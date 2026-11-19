// Push server test with stand-ins for Netlify Blobs, the push service and Supabase: node web/test/push.test.mjs
import assert from 'node:assert/strict';
import { handlePush, surgeReminder } from '../../server/push.mjs';
const store = () => { const m = new Map(); return { get: async k => m.has(k) ? JSON.parse(m.get(k)) : null, setJSON: async (k, v) => m.set(k, JSON.stringify(v)), delete: async k => m.delete(k), list: async ({ prefix }) => ({ blobs: [...m.keys()].filter(k => k.startsWith(prefix)).map(key => ({ key })) }), m }; };
const sent = []; const webpush = { generateVAPIDKeys: () => ({ publicKey: 'PUB', privateKey: 'PRIV' }), sendNotification: async (sub, payload) => { if (sub.endpoint.includes('gone')) { const e = new Error('gone'); e.statusCode = 410; throw e; } sent.push([sub.endpoint, JSON.parse(payload)]); } };
const fetchFn = async (url, init) => { const who = init.headers.Authorization.slice(7), fn = url.split('/').pop(), args = JSON.parse(init.body);
  if (who === 'bad') return new Response(JSON.stringify({ message: 'not signed in' }), { status: 401 });
  if (fn === 'kiki_whoami') return new Response(JSON.stringify(who));
  if (fn === 'kiki_can_notify') return new Response(JSON.stringify(who === 'ana' && args.p_to === 'ben'));
  return new Response('null', { status: 404 }); };
const S = store(), opts = { store: S, webpush, site: 'https://example.netlify.app', fetchFn };
const call = (path, body, who) => handlePush(new Request('https://x/api/push/' + path, body ? { method: 'POST', headers: who ? { authorization: 'Bearer ' + who } : {}, body: JSON.stringify(body) } : {}), opts).then(async r => [r.status, await r.json()]);
let r = await call('key'); assert.deepEqual(r, [200, { publicKey: 'PUB' }]); assert.equal((await S.get('vapid')).privateKey, 'PRIV');
assert.equal((await call('subscribe', { subscription: { endpoint: 'https://push/ben' } }))[0], 400); // not signed in
assert.equal((await call('subscribe', { subscription: { endpoint: 'https://push/ben' } }, 'bad'))[0], 400);
assert.equal((await call('subscribe', { subscription: { endpoint: 'http://insecure' } }, 'ben'))[0], 400);
assert.deepEqual(await call('subscribe', { subscription: { endpoint: 'https://push/ben' } }, 'ben'), [200, { ok: true }]);
await call('subscribe', { subscription: { endpoint: 'https://push/gone' }, surge: true }, 'cat');
assert.deepEqual(await call('notify', { to: 'ben', kind: 'gift' }, 'ana'), [200, { sent: true }]);
assert.equal(sent[0][1].title.startsWith('You got a gift'), true);
assert.equal((await call('notify', { to: 'ben', kind: 'gift' }, 'cat'))[0], 403); // cat didn't send ben anything
assert.equal((await call('notify', { to: 'ben', kind: 'surge' }, 'ana'))[0], 400); // players can't send surge alerts
assert.equal(await surgeReminder(opts), 1); assert.ok(!(await S.get('sub/cat'))); // the dead subscription is forgotten
assert.deepEqual(await call('subscribe', { subscription: null }, 'ben'), [200, { ok: true, off: true }]);
console.log('push server: all checks passed');
