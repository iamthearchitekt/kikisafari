// Phase 2 (docs/ROADMAP.md): live weather, the event calendar, eggs and nests, hatching, tasks with the stamp card and
// the story, medals, and one place (did) where everything you do is counted for tasks and medals.
import * as THREE from '../vendor/three.module.min.js';
import * as C from './core.js';
import * as R from './rules.js';
import { makeKiki, makeEgg, KikiMotion, portrait, EGG_COLORS, Sparkles } from './art.js';
import { $, toast, panel, hx, sfx, voice, settings, reducedMotion, wait, debug } from './services.js';
import { liveStage, levelUps, guide, confirm } from './ui.js';

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const now = () => Math.floor(Date.now() / 1000);
const img = (what, cls = '', size = 192) => `<img src="${portrait(what, size)}" alt="" class="${cls}">`;
function screen(html) { const el = document.createElement('div'); el.className = 'screen-sheet'; el.innerHTML = html; $('overlay').appendChild(el); return { root: el, q: s => el.querySelector(s), close: () => el.remove() }; }
const elChip = el => `<span class="el-chip" style="background:${R.ELEMENT_COLOR[el]}">${el}</span>`;

// ---------- weather (Open-Meteo, free, no key) ----------
// Only a rough position is sent (rounded to 0.1°, about 10 km), and only while you play.
export async function loadWeather(app) {
  const f = app.loc.fix; if (!f) return;
  const lat = Math.round(f.lat * 10) / 10, lon = Math.round(f.lon * 10) / 10, key = lat + ',' + lon;
  try { const c = JSON.parse(localStorage.getItem('kiki-weather') || 'null'); if (c && c.key === key && Date.now() - c.t < 30 * 60e3) { app.weather = c.w; return; } } catch (e) {}
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=weather_code,wind_speed_10m,is_day`);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json(), cur = j.current;
    app.weather = R.weatherFrom(cur.weather_code, !!cur.is_day, cur.wind_speed_10m || 0);
    localStorage.setItem('kiki-weather', JSON.stringify({ key, t: Date.now(), w: app.weather }));
  } catch (e) { app.weather = app.weather || null; }
  app.world.nextPlan = 0;
}
/** Everything that changes spawns and rewards right now: weather plus events (and the testing toggles). */
export function mods(app) {
  const evs = R.eventsAt(now()), m = R.eventMods(evs), w = debug.weather ? debug.weather : app.weather;
  if (w && R.WEATHER[w]) m.boost.push(...R.WEATHER[w].boost);
  if (debug.sparkle) m.sparkle = Math.max(m.sparkle, R.SPARKLE_ODDS / 3);
  return { ...m, events: evs, weather: w };
}
/** What's on: weather, events now, and events coming up this week. */
export function openEvents(app) {
  const m = mods(app), w = m.weather && R.WEATHER[m.weather], upcoming = [];
  for (let h = 1, seen = new Set(m.events.map(e => e.id)); h < 24 * 8 && upcoming.length < 4; h++) {
    const t = now() + h * 3600; for (const e of R.eventsAt(t)) if (!seen.has(e.id)) { seen.add(e.id); upcoming.push({ e, t }); }
  }
  const when = t => new Date(t * 1000).toLocaleString(undefined, { weekday: 'short', hour: 'numeric' });
  const p = panel(`<h2>What's on</h2>
    <div class="list-row sticker"><div style="font-size:40px;width:56px;text-align:center">${w ? w.icon : '❔'}</div><div class="grow"><div class="t">${w ? w.name : 'Weather unknown'}</div><div class="d">${w ? `${w.boost.map(elChip).join(' ')} Kikis are out more, a little stronger, and give 25% more Sprouts.` : "Couldn't check the weather right now."}</div></div></div>
    ${m.events.map(e => `<div class="list-row sticker" style="border-color:${e.color}"><div class="grow"><div class="t" style="color:${e.color}">${esc(e.name)}</div><div class="d">${esc(e.blurb)}</div></div></div>`).join('') || '<p class="d">No events right now.</p>'}
    ${upcoming.length ? `<p style="margin-bottom:4px"><b>Coming up</b></p>${upcoming.map(({ e, t }) => `<div class="d" style="text-align:left;margin:4px 8px">${when(t)}: <b>${esc(e.name)}</b></div>`).join('')}` : ''}
    <p class="small-print" style="font-size:12px;color:#4d5aa6">Weather from Open-Meteo, using your rough area (about 10 km).</p>
    <div class="stack"><button class="pill small" data-x>Close</button></div>`);
  p.root.querySelector('[data-x]').onclick = p.close;
}

// ---------- counting what you do (tasks, story, medals) ----------
export function did(app, ev) {
  const p = app.progress, done = R.track(p, ev);
  for (const t of done) { toast(t.story ? `Story step done: ${t.text}!` : `Task done: ${t.text}! Claim it in Tasks.`, 3000); hx.success(); }
  if (R.chapterReady(p) && done.some(t => t.story)) toast('Story chapter complete! Open Tasks to hear from Ranger Rue.', 3200);
  for (const { m, tier, coins } of R.newMedals(p)) medalPop(m, tier, coins);
  app.save();
  if (app.refreshBadges) app.refreshBadges();
}
function medalPop(m, tier, coins) {
  const el = document.createElement('div'); el.className = 'medal-pop sticker';
  el.innerHTML = `<span class="medal t${tier}">★</span><div><b>${R.TIER_NAMES[tier]} medal!</b><br>${esc(m.name)}: ${m.tiers[tier - 1].toLocaleString()} ${esc(m.what)}${coins ? ` · +${coins} coins` : ''}</div>`;
  $('toasts').appendChild(el); sfx('pickup', 0.45); setTimeout(() => el.remove(), 3600);
}

/** Walking: eggs warm up, your buddy looks for Fluff, and walking tasks count. */
export function walked(app, km) {
  const p = app.progress;
  const hatched = R.walkEggs(p, km);
  const found = R.walkBuddy(p, km);
  if (found) { const k = p.kikis.find(x => x.uid === p.buddy.uid); toast(`Your buddy ${k.nick || C.variant(k.sp).name} found ${found} ${R.fluffName(R.familyOf(k.sp))}!`, 3000); hx.light(); }
  did(app, { type: 'walk', n: km });
  for (const e of hatched) app.hatchQueue.push(e);
  if (hatched.length) runHatches(app);
}

// ---------- eggs ----------
export function openEggs(app) {
  const p = app.progress;
  const s = screen(`<div class="sheet-head"><button class="pill small cream" data-x>Back</button><h2>Eggs</h2><span class="count sticker" style="padding:2px 10px">${p.eggs.length} / ${R.EGG_MAX}</span></div><div class="sheet-body"></div>`);
  s.q('[data-x]').onclick = () => { sfx('button', 0.3); s.close(); };
  const render = () => {
    const nested = new Set(p.nests.map(n => n.egg).filter(x => x != null));
    s.q('.sheet-body').innerHTML = `<p class="sticker" style="padding:6px 12px;margin:0 0 10px;text-align:center;font-weight:500">Put an egg in a nest and walk. Distance only counts while the game is open.</p>
      <div class="cards" style="grid-template-columns:repeat(3,1fr);margin-bottom:12px">${p.nests.map(n => { const e = n.egg != null && p.eggs.find(x => x.id === n.egg);
        return `<div class="card sticker nest"><div class="no">${n.uses < 0 ? 'Warm Nest ∞' : `Cozy Nest · ${n.uses} left`}</div>${e ? img('egg:' + e.km, '', 160) + `<div class="eggbar"><i style="width:${e.walked / e.km * 100}%;background:${EGG_COLORS[e.km][0]}"></i></div><div class="pw">${e.walked.toFixed(1)} / ${e.km} km</div>` : '<div class="empty-nest">empty</div>'}</div>`; }).join('')}</div>
      <div class="cards">${p.eggs.length ? p.eggs.map(e => `<div class="card sticker" data-egg="${e.id}">${img('egg:' + e.km, '', 160)}<div class="nm">${e.km} km</div><div class="pw">${nested.has(e.id) ? 'warming…' : 'tap to warm'}</div></div>`).join('')
        : '<div class="empty sticker" style="grid-column:1/-1">No eggs yet. Supply stops sometimes give you one.</div>'}</div>`;
    s.root.querySelectorAll('[data-egg]').forEach(c => c.onclick = () => {
      const id = +c.dataset.egg; if (nested.has(id)) return toast('This egg is already warming in a nest.');
      const free = p.nests.find(n => n.egg == null && n.uses < 0) || p.nests.find(n => n.egg == null);
      if (!free) { hx.warning(); return toast('All your nests are busy. Walk to hatch an egg first, or level up for more nests.'); }
      R.incubate(p, id, free.id); app.save(); sfx('pickup', 0.4); hx.light(); toast(`Egg in the ${free.uses < 0 ? 'Warm Nest' : 'Cozy Nest'}. Start walking!`); render();
    });
  };
  render();
}
async function runHatches(app) {
  if (app.hatching) return; app.hatching = true;
  while (app.hatchQueue.length) {
    while (app.encounter || $('overlay').children.length || $('game').hidden) await wait(700); // wait for the map, with no menus open
    await hatchShow(app, app.hatchQueue.shift());
  }
  app.hatching = false;
}
/** "Oh?" The egg wobbles, cracks, and out pops a Kiki. */
export function hatchShow(app, egg) {
  return new Promise(res => {
    const p = app.progress, L = R.levelOf(p.xp), rec = R.hatchKiki(egg, L, C.sysRng), v = C.variant(egg.sp), first = !p.caught[egg.sp];
    const k = R.addKiki(p, rec, now(), 'Hatched from a ' + egg.km + ' km egg'); p.stats.hatched++;
    const rw = R.EGG_REWARD[egg.km]; p.sprouts += rw.sprouts; p.fluff[R.familyOf(egg.sp)] = (p.fluff[R.familyOf(egg.sp)] || 0) + rw.fluff;
    const ups = R.giveXp(p, rw.xp + (first ? R.XP.newSpecies : 0)); app.save();
    const el = document.createElement('div'); el.className = 'celebrate hatch';
    el.innerHTML = `<h2 style="font-size:40px">Oh?</h2><div class="hatch-stage"></div><div class="hatch-info" style="visibility:hidden"><div class="lines sticker"><div class="got" style="justify-content:center;font-family:Lilita One;font-size:24px">${esc(v.name)}${first ? ' <span class="new-chip">NEW</span>' : ''}</div><div class="got" style="justify-content:center">${elChip(v.element)} POWER ${R.power(k)}</div><div class="got" style="justify-content:center;gap:14px;font-size:16px"><span>+${rw.xp + (first ? R.XP.newSpecies : 0)} XP</span><span>+${rw.sprouts} Sprouts</span><span>+${rw.fluff} ${R.fluffName(R.familyOf(egg.sp))}</span></div></div><button class="pill play" style="font-size:28px;padding:8px 40px 12px">Hello!</button></div>`;
    $('overlay').appendChild(el); sfx('wobble', 0.4);
    let eggObj, kiki, motion, sparkles, t0 = performance.now(), phase = 0;
    const st = liveStage(el.querySelector('.hatch-stage'), (scene, cam) => {
      cam.position.set(0, 0.7, 3.4); cam.lookAt(0, 0.55, 0);
      eggObj = makeEgg(egg.km, 1.1); scene.add(eggObj); sparkles = new Sparkles(scene);
      kiki = makeKiki(egg.sp, 0.9, !!rec.sparkle); kiki.visible = false; scene.add(kiki); motion = new KikiMotion(kiki, reducedMotion);
      return { update(dt) {
        const t = (performance.now() - t0) / 1000;
        if (phase === 0) { const amp = Math.min(0.35, 0.05 + t * 0.07), sp = 6 + t * 3; eggObj.rotation.z = Math.sin(t * sp) * amp * (Math.sin(t * 1.7) > -0.3 ? 1 : 0.2); if (Math.floor(t * 2) !== Math.floor((t - dt) * 2)) { hx.tick(); sfx('wobble', 0.25, 1 + t * 0.1); } }
        motion.update(dt); sparkles.update(dt);
      } };
    });
    (async () => {
      await wait(reducedMotion() ? 1200 : 2600); phase = 1;
      el.querySelector('h2').textContent = rec.sparkle ? '✦ Sparkle! ✦' : 'It hatched!';
      eggObj.visible = false; kiki.visible = true; sparkles.burst(new THREE.Vector3(0, 0.6, 0.3), 30, 0xffffff, 0.08, 1.4, 0.9); sparkles.burst(new THREE.Vector3(0, 0.6, 0.3), 18, 0xffcf2e, 0.07, 1.1, 0.8);
      sfx('burst', 0.55); hx.success(); voice('yay', 0.8); motion.play(motion.randomDance());
      el.querySelector('.hatch-info').style.visibility = '';
      el.querySelector('.hatch-info button').onclick = async () => { sfx('button', 0.35); st.stop(); el.remove(); did(app, { type: 'hatch' }); await levelUps(app, ups); res(); };
    })();
  });
}

// ---------- tasks, the stamp card and the story ----------
const rewardText = r => [r.kiki && `a ${C.variant(r.kiki).name} encounter`, r.items && Object.entries(r.items).map(([id, n]) => `${n} ${n > 1 ? R.ITEMS[id].plural : R.ITEMS[id].name}`).join(', '), r.sprouts && `${r.sprouts} Sprouts`, r.xp && `${r.xp} XP`].filter(Boolean).join(' · ');
/** Hand out a reward bundle; a Kiki reward becomes an encounter right where you are. */
export async function giveReward(app, r) {
  const p = app.progress; if (r.items) R.addItems(p, r.items, true); if (r.sprouts) p.sprouts += r.sprouts;
  const ups = r.xp ? R.giveXp(p, r.xp) : []; app.save(); app.refreshHud();
  if (r.items || r.sprouts || r.xp) toast('Got ' + rewardText({ ...r, kiki: null }), 3000);
  await levelUps(app, ups);
  if (r.kiki) app.rewardEncounter(r.kiki);
}
export function openTasks(app) {
  const p = app.progress;
  const s = screen(`<div class="sheet-head"><button class="pill small cream" data-x>Back</button><h2>Tasks</h2></div><div class="sheet-body"></div>`);
  s.q('[data-x]').onclick = () => { sfx('button', 0.3); s.close(); };
  const render = () => {
    const ch = R.STORY[p.story.ch];
    s.q('.sheet-body').innerHTML = `
      <h3 class="sub">Ranger's tasks <span class="d">(${p.tasks.length}/${R.TASK_MAX})</span></h3>
      ${p.tasks.length ? p.tasks.map(t => `<div class="list-row sticker task"><div class="grow"><div class="t">${esc(t.text)}</div><div class="d">Reward: ${esc(rewardText(t.reward))}</div><div class="eggbar"><i style="width:${t.got / t.n * 100}%"></i></div></div>${t.got >= t.n ? `<button class="pill small" data-claim="${t.id}">Claim</button>` : `<span class="n" style="font-size:18px">${+t.got.toFixed(1)}/${t.n}</span>`}</div>`).join('')
        : '<p class="empty sticker">Spin supply stops to get tasks from Ranger Rue (one per stop each day).</p>'}
      <h3 class="sub">Stamp card</h3>
      <div class="sticker" style="padding:8px;text-align:center"><div class="streak">${[1, 2, 3, 4, 5, 6, 7].map(i => `<i class="${i <= p.stamps.n ? 'on' : ''}${i === 7 ? ' seven' : ''}"></i>`).join('')}</div><span class="d">Finish a task on 7 different days to fill the card and meet a rare Kiki.</span></div>
      <h3 class="sub">Story</h3>
      ${ch ? `<div class="sticker story"><div class="t">Chapter ${p.story.ch + 1}: ${esc(ch.title)}</div><p class="d" style="text-align:left">${esc(ch.intro)}</p>
        ${ch.tasks.map((t, i) => `<div class="step"><span>${esc(t.text)}</span><span class="n" style="font-size:16px">${+Math.min(t.n, p.story.prog[i] || 0).toFixed(1)}/${t.n}</span></div>`).join('')}
        <div class="d">Reward: ${esc(rewardText(ch.reward))}</div>${R.chapterReady(p) ? '<div class="row" style="margin-top:8px"><button class="pill small sky" data-chapter>Finish chapter</button></div>' : ''}</div>`
        : '<div class="sticker story"><div class="t">The story is complete!</div><p class="d">The Golden Spiral Kiki trusts you. More chapters are coming.</p></div>'}`;
    s.root.querySelectorAll('[data-claim]').forEach(b => b.onclick = async () => {
      const c = R.claimTask(p, +b.dataset.claim, now()); if (!c) return; app.save(); sfx('pickup', 0.5); hx.success();
      if (c.stamp) toast(c.card ? 'Stamp card complete!' : `Stamp ${p.stamps.n} of 7!`, 2500);
      did(app, { type: 'none' });
      s.close(); await giveReward(app, c.reward);
      if (c.card) { const sp = R.STAMP_PRIZE.kikiPool[Math.floor(Math.random() * R.STAMP_PRIZE.kikiPool.length)]; await guide(`You filled your stamp card! Here are some supplies, and a special Kiki came to meet you: a <b>${C.variant(sp).name}</b>.`, [['ok', 'Yay!']]); await giveReward(app, { items: R.STAMP_PRIZE.items, xp: R.STAMP_PRIZE.xp, kiki: sp }); }
    });
    const cb = s.q('[data-chapter]'); if (cb) cb.onclick = async () => {
      const done = R.claimChapter(p); if (!done) return; app.save(); s.close();
      await guide(esc(done.outro), [['ok', 'Next']]);
      await giveReward(app, done.reward);
    };
  };
  render();
}

// ---------- medals ----------
export function openMedals(app) {
  const p = app.progress;
  const s = screen(`<div class="sheet-head"><button class="pill small cream" data-x>Back</button><h2>Medals</h2></div><div class="sheet-body"><div class="cards"></div></div>`);
  s.q('[data-x]').onclick = () => { sfx('button', 0.3); s.close(); };
  s.q('.cards').innerHTML = R.MEDALS.map(m => {
    const tier = R.medalTier(p, m), v = m.get(p), next = m.tiers[Math.min(tier, 2)];
    return `<div class="card sticker medal-card"><span class="medal t${tier}" ${m.el ? `style="--el:${R.ELEMENT_COLOR[m.el]}"` : ''}>${m.el ? m.el[0] : '★'}</span><div class="nm">${esc(m.name)}</div><div class="pw">${R.TIER_NAMES[tier] || 'Not yet'}</div><div class="eggbar"><i style="width:${Math.min(100, v / next * 100)}%"></i></div><div class="no">${Math.floor(v).toLocaleString()} / ${next.toLocaleString()} ${esc(m.what)}</div></div>`;
  }).join('');
}
