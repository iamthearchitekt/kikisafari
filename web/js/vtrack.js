// Visual lock for AR (owner: "the AR objects won't stay in place … no drifting at all").
//
// The gyroscope gives a smooth view, but every phone's gyroscope slowly wanders, and the 3D camera's field of view
// never exactly matches the phone's lens, so on their own objects creep or slide against the real scene. This pins the
// 3D camera to the camera picture itself, the way real AR does:
//  - a few anchors: small textured patches of the real scene (corners, edges, patterns), each with the direction it
//    was seen in;
//  - every frame, each anchor is looked for (normalised cross-correlation) around where the gyroscope says it should
//    be; the gap between predicted and found positions (median over the anchors) is the gyroscope's drift;
//  - the turn error is fed back into the view (Orientation.corr); the lens's field of view is measured from how far
//    the picture moves for each degree the gyroscope turns, and the 3D camera is set to match (remembered on the phone).
// With a plain wall or darkness there is nothing to lock to, and the gyroscope alone carries on.
import * as THREE from '../vendor/three.module.min.js';

const SW = 128;          // width of the small grey copy of the picture that is searched
const T = 15, H = 7;     // template size (pixels of the small copy) and its half
const RAD = 10;          // search radius around the predicted spot
const SURF_R = 12;       // the surface under Kiki is searched further (it moves when you move, not only when you turn)
const WIDE = 72;         // and once lost (you walked while it was out of view), across most of the picture
const SPOT_X = 15, SPOT_Y = 12; // how far around Kiki's feet findable spots are picked
const NSURF = 7;         // patches remembered for the surface
const MINC = 250;        // how findable a spot must be (see corner())
const AMBIG = 0.06;      // a match counts only if no other place looks nearly as alike
const WANT = 7;          // anchors to keep in view
const KEEP = 48;         // anchors remembered in all (a small map of the room: they are found again when back in view)
const GOOD = 0.72;       // correlation needed to trust a match
const FOV_KEY = 'kiki-ar-fov';

export class VisualLock {
  constructor(orient, camera) {
    this.orient = orient; this.camera = camera;
    this.canvas = document.createElement('canvas'); this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.gray = null; this.w = 0; this.h = 0; this.anchors = []; this.frame = 0; this.on = false;
    const saved = +localStorage.getItem(FOV_KEY); if (saved > 35 && saved < 90) { camera.fov = saved; camera.updateProjectionMatrix(); }
    this.q = new THREE.Quaternion(); this.qi = new THREE.Quaternion(); this.v = new THREE.Vector3();
    this.stats = { matched: 0, anchors: 0 };
  }
  watch(video) {
    if (this.watched === video) return;
    this.watched = video; this.newFrame = true; this.staleN = 0;
    const on = () => { this.newFrame = true; if (this.watched === video) video.requestVideoFrameCallback(on); };
    video.requestVideoFrameCallback(on);
  }
  /** Stop and forget the anchors (camera off, AR off). The drift correction is kept. */
  stop() { this.on = false; this.anchors = []; }
  focal() { return (this.h / 2) / Math.tan(this.camera.fov * Math.PI / 360); }
  /** Grab the part of the camera picture that is on screen (as shown with object-fit: cover), small and grey. */
  grab(src, screenW, screenH) {
    const vw = src.videoWidth || src.width, vh = src.videoHeight || src.height; if (!vw || !vh) return false;
    const w = SW, h = Math.round(SW * screenH / screenW); this.sw = screenW; this.sh = screenH;
    if (w !== this.w || h !== this.h) { this.w = w; this.h = h; this.canvas.width = w; this.canvas.height = h; this.gray = new Float32Array(w * h); this.anchors = []; }
    const s = Math.max(screenW / vw, screenH / vh), cw = screenW / s, ch = screenH / s;
    // a smooth shrink: plain sampling turns fine detail (wood grain, carpet) into shimmer that can't be tracked
    // (set each time: resizing the canvas resets it)
    this.ctx.imageSmoothingEnabled = true; this.ctx.imageSmoothingQuality = 'high';
    this.ctx.drawImage(src, (vw - cw) / 2, (vh - ch) / 2, cw, ch, 0, 0, w, h);
    const d = this.ctx.getImageData(0, 0, w, h).data, g = this.gray;
    for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = d[j] * 0.299 + d[j + 1] * 0.587 + d[j + 2] * 0.114;
    return true;
  }
  /** Screen spot (small-copy pixels) of a direction seen by the camera; null if behind. */
  project(dir, out) {
    const v = this.v.copy(dir).applyQuaternion(this.qi); if (v.z > -1e-3) return null;
    const f = this.focal(); out.x = this.w / 2 + f * v.x / -v.z; out.y = this.h / 2 - f * v.y / -v.z; return out;
  }
  unproject(x, y) { const f = this.focal(); return new THREE.Vector3((x - this.w / 2) / f, -(y - this.h / 2) / f, -1).normalize().applyQuaternion(this.q); }
  template(cx, cy, min = 36) {
    const g = this.gray, w = this.w, t = new Float32Array(T * T); let m = 0;
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const v = g[(cy - H + y) * w + cx - H + x]; t[y * T + x] = v; m += v; }
    m /= T * T; let s = 0; for (let i = 0; i < t.length; i++) { t[i] -= m; s += t[i] * t[i]; }
    if (s < T * T * min) return null; // too flat to find again (std below ~6 grey levels; 3 for the surface's picked spots)
    s = Math.sqrt(s); for (let i = 0; i < t.length; i++) t[i] /= s; return t;
  }
  /** Best match of a template within R of (px, py): sub-pixel spot and its correlation. */
  search(t, px, py, R = RAD, step = 1) {
    const g = this.gray, w = this.w, h = this.h, n = T * T, x0 = Math.round(px), y0 = Math.round(py);
    let best = -2, bx = 0, by = 0; const scores = new Float32Array((2 * R + 1) * (2 * R + 1)).fill(-2);
    for (let dy = -R; dy <= R; dy += step) for (let dx = -R; dx <= R; dx += step) {
      const cx = x0 + dx, cy = y0 + dy; let sc = -2;
      if (cx - H >= 0 && cy - H >= 0 && cx + H < w && cy + H < h) {
        let si = 0, sii = 0, sit = 0;
        for (let y = 0; y < T; y++) { const row = (cy - H + y) * w + cx - H, tr = y * T; for (let x = 0; x < T; x++) { const v = g[row + x]; si += v; sii += v * v; sit += v * t[tr + x]; } }
        const den = Math.sqrt(Math.max(1e-6, sii - si * si / n)); sc = sit / den;
      }
      scores[(dy + R) * (2 * R + 1) + dx + R] = sc;
      if (sc > best) { best = sc; bx = dx; by = dy; }
    }
    // sub-pixel: a parabola through the neighbours
    // the best score away from the peak: nearly as high means the patch could be in more than one place (stripes, repeats)
    let second = -2; const ex = step > 1 ? 4 : 3;
    for (let dy = -R; dy <= R; dy += step) for (let dx = -R; dx <= R; dx += step) if (Math.abs(dx - bx) > ex || Math.abs(dy - by) > ex) { const v = scores[(dy + R) * (2 * R + 1) + dx + R]; if (v > second) second = v; }
    if (step > 1) return { x: x0 + bx, y: y0 + by, score: best, second, edge: Math.abs(bx) >= R - step + 1 || Math.abs(by) >= R - step + 1 };
    const at = (dx, dy) => (Math.abs(dx) > R || Math.abs(dy) > R) ? best : scores[(dy + R) * (2 * R + 1) + dx + R];
    const sub = (a, b, c) => { const d = a - 2 * b + c; return d < 0 ? 0.5 * (a - c) / d : 0; };
    const ox = sub(at(bx - 1, by), best, at(bx + 1, by)), oy = sub(at(bx, by - 1), best, at(bx, by + 1));
    return { x: x0 + bx + Math.max(-0.5, Math.min(0.5, ox)), y: y0 + by + Math.max(-0.5, Math.min(0.5, oy)), score: best, second, edge: Math.abs(bx) === R || Math.abs(by) === R };
  }
  /** New anchors at the most textured spots not already used (Shi-Tomasi corner strength on a grid). */
  replenish() {
    const g = this.gray, w = this.w, h = this.h, m = RAD + H + 2, cands = [];
    for (let cy = m; cy < h - m; cy += 5) for (let cx = m; cx < w - m; cx += 5) {
      let xx = 0, yy = 0, xy = 0;
      for (let y = -H; y <= H; y += 2) for (let x = -H; x <= H; x += 2) { const i = (cy + y) * w + cx + x, gx = g[i + 1] - g[i - 1], gy = g[i + w] - g[i - w]; xx += gx * gx; yy += gy * gy; xy += gx * gy; }
      const tr = xx + yy, det = xx * yy - xy * xy, lmin = tr / 2 - Math.sqrt(Math.max(0, tr * tr / 4 - det));
      cands.push({ cx, cy, s: lmin });
    }
    cands.sort((a, b) => b.s - a.s);
    const p = { x: 0, y: 0 };
    for (const c of cands) {
      if (this.visible >= WANT || c.s < 400) break;
      if (this.anchors.some(a => this.project(a.dir, p) && Math.hypot(p.x - c.cx, p.y - c.cy) < 16)) continue;
      if (this.anchors.length >= KEEP) { this.anchors.sort((u, v) => v.miss - u.miss); this.anchors.shift(); }
      const t = this.template(c.cx, c.cy); if (!t) continue;
      this.anchors.push({ x0: c.cx, y0: c.cy, q0: this.q.clone(), t, miss: 0, dir: this.unproject(c.cx, c.cy) }); this.visible++;
    }
  }
  /** One frame: find the anchors, correct the view's sideways drift and the field of view. */
  update(src, screenW, screenH) {
    // Only new camera frames (the camera gives about 30 a second, the screen draws 60): an old frame looked at again
    // after the phone turned would read as drift, and it's wasted work. (If the browser stops saying, carry on anyway.)
    if (src.requestVideoFrameCallback) {
      this.watch(src);
      if (!this.newFrame && ++this.staleN < 12) return;
      this.newFrame = false; this.staleN = 0;
    }
    if (!this.grab(src, screenW, screenH)) return;
    this.on = true; this.frame++; this.fresh = true;
    this.q.copy(this.camera.quaternion); this.qi.copy(this.q).invert();
    const p = { x: 0, y: 0 }, ms = [], fs = [], cx = this.w / 2;
    // how far the phone turned since the last frame
    // (by the gyroscope, less its drift: a slow average of how fast the correction has been moving)
    if (this.lastCorr != null) this.driftRate = (this.driftRate || 0) * 0.98 + (this.orient.corr - this.lastCorr) * 0.02; this.lastCorr = this.orient.corr;
    const raw = this.orient.rawHeading(this.orient.target) * Math.PI / 180, dth0 = this.lastRaw == null ? 0 : Math.atan2(Math.sin(raw - this.lastRaw), Math.cos(raw - this.lastRaw)); this.lastRaw = raw;
    const dth = dth0 - (this.driftRate || 0);
    const f0 = this.focal(); this.visible = 0;
    for (const a of this.anchors) {
      // its direction, from where it was first seen and the current lens estimate
      a.dir.set((a.x0 - cx) / f0, -(a.y0 - this.h / 2) / f0, -1).normalize().applyQuaternion(a.q0);
      if (!this.project(a.dir, p) || p.x < H + 1 || p.y < H + 1 || p.x > this.w - H - 2 || p.y > this.h - H - 2) { a.lf = 0; continue; } // out of view: kept for later
      this.visible++;
      const r = this.search(a.t, p.x, p.y);
      if (r.score >= GOOD && !r.edge) {
        a.miss = Math.max(0, a.miss - 1); ms.push({ ex: r.x - p.x, ey: r.y - p.y });
        // the lens: a turn of dθ moves a point at x by (f + x²/f)·dθ, so f follows from how far the anchor moved
        if (a.lf === this.frame - 1 && Math.abs(dth) > 0.004) {
          const k = -(r.x - a.lx) / dth, x = (r.x + a.lx) / 2 - cx, disc = k * k - 4 * x * x;
          if (k > 0 && disc > 0) fs.push((k + Math.sqrt(disc)) / 2);
        }
        a.lx = r.x; a.ly = r.y; a.lf = this.frame;
      } else { a.miss += 2; a.lf = 0; }
    }
    this.anchors = this.anchors.filter(a => a.miss < 24);
    this.stats = { matched: ms.length, anchors: this.anchors.length, visible: this.visible };
    if (ms.length >= 2) {
      // sideways drift: the median gap between where the anchors are and where the view puts them
      const ex = ms.map(m => m.ex).sort((u, v) => u - v)[ms.length >> 1];
      // a feature to the right of where it should be: the phone points further left than the gyroscope says
      this.orient.corr += Math.atan(ex / this.focal()) * 0.5;
    }
    if (fs.length >= 2) {
      fs.sort((u, v) => u - v); const fm = fs[fs.length >> 1];
      this.fEst = this.fEst ? this.fEst * 0.85 + fm * 0.15 : fm;
      const fov = Math.max(35, Math.min(90, 2 * Math.atan((this.h / 2) / this.fEst) * 180 / Math.PI));
      if (Math.abs(fov - this.camera.fov) > 0.05) { this.camera.fov += (fov - this.camera.fov) * 0.3; this.camera.updateProjectionMatrix(); }
      if (this.frame % 60 === 0) localStorage.setItem(FOV_KEY, this.camera.fov.toFixed(2));
    }
    // more anchors where the view has too few (only while the view is locked, so new ones start out right)
    if (this.visible < WANT && this.frame % 6 === 0 && (ms.length >= 2 || this.visible === 0)) { this.q.copy(this.camera.quaternion); this.replenish(); }
  }

  // ---------- the surface under Kiki (owner: "they need to find the nearest surface and remain there during the capture") ----------
  // The most findable little spots of the real surface around Kiki's feet (specks, corners, pattern: never plain areas
  // or stripes such as wood grain, which a patch could slide along) are remembered. Every frame they are found again in
  // the camera picture and Kiki's feet follow them, so Kiki stays standing on that spot of floor (or table) when you
  // turn, lean, step or crouch: the gyroscope can only follow turning, the picture shows everything. A match only counts
  // if it's clearly the one place that patch could be (not one of several look-alikes) and it moved the same way as the
  // others. If the spot isn't found where it should be (you walked while it was out of view), it's searched for across
  // most of the picture until the patches turn up again together.
  /** How findable the small copy is at (x, y): the weaker of the two gradient directions (Shi-Tomasi). 0 for plain
   *  areas and for stripes; high for specks and corners. */
  corner(x, y) {
    const g = this.gray, w = this.w; x = Math.round(x); y = Math.round(y);
    if (x < H + 2 || y < H + 2 || x > this.w - H - 3 || y > this.h - H - 3) return 0;
    let xx = 0, yy = 0, xy = 0;
    for (let j = -H; j <= H; j++) for (let i = -H; i <= H; i++) { const k = (y + j) * w + x + i, gx = g[k + 1] - g[k - 1], gy = g[k + w] - g[k - w]; xx += gx * gx; yy += gy * gy; xy += gx * gy; }
    const tr = xx + yy, det = xx * yy - xy * xy; return (tr / 2 - Math.sqrt(Math.max(0, tr * tr / 4 - det))) / 4;
  }
  /** The most findable spots near (x, y) of the small copy, well apart, nearer the feet first among equals. */
  spots(x, y) {
    const c = [];
    for (let dy = -SPOT_Y; dy <= SPOT_Y; dy += 3) for (let dx = -SPOT_X; dx <= SPOT_X; dx += 3) {
      const cx = Math.round(x + dx), cy = Math.round(y + dy), v = this.corner(cx, cy);
      if (v >= MINC) c.push({ cx, cy, v: v / (1 + (dx * dx + dy * dy) / 300) });
    }
    c.sort((a, b) => b.v - a.v);
    const out = [];
    for (const s of c) { if (out.every(o => Math.hypot(o.cx - s.cx, o.cy - s.cy) >= 6)) out.push(s); if (out.length >= NSURF) break; }
    return out;
  }
  /** How many findable spots the surface at a screen spot has (3 or more: Kiki can be kept on it). */
  surfaceSpots(sx, sy) { return this.gray ? this.spots(sx * this.w / this.sw, sy * this.h / this.sh).length : 0; }
  /** Remember the surface around a screen spot (Kiki's feet). Returns how many patches were remembered (0: none fit). */
  setSurface(sx, sy) {
    this.surf = null; if (!this.gray) return 0;
    this.q.copy(this.camera.quaternion); this.qi.copy(this.q).invert();
    const x = sx * this.w / this.sw, y = sy * this.h / this.sh, list = [];
    for (const s of this.spots(x, y)) {
      const t = this.template(s.cx, s.cy, 9); if (!t) continue;
      const u = this.unproject(s.cx, s.cy); list.push({ u, dir: u.clone(), t0: t, t, ox: 0, oy: 0, hits: 0 });
    }
    if (list.length < 2) return 0; // one patch alone can't be checked against anything
    this.surf = { patches: list, u: this.unproject(x, y), lost: 0 };
    return list.length;
  }
  clearSurface() { this.surf = null; }
  /** One patch near (px, py): by its first look while that still matches (so nothing creeps), else by its latest look. */
  findPatch(a, px, py, R) {
    let r = this.search(a.t0, px, py, R);
    if ((r.score < 0.8 || r.second > r.score - AMBIG) && a.t !== a.t0) { const r2 = this.search(a.t, px, py, R); if (r2.score > r.score && r2.second <= r2.score - AMBIG) { r = r2; r.x -= a.ox; r.y -= a.oy; } }
    return r;
  }
  /** This frame's spot of the remembered surface (screen px), or null if it can't be seen. */
  trackSurface() {
    const S = this.surf; if (!S || !this.fresh) return null;
    this.fresh = false; this.qi.copy(this.camera.quaternion).invert(); this.q.copy(this.camera.quaternion);
    const p = { x: 0, y: 0 }, ds = []; let seen = 0;
    for (const a of S.patches) {
      if (!this.project(a.dir, p) || p.x < H + 1 || p.y < H + 1 || p.x > this.w - H - 2 || p.y > this.h - H - 2) continue;
      seen++;
      const r = this.findPatch(a, p.x, p.y, SURF_R);
      if (r.score < 0.7 || r.edge || r.second > r.score - AMBIG) continue;
      ds.push([r.x - p.x, r.y - p.y, a, r]);
    }
    // enough patches must agree for a good fit: three if three or more can be seen (two alone can mislead a little)
    const need = Math.min(3, Math.max(2, seen));
    let m = ds.length >= 2 ? agree(ds) : null;
    if (!m || m.length < need) {
      if (m && m.length >= 2) return null; // nearly: just skip this frame
      // Not found where expected. Only counts as lost while it should be in view (looking away and back is fine).
      if (seen < 2) return null;
      S.lost++;
      m = this.reacquire(S); if (!m) return null;
    }
    S.lost = 0;
    for (const [, , a, r] of m) {
      a.dir = this.unproject(r.x, r.y); a.hits++;
      // the surface looks a little different as you move: keep a fresh look too (the first look stays the reference)
      if (a.hits % 15 === 0 && r.score < 0.9) { const cx = Math.round(r.x), cy = Math.round(r.y), t = this.template(cx, cy, 9); if (t) { a.t = t; a.ox = cx - r.x; a.oy = cy - r.y; } }
    }
    // Where the patches are now, against where turning alone would have put them: a small local fit (shift, plus the
    // stretch and skew of seeing the floor from a new spot), read at the feet. Measured afresh each frame from the
    // first sighting, so small errors never add up.
    if (!this.project(S.u, p)) return null;
    const fx = p.x, fy = p.y, pts = [];
    for (const [, , a, r] of m) if (this.project(a.u, p)) pts.push([p.x - fx, p.y - fy, r.x, r.y]);
    if (pts.length < 2) return null;
    const A = fitAffine(pts);
    // the patches that weren't found move along with the rest (the surface moves as one)
    for (const a of S.patches) if (!m.some(e => e[2] === a) && this.project(a.u, p)) { const dx = p.x - fx, dy = p.y - fy; a.dir = this.unproject(A[0] * dx + A[1] * dy + A[2], A[3] * dx + A[4] * dy + A[5]); }
    return { x: A[2] * this.sw / this.w, y: A[5] * this.sh / this.h, n: m.length };
  }
  /** The surface wasn't where it should be: search most of the picture (coarse, then fine) for the strongest patches,
   *  and trust what's found only if they agree. */
  reacquire(S) {
    if (S.lost % 3 !== 1) return null; // a wide search costs more: every third frame is plenty
    const p = { x: 0, y: 0 }, c = [];
    for (const a of S.patches.slice(0, 4)) {
      if (!this.project(a.dir, p) || p.x < 0 || p.y < 0 || p.x > this.w || p.y > this.h) continue;
      let r0 = this.search(a.t0, p.x, p.y, WIDE, 2);
      if (r0.score < 0.75 && a.t !== a.t0) { const r1 = this.search(a.t, p.x, p.y, WIDE, 2); if (r1.score > r0.score) r0 = r1; }
      // (looser than frame to frame: after walking, the surface is seen from a new spot and looks a bit different;
      // the patches having to agree with each other is what makes this safe)
      if (r0.score < 0.62 || r0.edge || r0.second > r0.score - AMBIG / 2) continue;
      const r = this.findPatch(a, r0.x, r0.y, 3); if (r.score >= 0.7) c.push([r.x - p.x, r.y - p.y, a, r, p.x, p.y]);
    }
    // agreeing allows for the stretch of seeing the surface from closer or further: more for patches further apart
    const m = c.length >= 2 ? agree(c, (u, v) => 2.5 + 0.25 * Math.hypot(u[4] - v[4], u[5] - v[5])) : null;
    return m && m.length >= Math.min(3, S.patches.length) ? m : null;
  }
}

/** The biggest group of matches that moved the same way (within 2.5 px of each other, or what tol allows). */
function agree(ds, tol = () => 2.5) {
  let best = [];
  for (const u of ds) { const g = ds.filter(v => Math.hypot(v[0] - u[0], v[1] - u[1]) < tol(u, v)); if (g.length > best.length) best = g; }
  return best;
}
/** Least-squares X = a·dx + b·dy + c, Y = d·dx + e·dy + f, gently held to a plain shift (a = e = 1, b = d = 0) so two
 *  patches, or patches in a line, still give a steady answer. Returns [a, b, c, d, e, f]. */
function fitAffine(pts, lam = 40) {
  const one = k => {
    const M = [[lam, 0, 0], [0, lam, 0], [0, 0, 1e-6]], v = [k ? 0 : lam, k ? lam : 0, 0];
    for (const [dx, dy, X, Y] of pts) { const r = [dx, dy, 1], z = k ? Y : X; for (let i = 0; i < 3; i++) { v[i] += r[i] * z; for (let j = 0; j < 3; j++) M[i][j] += r[i] * r[j]; } }
    return solve3(M, v);
  };
  return [...one(0), ...one(1)];
}
function solve3(M, v) {
  const det = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(M);
  return [0, 1, 2].map(c => det(M.map((row, i) => row.map((x, j) => j === c ? v[i] : x))) / D);
}
