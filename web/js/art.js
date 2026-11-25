// KIKI SAFARI art for the web, in three.js. Kiki is the claw game's makeMascot() (Big Plush), with the same tweaks as
// the Unity project's Core/Art: chubbier pear body, bigger grin, bolder mirrored spirals, a V-folded leaf fan, and the
// six variants' crowns, markings and glow. Kikis are little creatures, not stuffed toys (owner): smooth skin, no seams. Plus the Rune Stone, the portal, Rune Circles and sparkles.
import * as THREE from '../vendor/three.module.min.js';
import { rng, hash, variant, kikiSize } from './core.js';
import { premium, light } from './lux.js';
import { mergeGeometries, mergeVertices } from '../vendor/addons/utils/BufferGeometryUtils.js';
import { makeExplorer3D, explorerReady, preloadExplorer, loadExplorerKit, SEXES, SHIRTS, LEGWEAR, HAIRDOS, HAIR_FOR, SHADES, FRAMES, LENSES, SHOES, SHOE_COLORS } from './explorer3d.js';
export { preloadExplorer, loadExplorerKit, explorerReady, SEXES, SHIRTS, LEGWEAR, HAIRDOS, HAIR_FOR, SHADES, FRAMES, LENSES, SHOES, SHOE_COLORS };

export const EGG_H = 1.15, GROUND = EGG_H + 0.12, BODY_H = GROUND + EGG_H;
const C = h => new THREE.Color(h);
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------- looks (decisions doc section 3; Phase 2 roster in species.js) ----------
const HEX = h => '#' + h.toString(16).padStart(6, '0');
/** Sparkle Kikis: every colour turned around the colour wheel, a little brighter. */
function shift(hex, dh = 0.42, dl = 0.04, sm = 1.05) { const c = C(hex), hsl = {}; c.getHSL(hsl); return c.setHSL((hsl.h + dh) % 1, Math.min(1, hsl.s * sm), Math.min(0.9, hsl.l + dl)).getHex(); }
const shiftCss = (css, dh) => HEX(shift(parseInt(css.slice(1), 16), dh, 0));
export function lookFor(id, sparkle = false) {
  const v = variant(id);
  const look = { crown: 'canon', leaf: 0x38a626, tip: 0x92e25c, body: 0xffc928, rainbow: false, gold: false, belly: null, stars: false, glow: false, ...((v && v.look) || {}), scale: kikiSize(v.id) }; // (size by rarity and evolution: core.kikiSize)
  if (!sparkle) return look;
  const out = { ...look, sparkle: true, body: shift(look.body, look.body === 0xffc928 ? 0.8 : 0.42, 0.1, 0.7) };
  for (const k of ['leaf', 'tip', 'c1', 'c2']) if (typeof out[k] === 'number' && out[k] > 16) out[k] = shift(out[k]);
  if (typeof look.c3 === 'number' && look.c3 > 16) out.c3 = shift(look.c3);
  if (out.glow) out.glow = shift(out.glow); if (out.belly) out.belly = [out.belly[0], shiftCss(out.belly[1], 0.42), shiftCss(out.belly[2], 0.42)];
  out.starColor = '#ffd23f';
  return out;
}

// ---------- skin texture and normal map (canvas) ----------
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
/** Tummy marking shapes (Phase 2), centred at (x, y), about 2R across. */
function bellyPath(g, shape, x = 512, y = 366, R = 52) {
  g.beginPath();
  const P = pts => pts.forEach(([px, py], i) => i ? g.lineTo(x + px * R, y + py * R) : g.moveTo(x + px * R, y + py * R));
  switch (shape) {
    case 'drop': g.moveTo(x, y - R); g.bezierCurveTo(x + R * 0.95, y - R * 0.05, x + R * 0.8, y + R * 0.95, x, y + R * 0.95); g.bezierCurveTo(x - R * 0.8, y + R * 0.95, x - R * 0.95, y - R * 0.05, x, y - R); break;
    case 'flame': g.moveTo(x, y + R); g.bezierCurveTo(x - R, y + R, x - R * 0.85, y, x - R * 0.35, y - R * 0.45); g.lineTo(x - R * 0.18, y - R * 0.05); g.bezierCurveTo(x - R * 0.12, y - R * 0.6, x + R * 0.1, y - R * 0.85, x + R * 0.05, y - R * 1.1); g.bezierCurveTo(x + R * 0.65, y - R * 0.5, x + R * 1.0, y + R * 0.2, x + R * 0.72, y + R * 0.7); g.bezierCurveTo(x + R * 0.5, y + R, x + R * 0.2, y + R, x, y + R); break;
    case 'bolt': P([[0.25, -1], [-0.3, -1], [-0.6, 0.1], [-0.1, 0.1], [-0.4, 1.05], [0.6, -0.15], [0.05, -0.15]]); break;
    case 'star': { const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.45 : 1.05; pts.push([Math.cos(a) * r, Math.sin(a) * r + 0.05]); } P(pts); break; }
    case 'moon': g.arc(x, y, R, Math.PI * 0.35, Math.PI * 1.65, false); g.arc(x + R * 0.5, y - R * 0.05, R * 0.82, Math.PI * 1.55, Math.PI * 0.45, true); break;
    case 'heart': g.moveTo(x, y + R * 0.95); g.bezierCurveTo(x - R * 1.3, y + R * 0.05, x - R * 0.8, y - R * 1.1, x, y - R * 0.45); g.bezierCurveTo(x + R * 0.8, y - R * 1.1, x + R * 1.3, y + R * 0.05, x, y + R * 0.95); break;
    case 'leaf': g.moveTo(x - R * 0.2, y + R); g.bezierCurveTo(x - R * 1.1, y + R * 0.1, x - R * 0.4, y - R * 0.9, x + R * 0.6, y - R); g.bezierCurveTo(x + R * 0.8, y, x + R * 0.4, y + R * 0.8, x - R * 0.2, y + R); break;
    default: spiralPath(g, x, y, R, 1); return 'stroke';
  }
  g.closePath(); return 'fill';
}
const texCache = new Map(), normCache = new Map();
function faceTextures(look) {
  const key = look.body + ':' + (look.belly ? look.belly.join() : '') + (look.stars ? 's' + (look.starColor || '') : '');
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = HEX(look.body); g.fillRect(0, 0, 1024, 512);
  const r = rng(1);
  for (let i = 0; i < 900; i++) { g.fillStyle = r.next() < 0.5 ? 'rgba(255,255,255,.035)' : 'rgba(120,60,0,.03)'; g.beginPath(); g.arc(r.next() * 1024, r.next() * 512, 3 + r.next() * 6, 0, 7); g.fill(); } // soft skin mottling
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (look.stars) {
    g.strokeStyle = look.starColor || '#c77dff';
    for (const sx of [256, 768]) for (let y = 26; y < 492; y += 34) for (const side of [-1, 1]) {
      const x = sx + side * 16, s = 6.5;
      g.lineWidth = 2.6; g.beginPath(); g.moveTo(x - s, y); g.lineTo(x + s, y); g.moveTo(x, y - s); g.lineTo(x, y + s); g.stroke();
      g.lineWidth = 1.8; g.beginPath(); g.moveTo(x - s * .55, y - s * .55); g.lineTo(x + s * .55, y + s * .55); g.moveTo(x - s * .55, y + s * .55); g.lineTo(x + s * .55, y - s * .55); g.stroke();
    }
  }
  if (look.belly && look.bellyOn) { // tummy markings are off for every Kiki (owner: "no stickers on their stomachs")
    const [shape, dark, light] = look.belly;
    if (bellyPath(g, shape) === 'stroke') { g.strokeStyle = dark; g.lineWidth = 10; g.stroke(); bellyPath(g, shape); g.strokeStyle = light; g.lineWidth = 5.5; g.stroke(); }
    else { g.fillStyle = light; g.fill(); g.strokeStyle = dark; g.lineWidth = 5; g.stroke(); } // a natural marking, like a patch of colour
  }
  for (const s of [-1, 1]) {
    g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.arc(CX + s * EYE_DX, EYE_Y, 44, 0, 7); g.fill();
    spiralPath(g, CX + s * EYE_DX, EYE_Y, SPIRAL_R, s); g.strokeStyle = '#4a1a0c'; g.lineWidth = SPIRAL_R * 0.26; g.stroke();
  }
  mouthPath(g); g.fillStyle = '#7a0f1c'; g.fill();
  g.save(); g.clip(); g.fillStyle = '#ff4a2e'; g.beginPath(); g.ellipse(CX, MY + MH, MW * 0.68, MH * 0.58, 0, 0, 7); g.fill(); g.restore();
  mouthPath(g); g.strokeStyle = 'rgba(110,50,0,.35)'; g.lineWidth = 4; g.stroke();
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
  const res = { map, normal: normalMap(look.belly ? look.belly[0] : '') };
  texCache.set(key, res);
  return res;
}
/** Skin normal map: smooth, with the eyes very slightly domed and the mouth carved in. (No seams or stitches: Kikis are creatures.) */
function normalMap(belly) {
  belly = ''; // markings are colour only
  if (normCache.has(belly)) return normCache.get(belly);
  const n = document.createElement('canvas'); n.width = 1024; n.height = 512;
  const h = n.getContext('2d', { willReadFrequently: true });
  h.fillStyle = '#808080'; h.fillRect(0, 0, 1024, 512);
  h.lineCap = 'round'; h.lineJoin = 'round';
  for (const s of [-1, 1]) { const ex = CX + s * EYE_DX; for (let k = 0; k < 8; k++) { h.fillStyle = 'rgba(255,255,255,.04)'; h.beginPath(); h.arc(ex, EYE_Y, 50 - k * 3, 0, 7); h.fill(); } }
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
  normCache.set(belly, normal); return normal;
}

// ---------- geometry ----------
const geoCache = new Map();
// (shapes kept here are shared by many objects: marked so clean-ups leave them alone)
const cached = (k, f) => { if (!geoCache.has(k)) { const g = f(); if (g && g.userData) g.userData.shared = true; geoCache.set(k, g); } return geoCache.get(k); };

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
    // A rounded shoulder (a ball that stays buried inside the body) so the arm never opens up at the seam when it waves
    // or swings, then the arm itself, tapering to a round tip.
    const pts = [];
    for (let j = 0; j < 8; j++) { const f = -Math.PI / 2 + j / 8 * Math.PI / 2; pts.push(new THREE.Vector2(Math.max(1e-4, 0.3 * Math.cos(f)), -0.12 + 0.3 * Math.sin(f))); }
    for (let i = 0; i <= 14; i++) { const t = i / 14, tip = Math.max(0, (t - 0.72) / 0.28); pts.push(new THREE.Vector2(Math.max(1e-4, (0.3 - 0.07 * t) * Math.sqrt(1 - tip * tip)), -0.12 + 0.62 * t)); }
    return new THREE.LatheGeometry(pts, 20);
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
export function leafGeometry(width, round, base, tip, strongTip, detail = 1) {
  const g = new THREE.SphereGeometry(1, Math.max(6, Math.round(14 * detail)), Math.max(8, Math.round(22 * detail))); g.rotateX(Math.PI / 2);
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
// ---------- crowns (Phase 2: one builder per crown style; all parts are vertex-coloured and merged) ----------
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
function paint(geo, fn) { const p = geo.attributes.position, cols = []; for (let i = 0; i < p.count; i++) { const c = fn(p.getX(i), p.getY(i), p.getZ(i)); cols.push(c.r, c.g, c.b); } geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); return geo; }
const solid = (geo, hex) => paint(geo, () => C(hex));
const vgrad = (geo, a, b, y0, y1) => paint(geo, (x, y) => C(a).lerp(C(b), smooth(y0, y1, y)));
const noise3 = (x, y, z) => Math.sin(x * 12.9 + y * 7.3) * Math.cos(z * 9.1 - y * 4.7) * 0.5 + Math.sin(x * 31 + z * 23) * 0.25;
const at = (geo, x, y, z, rx = 0, ry = 0, s = 1, sy = s, sz = s) => [geo, M4(x, y, z, rx, ry, s, sy, sz)];
function taperTube(pts, r0, r1, colorAt, segs = 40, radial = 10) {
  const curve = new THREE.CatmullRomCurve3(pts), g = new THREE.TubeGeometry(curve, segs, 1, radial, false), p = g.attributes.position, cols = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, c = curve.getPointAt(t), r = r0 + (r1 - r0) * t, col = colorAt(t);
    for (let j = 0; j <= radial; j++) { const k = i * (radial + 1) + j, v = V3(p.getX(k), p.getY(k), p.getZ(k)).sub(c).multiplyScalar(r).add(c); p.setXYZ(k, v.x, v.y, v.z); cols.push(col.r, col.g, col.b); }
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.computeVertexNormals(); return g;
}
/** A teardrop flame: round at the bottom, pointed at the top, leaning by `bend`; base at y=0. */
function flameGeo(h, w, a, b, bend = 0) {
  const pts = []; for (let i = 0; i <= 18; i++) { const t = i / 18; pts.push(new THREE.Vector2(Math.max(1e-4, w * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.6)), 1.1) * (1 - 0.25 * t)), t * h)); }
  const g = new THREE.LatheGeometry(pts, 14), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const t = p.getY(i) / h; p.setX(i, p.getX(i) + bend * t * t * h); }
  g.computeVertexNormals(); return vgrad(g, a, b, 0.05 * h, 0.85 * h);
}
function extrude(points, depth, a, b, h) {
  const s = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: depth * 0.3, bevelSize: depth * 0.25, bevelSegments: 2, curveSegments: 4 });
  g.translate(0, 0, -depth / 2); return vgrad(g, a, b, 0, h);
}
const boltGeo = (h, a, b) => { const g = extrude([[-0.25, 0], [0.25, 0], [0.05, 0.45], [0.3, 0.45], [-0.2, 1], [0, 0.55], [-0.25, 0.55]].map(([x, y]) => [x * h, y * h]), 0.12 * h, a, b, h); return paint(g, (x, y) => C(a).lerp(C(b), smooth(0.75 * h, h, y))); };
function starGeo(r, a, b = a) { const pts = []; for (let i = 0; i < 10; i++) { const ang = Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; pts.push([Math.cos(ang) * rr, Math.sin(ang) * rr + r]); } return extrude(pts, r * 0.35, a, b, 2 * r); }
/** A crescent moon standing up, thick in the middle and pointed at both ends. */
function crescentGeo(R, tube, color) {
  const arc = Math.PI * 1.3, g = new THREE.TorusGeometry(R, tube, 12, 48, arc), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), th = Math.atan2(y, x), u = Math.min(1, Math.max(0, (th < -0.01 ? th + Math.PI * 2 : th) / arc)), cx = Math.cos(th) * R, cy = Math.sin(th) * R, k = Math.max(0.08, Math.pow(Math.sin(Math.PI * u), 0.8)); p.setXYZ(i, cx + (x - cx) * k, cy + (y - cy) * k, z * k); }
  g.rotateZ(-Math.PI * 0.15 - arc / 2 + Math.PI / 2); g.computeVertexNormals(); return solid(g, color);
}
function rock(r, detail, a, b, seed) {
  const g = new THREE.IcosahedronGeometry(r, detail), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const v = V3(p.getX(i), p.getY(i), p.getZ(i)), n = 1 + 0.18 * noise3(v.x / r + seed, v.y / r, v.z / r - seed); v.multiplyScalar(n); p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); return paint(g, (x, y, z) => C(a).lerp(C(b), 0.5 + 0.5 * noise3(x * 3 + seed, y * 3, z * 3)));
}
const sphere = (r, color, ws = 16, hs = 12) => solid(new THREE.SphereGeometry(r, ws, hs), color);
const cyl = (r0, r1, h, color, seg = 12) => solid(new THREE.CylinderGeometry(r0, r1, h, seg), color);
/** Leaf-fan crowns (the classic Kiki crown and its relatives). */
const FANS = {
  canon: { width: 0.46, layers: [[6, 0.84, 0.82, 0], [4, 0.78, 1.15, 0.4], [2, 0.6, 1.45, 1.1]] },
  pine: { width: 0.13, layers: [[9, 1.0, 0.85, 0], [7, 0.92, 1.12, 0.35], [4, 0.72, 1.4, 0.9]] },
  grand: { width: 0.5, layers: [[8, 0.98, 0.78, 0], [6, 0.92, 1.08, 0.3], [4, 0.78, 1.32, 0.85], [2, 0.62, 1.52, 1.4]] },
  elder: { width: 0.13, layers: [[11, 1.12, 0.8, 0], [9, 1.04, 1.04, 0.3], [7, 0.92, 1.26, 0.7], [4, 0.74, 1.48, 1.1]] },
};
function fanParts(look, R, fan, baseY) {
  const parts = [], total = fan.layers.reduce((a, l) => a + l[0], 0);
  const tipFor = i => look.gold ? 0xffd23f : look.rainbow ? hsv((i * 0.61803) % 1, 0.75, 1).getHex() : look.tip;
  let idx = 0;
  for (const [n, len, pitch, spin] of fan.layers) for (let i = 0; i < n; i++, idx++) {
    const yaw = i / n * Math.PI * 2 + spin + R(-0.12, 0.12), s = len * R(0.92, 1.08);
    parts.push([leafGeometry(fan.width, 0.8, look.leaf, tipFor(idx), true), M4(0, baseY, 0, -(pitch + R(-0.08, 0.08)), yaw, s, s, s)]);
  }
  return parts;
}
function stem(baseY, top, color) {
  const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new THREE.Vector2(0.08 * (1 - 0.4 * t), baseY - 0.08 + t * (top - baseY + 0.08))); }
  return solid(new THREE.LatheGeometry(pts, 10), C(color).lerp(C(0x7fcf5a), 0.4).getHex());
}
// ---------- crown helpers (refinement pass, owner: "dial in their looks so they don't appear dumb or half-assed") ----------
const V2 = (x, y) => new THREE.Vector2(x, y);
/** Place a part so its +z points along dir and its +y as near `up` as it can be. */
function aim(geo, pos, dir, up = V3(0, 1, 0), sx = 1, sy = sx, sz = sx, tag) {
  const z = dir.clone().normalize(); let x = up.clone().cross(z); if (x.lengthSq() < 1e-8) x = V3(1, 0, 0).cross(z); x.normalize(); const y = z.clone().cross(x);
  const m = new THREE.Matrix4().makeBasis(x.multiplyScalar(sx), y.multiplyScalar(sy), z.multiplyScalar(sz)).setPosition(pos);
  return tag ? [geo, m, tag] : [geo, m];
}
/** Place a part so its +y points along n (spun about it), at pos. */
function stand(geo, pos, n, sx = 1, sy = sx, sz = sx, spin = 0, tag) {
  const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), n.clone().normalize()).multiply(new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), spin));
  const m = new THREE.Matrix4().compose(pos, q, V3(sx, sy, sz)); return tag ? [geo, m, tag] : [geo, m];
}
const moveParts = (parts, m) => parts.map(([g, mm, tag]) => [g, m.clone().multiply(mm), tag]);
const rotZ = a => new THREE.Matrix4().makeRotationZ(a);
const latheOf = (pts, segs, colorAt) => { const g = new THREE.LatheGeometry(pts.map(([r, y]) => V2(Math.max(1e-4, r), y)), segs); return colorAt ? paint(g, colorAt) : g; };
/** A smooth river pebble, flattened, with soft speckles, a lighter top and (optionally) moss on top. */
function pebbleGeo(sx, sy, sz, a, b, seed, moss = null) {
  const g = new THREE.SphereGeometry(1, 30, 20), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = V3(p.getX(i), p.getY(i), p.getZ(i)); v.multiplyScalar(1 + 0.05 * Math.sin(v.x * 3 + seed) * Math.cos(v.z * 2.6 - seed) + 0.03 * Math.sin(v.y * 4 + seed * 2));
    if (v.y < -0.6) v.y = -0.6 + (v.y + 0.6) * 0.4; // a flatter underside, so it sits
    p.setXYZ(i, v.x * sx, v.y * sy, v.z * sz);
  }
  g.computeVertexNormals();
  return paint(g, (x, y, z) => {
    const ny = y / sy, speck = noise3(x * 9 + seed, y * 9, z * 9 - seed) > 0.6 ? 0.8 : noise3(x * 11 - seed, y * 11, z * 11) > 0.65 ? 1.12 : 1;
    let c = C(a).lerp(C(b), 0.5 + 0.5 * noise3(x * 2 + seed, y * 2, z * 2)).multiplyScalar(speck * (0.8 + 0.26 * smooth(-0.9, 0.9, ny)));
    if (moss && ny > 0.45 + 0.4 * noise3(x * 4.5 + seed, 0, z * 4.5)) c = C(moss).lerp(C(0xb6e07a), smooth(0.4, 1, ny) * 0.45).multiplyScalar(0.9 + 0.18 * noise3(x * 14, y * 14, z * 14));
    return c;
  });
}
/** A plump five-pointed star like a little cushion (rounded points, soft domed faces), centred, facing +z. */
function puffyStar(r, tipC, midC, depth = 0.3) {
  const n = r < 0.08 ? [24, 12] : [48, 24], g = new THREE.SphereGeometry(1, n[0], n[1]), p = g.attributes.position, th = r * (0.3 + depth * 0.25);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), ph = Math.atan2(y, x) - Math.PI / 2, k = Math.pow(0.5 + 0.5 * Math.cos(5 * ph), 1.7), R = r * (0.5 + 0.5 * k);
    p.setXYZ(i, x * R, y * R, z * th * (0.55 + 0.45 * (1 - k * 0.6)));
  }
  g.computeVertexNormals();
  return paint(g, (x, y, z) => C(midC).lerp(C(tipC), smooth(r * 0.1, r * 0.9, Math.hypot(x, y))).multiplyScalar(0.9 + 0.12 * smooth(-th * 0.5, th, z)));
}
/** One toadstool, foot of the stem at the origin: a domed cap with a curled rim, fine gills underneath, raised spots,
 *  and a stem that swells at the foot, with a skirt. */
function toadstool({ capR = 0.7, capH = 0.48, stemH = 0.36, stemR = 0.17, cap, spot, stem = 0xfbf4e6, gill = 0xf1e2c6, rimGlow = null, glowSpots = false, spots = 9, seed = 1, segs = 80 }) {
  const parts = [], I = new THREE.Matrix4();
  const sp = [[0, 0]]; for (let i = 0; i <= 10; i++) { const t = i / 10; sp.push([stemR * (1.2 - 0.36 * t + 0.1 * Math.sin(Math.PI * t)) * (i === 0 ? 0.9 : 1), t * (stemH + 0.04)]); } sp.push([0, stemH + 0.04]);
  parts.push([latheOf(sp, 28, (x, y, z) => C(stem).lerp(C(0xdcc8a6), smooth(stemH * 0.55, 0, y) * 0.4).multiplyScalar(0.95 + 0.05 * Math.sin(Math.atan2(z, x) * 14))), I]);
  const ky = stemH * 0.64, skirt = latheOf([[stemR * 0.84, ky + 0.03], [stemR * 1.45, ky - 0.005], [stemR * 1.72, ky - 0.06], [stemR * 1.62, ky - 0.07], [stemR * 1.28, ky - 0.025], [stemR * 0.84, ky]], 48);
  { const p = skirt.attributes.position; for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)), r = Math.hypot(p.getX(i), p.getZ(i)); p.setY(i, p.getY(i) + 0.014 * Math.sin(a * 9) * smooth(stemR, stemR * 1.6, r)); } skirt.computeVertexNormals(); }
  parts.push([paint(skirt, () => C(stem).multiplyScalar(0.92)), I]);
  const dome = ph => [capR * Math.sin(ph), capH * Math.pow(Math.cos(ph), 1.25)];
  const cp = []; for (let i = 0; i <= 24; i++) cp.push(dome(i / 24 * Math.PI / 2));
  cp.push([capR * 1.015, -0.035], [capR * 0.985, -0.07], [capR * 0.9, -0.075]);
  for (let i = 1; i <= 8; i++) { const t = i / 8; cp.push([capR * 0.9 - (capR * 0.9 - stemR * 0.95) * t, -0.075 + 0.05 * t]); }
  cp.push([0, -0.02]);
  const capG = paint(latheOf(cp, segs), (x, y, z) => {
    const r = Math.hypot(x, z), a = Math.atan2(z, x);
    if (y < -0.015 && r < capR * 0.93) return C(gill).multiplyScalar((0.76 + 0.24 * (0.5 + 0.5 * Math.cos(a * 44))) * (0.74 + 0.26 * smooth(stemR, capR * 0.9, r))); // the gills
    const u = Math.min(1, Math.max(0, y / capH));
    const c = C(cap).multiplyScalar(0.78 + 0.3 * u).lerp(C(0xffffff), smooth(0.75, 1, u) * 0.08).multiplyScalar(0.96 + 0.06 * noise3(x * 5 + seed, y * 5, z * 5));
    return rimGlow ? c.lerp(C(rimGlow), smooth(0.3, 0, u) * 0.8) : c;
  });
  parts.push([capG, new THREE.Matrix4().makeTranslation(0, stemH, 0)]);
  for (let i = 0; i < spots; i++) {
    const u = (i + 0.5) / spots, ph = 0.1 + Math.acos(1 - u * 0.95) * 0.8, th = i * 2.39996 + seed;
    const [r, y] = dome(ph), dr = capR * Math.cos(ph), dy = -capH * 1.25 * Math.pow(Math.max(1e-4, Math.cos(ph)), 0.25) * Math.sin(ph), nl = Math.hypot(dr, dy);
    const n = V3(-dy / nl * Math.sin(th), dr / nl, -dy / nl * Math.cos(th)), sz = capR * (0.17 - 0.07 * u) * (0.85 + 0.3 * ((i * 37) % 7) / 7);
    const g = paint(new THREE.SphereGeometry(1, 16, 8), (x, yy) => C(spot).multiplyScalar(0.9 + 0.12 * yy));
    parts.push(stand(g, V3(r * Math.sin(th), stemH + y, r * Math.cos(th)).addScaledVector(n, sz * 0.1), n, sz, sz * 0.32, sz * 0.88, th, glowSpots ? 'glow' : undefined));
  }
  return parts;
}
/** A soft conical hat from the brim up (lathe), wrinkled, its tip bent over by `bend` and drooping by `droop`. */
function hatCone(R0, H, bend, droop, colorAt, back = 0) {
  const cp = []; for (let i = 0; i <= 36; i++) { const t = i / 36; cp.push([R0 * Math.pow(1 - t, 0.92) * (1 + 0.05 * Math.sin(t * 10)), t * H]); }
  const g = latheOf(cp, 44), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const t = p.getY(i) / H, k = Math.pow(Math.max(0, t - 0.3) / 0.7, 2.2); p.setX(i, p.getX(i) + k * bend); p.setY(i, p.getY(i) - k * droop); p.setZ(i, p.getZ(i) - back * t * t); }
  g.computeVertexNormals(); return paint(g, colorAt);
}
/** A hat brim: a ring, curling up at the edge, gently wavy. */
function hatBrim(rin, rout, curl, wave, color, segs = 72) {
  const bp = [];
  for (let i = 0; i <= 14; i++) { const t = i / 14; bp.push([rin + (rout - rin) * t, 0.03 + curl * Math.pow(smooth(0.5, 1, t), 1.6)]); }
  bp.push([rout + 0.015, curl + 0.035], [rout, curl + 0.005]);
  for (let i = 14; i >= 0; i--) { const t = i / 14; bp.push([rin + (rout - rin) * t, curl * 0.9 * Math.pow(smooth(0.5, 1, t), 1.6)]); }
  const g = latheOf(bp, segs), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z), a = Math.atan2(z, x), w = smooth(rin, rout, r); p.setY(i, p.getY(i) + w * wave * (Math.sin(a * 2 + 0.6) + 0.5 * Math.sin(a * 5))); }
  g.computeVertexNormals(); return paint(g, (x, y, z) => C(color).multiplyScalar(0.82 + 0.22 * smooth(rin, rout, Math.hypot(x, z))));
}
/** An oak leaf (lobed), stem at z=0 to tip at z=1. */
function oakLeafGeometry(base, tip) {
  const g = new THREE.SphereGeometry(1, 24, 30); g.rotateX(Math.PI / 2);
  const p = g.attributes.position, cols = [], b = C(base), t = C(tip);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), u = (z + 1) / 2, r = Math.max(1e-4, Math.hypot(x, y));
    const k = Math.pow(Math.sin(Math.PI * Math.pow(u, 0.8)), 0.8) * (0.62 + 0.38 * Math.pow(Math.abs(Math.sin(u * Math.PI * 4.5)), 0.6)) / r;
    const nx = x * k * 0.42, ny = y * k * 0.04 + Math.abs(nx) * 0.35 - 0.12 * u * u; p.setXYZ(i, nx, ny, u);
    const vein = Math.max(0, 1 - Math.abs(nx) / 0.025), c = b.clone().lerp(t, smooth(0.3, 1, u) * 0.6).multiplyScalar(Math.min(1, 0.78 + 0.18 * u + 0.12 * vein)); cols.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); g.computeVertexNormals(); return g;
}
/** A small acorn (nut and cap), hanging from y=0 down. */
function acornNut(capC) {
  const nut = latheOf([[0, -0.2], [0.05, -0.19], [0.08, -0.14], [0.085, -0.08], [0.075, -0.03], [0, -0.02]], 16, (x, y) => C(0xc98a3c).lerp(C(0x8a5a20), smooth(-0.2, -0.05, y) * 0.5));
  const cap = latheOf([[0, 0.01], [0.06, 0], [0.095, -0.03], [0.09, -0.06], [0, -0.05]], 16, () => C(capC).multiplyScalar(0.9));
  return merge([[nut, new THREE.Matrix4()], [cap, new THREE.Matrix4()]]);
}
/** One wave, its foot at the origin, curling over towards +z: a thick blade swept along a curl, wide across x. */
function waveCurl(deep, foam, W, seed, R) {
  const curve = new THREE.CatmullRomCurve3([[0, 0.0, 0.1], [0, 0.3, 0.04], [0, 0.6, 0.02], [0, 0.84, 0.12], [0, 0.92, 0.32], [0, 0.84, 0.5], [0, 0.68, 0.52], [0, 0.6, 0.42], [0, 0.64, 0.34]].map(([x, y, z]) => V3(x, y, z)));
  const S = 72, A = 20, pos = [], col = [], idx = [], mid = C(deep).lerp(C(0x7fe0ff), 0.55);
  for (let i = 0; i <= S; i++) {
    const t = i / S, c = curve.getPointAt(t), T = curve.getTangentAt(t), N = V3(0, -T.z, T.y).normalize(), w = W * (1 - 0.6 * Math.pow(t, 1.2)) * (0.92 + 0.08 * Math.sin(t * 9 + seed)), h = 0.27 * Math.pow(1 - t, 1.15) + 0.022; // a full body that thins to the curl
    for (let j = 0; j <= A; j++) {
      const a = j / A * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), edge = Math.pow(Math.abs(ca), 3);
      const x = w * ca, q = c.clone().addScaledVector(N, h * sa * (1 - 0.5 * edge)); q.y += 0.03 * edge * Math.sin(seed + ca * 3) * t; q.x = x;
      pos.push(q.x, q.y, q.z);
      let k = C(deep).lerp(mid, smooth(0, 0.55, t)); k.lerp(C(foam), smooth(0.66, 0.86, t) + smooth(0.75, 0.95, edge) * smooth(0.45, 0.7, t) * 0.5);
      if (sa > 0.2 && t > 0.4 && t < 0.72) k.lerp(C(foam), smooth(0.2, 0.9, sa) * smooth(0.4, 0.62, t) * 0.55); // foam along the top of the crest
      k.multiplyScalar(0.9 + 0.12 * sa); col.push(k.r, k.g, k.b);
    }
  }
  for (let i = 0; i < S; i++) for (let j = 0; j < A; j++) { const a = i * (A + 1) + j, b = a + A + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  const parts = [[g, new THREE.Matrix4()]];
  // spray off the crest
  for (let i = 0; i < 5; i++) { const x = (i / 4 - 0.5) * W * 1.2, r = 0.028 + 0.018 * ((i * 7) % 3); parts.push([sphere(r, foam, 12, 8), new THREE.Matrix4().setPosition(x, 0.97 + 0.07 * ((i * 5) % 3), 0.42 + 0.08 * ((i * 3) % 3))]); }
  return parts;
}
/** A lily pad, draped like a beret: notched, veined, lighter at the rim. */
function lilyPad(Rp, color) {
  const notch = 0.5, g = new THREE.RingGeometry(0.015, Rp, 72, 10, notch / 2, Math.PI * 2 - notch); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z) / Rp, a = Math.atan2(z, x); p.setY(i, -0.34 * Rp * r * r + 0.025 * Math.sin(a * 7) * r * r * r); }
  g.computeVertexNormals();
  return paint(g, (x, y, z) => { const r = Math.hypot(x, z) / Rp, a = Math.atan2(z, x), vein = 1 - smooth(0.0, 0.05, Math.abs(Math.sin(a * 8))) * smooth(0.12, 0.3, r);
    return C(color).lerp(C(0xb8ec7a), smooth(0.55, 1, r) * 0.45).multiplyScalar((0.85 + 0.15 * r) * (1 - 0.18 * vein)); });
}
/** A water lily or lotus flower, base at the origin: layers of pointed petals opening out, and a golden middle. */
function lilyFlower(tipC, baseC, midC, size, layers, broad = 0.5, pod = false) {
  const parts = [];
  layers.forEach(([n, pitch, s], L) => { for (let i = 0; i < n; i++) { const k = size * s; parts.push([leafGeometry(broad, 0.9, baseC, tipC, true), M4(0, 0.02 + L * 0.02, 0, -pitch, i / n * Math.PI * 2 + L * 0.4, k, k, k)]); } });
  if (pod) {
    parts.push([latheOf([[0, size * 0.36], [size * 0.3, size * 0.36], [size * 0.33, size * 0.31], [size * 0.18, 0.02], [0, 0.02]], 32, (x, y) => C(midC).lerp(C(0x9fd45a), smooth(size * 0.3, size * 0.1, y) * 0.6)), new THREE.Matrix4()]);
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2, r = i ? size * 0.17 : 0; parts.push([sphere(size * 0.045, 0x6a7a2a, 8, 6), new THREE.Matrix4().makeTranslation(Math.cos(a) * r, size * 0.36, Math.sin(a) * r)]); }
  } else {
    parts.push([sphere(size * 0.2, midC, 18, 12), M4(0, size * 0.1, 0, 0, 0, 1, 0.55, 1)]);
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; parts.push([sphere(size * 0.045, 0xffb020, 8, 6), new THREE.Matrix4().makeTranslation(Math.cos(a) * size * 0.2, size * 0.2, Math.sin(a) * size * 0.2)]); }
  }
  return parts;
}
/** Where to put a part so its lowest point sits at height y (after transform m). */
function seat(geo, m, y) { const c = geo.clone().applyMatrix4(m); c.computeBoundingBox(); const d = y - c.boundingBox.min.y; c.dispose(); return new THREE.Matrix4().makeTranslation(0, d, 0).multiply(m); }
/** A swirling portal disc, facing +z. */
function swirlDisc(r, a, b) {
  const g = new THREE.CircleGeometry(r, 72, 0, Math.PI * 2); const p = g.attributes.position; // (more rings for the swirl)
  const rings = new THREE.RingGeometry(0.001, r, 72, 12);
  return paint(rings, (x, y) => { const rr = Math.hypot(x, y) / r, t = Math.atan2(y, x); return C(a).lerp(C(b), 0.5 + 0.5 * Math.sin(t * 2 - rr * 14)).lerp(C(0xffffff), smooth(0.25, 0, rr) * 0.8).multiplyScalar(0.6 + 0.4 * (1 - rr)); });
}
const CROWNS = {
  // Lily Kiki: a lily pad worn like a beret, a pink water lily open on top.
  lily(look, R, Y) {
    return [[lilyPad(0.7, look.c1), M4(0, Y + 0.16, 0, 0.05, Math.PI * 0.5, 1, 1, 1)], ...moveParts(lilyFlower(look.c2, C(look.c2).lerp(C(0xffffff), 0.6).getHex(), 0xffd23f, 0.58, [[9, 0.95, 1.05], [7, 1.2, 0.92], [5, 1.42, 0.74]], 0.78), M4(0.08, Y + 0.13, 0.08, 0.05, 0.3, 1, 1, 1))];
  },
  // Lotus Kiki: a big lotus in bloom, broad cupped petals white at the base and pink at the tips, round a seed pod.
  lotus(look, R, Y) {
    return [[lilyPad(0.78, 0x3fae2a), M4(0, Y + 0.14, 0, 0, Math.PI * 0.5, 1, 1, 1)], ...moveParts(lilyFlower(look.c1, C(look.c1).lerp(C(look.c2), 0.65).getHex(), look.c3, 0.7, [[10, 0.9, 1.0], [8, 1.16, 0.9], [6, 1.4, 0.74]], 0.95, true), M4(0, Y + 0.08, 0.02, 0, 0, 1, 1, 1))];
  },
  // Marshmallow Kiki: a fat marshmallow toasted golden on top (caramel patches, a little melted drip), sitting on its
  // head, skewered by a twig.
  toast(look, R, Y) {
    const r = 0.38, h = 0.44, cr = 0.12, mp = [[0, -h / 2]];
    for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + i / 6 * Math.PI / 2; mp.push([r - cr + cr * Math.cos(a), -h / 2 + cr + cr * Math.sin(a)]); }
    for (let i = 0; i <= 6; i++) { const a = i / 6 * Math.PI / 2; mp.push([r - cr + cr * Math.cos(a), h / 2 - cr + cr * Math.sin(a)]); }
    mp.push([0, h / 2]);
    const g = latheOf(mp, 56), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + 0.05 * Math.cos(y / h * Math.PI) + 0.02 * noise3(x * 6, y * 6, z * 6); p.setXYZ(i, x * k, y, z * k); }
    g.computeVertexNormals();
    paint(g, (x, y, z) => { const top = smooth(0.02, h / 2, y), n = noise3(x * 7, y * 7, z * 7), toast = top * (0.75 + 0.4 * n);
      return C(0xfffaf2).lerp(C(0xf0c070), smooth(0.05, 0.4, toast)).lerp(C(look.c1), smooth(0.35, 0.75, toast)).lerp(C(0x6a3a12), smooth(0.85, 1.05, toast + 0.15 * top)); });
    const at0 = M4(0, Y + 0.12, 0, 0.12, 0.5, 1, 1, 1).multiply(rotZ(0.22)), parts = [[g, at0]];
    // a melted drip down the front
    parts.push([paint(new THREE.SphereGeometry(0.06, 14, 10), (x, y) => C(0xf8e2b0).lerp(C(look.c1), smooth(0, 0.06, y) * 0.6)), M4(0.08, Y + 0.22, 0.36, 0, 0, 1, 1.9, 0.9)]);
    // the twig, through the middle and out the back
    const c = V3(0, Y + 0.12, 0), d = V3(1, 0.42, -0.5).normalize(), bark = C(look.c2);
    parts.push([taperTube([c.clone().addScaledVector(d, 0.52), c.clone().addScaledVector(d, 0.1), c.clone().addScaledVector(d, -0.4), c.clone().addScaledVector(d, -0.95).add(V3(0, 0.05, 0))], 0.022, 0.036, t => bark.clone().multiplyScalar(t < 0.18 ? 0.55 : 0.95), 24, 8), new THREE.Matrix4()]);
    const fk = c.clone().addScaledVector(d, -0.72);
    parts.push([taperTube([fk, fk.clone().add(V3(-0.08, 0.16, 0.06)), fk.clone().add(V3(-0.1, 0.28, 0.12))], 0.018, 0.008, () => bark, 10, 6), new THREE.Matrix4()]);
    parts.push(aim(leafGeometry(0.55, 0.7, 0x3f8f2a, 0x9fd45a, true), fk.clone().add(V3(-0.1, 0.28, 0.12)), V3(-0.3, 0.6, 0.5), V3(0, 1, 0), 0.22, 0.22, 0.22));
    return moveParts(parts, new THREE.Matrix4().makeTranslation(0, Y, 0).multiply(new THREE.Matrix4().makeScale(1.35, 1.35, 1.35)).multiply(new THREE.Matrix4().makeTranslation(0, -Y - 0.03, 0)));
  },
  // Dusk Kiki: a plump crescent moon perched on its head, a little star dangling from the top tip.
  crescent(look, R, Y) {
    const moon = paint(crescentGeo(0.46, 0.17, look.c1), (x, y, z) => C(look.c1).multiplyScalar(0.84 + 0.18 * smooth(-0.1, 0.2, z) - 0.08 * (noise3(x * 6, y * 6, z * 6) > 0.5 ? 1 : 0)));
    const m = seat(moon, M4(0.06, 0, -0.04, -0.12, 0.3, 1, 1, 1).multiply(rotZ(0.35)), Y + 0.08); moon.computeBoundingBox();
    const parts = [[moon, m]];
    parts.push([puffyStar(0.085, 0xfff2a8, 0xffffff, 0.6), M4(-0.34, Y + 0.34, 0.16, 0, 0.3, 1, 1, 1), 'glow'], [puffyStar(0.05, 0xfff2a8, 0xffffff, 0.6), M4(0.4, Y + 0.18, 0.2, 0, -0.4, 1, 1, 1), 'glow']);
    return parts;
  },
  // Portal Wookie: the crescent moon in front of a little swirling portal, with stars circling.
  starry(look, R, Y) {
    const parts = CROWNS.crescent(look, R, Y);
    parts.push([swirlDisc(0.34, 0x5a2bd6, 0xc9a8ff), M4(-0.06, Y + 0.6, -0.22, 0, 0, 1, 1, 1), 'glow']);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, p = V3(Math.cos(a) * 0.66, Y + 0.42 + Math.sin(a) * 0.66 * Math.sin(0.35), Math.sin(a) * 0.66 * Math.cos(0.35)); parts.push([puffyStar(0.045 + (i % 2) * 0.015, look.c2, 0xffffff, 0.6), M4(p.x, p.y, p.z, 0, -a, 1, 1, 1), 'glow']); }
    return parts;
  },
  // Sunburst Kiki: a round sun standing on its head like a medallion, wavy flame rays all round it.
  sun(look, R, Y) {
    const ctr = V3(0, Y + 0.43, 0.02), disc = new THREE.SphereGeometry(0.34, 40, 24); disc.scale(1, 1, 0.42);
    const parts = [[paint(disc, (x, y, z) => C(look.c1).lerp(C(0xfff6c8), smooth(0.34, 0, Math.hypot(x, y)) * 0.55 * smooth(-0.05, 0.14, z)).lerp(C(look.c2), smooth(0.22, 0.34, Math.hypot(x, y)) * 0.35)), new THREE.Matrix4().setPosition(ctr)]];
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * Math.PI * 2 + Math.PI / 2; if (Math.sin(a) < -0.55) continue; // none down into its head
      const long = i % 2 === 0, len = long ? 0.36 : 0.24, g = flameGeo(len, long ? 0.1 : 0.08, look.c1, look.c2, (i % 4 < 2 ? 1 : -1) * 0.05);
      parts.push([g, new THREE.Matrix4().makeTranslation(ctr.x + Math.cos(a) * 0.3, ctr.y + Math.sin(a) * 0.3, ctr.z).multiply(rotZ(a - Math.PI / 2)).multiply(new THREE.Matrix4().makeScale(1, 1, 0.55))]);
    }
    parts.push([sphere(0.07, 0xffffff, 16, 12), M4(ctr.x - 0.1, ctr.y + 0.1, ctr.z + 0.12, 0, 0, 1, 1, 0.5), 'glow']); // a glint
    return moveParts(parts, new THREE.Matrix4().makeTranslation(0, Y, 0).multiply(new THREE.Matrix4().makeScale(1.45, 1.45, 1.45)).multiply(new THREE.Matrix4().makeTranslation(0, -Y - 0.06, 0))).map(([g, m, t]) => [g, new THREE.Matrix4().makeTranslation(0, -0.03, 0).multiply(m), t]);
  },
  // Aurora Kiki: three luminous ribbons of northern lights rising and swaying above its head.
  aurora(look, R, Y) {
    const parts = [];
    [[-0.22, -0.04, 0.45, 1.15], [0.2, 0.05, -0.45, 1.3], [0.02, -0.2, 1.75, 1.05], [0.0, 0.16, 0.05, 0.9]].forEach(([x, z, yaw, hh], k) => {
      const W = 0.62, g = new THREE.PlaneGeometry(W, hh, 12, 36), p = g.attributes.position; g.translate(0, hh / 2, 0);
      for (let i = 0; i < p.count; i++) { const u = p.getX(i) / W + 0.5, y = p.getY(i), t = y / hh; p.setXYZ(i, (u - 0.5) * W * (0.4 + 0.85 * t) + 0.16 * Math.sin(t * 5 + k * 2) * t, y, (0.2 * Math.sin(t * 6 + u * 2.2 + k) + 0.12 * Math.sin(u * 5 + k)) * t); }
      g.computeVertexNormals();
      paint(g, (px, y) => { const t = y / hh; return C(look.c1).lerp(C(0x6ff6ff), smooth(0.2, 0.55, t)).lerp(C(look.c2), smooth(0.5, 0.95, t)).multiplyScalar(0.55 + 0.45 * smooth(0, 0.25, t)); });
      parts.push([g, M4(x, Y - 0.04, z, 0, yaw, 1, 1, 1), 'glow']);
    });
    for (let i = 0; i < 5; i++) { const a = i * 1.3; parts.push([puffyStar(0.035, 0xffffff, 0xe0fff4, 0.6), new THREE.Matrix4().setPosition(Math.cos(a) * 0.5, Y + 0.6 + (i % 3) * 0.25, Math.sin(a) * 0.4), 'glow']); }
    return parts;
  },
  // Summit Kiki: three craggy peaks with ridges, a jagged snowline and a little flag on the top.
  mountain(look, R, Y) {
    const parts = [];
    [[0, 1.0, 0.44, 0, 0], [0.34, 0.68, 0.32, 0.14, 1.7], [-0.36, 0.74, 0.34, -0.08, 3.1]].forEach(([x, h, r, z, seed]) => {
      const g = new THREE.ConeGeometry(r, h, 16, 12), p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const px = p.getX(i), py = p.getY(i), pz = p.getZ(i), t = (py + h / 2) / h, a = Math.atan2(pz, px), k = 1 + (0.22 * Math.abs(Math.sin(a * 2.5 + seed)) - 0.1 + 0.08 * noise3(px * 8 + seed, py * 6, pz * 8)) * (1 - t); p.setXYZ(i, px * k, py, pz * k); }
      g.computeVertexNormals();
      paint(g, (px, py, pz) => { const t = (py + h / 2) / h, a = Math.atan2(pz, px), line = 0.56 + 0.1 * Math.sin(a * 5 + seed) + 0.06 * noise3(px * 9, py * 9, pz * 9);
        const rock = C(look.c1).multiplyScalar(0.78 + 0.25 * noise3(px * 7 + seed, py * 12, pz * 7) + 0.1 * t);
        return t > line ? C(look.c2).multiplyScalar(0.9 + 0.1 * t) : rock; });
      parts.push([g, M4(x, Y + h / 2 - 0.08, z, 0, seed, 1, 1, 1)]);
    });
    parts.push([cyl(0.01, 0.01, 0.22, 0x5a4a3a, 5), new THREE.Matrix4().setPosition(0, Y + 1.02, 0)]);
    parts.push([extrude([[0, 0], [0.18, 0.05], [0, 0.1]], 0.015, 0xff5d5d, 0xff5d5d, 0.1), M4(0.005, Y + 1.03, 0, 0, 0.3, 1, 1, 1)]);
    return parts;
  },
  // Acorn Kiki: a scaly acorn cap worn like a beret, a curly little stem, and an oak leaf tucked in at the side.
  acorn(look, R, Y) {
    const Rc = 0.66, Hc = 0.36, cp = []; for (let i = 0; i <= 28; i++) { const ph = i / 28 * Math.PI / 2; cp.push([Rc * Math.sin(ph), Hc * Math.pow(Math.cos(ph), 1.1)]); }
    cp.push([Rc * 1.03, -0.02], [Rc * 0.98, -0.06], [Rc * 0.75, -0.05], [0, -0.03]);
    const cap = latheOf(cp, 96), p = cap.attributes.position, cols = [];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = Math.hypot(x, z); if (y < -0.005) { const c = C(look.c1).multiplyScalar(0.6); cols.push(c.r, c.g, c.b); continue; }
      const v = Math.min(1, y / Hc), rows = 8, row = Math.floor(v * rows), cols2 = 22 - row * 2, a = (Math.atan2(z, x) / (Math.PI * 2) + 0.5) * cols2 + (row % 2) * 0.5;
      const fx = a - Math.floor(a) - 0.5, fy = v * rows - row - 0.35, d = Math.hypot(fx * 1.1, fy), bump = 1 - smooth(0.18, 0.52, d);
      const n = V3(x, y * 1.6, z).normalize(); p.setXYZ(i, x + n.x * 0.028 * bump, y + n.y * 0.028 * bump, z + n.z * 0.028 * bump);
      const c = C(look.c1).lerp(C(look.c2), 0.15 + 0.4 * bump * (1 - v * 0.5)).multiplyScalar(0.72 + 0.35 * bump); cols.push(c.r, c.g, c.b);
    }
    cap.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); cap.computeVertexNormals();
    const parts = [[cap, new THREE.Matrix4()]];
    parts.push([taperTube([V3(0, Hc - 0.02, 0), V3(0.02, Hc + 0.1, 0), V3(0.08, Hc + 0.18, 0.02), V3(0.16, Hc + 0.2, 0.03)], 0.06, 0.04, t => C(look.c1).lerp(C(0x3a2410), t * 0.6), 16, 10), new THREE.Matrix4()]);
    const leaf = oakLeafGeometry(0x3f8f2a, 0x9fd45a), leaf2 = oakLeafGeometry(0x4f9a30, 0xc8e070);
    parts.push(aim(leaf, V3(0.36, Hc * 0.75, 0.32), V3(0.75, 0.35, 0.5), V3(-0.3, 1, 0.2), 0.62, 0.62, 0.62), aim(leaf2, V3(0.42, Hc * 0.6, 0.12), V3(0.9, 0.25, -0.1), V3(0, 1, 0), 0.46, 0.46, 0.46));
    return moveParts(parts, M4(0, Y - 0.1, 0, -0.08, 0, 1, 1, 1).multiply(rotZ(-0.1)));
  },
  // Hilltop Hank: a little oak: a trunk flaring into roots, two branches, and a full, soft, cloud-shaped canopy, with a
  // couple of acorns hanging under it.
  oak(look, R, Y) {
    const parts = [], bark = C(look.c1);
    const tp = []; for (let i = 0; i <= 12; i++) { const t = i / 12; tp.push([0.14 + 0.14 * Math.pow(1 - t, 3), t * 0.62]); }
    parts.push([latheOf(tp, 20, (x, y, z) => bark.clone().multiplyScalar(0.82 + 0.2 * Math.abs(Math.sin(Math.atan2(z, x) * 7 + y * 6)))), M4(0, Y - 0.06, 0, 0, 0, 1, 1, 1)]);
    for (const s of [-1, 1]) parts.push([taperTube([V3(0, Y + 0.3, 0), V3(s * 0.16, Y + 0.46, 0.04), V3(s * 0.3, Y + 0.58, 0.06)], 0.06, 0.03, () => bark, 12, 8), new THREE.Matrix4()]);
    const g0 = new THREE.IcosahedronGeometry(1, 5); g0.deleteAttribute('normal'); g0.deleteAttribute('uv'); const g = mergeVertices(g0), p = g.attributes.position; // (shared corners: smooth, not faceted)
    const lobes = [[0, 1, 0, 0.42], [0.8, 0.5, 0.3, 0.36], [-0.8, 0.45, 0.25, 0.36], [0.3, 0.5, -0.85, 0.34], [-0.35, 0.55, -0.8, 0.34], [0.25, 0.4, 0.9, 0.34], [-0.45, 0.75, 0.45, 0.3], [0.5, 0.8, -0.2, 0.28], [-0.6, -0.05, 0.7, 0.24], [0.65, -0.05, -0.6, 0.24], [0, -0.6, 0, -0.2]].map(([x, y, z, a]) => [V3(x, y, z).normalize(), a]);
    const rad = []; for (let i = 0; i < p.count; i++) { const v = V3(p.getX(i), p.getY(i), p.getZ(i)).normalize(); let r = 1; for (const [d, a] of lobes) r += a * Math.exp(-9 * (1 - v.dot(d))); r += 0.03 * noise3(v.x * 7, v.y * 7, v.z * 7); rad.push(r); p.setXYZ(i, v.x * r, v.y * r, v.z * r); }
    g.computeVertexNormals();
    const rmin = Math.min(...rad), rmax = Math.max(...rad), cols = [];
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), v = V3(x, y, z).normalize(), crease = smooth(rmin, rmin + (rmax - rmin) * 0.6, rad[i]);
      const c = C(look.leaf).lerp(C(look.tip), smooth(-0.3, 0.9, v.y) * 0.6 * crease + 0.1 * noise3(x * 6, y * 6, z * 6)).multiplyScalar((0.62 + 0.38 * crease) * (0.78 + 0.26 * smooth(-0.8, 0.4, v.y))); cols.push(c.r, c.g, c.b); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    parts.push([g, M4(0, Y + 0.86, 0, 0, 0.3, 0.5, 0.42, 0.48)]);
    for (const [x, z] of [[0.34, 0.3], [-0.3, 0.26]]) { parts.push([acornNut(look.c1), M4(x, Y + 0.5, z, 0, x * 5, 1.2, 1.2, 1.2)]); parts.push([cyl(0.01, 0.01, 0.1, 0x5a3a1a, 4), M4(x, Y + 0.58, z, 0, 0, 1, 1, 1)]); }
    return parts;
  },
  // The water family: a wave curling over the top of the head towards you, deep blue at its foot, turquoise up its face
  // and white foam along the crest, with spray. Wooder Kiki has one; Swimmin' Hole Sid two; Tide Kiki and Tidecaller a
  // big set of three (Tidecaller's spray glows).
  wave(look, R, Y) {
    const n = look.c3 || 1, parts = [];
    for (let k = 0; k < n; k++) {
      const side = n > 1 ? (k - (n - 1) / 2) : 0, s = n > 1 ? (k === 0 ? 1 : 0.86) : 1;
      // side-on, so you see the curl from the front: one curling to your right; two back to back, curling apart
      const dir = n > 1 ? (side < 0 ? -1 : 1) : 1;
      parts.push(...moveParts(waveCurl(look.c1, look.c2, 0.26, k * 1.3 + 1, R), M4(n > 1 ? side * 0.42 : -0.1, Y - 0.1, 0, 0, dir * Math.PI / 2, s, s, s)));
    }
    return parts;
  },
  tide(look, R, Y) {
    const parts = [], glowy = !!look.glow;
    // a big curl in the middle (curling to your right) and two smaller ones either side, curling outwards
    [[-0.12, 0.02, Math.PI / 2, 1.25], [-0.55, -0.1, -Math.PI / 2 - 0.3, 0.9], [0.55, -0.12, Math.PI / 2 - 0.3, 0.88]].forEach(([x, z, yaw, s], k) => parts.push(...moveParts(waveCurl(look.c1, look.c2, 0.28, k * 1.7 + 2, R), M4(x, Y - 0.14, z, 0, yaw, s, s, s))));
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + 0.3, r = 0.5 + (i % 3) * 0.12; parts.push([sphere(0.035 + (i % 3) * 0.015, i % 2 ? look.c2 : 0xbff0ff, 12, 8), new THREE.Matrix4().setPosition(Math.cos(a) * r, Y + 0.75 + (i % 4) * 0.12, Math.sin(a) * r * 0.6), glowy ? 'glow' : undefined]); }
    return parts;
  },
  // Pebble Kiki: three smooth river pebbles, balanced.
  pebbles(look, R, Y) {
    return moveParts([[pebbleGeo(0.36, 0.15, 0.32, look.c1, look.c2, 1.1), M4(0, Y + 0.02, 0, 0.04, 0.3, 1, 1, 1)], [pebbleGeo(0.25, 0.12, 0.23, look.c2, look.c1, 2.3), M4(0.03, Y + 0.25, 0.01, -0.06, 1.2, 1, 1, 1)], [pebbleGeo(0.15, 0.09, 0.14, look.c1, look.c2, 3.7), M4(-0.01, Y + 0.42, 0, 0.08, 2, 1, 1, 1)]],
      new THREE.Matrix4().makeTranslation(0, Y, 0).multiply(new THREE.Matrix4().makeScale(1.35, 1.35, 1.35)).multiply(new THREE.Matrix4().makeTranslation(0, -Y - 0.02, 0)));
  },
  // Stone Circle Steve: a tiny stone circle on a grassy mound, a lintel across the tallest pair, a rune glowing in the
  // middle.
  boulder(look, R, Y) {
    const parts = [], mound = new THREE.SphereGeometry(0.66, 48, 18, 0, Math.PI * 2, 0, Math.PI * 0.5); mound.scale(1, 0.42, 1);
    { const p = mound.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, p.getY(i) + 0.025 * noise3(x * 5, 0, z * 5)); } mound.computeVertexNormals(); }
    parts.push([paint(mound, (x, y, z) => C(0x4f8a3a).lerp(C(0x8fc860), smooth(0, 0.28, y) * 0.6 + 0.2 * noise3(x * 7, y * 7, z * 7)).multiplyScalar(0.85 + 0.2 * noise3(x * 15, y * 15, z * 15))), M4(0, Y - 0.12, 0, 0, 0, 1, 1, 1)]);
    const stoneGeo = () => paint(standingStoneGeometry().clone(), (x, y, z) => C(look.c1).lerp(C(0xc2bcb0), 0.4 + 0.4 * noise3(x * 4, y * 4, z * 4)).multiplyScalar(0.8 + 0.25 * smooth(-1, 1, y)));
    // seven standing stones round the top of the mound, the two at the back the tallest, with a lintel across them
    const N = 7, ring = 0.42, top = r => Y - 0.12 + 0.28 * Math.sqrt(Math.max(0, 1 - (r / 0.66) ** 2)), tall = [3, 4];
    const ang = i => i / N * Math.PI * 2 + Math.PI / 2 + Math.PI / N, hOf = i => tall.includes(i) ? 0.5 : 0.34 + 0.05 * ((i * 37) % 3);
    for (let i = 0; i < N; i++) { const a = ang(i), h = hOf(i); parts.push([stoneGeo(), M4(Math.cos(a) * ring, top(ring) + h * 0.38, Math.sin(a) * ring, 0, -a + Math.PI / 2, h * 0.34, h / 2, h * 0.34)]); }
    { const a0 = ang(tall[0]), a1 = ang(tall[1]), mx = (Math.cos(a0) + Math.cos(a1)) / 2 * ring, mz = (Math.sin(a0) + Math.sin(a1)) / 2 * ring;
      parts.push([paint(new THREE.BoxGeometry(0.5, 0.09, 0.13, 6, 2, 2), (x, y, z) => C(look.c1).lerp(C(0xc2bcb0), 0.45 + 0.4 * noise3(x * 5, y * 5, z * 5))), M4(mx, top(ring) + 0.5 * 0.88 + 0.03, mz, 0, Math.atan2(Math.cos(a1) - Math.cos(a0), Math.sin(a1) - Math.sin(a0)) + Math.PI / 2, 1, 1, 1)]); }
    // a rune glowing in the middle
    parts.push([paint(new THREE.TorusGeometry(0.12, 0.024, 8, 40, Math.PI * 1.7), () => C(0xb48cff)), M4(0, top(0) + 0.015, 0, -Math.PI / 2, 0, 1, 1, 1), 'glow'], [sphere(0.04, 0xe8dcff, 12, 8), new THREE.Matrix4().setPosition(0, top(0) + 0.03, 0), 'glow']);
    return parts;
  },
  mushroom(look, R, Y) {
    const big = (look.c3 || 1) > 1, glowy = !!look.glow;
    const kit = { cap: look.c1, spot: look.c2, stem: glowy ? 0xf0ecff : 0xfbf4e6, gill: glowy ? 0xd6ccff : 0xf1e2c6, rimGlow: glowy ? look.c2 : null, glowSpots: glowy };
    const parts = moveParts(toadstool({ ...kit, capR: big ? 0.78 : 0.7, capH: big ? 0.56 : 0.5, stemH: big ? 0.5 : 0.44, stemR: big ? 0.25 : 0.23, spots: big ? 11 : 9, seed: 1 }), M4(0, Y - 0.02, 0, -0.06, 0, 1, 1, 1).multiply(rotZ(-0.08)));
    // little ones on top of its head, beside the big one's stem and under its cap
    (big ? [[-0.3, 0.2, 0.42], [0.31, 0.14, 0.36]] : [[-0.3, 0.2, 0.38]]).forEach(([x, z, s], i) =>
      parts.push(...moveParts(toadstool({ ...kit, capR: 0.6, capH: 0.48, stemH: 0.5, stemR: 0.18, spots: 5, seed: 3 + i, segs: 40 }), M4(x, Y - 0.06, z, 0.15, 0, s, s, s).multiply(rotZ(-Math.sign(x) * 0.38)))));
    return parts;
  },
  // Fairy Cairn Fern: a little cairn of smooth river stones (moss on the lower ones), a fern unfurling behind it, an
  // open frond arching out to one side, and a tiny fairy (a glowing light with wings) keeping it company.
  cairn(look, R, Y) {
    const parts = [], moss = 0x4f8a3a;
    [[0.5, 0.2, 0.44, 0, Y + 0.02, -0.02, 0.4, 0.04, 0x8d8a85, 0xa9a49d, moss], [0.37, 0.16, 0.33, 0.04, Y + 0.33, 0, 1.3, -0.06, 0x7d8794, 0x9ba4af, moss],
      [0.27, 0.13, 0.24, -0.02, Y + 0.58, 0.01, 2.1, 0.08, 0x9d968c, 0xb8b1a6, null], [0.16, 0.09, 0.15, 0.02, Y + 0.77, 0, 0.7, -0.1, 0x76808e, 0x939ca7, null]]
      .forEach(([sx, sy, sz, x, y, z, yaw, tilt, a, b, m], i) => parts.push([pebbleGeo(sx, sy, sz, a, b, i * 1.7 + 0.3, m), M4(x, y, z, tilt, yaw, 1, 1, 1)]));
    const green = 0x3f8a33, light = 0x9fdc6e, leaflet = s => leafGeometry(0.55, 0.75, green, light, true, 0.55);
    // the fiddlehead: a stem rising behind the cairn and curling over at the top
    const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(V3(0.28 + 0.1 * t, Y - 0.02 + 1.04 * t, -0.38 + 0.05 * t)); }
    const cx = 0.23, cy = Y + 1.02; for (let i = 1; i <= 26; i++) { const th = i / 26 * Math.PI * 2.15, rr = 0.15 * (1 - 0.74 * i / 26); pts.push(V3(cx + rr * Math.cos(th), cy + rr * Math.sin(th), -0.33)); }
    parts.push([taperTube(pts, 0.042, 0.014, t => C(green).lerp(C(light), smooth(0.25, 1, t)), 80, 8), new THREE.Matrix4()]);
    // open fronds arching out to each side, their leaflets facing you (the left one longer)
    for (const [sg, len] of [[-1, 1], [1, 0.78]]) {
      const P = (x, y, z) => V3(sg * x * len, Y + y * len, z);
      const spine = new THREE.CatmullRomCurve3([P(0.3, 0.02, -0.2), P(0.5, 0.45, -0.12), P(0.7, 0.64, -0.02), P(0.88, 0.56, 0.06), P(1.0, 0.36, 0.1)]);
      parts.push([taperTube(spine.getPoints(24), 0.032, 0.01, t => C(green).lerp(C(light), t * 0.6), 40, 6), new THREE.Matrix4()]);
      for (let i = 0; i < 8; i++) { const t = 0.12 + i * 0.105, p = spine.getPointAt(t), T = spine.getTangentAt(t), side = T.clone().cross(V3(0, 0, 1)).normalize(), s = 0.36 * len * (1 - 0.62 * t);
        for (const k of [-1, 1]) parts.push(aim(leaflet(), p, side.clone().multiplyScalar(k).addScaledVector(T, 0.7), V3(0, 0, 1), s, s, s)); }
    }
    // the fairy: a glowing light with two little wings, and a trail of sparkles
    const f = V3(-0.42, Y + 1.02, 0.3);
    parts.push([sphere(0.075, 0xfffaff, 20, 14), new THREE.Matrix4().setPosition(f), 'glow'], [sphere(0.045, 0xffffff, 14, 10), new THREE.Matrix4().setPosition(f.clone().add(V3(0, 0, 0.04))), 'glow']);
    for (const sg of [-1, 1]) parts.push(aim(leafGeometry(0.75, 0.8, 0xd9c6ff, 0xf6f0ff, true), f.clone().add(V3(sg * 0.04, 0.03, -0.03)), V3(sg, 0.75, -0.25), V3(0, 0, 1), 0.17, 0.17, 0.17));
    [[0.14, 0.06, 0.04, 0.045], [-0.1, 0.16, 0.02, 0.035], [0.05, -0.16, 0.05, 0.03], [0.26, -0.18, -0.04, 0.026], [0.4, -0.32, -0.1, 0.022]].forEach(([dx, dy, dz, r], i) =>
      parts.push([puffyStar(r, i % 2 ? 0xffd2f2 : 0xfff2a8, 0xffffff), M4(f.x + dx, f.y + dy, f.z + dz, 0, i * 0.7, 1, 1, 1), 'glow']));
    // the whole cairn a good size on the head
    return moveParts(parts, new THREE.Matrix4().makeTranslation(0, Y, 0).multiply(new THREE.Matrix4().makeScale(1.4, 1.4, 1.4)).multiply(new THREE.Matrix4().makeTranslation(0, -Y - 0.04, 0)));
  },
  // Hex Kiki: a floppy witch's hat, crinkled, its tip flopping over, with a band and a gold crescent charm.
  witch(look, R, Y) {
    const H = 1.05, R0 = 0.46, gold = 0xffcf3a, dark = C(look.c1), parts = [];
    parts.push([hatBrim(0.4, 0.86, 0.09, 0.045, look.c1), new THREE.Matrix4()]);
    parts.push([hatCone(R0, H, 0.46, 0.24, (x, y) => dark.clone().lerp(dark.clone().lerp(C(0xffffff), 0.16), smooth(0, H, y))), new THREE.Matrix4()]);
    parts.push([solid(new THREE.TorusGeometry(0.432, 0.058, 12, 64), look.c2), M4(0, 0.11, 0, Math.PI / 2, 0, 1, 1, 1)]);
    parts.push([crescentGeo(0.1, 0.04, gold), M4(0, 0.12, 0.47, 0, 0, 1, 1, 1)]);
    parts.push([puffyStar(0.075, gold, 0xfff6c8), M4(0.48, H - 0.31, 0.02, 0, 0, 1, 1, 1), 'glow']);
    return moveParts(parts, M4(0.02, Y - 0.13, 0, -0.06, 0.3, 1, 1, 1).multiply(rotZ(0.1)));
  },
  // Lucid Wizard: a tall midnight wizard's hat with a gentle bend, gold stars and a crescent on it, and a ring of tiny
  // stars circling it.
  wizard(look, R, Y) {
    const H = 1.5, R0 = 0.45, gold = 0xffd75a, parts = [];
    parts.push([hatBrim(0.4, 0.78, 0.06, 0.02, look.c1, 56), new THREE.Matrix4()]);
    parts.push([hatCone(R0, H, 0.22, 0.12, (x, y) => C(look.c1).lerp(C(look.c2), smooth(0.1, H, y))), new THREE.Matrix4()]);
    // gold band
    parts.push([solid(new THREE.TorusGeometry(0.425, 0.05, 12, 64), gold), M4(0, 0.1, 0, Math.PI / 2, 0, 1, 1, 1)]);
    // stars and a crescent dotted over the cone, facing out
    const onCone = (t, th) => { const r = R0 * Math.pow(1 - t, 0.92), k = Math.pow(Math.max(0, t - 0.3) / 0.7, 2.2); return { p: V3(r * Math.sin(th) + k * 0.22, t * H - k * 0.12, r * Math.cos(th)), n: V3(Math.sin(th), R0 / H, Math.cos(th)).normalize() }; };
    [[0.2, 0.5, 0.07], [0.28, -0.9, 0.06], [0.42, 1.6, 0.055], [0.5, -0.2, 0.05], [0.62, 0.9, 0.045], [0.18, 2.6, 0.065], [0.36, -2.2, 0.055], [0.7, -1.2, 0.04]].forEach(([t, th, r]) => {
      const { p, n } = onCone(t, th); parts.push(aim(puffyStar(r, gold, 0xfff6c8), p.addScaledVector(n, 0.01), n, V3(0, 1, 0), 1, 1, 1, 'glow'));
    });
    { const { p, n } = onCone(0.3, 0.05); parts.push(aim(crescentGeo(0.1, 0.036, gold), p.addScaledVector(n, 0.02), n, V3(0, 1, 0), 1, 1, 1, 'glow')); }
    // a tilted ring of little stars orbiting the hat
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, p = V3(Math.cos(a) * 0.74, 0.42 + Math.sin(a) * 0.74 * Math.sin(0.32), Math.sin(a) * 0.74 * Math.cos(0.32)); parts.push([puffyStar(0.04 + (i % 3) * 0.01, gold, 0xffffff), M4(p.x, p.y, p.z, 0, -a, 1, 1, 1), 'glow']); }
    return moveParts(parts, M4(0, Y - 0.13, 0, -0.05, -0.2, 1, 1, 1).multiply(rotZ(-0.06)));
  },
  // Comet Kiki: a plump gold star with three tails streaming back over its head, gold to pink to lilac.
  comet(look, R, Y) {
    const sc = V3(0.02, Y + 0.34, 0.08), parts = [[puffyStar(0.44, look.c1, look.c2, 0.85), M4(sc.x, sc.y, sc.z, -0.15, 0.2, 1, 1, 1).multiply(rotZ(-0.22))]];
    [[-0.16, 0.0, 1], [0.0, 0.12, 1.15], [0.16, -0.06, 0.92]].forEach(([dx, dy, len]) => {
      const sweep = (k, up) => sc.clone().add(V3(-0.75 * k * len + dx * k, up + dy * k, -0.62 * k * len)); // back and off to the left
      const pts = [sc.clone().add(V3(0, 0, -0.02)), sweep(0.3, 0.1), sweep(0.62, 0.08), sweep(0.9, -0.06), sweep(1.12, -0.26)];
      parts.push([taperTube(pts, 0.12, 0.014, t => C(look.c1).lerp(C(0xff9fd6), smooth(0.05, 0.55, t)).lerp(C(0xa98bff), smooth(0.5, 1, t)), 44, 12), new THREE.Matrix4()]);
    });
    [[-0.5, 0.62, -0.25, 0.04], [-0.78, 0.36, -0.5, 0.035], [-0.3, 0.78, -0.45, 0.03], [-1.0, 0.18, -0.62, 0.03], [-0.62, 0.15, -0.2, 0.025]].forEach(([x, y, z, r], i) => parts.push([puffyStar(r, i % 2 ? 0xffd2f2 : 0xfff2a8, 0xffffff), M4(x, Y + y, z, 0, i, 1, 1, 1), 'glow']));
    return parts;
  },
  // Clown Town Coco: a celestial jester's hat: midnight and violet halves, two floppy points with gold star bells, a
  // gold band with Comet Kiki's star at the front.
  jester(look, R, Y) {
    const A = look.c1, B = look.c2, gold = 0xffcf3a, by = Y - 0.2, parts = [];
    const cap = new THREE.SphereGeometry(0.6, 48, 20, 0, Math.PI * 2, 0, Math.PI * 0.5); cap.scale(1, 0.64, 1);
    parts.push([paint(cap, (x, y) => C(x < 0 ? A : B).multiplyScalar(0.85 + 0.25 * smooth(0, 0.38, y))), M4(0, by, 0, 0, 0, 1, 1, 1)]);
    parts.push([solid(new THREE.TorusGeometry(0.6, 0.075, 12, 64), gold), M4(0, by + 0.01, 0, Math.PI / 2, 0, 1, 1, 1)]);
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; parts.push([solid(new THREE.ConeGeometry(0.06, 0.16, 8), gold), M4(Math.sin(a) * 0.62, by - 0.1, Math.cos(a) * 0.62, Math.PI, 0, 1, 1, 1)]); }
    parts.push([puffyStar(0.13, look.c3 || 0xffc21a, 0xfff09a, 0.45), M4(0, by + 0.06, 0.66, 0, 0, 1, 1, 1)]);
    for (const s of [-1, 1]) {
      const pts = [V3(s * 0.16, by + 0.22, 0), V3(s * 0.42, by + 0.62, -0.02), V3(s * 0.72, by + 0.84, 0), V3(s * 0.98, by + 0.74, 0.05), V3(s * 1.08, by + 0.5, 0.1)];
      parts.push([taperTube(pts, 0.22, 0.035, t => C(s < 0 ? B : A).multiplyScalar(0.88 + 0.2 * t), 48, 16), new THREE.Matrix4()]);
      const curve = new THREE.CatmullRomCurve3(pts);
      for (const t of [0.42, 0.7]) { const p = curve.getPointAt(t), n = V3(0, 0, 1); parts.push(aim(puffyStar(0.045, gold, 0xfff6c8), p.add(V3(0, 0.02, 0.2 * (1 - t) + 0.03)), n, V3(0, 1, 0), 1, 1, 1, 'glow')); }
      const tip = pts[4].clone().add(V3(s * 0.01, -0.1, 0.02));
      parts.push([paint(new THREE.SphereGeometry(0.1, 20, 14), (x, y) => C(gold).multiplyScalar(0.85 + 0.25 * smooth(-0.1, 0.1, y))), new THREE.Matrix4().setPosition(tip)]);
      parts.push([solid(new THREE.TorusGeometry(0.1, 0.012, 6, 24), 0x8a5a10), M4(tip.x, tip.y - 0.01, tip.z, Math.PI / 2, 0, 1, 1, 1)]);
      parts.push([puffyStar(0.05, 0xffffff, 0xfff6c8), M4(tip.x, tip.y - 0.02, tip.z + 0.1, 0, 0, 1, 1, 1), 'glow']);
    }
    return parts;
  },
  seedling(look, R, Y) {
    const parts = [[stem(Y, Y + 0.28, look.leaf), new THREE.Matrix4()]];
    for (let i = 0; i < 3; i++) { const s = 0.7 * R(0.95, 1.05); parts.push([leafGeometry(0.6, 0.7, look.leaf, look.tip, true), M4(0, Y + 0.27, 0, -(0.88 + R(-0.06, 0.06)), i / 3 * Math.PI * 2 + 0.3 + R(-0.08, 0.08), s, s, s)]); }
    return parts;
  },
  bloom(look, R, Y) {
    const top = Y + 0.56, parts = [[stem(Y, top, look.leaf), new THREE.Matrix4()]];
    for (let i = 0; i < 2; i++) parts.push([leafGeometry(0.6, 0.7, look.leaf, look.tip, true), M4(0, Y + 0.2 + i * 0.1, 0, -0.62, i * Math.PI + 0.5, 0.62, 0.62, 0.62)]);
    for (let i = 0; i < 7; i++) parts.push([leafGeometry(0.7, 0.9, look.c1, look.c2, true), M4(0, top, 0, -0.62 + R(-0.05, 0.05), i / 7 * Math.PI * 2 + R(-0.05, 0.05), 0.68, 0.68, 0.68)]);
    const ctr = new THREE.SphereGeometry(0.2, 16, 12); ctr.scale(1, 0.62, 1);
    parts.push(at(paint(ctr, (x, y) => C(0xffc928).lerp(C(0xff8a00), Math.max(0, 0.5 - y * 4))), 0, top + 0.1, 0));
    return parts;
  },
  orchard(look, R, Y) {
    const parts = fanParts(look, R, FANS.grand, Y);
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + 0.5; parts.push(at(paint(new THREE.SphereGeometry(0.15, 16, 12), (x, y) => C(look.c1).lerp(C(0xffffff), y > 0.08 && x < 0 ? 0.25 : 0)), Math.cos(a) * 0.42, Y + 0.42, Math.sin(a) * 0.42)); parts.push(at(cyl(0.015, 0.015, 0.1, 0x5a3a1a, 5), Math.cos(a) * 0.42, Y + 0.6, Math.sin(a) * 0.42)); }
    return parts;
  },


  evergreen(look, R, Y) {
    const parts = [at(cyl(0.1, 0.14, 0.3, 0x6b4426, 10), 0, Y + 0.1, 0)];
    [[0.62, 0.55, 0.32], [0.5, 0.5, 0.62], [0.38, 0.45, 0.9], [0.24, 0.4, 1.16]].forEach(([r, h, y]) => parts.push(at(vgrad(new THREE.ConeGeometry(r, h, 12), look.tip, look.leaf, -h / 2, -h / 2 + 0.12), 0, Y + y, 0)));
    parts.push(at(starGeo(0.1, 0xffe14a), 0, Y + 1.36, 0));
    return parts;
  },




  snow(look, R, Y) {
    const parts = [], cy = Y + 0.5, ice = C(look.c1).lerp(C(look.c2), 0.25).getHex();
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2, arm = new THREE.Group();
      const rot = (x, y) => [Math.cos(a) * x - Math.sin(a) * y, Math.sin(a) * x + Math.cos(a) * y];
      const [x, y] = rot(0, 0.24); parts.push([solid(new THREE.BoxGeometry(0.07, 0.48, 0.06), ice), M4(x, cy + y, 0, 0, 0, 1, 1, 1).multiply(new THREE.Matrix4().makeRotationZ(a))]);
      for (const s of [-1, 1]) { const [bx, by] = rot(s * 0.08, 0.34); parts.push([solid(new THREE.BoxGeometry(0.05, 0.17, 0.05), look.c1), M4(bx, cy + by, 0, 0, 0, 1, 1, 1).multiply(new THREE.Matrix4().makeRotationZ(a - s * 0.8))]); }
    }
    parts.push(at(sphere(0.09, look.c1), 0, cy, 0)); parts.push(at(cyl(0.05, 0.08, 0.25, ice, 8), 0, Y + 0.08, 0));
    return parts;
  },
  icicle(look, R, Y) {
    const cap = new THREE.SphereGeometry(0.6, 28, 12, 0, Math.PI * 2, 0, Math.PI * 0.42); cap.scale(1, 0.55, 1);
    const parts = [at(solid(cap, look.c1), 0, Y - 0.08, 0)];
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, h = i % 2 ? 0.34 : 0.55; parts.push([vgrad(new THREE.ConeGeometry(0.075, h, 6), look.c2, look.c1, -h / 2, h / 2), M4(Math.cos(a) * 0.38, Y + 0.12 + h / 2, Math.sin(a) * 0.38, 0, 0, 1, 1, 1).multiply(new THREE.Matrix4().makeRotationAxis(V3(Math.sin(a), 0, -Math.cos(a)), -0.35))]); }
    parts.push(at(vgrad(new THREE.ConeGeometry(0.1, 0.75, 6), look.c2, look.c1, -0.37, 0.37), 0, Y + 0.48, 0));
    return parts;
  },
  flame(look, R, Y) {
    const n = look.c3 || 3, parts = [];
    for (let i = 0; i < n; i++) {
      const centre = i === 0, a = centre ? 0 : (i - 1) / (n - 1) * Math.PI * 2, h = centre ? 1.0 : R(0.55, 0.7), d = centre ? 0 : 0.3;
      const g = flameGeo(h, 0.26, look.c1, look.c2, R(-0.15, 0.15)), inner = flameGeo(h * 0.6, 0.12, look.c2, 0xfff6c8, 0);
      const m = M4(Math.cos(a) * d, Y - 0.06, Math.sin(a) * d, 0, 0, 1, 1, 1).multiply(new THREE.Matrix4().makeRotationAxis(V3(Math.sin(a), 0, -Math.cos(a)), centre ? 0 : -0.3));
      parts.push([g, m], [inner, m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.02, 0.08))]);
    }
    return parts;
  },
  bonfire(look, R, Y) {
    const parts = CROWNS.flame({ ...look, c3: 7 }, R, (Y + 0.1) / 1.2).map(([g, m]) => [g, m.premultiply(new THREE.Matrix4().makeScale(1.2, 1.2, 1.2))]);
    for (let i = 0; i < 3; i++) parts.push([paint(new THREE.CylinderGeometry(0.07, 0.07, 0.9, 8), (x, y) => C(look.c3).multiplyScalar(Math.abs(y) > 0.4 ? 1.4 : 1)), M4(0, Y + 0.08, 0, 0, i / 3 * Math.PI, 1, 1, 1).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2))]);
    return parts;
  },

  campfire(look, R, Y) {
    const parts = CROWNS.flame({ ...look, c3: 3 }, R, Y + 0.1);
    for (let i = 0; i < 2; i++) parts.push([paint(new THREE.CylinderGeometry(0.08, 0.08, 0.8, 8), (x, y) => C(look.c3).multiplyScalar(Math.abs(y) > 0.36 ? 1.45 : 1)), M4(0, Y + 0.06, 0, 0, Math.PI / 4 + i * Math.PI / 2, 1, 1, 1).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2))]);
    return parts;
  },

  bolt(look, R, Y) {
    const n = look.c3 || 1, parts = [];
    for (let i = 0; i < n; i++) { const side = n === 1 ? 0 : (i - (n - 1) / 2), h = side === 0 ? 1.0 : 0.7; parts.push([boltGeo(h, look.c1, look.c2), M4(side * 0.32, Y - 0.05, side * -0.05, 0, side * 0.5, 1, 1, 1).multiply(new THREE.Matrix4().makeRotationZ(-side * 0.45))]); }
    return parts;
  },
  cloud(look, R, Y) {
    const parts = [];
    for (const [x, y, z, r] of [[0, 0.5, 0, 0.36], [0.34, 0.4, 0.05, 0.27], [-0.34, 0.42, 0, 0.28], [0.15, 0.38, 0.28, 0.24], [-0.12, 0.36, -0.26, 0.25], [0.12, 0.66, -0.08, 0.24]]) parts.push(at(vgrad(new THREE.SphereGeometry(r, 16, 12), look.c1, 0xffffff, -r, r), x, Y + y, z));
    for (const s of [-1, 1]) parts.push([boltGeo(0.42, look.c2, 0xffffff), M4(s * 0.32, Y + 0.6, 0.2, 0, 0, 1, 1, 1).multiply(new THREE.Matrix4().makeRotationZ(s * -0.5 + Math.PI))]);
    return parts;
  },
  antenna(look, R, Y) {
    const parts = [];
    for (const s of [-1, 1]) {
      const tip = V3(s * 0.42, Y + 0.72, 0.1), g = taperTube([V3(s * 0.12, Y - 0.05, 0), V3(s * 0.2, Y + 0.35, 0.05), V3(s * 0.34, Y + 0.6, 0.08), tip], 0.045, 0.03, () => C(look.c1), 20, 8);
      parts.push([g, new THREE.Matrix4()], at(paint(new THREE.SphereGeometry(0.1, 14, 10), (x, y) => C(look.c2).lerp(C(0xffffff), smooth(0, 0.1, y) * 0.5)), tip.x, tip.y + 0.04, tip.z));
    }
    return parts;
  },
  lantern(look, R, Y) {
    const parts = CROWNS.antenna({ ...look, c2: 0xfff27a }, R, Y), hx = 0.42, hy = Y + 0.46, hz = 0.12;
    parts.push(at(cyl(0.012, 0.012, 0.22, 0x3a2a1a, 4), hx, hy + 0.14, hz));
    parts.push(at(paint(new THREE.SphereGeometry(0.2, 16, 12), (x, y) => C(look.c2).lerp(C(0xfff27a), smooth(-0.1, 0.15, -Math.abs(y) + 0.1))), hx, hy - 0.05, hz, 0, 0, 1, 1.15, 1));
    parts.push(at(cyl(0.08, 0.1, 0.05, 0x3a2a1a, 10), hx, hy + 0.13, hz), at(cyl(0.1, 0.07, 0.05, 0x3a2a1a, 10), hx, hy - 0.23, hz));
    return parts;
  },



  crystal(look, R, Y) {
    const parts = [];
    const prism = (r, h) => { const g = new THREE.CylinderGeometry(r * 0.85, r, h, 6, 1); const tip = new THREE.ConeGeometry(r * 0.85, r * 1.6, 6); tip.translate(0, h / 2 + r * 0.8, 0); return [g, tip]; };
    [[0, 0, 0.7, 0.13], [0.6, 0.2, 0.45, 0.1], [-0.6, 0.9, 0.5, 0.1], [0.5, 2.6, 0.42, 0.09], [-0.5, 3.8, 0.4, 0.09], [0.7, 5.1, 0.32, 0.08]].forEach(([tilt, yaw, h, r]) => {
      for (const g of prism(r, h)) { vgrad(g, look.c1, look.c2, -h / 2, h / 2 + r); parts.push([g.toNonIndexed(), M4(Math.sin(yaw) * Math.abs(tilt) * 0.3, Y + h / 2, Math.cos(yaw) * Math.abs(tilt) * 0.3, 0, yaw, 1, 1, 1).multiply(new THREE.Matrix4().makeRotationX(tilt * 0.6))]); }
    });
    for (const [g] of parts) g.computeVertexNormals();
    return parts;
  },
  shell(look, R, Y) {
    const g = new THREE.CircleGeometry(0.5, 40, 0, Math.PI), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), r = Math.hypot(x, y), a = Math.atan2(y, x); p.setZ(i, 0.07 * Math.abs(Math.sin(a * 9)) * (r / 0.5) + 0.22 * (r / 0.5) ** 2); }
    g.computeVertexNormals(); paint(g, (x, y, z) => C(look.c1).lerp(C(look.c2), smooth(0.02, 0.07, z - 0.22 * (Math.hypot(x, y) / 0.5) ** 2)).lerp(C(0xffffff), smooth(0.4, 0.5, Math.hypot(x, y)) * 0.3));
    const hinge = sphere(0.08, look.c2, 10, 8);
    return [[g, M4(0, Y + 0.12, 0.18, -0.45, 0, 1, 1, 1)], at(hinge, 0, Y + 0.12, 0.18, 0, 0, 1.4, 0.7, 0.8)];
  },
  castle(look, R, Y) {
    const sand = (geo) => paint(geo, (x, y, z) => C(look.c1).multiplyScalar(0.92 + 0.12 * noise3(x * 8, y * 8, z * 8)));
    const parts = [at(sand(new THREE.CylinderGeometry(0.24, 0.3, 0.55, 14)), 0, Y + 0.25, 0)];
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; parts.push(at(sand(new THREE.BoxGeometry(0.1, 0.1, 0.1)), Math.cos(a) * 0.21, Y + 0.57, Math.sin(a) * 0.21, 0, -a)); }
    for (const s of [-1, 1]) { parts.push(at(sand(new THREE.CylinderGeometry(0.13, 0.17, 0.36, 12)), s * 0.38, Y + 0.12, 0.05)); parts.push(at(sand(new THREE.ConeGeometry(0.15, 0.2, 12)), s * 0.38, Y + 0.4, 0.05)); }
    parts.push(at(cyl(0.012, 0.012, 0.36, 0x6b4426, 5), 0, Y + 0.78, 0));
    parts.push(at(extrude([[0, 0], [0.22, 0.07], [0, 0.14]], 0.02, look.c2, look.c2, 0.14), 0.01, Y + 0.8, 0));
    return parts;
  },





};
const CROWN_SCALE = { acorn: 1, pebbles: 1, boulder: 1, wave: 1, toast: 1, icicle: 1.25, lotus: 1, lily: 1, evergreen: 1.2, oak: 1, tide: 1, sun: 1, mushroom: 1, cairn: 1, witch: 1, wizard: 1, comet: 1, jester: 1, castle: 1.35, mountain: 1, crescent: 1, starry: 1, aurora: 1 };
/** A Kiki's crown: { main } lit like the rest of it, and { glow }: parts tagged 'glow' (a third entry in the part),
 *  drawn unlit so they shine (fairy lights, glowing spots, star bells, aurora ribbons). */
function crownGeometry(id, look, key = id) {
  return cached('crown:' + key, () => {
    const r = rng(hash(id)), R = (a, b) => a + r.next() * (b - a), baseY = EGG_H * 0.88;
    const fan = FANS[look.crown];
    let parts = fan ? fanParts(look, R, fan, baseY) : (CROWNS[look.crown] || CROWNS.seedling)(look, R, baseY);
    const k = fan || look.crown === 'seedling' || look.crown === 'bloom' ? 1 : (CROWN_SCALE[look.crown] || 1.35);
    if (k !== 1) { const m = new THREE.Matrix4().makeTranslation(0, baseY, 0).multiply(new THREE.Matrix4().makeScale(k, k, k)).multiply(new THREE.Matrix4().makeTranslation(0, -baseY, 0)); parts = parts.map(([g, mm, tag]) => [g, m.clone().multiply(mm), tag]); }
    const lit = parts.filter(p => p[2] !== 'glow'), glow = parts.filter(p => p[2] === 'glow');
    const out = { main: merge(lit), glow: glow.length ? merge(glow) : null };
    out.main.userData.shared = true; if (out.glow) out.glow.userData.shared = true;
    return out;
  });
}
let _glowMat = null;
const glowMaterial = () => _glowMat || (_glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));

// ---------- materials ----------
/** Soft, matte skin with a gentle rim light (roughness ~0.4, metalness 0, never shiny). Used for Kikis and props. */
export function plush(params, rim = 0.4) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.38, metalness: 0, ...params }); // a soft satin skin
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
function matsFor(key, look) {
  if (kikiMats.has(key)) return kikiMats.get(key);
  const { map, normal } = faceTextures(look);
  const m = {
    body: plush({ map, normalMap: normal, normalScale: new THREE.Vector2(0.9, 0.9), vertexColors: true }),
    limb: plush({ color: look.body }),
    leaf: plush({ color: 0xffffff, vertexColors: true, roughness: 0.28, side: THREE.DoubleSide }, 0.3),
  };
  kikiMats.set(key, m);
  return m;
}
/**
 * A Kiki standing with feet at y=0, facing +z. Hierarchy for animation: root → motion → flip (pivot at the body's
 * centre) → squash (pivot at the feet) → parts. `height` is the real body height in metres (no leaves). Sparkle Kikis
 * get their alternate colours and a few twinkling stars.
 */
export function makeKiki(id, height = 0.42, sparkle = false) {
  const look = lookFor(id, sparkle), key = id + (sparkle ? ':s' : ''), m = matsFor(key, look);
  const root = new THREE.Group(); root.scale.setScalar(height / BODY_H * look.scale);
  const motion = new THREE.Group(); root.add(motion);
  const flip = new THREE.Group(); flip.position.y = GROUND; motion.add(flip);
  const squash = new THREE.Group(); squash.position.y = -GROUND; flip.add(squash);
  const model = new THREE.Group(); model.position.y = GROUND; squash.add(model);
  model.add(new THREE.Mesh(eggGeometry(), m.body));
  model.add(new THREE.Mesh(feetGeometry(), m.limb));
  const arms = [];
  for (const [x, y, rz] of [[-0.86, 0.0, 0.62], [0.86, -0.05, -2.15]]) { // shoulders set a little into the body
    const pivot = new THREE.Object3D(); pivot.position.set(x, y, 0.05); pivot.rotation.z = rz; pivot.userData.rest = rz;
    pivot.add(new THREE.Mesh(armGeometry(), m.limb)); model.add(pivot); arms.push(pivot);
  }
  { const cg = crownGeometry(id, look, key); model.add(new THREE.Mesh(cg.main, m.leaf)); if (cg.glow) model.add(new THREE.Mesh(cg.glow, glowMaterial())); }
  if (look.glow) { const s = glowShell(eggGeometry(), 1.4, 2.2, look.glow === true ? 0x7a00ff : look.glow); s.scale.set(1.22, 1.14, 1.22); s.position.y = -0.05; model.add(s); root.userData.glow = s; }
  let twinkle = null;
  if (sparkle) {
    twinkle = new THREE.Group(); model.add(twinkle);
    for (let i = 0; i < 7; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTexture(), color: i % 2 ? 0xffe680 : 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); const a = i / 7 * Math.PI * 2; sp.position.set(Math.cos(a) * 1.35, 0.2 + (i % 3) * 0.55, Math.sin(a) * 1.35); sp.scale.setScalar(0.35); sp.userData.ph = i * 0.9; twinkle.add(sp); }
  }
  // soft blob shadow on the ground
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 2.1), new THREE.MeshBasicMaterial({ map: blobTexture(), color: 0x0d0a26, transparent: true, opacity: 0.42, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; root.add(shadow);
  root.userData = { ...root.userData, id, motion, flip, squash, arms, shadow, look, twinkle, sparkle };
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
    if (this.k.twinkle) { this.k.twinkle.rotation.y += dt * 0.6; for (const sp of this.k.twinkle.children) { const k = 0.5 + 0.5 * Math.sin(this.t * 3 + sp.userData.ph); sp.material.opacity = k; sp.scale.setScalar(0.2 + 0.25 * k); } }
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
/** The capture portal: a dark void with a swirling UV-purple vortex (screen blend). Billboard it toward the camera. */
export function makePortal(size = 1) {
  // A swirling vortex (owner: "a high end swirling portal … no hard black edge"): spiral arms winding inwards and
  // turning, fine pink streaks, a cyan sheen, a deep violet eye with a bright pinpoint, and edges that fade to nothing.
  const g = new THREE.Group(), disc = new THREE.Group(); g.add(disc);
  const u = { t: { value: 0 }, pull: { value: 1 }, speed: { value: 1.6 }, k: { value: 1 } };
  const vx = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, premultipliedAlpha: true, uniforms: u,
    vertexShader: 'varying vec2 uv2; void main(){ uv2 = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `uniform float t, pull, speed, k; varying vec2 uv2;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
      void main(){
        vec2 c = uv2*2.-1.; float r = length(c); if (r > 1.) discard;
        float ang = atan(c.y, c.x), sw = ang + log(r + .035) * (2.4 + pull * .9) - t * speed;
        float arms = pow(.5 + .5 * sin(sw * 3.), 2.2);
        float grain = n(vec2(sw * 2.4, r * 6. - t * speed * .7)), streak = pow(.5 + .5 * sin(sw * 9. + grain * 3.2), 6.);
        float fade = smoothstep(1., .5, r), halo = smoothstep(1., .3, r) * .5, eye = smoothstep(.0, .45, r), core = pow(max(0., 1. - r * 2.6), 3.);
        vec3 deep = vec3(.05, .01, .16), purple = vec3(.5, .07, 1.), pink = vec3(1., .38, .88), cyan = vec3(.4, .86, 1.);
        vec3 col = mix(deep, purple, eye * (.3 + arms * .7));
        col = mix(col, pink, streak * .55 * eye);
        col += cyan * pow(arms, 4.) * .35 * fade + vec3(1., .85, 1.) * core * 1.4;
        float a = clamp((fade * (.5 + .5 * arms) + halo * .45) * mix(1., .9, eye) + core, 0., 1.);
        gl_FragColor = vec4(col * k * a, a);
      }` }));
  vx.renderOrder = 2; disc.add(vx);
  disc.scale.setScalar(0.0001);
  g.userData = { disc, u, open: 0, target: 0, size, boost: 0 };
  g.userData.update = (dt, time, camera) => {
    const d = g.userData; d.u.t.value = time;
    const rate = d.target > d.open ? 3.2 : 4.5;
    d.open += Math.sign(d.target - d.open) * Math.min(Math.abs(d.target - d.open), dt * rate);
    const s = d.target >= d.open ? easeOutBack(d.open) : d.open * d.open;
    d.disc.scale.setScalar(Math.max(0.0001, d.size * s * (1 + d.boost * 0.18)));
    d.u.speed.value = 1.6 + d.boost * 5; d.u.pull.value = 1 + d.boost * 2.5; d.u.k.value = 1 + d.boost * 0.45;
    if (camera) g.quaternion.copy(camera.quaternion);
  };
  return g;
}
/**
 * Get a Kiki ready to be sucked into a portal (owner: "distorts the Kiki like when people get sucked into Jumanji").
 * Its materials get a vertex twist, worked out in world space: round the line from the camera through the portal, the
 * Kiki swirls like water down a drain (the inner parts faster), its outer edges lag and smear into spiral arms, and it
 * all shrinks into the eye. set(suck 0..1, portal centre (world), axis (world, camera → portal), time).
 */
export function vortexify(obj) {
  const U = { vxSuck: { value: 0 }, vxC: { value: new THREE.Vector3() }, vxAx: { value: new THREE.Vector3(0, 0, -1) }, vxT: { value: 0 } };
  const HEAD = `uniform float vxSuck; uniform vec3 vxC; uniform vec3 vxAx; uniform float vxT;
    vec3 vxRot(vec3 p, vec3 ax, float a){ float c = cos(a), s = sin(a); return p*c + cross(ax, p)*s + ax*dot(ax, p)*(1.-c); }
    void main() {`;
  const BODY = `vec4 vxW = modelMatrix * vec4(transformed, 1.0);
    if (vxSuck > 0.0) {
      vec3 p = vxW.xyz - vxC; float along = dot(p, vxAx); vec3 lat = p - vxAx * along; float r = length(lat);
      float f = clamp(vxSuck * (1.3 - r * 0.9), 0.0, 1.0);
      lat = vxRot(lat, vxAx, pow(f, 1.4) * (2.5 + 1.5 / (r + 0.05)) + vxT * 5.0 * f); // inner parts spin much faster: a real twist
      lat *= 1.0 - pow(f, 1.5);
      vxW.xyz = vxC + vxAx * along * (1.0 - f) + lat;
    }
    vec4 mvPosition = viewMatrix * vxW;
    gl_Position = projectionMatrix * mvPosition;`;
  obj.traverse(o => {
    if (!o.isMesh || !o.material || o.userData.noVortex) return;
    const one = src => {
      const m = src.clone(), prev = src.onBeforeCompile, key = src.customProgramCacheKey.bind(src);
      m.onBeforeCompile = (sh, r) => { prev.call(m, sh, r); Object.assign(sh.uniforms, U); sh.vertexShader = sh.vertexShader.replace('void main() {', HEAD).replace('#include <project_vertex>', BODY); };
      m.customProgramCacheKey = () => key() + '|vortex'; return m;
    };
    o.material = Array.isArray(o.material) ? o.material.map(one) : one(o.material);
  });
  return { set(suck, centre, axis, time) { U.vxSuck.value = suck; U.vxC.value.copy(centre); U.vxAx.value.copy(axis).normalize(); U.vxT.value = time; } };
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
let _circleStones = null;
function circleStonesGeometry() {
  if (_circleStones) return _circleStones;
  const R = 2.6, geos = [], o = new THREE.Object3D();
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2 + 0.2, h = 1.3 * (0.9 + 0.2 * ((i * 37) % 7) / 7);
    o.scale.setScalar(h / 2); o.position.set(Math.cos(a) * R, h * 0.43, Math.sin(a) * R); o.rotation.set(0, -a + Math.PI / 2, ((i * 53) % 9 - 4) * 0.012); o.updateMatrix();
    geos.push(standingStoneGeometry().clone().applyMatrix4(o.matrix));
  }
  _circleStones = mergeGeometries(geos); geos.forEach(g => g.dispose()); _circleStones.userData.shared = true;
  return _circleStones;
}
export function makeCircle(keeperId) {
  const g = new THREE.Group(), mat = runeMaterial(1, 0.42), R = 2.6;
  g.add(new THREE.Mesh(circleStonesGeometry(), mat)); // the seven standing stones, one shape (one draw, not seven)
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.15, 0.16, 40), new THREE.MeshStandardMaterial({ color: 0x3d4275, roughness: 0.8 }));
  dais.position.y = 0.08; g.add(dais);
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.15, 3.32, 96), new THREE.MeshBasicMaterial({ color: 0x7a00ff, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; g.add(ring);
  const portal = makePortal(1.9); portal.position.y = 2.25; portal.userData.target = 1; g.add(portal);
  const beam = makeBeam(16, 0.5); beam.position.y = 2.25; g.add(beam);
  g.userData = { portal, keeper: null, keeperId: null, motion: null, setColor: hex => { ring.material.color.set(hex); beam.material.uniforms.c.value.set(hex); } };
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

// ---------- the explorer (your avatar): a festival-goer ----------
// A chibi festival-goer: big head, big shiny eyes, a real hairstyle (dreads, mohawk, braids, space buns…), a hat
// (bucket, trucker, cowboy, flower crown, bandana…), shades (round, hearts, shutter, LED), patterned clothes (tie-dye,
// rainbow, galaxy…), shorts or flowy pants, a hydration pack or fanny pack, and extras: kandi, LED gloves, a totem.
// A look is a flat object of numbers (see LOOK_KEYS; colours are 0xRRGGBB). Old saves only have { outfit, skin }:
// lookOf() turns those into a full look.
export const SKINS = [0xffe6cf, 0xffd3ae, 0xf1bd8e, 0xdba06e, 0xbf8452, 0x9b6339, 0x744626, 0x50301a];
export const HAIR_STYLES = ['Short', 'Bob', 'Long', 'Ponytail', 'Space buns', 'Curly', 'Spiky', 'Buzz', 'Dreads', 'Mohawk', 'Braids', 'Bald'];
export const BEARDS = ['No beard', 'Stubble', 'Short beard', 'Full beard', 'Mustache', 'Goatee'];
export const HATS = ['No hat', 'Bucket', 'Trucker', 'Beanie', 'Cowboy', 'Flower crown', 'Bandana', 'Ranger', 'Baseball cap'];
export const GLASSES = ['No shades', 'Round', 'Hearts', 'Shutter', 'LED'];
export const BAGS = ['Backpack', 'Hydration pack', 'Fanny pack', 'No bag'];
export const PATTERNS = ['Plain', 'Tie-dye', 'Rainbow', 'Galaxy', 'Checker', 'Stripes', 'Spots', 'Daisies'];
export const LEGS = ['Shorts', 'Flowy pants'];
export const EXTRAS = [['kandi', 'Kandi'], ['gloves', 'LED gloves'], ['totem', 'Totem']];
export const HAIR_COLORS = [0x231b2b, 0x3f2717, 0x6e4426, 0x9b3d22, 0xd97a2c, 0xf2cf6b, 0xf5ecd8, 0xa9a9b6, 0xff7ab8, 0x9b6bff, 0x48a8ff, 0x4fc95a];
export const EYE_COLORS = [0x18237a, 0x5a3218, 0x2f8f3a, 0x2f7fe0, 0x7a3ad6, 0x55606e];
export const CLOTHES = [0xffffff, 0xfff2c4, 0xffcf2e, 0xff8a00, 0xe23a3a, 0xff5d8f, 0xc77dff, 0x8c4dff, 0x2b3a8f, 0x36b6ff, 0x2bc4b6, 0x3fae2a, 0x7c8c3a, 0xc79a5b, 0x6b4a2a, 0x4a4f6a, 0x1f1f2e];
const OLD_SKIN = [0, 2, 3, 5, 6];
// the old hairstyles (HAIR_STYLES) → the 3D ones (STYLES): Short, Bob, Long, Ponytail, Space buns, Curly, Spiky, Buzz, Dreads, Mohawk, Braids, Bald
const OLD_HAIR_TO_STYLE = [0, 2, 2, 2, 3, 4, 1, 7, 5, 6, 5, 7];
// round-1 3D hairstyles (Short, Spiky, Long, Space buns, Curly, Locs, Undercut, Bald) → HAIRDOS; old shades → SHADES
const STYLE_TO_HAIRDO = [2, 3, 6, 8, 9, 10, 4, 0], OLD_SHADES = [0, 3, 5, 2, 4];
// Quick looks (old saves' outfits 0 to 3 become the first four; Ranger Rue is the guide).
export const OUTFITS = [
  ['Wook', { sex: 0, shirt: 0, legs: 0, hairdo: 10, body: 2, style: 5, hair: 8, beard: 2, hairC: 0x6e4426, hat: 1, hatC: 0x3fae2a, top: 0xff5d8f, topPat: 1, bottom: 0xc79a5b, botPat: 5, pants: 1, shoes: 0x6b4a2a, pack: 0x2b3a8f, bag: 1, glasses: 3, glassC: 0x6b3f22, lens: 1, eyes: 0x5a3218, kandi: 1, totem: 1 }],
  ['Raver', { sex: 1, shirt: 0, legs: 2, hairdo: 14, body: 0, style: 3, hair: 4, hairC: 0xff7ab8, hat: 0, hatC: 0xffcf2e, top: 0xffffff, topPat: 2, bottom: 0x1f1f2e, botPat: 4, pants: 0, shoes: 0xffffff, pack: 0xc77dff, bag: 2, glasses: 5, glassC: 0xf4f1ea, lens: 4, eyes: 0x2f7fe0, kandi: 1, gloves: 1 }],
  ['Bass Head', { sex: 0, shirt: 1, legs: 0, hairdo: 4, body: 1, style: 6, hair: 9, hairC: 0x48a8ff, hat: 0, hatC: 0x1f1f2e, top: 0x8c4dff, topPat: 3, bottom: 0x1f1f2e, botPat: 0, pants: 1, shoes: 0x1f1f2e, pack: 0x1f1f2e, bag: 2, glasses: 4, glassC: 0x1d1d22, lens: 3, eyes: 0x7a3ad6, gloves: 1 }],
  ['Flower Child', { sex: 1, shirt: 1, legs: 0, hairdo: 12, body: 2, style: 2, hair: 2, hairC: 0xf2cf6b, hat: 5, hatC: 0xff5d8f, top: 0xfff2c4, topPat: 7, bottom: 0x36b6ff, botPat: 0, pants: 1, shoes: 0xc79a5b, pack: 0xff8a00, bag: 3, glasses: 3, glassC: 0xc9a24a, lens: 5, eyes: 0x2f8f3a, kandi: 1 }],
  ['Ranger Rue', { sex: 1, shirt: 1, legs: 0, hairdo: 7, body: 1, style: 2, hair: 2, hairC: 0x9b3d22, hat: 7, hatC: 0x7a5a2a, top: 0xffcf2e, bottom: 0x2f6b3a, shoes: 0x3a2a1a, pack: 0x3fae2a, bag: 0, eyes: 0x2f8f3a, kandi: 1 }],
];
export const LOOK_KEYS = ['skin', 'hair', 'hat', 'hairC', 'hatC', 'top', 'bottom', 'shoes', 'pack', 'eyes', 'topPat', 'botPat', 'pants', 'glasses', 'glassC', 'bag', 'kandi', 'gloves', 'totem', 'beard', 'body', 'style', 'sex', 'shirt', 'legs', 'hairdo', 'lens', 'boots', 'shoeC'];
const LIMITS = { boots: 2, body: 3, style: 8, sex: 2, shirt: 2, legs: 3, hairdo: HAIRDOS.length, lens: LENSES.length, beard: BEARDS.length, skin: SKINS.length, hair: HAIR_STYLES.length, hat: HATS.length, glasses: SHADES.length, bag: BAGS.length, topPat: PATTERNS.length, botPat: PATTERNS.length, pants: LEGS.length, kandi: 2, gloves: 2, totem: 2 };
/** A full look from a saved explorer (or a friend's avatar): { look } or the old { outfit, skin }. */
export function lookOf(e = {}) {
  // A saved look keeps what it has, and anything added to the game later (beards, shades…) starts as "none"; only
  // explorers with no look at all start from their preset outfit.
  const none = { skin: 2, beard: 0, topPat: 0, botPat: 0, pants: 0, glasses: 0, glassC: 0x1f1f2e, bag: 0, kandi: 0, gloves: 0, totem: 0 };
  const preset = (OUTFITS[e.outfit] || OUTFITS[0])[1];
  const base = e.look ? { ...none, ...preset, beard: 0, glasses: 0, kandi: 0, gloves: 0, totem: 0, topPat: 0, botPat: 0, pants: 0, bag: 0 } : { ...none, ...preset };
  if (e.skin != null) base.skin = OLD_SKIN[e.skin] ?? 2;
  const out = { ...base, ...(e.look || {}) };
  if (out.boots == null) out.boots = 0; if (out.shoeC == null) out.shoeC = 0xffffff;
  // looks saved before the 3D explorers: pick the nearest cut and hairstyle
  if (e.look && e.look.body == null) out.body = out.pants ? 2 : 0;
  if (e.look && e.look.style == null) out.style = OLD_HAIR_TO_STYLE[out.hair] ?? 0;
  // looks saved before the basic-wear explorers (round 2): tee and shorts or jeans, the same hairstyle, everyday shades
  if (e.look && e.look.hairdo == null) {
    out.sex = 0; out.shirt = out.body === 1 ? 1 : 0; out.legs = out.body === 0 ? 1 : 0;
    out.hairdo = STYLE_TO_HAIRDO[out.style] ?? 2;
    out.glasses = OLD_SHADES[out.glasses] ?? 0; out.lens = 0;
  }
  for (const k of LOOK_KEYS) { out[k] = Math.max(0, Math.floor(+out[k] || 0)); if (LIMITS[k]) out[k] %= LIMITS[k]; }
  // retired: the painted buzz cut and stubble (owner: "no scalp or face paint", "no hair at all")
  if (out.hairdo === 1) out.hairdo = 0; if (out.beard === 1) out.beard = 0;
  return out;
}
/** A short text key for a look (for portraits): numbers in base 36, joined with dots. */
export const encodeLook = l => LOOK_KEYS.map(k => (l[k] || 0).toString(36)).join('.');
export const decodeLook = s => Object.fromEntries(s.split('.').map((v, i) => [LOOK_KEYS[i], parseInt(v, 36) || 0]));
const lookFrom = (a, b) => a && a.includes('.') ? lookOf({ look: decodeLook(a) }) : lookOf({ outfit: +a || 0, skin: b != null ? +b : 1 });

// ---------- fabric patterns (tie-dye, rainbow, galaxy…), drawn once per pattern and colour ----------
const patCache = new Map();
function patternTex(pat, base) {
  const key = pat + ':' + base; if (patCache.has(key)) return patCache.get(key);
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  const col = new THREE.Color(base), hsl = {}; col.getHSL(hsl);
  const tint = (dh, l = 0.55) => new THREE.Color().setHSL((hsl.h + dh + 1) % 1, Math.max(0.65, hsl.s), l);
  g.fillStyle = '#' + col.getHexString(); g.fillRect(0, 0, S, S);
  const r = rng(hash(pat, base));
  if (pat === 'Tie-dye') { // swirling bands that wrap seamlessly around the body
    const cs = [col, tint(0.33), tint(0.66), new THREE.Color(0xffffff)], id = g.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S, ph = Math.PI * 2 * 2 * u + 9 * v + 1.6 * Math.sin(Math.PI * 2 * 3 * u + 5 * v);
      const t = (Math.sin(ph) * 0.5 + 0.5) * 3, i = Math.floor(t) % 3, f = t - Math.floor(t), a = cs[i], b2 = cs[(i + 1) % 3], k = (y * S + x) * 4;
      const w = Math.pow(Math.abs(Math.sin(ph * 2.0)), 6) * 0.35; // white crinkle lines
      id.data[k] = (a.r + (b2.r - a.r) * f) * 255 * (1 - w) + 255 * w; id.data[k + 1] = (a.g + (b2.g - a.g) * f) * 255 * (1 - w) + 255 * w; id.data[k + 2] = (a.b + (b2.b - a.b) * f) * 255 * (1 - w) + 255 * w; id.data[k + 3] = 255;
    }
    g.putImageData(id, 0, 0);
  } else if (pat === 'Rainbow') { ['#ff3b6b', '#ff9a1f', '#ffe31a', '#4be05a', '#2fb8ff', '#8a5cff'].forEach((h, i) => { g.fillStyle = h; g.fillRect(0, i * S / 6, S, S / 6 + 1); }); }
  else if (pat === 'Galaxy') {
    g.fillStyle = '#1a0f3d'; g.fillRect(0, 0, S, S);
    for (const [cc, n] of [['#' + col.getHexString(), 5], ['#ff4fd8', 3], ['#38e8ff', 3]]) for (let i = 0; i < n; i++) { const x = r.next() * S, y = r.next() * S, rad = 18 + r.next() * 26, gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, cc + 'cc'); gr.addColorStop(1, cc + '00'); g.fillStyle = gr; for (const dx of [-S, 0, S]) g.fillRect(x - rad + dx, y - rad, rad * 2, rad * 2); g.translate(0, 0); }
    g.fillStyle = '#ffffff'; for (let i = 0; i < 60; i++) { const s = r.next() < 0.15 ? 2 : 1; g.fillRect(r.next() * S, r.next() * S, s, s); }
  } else if (pat === 'Checker') { const n = 8, other = hsl.l > 0.6 ? '#1f1f2e' : '#ffffff'; g.fillStyle = other; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if ((x + y) % 2) g.fillRect(x * S / n, y * S / n, S / n, S / n); }
  else if (pat === 'Stripes') { g.fillStyle = hsl.l > 0.75 ? '#' + tint(0.5, 0.5).getHexString() : '#ffffff'; for (let i = 0; i < 6; i++) g.fillRect(0, i * S / 6, S, S / 14); }
  else if (pat === 'Spots') { g.fillStyle = hsl.l > 0.75 ? '#' + tint(0, 0.45).getHexString() : '#fff6e0'; for (let i = 0; i < 14; i++) { const x = r.next() * S, y = r.next() * S, rad = 5 + r.next() * 8; for (const dx of [-S, 0, S]) { g.beginPath(); g.arc(x + dx, y, rad, 0, Math.PI * 2); g.fill(); } } }
  else if (pat === 'Daisies') {
    for (let i = 0; i < 9; i++) { const x = (i % 3 + 0.5 + (Math.floor(i / 3) % 2) * 0.5) * S / 3, y = (Math.floor(i / 3) + 0.5) * S / 3;
      g.fillStyle = '#ffffff'; for (let p = 0; p < 6; p++) { const a = p / 6 * Math.PI * 2; for (const dx of [-S, 0, S]) { g.beginPath(); g.ellipse(x + dx + Math.cos(a) * 7, y + Math.sin(a) * 7, 5, 3, a, 0, Math.PI * 2); g.fill(); } }
      g.fillStyle = '#ffcf2e'; for (const dx of [-S, 0, S]) { g.beginPath(); g.arc(x + dx, y, 4, 0, Math.PI * 2); g.fill(); } }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 2;
  patCache.set(key, t); return t;
}

// ---------- anime look (owner: "the avatars have to look slightly anime"): cel shading, ink outlines, painted eyes ----------
const TOON = (() => { const d = new Uint8Array([105, 180, 255]); const t = new THREE.DataTexture(d, 3, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return t; })();
const INK = 0x2a1d3f, inkMats = new Map();
/** The ink outline: the same shape, drawn back-facing and pushed out along its normals by w (in the mesh's own units). */
function inkMat(w) {
  const k = Math.round(w * 2000) / 2000; if (inkMats.has(k)) return inkMats.get(k);
  const m = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  m.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = vec3(position) + normalize(normal) * ${k.toFixed(4)};`); };
  m.customProgramCacheKey = () => 'ink' + k; inkMats.set(k, m); return m;
}
function inkAll(root, w = 0.0065) {
  const list = []; root.traverse(o => { if (o.isMesh && o.material && o.material.isMeshToonMaterial && !o.userData.noInk && o.geometry.attributes.normal) list.push(o); });
  for (const o of list) { const sc = Math.max(0.02, (Math.abs(o.scale.x) + Math.abs(o.scale.y) + Math.abs(o.scale.z)) / 3); const ol = new THREE.Mesh(o.geometry, inkMat(w / sc)); ol.userData.noInk = true; ol.renderOrder = -1; o.add(ol); }
}
const canv = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
const animeTex = new Map();
/** An anime eye: white, a tall glossy iris (dark at the top, glowing at the bottom), a pupil, two catch-lights and a
 * bold upper lash line with a little wing at the outer corner (on the right; the left eye is mirrored). */
function animeEye(color) {
  const key = 'eye' + color; if (animeTex.has(key)) return animeTex.get(key);
  const c = new THREE.Color(color), css = k => `rgb(${Math.round(Math.min(255, c.r * 255 * k))},${Math.round(Math.min(255, c.g * 255 * k))},${Math.round(Math.min(255, c.b * 255 * k))})`;
  const t = canv(128, 160, (x, W, H) => {
    x.save(); x.beginPath(); x.ellipse(64, 92, 46, 58, 0, 0, Math.PI * 2); x.clip(); // the eye opening
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H);
    x.fillStyle = 'rgba(120,110,170,0.25)'; x.fillRect(0, 30, W, 26); // the lid's soft shadow on the white
    const g = x.createLinearGradient(0, 50, 0, 146); g.addColorStop(0, css(0.35)); g.addColorStop(0.45, css(0.95)); g.addColorStop(1, css(1.6));
    x.fillStyle = g; x.beginPath(); x.ellipse(64, 98, 36, 47, 0, 0, Math.PI * 2); x.fill();
    x.lineWidth = 4; x.strokeStyle = css(0.3); x.stroke();
    x.fillStyle = '#120a22'; x.beginPath(); x.ellipse(64, 100, 15, 22, 0, 0, Math.PI * 2); x.fill();
    const glow = x.createRadialGradient(64, 132, 2, 64, 132, 30); glow.addColorStop(0, css(2)); glow.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = glow; x.globalAlpha = 0.6; x.beginPath(); x.ellipse(64, 128, 28, 16, 0, 0, Math.PI * 2); x.fill(); x.globalAlpha = 1;
    x.fillStyle = '#ffffff'; x.beginPath(); x.ellipse(48, 76, 13, 16, -0.3, 0, Math.PI * 2); x.fill();
    x.beginPath(); x.arc(82, 120, 6, 0, Math.PI * 2); x.fill(); x.beginPath(); x.arc(74, 72, 3.5, 0, Math.PI * 2); x.fill();
    x.restore();
    // upper lash line: thick, arched, with a wing at the outer corner
    x.fillStyle = '#1a0f2e'; x.beginPath(); x.moveTo(12, 70); x.quadraticCurveTo(58, 18, 116, 52); x.lineTo(126, 44); x.lineTo(120, 62); x.quadraticCurveTo(62, 36, 18, 80); x.closePath(); x.fill();
    x.strokeStyle = 'rgba(26,15,46,0.5)'; x.lineWidth = 2.5; x.beginPath(); x.moveTo(34, 146); x.quadraticCurveTo(66, 156, 96, 144); x.stroke(); // lower lid
  });
  animeTex.set(key, t); return t;
}
function animeMouth() {
  if (animeTex.has('mouth')) return animeTex.get('mouth');
  const t = canv(64, 48, x => { x.fillStyle = '#7a1f35'; x.beginPath(); x.moveTo(14, 14); x.quadraticCurveTo(32, 20, 50, 14); x.quadraticCurveTo(46, 42, 32, 42); x.quadraticCurveTo(18, 42, 14, 14); x.fill();
    x.fillStyle = '#ff8a9a'; x.beginPath(); x.ellipse(32, 36, 10, 6, 0, 0, Math.PI * 2); x.fill(); x.strokeStyle = '#3a1020'; x.lineWidth = 2.5; x.lineJoin = 'round'; x.beginPath(); x.moveTo(14, 14); x.quadraticCurveTo(32, 20, 50, 14); x.quadraticCurveTo(46, 42, 32, 42); x.quadraticCurveTo(18, 42, 14, 14); x.stroke(); });
  animeTex.set('mouth', t); return t;
}
function animeBlush() {
  if (animeTex.has('blush')) return animeTex.get('blush');
  const t = canv(64, 40, x => { const g = x.createRadialGradient(32, 20, 2, 32, 20, 28); g.addColorStop(0, 'rgba(255,120,150,0.6)'); g.addColorStop(1, 'rgba(255,120,150,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 40);
    x.strokeStyle = 'rgba(230,80,120,0.7)'; x.lineWidth = 2.2; for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(20 + i * 10, 26); x.lineTo(27 + i * 10, 14); x.stroke(); } });
  animeTex.set('blush', t); return t;
}
let lockGeo = null;
/** One hair lock: a flattened, slightly curved point; base at y = 0, tip at y = -1, curling outwards (+z). */
function hairLock() {
  if (lockGeo) return lockGeo;
  lockGeo = new THREE.ConeGeometry(1, 1, 8, 4); lockGeo.rotateX(Math.PI); lockGeo.translate(0, -0.5, 0);
  const p = lockGeo.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, p.getZ(i) + 0.35 * y * y); }
  lockGeo.computeVertexNormals(); return lockGeo;
}

/**
 * A chibi festival-goer about 1 unit tall, feet at y=0, facing +z. userData.update(dt, speed) walks (speed in m/s) or
 * idles, blinks, and makes LED things cycle colours. makeExplorer(look) or the old makeExplorer(outfit, skin).
 */
export function makeExplorer(look = {}, skin) {
  const L = typeof look === 'number' ? lookOf({ outfit: look, skin }) : lookOf({ look });
  // the real 3D anime explorer once its outfit and hairstyle have loaded (explorer3d.js); this chibi one until then
  if (explorerReady(L)) { const x = makeExplorer3D({ ...L, skinC: SKINS[L.skin], lensC: LENSES[L.lens] }); x.userData.is3D = true; return x; }
  // cel shading (three tones) for the anime look; ink outlines are added at the end (inkAll)
  const M = c => new THREE.MeshToonMaterial({ color: c, gradientMap: TOON }), dark = (c, k) => new THREE.Color(c).multiplyScalar(k).getHex();
  const P = (pat, c) => pat ? new THREE.MeshToonMaterial({ color: 0xffffff, map: patternTex(PATTERNS[pat], c), gradientMap: TOON }) : M(c);
  const skinM = M(SKINS[L.skin]), hairM = M(L.hairC), topM = P(L.topPat, L.top), botM = P(L.botPat, L.bottom), shoeM = M(L.shoes), packM = M(L.pack);
  const glow = []; // LED things: their colour cycles in update()
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const sph = (r, m, ws = 18, hs = 14) => new THREE.Mesh(new THREE.SphereGeometry(r, ws, hs), m);
  const cap = (r, h, m) => new THREE.Mesh(new THREE.CapsuleGeometry(r, h, 6, 14), m);
  const cyl = (r0, r1, h, m, seg = 18) => new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), m);
  const limb = (r, h, m, x, y) => { const pv = new THREE.Group(); pv.position.set(x, y, 0); const c = cap(r, h, m); c.position.y = -h / 2 - r * 0.4; pv.add(c); body.add(pv); return pv; };
  // legs: skin, with shorts or flowy pants, and chunky shoes
  const legs = [-1, 1].map(s => {
    const pv = new THREE.Group(); pv.position.set(s * 0.08, 0.235, 0); body.add(pv);
    if (L.pants) { const leg = cyl(0.072, 0.1, 0.2, botM); leg.position.y = -0.085; pv.add(leg); }
    else { const leg = cap(0.05, 0.1, skinM); leg.position.y = -0.09; pv.add(leg); const short = cyl(0.074, 0.08, 0.075, botM); short.position.y = -0.02; pv.add(short); }
    const shoe = sph(0.088, shoeM); shoe.scale.set(1, 0.62, 1.4); shoe.position.set(0, -0.19, 0.03); pv.add(shoe);
    const sole = cyl(0.084, 0.086, 0.026, M(0xf6f1e4)); sole.scale.set(1, 1, 1.38); sole.position.set(0, -0.222, 0.03); pv.add(sole);
    return pv;
  });
  // shorts/pants top and shirt
  const hips = sph(0.158, botM); hips.scale.set(1, 0.58, 0.86); hips.position.y = 0.25; body.add(hips);
  const torso = cap(0.155, 0.08, topM); torso.position.y = 0.36; torso.scale.set(1, 1, 0.84); body.add(torso);
  const trim = M(dark(L.topPat ? 0xffffff : L.top, L.topPat ? 0.92 : 0.78));
  const hem = new THREE.Mesh(new THREE.TorusGeometry(0.152, 0.018, 8, 28), trim); hem.rotation.x = Math.PI / 2; hem.scale.y = 0.84; hem.position.y = 0.28; body.add(hem);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.02, 8, 22), trim); collar.rotation.x = Math.PI / 2; collar.position.y = 0.455; body.add(collar);
  const neck = cap(0.05, 0.03, skinM); neck.position.y = 0.47; body.add(neck);
  // arms: sleeve, hand (or a glowing LED glove), kandi bracelets
  const handM = L.gloves ? new THREE.MeshBasicMaterial({ color: 0xff4fd8 }) : skinM; if (L.gloves) glow.push(handM);
  const arms = [-1, 1].map(s => {
    const a = limb(0.052, 0.1, topM, s * 0.18, 0.43); a.rotation.z = s * 0.16;
    const hand = sph(0.056, handM, 14, 10); hand.position.y = -0.2; a.add(hand);
    if (L.kandi) { const beads = ['#ff3b6b', '#ff9a1f', '#ffe31a', '#4be05a', '#2fb8ff', '#8a5cff']; for (let i = 0; i < 12; i++) { const ang = i / 12 * Math.PI * 2, b = sph(0.013, new THREE.MeshStandardMaterial({ color: beads[i % 6], roughness: 0.3 }), 8, 6); b.position.set(Math.cos(ang) * 0.055, -0.15, Math.sin(ang) * 0.055); a.add(b); } }
    return a;
  });
  // bag: backpack, hydration pack (with its drinking tube), fanny pack, or none
  if (L.bag === 0 || L.bag === 1) {
    const hyd = L.bag === 1, pack = new THREE.Mesh(new THREE.BoxGeometry(hyd ? 0.19 : 0.24, hyd ? 0.25 : 0.24, hyd ? 0.08 : 0.12, 2, 2, 2), packM); pack.position.set(0, 0.37, hyd ? -0.15 : -0.16);
    { const p = pack.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i), n = v.clone().normalize(); v.lerp(n.multiplyScalar(v.length()), 0.4); p.setXYZ(i, v.x, v.y, v.z); } pack.geometry.computeVertexNormals(); }
    body.add(pack);
    if (!hyd) {
      const flap = new THREE.Mesh(new THREE.SphereGeometry(0.095, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(dark(L.pack, 0.8))); flap.scale.set(1.25, 0.5, 0.72); flap.position.set(0, 0.48, -0.16); body.add(flap);
      const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.03), M(dark(L.pack, 0.85))); pocket.position.set(0, 0.32, -0.225); body.add(pocket);
    } else {
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.06, 0.48, -0.15), new THREE.Vector3(0.11, 0.53, -0.04), new THREE.Vector3(0.12, 0.47, 0.11), new THREE.Vector3(0.09, 0.4, 0.15)]), 16, 0.011, 6), M(dark(L.pack, 0.6))); body.add(tube);
      const valve = sph(0.017, M(0x2bc4b6), 8, 6); valve.position.set(0.09, 0.4, 0.155); body.add(valve);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.025, 0.085), M(dark(L.pack, 0.7))); stripe.position.set(0, 0.42, -0.15); body.add(stripe);
    }
  } else if (L.bag === 2) {
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.162, 0.01, 6, 30), M(dark(L.pack, 0.6))); belt.rotation.x = Math.PI / 2; belt.scale.y = 0.86; belt.position.y = 0.29; body.add(belt);
    const fanny = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.11, 6, 12), packM); fanny.rotation.z = Math.PI / 2; fanny.position.set(0.02, 0.28, 0.15); fanny.scale.set(1, 1, 0.75); body.add(fanny);
    const zip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.006, 0.005), M(0xf6f1e4)); zip.position.set(0.02, 0.29, 0.183); body.add(zip);
  }
  // a festival totem: a pole with a little Kiki on top, so your crew can find you
  if (L.totem) {
    const totem = new THREE.Group(); totem.position.set(0.25, 0.22, 0.02); body.add(totem);
    const pole = cyl(0.011, 0.011, 0.72, M(0xf6f1e4), 8); pole.position.y = 0.36; totem.add(pole);
    const mini = makeKiki('meadow', 0.15); mini.position.y = 0.72; mini.remove(mini.userData.shadow); totem.add(mini);
  }

  // head: anime chibi: big and round, cheeks soft, the chin tapering a little
  const head = new THREE.Group(); head.position.y = 0.7; body.add(head);
  const R = 0.265, SY = 0.95, SZ = 0.93, headGeo = new THREE.SphereGeometry(R, 40, 30), hp = headGeo.attributes.position;
  for (let i = 0; i < hp.count; i++) { let x = hp.getX(i), y = hp.getY(i), z = hp.getZ(i); if (y < 0) { const t = Math.pow(-y / R, 1.6); x *= 1 - 0.2 * t; z *= 1 - 0.06 * t; y *= 1 + 0.06 * t; } hp.setXYZ(i, x, y, z); }
  headGeo.computeVertexNormals();
  const skull = new THREE.Mesh(headGeo, skinM); skull.scale.set(1.03, SY, SZ); head.add(skull);
  // where the face is: rays from the front onto the head shape
  const probe = new THREE.Mesh(headGeo); probe.scale.copy(skull.scale); probe.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(), surf = (x, y) => { ray.set(new THREE.Vector3(x, y, 1), new THREE.Vector3(0, 0, -1)); const h = ray.intersectObject(probe)[0]; return h ? { p: h.point, n: h.face.normal.clone().transformDirection(probe.matrixWorld) } : { p: new THREE.Vector3(x, y, R * SZ), n: new THREE.Vector3(0, 0, 1) }; };
  const zOn = (x, y, lift = 0.004) => surf(x, y).p.z + lift;
  const onFace = (mesh, x, y, lift) => { const { p, n } = surf(x, y); mesh.position.copy(p).addScaledVector(n, lift); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n); head.add(mesh); return mesh; };
  for (const s of [-1, 1]) { const ear = sph(0.05, skinM, 12, 10); ear.scale.set(0.55, 1, 0.8); ear.position.set(s * 0.262, -0.035, -0.01); head.add(ear); }
  const decal = (tex, w, h) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = onFace(decal(animeEye(L.eyes), 0.112, 0.14), s * 0.094, -0.035, 0.004); e.scale.x = -s; e.renderOrder = 3; eyes.push(e); // mirrored so the wing is on the outside
    const brow = onFace(new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.011), new THREE.MeshBasicMaterial({ color: dark(L.hairC, 0.7) })), s * 0.096, 0.058, 0.006); brow.rotateZ(-s * 0.12); brow.renderOrder = 3;
    const blush = onFace(decal(animeBlush(), 0.075, 0.045), s * 0.152, -0.112, 0.004); blush.renderOrder = 2;
  }
  const mouth = onFace(decal(animeMouth(), 0.05, 0.0375), 0, -0.145, 0.004); mouth.renderOrder = 3;

  // shades
  if (L.glasses) {
    const gl = new THREE.Group(); head.add(gl); const frameM = M(L.glassC), y = -0.02, z = zOn(0.09, y) + 0.03;
    const lensM = new THREE.MeshBasicMaterial({ color: dark(L.glassC, 0.35), transparent: true, opacity: 0.82 });
    if (L.glasses === 1) for (const s of [-1, 1]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.009, 8, 24), frameM); ring.position.set(s * 0.092, y, z); gl.add(ring); const lens = new THREE.Mesh(new THREE.CircleGeometry(0.05, 24), lensM); lens.position.set(s * 0.092, y, z - 0.002); gl.add(lens); }
    if (L.glasses === 2) { const hs = new THREE.Shape(); hs.moveTo(0, -0.05); hs.bezierCurveTo(-0.07, -0.005, -0.045, 0.055, 0, 0.022); hs.bezierCurveTo(0.045, 0.055, 0.07, -0.005, 0, -0.05);
      for (const s of [-1, 1]) { const back = new THREE.Mesh(new THREE.ShapeGeometry(hs, 12), frameM); back.scale.setScalar(1.15); back.position.set(s * 0.092, y, z - 0.003); gl.add(back); const lens = new THREE.Mesh(new THREE.ShapeGeometry(hs, 12), new THREE.MeshBasicMaterial({ color: dark(L.glassC, 0.55), transparent: true, opacity: 0.9 })); lens.position.set(s * 0.092, y, z); gl.add(lens); } }
    if (L.glasses === 3 || L.glasses === 4) {
      const led = L.glasses === 4, barM = led ? new THREE.MeshBasicMaterial({ color: L.glassC }) : frameM; if (led) glow.push(barM);
      for (const s of [-1, 1]) { const frame = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.075, 0.012), M(0x1f1f2e)); frame.position.set(s * 0.092, y, z - 0.004); gl.add(frame); for (let i = 0; i < 4; i++) { const bar = new THREE.Mesh(new THREE.BoxGeometry(0.104, 0.011, 0.01), barM); bar.position.set(s * 0.092, y - 0.027 + i * 0.018, z + 0.004); gl.add(bar); } }
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.01, 0.01), frameM); bridge.position.set(0, y + 0.012, z); gl.add(bridge);
    for (const s of [-1, 1]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, 0.2), frameM); arm.position.set(s * 0.15, y + 0.01, z - 0.1); arm.rotation.y = s * 0.28; gl.add(arm); }
  }

  // hair: anime style: a cap of hair, pointed locks for the fringe and sides, and a shine band
  const hat = L.hat, tallHat = [1, 2, 3, 4, 7].includes(hat), hr = R + 0.016, hair = new THREE.Group(); head.add(hair);
  const shell = (r = hr, cover = 0.56, tilt = -0.42, m = hairM) => { const sh = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 18, 0, Math.PI * 2, 0, Math.PI * cover), m); sh.rotation.x = tilt; sh.scale.set(1.04, SY, SZ + 0.04); hair.add(sh); return sh; };
  const tuft = (x, y, z, r, sx = 1, sy = 1, sz = 1) => { const m = sph(r, hairM, 14, 10); m.position.set(x, y, z); m.scale.set(sx, sy, sz); hair.add(m); return m; };
  // a lock at angle phi round the head (0 = the middle of the forehead), starting at height y0, hanging len, leaning out
  const lock = (phi, y0, len, w, out = 0.3, m = hairM) => {
    const rr = R * Math.sqrt(Math.max(0.08, 1 - (y0 / (R * SY)) ** 2)), g = new THREE.Group();
    g.position.set(Math.sin(phi) * rr * 1.08, y0, Math.cos(phi) * rr * (SZ + 0.08)); g.rotation.y = phi; hair.add(g);
    const c = new THREE.Mesh(hairLock(), m); c.scale.set(w, len, w * 0.55); c.rotation.x = -out; g.add(c); return g;
  };
  const fringe = (n = 5, len0 = 0.11, len1 = 0.19, span = 1.0, y = 0.16) => { for (let i = 0; i < n; i++) { const t = n === 1 ? 0 : i / (n - 1) * 2 - 1, a = Math.abs(t); lock(t * span + (i % 2 ? 0.05 : -0.05), y - a * 0.03, len0 + (len1 - len0) * Math.pow(a, 1.4) + (i % 2) * 0.02, 0.085 - a * 0.012, 0.26 + a * 0.12); } };
  const sides = (len, n = 2, from = 1.32) => { for (const s of [-1, 1]) for (let i = 0; i < n; i++) lock(s * (from + i * 0.24), 0.11 - i * 0.02, len - i * 0.03, 0.075, 0.12); };
  const shine = r => { const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.007, 6, 48, Math.PI * 0.8), new THREE.MeshBasicMaterial({ color: new THREE.Color(L.hairC).lerp(new THREE.Color(0xffffff), 0.55), transparent: true, opacity: 0.75 })); ring.rotation.set(-0.95, 0, Math.PI * 0.1); ring.position.set(0, 0.06, 0); ring.scale.set(1.04, SY, SZ + 0.05); hair.add(ring); };
  const style = HAIR_STYLES[L.hair];
  if (style === 'Bald') { const gloss = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 })); gloss.position.set(-0.06, R * SY * 0.93, 0.05); gloss.rotation.x = -1.2; head.add(gloss); }
  else if (style === 'Buzz') shell(R + 0.006, 0.52, -0.5);
  else if (style === 'Mohawk') shell(R + 0.006, 0.52, -0.5, M(dark(L.hairC, 0.7)));
  else if (style === 'Curly') { shell(hr, 0.52, -0.45); const k = hat ? 0.75 : 1; for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, ring = i % 2; tuft(Math.cos(a) * 0.2 * k, 0.1 + ring * 0.07 + (hat ? -0.04 : 0), -0.02 + Math.sin(a) * 0.17 * k, 0.1 + ring * 0.01); } if (!tallHat) tuft(0, 0.26, -0.03, 0.15); for (let i = 0; i < 5; i++) tuft((i / 4 - 0.5) * 0.3, 0.15 - Math.abs(i / 4 - 0.5) * 0.06, 0.2, 0.055); }
  else {
    shell();
    if (style === 'Dreads') fringe(5, 0.08, 0.12, 0.9);
    else if (style === 'Spiky') fringe(6, 0.09, 0.14, 1.0);
    else fringe(5, 0.11, ['Long', 'Bob'].includes(style) ? 0.22 : 0.19);
    if (['Short', 'Ponytail', 'Space buns', 'Braids', 'Spiky'].includes(style)) sides(0.2);
    if (style === 'Bob') { sides(0.3, 3); for (let i = 0; i < 6; i++) lock(Math.PI + (i / 5 - 0.5) * 2.4, 0.06, 0.3, 0.11, 0.18); }
    if (style === 'Long') { sides(0.46, 3); for (let i = 0; i < 7; i++) lock(Math.PI + (i / 6 - 0.5) * 2.6, 0.09, 0.55 - Math.abs(i / 6 - 0.5) * 0.12, 0.12, 0.12); }
    if (style !== 'Dreads') shine(R * 1.075);
  }
  if (style === 'Ponytail') { const tail = cap(0.07, 0.2, hairM); tail.position.set(0, -0.06, -0.33); tail.rotation.x = 0.55; hair.add(tail); const tie = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.016, 8, 16), M(L.pack)); tie.position.set(0, 0.06, -0.27); tie.rotation.x = 0.9; hair.add(tie); }
  if (style === 'Space buns' && !tallHat) for (const s of [-1, 1]) { tuft(s * 0.17, 0.2, -0.04, 0.1); const tie = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 16), M(0xff4fd8)); tie.position.set(s * 0.15, 0.15, -0.04); tie.rotation.set(Math.PI / 2, 0, s * 0.5); hair.add(tie); }
  if (style === 'Spiky' && !tallHat) for (let i = 0; i < 9; i++) { const a = (i / 8 - 0.5) * 2.4, g = new THREE.Group(); g.position.set(Math.sin(a) * 0.16, 0.2 + Math.cos(a) * 0.05, -0.04 - Math.abs(a) * 0.03); g.rotation.set(0.5, 0, -a * 0.6); const c = new THREE.Mesh(hairLock(), hairM); c.scale.set(0.06, 0.2, 0.035); c.rotation.x = Math.PI; g.add(c); hair.add(g); }
  if (style === 'Mohawk' && !tallHat) for (let i = 0; i < 6; i++) { const a = -0.5 + i * 0.36, c = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.17, 10), hairM); c.scale.set(0.45, 1, 1); c.position.set(0, Math.cos(a) * 0.27, Math.sin(-a) * 0.27 * SZ); c.rotation.x = -a; hair.add(c); }
  if (style === 'Dreads') for (let i = 0; i < 18; i++) {
    const a = Math.PI * (0.06 + 0.88 * (i / 17)) + (i % 2) * 0.05, x = Math.cos(a) * 0.235, z = -Math.sin(a) * 0.22 * SZ, len = 0.2 + (i % 3) * 0.05;
    const loc = cap(0.026, len, M(dark(L.hairC, 0.85 + (i % 3) * 0.08))); loc.position.set(x * 1.02, -0.03 - len / 2, z * 1.02 - 0.01); loc.rotation.set(-z * 0.6, 0, x * 0.5); hair.add(loc);
    if (i % 4 === 0) { const bead = cyl(0.03, 0.03, 0.025, M([0xffcf2e, 0xff5d8f, 0x2bc4b6][i % 3]), 10); bead.position.set(x * 1.02, -0.06 - len, z * 1.02 - 0.01); hair.add(bead); }
  }
  if (style === 'Braids') for (const s of [-1, 1]) { for (let i = 0; i < 6; i++) tuft(s * (0.2 - i * 0.008), -0.08 - i * 0.05, -0.05 + i * 0.012, 0.042 - i * 0.002, 1, 1.1, 1); const tie = sph(0.022, M(0xff4fd8), 8, 6); tie.position.set(s * 0.15, -0.38, 0.02); hair.add(tie); }

  // beards and mustaches, in the hair colour
  if (L.beard) {
    const bM = M(dark(L.hairC, 0.92)), part = (rad, p0, pl, t0, tl, m = bM) => { const g = new THREE.Mesh(new THREE.SphereGeometry(rad, 28, 12, p0, pl, t0, tl), m); g.scale.set(1, SY, SZ + 0.02); head.add(g); return g; };
    const front = Math.PI / 2, mustache = (big) => { for (const s of [-1, 1]) { const m = cap(big ? 0.022 : 0.017, big ? 0.06 : 0.045, bM); m.position.set(s * 0.04, -0.088, zOn(s * 0.04, -0.088, 0.012)); m.rotation.set(0, 0, s * (Math.PI / 2 - 0.35)); head.add(m); } };
    if (L.beard === 1) { const st = part(R * 1.008, front - 1.25, 2.5, 2.08, 0.8, new THREE.MeshStandardMaterial({ color: L.hairC, transparent: true, opacity: 0.45, roughness: 1 })); st.renderOrder = 1; }
    if (L.beard === 2 || L.beard === 3) {
      part(R * 1.045, front - 1.35, 2.7, 2.14, 0.8); // round the jaw and chin, below the mouth
      for (const s of [-1, 1]) part(R * 1.03, front + s * 1.25 - 0.12, 0.24, 1.55, 0.62); // sideburns
      mustache(L.beard === 3);
      if (L.beard === 3) { // a big, full beard hanging down onto the chest
        const bulk = sph(0.16, bM, 20, 14); bulk.scale.set(1.05, 1.25, 0.72); bulk.position.set(0, -0.27, 0.1); head.add(bulk);
        for (let i = 0; i < 7; i++) { const a = (i / 6 - 0.5) * 1.8, t = sph(0.055, bM, 10, 8); t.position.set(Math.sin(a) * 0.13, -0.36 - Math.cos(a) * 0.04, 0.12 + Math.cos(a) * 0.04); head.add(t); }
      }
    }
    if (L.beard === 4) mustache(true);
  }

  // hat
  const hatM = M(L.hatC), H = 1.14;
  if (hat === 2) { // trucker cap: a white mesh front and a coloured bill
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.255 * H, 26, 12, 0, Math.PI * 2, 0, Math.PI / 2), hatM); dome.position.y = 0.06; dome.scale.y = 0.82; head.add(dome);
    const front = new THREE.Mesh(new THREE.SphereGeometry(0.258 * H, 20, 10, -Math.PI * 0.3, Math.PI * 0.6, 0.15, Math.PI / 2 - 0.15), M(0xffffff)); front.position.y = 0.06; front.scale.y = 0.83; head.add(front);
    const bill = new THREE.Mesh(new THREE.CylinderGeometry(0.17 * H, 0.17 * H, 0.025, 26, 1, false, -Math.PI / 2, Math.PI), hatM); bill.position.set(0, 0.085, 0.22 * H); bill.rotation.x = 0.12; head.add(bill);
    const btn = sph(0.025, M(dark(L.hatC, 0.75)), 10, 8); btn.position.y = 0.06 + 0.255 * H * 0.82; head.add(btn);
  } else if (hat === 3) { // beanie
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.262 * H, 26, 12, 0, Math.PI * 2, 0, Math.PI / 2), hatM); dome.position.y = 0.04; dome.scale.y = 1.02; head.add(dome);
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.252 * H, 0.045, 8, 30), M(dark(L.hatC, 0.82))); cuff.rotation.x = Math.PI / 2; cuff.position.y = 0.06; head.add(cuff);
    const pom = sph(0.075, M(0xffffff), 12, 10); pom.position.y = 0.36; head.add(pom);
  } else if (hat === 1) { // bucket hat: a floppy, sloping brim
    const crown = cyl(0.21 * H, 0.25 * H, 0.15, hatM, 26); crown.position.y = 0.18; head.add(crown);
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.21 * H, 26, 8, 0, Math.PI * 2, 0, Math.PI / 2), hatM); top.scale.y = 0.3; top.position.y = 0.255; head.add(top);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.25 * H, 0.37 * H, 0.08, 30, 1, true), plush({ color: L.hatC, roughness: 0.55, side: THREE.DoubleSide }, 0.16)); brim.position.y = 0.07; head.add(brim);
    const stitch = new THREE.Mesh(new THREE.TorusGeometry(0.3 * H, 0.006, 6, 40), M(dark(L.hatC, 0.7))); stitch.rotation.x = Math.PI / 2; stitch.position.y = 0.075; head.add(stitch);
  } else if (hat === 4 || hat === 7) { // cowboy hat (curled brim, dented crown) or the rangers' wide brim
    const cowboy = hat === 4;
    const crown = cyl(0.19 * H, 0.25 * H, cowboy ? 0.19 : 0.16, hatM, 26); crown.position.y = cowboy ? 0.17 : 0.15; crown.scale.z = cowboy ? 0.85 : 1; head.add(crown);
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.19 * H, 26, 8, 0, Math.PI * 2, 0, Math.PI / 2), hatM); top.scale.set(1, cowboy ? 0.22 : 0.35, cowboy ? 0.85 : 1); top.position.y = cowboy ? 0.265 : 0.23; head.add(top);
    if (cowboy) { const dent = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.3), M(dark(L.hatC, 0.8))); dent.position.y = 0.28; head.add(dent); }
    const brim = cyl(0.42 * H, 0.42 * H, 0.025, hatM, 34); brim.position.y = 0.08; brim.rotation.x = 0.06; if (cowboy) { brim.scale.set(0.95, 1, 0.8); for (const s of [-1, 1]) { const wing = cyl(0.16, 0.16, 0.024, hatM, 20); wing.scale.set(1, 1, 1.5); wing.position.set(s * 0.33 * H, 0.12, 0); wing.rotation.z = -s * 0.55; head.add(wing); } } head.add(brim);
    const band = cyl(0.252 * H, 0.252 * H, 0.04, M(cowboy ? 0x1f1f2e : dark(L.hatC, 0.62)), 26); band.position.y = 0.11; head.add(band);
  } else if (hat === 5) { // flower crown
    const vine = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.012, 6, 32), M(0x3fae2a)); vine.rotation.x = Math.PI / 2 - 0.35; vine.position.set(0, 0.13, -0.03); head.add(vine);
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, f = new THREE.Group(); f.position.set(Math.cos(a) * 0.255, 0.13 + Math.sin(a) * 0.255 * Math.sin(0.35), -0.03 + Math.sin(a) * 0.255 * Math.cos(0.35)); head.add(f);
      const pc = [L.hatC, 0xffffff, 0xffcf2e][i % 3]; for (let p = 0; p < 5; p++) { const pa = p / 5 * Math.PI * 2, petal = sph(0.024, M(pc), 8, 6); petal.position.set(Math.cos(pa) * 0.024, 0.01, Math.sin(pa) * 0.024); petal.scale.set(1, 0.5, 1); f.add(petal); }
      const mid = sph(0.016, M(0xffa400), 8, 6); mid.position.y = 0.018; f.add(mid); }
  } else if (hat === 6) { // bandana headband with a knot at the back
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.03, 8, 32), P(6, L.hatC)); band.rotation.x = Math.PI / 2 - 0.25; band.position.set(0, 0.1, -0.02); band.scale.set(1, 0.93, 1); head.add(band);
    const knot = sph(0.04, M(L.hatC), 10, 8); knot.position.set(0, 0.04, -0.265); head.add(knot);
    for (const s of [-1, 1]) { const tail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.012), M(L.hatC)); tail.position.set(s * 0.03, -0.03, -0.27); tail.rotation.z = s * 0.3; head.add(tail); }
  }
  // soft shadow
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), new THREE.MeshBasicMaterial({ map: blobTexture(), color: 0x0d0a26, transparent: true, opacity: 0.35, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.005; root.add(shadow);
  let phase = 0, t = Math.random() * 10, blink = 2 + Math.random() * 2;
  inkAll(root); // ink outlines on everything cel-shaded
  root.userData = {
    head, body, look: L,
    update(dt, speed = 0) {
      t += dt; const walk = Math.min(1, speed / 1.2);
      phase += dt * (4 + speed * 3.2) * (walk > 0.05 ? 1 : 0);
      const sw = Math.sin(phase) * 0.7 * walk;
      legs[0].rotation.x = sw; legs[1].rotation.x = -sw; arms[0].rotation.x = -sw * 0.9; arms[1].rotation.x = sw * 0.9;
      body.position.y = Math.abs(Math.cos(phase)) * 0.03 * walk + Math.sin(t * 2.2) * 0.006 * (1 - walk);
      body.rotation.z = Math.sin(phase) * 0.04 * walk;
      head.rotation.y = (1 - walk) * Math.sin(t * 0.5) * 0.25;
      blink -= dt; const closed = blink < 0 && blink > -0.12; if (blink < -0.12) blink = 2.5 + Math.random() * 3;
      for (const e of eyes) e.scale.y = closed ? 0.12 : 1;
      for (let i = 0; i < glow.length; i++) glow[i].color.setHSL((t * 0.25 + i * 0.3) % 1, 1, 0.6); // LED gloves and shades
    },
  };
  return root;
}

// ---------- rustling leaves on the map: something is hiding here ----------
// The leaves rustling where a Kiki hides (the distant Kikis on the map, often dozens at once). They move only as a
// whole tuft, so the seven leaves are one shape, shared by every rustle along with its material and shadow: two draws
// each instead of eight, and nothing new to make (or leak) as they come and go while you walk.
let rustleKit = null;
function rustleParts() {
  if (rustleKit) return rustleKit;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const tuftAt = detail => {
    const geos = [];
    for (let i = 0; i < 7; i++) {
      const g = leafGeometry(0.5, 0.8, 0x2f9e24, 0x9be36a, true, detail);
      m4.compose(new THREE.Vector3(), q.setFromEuler(e.set(-(0.95 + (i % 3) * 0.18), i / 7 * Math.PI * 2, 0, 'YXZ')), new THREE.Vector3().setScalar(0.8 + (i % 2) * 0.25));
      geos.push(g.applyMatrix4(m4));
    }
    const t = mergeGeometries(geos); geos.forEach(g => g.dispose()); t.userData.shared = true; return t;
  };
  return rustleKit = {
    tuft: tuftAt(1), tuftFar: tuftAt(0.45), // (far away a rustle is a few pixels: a quarter of the triangles looks the same)
    mat: plush({ color: 0xffffff, vertexColors: true, roughness: 0.3 }, 0.3),
    shadowGeo: Object.assign(new THREE.PlaneGeometry(2.4, 2.4), { userData: { shared: true } }), shadowMat: new THREE.MeshBasicMaterial({ map: blobTexture(), color: 0x0d0a26, transparent: true, opacity: 0.3, depthWrite: false }),
  };
}
export function makeRustle() {
  const K = rustleParts(), g = new THREE.Group(), tuft = new THREE.Mesh(K.tuft, K.mat); g.add(tuft);
  const shadow = new THREE.Mesh(K.shadowGeo, K.shadowMat); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; g.add(shadow);
  let t = Math.random() * 10, burst = 0;
  g.userData = {
    /** far: a simpler tuft (and its rustle needn't be smooth) */
    setFar(far) { tuft.geometry = far ? K.tuftFar : K.tuft; },
    update(dt) {
      t += dt; burst -= dt; if (burst < -1.6 - Math.random()) burst = 0.55;
      const k = burst > 0 ? Math.sin(burst * 40) * (burst / 0.55) : 0;
      tuft.rotation.set(k * 0.18, Math.sin(t * 0.7) * 0.2, k * 0.22); tuft.scale.set(1, 1 + Math.abs(k) * 0.08, 1);
    },
  };
  return g;
}

// ---------- eggs (Phase 2) ----------
export const EGG_COLORS = { 2: ['#5fd34b', '#2f8f2a'], 5: ['#ff9a2e', '#c25a00'], 10: ['#a24dff', '#5a1fb0'] };
const eggTex = new Map();
/** A Kiki egg about `height` tall: cream, with a big spiral and spots in its tier colour (2, 5 or 10 km). */
export function makeEgg(km, height = 1) {
  if (!eggTex.has(km)) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d'), [a, b] = EGG_COLORS[km], r = rng(km);
    const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#fffaf0'); gr.addColorStop(1, '#f2e6cc'); g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 26; i++) { g.fillStyle = i % 3 ? a : b; g.globalAlpha = 0.85; g.beginPath(); g.ellipse(r.next() * 512, 30 + r.next() * 200, 7 + r.next() * 12, 9 + r.next() * 14, 0, 0, 7); g.fill(); }
    g.globalAlpha = 1; g.lineCap = 'round';
    for (const [w, col] of [[22, b], [12, a]]) { spiralPath(g, 256, 140, 62, 1, 2.2); g.strokeStyle = col; g.lineWidth = w; g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; eggTex.set(km, t);
  }
  const pts = []; for (let i = 0; i <= 32; i++) { const a = i / 32 * Math.PI, y = -Math.cos(a); pts.push(new THREE.Vector2(Math.max(1e-4, Math.sin(a) * 0.72 * (1 - 0.2 * y)), y)); }
  const geo = cached('egg-shape', () => { const g = new THREE.LatheGeometry(pts, 40); g.rotateY(Math.PI); return g; });
  const root = new THREE.Group(), body = new THREE.Mesh(geo, plush({ map: eggTex.get(km) }, 0.3)); body.position.y = 1; root.add(body);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), new THREE.MeshBasicMaterial({ map: blobTexture(), color: 0x0d0a26, transparent: true, opacity: 0.35, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; root.add(shadow);
  root.scale.setScalar(height / 2); root.userData = { body, shadow, km };
  return root;
}

// ---------- bag items with their own looks (Phase 3 and 4) ----------
/** Gift box, Herb Salve (a jar of green balm), Super Salve (honey and moonflower), Revival Dew (a glowing drop), Portal Key. About 1 unit. */
export function makeItem(id) {
  const g = new THREE.Group(), M = (c, r = 0.45) => plush({ color: c, roughness: r }, 0.3);
  if (id === 'gift') {
    const box = new THREE.Mesh(new THREE.BoxGeometry(1, 0.8, 1, 2, 2, 2), M(0xff6fae)); g.add(box);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 1.1), M(0xff8fc0)); lid.position.y = 0.48; g.add(lid);
    for (const [sx, sz] of [[0.18, 1.12], [1.12, 0.18]]) { const r = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.86, sz), M(0xffd23f)); g.add(r); const r2 = new THREE.Mesh(new THREE.BoxGeometry(sx * 1.02, 0.24, sz * 1.02), M(0xffd23f)); r2.position.y = 0.48; g.add(r2); }
    for (const s2 of [-1, 1]) { const bow = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.07, 10, 20), M(0xffd23f)); bow.position.set(s2 * 0.18, 0.72, 0); bow.rotation.set(0, Math.PI / 2, s2 * 0.6); g.add(bow); }
  } else if (id === 'stitch' || id === 'superstitch') {
    const sup = id === 'superstitch', jar = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.38, 0.62, 28), new THREE.MeshStandardMaterial({ color: sup ? 0xffe6a0 : 0xd8f2ff, roughness: 0.15, transparent: true, opacity: 0.75 }));
    g.add(jar); const balm = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.34, 0.46, 28), M(sup ? 0xffb000 : 0x5fd34b, 0.6)); balm.position.y = -0.06; g.add(balm);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.16, 28), M(sup ? 0x8c4dff : 0x2f8f3a)); lid.position.y = 0.39; g.add(lid);
    const leaf = new THREE.Mesh(leafGeometry(0.6, 0.8, 0x2f9e24, 0x9be36a, true), M(0xffffff)); leaf.material.vertexColors = true; leaf.position.set(0, 0.48, -0.15); leaf.rotation.x = -0.5; leaf.scale.setScalar(0.5); g.add(leaf);
    if (sup) { const fl = new THREE.Mesh(new THREE.OctahedronGeometry(0.13), M(0xffffff)); fl.position.set(0.18, 0.6, 0.1); g.add(fl); }
  } else if (id === 'pillow') {
    const pts = []; for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI, y = -Math.cos(a); pts.push(new THREE.Vector2(Math.max(1e-4, Math.sin(a) * 0.45 * Math.pow((1 - y) / 2, 0.55)), y * 0.6)); }
    const drop = new THREE.Mesh(new THREE.LatheGeometry(pts, 28), new THREE.MeshStandardMaterial({ color: 0x8fdcff, roughness: 0.08, emissive: 0x2a6aff, emissiveIntensity: 0.35, transparent: true, opacity: 0.88 }));
    g.add(drop); const halo = glowShell(drop.geometry, 1.1, 1.8, 0x7fd0ff); halo.scale.setScalar(1.3); g.add(halo);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff })); shine.position.set(-0.12, -0.05, 0.3); g.add(shine);
  } else if (id === 'key') {
    const gold = M(0xffc928, 0.3), ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.1, 12, 32), gold); ring.position.y = 0.45; g.add(ring);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.9, 12), gold); shaft.position.y = -0.2; g.add(shaft);
    for (const [y, w] of [[-0.5, 0.26], [-0.32, 0.2]]) { const t = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, 0.1), gold); t.position.set(w / 2, y, 0); g.add(t); }
    const gem = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), M(0x8c4dff, 0.2)); gem.position.y = 0.45; g.add(gem);
  }
  return g;
}

// ---------- portraits for the menus (Kikis, items, your explorer), rendered once and cached ----------
let pr = null; const portraits = new Map();
function portraitRenderer() {
  if (pr) return pr;
  const canvas = document.createElement('canvas'), r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  r.outputColorSpace = THREE.SRGBColorSpace; r.setClearColor(0x000000, 0); premium(r);
  const scene = new THREE.Scene(); scene.add(new THREE.HemisphereLight(0xffffff, 0x9a8fd0, 1.2));
  const key = new THREE.DirectionalLight(0xfff2e0, 2.0); key.position.set(-1.2, 2, 2.4); scene.add(key); light(r, scene, 'day', 0.55);
  return pr = { r, scene, cam: new THREE.PerspectiveCamera(28, 1, 0.01, 50) };
}
/** Drops cached explorer portraits (after the 3D explorers load, so the next ones are drawn with them). */
export function forgetExplorerPortraits() { for (const k of [...portraits.keys()]) if (k.startsWith('explorer')) portraits.delete(k); }
/** A PNG data URL of a Kiki ('kiki:meadow'), an item ('item:moon') or the explorer ('explorer:' + encodeLook(look)). */
export function portrait(what, size = 256) {
  const key = what + '@' + size; if (portraits.has(key)) return portraits.get(key);
  const { r, scene, cam } = portraitRenderer(); r.setSize(size, size, false);
  const [kind, a, b] = what.split(':'); let obj;
  if (kind.startsWith('explorer') && !explorerReady(lookFrom(a, b))) preloadExplorer(lookFrom(a, b)).then(() => portraits.delete(key)).catch(() => {}); // drawn again in 3D next time
  if (kind === 'kiki') {
    obj = makeKiki(a, 1, b === 's'); obj.rotation.y = -0.35; obj.updateMatrixWorld(true);
    const sh = obj.userData.shadow; obj.remove(sh); const box = new THREE.Box3().setFromObject(obj); obj.add(sh);
    const h = Math.max(1.25, box.max.y - box.min.y, (box.max.x - box.min.x) * 0.95), cy = (box.max.y + box.min.y) / 2, d = h / 2 / Math.tan(14 * Math.PI / 180) * 1.12;
    cam.position.set(0, cy + d * 0.04, d); cam.lookAt(0, cy, 0);
  }
  else if (kind === 'egg') { obj = makeEgg(+a, 1); obj.rotation.y = -0.25; cam.position.set(0, 0.55, 2.6); cam.lookAt(0, 0.5, 0); }
  else if (kind === 'explorer') { obj = makeExplorer(lookFrom(a, b)); obj.userData.update(0, 0); obj.rotation.y = -0.3; if (obj.userData.is3D) { cam.position.set(0, 0.9, 0.92); cam.lookAt(0, 0.86, 0); } else { cam.position.set(0, 0.76, 1.62); cam.lookAt(0, 0.73, 0); } }
  else if (kind === 'explorer-full') { obj = makeExplorer(lookFrom(a, b)); obj.userData.update(0, 0); obj.rotation.y = -0.4; if (obj.userData.is3D) { cam.position.set(0, 0.6, 2.45); cam.lookAt(0, 0.52, 0); } else { cam.position.set(0, 0.62, 2.3); cam.lookAt(0, 0.53, 0); } }
  else if (['gift', 'stitch', 'superstitch', 'pillow', 'key'].includes(a)) { obj = makeItem(a); obj.rotation.set(0.35, -0.6, 0); cam.position.set(0, 0, 4.4); cam.lookAt(0, 0, 0); }
  else if (a === 'honey' || a === 'sunseed') { obj = makeTreat(a, 1); if (a === 'honey') obj.rotation.set(1.2, Math.PI - 0.7, 0); else obj.rotation.set(0.2, 0.5, -0.3); cam.position.set(0, 0, a === 'honey' ? 4.3 : 3.8); cam.lookAt(0, 0, 0); }
  else { obj = makeRuneStone(1, a); obj.rotation.set(-1.05, 0, 0.25); obj.userData.update(0, 0.25); cam.position.set(0, 0, 6.4); cam.lookAt(0, 0, 0); }
  scene.add(obj); r.render(scene, cam); const url = r.domElement.toDataURL('image/png'); scene.remove(obj);
  portraits.set(key, url); return url;
}
export { THREE };

/** Free an object's own shapes from the graphics chip when it leaves for good (shared shapes stay). */
export function dropShapes(root) { root.traverse(o => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); }); }
