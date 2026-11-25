// The catch (decisions doc, section 7, with the owner's Rune Stone and portal). Kiki stands on the ground in front of
// you and stays put as you turn the phone. Flick the Rune Stone up from the bottom of the screen (circle it first for
// spin), or tap "Tap to throw". On a hit the portal sucks Kiki in and seals into the stone; it wobbles, then bursts
// (caught) or blasts open (SO CLOSE!). Phase 1: pick a Rune, Moon or Star Stone, feed a treat, the dot on the name card
// shows how hard the catch is, every Kiki has its own Power, a Kiki that breaks out can run away, and AR can be turned
// off. There's no aiming circle (owner): a flick that lands near Kiki's middle earns Nice, Great or Excellent.
// Kiki stands on the floor where the phone points (close, so it fits in a room); tap the floor or a table to move it.
import * as THREE from '../vendor/three.module.min.js';
import * as C from './core.js';
import * as R from './rules.js';
import { makeKiki, KikiMotion, makeRuneStone, makePortal, vortexify, makeTreat, cosmicCanvas, portrait, easeOutBack, BODY_H, GROUND } from './art.js';
import { EYE } from './world.js';
import { $, hx, sfx, voice, pop, shake, toast, tuning, reducedMotion, settings, view } from './services.js';
import { liveStage } from './ui.js';

const HAND = new THREE.Vector3(0, -0.12, -0.46), STONE_R = 0.04;

export class Encounter {
  constructor(app, thing, onDone, { starter = false } = {}) {
    this.app = app; this.thing = thing; this.v = thing.variant; this.onDone = onDone; this.starter = starter; this.reward = !!thing.reward; this.raid = thing.raid || null; this.raidStones = this.raid ? this.raid.stones : 0;
    this.mods = app.mods ? app.mods() : { sparkle: 1, xp: 1, sprouts: 1 };
    this.scene = app.world.scene; this.camera = app.world.camera; this.sparkles = app.world.sparkles;
    this.group = new THREE.Group(); this.scene.add(this.group);
    this.state = 'ready'; this.clock = 0; this.samples = []; this.taught = false;
    const p = app.progress;
    // This Kiki's own level, hidden stats and size (the same each time you meet the same spawn).
    const odds = R.SPARKLE_ODDS / (this.mods.sparkle || 1);
    if (starter) this.rec = R.rollKiki(this.v.id, 3, C.rng(C.hash(thing.id, Date.now())));
    else if (this.raid) { this.rec = R.raidCatchKiki(this.raid.raid, C.sysRng); if (R.isSparkle(thing.id, odds)) this.rec.sparkle = true; }
    else if (this.reward) { const r = C.rng(C.hash(thing.id, Date.now())); this.rec = R.rollKiki(this.v.id, Math.min(25, Math.max(5, R.levelOf(p.xp))), r); this.rec.iv = this.rec.iv.map(() => 10 + r.int(0, 6)); if (R.isSparkle(thing.id + Date.now(), odds)) this.rec.sparkle = true; }
    else this.rec = R.wildKiki(thing.id, this.v.id, R.levelOf(p.xp), { boosted: !!thing.boosted, sparkleOdds: odds });
    p.seen[this.v.id] = (p.seen[this.v.id] || 0) + 1;
    const last = settings.get('stone', 'rune');
    this.stoneId = p.items[last] > 0 ? last : R.STONES.find(id => p.items[id] > 0) || 'rune'; this.treat = null;
    this.place();
    this.hud(true);
    this.bind();
  }

  place() {
    // Where you're looking: the floor point straight ahead, kept 1.4–2.6 m away.
    const o = this.app.world.orient, h = o.rawHeading(this.camera.quaternion) * Math.PI / 180;
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    let d = f.y < -0.05 ? EYE / -f.y * Math.hypot(f.x, f.z) : 1.6;
    d = Math.max(1.0, Math.min(2.2, d));
    this.home = new THREE.Vector3(Math.sin(h) * d, -EYE, -Math.cos(h) * d);
    // No motion sensors (stand-in or a computer): tilt the view down to Kiki.
    if (!o.have || o.locked) o.pitch = -Math.atan2(EYE - 0.25, d) - 0.06; // Kiki a little above the middle, clear of the stone in your hand
    this.kiki = makeKiki(this.v.id, 0.42 * (this.rec.h / this.v.cm) ** 0.5, !!this.rec.sparkle); this.kiki.position.copy(this.home); this.group.add(this.kiki);
    this.kiki.rotation.y = Math.atan2(-this.home.x, -this.home.z);
    this.motion = new KikiMotion(this.kiki, reducedMotion);
    this.scale = this.kiki.scale.x;
    if (this.app.arOn) this.kiki.userData.shadow.material.opacity = 0.6; // a darker shadow so Kiki sits on the floor in the camera picture
    this.portal = makePortal(0.62); this.group.add(this.portal);
    this.stone = makeRuneStone(STONE_R, this.stoneId); this.group.add(this.stone);
    this.recolor();
    this.kiki.scale.setScalar(0.0001);
    if (this.liveAR()) this.seek(); else this.popIn();
  }
  /** AR with the real camera and motion sensors: the only time there is a real surface to find. */
  liveAR() { const o = this.app.world.orient; return !!(this.app.arOn && o.have && !o.locked); }
  popIn() {
    this.kiki.visible = true; this.kiki.scale.setScalar(0.0001);
    this.anim(0.45, k => this.kiki.scale.setScalar(this.scale * easeOutBack(k, 2.2)));
    sfx('pickup', 0.4); hx.light();
    if (this.rec.sparkle) setTimeout(() => { this.sparkles.burst(this.center, 26, 0xffe680, 0.05, 0.8, 1.0); this.sparkles.burst(this.center, 14, 0xffffff, 0.04, 0.6, 0.8); sfx('burst', 0.4); hx.success(); pop('✦ Sparkle! ✦', '#ffcf2e'); }, 500);
  }

  // ---------- finding a surface (owner: "the Kikis don't search for a surface in a room well enough … they need to find the
  // nearest surface and remain there during the capture") ----------
  // In live AR, Kiki waits until you point at a real surface: a ring shows where it will stand (the floor ahead, low in
  // the view), and only where the camera picture there has texture that can be found again (a real floor, rug or table,
  // not empty air or a blank wall) and the phone is held steady does Kiki pop out onto it. Tapping a spot works too.
  seek() {
    this.state = 'seek'; this.kiki.visible = false; this.seekT = 0; this.spotsHere = null; this.steadyT = 0; this.seekQ = this.camera.quaternion.clone();
    if (!this.reticle) {
      const g = new THREE.Group(), ringM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.17, 0.2, 48), ringM); ring.rotation.x = -Math.PI / 2; g.add(ring);
      const fill = new THREE.Mesh(new THREE.CircleGeometry(0.17, 48), new THREE.MeshBasicMaterial({ color: 0x7a00ff, transparent: true, opacity: 0.18, depthTest: false })); fill.rotation.x = -Math.PI / 2; g.add(fill);
      const prog = new THREE.Mesh(new THREE.RingGeometry(0.205, 0.235, 48, 1, 0, 0.001), new THREE.MeshBasicMaterial({ color: 0xffcf2e, transparent: true, depthTest: false, side: THREE.DoubleSide })); prog.rotation.x = -Math.PI / 2; g.add(prog);
      g.renderOrder = 10; g.userData = { ringM, prog }; this.reticle = g; this.group.add(g);
    }
    this.reticle.visible = false; this.app.world.vlock.clearSurface(); this.surfaceN = 0; this.lastHint = null; $('enc-tap').disabled = true; $('enc-tray').hidden = true;
    this.hint('Point at the floor (or a table) where Kiki can stand');
  }
  /** The floor point under a screen spot, or null if it's not a sensible place to stand (too far, too near, or not downwards). */
  floorAt(x, y, near = 0.55, far = 3.2) {
    const ndc = new THREE.Vector3(x / view.w * 2 - 1, -(y / view.h) * 2 + 1, 0.5).unproject(this.camera), dir = ndc.sub(this.camera.position).normalize();
    if (dir.y > -0.12) return null;
    const t = (-EYE - this.camera.position.y) / dir.y, to = this.camera.position.clone().addScaledVector(dir, t), d = Math.hypot(to.x, to.z);
    return d > far || d < near ? null : to;
  }
  seekUpdate(dt) {
    if (!this.liveAR()) { this.lastHint = null; this.replace(); return; } // the camera went off: Kiki stands in front of you
    this.seekT += dt;
    const sx = view.w / 2, sy = view.h * 0.6, at = this.floorAt(sx, sy), vl = this.app.world.vlock;
    // held steady: turning slower than about 30° a second (a hand holding still, not sweeping the room)
    const turned = this.camera.quaternion.angleTo(this.seekQ); this.seekQ.copy(this.camera.quaternion);
    // can this spot be kept? (enough findable little spots on it: checked a few times a second)
    this.seekN = (this.seekN || 0) + 1; if (this.seekN % 5 === 0 || this.spotsHere == null) this.spotsHere = vl.on ? vl.surfaceSpots(sx, sy) : 0;
    const good = !!at && (this.spotsHere >= 3 || this.seekT > 7);
    this.steadyT = good && turned < dt * 0.6 ? this.steadyT + dt : Math.max(0, this.steadyT - dt * 2);
    const R = this.reticle; R.visible = !!at;
    if (at) {
      R.position.copy(at); R.position.y += 0.005; const s = Math.min(1.3, Math.max(0.6, Math.hypot(at.x, at.z) / 1.6)); R.scale.setScalar(s);
      R.userData.ringM.color.set(good ? 0xffffff : 0xff8fb0); R.rotation.y += dt * 0.8;
      const k = Math.min(1, this.steadyT / 0.7); R.userData.prog.geometry.dispose(); R.userData.prog.geometry = new THREE.RingGeometry(0.205, 0.235, 48, 1, 0, Math.max(0.001, k * Math.PI * 2));
    }
    const want = !at ? 'Point at the floor (or a table) where Kiki can stand' : !good ? 'Aim at a spot with some pattern or detail…' : 'Hold steady…';
    if (want !== this.lastHint) { this.lastHint = want; this.hint(want); }
    if (at && this.steadyT >= 0.7) this.appear(at, sx, sy);
    else if (this.seekT > 14) { const p = this.floorAt(sx, sy); this.appear(p || this.home, p ? sx : null, sy); } // never stuck
  }
  /** Kiki pops out onto the surface found at screen spot (sx, sy), and remembers it. */
  appear(at, sx, sy) {
    this.home.copy(at); this.kiki.position.copy(at); this.kiki.rotation.y = Math.atan2(-at.x, -at.z);
    this.reticle.visible = false; this.state = 'ready'; this.lastHint = null;
    this.surfaceN = sx == null ? 0 : this.app.world.vlock.setSurface(sx, sy);
    this.sparkles.burst(at.clone().setY(at.y + 0.15), 16, 0xd9a8ff, 0.03, 0.6, 0.6);
    this.popIn(); hx.success();
  }
  /** Each frame in live AR: keep Kiki's feet on the remembered surface as the view moves. */
  followSurface() {
    if (!this.liveAR()) return;
    const vl = this.app.world.vlock;
    if (!this.surfaceN || (vl.surf && vl.surf.lost > 60)) { this.reanchor(); if (!this.surfaceN) return; }
    const r = vl.trackSurface(); if (!r) return;
    const at = this.floorAt(r.x, r.y, 0.25, 6); if (!at) return; // (you may walk right up to Kiki, or back off)
    // where Kiki's feet are now in the world (the whole scene may be carried along during the capture, see below)
    const d = at.sub(this.home).sub(this.group.position); d.y = 0;
    if (d.length() > 0.8) return; // a jump that big is a mismatch, not you moving
    d.multiplyScalar(0.7);
    // During the capture (stone, portal, wobbles on the ground) everything moves together with the surface: carry the
    // whole scene. Otherwise only Kiki's spot moves (the stone in your hand stays in your hand).
    if (this.state === 'resolving') { this.group.position.add(d); return; }
    this.home.add(d);
    if (this.state !== 'moving') { this.kiki.position.x = this.home.x; this.kiki.position.z = this.home.z; }
  }
  /** Kiki's spot isn't remembered (the camera was still starting) or hasn't been found for a while although it's in
   *  view: remember it again from where Kiki's feet are on screen now, if the picture there can be found again. */
  reanchor() {
    const vl = this.app.world.vlock;
    if (!vl.on || (this.state !== 'ready' && this.state !== 'out') || (this.reanchorN = (this.reanchorN || 0) + 1) % 15) return;
    const p = this.home.clone().project(this.camera); if (p.z > 1 || Math.abs(p.x) > 0.8 || Math.abs(p.y) > 0.8) return;
    const sx = (p.x + 1) / 2 * view.w, sy = (1 - p.y) / 2 * view.h;
    if (vl.surfaceSpots(sx, sy) < 3) return;
    this.surfaceN = vl.setSurface(sx, sy);
  }
  /** After the capture: fold the carried scene back into Kiki's spot. */
  settle() {
    const g = this.group.position; if (!g.x && !g.z) return;
    this.home.add(g); this.kiki.position.add(g); this.portal.position.add(g); g.set(0, 0, 0);
  }

  /** Tap the floor (or a table top) and Kiki hops there. Its feet land right where you tapped. */
  placeAt(x, y) {
    if (!this.app.arOn) return;
    const ndc = new THREE.Vector3(x / view.w * 2 - 1, -(y / view.h) * 2 + 1, 0.5).unproject(this.camera), dir = ndc.sub(this.camera.position).normalize();
    if (dir.y > -0.08) return toast('Tap the floor (or a table) where you want Kiki.', 2400);
    const to = this.floorAt(x, y); if (!to) return toast('Tap the floor (or a table) a little closer.', 2400);
    const from = this.kiki.position.clone(); this.home = to.clone(); hx.light(); sfx('button', 0.3);
    this.surfaceN = 0; this.app.world.vlock.clearSurface();
    this.state = 'moving'; this.motion.stop(); this.motion.idling = false;
    this.anim(0.4, k => { this.kiki.position.lerpVectors(from, to, k); this.motion.hop(Math.sin(k * Math.PI) * 0.7); })
      .then(() => { this.motion.hop(0); this.motion.idling = true; if (this.state === 'moving') this.state = 'ready'; if (this.liveAR()) this.surfaceN = this.app.world.vlock.setSurface(x, y); });
  }
  /** AR switched on or off: put Kiki where you're looking now. */
  replace() {
    if (this.state !== 'ready' && this.state !== 'out' && this.state !== 'seek') return;
    if (this.liveAR()) { this.seek(); return; }
    if (this.state === 'seek') { this.state = 'ready'; this.reticle.visible = false; this.popIn(); }
    this.surfaceN = 0; this.app.world.vlock.clearSurface();
    const o = this.app.world.orient, h = o.rawHeading(this.camera.quaternion) * Math.PI / 180, d = 1.6;
    if (!o.have || o.locked) o.pitch = -Math.atan2(EYE - 0.25, d) - 0.06; // Kiki a little above the middle, clear of the stone in your hand
    this.home = new THREE.Vector3(Math.sin(h) * d, -EYE, -Math.cos(h) * d); this.kiki.position.copy(this.home);
  }
  /** How hard the catch is, as the dot on the name card: green is easy, red is hard. */
  recolor() {
    this.odds = R.catchOdds(this.v.rarity, this.rec.lvl, { stone: this.raid ? 'moon' : this.stoneId, treat: this.treat, odds: tuning.odds });
    const dot = $('enc-odds'); if (dot) { dot.style.background = R.ringColor(this.odds); dot.title = dot.ariaLabel = this.odds >= 0.6 ? 'Easy catch' : this.odds >= 0.35 ? 'Medium catch' : this.odds >= 0.18 ? 'Tricky catch' : 'Hard catch'; }
  }

  get center() { return this.kiki.position.clone().add(new THREE.Vector3(0, GROUND * this.scale, 0)); }

  hud(on) {
    $('hud').hidden = on; $('enc-hud').hidden = !on;
    if (!on) return;
    $('enc-name').textContent = this.v.name; $('enc-rarity').textContent = (this.rec.size ? this.rec.size + ' · ' : '') + C.RARITY[this.v.rarity].label; $('enc-rarity').style.color = C.RARITY[this.v.rarity].second;
    $('enc-power').innerHTML = `<i class="el-dot" style="background:${R.ELEMENT_COLOR[this.v.element]}"></i> POWER ${R.power(this.rec)}${this.rec.boosted ? ' · boosted' : ''}`;
    $('enc-name').textContent = (this.rec.sparkle ? '✦ ' : '') + this.v.name;
    $('enc-ar').textContent = this.app.arOn ? 'AR on' : 'AR off';
    $('enc-tray').hidden = true; $('enc-treat').hidden = true;
    this.stones(); this.hint(this.starter ? 'Flick the stone right at Kiki! Hit the middle for a bonus.' : 'Flick the stone at Kiki!');
    if (this.app.arOn && (+localStorage.getItem('kiki-place-tip') || 0) < 3) { localStorage.setItem('kiki-place-tip', (+localStorage.getItem('kiki-place-tip') || 0) + 1); setTimeout(() => this.state === 'ready' && toast('Tip: tap the floor or a table to move Kiki there.', 3200), 1800); }
  }
  stones() {
    const p = this.app.progress, sb = $('enc-stone'), fb = $('enc-food');
    if (this.raid) { sb.querySelector('img').src = portrait('item:star', 128); sb.querySelector('b').textContent = this.raidStones; }
    else { sb.querySelector('img').src = portrait('item:' + this.stoneId, 128); sb.querySelector('b').textContent = p.items[this.stoneId] || 0; }
    const t = this.treat || R.TREATS.find(id => p.items[id] > 0) || 'honey';
    fb.querySelector('img').src = portrait('item:' + t, 128); fb.querySelector('b').textContent = R.TREATS.reduce((a, id) => a + (p.items[id] || 0), 0);
    fb.style.opacity = this.treat ? 0.5 : 1;
  }
  /** The stone or treat picker. */
  tray(kind) {
    const el = $('enc-tray'), p = this.app.progress, L = R.levelOf(p.xp);
    if (!el.hidden && el.dataset.kind === kind) { el.hidden = true; return; }
    if (this.state !== 'ready' && this.state !== 'out') return;
    if (this.raid && kind === 'stone') { toast('Raid Stones only for this catch.'); return; }
    const ids = kind === 'stone' ? R.STONES : R.TREATS;
    el.dataset.kind = kind; el.hidden = false; sfx('button', 0.3);
    el.innerHTML = ids.map(id => { const locked = L < R.ITEMS[id].unlock, n = p.items[id] || 0;
      return `<button data-id="${id}" class="${(kind === 'stone' ? this.stoneId : this.treat) === id ? 'on' : ''}" ${locked || !n ? 'disabled' : ''}><img src="${portrait('item:' + id, 128)}" alt="">${locked ? 'Level ' + R.ITEMS[id].unlock : R.ITEMS[id].name + ' ×' + n}</button>`; }).join('')
      + `<div class="tray-note">${kind === 'treat' && this.treat ? 'Kiki is already enjoying a treat.' : kind === 'treat' ? 'A treat lasts until your next catch attempt.' : 'Better stones catch more easily.'}</div>`;
    el.querySelectorAll('[data-id]').forEach(b => b.onclick = () => { el.hidden = true; if (kind === 'stone') this.setStone(b.dataset.id); else this.feed(b.dataset.id); });
  }
  setStone(id) {
    if (id === this.stoneId) return;
    this.stoneId = id; settings.set('stone', id); this.group.remove(this.stone); this.stone = makeRuneStone(STONE_R, id); this.group.add(this.stone);
    if (this.state === 'out') this.state = 'ready';
    this.recolor(); this.stones(); hx.light(); sfx('pickup', 0.3);
  }
  /** Toss a treat: it floats to Kiki, who munches it happily. */
  feed(id) {
    if (this.treat || this.state !== 'ready' && this.state !== 'out') return;
    if (!R.useItem(this.app.progress, id)) return;
    this.app.save(); this.treat = id; this.stones(); this.state = 'feeding'; hx.light(); sfx('throw', 0.35); this.app.did && this.app.did({ type: 'feed' });
    const tr = makeTreat(id, 0.05); this.group.add(tr);
    const from = this.camera.localToWorld(HAND.clone()), to = this.center.add(new THREE.Vector3(0, 0.03, 0));
    this.anim(0.6, k => { tr.position.lerpVectors(from, to, k).y += Math.sin(k * Math.PI) * 0.15; tr.rotation.y = k * 8; }).then(() => {
      this.group.remove(tr); this.sparkles.burst(to, 10, id === 'honey' ? 0xffa200 : 0xffcf2e, 0.03, 0.4, 0.6); sfx('pickup', 0.4); hx.medium();
      this.motion.play(this.motion.tinyHops());
      const b = $('enc-treat'); b.hidden = false; b.innerHTML = `<img src="${portrait('item:' + id, 128)}" alt="">${id === 'honey' ? 'Easier to catch' : 'Double Fluff'}`;
      this.state = this.app.progress.items[this.stoneId] > 0 ? 'ready' : 'out'; this.recolor();
    });
  }
  hint(t) { $('enc-hint').hidden = !t; $('enc-hint').textContent = t || ''; }

  bind() {
    const gl = $('gl');
    this.onDown = e => {
      if (this.state === 'seek') { this.placeTap = [e.clientX, e.clientY, performance.now()]; return; }
      if (this.state !== 'ready') return;
      if (!$('enc-tray').hidden) { $('enc-tray').hidden = true; return; }
      const near = this.stoneScreen().distanceTo(new THREE.Vector2(e.clientX, e.clientY)) < view.h * 0.12;
      if (!near && e.clientY < view.h * 0.65) { this.placeTap = [e.clientX, e.clientY, performance.now()]; return; }
      this.state = 'drag'; this.samples = [[e.clientX, e.clientY, performance.now() / 1000]]; this.spin = 0; this.lastDir = null; this.spinning = false;
      hx.tick(); gl.setPointerCapture && gl.setPointerCapture(e.pointerId);
    };
    this.onMove = e => {
      if (this.state !== 'drag') return;
      const last = this.samples[this.samples.length - 1], dx = e.clientX - last[0], dy = e.clientY - last[1];
      if (Math.hypot(dx, dy) < 3) return;
      const dir = Math.atan2(dy, dx);
      if (this.lastDir != null) { let d = dir - this.lastDir; d = (d + Math.PI * 3) % (Math.PI * 2) - Math.PI; this.spin += d; }
      this.lastDir = dir; this.samples.push([e.clientX, e.clientY, performance.now() / 1000]); if (this.samples.length > 90) this.samples.shift();
      if (!this.spinning && Math.abs(this.spin) > Math.PI * 3) { this.spinning = true; hx.light(); this.sparkles.burst(this.stone.position.clone(), 8, 0x7a00ff, 0.02, 0.15, 0.4); }
      this.dragPos = [e.clientX, e.clientY];
    };
    this.onUp = e => {
      if (this.state === 'drag') return this.release(e.clientX, e.clientY);
      const t = this.placeTap; this.placeTap = null;
      if (t && performance.now() - t[2] < 450 && Math.hypot(e.clientX - t[0], e.clientY - t[1]) < 14) {
        if (this.state === 'ready') this.placeAt(e.clientX, e.clientY);
        else if (this.state === 'seek') { const at = this.floorAt(e.clientX, e.clientY); if (at) this.appear(at, e.clientX, e.clientY); else toast('Tap the floor (or a table) a little closer.', 2200); }
      }
    };
    gl.addEventListener('pointerdown', this.onDown); addEventListener('pointermove', this.onMove); addEventListener('pointerup', this.onUp);
    $('enc-tap').onclick = () => this.tapThrow();
    $('enc-back').onclick = () => { if (this.state === 'ready' || this.state === 'drag' || this.state === 'out' || this.state === 'seek') this.finish('left'); };
    $('enc-stone').onclick = () => this.tray('stone');
    $('enc-food').onclick = () => this.tray('treat');
    $('enc-ar').onclick = async () => {
      if (this.state !== 'ready' && this.state !== 'out' && this.state !== 'seek') return;
      await this.app.setEncounterAR(!this.app.arOn); $('enc-ar').textContent = this.app.arOn ? 'AR on' : 'AR off'; this.replace(); sfx('button', 0.3);
    };
  }
  unbind() {
    $('gl').removeEventListener('pointerdown', this.onDown); removeEventListener('pointermove', this.onMove); removeEventListener('pointerup', this.onUp);
    for (const id of ['enc-tap', 'enc-back', 'enc-stone', 'enc-food', 'enc-ar']) $(id).onclick = null;
    $('enc-tray').hidden = true; $('enc-treat').hidden = true;
  }

  stoneScreen() { const p = this.camera.localToWorld(HAND.clone()).project(this.camera); return new THREE.Vector2((p.x + 1) / 2 * view.w, (1 - p.y) / 2 * view.h); }

  release(x, y) {
    const now = performance.now() / 1000; let first = this.samples[0];
    for (let i = this.samples.length - 1; i >= 0; i--) if (now - this.samples[i][2] > 0.1) { first = this.samples[i]; break; }
    const dt = Math.max(0.016, now - first[2]), vy = -(y - first[1]) / dt / view.h, vx = (x - first[0]) / dt / view.h;
    if (vy < 0.55) { this.state = 'ready'; return; } // too gentle: back to the hand
    const speed = Math.min(11, Math.max(1.5, vy * 2.4)) * tuning.strength;
    const q = this.camera.quaternion, fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q), up = new THREE.Vector3(0, 1, 0).applyQuaternion(q), right = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    const vel = fwd.multiplyScalar(speed).addScaledVector(up, speed * 0.28).addScaledVector(right, vx * 2.4 * tuning.strength);
    const o = this.stone.position.clone(), t = this.center, a = C.aimAssist(o, t, vel, tuning.gravity, tuning.aimAssist);
    this.tapped = false; this.launch(o, new THREE.Vector3(a.x, a.y, a.z), this.spinning);
  }

  tapThrow() {
    if (this.state !== 'ready') return;
    const o = this.stone.position.clone(), t = this.center.add(new THREE.Vector3().randomDirection().multiplyScalar(0.05 * (1 - tuning.aimAssist)));
    const v = C.solveThrow(o, t, tuning.gravity, C.naturalTime(Math.hypot(t.x - o.x, t.z - o.z)));
    this.launch(o, new THREE.Vector3(v.x, v.y, v.z), false); this.tapped = true; // tap throws always land, but earn no bonus
  }

  launch(o, v, spin) {
    const app = this.app;
    if (this.raid) { if (this.raidStones <= 0) return this.outOfStones(); this.raidStones--; }
    else if (!R.useItem(app.progress, this.stoneId)) return this.outOfStones();
    app.progress.stats.throws++; app.save(); this.stones(); this.hint(null); this.taught = true; $('enc-tray').hidden = true;
    this.throwAim = 1; this.spinThrow = spin;
    this.pos = o; this.vel = v; this.flight = 0; this.state = 'fly';
    $('enc-tap').disabled = true; sfx('throw', 0.45); hx.light();
  }

  outOfStones() {
    if (this.raid) { this.state = 'out'; pop('It slipped away!', '#ff5d8f'); this.hint('Out of Raid Stones. The boss went back through the portal.'); setTimeout(() => this.finish('fled'), 2200); return; }
    const other = R.STONES.find(id => this.app.progress.items[id] > 0);
    if (other) { this.setStone(other); this.state = 'ready'; toast(`Switched to ${R.ITEMS[other].plural}`); return; }
    this.state = 'out';
    this.hint('Out of stones! Grab more at a supply stop. Kiki will wait for you.');
  }

  // per-frame tasks
  anim(dur, fn) { return new Promise(res => { let t = 0; this.app.tasks.add(dt => { t += dt; fn(Math.min(1, t / dur), dt, t); if (t >= dur) { res(); return true; } return false; }); }); }

  update(dt, time) {
    this.clock += dt;
    if (this.state === 'seek') { this.seekUpdate(dt); this.portal.userData.update(dt, time, this.camera); this.stone.visible = false; return; }
    if (this.state !== 'reveal' && this.state !== 'done' && this.state !== 'moving') this.followSurface();
    this.motion.update(dt);
    this.portal.userData.update(dt, time, this.camera);
    this.stone.userData.update(dt, time);
    if (this.state === 'ready' || this.state === 'out') {
      // If Kiki is off-screen, say where to look.
      const p = this.center.project(this.camera), off = p.z > 1 || Math.abs(p.x) > 0.95 || p.y < -0.75 || p.y > 0.95;
      const want = off ? (p.z > 1 ? 'Turn around: Kiki is behind you' : p.y < -0.75 ? 'Look down: Kiki is right in front of you' : p.x > 0 ? 'Kiki is to your right' : 'Kiki is to your left')
        : this.state === 'out' ? 'Out of stones! Grab more at a supply stop.' : this.taught ? null : this.starter ? 'Flick the stone right at Kiki! Hit the middle for a bonus.' : 'Flick the stone at Kiki!';
      if (want !== this.lastHint) { this.lastHint = want; this.hint(want); }
    }
    if (this.state === 'ready' || this.state === 'drag' || this.state === 'fly') {
      this.kiki.rotation.y = Math.atan2(-this.kiki.position.x, -this.kiki.position.z);
    }
    if (this.state === 'ready' || this.state === 'out') {
      this.stone.visible = this.state === 'ready';
      this.stone.position.copy(this.camera.localToWorld(HAND.clone()));
      this.stone.quaternion.copy(this.camera.quaternion).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.05, 0, 0)));
      this.stone.userData.body.rotation.set(0, time * 0.7, 0);
      $('enc-tap').disabled = this.state !== 'ready';
    } else if (this.state === 'drag' && this.dragPos) {
      const ndc = new THREE.Vector3(this.dragPos[0] / view.w * 2 - 1, -(this.dragPos[1] / view.h) * 2 + 1, 0.5).unproject(this.camera);
      const dir = ndc.sub(this.camera.position).normalize(), fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
      this.stone.position.copy(this.camera.position).addScaledVector(dir, 0.46 / Math.max(0.3, dir.dot(fwd)));
      this.stone.userData.body.rotation.y = time * (this.spinning ? 16 : 0.7);
    } else if (this.state === 'fly') {
      this.flight += dt;
      this.vel.y -= tuning.gravity * dt; this.pos.addScaledVector(this.vel, dt);
      this.stone.position.copy(this.pos);
      this.stone.userData.body.rotation.set(this.flight * 12, this.flight * (this.spinThrow ? 24 : 3.5), 0);
      const reach = tuning.hitRadius * (this.v.id === 'sprout' ? 0.78 : 1) + STONE_R;
      if (this.pos.distanceTo(this.center) <= reach) {
        // How close to Kiki's middle the stone was heading: 0 is dead centre, 1 is a graze. That's the throw bonus.
        const v = this.vel.clone().normalize(), off = this.center.sub(this.pos).cross(v).length();
        this.throwAim = this.tapped ? 1 : Math.min(1, off / reach); return this.resolve(true);
      }
      if (this.pos.y <= -EYE + STONE_R * 0.5 || this.flight > 2.5 || this.pos.length() > 7) this.resolve(false);
    }
  }

  async resolve(hit) {
    this.state = 'resolving';
    const app = this.app, p = app.progress;
    const o = R.resolveCatch(this.v.rarity, this.rec.lvl, { hit, ring: this.throwAim, spin: this.spinThrow, treat: this.treat, odds: tuning.odds, guaranteed: this.starter, noFlee: this.starter || this.reward || !!this.raid, stone: this.raid ? 'moon' : this.stoneId }, C.sysRng);
    let steps = C.revealSteps(o.result === 'fled' ? { ...o, result: 'brokeout' } : o, this.v.rarity, reducedMotion());
    if (o.result === 'fled') steps = steps.map(s => s.kind === 'soClose' ? { kind: 'flee', dur: 1.3, haptic: 'warning', voice: 'awww', voiceChance: 0.6 } : s);
    this.o = o;
    let rw = null; const now = Math.floor(Date.now() / 1000);
    if (o.quality === 'Excellent') p.stats.excellent++;
    const treatUsed = this.treat;
    if (o.result !== 'missed' && this.treat) { this.treat = null; $('enc-treat').hidden = true; } // a treat lasts one catch attempt
    if (o.result !== 'missed' && this.app.did) { if (o.quality) this.app.did({ type: 'throw', q: o.quality }); if (o.spin) this.app.did({ type: 'spinThrow' }); }
    if (o.result === 'caught') {
      rw = R.catchRewards(p, this.v.id, { quality: o.quality, spin: o.spin, treat: treatUsed });
      rw.sprouts = Math.round(rw.sprouts * (this.mods.sprouts || 1) * (this.rec.boosted ? R.BOOST_SPROUTS : 1));
      if ((this.mods.xp || 1) > 1) { const extra = rw.xpTotal * (this.mods.xp - 1); rw.xp.push([`Event bonus ×${this.mods.xp}`, extra]); rw.xpTotal += extra; }
      const d = R.daily(p, 'catch', now); if (d) { rw.xp.push([d.bonus ? '7-day catch streak!' : `First catch today (day ${d.day})`, d.xp]); rw.xpTotal += d.xp; rw.sprouts += d.sprouts; }
      this.kikiRec = R.addKiki(p, this.rec, now, app.placeName ? app.placeName() : '');
      p.sprouts += rw.sprouts; p.fluff[rw.family] = (p.fluff[rw.family] || 0) + rw.fluff;
      this.ups = R.giveXp(p, rw.xpTotal);
      if (!this.starter && !this.reward) R.markGone(p, this.thing.id, now);
      app.save(); if (app.did) app.did({ type: 'catch', el: this.v.element });
    } else if (o.result === 'fled') { p.stats.fled++; if (!this.starter) R.markGone(p, this.thing.id, now); app.save(); }
    const first = rw && rw.first;
    const at = this.pos.clone();
    for (const s of steps) {
      if (s.kind === 'stamp') break; // the reveal screen takes over
      hx.play(s.haptic); if (s.sfx) sfx(s.sfx, 0.5); if (s.voice) voice(s.voice, s.voiceChance);
      await this.beat(s, at);
    }
    if (o.result === 'caught') { this.state = 'reveal'; this.reveal(o, rw, first, steps); return; }
    if (o.result === 'fled') { this.finish('fled'); return; }
    this.settle(); this.kiki.visible = true; this.motion.idling = true;
    this.state = 'ready'; this.stone.scale.setScalar(1); this.stone.userData.body.rotation.set(0, 0, 0); this.recolor(); this.stones();
    if (this.raid ? this.raidStones <= 0 : !(app.progress.items[this.stoneId] > 0)) this.outOfStones();
  }

  async beat(s, hitPoint) {
    const d = s.dur, c = this.center, toCam = new THREE.Vector3(-c.x, 0, -c.z).normalize();
    const portalPos = c.clone().addScaledVector(toCam, -0.06).add(new THREE.Vector3(0, 0.02, 0)), hover = c.clone().addScaledVector(toCam, 0.14);
    const st = this.stone, reduced = reducedMotion();
    switch (s.kind) {
      case 'hit':
        if (this.o && (this.o.quality || this.o.spin)) pop([this.o.quality && this.o.quality + '!', this.o.spin && 'Spin!'].filter(Boolean).join(' '), { Nice: '#36b6ff', Great: '#5fd34b', Excellent: '#ffcf2e' }[this.o.quality] || '#c77dff');
        this.sparkles.burst(hitPoint, 14, 0xd9c0ff, 0.035, 0.5, 0.5); st.userData.flash(2);
        return this.anim(d, k => st.position.lerpVectors(hitPoint, hover, 1 - Math.pow(1 - k, 3)));
      case 'portalOpen':
        this.motion.stop(); this.motion.idling = false; this.portal.position.copy(portalPos); this.portal.userData.target = 1;
        this.sparkles.burst(portalPos, 10, 0x7a00ff, 0.03, 0.35, 0.6);
        return this.anim(d, (k, dt, t) => { st.position.copy(hover).y += Math.sin(t * 12) * 0.006; st.userData.body.rotation.set(-1.2, t * 5, 0); });
      case 'suck': {
        this.portal.userData.boost = 1;
        this.sparkles.implode(portalPos, 0.35, 26, 0x7a00ff, 0.028, d); this.sparkles.implode(portalPos, 0.25, 12, 0x8c59ff, 0.02, d * 0.9);
        // Jumanji: Kiki twists into the swirl like water down a drain, edges smearing into spiral arms, until it's gone
        const start = this.kiki.position.clone(), s0 = this.scale, rot0 = this.kiki.rotation.clone();
        if (!this.vortex) this.vortex = vortexify(this.kiki);
        const axis = portalPos.clone().sub(this.camera.position).normalize(), centre = portalPos.clone();
        this.kiki.updateMatrixWorld(true);
        await this.anim(reduced ? d : d * 1.25, (k, dt, t) => {
          const e = k * k * (3 - 2 * k);
          if (reduced) { this.kiki.scale.setScalar(s0 * (1 - e)); return; }
          this.vortex.set(Math.min(1, e * 1.08), centre, axis, t);
          this.kiki.position.lerpVectors(start, portalPos, e * 0.35); // a little drift towards the eye as it goes
          if (k > 0.85) this.kiki.scale.setScalar(s0 * Math.max(0.0001, 1 - (k - 0.85) / 0.15)); // the last gulp
          st.position.copy(hover).y += Math.sin(t * 20) * 0.004;
        });
        this.vortex.set(0, centre, axis, 0);
        this.kiki.visible = false; this.kiki.position.copy(start); this.kiki.scale.setScalar(s0); this.kiki.rotation.copy(rot0);
        return;
      }
      case 'seal':
        this.portal.userData.target = 0; this.portal.userData.boost = 0; st.userData.flash(3.5); this.sparkles.implode(hover, 0.12, 14, 0x7a00ff, 0.02, d);
        return this.anim(d, () => {});
      case 'drop': {
        const from = st.position.clone(), to = new THREE.Vector3(from.x, -EYE + STONE_R * 0.42, from.z);
        await this.anim(d, k => { const kk = Math.min(1, k / 0.7); st.position.lerpVectors(from, to, kk * kk).y += k < 0.7 ? 0 : Math.sin((k - 0.7) / 0.3 * Math.PI) * 0.025; });
        st.quaternion.setFromEuler(new THREE.Euler(0, Math.atan2(-toCam.x, -toCam.z), 0)); st.userData.body.rotation.set(0, 0, 0);
        return;
      }
      case 'wobble': {
        const amp = (reduced ? 10 : 24) * Math.PI / 180, dir = s.index % 2 ? 1 : -1; let knocked = false;
        await this.anim(d, k => { st.userData.body.rotation.z = Math.sin(k * Math.PI * 2) * amp * dir * (k < 0.75 ? 1 : (1 - k) * 4); if (!knocked && k > 0.25) { knocked = true; st.userData.flash(1.6); } });
        st.userData.body.rotation.z = 0;
        return this.anim(0.18, () => {});
      }
      case 'burst':
        st.userData.flash(4); this.sparkles.burst(st.position.clone().setY(st.position.y + 0.03), 30, 0x7a00ff, 0.04, 0.9, 0.8); this.sparkles.burst(st.position.clone(), 16, 0xffd966, 0.03, 0.7, 0.7);
        await this.anim(d, k => st.scale.setScalar((1 + (1 - Math.pow(1 - k, 3)) * 0.6) * (1 - k)));
        st.visible = false; return;
      case 'popOpen': {
        const sp = st.position.clone().add(new THREE.Vector3(0, 0.12, 0)); this.portal.position.copy(sp); this.portal.userData.open = 0.6; this.portal.userData.target = 0;
        st.visible = false; this.sparkles.burst(sp, 18, 0x7a00ff, 0.035, 0.8, 0.6); this.kiki.visible = true;
        await this.anim(d, k => { this.kiki.scale.setScalar(this.scale * Math.max(0.0001, easeOutBack(k, 2.4))); this.kiki.position.copy(this.home).y += Math.sin(k * Math.PI) * 0.12; });
        this.kiki.scale.setScalar(this.scale); this.kiki.position.copy(this.home); st.visible = true;
        return;
      }
      case 'soClose':
        pop(s.text, '#ff5d8f'); if (s.shake) shake($('game'), 16, 400);
        this.motion.idling = true; this.motion.play(this.motion.randomIdle());
        return this.anim(d, () => {});
      case 'flee': {
        pop('It ran away!', '#ff5d8f'); this.motion.stop(); this.motion.idling = false;
        const from = this.kiki.position.clone(), away = from.clone().add(new THREE.Vector3(from.x, 0, from.z).normalize().multiplyScalar(1.2));
        await this.anim(d * 0.7, k => { this.kiki.position.lerpVectors(from, away, k).y += Math.sin(k * Math.PI * 3) * 0.12 * (1 - k); this.kiki.rotation.y += 0.25; this.kiki.scale.setScalar(this.scale * (1 - k * 0.6)); });
        this.sparkles.burst(this.kiki.position.clone().add(new THREE.Vector3(0, 0.1, 0)), 22, 0xffffff, 0.04, 0.6, 0.6); this.kiki.visible = false;
        return this.anim(d * 0.3, () => {});
      }
      case 'bounce': {
        const v = this.vel.clone(); v.y = Math.abs(v.y) * 0.35; v.x *= 0.5; v.z *= 0.5; const p = this.pos.clone(); p.y = Math.max(p.y, -EYE + STONE_R * 0.5);
        return this.anim(d, (k, dt) => { v.y -= tuning.gravity * dt; p.addScaledVector(v, dt); if (p.y < -EYE + STONE_R * 0.5) { p.y = -EYE + STONE_R * 0.5; v.y = Math.abs(v.y) * 0.3; } st.position.copy(p); });
      }
      case 'fizzle':
        this.sparkles.burst(st.position.clone(), 8, 0x9980e6, 0.02, 0.2, 0.5);
        await this.anim(d, k => st.scale.setScalar(Math.max(0.0001, 1 - k)));
        return;
      default: return this.anim(d, () => {});
    }
  }

  // ---------- the reveal ----------
  reveal(o, rw, first, steps) {
    // A stacked layout (top: rarity, name, Power; middle: Kiki; bottom: rewards, button). Every slot is there from the
    // start (hidden until its moment), so nothing jumps or overlaps as the reveal plays out.
    const el = document.createElement('div'); el.className = 'reveal';
    if (!Encounter.cosmicUrl) Encounter.cosmicUrl = cosmicCanvas(512).toDataURL();
    const sub = `POWER ${R.power(this.rec)}${this.rec.size ? ' · ' + this.rec.size : ''}${this.rec.sparkle ? ' · SPARKLE' : ''}`;
    el.innerHTML = `<img class="cosmic" src="${Encounter.cosmicUrl}" alt=""><div class="flash"></div>
      <div class="rv-top"><div class="stamp" style="color:${C.RARITY[this.v.rarity].main}"></div>
        <div class="vname hide"><span class="nm">${this.rec.sparkle ? '✦ ' : ''}${this.v.name}</span>${first ? '<span class="new sticker">NEW!</span>' : ''}</div>
        <div class="vsub hide">${sub}</div></div>
      <div class="rv-space"></div><div class="kiki"></div>
      <div class="rv-bottom"><div class="sticker reward hide">${rw.xp.map(([label, amount]) => `<div class="ln">${label} <span>+${amount}</span></div>`).join('')}<div class="tot">+0 XP</div>
        <div class="extra"><span>+${rw.sprouts} Sprouts</span><span>+${rw.fluff} ${R.fluffName(rw.family)}</span></div></div>
        <button type="button" class="pill play keep hide">Keep playing</button></div>`;
    $('overlay').appendChild(el); $('enc-hud').hidden = true;
    const q = sel => el.querySelector(sel), show = n => n.classList.remove('hide');
    // Kiki on the cosmic spiral, on the shared screen stage.
    let k, motion;
    const space = q('.rv-space');
    const st = liveStage(q('.kiki'), (scene, cam) => {
      k = makeKiki(this.v.id, 0.42, !!this.rec.sparkle); k.visible = false; scene.add(k);
      motion = new KikiMotion(k, reducedMotion); motion.idling = false;
      let fit = '';
      return { update: dt => {
        motion.update(dt);
        // Frame Kiki in the clear space: the camera backs off so Kiki fills about 60% of it, and the picture is shifted
        // so Kiki stands in its middle (the whole screen is still drawn, so jumps can go up over the title).
        const W = view.w, H = view.h, r = space.getBoundingClientRect(), sig = [W, H, Math.round(r.top), Math.round(r.height)].join();
        if (sig === fit || r.height < 10) return; fit = sig;
        const viewH = 0.85 * H / r.height, d = Math.max(1.2, viewH / (2 * Math.tan(15 * Math.PI / 180)));
        cam.fov = 30; cam.position.set(0, 0.3, d); cam.lookAt(0, 0.25, 0);
        cam.setViewOffset(W, H, 0, -((r.top + r.height * 0.52) - H / 2), W, H); cam.updateProjectionMatrix();
      } };
    });
    const sleep = ms => new Promise(res => setTimeout(res, ms));
    (async () => {
      await sleep(350);
      for (const s of steps.slice(steps.findIndex(x => x.kind === 'stamp'))) {
        hx.play(s.haptic); if (s.sfx) sfx(s.sfx, 0.55); if (s.voice) voice(s.voice, s.voiceChance);
        if (s.kind === 'stamp') {
          const stp = q('.stamp'); stp.textContent = s.text; requestAnimationFrame(() => requestAnimationFrame(() => stp.classList.add('in')));
          await sleep(280); show(q('.vname')); show(q('.vsub'));
          await sleep(220);
        } else if (s.kind === 'dropIn') {
          k.visible = true; const t0 = performance.now();
          await new Promise(res => { const f = () => { const kk = Math.min(1, (performance.now() - t0) / (s.dur * 700)); k.position.y = 1.6 * (1 - kk * kk); if (kk < 1) requestAnimationFrame(f); else res(); }; f(); });
          hx.light();
        } else if (s.kind === 'dance') {
          motion.play(motion.randomDance()); const t0 = performance.now();
          while ((motion.busy || performance.now() - t0 < s.dur * 1000) && performance.now() - t0 < 4000) await sleep(50);
          motion.idling = true;
        } else if (s.kind === 'countUp') {
          const box = q('.reward'), lns = box.querySelectorAll('.ln'), tot = box.querySelector('.tot'); let run = 0;
          lns.forEach(l => l.classList.add('wait')); box.querySelector('.extra').classList.add('wait'); show(box);
          for (let i = 0; i < rw.xp.length; i++) {
            const amount = rw.xp[i][1]; lns[i].classList.remove('wait'); sfx('count', 0.4);
            const from = run, dur = Math.min(450, s.dur * 1000 / rw.xp.length), t0 = performance.now(); let ticks = 0;
            while (performance.now() - t0 < dur) { run = Math.round(from + amount * (performance.now() - t0) / dur); tot.textContent = `+${run} XP`; if (++ticks % 4 === 0) { hx.tick(); sfx('count', 0.25, 1 + (performance.now() - t0) / dur); } await sleep(16); }
            run = from + amount; tot.textContent = `+${run} XP`;
          }
          box.querySelector('.extra').classList.remove('wait'); sfx('pickup', 0.4);
        } else if (s.kind === 'keepPlaying') {
          const b = q('.keep'); show(b);
          b.onclick = () => { sfx('button', 0.35); hx.light(); st.stop(); el.remove(); this.finish('caught'); };
          return; // never closes by itself
        }
      }
    })();
  }

  finish(why) {
    this.state = 'done'; this.unbind(); this.scene.remove(this.group);
    // free this catch's buffers on the graphics chip (shared shapes are simply sent again next time they're drawn)
    this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); $('enc-hud').hidden = true; $('hud').hidden = false; $('enc-tap').disabled = false; this.hint(null);
    this.onDone(why);
  }
}
