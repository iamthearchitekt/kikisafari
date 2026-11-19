// Phase 5: the coin shop (in-game coins only, earned by keeping Rune Circles and winning medals) and the privacy page.
import * as R from './rules.js';
import { portrait } from './art.js';
import { $, toast, panel, hx, sfx } from './services.js';

function screen(html) { const el = document.createElement('div'); el.className = 'screen-sheet'; el.innerHTML = html; $('overlay').appendChild(el); return { root: el, q: s => el.querySelector(s), close: () => el.remove() }; }
const icon = it => it.items ? `item:${Object.keys(it.items)[0]}` : it.nest ? 'egg:2' : it.bag ? 'item:gift' : 'kiki:meadow';

export function openShop(app) {
  const p = app.progress;
  const s = screen(`<div class="sheet-head"><button class="pill small cream" data-x>Back</button><h2>Shop</h2><span class="coins sticker"><i class="coin"></i><b></b></span></div>
    <p class="sticker" style="padding:6px 12px;margin:0 0 10px;text-align:center;font-weight:500">Coins come from keeping Rune Circles (1 for every 10 minutes, up to 50 a day) and from medals. No real money, ever.</p>
    <div class="sheet-body"></div>`);
  s.q('[data-x]').onclick = () => { sfx('button', 0.3); s.close(); };
  const render = () => {
    s.q('.coins b').textContent = (p.coins || 0).toLocaleString();
    s.q('.sheet-body').innerHTML = R.SHOP.map(it => { const c = R.canBuy(p, it), locked = it.level && R.levelOf(p.xp) < it.level;
      return `<div class="list-row sticker${locked ? ' locked' : ''}"><img src="${portrait(icon(it), 128)}" alt=""><div class="grow"><div class="t">${locked ? '???' : it.name}</div><div class="d">${locked ? `Unlocks at level ${it.level}` : it.bag ? `Your bag holds ${R.bagMax(p)} now` : it.box ? `Room for ${R.kikiMax(p)} Kikis now` : it.nest ? 'Hatch one more egg at a time, three times' : ''}</div></div>
        <button class="pill small${c.ok ? '' : ' cream'}" data-buy="${it.id}" ${locked ? 'disabled' : ''}><i class="coin"></i>${it.price}</button></div>`; }).join('');
    s.root.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => {
      const it = R.SHOP.find(x => x.id === b.dataset.buy), c = R.canBuy(p, it);
      if (!c.ok) { hx.warning(); return toast(c.why); }
      R.buy(p, it.id); app.save(); sfx('pickup', 0.5); hx.success(); toast(`Bought: ${it.name}!`); render();
    });
  };
  render();
}

export function openPrivacy() {
  const pn = panel(`<h2>Privacy</h2><div style="text-align:left;font-weight:500;font-size:15px">
    <p><b>On this phone:</b> your explorer, Kikis, items and settings. "Start over" in Testing tools deletes them.</p>
    <p><b>Location</b> is used only while the game is open, to place Kikis and landmarks around you. It is never stored online, except your last spot when you trade, raid or keep a Rune Circle (to stop cheating), and it's replaced each time.</p>
    <p><b>Map data</b> comes from OpenStreetMap (Overpass): the game asks for the map around you. <b>Weather</b> comes from Open-Meteo, using your rough area (about 10 km).</p>
    <p><b>Online</b> (Supabase): an anonymous account with no email or real name, a backup of your progress, your friends, and what you share in the game. Other players can see your explorer name, level, faction, look, and the Kikis you trade, battle with or leave at circles.</p>
    <p><b>Notifications</b> (only if you turn them on): your browser's push address is kept so the game can send gift and Portal Surge reminders.</p>
    <p>Settings ▸ Online account ▸ "Delete my online account" removes everything online.</p></div>
    <div class="stack"><button class="pill small" data-x>Close</button></div>`);
  pn.root.querySelector('[data-x]').onclick = pn.close;
}
