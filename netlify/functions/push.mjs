// /api/push/key, /api/push/subscribe, /api/push/notify (see server/push.mjs)
import { getStore } from '@netlify/blobs';
import * as webpush from 'web-push';
import { handlePush } from '../../server/push.mjs';
export default async req => handlePush(req, { store: getStore({ name: 'kiki-push', consistency: 'strong' }), webpush, site: process.env.URL });
export const config = { path: '/api/push/*' };
