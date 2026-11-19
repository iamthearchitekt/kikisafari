// The Spiral Rite at a Rune Circle: the rune pulses to the beat, a ring of UV light closes on it each beat, and you
// tap as it lands. Since Phase 3 circles are won in battle; the Rite attunes you for Sprouts once a day per circle.
import * as C from './core.js';
import { $, hx, sfx, voice, panel } from './services.js';

export function spiralRite(app, circle, onDone) {
  const rite = new C.SpiralRite(), el = document.createElement('div'); el.className = 'rite';
  el.innerHTML = `<h2>The Spiral Rite</h2><div class="keeper">${circle.name}</div>
    <canvas width="720" height="720"></canvas><div class="judge"></div><div class="score">Attunement 0</div><div class="beats">${'<i></i>'.repeat(rite.beats)}</div>
    <div class="tip">Tap anywhere as each ring lands on the rune</div>`;
  $('overlay').appendChild(el);
  const cv = el.querySelector('canvas'), g = cv.getContext('2d'), judge = el.querySelector('.judge'), score = el.querySelector('.score'), dots = el.querySelectorAll('.beats i');
  const t0 = performance.now() / 1000; let pulse = 0, lastBeat = -1, done = false;

  const onTap = e => {
    if (done) return; e.preventDefault();
    const r = rite.tap(performance.now() / 1000 - t0);
    if (r) mark(r.beat, r.judgement);
  };
  el.addEventListener('pointerdown', onTap);

  function mark(i, j) {
    if (j === 'perfect') { dots[i].style.background = '#c77dff'; judge.textContent = 'Perfect!'; judge.style.color = '#ffcf2e'; hx.medium(); sfx('hit', 0.45); pulse = 0.16; }
    else if (j === 'good') { dots[i].style.background = '#36b6ff'; judge.textContent = 'Good'; judge.style.color = '#36b6ff'; hx.light(); sfx('tick', 0.4); pulse = 0.09; }
    else { dots[i].style.background = 'rgba(255,255,255,.08)'; judge.textContent = ''; }
  }

  function spiral(cx, cy, R, w, color) {
    g.beginPath(); for (let i = 0; i <= 160; i++) { const t = i / 160, a = t * 2.5 * Math.PI * 2, r = R * (0.08 + 0.92 * t); i ? g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r) : g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
    g.strokeStyle = color; g.lineWidth = w; g.lineCap = 'round'; g.stroke();
  }

  function frame() {
    if (done) return;
    const t = performance.now() / 1000 - t0, S = 720, cx = S / 2, cy = S / 2;
    const beat = Math.floor((t - rite.leadIn) / rite.interval + 1e-4);
    if (beat >= 0 && beat < rite.beats && beat !== lastBeat) { lastBeat = beat; sfx('wobble', 0.35, 1.25); pulse = Math.max(pulse, 0.06); }
    for (const m of rite.advance(t)) mark(m, 'miss');
    pulse = Math.max(0, pulse - 0.016);
    g.clearRect(0, 0, S, S);
    // the rune
    const s = 1 + pulse;
    g.save(); g.translate(cx, cy); g.scale(s, s); g.translate(-cx, -cy);
    const glow = g.createRadialGradient(cx, cy, 120, cx, cy, 300); glow.addColorStop(0, 'rgba(122,0,255,.55)'); glow.addColorStop(1, 'rgba(122,0,255,0)');
    g.fillStyle = glow; g.beginPath(); g.arc(cx, cy, 300, 0, 7); g.fill();
    g.fillStyle = '#241a4e'; g.beginPath(); g.arc(cx, cy, 200, 0, 7); g.fill();
    spiral(cx, cy, 165, 40, 'rgba(122,0,255,.5)'); spiral(cx, cy, 165, 24, '#7a00ff'); spiral(cx, cy, 165, 9, '#d9a8ff');
    g.strokeStyle = '#7a00ff'; g.lineWidth = 12; g.beginPath(); g.arc(cx, cy, 208, 0, 7); g.stroke();
    g.restore();
    // closing rings for the next three beats
    let shown = 0;
    for (let i = 0; i < rite.beats && shown < 3; i++) {
      if (rite.results[i]) continue;
      const until = rite.beatTime(i) - t; if (until > rite.interval * 3 || until < -0.16) continue;
      const k = Math.max(0, Math.min(1, until / (rite.interval * 3)));
      g.strokeStyle = `rgba(217,168,255,${1 - k * 0.85})`; g.lineWidth = 10; g.beginPath(); g.arc(cx, cy, Math.min(352, 208 * (1 + k * 2.2)), 0, 7); g.stroke(); shown++;
    }
    if (t < rite.leadIn) { const n = Math.ceil((rite.leadIn - t) / rite.interval); if (n >= 1 && n <= 3) { g.fillStyle = '#ffcf2e'; g.font = '160px "Lilita One"'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 12; g.strokeStyle = '#18237a'; g.strokeText(n, cx, cy); g.fillText(n, cx, cy); } }
    score.textContent = 'Attunement ' + rite.attunement;
    if (t >= rite.duration) return finish();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function finish() {
    done = true; el.removeEventListener('pointerdown', onTap);
    const att = rite.attunement;
    if (att >= 60) { hx.success(); sfx('burst', 0.55); voice('yay'); } else { hx.warning(); sfx('breakout', 0.45); voice('awww'); }
    const p = panel(`<h2 style="color:#7a00ff">${att >= 85 ? 'Perfectly attuned!' : att >= 60 ? 'Nicely attuned!' : 'A little out of tune'}</h2>
      <p style="font-size:20px">Attunement <b>${att}</b></p>
      <div class="stack"><button class="pill" id="rite-ok">Done</button><button class="pill small cream" id="rite-again">Try again</button></div>`);
    p.root.querySelector('#rite-ok').onclick = () => { p.close(); el.remove(); onDone(att); };
    p.root.querySelector('#rite-again').onclick = () => { p.close(); el.remove(); spiralRite(app, circle, onDone); };
  }
}
