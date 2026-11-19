// KIKI SAFARI on the web. Phase 1 (docs/ROADMAP.md): the street map is the home screen, with your explorer walking
// where you walk. Tap a Kiki to catch it (in AR through the camera, or AR off), tap a supply stop to spin it, tap a
// Rune Circle for the Spiral Rite. The camera view ("AR") is still there for looking around. Menus live in ui.js.
import * as THREE from '../vendor/three.module.min.js';
import * as C from './core.js';
import * as R from './rules.js';
import { WorldView, Location, OsmLoader, drawRadar } from './world.js';
import { StreetMap } from './map.js';
import { Encounter } from './encounter.js';
import { portrait } from './art.js';
import { openMenu, openExplorer, nearbyPanel, stopPanel, levelUps, confirm } from './ui.js';
import { runTutorial, spawnStarters } from './tutorial.js';
import { loadWeather, mods, openEvents, did, walked, openEggs, openTasks, openMedals } from './phase2.js';
import { circlePanel, healKiki } from './battle.js';
import { startTitle } from './title.js';
import { initOnline, connect, checkIn, openFriends, openLeagues, openAccount } from './social.js';
import { cosmicCanvas } from './art.js';
import { playMusic } from './music.js';
import { $, toast, panel, hx, sfx, unlockAudio, setSound, settings, loadProgress, saveProgress, tuning, saveTuning, debug, saveDebug, fmtDist } from './services.js';

const app = {
  progress: loadProgress(), progressApi: C.progressApi, caught: new Set(), mapMode: true, tasks: new Set(), encounter: null,
  tracking: null, extraThings: [], arOn: true, hatchQueue: [], weather: null, weatherNow: null,
  save() { saveProgress(this.progress); },
  debugNight: () => debug.night,
};
app.loc = new Location();
app.mods = () => mods(app);
app.healKiki = k => healKiki(app, k);
app.did = ev => did(app, ev);
app.open = name => ({ eggs: openEggs, tasks: openTasks, medals: openMedals, events: openEvents, friends: openFriends, leagues: openLeagues, account: openAccount })[name](app);
initOnline(app);
app.checkIn = () => checkIn(app);
app.osm = new OsmLoader();

// ---------- rendering ----------
const renderer = new THREE.WebGLRenderer({ canvas: $('gl'), alpha: true, antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.setClearColor(0x000000, 0);
app.world = new WorldView(app);
app.map = new StreetMap(app);
app.osm.listeners.push((cell, area) => app.map.addArea(cell, area));
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  for (const cam of [app.world.camera, app.map.camera]) { cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); }
}
addEventListener('resize', resize);
/** Battery saver (Settings): a lighter picture (1× pixels) and 30 frames a second on the map. Catches stay smooth. */
app.applyBattery = () => { renderer.setPixelRatio(settings.get('battery', false) ? 1 : Math.min(2, devicePixelRatio || 1)); resize(); };
app.applyBattery();

// ---------- title ----------
let titleScene = null;
function showTitleScene() { if (!titleScene && !$('title').hidden) titleScene = startTitle($('title-stage')); }
function hideTitleScene() { if (titleScene) { titleScene.stop(); titleScene = null; } }
setTimeout(() => { $('title-bg').querySelector('img').src = cosmicCanvas(768).toDataURL(); showTitleScene(); }, 0);
const soundBtn = $('sound-toggle'), motionBtn = $('motion-toggle');
const motionLabels = { auto: 'Motion: auto', reduced: 'Motion: reduced', full: 'Motion: full' };
const refreshTitle = () => { soundBtn.textContent = settings.get('sound', true) ? 'Sound: on' : 'Sound: off'; motionBtn.textContent = motionLabels[settings.get('motion', 'auto')]; };
refreshTitle();
app.setSound = on => { setSound(on); refreshTitle(); };
soundBtn.onclick = () => { unlockAudio(); app.setSound(!settings.get('sound', true)); sfx('button', 0.35); };
motionBtn.onclick = () => { const order = ['auto', 'reduced', 'full'], m = settings.get('motion', 'auto'); settings.set('motion', order[(order.indexOf(m) + 1) % 3]); refreshTitle(); sfx('button', 0.35); };
// Music starts with the first tap (browsers keep sound off until then).
$('title').addEventListener('pointerdown', () => { unlockAudio(); if (!$('title').hidden) playMusic('title'); });
$('play').onclick = () => {
  unlockAudio(); sfx('button', 0.4); hx.light();
  if (localStorage.getItem('kiki-perms') === 'asked') startSensors(); else { $('perms').hidden = false; }
};
$('perms-go').onclick = () => { unlockAudio(); localStorage.setItem('kiki-perms', 'asked'); startSensors(); };

// ---------- camera ----------
// The camera is a live viewfinder only: no microphone, nothing is recorded, saved or uploaded; frames go straight
// from the camera to the <video> behind the 3D. It's only on during AR catches and the AR view, and switched off
// everywhere else (map, menus, title screen, app in the background) so the iPhone's green camera dot goes away too.
const CAMERA = { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false };
let stream = null, camWanted = false, camTapToResume = false;
function camOn() {
  camWanted = true;
  if (stream && stream.getVideoTracks().some(t => t.readyState === 'live')) return Promise.resolve(stream);
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return Promise.resolve(null);
  return navigator.mediaDevices.getUserMedia(CAMERA).then(s => {
    if (!camWanted) { for (const t of s.getTracks()) t.stop(); return null; } // switched off while it was starting
    camOff(); camWanted = true;
    stream = s; const v = $('cam'); v.srcObject = s; v.play().catch(() => {});
    return s;
  }).catch(() => null);
}
function camOff() {
  camWanted = false;
  if (stream) { for (const t of stream.getTracks()) t.stop(); stream = null; }
  $('cam').srcObject = null;
}
const night = () => C.isNight(app.loc.fix || { lat: 40, lon: -74 }, new Date()) || debug.night;
/** Does what's on screen need the camera? */
const cameraWanted = () => !$('game').hidden && (app.encounter ? app.arOn : !app.mapMode);
/** Show the camera, or the sky-and-meadow stand-in, behind the 3D. */
function layers() {
  const live = !!stream && cameraWanted();
  if (app.mapMode && !app.encounter) { $('cam').hidden = true; $('sky').hidden = true; if (app.world.ground) app.world.ground.visible = false; }
  else app.world.setStandIn(!live, night());
}
function resumeCam() {
  if (!cameraWanted()) { camOff(); layers(); return Promise.resolve(null); }
  return camOn().then(s => {
    layers();
    if (s || !cameraWanted()) return s;
    if (app.encounter) { app.setEncounterAR(false); toast("Couldn't start the camera, so AR is off for this catch.", 3200); }
    else { camTapToResume = true; toast('Tap the screen to turn the camera back on.', 3500); }
    return null;
  });
}
document.addEventListener('visibilitychange', () => { if (document.hidden) { camOff(); } else resumeCam(); });

/** Must run inside a tap: iPhone only shows the motion prompt for a user gesture. The camera is asked for at the first AR catch. */
function startSensors() {
  $('perm-status').textContent = 'Asking your phone…';
  const pOri = (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function')
    ? DeviceOrientationEvent.requestPermission().catch(() => 'denied') : Promise.resolve('granted');
  const pLoc = app.loc.start();
  pOri.then(ori => {
    hideTitleScene(); $('title').hidden = true; $('perms').hidden = true; $('game').hidden = false;
    app.mapMode = true; applyMode(); refreshHud(true);
    if (ori !== 'granted') toast("No motion access: the map won't turn with you. Drag to turn it.", 4200);
    runTutorial(app); playMusic('map'); app.started = true;
    connect(app); // online features (Phase 4); the game works without them
  });
  const wx = () => { if (app.loc.fix) loadWeather(app); };
  setTimeout(wx, 3000); if (!app.wxTimer) app.wxTimer = setInterval(wx, 10 * 60e3);
  pLoc.then(ok => { if (!ok) toast(app.loc.problem || "Couldn't get your location.", 5000); });
}

app.goHome = function goHome() {
  if (app.encounter) return;
  camOff(); camTapToResume = false;
  $('game').hidden = true; $('title').hidden = false; app.mapMode = true; applyMode(); showTitleScene(); playMusic('title');
};
$('btn-view').onclick = () => { app.mapMode = !app.mapMode; applyMode(); sfx('button', 0.35); hx.light(); };
$('btn-north').onclick = () => { app.map.north(); sfx('button', 0.3); };
$('btn-menu').onclick = () => { sfx('button', 0.4); hx.light(); openMenu(app); };
$('btn-me').onclick = () => { sfx('button', 0.35); openExplorer(app); };
$('btn-nearby').onclick = () => { sfx('button', 0.35); nearbyPanel(app); };
$('on-chip').onclick = () => { sfx('button', 0.35); openEvents(app); };
function applyMode() {
  const m = app.mapMode;
  $('btn-view').textContent = m ? 'AR' : 'Map'; $('btn-view').setAttribute('aria-label', m ? 'Switch to the camera view' : 'Switch to the map');
  $('btn-north').hidden = !m; $('ar-bits').hidden = m; $('attribution').hidden = !m; $('hud').classList.toggle('ar', !m);
  app.world.setVisible(!m);
  resumeCam();
}

// ---------- interactions ----------
app.interact = t => {
  if (app.loc.locked) return toast(C.MOVING_FAST);
  const d = C.distance(app.loc.fix, t.where);
  if (d > C.ACTION) { hx.light(); return toast(`${t.kind === 'stop' ? 'That supply stop' : t.kind === 'circle' ? t.name : 'That Kiki'} is ${fmtDist(d)} away. Get inside the white circle.`); }
  if (t.kind === 'kiki') startEncounter(t);
  else if (t.kind === 'stop') { sfx('button', 0.35); hx.light(); stopPanel(app, t); }
  else circlePanel(app, t);
};
app.rustleTap = t => { hx.light(); app.tracking = t.id; refreshHud(true); toast('Something is rustling in the leaves… Walk closer! (Tracking it for you.)', 3200); };
app.pinHome = () => {
  const h = app.world.orient.facing * Math.PI / 180;
  localStorage.setItem('kiki-home', JSON.stringify(C.fromLocal(app.loc.fix, Math.sin(h) * 7, Math.cos(h) * 7)));
  app.world.nextPlan = 0;
};
/** The nearest named place, for "caught near …" (stays on this phone). */
app.placeName = () => { const t = app.world.things.find(x => (x.kind === 'stop' || x.kind === 'circle') && x.distance < 150 && !/^(Supply Stop|Circle Supply Stop)$/.test(x.name)); return t ? t.name : ''; };
app.refreshHud = () => refreshHud(true);
app.onStopSpun = null;

/** AR on or off during a catch. Off: a fixed view with the sky and meadow, and the camera off. */
app.setEncounterAR = async on => {
  settings.set('ar', on);
  if (on) { const s = await camOn(); if (!s) { toast("Couldn't start the camera, so AR stays off.", 3000); on = false; } }
  app.arOn = on; const o = app.world.orient; o.locked = !on;
  if (!on) { camOff(); o.yaw = 0; }
  layers();
};

/** Catch a raid boss you just beat: a set number of Raid Stones. */
app.raidCatch = (raid, stones) => { const v = C.variant(raid.sp); startEncounter({ kind: 'kiki', id: 'raid:' + raid.id, name: v.name, variant: v, where: { ...app.loc.fix }, raid: { raid, stones } }); };
/** A Kiki from a task or the story, right where you are (it can't run away). */
app.rewardEncounter = sp => { const v = C.variant(sp); startEncounter({ kind: 'kiki', id: 'reward:' + sp + ':' + Date.now(), name: v.name, variant: v, where: { ...app.loc.fix }, reward: true }); };

async function startEncounter(t) {
  if (app.encounter) return;
  if (app.progress.kikis.length >= R.kikiMax(app.progress)) { hx.warning(); return toast(`Your collection is full (${R.kikiMax(app.progress)}). Send some Kikis home, or get more room in the Shop.`, 3600); }
  if (!t.raid && !R.STONES.some(id => app.progress.items[id] > 0)) { hx.warning(); return toast('Out of stones! Spin a supply stop to get more.', 3200); }
  hx.medium(); sfx('pickup', 0.35);
  app.encounter = { pending: true }; playMusic('encounter');
  app.world.setVisible(false);
  await app.setEncounterAR(settings.get('ar', true));
  app.encounter = new Encounter(app, t, async why => {
    const enc = app.encounter; app.encounter = null; app.world.orient.locked = false; playMusic('map');
    if (why === 'caught' && !t.starter) app.caught.add(t.id);
    app.world.setVisible(!app.mapMode); app.world.nextPlan = 0; app.save(); resumeCam(); refreshHud(true);
    if (why === 'fled') toast(`${/ Kiki$/.test(t.name) ? 'The ' + t.name : t.name} ran away!`, 2800);
    if (why === 'caught' && enc.ups && enc.ups.length) await levelUps(app, enc.ups);
    if (why === 'caught' && t.starter && app.onStarterCaught) app.onStarterCaught();
  }, { starter: !!t.starter });
}

// ---------- testing tools (Settings ▸ Testing tools) ----------
app.tuningPanel = function tuningPanel() {
  const sliders = [['strength', 'Throw strength', 0.3, 3, 0.05], ['aimAssist', 'Aim assist', 0, 1, 0.05], ['odds', 'Catch odds ×', 0.1, 5, 0.05], ['gravity', 'Gravity (m/s²)', 2, 20, 0.1], ['hitRadius', 'Hit size (m)', 0.1, 1, 0.01]];
  const toggles = [['night', 'Force night (Moonbeam)'], ['surge', 'Force Portal Surge'], ['home', 'Home test Rune Circle'], ['sparkle', 'Sparkle Kikis 1 in 3']];
  const p = panel(`<h2>Testing tools</h2><div class="tune">${sliders.map(([k, l, a, b, s]) => `<label>${l}: <b id="tv-${k}">${tuning[k]}</b><input type="range" min="${a}" max="${b}" step="${s}" value="${tuning[k]}" data-k="${k}"></label>`).join('')}</div>
    <div class="stack">${toggles.map(([k, l]) => `<button class="pill small cream" data-t="${k}">${l}: ${debug[k] ? 'on' : 'off'}</button>`).join('')}
    <button class="pill small pink" id="t-pin">Move test Rune Circle here</button>
    <div class="row"><button class="pill small sky" id="t-stones">+30 stones</button><button class="pill small sky" id="t-xp">+5,000 XP</button><button class="pill small sky" id="t-res">+50 Fluff, +5k Sprouts</button></div>
    <div class="row"><button class="pill small sky" id="t-km">Walk 1 km</button><button class="pill small sky" id="t-eggs">+3 eggs</button><button class="pill small sky" id="t-wx"></button></div>
    <p class="d" style="font-size:13px;margin:0;color:#4d5aa6;overflow-wrap:anywhere">Map: ${app.osm.data.covers(app.loc.fix || { lat: 0, lon: 0 }) ? 'loaded here' : 'not loaded here'}${app.osm.lastError ? ' · last problem: ' + app.osm.lastError.replace(/[<>&]/g, '') : ''}</p>
    <button class="pill small sky" id="t-map">Try the map again now</button>
    <div class="row"><button class="pill small cream" id="t-reset">Reset sliders</button><button class="pill small cream" id="t-wipe">Start over</button><button class="pill small" id="t-done">Done</button></div></div>`);
  p.root.querySelectorAll('input[type=range]').forEach(i => i.oninput = () => { tuning[i.dataset.k] = +i.value; p.root.querySelector('#tv-' + i.dataset.k).textContent = i.value; saveTuning(); });
  p.root.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { const k = b.dataset.t; debug[k] = !debug[k]; saveDebug(); b.textContent = `${toggles.find(x => x[0] === k)[1]}: ${debug[k] ? 'on' : 'off'}`; app.world.nextPlan = 0; });
  p.root.querySelector('#t-pin').onclick = () => { app.pinHome(); toast('Test Rune Circle moved here.'); };
  p.root.querySelector('#t-stones').onclick = () => { R.addItems(app.progress, { rune: 30 }, true); app.save(); toast('+30 Rune Stones'); };
  p.root.querySelector('#t-xp').onclick = async () => { const ups = R.giveXp(app.progress, 5000); app.save(); refreshHud(true); p.close(); await levelUps(app, ups); };
  p.root.querySelector('#t-res').onclick = () => { for (const v of C.VARIANTS) app.progress.fluff[v.family] = (app.progress.fluff[v.family] || 0) + 50; app.progress.sprouts += 5000; app.save(); toast('+50 of every Fluff, +5,000 Sprouts'); };
  p.root.querySelector('#t-km').onclick = () => { app.progress.stats.km += 1; walked(app, 1); toast('Walked 1 km (pretend)'); };
  p.root.querySelector('#t-eggs').onclick = () => { for (let i = 0; i < 3; i++) R.newEgg(app.progress); app.save(); toast('+3 eggs'); };
  const wxs = [null, ...Object.keys(R.WEATHER)], wxb = p.root.querySelector('#t-wx'), wxl = () => { wxb.textContent = 'Weather: ' + (debug.weather ? R.WEATHER[debug.weather].name : 'real'); };
  wxl(); wxb.onclick = () => { debug.weather = wxs[(wxs.indexOf(debug.weather || null) + 1) % wxs.length]; saveDebug(); wxl(); app.world.nextPlan = 0; };
  p.root.querySelector('#t-reset').onclick = () => { Object.assign(tuning, { strength: 1, ringPeriod: 2.4, aimAssist: 0.35, odds: 1, gravity: 9.81, hitRadius: 0.26 }); saveTuning(); p.close(); app.tuningPanel(); };
  p.root.querySelector('#t-wipe').onclick = async () => { p.close(); if (await confirm('Start over? This deletes your explorer, Kikis and items on this phone.', 'Delete everything')) { localStorage.removeItem('kiki-safari-progress'); location.reload(); } };
  p.root.querySelector('#t-map').onclick = () => { app.osm.retry.clear(); app.osm.fails.clear(); if (app.loc.fix) app.osm.need(app.loc.fix); toast('Loading the map…'); p.close(); };
  p.root.querySelector('#t-done').onclick = p.close;
};

// ---------- input on the 3D view ----------
const gl = $('gl'), pointers = new Map(); let press = null, pinch = 0;
gl.addEventListener('pointerdown', e => { if (camTapToResume) { camTapToResume = false; resumeCam(); } pointers.set(e.pointerId, [e.clientX, e.clientY]); press = { x: e.clientX, y: e.clientY, t: performance.now(), lx: e.clientX, ly: e.clientY, moved: false }; });
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
addEventListener('keydown', e => { if (e.target.tagName === 'INPUT') return; keys[e.key.toLowerCase()] = true; if (e.key === 'Shift') keys.shift = true; });
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; if (e.key === 'Shift') keys.shift = false; });

// ---------- loop ----------
let last = performance.now(), time = 0, hudTick = 0, walkFix = null;
function frame(now) {
  // battery saver: 30 frames a second on the map and in AR (catches and battles stay at full speed)
  if (settings.get('battery', false) && !app.encounter && !app.inBattle && now - last < 30) { requestAnimationFrame(frame); return; }
  const dt = Math.min(0.05, (now - last) / 1000); last = now; time += dt;
  for (const task of [...app.tasks]) if (task(dt)) app.tasks.delete(task);
  if (!$('game').hidden && app.loc.fix) {
    app.loc.simWalk(keys, app.mapMode ? (app.map.yaw || 0) : app.world.orient.heading, dt);
    app.world.update(dt);
    if (app.encounter && app.encounter.update) app.encounter.update(dt, time);
    if (app.mapMode && !app.encounter) { app.map.update(dt, time, app.loc.fix, app.world.orient.facing, app.world.things); renderer.render(app.map.scene, app.map.camera); }
    else renderer.render(app.world.scene, app.world.camera);
    if ((hudTick -= dt) <= 0) { hudTick = 0.1; hud(); }
  } else if (!$('game').hidden) {
    app.world.update(dt); renderer.clear();
    $('status').hidden = false; $('status').textContent = app.loc.problem || 'Finding where you are…';
  }
  requestAnimationFrame(frame);
}

// ---------- HUD ----------
let hudSig = '';
function refreshHud(force) {
  const p = app.progress, L = R.levelOf(p.xp), lo = R.xpFor(L), hi = R.xpFor(L + 1);
  const sig = `${p.explorer.outfit}:${p.explorer.skin}`;
  if (force || $('me-face').dataset.sig !== sig) { $('me-face').src = portrait(`explorer:${sig}`, 160); $('me-face').dataset.sig = sig; }
  $('me-lvl').textContent = L; $('me-xp').style.width = (L >= R.MAX_LEVEL ? 100 : (p.xp - lo) / (hi - lo) * 100) + '%';
  if (force) hudSig = '';
}
function hud() {
  const p = app.progress, facing = app.world.orient.facing, things = app.world.things;
  if (!app.mapMode) drawRadar($('radar'), things, app.world.orient.heading);
  // Nearby button: the three closest Kikis (silhouettes until caught), or the one you're tracking.
  const kikis = things.filter(t => t.kind === 'kiki'), tracked = app.tracking && kikis.find(t => t.id === app.tracking);
  if (app.tracking && !tracked && things.length) app.tracking = null; // it's gone
  const show = tracked ? [tracked] : kikis.slice(0, 3);
  const sig = show.map(t => t.id + (p.caught[t.variant.id] ? 1 : 0)).join('|') + (tracked ? '#' + Math.round(tracked.distance / 5) : '');
  if (sig !== hudSig) {
    hudSig = sig;
    $('near-mini').innerHTML = show.map(t => `<img src="${portrait('kiki:' + t.variant.id, 96)}" alt="" class="${p.caught[t.variant.id] ? '' : 'sil'}">`).join('');
    $('near-label').textContent = tracked ? `Tracking · ${fmtDist(tracked.distance)}` : kikis.length ? 'Nearby' : 'None nearby';
    $('btn-nearby').classList.toggle('tracking', !!tracked);
  }
  // starters wander off if you walk away: bring them back around you
  if (app.extraThings.length && app.loc.fix && app.extraThings.every(t => C.distance(app.loc.fix, t.where) > 60)) spawnStarters(app);
  // What's on: weather and events (refreshed once a second)
  if ((hud.slow = (hud.slow || 0) - 0.1) <= 0) {
    hud.slow = 1; const m = app.mods(); app.weatherNow = m.weather;
    const w = m.weather && R.WEATHER[m.weather], ev = m.events[0];
    const txt = (w ? w.icon + ' ' + w.boost.join(' · ') : '') + (ev ? (w ? ' | ' : '') + ev.name : '');
    $('on-chip').hidden = !txt; $('on-chip').textContent = txt;
  }
  // Portal Surge chip
  const now = Math.floor(Date.now() / 1000), circleNear = things.some(t => t.kind === 'circle');
  const surge = circleNear && (C.surgeActive(now) || debug.surge);
  $('surge-chip').hidden = !surge; if (surge) $('surge-chip').textContent = `Portal Surge! ${Math.max(1, Math.ceil(C.surgeLeft(now) / 60))} min`;
  // km walked (only good GPS, walking speeds)
  const f = app.loc.fix;
  if (f && (app.loc.simulated || app.loc.accuracy <= 30) && !app.loc.locked) {
    if (!walkFix) walkFix = f; const d = C.distance(walkFix, f);
    if (d > 10) { if (d < 150) { p.stats.km += d / 1000; walked(app, d / 1000); } walkFix = f; }
  }
  let status = null;
  if (app.loc.locked) status = C.MOVING_FAST;
  else if (app.loc.problem && !app.loc.fix) status = app.loc.problem;
  else if (!app.loc.simulated && app.loc.accuracy > 50) status = 'Weak GPS. Things may wander a bit.';
  else if (app.mapMode && !app.osm.data.covers(app.loc.fix)) status = app.osm.problem || 'Loading the map…';
  $('status').hidden = !status; if (status) $('status').textContent = status;
}
requestAnimationFrame(frame);
window.kiki = app; // handy for testing in the browser console
