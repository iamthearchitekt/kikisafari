// Phase 3 (docs/ROADMAP.md): battles, healing, Rune Circle battles, factions and Portal Surge raids.
// The battle rules live in rules.js (Battle); this file is the arena on screen and the flows around it.
import { playMusic } from './music.js';
import * as THREE from '../vendor/three.module.min.js';
import * as C from './core.js';
import * as R from './rules.js';
import { makeKiki, KikiMotion, Sparkles, portrait } from './art.js';
import { $, toast, panel, hx, sfx, voice, pop, shake, reducedMotion, wait, debug } from './services.js';
import { liveStage, levelUps, guide, confirm } from './ui.js';
import { spiralRite } from './rite.js';
import { meadow, dais } from './meadow.js';
import { snapshot } from './online.js';

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const now = () => Math.floor(Date.now() / 1000);
const kp = k => 'kiki:' + k.sp + (k.sparkle ? ':s' : '');
const elChip = el => `<span class="el-chip" style="background:${R.ELEMENT_COLOR[el]}">${el}</span>`;
const hpBar = k => { const max = R.battleStats(k).maxHp, hp = R.hpOf(k); return `<div class="hpbar"><i style="width:${hp / max * 100}%;background:${hp / max > 0.5 ? '#5fd34b' : hp / max > 0.2 ? '#ffcf2e' : '#ff4d4d'}"></i></div>`; };

// ---------- choosing a team ----------
/** Pick up to n healthy Kikis (the strongest are picked for you). Resolves with the Kikis, or null. */
/** Pick up to n Kikis. `only` limits which (e.g. a league's power cap); `anyHp` lets hurt Kikis in (leagues heal everyone). */
export function chooseTeam(app, n, title, only = null, anyHp = false) {
  return new Promise(res => {
    const p = app.progress, ok = k => !k.keeping && (anyHp || R.hpOf(k) > 0) && (!only || only(k));
    let pick = [...p.kikis].filter(ok).sort((a, b) => R.power(b) - R.power(a)).slice(0, n).map(k => k.uid);
    const el = document.createElement('div'); el.className = 'screen-sheet'; $('overlay').appendChild(el);
    const render = () => {
      const list = [...p.kikis].filter(k => !only || only(k)).sort((a, b) => R.power(b) - R.power(a));
      el.innerHTML = `<div class="sheet-head"><button class="pill small cream" data-x>Back</button><h2>${esc(title)}</h2><span class="count sticker" style="padding:2px 10px">${pick.length} / ${n}</span></div>
        <p class="d" style="margin:0 0 8px;text-align:center">Tap Kikis to add or remove them. Fainted Kikis need Revival Dew from your bag.</p>
        <div class="sheet-body"><div class="cards">${list.map(k => { const hp = R.hpOf(k), on = pick.includes(k.uid), busy = !!k.keeping;
          const hp0 = hp === 0 && !anyHp;
          return `<div class="card sticker${on ? ' picked' : ''}${hp0 || busy ? ' unknown' : ''}" data-uid="${k.uid}">${on ? `<span class="pick-n">${pick.indexOf(k.uid) + 1}</span>` : ''}<img src="${portrait(kp(k), 160)}" alt=""><div class="pw">POWER ${R.power(k)}</div><div class="nm">${esc(k.nick || C.variant(k.sp).name)}</div>${hpBar(k)}${busy ? '<div class="no">keeping a circle</div>' : hp === 0 ? '<div class="no">fainted</div>' : ''}</div>`; }).join('')}</div></div>
        <div class="sheet-foot"><button class="pill" data-go ${pick.length ? '' : 'disabled'}>Let's go!</button></div>`;
      el.querySelector('[data-x]').onclick = () => { sfx('button', 0.3); el.remove(); res(null); };
      el.querySelector('[data-go]').onclick = () => { sfx('button', 0.4); el.remove(); res(pick.map(uid => p.kikis.find(k => k.uid === uid))); };
      el.querySelectorAll('[data-uid]').forEach(c => c.onclick = () => {
        const k = p.kikis.find(x => x.uid === +c.dataset.uid); if (k.keeping) return toast('That Kiki is keeping a Rune Circle.'); if (R.hpOf(k) === 0 && !anyHp) return toast('Fainted. Use Revival Dew from your bag.');
        if (pick.includes(k.uid)) pick = pick.filter(u => u !== k.uid); else if (n === 1) pick = [k.uid]; else if (pick.length < n) pick.push(k.uid); else { hx.light(); return toast(`Your team is full (${n}). Remove one first.`); }
        sfx('button', 0.25); render();
      });
    };
    render();
  });
}
/** After a battle, your Kikis keep the damage they took. */
function writeBack(app, team, fighters) {
  for (const f of fighters) { const k = team.find(x => x.uid === f.uid); if (!k) continue; const max = R.battleStats(k).maxHp; if (f.hp >= max) delete k.hp; else k.hp = f.hp; }
  app.save();
}

// ---------- the arena ----------
/**
 * Fight on screen. Tap anywhere to attack, swipe sideways to dodge, tap the charge button when it's full.
 * Resolves with 'win', 'lose', 'timeout' or 'run' and the Battle.
 */
export function runBattle(app, { mine, theirs, title, raid = false, time = 120, aiQuick = 1.7, aiCharged = 9, sync = null }) {
  playMusic(raid ? 'raid' : 'battle');
  return new Promise(res => {
    const b = new R.Battle(mine, theirs, { time, aiQuick, aiCharged, raid });
    const el = document.createElement('div'); el.className = 'battle' + (raid ? ' raid' : '');
    el.innerHTML = `<div class="bstage"></div>
      <div class="btop safe-top"><div class="bcard sticker them"></div><div class="btimer sticker"></div></div>
      <div class="btitle">${esc(title)}</div>
      <div class="bfloat"></div><div class="btele" hidden>!</div>
      <div class="bbottom"><div class="bcard sticker me"></div><button type="button" class="charge" aria-label="Charged move"><span class="cfill"></span><b></b></button></div>
      <div class="bhint">Tap to attack · swipe sideways to dodge</div>
      <button type="button" class="pill small cream brun">Run</button>`;
    $('overlay').appendChild(el); app.inBattle = true;
    const q = s => el.querySelector(s);
    let A, B, sparkles, motA, motB, cam, flashA = 0, flashB = 0, slide = 0, slideTo = 0;
    const PA = new THREE.Vector3(-0.42, 0.13, 1.15), PB = new THREE.Vector3(0.38, 0.13, -1.5), shots = []; // y: standing on the stone daises
    const st = liveStage(q('.bstage'), (scene, c) => {
      // Portrait phones see a narrow slice, so the camera pulls back and widens until both sides fit.
      cam = c; const tall = innerHeight > innerWidth; c.position.set(-0.55, tall ? 1.7 : 1.35, tall ? 5.4 : 4.4); c.lookAt(0.05, 0.55, -0.35); c.fov = tall ? 52 : 38; c.updateProjectionMatrix();
      // the arena: a meadow (a moonlit portal clearing for raids) with a carved stone dais under each side
      const md = meadow({ mood: raid ? 'raid' : 'day', keepClear: [{ x: PA.x, z: PA.z, r: 0.9 }, { x: PB.x, z: PB.z, r: raid ? 1.4 : 1.05 }], grassRadius: 7, treeRing: [11, 19], trees: 11 });
      scene.add(md.group); scene.fog = new THREE.Fog(md.fog, 12, 42);
      const dA = dais(0.62, 0x8fd8ff), dB = dais(raid ? 1.15 : 0.78, raid ? 0xc77dff : 0xff7ad9);
      dA.position.set(PA.x, 0.02, PA.z); dB.position.set(PB.x, 0.02, PB.z); scene.add(dA, dB);
      sparkles = new Sparkles(scene);
      return { update(dt, t) {
        md.update(dt, t); for (const d of [dA, dB]) d.userData.halo.material.opacity = 0.14 + Math.sin(t * 2 + (d === dA ? 0 : 1.5)) * 0.06;
        if (A) { A.position.set(PA.x + slide, PA.y, PA.z); slide += (slideTo - slide) * Math.min(1, dt * 14); if (Math.abs(slideTo) > 0 && Math.abs(slide - slideTo) < 0.02) slideTo = 0; A.scale.setScalar(A.userData.s * (1 + flashA * 0.12)); flashA = Math.max(0, flashA - dt * 4); motA.update(dt); }
        if (B) { B.scale.setScalar(B.userData.s * (1 + flashB * 0.12)); flashB = Math.max(0, flashB - dt * 4); motB.update(dt); }
        for (let i = shots.length - 1; i >= 0; i--) { const s = shots[i]; s.t += dt / s.dur; if (s.t >= 1) { scene.remove(s.m); shots.splice(i, 1); sparkles.burst(s.to, s.big ? 30 : 10, s.col, s.big ? 0.12 : 0.06, s.big ? 1.4 : 0.7, 0.6); continue; } s.m.position.lerpVectors(s.from, s.to, s.t).y += Math.sin(s.t * Math.PI) * (s.big ? 0.5 : 0.2); }
        sparkles.update(dt);
      }, scene };
    });
    const scene = st.api.scene;
    const put = (side, f) => {
      const old = side ? B : A; if (old) scene.remove(old);
      const h = side ? (raid ? 1.35 : 0.8) : 0.7, k = makeKiki(f.sp, h, f.sparkle), pos = side ? PB : PA; k.position.copy(pos);
      k.rotation.y = Math.atan2((side ? PA : PB).x - pos.x, (side ? PA : PB).z - pos.z); k.userData.s = k.scale.x; scene.add(k);
      const m = new KikiMotion(k, reducedMotion);
      if (side) { B = k; motB = m; } else { A = k; motA = m; }
    };
    put(0, b.me); put(1, b.them);
    const shoot = (side, big, el2) => {
      const col = new THREE.Color(R.ELEMENT_COLOR[el2]).getHex(), from = (side ? PB : PA).clone().add(new THREE.Vector3(side ? 0 : slide, side && raid ? 0.9 : 0.5, 0)), to = (side ? PA : PB).clone().add(new THREE.Vector3(side ? slide : 0, side ? 0.4 : (raid ? 0.8 : 0.5), 0));
      const m = new THREE.Mesh(new THREE.SphereGeometry(big ? 0.16 : 0.07, 12, 10), new THREE.MeshBasicMaterial({ color: col })); m.position.copy(from); scene.add(m);
      shots.push({ m, from, to, t: 0, dur: big ? 0.45 : 0.22, big, col });
      (side ? motB : motA).play((side ? motB : motA).tinyHops());
    };
    const float = (side, text, color) => {
      const p = (side ? PB : PA).clone(); p.y += side && raid ? 1.9 : 1.2; p.project(cam);
      const box = q('.bstage').getBoundingClientRect(), d = document.createElement('div'); d.className = 'bnum'; d.textContent = text; d.style.color = color;
      d.style.left = (box.left + (p.x + 1) / 2 * box.width) + 'px'; d.style.top = (box.top + (1 - p.y) / 2 * box.height) + 'px';
      q('.bfloat').appendChild(d); setTimeout(() => d.remove(), 1000);
    };
    const card = (f, side) => `<div class="bname">${esc(f.name)} ${elChip(f.el)} <span class="d">Lv ${f.lvl}</span></div><div class="hpbar big"><i style="width:${f.hp / f.maxHp * 100}%;background:${f.hp / f.maxHp > 0.5 ? '#5fd34b' : f.hp / f.maxHp > 0.2 ? '#ffcf2e' : '#ff4d4d'}"></i></div><div class="bteam">${b.sides[side].map(x => `<i class="${x.hp > 0 ? '' : 'out'}${x === f ? ' cur' : ''}"></i>`).join('')}<span class="d">${Math.ceil(f.hp)} / ${f.maxHp} HP</span></div>`;
    const hud = () => {
      if (b.me) q('.me').innerHTML = card(b.me, 0); if (b.them) q('.them').innerHTML = card(b.them, 1);
      const left = Math.max(0, Math.ceil(b.time - b.t)); q('.btimer').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
      const e = b.me ? b.me.energy : 0; q('.cfill').style.setProperty('--e', Math.min(1, e / R.CHARGED.cost));
      q('.charge b').textContent = b.me ? (e >= R.CHARGED.cost ? R.MOVES[b.me.el][1] + '!' : R.MOVES[b.me.el][1]) : ''; q('.charge').classList.toggle('ready', e >= R.CHARGED.cost);
    };
    const handle = evs => {
      for (const e of evs) {
        if (e.type === 'hit') {
          const target = e.side ? 0 : 1, att = e.side ? b.them : b.me;
          shoot(e.side, e.charged, (e.side ? b.sides[1][b.cur[1]] : b.sides[0][b.cur[0]]).el);
          setTimeout(() => {
            if (target) flashB = 1; else { flashA = 1; if (!reducedMotion() && e.charged) shake(q('.bstage'), 10, 300); }
            float(target, '-' + e.dmg, target ? '#fff27a' : '#ff9dba');
            if (e.dodged) float(0, 'Dodged!', '#36b6ff');
            if (e.eff > 1) float(target, 'Super effective!', '#5fd34b'); else if (e.eff < 1) float(target, 'Not very effective', '#c4c8e0');
            sfx(e.charged ? 'burst' : 'hit', e.charged ? 0.5 : 0.35); (e.charged ? hx.heavy : hx.light)();
          }, e.charged ? 430 : 210);
          if (e.charged && e.side === 0) pop(R.MOVES[att.el][1] + '!', R.ELEMENT_COLOR[att.el]);
        } else if (e.type === 'telegraph') { q('.btele').hidden = false; q('.btele').textContent = '!'; sfx('portal', 0.35); hx.warning(); setTimeout(() => { q('.btele').hidden = true; }, e.left * 1000); }
        else if (e.type === 'dodge') { slideTo = slide > 0 ? -0.55 : 0.55; sfx('throw', 0.3); }
        else if (e.type === 'faint') { const m = e.side ? motB : motA, k = e.side ? B : A; m.stop(); k.rotation.z = e.side ? -1.4 : 1.4; sfx('breakout', 0.4); }
        else if (e.type === 'switch') setTimeout(() => { put(e.side, e.who); (e.side ? motB : motA).play((e.side ? motB : motA).tinyHops()); toast(e.side ? `They sent out ${e.who.name}!` : `Go, ${e.who.name}!`, 1600); }, 700);
        else if (e.type === 'end') end(e.win ? 'win' : e.timeout ? 'timeout' : 'lose');
      }
      hud();
    };
    // input: tap to attack, swipe to dodge
    let down = null;
    el.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; down = [e.clientX, e.clientY]; });
    el.addEventListener('pointerup', e => {
      if (!down || b.done) { down = null; return; } const dx = e.clientX - down[0], dy = e.clientY - down[1]; down = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { slideTo = dx > 0 ? 0.55 : -0.55; handle(b.dodge()); hx.tick(); } else handle(b.quick());
    });
    q('.charge').onclick = () => handle(b.charged());
    q('.brun').onclick = async () => { if (b.done) return; if (await confirm('Run away from this battle?', 'Run', 'Keep fighting')) { b.done = 'run'; end('run'); } };
    let last = performance.now(), alive = true;
    const loop = t => { if (!alive) return; const dt = Math.min(0.05, (t - last) / 1000); last = t; handle(b.update(dt)); requestAnimationFrame(loop); };
    // Co-op raids: every 2 s, share your damage and take the boss's HP from everyone's.
    if (sync) { let busy = false; const tick = setInterval(async () => {
      if (!alive || b.done) { clearInterval(tick); return; } if (busy) return; busy = true;
      try { const r = await sync(b); if (r && alive) { if (r.hp < b.them.hp) handle(b.setHp(1, r.hp)); const others = r.players.filter(x => !x.me && x.active); q('.btitle').textContent = title + (others.length ? ` · with ${others.map(x => x.name).join(', ')}` : ''); } } catch (e) {}
      busy = false; }, 2000); }
    requestAnimationFrame(loop); hud();
    function end(result) {
      if (!alive) return; alive = false;
      setTimeout(() => {
        const box = document.createElement('div'); box.className = 'bend';
        box.innerHTML = `<h2 style="color:${result === 'win' ? '#ffcf2e' : '#ff9dba'}">${{ win: 'Victory!', lose: 'Your team fainted', timeout: "Time's up!", run: 'You ran away' }[result]}</h2><button class="pill play" style="font-size:28px;padding:8px 40px 12px">Continue</button>`;
        el.appendChild(box); if (result === 'win') { sfx('burst', 0.55); voice('yay', 0.7); hx.success(); } else { sfx('breakout', 0.4); hx.warning(); }
        box.querySelector('button').onclick = () => { sfx('button', 0.35); st.stop(); el.remove(); app.inBattle = false; playMusic('map'); res({ result, battle: b }); };
      }, result === 'run' ? 0 : 900);
    }
  });
}

// ---------- factions ----------
export function chooseFaction(app) {
  return new Promise(async res => {
    await guide("You've reached level 5, so Rune Circles will let you battle now. Explorers join one of three factions. Each looks after the circles in its own way. Pick the one that feels like you!", [['ok', 'Show me']]);
    const el = document.createElement('div'); el.className = 'screen-sheet';
    el.innerHTML = `<div class="sheet-head"><h2>Choose a faction</h2></div><div class="sheet-body">${Object.entries(R.FACTIONS).map(([id, f]) => `<button class="faction sticker" data-f="${id}" style="--fc:${f.color}"><b>${f.name}</b><span>${esc(f.motto)}</span></button>`).join('')}<p class="d" style="text-align:center">Your faction colours the Rune Circles your Kikis keep. You can't change it later.</p></div>`;
    $('overlay').appendChild(el);
    el.querySelectorAll('[data-f]').forEach(b => b.onclick = async () => {
      const f = R.FACTIONS[b.dataset.f]; if (!await confirm(`Join the <b style="color:${f.color}">${f.name}</b>?`, 'Join')) return;
      app.progress.faction = b.dataset.f; app.save(); el.remove(); sfx('burst', 0.5); hx.success(); toast(`Welcome to the ${f.name}!`, 2600); res(b.dataset.f);
    });
  });
}

// ---------- healing ----------
/** The best healing item for a Kiki right now (Revival Dew if it fainted). */
export function healKiki(app, k) {
  const p = app.progress, max = R.battleStats(k).maxHp, hp = R.hpOf(k);
  if (hp >= max) return toast('Already full of energy!');
  const order = hp === 0 ? ['pillow'] : max - hp > 80 && p.items.superstitch ? ['superstitch', 'stitch'] : ['stitch', 'superstitch'];
  const item = order.find(id => p.items[id] > 0);
  if (!item) { hx.warning(); return toast(hp === 0 ? 'You need Revival Dew. Spin supply stops to find some.' : 'You need a Herb Salve. Spin supply stops to find some.'); }
  const got = R.heal(p, k, item); app.save(); sfx('pickup', 0.45); hx.light(); toast(`${R.ITEMS[item].name}: +${got} HP`);
  return got;
}

// ---------- Rune Circles ----------
const surgeIndex = sec => Math.floor(sec / C.SURGE_EVERY);
export const raidFor = (t, sec) => (C.surgeActive(sec) || debug.surge) ? R.raidAt(t.id, surgeIndex(sec)) : null;
/** Can this explorer battle yet? Asks for a faction the first time. */
async function ready(app) {
  const p = app.progress;
  if (R.levelOf(p.xp) < R.BATTLE_LEVEL) { hx.light(); toast(`Battles open at explorer level ${R.BATTLE_LEVEL}. Keep catching!`, 3000); return false; }
  if (!p.faction) await chooseFaction(app);
  if (!p.kikis.some(k => R.hpOf(k) > 0 && !k.keeping)) { toast('All your Kikis need healing first. Use Herb Salves from your bag.', 3200); return false; }
  return true;
}
export async function circlePanel(app, t) {
  const p = app.progress, sec = now(), L = R.levelOf(p.xp), mine = p.keepers[t.id], keeper = mine && p.kikis.find(k => k.uid === mine.uid);
  const raid = raidFor(t, sec), raidDone = raid && p.raidsDone[raid.id], fc = p.faction && R.FACTIONS[p.faction];
  // Online: other explorers may keep this circle (Phase 4). Their Kikis replace the wild Keepers.
  let shared = null; if (app.online && app.online.signedIn) { try { shared = (await app.online.circles([t.id]))[t.id] || null; } catch (e) {} }
  const others = shared ? shared.keepers.filter(k => !k.mine) : [], sf = shared && R.FACTIONS[shared.faction];
  const friendly = shared && shared.faction === p.faction, canJoin = friendly && !mine && shared.keepers.length < 6;
  const team = mine || others.length ? [] : R.keeperTeam(t.id, sec, L), riteDone = (p.rites || {})[t.id] === R.dayKey(sec);
  const next = C.surgeNextIn(sec);
  const pn = panel(`<h2 style="color:${sf ? sf.color : mine && fc ? fc.color : '#7a00ff'}">${esc(t.name)}</h2>
    ${raid && !raidDone ? `<div class="raidbox sticker"><div class="t">PORTAL SURGE RAID ${'★'.repeat(raid.tier)}</div><img src="${portrait('kiki:' + raid.sp, 192)}" alt="" style="width:120px"><div><b>${C.variant(raid.sp).name}</b> ${elChip(C.variant(raid.sp).element)}</div><div class="d">Weak to ${R.weakTo(C.variant(raid.sp).element).join(' and ')}. Bring up to 6 Kikis${app.online && app.online.signedIn ? '. Anyone raiding here at the same time shares the boss' : ''}.</div>
      <button class="pill pink" data-raid>${R.canRaid(p, sec) ? (p.raidDay !== R.dayKey(sec) ? 'Raid (free today)' : 'Raid (1 Portal Key)') : 'Need a Portal Key'}</button></div>`
      : raid ? '<p class="d">You beat this Portal Surge raid. Well done!</p>' : `<p class="d">Next Portal Surge in ${Math.floor(next / 3600)}h ${String(Math.floor(next % 3600 / 60)).padStart(2, '0')}m. Raid bosses come through the portal.</p>`}
    ${mine ? `<p style="font-size:18px">${keeper ? `Your <b>${esc(keeper.nick || C.variant(keeper.sp).name)}</b>` : 'Your Kiki'} keeps this circle${fc ? ` for the <b style="color:${fc.color}">${fc.name}</b>` : ''}.</p>
        <p class="d">Circles gather 20 Sprouts every half hour for their keeper${app.online && app.online.signedIn ? ', and 1 coin for every 10 minutes it stays (up to 50 a day)' : ''}.</p>` : ''}
    ${others.length ? `<p style="margin-bottom:4px">Kept by the <b style="color:${sf ? sf.color : '#4d5aa6'}">${sf ? sf.name : 'explorers'}</b></p><div class="keepers">${others.map(k => `<div><img src="${portrait(kp(k.kiki), 128)}" alt=""><span>${esc(k.name)}<br>POWER ${R.power(k.kiki)}</span></div>`).join('')}</div>`
      : !mine ? `<p style="margin-bottom:4px">Wild Keepers</p><div class="keepers">${team.map(k => `<div><img src="${portrait('kiki:' + k.sp, 128)}" alt=""><span>POWER ${R.power(k)}</span></div>`).join('')}</div>` : ''}
    <div class="stack">
      ${mine ? '<button class="pill" data-collect>Collect Sprouts</button><button class="pill small cream" data-home>Call your keeper home</button>'
        : canJoin ? '<button class="pill" data-join>Add your Kiki to this circle</button>'
        : `<button class="pill" data-battle>${L >= R.BATTLE_LEVEL ? 'Battle the Keepers' : `Battles at level ${R.BATTLE_LEVEL}`}</button>`}
      <button class="pill small sky" data-rite>${riteDone ? 'Spiral Rite (practice)' : 'Spiral Rite (Sprouts today)'}</button>
      <button class="pill small cream" data-x>Close</button></div>`);
  const q = s => pn.root.querySelector(s);
  q('[data-x]').onclick = pn.close;
  q('[data-rite]').onclick = () => { pn.close(); spiralRite(app, t, att => {
    p.rites = p.rites || {}; if (p.rites[t.id] === R.dayKey(now())) { toast(`Attunement ${att}. Practice makes perfect!`); return; }
    p.rites[t.id] = R.dayKey(now()); const got = att * 3; p.sprouts += got; app.save(); toast(`Attunement ${att}: +${got} Sprouts!`, 2600); hx.success();
  }); };
  if (mine) {
    q('[data-collect]').onclick = () => { const got = C.progressApi.collectCircle(p, t.id, now()), coins = offlineCoins(app, t.id); app.save(); toast(got || coins ? `+${got} Sprouts${coins ? ` and ${coins} coins` : ''} from the circle!` : 'Nothing yet. Circles gather 20 Sprouts every half hour.'); if (got || coins) { hx.success(); sfx('pickup', 0.5); } };
    q('[data-home]').onclick = async () => {
      if (!await confirm('Call your keeper home? The circle goes back to wild Keepers.', 'Call home')) return;
      const got = C.progressApi.collectCircle(p, t.id, now()); offlineCoins(app, t.id); R.callHome(p, t.id); app.save(); pn.close();
      if (app.online && app.online.signedIn) { try { await app.online.circleHome(t.id); await app.checkIn(); } catch (e) {} }
      toast(`Your keeper is home${got ? ` with ${got} Sprouts` : ''}.`); app.world.nextPlan = 0;
    };
  } else if (canJoin) q('[data-join]').onclick = async () => { pn.close(); if (!await ready(app)) return; await keep(app, t); };
  else q('[data-battle]').onclick = async () => { pn.close(); await circleBattle(app, t, team, others.length > 0); };
  if (raid && !raidDone) q('[data-raid]').onclick = async () => { pn.close(); await raidBattle(app, t, raid); };
}
/** Playing offline, your keepers earn coins on this phone (online, the server pays them when they come home). */
function offlineCoins(app, id) {
  const kp = app.progress.keepers[id]; if (!kp || (app.online && app.online.signedIn)) return 0;
  const t = now(), c = R.keeperCoins(app.progress, kp.coinAt || kp.since, t); kp.coinAt = t; return c;
}
/** Leave one of your Kikis at the circle (online too, when signed in). */
async function keep(app, t) {
  const p = app.progress, pick = await chooseTeam(app, 1, 'Who keeps the circle?'); if (!pick || !pick[0]) return toast('Nobody stayed behind. The wild Keepers will be back.');
  if (app.online && app.online.signedIn) { try { await app.online.circleClaim(t.id, app.loc.fix, snapshot(pick[0])); } catch (e) { if (!/position|fast/.test(e.message)) toast(e.message, 3000); if (/beat the keepers|6 keepers|faction/.test(e.message)) return; } }
  R.takeCircle(p, t.id, pick[0], now()); app.save(); app.world.nextPlan = 0; sfx('burst', 0.5); hx.success();
  const f = R.FACTIONS[p.faction]; toast(`${pick[0].nick || C.variant(pick[0].sp).name} now keeps ${t.name}${f ? ' for the ' + f.name : ''}!`, 3200);
}
async function circleBattle(app, t, keepers, online) {
  if (!await ready(app)) return;
  const p = app.progress;
  let foes = keepers.map(k => R.fighter(k, { full: true }));
  if (online) { try { const d = await app.online.circleBattle(t.id); foes = d.map((x, i) => R.fighter({ uid: -1 - i, ...x.kiki, nick: x.kiki.nick || '' }, { full: true })); } catch (e) { return toast(e.message); } }
  const team = await chooseTeam(app, 3, 'Your team'); if (!team) return;
  const { result, battle } = await runBattle(app, { mine: team.map(k => R.fighter(k)), theirs: foes, title: t.name, time: 120 });
  writeBack(app, team, battle.sides[0]);
  if (result !== 'win') { if (team.some(k => R.hpOf(k) < R.battleStats(k).maxHp)) toast('Heal your Kikis with Herb Salves from your bag, then try again!', 3200); return; }
  p.stats.wins = (p.stats.wins || 0) + 1; const ups = R.giveXp(p, 600); R.addItems(p, { stitch: 2 }, true); app.save(); app.did({ type: 'battle' });
  await levelUps(app, ups);
  await keep(app, t);
}
async function raidBattle(app, t, raid) {
  if (!await ready(app)) return;
  const p = app.progress, sec = now();
  if (!R.canRaid(p, sec)) { hx.warning(); return toast("You've used today's free raid. Portal Keys come from level-ups and tasks.", 3400); }
  const team = await chooseTeam(app, 6, 'Raid team'); if (!team) return;
  R.payRaid(p, sec); app.save();
  const boss = R.raidBoss(raid); let sync = null;
  if (app.online && app.online.signedIn) { // co-op: everyone raiding this boss now shares its HP (it's tougher with more people)
    try {
      const st = await app.online.raidJoin(raid.id, app.loc.fix), n = Math.min(6, Math.max(1, st.players.filter(x => x.active || x.me).length));
      boss.maxHp = boss.hp = Math.round(boss.maxHp * (1 + 0.6 * (n - 1))); const startHp = Math.max(0, boss.maxHp - st.total);
      if (st.total) boss.hp = startHp;
      sync = async b => { const r = await app.online.raidHit(raid.id, b.dealt || 0); return { hp: boss.maxHp - r.total, players: r.players }; };
      if (n > 1) toast(`${n - 1} other explorer${n > 2 ? 's are' : ' is'} raiding here too!`, 2600);
    } catch (e) {}
  }
  const { result, battle } = await runBattle(app, { mine: team.map(k => R.fighter(k)), theirs: [boss], title: `${'★'.repeat(raid.tier)} Raid · ${t.name}`, raid: true, time: 180, aiQuick: 1.6, aiCharged: 8, sync });
  writeBack(app, team, battle.sides[0]);
  if (result !== 'win') return toast('The boss went back through the portal. Heal up and try the next surge!', 3400);
  const tier = R.RAID_TIERS[raid.tier], bonus = p.keepers[t.id] ? 2 : 0;
  p.raidsDone[raid.id] = 1; p.stats.raids = (p.stats.raids || 0) + 1; R.addItems(p, tier.items, true); const ups = R.giveXp(p, tier.xp); app.save(); app.did({ type: 'raid' });
  toast(`Raid rewards: ${Object.entries(tier.items).map(([id, n]) => n + ' ' + (n > 1 ? R.ITEMS[id].plural : R.ITEMS[id].name)).join(', ')}`, 3400);
  await levelUps(app, ups);
  await guide(`You beat the boss! It's weak now. Catch it before it slips back through the portal. You have <b>${tier.stones + bonus} Raid Stones</b>${bonus ? ' (2 extra because your Kiki keeps this circle)' : ''}.`, [['ok', 'Catch it!']]);
  app.raidCatch(raid, tier.stones + bonus);
}
