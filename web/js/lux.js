// The premium look for every 3D view (owner: "elevate all elements of the game that exist in 3D … premium … that extra
// layer of care and dialing in"): film-style tone mapping (Khronos PBR Neutral: highlights roll off softly, brand colours
// stay true) and a soft light environment for gentle reflections and sheen: a sky gradient and two studio softboxes,
// made in code (no image files) once per renderer.
import * as THREE from '../vendor/three.module.min.js';

export function premium(renderer, exposure = 1) { renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = exposure; return renderer; }

const PALETTES = {
  day: { top: 0xdcefff, horizon: 0xfff1dc, ground: 0x7a8a62, key: 0xffffff, rim: 0xcfe6ff },
  night: { top: 0x5b4fc0, horizon: 0x2e2670, ground: 0x120e28, key: 0xd8ccff, rim: 0x9a7aff },
  cosmic: { top: 0xc39cff, horizon: 0x7a3ad6, ground: 0x1a0f3a, key: 0xf3e6ff, rim: 0xff7ad9 },
};
const made = new WeakMap();
/** A pre-filtered environment texture for scene.environment ('day', 'night' or 'cosmic'). */
export function environment(renderer, kind = 'day') {
  let m = made.get(renderer); if (!m) made.set(renderer, m = {});
  if (m[kind]) return m[kind];
  const P = PALETTES[kind] || PALETTES.day, scene = new THREE.Scene();
  const geo = new THREE.SphereGeometry(10, 48, 24), pos = geo.attributes.position, col = [], top = new THREE.Color(P.top), hor = new THREE.Color(P.horizon), gnd = new THREE.Color(P.ground);
  for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) / 10, c = y > 0 ? hor.clone().lerp(top, Math.pow(y, 0.6)) : hor.clone().lerp(gnd, Math.pow(-y, 0.5)); col.push(c.r, c.g, c.b); }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  scene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true })));
  const softbox = (w, h, x, y, z, c, k) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), side: THREE.DoubleSide })); p.position.set(x, y, z); p.lookAt(0, 0, 0); scene.add(p); };
  softbox(7, 4.5, -4, 6, 5, P.key, 2.6);   // the key light: big, soft, up and to the left
  softbox(5, 2.5, 5.5, 2.5, -4, P.rim, 1.6); // a rim light behind on the right
  softbox(10, 1.2, 0, -1, 8, P.horizon, 1.2); // a soft bounce low in front
  const pm = new THREE.PMREMGenerator(renderer), rt = pm.fromScene(scene, 0.035); pm.dispose();
  geo.dispose(); return (m[kind] = rt.texture);
}
/** Give a scene the premium light (kind as above, strength 0..1). */
export function light(renderer, scene, kind = 'day', strength = 0.6) { scene.environment = environment(renderer, kind); scene.environmentIntensity = strength; }
