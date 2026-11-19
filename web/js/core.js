// KIKI SAFARI game rules, ported from the Unity project's engine-free Core (Assets/KikiSafari/Core).
// Everything here is plain JavaScript with no DOM or three.js, so it can be tested in node: node js/core.test.mjs

// ---------- random ----------
/** Deterministic 32-bit hash of any values (strings or numbers). */
export function hash(...parts) {
  let h = 2166136261 >>> 0;
  for (const p of parts) {
    const s = String(p);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    h ^= 0x9e; h = Math.imul(h, 16777619) >>> 0;
  }
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12; h = Math.imul(h, 0x297a2d39) >>> 0; h ^= h >>> 15;
  return h >>> 0;
}
/** Seeded random numbers (mulberry32). Same seed, same sequence, on every phone. */
export function rng(seed) {
  let a = seed >>> 0;
  const next = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { next, int: (min, max) => (max <= min ? min : min + Math.floor(next() * (max - min))), range: (a0, b0) => a0 + next() * (b0 - a0) };
}
export const sysRng = { next: Math.random, int: (min, max) => (max <= min ? min : min + Math.floor(Math.random() * (max - min))), range: (a, b) => a + Math.random() * (b - a) };

// ---------- rarity and variants ----------
export const RARITY = {
  Common: { order: 0, label: 'COMMON', main: '#ffffff', second: '#8fd3ff', wobbles: 1, chance: 0.65, reward: 100, keeper: 55 },
  Rare: { order: 1, label: 'RARE', main: '#4cc3ff', second: '#1f6fd6', wobbles: 2, chance: 0.45, reward: 250, keeper: 65 },
  Epic: { order: 2, label: 'EPIC', main: '#c77dff', second: '#7a2fd6', wobbles: 3, chance: 0.30, reward: 500, keeper: 75 },
  Legendary: { order: 3, label: 'LEGENDARY', main: '#ffd23f', second: '#ff8a00', wobbles: 3, chance: 0.15, reward: 1000, keeper: 85 },
};

// The species. The first six are the decisions doc's variants (section 3: only the crown, embroidery and glow change);
// Phase 1 adds an evolved form for each of the three commons. `no` is the Safari Log number, `family` shares Fluff,
// `base` sets Plush Power, `cm`/`kg` are average sizes. Names marked * in the roadmap are placeholders.
export const VARIANTS = [
  { id: 'meadow', no: 1, name: 'Meadow Kiki', rarity: 'Common', weight: 10, habitats: ['Meadow'], boost: 3, outside: 0.6, time: 'day', family: 'meadow', evolvesTo: 'grand-meadow', cost: 25, base: 60, cm: 42, kg: 0.6,
    blurb: 'Naps in sunny grass and wakes up whenever someone laughs nearby. Its leaf crown turns to follow the sun.' },
  { id: 'grand-meadow', no: 2, name: 'Grand Meadow Kiki', rarity: 'Rare', weight: 0.5, habitats: ['Meadow'], boost: 3, outside: 0.3, time: 'day', family: 'meadow', base: 115, cm: 55, kg: 1.1,
    blurb: 'A Meadow Kiki that has soaked up a whole summer. The spiral stitched on its tummy is said to grow one loop each year.' },
  { id: 'pine', no: 3, name: 'Pine Kiki', rarity: 'Common', weight: 10, habitats: ['Woods'], boost: 3, outside: 0.4, family: 'pine', evolvesTo: 'elder-pine', cost: 25, base: 62, cm: 44, kg: 0.7,
    blurb: 'Hides among tree roots and hums when the wind blows. Smells faintly of pine needles and campfire.' },
  { id: 'elder-pine', no: 4, name: 'Elder Pine Kiki', rarity: 'Rare', weight: 0.5, habitats: ['Woods'], boost: 3, outside: 0.2, family: 'pine', base: 120, cm: 60, kg: 1.3,
    blurb: 'Its tall crown keeps a dusting of frost even in summer. Younger Pine Kikis follow it around the forest.' },
  { id: 'sprout', no: 5, name: 'Sprout Kiki', rarity: 'Common', weight: 10, habitats: ['Town'], boost: 2, outside: 1, family: 'sprout', evolvesTo: 'bloom', cost: 25, base: 55, cm: 33, kg: 0.4,
    blurb: 'Pops up in flower beds, window boxes and cracks in the pavement. Waters its own seedling when nobody is looking.' },
  { id: 'bloom', no: 6, name: 'Bloom Kiki', rarity: 'Rare', weight: 0.5, habitats: ['Town'], boost: 2, outside: 0.6, family: 'sprout', base: 110, cm: 46, kg: 0.8,
    blurb: 'Its seedling finally flowered. It shares the pollen with every bee in the neighbourhood.' },
  { id: 'rainbow', no: 7, name: 'Rainbow Kiki', rarity: 'Rare', weight: 2.5, habitats: ['Water'], boost: 4, outside: 0.25, family: 'rainbow', base: 95, cm: 42, kg: 0.6,
    blurb: 'Appears near water after a rain shower. Each leaf of its crown is a different colour, and no two are the same.' },
  { id: 'moonbeam', no: 8, name: 'Moonbeam Kiki', rarity: 'Epic', weight: 1.2, time: 'night', family: 'moonbeam', base: 130, cm: 44, kg: 0.5,
    blurb: 'Only comes out after sunset. Its embroidered stars glow a soft purple, so it never gets lost in the dark.' },
  { id: 'golden-spiral', no: 9, name: 'Golden Spiral Kiki', rarity: 'Legendary', weight: 0.15, crewBoost: 6, family: 'golden-spiral', base: 200, cm: 48, kg: 0.9,
    blurb: 'The keeper of the portals. Legends say the spiral on every Rune Stone was copied from its tummy.' },
];
export const variant = id => VARIANTS.find(v => v.id === id) || VARIANTS[0];

// ---------- spawning ----------
export const WINDOW = 15 * 60, MIN_DUR = 15 * 60, MAX_DUR = 30 * 60;
export function weight(v, ctx) {
  if (v.time === 'night' && !ctx.night) return 0;
  if (v.time === 'day' && ctx.night) return 0;
  let w = v.weight;
  if (v.habitats && v.habitats.length) w *= v.habitats.includes(ctx.habitat) ? v.boost : v.outside;
  if (ctx.crew) w *= v.crewBoost || 1;
  return w;
}
export function pick(ctx, roll) {
  let total = 0; for (const v of VARIANTS) total += weight(v, ctx);
  if (total <= 0) return null;
  let t = roll * total, acc = 0, last = null;
  for (const v of VARIANTS) { const w = weight(v, ctx); if (w <= 0) continue; last = v; acc += w; if (t < acc) return v; }
  return last;
}
/** Spawns alive at time `now` in one grid cell. */
export function activeSpawns(cx, cy, now, seed, cellSize, ctx, chance) {
  const out = [], w = Math.floor(now / WINDOW), back = Math.ceil(MAX_DUR / WINDOW) + 1;
  for (let k = w - back; k <= w; k++) {
    const r = rng(hash(seed, cx, cy, k));
    const start = k * WINDOW + r.int(0, WINDOW), dur = r.int(MIN_DUR, MAX_DUR + 1);
    const e = r.next() * cellSize, n = r.next() * cellSize, v = pick(ctx, r.next()), ok = r.next() < chance;
    if (v && ok && now >= start && now < start + dur) out.push({ id: v.id, e, n, start, dur });
  }
  return out;
}

// ---------- catching ----------
export function quality(ring) { return ring <= 0.2 ? 'Excellent' : ring <= 0.5 ? 'Great' : ring <= 0.8 ? 'Nice' : null; }
const QMULT = { Nice: 1.3, Great: 1.6, Excellent: 2.0 };
export function catchChance(rarity, q, spin, odds = 1) {
  const c = RARITY[rarity].chance * (QMULT[q] || 1) * (spin ? 1.3 : 1) * odds;
  return Math.min(0.98, Math.max(0.02, c));
}
/** {result: 'caught'|'brokeout'|'missed', wobbles, quality, spin} */
export function resolveThrow(rarity, t, r = sysRng, odds = 1) {
  if (!t.hit) return { result: 'missed', wobbles: 0, quality: null, spin: t.spin };
  const q = quality(t.ring), chance = catchChance(rarity, q, t.spin, odds), n = RARITY[rarity].wobbles;
  if (r.next() < chance) return { result: 'caught', wobbles: n, quality: q, spin: t.spin, chance };
  return { result: 'brokeout', wobbles: r.int(0, n + 1), quality: q, spin: t.spin, chance };
}
export function reward(rarity, q, spin, first) {
  const lines = [['Catch', RARITY[rarity].reward]];
  if (q) lines.push([q + ' throw', { Nice: 10, Great: 50, Excellent: 100 }[q]]);
  if (spin) lines.push(['Spin bonus', 25]);
  if (first) lines.push(['New in your Safari Log!', 500]);
  return { lines, total: lines.reduce((a, l) => a + l[1], 0) };
}
/** The timing ring: 1 = largest, 0 = smallest, shrinking then growing. */
export function ringScale(t, period) { if (period <= 0) return 1; let p = t / period; p -= Math.floor(p); return p < 0.5 ? 1 - p * 2 : (p - 0.5) * 2; }

/**
 * The catch beats (decisions doc, section 7, with the owner's Rune Stone and portal). No text before the result,
 * none on a miss, and the reveal waits for Keep playing.
 */
export function revealSteps(o, rarity, reduced) {
  const s = [];
  if (o.result === 'missed') return [{ kind: 'bounce', dur: 0.5, haptic: 'light', sfx: 'bounce' }, { kind: 'fizzle', dur: 0.5, sfx: 'fizzle' }];
  const wob = reduced ? 0.45 : 0.8;
  s.push({ kind: 'hit', dur: 0.25, haptic: 'medium', sfx: 'hit' });
  s.push({ kind: 'portalOpen', dur: reduced ? 0.3 : 0.45, sfx: 'portal' });
  s.push({ kind: 'suck', dur: reduced ? 0.5 : 0.8, haptic: 'light', sfx: 'suck' });
  s.push({ kind: 'seal', dur: 0.35, haptic: 'medium', sfx: 'seal' });
  s.push({ kind: 'drop', dur: 0.4, haptic: 'light', sfx: 'bounce' });
  for (let i = 1; i <= o.wobbles; i++) s.push({ kind: 'wobble', index: i, dur: wob, haptic: 'heavy', sfx: 'wobble' });
  if (o.result === 'brokeout') {
    s.push({ kind: 'popOpen', dur: 0.4, haptic: 'warning', sfx: 'breakout' });
    s.push({ kind: 'soClose', dur: 1.1, text: 'SO CLOSE!', shake: reduced ? 0 : 1, voice: 'awww', voiceChance: 0.5 });
    return s;
  }
  s.push({ kind: 'burst', dur: 0.5, haptic: 'success', sfx: 'burst' });
  s.push({ kind: 'stamp', dur: 0.5, haptic: 'heavy', sfx: 'stamp', text: RARITY[rarity].label });
  s.push({ kind: 'dropIn', dur: 0.6, haptic: 'medium', voice: 'yay', voiceChance: 0.5 });
  s.push({ kind: 'dance', dur: reduced ? 1.0 : 1.8 });
  s.push({ kind: 'countUp', dur: 1.4, haptic: 'tick', sfx: 'count' });
  s.push({ kind: 'keepPlaying', dur: Infinity, text: 'Keep playing' });
  return s;
}

// ---------- throw maths ----------
export const solveThrow = (o, t, g, T) => ({ x: (t.x - o.x) / T, y: (t.y - o.y + 0.5 * g * T * T) / T, z: (t.z - o.z) / T });
export const naturalTime = d => 0.45 + 0.12 * Math.max(0, d);
export function aimAssist(o, t, v, g, k) {
  if (k <= 0) return v;
  const ideal = solveThrow(o, t, g, naturalTime(Math.hypot(t.x - o.x, t.z - o.z)));
  return { x: v.x + (ideal.x - v.x) * k, y: v.y + (ideal.y - v.y) * k, z: v.z + (ideal.z - v.z) * k };
}

// ---------- geo ----------
export const M_PER_DEG = 111320;
export const mPerDegLon = lat => M_PER_DEG * Math.cos(lat * Math.PI / 180);
export const toLocal = (o, p) => ({ e: (p.lon - o.lon) * mPerDegLon(o.lat), n: (p.lat - o.lat) * M_PER_DEG });
export const fromLocal = (o, e, n) => ({ lat: o.lat + n / M_PER_DEG, lon: o.lon + e / mPerDegLon(o.lat) });
export function distance(a, b) {
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.min(1, Math.sqrt(s)));
}
export function bearing(a, b) { const l = toLocal(a, b); let d = Math.atan2(l.e, l.n) * 180 / Math.PI; return d < 0 ? d + 360 : d; }

/** Worldwide grid of roughly square cells. */
export function cellMake(x, y, size) {
  const dLat = size / M_PER_DEG, band = (y + 0.5) * dLat, dLon = size / Math.max(1, mPerDegLon(band));
  return { x, y, size, dLat, dLon, sw: { lat: y * dLat, lon: x * dLon }, get center() { return { lat: this.sw.lat + dLat / 2, lon: this.sw.lon + dLon / 2 }; },
    at(e, n) { return { lat: this.sw.lat + n / M_PER_DEG, lon: this.sw.lon + e * dLon / size }; },
    contains(p) { return p.lat >= this.sw.lat && p.lat < this.sw.lat + dLat && p.lon >= this.sw.lon && p.lon < this.sw.lon + dLon; } };
}
export function cellOf(p, size) {
  const dLat = size / M_PER_DEG, y = Math.floor(p.lat / dLat), band = (y + 0.5) * dLat, dLon = size / Math.max(1, mPerDegLon(band));
  return cellMake(Math.floor(p.lon / dLon), y, size);
}
export function cellsAround(p, radius, size) {
  const out = [], dLat = size / M_PER_DEG;
  const y0 = Math.floor((p.lat - radius / M_PER_DEG) / dLat), y1 = Math.floor((p.lat + radius / M_PER_DEG) / dLat);
  for (let y = y0; y <= y1; y++) {
    const band = (y + 0.5) * dLat, dLon = size / Math.max(1, mPerDegLon(band)), r = radius / Math.max(1, mPerDegLon(p.lat));
    for (let x = Math.floor((p.lon - r) / dLon); x <= Math.floor((p.lon + r) / dLon); x++) out.push(cellMake(x, y, size));
  }
  return out;
}
export function rotatingHabitat(p, now, seed) {
  const c = cellOf(p, 1000), r = rng(hash(seed, c.x, c.y, Math.floor(now / (14 * 86400)), 31)).next();
  return r < 0.35 ? 'Meadow' : r < 0.7 ? 'Town' : r < 0.9 ? 'Woods' : 'Water';
}

/** Night = the sun is below the horizon at that place (NOAA solar position). */
export function sunElevation(p, date) {
  const jd = date.getTime() / 86400000 + 2440587.5, t = (jd - 2451545) / 36525;
  const l0 = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360, m = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t), mr = m * Math.PI / 180;
  const c = Math.sin(mr) * (1.914602 - t * (0.004817 + 0.000014 * t)) + Math.sin(2 * mr) * (0.019993 - 0.000101 * t) + Math.sin(3 * mr) * 0.000289;
  const om = 125.04 - 1934.136 * t, lam = l0 + c - 0.00569 - 0.00478 * Math.sin(om * Math.PI / 180);
  const eps = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60 + 0.00256 * Math.cos(om * Math.PI / 180);
  const decl = Math.asin(Math.sin(eps * Math.PI / 180) * Math.sin(lam * Math.PI / 180));
  let y = Math.tan(eps * Math.PI / 360); y *= y;
  const l0r = l0 * Math.PI / 180;
  const eq = 4 * 180 / Math.PI * (y * Math.sin(2 * l0r) - 2 * e * Math.sin(mr) + 4 * e * y * Math.sin(mr) * Math.cos(2 * l0r) - 0.5 * y * y * Math.sin(4 * l0r) - 1.25 * e * e * Math.sin(2 * mr));
  const mins = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  let ts = (mins + eq + 4 * p.lon) % 1440; if (ts < 0) ts += 1440;
  const ha = (ts / 4 < 0 ? ts / 4 + 180 : ts / 4 - 180) * Math.PI / 180, lat = p.lat * Math.PI / 180;
  const cz = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha);
  return 90 - Math.acos(Math.max(-1, Math.min(1, cz))) * 180 / Math.PI;
}
export const isNight = (p, date) => sunElevation(p, date) < -0.833;

// ---------- movement guard ----------
export const SPEED_LOCK = 30, SPEED_UNLOCK = 25, MOVING_FAST = "Looks like you're moving fast";
export const speedLocked = (locked, kmh) => locked ? kmh >= SPEED_UNLOCK : kmh > SPEED_LOCK;

// ---------- Spiral Rite ----------
export class SpiralRite {
  constructor(beats = 16, bpm = 84, leadIn = 2) { this.beats = beats; this.bpm = bpm; this.leadIn = leadIn; this.results = new Array(beats).fill(null); }
  get interval() { return 60 / this.bpm; }
  beatTime(i) { return this.leadIn + i * this.interval; }
  get duration() { return this.beatTime(this.beats - 1) + 0.16 + 0.3; }
  tap(t) {
    let best = -1, err = Infinity;
    for (let i = 0; i < this.beats; i++) { if (this.results[i]) continue; const e = Math.abs(t - this.beatTime(i)); if (e < err) { err = e; best = i; } }
    if (best < 0 || err > 0.16) return null;
    this.results[best] = err <= 0.075 ? 'perfect' : 'good';
    return { beat: best, judgement: this.results[best] };
  }
  advance(t) { const missed = []; for (let i = 0; i < this.beats; i++) if (!this.results[i] && t > this.beatTime(i) + 0.16) { this.results[i] = 'miss'; missed.push(i); } return missed; }
  get attunement() {
    let sum = 0, streak = 0, best = 0;
    for (const r of this.results) { if (r === 'perfect') { sum += 1; streak++; } else if (r === 'good') { sum += 0.6; streak++; } else streak = 0; best = Math.max(best, streak); }
    return Math.round(Math.max(0, Math.min(100, sum / this.beats * 90 + best / this.beats * 10)));
  }
}
export const SURGE_EVERY = 2 * 3600, SURGE_LASTS = 15 * 60;
const mod = (a, b) => ((a % b) + b) % b;
export const surgeActive = now => mod(now, SURGE_EVERY) < SURGE_LASTS;
export const surgeNextIn = now => surgeActive(now) ? 0 : SURGE_EVERY - mod(now, SURGE_EVERY);
export const surgeLeft = now => surgeActive(now) ? SURGE_LASTS - mod(now, SURGE_EVERY) : 0;

// ---------- save data ----------
export function newProgress() { return { v: 1, stones: 30, sprouts: 0, throws: 0, catches: 0, caught: {}, stops: {}, keepers: {} }; }
export const progressApi = {
  useStone(p) { if (p.stones <= 0) return false; p.stones--; p.throws++; return true; },
  recordCatch(p, id, now, amount) { p.catches++; p.sprouts += amount; const first = !p.caught[id]; p.caught[id] = (p.caught[id] || 0) + 1; return first; },
  stopWait(p, id, now, cooldown) { const t = p.stops[id]; return t ? Math.max(0, t + cooldown - now) : 0; },
  claimStop(p, id, now, cooldown, n) { if (progressApi.stopWait(p, id, now, cooldown) > 0) return false; p.stops[id] = now; p.stones += n; return true; },
  takeCircle(p, id, variantId, att, now) { p.keepers[id] = { variant: variantId, att, since: now, last: now }; },
  collectCircle(p, id, now) {
    const k = p.keepers[id]; if (!k) return 0;
    const halves = Math.floor(Math.max(0, now - k.last) / 1800), got = Math.min(480, halves * 20);
    if (got > 0) { k.last += halves * 1800; p.sprouts += got; }
    return got;
  },
};

// ---------- the live world ----------
export const KIKI_CELL = 70, SPAWN_CHANCE = 0.45, STOP_CELL = 250, NEARBY = 200, VISIBLE = 70, ACTION = 40, CIRCLE_RANGE = 400;
export const WORLD_SEED = 'KIKISAFARI-1';

/** Everything near the player: Kikis, supply stops and Rune Circles (real landmarks when map data is loaded). */
export function nearby(me, now, { home = null, progress = null, caught = new Set(), data = null, range = NEARBY } = {}) {
  const list = [], date = new Date(now * 1000), mapped = !!(data && data.covers(me));
  for (const c of cellsAround(me, range, KIKI_CELL)) {
    const ctr = c.center;
    const ctx = { habitat: (mapped && data.habitatAt(ctr)) || rotatingHabitat(ctr, now, WORLD_SEED), night: isNight(ctr, date) };
    for (const s of activeSpawns(c.x, c.y, now, WORLD_SEED, KIKI_CELL, ctx, SPAWN_CHANCE)) {
      const at = c.at(s.e, s.n);
      if (data && !data.isSafe(at)) continue;
      addKiki(list, `k:${c.x}:${c.y}:${s.start}`, s.id, at, caught);
    }
  }
  if (mapped) {
    for (const s of data.stops()) list.push({ kind: 'stop', id: s.id, name: s.name, where: s.where });
    for (const c of data.circles()) addCircle(list, c.id, c.name, c.where, now, date, progress, caught, data);
  } else {
    for (const c of cellsAround(me, range, STOP_CELL)) {
      const r = rng(hash(WORLD_SEED, c.x, c.y, 5));
      list.push({ kind: 'stop', id: `s:${c.x}:${c.y}`, name: 'Supply Stop', where: c.at(STOP_CELL * (0.15 + 0.7 * r.next()), STOP_CELL * (0.15 + 0.7 * r.next())) });
    }
  }
  if (home) {
    addCircle(list, 'circle:home', 'Home Rune Circle', home, now, date, progress, caught, data);
    list.push({ kind: 'stop', id: 's:home', name: 'Circle Supply Stop', where: fromLocal(home, 9, -6) });
  }
  for (const t of list) { t.distance = distance(me, t.where); t.bearing = bearing(me, t.where); }
  const kept = list.filter(t => t.kind === 'circle' ? t.distance <= CIRCLE_RANGE : t.distance <= range);
  kept.sort((a, b) => a.distance - b.distance);
  return kept;
}
function addKiki(list, id, variantId, at, caught) {
  if (caught.has(id)) return;
  const v = variant(variantId);
  list.push({ kind: 'kiki', id, name: v.name, where: at, variant: v });
}
function addCircle(list, id, name, where, now, date, progress, caught, data) {
  const safe = p => !data || data.isSafe(p), salt = hash(id), keeper = progress && progress.keepers[id];
  let kv, att;
  if (keeper) { kv = variant(keeper.variant); att = keeper.att; }
  else { kv = pick({ habitat: 'Meadow', night: isNight(where, date) }, rng(hash(WORLD_SEED, Math.floor(now / 86400), 77, salt)).next()) || VARIANTS[0]; att = RARITY[kv.rarity].keeper; }
  const surge = surgeActive(now);
  list.push({ kind: 'circle', id, name, where, variant: kv, mine: !!keeper, keeperAtt: att, surge });
  { // the wanderer: one Kiki always near each circle
    const w = Math.floor(now / WINDOW), r = rng(hash(WORLD_SEED, w, 55, salt));
    const v = pick({ habitat: rotatingHabitat(where, now, WORLD_SEED), night: isNight(where, date) }, r.next());
    const a = r.next() * Math.PI * 2, d = 10 + r.next() * 14;
    for (let k = 0; k < 8 && v; k++) { const at = fromLocal(where, Math.cos(a + k * 0.8) * d, Math.sin(a + k * 0.8) * d); if (!safe(at)) continue; addKiki(list, `wander:${salt}:${w}`, v.id, at, caught); break; }
  }
  if (surge) { // Portal Surge: rarer Kikis pour out
    const si = Math.floor(now / SURGE_EVERY), r = rng(hash(WORLD_SEED, si, 99, salt));
    for (let i = 0; i < 4; i++) {
      const a = r.next() * Math.PI * 2, d = 8 + r.next() * 18, v = pick({ habitat: 'Meadow', night: isNight(where, date), crew: true }, r.next());
      const at = fromLocal(where, Math.cos(a) * d, Math.sin(a) * d);
      if (v && safe(at)) addKiki(list, `surge:${salt}:${si}:${i}`, v.id, at, caught);
    }
  }
}
