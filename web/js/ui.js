// Phase 1 screens: the menu, your Kikis and their details (power up, evolve, send home), the Safari Log, the bag,
// your explorer and outfits, level-up celebrations, spinning a supply stop, the nearby list and settings.
import * as THREE from '../vendor/three.module.min.js';
import * as C from './core.js';
import * as R from './rules.js';
import { makeKiki, KikiMotion, portrait, OUTFITS, SKINS, Sparkles, makeExplorer, lookOf, encodeLook, HAIR_STYLES, HATS, GLASSES, BAGS, PATTERNS, LEGS, EXTRAS, HAIR_COLORS, EYE_COLORS, CLOTHES } from './art.js';
import { $, toast, panel, hx, sfx, voice, settings, reducedMotion, wait, fmtDist, fmtKm } from './services.js';
import { openShop, openPrivacy } from './shop.js';
import { setMusic } from './music.js';
import { premium, light } from './lux.js';

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => Math.round(n).toLocaleString('en-US');
const kikiName = k => k.nick || C.variant(k.sp).name;
const now = () => Math.floor(Date.now() / 1000);
const img = (what, cls = '', size = 256) => `<img src="${portrait(what, size)}" alt="" class="${cls}">`;
const day = sec => new Date(sec * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const kp = k => 'kiki:' + k.sp + (k.sparkle ? ':s' : ''); // portrait of one of your Kikis
const elChip = el => `<span class="el-chip" style="background:${R.ELEMENT_COLOR[el]}">${el}</span>`;
const did = (app, ev) => app.did && app.did(ev);
const hpLine = k => { const max = R.battleStats(k).maxHp, hp = R.hpOf(k); return hp >= max ? '' : `<div class="hpbar"><i style="width:${hp / max * 100}%;background:${hp / max > 0.5 ? '#5fd34b' : hp / max > 0.2 ? '#ffcf2e' : '#ff4d4d'}"></i></div>`; };

/** A full-screen sheet over the game. */
function screen(html, { dark = false } = {}) {
  const el = document.createElement('div'); el.className = 'screen-sheet' + (dark ? ' dark' : ''); el.innerHTML = html;
  $('overlay').appendChild(el);
  return { root: el, q: s => el.querySelector(s), close: () => el.remove() };
}
export function confirm(text, yes = 'Yes', no = 'Cancel') {
  return new Promise(res => {
    const p = panel(`<p style="font-size:19px">${text}</p><div class="stack"><button class="pill" data-a="y">${yes}</button><button class="pill small cream" data-a="n">${no}</button></div>`);
    p.root.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { p.close(); sfx('button', 0.35); res(b.dataset.a === 'y'); });
  });
}

// ---------- one shared 3D stage for screens (keeps the number of WebGL contexts low on phones) ----------
let LS = null;
export function liveStage(container, build) {
  if (!LS) {
    const canvas = document.createElement('canvas'), r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    r.outputColorSpace = THREE.SRGBColorSpace; r.setClearColor(0x000000, 0); premium(r); LS = { r, canvas, stop: null };
  }
  if (LS.stop) LS.stop();
  const { r, canvas } = LS; container.appendChild(canvas);
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 0.05, 30);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9a8fd0, 1.2)); const key = new THREE.DirectionalLight(0xfff2e0, 2.1); key.position.set(-1.5, 2.5, 3); scene.add(key);
  light(r, scene, 'day', 0.55); // soft studio reflections (lux.js)
  const api = build(scene, cam, r) || {};
  let alive = true, last = performance.now(), t = 0, w = 0, h = 0;
  const loop = now => {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    if (container.clientWidth !== w || container.clientHeight !== h) { w = container.clientWidth; h = container.clientHeight; r.setPixelRatio(Math.min(2, devicePixelRatio || 1)); r.setSize(w, h, false); cam.aspect = w / Math.max(1, h); cam.updateProjectionMatrix(); }
    if (api.update) api.update(dt, t);
    r.render(scene, cam); requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  const stop = () => { alive = false; canvas.remove(); if (LS.stop === stop) LS.stop = null; };
  LS.stop = stop;
  return { stop, scene, cam, api };
}
/** A Kiki on a little stand that you can spin with a finger. */
function kikiStage(container, sp, sparkle = false) {
  return liveStage(container, (scene, cam) => {
    cam.position.set(0, 0.95, 4.4); cam.lookAt(0, 0.68, 0);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.82, 0.08, 40), new THREE.MeshStandardMaterial({ color: 0xfff8de, roughness: 0.8 })); pad.position.y = -0.04; scene.add(pad);
    const holder = new THREE.Group(); scene.add(holder); const sparkles = new Sparkles(scene);
    let k, motion, spin = 0.3, vel = 0;
    const set = id => { if (k) holder.remove(k); k = makeKiki(id, 1, sparkle); holder.add(k); motion = new KikiMotion(k, reducedMotion); };
    set(sp);
    let drag = null;
    container.onpointerdown = e => { drag = e.clientX; container.setPointerCapture && container.setPointerCapture(e.pointerId); };
    container.onpointermove = e => { if (drag == null) return; vel = (e.clientX - drag) * 0.012; spin += vel; drag = e.clientX; };
    container.onpointerup = () => { drag = null; };
    return {
      set, sparkles, holder, get kiki() { return k; }, get motion() { return motion; },
      update(dt) { if (drag == null) { vel *= 0.92; spin += vel; spin += (0.3 - spin) * dt * 0.6 * (Math.abs(vel) < 0.01 ? 1 : 0); } holder.rotation.y = spin; motion.update(dt); sparkles.update(dt); },
    };
  });
}

// ---------- the menu ----------
export function openMenu(app) {
  const p = app.progress, dim = document.createElement('div'); dim.className = 'menu-dim';
  const best = [...p.kikis].sort((a, b) => b.at - a.at)[0];
  dim.innerHTML = `<div class="menu-grid">
    <button class="sticker" data-m="kikis">${img(best ? kp(best) : 'kiki:meadow', '', 160)}Kikis</button>
    <button class="sticker" data-m="log">${img('kiki:golden-spiral', 'sil', 160)}Safari Log</button>
    <button class="sticker" data-m="bag">${img('item:rune', '', 160)}Bag</button>
    <button class="sticker" data-m="eggs">${img('egg:5', '', 160)}Eggs${p.eggs.length ? ` <span class="badge-n">${p.eggs.length}</span>` : ''}</button>
    <button class="sticker" data-m="tasks"><span class="ic">📋</span>Tasks${p.tasks.some(t => t.got >= t.n) || R.chapterReady(p) ? ' <span class="badge-n">!</span>' : ''}</button>
    <button class="sticker" data-m="friends"><span class="ic">🤝</span>Friends</button>
    <button class="sticker" data-m="leagues"><span class="ic">🏆</span>Leagues</button>
    <button class="sticker" data-m="me">${img(`explorer:${encodeLook(lookOf(p.explorer))}`, '', 160)}Explorer</button>
    <button class="sticker" data-m="shop"><span class="ic"><i class="coin big"></i></span>Shop</button>
  </div>
  <div class="row"><button class="pill small cream" data-m="settings">Settings</button></div>
  <button class="round sticker" data-m="close" aria-label="Close" style="width:64px;height:64px;font-size:28px">✕</button>`;
  $('overlay').appendChild(dim);
  const close = () => dim.remove();
  dim.onclick = e => { if (e.target === dim) close(); };
  dim.querySelectorAll('[data-m]').forEach(b => b.onclick = () => {
    sfx('button', 0.35); hx.light(); close();
    ({ kikis: () => openKikis(app), log: () => openLog(app), bag: () => openBag(app), eggs: () => app.open('eggs'), tasks: () => app.open('tasks'), friends: () => app.open('friends'), leagues: () => app.open('leagues'), me: () => openExplorer(app), shop: () => openShop(app), settings: () => openSettings(app), close: () => {} })[b.dataset.m]();
  });
}

// ---------- your Kikis ----------
const SORTS = [['recent', 'Recent'], ['power', 'Power'], ['number', 'Number'], ['name', 'Name'], ['fav', '★']];
export function openKikis(app, onPick = null, title = 'Kikis', only = null) {
  const p = app.progress;
  const s = screen(`<div class="sheet-head"><button class="pill small cream" data-x>Back</button><h2>${title}</h2><span class="count sticker" style="padding:2px 10px">${p.kikis.length} / ${R.kikiMax(p)}</span></div>
    <div class="tabs">${SORTS.map(([k, l]) => `<button data-s="${k}">${l}</button>`).join('')}</div>
    <input class="search" type="search" placeholder="Search by name, element or sparkle" maxlength="20">
    <div class="sheet-body"><div class="cards"></div></div>`);
  let sort = settings.get('sort', 'recent');
  const render = () => {
    s.root.querySelectorAll('[data-s]').forEach(b => b.classList.toggle('on', b.dataset.s === sort));
    const q = s.q('.search').value.trim().toLowerCase();
    let list = p.kikis.filter(k => !only || only(k)).filter(k => !q || kikiName(k).toLowerCase().includes(q) || C.variant(k.sp).name.toLowerCase().includes(q) || C.variant(k.sp).element.toLowerCase() === q || (q === 'sparkle' && k.sparkle));
    const by = { recent: (a, b) => b.at - a.at || b.uid - a.uid, power: (a, b) => R.power(b) - R.power(a), number: (a, b) => C.variant(a.sp).no - C.variant(b.sp).no || R.power(b) - R.power(a), name: (a, b) => kikiName(a).localeCompare(kikiName(b)), fav: (a, b) => (b.fav - a.fav) || b.at - a.at };
    list.sort(by[sort]);
    s.q('.cards').innerHTML = list.length ? list.map(k => `<div class="card sticker" data-uid="${k.uid}">${k.size ? `<span class="sz">${k.size}</span>` : ''}${k.fav ? '<span class="fav">★</span>' : ''}${k.sparkle ? '<span class="spk">✦</span>' : ''}${app.progress.buddy && app.progress.buddy.uid === k.uid ? '<span class="bud">buddy</span>' : ''}${img(kp(k), '', 192)}<div class="pw">POWER ${R.power(k)}</div><div class="nm">${esc(kikiName(k))}</div>${hpLine(k)}${k.keeping ? '<div class="no">keeping a circle</div>' : ''}</div>`).join('')
      : `<div class="empty sticker" style="grid-column:1/-1">${p.kikis.length ? 'No Kikis match that.' : 'No Kikis yet. Tap one on the map to catch it!'}</div>`;
    s.root.querySelectorAll('[data-uid]').forEach(c => c.onclick = () => { sfx('button', 0.3); const k = p.kikis.find(x => x.uid === +c.dataset.uid); if (onPick) { s.close(); onPick(k); } else openKiki(app, k.uid, render); });
  };
  s.root.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { sort = b.dataset.s; settings.set('sort', sort); sfx('button', 0.3); render(); });
  s.q('.search').oninput = render;
  s.q('[data-x]').onclick = () => { sfx('button', 0.3); s.close(); };
  render();
  return s;
}

/** One Kiki: power, size, level, and what you can do with it. */
export function openKiki(app, uid, onChange = () => {}) {
  const p = app.progress, k = p.kikis.find(x => x.uid === uid); if (!k) return;
  const s = screen(`<div class="sheet-head"><button class="pill small cream" data-x>Back</button><h2></h2><button class="mini" data-fav></button></div>
    <div class="stage"></div><div class="sheet-body" style="padding-top:0"></div>`);
  const st = kikiStage(s.q('.stage'), k.sp, !!k.sparkle);
  const close = () => { st.stop(); s.close(); onChange(); };
  s.q('[data-x]').onclick = () => { sfx('button', 0.3); close(); };
  s.q('[data-fav]').onclick = () => { k.fav = !k.fav; app.save(); hx.light(); sfx('button', 0.3); render(); };
  function render() {
    const v = C.variant(k.sp), fam = R.familyOf(k.sp), fl = p.fluff[fam] || 0, maxL = R.maxKikiLevel(R.levelOf(p.xp)), cost = R.powerUpCost(k.lvl);
    const up = R.canPowerUp(p, k), ev = R.canEvolve(p, k);
    s.q('h2').textContent = '#' + String(v.no).padStart(3, '0');
    s.q('[data-fav]').textContent = k.fav ? '★ Favourite' : '☆ Favourite'; s.q('[data-fav]').classList.toggle('on', k.fav);
    s.q('.sheet-body').innerHTML = `
      <div class="detail-power">POWER <b>${R.power(k)}</b></div>
      <div class="detail-name"><span>${k.sparkle ? '✦ ' : ''}${esc(kikiName(k))}</span><button data-nick aria-label="Rename">✏️</button></div>
      <div style="text-align:center;margin:-2px 0 6px">${elChip(v.element)} <span class="d" style="font-size:13px">strong vs ${R.STRONG[v.element].join(', ')} · weak to ${R.weakTo(v.element).join(', ')}</span></div>
      ${(() => { const st2 = R.battleStats(k), hp = R.hpOf(k); return `<div class="hprow"><span>HP ${hp} / ${st2.maxHp}</span>${hp < st2.maxHp ? '<button class="mini" data-heal>Heal</button>' : ''}</div><div class="hpbar big"><i style="width:${hp / st2.maxHp * 100}%;background:${hp / st2.maxHp > 0.5 ? '#5fd34b' : hp / st2.maxHp > 0.2 ? '#ffcf2e' : '#ff4d4d'}"></i></div><div class="d" style="text-align:center;font-size:13px;margin:2px 0 8px">Moves: ${R.MOVES[v.element][0]} · ${R.MOVES[v.element][1]}${k.keeping ? ' · keeping a Rune Circle' : ''}</div>`; })()}
      <div style="display:flex;justify-content:space-between;font-size:14px"><span>Level ${k.lvl}</span><span>max ${maxL}</span></div>
      <div class="lvlbar"><i style="width:${Math.min(100, k.lvl / maxL * 100)}%"></i></div>
      <div class="stats3">
        <div class="sticker"><b>${k.w} kg</b><span>Weight${k.size === 'XS' || k.size === 'XL' ? ' · ' + k.size : ''}</span></div>
        <div class="sticker"><b style="color:${C.RARITY[v.rarity].second}">${C.RARITY[v.rarity].label}</b><span>${v.name.replace(' Kiki', '')}</span></div>
        <div class="sticker"><b>${(k.h / 100).toFixed(2)} m</b><span>Height${k.size ? ' · ' + k.size : ''}</span></div>
      </div>
      <div class="stats3" style="grid-template-columns:1fr 1fr">
        <div class="sticker"><b>${fmt(p.sprouts)}</b><span>Sprouts</span></div>
        <div class="sticker"><b>${fl}</b><span>${R.fluffName(fam)}</span></div>
      </div>
      <div class="actions">
        <div class="action sticker"><div class="what">Power up<span class="cost">${up.ok || k.lvl < maxL ? `${fmt(cost.sprouts)} Sprouts · ${cost.fluff} ${R.fluffName(fam)}` : 'Level up to power it further'}</span></div><button class="pill small" data-up ${up.ok ? '' : 'style="opacity:.55"'}>Power up</button></div>
        ${v.evolvesTo ? `<div class="action sticker"><div class="what">Evolve<span class="cost">${v.cost} ${R.fluffName(fam)} → ${C.variant(v.evolvesTo).name}</span></div><button class="pill small sky" data-ev ${ev.ok ? '' : 'style="opacity:.55"'}>Evolve</button></div>` : ''}
        <div class="action sticker"><div class="what">${p.buddy && p.buddy.uid === k.uid ? 'Your buddy' : 'Buddy'}<span class="cost">${p.buddy && p.buddy.uid === k.uid ? `${fmtKm(p.buddy.km)} of ${fmtKm(R.BUDDY_KM[v.rarity], 0)} to the next Fluff` : `Walks with you and finds a Fluff every ${fmtKm(R.BUDDY_KM[v.rarity], 0)}`}</span></div><button class="pill small cream" data-buddy>${p.buddy && p.buddy.uid === k.uid ? 'Swap' : 'Make buddy'}</button></div>
        <div class="action sticker"><div class="what">Appraise<span class="cost">Ask Ranger Rue about its hidden stats</span></div><button class="pill small cream" data-ap>Appraise</button></div>
      </div>
      <div class="blurb sticker">Caught ${day(k.at)}${k.place ? ' near ' + esc(k.place) : ''}.<br>${esc(v.blurb)}</div>
      <div class="row" style="margin-top:12px"><button class="pill small pink" data-home>Send home</button></div>`;
    const b = sel => s.q(sel);
    b('[data-nick]').onclick = () => rename(app, k, render);
    b('[data-up]').onclick = () => {
      if (!R.canPowerUp(p, k).ok) { hx.warning(); return toast(R.canPowerUp(p, k).why); }
      const before = R.power(k); R.powerUp(p, k); app.save(); sfx('pickup', 0.45); hx.medium(); did(app, { type: 'power' });
      st.api.sparkles.burst(new THREE.Vector3(0, 0.6, 0), 18, 0xffcf2e, 0.07, 1.1, 0.7); st.api.motion.play(st.api.motion.tinyHops());
      toast(`POWER ${before} → ${R.power(k)}`, 1600); render();
    };
    if (v.evolvesTo) b('[data-ev]').onclick = async () => {
      const c = R.canEvolve(p, k); if (!c.ok) { hx.warning(); return toast(c.why); }
      if (!await confirm(`Evolve ${esc(kikiName(k))} into ${C.variant(c.to).name}? It costs ${c.cost} ${R.fluffName(fam)}.`, 'Evolve')) return;
      const res = R.evolve(p, k); p.stats.evolved++; app.save(); did(app, { type: 'evolve' });
      await evolveShow(s, st, res);
      const ups = R.giveXp(p, res.xp); app.save(); app.refreshHud();
      toast(`+${res.xp} XP${res.first ? ' · New in your Safari Log!' : ''}`, 2600);
      render(); await levelUps(app, ups);
    };
    b('[data-ap]').onclick = () => appraisePanel(k);
    if (b('[data-heal]')) b('[data-heal]').onclick = () => { if (app.healKiki(k)) render(); };
    b('[data-buddy]').onclick = () => {
      if (p.buddy && p.buddy.uid === k.uid) { R.setBuddy(p, null); app.save(); app.map.setBuddy && app.map.setBuddy(null); toast('Buddy sent back to your collection. Pick a new one!'); return render(); }
      R.setBuddy(p, k.uid); app.save(); sfx('pickup', 0.45); hx.success(); st.api.motion.play(st.api.motion.randomDance()); toast(`${kikiName(k)} is your buddy now. Go for a walk!`); render();
    };
    b('[data-home]').onclick = async () => {
      if (k.fav) { hx.warning(); return toast("Favourites can't be sent home. Tap ☆ to unfavourite it first."); }
      if (k.keeping) { hx.warning(); return toast('This Kiki is keeping a Rune Circle. Call it home from the circle first.'); }
      if (!await confirm(`Send ${esc(kikiName(k))} home to Ranger Rue? You'll get 1 ${R.fluffName(fam)}.`, 'Send home')) return;
      if (p.buddy && p.buddy.uid === k.uid) R.setBuddy(p, null);
      R.sendHome(p, k.uid); app.save(); sfx('pickup', 0.4); toast(`Bye bye, ${kikiName(k)}! +1 ${R.fluffName(fam)}`); close();
    };
  }
  render();
}

function rename(app, k, done) {
  const p = panel(`<h2>Nickname</h2><input class="name-input" maxlength="12" value="${esc(k.nick || '')}" placeholder="${esc(C.variant(k.sp).name)}"><div class="stack"><button class="pill" data-ok>Save</button><button class="pill small cream" data-no>Cancel</button></div>`);
  const input = p.root.querySelector('input'); setTimeout(() => input.focus(), 50);
  p.root.querySelector('[data-ok]').onclick = () => { k.nick = input.value.replace(/[^\p{L}\p{N} '\-]/gu, '').trim().slice(0, 12); app.save(); p.close(); done(); };
  p.root.querySelector('[data-no]').onclick = p.close;
}

function appraisePanel(k) {
  const a = R.appraise(k), says = a.perfect ? 'A perfect Kiki! Look after this one.' : ['It has a lot of heart!', 'A good, solid Kiki.', 'A really strong Kiki.', 'Wow! This one is amazing!'][a.stars];
  const p = panel(`<img src="${portrait('explorer:4:3', 256)}" alt="" style="width:110px"><p style="font-size:19px;margin-top:0"><b style="color:#3fae2a">Ranger Rue</b><br>${says}</p>
    <div class="stars">${'★'.repeat(a.stars)}${'☆'.repeat(3 - a.stars)}${a.perfect ? ' 👑' : ''}</div>
    ${R.STATS.map((n, i) => `<div class="statbar"><span>${n}</span><div><i style="width:${k.iv[i] / 15 * 100}%;${k.iv[i] === 15 ? 'background:#ff5d8f' : ''}"></i></div></div>`).join('')}
    <div class="stack"><button class="pill small" data-ok>Thanks!</button></div>`);
  p.root.querySelector('[data-ok]').onclick = p.close; sfx('pickup', 0.35);
}

/** The evolution: Kiki flickers between forms faster and faster, then bursts into the new one. */
async function evolveShow(s, st, res) {
  const stageEl = s.q('.stage'), flash = document.createElement('div');
  flash.style.cssText = 'position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;transition:opacity .12s'; stageEl.appendChild(flash);
  s.q('.sheet-body').style.visibility = 'hidden';
  const api = st.api; api.motion.stop(); sfx('portal', 0.5);
  const t0 = performance.now(), dur = reducedMotion() ? 1600 : 3200;
  let shown = res.from.id;
  while (performance.now() - t0 < dur) {
    const k = (performance.now() - t0) / dur, gap = 420 * (1 - k) + 50;
    shown = shown === res.from.id ? res.to.id : res.from.id; api.set(shown); flash.style.opacity = 0.35 + k * 0.5; hx.tick();
    api.sparkles.burst(new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.3 + Math.random() * 1.2, 0.4), 3, 0xffffff, 0.06, 0.4, 0.6);
    await wait(gap); flash.style.opacity = 0.1;
  }
  api.set(res.to.id); flash.style.transition = 'opacity .8s'; flash.style.opacity = 1; await wait(60); flash.style.opacity = 0;
  api.sparkles.burst(new THREE.Vector3(0, 0.7, 0.2), 40, 0xffcf2e, 0.09, 1.6, 1.0); api.sparkles.burst(new THREE.Vector3(0, 0.7, 0.2), 24, 0x7a00ff, 0.08, 1.2, 0.9);
  sfx('burst', 0.55); hx.success(); voice('yay', 0.8);
  api.motion.play(api.motion.randomDance());
  const msg = document.createElement('div'); msg.className = 'sticker'; msg.style.cssText = 'position:absolute;left:50%;bottom:8px;transform:translateX(-50%);padding:6px 14px;font-size:17px;text-align:center;width:max-content;max-width:92%';
  msg.innerHTML = `Your ${esc(res.from.name)} evolved into <b>${esc(res.to.name)}</b>!`; stageEl.appendChild(msg);
  await wait(2200); msg.remove(); flash.remove(); s.q('.sheet-body').style.visibility = '';
}

// ---------- level up ----------
export async function levelUps(app, ups) {
  for (const u of ups) await new Promise(res => {
    const el = document.createElement('div'); el.className = 'celebrate';
    el.innerHTML = `<h2>LEVEL ${u.level}!</h2><div class="lines sticker">${Object.entries(u.items).map(([id, n]) => `<div class="got">${img('item:' + id, '', 128)}<span>${R.ITEMS[id].name}</span><span class="x">×${n}</span></div>`).join('')}
      ${u.nest ? `<div class="got">${img('egg:2', '', 128)}<span>Cozy Nest (3 eggs)</span><span class="x">×1</span></div>` : ''}
      ${u.unlocks.map(id => `<div class="unlock">New: <b>${R.ITEMS[id].plural}</b>! ${esc(R.ITEMS[id].blurb)}</div>`).join('')}</div>
      <button class="pill play" style="font-size:30px;padding:10px 40px 14px">Awesome!</button>`;
    $('overlay').appendChild(el); sfx('burst', 0.55); hx.success(); voice('yay', 0.7);
    el.querySelector('button').onclick = () => { sfx('button', 0.35); el.remove(); res(); };
  });
  if (ups.length) app.refreshHud();
}

// ---------- the Safari Log ----------
export function openLog(app) {
  const p = app.progress, caught = R.SPECIES.filter(v => p.caught[v.id]).length, seen = R.SPECIES.filter(v => p.seen[v.id]).length;
  const s = screen(`<div class="sheet-head"><button class="pill small cream" data-x>Back</button><h2>Safari Log</h2></div>
    <p class="sticker" style="padding:6px 12px;margin:0 0 8px;text-align:center">Caught <b>${caught}</b> · Seen <b>${seen}</b> · of ${R.SPECIES.length}</p>
    <div class="tabs"><button data-f="" class="on">All</button>${R.ELEMENTS.map(e => `<button data-f="${e}">${e}</button>`).join('')}</div>
    <div class="sheet-body"><div class="cards">${R.SPECIES.map(v => {
      const c = p.caught[v.id], sn = p.seen[v.id];
      return `<div class="card sticker${c ? '' : ' unknown'}" data-sp="${v.id}" data-el="${v.element}"><div class="no">#${String(v.no).padStart(3, '0')} <i class="el-dot" style="background:${R.ELEMENT_COLOR[v.element]}"></i></div>${sn || c ? img('kiki:' + v.id, c ? '' : 'sil', 192) : '<div style="aspect-ratio:1;display:grid;place-items:center;font-family:Lilita One;font-size:44px;color:#b9b6a0">?</div>'}<div class="nm">${c ? v.name : sn ? v.name : '???'}</div></div>`;
    }).join('')}</div></div>`);
  s.q('[data-x]').onclick = () => { sfx('button', 0.3); s.close(); };
  s.root.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { s.root.querySelectorAll('[data-f]').forEach(x => x.classList.toggle('on', x === b)); s.root.querySelectorAll('[data-el]').forEach(c => c.hidden = !!b.dataset.f && c.dataset.el !== b.dataset.f); sfx('button', 0.3); });
  s.root.querySelectorAll('[data-sp]').forEach(c => c.onclick = () => { if (!p.caught[c.dataset.sp]) { hx.light(); return toast(p.seen[c.dataset.sp] ? 'Seen but not caught yet!' : "You haven't found this one yet."); } sfx('button', 0.3); openSpecies(app, c.dataset.sp); });
}
export function openSpecies(app, id) {
  const p = app.progress, v = C.variant(id), fam = R.familyOf(id);
  const chain = R.SPECIES.filter(x => x.family === fam);
  const where = !v.weight ? 'Not seen in the wild. Some say it comes through the portals' : v.time === 'night' ? 'Only at night' : v.habitats ? `Most often in ${v.habitats.join(', ').toLowerCase()} areas${v.nightBoost ? ', especially after dark' : ''}` : 'Anywhere, very rarely (more during Portal Surges)';
  const s = screen(`<div class="sheet-head"><button class="pill small cream" data-x>Back</button><h2>#${String(v.no).padStart(3, '0')}</h2></div>
    <div class="stage"></div><div class="sheet-body" style="padding-top:0">
      <div class="detail-name">${v.name}</div>
      <p style="text-align:center;margin:0;color:${C.RARITY[v.rarity].second}">${C.RARITY[v.rarity].label} ${elChip(v.element)}</p>
      <p class="d" style="text-align:center;margin:4px 0 0">Strong vs ${R.STRONG[v.element].join(' and ')} · weak to ${R.weakTo(v.element).join(' and ')}</p>
      <div class="blurb sticker">${esc(v.blurb)}<br><span style="color:#4d5aa6">${where}${v.time === 'day' ? ', in daylight' : ''}.</span></div>
      ${chain.length > 1 ? `<div class="sticker chain">${chain.map((x, i) => `${i ? `<span class="arrow">→<br>${chain[i - 1].cost} Fluff</span>` : ''}<div class="step">${img('kiki:' + x.id, p.caught[x.id] ? '' : 'sil', 160)}<div style="font-size:12px">${p.caught[x.id] ? x.name : '???'}</div></div>`).join('')}</div>` : ''}
      <div class="stats3" style="grid-template-columns:1fr 1fr"><div class="sticker"><b>${p.caught[id] || 0}</b><span>Caught</span></div><div class="sticker"><b>${p.fluff[fam] || 0}</b><span>${R.fluffName(fam)}</span></div></div>
    </div>`);
  const st = kikiStage(s.q('.stage'), id);
  s.q('[data-x]').onclick = () => { sfx('button', 0.3); st.stop(); s.close(); };
}

// ---------- the bag ----------
export function openBag(app) {
  const p = app.progress, L = R.levelOf(p.xp);
  const s = screen(`<div class="sheet-head"><button class="pill small cream" data-x>Back</button><h2>Bag</h2><span class="count sticker" style="padding:2px 10px"></span></div><div class="sheet-body"></div>`);
  const render = () => {
    s.q('.count').textContent = `${R.bagCount(p)} / ${R.bagMax(p)}`;
    s.q('.sheet-body').innerHTML = Object.entries(R.ITEMS).map(([id, it]) => {
      const n = p.items[id] || 0, locked = L < it.unlock;
      if (locked && !n) return `<div class="list-row sticker" style="opacity:.55"><div style="width:56px;height:56px;display:grid;place-items:center;font-size:26px">🔒</div><div class="grow"><div class="t">???</div><div class="d">Unlocks at explorer level ${it.unlock}</div></div></div>`;
      return `<div class="list-row sticker">${img('item:' + id, '', 128)}<div class="grow"><div class="t">${it.name}</div><div class="d">${esc(it.blurb)}</div></div><div style="text-align:center"><div class="n">${n}</div>${n && (it.kind === 'heal' || it.kind === 'revive') ? `<button class="mini" data-use="${id}">Use</button> ` : ''}${n ? `<button class="mini" data-drop="${id}">Discard</button>` : ''}</div></div>`;
    }).join('') + `<p class="d" style="text-align:center;color:#4d5aa6">Your bag holds ${R.bagMax(p)} items. Supply stops can't give you more when it's full. A bigger bag is in the Shop.</p>`;
    s.root.querySelectorAll('[data-drop]').forEach(b => b.onclick = () => discard(app, b.dataset.drop, render));
    s.root.querySelectorAll('[data-use]').forEach(b => b.onclick = () => {
      const id = b.dataset.use, revive = R.ITEMS[id].kind === 'revive', hurt = p.kikis.filter(k => revive ? R.hpOf(k) === 0 : R.hpOf(k) > 0 && R.hpOf(k) < R.battleStats(k).maxHp);
      if (!hurt.length) return toast(revive ? 'No fainted Kikis. Great!' : 'All your Kikis are full of energy!');
      openKikis(app, k => { const got = R.heal(p, k, id); app.save(); if (got) { sfx('pickup', 0.45); toast(`${kikiName(k)}: +${got} HP`); } render(); }, revive ? 'Revive which Kiki?' : 'Heal which Kiki?', k => hurt.includes(k));
    });
  };
  s.q('[data-x]').onclick = () => { sfx('button', 0.3); s.close(); };
  render();
}
function discard(app, id, done) {
  const p = app.progress, max = p.items[id] || 0; let n = Math.min(5, max);
  const pn = panel(`<h2>Discard</h2>${img('item:' + id, '', 128)}<p>${R.ITEMS[id].name}</p><div class="row"><button class="pill small cream" data-d="-1">−</button><b class="n" style="font-family:Lilita One;font-size:30px;min-width:60px">${n}</b><button class="pill small cream" data-d="1">+</button></div>
    <div class="stack"><button class="pill pink" data-ok>Discard</button><button class="pill small cream" data-no>Cancel</button></div>`);
  pn.root.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { n = Math.max(1, Math.min(max, n + +b.dataset.d)); pn.root.querySelector('.n').textContent = n; });
  pn.root.querySelector('[data-ok]').onclick = () => { p.items[id] -= n; app.save(); pn.close(); done(); };
  pn.root.querySelector('[data-no]').onclick = pn.close;
}

// ---------- your explorer ----------
export function openExplorer(app) {
  const p = app.progress, L = R.levelOf(p.xp), lo = R.xpFor(L), hi = R.xpFor(L + 1), t = now();
  const dots = kind => { const n = R.streakNow(p, kind, t); return `<div class="streak">${[1, 2, 3, 4, 5, 6, 7].map(i => `<i class="${i <= n ? 'on' : ''}${i === 7 ? ' seven' : ''}"></i>`).join('')}</div>`; };
  const s = screen(`<div class="sheet-head"><button class="pill small cream" data-x>Back</button><h2>${esc(p.explorer.name || 'Explorer')}</h2></div>
    <div class="sheet-body" style="text-align:center">
      ${img(`explorer-full:${encodeLook(lookOf(p.explorer))}`, 'big-explorer', 512)}
      <div class="row"><button class="pill small sky" data-look>Change look</button><button class="pill small" data-medals>Medals</button></div>
      ${p.buddy && p.kikis.find(k => k.uid === p.buddy.uid) ? (() => { const b = p.kikis.find(k => k.uid === p.buddy.uid); return `<div class="list-row sticker" style="margin-top:12px">${img(kp(b), '', 128)}<div class="grow"><div class="t">Buddy: ${esc(kikiName(b))}</div><div class="d">${fmtKm(p.buddy.km)} of ${fmtKm(R.BUDDY_KM[C.variant(b.sp).rarity], 0)} to the next ${R.fluffName(R.familyOf(b.sp))}</div></div></div>`; })() : ''}
      ${p.faction ? `<div class="sticker" style="padding:6px 12px;margin-top:12px;border-color:${R.FACTIONS[p.faction].color}"><b style="color:${R.FACTIONS[p.faction].color};font-family:Lilita One;font-size:20px">${R.FACTIONS[p.faction].name}</b></div>` : ''}
      <div class="sticker" style="padding:8px 14px;margin:14px 0 6px"><div style="font-family:Lilita One;font-size:26px">Level ${L}</div>
        <div class="lvlbar"><i style="width:${L >= R.MAX_LEVEL ? 100 : (p.xp - lo) / (hi - lo) * 100}%"></i></div>
        <div style="font-size:14px">${L >= R.MAX_LEVEL ? fmt(p.xp) + ' XP' : `${fmt(p.xp - lo)} / ${fmt(hi - lo)} XP to level ${L + 1}`}</div></div>
      <div class="stats3"><div class="sticker"><b>${p.stats.catches}</b><span>Kikis caught</span></div><div class="sticker"><b>${R.SPECIES.filter(v => p.caught[v.id]).length}/${R.SPECIES.length}</b><span>Safari Log</span></div><div class="sticker"><b>${p.stats.stops}</b><span>Stops spun</span></div></div>
      <div class="stats3"><div class="sticker"><b>${p.stats.wins || 0}</b><span>Battles won</span></div><div class="sticker"><b>${p.stats.raids || 0}</b><span>Raids won</span></div><div class="sticker"><b>${Object.keys(p.keepers).length}</b><span>Circles kept</span></div></div>
      <div class="stats3"><div class="sticker"><b>${fmtKm(p.stats.km).split(' ')[0]}</b><span>${fmtKm(0).split(' ')[1]} walked</span></div><div class="sticker"><b>${p.stats.excellent}</b><span>Excellent throws</span></div><div class="sticker"><b>${p.stats.evolved}</b><span>Evolved</span></div></div>
      <div class="sticker" style="padding:8px">First catch of the day${dots('catch')}First stop of the day${dots('stop')}<span style="font-size:13px;color:#4d5aa6">Day 7 in a row gives a big bonus.</span></div>
    </div>`);
  s.q('[data-x]').onclick = () => { sfx('button', 0.3); s.close(); };
  s.q('[data-look]').onclick = () => { s.close(); outfitPicker(app, { onDone: () => openExplorer(app) }); };
  s.q('[data-medals]').onclick = () => { sfx('button', 0.3); app.open('medals'); };
}
/** Pick your look (and name, the first time): skin, hair, eyes, hat and clothes, each in any colour. */
export function outfitPicker(app, { first = false, onDone = () => {} } = {}) {
  const e = app.progress.explorer, look = lookOf(e);
  const hex = c => '#' + c.toString(16).padStart(6, '0');
  const sw = (key, colors, label) => `<div class="look-row"><div class="look-label">${label}</div><div class="look-swatches">${colors.map(c => `<button data-c="${key}" data-v="${c}" style="background:${hex(c)}" aria-label="${label} ${hex(c)}"></button>`).join('')}</div></div>`;
  const chips = (key, names, label) => `<div class="look-row"><div class="look-label">${label}</div><div class="look-chips">${names.map((n, i) => `<button data-s="${key}" data-v="${i}">${n}</button>`).join('')}</div></div>`;
  const s = screen(`<div class="sheet-head"><h2>${first ? 'Make your explorer' : 'Change look'}</h2></div>
    <div class="look-stage"></div>
    <div class="sheet-body look-body">
      ${first ? `<input class="name-input" maxlength="15" placeholder="Your explorer name" value="${esc(e.name)}">` : ''}
      <div class="look-row"><div class="look-label">Festival looks</div><div class="outfits">${OUTFITS.slice(0, 4).map((o, i) => `<button data-o="${i}">${img(`explorer:${encodeLook({ ...lookOf({ outfit: i }), skin: look.skin })}`, '', 160)}${o[0]}</button>`).join('')}</div></div>
      ${sw('skin', SKINS, 'Skin')}
      ${chips('hair', HAIR_STYLES, 'Hair')}
      ${sw('hairC', HAIR_COLORS, 'Hair colour')}
      ${sw('eyes', EYE_COLORS, 'Eyes')}
      ${chips('hat', HATS, 'Hat')}
      <div class="look-if" data-if="hat">${sw('hatC', CLOTHES, 'Hat colour')}</div>
      ${chips('glasses', GLASSES, 'Shades')}
      <div class="look-if" data-if="glasses">${sw('glassC', CLOTHES, 'Shades colour')}</div>
      ${chips('topPat', PATTERNS, 'Top')}
      ${sw('top', CLOTHES, 'Top colour')}
      ${chips('pants', LEGS, 'Bottoms')}
      ${chips('botPat', PATTERNS, 'Bottoms pattern')}
      ${sw('bottom', CLOTHES, 'Bottoms colour')}
      ${sw('shoes', CLOTHES, 'Shoes')}
      ${chips('bag', BAGS, 'Bag')}
      <div class="look-if" data-if="bag">${sw('pack', CLOTHES, 'Bag colour')}</div>
      <div class="look-row"><div class="look-label">Extras</div><div class="look-chips">${EXTRAS.map(([k, n]) => `<button data-t="${k}">${n}</button>`).join('')}</div></div>
    </div><div class="sheet-foot"><button class="pill" data-ok>${first ? "That's me!" : 'Done'}</button></div>`);
  // A live 3D preview: drag to turn your explorer around.
  let holder, avatar, spin = -0.4, drag = null;
  const st = liveStage(s.q('.look-stage'), (scene, cam) => {
    cam.position.set(0, 0.62, 2.35); cam.lookAt(0, 0.52, 0);
    holder = new THREE.Group(); scene.add(holder);
    return { update: dt => { if (avatar) avatar.userData.update(dt, 0); if (!drag) spin += dt * 0.25; holder.rotation.y = spin; } };
  });
  const stage = s.q('.look-stage');
  stage.addEventListener('pointerdown', ev => { drag = ev.clientX; stage.setPointerCapture && stage.setPointerCapture(ev.pointerId); });
  stage.addEventListener('pointermove', ev => { if (drag == null) return; spin += (ev.clientX - drag) * 0.012; drag = ev.clientX; });
  const endDrag = () => { drag = null; }; stage.addEventListener('pointerup', endDrag); stage.addEventListener('pointercancel', endDrag);
  const skinValue = i => SKINS[i];
  const render = () => {
    if (avatar) holder.remove(avatar);
    avatar = makeExplorer(look); holder.add(avatar);
    s.root.querySelectorAll('[data-c]').forEach(b => b.classList.toggle('on', b.dataset.c === 'skin' ? skinValue(look.skin) === +b.dataset.v : look[b.dataset.c] === +b.dataset.v));
    s.root.querySelectorAll('[data-s]').forEach(b => b.classList.toggle('on', look[b.dataset.s] === +b.dataset.v));
    s.root.querySelectorAll('[data-t]').forEach(b => b.classList.toggle('on', !!look[b.dataset.t]));
    s.root.querySelectorAll('.look-if').forEach(d => { d.hidden = d.dataset.if === 'bag' ? look.bag === 3 : !look[d.dataset.if]; });
  };
  s.root.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { const k = b.dataset.c, v = +b.dataset.v; look[k] = k === 'skin' ? SKINS.indexOf(v) : v; sfx('button', 0.25); hx.light(); render(); });
  s.root.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { look[b.dataset.s] = +b.dataset.v; sfx('button', 0.25); hx.light(); render(); });
  s.root.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { look[b.dataset.t] = look[b.dataset.t] ? 0 : 1; sfx('button', 0.25); hx.light(); render(); });
  s.root.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { Object.assign(look, { ...lookOf({ outfit: +b.dataset.o }), skin: look.skin }); sfx('button', 0.3); hx.light(); render(); });
  s.q('[data-ok]').onclick = () => {
    if (first) { const n = cleanName(s.q('.name-input').value); if (!n) { hx.warning(); s.q('.name-input').focus(); return toast('Give your explorer a name!'); } e.name = n; }
    e.look = { ...look }; app.save(); app.map.setExplorer(); app.refreshHud(); if (app.syncProfile) app.syncProfile();
    sfx('pickup', 0.45); hx.success(); st.stop(); s.close(); onDone();
  };
  render();
}

// ---------- supply stops ----------
export function stopPanel(app, t) {
  const p = app.progress, t0 = now(), since = p.stops[t.id] ? t0 - p.stops[t.id] : Infinity, used = since < R.STOP_COOLDOWN;
  const s = screen(`<div class="sheet-head"><button class="pill small cream" data-x>Close</button><h2 style="font-size:24px">${esc(t.name)}</h2></div>
    <div class="sheet-body" style="text-align:center;touch-action:none"><p class="sticker" style="display:inline-block;padding:4px 14px;margin:6px 0">${used ? 'Restocking…' : p.visited[t.id] ? 'Supply Stop' : 'New Supply Stop!'}</p>
      <div class="disc${used ? ' used' : ''}">${img('item:rune', '', 256)}</div>
      <p class="hint-line" style="font-size:18px">${used ? `This stop restocks in ${Math.floor((R.STOP_COOLDOWN - since) / 60)}:${String((R.STOP_COOLDOWN - since) % 60).padStart(2, '0')}` : 'Swipe across the stone to spin it!'}</p>
      <div class="loot"></div></div>`);
  const disc = s.q('.disc'); let x0 = null, spun = false, angle = 0;
  const close = () => { s.close(); app.world.nextPlan = 0; if (s.after) s.after(); };
  s.q('[data-x]').onclick = () => { sfx('button', 0.3); close(); };
  disc.onpointerdown = e => { x0 = [e.clientX, e.clientY]; disc.setPointerCapture && disc.setPointerCapture(e.pointerId); };
  disc.onpointerup = e => {
    if (!x0) return; const dx = e.clientX - x0[0], dy = e.clientY - x0[1]; x0 = null;
    if (Math.hypot(dx, dy) < 40) return;
    angle += (dx >= 0 ? 1 : -1) * 1080; disc.style.transition = 'transform 1.1s cubic-bezier(.15,.8,.3,1), filter .3s'; disc.style.transform = `rotate(${angle}deg)`;
    sfx('throw', 0.4); hx.medium();
    if (used || spun) return; spun = true; spin();
  };
  async function spin() {
    const now2 = now(), first = !p.visited[t.id];
    const roll = R.stopRoll(R.levelOf(p.xp)), got = R.addItems(p, roll);
    let xp = R.XP.stop + (first ? R.XP.newStop : 0), lines = [];
    const d = R.daily(p, 'stop', now2);
    if (d) { xp += d.xp; if (d.items) { const extra = R.addItems(p, d.items); for (const [id, n] of Object.entries(extra)) got[id] = (got[id] || 0) + n; } lines.push(d.bonus ? `7-day streak bonus! +${d.xp} XP` : `First stop today (day ${d.day} of 7) +${d.xp} XP`); }
    p.stops[t.id] = now2; p.visited[t.id] = 1; p.stats.stops++;
    const egg = Math.random() < 0.3 ? R.newEgg(p) : null, task = R.giveTask(p, t.id, now2);
    if (Math.random() < 0.25) { const g = R.addItems(p, { gift: 1 }); if (g.gift) got.gift = (got.gift || 0) + 1; }
    if (egg) lines.push(`A ${egg.km} km egg! Put it in a nest from the menu.`);
    if (task) lines.push(`New task from Ranger Rue: ${task.text}`);
    const ups = R.giveXp(p, xp); app.save(); app.refreshHud();
    await wait(450); sfx('pickup', 0.55); hx.success(); disc.classList.add('used');
    const full = Object.values(got).reduce((a, n) => a + n, 0) < Object.values(roll).reduce((a, n) => a + n, 0);
    const r = disc.getBoundingClientRect();
    for (const [id, n] of Object.entries(got)) for (let i = 0; i < Math.min(n, 3); i++) {
      const f = document.createElement('img'); f.className = 'fly'; f.src = portrait('item:' + id, 128); f.style.left = (r.left + r.width / 2 - 28) + 'px'; f.style.top = (r.top + r.height / 2 - 28) + 'px'; s.root.appendChild(f);
      const a = Math.random() * Math.PI * 2; requestAnimationFrame(() => requestAnimationFrame(() => { f.style.transform = `translate(${Math.cos(a) * 150}px, ${Math.sin(a) * 120 + 60}px) scale(1.2)`; f.style.opacity = '0'; }));
      setTimeout(() => f.remove(), 800);
    }
    s.q('.hint-line').textContent = full ? 'Your bag is full! Discard some items to make room.' : 'Come back in 5 minutes for more.';
    s.q('.loot').innerHTML = `<div class="sticker" style="padding:8px 14px;text-align:left;max-width:380px;margin:0 auto">${Object.entries(got).map(([id, n]) => `<div class="got">${img('item:' + id, '', 128)}<span>${R.ITEMS[id].name}</span><span class="x">+${n}</span></div>`).join('')}${egg ? `<div class="got">${img('egg:' + egg.km, '', 128)}<span>${egg.km} km Egg</span><span class="x">+1</span></div>` : ''}
      <div class="got" style="justify-content:center;font-family:Lilita One;font-size:20px">+${R.XP.stop} XP${first ? ` · First visit +${R.XP.newStop} XP` : ''}</div>${lines.map(l => `<div class="unlock" style="text-align:center">${l}</div>`).join('')}</div>`;
    s.after = async () => { did(app, { type: 'spin' }); await levelUps(app, ups); if (app.onStopSpun) app.onStopSpun(); };
  }
}

// ---------- nearby ----------
export function nearbyPanel(app) {
  const p = app.progress, things = app.world.things.filter(t => t.kind === 'kiki').slice(0, 9), facing = app.world.orient.facing;
  const pn = panel(`<h2>Nearby</h2>${things.length ? things.map(t => {
      const c = p.caught[t.variant.id], tr = app.tracking === t.id;
      return `<div class="list-row sticker" style="${tr ? 'background:#fff27a' : ''}">${img('kiki:' + t.variant.id, c ? '' : 'sil', 128)}<div class="grow"><div class="t">${c ? t.name : '???'}</div><div class="d"><i class="el-dot" style="background:${R.ELEMENT_COLOR[t.variant.element]}"></i> ${fmtDist(t.distance)}${t.boosted ? ' · boosted' : ''} <svg viewBox="0 0 24 24" width="16" height="16" style="vertical-align:-3px;transform:rotate(${t.bearing - facing}deg)"><path d="M12 2 21 21 12 16 3 21z" fill="#ff5d8f" stroke="#18237a" stroke-width="2" stroke-linejoin="round"/></svg>${t.distance > C.VISIBLE ? ' · rustling' : ''}</div></div><button class="mini${tr ? ' on' : ''}" data-tr="${esc(t.id)}">${tr ? 'Tracking' : 'Track'}</button></div>`;
    }).join('') : '<p>No Kikis nearby right now. Take a walk, they move around every 15 minutes!</p>'}
    <p style="font-size:14px;color:#4d5aa6">Rustling leaves on the map are Kikis that are a bit further away. Walk closer and they pop out.</p>
    <div class="stack"><button class="pill small" data-x>Close</button></div>`);
  pn.root.querySelector('[data-x]').onclick = pn.close;
  pn.root.querySelectorAll('[data-tr]').forEach(b => b.onclick = () => { app.tracking = app.tracking === b.dataset.tr ? null : b.dataset.tr; sfx('button', 0.3); hx.light(); pn.close(); nearbyPanel(app); app.refreshHud(); });
}

// ---------- your explorer's name ----------
export const cleanName = s => String(s || '').replace(/[^\p{L}\p{N} '\-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 15);
export function renameExplorer(app, onDone = () => {}) {
  const e = app.progress.explorer;
  const pn = panel(`<h2>Your name</h2><p>This is what friends, trades and leagues show.</p>
    <input class="name-input" maxlength="15" value="${esc(e.name || '')}" placeholder="Your explorer name" autocomplete="off" enterkeyhint="done">
    <div class="row"><button class="pill small cream" data-x>Cancel</button><button class="pill small" data-ok>Save</button></div>`);
  const input = pn.root.querySelector('.name-input'); setTimeout(() => input.focus(), 50);
  const save = () => {
    const n = cleanName(input.value); if (!n) { hx.warning(); input.focus(); return toast('Give your explorer a name!'); }
    e.name = n; app.save(); if (app.syncProfile) app.syncProfile(); app.refreshHud();
    sfx('pickup', 0.4); hx.success(); toast(`You're ${n} now!`); pn.close(); onDone();
  };
  pn.root.querySelector('[data-ok]').onclick = save; input.onkeydown = ev => { if (ev.key === 'Enter') save(); };
  pn.root.querySelector('[data-x]').onclick = () => { sfx('button', 0.3); pn.close(); };
}

// ---------- settings ----------
export function openSettings(app, { fromTitle = false } = {}) {
  const motionLabels = { auto: 'auto', reduced: 'reduced', full: 'full' };
  const pn = panel(`<h2>Settings</h2>
    <button class="pill small sky name-btn" data-k="name"></button>
    <div class="grid2">
    <button class="pill small cream" data-k="sound"></button>
    <button class="pill small cream" data-k="music"></button>
    <button class="pill small cream" data-k="motion"></button>
    <button class="pill small cream" data-k="ar"></button>
    <button class="pill small cream" data-k="battery"></button>
    <button class="pill small cream" data-k="units"></button></div>
    <div class="stack">
    <button class="pill small sky" data-k="account">Online account</button>
    <div class="row"><button class="pill small sky" data-k="privacy">Privacy</button><button class="pill small sky" data-k="title">Title screen</button></div>
    <button class="pill small cream" data-k="tools">Testing tools</button>
    <button class="pill small" data-k="close">Done</button></div>`);
  if (fromTitle) for (const k of ['title', 'tools']) pn.root.querySelector(`[data-k=${k}]`).remove(); // already on the title screen
  const label = () => {
    const set = (k, t) => { pn.root.querySelector(`[data-k=${k}]`).textContent = t; };
    set('name', 'Name: ' + (app.progress.explorer.name || 'Explorer') + '  ✎');
    set('sound', 'Sound: ' + (settings.get('sound', true) ? 'on' : 'off'));
    set('music', 'Music: ' + (settings.get('music', true) ? 'on' : 'off'));
    set('motion', 'Motion: ' + motionLabels[settings.get('motion', 'auto')]);
    set('ar', 'AR catches: ' + (settings.get('ar', true) ? 'on' : 'off'));
    set('battery', 'Battery saver: ' + (settings.get('battery', false) ? 'on' : 'off'));
    set('units', 'Units: ' + (settings.get('units', 'km') === 'mi' ? 'miles' : 'km'));
  };
  label();
  pn.root.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
    sfx('button', 0.35); const k = b.dataset.k;
    if (k === 'sound') app.setSound(!settings.get('sound', true));
    else if (k === 'music') { setMusic(!settings.get('music', true)); app.refreshTitle && app.refreshTitle(); }
    else if (k === 'name') { renameExplorer(app, label); return; }
    else if (k === 'motion') { const o = ['auto', 'reduced', 'full'], m = settings.get('motion', 'auto'); settings.set('motion', o[(o.indexOf(m) + 1) % 3]); }
    else if (k === 'ar') settings.set('ar', !settings.get('ar', true));
    else if (k === 'battery') { settings.set('battery', !settings.get('battery', false)); app.applyBattery(); if (settings.get('battery')) toast('Battery saver: a calmer frame rate and a lighter picture.', 3000); }
    else if (k === 'units') { settings.set('units', settings.get('units', 'km') === 'mi' ? 'km' : 'mi'); app.refreshHud(); }
    else if (k === 'privacy') { openPrivacy(); return; }
    else if (k === 'title') { pn.close(); app.goHome(); return; }
    else if (k === 'tools') { pn.close(); app.tuningPanel(); return; }
    else if (k === 'account') { pn.close(); app.open('account'); return; }
    else if (k === 'close') { pn.close(); return; }
    label();
  });
}

// ---------- the guide (Ranger Rue) for the tutorial and tips ----------
export function guide(text, buttons = [['ok', 'Next']], { light = false } = {}) {
  return new Promise(res => {
    const el = document.createElement('div'); el.className = 'guide' + (light ? ' light' : '');
    el.innerHTML = `<img class="who" src="${portrait('explorer-full:4:3', 384)}" alt=""><div class="bubble sticker"><b class="name">Ranger Rue</b>${text}<div class="row">${buttons.map(([k, l], i) => `<button class="pill small${i ? ' cream' : ''}" data-g="${k}">${l}</button>`).join('')}</div></div>`;
    $('overlay').appendChild(el); sfx('button', 0.25);
    el.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { sfx('button', 0.35); hx.light(); el.remove(); res(b.dataset.g); });
    guide.current = el;
  });
}
