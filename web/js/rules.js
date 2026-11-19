// Phase 1 rules (docs/ROADMAP.md): explorer level and XP, the bag and its items, individual Kikis with Plush Power,
// size and hidden stats, powering up, evolving and sending home, catch and run-away odds, supply stop rewards, daily
// streaks, and the save format. Plain JavaScript with no DOM, tested in node: node test/core.test.mjs
import { RARITY, VARIANTS, variant, rng, hash, sysRng, quality, isNight } from './core.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// ---------- explorer level ----------
export const MAX_LEVEL = 40;
/** Total XP needed to reach a level: 1,000 for level 2, 3,000 for 3, 6,000 for 4, 10,000 for 5… */
export const xpFor = level => 500 * level * (level - 1);
export function levelOf(xp) { let L = 1; while (L < MAX_LEVEL && xp >= xpFor(L + 1)) L++; return L; }
export const XP = { catch: 100, Nice: 10, Great: 50, Excellent: 100, spin: 10, newSpecies: 500, stop: 50, newStop: 250, evolve: 500, daily: 500, streak: 2500 };
/** Items you get for reaching a level. Better stones and treats unlock along the way (battle supplies from level 5). */
let levelRewardsImpl = null;
export const levelRewards = L => levelRewardsImpl ? levelRewardsImpl(L) : baseLevelRewards(L);
function baseLevelRewards(L) {
  const r = { rune: L < 10 ? 15 : 20 };
  if (L >= 2) r.honey = L < 10 ? 5 : 10;
  if (L >= 5) r.moon = L === 5 ? 15 : 10;
  if (L >= 6) r.sunseed = L === 6 ? 5 : 3;
  if (L >= 10) r.star = L === 10 ? 15 : 10;
  return r;
}

// ---------- items ----------
export const ITEMS = {
  rune: { plural: 'Rune Stones', name: 'Rune Stone', kind: 'stone', catch: 1, unlock: 1, blurb: "A river stone carved with Kiki's spiral. Throw it and its portal pulls a Kiki inside." },
  moon: { plural: 'Moon Stones', name: 'Moon Stone', kind: 'stone', catch: 1.5, unlock: 5, blurb: 'Charged under a full moon. Its portal pulls harder than a Rune Stone.' },
  star: { plural: 'Star Stones', name: 'Star Stone', kind: 'stone', catch: 2, unlock: 10, blurb: 'A sliver of a fallen star. The strongest pull of all.' },
  honey: { plural: 'Honey Leaves', name: 'Honey Leaf', kind: 'treat', catch: 1.5, unlock: 2, blurb: 'A sticky-sweet leaf. A Kiki that eats one is easier to catch on your next throw.' },
  sunseed: { plural: 'Sun Seeds', name: 'Sun Seed', kind: 'treat', fluff: 2, unlock: 6, blurb: 'A seed full of sunshine. Catch a Kiki that ate one and you get double Fluff.' },
};
export const STONES = ['rune', 'moon', 'star'], TREATS = ['honey', 'sunseed'];
export const BAG_MAX = 250, KIKI_MAX = 200;
export const bagCount = p => Object.values(p.items).reduce((a, n) => a + n, 0);
/** Add items as far as the bag has room; returns what actually went in. */
export function addItems(p, items, ignoreLimit = false) {
  const got = {}; let room = ignoreLimit ? Infinity : BAG_MAX - bagCount(p);
  for (const [id, n] of Object.entries(items)) { const k = Math.max(0, Math.min(n, room)); if (!k) continue; p.items[id] = (p.items[id] || 0) + k; got[id] = k; room -= k; }
  return got;
}
export function useItem(p, id) { if (!(p.items[id] > 0)) return false; p.items[id]--; return true; }

// ---------- species helpers ----------
export const SPECIES = [...VARIANTS].sort((a, b) => a.no - b.no);
export const fluffName = family => variant(family).name.replace(' Kiki', '') + ' Fluff';
export const familyOf = id => variant(id).family || id;
export const STATS = ['Cuddle', 'Bounce', 'Zest'];

// ---------- individual Kikis ----------
export const levelMult = lvl => 0.25 + 0.075 * lvl;
/** Plush Power: how strong a Kiki is. Grows with level, species and hidden stats. */
export function power(k) { const v = variant(k.sp); return Math.max(10, Math.round(v.base * levelMult(k.lvl) * (1 + (k.iv[0] + k.iv[1] + k.iv[2]) / 90))); }
/** Hidden stats (0–15 each), level and size, from a random source. Wild ones use a seed so they look the same each time. */
export function rollKiki(sp, lvl, r = sysRng) {
  const v = variant(sp), iv = [r.int(0, 16), r.int(0, 16), r.int(0, 16)];
  const z = (r.next() + r.next() + r.next() - 1.5) / 0.5, hm = clamp(1 + 0.12 * z, 0.6, 1.4), wm = hm * hm * (0.9 + 0.2 * r.next());
  return { sp, lvl, iv, h: Math.round(v.cm * hm * 10) / 10, w: Math.round(v.kg * wm * 100) / 100, size: hm < 0.82 ? 'XS' : hm > 1.18 ? 'XL' : '' };
}
/** A wild Kiki's level: up to your explorer level (max 30). */
export function wildKiki(spawnId, sp, explorerLevel, { boosted = false, sparkleOdds = SPARKLE_ODDS } = {}) {
  const r = rng(hash(spawnId, 'stats')), lvl = 1 + r.int(0, Math.min(30, explorerLevel)) + (boosted ? BOOST_LEVELS : 0);
  const k = rollKiki(sp, lvl, r); if (isSparkle(spawnId, sparkleOdds)) k.sparkle = true; if (boosted) k.boosted = true;
  return k;
}
/** Stars from the hidden stats: 0 to 3 (and a perfect 45 gets a crown). */
export function appraise(k) { const t = k.iv[0] + k.iv[1] + k.iv[2]; return { total: t, stars: t >= 40 ? 3 : t >= 30 ? 2 : t >= 20 ? 1 : 0, perfect: t === 45 }; }
export const maxKikiLevel = explorerLevel => Math.min(MAX_LEVEL, explorerLevel + 2);
export const powerUpCost = lvl => ({ sprouts: 200 + 200 * Math.floor((lvl - 1) / 4), fluff: lvl < 10 ? 1 : lvl < 20 ? 2 : lvl < 30 ? 3 : 4 });
export function canPowerUp(p, k) {
  const c = powerUpCost(k.lvl), f = p.fluff[familyOf(k.sp)] || 0;
  if (k.lvl >= maxKikiLevel(levelOf(p.xp))) return { ok: false, why: `Reach explorer level ${k.lvl - 1} to power it up further.` };
  if (p.sprouts < c.sprouts) return { ok: false, why: `Needs ${c.sprouts} Sprouts.` };
  if (f < c.fluff) return { ok: false, why: `Needs ${c.fluff} ${fluffName(familyOf(k.sp))}.` };
  return { ok: true, cost: c };
}
export function powerUp(p, k) {
  const c = canPowerUp(p, k); if (!c.ok) return false;
  p.sprouts -= c.cost.sprouts; p.fluff[familyOf(k.sp)] -= c.cost.fluff; k.lvl++; return true;
}
export function canEvolve(p, k) {
  const v = variant(k.sp); if (!v.evolvesTo) return { ok: false, why: "This Kiki doesn't evolve." };
  const f = p.fluff[familyOf(k.sp)] || 0;
  if (f < v.cost) return { ok: false, why: `Needs ${v.cost} ${fluffName(familyOf(k.sp))} (you have ${f}).`, cost: v.cost };
  return { ok: true, cost: v.cost, to: v.evolvesTo };
}
/** Evolve in place: same level and hidden stats, new species. Returns {from, to, xp, first}. */
export function evolve(p, k) {
  const c = canEvolve(p, k); if (!c.ok) return null;
  const from = variant(k.sp), to = variant(c.to);
  p.fluff[familyOf(k.sp)] -= c.cost;
  k.h = Math.round(k.h / from.cm * to.cm * 10) / 10; k.w = Math.round(k.w / from.kg * to.kg * 100) / 100; k.sp = to.id;
  const first = !p.caught[to.id]; p.caught[to.id] = (p.caught[to.id] || 0) + 1; p.seen[to.id] = Math.max(1, p.seen[to.id] || 0);
  const xp = XP.evolve + (first ? XP.newSpecies : 0);
  return { from, to, xp, first };
}
/** Send a Kiki home to the ranger for 1 Fluff. Favourites stay. */
export function sendHome(p, uid) {
  const i = p.kikis.findIndex(k => k.uid === uid); if (i < 0 || p.kikis[i].fav || p.kikis[i].keeping) return false;
  const [k] = p.kikis.splice(i, 1), fam = familyOf(k.sp); p.fluff[fam] = (p.fluff[fam] || 0) + 1; return true;
}

// ---------- catching ----------
export const FLUFF = { Common: 3, Rare: 5, Epic: 5, Legendary: 10 };
export const FLEE = { Common: 0.1, Rare: 0.12, Epic: 0.15, Legendary: 0.1 };
const QMULT = { Nice: 1.3, Great: 1.6, Excellent: 2.0 };
/**
 * Catch odds. Higher-level Kikis are harder; better stones, Honey Leaves, smaller rings and spin all help.
 * Bonuses stack the way odds do (1 − (1 − base)^bonus), so they help a lot on hard Kikis and never pass 98%.
 */
export function catchOdds(rarity, lvl, { stone = 'rune', treat = null, q = null, spin = false, odds = 1 } = {}) {
  const base = clamp(RARITY[rarity].chance * clamp(1.15 - 0.015 * lvl, 0.55, 1.15), 0.01, 0.95);
  const m = (ITEMS[stone] ? ITEMS[stone].catch : 1) * (treat && ITEMS[treat].catch ? ITEMS[treat].catch : 1) * (QMULT[q] || 1) * (spin ? 1.3 : 1) * odds;
  return clamp(1 - Math.pow(1 - base, m), 0.02, 0.98);
}
/** Ring colour from the odds before the throw: green, yellow, orange, red. */
export const ringColor = chance => chance >= 0.6 ? '#5fd34b' : chance >= 0.35 ? '#ffd23f' : chance >= 0.18 ? '#ff9a2e' : '#ff4d4d';
/** {result: 'caught'|'brokeout'|'fled'|'missed', wobbles, quality, spin} */
export function resolveCatch(rarity, lvl, t, r = sysRng) {
  if (!t.hit) return { result: 'missed', wobbles: 0, quality: null, spin: t.spin };
  const q = quality(t.ring), n = RARITY[rarity].wobbles;
  const chance = t.guaranteed ? 1 : catchOdds(rarity, lvl, { stone: t.stone, treat: t.treat, q, spin: t.spin, odds: t.odds });
  if (r.next() < chance) return { result: 'caught', wobbles: n, quality: q, spin: t.spin, chance };
  const fled = !t.noFlee && r.next() < FLEE[rarity];
  return { result: fled ? 'fled' : 'brokeout', wobbles: r.int(0, n + 1), quality: q, spin: t.spin, chance };
}
/** Rewards for a catch: XP lines, Sprouts and Fluff. */
export function catchRewards(p, sp, { quality: q = null, spin = false, treat = null } = {}) {
  const v = variant(sp), first = !p.caught[sp], xp = [['Catch', XP.catch]];
  if (q) xp.push([q + ' throw', XP[q]]);
  if (spin) xp.push(['Spin bonus', XP.spin]);
  if (first) xp.push(['New in your Safari Log!', XP.newSpecies]);
  const fluff = FLUFF[v.rarity] * (treat && ITEMS[treat].fluff ? ITEMS[treat].fluff : 1);
  return { xp, xpTotal: xp.reduce((a, l) => a + l[1], 0), sprouts: RARITY[v.rarity].reward, fluff, family: familyOf(sp), first };
}

// ---------- supply stops ----------
export const STOP_COOLDOWN = 5 * 60;
/** 3 to 5 items; better stones and treats once you've unlocked them. */
export function stopRoll(level, r = sysRng) {
  const table = [['rune', 60], ['honey', 20], ['moon', 25], ['sunseed', 8], ['star', 12], ['stitch', 18], ['superstitch', 6], ['pillow', 6]].filter(([id]) => ITEMS[id] && level >= ITEMS[id].unlock);
  const total = table.reduce((a, t) => a + t[1], 0), n = 3 + r.int(0, 3), out = {};
  for (let i = 0; i < n; i++) { let x = r.next() * total; for (const [id, w] of table) { if ((x -= w) < 0) { out[id] = (out[id] || 0) + 1; break; } } }
  return out;
}

// ---------- daily streaks (first catch and first stop of the day) ----------
export function dayKey(sec) { const d = new Date(sec * 1000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
const yesterday = sec => { const d = new Date(sec * 1000); d.setDate(d.getDate() - 1); return dayKey(d.getTime() / 1000); };
/** Mark today's first catch or stop. Returns null if already done today, else {day (1–7), xp, sprouts, bonus}. */
export function daily(p, kind, now) {
  const d = p.daily[kind] || (p.daily[kind] = { last: '', streak: 0 }), today = dayKey(now);
  if (d.last === today) return null;
  d.streak = d.last === yesterday(now) && d.streak < 7 ? d.streak + 1 : 1; d.last = today;
  const bonus = d.streak === 7;
  return { day: d.streak, bonus, xp: bonus ? XP.streak : XP.daily, sprouts: kind === 'catch' ? (bonus ? 1600 : 300) : 0, items: kind === 'stop' && bonus ? { rune: 10, honey: 5 } : null };
}
/** Days in a row for a streak, as of now (0 if it lapsed). */
export function streakNow(p, kind, now) { const d = p.daily[kind]; if (!d || !d.last) return 0; return d.last === dayKey(now) || d.last === yesterday(now) ? d.streak : 0; }

// ---------- the save ----------
export function newSave() {
  return {
    v: 2, xp: 0, sprouts: 0, items: { rune: 30, moon: 0, star: 0, honey: 0, sunseed: 0 }, fluff: {}, kikis: [], nextUid: 1,
    caught: {}, seen: {}, stops: {}, visited: {}, keepers: {}, gone: {}, daily: {},
    explorer: { name: '', outfit: 0, skin: 1 }, tutorial: 'start', stats: { throws: 0, catches: 0, fled: 0, km: 0, stops: 0, evolved: 0, excellent: 0, hatched: 0, sparkles: 0, buddyKm: 0, tasks: 0, el: {}, wins: 0, raids: 0 },
    // Phase 2
    eggs: [], nests: [{ id: 'warm', uses: -1, egg: null }], buddy: null, tasks: [], stamps: { last: '', n: 0 }, story: { ch: 0, prog: [] }, medals: {},
    // Phase 3
    faction: null, raidDay: '', raidsDone: {},
  };
}
/** Add a caught Kiki to the collection. */
export function addKiki(p, rec, now, place = '') {
  const k = { uid: p.nextUid++, ...rec, at: now, place, nick: '', fav: false };
  p.kikis.push(k); p.caught[k.sp] = (p.caught[k.sp] || 0) + 1; p.seen[k.sp] = Math.max(1, p.seen[k.sp] || 0); p.stats.catches++;
  const el = variant(k.sp).element; p.stats.el[el] = (p.stats.el[el] || 0) + 1; if (k.sparkle) p.stats.sparkles++;
  return k;
}
/** Give XP; returns the levels reached (each gets its rewards). */
export function giveXp(p, n) {
  const before = levelOf(p.xp); p.xp += n; const after = levelOf(p.xp), ups = [];
  for (let L = before + 1; L <= after; L++) {
    const items = levelRewards(L); addItems(p, items, true);
    const nest = L % 3 === 0; if (nest && p.nests) p.nests.push({ id: 'cozy' + p.nextUid++, uses: NEST_USES, egg: null }); // a Cozy Nest every 3 levels
    ups.push({ level: L, items, nest, unlocks: Object.keys(ITEMS).filter(id => ITEMS[id].unlock === L) });
  }
  return ups;
}
/** Caught and run-away spawns stay gone for you until they would have despawned anyway. */
export function markGone(p, id, now) { p.gone[id] = now + 45 * 60; }
export function goneSet(p, now) { for (const [id, t] of Object.entries(p.gone)) if (t < now) delete p.gone[id]; return new Set(Object.keys(p.gone)); }

/** Load any save: fills in new fields, and turns a version 1 save (before Phase 1) into the new format. */
export function migrate(raw, now = Math.floor(Date.now() / 1000)) {
  const s = newSave();
  if (!raw || typeof raw !== 'object') return s;
  if (raw.v === 2) {
    const out = Object.assign(s, raw);
    for (const k of ['items', 'stats', 'explorer', 'stamps', 'story']) out[k] = Object.assign(newSave()[k], raw[k]);
    for (const k of ['fluff', 'caught', 'seen', 'stops', 'visited', 'keepers', 'gone', 'daily', 'medals', 'raidsDone']) out[k] = raw[k] || {};
    for (const k of ['kikis', 'eggs', 'tasks']) out[k] = Array.isArray(raw[k]) ? raw[k] : [];
    out.nests = Array.isArray(raw.nests) && raw.nests.length ? raw.nests : newSave().nests;
    out.stats.el = out.stats.el || {};
    return out;
  }
  if (raw.v === 1) {
    s.items.rune = Math.max(0, raw.stones | 0); s.sprouts = raw.sprouts | 0; s.stops = raw.stops || {}; s.keepers = raw.keepers || {};
    s.stats.throws = raw.throws | 0;
    const r = rng(hash('migrate', raw.catches | 0, raw.throws | 0));
    for (const [sp, n] of Object.entries(raw.caught || {})) {
      if (!VARIANTS.some(v => v.id === sp)) continue;
      for (let i = 0; i < n && s.kikis.length < KIKI_MAX; i++) { addKiki(s, rollKiki(sp, 1 + r.int(0, 5), r), now); s.xp += XP.catch; }
      s.xp += XP.newSpecies; s.fluff[familyOf(sp)] = (s.fluff[familyOf(sp)] || 0) + n * FLUFF[variant(sp).rarity];
    }
    s.stats.catches = s.kikis.length;
    s.tutorial = s.kikis.length ? 'explorer' : 'start'; // already played: just make an explorer, no starter
  }
  return s;
}

// =====================================================================================================================
// Phase 2
// =====================================================================================================================

// ---------- elements ----------
export const ELEMENTS = ['Leaf', 'Water', 'Ember', 'Spark', 'Stone', 'Moon'];
export const ELEMENT_COLOR = { Leaf: '#3fae2a', Water: '#2f9bf0', Ember: '#ff6a1a', Spark: '#f2b600', Stone: '#8f8574', Moon: '#8c4dff' };
/** Each element is strong against two and weak against two (a wheel, so nothing is best at everything). */
export const STRONG = { Leaf: ['Water', 'Stone'], Water: ['Ember', 'Spark'], Ember: ['Leaf', 'Moon'], Spark: ['Moon', 'Leaf'], Stone: ['Spark', 'Ember'], Moon: ['Stone', 'Water'] };
export const effectiveness = (att, def) => STRONG[att].includes(def) ? 1.6 : STRONG[def].includes(att) ? 0.625 : 1;
export const weakTo = el => ELEMENTS.filter(e => STRONG[e].includes(el));

// ---------- weather (Open-Meteo weather codes) ----------
export const WEATHER = {
  sunny: { name: 'Sunny', boost: ['Ember', 'Leaf'], icon: '☀️' }, clear: { name: 'Clear night', boost: ['Moon', 'Spark'], icon: '🌙' },
  cloudy: { name: 'Cloudy', boost: ['Stone', 'Moon'], icon: '☁️' }, rain: { name: 'Rainy', boost: ['Water', 'Leaf'], icon: '🌧️' },
  storm: { name: 'Stormy', boost: ['Spark', 'Water'], icon: '⛈️' }, snow: { name: 'Snowy', boost: ['Water', 'Stone'], icon: '❄️' },
  fog: { name: 'Foggy', boost: ['Moon', 'Stone'], icon: '🌫️' }, windy: { name: 'Windy', boost: ['Spark', 'Leaf'], icon: '💨' },
};
export function weatherFrom(code, isDay, windKmh = 0) {
  if (code >= 95) return 'storm';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if (code === 45 || code === 48) return 'fog';
  if (windKmh >= 30) return 'windy';
  if (code >= 2) return 'cloudy';
  return isDay ? 'sunny' : 'clear';
}
/** Weather-boosted Kikis are a little stronger and give more Sprouts. */
export const BOOST_LEVELS = 3, BOOST_SPROUTS = 1.25;

// ---------- Sparkle Kikis ----------
export const SPARKLE_ODDS = 450;
export const isSparkle = (spawnId, odds = SPARKLE_ODDS) => hash(spawnId, 'sparkle') % Math.max(1, Math.round(odds)) === 0;

// ---------- eggs and nests ----------
export const EGG_MAX = 9, EGG_KM = [2, 5, 10];
export const eggPool = km => VARIANTS.filter(v => v.egg === km);
export const EGG_REWARD = { 2: { xp: 500, sprouts: 800, fluff: 5 }, 5: { xp: 1000, sprouts: 1600, fluff: 10 }, 10: { xp: 2000, sprouts: 3200, fluff: 16 } };
/** An egg from a supply stop: mostly 2 km, sometimes 5 km, rarely 10 km. What's inside is decided now. */
export function newEgg(p, r = sysRng) {
  if (p.eggs.length >= EGG_MAX) return null;
  const x = r.next(), km = x < 0.55 ? 2 : x < 0.9 ? 5 : 10, pool = eggPool(km);
  const egg = { id: p.nextUid++, km, sp: pool[r.int(0, pool.length)].id, walked: 0 };
  p.eggs.push(egg); return egg;
}
export function incubate(p, eggId, nestId) {
  const n = p.nests.find(x => x.id === nestId), e = p.eggs.find(x => x.id === eggId);
  if (!n || !e || n.egg != null || p.nests.some(x => x.egg === eggId)) return false;
  n.egg = eggId; return true;
}
/** Walking moves every egg in a nest along; returns the eggs that are ready to hatch (they leave their nest). */
export function walkEggs(p, km) {
  const ready = [];
  for (const n of [...p.nests]) {
    if (n.egg == null) continue;
    const e = p.eggs.find(x => x.id === n.egg); if (!e) { n.egg = null; continue; }
    e.walked = Math.min(e.km, e.walked + km);
    if (e.walked >= e.km) {
      ready.push(e); p.eggs = p.eggs.filter(x => x !== e); n.egg = null;
      if (n.uses > 0 && --n.uses === 0) p.nests = p.nests.filter(x => x !== n);
    }
  }
  return ready;
}
/** What hatches: up to level 20, with good hidden stats (10 to 15 each). */
export function hatchKiki(egg, explorerLevel, r = sysRng) {
  const k = rollKiki(egg.sp, Math.min(20, explorerLevel), r);
  k.iv = k.iv.map(() => 10 + r.int(0, 6)); return k;
}
export const NEST_USES = 3;

// ---------- buddy ----------
export const BUDDY_KM = { Common: 1, Rare: 3, Epic: 5, Legendary: 5 };
export function setBuddy(p, uid) { p.buddy = uid == null ? null : { uid, km: 0 }; }
/** Walking with your buddy: every 1, 3 or 5 km (by rarity) it finds a Fluff. Returns how many it found. */
export function walkBuddy(p, km) {
  if (!p.buddy) return 0;
  const k = p.kikis.find(x => x.uid === p.buddy.uid); if (!k) { p.buddy = null; return 0; }
  const need = BUDDY_KM[variant(k.sp).rarity]; p.buddy.km += km; p.stats.buddyKm += km;
  let n = 0; while (p.buddy.km >= need) { p.buddy.km -= need; n++; }
  if (n) p.fluff[familyOf(k.sp)] = (p.fluff[familyOf(k.sp)] || 0) + n;
  return n;
}

// ---------- tasks (from supply stops), the stamp card and the story ----------
// Task kinds count events the game reports with track(): catch (el), throw (q), spin, spinThrow, power, evolve, walk (km), feed, hatch, battle, raid.
export const TASKS = [
  { type: 'catch', n: 5, text: 'Catch 5 Kikis', reward: { items: { rune: 6 } } },
  { type: 'catch', n: 10, text: 'Catch 10 Kikis', reward: { items: { moon: 4 }, sprouts: 500 } },
  ...['Leaf', 'Water', 'Ember', 'Spark', 'Stone', 'Moon'].map((el, i) => ({ type: 'catch', el, n: 3, text: `Catch 3 ${el} Kikis`, reward: { kiki: ['acorn', 'lily', 'marshmallow', 'firefly', 'sandy', 'shroom'][i] } })),
  { type: 'throw', q: 'Nice', n: 5, text: 'Make 5 Nice throws or better', reward: { items: { honey: 3 } } },
  { type: 'throw', q: 'Great', n: 3, text: 'Make 3 Great throws or better', reward: { kiki: 'rainbow' } },
  { type: 'throw', q: 'Excellent', n: 1, text: 'Make an Excellent throw', reward: { kiki: 'geode' } },
  { type: 'spinThrow', n: 3, text: 'Make 3 spin throws', reward: { items: { rune: 8 } } },
  { type: 'spin', n: 3, text: 'Spin 3 supply stops', reward: { items: { rune: 5, honey: 2 } } },
  { type: 'power', n: 3, text: 'Power up Kikis 3 times', reward: { sprouts: 600 } },
  { type: 'evolve', n: 1, text: 'Evolve a Kiki', reward: { items: { star: 2 }, sprouts: 800 } },
  { type: 'walk', n: 1, text: 'Walk 1 km', reward: { items: { sunseed: 2 } } },
  { type: 'feed', n: 3, text: 'Give Kikis 3 treats', reward: { items: { rune: 5 } } },
  { type: 'hatch', n: 1, text: 'Hatch an egg', reward: { kiki: 'zap' } },
];
export const TASK_MAX = 3;
/** A new task from a stop (one per stop per day), if you have room. */
export function giveTask(p, stopId, now) {
  if (p.tasks.length >= TASK_MAX) return null;
  const pool = TASKS.filter(t => (t.type !== 'battle' && t.type !== 'raid') || levelOf(p.xp) >= 5);
  const r = rng(hash(stopId, dayKey(now), p.stats.tasks));
  const t = { ...pool[r.int(0, pool.length)], got: 0, id: p.nextUid++ }; p.tasks.push(t); return t;
}
const matches = (t, ev) => t.type === ev.type && (!t.el || t.el === ev.el) && (!t.q || QUAL.indexOf(ev.q) >= QUAL.indexOf(t.q));
const QUAL = ['Nice', 'Great', 'Excellent'];
/** Report something you did; returns tasks and story steps that just finished. */
export function track(p, ev) {
  const n = ev.n == null ? 1 : ev.n, done = [];
  for (const t of p.tasks) if (t.got < t.n && matches(t, ev)) { t.got = Math.min(t.n, t.got + n); if (t.got >= t.n) done.push(t); }
  const ch = STORY[p.story.ch];
  if (ch) ch.tasks.forEach((t, i) => { const g = p.story.prog[i] || 0; if (g < t.n && matches(t, ev)) { p.story.prog[i] = Math.min(t.n, g + n); if (p.story.prog[i] >= t.n) done.push({ ...t, story: true }); } });
  return done;
}
/** Claim a finished task: rewards, plus today's stamp if you don't have it yet. Returns {reward, stamp, card}. */
export function claimTask(p, id, now) {
  const i = p.tasks.findIndex(t => t.id === id); if (i < 0 || p.tasks[i].got < p.tasks[i].n) return null;
  const [t] = p.tasks.splice(i, 1); p.stats.tasks++;
  let stamp = false, card = false; const today = dayKey(now);
  if (p.stamps.last !== today) { p.stamps.last = today; p.stamps.n++; stamp = true; if (p.stamps.n >= 7) { p.stamps.n = 0; card = true; } }
  return { reward: t.reward, stamp, card, task: t };
}
/** The stamp card's prize: a rare encounter and a bundle of items. */
export const STAMP_PRIZE = { items: { moon: 10, honey: 5, sunseed: 3 }, xp: 2500, kikiPool: ['rainbow', 'geode', 'moonbeam', 'orchard', 'tide', 'crystal'] };
export const STORY = [
  { title: 'A Spiral in the Grass', intro: "Something odd is happening, explorer. Spirals keep appearing on the ground wherever Kikis play. Help me find out why: catch a few Kikis and keep your eyes open.",
    tasks: [{ type: 'catch', n: 3, text: 'Catch 3 Kikis' }, { type: 'spin', n: 2, text: 'Spin 2 supply stops' }, { type: 'throw', q: 'Nice', n: 3, text: 'Make 3 Nice throws or better' }],
    reward: { items: { rune: 20, honey: 5 }, xp: 1000 }, outro: 'The spirals point towards the Rune Circles. Every one of them. That can\'t be a coincidence.' },
  { title: 'Six Kinds of Kiki', intro: 'Kikis come in six elements: Leaf, Water, Ember, Spark, Stone and Moon. Each is strong against two others. The spirals glow brightest near Kikis of every kind together.',
    tasks: [{ type: 'catch', el: 'Leaf', n: 2, text: 'Catch 2 Leaf Kikis' }, { type: 'catch', el: 'Water', n: 2, text: 'Catch 2 Water Kikis' }, { type: 'catch', n: 8, text: 'Catch 8 Kikis' }],
    reward: { items: { moon: 10 }, xp: 1500, kiki: 'lily' }, outro: 'Look at this Lily Kiki! It was sitting right in the middle of a spiral, humming.' },
  { title: 'Warm Eggs', intro: 'Kiki eggs have been turning up at supply stops. Keep one warm in your nest and walk, and it will hatch. I wonder what the spirals have to do with it.',
    tasks: [{ type: 'hatch', n: 1, text: 'Hatch an egg' }, { type: 'walk', n: 2, text: 'Walk 2 km' }, { type: 'feed', n: 3, text: 'Give Kikis 3 treats' }],
    reward: { items: { sunseed: 5 }, xp: 2000, sprouts: 2000 }, outro: 'Every egg has a tiny spiral on it, just like a Rune Stone. They must come through the portals!' },
  { title: 'Growing Up', intro: 'Kikis grow stronger with Sprouts and Fluff, and some evolve into something new. The portals seem to open wider for Kikis that have grown.',
    tasks: [{ type: 'evolve', n: 1, text: 'Evolve a Kiki' }, { type: 'power', n: 5, text: 'Power up Kikis 5 times' }, { type: 'catch', n: 15, text: 'Catch 15 Kikis' }],
    reward: { items: { star: 10 }, xp: 3000 }, outro: 'The portal at the Rune Circle flickered just now. Did you see it? Something golden, on the other side.' },
  { title: 'The Keeper of the Portals', intro: "It's the Golden Spiral Kiki, the keeper of the portals. It's been leaving the spirals all along, looking for an explorer it can trust. Show it what you've learned.",
    tasks: [{ type: 'spin', n: 10, text: 'Spin 10 supply stops' }, { type: 'catch', n: 20, text: 'Catch 20 Kikis' }, { type: 'throw', q: 'Excellent', n: 1, text: 'Make an Excellent throw' }],
    reward: { items: { star: 10 }, xp: 5000, kiki: 'golden-spiral' }, outro: 'It chose you! Take good care of it. And keep exploring: there are many more spirals out there.' },
];
export const storyDone = p => p.story.ch >= STORY.length;
export const chapterReady = p => !storyDone(p) && STORY[p.story.ch].tasks.every((t, i) => (p.story.prog[i] || 0) >= t.n);
export function claimChapter(p) { if (!chapterReady(p)) return null; const ch = STORY[p.story.ch]; p.story.ch++; p.story.prog = []; return ch; }

// ---------- medals ----------
const speciesCaught = p => Object.keys(p.caught).filter(id => p.caught[id] > 0).length;
export const MEDALS = [
  { id: 'collector', name: 'Collector', what: 'Kikis caught', get: p => p.stats.catches, tiers: [10, 100, 1000] },
  { id: 'wanderer', name: 'Wanderer', what: 'km walked', get: p => p.stats.km, tiers: [10, 100, 1000] },
  { id: 'supplier', name: 'Supplier', what: 'supply stops spun', get: p => p.stats.stops, tiers: [10, 100, 1000] },
  { id: 'logkeeper', name: 'Log Keeper', what: 'Safari Log entries', get: speciesCaught, tiers: [10, 25, 45] },
  { id: 'sharpshooter', name: 'Sharpshooter', what: 'Excellent throws', get: p => p.stats.excellent, tiers: [5, 50, 500] },
  { id: 'evolver', name: 'Evolver', what: 'Kikis evolved', get: p => p.stats.evolved, tiers: [3, 30, 200] },
  { id: 'nestwarmer', name: 'Nest Warmer', what: 'eggs hatched', get: p => p.stats.hatched, tiers: [5, 50, 500] },
  { id: 'sparkle', name: 'Sparkle Seeker', what: 'Sparkle Kikis caught', get: p => p.stats.sparkles, tiers: [1, 10, 50] },
  { id: 'buddy', name: 'Best Buddies', what: 'km with your buddy', get: p => p.stats.buddyKm, tiers: [10, 100, 1000] },
  { id: 'ranger', name: 'Ranger', what: 'tasks done', get: p => p.stats.tasks, tiers: [10, 100, 1000] },
  ...ELEMENTS.map(el => ({ id: 'el-' + el, name: el + ' Friend', what: el + ' Kikis caught', el, get: p => p.stats.el[el] || 0, tiers: [10, 50, 200] })),
];
export const TIER_NAMES = ['', 'Bronze', 'Silver', 'Gold'];
export const medalTier = (p, m) => m.tiers.filter(t => m.get(p) >= t).length;
/** Medals that just reached a new tier (and remembers them). */
export function newMedals(p) {
  const out = [];
  for (const m of MEDALS) { const t = medalTier(p, m); if (t > (p.medals[m.id] || 0)) { p.medals[m.id] = t; out.push({ m, tier: t }); } }
  return out;
}

// ---------- events (a calendar every phone works out the same way, no server needed) ----------
const SYNODIC = 29.530588853, NEW_MOON = Date.UTC(2000, 0, 6, 18, 14) / 1000;
/** 0 = new moon, 0.5 = full moon. */
export const moonPhase = sec => (((sec - NEW_MOON) / 86400 / SYNODIC) % 1 + 1) % 1;
const weekNo = d => Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5 + 3) / 7);
const COMMONS = () => VARIANTS.filter(v => v.rarity === 'Common' && v.weight > 0 && !v.time).map(v => v.id);
/**
 * What's on right now (local time). Effects: boost (elements spawn more), featured (one Kiki spawns a lot),
 * sparkle (better Sparkle odds), xp / sprouts (multipliers for catches), surge (Portal Surge Kikis follow the event).
 */
export function eventsAt(sec) {
  const d = new Date(sec * 1000), out = [], day = d.getDay(), h = d.getHours(), w = weekNo(d);
  const commons = COMMONS();
  if (day === 6 || day === 0) { const el = ELEMENTS[w % ELEMENTS.length]; out.push({ id: 'weekend-' + w, name: `${el} Weekend`, blurb: `${el} Kikis are out all weekend, and catches give 2× Sprouts.`, boost: [el], sprouts: 2, color: ELEMENT_COLOR[el] }); }
  if (day === 3 && h >= 18 && h < 20) { const sp = commons[w % commons.length]; out.push({ id: 'parade-' + w, name: `${variant(sp).name} Parade`, blurb: `${variant(sp).name}s everywhere from 6 to 8 pm, and catches give 2× XP.`, featured: sp, xp: 2, color: '#ff5d8f' }); }
  if (d.getDate() <= 7 && day === 6 && h >= 14 && h < 17) { const sp = commons[(d.getFullYear() * 12 + d.getMonth()) % commons.length]; out.push({ id: 'kikiday-' + d.getFullYear() + '-' + d.getMonth(), name: 'Kiki Day', blurb: `${variant(sp).name}s all afternoon, Sparkle ones far more often, and 3× XP for catches.`, featured: sp, sparkle: 18, xp: 3, color: '#ffcf2e' }); }
  const ph = moonPhase(sec); if (ph > 0.47 && ph < 0.53 && (h >= 18 || h < 6)) out.push({ id: 'fullmoon-' + Math.floor((sec - NEW_MOON) / 86400 / SYNODIC), name: 'Full Moon', blurb: 'Moon Kikis are out tonight, and Moonbeam Kikis aren\'t so shy.', boost: ['Moon'], featured: 'moonbeam', color: '#8c4dff' });
  return out;
}
/** All event effects merged. */
export function eventMods(evs) {
  const m = { boost: [], featured: null, sparkle: 1, xp: 1, sprouts: 1 };
  for (const e of evs) { if (e.boost) m.boost.push(...e.boost); if (e.featured) m.featured = e.featured; if (e.sparkle) m.sparkle = Math.max(m.sparkle, e.sparkle); if (e.xp) m.xp = Math.max(m.xp, e.xp); if (e.sprouts) m.sprouts = Math.max(m.sprouts, e.sprouts); }
  return m;
}

// =====================================================================================================================
// Phase 3: battles, healing, Rune Circles, factions and raids
// =====================================================================================================================
export const BATTLE_LEVEL = 5; // battles, factions and raids open at explorer level 5
ITEMS.stitch = { plural: 'Stitch Kits', name: 'Stitch Kit', kind: 'heal', heal: 60, unlock: BATTLE_LEVEL, blurb: 'Needle, thread and a hug. Restores 60 HP to a Kiki.' };
ITEMS.superstitch = { plural: 'Super Stitch Kits', name: 'Super Stitch Kit', kind: 'heal', heal: 200, unlock: 12, blurb: 'Extra-soft stuffing. Restores 200 HP to a Kiki.' };
ITEMS.pillow = { plural: 'Revive Pillows', name: 'Revive Pillow', kind: 'revive', unlock: BATTLE_LEVEL, blurb: 'A nap on this and a fainted Kiki is back on its feet with half its HP.' };
ITEMS.key = { plural: 'Portal Keys', name: 'Portal Key', kind: 'raid', unlock: BATTLE_LEVEL, blurb: 'Opens a Portal Surge raid. Your first raid each day is free.' };
export const HEALS = ['stitch', 'superstitch', 'pillow'];
{ // battle supplies in level-up rewards and supply stops
  levelRewardsImpl = L => { const r = baseLevelRewards(L); if (L >= BATTLE_LEVEL) { r.stitch = L === BATTLE_LEVEL ? 10 : 5; r.pillow = L === BATTLE_LEVEL ? 5 : 2; r.key = 1; } if (L >= 12) r.superstitch = 3; return r; };
}

// ---------- fighters ----------
const SHAPE = { atk: [1.2, 0.9, 0.95], def: [0.9, 1.25, 1.0], hp: [0.9, 0.95, 1.25], bal: [1, 1, 1] };
/** Battle stats from a Kiki: attack (Zest), defence (Bounce) and HP (Cuddle), all growing with level. */
export function battleStats(k) {
  const v = variant(k.sp), [a, d, h] = SHAPE[v.shape || 'bal'], m = levelMult(k.lvl);
  return { atk: (v.base * a + 2 * k.iv[2]) * m, def: (v.base * d + 2 * k.iv[1]) * m, maxHp: Math.round((v.base * h + 2 * k.iv[0]) * m * 1.2) };
}
export const hpOf = k => k.hp == null ? battleStats(k).maxHp : k.hp;
export const MOVES = {
  Leaf: ['Leaf Flick', 'Petal Storm'], Water: ['Splash', 'Bubble Burst'], Ember: ['Ember Puff', 'Flare Spin'],
  Spark: ['Zap', 'Thunder Hug'], Stone: ['Pebble Pop', 'Rock Roll'], Moon: ['Moon Glimmer', 'Dream Spiral'],
};
export const QUICK = { power: 10, energy: 9, cooldown: 0.5 }, CHARGED = { power: 70, cost: 50 };
export const damage = (power, att, def) => Math.floor(power * (att.atk / def.def) * effectiveness(att.el, def.el) * 0.5) + 1;
export function fighter(k, opts = {}) {
  const s = battleStats(k), v = variant(k.sp);
  const maxHp = Math.round(s.maxHp * (opts.hpMult || 1));
  return { uid: k.uid, sp: k.sp, name: k.nick || v.name, el: v.element, lvl: k.lvl, sparkle: !!k.sparkle, atk: s.atk, def: s.def, maxHp, hp: opts.full ? maxHp : Math.min(maxHp, hpOf(k)), energy: 0 };
}

/**
 * A real-time battle: your team against theirs, one Kiki out at a time on each side. You tap for quick moves
 * (they build energy), unleash a charged move when the meter is full, and swipe to dodge. The other side attacks on a
 * timer and telegraphs its charged moves so you can dodge them. update(dt) and the player actions return events for
 * the screen to animate: hit, faint, switch, telegraph, end.
 */
export class Battle {
  constructor(mine, theirs, { time = 120, aiQuick = 1.7, aiCharged = 9, raid = false } = {}) {
    this.sides = [mine.filter(f => f.hp > 0), theirs]; this.cur = [0, 0]; this.time = time; this.t = 0; this.done = null;
    this.aiQuick = aiQuick; this.aiCharged = aiCharged; this.raid = raid;
    this.cool = 0; this.aiT = aiQuick; this.aiC = aiCharged; this.tele = null; this.dodgeT = -9; this.log = [];
  }
  get me() { return this.sides[0][this.cur[0]]; }
  get them() { return this.sides[1][this.cur[1]]; }
  hit(side, power, charged) {
    const att = side === 0 ? this.me : this.them, def = side === 0 ? this.them : this.me;
    let dmg = damage(power, att, def), dodged = false;
    if (side === 1 && this.t - this.dodgeT < 0.6) { dmg = Math.max(1, Math.floor(dmg * 0.25)); dodged = true; }
    def.hp = Math.max(0, def.hp - dmg);
    const ev = [{ type: 'hit', side, dmg, eff: effectiveness(att.el, def.el), charged, dodged }];
    if (def.hp === 0) ev.push(...this.faint(1 - side));
    return ev;
  }
  faint(side) {
    const ev = [{ type: 'faint', side, who: this.sides[side][this.cur[side]] }];
    const next = this.sides[side].findIndex((f, i) => i > this.cur[side] && f.hp > 0);
    if (next < 0) { this.done = side === 1 ? 'win' : 'lose'; ev.push({ type: 'end', win: side === 1 }); }
    else { this.cur[side] = next; if (side === 1) { this.aiT = this.aiQuick; this.aiC = this.aiCharged; this.tele = null; } ev.push({ type: 'switch', side, who: this.sides[side][next] }); }
    return ev;
  }
  quick() {
    if (this.done || this.cool > 0) return [];
    this.cool = QUICK.cooldown; this.me.energy = Math.min(100, this.me.energy + QUICK.energy);
    return this.hit(0, QUICK.power, false);
  }
  charged() {
    if (this.done || this.me.energy < CHARGED.cost) return [];
    this.me.energy -= CHARGED.cost; this.cool = 0.8;
    return this.hit(0, CHARGED.power, true);
  }
  dodge() { if (this.done) return []; this.dodgeT = this.t; return [{ type: 'dodge' }]; }
  update(dt) {
    if (this.done) return [];
    const ev = []; this.t += dt; this.cool = Math.max(0, this.cool - dt);
    if (this.t >= this.time) { this.done = 'timeout'; return [{ type: 'end', win: false, timeout: true }]; }
    if (this.tele) { this.tele.left -= dt; if (this.tele.left <= 0) { this.tele = null; ev.push(...this.hit(1, CHARGED.power, true)); } return ev; }
    this.aiT -= dt; this.aiC -= dt;
    if (this.aiC <= 0) { this.aiC = this.aiCharged * (0.85 + Math.random() * 0.3); this.tele = { left: 1.1 }; ev.push({ type: 'telegraph', left: 1.1 }); }
    else if (this.aiT <= 0) { this.aiT = this.aiQuick * (0.85 + Math.random() * 0.3); ev.push(...this.hit(1, QUICK.power, false)); }
    return ev;
  }
}
/** Use a healing item on a Kiki. Returns HP gained (or false). */
export function heal(p, k, item) {
  const max = battleStats(k).maxHp, hp = hpOf(k), it = ITEMS[item];
  if (!it || !(p.items[item] > 0)) return false;
  if (it.kind === 'revive' ? hp > 0 : hp === 0 || hp >= max) return false;
  p.items[item]--; const to = it.kind === 'revive' ? Math.ceil(max / 2) : Math.min(max, hp + it.heal);
  if (to >= max) delete k.hp; else k.hp = to;
  return to - hp;
}
/** The strongest healthy Kikis that aren't busy keeping a circle. */
export const bestTeam = (p, n) => p.kikis.filter(k => hpOf(k) > 0 && !k.keeping).sort((a, b) => power(b) - power(a)).slice(0, n);

// ---------- factions ----------
export const FACTIONS = {
  dusk: { name: 'Dusk Weavers', color: '#8c4dff', motto: 'We follow the spirals into the night. Every portal has a story.' },
  tide: { name: 'Tide Keepers', color: '#14b8a6', motto: 'Steady as the sea. We look after the circles and every Kiki in them.' },
  bloom: { name: 'Bloom Wardens', color: '#ff6f61', motto: 'Grow, explore, be brave. Wherever we walk, something new blooms.' },
};

// ---------- Rune Circle keepers ----------
const wildPool = () => VARIANTS.filter(v => v.weight > 0 && v.rarity !== 'Legendary');
/** Today's wild Keepers at a circle: 1 to 3 Kikis around your level. */
export function keeperTeam(circleId, sec, explorerLevel) {
  const r = rng(hash(circleId, dayKey(sec), 'keepers')), pool = wildPool(), n = 1 + r.int(0, 3), out = [];
  for (let i = 0; i < n; i++) { const sp = pool[r.int(0, pool.length)].id, lvl = Math.max(3, Math.min(30, explorerLevel - 3 + r.int(0, 5))); out.push({ uid: -1 - i, ...rollKiki(sp, lvl, r) }); }
  return out;
}
export function takeCircle(p, circleId, k, sec) {
  for (const x of p.kikis) if (x.keeping === circleId) delete x.keeping;
  k.keeping = circleId; p.keepers[circleId] = { uid: k.uid, variant: k.sp, att: 0, since: sec, last: sec };
}
export function callHome(p, circleId) { const k = p.kikis.find(x => x.keeping === circleId); if (k) delete k.keeping; delete p.keepers[circleId]; }

// ---------- Portal Surge raids ----------
export const LEGENDARIES = () => VARIANTS.filter(v => v.rarity === 'Legendary').map(v => v.id);
export const RAID_TIERS = { 1: { level: 15, hpMult: 7, xp: 2000, stones: 6, items: { stitch: 4, rune: 10 } }, 3: { level: 20, hpMult: 3, xp: 4000, stones: 7, items: { stitch: 6, moon: 6, superstitch: 1 } }, 5: { level: 25, hpMult: 1.7, xp: 8000, stones: 8, items: { superstitch: 3, star: 6, pillow: 2 } } };
/** The boss at a circle during a Portal Surge (the same on every phone). */
export function raidAt(circleId, surgeIndex) {
  const r = rng(hash(circleId, surgeIndex, 'raid')), x = r.next(), tier = x < 0.4 ? 1 : x < 0.8 ? 3 : 5;
  const pool = tier === 5 ? LEGENDARIES() : tier === 3 ? VARIANTS.filter(v => v.rarity === 'Epic').map(v => v.id) : VARIANTS.filter(v => v.rarity === 'Rare' && v.weight > 0).map(v => v.id);
  return { id: circleId + '#' + surgeIndex, sp: pool[r.int(0, pool.length)], tier };
}
export function raidBoss(raid) {
  const t = RAID_TIERS[raid.tier], k = { uid: -100, sp: raid.sp, lvl: t.level, iv: [15, 15, 15] };
  return fighter(k, { hpMult: t.hpMult, full: true });
}
/** One free raid a day, then Portal Keys. */
export function canRaid(p, sec) { return p.raidDay !== dayKey(sec) || (p.items.key || 0) > 0; }
export function payRaid(p, sec) { if (p.raidDay !== dayKey(sec)) { p.raidDay = dayKey(sec); return 'free'; } if (useItem(p, 'key')) return 'key'; return null; }
/** The Kiki you get to catch after a raid: level 20 (25 for legendaries), strong hidden stats. */
export function raidCatchKiki(raid, r = sysRng) {
  const k = rollKiki(raid.sp, raid.tier === 5 ? 25 : 20, r); k.iv = k.iv.map(() => 10 + r.int(0, 6)); return k;
}
TASKS.push({ type: 'battle', n: 1, text: 'Win a battle at a Rune Circle', reward: { items: { stitch: 5, pillow: 2 } } }, { type: 'raid', n: 1, text: 'Win a Portal Surge raid', reward: { items: { key: 1, star: 3 } } });
MEDALS.push({ id: 'battler', name: 'Champion', what: 'battles won', get: p => p.stats.wins || 0, tiers: [10, 100, 1000] }, { id: 'raider', name: 'Portal Diver', what: 'raids won', get: p => p.stats.raids || 0, tiers: [5, 50, 500] });
