// Ten minutes before each Portal Surge (they start on even UTC hours), remind everyone who asked.
import { getStore } from '@netlify/blobs';
import * as webpush from 'web-push';
import { surgeReminder } from '../../server/push.mjs';
export default async () => { await surgeReminder({ store: getStore({ name: 'kiki-push', consistency: 'strong' }), webpush, site: process.env.URL }); };
export const config = { schedule: '50 1-23/2 * * *' };
