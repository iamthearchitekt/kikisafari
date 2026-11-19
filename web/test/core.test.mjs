// Tests for the web port: node web/test/core.test.mjs  (mirrors the Unity project's EditMode tests)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as C from '../js/core.js';
import * as R from '../js/rules.js';
import { OsmArea, WorldData, placeLandmarks, DATA_CELL, CIRCLE_SPACING, STOP_SPACING } from '../js/osm.js';

let passed = 0, failed = 0;
const test = (name, fn) => { try { fn(); passed++; } catch (e) { failed++; console.log('FAIL', name, '\n  ', e.message); } };

test('wobbles by rarity', () => { assert.deepEqual(['Common', 'Rare', 'Epic', 'Legendary'].map(r => C.RARITY[r].wobbles), [1, 2, 3, 3]); });
test('quality from ring size', () => { assert.equal(C.quality(0.1), 'Excellent'); assert.equal(C.quality(0.4), 'Great'); assert.equal(C.quality(0.7), 'Nice'); assert.equal(C.quality(0.95), null); });
test('catch chance clamps and rises', () => {
  assert.ok(C.catchChance('Rare', null, false) < C.catchChance('Rare', 'Great', false));
  assert.ok(C.catchChance('Rare', 'Great', false) < C.catchChance('Rare', 'Great', true));
  assert.ok(C.catchChance('Common', 'Excellent', true, 10) <= 0.98);
});
test('miss never wobbles; catch plays all wobbles', () => {
  assert.equal(C.resolveThrow('Epic', { hit: false }).wobbles, 0);
  const o = C.resolveThrow('Rare', { hit: true, ring: 0.3 }, { next: () => 0, int: a => a });
  assert.equal(o.result, 'caught'); assert.equal(o.wobbles, 2);
});
test('catch rate matches chance', () => {
  const r = C.rng(42); let n = 0;
  for (let i = 0; i < 20000; i++) if (C.resolveThrow('Common', { hit: true, ring: 1 }, r).result === 'caught') n++;
  assert.ok(Math.abs(n / 20000 - 0.65) < 0.02);
});
test('reveal order: portal before wobbles, nothing spoken before the burst, waits for Keep playing', () => {
  const s = C.revealSteps({ result: 'caught', wobbles: 3 }, 'Epic', false), k = s.map(x => x.kind);
  assert.ok(k.indexOf('portalOpen') < k.indexOf('suck') && k.indexOf('suck') < k.indexOf('seal') && k.indexOf('seal') < k.indexOf('wobble'));
  assert.equal(k.filter(x => x === 'wobble').length, 3);
  assert.ok(s.slice(0, k.indexOf('burst')).every(x => !x.text));
  assert.equal(k[k.length - 1], 'keepPlaying');
  assert.ok(C.revealSteps({ result: 'missed' }, 'Common').every(x => !x.text));
  const b = C.revealSteps({ result: 'brokeout', wobbles: 1 }, 'Rare', true);
  assert.ok(b.every(x => !x.shake));
});
test('timing ring', () => { assert.equal(C.ringScale(0, 2), 1); assert.equal(C.ringScale(1, 2), 0); assert.equal(C.ringScale(0.5, 2), 0.5); });
test('aim assist hits with full help', () => {
  const o = { x: 0, y: 1.2, z: 0 }, t = { x: 0.3, y: 0.2, z: 2.5 }, g = 9.81;
  const v = C.aimAssist(o, t, { x: 2, y: 5, z: 1 }, g, 1), T = C.naturalTime(Math.hypot(0.3, 2.5));
  assert.ok(Math.abs(o.x + v.x * T - t.x) < 1e-9 && Math.abs(o.y + v.y * T - 0.5 * g * T * T - t.y) < 1e-9);
});
test('spawns: night-only Moonbeam, habitats, Golden Spiral rare', () => {
  const moon = C.variant('moonbeam');
  assert.equal(C.weight(moon, { habitat: 'Meadow', night: false }), 0);
  assert.ok(C.weight(moon, { habitat: 'Meadow', night: true }) > 0);
  assert.ok(C.weight(C.variant('pine'), { habitat: 'Woods' }) > C.weight(C.variant('pine'), { habitat: 'Town' }));
  const r = C.rng(7); let g = 0; for (let i = 0; i < 50000; i++) if (C.pick({ habitat: 'Town' }, r.next()).id === 'golden-spiral') g++;
  assert.ok(g > 0 && g / 50000 < 0.02);
});
test('geo round trip, bearings, grid', () => {
  const o = { lat: 40.7829, lon: -73.9654 }, p = C.fromLocal(o, 120, -80), l = C.toLocal(o, p);
  assert.ok(Math.abs(l.e - 120) < 0.01 && Math.abs(l.n + 80) < 0.01);
  assert.ok(Math.abs(C.bearing(o, C.fromLocal(o, 50, 0)) - 90) < 0.5);
  for (const lat of [-60, 0.1, 39, 64]) { const q = { lat, lon: 151 - lat }, c = C.cellOf(q, 70); assert.ok(c.contains(q)); assert.ok(Math.abs(C.distance(c.sw, { lat: c.sw.lat, lon: c.sw.lon + c.dLon }) - 70) < 3); }
});
test('night follows the local sun', () => {
  const ny = { lat: 40.7829, lon: -73.9654 };
  assert.equal(C.isNight(ny, new Date(Date.UTC(2026, 5, 20, 16))), false);
  assert.equal(C.isNight(ny, new Date(Date.UTC(2026, 5, 20, 5))), true);
  assert.ok(Math.abs(C.sunElevation(ny, new Date(Date.UTC(2026, 5, 21, 16, 57))) - 73.4) < 1);
});
test('spiral rite scoring', () => {
  const r = new C.SpiralRite(10); for (let i = 0; i < 10; i++) if (i !== 5) r.tap(r.beatTime(i)); r.advance(r.duration);
  assert.equal(r.attunement, 86);
  const g = new C.SpiralRite(4); assert.equal(g.tap(g.beatTime(0) + 0.12).judgement, 'good'); assert.equal(g.tap(g.beatTime(1) + 0.3), null);
});
test('keepers pay sprouts', () => {
  const p = C.newProgress(); C.progressApi.takeCircle(p, 'c', 'pine', 80, 1000);
  assert.equal(C.progressApi.collectCircle(p, 'c', 2700), 0); assert.equal(C.progressApi.collectCircle(p, 'c', 4700), 40);
});
test('live world: deterministic, sorted, home circle with wanderer and stop', () => {
  const me = { lat: 51.5079, lon: -0.0877 }, now = 1800000000;
  const a = C.nearby(me, now), b = C.nearby(me, now);
  assert.deepEqual(a.map(t => t.id), b.map(t => t.id));
  assert.ok(a.some(t => t.kind === 'kiki') && a.some(t => t.kind === 'stop'));
  for (let i = 1; i < a.length; i++) assert.ok(a[i - 1].distance <= a[i].distance);
  const h = C.nearby(me, now, { home: me, progress: C.newProgress() });
  assert.equal(h.filter(t => t.kind === 'circle').length, 1);
  assert.equal(h.filter(t => t.id.startsWith('wander:')).length, 1);
  assert.ok(h.some(t => t.id === 's:home' && t.distance < 20));
});

// OpenStreetMap, on the same made-up neighbourhood as the Unity tests.
const json = JSON.parse(readFileSync(new URL('./osm-fixture.json', import.meta.url)));
const fc = JSON.parse(readFileSync(new URL('./osm-fixture-cell.json', import.meta.url)));
const cell = C.cellMake(fc.x, fc.y, DATA_CELL), area = OsmArea.fromOverpass(json, cell.center);
const P = (e, n) => cell.at(e, n);
test('osm classification', () => {
  const n = k => area.features.filter(f => f.kind === k).length;
  assert.equal(n('road'), 11); assert.equal(n('path'), 1); assert.equal(n('park'), 1); assert.equal(n('water'), 2); assert.equal(n('landmark'), 6);
  assert.ok(n('building') > 50);
});
test('osm safety', () => {
  assert.equal(area.unsafe(P(20, 100)), 'road'); assert.equal(area.unsafe(P(51, 62)), 'building'); assert.equal(area.unsafe(P(230, 630)), 'school');
  assert.equal(area.unsafe(P(720, 175)), 'place_of_worship'); assert.equal(area.unsafe(P(425, 150)), 'memorial'); assert.equal(area.unsafe(P(610, 465)), 'water');
  assert.equal(area.unsafe(P(762, 300)), 'railway'); assert.equal(area.unsafe(P(470, 450)), null);
});
test('osm habitats', () => {
  assert.equal(area.habitatAt(P(470, 450)), 'Meadow'); assert.equal(area.habitatAt(P(300, 230)), 'Water'); assert.equal(area.habitatAt(P(100, 420)), 'Woods'); assert.equal(area.habitatAt(P(330, 700)), 'Town');
});
test('landmarks: notable circles spread out, stops spaced, nothing unsafe, every square covered', () => {
  const { stops, circles } = placeLandmarks(area, cell);
  assert.ok(circles.length >= 1 && circles.length <= 3);
  assert.ok(circles.some(c => /Willow|Old Mile|Big Spiral/.test(c.name)), circles.map(c => c.name).join());
  for (let i = 0; i < circles.length; i++) for (let j = i + 1; j < circles.length; j++) assert.ok(C.distance(circles[i].where, circles[j].where) >= CIRCLE_SPACING);
  for (let i = 0; i < stops.length; i++) for (let j = i + 1; j < stops.length; j++) assert.ok(C.distance(stops[i].where, stops[j].where) >= STOP_SPACING);
  const all = [...stops, ...circles];
  assert.ok(!all.some(s => s.name === 'Playground Mural' || s.name === 'Angel Statue'));
  for (const s of all) assert.equal(area.unsafe(s.where, true), null, s.name);
  for (let e = 125; e < 750; e += 250) for (let n = 125; n < 750; n += 250) assert.ok(Math.min(...all.map(s => C.distance(s.where, P(e, n)))) < 260);
});
test('live world uses real data and keeps Kikis safe', () => {
  const data = new WorldData(); data.add(cell, area);
  for (let t = 1800000000; t < 1800000000 + 4 * 3600; t += 1800) {
    const list = C.nearby(cell.center, t, { data, progress: C.newProgress() });
    assert.ok(list.filter(x => x.kind === 'stop').every(x => x.id.startsWith('osm:') || x.id.startsWith('fill:')));
    assert.ok(list.some(x => x.kind === 'circle'));
    for (const k of list.filter(x => x.kind === 'kiki')) assert.ok(data.isSafe(k.where), k.id + ' ' + area.unsafe(k.where));
  }
});

// ---------- Phase 1 rules ----------
test('species table: numbers, families and evolutions line up', () => {
  assert.deepEqual(R.SPECIES.map(v => v.no), R.SPECIES.map((v, i) => i + 1)); assert.ok(R.SPECIES.length >= 40);
  assert.equal(new Set(C.VARIANTS.map(v => v.id)).size, C.VARIANTS.length);
  for (const v of C.VARIANTS) { assert.ok(v.family && v.base && v.cm && v.kg && v.blurb && R.ELEMENTS.includes(v.element), v.id); if (v.evolvesTo) { assert.equal(C.variant(v.evolvesTo).family, v.family); assert.equal(C.variant(v.evolvesTo).element, v.element); } }
  assert.equal(R.fluffName('pine'), 'Pine Fluff');
});
test('levels and XP', () => {
  assert.equal(R.levelOf(0), 1); assert.equal(R.levelOf(999), 1); assert.equal(R.levelOf(1000), 2); assert.equal(R.levelOf(10000), 5); assert.equal(R.levelOf(1e9), R.MAX_LEVEL);
  const p = R.newSave(), ups = R.giveXp(p, 10000);
  assert.deepEqual(ups.map(u => u.level), [2, 3, 4, 5]);
  assert.ok(ups.find(u => u.level === 5).unlocks.includes('moon') && p.items.moon === 15);
});
test('bag limit', () => {
  const p = R.newSave(); p.items.rune = R.BAG_MAX - 3;
  assert.deepEqual(R.addItems(p, { rune: 2, honey: 5 }), { rune: 2, honey: 1 });
  assert.equal(R.bagCount(p), R.BAG_MAX);
  assert.ok(R.useItem(p, 'honey') && !R.useItem(p, 'star'));
});
test('individual Kikis: power grows with level, wild stats repeat, sizes sensible', () => {
  const a = R.wildKiki('k:1:2:3', 'meadow', 20), b = R.wildKiki('k:1:2:3', 'meadow', 20);
  assert.deepEqual(a, b); assert.ok(a.lvl >= 1 && a.lvl <= 20);
  assert.ok(R.wildKiki('x', 'meadow', 1).lvl === 1);
  const k = { ...a, lvl: 10 }, k2 = { ...a, lvl: 11 }; assert.ok(R.power(k2) > R.power(k));
  const r = C.rng(5); let xs = 0, xl = 0;
  for (let i = 0; i < 5000; i++) { const z = R.rollKiki('pine', 5, r); assert.ok(z.iv.every(x => x >= 0 && x <= 15)); if (z.size === 'XS') xs++; if (z.size === 'XL') xl++; }
  assert.ok(xs > 100 && xs < 600 && xl > 100 && xl < 600, xs + ' ' + xl);
  assert.equal(R.appraise({ iv: [15, 15, 15] }).perfect, true); assert.equal(R.appraise({ iv: [0, 5, 5] }).stars, 0);
});
test('power up, evolve, send home', () => {
  const p = R.newSave(); p.xp = R.xpFor(10); p.sprouts = 10000; p.fluff.sprout = 30;
  const k = R.addKiki(p, R.rollKiki('sprout', 5, C.rng(1)), 1000);
  const before = R.power(k); assert.ok(R.powerUp(p, k)); assert.equal(k.lvl, 6); assert.ok(R.power(k) > before); assert.equal(p.fluff.sprout, 29); assert.equal(p.sprouts, 9600);
  k.lvl = 12; assert.equal(R.canPowerUp(p, k).ok, false); // explorer level 10 caps Kikis at 12
  const e = R.evolve(p, k); assert.equal(e.to.id, 'bloom'); assert.equal(k.sp, 'bloom'); assert.equal(p.fluff.sprout, 4); assert.ok(e.first && p.caught.bloom === 1);
  assert.equal(R.canEvolve(p, k).ok, false);
  k.fav = true; assert.equal(R.sendHome(p, k.uid), false); k.fav = false; assert.ok(R.sendHome(p, k.uid)); assert.equal(p.kikis.length, 0); assert.equal(p.fluff.sprout, 5);
});
test('catch odds: items and good throws help, high levels are harder, never certain', () => {
  const o = (opt, lvl = 5) => R.catchOdds('Rare', lvl, opt);
  assert.ok(o({}) < o({ stone: 'moon' }) && o({ stone: 'moon' }) < o({ stone: 'star' }));
  assert.ok(o({}) < o({ treat: 'honey' }) && o({}) === o({ treat: 'sunseed' }));
  assert.ok(o({ q: 'Excellent', spin: true }) > o({ q: 'Nice' }));
  assert.ok(o({}, 30) < o({}, 1));
  assert.ok(R.catchOdds('Common', 1, { stone: 'star', treat: 'honey', q: 'Excellent', spin: true, odds: 10 }) <= 0.98);
  assert.equal(R.ringColor(0.7), '#5fd34b'); assert.equal(R.ringColor(0.1), '#ff4d4d');
});
test('break-outs can run away; guaranteed catches always land', () => {
  const r = C.rng(9); let fled = 0, out = 0;
  for (let i = 0; i < 20000; i++) { const x = R.resolveCatch('Common', 30, { hit: true, ring: 1 }, r); if (x.result === 'fled') fled++; if (x.result !== 'caught') out++; }
  assert.ok(Math.abs(fled / out - R.FLEE.Common) < 0.02, String(fled / out));
  assert.equal(R.resolveCatch('Legendary', 30, { hit: true, ring: 1, guaranteed: true }, r).result, 'caught');
  assert.equal(R.resolveCatch('Rare', 1, { hit: false }).result, 'missed');
});
test('catch rewards and Sun Seed', () => {
  const p = R.newSave(), a = R.catchRewards(p, 'pine', { quality: 'Great', spin: true });
  assert.equal(a.xpTotal, 100 + 50 + 10 + 500); assert.equal(a.fluff, 3); assert.equal(a.family, 'pine');
  assert.equal(R.catchRewards(p, 'golden-spiral', { treat: 'sunseed' }).fluff, 20);
});
test('supply stops: 3 to 5 items, only unlocked ones', () => {
  const r = C.rng(3);
  for (let i = 0; i < 500; i++) { const a = R.stopRoll(1, r), n = Object.values(a).reduce((x, y) => x + y, 0); assert.ok(n >= 3 && n <= 5); assert.deepEqual(Object.keys(a), ['rune']); }
  let star = 0; for (let i = 0; i < 500; i++) if (R.stopRoll(12, r).star) star++; assert.ok(star > 50);
});
test('daily streaks: once a day, 7 days in a row pays the bonus, a missed day resets', () => {
  const p = R.newSave(), day = 86400, t0 = Math.floor(new Date(2026, 10, 1, 12).getTime() / 1000);
  for (let i = 0; i < 6; i++) { const d = R.daily(p, 'catch', t0 + i * day); assert.equal(d.day, i + 1); assert.equal(d.bonus, false); assert.equal(R.daily(p, 'catch', t0 + i * day + 60), null); }
  const seven = R.daily(p, 'catch', t0 + 6 * day); assert.ok(seven.bonus && seven.xp === R.XP.streak);
  assert.equal(R.daily(p, 'catch', t0 + 7 * day).day, 1);
  assert.equal(R.daily(p, 'catch', t0 + 9 * day).day, 1);
  assert.equal(R.streakNow(p, 'catch', t0 + 9 * day), 1); assert.equal(R.streakNow(p, 'catch', t0 + 12 * day), 0);
});
test('spawns you caught or scared off stay gone, then expire', () => {
  const p = R.newSave(); R.markGone(p, 'k:1', 1000);
  assert.ok(R.goneSet(p, 2000).has('k:1')); assert.ok(!R.goneSet(p, 1000 + 46 * 60).has('k:1'));
});
test('old saves move to the new format', () => {
  const v1 = { v: 1, stones: 12, sprouts: 900, throws: 20, catches: 3, caught: { meadow: 2, rainbow: 1 }, stops: { a: 5 }, keepers: { c: { variant: 'pine', att: 70, since: 1, last: 1 } } };
  const s = R.migrate(v1, 5000);
  assert.equal(s.v, 2); assert.equal(s.items.rune, 12); assert.equal(s.sprouts, 900); assert.equal(s.kikis.length, 3);
  assert.equal(s.caught.meadow, 2); assert.equal(s.fluff.meadow, 6); assert.equal(s.fluff.rainbow, 5); assert.equal(s.tutorial, 'explorer'); assert.ok(s.keepers.c);
  assert.equal(R.migrate(null).tutorial, 'start');
  const again = R.migrate(JSON.parse(JSON.stringify(s))); assert.deepEqual(again, s);
});

// ---------- Phase 2 ----------
test('element wheel: two strengths and two weaknesses each, never both ways', () => {
  for (const a of R.ELEMENTS) { assert.equal(R.STRONG[a].length, 2); assert.equal(R.weakTo(a).length, 2); for (const b of R.STRONG[a]) assert.ok(!R.STRONG[b].includes(a), a + b); }
  assert.equal(R.effectiveness('Water', 'Ember'), 1.6); assert.equal(R.effectiveness('Ember', 'Water'), 0.625); assert.equal(R.effectiveness('Leaf', 'Moon'), 1);
});
test('every element can spawn in the wild and hatch from an egg; legendaries only from raids and rewards', () => {
  for (const el of R.ELEMENTS) { assert.ok(C.VARIANTS.some(v => v.element === el && v.weight > 0), el); assert.ok(C.VARIANTS.some(v => v.element === el && v.egg), el); }
  for (const km of R.EGG_KM) assert.ok(R.eggPool(km).length >= 2);
  assert.ok(C.VARIANTS.filter(v => v.rarity === 'Legendary' && !v.weight).length >= 5);
});
test('weather codes and boosts', () => {
  assert.equal(R.weatherFrom(0, true), 'sunny'); assert.equal(R.weatherFrom(1, false), 'clear'); assert.equal(R.weatherFrom(3, true), 'cloudy'); assert.equal(R.weatherFrom(61, true), 'rain');
  assert.equal(R.weatherFrom(95, true), 'storm'); assert.equal(R.weatherFrom(73, true), 'snow'); assert.equal(R.weatherFrom(45, true), 'fog'); assert.equal(R.weatherFrom(2, true, 40), 'windy');
  for (const el of R.ELEMENTS) assert.ok(Object.values(R.WEATHER).some(w => w.boost.includes(el)), el);
  const r = C.rng(4); let leaf = 0, leafB = 0; for (let i = 0; i < 20000; i++) { if (C.pick({ habitat: 'Town' }, r.next()).element === 'Leaf') leaf++; if (C.pick({ habitat: 'Town', boost: ['Leaf'] }, r.next()).element === 'Leaf') leafB++; }
  assert.ok(leafB > leaf * 1.5, leaf + ' ' + leafB);
  const k = R.wildKiki('k:x', 'meadow', 10, { boosted: true }); assert.ok(k.boosted && k.lvl >= 4);
});
test('night Kikis and featured events', () => {
  const r = C.rng(8); let dusk = 0, duskN = 0, feat = 0;
  for (let i = 0; i < 20000; i++) { if (C.pick({ habitat: 'Meadow' }, r.next()).id === 'dusk') dusk++; if (C.pick({ habitat: 'Meadow', night: true }, r.next()).id === 'dusk') duskN++; if (C.pick({ habitat: 'Meadow', featured: 'pebble' }, r.next()).id === 'pebble') feat++; }
  assert.ok(duskN > dusk * 2); assert.ok(feat > 4000, String(feat));
});
test('sparkle odds', () => { let n = 0; for (let i = 0; i < 90000; i++) if (R.isSparkle('k:' + i)) n++; assert.ok(n > 120 && n < 290, String(n)); let m = 0; for (let i = 0; i < 9000; i++) if (R.isSparkle('k:' + i, 18)) m++; assert.ok(m > 350 && m < 650); });
test('eggs: from stops, warm in a nest, hatch by walking, extra nests wear out', () => {
  const p = R.newSave(), r = C.rng(2);
  for (let i = 0; i < 12; i++) R.newEgg(p, r);
  assert.equal(p.eggs.length, R.EGG_MAX); assert.ok(p.eggs.every(e => R.eggPool(e.km).some(v => v.id === e.sp)));
  const e2 = p.eggs.find(e => e.km === 2) || p.eggs[0];
  assert.ok(R.incubate(p, e2.id, 'warm')); assert.ok(!R.incubate(p, p.eggs.find(e => e !== e2).id, 'warm'));
  p.nests.push({ id: 'cozy', uses: 1, egg: null }); const e5 = p.eggs.find(e => e !== e2); R.incubate(p, e5.id, 'cozy');
  assert.equal(R.walkEggs(p, e2.km - 0.5).length, e2.km - 0.5 >= e5.km ? 1 : 0);
  const hatched = R.walkEggs(p, 20); assert.ok(hatched.some(e => e.id === e2.id) && hatched.some(e => e.id === e5.id));
  assert.equal(p.nests.length, 1); assert.equal(p.nests[0].egg, null);
  const k = R.hatchKiki(e2, 30, r); assert.ok(k.lvl === 20 && k.iv.every(x => x >= 10));
});
test('buddy finds Fluff as you walk', () => {
  const p = R.newSave(), k = R.addKiki(p, R.rollKiki('pine', 5, C.rng(1)), 1); R.setBuddy(p, k.uid);
  assert.equal(R.walkBuddy(p, 0.6), 0); assert.equal(R.walkBuddy(p, 0.6), 1); assert.equal(p.fluff.pine, 1); assert.ok(Math.abs(p.buddy.km - 0.2) < 1e-9);
  assert.equal(R.walkBuddy(p, 2.05), 2);
});
test('tasks: one per stop per day, tracked, claimed for a stamp; seven stamps fill the card', () => {
  const p = R.newSave(), t0 = Math.floor(new Date(2026, 10, 2, 12).getTime() / 1000);
  const a = R.giveTask(p, 'stop1', t0); R.giveTask(p, 'stop2', t0); R.giveTask(p, 'stop3', t0); assert.equal(R.giveTask(p, 'stop4', t0), null);
  a.type = 'catch'; a.el = 'Water'; a.q = undefined; a.n = 2;
  assert.equal(R.track(p, { type: 'catch', el: 'Leaf' }).filter(x => !x.story).length, 0);
  R.track(p, { type: 'catch', el: 'Water' }); const done = R.track(p, { type: 'catch', el: 'Water' }).filter(x => !x.story);
  assert.ok(done.includes(a)); const c = R.claimTask(p, a.id, t0); assert.ok(c.stamp && !c.card && p.stamps.n === 1);
  const q = { id: 99, type: 'throw', q: 'Nice', n: 1, got: 0 }; p.tasks.push(q); R.track(p, { type: 'throw', q: 'Excellent' }); assert.equal(q.got, 1);
  assert.equal(R.claimTask(p, 99, t0).stamp, false); // one stamp a day
  p.stamps.n = 6; const t = { id: 100, type: 'spin', n: 1, got: 1 }; p.tasks.push(t); assert.ok(R.claimTask(p, 100, t0 + 86400).card);
});
test('story chapters advance', () => {
  const p = R.newSave();
  for (let i = 0; i < 3; i++) R.track(p, { type: 'catch' }); R.track(p, { type: 'spin', n: 2 }); assert.ok(!R.chapterReady(p));
  for (let i = 0; i < 3; i++) R.track(p, { type: 'throw', q: 'Great' });
  assert.ok(R.chapterReady(p)); assert.equal(R.claimChapter(p).title, R.STORY[0].title); assert.equal(p.story.ch, 1);
  assert.equal(R.STORY[R.STORY.length - 1].reward.kiki, 'golden-spiral');
});
test('medals reach tiers once', () => {
  const p = R.newSave(); p.stats.catches = 12; p.stats.el.Leaf = 11;
  const got = R.newMedals(p).map(x => x.m.id + x.tier); assert.ok(got.includes('collector1') && got.includes('el-Leaf1'));
  assert.equal(R.newMedals(p).length, 0); p.stats.catches = 150; assert.deepEqual(R.newMedals(p).map(x => x.m.id + x.tier), ['collector2']);
});
test('event calendar: weekends, parades, Kiki Day, full moon', () => {
  const at = (y, m, d, h) => Math.floor(new Date(y, m, d, h).getTime() / 1000);
  assert.ok(R.eventsAt(at(2026, 10, 21, 12)).some(e => e.name.endsWith('Weekend'))); // a Saturday
  assert.equal(R.eventsAt(at(2026, 10, 17, 12)).length, 0); // a Tuesday noon
  assert.ok(R.eventsAt(at(2026, 10, 18, 18)).some(e => e.featured && e.xp === 2)); // Wednesday 6 pm
  assert.ok(R.eventsAt(at(2026, 10, 7, 15)).some(e => e.name === 'Kiki Day')); // first Saturday
  let full = 0; for (let d = 0; d < 60; d++) if (R.eventsAt(at(2026, 0, 1 + d, 22)).some(e => e.name === 'Full Moon')) full++; assert.ok(full >= 2 && full <= 6, String(full));
  const m = R.eventMods([{ boost: ['Leaf'], sprouts: 2 }, { featured: 'zap', xp: 3, sparkle: 18 }]); assert.deepEqual([m.boost, m.featured, m.xp, m.sprouts, m.sparkle], [['Leaf'], 'zap', 3, 2, 18]);
});

// ---------- Phase 3 ----------
/** A simulated player: taps twice a second, fires charged moves when ready, dodges some telegraphed attacks. */
function simulate(b, dodgeRate, r = C.rng(5)) {
  let tap = 0, dodgeAt = null;
  for (let i = 0; i < 20000 && !b.done; i++) {
    const dt = 0.05; tap -= dt;
    for (const e of b.update(dt)) if (e.type === 'telegraph' && r.next() < dodgeRate) dodgeAt = b.t + 0.7;
    if (dodgeAt != null && b.t >= dodgeAt) { b.dodge(); dodgeAt = null; }
    if (b.me && b.me.energy >= R.CHARGED.cost) b.charged(); else if (tap <= 0) { b.quick(); tap = 0.5; }
  }
  return b.done;
}
const kid = (sp, lvl, iv = [10, 10, 10]) => ({ uid: Math.random(), sp, lvl, iv });
test('battle maths: elements matter, stats grow with level', () => {
  const w = R.fighter(kid('puddle', 10)), e = R.fighter(kid('ember', 10));
  assert.ok(R.damage(R.CHARGED.power, w, e) > R.damage(R.CHARGED.power, e, w) * 1.5);
  assert.ok(R.battleStats(kid('pine', 20)).maxHp > R.battleStats(kid('pine', 10)).maxHp);
  assert.equal(R.MOVES.Leaf.length, 2);
});
test('battles end: faint, switch, win, lose, time out', () => {
  const mine = [R.fighter(kid('blaze', 15)), R.fighter(kid('volt', 15))], theirs = [R.fighter(kid('acorn', 6), { full: true })];
  const b = new R.Battle(mine, theirs); assert.equal(simulate(b, 0.5), 'win');
  const weak = new R.Battle([R.fighter(kid('sprout', 2))], [R.fighter(kid('tide', 30), { full: true })]); assert.equal(simulate(weak, 0), 'lose');
  const slow = new R.Battle([R.fighter(kid('boulder', 30))], [R.fighter(kid('crystal', 30), { full: true, hpMult: 50 })], { time: 20 }); assert.equal(simulate(slow, 1), 'timeout');
  const f = R.fighter(kid('zap', 5)); f.hp = 0; assert.equal(new R.Battle([f, R.fighter(kid('pine', 5))], [R.fighter(kid('pine', 5))]).sides[0].length, 1);
});
test('dodging telegraphed charged moves cuts their damage to a quarter', () => {
  const b = new R.Battle([R.fighter(kid('pebble', 10))], [R.fighter(kid('pebble', 10), { full: true })]);
  b.tele = { left: 0.3 }; b.dodge(); const hp = b.me.hp; const ev = b.update(0.31).find(e => e.type === 'hit');
  assert.ok(ev.dodged && hp - b.me.hp === ev.dmg && ev.dmg <= Math.floor(R.damage(R.CHARGED.power, b.them, b.me) * 0.25) + 1);
});
test('raids: winnable with a good team and some dodging, hard without', () => {
  const team = n => ['blaze', 'brook', 'volt', 'boulder', 'glowcap', 'oak'].slice(0, n).map(sp => R.fighter(kid(sp, 20)));
  const odds = (tier, n, dodge) => { let w = 0; for (let i = 0; i < 12; i++) { const raid = { sp: tier === 5 ? 'summit' : tier === 3 ? 'crystal' : 'grand-meadow', tier }; if (simulate(new R.Battle(team(n), [R.raidBoss(raid)], { time: 180, aiQuick: 1.6, aiCharged: 8, raid: true }), dodge, C.rng(i)) === 'win') w++; } return w / 12; };
  assert.ok(odds(1, 3, 0.5) > 0.8, 'tier 1 with 3'); assert.ok(odds(3, 6, 0.6) > 0.6, 'tier 3 with 6'); assert.ok(odds(5, 6, 0.8) > 0.3, 'tier 5 with 6 and good dodging');
  assert.ok(odds(5, 3, 0) < 0.3, 'tier 5 is hard with 3 and no dodging');
});
test('healing and reviving', () => {
  const p = R.newSave(), k = R.addKiki(p, R.rollKiki('pine', 10, C.rng(1)), 1), max = R.battleStats(k).maxHp;
  p.items.stitch = 2; p.items.pillow = 1; k.hp = 0;
  assert.equal(R.heal(p, k, 'stitch'), false); assert.ok(R.heal(p, k, 'pillow') > 0); assert.equal(k.hp, Math.ceil(max / 2));
  assert.ok(R.heal(p, k, 'stitch') > 0); assert.equal(R.heal(p, k, 'stitch'), false); assert.equal(R.hpOf(k), max); assert.equal(k.hp, undefined); assert.equal(p.items.stitch, 1);
});
test('circle keepers and raids are the same on every phone; one free raid a day', () => {
  const a = R.keeperTeam('osm:n1', 1800000000, 12), b = R.keeperTeam('osm:n1', 1800000000, 12);
  assert.deepEqual(a, b); assert.ok(a.length >= 1 && a.length <= 3 && a.every(k => k.lvl >= 3 && k.lvl <= 30));
  const tiers = { 1: 0, 3: 0, 5: 0 }; for (let i = 0; i < 600; i++) tiers[R.raidAt('c' + i, 7).tier]++;
  assert.ok(tiers[1] > 180 && tiers[3] > 180 && tiers[5] > 60, JSON.stringify(tiers));
  assert.ok(C.variant(R.raidAt('c1', 7).sp)); assert.deepEqual(R.raidAt('c1', 7), R.raidAt('c1', 7));
  const p = R.newSave(), t = Math.floor(new Date(2026, 10, 5, 12).getTime() / 1000);
  assert.equal(R.payRaid(p, t), 'free'); assert.equal(R.canRaid(p, t), false); p.items.key = 1; assert.equal(R.payRaid(p, t), 'key'); assert.equal(R.payRaid(p, t + 86400), 'free');
  const k = R.addKiki(p, R.rollKiki('pine', 10, C.rng(1)), 1); R.takeCircle(p, 'c9', k, t); assert.equal(k.keeping, 'c9'); assert.equal(R.sendHome(p, k.uid), false);
  assert.ok(!R.bestTeam(p, 3).includes(k)); R.callHome(p, 'c9'); assert.ok(!k.keeping && !p.keepers.c9);
  const ups = R.giveXp(p, R.xpFor(5)); assert.ok(ups.find(u => u.level === 5).items.stitch === 10 && p.items.key >= 1);
});

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
