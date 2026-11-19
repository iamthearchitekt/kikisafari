-- KIKI SAFARI online (Phase 4) for Supabase. Safe to run more than once (Supabase SQL editor or the Management API).
-- Security model: Row Level Security is on for every table with no policies, so players can't read or write tables
-- directly. Every action is a SECURITY DEFINER function in the public schema that works out who is calling from
-- auth.uid() (anonymous sign-in) and checks what they're allowed to do. Helpers live in kiki_private, which the API
-- doesn't expose. Anti-cheat basics: a request limit per player, a speed check on actions tied to a place, and checks
-- that Kikis sent to the server are possible ones.
create extension if not exists pgcrypto with schema extensions;
create schema if not exists kiki_private;
revoke all on schema kiki_private from public, anon, authenticated;

-- ---------- tables ----------
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  auth_uid uuid unique,
  name text not null default 'Explorer',
  faction text,
  level int not null default 1,
  avatar jsonb not null default '{}',
  buddy text,
  friend_code text unique not null,
  coins_pending int not null default 0,
  coin_day date, coins_today int not null default 0,
  last_lat double precision, last_lon double precision, last_at timestamptz,
  rl_min bigint not null default 0, rl_n int not null default 0,
  last_match jsonb, last_battle jsonb,
  link_hash text, link_until timestamptz,
  notes jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create table if not exists public.saves (player_id uuid primary key references public.players(id) on delete cascade, data jsonb not null, saved_at bigint not null, updated timestamptz not null default now());
create table if not exists public.friend_requests (from_id uuid references public.players(id) on delete cascade, to_id uuid references public.players(id) on delete cascade, created timestamptz not null default now(), primary key (from_id, to_id));
create table if not exists public.friendships (a uuid references public.players(id) on delete cascade, b uuid references public.players(id) on delete cascade, since timestamptz not null default now(), days int not null default 0, last_day date, primary key (a, b), check (a < b));
create table if not exists public.gifts (id bigserial primary key, from_id uuid references public.players(id) on delete cascade, to_id uuid references public.players(id) on delete cascade, items jsonb not null, created timestamptz not null default now());
create table if not exists public.trades (code text primary key, host uuid references public.players(id) on delete cascade, guest uuid references public.players(id) on delete cascade, host_lat double precision, host_lon double precision, host_offer jsonb, guest_offer jsonb, host_ok boolean not null default false, guest_ok boolean not null default false, status text not null default 'open', created timestamptz not null default now());
create table if not exists public.league_teams (player_id uuid references public.players(id) on delete cascade, league text not null, team jsonb not null, rating int not null default 1000, wins int not null default 0, losses int not null default 0, updated timestamptz not null default now(), primary key (player_id, league));
create table if not exists public.circles (id text primary key, faction text, updated timestamptz not null default now());
create table if not exists public.circle_keepers (circle_id text references public.circles(id) on delete cascade, player_id uuid references public.players(id) on delete cascade, name text, kiki jsonb not null, since timestamptz not null default now(), primary key (circle_id, player_id));
create table if not exists public.raid_players (raid_id text, player_id uuid references public.players(id) on delete cascade, name text, dmg int not null default 0, updated timestamptz not null default now(), primary key (raid_id, player_id));
create index if not exists gifts_to on public.gifts (to_id);
create index if not exists keepers_player on public.circle_keepers (player_id);
create index if not exists league_rating on public.league_teams (league, rating);
do $$ declare t text; begin
  foreach t in array array['players','saves','friend_requests','friendships','gifts','trades','league_teams','circles','circle_keepers','raid_players'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop; end $$;

-- ---------- private helpers ----------
create or replace function kiki_private.me() returns public.players language plpgsql security definer set search_path = public as $$
declare p players; m bigint := floor(extract(epoch from now()) / 60);
begin
  select * into p from players where auth_uid = auth.uid();
  if p.id is null then raise exception 'not signed in'; end if;
  if p.rl_min = m then
    if p.rl_n >= 150 then raise exception 'slow down'; end if;
    update players set rl_n = rl_n + 1 where id = p.id;
  else update players set rl_min = m, rl_n = 1 where id = p.id; end if;
  return p;
end $$;
create or replace function kiki_private.dist(a_lat float8, a_lon float8, b_lat float8, b_lon float8) returns float8 language sql immutable as $$
  select 2 * 6371000 * asin(sqrt(power(sin(radians(b_lat - a_lat) / 2), 2) + cos(radians(a_lat)) * cos(radians(b_lat)) * power(sin(radians(b_lon - a_lon) / 2), 2)))
$$;
-- Speed check for anything tied to a place: no teleporting more than 300 km/h (beyond 1 km of jitter).
create or replace function kiki_private.moved(pid uuid, lat float8, lon float8) returns void language plpgsql security definer set search_path = public as $$
declare p players; d float8; dt float8;
begin
  if lat is null or lon is null or abs(lat) > 90 or abs(lon) > 180 then raise exception 'bad position'; end if;
  select * into p from players where id = pid;
  if p.last_at is not null then
    d := kiki_private.dist(p.last_lat, p.last_lon, lat, lon); dt := greatest(1, extract(epoch from now() - p.last_at));
    if d > 1000 and d / dt * 3.6 > 300 then raise exception 'moving too fast'; end if;
  end if;
  update players set last_lat = lat, last_lon = lon, last_at = now() where id = pid;
end $$;
-- A Kiki sent to the server must be a real species with a possible level and hidden stats.
create or replace function kiki_private.kiki(k jsonb, max_level int default 40) returns jsonb language plpgsql immutable as $$
declare iv jsonb; lvl int;
begin
  if k is null or jsonb_typeof(k) <> 'object' then raise exception 'bad kiki'; end if;
  if not (k->>'sp' = any(array['meadow','grand-meadow','pine','elder-pine','sprout','bloom','orchard','acorn','oak','evergreen','rainbow','puddle','brook','tide','lily','lotus','flurry','frosty','tidecaller','ember','blaze','bonfire','marshmallow','campfire','sunburst','zap','volt','thunderhead','firefly','lantern','fuzz','frizz','aurora','pebble','boulder','crystal','sandy','sandcastle','geode','summit','moonbeam','dusk','starry','shroom','glowcap','hoot','nightwing','golden-spiral'])) then raise exception 'unknown kiki'; end if;
  lvl := (k->>'lvl')::int; if lvl is null or lvl < 1 or lvl > least(40, max_level) then raise exception 'bad level'; end if;
  iv := k->'iv'; if jsonb_typeof(iv) <> 'array' or jsonb_array_length(iv) <> 3 then raise exception 'bad stats'; end if;
  for i in 0..2 loop if (iv->>i)::int < 0 or (iv->>i)::int > 15 then raise exception 'bad stats'; end if; end loop;
  return jsonb_build_object('sp', k->>'sp', 'lvl', lvl, 'iv', iv, 'h', coalesce((k->>'h')::float8, 40), 'w', coalesce((k->>'w')::float8, 0.5),
    'size', coalesce(k->>'size', ''), 'sparkle', coalesce((k->>'sparkle')::boolean, false), 'nick', left(regexp_replace(coalesce(k->>'nick', ''), '[^[:alnum:] ''-]', '', 'g'), 12));
end $$;
create or replace function kiki_private.name(n text) returns text language sql immutable as $$
  select coalesce(nullif(left(trim(regexp_replace(coalesce(n, ''), '[^[:alnum:] ''-]', '', 'g')), 15), ''), 'Explorer')
$$;
create or replace function kiki_private.public(p public.players) returns jsonb language sql stable as $$
  select jsonb_build_object('id', p.id, 'name', p.name, 'faction', p.faction, 'level', p.level, 'avatar', p.avatar, 'buddy', p.buddy, 'friend_code', p.friend_code)
$$;
-- Coins for a keeper coming home: 1 per 10 minutes kept, at most 50 a day (paid when you next check in).
create or replace function kiki_private.credit(pid uuid, since timestamptz, circle text, kiki jsonb, why text) returns void language plpgsql security definer set search_path = public as $$
declare p players; c int;
begin
  select * into p from players where id = pid;
  if p.coin_day is distinct from current_date then p.coins_today := 0; end if;
  c := greatest(0, least(floor(extract(epoch from now() - since) / 600)::int, 50 - p.coins_today));
  update players set coins_pending = coins_pending + c, coins_today = p.coins_today + c, coin_day = current_date,
    notes = (notes || jsonb_build_array(jsonb_build_object('kind', why, 'circle', circle, 'kiki', kiki, 'coins', c, 'at', now())))
  where id = pid;
end $$;

-- ---------- you ----------
create or replace function public.kiki_hello(p_name text default null, p_avatar jsonb default '{}') returns jsonb language plpgsql security definer set search_path = public as $$
declare p players; code text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into p from players where auth_uid = auth.uid();
  if p.id is null then
    loop code := lpad(floor(random() * 100000000)::bigint::text, 8, '0'); exit when not exists (select 1 from players where friend_code = code); end loop;
    insert into players (auth_uid, name, avatar, friend_code) values (auth.uid(), kiki_private.name(p_name), coalesce(p_avatar, '{}'), code) returning * into p;
  end if;
  return kiki_private.public(p) || jsonb_build_object('coins_pending', p.coins_pending, 'notes', p.notes);
end $$;
create or replace function public.kiki_profile(p_name text, p_faction text, p_level int, p_avatar jsonb, p_buddy text) returns jsonb language plpgsql security definer set search_path = public as $$
declare p players := kiki_private.me();
begin
  update players set name = kiki_private.name(p_name), level = greatest(1, least(40, coalesce(p_level, 1))), avatar = coalesce(p_avatar, '{}'),
    buddy = case when p_buddy = any(array['meadow','grand-meadow','pine','elder-pine','sprout','bloom','orchard','acorn','oak','evergreen','rainbow','puddle','brook','tide','lily','lotus','flurry','frosty','tidecaller','ember','blaze','bonfire','marshmallow','campfire','sunburst','zap','volt','thunderhead','firefly','lantern','fuzz','frizz','aurora','pebble','boulder','crystal','sandy','sandcastle','geode','summit','moonbeam','dusk','starry','shroom','glowcap','hoot','nightwing','golden-spiral']) then p_buddy else null end,
    faction = coalesce(faction, case when p_faction in ('dusk', 'tide', 'bloom') then p_faction end)
  where id = p.id returning * into p;
  return kiki_private.public(p);
end $$;
-- Coins from keepers that came home, and messages for you (then cleared).
create or replace function public.kiki_inbox() returns jsonb language plpgsql security definer set search_path = public as $$
declare p players := kiki_private.me();
begin
  update players set coins_pending = 0, notes = '[]' where id = p.id;
  return jsonb_build_object('coins', p.coins_pending, 'notes', p.notes);
end $$;
create or replace function public.kiki_save_put(p_data jsonb, p_saved_at bigint) returns bigint language plpgsql security definer set search_path = public as $$
declare p players := kiki_private.me(); s bigint;
begin
  if pg_column_size(p_data) > 800000 then raise exception 'save too big'; end if;
  insert into saves (player_id, data, saved_at) values (p.id, p_data, p_saved_at)
  on conflict (player_id) do update set data = excluded.data, saved_at = excluded.saved_at, updated = now() where saves.saved_at < excluded.saved_at;
  select saved_at into s from saves where player_id = p.id; return s;
end $$;
create or replace function public.kiki_save_get() returns jsonb language plpgsql security definer set search_path = public as $$
declare p players := kiki_private.me(); r jsonb;
begin select jsonb_build_object('data', data, 'saved_at', saved_at) into r from saves where player_id = p.id; return r; end $$;
-- Moving to another phone: a one-time code, good for 15 minutes.
create or replace function public.kiki_link_code() returns text language plpgsql security definer set search_path = public as $$
declare p players := kiki_private.me(); code text := ''; abc text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
begin
  for i in 1..8 loop code := code || substr(abc, 1 + floor(random() * length(abc))::int, 1); end loop;
  update players set link_hash = encode(extensions.digest(code, 'sha256'), 'hex'), link_until = now() + interval '15 minutes' where id = p.id;
  return code;
end $$;
create or replace function public.kiki_link_claim(p_code text) returns jsonb language plpgsql security definer set search_path = public as $$
declare t players; mine players;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into t from players where link_hash = encode(extensions.digest(upper(trim(p_code)), 'sha256'), 'hex') and link_until > now();
  if t.id is null then raise exception 'code not found or expired'; end if;
  select * into mine from players where auth_uid = auth.uid();
  if mine.id is not null and mine.id <> t.id then delete from players where id = mine.id; end if;
  update players set auth_uid = auth.uid(), link_hash = null, link_until = null where id = t.id returning * into t;
  return kiki_private.public(t) || jsonb_build_object('save', (select jsonb_build_object('data', data, 'saved_at', saved_at) from saves where player_id = t.id));
end $$;
create or replace function public.kiki_delete_me() returns boolean language plpgsql security definer set search_path = public as $$
declare p players := kiki_private.me();
begin delete from players where id = p.id; return true; end $$;

-- ---------- friends and gifts ----------
create or replace function public.kiki_friend_add(p_code text) returns text language plpgsql security definer set search_path = public as $$
declare p players := kiki_private.me(); t players;
begin
  select * into t from players where friend_code = trim(p_code);
  if t.id is null then raise exception 'no explorer with that code'; end if;
  if t.id = p.id then raise exception 'that is your own code'; end if;
  if exists (select 1 from friendships where a = least(p.id, t.id) and b = greatest(p.id, t.id)) then return 'already'; end if;
  if (select count(*) from friendships where a = p.id or b = p.id) >= 200 then raise exception 'too many friends'; end if;
  if exists (select 1 from friend_requests where from_id = t.id and to_id = p.id) then
    delete from friend_requests where from_id = t.id and to_id = p.id;
    insert into friendships (a, b) values (least(p.id, t.id), greatest(p.id, t.id)); return 'friends';
  end if;
  insert into friend_requests (from_id, to_id) values (p.id, t.id) on conflict do nothing; return 'requested';
end $$;
create or replace function public.kiki_friend_answer(p_from uuid, p_ok boolean) returns text language plpgsql security definer set search_path = public as $$
declare p players := kiki_private.me();
begin
  delete from friend_requests where from_id = p_from and to_id = p.id; if not found then raise exception 'no request'; end if;
  if p_ok then insert into friendships (a, b) values (least(p.id, p_from), greatest(p.id, p_from)) on conflict do nothing; return 'friends'; end if;
  return 'declined';
end $$;
create or replace function public.kiki_friend_remove(p_id uuid) returns boolean language plpgsql security definer set search_path = public as $$
declare p players := kiki_private.me();
begin delete from friendships where a = least(p.id, p_id) and b = greatest(p.id, p_id); return found; end $$;
create or replace function public.kiki_friends() returns jsonb language plpgsql security definer set search_path = public as $$
declare p players := kiki_private.me();
begin
  return jsonb_build_object(
    'friends', coalesce((select jsonb_agg(kiki_private.public(o) || jsonb_build_object('since', f.since, 'days', f.days,
        'sent_today', exists (select 1 from gifts g where g.from_id = p.id and g.to_id = o.id and g.created::date = current_date)) order by o.name)
      from friendships f join players o on o.id = case when f.a = p.id then f.b else f.a end where f.a = p.id or f.b = p.id), '[]'),
    'requests', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'level', o.level, 'avatar', o.avatar)) from friend_requests r join players o on o.id = r.from_id where r.to_id = p.id), '[]'),
    'gifts', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'from', o.name, 'items', g.items, 'created', g.created) order by g.id) from gifts g join players o on o.id = g.from_id where g.to_id = p.id), '[]'));
end $$;
-- One gift a day to each friend: up to 6 items from a short list (and maybe a 5 km egg). Gifting raises friendship.
create or replace function public.kiki_gift_send(p_to uuid, p_items jsonb) returns int language plpgsql security definer set search_path = public as $$
declare p players := kiki_private.me(); n int := 0; k text; v int; d int;
begin
  if not exists (select 1 from friendships where a = least(p.id, p_to) and b = greatest(p.id, p_to)) then raise exception 'not friends'; end if;
  if exists (select 1 from gifts where from_id = p.id and to_id = p_to and created::date = current_date) then raise exception 'already sent a gift today'; end if;
  if jsonb_typeof(p_items) <> 'object' then raise exception 'bad gift'; end if;
  for k, v in select key, value::int from jsonb_each_text(p_items) loop
    if k not in ('rune', 'moon', 'star', 'honey', 'sunseed', 'stitch', 'pillow', 'egg') or v < 0 or v > 4 then raise exception 'bad gift'; end if;
    if k = 'egg' and v > 1 then raise exception 'bad gift'; end if;
    n := n + v;
  end loop;
  if n < 1 or n > 6 then raise exception 'bad gift'; end if;
  insert into gifts (from_id, to_id, items) values (p.id, p_to, p_items);
  update friendships set days = days + case when last_day is distinct from current_date then 1 else 0 end, last_day = current_date
    where a = least(p.id, p_to) and b = greatest(p.id, p_to) returning days into d;
  return d;
end $$;
create or replace function public.kiki_gift_open(p_id bigint) returns jsonb language plpgsql security definer set search_path = public as $$
declare p players := kiki_private.me(); r jsonb;
begin delete from gifts where id = p_id and to_id = p.id returning items into r; return r; end $$;

-- ---------- trading, face to face (within 100 m) ----------
create or replace function public.kiki_trade_open(p_lat float8, p_lon float8) returns text language plpgsql security definer set search_path = public as $$
declare p players := kiki_private.me(); new_code text;
begin
  perform kiki_private.moved(p.id, p_lat, p_lon);
  delete from trades where host = p.id or created < now() - interval '1 hour';
  loop new_code := lpad(floor(random() * 10000)::int::text, 4, '0'); exit when not exists (select 1 from trades t where t.code = new_code); end loop;
  insert into trades (code, host, host_lat, host_lon) values (new_code, p.id, p_lat, p_lon); return new_code;
end $$;
create or replace function public.kiki_trade_join(p_code text, p_lat float8, p_lon float8) returns jsonb language plpgsql security definer set search_path = public as $$
declare p players := kiki_private.me(); t trades;
begin
  perform kiki_private.moved(p.id, p_lat, p_lon);
  select * into t from trades where code = p_code and status = 'open' and created > now() - interval '30 minutes';
  if t.code is null then raise exception 'no trade with that code'; end if;
  if t.host = p.id then raise exception 'that is your own trade'; end if;
  if t.guest is not null and t.guest <> p.id then raise exception 'someone else joined that trade'; end if;
  if kiki_private.dist(t.host_lat, t.host_lon, p_lat, p_lon) > 100 then raise exception 'you need to be within 100 m of each other'; end if;
  update trades set guest = p.id where code = p_code;
  return public.kiki_trade_get(p_code);
end $$;
create or replace function public.kiki_trade_offer(p_code text, p_kiki jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare p players := kiki_private.me(); t trades; k jsonb := kiki_private.kiki(p_kiki, p.level + 2);
begin
  select * into t from trades where code = p_code and status = 'open'; if t.code is null then raise exception 'no trade'; end if;
  if t.host = p.id then update trades set host_offer = k, host_ok = false, guest_ok = false where code = p_code;
  elsif t.guest = p.id then update trades set guest_offer = k, host_ok = false, guest_ok = false where code = p_code;
  else raise exception 'not your trade'; end if;
  return public.kiki_trade_get(p_code);
end $$;
create or replace function public.kiki_trade_confirm(p_code text) returns jsonb language plpgsql security definer set search_path = public as $$
declare p players := kiki_private.me(); t trades;
begin
  select * into t from trades where code = p_code and status = 'open'; if t.code is null then raise exception 'no trade'; end if;
  if t.host_offer is null or t.guest_offer is null then raise exception 'both of you need to pick a Kiki'; end if;
  if t.host = p.id then update trades set host_ok = true where code = p_code; elsif t.guest = p.id then update trades set guest_ok = true where code = p_code; else raise exception 'not your trade'; end if;
  update trades set status = 'done' where code = p_code and host_ok and guest_ok;
  return public.kiki_trade_get(p_code);
end $$;
create or replace function public.kiki_trade_cancel(p_code text) returns boolean language plpgsql security definer set search_path = public as $$
declare p players := kiki_private.me();
begin update trades set status = 'cancelled' where code = p_code and status = 'open' and (host = p.id or guest = p.id); return found; end $$;
create or replace function public.kiki_trade_get(p_code text) returns jsonb language plpgsql security definer set search_path = public as $$
declare p players := kiki_private.me(); t trades; host boolean; o players;
begin
  select * into t from trades where code = p_code; if t.code is null or (t.host <> p.id and t.guest is distinct from p.id) then raise exception 'no trade'; end if;
  host := t.host = p.id; select * into o from players where id = case when host then t.guest else t.host end;
  return jsonb_build_object('code', t.code, 'status', t.status, 'side', case when host then 'host' else 'guest' end,
    'partner', case when o.id is null then null else jsonb_build_object('name', o.name, 'level', o.level, 'avatar', o.avatar) end,
    'mine', case when host then t.host_offer else t.guest_offer end, 'theirs', case when host then t.guest_offer else t.host_offer end,
    'my_ok', case when host then t.host_ok else t.guest_ok end, 'their_ok', case when host then t.guest_ok else t.host_ok end);
end $$;

-- ---------- league battles (against other explorers' teams, played by the game) ----------
create or replace function public.kiki_league_team(p_league text, p_team jsonb) returns int language plpgsql security definer set search_path = public as $$
declare p players := kiki_private.me(); team jsonb := '[]'; r int;
begin
  if p_league not in ('sprout', 'bloom', 'open') then raise exception 'unknown league'; end if;
  if jsonb_typeof(p_team) <> 'array' or jsonb_array_length(p_team) not between 1 and 3 then raise exception 'pick 1 to 3 Kikis'; end if;
  for i in 0..jsonb_array_length(p_team) - 1 loop team := team || jsonb_build_array(kiki_private.kiki(p_team->i, p.level + 2)); end loop;
  insert into league_teams (player_id, league, team) values (p.id, p_league, team) on conflict (player_id, league) do update set team = excluded.team, updated = now();
  select rating into r from league_teams where player_id = p.id and league = p_league; return r;
end $$;
create or replace function public.kiki_league_match(p_league text) returns jsonb language plpgsql security definer set search_path = public as $$
declare p players := kiki_private.me(); me_r int; o record;
begin
  select rating into me_r from league_teams where player_id = p.id and league = p_league; if me_r is null then raise exception 'set your league team first'; end if;
  select lt.player_id, lt.team, lt.rating, pl.name, pl.faction, pl.avatar into o from league_teams lt join players pl on pl.id = lt.player_id
    where lt.league = p_league and lt.player_id <> p.id order by abs(lt.rating - me_r) + random() * 300 limit 1;
  update players set last_match = jsonb_build_object('league', p_league, 'opp', o.player_id, 'at', now()) where id = p.id;
  if o.player_id is null then return null; end if;
  return jsonb_build_object('name', o.name, 'faction', o.faction, 'avatar', o.avatar, 'rating', o.rating, 'team', o.team);
end $$;
create or replace function public.kiki_league_result(p_win boolean) returns int language plpgsql security definer set search_path = public as $$
declare p players := kiki_private.me(); m jsonb := p.last_match; lg text; r1 int; r2 int; e float8; dlt int;
begin
  if m is null or (m->>'at')::timestamptz < now() - interval '15 minutes' then raise exception 'no battle to report'; end if;
  update players set last_match = null where id = p.id;
  lg := m->>'league'; select rating into r1 from league_teams where player_id = p.id and league = lg;
  select rating into r2 from league_teams where player_id = (m->>'opp')::uuid and league = lg; r2 := coalesce(r2, 1000);
  e := 1 / (1 + power(10, (r2 - r1) / 400.0)); dlt := round(24 * ((case when p_win then 1 else 0 end) - e));
  update league_teams set rating = greatest(0, rating + dlt), wins = wins + case when p_win then 1 else 0 end, losses = losses + case when p_win then 0 else 1 end where player_id = p.id and league = lg;
  if m->>'opp' is not null then update league_teams set rating = greatest(0, rating - round(dlt * 0.5)) where player_id = (m->>'opp')::uuid and league = lg; end if;
  return r1 + dlt;
end $$;
create or replace function public.kiki_league_top(p_league text) returns jsonb language plpgsql security definer set search_path = public as $$
declare p players := kiki_private.me();
begin
  return jsonb_build_object('top', coalesce((select jsonb_agg(x) from (select pl.name, pl.faction, lt.rating, lt.wins, lt.losses, lt.player_id = p.id as me from league_teams lt join players pl on pl.id = lt.player_id where lt.league = p_league order by lt.rating desc limit 20) x), '[]'),
    'me', (select jsonb_build_object('rating', rating, 'wins', wins, 'losses', losses, 'rank', (select count(*) + 1 from league_teams o where o.league = p_league and o.rating > lt.rating)) from league_teams lt where player_id = p.id and league = p_league));
end $$;

-- ---------- Rune Circles held by factions ----------
create or replace function public.kiki_circles(p_ids text[]) returns jsonb language plpgsql security definer set search_path = public as $$
declare p players := kiki_private.me();
begin
  if array_length(p_ids, 1) > 40 then raise exception 'too many circles'; end if;
  return coalesce((select jsonb_object_agg(c.id, jsonb_build_object('faction', c.faction, 'keepers',
      coalesce((select jsonb_agg(jsonb_build_object('name', k.name, 'kiki', k.kiki, 'since', k.since, 'mine', k.player_id = p.id) order by k.since) from circle_keepers k where k.circle_id = c.id), '[]')))
    from circles c where c.id = any(p_ids) and exists (select 1 from circle_keepers k where k.circle_id = c.id)), '{}');
end $$;
create or replace function public.kiki_circle_battle(p_id text) returns jsonb language plpgsql security definer set search_path = public as $$
declare p players := kiki_private.me();
begin
  update players set last_battle = jsonb_build_object('circle', p_id, 'at', now()) where id = p.id;
  return coalesce((select jsonb_agg(jsonb_build_object('name', k.name, 'kiki', k.kiki)) from circle_keepers k where k.circle_id = p_id), '[]');
end $$;
-- Leave a Kiki at a circle. Empty or your faction's: just join (up to 6 keepers). Another faction's: only right after
-- beating its keepers (kiki_circle_battle); they all go home with their coins and your faction takes the circle.
create or replace function public.kiki_circle_claim(p_id text, p_lat float8, p_lon float8, p_kiki jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare p players := kiki_private.me(); k jsonb := kiki_private.kiki(p_kiki, p.level + 2); c circles; n int; kp record;
begin
  if p.faction is null then raise exception 'choose a faction first'; end if;
  perform kiki_private.moved(p.id, p_lat, p_lon);
  insert into circles (id) values (p_id) on conflict do nothing;
  select * into c from circles where id = p_id for update;
  select count(*) into n from circle_keepers where circle_id = p_id;
  if exists (select 1 from circle_keepers where circle_id = p_id and player_id = p.id) then raise exception 'you already keep this circle'; end if;
  if n > 0 and c.faction is distinct from p.faction then
    if p.last_battle is null or p.last_battle->>'circle' <> p_id or (p.last_battle->>'at')::timestamptz < now() - interval '10 minutes' then raise exception 'beat the keepers first'; end if;
    for kp in select * from circle_keepers where circle_id = p_id loop perform kiki_private.credit(kp.player_id, kp.since, p_id, kp.kiki, 'defeated'); end loop;
    delete from circle_keepers where circle_id = p_id; n := 0;
  elsif n >= 6 then raise exception 'this circle has 6 keepers already';
  end if;
  update circles set faction = p.faction, updated = now() where id = p_id;
  insert into circle_keepers (circle_id, player_id, name, kiki) values (p_id, p.id, p.name, k);
  update players set last_battle = null where id = p.id;
  return public.kiki_circles(array[p_id]);
end $$;
create or replace function public.kiki_circle_home(p_id text) returns int language plpgsql security definer set search_path = public as $$
declare p players := kiki_private.me(); kp circle_keepers; c int;
begin
  select * into kp from circle_keepers where circle_id = p_id and player_id = p.id; if kp.circle_id is null then return 0; end if;
  perform kiki_private.credit(p.id, kp.since, p_id, kp.kiki, 'home');
  delete from circle_keepers where circle_id = p_id and player_id = p.id;
  if not exists (select 1 from circle_keepers where circle_id = p_id) then update circles set faction = null where id = p_id; end if;
  select coins_pending into c from players where id = p.id; return c;
end $$;
create or replace function public.kiki_my_keepers() returns jsonb language plpgsql security definer set search_path = public as $$
declare p players := kiki_private.me();
begin return coalesce((select jsonb_agg(jsonb_build_object('circle', circle_id, 'kiki', kiki, 'since', since)) from circle_keepers where player_id = p.id), '[]'); end $$;

-- ---------- co-op raids (shared boss HP during a Portal Surge) ----------
create or replace function public.kiki_raid_join(p_raid text, p_lat float8, p_lon float8) returns jsonb language plpgsql security definer set search_path = public as $$
declare p players := kiki_private.me();
begin
  perform kiki_private.moved(p.id, p_lat, p_lon);
  delete from raid_players where updated < now() - interval '1 day';
  insert into raid_players (raid_id, player_id, name) values (p_raid, p.id, p.name) on conflict do nothing;
  return public.kiki_raid_state(p_raid);
end $$;
-- Your total damage so far (it can only go up, and only so fast).
create or replace function public.kiki_raid_hit(p_raid text, p_dmg int) returns jsonb language plpgsql security definer set search_path = public as $$
declare p players := kiki_private.me(); r raid_players;
begin
  select * into r from raid_players where raid_id = p_raid and player_id = p.id; if r.raid_id is null then raise exception 'join the raid first'; end if;
  update raid_players set dmg = greatest(dmg, least(p_dmg, dmg + 400 + floor(400 * extract(epoch from now() - updated))::int)), updated = now() where raid_id = p_raid and player_id = p.id;
  return public.kiki_raid_state(p_raid);
end $$;
create or replace function public.kiki_raid_state(p_raid text) returns jsonb language plpgsql security definer set search_path = public as $$
declare p players := kiki_private.me();
begin
  return jsonb_build_object('total', coalesce((select sum(dmg) from raid_players where raid_id = p_raid), 0),
    'players', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'dmg', dmg, 'me', player_id = p.id, 'active', updated > now() - interval '20 seconds') order by dmg desc) from raid_players where raid_id = p_raid), '[]'));
end $$;

-- ---------- for the push server (Netlify) ----------
create or replace function public.kiki_whoami() returns uuid language plpgsql security definer set search_path = public as $$
declare p players := kiki_private.me(); begin return p.id; end $$;
-- May I ping this player? Only right after sending them a gift or a friend request.
create or replace function public.kiki_can_notify(p_to uuid, p_kind text) returns boolean language plpgsql security definer set search_path = public as $$
declare p players := kiki_private.me();
begin
  if p_kind = 'gift' then return exists (select 1 from gifts where from_id = p.id and to_id = p_to and created > now() - interval '10 minutes'); end if;
  if p_kind = 'friend' then return exists (select 1 from friend_requests where from_id = p.id and to_id = p_to and created > now() - interval '10 minutes'); end if;
  return false;
end $$;

-- ---------- who can call what ----------
revoke execute on all functions in schema kiki_private from public, anon, authenticated;
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'kiki\_%' loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop; end $$;
