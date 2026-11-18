// The catch (decisions doc, section 7, with the owner's Rune Stone and portal). Kiki stands on the ground in front of
// you and stays put as you turn the phone. Flick the Rune Stone up from the bottom of the screen (circle it first for
// spin), or tap "Tap to throw". On a hit the portal sucks Kiki in and seals into the stone; it wobbles, then bursts
// (caught) or blasts open (SO CLOSE!). Kiki never runs away.
import * as THREE from '../vendor/three.module.min.js';
import * as C from './core.js';
import { makeKiki, KikiMotion, makeRuneStone, makePortal, makeTimingRing, cosmicCanvas, easeOutBack, BODY_H, GROUND } from './art.js';
import { EYE } from './world.js';
import { $, hx, sfx, voice, pop, shake, toast, tuning, reducedMotion } from './services.js';

const HAND = new THREE.Vector3(0, -0.12, -0.46), STONE_R = 0.04;

export class Encounter {
  constructor(app, thing, onDone) {
    this.app = app; this.thing = thing; this.v = thing.variant; this.onDone = onDone;
    this.scene = app.world.scene; this.camera = app.world.camera; this.sparkles = app.world.sparkles;
    this.group = new THREE.Group(); this.scene.add(this.group);
    this.state = 'ready'; this.clock = 0; this.samples = []; this.taught = false;
    this.place();
    this.hud(true);
    this.bind();
  }

  place() {
    // Where you're looking: the floor point straight ahead, kept 1.4–2.6 m away.
    const o = this.app.world.orient, h = o.rawHeading(this.camera.quaternion) * Math.PI / 180;
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    let d = f.y < -0.05 ? EYE / -f.y * Math.hypot(f.x, f.z) : 2.0;
    d = Math.max(1.4, Math.min(2.6, d));
    this.home = new THREE.Vector3(Math.sin(h) * d, -EYE, -Math.cos(h) * d);
    // No motion sensors (stand-in or a computer): tilt the view down to Kiki.
    if (!o.have) o.pitch = -Math.atan2(EYE - 0.25, d) + 0.08;
    this.kiki = makeKiki(this.v.id, 0.42); this.kiki.position.copy(this.home); this.group.add(this.kiki);
    this.kiki.rotation.y = Math.atan2(-this.home.x, -this.home.z);
    this.motion = new KikiMotion(this.kiki, reducedMotion);
    this.scale = this.kiki.scale.x;
    this.ring = makeTimingRing(C.RARITY[this.v.rarity].main); this.ring.userData.max = 0.3 * (this.v.id === 'sprout' ? 0.78 : 1); this.ring.userData.min = 0.07; this.group.add(this.ring);
    this.portal = makePortal(0.62); this.group.add(this.portal);
    this.stone = makeRuneStone(STONE_R); this.group.add(this.stone);
    // pop in
    this.kiki.scale.setScalar(0.0001);
    this.anim(0.45, k => this.kiki.scale.setScalar(this.scale * easeOutBack(k, 2.2)));
    sfx('pickup', 0.4); hx.light();
  }

  get center() { return this.kiki.position.clone().add(new THREE.Vector3(0, GROUND * this.scale, 0)); }

  hud(on) {
    $('hud').hidden = on; $('enc-hud').hidden = !on;
    if (!on) return;
    $('enc-name').textContent = this.v.name; $('enc-rarity').textContent = C.RARITY[this.v.rarity].label; $('enc-rarity').style.color = C.RARITY[this.v.rarity].second;
    this.stones(); this.hint('Flick the Rune Stone at Kiki!');
  }
  stones() { $('enc-stones').textContent = this.app.progress.stones; }
  hint(t) { $('enc-hint').hidden = !t; $('enc-hint').textContent = t || ''; }

  bind() {
    const gl = $('gl');
    this.onDown = e => {
      if (this.state !== 'ready') return;
      const near = this.stoneScreen().distanceTo(new THREE.Vector2(e.clientX, e.clientY)) < innerHeight * 0.12;
      if (!near && e.clientY < innerHeight * 0.65) return;
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
    this.onUp = e => { if (this.state === 'drag') this.release(e.clientX, e.clientY); };
    gl.addEventListener('pointerdown', this.onDown); addEventListener('pointermove', this.onMove); addEventListener('pointerup', this.onUp);
    $('enc-tap').onclick = () => this.tapThrow();
    $('enc-back').onclick = () => { if (this.state === 'ready' || this.state === 'drag' || this.state === 'out') this.finish('left'); };
  }
  unbind() {
    $('gl').removeEventListener('pointerdown', this.onDown); removeEventListener('pointermove', this.onMove); removeEventListener('pointerup', this.onUp);
    $('enc-tap').onclick = null; $('enc-back').onclick = null;
  }

  stoneScreen() { const p = this.camera.localToWorld(HAND.clone()).project(this.camera); return new THREE.Vector2((p.x + 1) / 2 * innerWidth, (1 - p.y) / 2 * innerHeight); }

  release(x, y) {
    const now = performance.now() / 1000; let first = this.samples[0];
    for (let i = this.samples.length - 1; i >= 0; i--) if (now - this.samples[i][2] > 0.1) { first = this.samples[i]; break; }
    const dt = Math.max(0.016, now - first[2]), vy = -(y - first[1]) / dt / innerHeight, vx = (x - first[0]) / dt / innerHeight;
    if (vy < 0.55) { this.state = 'ready'; return; } // too gentle: back to the hand
    const speed = Math.min(11, Math.max(1.5, vy * 2.4)) * tuning.strength;
    const q = this.camera.quaternion, fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q), up = new THREE.Vector3(0, 1, 0).applyQuaternion(q), right = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    const vel = fwd.multiplyScalar(speed).addScaledVector(up, speed * 0.28).addScaledVector(right, vx * 2.4 * tuning.strength);
    const o = this.stone.position.clone(), t = this.center, a = C.aimAssist(o, t, vel, tuning.gravity, tuning.aimAssist);
    this.launch(o, new THREE.Vector3(a.x, a.y, a.z), this.spinning);
  }

  tapThrow() {
    if (this.state !== 'ready') return;
    const o = this.stone.position.clone(), t = this.center.add(new THREE.Vector3().randomDirection().multiplyScalar(0.05 * (1 - tuning.aimAssist)));
    const v = C.solveThrow(o, t, tuning.gravity, C.naturalTime(Math.hypot(t.x - o.x, t.z - o.z)));
    this.launch(o, new THREE.Vector3(v.x, v.y, v.z), false);
  }

  launch(o, v, spin) {
    const app = this.app;
    if (!app.progressApi.useStone(app.progress)) return this.outOfStones();
    app.save(); this.stones(); this.hint(null); this.taught = true;
    this.releaseRing = C.ringScale(this.clock, tuning.ringPeriod); this.spinThrow = spin;
    this.pos = o; this.vel = v; this.flight = 0; this.state = 'fly';
    $('enc-tap').disabled = true; sfx('throw', 0.45); hx.light();
  }

  outOfStones() {
    this.state = 'out';
    this.hint('Out of Rune Stones! Grab more at a supply stop. Kiki will wait for you.');
  }

  // per-frame tasks
  anim(dur, fn) { return new Promise(res => { let t = 0; this.app.tasks.add(dt => { t += dt; fn(Math.min(1, t / dur), dt, t); if (t >= dur) { res(); return true; } return false; }); }); }

  update(dt, time) {
    this.clock += dt;
    this.motion.update(dt);
    this.portal.userData.update(dt, time, this.camera);
    this.stone.userData.update(dt, time);
    if (this.state === 'ready' || this.state === 'out') {
      // If Kiki is off-screen, say where to look.
      const p = this.center.project(this.camera), off = p.z > 1 || Math.abs(p.x) > 0.95 || p.y < -0.75 || p.y > 0.95;
      const want = off ? (p.z > 1 ? 'Turn around: Kiki is behind you' : p.y < -0.75 ? 'Look down: Kiki is right in front of you' : p.x > 0 ? 'Kiki is to your right' : 'Kiki is to your left')
        : this.state === 'out' ? 'Out of Rune Stones! Grab more at a supply stop.' : this.taught ? null : 'Flick the Rune Stone at Kiki!';
      if (want !== this.lastHint) { this.lastHint = want; this.hint(want); }
    }
    if (this.state === 'ready' || this.state === 'drag' || this.state === 'fly') {
      const c = this.center; this.ring.position.copy(c); this.ring.quaternion.copy(this.camera.quaternion);
      this.ring.userData.set(C.ringScale(this.clock, tuning.ringPeriod));
      this.kiki.rotation.y = Math.atan2(-this.kiki.position.x, -this.kiki.position.z);
    }
    if (this.state === 'ready' || this.state === 'out') {
      this.stone.visible = this.state === 'ready';
      this.stone.position.copy(this.camera.localToWorld(HAND.clone()));
      this.stone.quaternion.copy(this.camera.quaternion).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-1.05, 0, 0)));
      this.stone.userData.body.rotation.set(0, time * 0.7, 0);
      $('enc-tap').disabled = this.state !== 'ready';
    } else if (this.state === 'drag' && this.dragPos) {
      const ndc = new THREE.Vector3(this.dragPos[0] / innerWidth * 2 - 1, -(this.dragPos[1] / innerHeight) * 2 + 1, 0.5).unproject(this.camera);
      const dir = ndc.sub(this.camera.position).normalize(), fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
      this.stone.position.copy(this.camera.position).addScaledVector(dir, 0.46 / Math.max(0.3, dir.dot(fwd)));
      this.stone.userData.body.rotation.y = time * (this.spinning ? 16 : 0.7);
    } else if (this.state === 'fly') {
      this.flight += dt;
      this.vel.y -= tuning.gravity * dt; this.pos.addScaledVector(this.vel, dt);
      this.stone.position.copy(this.pos);
      this.stone.userData.body.rotation.set(this.flight * 12, this.flight * (this.spinThrow ? 24 : 3.5), 0);
      if (this.pos.distanceTo(this.center) <= tuning.hitRadius * (this.v.id === 'sprout' ? 0.78 : 1) + STONE_R) return this.resolve(true);
      if (this.pos.y <= -EYE + STONE_R * 0.5 || this.flight > 2.5 || this.pos.length() > 7) this.resolve(false);
    }
  }

  async resolve(hit) {
    this.state = 'resolving';
    const app = this.app, o = C.resolveThrow(this.v.rarity, { hit, ring: this.releaseRing, spin: this.spinThrow }, C.sysRng, tuning.odds);
    const steps = C.revealSteps(o, this.v.rarity, reducedMotion());
    const first = !app.progress.caught[this.v.id];
    let rw = null;
    if (o.result === 'caught') { rw = C.reward(this.v.rarity, o.quality, o.spin, first); app.progressApi.recordCatch(app.progress, this.v.id, Date.now() / 1000, rw.total); app.save(); }
    const at = this.pos.clone();
    for (const s of steps) {
      if (s.kind === 'stamp') break; // the reveal screen takes over
      hx.play(s.haptic); if (s.sfx) sfx(s.sfx, 0.5); if (s.voice) voice(s.voice, s.voiceChance);
      await this.beat(s, at);
    }
    if (o.result === 'caught') { this.state = 'reveal'; this.reveal(o, rw, first, steps); return; }
    this.ring.visible = true; this.kiki.visible = true; this.motion.idling = true;
    this.state = 'ready'; this.stone.scale.setScalar(1); this.stone.userData.body.rotation.set(0, 0, 0);
    if (app.progress.stones <= 0) this.outOfStones();
  }

  async beat(s, hitPoint) {
    const d = s.dur, c = this.center, toCam = new THREE.Vector3(-c.x, 0, -c.z).normalize();
    const portalPos = c.clone().addScaledVector(toCam, -0.06).add(new THREE.Vector3(0, 0.02, 0)), hover = c.clone().addScaledVector(toCam, 0.14);
    const st = this.stone, reduced = reducedMotion();
    switch (s.kind) {
      case 'hit':
        this.ring.visible = false; this.sparkles.burst(hitPoint, 14, 0xd9c0ff, 0.035, 0.5, 0.5); st.userData.flash(2);
        return this.anim(d, k => st.position.lerpVectors(hitPoint, hover, 1 - Math.pow(1 - k, 3)));
      case 'portalOpen':
        this.motion.stop(); this.motion.idling = false; this.portal.position.copy(portalPos); this.portal.userData.target = 1;
        this.sparkles.burst(portalPos, 10, 0x7a00ff, 0.03, 0.35, 0.6);
        return this.anim(d, (k, dt, t) => { st.position.copy(hover).y += Math.sin(t * 12) * 0.006; st.userData.body.rotation.set(-1.2, t * 5, 0); });
      case 'suck': {
        this.portal.userData.boost = 1;
        this.sparkles.implode(portalPos, 0.35, 26, 0x7a00ff, 0.028, d); this.sparkles.implode(portalPos, 0.25, 12, 0x8c59ff, 0.02, d * 0.9);
        const start = this.kiki.position.clone(), s0 = this.scale, rot0 = this.kiki.rotation.clone();
        await this.anim(d, (k, dt, t) => {
          const e = k * k * (3 - 2 * k), shrink = 1 - e * e;
          this.kiki.position.lerpVectors(start, portalPos.clone().add(new THREE.Vector3(0, -GROUND * s0 * (1 - e), 0)), e);
          this.kiki.scale.set(s0 * shrink * (1 - 0.25 * e), s0 * shrink * (1 + 0.35 * e), s0 * shrink);
          if (!reduced) this.kiki.rotation.z = e * e * Math.PI * 3;
          st.position.copy(hover).y += Math.sin(t * 20) * 0.004;
        });
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
    const el = document.createElement('div'); el.className = 'reveal';
    if (!Encounter.cosmicUrl) Encounter.cosmicUrl = cosmicCanvas(512).toDataURL();
    el.innerHTML = `<img class="cosmic" src="${Encounter.cosmicUrl}" alt=""><canvas class="kiki"></canvas><div class="flash"></div>`;
    $('overlay').appendChild(el); $('enc-hud').hidden = true;
    // Kiki on the cosmic spiral, in his own little renderer.
    const cv = el.querySelector('canvas.kiki'), size = Math.round(Math.min(innerWidth, innerHeight * 0.7) * Math.min(2, devicePixelRatio || 1));
    const r = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true }); r.setSize(size, size, false); r.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 0.05, 10); cam.position.set(0, 0.33, 1.55); cam.lookAt(0, 0.26, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x7a5cff, 1.7)); const key = new THREE.DirectionalLight(0xfff2e0, 2.4); key.position.set(-1, 2, 2); scene.add(key);
    const k = makeKiki(this.v.id, 0.42); k.visible = false; scene.add(k);
    const motion = new KikiMotion(k, reducedMotion); motion.idling = false;
    let alive = true, last = performance.now();
    const loop = now => { if (!alive) return; const dt = Math.min(0.05, (now - last) / 1000); last = now; motion.update(dt); r.render(scene, cam); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    const add = html => { const d = document.createElement('div'); d.innerHTML = html; const n = d.firstElementChild; el.appendChild(n); return n; };
    const sleep = ms => new Promise(res => setTimeout(res, ms));
    (async () => {
      await sleep(350);
      for (const s of steps.slice(steps.findIndex(x => x.kind === 'stamp'))) {
        hx.play(s.haptic); if (s.sfx) sfx(s.sfx, 0.55); if (s.voice) voice(s.voice, s.voiceChance);
        if (s.kind === 'stamp') {
          const st = add(`<div class="stamp" style="color:${C.RARITY[this.v.rarity].main}">${s.text}</div>`); requestAnimationFrame(() => requestAnimationFrame(() => st.classList.add('in')));
          await sleep(280); add(`<div class="vname">${this.v.name}</div>`); if (first) add('<div class="new sticker">NEW!</div>');
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
          const box = add(`<div class="sticker reward">${rw.lines.map(() => '<div class="ln"></div>').join('')}<div class="tot">+0 Sprouts</div></div>`);
          const lns = box.querySelectorAll('.ln'), tot = box.querySelector('.tot'); let run = 0;
          for (let i = 0; i < rw.lines.length; i++) {
            const [label, amount] = rw.lines[i]; lns[i].innerHTML = `${label} <span>+${amount}</span>`; sfx('count', 0.4);
            const from = run, dur = Math.min(500, s.dur * 1000 / rw.lines.length), t0 = performance.now(); let ticks = 0;
            while (performance.now() - t0 < dur) { run = Math.round(from + amount * (performance.now() - t0) / dur); tot.textContent = `+${run} Sprouts`; if (++ticks % 4 === 0) { hx.tick(); sfx('count', 0.25, 1 + (performance.now() - t0) / dur); } await sleep(16); }
            run = from + amount; tot.textContent = `+${run} Sprouts`;
          }
        } else if (s.kind === 'keepPlaying') {
          const b = add('<button type="button" class="pill play keep">Keep playing</button>');
          b.onclick = () => { sfx('button', 0.35); hx.light(); alive = false; r.dispose(); el.remove(); this.finish('caught'); };
          return; // never closes by itself
        }
      }
    })();
  }

  finish(why) {
    this.state = 'done'; this.unbind(); this.scene.remove(this.group); $('enc-hud').hidden = true; $('hud').hidden = false; $('enc-tap').disabled = false; this.hint(null);
    this.onDone(why);
  }
}
