// A meadow to stand in (premium 3D, part 2): the backdrop for battles and for catches with AR off. A sky dome with soft
// clouds (stars at night), a lit grass ground, a carpet of real grass blades and wildflowers that leaves the Kikis'
// spots clear, a ring of real trees and bushes in the distance, and fireflies at night. Moods: 'day', 'night', 'raid'.
import * as THREE from '../vendor/three.module.min.js';
import { rng } from './core.js';
import { realTree, realBush, lawn } from './foliage.js';

const MOODS = {
  day: { top: 0x5eb2ff, horizon: 0xe2f4ff, ground: 0x4f9638, groundDark: 0x2f6a26, cloud: '255,255,255', fog: 0xd8efff, stars: 0, fireflies: 0 },
  night: { top: 0x120d36, horizon: 0x433a8c, ground: 0x2a4a52, groundDark: 0x1b3340, cloud: '150,140,220', fog: 0x3a2f7a, stars: 260, fireflies: 40 },
  raid: { top: 0x12062e, horizon: 0x6a2ad0, ground: 0x2c2458, groundDark: 0x1c173e, cloud: '200,120,255', fog: 0x4a1fa0, stars: 320, fireflies: 60 },
};
const soft = (stops, w = 128, h = 128) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'), g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.min(w, h) / 2); for (const [o, col] of stops) g.addColorStop(o, col); x.fillStyle = g; x.fillRect(0, 0, w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
function cloudTex(rgb) { // a soft cumulus: overlapping puffs, brighter on top
  const W = 256, H = 128, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'), r = rng(5);
  for (let i = 0; i < 14; i++) { const cx = 40 + r.next() * 176, cy = 60 + r.next() * 30 - Math.sin((cx - 40) / 176 * Math.PI) * 26, rad = 22 + r.next() * 26, g = x.createRadialGradient(cx, cy - rad * 0.2, 0, cx, cy, rad); g.addColorStop(0, `rgba(${rgb},0.95)`); g.addColorStop(0.6, `rgba(${rgb},0.55)`); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.beginPath(); x.arc(cx, cy, rad, 0, 7); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function groundTex(m) { // painted ground: grass strokes, clover, a few petals
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'), r = rng(11), base = new THREE.Color(m.ground), dark = new THREE.Color(m.groundDark);
  x.fillStyle = '#' + base.getHexString(); x.fillRect(0, 0, S, S);
  for (let i = 0; i < 26; i++) { const px = r.next() * S, py = r.next() * S, rad = 14 + r.next() * 30, g = x.createRadialGradient(px, py, 0, px, py, rad); g.addColorStop(0, `rgba(${Math.round(dark.r * 255)},${Math.round(dark.g * 255)},${Math.round(dark.b * 255)},0.45)`); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(px - rad, py - rad, rad * 2, rad * 2); }
  for (let i = 0; i < 1400; i++) { const px = r.next() * S, py = r.next() * S, h = 3 + r.next() * 6, k = r.next(); const col = base.clone().lerp(k < 0.5 ? new THREE.Color(0xffffff) : dark, k < 0.5 ? 0.25 : 0.5); x.strokeStyle = '#' + col.getHexString(); x.globalAlpha = 0.6; x.lineWidth = 1.2; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (r.next() - 0.5) * 3, py - h); x.stroke(); }
  x.globalAlpha = 1; const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
/** Wildflowers in one go: stems, petals and centres as three instanced meshes. */
function flowers(spots, r) {
  const g = new THREE.Group(), n = spots.length, petals = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 7, 5), new THREE.MeshStandardMaterial({ roughness: 0.5 }), n * 5);
  const mids = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffd23f }), n), stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.5, 0.7, 1, 5), new THREE.MeshLambertMaterial({ color: 0x2f8f3a }), n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color(), cols = [0xff8fc8, 0xfff27a, 0x9fd8ff, 0xffffff, 0xc4a8ff, 0xff9a5c];
  spots.forEach((sp, i) => {
    const h = sp.h, top = new THREE.Vector3(sp.x, sp.y + h, sp.z), pc = cols[Math.floor(r.next() * cols.length)];
    m.compose(p.set(sp.x, sp.y + h / 2, sp.z), q.identity(), s.set(0.012, h, 0.012)); stems.setMatrixAt(i, m);
    m.compose(top, q.identity(), s.setScalar(0.022)); mids.setMatrixAt(i, m);
    for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 + i; m.compose(p.set(top.x + Math.cos(a) * 0.035, top.y, top.z + Math.sin(a) * 0.035), q.identity(), s.set(0.03, 0.012, 0.03)); petals.setMatrixAt(i * 5 + k, m); petals.setColorAt(i * 5 + k, col.set(pc)); }
  });
  for (const x of [petals, mids, stems]) x.instanceMatrix.needsUpdate = true; petals.instanceColor.needsUpdate = true;
  g.add(stems, petals, mids); return g;
}

/**
 * The meadow, centred on (0, y, 0). keepClear: [{ x, z, r }] spots left bare (where Kikis stand). grassRadius: how far
 * the grass carpet reaches. treeRing: [near, far] radius of the trees. Returns { group, fog, update(dt, t) }.
 */
export function meadow({ mood = 'day', y = 0, keepClear = [], grassRadius = 7, treeRing = [14, 22], trees = 10, seed = 3, density = 9 } = {}) {
  const M = MOODS[mood] || MOODS.day, r = rng(seed), group = new THREE.Group(); group.position.y = y;
  // sky dome
  const R = 70, sky = new THREE.SphereGeometry(R, 32, 16), sp = sky.attributes.position, sc = [], top = new THREE.Color(M.top), hor = new THREE.Color(M.horizon);
  for (let i = 0; i < sp.count; i++) { const k = Math.max(0, sp.getY(i) / R), c = hor.clone().lerp(top, Math.pow(k, 0.55)); sc.push(c.r, c.g, c.b); }
  sky.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3));
  const dome = new THREE.Mesh(sky, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false })); dome.renderOrder = -10; group.add(dome);
  if (mood === 'day') { const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft([[0, 'rgba(255,250,225,1)'], [0.15, 'rgba(255,240,200,0.8)'], [1, 'rgba(255,230,180,0)']]), fog: false, depthWrite: false, transparent: true })); sun.scale.setScalar(26); sun.position.set(-30, 34, -40); group.add(sun); }
  else { const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft([[0, 'rgba(255,250,240,1)'], [0.12, 'rgba(230,220,255,0.9)'], [0.2, 'rgba(180,160,255,0.35)'], [1, 'rgba(120,90,255,0)']]), fog: false, depthWrite: false, transparent: true })); moon.scale.setScalar(20); moon.position.set(26, 30, -42); group.add(moon); }
  const ct = cloudTex(M.cloud), clouds = [];
  for (let i = 0; i < 7; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ct, fog: false, depthWrite: false, transparent: true, opacity: mood === 'day' ? 0.9 : 0.35 })); const a = r.next() * Math.PI * 2, d = 45 + r.next() * 15; s.position.set(Math.cos(a) * d, 12 + r.next() * 14, Math.sin(a) * d); s.scale.set(26 + r.next() * 14, 11 + r.next() * 5, 1); group.add(s); clouds.push(s); }
  if (M.stars) { const n = M.stars, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = r.next() * Math.PI * 2, e = 0.08 + r.next() * 1.4; pos[i * 3] = Math.cos(a) * Math.cos(e) * 66; pos[i * 3 + 1] = Math.sin(e) * 66; pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * 66; } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); group.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, fog: false, transparent: true, opacity: 0.9 }))); }
  // ground
  const gt = groundTex(M); gt.repeat.set(24, 24);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(80, 48), new THREE.MeshLambertMaterial({ map: gt })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.005; group.add(ground);
  // grass carpet and wildflowers, leaving the Kikis' spots clear
  const clear = (x, z) => keepClear.some(k => Math.hypot(x - k.x, z - k.z) < k.r);
  const clumps = [], spots = [];
  for (let i = 0; i < grassRadius * grassRadius * density; i++) {
    const a = r.next() * Math.PI * 2, d = Math.sqrt(r.next()) * grassRadius, x = Math.cos(a) * d, z = Math.sin(a) * d; if (clear(x, z)) continue;
    clumps.push({ x, y: 0, z, r: 0.12, n: 5 + Math.round(r.next() * 4), h: 0.12 + r.next() * 0.16 + (d / grassRadius) * 0.08 });
    if (r.next() < 0.09) spots.push({ x: x + 0.05, y: 0, z: z + 0.05, h: 0.12 + r.next() * 0.12 });
  }
  if (mood !== 'day') { // night: the grass picks up the moonlight
    const nightGrass = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, color: mood === 'raid' ? 0x8a7ad0 : 0x7aa8b8 }); group.add(lawn(clumps, nightGrass));
  } else group.add(lawn(clumps));
  if (spots.length) group.add(flowers(spots, r));
  // the tree line, with bushes in front
  for (let i = 0; i < trees; i++) {
    const a = i / trees * Math.PI * 2 + r.next() * 0.4, d = treeRing[0] + r.next() * (treeRing[1] - treeRing[0]);
    const { group: t } = realTree({ h: 5 + r.next() * 4, r0: 0.3 + r.next() * 0.15, lean: (r.next() - 0.5) * 0.8, seed: 50 + i, leaves: 0.42, crownWidth: 3.6 + r.next() * 1.4 });
    t.position.set(Math.cos(a) * d, 0, Math.sin(a) * d); t.rotation.y = r.next() * 6.28; group.add(t);
    const b = realBush(0.7 + r.next() * 0.5, r.next() < 0.5 ? [0xff8fc8, 0xfff27a, 0x9fd8ff][i % 3] : null, 80 + i); const a2 = a + Math.PI / trees; b.position.set(Math.cos(a2) * (treeRing[0] - 2), 0, Math.sin(a2) * (treeRing[0] - 2)); group.add(b);
  }
  // fireflies (night and raids)
  let flies = null, base = null;
  if (M.fireflies) {
    const n = M.fireflies, pos = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = r.next() * Math.PI * 2, d = 2 + r.next() * grassRadius * 1.4; pos[i * 3] = Math.cos(a) * d; pos[i * 3 + 1] = 0.3 + r.next() * 1.8; pos[i * 3 + 2] = Math.sin(a) * d; }
    base = pos.slice(); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    flies = new THREE.Points(g, new THREE.PointsMaterial({ map: soft([[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,0.5)'], [1, 'rgba(255,255,255,0)']], 32, 32), color: mood === 'raid' ? 0xff9ae6 : 0xfff27a, size: 0.18, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); group.add(flies);
  }
  return {
    group, fog: M.fog,
    update(dt, t) {
      for (const c of clouds) { c.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), dt * 0.004); }
      if (flies) { const p = flies.geometry.attributes.position; for (let i = 0; i < p.count; i++) { p.setX(i, base[i * 3] + Math.sin(t * 0.6 + i) * 0.4); p.setY(i, base[i * 3 + 1] + Math.sin(t * 1.1 + i * 2.3) * 0.25); p.setZ(i, base[i * 3 + 2] + Math.cos(t * 0.5 + i * 1.7) * 0.4); } p.needsUpdate = true; flies.material.opacity = 0.65 + Math.sin(t * 2.2) * 0.3; }
    },
  };
}

/** A carved stone dais for a battle (premium part 2): a bevelled stone disc with a glowing inlaid ring. */
let stoneTex = null;
function stoneTexture() {
  if (stoneTex) return stoneTex;
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'), r = rng(9);
  x.fillStyle = '#9a96a8'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 2600; i++) { const v = 120 + Math.floor(r.next() * 70); x.fillStyle = `rgba(${v},${v - 4},${v + 10},0.35)`; x.fillRect(r.next() * S, r.next() * S, 1 + r.next() * 3, 1 + r.next() * 3); }
  for (let i = 0; i < 18; i++) { x.strokeStyle = 'rgba(60,56,72,0.35)'; x.lineWidth = 1; x.beginPath(); let px = r.next() * S, py = r.next() * S; x.moveTo(px, py); for (let k = 0; k < 5; k++) { px += (r.next() - 0.5) * 40; py += (r.next() - 0.5) * 40; x.lineTo(px, py); } x.stroke(); }
  for (let i = 0; i < 10; i++) { const px = r.next() * S, py = r.next() * S, g = x.createRadialGradient(px, py, 0, px, py, 24); g.addColorStop(0, 'rgba(90,140,70,0.35)'); g.addColorStop(1, 'rgba(90,140,70,0)'); x.fillStyle = g; x.fillRect(px - 24, py - 24, 48, 48); }
  stoneTex = new THREE.CanvasTexture(c); stoneTex.colorSpace = THREE.SRGBColorSpace; stoneTex.wrapS = stoneTex.wrapT = THREE.RepeatWrapping; return stoneTex;
}
export function dais(radius, glow = 0x8fd8ff) {
  const g = new THREE.Group(), tex = stoneTexture(), mat = new THREE.MeshStandardMaterial({ map: tex, bumpMap: tex, bumpScale: 2, roughness: 0.85, color: 0xffffff });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.06, 0.1, 48), mat); base.position.y = 0.0; g.add(base);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.93, radius, 0.04, 48), mat); top.position.y = 0.07; g.add(top);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.72, radius * 0.025, 8, 64), new THREE.MeshStandardMaterial({ color: glow, emissive: glow, emissiveIntensity: 1.4, roughness: 0.3 })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.092; g.add(ring);
  const halo = new THREE.Mesh(new THREE.RingGeometry(radius * 0.6, radius * 0.86, 64), new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending })); halo.rotation.x = -Math.PI / 2; halo.position.y = 0.094; g.add(halo);
  g.userData = { ring, halo }; return g;
}
