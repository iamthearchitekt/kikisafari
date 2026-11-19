// Push notifications (Phase 4), run as Netlify Functions next to the game. Keys and subscriptions live in Netlify
// Blobs; the VAPID keys are made on first use, so there is nothing to set up. Who is asking is checked by calling the
// game's Supabase functions with the player's own sign-in token, so this server needs no Supabase secrets either.
import { SUPABASE_URL, SUPABASE_KEY } from '../web/js/online.js';

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
const MESSAGES = {
  gift: { title: 'You got a gift! 🎁', body: 'A friend sent you a gift in KIKI SAFARI. Open it from Friends.' },
  friend: { title: 'New friend request', body: 'Someone wants to be friends in KIKI SAFARI.' },
  surge: { title: 'Portal Surge soon! 🌀', body: 'Raid bosses come through the Rune Circles in 10 minutes.' },
};
async function vapid(store, webpush) {
  let v = await store.get('vapid', { type: 'json' });
  if (!v) { v = webpush.generateVAPIDKeys(); await store.setJSON('vapid', v); }
  return v;
}
async function asPlayer(fetchFn, auth, fn, args) {
  if (!auth || !/^Bearer /.test(auth)) throw new Error('sign in first');
  const r = await fetchFn(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: auth, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
  const j = await r.json().catch(() => null); if (!r.ok) throw new Error((j && j.message) || 'not allowed'); return j;
}
async function send(store, webpush, site, id, sub, msg) {
  const v = await vapid(store, webpush);
  try { await webpush.sendNotification(sub.subscription, JSON.stringify({ ...msg, url: './' }), { TTL: 3600, vapidDetails: { subject: site || 'https://kiki-safari.netlify.app', publicKey: v.publicKey, privateKey: v.privateKey } }); return true; }
  catch (e) { if (e.statusCode === 404 || e.statusCode === 410) await store.delete('sub/' + id); return false; } // gone: forget it
}
export async function handlePush(req, { store, webpush, site, fetchFn = fetch }) {
  const path = new URL(req.url).pathname.replace(/^.*\/api\/push\/?/, '');
  try {
    if (path === 'key') return json({ publicKey: (await vapid(store, webpush)).publicKey });
    if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
    const body = await req.json().catch(() => ({})), auth = req.headers.get('authorization');
    if (path === 'subscribe') {
      const id = await asPlayer(fetchFn, auth, 'kiki_whoami', {});
      if (!body.subscription) { await store.delete('sub/' + id); return json({ ok: true, off: true }); }
      const ep = body.subscription && body.subscription.endpoint;
      if (typeof ep !== 'string' || !ep.startsWith('https://') || ep.length > 1000) return json({ error: 'bad subscription' }, 400);
      await store.setJSON('sub/' + id, { subscription: body.subscription, surge: body.surge !== false, at: Date.now() });
      return json({ ok: true });
    }
    if (path === 'notify') {
      if (!MESSAGES[body.kind] || body.kind === 'surge') return json({ error: 'unknown kind' }, 400);
      if (!(await asPlayer(fetchFn, auth, 'kiki_can_notify', { p_to: body.to, p_kind: body.kind }))) return json({ error: 'not allowed' }, 403);
      const sub = await store.get('sub/' + body.to, { type: 'json' });
      return json({ sent: sub ? await send(store, webpush, site, body.to, sub, MESSAGES[body.kind]) : false });
    }
    return json({ error: 'not found' }, 404);
  } catch (e) { return json({ error: e.message }, 400); }
}
/** Every other hour at :50 (Portal Surges start on even UTC hours). */
export async function surgeReminder({ store, webpush, site }) {
  const { blobs } = await store.list({ prefix: 'sub/' }); let n = 0;
  for (const b of blobs) { const sub = await store.get(b.key, { type: 'json' }); if (sub && sub.surge && await send(store, webpush, site, b.key.slice(4), sub, MESSAGES.surge)) n++; }
  return n;
}
