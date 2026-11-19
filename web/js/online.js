// Phase 4: talking to the game's Supabase project. Anonymous sign-in (no email, no personal details), then every
// action is a server function (supabase/schema.sql) that checks who you are. The game works fine offline: if the
// server can't be reached, online features just say so. The publishable key below is meant to be public.
export const SUPABASE_URL = 'https://kuhafyzcfndnobawyeqy.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_DXLf7QqdKJwbwPxU1wOiDw_J8LUIa85';
const SESSION = 'kiki-online';

export class Online {
  constructor(storage = globalThis.localStorage, fetchFn = globalThis.fetch.bind(globalThis)) {
    this.store = storage; this.fetch = fetchFn; this.player = null; this.problem = null;
    try { this.session = JSON.parse(storage.getItem(SESSION) || 'null'); } catch (e) { this.session = null; }
  }
  get signedIn() { return !!(this.session && this.player); }
  keep(s) { this.session = s ? { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600) } : null; this.store.setItem(SESSION, JSON.stringify(this.session)); }
  async auth(path, body) {
    const r = await this.fetch(`${SUPABASE_URL}/auth/v1/${path}`, { method: 'POST', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.msg || j.message || j.error_description || 'Sign-in failed (' + r.status + ')');
    this.keep(j); return j;
  }
  /** A session that's good for at least a minute: refresh it, or start a new anonymous one. */
  async token() {
    const now = Math.floor(Date.now() / 1000);
    if (this.session && this.session.expires_at - 60 > now) return this.session.access_token;
    if (this.session && this.session.refresh_token) { try { await this.auth('token?grant_type=refresh_token', { refresh_token: this.session.refresh_token }); return this.session.access_token; } catch (e) { /* fall through */ } }
    await this.auth('signup', { data: {} }); return this.session.access_token;
  }
  /** Call a server function. Throws an Error with the server's message (e.g. "not friends"). */
  async rpc(fn, args = {}, retry = true) {
    const t = await this.token();
    const r = await this.fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
    if (r.status === 401 && retry) { this.session.expires_at = 0; return this.rpc(fn, args, false); }
    const text = await r.text(), j = text ? JSON.parse(text) : null;
    if (!r.ok) throw new Error((j && j.message) || 'Server error (' + r.status + ')');
    return j;
  }
  /** Sign in (creating an explorer the first time). */
  async hello(name, avatar) { this.player = await this.rpc('kiki_hello', { p_name: name || null, p_avatar: avatar || {} }); this.problem = null; return this.player; }
  profile(p) { return this.rpc('kiki_profile', { p_name: p.explorer.name, p_faction: p.faction, p_level: p.level, p_avatar: { outfit: p.explorer.outfit, skin: p.explorer.skin }, p_buddy: p.buddySp || null }); }
  inbox() { return this.rpc('kiki_inbox'); }
  savePut(data, savedAt) { return this.rpc('kiki_save_put', { p_data: data, p_saved_at: savedAt }); }
  saveGet() { return this.rpc('kiki_save_get'); }
  linkCode() { return this.rpc('kiki_link_code'); }
  linkClaim(code) { return this.rpc('kiki_link_claim', { p_code: code }); }
  deleteMe() { return this.rpc('kiki_delete_me'); }
  friends() { return this.rpc('kiki_friends'); }
  friendAdd(code) { return this.rpc('kiki_friend_add', { p_code: code }); }
  friendAnswer(id, ok) { return this.rpc('kiki_friend_answer', { p_from: id, p_ok: ok }); }
  friendRemove(id) { return this.rpc('kiki_friend_remove', { p_id: id }); }
  giftSend(to, items) { return this.rpc('kiki_gift_send', { p_to: to, p_items: items }); }
  giftOpen(id) { return this.rpc('kiki_gift_open', { p_id: id }); }
  tradeOpen(pos) { return this.rpc('kiki_trade_open', { p_lat: pos.lat, p_lon: pos.lon }); }
  tradeJoin(code, pos) { return this.rpc('kiki_trade_join', { p_code: code, p_lat: pos.lat, p_lon: pos.lon }); }
  tradeOffer(code, kiki) { return this.rpc('kiki_trade_offer', { p_code: code, p_kiki: kiki }); }
  tradeConfirm(code) { return this.rpc('kiki_trade_confirm', { p_code: code }); }
  tradeCancel(code) { return this.rpc('kiki_trade_cancel', { p_code: code }); }
  tradeGet(code) { return this.rpc('kiki_trade_get', { p_code: code }); }
  leagueTeam(league, team) { return this.rpc('kiki_league_team', { p_league: league, p_team: team }); }
  leagueMatch(league) { return this.rpc('kiki_league_match', { p_league: league }); }
  leagueResult(win) { return this.rpc('kiki_league_result', { p_win: win }); }
  leagueTop(league) { return this.rpc('kiki_league_top', { p_league: league }); }
  circles(ids) { return this.rpc('kiki_circles', { p_ids: ids }); }
  circleBattle(id) { return this.rpc('kiki_circle_battle', { p_id: id }); }
  circleClaim(id, pos, kiki) { return this.rpc('kiki_circle_claim', { p_id: id, p_lat: pos.lat, p_lon: pos.lon, p_kiki: kiki }); }
  circleHome(id) { return this.rpc('kiki_circle_home', { p_id: id }); }
  myKeepers() { return this.rpc('kiki_my_keepers'); }
  raidJoin(id, pos) { return this.rpc('kiki_raid_join', { p_raid: id, p_lat: pos.lat, p_lon: pos.lon }); }
  raidHit(id, dmg) { return this.rpc('kiki_raid_hit', { p_raid: id, p_dmg: Math.floor(dmg) }); }
  canNotify(to, kind) { return this.rpc('kiki_can_notify', { p_to: to, p_kind: kind }); }
}

/** The parts of a Kiki the server keeps (no personal info, no catch place). */
export const snapshot = k => ({ sp: k.sp, lvl: k.lvl, iv: k.iv, h: k.h, w: k.w, size: k.size || '', sparkle: !!k.sparkle, nick: k.nick || '' });
export const FRIEND_TIERS = [[90, 'Best friends'], [30, 'Great friends'], [7, 'Good friends'], [1, 'Friends'], [0, 'New friends']];
export const friendTier = days => FRIEND_TIERS.find(([d]) => days >= d)[1];
