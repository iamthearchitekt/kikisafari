// Foliage that looks like the real thing (owner: "the trees look dumb and fake … add leaves, make it look a bit more
// real … premium"): tapered, knobbly trunks with painted bark, forked branches, and thousands of individual leaves
// (one instanced mesh per cluster set, so it stays light on a phone), each a slightly different green and lighter
// where the light hits; ferns with real fronds (leaflets in pairs along a curving stem); leafy bushes.
import * as THREE from '../vendor/three.module.min.js';
import { rng } from './core.js';

const C = h => new THREE.Color(h);

// ---------- bark ----------
let barkTex = null;
/** A bark texture (colour, also used as its bump map): long wavy grooves, lighter ridges, flecks and a little moss. */
export function bark() {
  if (barkTex) return barkTex;
  const W = 256, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'), r = rng(42);
  const g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, '#3b2618'); g.addColorStop(0.5, '#4f3321'); g.addColorStop(1, '#3b2618'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 70; i++) { // grooves and ridges running up the trunk
    const x0 = r.next() * W, w = 1 + r.next() * 4, dark = r.next() < 0.6;
    x.strokeStyle = dark ? `rgba(18,10,6,${0.35 + r.next() * 0.4})` : `rgba(140,104,72,${0.18 + r.next() * 0.22})`; x.lineWidth = w; x.beginPath();
    let px = x0; x.moveTo(px, 0); for (let y = 0; y <= H; y += 16) { px += (r.next() - 0.5) * 6; x.lineTo(px, y); } x.stroke();
    for (const dx of [-W, W]) { x.save(); x.translate(dx, 0); x.stroke(); x.restore(); }
  }
  for (let i = 0; i < 900; i++) { x.fillStyle = r.next() < 0.5 ? 'rgba(20,12,8,0.35)' : 'rgba(150,118,86,0.25)'; x.fillRect(r.next() * W, r.next() * H, 1 + r.next() * 2, 2 + r.next() * 5); }
  for (let i = 0; i < 14; i++) { const mx = r.next() * W, my = H * (0.7 + r.next() * 0.3), gr = x.createRadialGradient(mx, my, 0, mx, my, 18 + r.next() * 22); gr.addColorStop(0, 'rgba(70,120,50,0.55)'); gr.addColorStop(1, 'rgba(70,120,50,0)'); x.fillStyle = gr; x.fillRect(mx - 40, my - 40, 80, 80); }
  barkTex = new THREE.CanvasTexture(c); barkTex.colorSpace = THREE.SRGBColorSpace; barkTex.wrapS = barkTex.wrapT = THREE.RepeatWrapping; barkTex.anisotropy = 4;
  return barkTex;
}
let barkMat = null;
export const barkMaterial = () => barkMat || (barkMat = new THREE.MeshStandardMaterial({ map: bark(), bumpMap: bark(), bumpScale: 3, roughness: 0.95, color: 0xffffff }));

/** A tube that tapers from r0 to r1 along a curve, a little knobbly, with bark-friendly UVs. */
export function taperedTube(curve, r0, r1, segs = 28, radial = 12, wobble = 0.07, seed = 1) {
  const frames = curve.computeFrenetFrames(segs, false), len = curve.getLength(), pos = [], uv = [], idx = [], r = rng(seed), ph = r.next() * 10;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, p = curve.getPointAt(t), N = frames.normals[i], B = frames.binormals[i], rad = r0 + (r1 - r0) * Math.pow(t, 0.75);
    for (let j = 0; j <= radial; j++) {
      const a = j / radial * Math.PI * 2, k = 1 + wobble * (Math.sin(a * 3 + t * 9 + ph) * 0.6 + Math.sin(a * 7 - t * 21 + ph) * 0.4), cx = Math.cos(a) * rad * k, sx = Math.sin(a) * rad * k;
      pos.push(p.x + cx * N.x + sx * B.x, p.y + cx * N.y + sx * B.y, p.z + cx * N.z + sx * B.z);
      uv.push(j / radial * Math.max(1, Math.round(r0 * 6)), t * len / Math.max(0.2, r0 * 4));
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) { const a = i * (radial + 1) + j, b = a + radial + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// ---------- leaves ----------
let leafGeo = null;
/** One leaf, 1 unit long along +z: a pointed oval folded along its midrib, darker at the stalk, lighter at the tip. */
export function leafCard() {
  if (leafGeo) return leafGeo;
  const base = C(0x2a6a2c), tip = C(0x9be36a), edge = C(0x4f9a3a);
  // [x, y, z]: the midrib (x = 0) is raised a little (the fold); the edges droop
  const P = [[0, 0, 0], [0, 0.014, 0.33], [0, 0.018, 0.66], [0, 0, 1],
    [-0.18, -0.02, 0.18], [-0.26, -0.035, 0.45], [-0.17, -0.025, 0.76],
    [0.18, -0.02, 0.18], [0.26, -0.035, 0.45], [0.17, -0.025, 0.76]];
  const pts = [], col = [];
  for (const [x, y, z] of P) { pts.push(x, y, z); const c = base.clone().lerp(tip, z).lerp(edge, x ? 0.25 : 0); col.push(c.r, c.g, c.b); }
  const idx = [0, 4, 1, 4, 5, 1, 1, 5, 2, 5, 6, 2, 2, 6, 3, // left half (midrib 0..3, left edge 4..6)
    0, 1, 7, 7, 1, 8, 1, 2, 8, 8, 2, 9, 2, 3, 9]; // right half (right edge 7..9)
  leafGeo = new THREE.BufferGeometry(); leafGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); leafGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); leafGeo.setIndex(idx); leafGeo.computeVertexNormals();
  return leafGeo;
}
let leafMat = null;
// matte (Lambert) shading: leaves look the same as with full PBR, and it costs much less on a phone with thousands of them
export const leafMaterial = () => leafMat || (leafMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));

/**
 * Many leaves in one mesh. clusters: [{ c: Vector3 centre, r: [rx, ry, rz] radii, n: count, size }]. Leaves sit mostly
 * near each cluster's surface pointing outwards, and are lighter on top and outside (where the light reaches).
 */
export function leafMass(clusters, { seed = 7, dark = 0x1f5a2a, light = 0xa8e870, tint = null } = {}) {
  const n = clusters.reduce((a, c) => a + c.n, 0), mesh = new THREE.InstancedMesh(leafCard(), leafMaterial(), n), r = rng(seed);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), dir = new THREE.Vector3(), up = new THREE.Vector3(0, 0, 1), twist = new THREE.Quaternion(), col = new THREE.Color();
  const D = C(dark), Lt = C(light), T = tint ? C(tint) : null; let i = 0;
  for (const cl of clusters) for (let k = 0; k < cl.n; k++) {
    dir.set(r.next() * 2 - 1, r.next() * 2 - 1, r.next() * 2 - 1); if (dir.lengthSq() > 1 || dir.lengthSq() < 0.01) { k--; continue; } dir.normalize();
    const depth = 0.55 + 0.45 * Math.sqrt(r.next());
    p.set(cl.c.x + dir.x * cl.r[0] * depth, cl.c.y + dir.y * cl.r[1] * depth, cl.c.z + dir.z * cl.r[2] * depth);
    // point the leaf outwards and a little down (leaves hang), then spin it about its own length
    const out = dir.clone(); out.y -= 0.35 + r.next() * 0.3; out.normalize();
    q.setFromUnitVectors(up, out); twist.setFromAxisAngle(out, r.next() * Math.PI * 2); q.premultiply(twist);
    s.setScalar(cl.size * (0.75 + r.next() * 0.5)); m.compose(p, q, s); mesh.setMatrixAt(i, m);
    const lit = Math.min(1, Math.max(0, 0.45 + dir.y * 0.35 + (depth - 0.75) * 1.2 + (r.next() - 0.5) * 0.35));
    col.copy(D).lerp(Lt, lit); if (T && r.next() < 0.18) col.lerp(T, 0.35); mesh.setColorAt(i, col); i++;
  }
  mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

// ---------- a tree ----------
/**
 * A tree: root flare, a trunk that bends (lean: sideways drift over its height), a few forked branches, and leaf clusters
 * on the branch tips and crown. Feet at y = 0. Returns { group, tips } (tips: where leaves are, for vines and such).
 */
export function realTree({ h = 6, r0 = 0.45, lean = 0, seed = 1, leaves = 1, crownWidth = 3, aim = null, spread = Math.PI, keep = () => true } = {}) {
  const g = new THREE.Group(), r = rng(seed), bm = barkMaterial(), clusters = [], tips = [];
  const trunkPts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; trunkPts.push(new THREE.Vector3(lean * Math.sin(t * 1.3) + Math.sin(t * 5 + seed) * 0.08 * h * 0.1, t * h, Math.sin(t * 3 + seed) * 0.12)); }
  const trunk = new THREE.CatmullRomCurve3(trunkPts);
  g.add(new THREE.Mesh(taperedTube(trunk, r0, r0 * 0.38, 36, 14, 0.09, seed), bm));
  for (let i = 0; i < 5; i++) { // roots flaring into the ground
    const a = i / 5 * Math.PI * 2 + r.next() * 0.6, len = r0 * (2.2 + r.next() * 1.4);
    const c = new THREE.CatmullRomCurve3([new THREE.Vector3(0, r0 * 1.4, 0), new THREE.Vector3(Math.cos(a) * len * 0.45, r0 * 0.35, Math.sin(a) * len * 0.45), new THREE.Vector3(Math.cos(a) * len, -0.05, Math.sin(a) * len)]);
    g.add(new THREE.Mesh(taperedTube(c, r0 * 0.42, r0 * 0.06, 10, 8, 0.05, seed + i), bm));
  }
  const branches = 4 + Math.round(r.next());
  for (let i = 0; i < branches; i++) {
    const t = 0.45 + 0.5 * (i / (branches - 1 || 1)), from = trunk.getPointAt(t), a = aim == null ? r.next() * Math.PI * 2 : aim + (r.next() - 0.5) * 2 * spread;
    const reach = crownWidth * (0.35 + r.next() * 0.3) * (1.1 - t * 0.4), rise = h * (0.12 + r.next() * 0.15);
    const mid = from.clone().add(new THREE.Vector3(Math.cos(a) * reach * 0.5, rise * 0.6, Math.sin(a) * reach * 0.35));
    const end = from.clone().add(new THREE.Vector3(Math.cos(a) * reach, rise, Math.sin(a) * reach * 0.7));
    const c = new THREE.CatmullRomCurve3([from, mid, end]);
    g.add(new THREE.Mesh(taperedTube(c, r0 * (0.42 - t * 0.18), r0 * 0.06, 14, 8, 0.06, seed + 10 + i), bm));
    tips.push(end);
    // a twig fork near the end
    const fork = c.getPointAt(0.65), fend = fork.clone().add(new THREE.Vector3(Math.cos(a + 0.9) * reach * 0.35, rise * 0.35, Math.sin(a + 0.9) * reach * 0.3));
    g.add(new THREE.Mesh(taperedTube(new THREE.CatmullRomCurve3([fork, fork.clone().lerp(fend, 0.5).add(new THREE.Vector3(0, 0.1, 0)), fend]), r0 * 0.09, r0 * 0.03, 8, 6, 0.04, seed + 20 + i), bm));
    tips.push(fend);
  }
  const top = trunk.getPointAt(1); tips.push(top);
  for (const tp of tips) clusters.push({ c: tp.clone().add(new THREE.Vector3(0, 0.25, 0)), r: [crownWidth * 0.26, crownWidth * 0.2, crownWidth * 0.24], n: Math.round(110 * leaves), size: 0.34 });
  clusters.push({ c: top.clone().add(new THREE.Vector3(0, crownWidth * 0.18, 0)), r: [crownWidth * 0.45, crownWidth * 0.3, crownWidth * 0.4], n: Math.round(260 * leaves), size: 0.38 });
  const kept = clusters.filter(cl => keep(cl.c)); if (kept.length) g.add(leafMass(kept, { seed: seed * 13 + 1 }));
  return { group: g, tips, trunk };
}

// ---------- ferns and bushes ----------
let frondGeo = null;
/** One fern frond, 1 unit long: a curving stem with pairs of leaflets that shrink towards the tip. */
export function frond() {
  if (frondGeo) return frondGeo;
  const leaf = leafCard(), lp = leaf.attributes.position, lc = leaf.attributes.color, li = leaf.index.array, pos = [], col = [], idx = [];
  const spine = t => new THREE.Vector3(0, Math.sin(t * Math.PI * 0.55) * 0.32 - t * t * 0.12, t); // arcs up, then droops
  const add = (mat, tint) => { const base = pos.length / 3, v = new THREE.Vector3(); for (let i = 0; i < lp.count; i++) { v.fromBufferAttribute(lp, i).applyMatrix4(mat); pos.push(v.x, v.y, v.z); col.push(lc.getX(i) * tint, lc.getY(i) * tint, lc.getZ(i) * tint); } for (const k of li) idx.push(base + k); };
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), e = new THREE.Euler();
  for (let i = 0; i < 18; i++) {
    const t = 0.08 + i / 18 * 0.9, p = spine(t), tan = spine(t + 0.01).sub(p).normalize(), size = 0.2 * (1 - t * 0.75);
    for (const side of [-1, 1]) {
      e.set(0, side * (1.15 - t * 0.4), 0); q.setFromEuler(e); const d = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan); q.premultiply(d);
      s.set(size * 0.75, size, size); m.compose(p, q, s); add(m, 0.85 + t * 0.25);
    }
  }
  // the stem: a thin strip
  for (let i = 0; i < 12; i++) { const t0 = i / 12, t1 = (i + 1) / 12, a = spine(t0), b = spine(t1), base = pos.length / 3, w = 0.008 * (1 - t0 * 0.7);
    pos.push(a.x - w, a.y, a.z, a.x + w, a.y, a.z, b.x - w, b.y, b.z, b.x + w, b.y, b.z); for (let k = 0; k < 4; k++) col.push(0.2, 0.42, 0.18); idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3); }
  frondGeo = new THREE.BufferGeometry(); frondGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); frondGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); frondGeo.setIndex(idx); frondGeo.computeVertexNormals();
  return frondGeo;
}
/** A fern: 9 to 12 fronds fanning up and out from one spot (one instanced mesh). */
export function realFern(size = 1, seed = 3) {
  const r = rng(seed), n = 9 + Math.round(r.next() * 3), mesh = new THREE.InstancedMesh(frond(), leafMaterial(), n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), col = new THREE.Color();
  for (let i = 0; i < n; i++) {
    e.set(-(0.15 + r.next() * 0.45), i / n * Math.PI * 2 + r.next() * 0.4, 0, 'YXZ'); q.setFromEuler(e);
    s.setScalar(size * (0.75 + r.next() * 0.45)); m.compose(new THREE.Vector3(), q, s); mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, col.setHSL(0.27 + r.next() * 0.05, 0.55, 0.55 + r.next() * 0.2));
  }
  mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; return mesh;
}
/** A leafy bush: a few overlapping clusters of leaves on short twigs, with flowers. */
export function realBush(rad = 0.6, flowers = null, seed = 5) {
  const g = new THREE.Group(), r = rng(seed), clusters = [];
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + r.next(); clusters.push({ c: new THREE.Vector3(Math.cos(a) * rad * 0.45, rad * (0.35 + r.next() * 0.3), Math.sin(a) * rad * 0.35), r: [rad * 0.5, rad * 0.42, rad * 0.45], n: 45, size: rad * 0.36 }); }
  clusters.push({ c: new THREE.Vector3(0, rad * 0.75, 0), r: [rad * 0.55, rad * 0.45, rad * 0.5], n: 60, size: rad * 0.38 });
  g.add(leafMass(clusters, { seed: seed * 7, dark: 0x1a4f26, light: 0x96dc62 }));
  if (flowers) {
    const fm = new THREE.MeshStandardMaterial({ color: flowers, emissive: flowers, emissiveIntensity: 0.2, roughness: 0.5 }), mid = new THREE.MeshBasicMaterial({ color: 0xffe066 });
    for (let i = 0; i < 9; i++) { const a = r.next() * Math.PI * 2, y = rad * (0.5 + r.next() * 0.55), f = new THREE.Group(); f.position.set(Math.cos(a) * rad * 0.75, y, Math.sin(a) * rad * 0.6 + rad * 0.12); f.lookAt(f.position.clone().multiplyScalar(2)); g.add(f);
      for (let p = 0; p < 5; p++) { const pa = p / 5 * Math.PI * 2, pt = new THREE.Mesh(new THREE.SphereGeometry(rad * 0.045, 6, 4), fm); pt.scale.set(1, 1, 0.4); pt.position.set(Math.cos(pa) * rad * 0.05, Math.sin(pa) * rad * 0.05, 0); f.add(pt); }
      const c = new THREE.Mesh(new THREE.SphereGeometry(rad * 0.03, 6, 4), mid); c.position.z = rad * 0.01; f.add(c); }
  }
  return g;
}
