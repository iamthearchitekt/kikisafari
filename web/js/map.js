// The street map: your real streets from OpenStreetMap in the sticker style (ported from the Unity project's
// StreetMapGeometry), with you, the Kikis, supply stops and Rune Circles. Drag to turn, pinch or scroll to zoom,
// tap anything within 40 m. Map data © OpenStreetMap contributors.
import * as THREE from '../vendor/three.module.min.js';
import * as C from './core.js';
import { roadHalf } from './osm.js';
import { makeKiki, KikiMotion, makeRuneStone, makeCircle, makeExplorer, makeRustle } from './art.js';
import { STOP_COOLDOWN } from './rules.js';
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
    this.origin = null; this.built = new Set(); this.waiting = []; this.views = new Map(); this.dist = 230; this.yaw = null; this.night = false; this.player = this.makePlayer(); this.scene.add(this.player); this.walkSpeed = 0; this.facing = 0;
    this.mats = [0, 1, 2, 3, 4].map(i => { const m = new THREE.MeshBasicMaterial({ vertexColors: true, depthWrite: false, side: THREE.DoubleSide }); return m; });
    this.buildMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  }
  pal() { return this.night ? NIGHT : DAY; }
  local(p) { const l = C.toLocal(this.origin, p); return new THREE.Vector3(l.e, 0, -l.n); }

  ensureOrigin(me) {
    if (this.origin) return;
    this.origin = { ...me }; this.night = C.isNight(me, new Date()) || this.app.debugNight();
    this.scene.background = new THREE.Color(this.pal().land);
    this.scene.fog = new THREE.Fog(this.pal().land, 400, 900); // the map fades softly into the distance
    this.makeSky();
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
    const ring = (r0, r1, color, y, op = 1) => { const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 96), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: op < 1, opacity: op, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.y = y; m.renderOrder = -2; g.add(m); return m; };
    ring(C.ACTION - 0.9, C.ACTION, 0xffffff, 0.4, 0.9);
    const e = this.app.progress.explorer; this.setExplorer(g, e.outfit, e.skin);
    return g;
  }
  /** Your explorer, about 12 m tall on the map so you can see them at any zoom (things on the map are drawn big, like a board game). */
  setExplorer(g = this.player, outfit = 0, skin = 1) {
    if (this.avatar) g.remove(this.avatar);
    this.avatar = makeExplorer(outfit, skin); this.avatar.scale.setScalar(12); g.add(this.avatar);
  }

  makeThing(t) {
    const g = new THREE.Group(); g.userData.thing = t;
    if (t.kind === 'kiki' && t.distance > C.VISIBLE) {
      const r = makeRustle(); r.scale.setScalar(4); g.add(r); g.userData.rustle = r; g.userData.hidden = true;
    } else if (t.kind === 'kiki') {
      const k = makeKiki(t.variant.id, 10); k.rotation.y = Math.PI * 0.85; g.add(k); g.userData.motion = new KikiMotion(k, reducedMotion); g.userData.kiki = k;
      const r = new THREE.Mesh(new THREE.RingGeometry(5, 6.6, 48), new THREE.MeshBasicMaterial({ color: C.RARITY[t.variant.rarity].main, side: THREE.DoubleSide, depthWrite: false })); r.rotation.x = -Math.PI / 2; r.position.y = 0.3; r.renderOrder = -3; g.add(r);
      g.userData.base = k.scale.x; k.scale.setScalar(0.0001); g.userData.pop = 0; // pops up out of the leaves
    } else if (t.kind === 'stop') {
      const s = makeRuneStone(0.04); s.scale.setScalar(110); s.position.y = 9; g.add(s); g.userData.stone = s;
      const r = new THREE.Mesh(new THREE.RingGeometry(6, 8, 48), new THREE.MeshBasicMaterial({ color: 0xff5d8f, side: THREE.DoubleSide, depthWrite: false })); r.rotation.x = -Math.PI / 2; r.position.y = 0.3; r.renderOrder = -3; g.add(r); g.userData.ring = r;
      const disc = new THREE.Mesh(new THREE.CircleGeometry(6, 40), new THREE.MeshBasicMaterial({ color: 0xff5d8f, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false })); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.28; disc.renderOrder = -3; g.add(disc); g.userData.disc = disc;
    } else {
      const c = makeCircle(t.variant.id); c.scale.setScalar(3.6); g.add(c); g.userData.circle = c;
    }
    const hit = new THREE.Mesh(new THREE.SphereGeometry(t.kind === 'circle' ? 9 : 8, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = t.kind === 'circle' ? 5 : 6; hit.userData.hitFor = g; g.add(hit); g.userData.hit = hit;
    return g;
  }

  update(dt, time, me, heading, things) {
    this.ensureOrigin(me);
    if (this.yaw === null) this.yaw = heading;
    const target = this.local(me), prev = this.player.position.clone();
    this.player.position.lerp(target, this.player.position.lengthSq() ? 1 - Math.exp(-dt * 4) : 1);
    const step = this.player.position.clone().sub(prev); step.y = 0;
    const v = dt > 0 ? step.length() / dt : 0; this.walkSpeed += (Math.min(v, 4) - this.walkSpeed) * Math.min(1, dt * 3);
    // face where you're walking; standing still, face where the phone points
    const want = this.walkSpeed > 0.4 && step.lengthSq() > 1e-6 ? Math.atan2(step.x, step.z) : Math.PI - heading * Math.PI / 180;
    let d = want - this.facing; d = Math.atan2(Math.sin(d), Math.cos(d)); this.facing += d * Math.min(1, dt * 6);
    this.avatar.rotation.y = this.facing; this.avatar.userData.update(dt, this.walkSpeed > 0.25 ? this.walkSpeed : 0);
    this.updateBuddy(dt); this.updateWeather(dt); this.updateSky(dt, time);
    if (this.scene.fog) { this.scene.fog.near = this.dist * 1.7; this.scene.fog.far = this.dist * 3.6; }
    const h = this.yaw * Math.PI / 180, tilt = 54 * Math.PI / 180, f = new THREE.Vector3(Math.sin(h), 0, -Math.cos(h));
    this.camera.position.copy(this.player.position).addScaledVector(f, -this.dist * Math.cos(tilt)).add(new THREE.Vector3(0, this.dist * Math.sin(tilt), 0));
    this.camera.lookAt(this.player.position);
    const keep = new Set();
    for (const t of things) {
      if (t.distance > 400) continue; keep.add(t.id);
      let v = this.views.get(t.id);
      if (v && t.kind === 'kiki' && !!v.userData.hidden !== t.distance > C.VISIBLE + (v.userData.hidden ? 0 : 8)) { this.things.remove(v); this.views.delete(t.id); v = null; } // came into view (or left it)
      if (!v) { v = this.makeThing(t); this.views.set(t.id, v); this.things.add(v); v.position.copy(this.local(t.where)); }
      v.userData.thing = t; v.position.lerp(this.local(t.where), 1 - Math.exp(-dt * 4));
      if (v.userData.motion) v.userData.motion.update(dt);
      if (v.userData.rustle) v.userData.rustle.userData.update(dt);
      if (v.userData.kiki && v.userData.pop < 1) { v.userData.pop = Math.min(1, v.userData.pop + dt * 2.5); const k = v.userData.pop, s = 1 + Math.sin(k * Math.PI) * 0.25; v.userData.kiki.scale.setScalar(Math.max(0.0001, k * s) * v.userData.base); }
      if (v.userData.stone) {
        const ready = !this.app.progress.stops[t.id] || Math.floor(Date.now() / 1000) - this.app.progress.stops[t.id] >= STOP_COOLDOWN;
        v.userData.stone.rotation.set(-1.2, ready ? time : 0.4, 0); v.userData.stone.userData.update(dt, time);
        const c = ready ? 0xff5d8f : 0x9b8cff; v.userData.ring.material.color.setHex(c); v.userData.disc.material.color.setHex(c);
      }
      if (this.app.tracking === t.id) { if (!v.userData.track) { const r = new THREE.Mesh(new THREE.RingGeometry(9, 10.6, 48), new THREE.MeshBasicMaterial({ color: 0xffcf2e, side: THREE.DoubleSide, transparent: true, depthWrite: false })); r.rotation.x = -Math.PI / 2; r.position.y = 0.5; r.renderOrder = -1; v.add(r); v.userData.track = r; } const k = (time * 0.8) % 1; v.userData.track.scale.setScalar(0.7 + k * 0.8); v.userData.track.material.opacity = 1 - k; }
      else if (v.userData.track) { v.remove(v.userData.track); v.userData.track = null; }
      if (v.userData.circle) { v.userData.circle.userData.portal.userData.update(dt, time, this.camera); v.userData.circle.userData.setKeeper(t.raid ? t.raid.sp : t.variant.id); v.userData.circle.userData.setColor(t.raid ? 0xff2d8a : t.color || 0x7a00ff); if (v.userData.circle.userData.motion) v.userData.circle.userData.motion.update(dt); }
    }
    for (const [id, v] of this.views) if (!keep.has(id)) { this.things.remove(v); this.views.delete(id); }
  }

  tap(x, y) {
    const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1), this.camera);
    const hits = ray.intersectObjects([...this.views.values()].map(v => v.userData.hit), false);
    if (!hits.length) return;
    // Kikis win over stops, stops over Rune Circles (their tap areas overlap when they're close together).
    const rank = h => ({ kiki: 0, stop: 1, circle: 2 }[h.object.userData.hitFor.userData.thing.kind] ?? 3);
    hits.sort((a, b) => rank(a) - rank(b) || a.distance - b.distance);
    const g = hits[0].object.userData.hitFor;
    if (g.userData.hidden) return this.app.rustleTap(g.userData.thing);
    this.app.interact(g.userData.thing);
  }
  north() { this.yaw = 0; }

  /** Your buddy trots along behind your explorer (Phase 2). */
  setBuddy(rec) {
    if (this.buddy) { this.scene.remove(this.buddy); this.buddy = null; }
    this.buddyKey = rec ? rec.uid + rec.sp + !!rec.sparkle : null;
    if (!rec) return;
    this.buddy = makeKiki(rec.sp, 6, !!rec.sparkle); this.buddy.userData.motionCtl = new KikiMotion(this.buddy, reducedMotion); this.scene.add(this.buddy);
    this.buddy.position.copy(this.player.position);
  }
  updateBuddy(dt) {
    const p = this.app.progress, rec = p.buddy && p.kikis.find(k => k.uid === p.buddy.uid);
    const key = rec ? rec.uid + rec.sp + !!rec.sparkle : null; if (key !== this.buddyKey) this.setBuddy(rec || null);
    if (!this.buddy) return;
    const f = this.facing, target = this.player.position.clone().add(new THREE.Vector3(Math.sin(f) * -7 + Math.cos(f) * 6, 0, Math.cos(f) * -7 - Math.sin(f) * 6));
    const gap = this.buddy.position.distanceTo(target); this.buddy.position.lerp(target, 1 - Math.exp(-dt * 2.5));
    this.buddy.rotation.y = gap > 1.5 ? Math.atan2(target.x - this.buddy.position.x, target.z - this.buddy.position.z) : f;
    const m = this.buddy.userData.motionCtl; if (gap > 2 && !m.busy) m.play(m.tinyHops()); m.update(dt);
  }
  /** Rain or snow falling on the map when that's the real weather. */
  /** Phase 5 map look: cloud shadows drifting over the streets by day, fireflies by night. */
  makeSky() {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64); const tex = new THREE.CanvasTexture(c);
    this.sky = new THREE.Group(); this.scene.add(this.sky);
    if (!this.night) {
      const mat = new THREE.MeshBasicMaterial({ map: tex, color: 0x3a2a8a, transparent: true, opacity: 0.2, depthWrite: false });
      for (let i = 0; i < 12; i++) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); m.rotation.x = -Math.PI / 2; m.position.set((Math.random() - 0.5) * 700, 0.6, (Math.random() - 0.5) * 700);
        m.scale.set(160 + Math.random() * 160, 90 + Math.random() * 80, 1); m.renderOrder = 1; this.sky.add(m);
      }
    } else {
      const n = 70, pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 500; pos[i * 3 + 1] = 3 + Math.random() * 12; pos[i * 3 + 2] = (Math.random() - 0.5) * 500; }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.flies = new THREE.Points(g, new THREE.PointsMaterial({ map: tex, color: 0xfff27a, size: 7, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
      this.flies.userData.base = pos.slice(); this.sky.add(this.flies);
    }
  }
  updateSky(dt, time) {
    if (!this.sky) return;
    const me = this.player.position, still = reducedMotion();
    if (!this.night) for (const m of this.sky.children) {
      if (!still) { m.position.x += dt * 4; m.position.z -= dt * 1.5; } // a gentle breeze
      for (const k of ['x', 'z']) { const d = m.position[k] - me[k]; if (Math.abs(d) > 350) m.position[k] -= Math.sign(d) * 700; }
    }
    else if (this.flies && !still) {
      const a = this.flies.geometry.attributes.position, b = this.flies.userData.base;
      for (let i = 0; i < a.count; i++) { a.setX(i, b[i * 3] + Math.sin(time * 0.7 + i) * 4); a.setY(i, b[i * 3 + 1] + Math.sin(time * 1.3 + i * 2.1) * 2); a.setZ(i, b[i * 3 + 2] + Math.cos(time * 0.6 + i * 1.7) * 4); }
      a.needsUpdate = true; this.flies.position.set(me.x, 0, me.z); this.flies.material.opacity = 0.6 + Math.sin(time * 2.4) * 0.3;
    }
  }
  updateWeather(dt) {
    const w = this.app.weatherNow, kind = w === 'rain' || w === 'storm' ? 'rain' : w === 'snow' ? 'snow' : null;
    if (kind !== this.fxKind) {
      if (this.fx) { this.scene.remove(this.fx); this.fx.geometry.dispose(); this.fx = null; }
      this.fxKind = kind;
      if (kind) {
        const n = kind === 'rain' ? 900 : 600, pos = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 400; pos[i * 3 + 1] = Math.random() * 160; pos[i * 3 + 2] = (Math.random() - 0.5) * 400; }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d');
        if (kind === 'rain') { const gr = x.createLinearGradient(0, 0, 0, 32); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,1)'); x.fillStyle = gr; x.fillRect(14, 0, 4, 32); }
        else { const gr = x.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 32, 32); }
        this.fx = new THREE.Points(g, new THREE.PointsMaterial({ map: new THREE.CanvasTexture(c), color: kind === 'rain' ? 0xbfe6ff : 0xffffff, size: kind === 'rain' ? 9 : 6, transparent: true, opacity: kind === 'rain' ? 0.75 : 0.95, depthWrite: false }));
        this.fx.renderOrder = 5; this.scene.add(this.fx);
      }
    }
    if (!this.fx) return;
    const a = this.fx.geometry.attributes.position, fall = (this.fxKind === 'rain' ? 70 : 9) * dt;
    for (let i = 0; i < a.count; i++) { let y = a.getY(i) - fall; if (y < 0) y += 160; a.setY(i, y); if (this.fxKind === 'snow') a.setX(i, a.getX(i) + Math.sin(y * 0.1 + i) * 0.05); }
    a.needsUpdate = true; this.fx.position.set(this.player.position.x, 0, this.player.position.z);
  }
  rotate(dxPx) { this.yaw = (this.yaw || 0) + dxPx / innerWidth * 180; }
  zoom(f) { this.dist = Math.max(160, Math.min(1100, this.dist * f)); }
}
