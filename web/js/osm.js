// OpenStreetMap for KIKI SAFARI, ported from the Unity project's Core (Osm.cs, Landmarks.cs):
// classify an Overpass "out geom" response, keep spawns/stops/circles out of unsafe spots, find habitats,
// and place Rune Circles and supply stops at real landmarks. Map data © OpenStreetMap contributors.
import { toLocal, fromLocal, distance, hash, rng, cellOf } from './core.js';

export const ATTRIBUTION = '© OpenStreetMap contributors';
export const DATA_CELL = 800, CIRCLE_SPACING = 250, CIRCLES_PER_CELL = 3, STOP_SPACING = 70, STOP_FILL = 250;

export function overpassQuery(s, w, n, e) {
  const b = [s, w, n, e].map(v => v.toFixed(6)).join(',');
  return `[out:json][timeout:25][bbox:${b}];(` +
    'node["tourism"~"^(artwork|viewpoint|attraction|museum|gallery)$"];' +
    'node["amenity"~"^(fountain|library|arts_centre|community_centre|townhall|marketplace|theatre|clock)$"];' +
    'node["historic"];' +
    'way["leisure"~"^(park|garden|nature_reserve|common|dog_park)$"];' +
    'relation["leisure"~"^(park|nature_reserve)$"];' +
    'way["landuse"~"^(grass|meadow|recreation_ground|village_green|forest)$"];' +
    'way["natural"~"^(wood|water|scrub|grassland|beach)$"];' +
    'relation["natural"="water"];' +
    'way["waterway"~"^(river|stream|canal)$"];' +
    'way["highway"];' +
    'way["railway"~"^(rail|light_rail|tram|subway)$"];' +
    'way["building"];' +
    'nwr["amenity"~"^(school|kindergarten|childcare|hospital|clinic|place_of_worship|prison|grave_yard)$"];' +
    'nwr["landuse"~"^(cemetery|military|religious)$"];' +
    'nwr["aeroway"~"^(aerodrome|runway|helipad)$"];' +
    ');out geom qt;';
}

const EX_AMENITY = new Set(['school', 'kindergarten', 'childcare', 'hospital', 'clinic', 'place_of_worship', 'prison', 'grave_yard']);
const EX_LANDUSE = new Set(['cemetery', 'military', 'religious']);
const LM_TOURISM = new Set(['artwork', 'viewpoint', 'attraction', 'museum', 'gallery']);
const LM_AMENITY = new Set(['fountain', 'library', 'arts_centre', 'community_centre', 'townhall', 'marketplace', 'theatre', 'clock']);
const PATHS = new Set(['footway', 'path', 'pedestrian', 'cycleway', 'steps', 'bridleway', 'track', 'corridor']);

function classify(t, closed) {
  const name = t.name;
  if (t.amenity && EX_AMENITY.has(t.amenity)) return { kind: 'exclusion', cat: t.amenity, name };
  if (t.landuse && EX_LANDUSE.has(t.landuse)) return { kind: 'exclusion', cat: t.landuse, name };
  if (t.aeroway) return { kind: 'exclusion', cat: t.aeroway, name };
  if (t.historic === 'memorial' || t.memorial) return { kind: 'exclusion', cat: 'memorial', name };
  if (t.building) return { kind: 'building', cat: t.building, name, height: buildingHeight(t.height, t['building:levels']) };
  if (t.highway) return { kind: PATHS.has(t.highway) ? 'path' : 'road', cat: t.highway, name };
  if (t.railway) return { kind: 'rail', cat: t.railway, name };
  if (t.waterway) return { kind: 'waterline', cat: t.waterway, name };
  if (t.natural === 'water') return { kind: 'water', cat: 'water', name };
  if (t.natural === 'wood' || t.landuse === 'forest') return { kind: 'woods', cat: t.natural || t.landuse, name };
  if (t.leisure && closed) return { kind: 'park', cat: t.leisure, name };
  if (t.landuse || t.natural) return { kind: 'grass', cat: t.landuse || t.natural, name };
  if (t.tourism && LM_TOURISM.has(t.tourism)) return { kind: 'landmark', cat: t.tourism, name };
  if (t.amenity && LM_AMENITY.has(t.amenity)) return { kind: 'landmark', cat: t.amenity, name };
  if (t.historic) return { kind: 'landmark', cat: 'historic', name };
  return null;
}
/** Buildings on the map stay low (it's a board-game map, not a city model): taller buildings are a bit taller, up to
 * about the explorer's height, so towers never hide the streets, Kikis or you. */
function buildingHeight(h, levels) {
  let a = parseFloat(String(h || '').replace('m', ''));
  if (!isFinite(a)) { const l = parseFloat(levels); a = isFinite(l) ? l * 3.2 : NaN; }
  if (!isFinite(a)) return 7;
  return Math.round(Math.max(4, Math.min(13, 4 + Math.sqrt(Math.max(0, a)) * 0.9)));
}

// ---------- 2D helpers (metres: e = east, n = north) ----------
/** Inside a mapped shape, not in one of its holes (a courtyard, an island). */
export const insideShape = (f, p) => contains(f.local, p) && !(f.holesLocal || []).some(h => contains(h, p));
export function contains(ring, p) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.n > p.n) !== (b.n > p.n) && p.e < (b.e - a.e) * (p.n - a.n) / (b.n - a.n) + a.e) inside = !inside;
  }
  return inside;
}
export function distToLine(p, pts, closed) {
  let best = Infinity; const n = pts.length;
  if (n === 1) return Math.hypot(p.e - pts[0].e, p.n - pts[0].n);
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = pts[i], b = pts[(i + 1) % n], dx = b.e - a.e, dy = b.n - a.n, l2 = dx * dx + dy * dy;
    let t = l2 ? ((p.e - a.e) * dx + (p.n - a.n) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
    best = Math.min(best, Math.hypot(p.e - a.e - dx * t, p.n - a.n - dy * t));
  }
  return best;
}
export function roadHalf(hw) {
  return ({ motorway: 9, trunk: 9, primary: 6.5, secondary: 5.5, tertiary: 5, residential: 4, unclassified: 4, living_street: 4, service: 3 })[hw] || 3;
}

/** One downloaded area, classified. */
export class OsmArea {
  constructor(origin) { this.origin = origin; this.features = []; this._index = null; }

  static fromOverpass(json, origin) {
    const area = new OsmArea(origin);
    // Real map data has odd bits (a street crossing the edge of the area can come back with gaps, a park with no
    // outline). Each thing is read on its own and skipped if it's broken, so one odd item can't stop the whole map.
    const ok = g => g && Number.isFinite(g.lat) && Number.isFinite(g.lon);
    for (const el of (json.elements || [])) {
      try {
      const tags = el && el.tags; if (!tags) continue;
      const id = (el.type === 'node' ? 'n' : el.type === 'way' ? 'w' : 'r') + el.id;
      if (el.type === 'node') {
        if (!ok(el)) continue;
        const f = classify(tags, false); if (!f) continue;
        area.add(Object.assign(f, { id, pts: [{ lat: el.lat, lon: el.lon }], closed: false }));
      } else if (el.type === 'way') {
        const pts = (el.geometry || []).filter(ok).map(g => ({ lat: g.lat, lon: g.lon })); if (pts.length < 2) continue;
        const a = pts[0], z = pts[pts.length - 1];
        const closed = pts.length >= 4 && a.lat === z.lat && a.lon === z.lon;
        const f = classify(tags, closed); if (!f) continue;
        const holes = closed && Array.isArray(el.holes) ? el.holes.map(h => (h || []).filter(ok).map(g => ({ lat: g.lat, lon: g.lon }))).filter(h => h.length >= 4) : [];
        area.add(Object.assign(f, { id, pts, closed, holes }));
      } else if (el.type === 'relation') {
        let k = 0;
        for (const m of (el.members || [])) {
          if (!m || m.role !== 'outer') continue;
          const pts = (m.geometry || []).filter(ok).map(g => ({ lat: g.lat, lon: g.lon })); if (pts.length < 4) continue;
          if (pts[0].lat !== pts[pts.length - 1].lat || pts[0].lon !== pts[pts.length - 1].lon) pts.push(pts[0]);
          const f = classify(tags, true); if (!f) continue;
          area.add(Object.assign(f, { id: id + ':' + k++, pts, closed: true }));
        }
      }
      } catch (e) { area.skipped = (area.skipped || 0) + 1; }
    }
    return area;
  }

  add(f) {
    f.local = f.pts.map(p => toLocal(this.origin, p));
    f.holesLocal = (f.holes || []).map(h => h.map(p => toLocal(this.origin, p)));
    f.minE = Math.min(...f.local.map(p => p.e)); f.maxE = Math.max(...f.local.map(p => p.e));
    f.minN = Math.min(...f.local.map(p => p.n)); f.maxN = Math.max(...f.local.map(p => p.n));
    f.poly = f.closed && f.local.length >= 3;
    this.features.push(f);
  }

  local(p) { return toLocal(this.origin, p); }

  /** Features near a point (50 m buckets, padded by the largest check distance). */
  near(p) {
    if (!this._index) {
      this._index = new Map();
      for (const f of this.features) {
        let x0 = Math.floor((f.minE - 52) / 50), x1 = Math.floor((f.maxE + 52) / 50), y0 = Math.floor((f.minN - 52) / 50), y1 = Math.floor((f.maxN + 52) / 50);
        if ((x1 - x0 + 1) * (y1 - y0 + 1) > 4000) { x0 = Math.max(x0, -40); x1 = Math.min(x1, 40); y0 = Math.max(y0, -40); y1 = Math.min(y1, 40); }
        for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) { const k = x + ',' + y; let l = this._index.get(k); if (!l) this._index.set(k, l = []); l.push(f); }
      }
    }
    return this._index.get(Math.floor(p.e / 50) + ',' + Math.floor(p.n / 50)) || [];
  }

  /** Why a spot is unsafe, or null. Safety exclusions are reported first. */
  unsafe(spot, allowBuildings = false) {
    const p = this.local(spot), near = this.near(p);
    const box = (f, pad) => p.e >= f.minE - pad && p.e <= f.maxE + pad && p.n >= f.minN - pad && p.n <= f.maxN + pad;
    for (const f of near) {
      if (f.kind !== 'exclusion') continue;
      if (f.poly) { if (box(f, 15) && (contains(f.local, p) || distToLine(p, f.local, true) < 15)) return f.cat; }
      else if (f.local.length === 1) { if (Math.hypot(f.local[0].e - p.e, f.local[0].n - p.n) < 50) return f.cat; }
      else if (box(f, 15) && distToLine(p, f.local, false) < 15) return f.cat;
    }
    for (const f of near) {
      if (f.kind === 'building' && !allowBuildings && f.poly && box(f, 1) && insideShape(f, p)) return 'building';
      if (f.kind === 'water' && f.poly && box(f, 1) && insideShape(f, p)) return 'water';
      if (f.kind === 'waterline' && box(f, 10) && distToLine(p, f.local, false) < 8) return 'water';
      if (f.kind === 'road' && box(f, 12) && distToLine(p, f.local, false) < roadHalf(f.cat) + 3) return 'road';
      if (f.kind === 'rail' && box(f, 8) && distToLine(p, f.local, false) < 6) return 'railway';
    }
    return null;
  }

  habitatAt(spot) {
    const p = this.local(spot), near = this.near(p);
    const box = (f, pad) => p.e >= f.minE - pad && p.e <= f.maxE + pad && p.n >= f.minN - pad && p.n <= f.maxN + pad;
    for (const f of near) {
      if (f.kind === 'water' && f.poly && box(f, 40) && (contains(f.local, p) || distToLine(p, f.local, true) < 40)) return 'Water';
      if (f.kind === 'waterline' && box(f, 40) && distToLine(p, f.local, false) < 40) return 'Water';
    }
    for (const f of near) if (f.kind === 'woods' && f.poly && box(f, 0) && insideShape(f, p)) return 'Woods';
    for (const f of near) if ((f.kind === 'park' || f.kind === 'grass') && f.poly && box(f, 0) && insideShape(f, p)) return 'Meadow';
    return 'Town';
  }
}

function polyArea(pts) { let a = 0; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += pts[j].e * pts[i].n - pts[i].e * pts[j].n; return Math.abs(a) / 2; }
function centroid(pts) { const c = pts.length > 1 ? pts.length - 1 : 1; let e = 0, n = 0; for (let i = 0; i < c; i++) { e += pts[i].e; n += pts[i].n; } return { e: e / c, n: n / c }; }

export function circlePriority(f) {
  if (f.kind === 'park') return polyArea(f.local) > 5000 ? 5 : 2;
  if (f.cat === 'historic') return 5;
  if (f.cat === 'artwork' || f.cat === 'fountain') return 4;
  if (['museum', 'gallery', 'theatre', 'arts_centre', 'townhall', 'library', 'viewpoint', 'attraction'].includes(f.cat)) return 3;
  return 1;
}
function niceName(f) {
  if (f.name) return f.name;
  return ({ artwork: 'Public Art', fountain: 'Fountain', historic: 'Historic Site', library: 'Library', viewpoint: 'Viewpoint', park: 'Park', garden: 'Garden', common: 'Common' })[f.cat]
    || f.cat.charAt(0).toUpperCase() + f.cat.slice(1).replace(/_/g, ' ');
}

/** Supply stops and Rune Circles for one area: landmarks first, spaced; quiet squares filled; nothing unsafe. */
export function placeLandmarks(area, cell) {
  const stops = [], circles = [], cands = [];
  for (const f of area.features) {
    if (f.kind !== 'landmark' && f.kind !== 'park') continue;
    let at;
    if (f.kind === 'park') {
      if (!f.poly || polyArea(f.local) < 800) continue;
      const c = centroid(f.local); if (!contains(f.local, c)) continue;
      at = fromLocal(area.origin, c.e, c.n);
    } else at = f.pts[0];
    if (!cell.contains(at) || area.unsafe(at, true)) continue;
    cands.push({ spot: { id: 'osm:' + f.id, name: niceName(f), where: at, landmark: true, cat: f.cat }, prio: circlePriority(f), h: hash(f.id) });
  }
  const tooClose = (p, list, m) => list.some(s => distance(s.where, p) < m);
  cands.sort((a, b) => a.prio !== b.prio ? b.prio - a.prio : a.h - b.h);
  const used = new Set();
  for (const c of cands) {
    if (circles.length >= CIRCLES_PER_CELL || c.prio < 3) break;
    if (tooClose(c.spot.where, circles, CIRCLE_SPACING)) continue;
    circles.push({ id: 'circle:' + c.spot.id, name: c.spot.name + ' Rune Circle', where: c.spot.where, landmark: true });
    used.add(c.spot.id);
  }
  cands.sort((a, b) => a.h - b.h);
  for (const c of cands) {
    if (used.has(c.spot.id) || tooClose(c.spot.where, stops, STOP_SPACING) || tooClose(c.spot.where, circles, STOP_SPACING)) continue;
    stops.push(c.spot);
  }
  const green = area.features.filter(f => (f.kind === 'park' || f.kind === 'grass' || f.kind === 'woods') && f.poly && polyArea(f.local) > 400);
  const findSafe = (e0, n0, size, seed) => {
    const r = rng(seed);
    for (let pass = 0; pass < 2; pass++) for (let t = 0; t < 24; t++) {
      const p = cell.at(e0 + r.next() * size, n0 + r.next() * size);
      if (pass === 0) { const lp = area.local(p); if (!green.some(g => lp.e >= g.minE && lp.e <= g.maxE && lp.n >= g.minN && lp.n <= g.maxN && insideShape(g, lp))) continue; }
      if (!area.unsafe(p)) return p;
    }
    return null;
  };
  const sub = Math.round(DATA_CELL / STOP_FILL);
  for (let i = 0; i < sub; i++) for (let j = 0; j < sub; j++) {
    const e0 = i * STOP_FILL, n0 = j * STOP_FILL, ctr = cell.at(e0 + STOP_FILL / 2, n0 + STOP_FILL / 2);
    if (stops.some(s => distance(s.where, ctr) < STOP_FILL * 0.6)) continue;
    const p = findSafe(e0, n0, STOP_FILL, hash('s', cell.x, cell.y, i, j));
    if (p && !tooClose(p, stops, STOP_SPACING) && !tooClose(p, circles, STOP_SPACING)) stops.push({ id: `fill:s:${cell.x}:${cell.y}:${i}:${j}`, name: 'Supply Stop', where: p });
  }
  if (!circles.length) {
    const p = findSafe(DATA_CELL * 0.2, DATA_CELL * 0.2, DATA_CELL * 0.6, hash('c', cell.x, cell.y));
    if (p) {
      for (let i = stops.length - 1; i >= 0; i--) if (distance(stops[i].where, p) < STOP_SPACING) stops.splice(i, 1);
      circles.push({ id: `fill:c:${cell.x}:${cell.y}`, name: 'Rune Circle', where: p });
    }
  }
  return { stops, circles };
}

/** Everything loaded around the player. */
export class WorldData {
  constructor() { this.cells = new Map(); }
  key(c) { return c.x + ':' + c.y; }
  add(cell, area, placed = placeLandmarks(area, cell)) { this.cells.set(this.key(cell), { cell, area, ...placed }); }
  has(cell) { return this.cells.has(this.key(cell)); }
  areaAt(p) { const e = this.cells.get(this.key(cellOf(p, DATA_CELL))); return e ? e.area : null; }
  covers(p) { return !!this.areaAt(p); }
  isSafe(p) { const a = this.areaAt(p); return !a || !a.unsafe(p); }
  habitatAt(p) { const a = this.areaAt(p); return a ? a.habitatAt(p) : null; }
  *stops() { for (const e of this.cells.values()) yield* e.stops; }
  *circles() { for (const e of this.cells.values()) yield* e.circles; }
}
