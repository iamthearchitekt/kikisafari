// The title screen (owner: "cosmic purple portal style", with underbrush in the foreground and trees framing the sides
// and top; "just the one main Kiki"): a swirling portal in a forest clearing at night. Kiki pops out of the portal,
// lands in the clearing and waves and dances; fireflies drift; ferns and bushes fill the foreground, trees and a leafy canopy frame the edges.
import * as THREE from '../vendor/three.module.min.js';
import { makeKiki, KikiMotion, makePortal, Sparkles, leafGeometry, plush } from './art.js';
import { liveStage } from './ui.js';
import { reducedMotion } from './services.js';

const C = h => new THREE.Color(h);
const LEAF = plush({ color: 0xffffff, vertexColors: true, roughness: 0.55, side: THREE.DoubleSide }, 0.35);
function vgrad(geo, a, b, y0, y1) {
  const p = geo.attributes.position, cols = [];
  for (let i = 0; i < p.count; i++) { const t = Math.max(0, Math.min(1, (p.getY(i) - y0) / (y1 - y0))); const c = C(a).lerp(C(b), t); cols.push(c.r, c.g, c.b); }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); return geo;
}
const leafy = (r, dark = 0x0f3d2a, light = 0x3f9a4a) => new THREE.Mesh(vgrad(new THREE.IcosahedronGeometry(r, 2), dark, light, -r, r), plush({ vertexColors: true, roughness: 0.8 }, 0.3));
/** A fern: long fronds fanning up and out. */
function fern(size, dark = 0x165c2e, tip = 0x7fd65a) {
  const g = new THREE.Group();
  for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(leafGeometry(0.28, 0.7, dark, tip, true), LEAF); m.rotation.set(-(0.35 + (i % 3) * 0.28), i / 9 * Math.PI * 2, 0, 'YXZ'); m.scale.setScalar(size * (0.8 + (i % 2) * 0.35)); g.add(m); }
  return g;
}
/** A round bush with a few flowers. */
function bush(r, flowers = 0xff8fc8) {
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, b = leafy(r * (0.45 + (i % 3) * 0.12)); b.position.set(Math.cos(a) * r * 0.55, r * (0.2 + (i % 2) * 0.25), Math.sin(a) * r * 0.35); g.add(b); }
  const top = leafy(r * 0.6); top.position.y = r * 0.55; g.add(top);
  for (let i = 0; i < 5; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(r * 0.07, 8, 6), new THREE.MeshBasicMaterial({ color: i % 2 ? flowers : 0xfff27a })); const a = i * 1.7; f.position.set(Math.cos(a) * r * 0.6, r * (0.45 + (i % 3) * 0.2), r * 0.45); g.add(f); }
  return g;
}
/** A tree trunk leaning in from the side, with a leafy crown and a hanging vine. */
function tree(h, side) {
  const g = new THREE.Group();
  const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector3(side * -0.6 * Math.sin(t * 1.4) , t * h, 0)); }
  const trunk = new THREE.Mesh(vgrad(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.42, 10), 0x2a1a12, 0x5a3a26, 0, h), plush({ vertexColors: true, roughness: 0.9 }, 0.25));
  g.add(trunk);
  for (let i = 0; i < 7; i++) { const b = leafy(0.9 + (i % 3) * 0.3); b.position.set(side * (-0.5 - i * 0.28) + (i % 2) * 0.3, h - 0.3 + (i % 3) * 0.45, (i % 2) * 0.4); g.add(b); }
  for (let v = 0; v < 2; v++) { const vx = side * (-0.55 - v * 0.45), vine = []; for (let i = 0; i <= 8; i++) vine.push(new THREE.Vector3(vx + Math.sin(i * 0.8) * 0.08, h - 0.4 - i * 0.35, 0.5)); g.add(new THREE.Mesh(vgrad(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(vine), 16, 0.035, 5), 0x1f5a2a, 0x3f8a3a, h - 3, h), plush({ vertexColors: true }, 0.2)));
    for (let i = 1; i < 8; i += 2) { const l = new THREE.Mesh(leafGeometry(0.4, 0.8, 0x1f6a30, 0x8fe05a, true), LEAF); l.position.set(vx, h - 0.4 - i * 0.35, 0.5); l.rotation.set(0.6, (i % 4 ? 1 : -1) * 1.2, 0, 'YXZ'); l.scale.setScalar(0.45); g.add(l); } }
  return g;
}
/** Big leaves hanging down from the canopy across the top. */
function canopy(width) {
  const g = new THREE.Group();
  for (let i = 0; i < 9; i++) { const b = leafy(0.9 + (i % 3) * 0.3); b.position.set((i / 8 - 0.5) * width, (i % 2) * 0.35, (i % 3) * 0.2); g.add(b); }
  for (let i = 0; i < 14; i++) { const l = new THREE.Mesh(leafGeometry(0.45, 0.8, 0x175a2c, 0x7fd65a, true), LEAF); l.position.set((i / 13 - 0.5) * width * 1.05, -0.5, 0.6); l.rotation.set(-(Math.PI / 2 + 0.35 + (i % 3) * 0.2), (i % 2 ? 0.4 : -0.4), 0, 'YXZ'); l.scale.setScalar(0.9 + (i % 3) * 0.3); g.add(l); }
  return g;
}

export function startTitle(host) {
  return liveStage(host, (scene, cam) => {
    cam.fov = 55; cam.position.set(0, 0.2, 8); cam.lookAt(0, 0.1, 0); cam.updateProjectionMatrix();
    scene.add(new THREE.HemisphereLight(0xb89aff, 0x1a0f3a, 0.9));
    const glow = new THREE.PointLight(0xa24dff, 30, 14, 1.6); glow.position.set(0, 0.5, -1.2); scene.add(glow);
    const warm = new THREE.DirectionalLight(0xffe6c0, 1.4); warm.position.set(2, 4, 8); scene.add(warm);
    const portal = makePortal(4.6); portal.position.set(0, 0.9, -2.6); portal.userData.target = 1; scene.add(portal);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(9, 48), new THREE.MeshStandardMaterial({ color: 0x1f3a2a, roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -1.08; scene.add(ground);
    const sparkles = new Sparkles(scene);
    // the frame: trees, canopy and underbrush, placed to fit whatever shape the screen is
    const frame = new THREE.Group(); scene.add(frame);
    let parts = null, aspect = 0;
    const fit = () => {
      aspect = cam.aspect; frame.clear(); parts = [];
      const at = z => { const d = cam.position.z - z, hh = Math.tan(cam.fov * Math.PI / 360) * d; return { hh, hw: hh * cam.aspect }; };
      { const { hh, hw } = at(1); for (const s of [-1, 1]) { const t = tree(hh * 2.4, s); t.position.set(s * (hw + 0.15), -hh - 1.2, 1); frame.add(t); parts.push(t); } }
      { const { hh, hw } = at(1.8); const c = canopy(hw * 2.4); c.position.set(0, hh * 0.98, 1.8); frame.add(c); }
      { const { hh, hw } = at(3.2), n = Math.max(5, Math.round(hw * 2.2));
        for (let i = 0; i <= n; i++) { const x = (i / n - 0.5) * hw * 2.3, corner = Math.abs(x) > hw * 0.6, f = i % 2 ? fern(corner ? 0.95 : 0.6) : bush(corner ? 0.8 : 0.5, ['#ff8fc8', '#fff27a', '#9fd8ff'][i % 3]);
          f.position.set(x, cam.position.y - hh - 0.15 + (corner ? 0.3 : 0), 3.2 + (i % 2) * 0.3); f.rotation.y = i * 0.7; frame.add(f); parts.push(f); }
        for (const s of [-1, 1]) { const f = fern(1.0); f.position.set(s * hw * 1.02, cam.position.y - hh * 0.45, 2.8); f.rotation.z = s * 0.9; frame.add(f); } }
    };
    // Kiki pops out of the portal and lands in the clearing, then waves and dances.
    const k = makeKiki('meadow', 1.35), m = new KikiMotion(k, reducedMotion), base = k.scale.x, home = new THREE.Vector3(0, -1.06, -0.2);
    k.visible = false; scene.add(k); const born = 0.7; let landed = false, fly = 0;
    return { update(dt, t) {
      if (cam.aspect !== aspect) fit();
      portal.userData.update(dt, t, cam); glow.intensity = 26 + Math.sin(t * 2) * 6;
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
