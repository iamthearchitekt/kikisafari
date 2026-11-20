// The title screen (owner: "cosmic purple portal style", with underbrush in the foreground and trees framing the sides
// and top; "just the one main Kiki"; then "enhance that 3D scene with some subtle detail and lighting effects from the
// back like purple portal … add more plants to fill up the foreground"): a swirling portal in a forest clearing at
// night. The portal lights the scene from behind (a purple rim on Kiki and the plants, slow light rays, a halo, a pool
// of light on the ground, drifting magic dust and low mist). Kiki pops out of the portal, lands in the clearing and
// waves and dances; ferns, bushes, grass, wildflowers and glowing mushrooms fill the foreground; trees and a leafy
// canopy frame the edges.
import * as THREE from '../vendor/three.module.min.js';
import { makeKiki, KikiMotion, makePortal, Sparkles, leafGeometry, plush } from './art.js';
import { liveStage } from './ui.js';
import { realTree, realFern, realBush, leafMass, taperedTube, barkMaterial } from './foliage.js';
import { light } from './lux.js';
import { reducedMotion } from './services.js';

const C = h => new THREE.Color(h);
const LEAF = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }); // grass and leaves: matte, cheap
function vgrad(geo, a, b, y0, y1) {
  const p = geo.attributes.position, cols = [];
  for (let i = 0; i < p.count; i++) { const t = Math.max(0, Math.min(1, (p.getY(i) - y0) / (y1 - y0))); const c = C(a).lerp(C(b), t); cols.push(c.r, c.g, c.b); }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); return geo;
}
/** A tuft of grass blades. */
function grass(h, dark = 0x123f26, light = 0x6fd65a) {
  const g = new THREE.Group();
  for (let i = 0; i < 7; i++) { const m = new THREE.Mesh(blade(), LEAF); m.scale.setScalar(h * (0.7 + (i % 3) * 0.22)); m.rotation.set(-(Math.PI / 2 - 0.3 - (i % 3) * 0.16), i / 7 * Math.PI * 2 + i * 0.3, 0, 'YXZ'); g.add(m); }
  return g;
}
/** One grass blade: a thin tapering strip (8 points), dark at the root and bright at the tip, pointing up +z like a leaf. */
let bladeGeo = null;
function blade() {
  if (bladeGeo) return bladeGeo;
  const pos = [], col = [], idx = [], a = C(0x123f26), b = C(0x7fe05a);
  for (let i = 0; i < 4; i++) { const t = i / 3, w = 0.07 * (1 - t) + 0.004, bend = -0.18 * t * t; pos.push(-w, bend, t, w, bend, t); const c = a.clone().lerp(b, t); col.push(c.r, c.g, c.b, c.r, c.g, c.b); }
  for (let i = 0; i < 3; i++) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  bladeGeo = new THREE.BufferGeometry(); bladeGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); bladeGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); bladeGeo.setIndex(idx); bladeGeo.computeVertexNormals();
  return bladeGeo;
}
/** A carpet of grass: hundreds of blades in clumps, drawn in one go (one instanced mesh, light on the phone). */
function lawn(clumps) {
  const blades = clumps.reduce((a, c) => a + c.n, 0), mesh = new THREE.InstancedMesh(blade(), LEAF, blades);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(); let i = 0;
  for (const c of clumps) for (let k = 0; k < c.n; k++) {
    const a = Math.random() * Math.PI * 2, r = Math.random() * c.r;
    v.set(c.x + Math.cos(a) * r, c.y, c.z + Math.sin(a) * r); e.set(-(Math.PI / 2 - 0.25 - Math.random() * 0.4), Math.random() * Math.PI * 2, 0, 'YXZ'); q.setFromEuler(e);
    sc.setScalar(c.h * (0.6 + Math.random() * 0.6)); m.compose(v, q, sc); mesh.setMatrixAt(i++, m);
  }
  mesh.instanceMatrix.needsUpdate = true; return mesh;
}
/** A wildflower: a stem, two leaves and a little round flower. */
function flower(h, petal) {
  const g = new THREE.Group(), stemM = plush({ color: 0x2f8f3a, roughness: 0.7 }, 0.2);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, h, 6), stemM); stem.position.y = h / 2; g.add(stem);
  for (const s of [-1, 1]) { const l = new THREE.Mesh(leafGeometry(0.25, 0.8, 0x1f6a30, 0x7fd65a, true), LEAF); l.scale.setScalar(h * 0.35); l.position.y = h * (0.25 + (s + 1) * 0.1); l.rotation.set(-0.5, s * 1.6, 0, 'YXZ'); g.add(l); }
  const head = new THREE.Group(); head.position.y = h; head.rotation.x = 0.5; g.add(head);
  const pm = new THREE.MeshStandardMaterial({ color: petal, emissive: petal, emissiveIntensity: 0.25, roughness: 0.5 });
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, pt = new THREE.Mesh(new THREE.SphereGeometry(h * 0.11, 8, 6), pm); pt.scale.set(1, 0.45, 1); pt.position.set(Math.cos(a) * h * 0.12, 0, Math.sin(a) * h * 0.12); head.add(pt); }
  const mid = new THREE.Mesh(new THREE.SphereGeometry(h * 0.075, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd23f })); mid.position.y = h * 0.03; head.add(mid);
  return g;
}
/** A glowing mushroom (or a little cluster of them), lit from inside like the Glowcap Kikis. */
function mushrooms(h, cap) {
  const g = new THREE.Group(), stemM = plush({ color: 0xf3e9ff, roughness: 0.6 }, 0.3), capM = new THREE.MeshStandardMaterial({ color: cap, emissive: cap, emissiveIntensity: 0.85, roughness: 0.35 });
  for (let i = 0; i < 3; i++) {
    const k = [1, 0.62, 0.45][i], m = new THREE.Group(); m.position.set([0, 0.2, -0.16][i] * h * 2, 0, [0, 0.1, 0.12][i] * h * 2); m.rotation.z = [0, -0.2, 0.25][i]; g.add(m);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(h * k * 0.11, h * k * 0.15, h * k, 10), stemM); stem.position.y = h * k / 2; m.add(stem);
    const c = new THREE.Mesh(new THREE.SphereGeometry(h * k * 0.42, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), capM); c.scale.y = 0.7; c.position.y = h * k * 0.92; m.add(c);
    for (let j = 0; j < 5; j++) { const a = j * 1.3 + i, d = new THREE.Mesh(new THREE.SphereGeometry(h * k * 0.05, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff })); d.position.set(Math.cos(a) * h * k * 0.26, h * k * (0.92 + 0.2), Math.sin(a) * h * k * 0.26); m.add(d); }
  }
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: radial([[0, '#ffffffaa'], [1, '#ffffff00']]), color: cap, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(h * 3.2); halo.position.y = h * 0.8; g.add(halo);
  return g;
}
/** A soft round glow texture (cached by its colour stops). */
const radials = new Map();
function radial(stops, size = 128) {
  const key = JSON.stringify(stops); if (radials.has(key)) return radials.get(key);
  const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) g.addColorStop(o, col); x.fillStyle = g; x.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; radials.set(key, t); return t;
}
/** A real tree leaning in from the side of the screen: bark, roots, forked branches, a full crown of leaves, and two
 * vines (with leaves along them) draping from the crown and swinging off the side of the screen. */
function tree(h, side, seed, keep) {
  // branches reach outwards and a little towards you; leaves stay off the portal and Kiki (keep)
  const { group: g } = realTree({ h, r0: 0.5, lean: -side * 0.75, seed, crownWidth: 3.0, leaves: 1, aim: side > 0 ? 0.45 : Math.PI - 0.45, spread: 1.0, keep });
  for (let v = 0; v < 2; v++) {
    const drop = 2.4 + v * 1.6, inward = 1.5 + v * 0.5, vine = [];
    for (let i = 0; i <= 24; i++) { const t = i / 24; vine.push(new THREE.Vector3(side * (-inward * (1 - t) + 1.2 * t), h - 0.3 - t * drop - Math.sin(t * Math.PI) * 0.7, 0.6 + v * 0.2)); }
    const curve = new THREE.CatmullRomCurve3(vine);
    g.add(new THREE.Mesh(taperedTube(curve, 0.05, 0.03, 48, 6, 0.1, seed + v), new THREE.MeshStandardMaterial({ color: 0x2f5a2a, roughness: 0.85 })));
    const clusters = []; for (let i = 1; i < 12; i++) { const p = curve.getPointAt(i / 12); clusters.push({ c: p, r: [0.16, 0.12, 0.16], n: 7, size: 0.2 }); }
    g.add(leafMass(clusters, { seed: seed * 3 + v, dark: 0x1d5a2a, light: 0x8fd65a }));
  }
  return g;
}
/** The canopy across the top: leafy clusters overlapping into one ceiling of leaves. */
function canopy(width) {
  const clusters = [];
  for (let i = 0; i < 9; i++) clusters.push({ c: new THREE.Vector3((i / 8 - 0.5) * width, (i % 2) * 0.3, (i % 3) * 0.2), r: [0.95, 0.55, 0.6], n: 120, size: 0.36 });
  for (let i = 0; i < 12; i++) clusters.push({ c: new THREE.Vector3((i / 11 - 0.5) * width * 1.05, -0.55 - (i % 3) * 0.12, 0.55), r: [0.35, 0.3, 0.25], n: 28, size: 0.32 }); // leaves hanging lower at the front edge
  return leafMass(clusters, { seed: 99, dark: 0x163f22, light: 0x86d05a });
}

export function startTitle(host) {
  return liveStage(host, (scene, cam, renderer) => {
    light(renderer, scene, 'cosmic', 0.55); // the portal's purple in every reflection
    cam.fov = 55; cam.position.set(0, 0.2, 8); cam.lookAt(0, 0.1, 0); cam.updateProjectionMatrix();
    scene.add(new THREE.HemisphereLight(0xb89aff, 0x160b33, 0.75));
    const glow = new THREE.PointLight(0xa24dff, 30, 14, 1.6); glow.position.set(0, 0.5, -1.2); scene.add(glow);
    const warm = new THREE.DirectionalLight(0xffe6c0, 1.1); warm.position.set(2, 4, 8); scene.add(warm);
    // light from the portal behind: a purple rim on Kiki and the plants, and a magenta glow along the ground
    const back = new THREE.DirectionalLight(0xc27bff, 2.6); back.position.set(0, 2.4, -7); scene.add(back);
    const portal = makePortal(4.6); portal.position.set(0, 0.9, -2.6); portal.userData.target = 1; scene.add(portal);
    // a halo round the portal with light rays fanning out of it: painted once into one glowing image that slowly turns
    // (one layer to draw instead of ten, so it stays light on the phone)
    const glowTex = (() => {
      const S = 512, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'); x.globalCompositeOperation = 'lighter';
      const h = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); h.addColorStop(0, 'rgba(230,190,255,0.85)'); h.addColorStop(0.3, 'rgba(162,77,255,0.35)'); h.addColorStop(1, 'rgba(122,0,255,0)'); x.fillStyle = h; x.fillRect(0, 0, S, S);
      const cols = ['199,125,255', '255,122,217', '143,216,255'];
      for (let i = 0; i < 11; i++) {
        const a = i / 11 * Math.PI * 2 + (i % 2) * 0.13, len = S * (0.36 + (i % 3) * 0.06), w = 0.05 + (i % 2) * 0.035, g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, len);
        g.addColorStop(0, `rgba(${cols[i % 3]},0.34)`); g.addColorStop(0.45, `rgba(${cols[i % 3]},0.1)`); g.addColorStop(1, `rgba(${cols[i % 3]},0)`);
        x.fillStyle = g; x.beginPath(); x.moveTo(S / 2, S / 2); x.arc(S / 2, S / 2, len, a - w, a + w); x.closePath(); x.fill();
      }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(11, 11), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.position.set(0, 0.9, -2.45); scene.add(halo);
    // the forest floor: glowing purple near the portal, darker green out towards you, with a pool of light
    const groundGeo = new THREE.CircleGeometry(9, 64), gp = groundGeo.attributes.position, gcol = [];
    for (let i = 0; i < gp.count; i++) { const x = gp.getX(i), y = gp.getY(i), d = Math.hypot(x, y + 2.4), t = Math.min(1, d / 6.5), c = C(0x40285e).lerp(C(0x10291c), t); gcol.push(c.r, c.g, c.b); }
    groundGeo.setAttribute('color', new THREE.Float32BufferAttribute(gcol, 3));
    const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -1.08; scene.add(ground);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(7, 5), new THREE.MeshBasicMaterial({ map: radial([[0, '#e08cffcc'], [0.5, '#9a30ff44'], [1, '#7a00ff00']]), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(0, -1.06, -1.6); scene.add(pool);
    // low mist drifting across the clearing
    const mistTex = radial([[0, '#b98cffff'], [0.6, '#b98cff33'], [1, '#b98cff00']]), mists = [];
    for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 1.2), new THREE.MeshBasicMaterial({ map: mistTex, transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending })); m.position.set(-5 + i * 2.6, -0.85 + (i % 2) * 0.15, -1.2 + (i % 3) * 1.1); m.userData.v = 0.12 + (i % 3) * 0.05; scene.add(m); mists.push(m); }
    // magic dust: soft motes rising slowly out of the portal light
    const N = 110, dustPos = new Float32Array(N * 3), dustCol = new Float32Array(N * 3), dustV = [];
    const reseed = (i, fresh) => { dustPos[i * 3] = (Math.random() - 0.5) * 7; dustPos[i * 3 + 1] = fresh ? -1 + Math.random() * 4.5 : -1.1; dustPos[i * 3 + 2] = -2.2 + Math.random() * 4.5; dustV[i] = 0.08 + Math.random() * 0.22; const c = C([0xd9a8ff, 0xff9ae6, 0xfff27a, 0x9fe8ff][i % 4]); dustCol[i * 3] = c.r; dustCol[i * 3 + 1] = c.g; dustCol[i * 3 + 2] = c.b; };
    for (let i = 0; i < N; i++) reseed(i, true);
    const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3)); dustGeo.setAttribute('color', new THREE.BufferAttribute(dustCol, 3));
    const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ map: radial([[0, '#ffffffff'], [0.4, '#ffffff66'], [1, '#ffffff00']], 32), size: 0.09, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
    scene.add(dust);
    const sparkles = new Sparkles(scene);
    // the frame: trees, canopy and underbrush, placed to fit whatever shape the screen is
    const frame = new THREE.Group(); scene.add(frame);
    let parts = null, aspect = 0;
    const fit = () => {
      aspect = cam.aspect; frame.clear(); parts = [];
      const at = z => { const d = cam.position.z - z, hh = Math.tan(cam.fov * Math.PI / 360) * d; return { hh, hw: hh * cam.aspect }; };
      { const { hh, hw } = at(1); for (const s of [-1, 1]) { const px = s * (hw + 0.15), py = -hh - 1.2, t = tree(hh * 2.4, s, s > 0 ? 3 : 8, c => !(Math.abs(c.x + px) < 1.7 && c.y + py < hh * 0.62)); t.position.set(px, py, 1); frame.add(t); parts.push(t); } }
      { const { hh, hw } = at(1.8); const c = canopy(hw * 2.4); c.position.set(0, hh * 0.98, 1.8); frame.add(c); }
      { const { hh, hw } = at(3.2), n = Math.max(5, Math.round(hw * 2.2));
        for (let i = 0; i <= n; i++) { const x = (i / n - 0.5) * hw * 2.3, corner = Math.abs(x) > hw * 0.6, f = i % 2 ? realFern(corner ? 1.05 : 0.7, i + 1) : realBush(corner ? 0.8 : 0.5, [0xff8fc8, 0xfff27a, 0x9fd8ff][i % 3], i + 2);
          f.position.set(x, cam.position.y - hh - 0.15 + (corner ? 0.3 : 0), 3.2 + (i % 2) * 0.3); f.rotation.y = i * 0.7; frame.add(f); parts.push(f); }
        for (const s of [-1, 1]) { const f = realFern(1.1, s > 0 ? 21 : 22); f.position.set(s * hw * 1.02, cam.position.y - hh * 0.45, 2.8); f.rotation.z = s * 0.9; frame.add(f); } }
      // the clearing round Kiki: grass, wildflowers and glowing mushrooms (leaving Kiki's spot clear)
      { const { hw } = at(0.5), y = -1.08, caps = [0x4fd8ff, 0xff4fd8, 0xb46bff, 0x6dffb0];
        const spots = [[-1.0, 1.2], [1.15, 1.0], [-1.9, 0.2], [2.0, 0.4], [-2.6, -0.8], [2.5, -1.0], [-1.6, -1.6], [1.5, -1.7], [-0.7, 2.0], [0.8, 2.1], [-2.3, 1.7], [2.2, 1.9], [-3.2, 0.9], [3.1, 0.7]];
        spots.forEach(([x, z], i) => { if (Math.abs(x) > hw * 1.25) return;
          const t = grass(0.42 + (i % 3) * 0.1); t.position.set(x, y, z); t.rotation.y = i; frame.add(t);
          if (i % 3 === 0) { const f = flower(0.38 + (i % 2) * 0.1, ['#ff8fc8', '#fff27a', '#9fd8ff', '#ffffff'][i % 4]); f.position.set(x + 0.25, y, z + 0.15); f.rotation.y = i * 0.8; frame.add(f); }
          if (i % 4 === 1) { const m = mushrooms(0.32 + (i % 2) * 0.08, caps[i % 4]); m.position.set(x - 0.2, y, z - 0.1); m.rotation.y = i; frame.add(m); }
        }); }
      // a carpet of grass over the whole clearing, thicker and taller towards the edges, with a clear spot for Kiki
      { const clumps = [], y = -1.07;
        for (let z = -1.7; z <= 4.2; z += 0.32) { const { hw } = at(z); for (let x = -hw * 1.1; x <= hw * 1.1; x += 0.34) {
          const jx = x + (Math.random() - 0.5) * 0.25, jz = z + (Math.random() - 0.5) * 0.2, edge = Math.min(1, Math.abs(jx) / Math.max(0.5, hw));
          if (Math.abs(jx) < 0.75 && jz > -0.9 && jz < 1.6) continue; // Kiki's spot and the path in front of it
          if (Math.random() < 0.25) continue;
          clumps.push({ x: jx, y, z: jz, r: 0.14, n: 5 + Math.round(edge * 4), h: 0.16 + edge * 0.22 + (jz > 2.5 ? 0.06 : 0) });
        } }
        frame.add(lawn(clumps)); }
      // more flowers and glowing mushrooms down both sides, nearer to you
      { const y = -1.08;
        for (let i = 0; i < 12; i++) { const z = 0.4 + i * 0.3, { hw } = at(z), s = i % 2 ? 1 : -1, x = s * hw * (0.55 + (i % 3) * 0.14);
          if (i % 3 !== 2) { const f = flower(0.3 + (i % 2) * 0.08, ['#ff8fc8', '#fff27a', '#9fd8ff', '#c4a8ff'][i % 4]); f.position.set(x, y, z); f.rotation.y = i; frame.add(f); }
          else { const m = mushrooms(0.26, [0x4fd8ff, 0xff4fd8, 0xb46bff, 0x6dffb0][i % 4]); m.position.set(x, y, z); m.rotation.y = i; frame.add(m); } } }
      // the foreground in front of you: more grass, flowers and mushrooms between the ferns, and big leaves in the corners
      { const { hh, hw } = at(4.4), y = cam.position.y - hh, n = Math.max(6, Math.round(hw * 3));
        for (let i = 0; i <= n; i++) { const x = (i / n - 0.5) * hw * 2.2, t = grass(0.3 + (i % 3) * 0.08); t.position.set(x, y - 0.05, 4.4 + (i % 2) * 0.25); t.rotation.y = i * 1.3; frame.add(t);
          if (i % 3 === 1) { const f = flower(0.3, ['#ff8fc8', '#fff27a', '#c4a8ff'][i % 3]); f.position.set(x + 0.15, y - 0.05, 4.5); frame.add(f); }
          if (i % 4 === 2) { const m = mushrooms(0.22, [0x4fd8ff, 0xff4fd8, 0xb46bff][i % 3]); m.position.set(x - 0.1, y - 0.04, 4.3); m.rotation.y = i; frame.add(m); } }
        const { hh: h2, hw: w2 } = at(5.2);
        for (const s of [-1, 1]) for (let j = 0; j < 3; j++) { const l = new THREE.Mesh(leafGeometry(0.42, 0.75, 0x10462a, 0x5fc95a, true), LEAF); l.scale.setScalar(h2 * (0.32 + j * 0.06)); l.position.set(s * w2 * (1.02 + j * 0.02), cam.position.y - h2 * (1.02 - j * 0.1), 5.2 - j * 0.15); l.rotation.set(-(0.9 + j * 0.25), s * (-0.55 - j * 0.35), 0, 'YXZ'); frame.add(l); } }
    };
    // Kiki pops out of the portal and lands in the clearing, then waves and dances.
    const k = makeKiki('meadow', 1.35), m = new KikiMotion(k, reducedMotion), base = k.scale.x, home = new THREE.Vector3(0, -1.06, -0.2);
    k.visible = false; scene.add(k); const born = 0.7; let landed = false, fly = 0;
    return { update(dt, t) {
      if (cam.aspect !== aspect) fit();
      portal.userData.update(dt, t, cam); glow.intensity = 26 + Math.sin(t * 2) * 6;
      const calm = reducedMotion() ? 0.25 : 1;
      halo.rotation.z += dt * 0.05 * calm; halo.material.opacity = 0.6 + Math.sin(t * 1.3) * 0.12; back.intensity = 2.4 + Math.sin(t * 1.1) * 0.5;
      for (const m of mists) { m.position.x += m.userData.v * dt * calm; if (m.position.x > 6) m.position.x = -6; }
      for (let i = 0; i < N; i++) { dustPos[i * 3 + 1] += dustV[i] * dt * calm; dustPos[i * 3] += Math.sin(t * 0.7 + i) * 0.05 * dt; if (dustPos[i * 3 + 1] > 3.6) reseed(i, false); }
      dustGeo.attributes.position.needsUpdate = true;
      const age = t - born;
      if (age >= 0) {
        k.visible = true;
        if (age < 1.3) {
          const e = age / 1.3, from = portal.position.clone(); k.position.lerpVectors(from, home, e).y += Math.sin(e * Math.PI) * 1.4;
          k.scale.setScalar(base * Math.min(1, 0.15 + e * 1.2)); k.rotation.y = (1 - e) * Math.PI * 4;
          if (age - dt < 0) sparkles.burst(from.clone(), 26, 0xd9a8ff, 0.14, 1.6, 0.9);
        } else {
          if (!landed) { landed = true; k.position.copy(home); k.scale.setScalar(base); k.rotation.y = 0; m.play(m.wave()); sparkles.burst(home.clone().setY(-1.2), 18, 0xfff27a, 0.1, 1.0, 0.7); }
          k.rotation.y = Math.sin(t * 0.4) * 0.25;
          m.update(dt);
          if (!m.busy && Math.random() < dt * 0.18) m.play(Math.random() < 0.5 ? m.wave() : m.randomDance());
        }
      }
      if ((fly -= dt) <= 0) { fly = 0.25; sparkles.burst(new THREE.Vector3((Math.random() - 0.5) * 6, -1 + Math.random() * 3.5, -1 + Math.random() * 3), 1, Math.random() < 0.5 ? 0xfff27a : 0xc4ff9a, 0.09, 0.15, 2.2); }
      sparkles.update(dt);
    } };
  });
}
