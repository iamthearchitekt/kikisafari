// The street map: your real streets from OpenStreetMap in the sticker style (ported from the Unity project's
// StreetMapGeometry), with you, the Kikis, supply stops and Rune Circles. Drag to turn, pinch or scroll to zoom,
// tap anything within 40 m. Map data © OpenStreetMap contributors.
import * as THREE from '../vendor/three.module.min.js';
import * as C from './core.js';
import { roadHalf } from './osm.js';
import { makeKiki, KikiMotion, makeRuneStone, makeCircle } from './art.js';
import { reducedMotion } from './services.js';

const DAY = { park: 0x8fd45e, woods: 0x4fa046, grass: 0xa6dc74, water: 0x45d6e6, casing: 0xb9bedd, road: 0xffffff, main: 0xffe58a, path: 0xf3dfa8, rail: 0x6b6f8c, roof: 0xf4ecff, wall: 0xcfc4ea, land: 0xe9f3d6 };
const NIGHT = { park: 0x2e5a63, woods: 0x22434f, grass: 0x34636b, water: 0x2e4c8c, casing: 0x1c2350, road: 0x5a5f9a, main: 0x8b6fd8, path: 0x4a4f7a, rail: 0x14183a, roof: 0x6b5fa8, wall: 0x463d7a, land: 0x22304f };
const MAJOR = new Set(['motorway', 'trunk', 'primary', 'secondary']);

class Layer {
  constructor() { this.pos = []; this.col = []; }
  tri(a, b, c, color) { const k = new THREE.Color(color); for (const p of [a, b, c]) { this.pos.push(p[0], p[1], p[2]); this.col.push(k.r, k.g, k.b); } }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals(); return g;
  }
}

function flat(layer, pts, y, color) {
  const ring = pts.slice(); if (ring.length > 1 && ring[0].x === ring[ring.length - 1].x && ring[0].z === ring[ring.length - 1].z) ring.pop();
  if (ring.length < 3) return;
  const v2 = ring.map(p => new THREE.Vector2(p.x, p.z));
  for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(v2, [])) layer.tri([ring[a].x, y, ring[a].z], [ring[b].x, y, ring[b].z], [ring[c].x, y, ring[c].z], color);
}
function ribbon(layer, pts, width, y, color) {
  const n = pts.length; if (n < 2) return; const hw = width / 2, L = [], R = [];
  const dir = (a, b) => { const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l]; };
  for (let i = 0; i < n; i++) {
    const d0 = i > 0 ? dir(pts[i - 1], pts[i]) : dir(pts[i], pts[i + 1]), d1 = i < n - 1 ? dir(pts[i], pts[i + 1]) : d0;
    let nx = -(d0[1] + d1[1]), nz = d0[0] + d1[0], l = Math.hypot(nx, nz); if (l < 1e-6) { nx = -d0[1]; nz = d0[0]; l = 1; } nx /= l; nz /= l;
    const sc = hw / Math.max(0.5, nx * -d0[1] + nz * d0[0]), ext = (i === 0 ? -1 : i === n - 1 ? 1 : 0) * hw * 0.5, dd = i === 0 ? d0 : d1;
    const px = pts[i].x + dd[0] * ext, pz = pts[i].z + dd[1] * ext;
    L.push([px + nx * sc, y, pz + nz * sc]); R.push([px - nx * sc, y, pz - nz * sc]);
  }
  for (let i = 0; i < n - 1; i++) { layer.tri(L[i], R[i], L[i + 1], color); layer.tri(R[i], R[i + 1], L[i + 1], color); }
}
function building(layer, pts, h, pal) {
  const ring = pts.slice(); if (ring.length > 1 && ring[0].x === ring[ring.length - 1].x && ring[0].z === ring[ring.length - 1].z) ring.pop();
  if (ring.length < 3) return;
  const wall = new THREE.Color(pal.wall);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz); if (l < 1e-6) continue;
    const shade = 0.82 + 0.18 * Math.abs(dz / l); const c = wall.clone().multiplyScalar(shade);
    layer.tri([a.x, 0.06, a.z], [b.x, 0.06, b.z], [b.x, h, b.z], c); layer.tri([a.x, 0.06, a.z], [b.x, h, b.z], [a.x, h, a.z], c);
  }
  flat(layer, ring, h, pal.roof);
}

export class StreetMap {
  constructor(app) {
    this.app = app; this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 2, 4000);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xb0a8d8, 1.8)); const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(-200, 400, 150); this.scene.add(sun);
    this.layers = new THREE.Group(); this.scene.add(this.layers); this.things = new THREE.Group(); this.scene.add(this.things);
    this.origin = null; this.built = new Set(); this.waiting = []; this.views = new Map(); this.dist = 420; this.yaw = null; this.night = false; this.player = this.makePlayer(); this.scene.add(this.player);
    this.mats = [0, 1, 2, 3, 4].map(i => { const m = new THREE.MeshBasicMaterial({ vertexColors: true, depthWrite: false, side: THREE.DoubleSide }); return m; });
    this.buildMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  }
  pal() { return this.night ? NIGHT : DAY; }
  local(p) { const l = C.toLocal(this.origin, p); return new THREE.Vector3(l.e, 0, -l.n); }

  ensureOrigin(me) {
    if (this.origin) return;
    this.origin = { ...me }; this.night = C.isNight(me, new Date()) || this.app.debugNight();
    this.scene.background = new THREE.Color(this.pal().land);
    // Areas that loaded before the map was first opened.
    for (const [cell, area] of this.waiting.splice(0)) this.addArea(cell, area);
  }

  addArea(cell, area) {
    const key = cell.x + ':' + cell.y; if (this.built.has(key)) return;
    if (!this.origin) { this.waiting.push([cell, area]); return; }
    this.built.add(key);
    const pal = this.pal(), L = [new Layer(), new Layer(), new Layer(), new Layer(), new Layer()], B = new Layer();
    const o = C.toLocal(this.origin, area.origin), P = f => f.local.map(p => ({ x: p.e + o.e, z: -(p.n + o.n) }));
    for (const f of area.features) {
      switch (f.kind) {
        case 'park': if (f.poly) flat(L[0], P(f), 0.02, pal.park); break;
        case 'grass': if (f.poly) flat(L[0], P(f), 0.015, pal.grass); break;
        case 'woods': if (f.poly) flat(L[0], P(f), 0.025, pal.woods); break;
        case 'water': if (f.poly) flat(L[1], P(f), 0.03, pal.water); break;
        case 'waterline': ribbon(L[1], P(f), f.cat === 'river' ? 14 : 5, 0.032, pal.water); break;
        case 'road': { const w = roadHalf(f.cat) * 2; ribbon(L[2], P(f), w + 2.2, 0.04, pal.casing); ribbon(L[3], P(f), w, 0.05, MAJOR.has(f.cat) ? pal.main : pal.road); break; }
        case 'path': ribbon(L[4], P(f), f.cat === 'pedestrian' ? 6 : 2.4, 0.055, pal.path); break;
        case 'rail': ribbon(L[4], P(f), 2.2, 0.058, pal.rail); break;
        case 'building': if (f.poly) building(B, P(f), Math.min(24, f.height * 0.8), pal); break;
      }
    }
    const g = new THREE.Group();
    L.forEach((l, i) => { if (!l.pos.length) return; const m = new THREE.Mesh(l.geometry(), this.mats[i]); m.renderOrder = -10 + i; g.add(m); });
    if (B.pos.length) g.add(new THREE.Mesh(B.geometry(), this.buildMat));
    this.layers.add(g);
  }

  makePlayer() {
    const g = new THREE.Group();
    const puck = new THREE.Mesh(new THREE.SphereGeometry(3.2, 22, 12), new THREE.MeshLambertMaterial({ color: 0xfff8de })); puck.scale.y = 0.5; puck.position.y = 1.6; g.add(puck);
    const ring = (r0, r1, color, y, op = 1) => { const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 96), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: op < 1, opacity: op, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.y = y; m.renderOrder = -2; g.add(m); return m; };
    ring(3.4, 4.8, 0x18237a, 0.5); ring(C.ACTION - 0.9, C.ACTION, 0xffffff, 0.4, 0.9);
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(1.8, 3.4, 3), new THREE.MeshBasicMaterial({ color: 0xff5d8f })); arrow.rotation.x = -Math.PI / 2; arrow.position.set(0, 0.6, -6.5); g.add(arrow);
    return g;
  }

  makeThing(t) {
    const g = new THREE.Group(); g.userData.thing = t;
    if (t.kind === 'kiki') {
      const k = makeKiki(t.variant.id, 6); k.rotation.y = Math.PI * 0.85; g.add(k); g.userData.motion = new KikiMotion(k, reducedMotion);
      const r = new THREE.Mesh(new THREE.RingGeometry(3.4, 4.6, 48), new THREE.MeshBasicMaterial({ color: C.RARITY[t.variant.rarity].main, side: THREE.DoubleSide, depthWrite: false })); r.rotation.x = -Math.PI / 2; r.position.y = 0.3; r.renderOrder = -3; g.add(r);
    } else if (t.kind === 'stop') {
      const s = makeRuneStone(0.04); s.scale.setScalar(70); s.position.y = 7; g.add(s); g.userData.stone = s;
      const r = new THREE.Mesh(new THREE.RingGeometry(4.5, 6, 48), new THREE.MeshBasicMaterial({ color: 0xff5d8f, side: THREE.DoubleSide, depthWrite: false })); r.rotation.x = -Math.PI / 2; r.position.y = 0.3; r.renderOrder = -3; g.add(r);
    } else {
      const c = makeCircle(t.variant.id); c.scale.setScalar(3.2); g.add(c); g.userData.circle = c;
    }
    const hit = new THREE.Mesh(new THREE.SphereGeometry(t.kind === 'circle' ? 11 : 7, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 4; hit.userData.hitFor = g; g.add(hit); g.userData.hit = hit;
    return g;
  }

  update(dt, time, me, heading, things) {
    this.ensureOrigin(me);
    if (this.yaw === null) this.yaw = heading;
    const target = this.local(me);
    this.player.position.lerp(target, this.player.position.lengthSq() ? 1 - Math.exp(-dt * 4) : 1);
    this.player.rotation.y = -heading * Math.PI / 180;
    const h = this.yaw * Math.PI / 180, tilt = 54 * Math.PI / 180, f = new THREE.Vector3(Math.sin(h), 0, -Math.cos(h));
    this.camera.position.copy(this.player.position).addScaledVector(f, -this.dist * Math.cos(tilt)).add(new THREE.Vector3(0, this.dist * Math.sin(tilt), 0));
    this.camera.lookAt(this.player.position);
    const keep = new Set();
    for (const t of things) {
      if (t.distance > 400) continue; keep.add(t.id);
      let v = this.views.get(t.id); if (!v) { v = this.makeThing(t); this.views.set(t.id, v); this.things.add(v); v.position.copy(this.local(t.where)); }
      v.userData.thing = t; v.position.lerp(this.local(t.where), 1 - Math.exp(-dt * 4));
      if (v.userData.motion) v.userData.motion.update(dt);
      if (v.userData.stone) { v.userData.stone.rotation.set(-1.2, time, 0); v.userData.stone.userData.update(dt, time); }
      if (v.userData.circle) { v.userData.circle.userData.portal.userData.update(dt, time, this.camera); v.userData.circle.userData.setKeeper(t.variant.id); if (v.userData.circle.userData.motion) v.userData.circle.userData.motion.update(dt); }
    }
    for (const [id, v] of this.views) if (!keep.has(id)) { this.things.remove(v); this.views.delete(id); }
  }

  tap(x, y) {
    const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1), this.camera);
    const hits = ray.intersectObjects([...this.views.values()].map(v => v.userData.hit), false);
    if (hits.length) this.app.interact(hits[0].object.userData.hitFor.userData.thing);
  }
  rotate(dxPx) { this.yaw = (this.yaw || 0) + dxPx / innerWidth * 180; }
  zoom(f) { this.dist = Math.max(160, Math.min(1100, this.dist * f)); }
}
