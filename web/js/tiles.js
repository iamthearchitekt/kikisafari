// Street map data from OpenFreeMap (https://openfreemap.org): free OpenStreetMap vector tiles on a CDN, no key, built
// for apps. The public Overpass servers the game used first are often too busy to answer. A zoom-14 tile (about 2 km
// across) is fetched once, kept on the phone, and turned into the same shape of data Overpass gave (nodes and ways
// with OpenStreetMap tags), so the rest of the map code doesn't change.
const TILEJSON = 'https://tiles.openfreemap.org/planet', Z = 14, TILE_CACHE = 'kiki-tiles-v1', KEEP = 30 * 864e5;

// ---------- a small Mapbox Vector Tile (protobuf) reader ----------
function reader(buf) {
  const b = new Uint8Array(buf); let p = 0;
  const varint = () => { let v = 0, m = 1, x; do { x = b[p++]; v += (x & 0x7f) * m; m *= 128; } while (x & 0x80); return v; };
  const skip = wt => { if (wt === 0) varint(); else if (wt === 1) p += 8; else if (wt === 2) p += varint(); else if (wt === 5) p += 4; else throw new Error('bad tile'); };
  return { b, get pos() { return p; }, set pos(v) { p = v; }, varint, skip, end: () => p >= b.length };
}
const zig = n => (n % 2 ? -(n + 1) / 2 : n / 2);
const utf8 = new TextDecoder();
function packed(r, end) { const out = []; while (r.pos < end) out.push(r.varint()); return out; }
function readValue(r, end) {
  let v = null;
  while (r.pos < end) {
    const key = r.varint(), f = key >> 3, wt = key & 7;
    if (f === 1) { const n = r.varint(); v = utf8.decode(r.b.subarray(r.pos, r.pos + n)); r.pos += n; }
    else if (f === 2) { v = new DataView(r.b.buffer, r.b.byteOffset + r.pos, 4).getFloat32(0, true); r.pos += 4; }
    else if (f === 3) { v = new DataView(r.b.buffer, r.b.byteOffset + r.pos, 8).getFloat64(0, true); r.pos += 8; }
    else if (f === 4 || f === 5) v = r.varint();
    else if (f === 6) v = zig(r.varint());
    else if (f === 7) v = !!r.varint();
    else r.skip(wt);
  }
  return v;
}
/** Decode a tile into { layerName: [{ id, type (1 point, 2 line, 3 polygon), props, geom: [[x, y]…] parts }] }. */
export function decodeTile(buf) {
  const r = reader(buf), layers = {};
  while (!r.end()) {
    const key = r.varint(), f = key >> 3, wt = key & 7;
    if (f !== 3) { r.skip(wt); continue; }
    const lend = r.varint() + r.pos, keys = [], vals = [], feats = []; let name = '', extent = 4096;
    while (r.pos < lend) {
      const k2 = r.varint(), f2 = k2 >> 3, w2 = k2 & 7;
      if (f2 === 1) { const n = r.varint(); name = utf8.decode(r.b.subarray(r.pos, r.pos + n)); r.pos += n; }
      else if (f2 === 3) { const n = r.varint(); keys.push(utf8.decode(r.b.subarray(r.pos, r.pos + n))); r.pos += n; }
      else if (f2 === 4) { const n = r.varint(); vals.push(readValue(r, r.pos + n)); }
      else if (f2 === 5) extent = r.varint();
      else if (f2 === 2) {
        const fend = r.varint() + r.pos, ft = { id: null, type: 0, tags: [], cmds: [] };
        while (r.pos < fend) {
          const k3 = r.varint(), f3 = k3 >> 3, w3 = k3 & 7;
          if (f3 === 1) ft.id = r.varint();
          else if (f3 === 2) ft.tags = packed(r, r.varint() + r.pos);
          else if (f3 === 3) ft.type = r.varint();
          else if (f3 === 4) ft.cmds = packed(r, r.varint() + r.pos);
          else r.skip(w3);
        }
        feats.push(ft);
      } else r.skip(w2);
    }
    layers[name] = feats.map(ft => {
      const props = {}; for (let i = 0; i + 1 < ft.tags.length; i += 2) props[keys[ft.tags[i]]] = vals[ft.tags[i + 1]];
      const parts = []; let x = 0, y = 0, cur = null;
      for (let i = 0; i < ft.cmds.length;) {
        const c = ft.cmds[i++], id = c & 7, n = c >> 3;
        if (id === 1 || id === 2) for (let k = 0; k < n; k++) { x += zig(ft.cmds[i++]); y += zig(ft.cmds[i++]); if (id === 1) { cur = [[x, y]]; parts.push(cur); } else if (cur) cur.push([x, y]); }
        else if (id === 7 && cur && cur.length) cur.push([cur[0][0], cur[0][1]]);
      }
      return { id: ft.id, type: ft.type, props, parts, extent };
    });
  }
  return layers;
}

// ---------- tile maths ----------
export const tileOf = (lat, lon, z = Z) => { const n = 2 ** z, s = Math.sin(lat * Math.PI / 180); return { x: Math.floor((lon + 180) / 360 * n), y: Math.floor((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n) }; };
const toLatLon = (tx, ty, px, py, extent, z = Z) => { const n = 2 ** z, X = (tx + px / extent) / n, Y = (ty + py / extent) / n; return { lat: Math.atan(Math.sinh(Math.PI * (1 - 2 * Y))) * 180 / Math.PI, lon: X * 360 - 180 }; };
const ringArea = pts => { let a = 0; for (let i = 0; i < pts.length - 1; i++) a += pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1]; return a / 2; };

// ---------- OpenMapTiles layers → OpenStreetMap tags (what osm.js understands) ----------
const PATH_SUB = new Set(['footway', 'path', 'pedestrian', 'cycleway', 'steps', 'bridleway', 'corridor']);
const RAIL_SUB = new Set(['rail', 'light_rail', 'tram', 'subway', 'narrow_gauge']);
const TOURISM = new Set(['artwork', 'viewpoint', 'attraction', 'museum', 'gallery']);
const AMENITY = new Set(['fountain', 'library', 'arts_centre', 'community_centre', 'townhall', 'marketplace', 'theatre', 'clock', 'school', 'kindergarten', 'childcare', 'hospital', 'clinic', 'place_of_worship', 'prison', 'grave_yard']);
const HISTORIC = new Set(['monument', 'memorial', 'castle', 'ruins', 'archaeological_site', 'fort', 'wayside_cross', 'wayside_shrine', 'boundary_stone', 'milestone', 'manor', 'city_gate', 'battlefield', 'heritage']);
function tagsFor(layer, p) {
  const c = p.class, s = p.subclass, name = p.name_en || p.name || p['name:latin'] || undefined, T = o => (name ? { ...o, name } : o);
  switch (layer) {
    case 'transportation':
      if (['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'service', 'track'].includes(c)) return T({ highway: c });
      if (c === 'minor') return T({ highway: 'residential' });
      if (c === 'path') return s === 'platform' ? null : T({ highway: PATH_SUB.has(s) ? s : 'path' });
      if ((c === 'rail' || c === 'transit') && RAIL_SUB.has(s)) return T({ railway: s });
      return null;
    case 'water': return c === 'swimming_pool' ? null : { natural: 'water' };
    case 'waterway': return ['river', 'stream', 'canal'].includes(c) ? T({ waterway: c }) : null;
    case 'landcover':
      if (c === 'wood') return { natural: 'wood' };
      if (c === 'grass' && (s === 'park' || s === 'garden')) return { leisure: s }; // city parks live here in this format
      if (c === 'grass') return { landuse: ['meadow', 'grass', 'recreation_ground', 'village_green'].includes(s) ? s : 'grass' };
      if (c === 'sand' && s === 'beach') return { natural: 'beach' };
      return null;
    case 'landuse':
      if (['school', 'kindergarten', 'hospital'].includes(c)) return T({ amenity: c });
      if (['cemetery', 'military'].includes(c)) return T({ landuse: c });
      return null;
    case 'park': return c === 'park' ? T({ leisure: 'park' }) : ['nature_reserve', 'national_park', 'protected_area'].includes(c) ? T({ leisure: 'nature_reserve' }) : null;
    // outlines hidden behind their building parts, and parts that float above the ground, would only overlap other parts
    case 'building': return p.hide_3d || p.render_min_height > 0 ? null : { building: 'yes', height: p.render_height != null ? String(p.render_height) : undefined };
    case 'aeroway': return ['aerodrome', 'runway', 'helipad', 'heliport'].includes(c) ? { aeroway: c === 'heliport' ? 'helipad' : c } : null;
    case 'poi':
      if (TOURISM.has(s)) return T({ tourism: s });
      if (AMENITY.has(s)) return T({ amenity: s });
      if (HISTORIC.has(s)) return T({ historic: s });
      if (s === 'park' || s === 'garden') return name ? { parkName: name } : null; // a park's label: names the park it sits in
      return null;
  }
  return null;
}
const LAYERS = ['transportation', 'water', 'waterway', 'landcover', 'landuse', 'park', 'building', 'aeroway', 'poi'];

/** One tile as Overpass-style elements. Ids are stable (tile feature id, or position for unnamed bits). */
export function tileElements(layers, tx, ty) {
  const out = [];
  for (const L of LAYERS) for (const f of layers[L] || []) {
    const tags = tagsFor(L, f.props); if (!tags) continue;
    for (const k in tags) if (tags[k] === undefined) delete tags[k];
    const ll = ([x, y]) => toLatLon(tx, ty, x, y, f.extent), base = f.id != null ? f.id : 0;
    if (f.type === 1) { // points (landmarks): the same point can sit in two tiles' edges, so its id comes from where it is
      for (const part of f.parts) for (const pt of part) { const g = ll(pt); out.push({ type: 'node', id: f.id != null ? `t${L[0]}${f.id}` : `t${L[0]}_${g.lat.toFixed(4)}_${g.lon.toFixed(4)}_${tags.name || ''}`, lat: g.lat, lon: g.lon, tags }); }
    } else if (f.type === 2) {
      f.parts.forEach((part, i) => { if (part.length >= 2) out.push({ type: 'way', id: `t${L[0]}${tx}_${ty}_${base}_${i}`, tags, geometry: part.map(ll) }); });
    } else if (f.type === 3) {
      // An outline is followed by its holes (courtyards, the gaps between merged buildings, islands in a lake).
      let cur = null; const close = g => { const a = g[0], z = g[g.length - 1]; if (a.lat !== z.lat || a.lon !== z.lon) g.push({ ...a }); return g; };
      f.parts.forEach((part, i) => {
        if (part.length < 4) return; const area = ringArea(part);
        if (area > 0) { cur = { type: 'way', id: `t${L[0]}${tx}_${ty}_${base}_${i}`, tags, geometry: close(part.map(ll)), holes: [] }; out.push(cur); }
        else if (area < 0 && cur) cur.holes.push(close(part.map(ll)));
      });
    }
  }
  return out;
}

// ---------- fetching, with the phone's cache ----------
let template = null;
async function tileUrl(x, y) {
  if (!template) {
    const saved = JSON.parse(localStorage.getItem('kiki-tilejson') || 'null');
    if (saved && Date.now() - saved.at < 3 * 864e5) template = saved.url;
    else {
      try { const j = await (await fetch(TILEJSON)).json(); template = j.tiles[0]; localStorage.setItem('kiki-tilejson', JSON.stringify({ url: template, at: Date.now() })); }
      catch (e) { if (saved) template = saved.url; else throw new Error('tiles.openfreemap.org: ' + e.message); }
    }
  }
  return template.replace('{z}', Z).replace('{x}', x).replace('{y}', y);
}
const decoded = new Map(); // tiles already read this session
async function getTile(x, y) {
  const k = x + '/' + y; if (decoded.has(k)) return decoded.get(k);
  const key = `https://kiki-safari.local/tiles/${Z}/${k}`; let buf = null, cache = null;
  const within = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('timeout')), ms))]);
  try { cache = await within(caches.open(TILE_CACHE), 3000); const hit = await within(cache.match(key), 3000); if (hit && Date.now() - +(hit.headers.get('x-saved') || 0) < KEEP) buf = await hit.arrayBuffer(); } catch (e) {}
  if (!buf) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 25000);
    try {
      const r = await fetch(await tileUrl(x, y), { signal: ctl.signal }); if (!r.ok) throw new Error('tiles.openfreemap.org: HTTP ' + r.status);
      buf = await r.arrayBuffer();
      if (cache) cache.put(key, new Response(buf.slice(0), { headers: { 'x-saved': String(Date.now()), 'Content-Type': 'application/octet-stream' } })).catch(() => {});
    } catch (e) {
      if (cache) { try { const old = await cache.match(key); if (old) buf = await old.arrayBuffer(); } catch (e2) {} }
      if (!buf) throw new Error(e.name === 'AbortError' ? 'tiles.openfreemap.org: no answer in 25 s' : e.message);
    } finally { clearTimeout(t); }
  }
  const els = nameParks(tileElements(decodeTile(buf), x, y)); decoded.set(k, els); if (decoded.size > 12) decoded.delete(decoded.keys().next().value);
  return els;
}
/** Park labels (points) give their name to the park outline they sit in; then the label points are dropped. */
function nameParks(els) {
  const labels = els.filter(e => e.type === 'node' && e.tags.parkName), parks = els.filter(e => e.type === 'way' && e.tags.leisure && !e.tags.name);
  for (const l of labels) {
    let best = null, bestSize = Infinity;
    for (const p of parks) {
      const g = p.geometry; let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
      for (const q of g) { if (q.lat < minLat) minLat = q.lat; if (q.lat > maxLat) maxLat = q.lat; if (q.lon < minLon) minLon = q.lon; if (q.lon > maxLon) maxLon = q.lon; }
      if (l.lat < minLat || l.lat > maxLat || l.lon < minLon || l.lon > maxLon) continue;
      let inside = false; for (let i = 0, j = g.length - 1; i < g.length; j = i++) { const a = g[i], b = g[j]; if ((a.lat > l.lat) !== (b.lat > l.lat) && l.lon < (b.lon - a.lon) * (l.lat - a.lat) / (b.lat - a.lat) + a.lon) inside = !inside; }
      const size = (maxLat - minLat) * (maxLon - minLon); if (inside && size < bestSize) { best = p; bestSize = size; }
    }
    if (best) best.tags = { ...best.tags, name: l.tags.parkName };
  }
  return els.filter(e => !(e.type === 'node' && e.tags.parkName));
}
/** Map data for a box (south, west, north, east) as Overpass-style JSON: every tile it touches, merged. */
export async function tilesFor(s, w, n, e) {
  const a = tileOf(n, w), b = tileOf(s, e), seen = new Set(), elements = [];
  for (let x = a.x; x <= b.x; x++) for (let y = a.y; y <= b.y; y++) for (const el of await getTile(x, y)) {
    if (seen.has(el.id)) continue; seen.add(el.id);
    if (el.type === 'node' ? el.lat < s || el.lat > n || el.lon < w || el.lon > e : !el.geometry.some(g => g.lat >= s - 0.002 && g.lat <= n + 0.002 && g.lon >= w - 0.003 && g.lon <= e + 0.003)) continue;
    elements.push(el);
  }
  return { elements, source: 'openfreemap' };
}
