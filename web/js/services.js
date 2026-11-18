// Saves, settings, haptics, sound and small UI helpers for the web version.
import { newProgress } from './core.js';

// ---------- saves (this phone only) ----------
const SAVE = 'kiki-safari-progress';
export function loadProgress() {
  try { const p = JSON.parse(localStorage.getItem(SAVE)); if (p && p.v === 1) return Object.assign(newProgress(), p); } catch (e) {}
  return newProgress();
}
export const saveProgress = p => { try { localStorage.setItem(SAVE, JSON.stringify(p)); } catch (e) {} };

export const settings = {
  get(k, d) { try { const v = localStorage.getItem('kiki-' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('kiki-' + k, JSON.stringify(v)); } catch (e) {} },
};
/** Reduced motion: 'auto' follows the phone's setting. */
export function reducedMotion() {
  const m = settings.get('motion', 'auto');
  return m === 'reduced' || (m === 'auto' && matchMedia('(prefers-reduced-motion: reduce)').matches);
}
export const tuning = Object.assign({ strength: 1, ringPeriod: 2.4, aimAssist: 0.35, odds: 1, gravity: 9.81, hitRadius: 0.26 }, settings.get('tuning', {}));
export const saveTuning = () => settings.set('tuning', tuning);
export const debug = Object.assign({ night: false, surge: false, home: true }, settings.get('debug', {}));
export const saveDebug = () => settings.set('debug', debug);

// ---------- haptics (the treatment's seven patterns; every haptic has a matching visual) ----------
// Android browsers: the Vibration API. iPhone Safari has none, so a hidden iOS switch gives a light tap (iOS 18+),
// which only works during the player's own tap, so the first pulse fires immediately. Same approach as Big Plush.
function iosTap() {
  try { const label = document.createElement('label'), input = document.createElement('input'); label.style.display = 'none'; input.type = 'checkbox'; input.setAttribute('switch', ''); label.appendChild(input); document.head.appendChild(label); label.click(); label.remove(); } catch (e) {}
}
function buzz(pattern) {
  const p = Array.isArray(pattern) ? pattern : [pattern];
  try {
    if (typeof navigator.vibrate === 'function') navigator.vibrate(pattern);
    else { iosTap(); let t = p[0] + (p[1] || 0); for (let i = 2; i < p.length; i += 2) { setTimeout(iosTap, t); t += p[i] + (p[i + 1] || 0); } }
  } catch (e) {}
}
export const hx = {
  tick: () => buzz(6), light: () => buzz(10), medium: () => buzz(22), heavy: () => buzz(40),
  success: () => buzz([18, 70, 36]), warning: () => buzz([40, 80, 40]), error: () => buzz([60, 50, 60, 50, 90]),
  play(kind) { if (kind && hx[kind] && kind !== 'play') hx[kind](); },
};

// ---------- sound: chiptune blips (square and triangle waves) made on the fly ----------
let ac = null, master = null;
const voices = {};
export function unlockAudio() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ac = new AC(); master = ac.createGain(); master.connect(ac.destination);
    master.gain.value = settings.get('sound', true) ? 1 : 0;
    for (const v of ['yay', 'awww']) fetch(`assets/${v}.mp3`).then(r => r.arrayBuffer()).then(b => ac.decodeAudioData(b)).then(buf => { voices[v] = buf; }).catch(() => {});
  }
  if (ac.state === 'suspended') ac.resume();
}
export function setSound(on) { settings.set('sound', on); if (master) master.gain.value = on ? 1 : 0; }
const NOTES = {
  tick: [['square', 1800, 1800, .02, .4]], button: [['square', 880, 1320, .05, .5]], throw: [['triangle', 300, 900, .16, 1]],
  hit: [['square', 1200, 1700, .05, .6], ['triangle', 2400, 2600, .08, .5]], portal: [['triangle', 200, 500, .4, .7]],
  suck: [['triangle', 900, 180, .7, .7]], seal: [['square', 520, 1040, .08, .5], ['triangle', 1040, 1040, .12, .5]],
  wobble: [['triangle', 230, 150, .13, 1], ['noise', 0, 0, .03, .25]], burst: [['square', 1047, 1047, .06, .6], ['square', 1319, 1319, .06, .6], ['square', 1568, 1568, .06, .6], ['square', 2093, 2093, .18, .6]],
  stamp: [['noise', 0, 0, .04, .5], ['square', 160, 110, .12, .8]], count: [['square', 2000, 2000, .015, .3]], breakout: [['square', 700, 300, .22, .6]],
  bounce: [['triangle', 320, 190, .09, 1]], fizzle: [['noise', 0, 0, .3, .35]], pickup: [['square', 784, 784, .05, .5], ['square', 1175, 1175, .05, .5], ['square', 1568, 1568, .1, .5]],
};
export function sfx(name, vol = 0.5, pitch = 1) {
  if (!ac || !NOTES[name]) return;
  let t = ac.currentTime;
  for (const [wave, f0, f1, dur, v] of NOTES[name]) {
    const g = ac.createGain(); g.connect(master);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * vol * 0.3, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    if (wave === 'noise') {
      const b = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const s = ac.createBufferSource(); s.buffer = b; s.connect(g); s.start(t);
    } else {
      const o = ac.createOscillator(); o.type = wave; o.frequency.setValueAtTime(f0 * pitch, t); o.frequency.linearRampToValueAtTime(f1 * pitch, t + dur); o.connect(g); o.start(t); o.stop(t + dur + 0.02);
    }
    t += dur;
  }
}
/** The "yay" and "awww" clips: quiet, and only about half the time. */
export function voice(name, chance = 0.5) {
  if (!ac || !voices[name] || Math.random() > chance) return;
  const s = ac.createBufferSource(), g = ac.createGain(); g.gain.value = 0.35; s.buffer = voices[name]; s.connect(g); g.connect(master); s.start();
}

// ---------- small UI helpers ----------
export const $ = id => document.getElementById(id);
export function toast(msg, ms = 2600) {
  const t = document.createElement('div'); t.className = 'sticker toast'; t.textContent = msg; $('toasts').appendChild(t); setTimeout(() => t.remove(), ms);
}
export function pop(text, color = '#ff5d8f') {
  const p = $('pop'); p.textContent = text; p.style.color = color; p.classList.add('show');
  clearTimeout(pop._t); pop._t = setTimeout(() => p.classList.remove('show'), 1100);
}
/** A panel over the game; returns {root, close}. */
export function panel(html, onClose) {
  const dim = document.createElement('div'); dim.className = 'panel-dim';
  dim.innerHTML = `<div class="sticker panel">${html}</div>`;
  $('overlay').appendChild(dim);
  const close = () => { dim.remove(); onClose && onClose(); };
  return { root: dim, close };
}
export function shake(el, px = 14, ms = 400) {
  const t0 = performance.now();
  const step = now => { const k = (now - t0) / ms; if (k >= 1) { el.style.transform = ''; return; } el.style.transform = `translate(${(Math.random() * 2 - 1) * px * (1 - k)}px, ${(Math.random() * 2 - 1) * px * (1 - k)}px)`; requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
export const wait = ms => new Promise(r => setTimeout(r, ms));
