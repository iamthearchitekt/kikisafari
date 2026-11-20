// The explorer (your avatar), as a real 3D anime character. Owner, round 1: "pro anime 3D characters", "make them
// believable", "don't overdo stereotypes". Round 2: "the avatars aren't customizable enough. The bald option looks
// especially bad. Basic wear like short sleeve and long sleeve t-shirt, jeans, shorts, skirt. Male and female, basic
// sunglass options, nothing too wild."
//
// Ten generated, rigged and animated bodies: male and female, each in a short- or long-sleeve tee with jeans or shorts
// (and a skirt for the female body), all with white trainers. They were made bald so every hairstyle is a separate
// piece and bald is simply the real head. Their textures were painted with key colours (bright green tops, royal
// blue bottoms) so a shader can repaint them any colour while keeping every painted fold and shadow; skin is
// repainted the same way. Hairstyles are generated pieces on the head bone, tinted from a grey texture; a buzz cut and
// beards are painted on; hats and sunglasses are built in code. Everything is cel-shaded with ink outlines.
import * as THREE from '../vendor/three.module.min.js';
import { GLTFLoader } from '../vendor/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from '../vendor/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from '../vendor/addons/utils/SkeletonUtils.js';

export const SEXES = ['Male', 'Female'];
export const SHIRTS = ['Short sleeve', 'Long sleeve'];
export const LEGWEAR = ['Jeans', 'Shorts', 'Skirt']; // the skirt is on the female body
export const HAIRDOS = ['Bald', 'Buzz cut', 'Short', 'Spiky', 'Undercut', 'Bob', 'Long', 'Ponytail', 'Space buns', 'Curly', 'Locs'];
const HAIR_FILE = [null, null, 'short', 'spiky', 'undercut', 'bob', 'long', 'pony', 'buns', 'curly', 'locs'];
export const SHADES = ['No shades', 'Aviators', 'Classic', 'Round', 'Sport', 'Cat-eye'];
export const FRAMES = [0x1d1d22, 0x6b3f22, 0xc9a24a, 0xb9bdc6, 0xf4f1ea, 0xb8322a, 0x2b3a8f];
export const LENSES = [0x23272e, 0x4a3020, 0x2c4632, 0x2763c9, 0xc9577f, 0xd59a2a];
/** Which body file a look uses: m/f, st/lt (short or long sleeves), j/s/k (jeans, shorts, skirt). */
export const bodyKey = L => `${L.sex ? 'f' : 'm'}-${L.shirt ? 'lt' : 'st'}-${'jsk'[L.sex ? L.legs % 3 : Math.min(L.legs % 3, 1)]}`;
const ALL_BODIES = ['m-st-j', 'm-st-s', 'm-lt-j', 'm-lt-s', 'f-st-j', 'f-st-s', 'f-st-k', 'f-lt-j', 'f-lt-s', 'f-lt-k'];

// ---------- loading: each body and hairstyle on demand (yours first, the rest when they are needed) ----------
const BASE = 'assets/explorers/', bodies = {}, hairs = [], pending = new Map();
let loader = null;
function fetchPart(kind, id) {
  const key = kind + id; if (pending.has(key)) return pending.get(key);
  loader ||= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const file = kind === 'body' ? `body-${id}.glb` : `hair-${HAIR_FILE[id]}.glb`;
  const p = loader.loadAsync(BASE + file).then(g => { if (kind === 'body') bodies[id] = prepBody(g); else hairs[id] = prepHair(g); });
  p.catch(() => pending.delete(key)); pending.set(key, p); return p;
}
/** Loads what one look needs (its body and hairstyle). */
export function preloadExplorer(L) { return Promise.all([fetchPart('body', bodyKey(L)), HAIR_FILE[L.hairdo] ? fetchPart('hair', L.hairdo) : null]); }
/** Loads every hairstyle and the bodies for one sex (or all), for the look picker. */
export function loadExplorerKit(sex) { return Promise.all([...ALL_BODIES.filter(k => sex == null || k[0] === 'mf'[sex]).map(k => fetchPart('body', k)), ...HAIR_FILE.map((h, i) => h ? fetchPart('hair', i) : null)]); }
/** True when makeExplorer3D(L) can build this look right now. */
export const explorerReady = L => !!bodies[bodyKey(L)] && (!HAIR_FILE[L.hairdo] || !!hairs[L.hairdo]);

// ---------- cel shading and ink ----------
const TOON = (() => { const t = new THREE.DataTexture(new Uint8Array([150, 205, 255]), 3, 1, THREE.RedFormat); t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return t; })();
const INK = 0x24182f;
/** Smooth normals for the ink shell (the mesh's own normals split at every UV seam, which would crack the outline). */
function addInkNormals(geo) {
  if (geo.attributes.inkNormal) return;
  const p = geo.attributes.position, n = geo.attributes.normal, map = new Map(), key = i => `${Math.round(p.getX(i) * 2e3)},${Math.round(p.getY(i) * 2e3)},${Math.round(p.getZ(i) * 2e3)}`;
  const acc = [];
  for (let i = 0; i < p.count; i++) { const k = key(i); let a = map.get(k); if (!a) map.set(k, a = [0, 0, 0]); a[0] += n.getX(i); a[1] += n.getY(i); a[2] += n.getZ(i); acc.push(a); }
  const out = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const a = acc[i], l = Math.hypot(a[0], a[1], a[2]) || 1; out[i * 3] = a[0] / l; out[i * 3 + 1] = a[1] / l; out[i * 3 + 2] = a[2] / l; }
  geo.setAttribute('inkNormal', new THREE.BufferAttribute(out, 3));
}
/** The ink outline: back faces pushed out along the smooth normals by a fixed share of the screen height. */
const inkMats = new Map();
function inkMaterial(px = 0.0055) {
  if (inkMats.has(px)) return inkMats.get(px);
  const m = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
  m.onBeforeCompile = sh => {
    sh.vertexShader = 'attribute vec3 inkNormal;\n' + sh.vertexShader.replace('#include <project_vertex>', `
      #ifdef USE_SKINNING
        vec3 inkN = (skinMatrix * vec4(inkNormal, 0.0)).xyz;
      #else
        vec3 inkN = inkNormal;
      #endif
      vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      vec2 sn = (projectionMatrix * vec4(normalize(normalMatrix * inkN), 0.0)).xy;
      gl_Position.xy += (length(sn) > 1e-5 ? normalize(sn) : vec2(0.0)) * ${px.toFixed(5)} * gl_Position.w;`);
  };
  m.customProgramCacheKey = () => 'ink3d' + px; inkMats.set(px, m); return m;
}
function inkFor(mesh, px) {
  addInkNormals(mesh.geometry);
  const ink = mesh.isSkinnedMesh ? new THREE.SkinnedMesh(mesh.geometry, inkMaterial(px)) : new THREE.Mesh(mesh.geometry, inkMaterial(px));
  if (mesh.isSkinnedMesh) { ink.bind(mesh.skeleton, mesh.bindMatrix); ink.frustumCulled = false; }
  ink.position.copy(mesh.position); ink.quaternion.copy(mesh.quaternion); ink.scale.copy(mesh.scale);
  ink.renderOrder = -1; ink.userData.ink = true; mesh.parent.add(ink); return ink;
}
const toon = opts => new THREE.MeshToonMaterial({ gradientMap: TOON, ...opts });
/** Hides whatever of a hair piece is above uCut (head space): the part inside a hat. */
function cutAbove(m, U) {
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => { if (prev) prev(sh, r); Object.assign(sh.uniforms, U);
    sh.vertexShader = 'uniform mat4 uToHead; varying float vHeadY;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvHeadY = (uToHead * vec4(position, 1.0)).y;');
    sh.fragmentShader = 'uniform float uCut; varying float vHeadY;\n' + sh.fragmentShader.replace('void main() {', 'void main() {\n  if (vHeadY > uCut) discard;'); };
  const key = m.customProgramCacheKey(); m.customProgramCacheKey = () => key + '-cut';
}

// ---------- body prep (once per outfit) ----------
function prepBody(g) {
  let mesh = null; g.scene.traverse(o => { if (o.isSkinnedMesh) mesh = o; });
  g.scene.updateMatrixWorld(true);
  // Find the head from the skin weights: the box of every vertex the Head bone mostly carries, both in the mesh's own
  // (quantized) vertex space, for the repaint shader, and in the head bone's space, where hair, hats and shades go.
  const headBone = mesh.skeleton.bones.find(b => b.name === 'Head'), hj = mesh.skeleton.bones.indexOf(headBone);
  const P = mesh.geometry.attributes.position, SI = mesh.geometry.attributes.skinIndex, SW = mesh.geometry.attributes.skinWeight;
  const attr = new THREE.Box3(), bone = new THREE.Box3(), v = new THREE.Vector3(), inv = headBone.matrixWorld.clone().invert();
  // some rigs give the head bone a turned rest pose: hair, hats and shades use an upright frame at the head instead
  const R = headBone.getWorldQuaternion(new THREE.Quaternion());
  let yMin = Infinity, yMax = -Infinity; const pts = [];
  for (let i = 0; i < P.count; i++) {
    const y = P.getY(i); if (y < yMin) yMin = y; if (y > yMax) yMax = y;
    let dom = -1, best = -1; for (let k = 0; k < 4; k++) { const w = SW.getComponent(i, k); if (w > best) { best = w; dom = SI.getComponent(i, k); } }
    if (dom !== hj) continue;
    v.fromBufferAttribute(P, i); attr.expandByPoint(v);
    mesh.applyBoneTransform(i, v); v.applyMatrix4(mesh.matrixWorld).applyMatrix4(inv).applyQuaternion(R); bone.expandByPoint(v);
    if (i % 3 === 0) pts.push(v.x, v.y, v.z);
  }
  const whole = new THREE.Box3().setFromObject(g.scene, true);
  addInkNormals(mesh.geometry);
  const clips = Object.fromEntries(g.animations.map(a => [a.name, a]));
  const parentWorld = {}; for (const b of mesh.skeleton.bones) parentWorld[b.name] = b.parent.getWorldQuaternion(new THREE.Quaternion());
  const boneToAttrY = y => attr.min.y + (y - bone.min.y) * (attr.max.y - attr.min.y) / (bone.max.y - bone.min.y);
  return { gltf: g, mesh, parentWorld, headPts: new Float32Array(pts), boneToAttrY, headBox: bone, headUpright: R.clone().invert(), attrHead: attr, attrY: [yMin, yMax], height: whole.max.y - whole.min.y, floor: whole.min.y, clips };
}
function prepHair(g) {
  const meshes = []; g.scene.traverse(o => { if (o.isMesh) { meshes.push(o); addInkNormals(o.geometry); } });
  const m = g.scene.userData.mannequin || g.userData?.mannequin;
  return { gltf: g, meshes, box: m ? new THREE.Box3(new THREE.Vector3(...m.min), new THREE.Vector3(...m.max)) : new THREE.Box3().setFromObject(g.scene) };
}

// ---------- facial hair: where it grows (beard coordinates: head coordinates stretched by BEARD_K) ----------
// 1 stubble (painted only), 2 short beard, 3 full beard, 4 mustache, 5 goatee. The same shape is painted on the skin and
// grown as a 3D shell from the face itself (beardShell), so it always sits on the jaw, whatever the head.
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function beardW(x, y, z, style) {
  const ax = Math.abs(x), front = ss(-0.15, 0.1, z), onHead = 1 - ss(1.0, 1.08, ax);
  // the beard's upper edge: under the mouth in the middle, up the cheeks, then up the sideburns to the ears
  const top = -0.6 + 0.24 * ss(0.2, 0.62, ax) + 0.42 * ss(0.6, 0.86, ax);
  const ear = ss(0.86, 0.93, ax) * ss(-0.5, -0.38, y); // in front of the ears, not on them
  const jaw = (1 - ss(top - 0.04, top + 0.03, y)) * ss(-0.95, -0.82, y) * ss(-0.22, -0.04, z) * (1 - ear) * onHead;
  const side = 0;
  const lip = (1 - ss(0.15, 0.24, ax)) * ss(-0.64, -0.6, y) * (1 - ss(-0.53, -0.49, y)) * (z > 0.45 ? 1 : 0);
  const mus = (1 - ss(0.26, 0.38, ax)) * ss(-0.575 - 0.05 * ax, -0.55 - 0.05 * ax, y) * (1 - ss(-0.47 - 0.03 * ax, -0.44 - 0.03 * ax, y)) * (z > 0.45 ? 1 : 0);
  const chin = (1 - ss(0.2, 0.34, ax)) * ss(-0.95, -0.82, y) * (1 - ss(-0.64, -0.58, y)) * front;
  if (style === 4) return mus;
  if (style === 5) return Math.max(chin * (1 - lip), mus);
  return Math.max(Math.max(jaw, side) * (1 - lip), mus);
}
const BEARD_GLSL = `float beardW(vec3 q, float style) {
        float ax = abs(q.x), front = smoothstep(-0.15, 0.1, q.z), onHead = 1.0 - smoothstep(1.0, 1.08, ax);
        float top = -0.6 + 0.24 * smoothstep(0.2, 0.62, ax) + 0.42 * smoothstep(0.6, 0.86, ax);
        float ear = smoothstep(0.86, 0.93, ax) * smoothstep(-0.5, -0.38, q.y);
        float jaw = (1.0 - smoothstep(top - 0.04, top + 0.03, q.y)) * smoothstep(-0.95, -0.82, q.y) * smoothstep(-0.22, -0.04, q.z) * (1.0 - ear) * onHead;
        float side = 0.0;
        float lip = (1.0 - smoothstep(0.15, 0.24, ax)) * smoothstep(-0.64, -0.6, q.y) * (1.0 - smoothstep(-0.53, -0.49, q.y)) * step(0.45, q.z);
        float mus = (1.0 - smoothstep(0.26, 0.38, ax)) * smoothstep(-0.575 - 0.05 * ax, -0.55 - 0.05 * ax, q.y) * (1.0 - smoothstep(-0.47 - 0.03 * ax, -0.44 - 0.03 * ax, q.y)) * step(0.45, q.z);
        float chin = (1.0 - smoothstep(0.2, 0.34, ax)) * smoothstep(-0.95, -0.82, q.y) * (1.0 - smoothstep(-0.64, -0.58, q.y)) * front;
        if (style > 3.5 && style < 4.5) return mus;
        if (style > 4.5) return max(chin * (1.0 - lip), mus);
        return max(max(jaw, side) * (1.0 - lip), mus);
      }`;
// how thick each beard grows (share of the head's height), and how far a full beard hangs below the chin
const BEARD_DEPTH = { 2: 0.022, 3: 0.04, 4: 0.014, 5: 0.028 };
/** A beard as a shell grown out of the face's own surface (bind pose, the body's vertex space), skinned like it. */
function beardShell(src, style, sex) {
  src.beards ||= {}; const key = style + ':' + sex; if (src.beards[key]) return src.beards[key];
  const geo = src.mesh.geometry, P = geo.attributes.position, N = geo.attributes.inkNormal, I = geo.index.array;
  const SI = geo.attributes.skinIndex, SW = geo.attributes.skinWeight;
  const c = src.attrHead.getCenter(new THREE.Vector3()), h = src.attrHead.getSize(new THREE.Vector3()).multiplyScalar(0.5), K = BEARD_K[sex] || BEARD_K[0], H = h.y * 2;
  const w = new Float32Array(P.count), qy = new Float32Array(P.count);
  for (let i = 0; i < P.count; i++) {
    const x = (P.getX(i) - c.x) / h.x * K[0], y = (P.getY(i) - c.y) / h.y * K[1], z = (P.getZ(i) - c.z) / h.z;
    w[i] = beardW(x, y, z, style); qy[i] = y;
  }
  const map = new Map(), idx = [];
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], d = I[t + 2]; if (w[a] + w[b] + w[d] < 0.03) continue;
    for (const v of [a, b, d]) { if (!map.has(v)) map.set(v, map.size); idx.push(map.get(v)); }
  }
  const n = map.size, pos = new Float32Array(n * 3), base = new Float32Array(n * 3), wt = new Float32Array(n), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  const depth = BEARD_DEPTH[style] || 0.02;
  for (const [v, j] of map) {
    const k = w[v], off = H * (0.002 + depth * ss(0.2, 0.85, k));
    let x = P.getX(v) + N.getX(v) * off, y = P.getY(v) + N.getY(v) * off, z = P.getZ(v) + N.getZ(v) * off;
    if (style === 3) { const low = ss(-0.62, -0.88, qy[v]) * k; y -= H * 0.08 * low; z += H * 0.025 * low; } // a full beard hangs down a little
    pos.set([x, y, z], j * 3); base.set([P.getX(v), P.getY(v), P.getZ(v)], j * 3); wt[j] = k;
    for (let q = 0; q < 4; q++) { si[j * 4 + q] = SI.getComponent(v, q); sw[j * 4 + q] = SW.getComponent(v, q); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('basePos', new THREE.BufferAttribute(base, 3)); g.setAttribute('beardW', new THREE.BufferAttribute(wt, 1));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  g.setIndex(idx); g.computeVertexNormals();
  return (src.beards[key] = g);
}
/** Beard material: cel-shaded in the hair colour, with fine downward strands, darker where it thins out; its outline
 * is cut per pixel from the same smooth shape as the painted beard (not along the mesh's triangles). */
function beardMaterial(color, src, style, sex) {
  const m = toon({ color, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const U = { uBC: { value: src.attrHead.getCenter(new THREE.Vector3()) }, uBH: { value: src.attrHead.getSize(new THREE.Vector3()).multiplyScalar(0.5) },
    uBK: { value: new THREE.Vector2(...(BEARD_K[sex] || BEARD_K[0])) }, uBS: { value: style } };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = 'attribute float beardW; attribute vec3 basePos; varying float vBW; varying vec3 vBP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvBW = beardW; vBP = basePos;');
    sh.fragmentShader = 'varying float vBW; varying vec3 vBP; uniform vec3 uBC, uBH; uniform vec2 uBK; uniform float uBS;\n' + BEARD_GLSL +
      '\nfloat bHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }\n' +
      sh.fragmentShader.replace('void main() {', 'void main() {\n  vec3 bq = (vBP - uBC) / uBH; bq.xy *= uBK; float bw = beardW(bq, uBS); if (bw < 0.32) discard;')
        .replace('#include <map_fragment>', '#include <map_fragment>\n  diffuseColor.rgb *= (0.74 + 0.26 * smoothstep(0.32, 0.8, bw)) * (0.84 + 0.24 * bHash(floor(vBP * vec3(1500.0, 260.0, 1500.0))));');
  };
  m.customProgramCacheKey = () => 'beard3d';
  return m;
}

// ---------- the repaint shader ----------
// where things are on each head, in head coordinates (-1..1 from chin-and-neck to crown): brows from/to, the hairline
// at the forehead, and at the nape
const FACE = [[-0.1, 0.02, 0.34, -0.4], [-0.1, 0.02, 0.34, -0.4]];
// beards were drawn for a head box that included hair; these stretch the bald heads' coordinates to match (x, y)
const BEARD_K = [[0.92, 1.2], [0.92, 1.2]];
const hex3 = c => new THREE.Vector3(((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255); // sRGB 0..1, as written
function bodyMaterial(src, L, debug = 0) {
  const tex = src.mesh.material.map, hc = src.attrHead.getCenter(new THREE.Vector3()), hh = src.attrHead.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  const [y0, y1] = src.attrY, at = f => y0 + (y1 - y0) * f;
  const m = toon({ map: tex });
  const U = {
    uTop: { value: hex3(L.top) }, uBot: { value: hex3(L.bottom) }, uSkin: { value: hex3(L.skinC) }, uHair: { value: hex3(L.hairC) },
    uHeadC: { value: hc }, uHeadH: { value: hh }, uTopMin: { value: at(0.45) }, uBotMax: { value: at(0.6) },
    uFace: { value: new THREE.Vector4(...(FACE[L.sex] || FACE[0])) }, uBeardK: { value: new THREE.Vector2(...(BEARD_K[L.sex] || BEARD_K[0])) }, uBuzz: { value: L.hairdo === 1 ? 1 : L.hairdo >= 2 ? 2 : 0 }, uHatCut: { value: 1e9 }, uBeard: { value: L.beard || 0 }, uDebug: { value: debug },
  };
  m.userData.uniforms = U;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = 'varying vec3 vKPos;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvKPos = position;');
    sh.fragmentShader = `varying vec3 vKPos;
      uniform vec3 uTop, uBot, uSkin, uHair, uHeadC, uHeadH; uniform vec4 uFace; uniform vec2 uBeardK; uniform float uTopMin, uBotMax, uBuzz, uBeard, uDebug, uHatCut;
      vec3 kHsv(vec3 c) { vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0); vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
        vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r)); float d = q.x - min(q.w, q.y); return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-10)), d / (q.x + 1e-10), q.x); }
      float kHue(float h, float c, float w) { float d = abs(h - c); d = min(d, 1.0 - d); return 1.0 - smoothstep(w * 0.55, w, d); }
      float kHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      vec3 kLin(vec3 c) { return pow(max(c, vec3(0.0)), vec3(2.2)); }
      ${BEARD_GLSL}
    ` + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      {
        vec3 sc = pow(max(diffuseColor.rgb, vec3(0.0)), vec3(1.0 / 2.2)), hsv = kHsv(sc);
        if (vKPos.y > uHatCut) discard; // inside a hat
        vec3 q = (vKPos - uHeadC) / uHeadH; // -1..1 across the head
        float sat = smoothstep(0.30, 0.46, hsv.y);
        float wTop = kHue(hsv.x, 0.27, 0.10) * sat * step(uTopMin, vKPos.y);
        float wBot = kHue(hsv.x, 0.625, 0.085) * sat * (1.0 - step(uBotMax, vKPos.y));
        float wSkin = kHue(hsv.x, 0.075, 0.065) * smoothstep(0.08, 0.17, hsv.y) * (1.0 - smoothstep(0.66, 0.8, hsv.y)) * smoothstep(0.28, 0.42, hsv.z);
        vec3 col = sc;
        col = mix(col, uTop * clamp(hsv.z / 0.86, 0.0, 1.25), wTop);
        col = mix(col, uBot * clamp(hsv.z / 0.70, 0.0, 1.35), wBot);
        col = mix(col, uSkin * clamp(hsv.z / 0.93, 0.0, 1.15), wSkin);
        // eyebrows in the hair colour (dark strokes just above the eyes)
        float brow = step(0.45, q.z) * smoothstep(uFace.x, uFace.x + 0.03, q.y) * (1.0 - smoothstep(uFace.y - 0.03, uFace.y, q.y)) * step(abs(q.x), 0.75) * (1.0 - smoothstep(0.3, 0.45, hsv.z));
        col = mix(col, uHair * (0.45 + 0.8 * hsv.z), brow);
        // the scalp: a buzz cut is painted on (short grain); under a hairstyle it is painted solid in a darker hair
        // colour, so no bald patch shows through gaps between the locks
        if (uBuzz > 0.5) {
          float line = mix(mix(uFace.w, -0.02, smoothstep(-0.65, -0.05, q.z)), uFace.z, smoothstep(0.25, 0.75, q.z)); // nape, above the ears, forehead
          float scalp = smoothstep(line - 0.015, line + 0.05, q.y);
          float grain = 0.5 + 0.5 * kHash(floor(vKPos * 1400.0));
          // under a hairstyle: the hair colour itself (a touch darker), from a hairline a little higher at the forehead
          float lift = 0.16 * smoothstep(0.3, 0.7, q.z); // pieces cover the forehead themselves
          float under = smoothstep(line + lift - 0.015, line + lift + 0.05, q.y);
          if (uBuzz > 1.5) col = mix(col, uHair * (0.72 + 0.25 * hsv.z), under * max(wSkin, 0.6));
          else col = mix(col, uHair * (0.75 + 0.3 * hsv.z), scalp * (0.55 + 0.25 * grain) * max(wSkin, 0.5));
        }
        // facial hair painted on the skin (under the 3D beard, so its edges blend; stubble is only this)
        if (uBeard > 0.5) {
          vec3 qb = q; qb.xy *= uBeardK;
          float b = beardW(qb, uBeard);
          if (uBeard < 1.5) b *= 0.25 + 0.3 * kHash(floor(vKPos * 1600.0));
          col = mix(col, uHair * (0.5 + 0.6 * hsv.z), clamp(b, 0.0, 1.0) * wSkin * 0.95);
        }
        if (uDebug > 1.5) { float b = floor(-q.y * 10.0); col = b == 3.0 ? vec3(1,0,1) : b == 4.0 ? vec3(1,1,0) : b == 5.0 ? vec3(1,0,0) : b == 6.0 ? vec3(0,1,0) : b == 7.0 ? vec3(0,0,1) : b == 8.0 ? vec3(0,1,1) : b == 9.0 ? vec3(1,0.5,0) : sc;
          if (abs(fract(q.x * 5.0 + 0.5) - 0.5) < 0.03) col = vec3(0.0); if (abs(q.z - 0.5) < 0.02) col = vec3(1.0); }
        else if (uDebug > 0.5) col = vec3(wTop, wBot, wSkin) + vec3(brow, brow, 0.0);
        diffuseColor.rgb = kLin(col);
      }`);
  };
  m.customProgramCacheKey = () => 'explorer-body';
  return m;
}

// ---------- hats and shades (built in code, fitted to the head) ----------
function buildHat(kind, color, r) {
  const g = new THREE.Group(), M = c => toon({ color: c }), dk = (c, k) => new THREE.Color(c).multiplyScalar(k);
  const sph = (rad, m, ws = 24, hs = 16, ...a) => new THREE.Mesh(new THREE.SphereGeometry(rad, ws, hs, ...a), m);
  const cyl = (r0, r1, h, m, seg = 28, open = false) => new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg, 1, open), m);
  const m = M(color);
  if (kind === 1) { // bucket hat: soft crown and a sloping brim
    const crown = cyl(r * 0.86, r * 1.0, r * 0.62, m); crown.position.y = r * 0.42; g.add(crown);
    const top = sph(r * 0.86, m, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2); top.scale.y = 0.32; top.position.y = r * 0.73; g.add(top);
    const brim = cyl(r * 1.0, r * 1.42, r * 0.3, toon({ color, side: THREE.DoubleSide }), 32, true); brim.position.y = r * 0.0; g.add(brim);
  } else if (kind === 2) { // trucker cap
    const dome = sph(r * 1.04, m, 26, 12, 0, Math.PI * 2, 0, Math.PI / 2); dome.scale.y = 0.86; dome.position.y = r * 0.05; g.add(dome);
    const front = sph(r * 1.05, M(0xffffff), 20, 10, Math.PI * 0.2, Math.PI * 0.6, 0.12, Math.PI / 2 - 0.12); front.scale.y = 0.87; front.position.y = r * 0.05; g.add(front);
    const bill = cyl(r * 0.72, r * 0.72, r * 0.08, m, 26); bill.geometry = new THREE.CylinderGeometry(r * 0.72, r * 0.72, r * 0.08, 26, 1, false, -Math.PI / 2, Math.PI); bill.position.set(0, r * 0.12, r * 0.86); bill.rotation.x = 0.1; g.add(bill);
  } else if (kind === 3) { // beanie
    const dome = sph(r * 1.06, m, 26, 12, 0, Math.PI * 2, 0, Math.PI / 2); dome.scale.y = 0.85; g.add(dome);
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(r * 1.02, r * 0.14, 10, 32), M(dk(color, 0.82))); cuff.rotation.x = Math.PI / 2; cuff.position.y = r * 0.06; g.add(cuff);
  } else if (kind === 4 || kind === 7) { // cowboy hat, or the rangers' flat wide brim
    const cow = kind === 4;
    const crown = cyl(r * 0.78, r * 1.0, r * 0.7, m); crown.position.y = r * 0.42; crown.scale.z = cow ? 0.88 : 1; g.add(crown);
    const top = sph(r * 0.78, m, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2); top.scale.set(1, cow ? 0.2 : 0.3, cow ? 0.88 : 1); top.position.y = r * 0.77; g.add(top);
    const brim = cyl(r * 1.5, r * 1.5, r * 0.07, m, 36); brim.position.y = r * 0.08; if (cow) brim.scale.set(1, 1, 0.8); g.add(brim);
    if (cow) for (const s of [-1, 1]) { const wing = cyl(r * 0.6, r * 0.6, r * 0.07, m, 20); wing.scale.set(1, 1, 1.5); wing.position.set(s * r * 1.15, r * 0.22, 0); wing.rotation.z = -s * 0.55; g.add(wing); }
    const band = cyl(r * 1.005, r * 1.005, r * 0.14, M(cow ? 0x1f1f2e : dk(color, 0.62))); band.position.y = r * 0.16; g.add(band);
  } else if (kind === 5) { // flower crown
    const vine = new THREE.Mesh(new THREE.TorusGeometry(r * 1.0, r * 0.045, 6, 36), M(0x3fae2a)); vine.rotation.x = Math.PI / 2 - 0.3; vine.position.set(0, r * 0.12, -r * 0.05); g.add(vine);
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2, f = new THREE.Group(); f.position.set(Math.cos(a) * r, r * 0.12 + Math.sin(a) * r * Math.sin(0.3), -r * 0.05 + Math.sin(a) * r * Math.cos(0.3)); g.add(f);
      const pc = [color, 0xffffff, 0xffcf2e][i % 3]; for (let p = 0; p < 5; p++) { const pa = p / 5 * Math.PI * 2, petal = sph(r * 0.09, M(pc), 8, 6); petal.position.set(Math.cos(pa) * r * 0.09, r * 0.03, Math.sin(pa) * r * 0.09); petal.scale.set(1, 0.5, 1); f.add(petal); }
      const mid = sph(r * 0.06, M(0xffa400), 8, 6); mid.position.y = r * 0.06; f.add(mid);
    }
  } else if (kind === 6) { // bandana headband, knotted at the back
    const band = new THREE.Mesh(new THREE.TorusGeometry(r * 1.02, r * 0.11, 8, 36), m); band.rotation.x = Math.PI / 2 - 0.2; band.position.set(0, r * 0.12, -r * 0.03); band.scale.set(1, 1, 1.05); g.add(band);
    const knot = sph(r * 0.15, m, 10, 8); knot.position.set(0, -r * 0.05, -r * 1.05); g.add(knot);
    for (const s of [-1, 1]) { const tail = new THREE.Mesh(new THREE.BoxGeometry(r * 0.18, r * 0.45, r * 0.04), m); tail.position.set(s * r * 0.1, -r * 0.3, -r * 1.07); tail.rotation.z = s * 0.3; g.add(tail); }
  }
  return g;
}
/** Everyday sunglasses: aviators, classic (wayfarer-style), round, a sport wrap, cat-eye. w is the face width at the
 * eyes; the glasses face +z with the lenses' middle at the origin. */
function lensShape(kind) {
  const p = new THREE.Shape();
  if (kind === 1) { p.moveTo(-0.48, 0.3); p.bezierCurveTo(-0.2, 0.38, 0.3, 0.38, 0.5, 0.3); p.bezierCurveTo(0.56, 0.0, 0.42, -0.42, 0.1, -0.47); p.bezierCurveTo(-0.22, -0.5, -0.5, -0.24, -0.5, 0.06); p.closePath(); }
  else if (kind === 2) { p.moveTo(-0.5, 0.3); p.lineTo(0.53, 0.34); p.quadraticCurveTo(0.55, 0.34, 0.53, 0.25); p.lineTo(0.43, -0.28); p.quadraticCurveTo(0.4, -0.34, 0.32, -0.34); p.lineTo(-0.36, -0.32); p.quadraticCurveTo(-0.44, -0.31, -0.45, -0.24); p.lineTo(-0.52, 0.22); p.quadraticCurveTo(-0.53, 0.3, -0.5, 0.3); }
  else if (kind === 3) p.absarc(0, 0, 0.4, 0, Math.PI * 2, false);
  else if (kind === 5) { p.moveTo(-0.47, 0.16); p.bezierCurveTo(-0.2, 0.3, 0.3, 0.32, 0.58, 0.44); p.bezierCurveTo(0.56, 0.1, 0.46, -0.3, 0.2, -0.33); p.bezierCurveTo(-0.15, -0.36, -0.45, -0.25, -0.47, 0.16); }
  return p;
}
function grow(shape, k) { const pts = shape.getPoints(24), c = pts.reduce((a, v) => a.add(v), new THREE.Vector2()).divideScalar(pts.length); const s = new THREE.Shape(pts.map(v => v.clone().sub(c).multiplyScalar(k).add(c))); return s; }
function buildShades(kind, frameC, lensC, w) {
  const g = new THREE.Group(), L = w * 0.36, frameM = toon({ color: frameC });
  const mirror = lensC === LENSES[3];
  const lensM = new THREE.MeshBasicMaterial({ color: lensC, transparent: true, opacity: mirror ? 0.95 : 0.88, side: THREE.DoubleSide });
  const shineM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: mirror ? 0.55 : 0.3, side: THREE.DoubleSide });
  const thick = { 1: 1.07, 2: 1.2, 3: 1.1, 5: 1.2 }[kind] || 1.1, depth = kind === 1 || kind === 3 ? 0.04 : 0.07;
  const lensAt = x => { const grp = new THREE.Group(); grp.position.set(x * L * 0.58, 0, -Math.abs(x) * L * 0.06); grp.rotation.y = -x * 0.14; g.add(grp); return grp; };
  if (kind === 4) { // sport: one curved shield across both eyes
    const sh = new THREE.Shape(); sh.moveTo(-1.25, 0.18); sh.bezierCurveTo(-0.6, 0.36, 0.6, 0.36, 1.25, 0.18); sh.bezierCurveTo(1.3, -0.1, 1.05, -0.38, 0.6, -0.36); sh.bezierCurveTo(0.25, -0.34, 0.15, -0.12, 0, -0.12); sh.bezierCurveTo(-0.15, -0.12, -0.25, -0.34, -0.6, -0.36); sh.bezierCurveTo(-1.05, -0.38, -1.3, -0.1, -1.25, 0.18);
    const geo = new THREE.ShapeGeometry(sh, 24), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, -x * x * 0.22); } // wrap round the face
    geo.computeVertexNormals();
    const lens = new THREE.Mesh(geo, lensM); lens.scale.setScalar(L); lens.userData.noInk = true; g.add(lens);
    const top = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 6, 40, Math.PI * 0.62), frameM); top.rotation.z = Math.PI * 0.19; top.scale.set(L * 1.32, L * 0.3, L); top.position.set(0, -L * 0.02, -L * 0.12); g.add(top);
    const shine = new THREE.Mesh(new THREE.PlaneGeometry(L * 0.5, L * 0.06), shineM); shine.position.set(-L * 0.5, L * 0.12, L * 0.02); shine.rotation.z = 0.5; shine.userData.noInk = true; g.add(shine);
  } else {
    const lensSh = lensShape(kind);
    for (const x of [-1, 1]) {
      const grp = lensAt(x), sx = x > 0 ? 1 : -1; // mirror the left lens so the outer corners match
      const rimSh = grow(lensSh, thick); rimSh.holes.push(new THREE.Path(lensSh.getPoints(24)));
      const rim = new THREE.Mesh(new THREE.ExtrudeGeometry(rimSh, { depth, bevelEnabled: false, curveSegments: 12 }), frameM); rim.scale.set(sx * L, L, L); rim.position.z = -depth * L / 2; grp.add(rim);
      const lens = new THREE.Mesh(new THREE.ShapeGeometry(lensSh, 16), lensM); lens.scale.set(sx * L, L, L); lens.userData.noInk = true; grp.add(lens);
      const shine = new THREE.Mesh(new THREE.PlaneGeometry(L * 0.34, L * 0.06), shineM); shine.position.set(-sx * L * 0.12, L * 0.12, L * 0.01); shine.rotation.z = 0.55 * sx; shine.userData.noInk = true; grp.add(shine);
    }
    const bridgeW = L * 0.36;
    if (kind === 1) for (const y of [0.24, 0.31]) { const b = new THREE.Mesh(new THREE.BoxGeometry(bridgeW, L * 0.025, L * 0.025), frameM); b.position.set(0, y * L, 0); g.add(b); } // aviators: a double bridge
    else { const b = new THREE.Mesh(new THREE.TorusGeometry(bridgeW / 2, L * (kind === 3 ? 0.025 : 0.05), 6, 12, Math.PI), frameM); b.position.set(0, L * 0.06, 0); g.add(b); }
  }
  // the arms, back to the ears
  for (const x of [-1, 1]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(L * 0.05, L * 0.07, w * 0.62), frameM); arm.position.set(x * w * 0.47, L * 0.18, -w * 0.31); arm.rotation.y = x * 0.06; g.add(arm); }
  g.userData.glow = [];
  return g;
}

// ---------- tuning: how the hair pieces sit on the head (head-bone space, fractions of the head box) ----------
const HAIR_FIT = { scale: 1.0, y: 0.16, z: -0.12, per: { pony: { scale: 1.18, y: 0.12, z: -0.14 }, buns: { scale: 1.3, y: 0.06, z: -0.02 } } };
const SHADE_FIT = { w: 0.8, y: 0.09, z: 0.46 }; // width share of the head box, height (head coords, from the brows), depth
export const _tune = { HAIR_FIT, SHADE_FIT, FACE }; // for the dev viewer

/**
 * An explorer about 1 unit tall, feet at y = 0, facing +z. L is a full look (see art.js lookOf): sex, shirt, legs,
 * hairdo, hairC, top, bottom, skinC, beard, hat, hatC, glasses, glassC, lensC. userData.update(dt, speed) walks or idles.
 */
export function makeExplorer3D(L, opts = {}) {
  const src = bodies[bodyKey(L)];
  const root = new THREE.Group(), model = cloneSkinned(src.gltf.scene);
  const k = 1 / src.height; model.scale.setScalar(k); model.position.y = -src.floor * k; root.add(model);
  let mesh = null; model.traverse(o => { if (o.isSkinnedMesh) mesh = o; });
  mesh.material = bodyMaterial(src, L, opts.debug); mesh.frustumCulled = false; mesh.castShadow = false;
  const bodyInk = opts.noInk ? null : inkFor(mesh);
  /** Hides the body's head above y (head space), outline included: under a hat, or for a bald scalp. */
  const hideHeadAbove = y => {
    const U = mesh.material.userData.uniforms.uHatCut; U.value = src.boneToAttrY(y + hc.y);
    if (!bodyInk) return;
    const m = bodyInk.material.clone(), prev = m.onBeforeCompile;
    m.onBeforeCompile = (sh, r) => { prev(sh, r); sh.uniforms.uHatCut = U;
      sh.vertexShader = 'varying float vKY;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvKY = position.y;');
      sh.fragmentShader = 'uniform float uHatCut; varying float vKY;\n' + sh.fragmentShader.replace('void main() {', 'void main() {\n  if (vKY > uHatCut) discard;'); };
    m.customProgramCacheKey = () => 'ink-body-cut'; bodyInk.material = m;
  };
  const headBone = mesh.skeleton.bones.find(b => b.name === 'Head');
  const hb = src.headBox, hc = hb.getCenter(new THREE.Vector3()), hs = hb.getSize(new THREE.Vector3());
  const attach = new THREE.Group(); attach.quaternion.copy(src.headUpright); attach.position.copy(hc).applyQuaternion(src.headUpright); headBone.add(attach); // the middle of the head, upright
  // hair
  const hairName = HAIR_FILE[L.hairdo], hairSrc = hairName && hairs[L.hairdo];
  const r = hs.x * 0.5, brimY = hs.y * 0.1, crowned = [1, 2, 3, 4, 7].includes(L.hat); // hats whose crown hides the hair above their band
  const cloud = []; for (let i = 0; i < src.headPts.length; i += 3) cloud.push(src.headPts[i] - hc.x, src.headPts[i + 1] - hc.y, src.headPts[i + 2] - hc.z);
  const cut = brimY + hs.y * 0.02;
  if (hairSrc) {
    const piece = hairSrc.gltf.scene.clone(true), mb = hairSrc.box, mc = mb.getCenter(new THREE.Vector3()), ms = mb.getSize(new THREE.Vector3());
    const f = { ...HAIR_FIT, ...(HAIR_FIT.per[hairName] || {}) };
    // the mannequin's face is matched to ours: same width (our box has ears too), face fronts and jaws lined up
    const s = (hs.x / ms.x) * 0.86 * f.scale; piece.scale.setScalar(s);
    piece.position.set(-mc.x * s, (hb.min.y - hc.y) - mb.min.y * s + hs.y * f.y, (hb.max.z - hc.z) - mb.max.z * s + hs.z * f.z);
    piece.updateMatrixWorld(true); // (not attached yet, so this is head space)
    const meshes = []; piece.traverse(o => { if (o.isMesh) meshes.push(o); });
    if (L.hat) { const v = new THREE.Vector3(); for (const o of meshes) { const P = o.geometry.attributes.position; for (let i = 0; i < P.count; i += 2) { v.fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld); cloud.push(v.x, v.y, v.z); } } }
    for (const o of meshes) {
      const hm = toon({ color: L.hairC, map: o.material.map }), U = L.hat && crowned ? { uCut: { value: cut }, uToHead: { value: o.matrixWorld.clone() } } : null;
      if (U) cutAbove(hm, U);
      o.material = hm;
      if (!opts.noInk && hairName !== 'locs') { const ink = inkFor(o, 0.004); if (U) { ink.material = ink.material.clone(); cutAbove(ink.material, U); } } // (locs: the outline showed through the gaps)
    }
    const holder = new THREE.Group(); holder.add(piece); attach.add(holder);
  }
  if (L.hat) {
    // the hat's band is an ellipse round everything (head and hair) at the height it sits
    const band = (y0, y1) => { let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (let i = 0; i < cloud.length; i += 3) { const y = cloud[i + 1]; if (y < y0 || y > y1) continue; x0 = Math.min(x0, cloud[i]); x1 = Math.max(x1, cloud[i]); z0 = Math.min(z0, cloud[i + 2]); z1 = Math.max(z1, cloud[i + 2]); }
      return x0 === Infinity ? { cx: 0, cz: 0, rx: hs.x / 2, rz: hs.z / 2 } : { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, rx: (x1 - x0) / 2, rz: (z1 - z0) / 2 }; };
    const y = crowned ? brimY : brimY + hs.y * 0.14, bd = band(y - hs.y * 0.05, y + hs.y * 0.05), k = crowned ? 1.05 : 1.0;
    const hat = buildHat(L.hat, L.hatC, bd.rx * k); hat.scale.set(1, 1, Math.max(0.8, Math.min(1.4, bd.rz / bd.rx))); hat.position.set(bd.cx, y - (crowned ? hs.y * 0.02 : 0), bd.cz); attach.add(hat);
    if (crowned) hideHeadAbove(cut);
    if (!opts.noInk) { const list = []; hat.traverse(o => { if (o.isMesh) list.push(o); }); list.forEach(o => inkFor(o, 0.004)); }
  }
  if (L.glasses) {
    const F = FACE[L.sex] || FACE[0], sh = buildShades(L.glasses, L.glassC, L.lensC ?? LENSES[0], hs.x * SHADE_FIT.w); sh.position.set(0, (F[0] + SHADE_FIT.y) * hs.y / 2, hs.z * SHADE_FIT.z); attach.add(sh);
    if (!opts.noInk) { const list = []; sh.traverse(o => { if (o.isMesh && !o.userData.noInk) list.push(o); }); list.forEach(o => inkFor(o, 0.003)); }
  }
  // facial hair with real volume: a shell grown from the face (stubble is painted only)
  if (L.beard >= 2) {
    const beard = new THREE.SkinnedMesh(beardShell(src, L.beard, L.sex), beardMaterial(L.hairC, src, L.beard, L.sex));
    beard.bind(mesh.skeleton, mesh.bindMatrix); beard.frustumCulled = false;
    beard.position.copy(mesh.position); beard.quaternion.copy(mesh.quaternion); beard.scale.copy(mesh.scale); mesh.parent.add(beard);
  }
  // animation: the generated walk, and a calm standing pose made here (arms relaxed at the sides, breathing, a
  // look around now and then), cross-faded by speed
  const mixer = new THREE.AnimationMixer(model), walk = mixer.clipAction(src.clips.walk); walk.play();
  const bones = model.getObjectByProperty('isSkinnedMesh', true).skeleton.bones, rest = bones.map(b => [b.quaternion.clone(), b.position.clone()]);
  const byName = Object.fromEntries(bones.map((b, i) => [b.name, i])), Z = new THREE.Vector3(0, 0, 1), X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), idleQ = new THREE.Quaternion();
  /** world-space turn of one bone about its own pivot, as a local rotation on top of its rest pose */
  const turn = (name, axis, ang, out) => { const pw = src.parentWorld[name]; qa.setFromAxisAngle(axis, ang); return out.copy(pw).invert().multiply(qa).multiply(pw).multiply(rest[byName[name]][0]); };
  const seed = Math.random() * 100;
  let w = 0, t = 0;
  function standing(name, out) {
    const tt = t + seed, breathe = Math.sin(tt * 1.6), look = Math.sin(tt * 0.31) * Math.sin(tt * 0.17 + 1);
    switch (name) {
      case 'LeftArm': return turn(name, Z, -0.36 + breathe * 0.015, out);
      case 'RightArm': return turn(name, Z, 0.36 - breathe * 0.015, out);
      case 'LeftForeArm': return turn(name, X, 0.22, out);
      case 'RightForeArm': return turn(name, X, 0.22, out);
      case 'Spine01': return turn(name, X, breathe * 0.012, out);
      case 'Head': return turn(name, Y, look * 0.35, out);
      default: return null;
    }
  }
  root.userData = {
    look: L, head: attach, mixer, model,
    update(dt, speed = 0) {
      t += dt; const target = Math.min(1, speed / 0.6); w += (target - w) * Math.min(1, dt * 6); if (w < 0.002) w = 0;
      walk.timeScale = 0.8 + Math.min(1.2, speed / 1.4) * 0.6;
      if (w > 0) mixer.update(dt);
      for (let i = 0; i < bones.length; i++) {
        const b = bones[i], [rq, rp] = rest[i], iq = standing(b.name, idleQ) || rq;
        if (w === 0) { b.quaternion.copy(iq); if (i === 0 || b.name === 'Hips') b.position.copy(rp); }
        else { b.quaternion.slerpQuaternions(iq, qb.copy(b.quaternion), w); if (b.name === 'Hips') b.position.lerpVectors(rp, b.position, w); }
      }
    },
  };
  return root;
}
