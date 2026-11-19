// KIKI SAFARI art for the web, in three.js. Kiki is the claw game's makeMascot() (Big Plush), with the same tweaks as
// the Unity project's Core/Art: chubbier pear body, bigger grin, bolder mirrored spirals, a V-folded leaf fan, and the
// six variants' crowns, embroidery and glow. Plus the Rune Stone, the portal, Rune Circles and sparkles.
import * as THREE from '../vendor/three.module.min.js';
import { rng, hash, variant } from './core.js';

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
  const look = { crown: 'canon', leaf: 0x38a626, tip: 0x92e25c, body: 0xffc928, rainbow: false, gold: false, belly: null, stars: false, glow: false, scale: 1, ...((v && v.look) || {}) };
  if (!sparkle) return look;
  const out = { ...look, sparkle: true, body: shift(look.body, look.body === 0xffc928 ? 0.8 : 0.42, 0.1, 0.7) };
  for (const k of ['leaf', 'tip', 'c1', 'c2']) if (typeof out[k] === 'number' && out[k] > 16) out[k] = shift(out[k]);
  if (typeof look.c3 === 'number' && look.c3 > 16) out.c3 = shift(look.c3);
  if (out.glow) out.glow = shift(out.glow); if (out.belly) out.belly = [out.belly[0], shiftCss(out.belly[1], 0.42), shiftCss(out.belly[2], 0.42)];
  out.starColor = '#ffd23f';
  return out;
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
/** Tummy embroidery shapes (Phase 2), centred at (x, y), about 2R across. */
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
  for (let i = 0; i < 3000; i++) { g.fillStyle = r.next() < 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(120,60,0,.04)'; g.fillRect(r.next() * 1024, r.next() * 512, 2, 2); }
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (look.stars) {
    g.strokeStyle = look.starColor || '#c77dff';
    for (const sx of [256, 768]) for (let y = 26; y < 492; y += 34) for (const side of [-1, 1]) {
      const x = sx + side * 16, s = 6.5;
      g.lineWidth = 2.6; g.beginPath(); g.moveTo(x - s, y); g.lineTo(x + s, y); g.moveTo(x, y - s); g.lineTo(x, y + s); g.stroke();
      g.lineWidth = 1.8; g.beginPath(); g.moveTo(x - s * .55, y - s * .55); g.lineTo(x + s * .55, y + s * .55); g.moveTo(x - s * .55, y + s * .55); g.lineTo(x + s * .55, y - s * .55); g.stroke();
    }
  }
  if (look.belly) {
    const [shape, dark, light] = look.belly;
    if (bellyPath(g, shape) === 'stroke') { g.strokeStyle = dark; g.lineWidth = 10; g.stroke(); bellyPath(g, shape); g.strokeStyle = light; g.lineWidth = 5.5; g.stroke(); }
    else { g.fillStyle = light; g.fill(); g.strokeStyle = dark; g.lineWidth = 7; g.stroke(); g.setLineDash([7, 6]); g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 2; bellyPath(g, shape, 512, 366, 40); g.stroke(); g.setLineDash([]); }
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
/** Plush normal map: fabric grain, seams (groove + raised stitches), domed eye discs, raised piping, carved mouth. Only depends on the tummy shape. */
function normalMap(belly) {
  if (normCache.has(belly)) return normCache.get(belly);
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
  if (belly) for (const [w, a] of [[12, .2], [7, .3]]) { const kind = bellyPath(h, belly); if (kind === 'fill') { h.fillStyle = 'rgba(255,255,255,.08)'; h.fill(); } h.strokeStyle = `rgba(255,255,255,${a})`; h.lineWidth = w; h.stroke(); }
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
const CROWNS = {
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
  acorn(look, R, Y) {
    const cap = new THREE.SphereGeometry(0.72, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5); cap.scale(1, 0.62, 1);
    paint(cap, (x, y, z) => { const a = Math.atan2(z, x), k = (Math.sin(a * 14) * Math.sin(y * 40)) > 0 ? 0.82 : 1; return C(look.c1).multiplyScalar(k); });
    return [at(cap, 0, Y + 0.02, 0), at(cyl(0.05, 0.07, 0.22, look.c1, 8), 0.04, Y + 0.52, 0, 0, 0, 1), at(sphere(0.05, look.c2, 8, 6), 0.06, Y + 0.64, 0)];
  },
  oak(look, R, Y) {
    const parts = [at(cyl(0.11, 0.15, 0.4, look.c1, 10), 0, Y + 0.12, 0)];
    const blobs = [[0, 0.62, 0, 0.36], [0.3, 0.48, 0.1, 0.28], [-0.3, 0.5, 0.05, 0.28], [0.1, 0.5, 0.3, 0.27], [-0.08, 0.5, -0.3, 0.28], [0.2, 0.72, -0.12, 0.24], [-0.22, 0.74, 0.14, 0.24]];
    for (const [x, y, z, r] of blobs) parts.push(at(vgrad(new THREE.SphereGeometry(r, 16, 12), look.leaf, look.tip, -r, r), x, Y + y, z));
    for (const s of [-1, 1]) { const g = sphere(0.07, 0xc98a3c, 10, 8); parts.push(at(g, s * 0.36, Y + 0.3, 0.12, 0, 0, 1, 1.3, 1)); parts.push(at(sphere(0.06, look.c1, 10, 6), s * 0.36, Y + 0.38, 0.12, 0, 0, 1, 0.6, 1)); }
    return parts;
  },
  evergreen(look, R, Y) {
    const parts = [at(cyl(0.1, 0.14, 0.3, 0x6b4426, 10), 0, Y + 0.1, 0)];
    [[0.62, 0.55, 0.32], [0.5, 0.5, 0.62], [0.38, 0.45, 0.9], [0.24, 0.4, 1.16]].forEach(([r, h, y]) => parts.push(at(vgrad(new THREE.ConeGeometry(r, h, 12), look.tip, look.leaf, -h / 2, -h / 2 + 0.12), 0, Y + y, 0)));
    parts.push(at(starGeo(0.1, 0xffe14a), 0, Y + 1.36, 0));
    return parts;
  },
  wave(look, R, Y) {
    const n = look.c3 || 1, parts = [];
    for (let k = 0; k < n; k++) {
      const sc = n > 1 ? (k === 0 ? 1.05 : 0.8) : 0.95, yaw = n > 1 ? (k - (n - 1) / 2) * 1.1 : 0, pts = [];
      for (let i = 0; i <= 24; i++) { const t = i / 24, th = -Math.PI * 0.5 + t * Math.PI * 1.7, r = 0.42 * (1 - 0.62 * t); pts.push(V3(0, 0.42 + Math.sin(th) * r + (1 - t) * 0.0, -Math.cos(th) * r + 0.05)); }
      pts[0] = V3(0, -0.05, 0.05);
      const g = taperTube(pts, 0.27, 0.05, t => C(look.c1).lerp(C(0x9fe0ff), t * 0.8).lerp(C(look.c2), smooth(0.8, 1, t)));
      parts.push([g, M4(0, Y, 0, 0, yaw, sc, sc, sc)]);
    }
    return parts;
  },
  tide(look, R, Y) {
    const parts = CROWNS.wave({ ...look, c3: 3 }, R, Y).map(([g, m]) => [g, m.premultiply(new THREE.Matrix4().makeScale(1.25, 1.25, 1.25)).premultiply(new THREE.Matrix4().makeTranslation(0, -Y * 0.25, 0))]);
    for (let i = 0; i < 9; i++) { const a = R(0, Math.PI * 2), r = R(0.35, 0.6); parts.push(at(sphere(R(0.04, 0.07), i % 2 ? look.c2 : 0x9fe0ff, 8, 6), Math.cos(a) * r, Y + R(0.6, 1.05), Math.sin(a) * r)); }
    return parts;
  },
  lily(look, R, Y) {
    const pad = new THREE.CylinderGeometry(0.66, 0.66, 0.05, 36, 1, false, 0.3, Math.PI * 2 - 0.6);
    paint(pad, (x, y, z) => C(look.c1).lerp(C(0xa6ec72), Math.min(1, Math.hypot(x, z) / 0.66) * 0.5));
    const parts = [at(pad, 0, Y + 0.08, 0.05, 0.3, 0.2)];
    for (let i = 0; i < 7; i++) parts.push([leafGeometry(0.75, 0.9, look.c2, 0xffffff, true), M4(0.2, Y + 0.2, 0.22, -0.9, i / 7 * Math.PI * 2, 0.42, 0.42, 0.42)]);
    parts.push(at(sphere(0.09, 0xffd23f), 0.2, Y + 0.27, 0.22));
    return parts;
  },
  lotus(look, R, Y) {
    const pad = new THREE.CylinderGeometry(0.72, 0.72, 0.05, 36, 1, false, 0.3, Math.PI * 2 - 0.6);
    paint(pad, (x, y, z) => C(0x3fae2a).lerp(C(0xa6ec72), Math.min(1, Math.hypot(x, z) / 0.72) * 0.5));
    const parts = [at(pad, 0, Y + 0.02, 0)];
    for (let i = 0; i < 9; i++) parts.push([leafGeometry(0.75, 0.9, look.c1, look.c2, true), M4(0, Y + 0.06, 0, -0.75, i / 9 * Math.PI * 2, 0.62, 0.62, 0.62)]);
    for (let i = 0; i < 6; i++) parts.push([leafGeometry(0.7, 0.9, look.c1, look.c2, true), M4(0, Y + 0.1, 0, -1.15, i / 6 * Math.PI * 2 + 0.3, 0.52, 0.52, 0.52)]);
    parts.push(at(sphere(0.12, look.c3), 0, Y + 0.22, 0, 0, 0, 1, 0.6, 1));
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
  toast(look, R, Y) {
    const cap = new THREE.SphereGeometry(0.72, 32, 14, 0, Math.PI * 2, 0, Math.PI * 0.36); cap.scale(1, 0.7, 1);
    paint(cap, (x, y, z) => C(look.c1).lerp(C(0x7a4a1a), Math.max(0, noise3(x * 3, y * 3, z * 3)) * 0.7).lerp(C(0xffd9a0), smooth(0.5, 0.66, Math.hypot(x, z)) * 0.8));
    return [at(cap, 0, Y - 0.1, 0), [cyl(0.03, 0.03, 0.9, look.c2, 6), M4(0.08, Y + 0.4, -0.05, 0.2, 0, 1, 1, 1).multiply(new THREE.Matrix4().makeRotationZ(-0.35))]];
  },
  campfire(look, R, Y) {
    const parts = CROWNS.flame({ ...look, c3: 3 }, R, Y + 0.1);
    for (let i = 0; i < 2; i++) parts.push([paint(new THREE.CylinderGeometry(0.08, 0.08, 0.8, 8), (x, y) => C(look.c3).multiplyScalar(Math.abs(y) > 0.36 ? 1.45 : 1)), M4(0, Y + 0.06, 0, 0, Math.PI / 4 + i * Math.PI / 2, 1, 1, 1).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2))]);
    return parts;
  },
  sun(look, R, Y) {
    const parts = [at(paint(new THREE.SphereGeometry(0.3, 20, 14), (x, y) => C(look.c1).lerp(C(0xfff6c8), smooth(0, 0.3, y) * 0.5)), 0, Y + 0.22, 0, 0, 0, 1, 0.55, 1)];
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, h = i % 2 ? 0.34 : 0.48; parts.push([vgrad(new THREE.ConeGeometry(0.09, h, 6), i % 2 ? look.c2 : look.c1, 0xfff27a, -h / 2, h / 2), M4(Math.cos(a) * (0.36 + h / 2 * 0.6), Y + 0.32 + h * 0.4, Math.sin(a) * (0.36 + h / 2 * 0.6), 0, 0, 1, 1, 1).multiply(new THREE.Matrix4().makeRotationAxis(V3(Math.sin(a), 0, -Math.cos(a)), -0.95))]); }
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
  puff(look, R, Y) {
    const big = (look.c3 || 1) > 1, n = big ? 26 : 15, parts = [];
    for (let i = 0; i < n; i++) { const u = (i + 0.5) / n, phi = Math.acos(1 - u * 1.1), th = i * 2.39996, rr = big ? 0.62 : 0.48, r = R(0.15, 0.22) * (big ? 1.15 : 1); parts.push(at(vgrad(new THREE.SphereGeometry(r, 12, 10), look.c1, look.c2, -r, r), Math.sin(phi) * Math.cos(th) * rr, Y + 0.1 + Math.cos(phi) * rr * 0.8, Math.sin(phi) * Math.sin(th) * rr)); }
    if (big) for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4; parts.push([boltGeo(0.26, 0xffd000, 0xffffff), M4(Math.cos(a) * 0.62, Y + 0.55, Math.sin(a) * 0.62, 0, -a + Math.PI / 2, 1, 1, 1).multiply(new THREE.Matrix4().makeRotationZ(0.5))]); }
    return parts;
  },
  aurora(look, R, Y) {
    const parts = [];
    for (let k = 0; k < 5; k++) {
      const g = new THREE.PlaneGeometry(1.1, 1.0, 20, 8), p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i) + 0.45; p.setXYZ(i, x * (0.6 + y * 0.5), y, Math.sin(x * 5 + k * 2 + y * 2) * 0.12); }
      g.computeVertexNormals(); paint(g, (x, y) => C(look.c1).lerp(C(look.c2), smooth(0.1, 0.9, y)).lerp(C(0xffffff), smooth(0.85, 0.95, y) * 0.4));
      parts.push([g, M4(0, Y - 0.02, 0, 0, k / 5 * Math.PI, 1, 1, 1)]);
    }
    return parts;
  },
  pebbles(look, R, Y) { return [at(rock(0.3, 2, look.c1, look.c2, 1), 0, Y + 0.08, 0, 0, 0.3, 1.3, 0.55, 1.1), at(rock(0.22, 2, look.c2, look.c1, 2), 0.04, Y + 0.3, 0.02, 0, 1.1, 1.25, 0.6, 1.05), at(rock(0.14, 2, look.c1, look.c2, 3), -0.02, Y + 0.46, 0, 0, 2, 1.2, 0.65, 1)]; },
  boulder(look, R, Y) {
    const g = rock(0.5, 2, look.c1, 0xb3ada2, 4), p = g.attributes.position, col = g.attributes.color, moss = C(look.c2);
    for (let i = 0; i < p.count; i++) if (p.getY(i) > 0.22 + 0.08 * noise3(p.getX(i) * 4, 0, p.getZ(i) * 4)) col.setXYZ(i, moss.r, moss.g, moss.b);
    return [at(g, 0, Y + 0.12, 0, 0, 0, 1.2, 0.8, 1.1), [leafGeometry(0.6, 0.7, 0x3fae2a, 0x9be36a, true), M4(0.1, Y + 0.45, 0, -0.9, 0.4, 0.35, 0.35, 0.35)], [leafGeometry(0.6, 0.7, 0x3fae2a, 0x9be36a, true), M4(0.1, Y + 0.45, 0, -0.9, 3.4, 0.3, 0.3, 0.3)]];
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
  geode(look, R, Y) {
    const shell = new THREE.SphereGeometry(0.5, 24, 16, 0, Math.PI); shell.rotateY(Math.PI / 2); shell.rotateX(-Math.PI / 2 * 0); 
    paint(shell, (x, y, z) => C(look.c1).multiplyScalar(0.85 + 0.25 * noise3(x * 5, y * 5, z * 5)));
    const face = new THREE.CircleGeometry(0.5, 32); paint(face, (x, y) => C(0x3a1f6b).lerp(C(look.c2), smooth(0.48, 0.2, Math.hypot(x, y))));
    const parts = [at(shell, 0, Y + 0.32, -0.08, 0, Math.PI, 1, 1, 0.8), at(face, 0, Y + 0.32, -0.08)];
    for (let i = 0; i < 16; i++) { const a = i * 2.4, r = 0.36 * Math.sqrt((i + 0.5) / 16), h = R(0.1, 0.18); parts.push([vgrad(new THREE.ConeGeometry(0.045, h, 5), look.c2, 0xf0e0ff, -h / 2, h / 2).toNonIndexed(), M4(Math.cos(a) * r, Y + 0.32 + Math.sin(a) * r, -0.08 + h / 2, Math.PI / 2, 0, 1, 1, 1)]); }
    return parts;
  },
  mountain(look, R, Y) {
    const parts = [];
    [[0, 0.95, 0.42, 0], [0.32, 0.65, 0.3, 0.15], [-0.34, 0.7, 0.32, -0.1]].forEach(([x, h, r, z], i) => { const g = new THREE.ConeGeometry(r, h, 5); paint(g, (px, y, pz) => C(look.c1).multiplyScalar(0.85 + 0.2 * noise3(px * 6, y * 6, pz * 6)).lerp(C(look.c2), smooth(h * 0.12, h * 0.2, y))); parts.push([g.toNonIndexed(), M4(x, Y + h / 2 - 0.05, z, 0, i * 0.7, 1, 1, 1)]); });
    for (const [g] of parts) g.computeVertexNormals();
    return parts;
  },
  crescent(look, R, Y) { return [at(crescentGeo(0.4, 0.15, look.c1), 0.02, Y + 0.48, 0, 0, 0.2), at(starGeo(0.09, look.c1, 0xffffff), -0.32, Y + 0.18, 0.12, 0, 0.3)]; },
  starry(look, R, Y) {
    const parts = CROWNS.crescent(look, R, Y);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; parts.push(at(starGeo(0.07, look.c2, 0xffffff), Math.cos(a) * 0.62, Y + 0.2 + (i % 2) * 0.14, Math.sin(a) * 0.62, 0, -a + Math.PI / 2)); }
    return parts;
  },
  mushroom(look, R, Y) {
    const k = look.c3 || 1, cap = new THREE.SphereGeometry(0.58 * k, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5); cap.scale(1, 0.62, 1);
    paint(cap, (x, y, z) => { const n = V3(x, y / 0.62, z).normalize(), spot = Math.sin(n.x * 9 + 1) * Math.sin(n.z * 9 + 2) * Math.sin(n.y * 7) > 0.32; return spot ? C(look.c2) : C(look.c1).lerp(C(0xffffff), smooth(0.2, 0.6, y) * 0.1); });
    const under = new THREE.CircleGeometry(0.56 * k, 32); under.rotateX(Math.PI / 2); solid(under, 0xf2e6d0);
    return [at(cyl(0.16, 0.2, 0.32, 0xf6efe0, 14), 0, Y + 0.1, 0), at(cap, 0, Y + 0.24, 0), at(under, 0, Y + 0.245, 0)];
  },
  ears(look, R, Y) {
    const k = (look.c3 || 1) * 1.25, parts = [];
    for (const s of [-1, 1]) for (let j = 0; j < 3; j++) parts.push([leafGeometry(0.45, 0.8, look.c1, look.c2, true), M4(s * (0.3 + j * 0.05), Y + 0.02, -0.05 + j * 0.06, -(1.15 - j * 0.15), s * (0.55 + j * 0.25) - 0.0, 0.62 * k * (1 - j * 0.18), 0.62 * k * (1 - j * 0.18), 0.62 * k * (1 - j * 0.18))]);
    if (k > 1) for (let i = 0; i < 5; i++) parts.push([leafGeometry(0.4, 0.8, look.c1, look.c2, true), M4(0, Y, -0.1, -(0.75 + Math.abs(i - 2) * 0.05), Math.PI + (i - 2) * 0.35, 0.7, 0.7, 0.7)]);
    return parts;
  },
};
const CROWN_SCALE = { acorn: 1.25, toast: 1.2, icicle: 1.25, lotus: 1.3, lily: 1.45, evergreen: 1.2, oak: 1.3, tide: 1.2, sun: 1.3, mushroom: 1.4, geode: 1.3, castle: 1.35, mountain: 1.3 };
function crownGeometry(id, look, key = id) {
  return cached('crown:' + key, () => {
    const r = rng(hash(id)), R = (a, b) => a + r.next() * (b - a), baseY = EGG_H * 0.88;
    const fan = FANS[look.crown];
    let parts = fan ? fanParts(look, R, fan, baseY) : (CROWNS[look.crown] || CROWNS.seedling)(look, R, baseY);
    const k = fan || look.crown === 'seedling' || look.crown === 'bloom' ? 1 : (CROWN_SCALE[look.crown] || 1.35);
    if (k !== 1) { const m = new THREE.Matrix4().makeTranslation(0, baseY, 0).multiply(new THREE.Matrix4().makeScale(k, k, k)).multiply(new THREE.Matrix4().makeTranslation(0, -baseY, 0)); parts = parts.map(([g, mm]) => [g, m.clone().multiply(mm)]); }
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
  for (const [x, y, rz] of [[-0.9, 0.0, 0.62], [0.9, -0.05, -2.15]]) {
    const pivot = new THREE.Object3D(); pivot.position.set(x, y, 0.05); pivot.rotation.z = rz; pivot.userData.rest = rz;
    pivot.add(new THREE.Mesh(armGeometry(), m.limb)); model.add(pivot); arms.push(pivot);
  }
  model.add(new THREE.Mesh(crownGeometry(id, look, key), m.leaf));
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
  if (kind === 'kiki') {
    obj = makeKiki(a, 1, b === 's'); obj.rotation.y = -0.35; obj.updateMatrixWorld(true);
    const sh = obj.userData.shadow; obj.remove(sh); const box = new THREE.Box3().setFromObject(obj); obj.add(sh);
    const h = Math.max(1.25, box.max.y - box.min.y, (box.max.x - box.min.x) * 0.95), cy = (box.max.y + box.min.y) / 2, d = h / 2 / Math.tan(14 * Math.PI / 180) * 1.12;
    cam.position.set(0, cy + d * 0.04, d); cam.lookAt(0, cy, 0);
  }
  else if (kind === 'egg') { obj = makeEgg(+a, 1); obj.rotation.y = -0.25; cam.position.set(0, 0.55, 2.6); cam.lookAt(0, 0.5, 0); }
  else if (kind === 'explorer') { obj = makeExplorer(+a, +b); obj.userData.update(0, 0); obj.rotation.y = -0.3; cam.position.set(0, 0.78, 1.35); cam.lookAt(0, 0.74, 0); }
  else if (kind === 'explorer-full') { obj = makeExplorer(+a, +b); obj.userData.update(0, 0); obj.rotation.y = -0.4; cam.position.set(0, 0.62, 2.6); cam.lookAt(0, 0.5, 0); }
  else if (a === 'honey' || a === 'sunseed') { obj = makeTreat(a, 1); if (a === 'honey') obj.rotation.set(1.2, Math.PI - 0.7, 0); else obj.rotation.set(0.2, 0.5, -0.3); cam.position.set(0, 0, a === 'honey' ? 4.3 : 3.8); cam.lookAt(0, 0, 0); }
  else { obj = makeRuneStone(1, a); obj.rotation.set(-1.05, 0, 0.25); obj.userData.update(0, 0.25); cam.position.set(0, 0, 6.4); cam.lookAt(0, 0, 0); }
  scene.add(obj); r.render(scene, cam); const url = r.domElement.toDataURL('image/png'); scene.remove(obj);
  portraits.set(key, url); return url;
}
export { THREE };
