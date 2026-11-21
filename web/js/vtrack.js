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
const R = 10;            // search radius around the predicted spot
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
  /** Stop and forget the anchors (camera off, AR off). The drift correction is kept. */
  stop() { this.on = false; this.anchors = []; }
  focal() { return (this.h / 2) / Math.tan(this.camera.fov * Math.PI / 360); }
  /** Grab the part of the camera picture that is on screen (as shown with object-fit: cover), small and grey. */
  grab(src, screenW, screenH) {
    const vw = src.videoWidth || src.width, vh = src.videoHeight || src.height; if (!vw || !vh) return false;
    const w = SW, h = Math.round(SW * screenH / screenW);
    if (w !== this.w || h !== this.h) { this.w = w; this.h = h; this.canvas.width = w; this.canvas.height = h; this.gray = new Float32Array(w * h); this.anchors = []; }
    const s = Math.max(screenW / vw, screenH / vh), cw = screenW / s, ch = screenH / s;
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
  template(cx, cy) {
    const g = this.gray, w = this.w, t = new Float32Array(T * T); let m = 0;
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const v = g[(cy - H + y) * w + cx - H + x]; t[y * T + x] = v; m += v; }
    m /= T * T; let s = 0; for (let i = 0; i < t.length; i++) { t[i] -= m; s += t[i] * t[i]; }
    if (s < T * T * 36) return null; // too flat to find again (std below ~6 grey levels)
    s = Math.sqrt(s); for (let i = 0; i < t.length; i++) t[i] /= s; return t;
  }
  /** Best match of a template within R of (px, py): sub-pixel spot and its correlation. */
  search(t, px, py) {
    const g = this.gray, w = this.w, h = this.h, n = T * T, x0 = Math.round(px), y0 = Math.round(py);
    let best = -2, bx = 0, by = 0; const scores = new Float32Array((2 * R + 1) * (2 * R + 1));
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
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
    const at = (dx, dy) => (Math.abs(dx) > R || Math.abs(dy) > R) ? best : scores[(dy + R) * (2 * R + 1) + dx + R];
    const sub = (a, b, c) => { const d = a - 2 * b + c; return d < 0 ? 0.5 * (a - c) / d : 0; };
    const ox = sub(at(bx - 1, by), best, at(bx + 1, by)), oy = sub(at(bx, by - 1), best, at(bx, by + 1));
    return { x: x0 + bx + Math.max(-0.5, Math.min(0.5, ox)), y: y0 + by + Math.max(-0.5, Math.min(0.5, oy)), score: best, edge: Math.abs(bx) === R || Math.abs(by) === R };
  }
  /** New anchors at the most textured spots not already used (Shi-Tomasi corner strength on a grid). */
  replenish() {
    const g = this.gray, w = this.w, h = this.h, m = R + H + 2, cands = [];
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
    if (!this.grab(src, screenW, screenH)) return;
    this.on = true; this.frame++;
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
}
