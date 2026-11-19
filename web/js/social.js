// Phase 4 in the game: signing in, cloud saves, friends and gifts, trading face to face, leagues, notifications, and
// moving your explorer to another phone. Everything here is optional: offline, the game carries on and these screens
// say so. The server side is supabase/schema.sql (game data) and server/push.mjs (notifications).
import * as C from './core.js';
import * as R from './rules.js';
import { Online, snapshot, friendTier } from './online.js';
import { portrait, lookOf, encodeLook } from './art.js';
import { $, toast, panel, hx, sfx, settings, wait } from './services.js';
import { confirm, levelUps } from './ui.js';

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const kp = k => 'kiki:' + k.sp + (k.sparkle ? ':s' : '');
const face = a => portrait(`explorer:${encodeLook(lookOf(a || {}))}`, 128);
const fcolor = f => (R.FACTIONS[f] || {}).color || '#4d5aa6';
function screen(html) { const el = document.createElement('div'); el.className = 'screen-sheet'; el.innerHTML = html; $('overlay').appendChild(el); return { root: el, q: s => el.querySelector(s), close: () => el.remove() }; }
const offline = msg => toast(msg || "Can't reach the KIKI SAFARI server right now. Check your signal and try again.", 3200);

// ---------- connecting ----------
export function initOnline(app) {
  app.online = new Online();
  let upload = null;
  const save0 = app.save.bind(app);
  app.save = () => { save0(); if (app.online.signedIn) { clearTimeout(upload); upload = setTimeout(() => pushSave(app), 20000); } };
  addEventListener('visibilitychange', () => { if (document.hidden && app.online.signedIn) pushSave(app); });
  setInterval(() => { if (app.online.signedIn && !document.hidden) checkIn(app); }, 90000);
  setInterval(() => { if (app.online.signedIn && !document.hidden) refreshCircles(app); }, 60000);
  // Offline grace: everything keeps working on the phone; when the signal comes back, catch up.
  addEventListener('online', () => { if (!app.started) return; if (app.online.signedIn) { pushSave(app); checkIn(app); } else connect(app); });
}
let saveRetry = null;
async function pushSave(app) { clearTimeout(saveRetry); try { await app.online.savePut(app.progress, app.progress.savedAt || Date.now()); } catch (e) { saveRetry = setTimeout(() => pushSave(app), 120000); } }
/** Which faction holds the Rune Circles around you (they glow in its colour on the map). */
export async function refreshCircles(app) {
  const ids = app.world.things.filter(t => t.kind === 'circle').map(t => t.id).slice(0, 40); if (!ids.length) return;
  try { app.sharedCircles = await app.online.circles(ids); app.world.nextPlan = 0; } catch (e) {}
}
/** Sign in (silently) and catch up: profile, coins and messages, keepers. */
export async function connect(app) {
  const p = app.progress;
  try { await app.online.hello(p.explorer.name, avatarOf(p)); await syncProfile(app); await checkIn(app); pushSave(app); setTimeout(() => refreshCircles(app), 5000); return true; }
  catch (e) { app.online.problem = e.message; return false; }
}
/** What other players see of your explorer: the old outfit/skin (for older versions of the game) and the full look. */
const avatarOf = p => ({ outfit: p.explorer.outfit || 0, skin: p.explorer.skin ?? 1, look: lookOf(p.explorer) });
export function syncProfile(app) {
  const p = app.progress, b = p.buddy && p.kikis.find(k => k.uid === p.buddy.uid);
  return app.online.profile({ explorer: p.explorer, avatar: avatarOf(p), faction: p.faction, level: R.levelOf(p.xp), buddySp: b ? b.sp : null }).catch(() => {});
}
/** Coins from keepers who came home, and news like "your keeper was beaten". */
export async function checkIn(app) {
  try {
    const p = app.progress, box = await app.online.inbox();
    if (box.coins) { p.coins = (p.coins || 0) + box.coins; }
    for (const n of box.notes || []) {
      const v = n.kiki && C.variant(n.kiki.sp);
      if (n.kind === 'defeated') { R.callHome(p, n.circle); toast(`Your ${v ? v.name : 'Kiki'} was beaten at a Rune Circle and came home${n.coins ? ` with ${n.coins} coins` : ''}.`, 3800); }
    }
    if (box.coins || (box.notes || []).length) { app.save(); app.refreshHud(); }
  } catch (e) {}
}
async function needOnline(app) {
  if (app.online.signedIn) return true;
  toast('Connecting…', 1200); if (await connect(app)) return true;
  offline(); return false;
}
const ping = (app, to, kind) => app.online.token().then(t => fetch('/api/push/notify', { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify({ to, kind }) })).catch(() => {});

// ---------- friends and gifts ----------
export async function openFriends(app) {
  if (!await needOnline(app)) return;
  const p = app.progress, me = app.online.player;
  const s = screen(`<div class="sheet-head"><button class="pill small cream" data-x>Back</button><h2>Friends</h2></div><div class="sheet-body"><p class="empty">Loading…</p></div>`);
  s.q('[data-x]').onclick = () => { sfx('button', 0.3); s.close(); };
  const render = async () => {
    let f; try { f = await app.online.friends(); } catch (e) { s.q('.sheet-body').innerHTML = `<p class="empty sticker">${esc(e.message)}</p>`; return; }
    const gifts = p.items.gift || 0;
    s.q('.sheet-body').innerHTML = `
      <div class="sticker code-card"><div class="d">Your friend code</div><div class="code">${me.friend_code.replace(/(\d{4})(\d{4})/, '$1 $2')}</div><div class="d">Share it with people you know. Friends can send each other gifts.</div>
        <div class="row" style="margin-top:8px"><input class="search" style="margin:0;max-width:200px;text-align:center" inputmode="numeric" maxlength="9" placeholder="Their code"><button class="pill small" data-add>Add</button></div></div>
      <div class="row" style="margin:12px 0"><button class="pill small sky" data-trade>Trade in person</button><button class="pill small" data-league>Leagues</button></div>
      ${f.gifts.length ? `<h3 class="sub">Gifts for you</h3>${f.gifts.map(g => `<div class="list-row sticker">${portrait ? `<img src="${portrait('item:rune', 96)}" alt="">` : ''}<div class="grow"><div class="t">From ${esc(g.from)}</div><div class="d">${new Date(g.created).toLocaleDateString()}</div></div><button class="pill small" data-open="${g.id}">Open</button></div>`).join('')}` : ''}
      ${f.requests.length ? `<h3 class="sub">Friend requests</h3>${f.requests.map(r => `<div class="list-row sticker"><img src="${face(r.avatar)}" alt=""><div class="grow"><div class="t">${esc(r.name)}</div><div class="d">Level ${r.level}</div></div><button class="mini" data-yes="${r.id}">Accept</button><button class="mini" data-no="${r.id}">No</button></div>`).join('')}` : ''}
      <h3 class="sub">Friends <span class="d">(${f.friends.length}) · you have ${gifts} Gift${gifts === 1 ? '' : 's'} to send</span></h3>
      ${f.friends.length ? f.friends.map(fr => `<div class="list-row sticker" style="border-color:${fcolor(fr.faction)}"><img src="${face(fr.avatar)}" alt=""><div class="grow"><div class="t">${esc(fr.name)}</div><div class="d">Level ${fr.level} · ${friendTier(fr.days)}${fr.buddy ? ' · buddy: ' + esc(C.variant(fr.buddy).name) : ''}</div></div>
        ${fr.sent_today ? '<span class="d">Gift sent today</span>' : `<button class="mini" data-gift="${fr.id}" ${gifts ? '' : 'disabled'}>Send gift</button>`}<button class="mini" data-rm="${fr.id}" aria-label="Remove friend">✕</button></div>`).join('')
        : '<p class="empty sticker">No friends yet. Swap codes with someone you know!</p>'}`;
    const q = sel => s.root.querySelectorAll(sel);
    s.q('[data-add]').onclick = async () => {
      const code = s.q('.search').value.replace(/\D/g, ''); if (code.length !== 8) return toast('Friend codes have 8 numbers.');
      try { const r = await app.online.friendAdd(code); toast({ requested: 'Friend request sent!', friends: "You're friends now!", already: 'Already friends.' }[r]); hx.success(); render(); } catch (e) { hx.warning(); toast(e.message); }
    };
    s.q('[data-trade]').onclick = () => { s.close(); openTrade(app); };
    s.q('[data-league]').onclick = () => { s.close(); openLeagues(app); };
    q('[data-yes]').forEach(b => b.onclick = async () => { await app.online.friendAnswer(b.dataset.yes, true).catch(e => toast(e.message)); sfx('pickup', 0.4); render(); });
    q('[data-no]').forEach(b => b.onclick = async () => { await app.online.friendAnswer(b.dataset.no, false).catch(e => toast(e.message)); render(); });
    q('[data-rm]').forEach(b => b.onclick = async () => { if (await confirm('Remove this friend?', 'Remove')) { await app.online.friendRemove(b.dataset.rm).catch(e => toast(e.message)); render(); } });
    q('[data-gift]').forEach(b => b.onclick = async () => {
      if (!R.useItem(p, 'gift')) return toast('You need a Gift. Supply stops give them sometimes.');
      const items = giftContents(p);
      try { const days = await app.online.giftSend(b.dataset.gift, items); app.save(); sfx('pickup', 0.5); hx.success(); toast(`Gift sent! (${friendTier(days)})`); ping(app, b.dataset.gift, 'gift'); app.did({ type: 'gift' }); render(); }
      catch (e) { R.addItems(p, { gift: 1 }, true); app.save(); toast(e.message); }
    });
    q('[data-open]').forEach(b => b.onclick = async () => {
      let items; try { items = await app.online.giftOpen(+b.dataset.open); } catch (e) { return toast(e.message); }
      if (!items) return render();
      const { egg, ...rest } = items, got = R.addItems(p, rest), lines = Object.entries(got).map(([id, n]) => `${n} ${n > 1 ? R.ITEMS[id].plural : R.ITEMS[id].name}`);
      if (egg && p.eggs.length < R.EGG_MAX) { const pool = R.eggPool(5), e = { id: p.nextUid++, km: 5, sp: pool[Math.floor(Math.random() * pool.length)].id, walked: 0 }; p.eggs.push(e); lines.push('a 5 km egg'); }
      const ups = R.giveXp(p, 200); app.save(); sfx('burst', 0.45); hx.success(); toast('Gift: ' + (lines.join(', ') || 'your bag is full!'), 3200); await levelUps(app, ups); render();
    });
  };
  render();
}
/** What's in a gift you send: a few useful items, and sometimes an egg. */
function giftContents(p) {
  const L = R.levelOf(p.xp), pool = ['rune', 'rune', 'honey', ...(L >= 5 ? ['stitch', 'moon'] : [])], out = {};
  const n = 2 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) { const id = pool[Math.floor(Math.random() * pool.length)]; out[id] = Math.min(4, (out[id] || 0) + 1); }
  if (Math.random() < 0.25) out.egg = 1;
  return out;
}

// ---------- trading in person ----------
export async function openTrade(app) {
  if (!await needOnline(app)) return;
  if (!app.loc.fix) return toast('Waiting for your location…');
  const p = app.progress, s = screen(`<div class="sheet-head"><button class="pill small cream" data-x>Close</button><h2>Trade</h2></div><div class="sheet-body" style="text-align:center"></div>`);
  let code = null, timer = null, done = false;
  const stop = () => { clearInterval(timer); timer = null; };
  s.q('[data-x]').onclick = async () => { stop(); if (code && !done) app.online.tradeCancel(code).catch(() => {}); s.close(); };
  const body = s.q('.sheet-body');
  body.innerHTML = `<p class="sticker" style="padding:10px">Trade a Kiki with someone standing next to you (within 100 m). One of you starts a trade and reads out the code; the other joins with it. Trading costs 100 Sprouts.</p>
    <div class="stack"><button class="pill" data-host>Start a trade</button><div class="row"><input class="search" style="margin:0;max-width:140px;text-align:center;font-size:24px" inputmode="numeric" maxlength="4" placeholder="Code"><button class="pill small sky" data-join>Join</button></div></div>`;
  const watch = () => { stop(); timer = setInterval(async () => { try { show(await app.online.tradeGet(code)); } catch (e) { stop(); toast(e.message); } }, 2000); };
  s.q('[data-host]').onclick = async () => { try { code = await app.online.tradeOpen(app.loc.fix); sfx('button', 0.4); show({ code, status: 'open', side: 'host' }); watch(); } catch (e) { toast(e.message); } };
  s.q('[data-join]').onclick = async () => { const c = s.q('.search').value.replace(/\D/g, ''); if (c.length !== 4) return toast('Trade codes have 4 numbers.'); try { code = c; show(await app.online.tradeJoin(c, app.loc.fix)); watch(); } catch (e) { code = null; hx.warning(); toast(e.message, 3200); } };
  const card = (k, title) => k ? `<div class="card sticker" style="width:150px;margin:0 auto"><div class="no">${title}</div><img src="${portrait(kp(k), 160)}" alt=""><div class="pw">POWER ${R.power(k)}</div><div class="nm">${esc(k.nick || C.variant(k.sp).name)}${k.sparkle ? ' ✦' : ''}</div></div>` : `<div class="card sticker unknown" style="width:150px;margin:0 auto"><div class="no">${title}</div><div class="empty-nest">not picked yet</div></div>`;
  function show(t) {
    if (done) return;
    if (t.status === 'cancelled') { stop(); body.innerHTML = '<p class="empty sticker">The trade was cancelled.</p>'; return; }
    if (t.status === 'done') { stop(); finish(t); return; }
    if (!t.partner) { body.innerHTML = `<p>Your trade code</p><div class="code big">${t.code}</div><p class="d">Waiting for your partner to join…</p>`; return; }
    const mine = t.mine, theirs = t.theirs;
    body.innerHTML = `<p>Trading with <b>${esc(t.partner.name)}</b> (level ${t.partner.level})</p>
      <div class="row" style="align-items:flex-start">${card(mine, 'You give')}<div style="font-size:36px;align-self:center">⇄</div>${card(theirs, 'You get')}</div>
      <div class="stack"><button class="pill small cream" data-pick>${mine ? 'Change my Kiki' : 'Pick a Kiki to give'}</button>
      ${mine && theirs ? `<button class="pill" data-ok ${t.my_ok ? 'disabled' : ''}>${t.my_ok ? 'Waiting for them…' : 'Confirm trade'}</button>` : ''}</div>
      ${t.their_ok ? '<p class="d">They confirmed!</p>' : ''}`;
    body.querySelector('[data-pick]').onclick = () => import('./ui.js').then(({ openKikis }) => openKikis(app, async k => {
      try { show(await app.online.tradeOffer(code, snapshot(k))); app.tradeUid = k.uid; } catch (e) { toast(e.message); }
    }, 'Pick a Kiki to trade', k => !k.fav && !k.keeping && !(p.buddy && p.buddy.uid === k.uid)));
    const ok = body.querySelector('[data-ok]'); if (ok) ok.onclick = async () => {
      if (p.sprouts < 100) return toast('Trading costs 100 Sprouts.');
      try { show(await app.online.tradeConfirm(code)); } catch (e) { toast(e.message); }
    };
  }
  function finish(t) {
    done = true; p.tradesDone = p.tradesDone || {};
    const key = code + ':' + t.side; if (p.tradesDone[key]) return;
    const gone = p.kikis.find(k => k.uid === app.tradeUid && k.sp === t.mine.sp && k.lvl === t.mine.lvl);
    if (gone) p.kikis = p.kikis.filter(k => k !== gone);
    const k = R.addKiki(p, { ...t.theirs, iv: t.theirs.iv }, Math.floor(Date.now() / 1000), 'Traded with ' + t.partner.name);
    k.nick = t.theirs.nick || ''; p.sprouts = Math.max(0, p.sprouts - 100); p.tradesDone[key] = 1; p.stats.trades = (p.stats.trades || 0) + 1;
    const ups = R.giveXp(p, 500); app.save(); sfx('burst', 0.55); hx.success();
    body.innerHTML = `<h2 style="color:#7a00ff">Trade complete!</h2>${card(k, 'Your new Kiki')}<p>+500 XP</p>`;
    app.did({ type: 'trade' }); levelUps(app, ups);
  }
}

// ---------- leagues ----------
export const LEAGUES = [['sprout', 'Sprout League', 500, 'Kikis up to 500 power'], ['bloom', 'Bloom League', 1500, 'Kikis up to 1,500 power'], ['open', 'Open League', Infinity, 'Any Kikis']];
export async function openLeagues(app) {
  if (!await needOnline(app)) return;
  if (R.levelOf(app.progress.xp) < R.BATTLE_LEVEL) return toast(`Leagues open at explorer level ${R.BATTLE_LEVEL}.`);
  const p = app.progress; p.leagues = p.leagues || {};
  const s = screen(`<div class="sheet-head"><button class="pill small cream" data-x>Back</button><h2>Leagues</h2></div><div class="sheet-body"></div>`);
  s.q('[data-x]').onclick = () => { sfx('button', 0.3); s.close(); };
  const render = () => {
    s.q('.sheet-body').innerHTML = `<p class="sticker" style="padding:8px 12px;text-align:center;font-weight:500">Battle other explorers' teams (the game plays them). Win to climb the ladder. League battles don't hurt your Kikis.</p>` +
      LEAGUES.map(([id, name, cap, what]) => { const team = (p.leagues[id] || []).map(uid => p.kikis.find(k => k.uid === uid)).filter(Boolean);
        return `<div class="sticker league"><div class="t">${name}</div><div class="d">${what}</div><div class="keepers">${team.map(k => `<div><img src="${portrait(kp(k), 128)}" alt=""><span>${R.power(k)}</span></div>`).join('') || '<span class="d">No team yet</span>'}</div>
        <div class="row"><button class="mini" data-team="${id}">${team.length ? 'Change team' : 'Pick a team'}</button>${team.length ? `<button class="pill small" data-fight="${id}">Battle!</button><button class="mini" data-top="${id}">Ladder</button>` : ''}</div></div>`; }).join('');
    s.root.querySelectorAll('[data-team]').forEach(b => b.onclick = async () => {
      const [id, , cap] = LEAGUES.find(l => l[0] === b.dataset.team);
      const { chooseTeam } = await import('./battle.js');
      const team = await chooseTeam(app, 3, LEAGUES.find(l => l[0] === id)[1], k => R.power(k) <= cap, true); if (!team) return;
      try { await app.online.leagueTeam(id, team.map(snapshot)); p.leagues[id] = team.map(k => k.uid); app.save(); toast('Team saved!'); render(); } catch (e) { toast(e.message); }
    });
    s.root.querySelectorAll('[data-fight]').forEach(b => b.onclick = () => leagueBattle(app, b.dataset.fight, render));
    s.root.querySelectorAll('[data-top]').forEach(b => b.onclick = () => ladder(app, b.dataset.top));
  };
  render();
}
async function leagueBattle(app, id, after) {
  const p = app.progress, team = (p.leagues[id] || []).map(uid => p.kikis.find(k => k.uid === uid)).filter(Boolean);
  if (!team.length) return toast('Pick a team first.');
  let opp; try { opp = await app.online.leagueMatch(id); } catch (e) { return toast(e.message); }
  if (!opp) { // nobody else in this league yet: a practice team around your level
    const lvl = Math.round(team.reduce((a, k) => a + k.lvl, 0) / team.length), pool = C.VARIANTS.filter(v => v.weight > 0 && v.rarity !== 'Legendary'), cap = LEAGUES.find(l => l[0] === id)[2];
    const bots = []; for (let i = 0; i < 3; i++) { let k; for (let tries = 0; tries < 20; tries++) { k = R.rollKiki(pool[Math.floor(Math.random() * pool.length)].id, lvl); if (R.power(k) <= cap) break; } bots.push(k); }
    opp = { name: 'Ranger Rue', team: bots };
  }
  const { runBattle } = await import('./battle.js');
  await guide(app, `<b>${esc(opp.name)}</b>${opp.rating ? ` (rating ${opp.rating})` : ''} accepts your challenge!`);
  const { result } = await runBattle(app, { mine: team.map(k => R.fighter(k, { full: true })), theirs: opp.team.map((k, i) => R.fighter({ uid: -1 - i, ...k }, { full: true })), title: `${LEAGUES.find(l => l[0] === id)[1]} · vs ${opp.name}`, time: 120 });
  const win = result === 'win';
  try { const r = await app.online.leagueResult(win); toast(`${win ? 'You won!' : 'You lost this one.'} Rating ${r}`, 3000); } catch (e) {}
  if (win) { p.stats.wins = (p.stats.wins || 0) + 1; const ups = R.giveXp(p, 400); app.save(); app.did({ type: 'battle' }); await levelUps(app, ups); }
  after();
}
const guide = (app, html) => import('./ui.js').then(({ guide }) => guide(html, [['ok', "Let's go!"]]));
async function ladder(app, id) {
  let t; try { t = await app.online.leagueTop(id); } catch (e) { return toast(e.message); }
  const pn = panel(`<h2>${LEAGUES.find(l => l[0] === id)[1]}</h2>${t.top.map((r, i) => `<div class="list-row sticker" style="${r.me ? 'background:#fff27a' : ''}"><b class="n" style="width:36px">${i + 1}</b><div class="grow"><div class="t" style="color:${fcolor(r.faction)}">${esc(r.name)}</div><div class="d">${r.wins} wins · ${r.losses} losses</div></div><b>${r.rating}</b></div>`).join('')}
    ${t.me ? `<p>You: <b>#${t.me.rank}</b> · rating ${t.me.rating}</p>` : ''}<div class="stack"><button class="pill small" data-x>Close</button></div>`);
  pn.root.querySelector('[data-x]').onclick = pn.close;
}

// ---------- account: moving phones, notifications, deleting ----------
export function openAccount(app) {
  const o = app.online, me = o.player;
  const pn = panel(`<h2>Online account</h2>
    <p class="d">${me ? `Signed in as <b>${esc(me.name)}</b> · friend code ${me.friend_code}` : 'Not connected right now.'}<br>No email needed: your account lives on this phone, and your progress is backed up online.</p>
    <div class="stack">
      <button class="pill small sky" data-move>Move to another phone</button>
      <button class="pill small cream" data-claim>I have a moving code</button>
      <button class="pill small cream" data-push>Notifications: ${settings.get('push', false) ? 'on' : 'off'}</button>
      <button class="pill small pink" data-del>Delete my online account</button>
      <button class="pill small" data-x>Close</button></div>`);
  const q = s => pn.root.querySelector(s);
  q('[data-x]').onclick = pn.close;
  q('[data-move]').onclick = async () => {
    if (!await needOnline(app)) return;
    try { await pushSave(app); const code = await o.linkCode(); pn.close(); const p2 = panel(`<h2>Your moving code</h2><div class="code big">${code}</div><p>On your new phone, open KIKI SAFARI, go to Settings ▸ Online account ▸ "I have a moving code", and type this in. It works once, for 15 minutes. Don't share it with anyone else.</p><div class="stack"><button class="pill small" data-x>Done</button></div>`); p2.root.querySelector('[data-x]').onclick = p2.close; }
    catch (e) { toast(e.message); }
  };
  q('[data-claim]').onclick = async () => {
    pn.close();
    const p2 = panel(`<h2>Moving code</h2><input class="name-input" maxlength="9" autocapitalize="characters" placeholder="ABCD2345"><p class="d">This replaces the progress on this phone with your other phone's.</p><div class="stack"><button class="pill" data-ok>Move here</button><button class="pill small cream" data-no>Cancel</button></div>`);
    p2.root.querySelector('[data-no]').onclick = p2.close;
    p2.root.querySelector('[data-ok]').onclick = async () => {
      const code = p2.root.querySelector('input').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (code.length !== 8) return toast('Moving codes have 8 letters and numbers.');
      try { await o.token(); const r = await o.linkClaim(code); if (r.save && r.save.data) localStorage.setItem('kiki-safari-progress', JSON.stringify(r.save.data)); toast('Welcome back, ' + r.name + '!'); await wait(900); location.reload(); }
      catch (e) { hx.warning(); toast(e.message, 3200); }
    };
  };
  q('[data-push]').onclick = async () => { const on = !settings.get('push', false); const ok = on ? await enablePush(app) : await disablePush(app); if (ok) { settings.set('push', on); q('[data-push]').textContent = 'Notifications: ' + (on ? 'on' : 'off'); } };
  q('[data-del]').onclick = async () => {
    if (!await confirm('Delete your online account? Friends, circles you keep and your online backup are removed. Your progress on this phone stays.', 'Delete')) return;
    try { await o.deleteMe(); localStorage.removeItem('kiki-online'); o.session = null; o.player = null; pn.close(); toast('Online account deleted.'); } catch (e) { toast(e.message); }
  };
}
const b64 = s => { const pad = '='.repeat((4 - s.length % 4) % 4), raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...raw].map(c => c.charCodeAt(0))); };
async function enablePush(app) {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent), standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) { toast(ios && !standalone ? 'On iPhone, add KIKI SAFARI to your Home Screen first (Share ▸ Add to Home Screen), then turn this on from there.' : "This browser can't do notifications.", 4200); return false; }
  if (!await needOnline(app)) return false;
  if (await Notification.requestPermission() !== 'granted') { toast('Notifications are blocked. You can allow them in your phone settings.'); return false; }
  try {
    const reg = await navigator.serviceWorker.ready, { publicKey } = await (await fetch('/api/push/key')).json();
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(publicKey) });
    const r = await fetch('/api/push/subscribe', { method: 'POST', headers: { Authorization: 'Bearer ' + await app.online.token(), 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON(), surge: true }) });
    if (!r.ok) throw new Error('subscribe failed');
    toast("Notifications on: gifts, friend requests and Portal Surge reminders.", 3200); return true;
  } catch (e) { toast("Couldn't turn on notifications right now."); return false; }
}
async function disablePush(app) {
  try { const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription(); if (sub) await sub.unsubscribe(); await fetch('/api/push/subscribe', { method: 'POST', headers: { Authorization: 'Bearer ' + await app.online.token(), 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: null }) }); } catch (e) {}
  return true;
}
