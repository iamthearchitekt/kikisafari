// KIKI SAFARI art for the web, in three.js. Kiki is the claw game's makeMascot() (Big Plush), with the same tweaks as
// the Unity project's Core/Art: chubbier pear body, bigger grin, bolder mirrored spirals, a V-folded leaf fan, and the
// six variants' crowns, embroidery and glow. Plus the Rune Stone, the portal, Rune Circles and sparkles.
import * as THREE from '../vendor/three.module.min.js';
import { rng, hash } from './core.js';

export const EGG_H = 1.15, GROUND = EGG_H + 0.12, BODY_H = GROUND + EGG_H;
const C = h => new THREE.Color(h);
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------- looks (decisions doc, section 3) ----------
export function lookFor(id) {
  const base = { crown: 'canon', leaf: 0x38a626, tip: 0x92e25c, rainbow: false, gold: false, belly: false, stars: false, glow: false, scale: 1 };
  switch (id) {
    case 'pine': return { ...base, crown: 'pine', leaf: 0x1c6b2a, tip: 0x2e8b47 };
    case 'sprout': return { ...base, crown: 'seedling', leaf: 0x3fae2a, tip: 0x9be36a, scale: 0.78 };
    case 'rainbow': return { ...base, rainbow: true };
    case 'moonbeam': return { ...base, glow: true, stars: true, tip: 0x9fe6c8 };
    case 'golden-spiral': return { ...base, gold: true, belly: 'gold' };
    // Phase 1 evolutions: bigger, fuller crowns and an embroidered tummy spiral.
    case 'grand-meadow': return { ...base, crown: 'grand', leaf: 0x2f9e24, tip: 0xc4f27a, belly: 'leaf', scale: 1.1 };
    case 'elder-pine': return { ...base, crown: 'elder', leaf: 0x17552c, tip: 0xe9f6ff, belly: 'frost', scale: 1.12 };
    case 'bloom': return { ...base, crown: 'bloom', leaf: 0x3fae2a, tip: 0x9be36a, petal: 0xff6fae, petalTip: 0xffd6ea, scale: 0.92 };
    default: return base;
  }
}

// ---------- face texture and plush normal map (canvas, like the claw game) ----------
const CX = 512, EYE_Y = 190, EYE_DX = 66, SPIRAL_R = 38, MY = 250, MW = 98, MH = 56;
function spiralPath(g, x, y, R, dir, turns = 2.4) {
  g.beginPath();
  for (let i = 0; i <= 140; i++) { const t = i / 140, a = t * turns * Math.PI * 2 * dir, r = R * (0.1 + 0.9 * t); const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; i ? g.lineTo(px, py) : g.moveTo(px, py); }
}
function mouthPath(g, sx = 1, sy = 1) {
  const ox = CX, oy = MY + 22, T = (x, y) => [ox + (x - ox) * sx, oy + (y - oy) * sy];
  g.beginPath(); g.moveTo(...T(CX - MW, MY)); g.quadraticCurveTo(...T(CX, MY - 8), ...T(CX + MW, MY));
  g.bezierCurveTo(...T(CX + MW * 0.85, MY + MH * 1.3), ...T(CX - MW * 0.85, MY + MH * 1.3), ...T(CX - MW, MY)); g.closePath();
}
const texCache = new Map();
function faceTextures(look) {
  const key = (look.belly || '') + (look.stars ? 's' : '');
  const BELLY = { gold: ['#c97800', '#ffe48a'], leaf: ['#23701a', '#a6ec72'], frost: ['#3f73ad', '#eaf6ff'] }[look.belly];
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#ffc928'; g.fillRect(0, 0, 1024, 512);
  const r = rng(1);
  for (let i = 0; i < 3000; i++) { g.fillStyle = r.next() < 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(120,60,0,.04)'; g.fillRect(r.next() * 1024, r.next() * 512, 2, 2); }
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (look.stars) {
    g.strokeStyle = '#c77dff';
    for (const sx of [256, 768]) for (let y = 26; y < 492; y += 34) for (const side of [-1, 1]) {
      const x = sx + side * 16, s = 6.5;
      g.lineWidth = 2.6; g.beginPath(); g.moveTo(x - s, y); g.lineTo(x + s, y); g.moveTo(x, y - s); g.lineTo(x, y + s); g.stroke();
      g.lineWidth = 1.8; g.beginPath(); g.moveTo(x - s * .55, y - s * .55); g.lineTo(x + s * .55, y + s * .55); g.moveTo(x - s * .55, y + s * .55); g.lineTo(x + s * .55, y - s * .55); g.stroke();
    }
  }
  if (look.belly) {
    spiralPath(g, 512, 366, 52, 1); g.strokeStyle = BELLY[0]; g.lineWidth = 10; g.stroke();
    spiralPath(g, 512, 366, 52, 1); g.strokeStyle = BELLY[1]; g.lineWidth = 5.5; g.stroke();
  }
  for (const s of [-1, 1]) {
    g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.arc(CX + s * EYE_DX, EYE_Y, 44, 0, 7); g.fill();
    spiralPath(g, CX + s * EYE_DX, EYE_Y, SPIRAL_R, s); g.strokeStyle = '#4a1a0c'; g.lineWidth = SPIRAL_R * 0.26; g.stroke();
  }
  mouthPath(g); g.fillStyle = '#7a0f1c'; g.fill();
  g.save(); g.clip(); g.fillStyle = '#ff4a2e'; g.beginPath(); g.ellipse(CX, MY + MH, MW * 0.68, MH * 0.58, 0, 0, 7); g.fill(); g.restore();
  mouthPath(g); g.strokeStyle = 'rgba(110,50,0,.35)'; g.lineWidth = 4; g.stroke();
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;

  // Normal map: fabric grain, seams (groove + raised stitches), domed eye discs, raised spiral piping, carved mouth.
  const n = document.createElement('canvas'); n.width = 1024; n.height = 512;
  const h = n.getContext('2d', { willReadFrequently: true });
  h.fillStyle = '#808080'; h.fillRect(0, 0, 1024, 512);
  const r2 = rng(2);
  for (let i = 0; i < 14000; i++) { h.fillStyle = r2.next() < .5 ? 'rgba(255,255,255,.02)' : 'rgba(0,0,0,.02)'; h.beginPath(); h.arc(r2.next() * 1024, r2.next() * 512, .6 + r2.next() * 1.2, 0, 7); h.fill(); }
  for (const sx of [256, 768]) {
    for (let w = 11; w >= 1; w -= 2) { h.strokeStyle = 'rgba(0,0,0,.09)'; h.lineWidth = w; h.beginPath(); h.moveTo(sx, 0); h.lineTo(sx, 512); h.stroke(); }
    h.setLineDash([8, 7]); h.lineCap = 'round';
    for (const side of [-1, 1]) { h.strokeStyle = 'rgba(255,255,255,.35)'; h.lineWidth = 3; h.beginPath(); h.moveTo(sx + side * 8, 4); h.lineTo(sx + side * 8, 508); h.stroke(); }
    h.setLineDash([]);
  }
  h.lineCap = 'round'; h.lineJoin = 'round';
  for (const s of [-1, 1]) {
    const ex = CX + s * EYE_DX;
    for (let k = 0; k < 8; k++) { h.fillStyle = 'rgba(255,255,255,.045)'; h.beginPath(); h.arc(ex, EYE_Y, 50 - k * 3, 0, 7); h.fill(); }
    for (const [w, a] of [[14, .22], [10, .3], [6, .35]]) { spiralPath(h, ex, EYE_Y, SPIRAL_R, s); h.strokeStyle = `rgba(255,255,255,${a})`; h.lineWidth = w; h.stroke(); }
  }
  if (look.belly) for (const [w, a] of [[12, .2], [7, .3]]) { spiralPath(h, 512, 366, 52, 1); h.strokeStyle = `rgba(255,255,255,${a})`; h.lineWidth = w; h.stroke(); }
  for (let k = 0; k < 24; k++) { mouthPath(h, 1 - k * 0.026, 1 - k * 0.03); h.fillStyle = 'rgba(0,0,0,.05)'; h.fill(); }
  const src = h.getImageData(0, 0, 1024, 512).data, H = new Float32Array(1024 * 512);
  for (let i = 0; i < H.length; i++) H[i] = src[i * 4] / 255;
  const out = h.createImageData(1024, 512), o = out.data, K = 5.5;
  for (let y = 0; y < 512; y++) {
    const yu = Math.max(0, y - 1), yd = Math.min(511, y + 1);
    for (let x = 0; x < 1024; x++) {
      const dx = (H[y * 1024 + (x + 1) % 1024] - H[y * 1024 + (x + 1023) % 1024]) * K, dy = (H[yd * 1024 + x] - H[yu * 1024 + x]) * K;
      const l = Math.sqrt(dx * dx + dy * dy + 1), i = (y * 1024 + x) * 4;
      o[i] = (-dx / l * .5 + .5) * 255; o[i + 1] = (dy / l * .5 + .5) * 255; o[i + 2] = (1 / l * .5 + .5) * 255; o[i + 3] = 255;
    }
  }
  h.putImageData(out, 0, 0);
  const normal = new THREE.CanvasTexture(n); normal.anisotropy = 4;
  const res = { map, normal };
  texCache.set(key, res);
  return res;
}

// ---------- geometry ----------
const geoCache = new Map();
const cached = (k, f) => { if (!geoCache.has(k)) geoCache.set(k, f()); return geoCache.get(k); };

function eggGeometry() {
  return cached('egg', () => {
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const a = i / 40 * Math.PI, y = -Math.cos(a) * EGG_H, k = y / EGG_H, sa = Math.sin(a);
      const full = k < 0 ? Math.pow(sa, 0.78) : sa;
      pts.push(new THREE.Vector2(Math.max(1e-4, 1.04 * full * (1 - 0.16 * k) * (k > 0 ? 1 - 0.24 * k * k : 1)), y));
    }
    const g = new THREE.LatheGeometry(pts, 48); g.rotateY(Math.PI);
    const p = g.attributes.position, cols = [];
    for (let i = 0; i < p.count; i++) { const y = p.getY(i), s = (0.72 + 0.28 * smooth(-1.2, -0.25, y)) * (1 - 0.2 * smooth(0.82, 1.12, y)); cols.push(s, s, s); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    return g;
  });
}
function armGeometry() {
  return cached('arm', () => {
    const pts = [];
    for (let i = 0; i <= 14; i++) { const t = i / 14, tip = Math.max(0, (t - 0.72) / 0.28); pts.push(new THREE.Vector2(Math.max(1e-4, (0.3 - 0.07 * t) * Math.sqrt(1 - tip * tip)), -0.12 + 0.62 * t)); }
    return new THREE.LatheGeometry(pts, 16);
  });
}
const M4 = (x, y, z, rx, ry, sx, sy, sz) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0, 'YXZ')), new THREE.Vector3(sx, sy, sz));
function merge(parts) {
  const geos = parts.map(([g, m]) => { const c = g.clone(); c.applyMatrix4(m); return c.index ? c.toNonIndexed() : c; });
  let n = 0; for (const g of geos) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.color) col.set(g.attributes.color.array, o * 3); else col.fill(1, o * 3, (o + g.attributes.position.count) * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}
function feetGeometry() {
  return cached('feet', () => merge([-1, 1].map(s => [new THREE.SphereGeometry(1, 14, 10), M4(s * 0.44, -EGG_H + 0.08, 0.14, 0, 0, 0.33, 0.22, 0.38)])));
}
function hsv(h, s, v) {
  const f = n => { const k = (n + h * 6) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return new THREE.Color(f(5), f(3), f(1));
}
/** One leaf, stem at z=0 to tip at z=1: folded up along the midrib, arching with a drooping tip. */
function leafGeometry(width, round, base, tip, strongTip) {
  const g = new THREE.SphereGeometry(1, 14, 22); g.rotateX(Math.PI / 2);
  const p = g.attributes.position, cols = [], b = C(base), t = C(tip);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), u = (z + 1) / 2, r = Math.max(1e-4, Math.hypot(x, y));
    const k = Math.pow(Math.sin(Math.PI * Math.pow(u, 0.75)), round) / r;
    const nx = x * k * width, ny = y * k * 0.05 + Math.abs(nx) * 0.6 - 0.26 * u * u;
    p.setXYZ(i, nx, ny, u);
    const vein = Math.max(0, 1 - Math.abs(nx) / 0.03), shade = Math.min(1, 0.7 + 0.26 * u + 0.14 * vein);
    const c = b.clone().lerp(t, strongTip ? smooth(0.55, 0.95, u) : 0);
    cols.push(c.r * shade, c.g * shade, c.b * shade * 0.95);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.computeVertexNormals();
  return g;
}
function crownGeometry(id, look) {
  return cached('crown:' + id, () => {
    const r = rng(hash(id)), R = (a, b) => a + r.next() * (b - a), baseY = EGG_H * 0.88, parts = [];
    const tipFor = (i, n) => look.gold ? 0xffd23f : look.rainbow ? hsv((i * 0.61803) % 1, 0.75, 1).getHex() : look.tip;
    if (look.crown === 'seedling') {
      const stemPts = []; for (let i = 0; i <= 6; i++) { const t = i / 6; stemPts.push(new THREE.Vector2(0.075 * (1 - 0.35 * t), baseY - 0.08 + t * 0.36)); }
      const stem = new THREE.LatheGeometry(stemPts, 10), sc = [];
      for (let i = 0; i < stem.attributes.position.count; i++) { const c = C(look.leaf).lerp(C(0x7fcf5a), 0.4); sc.push(c.r, c.g, c.b); }
      stem.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3));
      parts.push([stem, new THREE.Matrix4()]);
      for (let i = 0; i < 3; i++) {
        const s = 0.7 * R(0.95, 1.05);
        parts.push([leafGeometry(0.6, 0.7, look.leaf, tipFor(i, 3), true), M4(0, baseY + 0.27, 0, -(0.88 + R(-0.06, 0.06)), i / 3 * Math.PI * 2 + 0.3 + R(-0.08, 0.08), s, s, s)]);
      }
      return merge(parts);
    }
    if (look.crown === 'bloom') {
      // The seedling, grown up: a taller stem, two leaves, and a pink flower on top.
      const top = baseY + 0.56, stemPts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; stemPts.push(new THREE.Vector2(0.08 * (1 - 0.4 * t), baseY - 0.08 + t * (top - baseY + 0.08))); }
      const stem = new THREE.LatheGeometry(stemPts, 10), sc = [];
      for (let i = 0; i < stem.attributes.position.count; i++) { const c = C(look.leaf).lerp(C(0x7fcf5a), 0.4); sc.push(c.r, c.g, c.b); }
      stem.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3)); parts.push([stem, new THREE.Matrix4()]);
      for (let i = 0; i < 2; i++) parts.push([leafGeometry(0.6, 0.7, look.leaf, look.tip, true), M4(0, baseY + 0.2 + i * 0.1, 0, -0.62, i * Math.PI + 0.5, 0.62, 0.62, 0.62)]);
      for (let i = 0; i < 7; i++) parts.push([leafGeometry(0.7, 0.9, look.petal, look.petalTip, true), M4(0, top, 0, -0.62 + R(-0.05, 0.05), i / 7 * Math.PI * 2 + R(-0.05, 0.05), 0.68, 0.68, 0.68)]);
      const ctr = new THREE.SphereGeometry(0.2, 16, 12); ctr.scale(1, 0.62, 1); ctr.translate(0, top + 0.1, 0);
      const cc = []; for (let i = 0; i < ctr.attributes.position.count; i++) { const y = ctr.attributes.position.getY(i) - top; const c = C(0xffc928).lerp(C(0xff8a00), Math.max(0, 0.6 - y * 6)); cc.push(c.r, c.g, c.b); }
      ctr.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3)); parts.push([ctr, new THREE.Matrix4()]);
      return merge(parts);
    }
    const pine = look.crown === 'pine' || look.crown === 'elder';
    const width = pine ? 0.13 : look.crown === 'grand' ? 0.5 : 0.46, round = 0.8;
    const layers = look.crown === 'elder' ? [[11, 1.12, 0.8, 0], [9, 1.04, 1.04, 0.3], [7, 0.92, 1.26, 0.7], [4, 0.74, 1.48, 1.1]]
      : look.crown === 'grand' ? [[8, 0.98, 0.78, 0], [6, 0.92, 1.08, 0.3], [4, 0.78, 1.32, 0.85], [2, 0.62, 1.52, 1.4]]
      : pine ? [[9, 1.0, 0.85, 0], [7, 0.92, 1.12, 0.35], [4, 0.72, 1.4, 0.9]] : [[6, 0.84, 0.82, 0], [4, 0.78, 1.15, 0.4], [2, 0.6, 1.45, 1.1]];
    const total = layers.reduce((a, l) => a + l[0], 0);
    let idx = 0;
    for (const [n, len, pitch, spin] of layers) for (let i = 0; i < n; i++, idx++) {
      const yaw = i / n * Math.PI * 2 + spin + R(-0.12, 0.12), s = len * R(0.92, 1.08);
      parts.push([leafGeometry(width, round, look.leaf, tipFor(idx, total), true), M4(0, baseY, 0, -(pitch + R(-0.08, 0.08)), yaw, s, s, s)]);
    }
    return merge(parts);
  });
}

// ---------- materials ----------
/** Matte plush with a soft velvet rim (treatment section 3: roughness ~0.4, metalness 0, never shiny). */
export function plush(params, rim = 0.4) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0, ...params });
  m.onBeforeCompile = sh => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      totalEmissiveRadiance += diffuseColor.rgb * pow(1. - clamp(dot(normal, normalize(vViewPosition)), 0., 1.), 2.4) * ${rim.toFixed(2)};`);
  };
  m.customProgramCacheKey = () => 'plush' + rim;
  return m;
}
/** UV-purple halo on a back-face shell: tint pass (keeps it saturated in daylight) + screen-blend pass. */
export function glowShell(geometry, intensity = 1.4, power = 2.2, color = 0x7a00ff) {
  const gc = C(color), glsl = `vec3(${gc.r.toFixed(3)},${gc.g.toFixed(3)},${gc.b.toFixed(3)})`;
  const vs = 'varying vec3 n; varying vec3 v; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); n = normalize(normalMatrix*normal); v = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }';
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geometry, new THREE.ShaderMaterial({ side: THREE.BackSide, transparent: true, depthWrite: false, uniforms: { k: { value: intensity }, p: { value: power } }, vertexShader: vs,
    fragmentShader: 'uniform float k, p; varying vec3 n; varying vec3 v; void main(){ float d = clamp(-dot(normalize(n),normalize(v)),0.,1.); gl_FragColor = vec4(' + glsl + '*.55, clamp(pow(d,p)*k,0.,1.)*.6); }' })));
  const screen = new THREE.Mesh(geometry, new THREE.ShaderMaterial({ side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneMinusDstColorFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    uniforms: { k: { value: intensity }, p: { value: power } }, vertexShader: vs,
    fragmentShader: 'uniform float k, p; varying vec3 n; varying vec3 v; void main(){ float d = clamp(-dot(normalize(n),normalize(v)),0.,1.); gl_FragColor = vec4(' + glsl + '*clamp(pow(d,p)*k + .05*d,0.,1.),1.); }' }));
  screen.renderOrder = 1; g.add(screen);
  g.userData.setIntensity = k => { for (const c of g.children) c.material.uniforms.k.value = k; };
  return g;
}

// ---------- Kiki ----------
const kikiMats = new Map();
function matsFor(id, look) {
  if (kikiMats.has(id)) return kikiMats.get(id);
  const { map, normal } = faceTextures(look);
  const m = {
    body: plush({ map, normalMap: normal, normalScale: new THREE.Vector2(0.9, 0.9), vertexColors: true }),
    limb: plush({ color: 0xffc928 }),
    leaf: plush({ color: 0xffffff, vertexColors: true, roughness: 0.28 }, 0.3),
  };
  kikiMats.set(id, m);
  return m;
}
/**
 * A Kiki standing with feet at y=0, facing +z. Hierarchy for animation: root → motion → flip (pivot at the body's
 * centre) → squash (pivot at the feet) → parts. `height` is the real body height in metres (no leaves).
 */
export function makeKiki(id, height = 0.42) {
  const look = lookFor(id), m = matsFor(id, look);
  const root = new THREE.Group(); root.scale.setScalar(height / BODY_H * look.scale);
  const motion = new THREE.Group(); root.add(motion);
  const flip = new THREE.Group(); flip.position.y = GROUND; motion.add(flip);
  const squash = new THREE.Group(); squash.position.y = -GROUND; flip.add(squash);
  const model = new THREE.Group(); model.position.y = GROUND; squash.add(model);
  model.add(new THREE.Mesh(eggGeometry(), m.body));
  model.add(new THREE.Mesh(feetGeometry(), m.limb));
  const arms = [];
  for (const [x, y, rz] of [[-0.9, 0.0, 0.62], [0.9, -0.05, -2.15]]) {
    const pivot = new THREE.Object3D(); pivot.position.set(x, y, 0.05); pivot.rotation.z = rz; pivot.userData.rest = rz;
    pivot.add(new THREE.Mesh(armGeometry(), m.limb)); model.add(pivot); arms.push(pivot);
  }
  model.add(new THREE.Mesh(crownGeometry(id, look), m.leaf));
  if (look.glow) { const s = glowShell(eggGeometry()); s.scale.set(1.22, 1.14, 1.22); s.position.y = -0.05; model.add(s); root.userData.glow = s; }
  // soft blob shadow on the ground
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 2.1), new THREE.MeshBasicMaterial({ map: blobTexture(), color: 0x0d0a26, transparent: true, opacity: 0.42, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; root.add(shadow);
  root.userData = { ...root.userData, id, motion, flip, squash, arms, shadow, look };
  return root;
}

let _blob;
export function blobTexture() {
  if (_blob) return _blob;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return _blob = new THREE.CanvasTexture(c);
}

/**
 * Idles and celebration dances (treatment section 3). Squash on every landing, stretch on every jump; random height,
 * tempo and direction. Reduced motion drops the spins. Drive with update(dt) every frame.
 */
export class KikiMotion {
  constructor(kiki, reduced = () => false) {
    this.k = kiki.userData; this.reduced = reduced; this.gen = null; this.idling = true; this.next = 0.6; this.t = 0;
    this.shadowScale = this.k.shadow.scale.clone();
  }
  get busy() { return !!this.gen; }
  get amp() { return this.reduced() ? 0.5 : 1; }
  vary() { return 0.85 + Math.random() * 0.3; }
  dir() { return Math.random() < 0.5 ? -1 : 1; }
  play(gen) { this.reset(); this.gen = gen; }
  stop() { this.gen = null; this.reset(); }
  reset() {
    const k = this.k; k.motion.position.set(0, 0, 0); k.motion.rotation.set(0, 0, 0); k.flip.rotation.set(0, 0, 0);
    this.squash(1); this.hop(0); for (const a of k.arms) a.rotation.z = a.userData.rest;
  }
  squash(s) { s = Math.max(0.1, s); const w = 1 / Math.sqrt(s); this.k.squash.scale.set(w, s, w); }
  hop(h) { this.k.motion.position.y = h; this.k.shadow.scale.copy(this.shadowScale).multiplyScalar(1 - 0.4 * Math.min(1, h / 1.6)); }
  /** Arms by raise angle in degrees (90 = straight up, 0 = out, -60 = down). arms[0] is the waving arm (−x). */
  armsTo(r0, r1) { this.k.arms[0].rotation.z = (90 - r0) * Math.PI / 180; this.k.arms[1].rotation.z = (r1 - 90) * Math.PI / 180; }
  update(dt) {
    this.t += dt;
    if (this.gen) { const r = this.gen.next(dt); if (r.done) { this.gen = null; this.reset(); } return; }
    if (!this.idling) return;
    this.squash(1 + Math.sin(this.t * 2.2) * 0.015 * this.amp);
    if ((this.next -= dt) <= 0) { this.play(this.randomIdle()); this.next = 1.6 + Math.random() * 1.8; }
  }
  *wait(s) { for (let t = 0; t < s;) t += yield; }
  *hopGen(height, air, crouch, during) {
    for (let t = 0; t < crouch;) { this.squash(1 - 0.18 * this.amp * t / crouch); t += yield; }
    for (let t = 0; t < air;) { const k = t / air; this.hop(4 * height * k * (1 - k)); this.squash(1 + 0.16 * this.amp * (1 - Math.abs(k * 2 - 1))); if (during) during(k); t += yield; }
    this.hop(0); if (during) during(1);
    for (let t = 0; t < 0.22;) { this.squash(1 - 0.22 * this.amp * Math.exp(-3 * t / 0.22) * Math.cos(t / 0.22 * 1.2 * Math.PI * 2)); t += yield; }
    this.squash(1);
  }
  randomIdle() { return [this.rock, this.tinyHops, this.wave, this.lookAround][Math.floor(Math.random() * 4)].call(this); }
  *rock() { const d = 1.6 * this.vary(), a = 7 * this.amp * this.vary() * Math.PI / 180, s = this.dir(); for (let t = 0; t < d;) { this.k.motion.rotation.z = Math.sin(t / d * Math.PI * 4) * Math.sin(t / d * Math.PI) * a * s; t += yield; } }
  *tinyHops() { const n = 2 + Math.floor(Math.random() * 2); for (let i = 0; i < n; i++) yield* this.hopGen(0.24 * this.amp * this.vary(), 0.32 * this.vary(), 0.12); }
  *wave() {
    const d = 1.5 * this.vary(), rest = 90 - this.k.arms[0].userData.rest * 180 / Math.PI;
    for (let t = 0; t < d;) { const up = smooth(0, 1, Math.min(1, t / 0.25)) * smooth(0, 1, Math.min(1, (d - t) / 0.25)); this.k.arms[0].rotation.z = (90 - (rest + (75 + Math.sin(t * 14) * 16 * this.amp - rest) * up)) * Math.PI / 180; t += yield; }
  }
  *lookAround() { const d = 2.2 * this.vary(), a = 22 * this.amp * Math.PI / 180, s = this.dir(); for (let t = 0; t < d;) { const k = Math.sin(t / d * Math.PI * 2) * s; this.k.motion.rotation.y = k * a; this.k.motion.rotation.z = k * 0.05; t += yield; } }
  randomDance() {
    const all = ['spinJump', 'tripleBounceFlip', 'wiggle', 'tiptoeTwirl', 'jellyPancake'];
    const pool = this.reduced() ? ['wiggle', 'jellyPancake'] : all;
    return this[pool[Math.floor(Math.random() * pool.length)]]();
  }
  *spinJump() { const d = this.dir(); yield* this.hopGen(1.5 * this.vary(), 0.7 * this.vary(), 0.18, k => { this.k.motion.rotation.y = Math.PI * 2 * smooth(0, 1, k) * d; const f = Math.sin(k * Math.PI * 8) * 35; this.armsTo(35 + f, 35 + f); }); }
  *tripleBounceFlip() { yield* this.hopGen(0.5 * this.vary(), 0.32, 0.1); yield* this.hopGen(0.6 * this.vary(), 0.34, 0.08); const d = this.dir(); yield* this.hopGen(1.6 * this.vary(), 0.75, 0.14, k => { this.k.flip.rotation.x = -Math.PI * 2 * smooth(0, 1, k) * d; this.armsTo(75, 75); }); }
  *wiggle() { const d = 1.8 * this.vary(), sp = 9 * this.vary(), a = this.amp; for (let t = 0; t < d;) { const s = Math.sin(t * sp); this.k.motion.position.x = s * 0.12 * a; this.k.motion.rotation.z = -s * 0.17 * a; const w = Math.sin(t * sp * 2) * 40 * a; this.armsTo(30 + w, 30 - w); this.squash(1 + Math.abs(s) * 0.05 * a); t += yield; } }
  *tiptoeTwirl() { const d = 2 * this.vary(), dir = this.dir(), turns = 1 + Math.random() * 0.5; for (let t = 0; t < d;) { const k = t / d, up = Math.sin(k * Math.PI); this.hop(0.1 * up); this.squash(1 + 0.1 * up); this.k.motion.rotation.y = Math.PI * 2 * turns * smooth(0, 1, k) * dir; this.armsTo(-30 + 110 * up, -30 + 110 * up); t += yield; } }
  *jellyPancake() {
    const a = this.amp;
    for (let t = 0; t < 0.3;) { const k = t / 0.3; this.squash(1 - 0.72 * a * (1 - Math.pow(1 - k, 3))); this.armsTo(-30 + 30 * k, -30 + 30 * k); t += yield; }
    const hold = 0.35 * this.vary(); for (let t = 0; t < hold;) { this.squash(1 - 0.72 * a + Math.sin(t * 30) * 0.03); t += yield; }
    yield* this.hopGen(0.7 * this.vary() * a, 0.45, 0.02, k => this.armsTo(80 - 110 * k, 80 - 110 * k));
  }
}

// ---------- Rune Stone, standing stones, portal, beams, sparkles ----------
const runeVS = `uniform float rad; varying vec3 op; varying vec3 on; varying vec3 wn; varying vec3 vd;
  void main(){ op = position / rad; on = normal; vec4 w = modelMatrix*vec4(position,1.); wn = normalize(mat3(modelMatrix)*normal); vd = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix*viewMatrix*w; }`;
const runeFS = `uniform float glow, axisZ; uniform vec3 cA, cB, cC, cG; varying vec3 op; varying vec3 on; varying vec3 wn; varying vec3 vd;
  float hsh(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7)))*43758.5453); }
  float sd(vec2 p, float m){ float rho = length(p); float ang = atan(p.y, p.x*m); if (ang < 0.) ang += 6.2831853;
    float maxT = 2.5*6.2831853; float b = .78/maxT; float k0 = floor((rho/b - ang)/6.2831853); float best = 10.;
    for (int i=-1;i<=1;i++){ float th = ang + (k0+float(i))*6.2831853; if (th>=0. && th<=maxT) best = min(best, abs(b*th-rho)); } return best; }
  void main(){
    float speck = step(.86, hsh(floor(op*28.)));
    vec3 col = mix(cA, cB, speck*.6);
    float fn = mix(on.y, on.z, axisZ); float face = smoothstep(.35,.6,abs(fn)); float m = fn >= 0. ? 1. : -1.;
    float d = sd(mix(op.xz, op.xy, axisZ), m); float carve = face*(1.-smoothstep(.06*.7,.06,d));
    col = mix(col, cC, carve);
    vec3 L = normalize(vec3(-.4,.8,.6)); float diff = .5 + .5*max(0., dot(normalize(wn), L));
    float rim = pow(1.-clamp(dot(normalize(wn), normalize(vd)),0.,1.),3.);
    gl_FragColor = vec4(col*diff + cG*carve*glow + cB*rim*.15, 1.);
  }`;
/** Stone tiers (Phase 1): body, specks, carving and glow colours. */
export const STONE_LOOK = {
  rune: { a: [0.24, 0.26, 0.45], b: [0.42, 0.44, 0.62], c: [0.07, 0.03, 0.16], g: 0x7a00ff },
  moon: { a: [0.6, 0.67, 0.82], b: [0.88, 0.93, 1.0], c: [0.06, 0.12, 0.3], g: 0x2fc4ff },
  star: { a: [0.1, 0.1, 0.3], b: [1.0, 0.82, 0.3], c: [0.3, 0.14, 0.0], g: 0xffb000 },
};
export function runeMaterial(axisZ, radius, tier = 'rune') {
  const L = STONE_LOOK[tier] || STONE_LOOK.rune, v3 = a => new THREE.Vector3(...a), gc = C(L.g);
  return new THREE.ShaderMaterial({ uniforms: { glow: { value: 1.3 }, axisZ: { value: axisZ }, rad: { value: radius }, cA: { value: v3(L.a) }, cB: { value: v3(L.b) }, cC: { value: v3(L.c) }, cG: { value: new THREE.Vector3(gc.r, gc.g, gc.b) } }, vertexShader: runeVS, fragmentShader: runeFS });
}
/** The Rune Stone (owner's call): a slate river stone with Kiki's spiral carved into both faces, glowing UV purple. */
export function makeRuneStone(radius = 0.04, tier = 'rune') {
  const geo = cached('stone' + radius, () => { const g = new THREE.SphereGeometry(radius, 32, 20); g.scale(1, 0.42, 0.86); return g; });
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const mat = runeMaterial(0, radius, tier);
  body.add(new THREE.Mesh(geo, mat));
  const halo = glowShell(geo, 1.1, 1.6, (STONE_LOOK[tier] || STONE_LOOK.rune).g); halo.scale.setScalar(1.45); body.add(halo);
  g.userData = { body, mat, halo, boost: 0, tier };
  g.userData.flash = (a = 2.5) => { g.userData.boost = Math.max(g.userData.boost, a); };
  g.userData.update = (dt, time) => {
    g.userData.boost = Math.max(0, g.userData.boost - dt * 4);
    const beat = 0.5 + 0.5 * Math.sin(time * Math.PI * 2 * 70 / 60);
    mat.uniforms.glow.value = 1.0 + 0.4 * beat + g.userData.boost;
    halo.userData.setIntensity(0.9 + 0.3 * beat + g.userData.boost * 0.5);
  };
  return g;
}
export function standingStoneGeometry() {
  return cached('standing', () => {
    const g = new THREE.SphereGeometry(1, 32, 24), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), sg = Math.sign;
      const bx = sg(x) * Math.pow(Math.abs(x), 0.55), by = sg(y) * Math.pow(Math.abs(y), 0.75), bz = sg(z) * Math.pow(Math.abs(z), 0.55);
      const taper = 1 - 0.22 * Math.max(0, by), n = 1 + 0.045 * Math.sin(x * 7.1 + y * 3.3) * Math.cos(z * 5.7 - y * 2.1);
      p.setXYZ(i, bx * 0.42 * taper * n, by * n, bz * 0.2 * taper * n);
    }
    g.computeVertexNormals();
    return g;
  });
}
let _void;
function voidTexture() {
  if (_void) return _void;
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), id = x.createImageData(128, 128);
  for (let y = 0; y < 128; y++) for (let X = 0; X < 128; X++) { const r = Math.hypot((X + .5) / 64 - 1, (y + .5) / 64 - 1), a = Math.pow(Math.min(1, Math.max(0, (1 - r) / .35)), 1.2) * .94, i = (y * 128 + X) * 4; id.data[i] = 20; id.data[i + 1] = 5; id.data[i + 2] = 51; id.data[i + 3] = a * 255; }
  x.putImageData(id, 0, 0); _void = new THREE.CanvasTexture(c); _void.colorSpace = THREE.SRGBColorSpace; return _void;
}
/** The capture portal: a dark void with a swirling UV-purple vortex (screen blend). Billboard it toward the camera. */
export function makePortal(size = 1) {
  const g = new THREE.Group(), disc = new THREE.Group(); g.add(disc);
  disc.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: voidTexture(), transparent: true, depthWrite: false })));
  const u = { t: { value: 0 }, pull: { value: 1.5 }, speed: { value: 3 }, k: { value: 1.15 } };
  const vx = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneMinusDstColorFactor, blendDst: THREE.OneFactor, uniforms: u,
    vertexShader: 'varying vec2 uv2; void main(){ uv2 = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `uniform float t, pull, speed, k; varying vec2 uv2;
      void main(){ vec2 c = uv2*2.-1.; float r = length(c); if (r>1.) discard; float ang = atan(c.y,c.x);
        float arms = pow(.5+.5*cos(ang*4. + log(r+.04)*6.4 + t*speed), 3.);
        float streams = pow(.5+.5*cos(ang*9. - log(r+.04)*6. + t*speed*1.7 + r*pull*8.), 8.);
        float edge = smoothstep(1.,.72,r); float rim = smoothstep(.75,.92,r)*edge; float core = pow(clamp(1.-r*1.6,0.,1.),2.);
        float kk = (arms*.75 + streams*.35 + rim*.9 + core*1.3)*edge;
        vec3 col = mix(vec3(.25,.05,.85), vec3(.478,0.,1.), clamp(arms+core,0.,1.));
        gl_FragColor = vec4(col*kk*k, 1.); }` }));
  vx.position.z = 0.002; vx.renderOrder = 2; disc.add(vx);
  disc.scale.setScalar(0.0001);
  g.userData = { disc, u, open: 0, target: 0, size, boost: 0 };
  g.userData.update = (dt, time, camera) => {
    const d = g.userData; d.u.t.value = time;
    const rate = d.target > d.open ? 3.2 : 4.5;
    d.open += Math.sign(d.target - d.open) * Math.min(Math.abs(d.target - d.open), dt * rate);
    const s = d.target >= d.open ? easeOutBack(d.open) : d.open * d.open;
    d.disc.scale.setScalar(Math.max(0.0001, d.size * s));
    d.u.speed.value = 3 + d.boost * 6; d.u.pull.value = 1.5 + d.boost * 3; d.u.k.value = 1.15 + d.boost * 0.5;
    if (camera) g.quaternion.copy(camera.quaternion);
  };
  return g;
}
export const easeOutBack = (t, s = 1.70158) => { t = Math.min(1, Math.max(0, t)) - 1; return t * t * ((s + 1) * t + s) + 1; };

/** A soft column of UV light (alpha-blended so it stays purple over a bright sky). */
export function makeBeam(height, radius, color = 0x7a00ff, strength = 0.6) {
  const geo = new THREE.CylinderGeometry(radius * 0.6, radius, height, 32, 1, true); geo.translate(0, height / 2, 0);
  const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { c: { value: C(color) }, s: { value: strength }, h: { value: height } },
    vertexShader: 'uniform float h; varying float hh; varying vec3 n; varying vec3 v; void main(){ hh = position.y/h; vec4 mv = modelViewMatrix*vec4(position,1.); n = normalize(normalMatrix*normal); v = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'uniform vec3 c; uniform float s; varying float hh; varying vec3 n; varying vec3 v; void main(){ float e = pow(abs(dot(normalize(n), normalize(v))), 2.5); gl_FragColor = vec4(c, e*pow(1.-clamp(hh,0.,1.),1.6)*smoothstep(0.,.04,hh)*s); }' }));
  m.renderOrder = 3;
  return m;
}

/** A Rune Circle: seven carved standing stones, a dais, a ground ring, the portal and a light column; the Keeper stands on the dais. */
export function makeCircle(keeperId) {
  const g = new THREE.Group(), mat = runeMaterial(1, 0.42), R = 2.6;
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2 + 0.2, h = 1.3 * (0.9 + 0.2 * ((i * 37) % 7) / 7), st = new THREE.Mesh(standingStoneGeometry(), mat);
    st.scale.setScalar(h / 2); st.position.set(Math.cos(a) * R, h * 0.43, Math.sin(a) * R); st.rotation.set(0, -a + Math.PI / 2, ((i * 53) % 9 - 4) * 0.012); g.add(st);
  }
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.15, 0.16, 40), new THREE.MeshStandardMaterial({ color: 0x3d4275, roughness: 0.8 }));
  dais.position.y = 0.08; g.add(dais);
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.15, 3.32, 96), new THREE.MeshBasicMaterial({ color: 0x7a00ff, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; g.add(ring);
  const portal = makePortal(1.9); portal.position.y = 2.25; portal.userData.target = 1; g.add(portal);
  const beam = makeBeam(16, 0.5); beam.position.y = 2.25; g.add(beam);
  g.userData = { portal, keeper: null, keeperId: null, motion: null };
  g.userData.setKeeper = id => {
    if (g.userData.keeperId === id) return;
    if (g.userData.keeper) g.remove(g.userData.keeper);
    const k = makeKiki(id, 0.65); k.position.y = 0.16; g.add(k);
    g.userData.keeper = k; g.userData.keeperId = id; g.userData.motion = new KikiMotion(k);
  };
  if (keeperId) g.userData.setKeeper(keeperId);
  return g;
}

let _spark;
function sparkTexture() {
  if (_spark) return _spark;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), id = x.createImageData(64, 64);
  for (let y = 0; y < 64; y++) for (let X = 0; X < 64; X++) {
    const dx = Math.abs((X + .5) / 32 - 1), dy = Math.abs((y + .5) / 32 - 1), star = Math.max(0, 1 - (Math.sqrt(dx) + Math.sqrt(dy)) * 0.9), core = Math.max(0, 1 - Math.hypot(dx, dy) * 3);
    const a = Math.min(1, star * 2.2 + core), i = (y * 64 + X) * 4; id.data[i] = id.data[i + 1] = id.data[i + 2] = 255; id.data[i + 3] = a * 255;
  }
  x.putImageData(id, 0, 0); return _spark = new THREE.CanvasTexture(c);
}
/** Little additive stars: bursts outward, or streams inward to a point (the portal's pull). */
export class Sparkles {
  constructor(scene) { this.scene = scene; this.live = []; }
  burst(at, count, color, size, speed = 0.6, life = 0.7) { this._spawn(at, count, color, size, life, () => new THREE.Vector3().randomDirection().multiplyScalar(speed * (0.4 + Math.random() * 0.6)).add(new THREE.Vector3(0, speed * 0.3, 0)), null); }
  implode(sink, radius, count, color, size, life = 0.8) {
    this._spawn(sink, count, color, size, life, null, s => { const off = new THREE.Vector3().randomDirection().multiplyScalar(radius * (0.6 + Math.random() * 0.4)); s.position.copy(sink).add(off); return new THREE.Vector3().crossVectors(off, new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(radius * 1.5); });
  }
  _spawn(at, count, color, size, life, vel, implodeInit) {
    for (let i = 0; i < count; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      s.position.copy(at); s.scale.setScalar(size);
      const v = implodeInit ? implodeInit(s) : vel();
      this.scene.add(s); this.live.push({ s, v, age: 0, life, size, sink: implodeInit ? at.clone() : null });
    }
  }
  update(dt) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i]; p.age += dt; const k = p.age / p.life;
      if (k >= 1) { this.scene.remove(p.s); p.s.material.dispose(); this.live.splice(i, 1); continue; }
      if (p.sink) { p.v.addScaledVector(p.sink.clone().sub(p.s.position), 18 * dt); p.v.multiplyScalar(1 - dt * 3); } else p.v.multiplyScalar(1 - dt * 2.5);
      p.s.position.addScaledVector(p.v, dt); p.s.material.opacity = 1 - k * k; p.s.scale.setScalar(p.size * (1 - k * 0.6)); p.s.material.rotation = p.age * 3;
    }
  }
}

/** The timing ring: navy outline + rarity colour. It only ever shows the target size. */
export function makeTimingRing(rarityColor) {
  const g = new THREE.Group(), s = new THREE.Group(); g.add(s);
  const a = new THREE.Mesh(new THREE.RingGeometry(0.86, 1.14, 72), new THREE.MeshBasicMaterial({ color: 0x18237a, side: THREE.DoubleSide, depthTest: false, transparent: true }));
  const b = new THREE.Mesh(new THREE.RingGeometry(0.92, 1.08, 72), new THREE.MeshBasicMaterial({ color: rarityColor, side: THREE.DoubleSide, depthTest: false, transparent: true }));
  a.renderOrder = 10; b.renderOrder = 11; b.position.z = 0.001; s.add(a, b);
  g.userData = { scaler: s, min: 0.07, max: 0.3, setColor: c => b.material.color.set(c) };
  g.userData.set = k => { const r = g.userData.min + (g.userData.max - g.userData.min) * k; s.scale.set(r, r, 1); };
  return g;
}

/** The "cosmic set" reveal background: purple and indigo, spiral galaxy arms in teal, purple and gold, stars. */
export function cosmicCanvas(size = 512) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'), id = g.createImageData(size, size), r = rng(7);
  const arms = [[0.15, 0.85, 0.8], [0.62, 0.3, 1], [1, 0.8, 0.25]];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (x + .5) / size * 2 - 1, dy = (y + .5) / size * 2 - 1, rr = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
    const t = Math.min(1, rr * 1.1); let col = [0.2 + (0.09 - 0.2) * t, 0.08 + (0.04 - 0.08) * t, 0.45 + (0.24 - 0.45) * t];
    for (let k = 0; k < 3; k++) { const ph = ang - Math.log(rr + 0.02) * 2.2 + k * Math.PI * 2 / 3, band = Math.pow(0.5 + 0.5 * Math.cos(ph), 6), fade = Math.min(1, Math.max(0, 1.15 - rr)) * Math.min(1, rr * 6); for (let j = 0; j < 3; j++) col[j] += arms[k][j] * band * fade * 0.55; }
    const core = Math.pow(Math.max(0, 1 - rr * 3), 2) * 0.8; col = [col[0] + 0.5 * core, col[1] + 0.3 * core, col[2] + core];
    const i = (y * size + x) * 4; id.data[i] = Math.min(255, col[0] * 255); id.data[i + 1] = Math.min(255, col[1] * 255); id.data[i + 2] = Math.min(255, col[2] * 255); id.data[i + 3] = 255;
  }
  for (let i = 0; i < size * size / 260; i++) { const k = (Math.floor(r.next() * size) * size + Math.floor(r.next() * size)) * 4, b = 0.5 + r.next() * 0.5; for (let j = 0; j < 3; j++) id.data[k + j] += (255 - id.data[k + j]) * b; }
  g.putImageData(id, 0, 0);
  return c;
}

// ---------- treats (Phase 1) ----------
/** Honey Leaf: a golden leaf with a honey drop. Sun Seed: a striped seed glowing like a little sun. ~`size` long. */
export function makeTreat(id, size = 0.06) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  if (id === 'honey') {
    const lm = plush({ color: 0xffffff, vertexColors: true, roughness: 0.3 }, 0.35);
    const leaf = new THREE.Mesh(leafGeometry(0.85, 0.75, 0xe89400, 0xffe27a, true), lm); leaf.position.z = -0.5; body.add(leaf);
    const small = new THREE.Mesh(leafGeometry(0.8, 0.75, 0x5fb82e, 0xb6e86a, true), lm); small.scale.setScalar(0.5); small.rotation.y = 2.4; small.position.z = -0.5; body.add(small);
    const drop = new THREE.Mesh(new THREE.SphereGeometry(0.14, 20, 14), new THREE.MeshStandardMaterial({ color: 0xffa200, roughness: 0.06, emissive: 0x8a4200, emissiveIntensity: 0.45 }));
    drop.scale.set(1, 0.7, 1.15); drop.position.set(0, 0.06, -0.12); body.add(drop);
    body.scale.setScalar(size);
  } else {
    const geo = cached('seed', () => {
      const pts = []; for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI, y = -Math.cos(a); pts.push(new THREE.Vector2(Math.max(1e-4, Math.sin(a) * 0.62 * (1 - 0.28 * y)), y)); }
      const s = new THREE.LatheGeometry(pts, 24), p = s.attributes.position, cols = [];
      for (let i = 0; i < p.count; i++) { const ang = Math.atan2(p.getZ(i), p.getX(i)), st = Math.cos(ang * 6) > 0.55; const c = st ? C(0x7a3a12) : C(0xffb100).lerp(C(0xffe066), (p.getY(i) + 1) / 2); cols.push(c.r, c.g, c.b); }
      s.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); s.computeVertexNormals(); return s;
    });
    body.add(new THREE.Mesh(geo, plush({ color: 0xffffff, vertexColors: true, roughness: 0.35 }, 0.5)));
    const halo = glowShell(geo, 1.2, 1.8, 0xff9a00); halo.scale.setScalar(1.35); body.add(halo);
    body.scale.setScalar(size * 0.55);
  }
  g.userData = { body, id };
  return g;
}

// ---------- the explorer (your avatar) ----------
export const SKINS = [0xffdcb8, 0xf2c28e, 0xd39a63, 0xa86b3c, 0x6b4426];
/** Starter outfits: [name, hat style, hat, top, bottoms, shoes, backpack]. The guide wears the last one. */
export const OUTFITS = [
  ['Trailblazer', 'bucket', 0xd9b779, 0x3fae2a, 0xc79a5b, 0x5a3a22, 0xff8a00],
  ['Sunny', 'cap', 0xffcf2e, 0x36b6ff, 0x18237a, 0xffffff, 0xff5d8f],
  ['Night Owl', 'beanie', 0x8c4dff, 0x2b3a8f, 0x4a4f6a, 0x18237a, 0xffcf2e],
  ['Ranger', 'brim', 0x6b7a2a, 0x7c8c3a, 0x6b4a2a, 0x3a2a1a, 0xe23a3a],
  ['Ranger Rue', 'brim', 0x7a5a2a, 0xffcf2e, 0x2f6b3a, 0x3a2a1a, 0x3fae2a],
];
/**
 * A chibi explorer about 1 unit tall, feet at y=0, facing +z. userData.update(dt, speed) walks (speed in m/s) or idles.
 */
export function makeExplorer(outfit = 0, skin = 1) {
  const [, hatStyle, hatC, topC, botC, shoeC, packC] = OUTFITS[outfit] || OUTFITS[0];
  const M = c => plush({ color: c }, 0.25), skinM = M(SKINS[skin] || SKINS[1]);
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const cap = (r, h, m) => new THREE.Mesh(new THREE.CapsuleGeometry(r, h, 6, 14), m);
  const limb = (r, h, m, x, y) => { const pv = new THREE.Group(); pv.position.set(x, y, 0); const c = cap(r, h, m); c.position.y = -h / 2 - r * 0.4; pv.add(c); body.add(pv); return pv; };
  // legs with shoes
  const legs = [-1, 1].map(s => { const l = limb(0.075, 0.16, M(botC), s * 0.085, 0.3); const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.085, 14, 10), M(shoeC)); shoe.scale.set(1, 0.6, 1.35); shoe.position.set(0, -0.28, 0.03); l.add(shoe); return l; });
  // torso
  const torso = cap(0.17, 0.12, M(topC)); torso.position.y = 0.47; torso.scale.set(1, 1, 0.82); body.add(torso);
  const hips = new THREE.Mesh(new THREE.SphereGeometry(0.172, 20, 14), M(botC)); hips.scale.set(1, 0.62, 0.84); hips.position.y = 0.3; body.add(hips);
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.174, 0.174, 0.045, 24), M(new THREE.Color(botC).multiplyScalar(0.7).getHex())); belt.position.y = 0.345; belt.scale.z = 0.84; body.add(belt);
  // arms (sleeve + hand)
  const arms = [-1, 1].map(s => { const a = limb(0.06, 0.15, M(topC), s * 0.21, 0.52); a.rotation.z = s * 0.12; const hand = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 10), skinM); hand.position.y = -0.27; a.add(hand); return a; });
  // backpack
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.28, 0.14, 2, 2, 2), M(packC)); pack.position.set(0, 0.44, -0.17);
  { const p = pack.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i), n = v.clone().normalize(); v.lerp(n.multiplyScalar(v.length()), 0.35); p.setXYZ(i, v.x, v.y, v.z); } pack.geometry.computeVertexNormals(); }
  body.add(pack);
  const flap = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(new THREE.Color(packC).multiplyScalar(0.8).getHex())); flap.scale.set(1.25, 0.5, 0.75); flap.position.set(0, 0.57, -0.17); body.add(flap);
  // head
  const head = new THREE.Group(); head.position.y = 0.76; body.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.24, 28, 20), skinM); skull.scale.set(1, 0.95, 0.95); head.add(skull);
  const eyeM = new THREE.MeshBasicMaterial({ color: 0x18237a });
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.034, 12, 10), eyeM); e.scale.set(0.85, 1.2, 0.5); e.position.set(s * 0.085, 0.0, 0.215); head.add(e);
    const gl = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff })); gl.position.set(s * 0.085 + 0.01, 0.018, 0.232); head.add(gl);
    const ch = new THREE.Mesh(new THREE.CircleGeometry(0.035, 16), new THREE.MeshBasicMaterial({ color: 0xff8fae, transparent: true, opacity: 0.55 })); ch.position.set(s * 0.14, -0.06, 0.2); ch.lookAt(s * 0.5, -0.2, 1.4); head.add(ch);
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.009, 6, 16, Math.PI), eyeM); smile.rotation.z = Math.PI; smile.position.set(0, -0.07, 0.225); head.add(smile);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.245, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), M(0x5a3a22)); hair.rotation.x = -0.35; hair.position.set(0, 0.02, -0.02); head.add(hair);
  // hat
  const hatM = M(hatC);
  if (hatStyle === 'cap') {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.255, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), hatM); dome.position.y = 0.04; dome.scale.y = 0.85; head.add(dome);
    const bill = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.025, 24, 1, false, -Math.PI / 2, Math.PI), hatM); bill.position.set(0, 0.06, 0.2); bill.scale.set(1, 1, 1.1); head.add(bill);
  } else if (hatStyle === 'beanie') {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.262, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), hatM); dome.position.y = 0.02; dome.scale.y = 1.05; head.add(dome);
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.245, 0.04, 8, 28), hatM); cuff.rotation.x = Math.PI / 2; cuff.position.y = 0.04; head.add(cuff);
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), M(0xffffff)); pom.position.y = 0.3; head.add(pom);
  } else {
    const wide = hatStyle === 'brim';
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(wide ? 0.19 : 0.2, 0.25, wide ? 0.16 : 0.15, 24), hatM); crown.position.y = 0.15; head.add(crown);
    const top = new THREE.Mesh(new THREE.SphereGeometry(wide ? 0.19 : 0.2, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2), hatM); top.scale.y = 0.35; top.position.y = 0.23; head.add(top);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(wide ? 0.42 : 0.34, wide ? 0.42 : 0.34, 0.025, 32), hatM); brim.position.y = 0.08; brim.rotation.x = 0.06; head.add(brim);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.252, 0.252, 0.04, 24), M(new THREE.Color(hatC).multiplyScalar(0.62).getHex())); band.position.y = 0.11; head.add(band);
  }
  // soft shadow
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), new THREE.MeshBasicMaterial({ map: blobTexture(), color: 0x0d0a26, transparent: true, opacity: 0.35, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.005; root.add(shadow);
  let phase = 0, t = 0;
  root.userData = {
    head, body,
    update(dt, speed = 0) {
      t += dt; const walk = Math.min(1, speed / 1.2);
      phase += dt * (4 + speed * 3.2) * (walk > 0.05 ? 1 : 0);
      const sw = Math.sin(phase) * 0.7 * walk;
      legs[0].rotation.x = sw; legs[1].rotation.x = -sw; arms[0].rotation.x = -sw * 0.9; arms[1].rotation.x = sw * 0.9;
      body.position.y = Math.abs(Math.cos(phase)) * 0.03 * walk + Math.sin(t * 2.2) * 0.006 * (1 - walk);
      body.rotation.z = Math.sin(phase) * 0.04 * walk;
      head.rotation.y = (1 - walk) * Math.sin(t * 0.5) * 0.25;
    },
  };
  return root;
}

// ---------- rustling leaves on the map: something is hiding here ----------
export function makeRustle() {
  const g = new THREE.Group(), tuft = new THREE.Group(); g.add(tuft);
  const m = plush({ color: 0xffffff, vertexColors: true, roughness: 0.3 }, 0.3);
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(leafGeometry(0.5, 0.8, 0x2f9e24, 0x9be36a, true), m);
    leaf.rotation.set(-(0.95 + (i % 3) * 0.18), i / 7 * Math.PI * 2, 0, 'YXZ'); leaf.scale.setScalar(0.8 + (i % 2) * 0.25); tuft.add(leaf);
  }
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshBasicMaterial({ map: blobTexture(), color: 0x0d0a26, transparent: true, opacity: 0.3, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; g.add(shadow);
  let t = Math.random() * 10, burst = 0;
  g.userData = {
    update(dt) {
      t += dt; burst -= dt; if (burst < -1.6 - Math.random()) burst = 0.55;
      const k = burst > 0 ? Math.sin(burst * 40) * (burst / 0.55) : 0;
      tuft.rotation.set(k * 0.18, Math.sin(t * 0.7) * 0.2, k * 0.22); tuft.scale.set(1, 1 + Math.abs(k) * 0.08, 1);
    },
  };
  return g;
}

// ---------- portraits for the menus (Kikis, items, your explorer), rendered once and cached ----------
let pr = null; const portraits = new Map();
function portraitRenderer() {
  if (pr) return pr;
  const canvas = document.createElement('canvas'), r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  r.outputColorSpace = THREE.SRGBColorSpace; r.setClearColor(0x000000, 0);
  const scene = new THREE.Scene(); scene.add(new THREE.HemisphereLight(0xffffff, 0x9a8fd0, 1.7));
  const key = new THREE.DirectionalLight(0xfff2e0, 2.2); key.position.set(-1.2, 2, 2.4); scene.add(key);
  return pr = { r, scene, cam: new THREE.PerspectiveCamera(28, 1, 0.01, 50) };
}
/** A PNG data URL of a Kiki ('kiki:meadow'), an item ('item:moon') or the explorer ('explorer:outfit:skin'). */
export function portrait(what, size = 256) {
  const key = what + '@' + size; if (portraits.has(key)) return portraits.get(key);
  const { r, scene, cam } = portraitRenderer(); r.setSize(size, size, false);
  const [kind, a, b] = what.split(':'); let obj;
  if (kind === 'kiki') { obj = makeKiki(a, 1); obj.rotation.y = -0.35; cam.position.set(0, 0.62, 3.1); cam.lookAt(0, 0.6, 0); }
  else if (kind === 'explorer') { obj = makeExplorer(+a, +b); obj.userData.update(0, 0); obj.rotation.y = -0.3; cam.position.set(0, 0.78, 1.35); cam.lookAt(0, 0.74, 0); }
  else if (kind === 'explorer-full') { obj = makeExplorer(+a, +b); obj.userData.update(0, 0); obj.rotation.y = -0.4; cam.position.set(0, 0.62, 2.6); cam.lookAt(0, 0.5, 0); }
  else if (a === 'honey' || a === 'sunseed') { obj = makeTreat(a, 1); if (a === 'honey') obj.rotation.set(1.2, Math.PI - 0.7, 0); else obj.rotation.set(0.2, 0.5, -0.3); cam.position.set(0, 0, a === 'honey' ? 4.3 : 3.8); cam.lookAt(0, 0, 0); }
  else { obj = makeRuneStone(1, a); obj.rotation.set(-1.05, 0, 0.25); obj.userData.update(0, 0.25); cam.position.set(0, 0, 6.4); cam.lookAt(0, 0, 0); }
  scene.add(obj); r.render(scene, cam); const url = r.domElement.toDataURL('image/png'); scene.remove(obj);
  portraits.set(key, url); return url;
}
export { THREE };
