// Phase 5: original chiptune music, made on the fly with Web Audio (no audio files). Each screen has a track: title
// (dreamy portal), map (bouncy walk), catch (playful), battle and raid (driving). Tunes are written out of a seeded
// pattern generator so they repeat like real songs: an 8-bar phrase over a chord loop, a bass line, arpeggios and drums.
import { audioOut, settings } from './services.js';
import { rng, hash } from './core.js';

const N = n => 440 * Math.pow(2, (n - 69) / 12); // MIDI note → Hz
// [bpm, root MIDI note, scale steps, chord roots (scale degrees) per bar, lead wave, mood]
const TRACKS = {
  title: { bpm: 80, root: 62, scale: [0, 2, 4, 6, 7, 9, 11], chords: [0, 6, 5, 4], lead: 'triangle', hat: 0, kick: false, pad: true, arp: 'up', seed: 11 },
  map: { bpm: 104, root: 60, scale: [0, 2, 4, 5, 7, 9, 11], chords: [0, 4, 5, 3], lead: 'square', hat: 2, kick: true, pad: false, arp: 'bounce', seed: 23 },
  encounter: { bpm: 118, root: 65, scale: [0, 2, 4, 5, 7, 9, 11], chords: [0, 5, 3, 4], lead: 'square', hat: 2, kick: true, pad: false, arp: 'up', seed: 37 },
  battle: { bpm: 140, root: 57, scale: [0, 2, 3, 5, 7, 8, 10], chords: [0, 5, 6, 4], lead: 'square', hat: 1, kick: true, pad: false, arp: 'pump', seed: 41 },
  raid: { bpm: 152, root: 62, scale: [0, 2, 3, 5, 7, 8, 10], chords: [0, 5, 6, 4], lead: 'sawtooth', hat: 1, kick: true, pad: true, arp: 'pump', seed: 53 },
};
/** An 8-bar melody: a motif in bars 1–2, answered and varied, ending home. Notes are scale steps (or null for rests). */
function compose(t) {
  const r = rng(hash('kiki-music', t.seed)), rhythm = [1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0].map(x => x && r.next() < 0.85 ? 1 : 0);
  const motif = [], bars = [];
  let deg = 4;
  for (let i = 0; i < 32; i++) { if (!rhythm[i % 16]) { motif.push(null); continue; } deg = Math.max(0, Math.min(9, deg + [-2, -1, -1, 0, 1, 1, 2][r.int(0, 7)])); motif.push(deg); }
  for (let b = 0; b < 8; b++) {
    const src = motif.slice((b % 2) * 16, (b % 2) * 16 + 16), lift = b >= 4 && b < 6 ? 2 : 0;
    bars.push(src.map((d, i) => d == null ? null : (b === 7 && i >= 8 ? (i === 8 ? 0 : null) : d + lift)));
  }
  return bars;
}
const steps = (t, deg, oct = 0) => t.root + 12 * (oct + Math.floor(deg / 7)) + t.scale[((deg % 7) + 7) % 7];

let cur = null, timer = null, bus = null, nextT = 0, step = 0, song = null, track = null;
function voice(ac, out, wave, freq, t0, dur, vol, glide = 0) {
  const o = ac.createOscillator(), g = ac.createGain(); o.type = wave; o.frequency.setValueAtTime(freq, t0); if (glide) o.frequency.exponentialRampToValueAtTime(freq * glide, t0 + dur);
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, t0 + dur);
  o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + dur + 0.02);
}
function noise(ac, out, t0, dur, vol, hp) {
  const b = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); f.type = 'highpass'; f.frequency.value = hp; s.buffer = b;
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0005, t0 + dur); s.connect(f); f.connect(g); g.connect(out); s.start(t0);
}
function tick() {
  const a = audioOut(); if (!a || !track) return;
  const { ac } = a, t = track, sd = 60 / t.bpm / 4;
  if (nextT < ac.currentTime) nextT = ac.currentTime + 0.05;
  while (nextT < ac.currentTime + 0.25) {
    const bar = Math.floor(step / 16) % 8, i = step % 16, chord = t.chords[bar % 4];
    const m = song[bar][i]; if (m != null) voice(ac, bus, t.lead, N(steps(t, chord + m, 1)), nextT, sd * 1.8, t.lead === 'square' ? 0.05 : 0.08);
    if (i % 4 === 0 || (t.arp === 'pump' && i % 2 === 0)) voice(ac, bus, 'triangle', N(steps(t, chord, -1)), nextT, sd * (t.arp === 'pump' ? 1.6 : 3.2), 0.16);
    const arpNotes = [0, 2, 4, 7], ai = t.arp === 'bounce' ? [0, 2, 1, 3][i % 4] : i % 4;
    if (i % (t.arp === 'up' && t.bpm < 90 ? 2 : 1) === 0) voice(ac, bus, 'square', N(steps(t, chord + arpNotes[ai], t.arp === 'pump' ? 0 : 1)), nextT, sd * 0.9, 0.018);
    if (t.pad && i === 0) for (const d of [0, 2, 4]) voice(ac, bus, 'sawtooth', N(steps(t, chord + d, 0)), nextT, sd * 15, 0.012);
    if (t.kick && i % 8 === 0) voice(ac, bus, 'sine', 140, nextT, 0.18, 0.35, 0.3);
    if (t.kick && i % 8 === 4) noise(ac, bus, nextT, 0.12, 0.12, 1800);
    if (t.hat && i % t.hat === 0) noise(ac, bus, nextT, 0.03, 0.04, 7000);
    nextT += sd; step++;
  }
}
/** Switch to a track (or null for silence), with a short fade. */
export function playMusic(name) {
  if (name === cur && track) return; cur = name;
  const a = audioOut(); if (!a) return; // starts once the player has tapped
  const { ac, master } = a;
  if (bus) { const old = bus; old.gain.cancelScheduledValues(ac.currentTime); old.gain.setTargetAtTime(0, ac.currentTime, 0.2); setTimeout(() => old.disconnect(), 1500); }
  bus = null; track = null; clearInterval(timer);
  if (!name || !settings.get('music', true)) return;
  bus = ac.createGain(); bus.gain.value = 0; bus.gain.setTargetAtTime(0.26, ac.currentTime, 0.4); // music sits well under the sound effects (owner: "make the music quieter") bus.connect(master);
  track = TRACKS[name]; song = compose(track); step = 0; nextT = ac.currentTime + 0.1;
  timer = setInterval(tick, 60); tick();
}
export const musicName = () => cur;
// Quiet while the app is in the background, back on the same track when you return.
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => {
  const n = cur;
  if (document.hidden) { playMusic(null); cur = n; } else if (n) { cur = null; playMusic(n); }
});
export function setMusic(on) { settings.set('music', on); const n = cur; cur = null; playMusic(on ? n : null); if (!on) cur = n; }
