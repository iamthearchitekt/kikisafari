// The explorer (your avatar), as a real 3D anime character (owner: "pro anime 3D characters", "make them believable",
// "don't overdo stereotypes", "modern EDM festivals", "customize hair, facial hair, clothes colour, a few clothing
// options, hats and sunglasses, anime adventure-hero style").
//
// Three generated, rigged and animated bodies (tee and cargo shorts, windbreaker and joggers, tank and wide cargos;
// all with white chunky trainers and a hydration pack) share one face and skeleton. Their textures were painted with
// key colours: the top is bright green, the bottoms royal blue, so a shader can repaint them any colour while keeping
// every painted fold and shadow. Skin and the short base hair are repainted the same way. Hairstyles are separate
// generated pieces that sit on the head bone (tinted from a grey texture); beards are painted onto the face; hats and
// shades are built in code. Everything is cel-shaded with ink outlines.
import * as THREE from '../vendor/three.module.min.js';
import { GLTFLoader } from '../vendor/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from '../vendor/addons/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from '../vendor/addons/utils/SkeletonUtils.js';

export const CUTS = ['Tee + cargo shorts', 'Windbreaker + joggers', 'Tank + wide cargos'];
export const STYLES = ['Short', 'Spiky', 'Long', 'Space buns', 'Curly', 'Locs', 'Undercut', 'Bald'];
const HAIR_FILE = [null, 'spiky', 'long', 'buns', 'curly', 'locs', 'undercut', null];

// ---------- loading: each outfit and hairstyle on demand (yours first, the rest in the background) ----------
const BASE = 'assets/explorers/', bodies = [], hairs = [], pending = new Map();
let loader = null;
function fetchPart(kind, i) {
  const key = kind + i; if (pending.has(key)) return pending.get(key);
  loader ||= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const file = kind === 'body' ? `body-${'abc'[i]}.glb` : `hair-${HAIR_FILE[i]}.glb`;
  const p = loader.loadAsync(BASE + file).then(g => { if (kind === 'body') bodies[i] = prepBody(g); else hairs[i] = prepHair(g); });
  p.catch(() => pending.delete(key)); pending.set(key, p); return p;
}
/** Loads what one look needs (its outfit and hairstyle). */
export function preloadExplorer(L) { return Promise.all([fetchPart('body', L.body % CUTS.length), HAIR_FILE[L.style] ? fetchPart('hair', L.style) : null]); }
/** Loads every outfit and hairstyle (for the customiser and friends' portraits). */
export function loadExplorerKit() { return Promise.all([...CUTS.map((_, i) => fetchPart('body', i)), ...HAIR_FILE.map((h, i) => h ? fetchPart('hair', i) : null)]); }
/** True when makeExplorer3D(L) can build this look right now. */
export const explorerReady = L => !!bodies[L.body % CUTS.length] && (!HAIR_FILE[L.style] || !!hairs[L.style]);

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
  let yMin = Infinity, yMax = -Infinity; const pts = [];
  for (let i = 0; i < P.count; i++) {
    const y = P.getY(i); if (y < yMin) yMin = y; if (y > yMax) yMax = y;
    let dom = -1, best = -1; for (let k = 0; k < 4; k++) { const w = SW.getComponent(i, k); if (w > best) { best = w; dom = SI.getComponent(i, k); } }
    if (dom !== hj) continue;
    v.fromBufferAttribute(P, i); attr.expandByPoint(v);
    mesh.applyBoneTransform(i, v); v.applyMatrix4(mesh.matrixWorld).applyMatrix4(inv); bone.expandByPoint(v);
    if (i % 3 === 0) pts.push(v.x, v.y, v.z);
  }
  const whole = new THREE.Box3().setFromObject(g.scene, true);
  addInkNormals(mesh.geometry);
  const clips = Object.fromEntries(g.animations.map(a => [a.name, a]));
  const parentWorld = {}; for (const b of mesh.skeleton.bones) parentWorld[b.name] = b.parent.getWorldQuaternion(new THREE.Quaternion());
  const boneToAttrY = y => attr.min.y + (y - bone.min.y) * (attr.max.y - attr.min.y) / (bone.max.y - bone.min.y);
  return { gltf: g, mesh, parentWorld, headPts: new Float32Array(pts), boneToAttrY, headBox: bone, attrHead: attr, attrY: [yMin, yMax], height: whole.max.y - whole.min.y, floor: whole.min.y, clips };
}
function prepHair(g) {
  const meshes = []; g.scene.traverse(o => { if (o.isMesh) { meshes.push(o); addInkNormals(o.geometry); } });
  const m = g.scene.userData.mannequin || g.userData?.mannequin;
  return { gltf: g, meshes, box: m ? new THREE.Box3(new THREE.Vector3(...m.min), new THREE.Vector3(...m.max)) : new THREE.Box3().setFromObject(g.scene) };
}

// ---------- the repaint shader ----------
const hex3 = c => new THREE.Vector3(((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255); // sRGB 0..1, as written
function bodyMaterial(src, L, debug = 0) {
  const tex = src.mesh.material.map, hc = src.attrHead.getCenter(new THREE.Vector3()), hh = src.attrHead.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  const [y0, y1] = src.attrY, at = f => y0 + (y1 - y0) * f;
  const m = toon({ map: tex });
  const U = {
    uTop: { value: hex3(L.top) }, uBot: { value: hex3(L.bottom) }, uSkin: { value: hex3(L.skinC) }, uHair: { value: hex3(L.hairC) },
    uHeadC: { value: hc }, uHeadH: { value: hh }, uTopMin: { value: at(0.45) }, uBotMax: { value: at(0.6) },
    uBald: { value: L.style === 7 ? 1 : 0 }, uHatCut: { value: 1e9 }, uBeard: { value: L.beard || 0 }, uDebug: { value: debug },
  };
  m.userData.uniforms = U;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = 'varying vec3 vKPos;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvKPos = position;');
    sh.fragmentShader = `varying vec3 vKPos;
      uniform vec3 uTop, uBot, uSkin, uHair, uHeadC, uHeadH; uniform float uTopMin, uBotMax, uBald, uBeard, uDebug, uHatCut;
      vec3 kHsv(vec3 c) { vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0); vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
        vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r)); float d = q.x - min(q.w, q.y); return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-10)), d / (q.x + 1e-10), q.x); }
      float kHue(float h, float c, float w) { float d = abs(h - c); d = min(d, 1.0 - d); return 1.0 - smoothstep(w * 0.55, w, d); }
      float kHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      vec3 kLin(vec3 c) { return pow(max(c, vec3(0.0)), vec3(2.2)); }
    ` + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
      {
        vec3 sc = pow(max(diffuseColor.rgb, vec3(0.0)), vec3(1.0 / 2.2)), hsv = kHsv(sc);
        if (vKPos.y > uHatCut) discard; // inside a hat
        vec3 q = (vKPos - uHeadC) / uHeadH; // -1..1 across the head
        float head = step(-1.05, q.y);
        float sat = smoothstep(0.30, 0.46, hsv.y);
        float wTop = kHue(hsv.x, 0.27, 0.10) * sat * step(uTopMin, vKPos.y);
        float wBot = kHue(hsv.x, 0.625, 0.085) * sat * (1.0 - step(uBotMax, vKPos.y));
        float wSkin = kHue(hsv.x, 0.075, 0.065) * smoothstep(0.08, 0.17, hsv.y) * (1.0 - smoothstep(0.66, 0.8, hsv.y)) * smoothstep(0.28, 0.42, hsv.z);
        // the eyes and brows (kept as painted): a band across the front of the face
        float eyes = step(0.25, q.z) * step(-0.36, q.y) * step(q.y, 0.18) * step(abs(q.x), 0.78);
        float wHair = step(-0.62, q.y) * head * (1.0 - smoothstep(0.26, 0.38, hsv.z)) * (1.0 - smoothstep(0.3, 0.5, hsv.y)) * (1.0 - eyes);
        vec3 col = sc;
        col = mix(col, uTop * clamp(hsv.z / 0.86, 0.0, 1.25), wTop);
        col = mix(col, uBot * clamp(hsv.z / 0.70, 0.0, 1.35), wBot);
        col = mix(col, uSkin * clamp(hsv.z / 0.93, 0.0, 1.15), wSkin);
        vec3 hairCol = uBald > 0.5 ? uSkin * (0.88 + 0.25 * hsv.z) : uHair * (0.5 + 1.7 * hsv.z);
        col = mix(col, hairCol, wHair);
        // painted facial hair, on the skin of the lower face (head coordinates q: nose about -0.43, mouth -0.55, chin -0.72)
        if (uBeard > 0.5) {
          float ax = abs(q.x), front = smoothstep(-0.15, 0.1, q.z);
          float jawTop = mix(-0.6, -0.34, smoothstep(0.22, 0.75, ax)); // under the mouth in the middle, up the cheeks at the sides
          float jaw = (1.0 - smoothstep(jawTop - 0.03, jawTop + 0.03, q.y)) * smoothstep(-0.86, -0.8, q.y) * front;
          float side = smoothstep(0.66, 0.74, ax) * (1.0 - smoothstep(-0.16, -0.1, q.y)) * smoothstep(-0.12, -0.05, q.z) * (1.0 - smoothstep(0.42, 0.5, q.z));
          float lip = (1.0 - smoothstep(0.17, 0.22, ax)) * smoothstep(-0.61, -0.59, q.y) * (1.0 - smoothstep(-0.53, -0.51, q.y)) * step(0.55, q.z);
          float mus = (1.0 - smoothstep(0.3, 0.37, ax)) * smoothstep(-0.55, -0.525, q.y) * (1.0 - smoothstep(-0.46, -0.44, q.y)) * step(0.55, q.z);
          float full = max(max(jaw, side) * (1.0 - lip), mus);
          float b = uBeard < 1.5 ? max(jaw, side) * (1.0 - lip) * (0.3 + 0.18 * kHash(floor(vKPos * 700.0))) // stubble
                  : uBeard < 3.5 ? full                                                                         // beard, big beard
                  : mus;                                                                                         // mustache
          col = mix(col, uHair * (0.55 + 0.9 * hsv.z), clamp(b, 0.0, 1.0) * wSkin);
        }
        if (uDebug > 1.5) { float b = floor(-q.y * 10.0); col = b == 3.0 ? vec3(1,0,1) : b == 4.0 ? vec3(1,1,0) : b == 5.0 ? vec3(1,0,0) : b == 6.0 ? vec3(0,1,0) : b == 7.0 ? vec3(0,0,1) : b == 8.0 ? vec3(0,1,1) : b == 9.0 ? vec3(1,0.5,0) : sc;
          if (abs(fract(q.x * 5.0 + 0.5) - 0.5) < 0.03) col = vec3(0.0); if (abs(q.z - 0.5) < 0.02) col = vec3(1.0); }
        else if (uDebug > 0.5) col = vec3(wTop, wBot, wSkin) + vec3(wHair, 0.0, wHair) + vec3(0.0, eyes * 0.5, 0.0);
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
function buildShades(kind, color, w) { // w: the face's width at the eyes
  const g = new THREE.Group(), frameM = toon({ color }), s = w / 2;
  const lensM = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(0.3), transparent: true, opacity: 0.85 });
  const glow = [];
  if (kind === 1) for (const x of [-1, 1]) { // round
    const ring = new THREE.Mesh(new THREE.TorusGeometry(s * 0.34, s * 0.045, 8, 28), frameM); ring.position.set(x * s * 0.42, 0, 0); g.add(ring);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(s * 0.33, 28), lensM); lens.position.set(x * s * 0.42, 0, -s * 0.01); lens.userData.noInk = true; g.add(lens);
  }
  if (kind === 2) { // hearts
    const hs = new THREE.Shape(); hs.moveTo(0, -0.5); hs.bezierCurveTo(-0.7, -0.05, -0.45, 0.55, 0, 0.22); hs.bezierCurveTo(0.45, 0.55, 0.7, -0.05, 0, -0.5);
    for (const x of [-1, 1]) {
      const back = new THREE.Mesh(new THREE.ShapeGeometry(hs, 14), frameM); back.scale.setScalar(s * 0.8); back.position.set(x * s * 0.42, s * 0.04, -s * 0.01); g.add(back);
      const lens = new THREE.Mesh(new THREE.ShapeGeometry(hs, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(0.55), transparent: true, opacity: 0.9 })); lens.scale.setScalar(s * 0.68); lens.position.set(x * s * 0.42, s * 0.04, s * 0.005); lens.userData.noInk = true; g.add(lens);
    }
  }
  if (kind === 3 || kind === 4) { // shutter shades, or LED ones that cycle colours
    const led = kind === 4, barM = led ? new THREE.MeshBasicMaterial({ color }) : frameM; if (led) glow.push(barM);
    for (const x of [-1, 1]) {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(s * 0.72, s * 0.46, s * 0.05), toon({ color: 0x1f1f2e })); frame.position.set(x * s * 0.42, 0, -s * 0.02); g.add(frame);
      for (let i = 0; i < 4; i++) { const bar = new THREE.Mesh(new THREE.BoxGeometry(s * 0.68, s * 0.065, s * 0.05), barM); bar.position.set(x * s * 0.42, -s * 0.17 + i * s * 0.112, s * 0.02); bar.userData.noInk = true; g.add(bar); }
    }
  }
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(s * 0.22, s * 0.05, s * 0.05), frameM); bridge.position.set(0, s * 0.08, 0); g.add(bridge);
  for (const x of [-1, 1]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(s * 0.04, s * 0.04, s * 1.0), frameM); arm.position.set(x * s * 0.84, s * 0.04, -s * 0.5); g.add(arm); }
  g.userData.glow = glow;
  return g;
}

// ---------- tuning: how the hair pieces sit on the head (head-bone space, fractions of the head box) ----------
const HAIR_FIT = { scale: 1.0, y: 0.16, z: -0.12, per: { spiky: {}, long: {}, buns: {}, curly: {}, locs: {}, undercut: {} } };
export const _tune = { HAIR_FIT }; // for the dev viewer

/**
 * An explorer about 1 unit tall, feet at y = 0, facing +z. L is a full look (see art.js lookOf): body (cut), style
 * (hairstyle), hairC, top, bottom, skinC, beard, hat, hatC, glasses, glassC. userData.update(dt, speed) walks or idles.
 */
export function makeExplorer3D(L, opts = {}) {
  const src = bodies[L.body % CUTS.length];
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
  const attach = new THREE.Group(); attach.position.copy(hc); headBone.add(attach); // the middle of the head
  const glow = [];
  // hair
  const hairName = HAIR_FILE[L.style], hairSrc = hairName && hairs[L.style];
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
      if (!opts.noInk) { const ink = inkFor(o, 0.004); if (U) { ink.material = ink.material.clone(); cutAbove(ink.material, U); } }
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
    const sh = buildShades(L.glasses, L.glassC, hs.x * 0.86); sh.position.set(0, -hs.y * 0.02, hs.z * 0.47); attach.add(sh); glow.push(...sh.userData.glow);
    if (!opts.noInk) { const list = []; sh.traverse(o => { if (o.isMesh && !o.userData.noInk) list.push(o); }); list.forEach(o => inkFor(o, 0.003)); }
  }
  // a big beard also gets some volume: a soft tapered shape from the jaw down onto the chest
  if (L.beard === 3) {
    const geo = new THREE.SphereGeometry(1, 24, 16), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i), k = y < 0 ? 1 + y * 0.55 : 1; p.setXYZ(i, p.getX(i) * k, y, p.getZ(i) * k * (y > 0 ? 0.8 : 1)); }
    geo.computeVertexNormals();
    const bulk = new THREE.Mesh(geo, toon({ color: L.hairC })); bulk.scale.set(hs.x * 0.3, hs.y * 0.2, hs.z * 0.22); bulk.position.set(0, -hs.y * 0.42, hs.z * 0.22); attach.add(bulk);
    if (!opts.noInk) inkFor(bulk, 0.004);
  }
  // bald: the short hair above the hairline is hidden and a smooth scalp takes its place
  if (L.style === 7 && !crowned) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < cloud.length; i += 3) { const y = cloud[i + 1]; if (Math.abs(y - brimY) > hs.y * 0.04) continue; x0 = Math.min(x0, cloud[i]); x1 = Math.max(x1, cloud[i]); z0 = Math.min(z0, cloud[i + 2]); z1 = Math.max(z1, cloud[i + 2]); }
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2 + 0.25), toon({ color: opts.debug ? 0xff0000 : L.skinC }));
    dome.scale.set((x1 - x0) / 2 * 0.93, hs.y * 0.3, (z1 - z0) / 2 * 0.95); dome.position.set((x0 + x1) / 2, brimY, (z0 + z1) / 2 - hs.z * 0.01); attach.add(dome);
    hideHeadAbove(brimY);
    if (!opts.noInk) inkFor(dome, 0.004);
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
      for (let i = 0; i < glow.length; i++) glow[i].color.setHSL((t * 0.25 + i * 0.3) % 1, 1, 0.6);
    },
  };
  return root;
}
