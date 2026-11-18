// KIKI SAFARI on the web: boot, permissions, the camera world view and the street map, encounters, Rune Circles,
// the Safari Log and the hidden tuning panel.
import * as THREE from '../vendor/three.module.min.js';
import * as C from './core.js';
import { WorldView, Location, OsmLoader, drawRadar, renderNearby } from './world.js';
import { StreetMap } from './map.js';
import { Encounter } from './encounter.js';
import { spiralRite } from './rite.js';
import { $, toast, panel, hx, sfx, unlockAudio, setSound, settings, loadProgress, saveProgress, tuning, saveTuning, debug, saveDebug } from './services.js';

const STOP_COOLDOWN = 5 * 60, STOP_REWARD = 5;

const app = {
  progress: loadProgress(), progressApi: C.progressApi, caught: new Set(), mapMode: false, tasks: new Set(), encounter: null,
  save() { saveProgress(this.progress); $('stone-count').textContent = this.progress.stones; },
  debugNight: () => debug.night,
};
app.loc = new Location();
app.osm = new OsmLoader();

// ---------- rendering ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('gl'), alpha: true, antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.setClearColor(0x000000, 0);
app.world = new WorldView(app);
app.map = new StreetMap(app);
app.osm.listeners.push((cell, area) => app.map.addArea(cell, area));
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  for (const cam of [app.world.camera, app.map.camera]) { cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); }
}
addEventListener('resize', resize); resize();

// ---------- title ----------
const soundBtn = $('sound-toggle'), motionBtn = $('motion-toggle');
const motionLabels = { auto: 'Motion: auto', reduced: 'Motion: reduced', full: 'Motion: full' };
const refreshTitle = () => { soundBtn.textContent = settings.get('sound', true) ? 'Sound: on' : 'Sound: off'; motionBtn.textContent = motionLabels[settings.get('motion', 'auto')]; };
refreshTitle();
soundBtn.onclick = () => { unlockAudio(); setSound(!settings.get('sound', true)); refreshTitle(); sfx('button', 0.35); };
motionBtn.onclick = () => { const order = ['auto', 'reduced', 'full'], m = settings.get('motion', 'auto'); settings.set('motion', order[(order.indexOf(m) + 1) % 3]); refreshTitle(); sfx('button', 0.35); };
$('play').onclick = () => {
  unlockAudio(); sfx('button', 0.4); hx.light();
  if (localStorage.getItem('kiki-perms') === 'asked') startSensors(); else { $('perms').hidden = false; }
};
$('perms-go').onclick = () => { unlockAudio(); localStorage.setItem('kiki-perms', 'asked'); startSensors(); };

let stream = null;
/** Must run inside a tap: iPhone only shows the motion and camera prompts for a user gesture. */
function startSensors() {
  $('perm-status').textContent = 'Asking your phone…';
  const pOri = (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function')
    ? DeviceOrientationEvent.requestPermission().catch(() => 'denied') : Promise.resolve('granted');
  const pCam = navigator.mediaDevices && navigator.mediaDevices.getUserMedia
    ? navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }).catch(() => null)
    : Promise.resolve(null);
  const pLoc = app.loc.start();
  Promise.all([pOri, pCam]).then(([ori, cam]) => {
    stream = cam;
    if (cam) { const v = $('cam'); v.srcObject = cam; v.play().catch(() => {}); }
    app.world.setStandIn(!cam, C.isNight(app.loc.fix || { lat: 40, lon: -74 }, new Date()) || debug.night);
    $('title').hidden = true; $('perms').hidden = true; $('game').hidden = false;
    app.save();
    const missing = [!cam && 'camera', ori !== 'granted' && 'motion'].filter(Boolean);
    if (missing.length) toast(`No ${missing.join(' or ')} access, so you'll see a stand-in view. Drag to look around.`, 4200);
  });
  pLoc.then(ok => { if (!ok) toast(app.loc.problem || "Couldn't get your location.", 5000); });
}

function goHome() {
  if (app.encounter) return;
  if (stream) { for (const t of stream.getTracks()) t.stop(); stream = null; }
  $('game').hidden = true; $('title').hidden = false; app.mapMode = false; applyMode();
}
$('btn-home').onclick = goHome;
$('btn-map').onclick = () => { app.mapMode = !app.mapMode; applyMode(); sfx('button', 0.35); };
function applyMode() {
  const m = app.mapMode;
  $('btn-map').textContent = m ? 'Camera' : 'Map';
  $('radar').hidden = m; $('attribution').hidden = !m;
  $('cam').hidden = m || !stream; $('sky').hidden = m || !!stream;
  if (m) $('cam').pause && $('cam').pause(); else if (stream) $('cam').play().catch(() => {});
  app.world.setVisible(!m);
}

// ---------- interactions ----------
app.interact = t => {
  if (app.loc.locked) return toast(C.MOVING_FAST);
  const d = C.distance(app.loc.fix, t.where);
  if (d > C.ACTION) return toast(`${t.kind === 'stop' ? 'That supply stop' : t.name} is ${Math.round(d)} m away. Get within ${C.ACTION} m.`);
  if (t.kind === 'kiki') startEncounter(t);
  else if (t.kind === 'stop') claimStop(t);
  else circlePanel(t);
};
app.pinHome = () => {
  const h = app.world.orient.heading * Math.PI / 180;
  localStorage.setItem('kiki-home', JSON.stringify(C.fromLocal(app.loc.fix, Math.sin(h) * 7, Math.cos(h) * 7)));
  app.world.nextPlan = 0;
};

function startEncounter(t) {
  hx.medium();
  if (app.mapMode) { app.mapMode = false; applyMode(); }
  app.world.setVisible(false);
  app.encounter = new Encounter(app, t, why => {
    app.encounter = null; if (why === 'caught') app.caught.add(t.id);
    app.world.setVisible(true); app.world.nextPlan = 0; app.save();
  });
}

function claimStop(t) {
  const now = Math.floor(Date.now() / 1000);
  if (C.progressApi.claimStop(app.progress, t.id, now, STOP_COOLDOWN, STOP_REWARD)) {
    app.save(); sfx('pickup', 0.55); hx.success(); toast(`+${STOP_REWARD} Rune Stones!`);
    const v = app.world.views.get(t.id); if (v) app.world.sparkles.burst(v.position.clone().setY(v.position.y + 1.9), 22, 0x7a00ff, 0.12, 1.2, 0.9);
  } else {
    const left = C.progressApi.stopWait(app.progress, t.id, now, STOP_COOLDOWN);
    toast(`This stop restocks in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`);
  }
}

function circlePanel(t) {
  const now = Math.floor(Date.now() / 1000), next = C.surgeNextIn(now);
  const surge = C.surgeActive(now) ? `<p style="color:#ff5d8f">PORTAL SURGE! Rare Kikis are pouring out (${Math.ceil(C.surgeLeft(now) / 60)} min left)</p>`
    : `<p style="color:#4d5aa6">Next Portal Surge in ${Math.floor(next / 3600)}h ${String(Math.floor(next % 3600 / 60)).padStart(2, '0')}m</p>`;
  const hasKiki = Object.keys(app.progress.caught).length > 0;
  const p = panel(`<h2 style="color:#7a00ff">${t.name}</h2>${surge}
    <p style="font-size:20px">${t.mine ? `Your ${t.variant.name} keeps this circle.` : `Keeper: a wild ${t.variant.name}`}<br>Attunement ${t.keeperAtt}</p>
    <p style="color:#4d5aa6">${t.mine ? 'While your Kiki keeps it, the circle gathers Sprouts for you. Come back to collect them.' : 'Begin the Spiral Rite: tap as each ring of light lands on the rune. Out-attune the Keeper and your Kiki takes the circle.'}</p>
    <div class="stack">${t.mine ? '<button class="pill" id="c-collect">Collect Sprouts</button>' : `<button class="pill" id="c-begin"${hasKiki ? '' : ' style="opacity:.6"'}>${hasKiki ? 'Begin the Spiral Rite' : 'Catch a Kiki first'}</button>`}
    <button class="pill small cream" id="c-close">Close</button></div>`);
  p.root.querySelector('#c-close').onclick = p.close;
  if (t.mine) p.root.querySelector('#c-collect').onclick = () => {
    const got = C.progressApi.collectCircle(app.progress, t.id, Math.floor(Date.now() / 1000)); app.save();
    toast(got ? `+${got} Sprouts from the circle!` : 'Nothing yet. Circles gather 20 Sprouts every half hour.'); if (got) { hx.success(); sfx('pickup', 0.5); }
  };
  else p.root.querySelector('#c-begin').onclick = () => {
    if (!hasKiki) return toast('Catch a Kiki first, then come back to challenge the Keeper.');
    p.close(); spiralRite(app, t, () => { app.world.nextPlan = 0; });
  };
}

$('btn-log').onclick = () => {
  const found = C.VARIANTS.filter(v => app.progress.caught[v.id]).length;
  const rows = C.VARIANTS.map(v => { const n = app.progress.caught[v.id] || 0, r = C.RARITY[v.rarity];
    return `<div class="logrow sticker${n ? '' : ' unknown'}"><span class="dot" style="background:${r.main}"></span><span class="nm">${n ? v.name : '???'}<span class="rr" style="color:${r.second}">${r.label}</span></span><span class="ct">${n ? '×' + n : ''}</span></div>`; }).join('');
  const p = panel(`<h2 style="color:#ffcf2e;-webkit-text-stroke:2px #18237a;paint-order:stroke fill">Safari Log</h2><p>${found} of ${C.VARIANTS.length} found · ${app.progress.sprouts} Sprouts</p>${rows}<div class="stack"><button class="pill" id="log-close">Back</button></div>`);
  p.root.querySelector('#log-close').onclick = p.close;
};

// Hidden tuning panel: triple-tap the Rune Stone counter.
let taps = [];
$('stones').addEventListener('pointerdown', () => {
  const now = performance.now(); taps = taps.filter(t => now - t < 1000); taps.push(now);
  if (taps.length >= 3) { taps = []; tuningPanel(); }
});
function tuningPanel() {
  const sliders = [['strength', 'Throw strength', 0.3, 3, 0.05], ['ringPeriod', 'Ring cycle (s)', 0.8, 6, 0.1], ['aimAssist', 'Aim assist', 0, 1, 0.05], ['odds', 'Catch odds ×', 0.1, 5, 0.05], ['gravity', 'Gravity (m/s²)', 2, 20, 0.1], ['hitRadius', 'Hit size (m)', 0.1, 1, 0.01]];
  const toggles = [['night', 'Force night (Moonbeam)'], ['surge', 'Force Portal Surge'], ['home', 'Home test Rune Circle']];
  const p = panel(`<h2>Tuning</h2><div class="tune">${sliders.map(([k, l, a, b, s]) => `<label>${l}: <b id="tv-${k}">${tuning[k]}</b><input type="range" min="${a}" max="${b}" step="${s}" value="${tuning[k]}" data-k="${k}"></label>`).join('')}</div>
    <div class="stack">${toggles.map(([k, l]) => `<button class="pill small cream" data-t="${k}">${l}: ${debug[k] ? 'on' : 'off'}</button>`).join('')}
    <button class="pill small pink" id="t-pin">Move test Rune Circle here</button>
    <div class="row"><button class="pill small sky" id="t-stones">+30 stones</button><button class="pill small cream" id="t-reset">Reset</button><button class="pill small" id="t-done">Done</button></div></div>`);
  p.root.querySelectorAll('input[type=range]').forEach(i => i.oninput = () => { tuning[i.dataset.k] = +i.value; p.root.querySelector('#tv-' + i.dataset.k).textContent = i.value; saveTuning(); });
  p.root.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { const k = b.dataset.t; debug[k] = !debug[k]; saveDebug(); b.textContent = `${toggles.find(x => x[0] === k)[1]}: ${debug[k] ? 'on' : 'off'}`; app.world.nextPlan = 0; });
  p.root.querySelector('#t-pin').onclick = () => { app.pinHome(); toast('Test Rune Circle moved here.'); };
  p.root.querySelector('#t-stones').onclick = () => { app.progress.stones += 30; app.save(); };
  p.root.querySelector('#t-reset').onclick = () => { Object.assign(tuning, { strength: 1, ringPeriod: 2.4, aimAssist: 0.35, odds: 1, gravity: 9.81, hitRadius: 0.26 }); saveTuning(); p.close(); tuningPanel(); };
  p.root.querySelector('#t-done').onclick = p.close;
}

// ---------- input on the 3D view ----------
const gl = $('gl'), pointers = new Map(); let press = null, pinch = 0;
gl.addEventListener('pointerdown', e => { pointers.set(e.pointerId, [e.clientX, e.clientY]); press = { x: e.clientX, y: e.clientY, t: performance.now(), lx: e.clientX, ly: e.clientY, moved: false }; });
addEventListener('pointermove', e => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, [e.clientX, e.clientY]);
  if (app.encounter || !press) return;
  if (pointers.size >= 2 && app.mapMode) {
    const [a, b] = [...pointers.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (pinch) app.map.zoom(pinch / d); pinch = d; press.moved = true; return;
  }
  const dx = e.clientX - press.lx, dy = e.clientY - press.ly; press.lx = e.clientX; press.ly = e.clientY;
  if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) press.moved = true;
  if (app.mapMode) app.map.rotate(dx); else app.world.orient.drag(dx, dy);
});
addEventListener('pointerup', e => {
  pointers.delete(e.pointerId); if (pointers.size < 2) pinch = 0;
  if (!press || app.encounter) { press = null; return; }
  if (!press.moved && performance.now() - press.t < 500) (app.mapMode ? app.map : app.world).tap(e.clientX, e.clientY);
  press = null;
});
gl.addEventListener('wheel', e => { if (app.mapMode) app.map.zoom(e.deltaY > 0 ? 1.1 : 0.9); }, { passive: true });
const keys = {};
addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; if (e.key === 'Shift') keys.shift = true; });
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; if (e.key === 'Shift') keys.shift = false; });

// ---------- loop ----------
let last = performance.now(), time = 0, hudTick = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
  for (const task of [...app.tasks]) if (task(dt)) app.tasks.delete(task);
  if (!$('game').hidden && app.loc.fix) {
    app.loc.simWalk(keys, app.world.orient.heading, dt);
    app.world.update(dt);
    if (app.encounter) app.encounter.update(dt, time);
    if (app.mapMode && !app.encounter) { app.map.update(dt, time, app.loc.fix, app.world.orient.heading, app.world.things); renderer.render(app.map.scene, app.map.camera); }
    else renderer.render(app.world.scene, app.world.camera);
    if ((hudTick -= dt) <= 0) { hudTick = 0.1; hud(); }
  } else if (!$('game').hidden) {
    app.world.update(dt); renderer.render(app.world.scene, app.world.camera);
    $('status').hidden = false; $('status').textContent = app.loc.problem || 'Finding where you are…';
  }
  requestAnimationFrame(frame);
}
function hud() {
  const heading = app.world.orient.heading, things = app.world.things;
  if (!app.mapMode) drawRadar($('radar'), things, heading);
  renderNearby($('nearby'), things, heading);
  let status = null;
  if (app.loc.locked) status = C.MOVING_FAST;
  else if (app.loc.problem && !app.loc.fix) status = app.loc.problem;
  else if (!app.loc.simulated && app.loc.accuracy > 50) status = 'Weak GPS. Things may wander a bit.';
  else if (app.mapMode && !app.osm.data.covers(app.loc.fix)) status = app.osm.problem || 'Loading the map…';
  $('status').hidden = !status; if (status) $('status').textContent = status;
}
requestAnimationFrame(frame);
window.kiki = app; // handy for testing in the browser console
