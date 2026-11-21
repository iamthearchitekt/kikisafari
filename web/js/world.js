// The camera world view: the live camera, turned by the phone's motion sensors and pointed at true north by the
// compass, with Kikis, supply stops and Rune Circles at their real GPS spots (owner's call: camera first).
import * as THREE from '../vendor/three.module.min.js';
import * as C from './core.js';
import { OsmArea, WorldData, placeLandmarks, overpassQuery, DATA_CELL } from './osm.js';
import { tilesFor } from './tiles.js';
import { makeKiki, KikiMotion, makeRuneStone, makeCircle, makeBeam, Sparkles } from './art.js';
import { meadow } from './meadow.js';
import { $, toast, hx, sfx, debug, reducedMotion, fmtDist } from './services.js';
import { goneSet, STOP_COOLDOWN, keeperTeam, raidAt, levelOf, FACTIONS } from './rules.js';

export const EYE = 1.4; // the camera is about 1.4 m above the ground

// ---------- location (GPS, or simulated on a computer) ----------
export class Location {
  constructor() {
    this.fix = null; this.accuracy = 999; this.count = 0; this.speedKmh = 0; this.locked = false; this.problem = null; this.simulated = false; this.last = null;
  }
  start() {
    if (this.started) return this.started; // Play again from the title: keep the one GPS watch
    return this.started = this._start();
  }
  _start() {
    const q = new URLSearchParams(location.search);
    if (q.has('lat') || !('geolocation' in navigator)) return this.simulate(q);
    return new Promise(resolve => {
      let first = true;
      this.watch = navigator.geolocation.watchPosition(p => {
        const fix = { lat: p.coords.latitude, lon: p.coords.longitude }, now = p.timestamp / 1000;
        this.accuracy = p.coords.accuracy;
        if (this.last) {
          const d = C.distance(this.last.fix, fix), dt = Math.max(1, now - this.last.t), kmh = d / dt * 3.6;
          if (kmh > 300 && p.coords.accuracy > 20) return; // impossible jump: ignore
          this.speedKmh = p.coords.speed != null && p.coords.speed >= 0 ? p.coords.speed * 3.6 : kmh;
          this.locked = C.speedLocked(this.locked, this.speedKmh);
        }
        this.last = { fix, t: now };
        this.fix = this.fix ? C.smoothFix(this.fix, fix, p.coords.accuracy, p.coords.speed) : fix; this.count++; this.problem = null;
        if (first) { first = false; resolve(true); }
      }, e => {
        this.problem = e.code === 1 ? 'Location is off for this site. Turn it on in Settings ▸ Safari ▸ Location (or your browser) to find Kikis near you.' : "Couldn't get your location yet. Step outside or wait a moment.";
        if (first && e.code === 1) { first = false; resolve(false); }
      }, { enableHighAccuracy: true, maximumAge: 2000, timeout: 30000 });
      setTimeout(() => { if (first) { first = false; resolve(!!this.fix); } }, 30000);
    });
  }
  simulate(q) {
    this.simulated = true; this.accuracy = 5;
    const saved = JSON.parse(localStorage.getItem('kiki-sim') || 'null');
    this.fix = q.has('lat') ? { lat: +q.get('lat'), lon: +q.get('lon') } : saved || { lat: 40.7829, lon: -73.9654 };
    this.count = 1;
    return Promise.resolve(true);
  }
  /** Computer testing: WASD walks along the view, Shift runs. */
  simWalk(keys, headingDeg, dt) {
    if (!this.simulated) return;
    const f = (keys.w ? 1 : 0) - (keys.s ? 1 : 0), s = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
    if (!f && !s) return;
    const sp = keys.shift ? 6 : 1.6, h = headingDeg * Math.PI / 180;
    const e = (Math.sin(h) * f + Math.cos(h) * s) * sp * dt, n = (Math.cos(h) * f - Math.sin(h) * s) * sp * dt;
    this.fix = C.fromLocal(this.fix, e, n); this.count++;
    localStorage.setItem('kiki-sim', JSON.stringify(this.fix));
  }
}

// ---------- orientation (motion sensors + compass, or drag to look) ----------
// Owner: "the AR objects won't stay in place when I turn my camera on, they keep drifting off to the left or right."
// The view follows the gyroscope only (the phone's relative orientation): it is smooth and does not wander. The
// compass is far noisier (and the camera's own hardware disturbs it once it switches on), so it is used once, to line
// the gyroscope's arbitrary zero up with north: a short calibration (an average over about half a second, with the
// phone upright) at start and whenever the camera turns on; after that the alignment is held still. Before, it was
// nudged towards the live compass sixty times a second (iPhone), or the view ran on the compass itself (Android),
// which is what made everything slide sideways.
const zee = new THREE.Vector3(0, 0, 1), q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
const screenAngle = () => ((screen.orientation && screen.orientation.angle) || window.orientation || 0);
/** The camera's orientation from a deviceorientation event (three.js convention). */
function eventQuat(e, out) {
  const eu = new THREE.Euler(e.beta * Math.PI / 180, e.alpha * Math.PI / 180, -e.gamma * Math.PI / 180, 'YXZ');
  return out.setFromEuler(eu).multiply(q1).multiply(new THREE.Quaternion().setFromAxisAngle(zee, -screenAngle() * Math.PI / 180));
}
const CALIB_SAMPLES = 30;
export class Orientation {
  constructor(camera) {
    this.camera = camera; this.target = new THREE.Quaternion(); this.have = false; this.offset = 0; this.offsetSet = false;
    this.yaw = 0; this.pitch = -0.12; // drag-to-look fallback
    this.locked = false; // AR off: a fixed view, the phone's motion is ignored
    this.relQ = new THREE.Quaternion(); this.absQ = new THREE.Quaternion(); this.haveRel = false; this.firstAbsAt = 0;
    this.samples = []; this.calibrating = true;
    this.onEvent = e => {
      if (e.alpha == null) return;
      const isAbs = e.type === 'deviceorientationabsolute' || e.absolute === true;
      if (isAbs) {
        eventQuat(e, this.absQ);
        if (typeof e.webkitCompassHeading !== 'number') this.compass = norm(360 - e.alpha - screenAngle()); // the map's compass
        if (this.haveRel) this.sample(norm(this.rawHeading(this.absQ) - this.rawHeading(this.relQ)), e.beta);
        else {
          // a phone with no gyroscope-only orientation: use the compass one (its frame is north already)
          this.firstAbsAt ||= performance.now();
          if (performance.now() - this.firstAbsAt > 500) { this.target.copy(this.absQ); this.have = true; this.offset = 0; this.offsetSet = true; this.calibrating = false; }
        }
      } else {
        eventQuat(e, this.relQ); this.target.copy(this.relQ); this.have = this.haveRel = true;
        if (typeof e.webkitCompassHeading === 'number') { // iPhone: the compass comes with the gyroscope's event
          this.compass = e.webkitCompassHeading;
          const acc = e.webkitCompassAccuracy;
          if (acc == null || (acc >= 0 && acc <= 30)) this.sample(norm(e.webkitCompassHeading - this.rawHeading(this.relQ)), e.beta);
        }
      }
    };
    addEventListener('deviceorientationabsolute', this.onEvent);
    addEventListener('deviceorientation', this.onEvent);
  }
  /** One reading of how far the gyroscope's zero is from north; while calibrating, the average of the readings so far. */
  sample(deg, beta) {
    if (!this.calibrating || Math.abs(beta) < 40) return; // only with the phone held up (the compass is poor lying flat)
    this.samples.push(deg * Math.PI / 180);
    let x = 0, y = 0; for (const a of this.samples) { x += Math.cos(a); y += Math.sin(a); }
    this.offset = norm(Math.atan2(y, x) * 180 / Math.PI); this.offsetSet = true;
    if (this.samples.length >= CALIB_SAMPLES) { this.calibrating = false; this.samples = []; }
  }
  /** Line up with north again (when the camera turns on); held still afterwards. */
  recalibrate() { if (this.haveRel) { this.calibrating = true; this.samples = []; } }
  /** Heading of a camera orientation in the sensor frame (degrees clockwise from the frame's -Z). */
  rawHeading(q) { const f = new THREE.Vector3(0, 0, -1).applyQuaternion(q); return norm(Math.atan2(f.x, -f.z) * 180 / Math.PI); }
  /** Which way you're facing for the map: the compass if there is one, else the camera's heading. */
  get facing() { return this.compass != null && !this.locked ? this.compass : this.heading; }
  /** True compass heading of the camera. */
  get heading() { return norm(this.rawHeading(this.camera.quaternion) + this.offset); }
  update(dt) {
    if (this.have && !this.locked) this.camera.quaternion.slerp(this.target, 1 - Math.exp(-dt * 18));
    else this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
  }
  drag(dx, dy) { if (this.have && !this.locked) return; this.yaw -= dx * 0.005; this.pitch = Math.max(-1.2, Math.min(0.8, this.pitch - dy * 0.005)); }
}
const norm = d => ((d % 360) + 360) % 360;

// ---------- map data (OpenStreetMap via Overpass, cached on the phone) ----------
// Overpass is a free public service, and its servers get busy. The game asks the main one first and moves on to the
// others if it's busy, down or slow, then remembers which one answered. A reply that is really an error ("timed out")
// is never kept on the phone, so a busy moment can't leave the map blank for two weeks.
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const OSM_CACHE = 'kiki-osm-v2';
if (typeof caches !== 'undefined') caches.delete('kiki-osm-v1').catch(() => {}); // the old cache could hold a blank "timed out" reply
/** Is this a real map reply (not an Overpass error dressed up as data)? */
export const goodMap = j => !!j && Array.isArray(j.elements) && !(j.remark && /error|timed out|timeout|out of memory|too many/i.test(j.remark));
let overpassAt = Math.max(0, OVERPASS.indexOf(localStorage.getItem('kiki-overpass')));
async function fetchOverpass(q, onTry = () => {}) {
  const errors = [];
  for (let i = 0; i < OVERPASS.length; i++) {
    const url = OVERPASS[(overpassAt + i) % OVERPASS.length], host = new URL(url).host, ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 30000);
    onTry(i, host);
    try {
      const r = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: ctl.signal });
      if (!r.ok) throw new Error(`HTTP ${r.status}${r.status === 429 ? ' (busy)' : r.status === 504 ? ' (timed out)' : ''}`);
      const text = await r.text(), json = JSON.parse(text);
      if (!goodMap(json)) throw new Error(json.remark ? json.remark.slice(0, 80) : 'not map data');
      if (overpassAt !== OVERPASS.indexOf(url)) { overpassAt = OVERPASS.indexOf(url); localStorage.setItem('kiki-overpass', url); }
      return { text, json };
    } catch (e) { errors.push(`${host}: ${e.name === 'AbortError' ? 'no answer in 30 s' : e.message}`); }
    finally { clearTimeout(timer); }
  }
  throw new Error(errors.join(' · '));
}
export class OsmLoader {
  constructor() { this.data = new WorldData(); this.queue = []; this.busy = false; this.pending = new Set(); this.retry = new Map(); this.fails = new Map(); this.problem = null; this.listeners = []; }
  need(me) {
    for (const c of C.cellsAround(me, 450, DATA_CELL)) {
      const k = c.x + ':' + c.y;
      if (this.data.has(c) || this.pending.has(k) || (this.retry.get(k) || 0) > performance.now()) continue;
      this.pending.add(k); this.queue.push(c);
    }
    if (!this.busy && this.queue.length) this.run();
  }
  async run() {
    this.busy = true;
    while (this.queue.length) {
      const c = this.queue.shift();
      try { await this.load(c); }
      catch (e) { // never fail silently: say so on screen, and in Testing tools
        console.warn('map', e); this.lastError = 'reading the map: ' + (e && e.message || e); this.problem = "Couldn't read the map here. Trying again soon.";
        this.retry.set(c.x + ':' + c.y, performance.now() + 30000);
      }
      this.loading = null; this.pending.delete(c.x + ':' + c.y);
    }
    this.busy = false;
  }
  async load(cell) {
    const key = `https://kiki-safari.local/osm/${cell.x}_${cell.y}.json`;
    let json = null, cache = null;
    const within = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('timeout')), ms))]); // a stuck phone cache can't hold things up
    this.loading = 'Loading the map…';
    try {
      cache = await within(caches.open(OSM_CACHE), 3000);
      const hit = await within(cache.match(key), 3000);
      if (hit && Date.now() - +(hit.headers.get('x-saved') || 0) < 14 * 864e5) { const j = await hit.json(); if (goodMap(j)) json = j; }
    } catch (e) {}
    if (!json) {
      const q = overpassQuery(cell.sw.lat, cell.sw.lon, cell.sw.lat + cell.dLat, cell.sw.lon + cell.dLon); let tileError = null;
      try {
        // Map tiles from OpenFreeMap first (fast and dependable; the tiles are kept on the phone); the public Overpass
        // servers only if the tiles can't be had.
        try { this.server = 'tiles.openfreemap.org'; json = await tilesFor(cell.sw.lat, cell.sw.lon, cell.sw.lat + cell.dLat, cell.sw.lon + cell.dLon); }
        catch (e) {
          tileError = e.message; this.loading = 'Loading the map (backup servers)…';
          const got = await fetchOverpass(q, (i, host) => { this.loading = i ? 'The map server is slow. Trying another one…' : 'Loading the map (backup servers)…'; this.server = host; });
          json = got.json;
          if (cache) cache.put(key, new Response(got.text, { headers: { 'x-saved': String(Date.now()), 'Content-Type': 'application/json' } })).catch(() => {});
        }
        this.problem = null; this.lastError = null;
      } catch (e) {
        this.lastError = (tileError ? tileError + ' · then ' : '') + e.message; console.warn('map', this.lastError);
        if (cache) { try { const old = await cache.match(key); if (old) { const j = await old.json(); if (goodMap(j)) json = j; } } catch (e2) {} }
        if (!json) {
          this.problem = navigator.onLine === false ? "You're offline. The map loads when you're back." : "Can't reach the map right now. Trying again… (Kikis still spawn.)";
          const k = cell.x + ':' + cell.y, n = (this.fails.get(k) || 0) + 1; this.fails.set(k, n);
          this.retry.set(k, performance.now() + Math.min(300000, 15000 * 2 ** (n - 1))); // back off: 15 s, 30 s, 60 s … up to 5 min
          return;
        }
      }
    }
    await new Promise(r => setTimeout(r, 0));
    const area = OsmArea.fromOverpass(json, cell.center);
    await new Promise(r => setTimeout(r, 0));
    this.data.add(cell, area, placeLandmarks(area, cell));
    for (const l of this.listeners) { try { l(cell, area); } catch (e) { console.warn('map', e); this.lastError = 'drawing the map: ' + (e && e.message || e); } }
  }
}

// ---------- the world view ----------

export class WorldView {
  constructor(app) {
    this.app = app; this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.05, 1500);
    this.scene.add(this.camera);
    this.scene.add(new THREE.HemisphereLight(0xfff5e0, 0x8a80c0, 1.6));
    const sun = new THREE.DirectionalLight(0xfff5e0, 2.0); sun.position.set(-3, 6, 4); this.scene.add(sun);
    this.root = new THREE.Group(); this.scene.add(this.root);
    this.sparkles = new Sparkles(this.scene);
    this.orient = new Orientation(this.camera);
    this.views = new Map(); this.things = []; this.nextPlan = 0; this.labels = new Map();
    this.ground = null; this.time = 0;
  }

  /** Stand-in when there's no camera: a sky and meadow behind the 3D. */
  setStandIn(on, night) {
    // No camera picture (AR off, or no camera): a real meadow to stand in (meadow.js): sky dome and clouds, grass
    // blades, wildflowers and a tree line; moonlit with fireflies at night. The flat CSS sky stays as a fallback.
    $('sky').hidden = true; $('sky').classList.toggle('night', !!night); $('cam').hidden = on;
    if (on && (!this.ground || this.groundNight !== !!night)) {
      if (this.ground) { this.scene.remove(this.ground); this.ground.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
      this.standIn = meadow({ mood: night ? 'night' : 'day', y: -EYE, grassRadius: 8, treeRing: [20, 32], trees: 12, seed: 7, density: 18 });
      this.ground = this.standIn.group; this.scene.add(this.ground); this.groundNight = !!night;
    }
    if (this.ground) this.ground.visible = on;
    this.scene.fog = on ? new THREE.Fog(this.standIn ? this.standIn.fog : (night ? 0x52298c : 0xd9f1ff), 10, 65) : null;
  }

  /** Position in the 3D world (x = east, z = south) of a real place, relative to the player. */
  place(where) {
    const me = this.app.loc.fix, b = (C.bearing(me, where) - this.orient.offset) * Math.PI / 180, d = C.distance(me, where);
    return new THREE.Vector3(Math.sin(b) * d, -EYE, -Math.cos(b) * d);
  }

  plan() {
    const app = this.app, me = app.loc.fix;
    app.osm.need(me);
    if (debug.home && !localStorage.getItem('kiki-home') && (app.loc.simulated || app.loc.accuracy <= 35)) {
      app.pinHome(); toast('Your test Rune Circle is pinned right here!');
    }
    let now = Math.floor(Date.now() / 1000);
    if (debug.surge && !C.surgeActive(now)) now = Math.floor(now / C.SURGE_EVERY) * C.SURGE_EVERY + 60;
    const home = debug.home ? JSON.parse(localStorage.getItem('kiki-home') || 'null') : null;
    const gone = goneSet(app.progress, now); for (const id of app.caught) gone.add(id);
    const m = app.mods ? app.mods() : {};
    this.things = C.nearby(me, now, { home, progress: app.progress, caught: gone, data: app.osm.data, boost: m.boost, featured: m.featured });
    if (app.extraThings && app.extraThings.length) { // the tutorial's starters
      for (const t of app.extraThings) { t.distance = C.distance(me, t.where); t.bearing = C.bearing(me, t.where); }
      this.things = [...app.extraThings, ...this.things.filter(t => t.kind !== 'kiki')].sort((a, b) => a.distance - b.distance);
    }
    if (debug.night) for (const t of this.things) if (t.kind === 'kiki' && t.variant.time === 'day') t.variant = C.variant('moonbeam');
    // Phase 3: today's wild Keepers stand on circles you don't hold; during a Portal Surge, the raid boss does.
    const L = levelOf(app.progress.xp), surge = C.surgeActive(now) || debug.surge;
    for (const t of this.things) if (t.kind === 'circle') {
      const mine = app.progress.keepers[t.id];
      t.mine = !!mine; t.keepers = mine ? [] : keeperTeam(t.id, now, L);
      if (mine) t.variant = C.variant(mine.variant); else t.variant = C.variant(t.keepers[0].sp);
      t.raid = surge ? raidAt(t.id, Math.floor(now / C.SURGE_EVERY)) : null; if (t.raid && app.progress.raidsDone[t.raid.id]) t.raid = null;
      const sh = app.sharedCircles && app.sharedCircles[t.id];
      t.color = mine && app.progress.faction ? FACTIONS[app.progress.faction].color : sh && FACTIONS[sh.faction] ? FACTIONS[sh.faction].color : null;
    }
    if (app.mapMode) return;
    const keep = new Set();
    for (const t of this.things) {
      if (t.kind === 'circle' ? t.distance > 250 : t.distance > C.VISIBLE) continue;
      keep.add(t.id);
      let v = this.views.get(t.id);
      if (!v) { v = this.make(t); this.views.set(t.id, v); v.position.copy(this.place(t.where)); }
      v.userData.thing = t;
      if (t.kind === 'circle') { v.userData.setKeeper(t.raid ? t.raid.sp : t.variant.id); v.userData.setColor(t.raid ? 0xff2d8a : t.color || 0x7a00ff); v.userData.portal.userData.size = t.surge ? 2.8 : 1.9; v.userData.portal.userData.boost = t.surge ? 0.8 : 0; }
    }
    for (const [id, v] of this.views) if (!keep.has(id)) { this.root.remove(v); this.views.delete(id); }
  }

  make(t) {
    let g;
    if (t.kind === 'kiki') {
      g = new THREE.Group(); const k = makeKiki(t.variant.id, 0.6); g.add(k);
      const beam = makeBeam(7, 0.22, C.RARITY[t.variant.rarity].main, 0.45); beam.position.y = 0.3; g.add(beam);
      g.userData = { kiki: k, motion: new KikiMotion(k, reducedMotion), beam };
    } else if (t.kind === 'stop') {
      g = new THREE.Group(); const s = makeRuneStone(0.04); s.scale.setScalar(7); s.position.y = 1.9; g.add(s);
      const beam = makeBeam(6, 0.3, 0xff5d8f, 0.4); beam.position.y = 2.1; g.add(beam);
      g.userData = { stone: s, beam };
    } else {
      g = makeCircle(t.variant.id);
    }
    // invisible hit target for taps
    const hit = new THREE.Mesh(new THREE.SphereGeometry(t.kind === 'circle' ? 3.2 : t.kind === 'stop' ? 1 : 0.7, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = t.kind === 'circle' ? 1.4 : t.kind === 'stop' ? 1.9 : 0.3; hit.userData.hitFor = g; g.add(hit); g.userData.hit = hit;
    this.root.add(g);
    return g;
  }

  update(dt) {
    const app = this.app; this.time += dt;
    this.orient.update(dt);
    if (!app.loc.fix) return;
    if (this.time >= this.nextPlan) { this.nextPlan = this.time + 1; this.plan(); }
    this.sparkles.update(dt); // catches started from the map use these too
    if (this.standIn && this.ground && this.ground.visible) this.standIn.update(dt, this.time); // clouds drift, fireflies dance
    if (app.mapMode) return;
    const camPos = this.camera.position, now = Date.now() / 1000;
    for (const v of this.views.values()) {
      const t = v.userData.thing, target = this.place(t.where);
      v.position.lerp(target, 1 - Math.exp(-dt * 3));
      const d = Math.hypot(v.position.x, v.position.z);
      if (t.kind === 'kiki') {
        v.userData.kiki.rotation.y = Math.atan2(camPos.x - v.position.x, camPos.z - v.position.z);
        v.scale.setScalar(Math.min(2.6, Math.max(1, d / 12)));
        v.userData.beam.visible = d > 10; v.userData.motion.update(dt);
      } else if (t.kind === 'stop') {
        const ready = app.progressApi.stopWait(app.progress, t.id, Math.floor(now), STOP_COOLDOWN) === 0;
        v.userData.stone.rotation.set(-1.22, this.time * (ready ? 1 : 0.2), 0);
        v.userData.stone.position.y = 1.9 + Math.sin(this.time * 2) * 0.08;
        v.userData.stone.userData.update(dt, this.time);
        v.userData.beam.material.uniforms.c.value.set(ready ? 0xff5d8f : 0x8c91b8);
      } else {
        v.userData.portal.userData.update(dt, this.time, this.camera);
        if (v.userData.keeper) v.userData.keeper.rotation.y = Math.atan2(camPos.x - v.position.x, camPos.z - v.position.z);
        if (v.userData.motion) v.userData.motion.update(dt);
        if (t.surge && Math.random() < dt * 6) this.sparkles.burst(v.position.clone().add(new THREE.Vector3((Math.random() - .5) * 1.6, 2.25 + (Math.random() - .5) * 1.6, 0)), 3, 0x7a00ff, 0.12, 0.6, 0.8);
      }
    }
    this.updateLabels();
  }

  updateLabels() {
    const el = $('labels'), used = new Set(), w = innerWidth, h = innerHeight, v3 = new THREE.Vector3();
    if (this.app.mapMode) { el.hidden = true; return; } el.hidden = false;
    for (const [id, v] of this.views) {
      const t = v.userData.thing, lift = t.kind === 'circle' ? 3.9 : t.kind === 'stop' ? 2.8 : 1.15 * v.scale.y;
      v3.copy(v.position).y += lift; v3.project(this.camera);
      if (v3.z > 1 || v3.z < -1 || Math.abs(v3.x) > 1.2 || Math.abs(v3.y) > 1.2) continue;
      used.add(id);
      let lab = this.labels.get(id);
      if (!lab) { lab = document.createElement('div'); lab.className = 'label sticker'; el.appendChild(lab); this.labels.set(id, lab); }
      const near = t.distance <= C.ACTION && t.kind !== 'circle';
      const name = t.kind === 'stop' ? 'Supply Stop' : t.name;
      lab.textContent = near ? `${name} · tap!` : `${name} · ${fmtDist(t.distance)}`;
      lab.classList.toggle('tap', near);
      lab.style.left = ((v3.x + 1) / 2 * w) + 'px'; lab.style.top = ((1 - v3.y) / 2 * h) + 'px';
      lab.style.display = '';
      lab.style.transform = `translate(-50%,-100%) scale(${Math.max(0.75, Math.min(1.1, 1.3 - t.distance / 90))})`;
    }
    for (const [id, lab] of this.labels) if (!used.has(id)) { if (!this.views.has(id)) { lab.remove(); this.labels.delete(id); } else lab.style.display = 'none'; }
  }

  tap(x, y) {
    const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1), this.camera);
    const hits = ray.intersectObjects([...this.views.values()].map(v => v.userData.hit), false);
    const rank = h => ({ kiki: 0, stop: 1, circle: 2 }[h.object.userData.hitFor.userData.thing.kind] ?? 3);
    hits.sort((a, b) => rank(a) - rank(b) || a.distance - b.distance);
    if (hits.length) this.app.interact(hits[0].object.userData.hitFor.userData.thing);
  }

  setVisible(on) { this.root.visible = on; $('labels').hidden = !on; }
}

// ---------- radar and nearby strip ----------
export function drawRadar(canvas, things, heading) {
  const g = canvas.getContext('2d'), S = canvas.width, R = S / 2 - 6, range = 100;
  g.clearRect(0, 0, S, S);
  g.fillStyle = '#fff8de'; g.beginPath(); g.arc(S / 2, S / 2, S / 2, 0, 7); g.fill();
  g.fillStyle = 'rgba(61,66,117,.10)'; g.beginPath(); g.arc(S / 2, S / 2, R * C.ACTION / range, 0, 7); g.fill();
  const col = t => t.kind === 'kiki' ? C.RARITY[t.variant.rarity].main : t.kind === 'stop' ? '#ff5d8f' : '#7a00ff';
  for (const t of things) {
    if (t.distance > range) continue;
    const a = (t.bearing - heading) * Math.PI / 180, r = t.distance / range * R, x = S / 2 + Math.sin(a) * r, y = S / 2 - Math.cos(a) * r;
    const s = t.kind === 'circle' ? 15 : t.kind === 'stop' ? 10 : 12;
    g.fillStyle = col(t); g.strokeStyle = '#18237a'; g.lineWidth = 4; g.beginPath(); g.arc(x, y, s, 0, 7); g.fill(); g.stroke();
  }
  // you, facing up
  g.fillStyle = '#18237a'; g.beginPath(); g.moveTo(S / 2, S / 2 - 26); g.lineTo(S / 2 + 18, S / 2 + 18); g.lineTo(S / 2, S / 2 + 8); g.lineTo(S / 2 - 18, S / 2 + 18); g.closePath(); g.fill();
  const na = -heading * Math.PI / 180; g.fillStyle = '#ff5d8f'; g.font = '30px "Lilita One"'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('N', S / 2 + Math.sin(na) * (R - 22), S / 2 - Math.cos(na) * (R - 22));
}

export function renderNearby(el, things, heading) {
  const list = things.filter(t => t.kind !== 'stop').slice(0, 3);
  const sig = list.map(t => t.id + Math.round(t.distance / 5) + Math.round((t.bearing - heading) / 10)).join('|');
  if (el.dataset.sig === sig) return; el.dataset.sig = sig;
  el.innerHTML = list.map(t => {
    const col = t.kind === 'kiki' ? C.RARITY[t.variant.rarity].main : '#7a00ff', near = t.distance <= C.ACTION;
    const name = t.kind === 'circle' ? 'Rune Circle' : t.name.replace(' Kiki', '');
    return `<div class="chip sticker${near ? ' near' : ''}"><span class="dot" style="background:${col}"></span><span class="nm">${name}</span><span class="ds">${near ? 'Tap it!' : fmtDist(t.distance)}</span>` +
      `<svg class="ar" viewBox="0 0 24 24" style="transform:rotate(${t.bearing - heading}deg)"><path d="M12 2 21 21 12 16 3 21z" fill="#ff5d8f" stroke="#18237a" stroke-width="2" stroke-linejoin="round"/></svg></div>`;
  }).join('');
}
