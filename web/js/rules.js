// Phase 1 rules (docs/ROADMAP.md): explorer level and XP, the bag and its items, individual Kikis with Plush Power,
// size and hidden stats, powering up, evolving and sending home, catch and run-away odds, supply stop rewards, daily
// streaks, and the save format. Plain JavaScript with no DOM, tested in node: node test/core.test.mjs
import { RARITY, VARIANTS, variant, rng, hash, sysRng, quality } from './core.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// ---------- explorer level ----------
export const MAX_LEVEL = 40;
/** Total XP needed to reach a level: 1,000 for level 2, 3,000 for 3, 6,000 for 4, 10,000 for 5… */
export const xpFor = level => 500 * level * (level - 1);
export function levelOf(xp) { let L = 1; while (L < MAX_LEVEL && xp >= xpFor(L + 1)) L++; return L; }
export const XP = { catch: 100, Nice: 10, Great: 50, Excellent: 100, spin: 10, newSpecies: 500, stop: 50, newStop: 250, evolve: 500, daily: 500, streak: 2500 };
/** Items you get for reaching a level. Better stones and treats unlock along the way. */
export function levelRewards(L) {
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
export function wildKiki(spawnId, sp, explorerLevel) {
  const r = rng(hash(spawnId, 'stats')), lvl = 1 + r.int(0, Math.min(30, explorerLevel));
  return rollKiki(sp, lvl, r);
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
  const i = p.kikis.findIndex(k => k.uid === uid); if (i < 0 || p.kikis[i].fav) return false;
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
  const table = [['rune', 60], ['honey', 20], ['moon', 25], ['sunseed', 8], ['star', 12]].filter(([id]) => level >= ITEMS[id].unlock);
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
    explorer: { name: '', outfit: 0, skin: 1 }, tutorial: 'start', stats: { throws: 0, catches: 0, fled: 0, km: 0, stops: 0, evolved: 0, excellent: 0 },
  };
}
/** Add a caught Kiki to the collection. */
export function addKiki(p, rec, now, place = '') {
  const k = { uid: p.nextUid++, ...rec, at: now, place, nick: '', fav: false };
  p.kikis.push(k); p.caught[k.sp] = (p.caught[k.sp] || 0) + 1; p.seen[k.sp] = Math.max(1, p.seen[k.sp] || 0); p.stats.catches++;
  return k;
}
/** Give XP; returns the levels reached (each gets its rewards). */
export function giveXp(p, n) {
  const before = levelOf(p.xp); p.xp += n; const after = levelOf(p.xp), ups = [];
  for (let L = before + 1; L <= after; L++) { const items = levelRewards(L); addItems(p, items, true); ups.push({ level: L, items, unlocks: Object.keys(ITEMS).filter(id => ITEMS[id].unlock === L) }); }
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
    for (const k of ['items', 'stats', 'explorer']) out[k] = Object.assign(newSave()[k], raw[k]);
    for (const k of ['fluff', 'caught', 'seen', 'stops', 'visited', 'keepers', 'gone', 'daily']) out[k] = raw[k] || {};
    out.kikis = Array.isArray(raw.kikis) ? raw.kikis : [];
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
