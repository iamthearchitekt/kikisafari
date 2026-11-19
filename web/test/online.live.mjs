// Live test against the game's Supabase project: node web/test/online.live.mjs
// Makes a few throwaway explorers, runs every online feature, then deletes them. Needs network access.
import assert from 'node:assert/strict';
import { Online, snapshot } from '../js/online.js';
const mem = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const kiki = (sp, lvl) => snapshot({ sp, lvl, iv: [10, 12, 14], h: 40, w: 0.5 });
const fails = async (p, re) => { try { await p; } catch (e) { assert.match(e.message, re); return; } assert.fail('expected an error matching ' + re); };
const home = { lat: 51.5, lon: -0.12 }, near = { lat: 51.5003, lon: -0.12 }, far = { lat: 51.502, lon: -0.12 };
const made = [];
let step = '';
try {
  step = 'sign in'; const A = new Online(mem()), B = new Online(mem()); made.push(A, B);
  const a = await A.hello('Ada Test', { outfit: 1, skin: 2 }), b = await B.hello('Bo Test', { outfit: 2, skin: 0 });
  assert.ok(a.id && a.friend_code.length === 8 && a.id !== b.id);
  await A.profile({ explorer: { name: 'Ada Test', outfit: 1, skin: 2 }, faction: 'tide', level: 12 });
  await B.profile({ explorer: { name: 'Bo Test', outfit: 2, skin: 0 }, faction: 'dusk', level: 12 });

  step = 'cloud save'; await A.savePut({ v: 2, xp: 5 }, 100); await A.savePut({ v: 2, xp: 1 }, 50);
  assert.equal((await A.saveGet()).data.xp, 5);

  step = 'friends'; assert.equal(await A.friendAdd(b.friend_code), 'requested'); assert.equal(await B.friendAdd(a.friend_code), 'friends');
  await fails(A.friendAdd(a.friend_code), /your own code/);
  let fa = await A.friends(); assert.equal(fa.friends.length, 1); assert.equal(fa.friends[0].name, 'Bo Test');

  step = 'gifts'; assert.equal(await A.giftSend(b.id, { rune: 3, egg: 1 }), 1);
  await fails(A.giftSend(b.id, { rune: 1 }), /already sent/); await fails(B.giftSend(a.id, { rune: 40 }), /bad gift/);
  assert.equal(await A.canNotify(b.id, 'gift'), true); assert.equal(await B.canNotify(a.id, 'gift'), false);
  const fb = await B.friends(); assert.equal(fb.gifts.length, 1); assert.deepEqual(await B.giftOpen(fb.gifts[0].id), { rune: 3, egg: 1 }); assert.equal(await B.giftOpen(fb.gifts[0].id), null);

  step = 'trade'; const code = await A.tradeOpen(home); assert.match(code, /^\d{4}$/);
  await fails(B.tradeJoin(code, far), /within 100 m/);
  let t = await B.tradeJoin(code, near); assert.equal(t.partner.name, 'Ada Test');
  await fails(A.tradeConfirm(code), /both of you/);
  await A.tradeOffer(code, kiki('pine', 10)); await B.tradeOffer(code, kiki('zap', 9));
  await fails(A.tradeOffer(code, kiki('pine', 39)), /bad level/); await fails(A.tradeOffer(code, kiki('dragon', 5)), /unknown kiki/);
  await A.tradeConfirm(code); t = await B.tradeConfirm(code); assert.equal(t.status, 'done'); assert.equal(t.theirs.sp, 'pine');

  step = 'league'; await A.leagueTeam('open', [kiki('blaze', 12), kiki('volt', 12)]); await B.leagueTeam('open', [kiki('crystal', 12)]);
  const m = await A.leagueMatch('open'); assert.ok(m && m.team.length >= 1);
  const r = await A.leagueResult(true); assert.ok(r > 1000); await fails(A.leagueResult(true), /no battle/);
  const top = await A.leagueTop('open'); assert.ok(top.top.length >= 2 && top.me.rank >= 1);

  step = 'circles'; const cid = 'test-circle-' + Date.now();
  await A.circleClaim(cid, home, kiki('blaze', 12));
  await fails(B.circleClaim(cid, near, kiki('crystal', 12)), /beat the keepers/);
  const keepers = await B.circleBattle(cid); assert.equal(keepers.length, 1);
  const st = await B.circleClaim(cid, near, kiki('crystal', 12)); assert.equal(st[cid].faction, 'dusk');
  const inbox = await A.inbox(); assert.equal(inbox.notes[0].kind, 'defeated'); assert.equal((await A.inbox()).notes.length, 0);
  assert.equal((await B.myKeepers()).length, 1); await B.circleHome(cid); assert.equal((await B.myKeepers()).length, 0);

  step = 'raid'; const rid = 'test-raid-' + Date.now();
  await A.raidJoin(rid, home); await B.raidJoin(rid, near);
  await A.raidHit(rid, 300); const rs = await B.raidHit(rid, 200); assert.equal(rs.total, 500); assert.equal(rs.players.length, 2);
  const cheat = await A.raidHit(rid, 999999); assert.ok(cheat.total < 5000, String(cheat.total));

  step = 'teleport check'; await fails(A.tradeOpen({ lat: 40.7, lon: -74 }), /moving too fast/);

  step = 'move to a new phone'; const linkCode = await A.linkCode(); const C = new Online(mem()); made.push(C);
  await C.hello('Temp'); const moved = await C.linkClaim(linkCode); assert.equal(moved.id, a.id); assert.equal(moved.save.data.xp, 5);
  await fails(A.friends(), /not signed in/); await fails(C.linkClaim(linkCode), /expired|not found/);
  console.log('online live test: all steps passed');
} catch (e) { console.log('FAILED at', step, '-', e.message); process.exitCode = 1; }
finally { for (const o of made) { try { await o.deleteMe(); } catch (e) {} } }
