using System;
using System.Collections.Generic;

namespace KikiSafari.Core.Art
{
    /// <summary>RGBA colour, components 0..1 (sRGB, straight alpha).</summary>
    public struct Rgba
    {
        public float R, G, B, A;
        public Rgba(float r, float g, float b, float a = 1f) { R = r; G = g; B = b; A = a; }
        public static Rgba Hex(uint rgb, float a = 1f) => new Rgba(((rgb >> 16) & 255) / 255f, ((rgb >> 8) & 255) / 255f, (rgb & 255) / 255f, a);
        public Rgba WithA(float a) => new Rgba(R, G, B, a);
        public static Rgba Lerp(Rgba a, Rgba b, float t) => new Rgba(a.R + (b.R - a.R) * t, a.G + (b.G - a.G) * t, a.B + (b.B - a.B) * t, a.A + (b.A - a.A) * t);
    }

    public struct P2
    {
        public float X, Y;
        public P2(float x, float y) { X = x; Y = y; }
    }

    /// <summary>
    /// A tiny software canvas with the handful of HTML-canvas operations the claw game uses to paint Big Plush's face:
    /// anti-aliased circles, polylines (with dashes), polygons and clipping. Y runs down, like an HTML canvas.
    /// Engine-free so the art can be generated and checked outside Unity.
    /// </summary>
    public sealed class Canvas
    {
        public readonly int Width, Height;
        public readonly float[] Px; // RGBA interleaved

        public Canvas(int w, int h, Rgba fill)
        {
            Width = w; Height = h;
            Px = new float[w * h * 4];
            for (int i = 0; i < w * h; i++) { Px[i * 4] = fill.R; Px[i * 4 + 1] = fill.G; Px[i * 4 + 2] = fill.B; Px[i * 4 + 3] = fill.A; }
        }

        public void Blend(int x, int y, Rgba c, float coverage)
        {
            if ((uint)x >= (uint)Width || (uint)y >= (uint)Height) return;
            float a = c.A * coverage;
            if (a <= 0) return;
            int i = (y * Width + x) * 4;
            Px[i] += (c.R - Px[i]) * a;
            Px[i + 1] += (c.G - Px[i + 1]) * a;
            Px[i + 2] += (c.B - Px[i + 2]) * a;
            Px[i + 3] = Px[i + 3] + a * (1 - Px[i + 3]);
        }

        static float Clamp01(float v) => v < 0 ? 0 : v > 1 ? 1 : v;

        public void FillRect(float x, float y, float w, float h, Rgba c)
        {
            int x0 = (int)Math.Floor(x), y0 = (int)Math.Floor(y), x1 = (int)Math.Ceiling(x + w), y1 = (int)Math.Ceiling(y + h);
            for (int py = y0; py < y1; py++)
            for (int px = x0; px < x1; px++)
            {
                float cx = Clamp01(Math.Min(px + 1, x + w) - Math.Max(px, x));
                float cy = Clamp01(Math.Min(py + 1, y + h) - Math.Max(py, y));
                Blend(px, py, c, cx * cy);
            }
        }

        public void FillCircle(float cx, float cy, float r, Rgba c, Func<int, int, float> clip = null)
        {
            int x0 = (int)Math.Floor(cx - r - 1), x1 = (int)Math.Ceiling(cx + r + 1);
            int y0 = (int)Math.Floor(cy - r - 1), y1 = (int)Math.Ceiling(cy + r + 1);
            for (int y = y0; y <= y1; y++)
            for (int x = x0; x <= x1; x++)
            {
                float dx = x + 0.5f - cx, dy = y + 0.5f - cy;
                float cov = Clamp01(r - (float)Math.Sqrt(dx * dx + dy * dy) + 0.5f);
                if (clip != null) cov *= clip(x, y);
                Blend(x, y, c, cov);
            }
        }

        public void FillEllipse(float cx, float cy, float rx, float ry, Rgba c, Func<int, int, float> clip = null)
        {
            int x0 = (int)Math.Floor(cx - rx - 1), x1 = (int)Math.Ceiling(cx + rx + 1);
            int y0 = (int)Math.Floor(cy - ry - 1), y1 = (int)Math.Ceiling(cy + ry + 1);
            float rm = Math.Min(rx, ry);
            for (int y = y0; y <= y1; y++)
            for (int x = x0; x <= x1; x++)
            {
                float dx = (x + 0.5f - cx) / rx, dy = (y + 0.5f - cy) / ry;
                float d = ((float)Math.Sqrt(dx * dx + dy * dy) - 1) * rm; // approx signed distance in px
                float cov = Clamp01(0.5f - d);
                if (clip != null) cov *= clip(x, y);
                Blend(x, y, c, cov);
            }
        }

        /// <summary>
        /// Strokes a polyline. Overlaps within one stroke don't double up (like canvas). Ends are round when
        /// <paramref name="roundCaps"/>, otherwise butt. Optional dash pattern [on, off] along the path.
        /// </summary>
        public void Stroke(IList<P2> pts, float width, Rgba c, bool roundCaps = true, float[] dash = null)
        {
            var pieces = dash == null ? new List<List<P2>> { new List<P2>(pts) } : DashPieces(pts, dash);
            float hw = width / 2;
            float minX = float.MaxValue, minY = float.MaxValue, maxX = float.MinValue, maxY = float.MinValue;
            foreach (var p in pts) { minX = Math.Min(minX, p.X); minY = Math.Min(minY, p.Y); maxX = Math.Max(maxX, p.X); maxY = Math.Max(maxY, p.Y); }
            int x0 = (int)Math.Floor(minX - hw - 1), x1 = (int)Math.Ceiling(maxX + hw + 1);
            int y0 = (int)Math.Floor(minY - hw - 1), y1 = (int)Math.Ceiling(maxY + hw + 1);
            x0 = Math.Max(0, x0); y0 = Math.Max(0, y0); x1 = Math.Min(Width - 1, x1); y1 = Math.Min(Height - 1, y1);
            for (int y = y0; y <= y1; y++)
            for (int x = x0; x <= x1; x++)
            {
                float px = x + 0.5f, py = y + 0.5f, best = float.MaxValue;
                foreach (var piece in pieces)
                    for (int i = 0; i + 1 < piece.Count; i++)
                    {
                        float d = SegDist(px, py, piece[i], piece[i + 1], !roundCaps, i == 0, i + 2 == piece.Count);
                        if (d < best) best = d;
                    }
                float cov = Clamp01(hw - best + 0.5f);
                if (cov > 0) Blend(x, y, c, cov);
            }
        }

        static float SegDist(float px, float py, P2 a, P2 b, bool butt, bool first, bool last)
        {
            float dx = b.X - a.X, dy = b.Y - a.Y;
            float len2 = dx * dx + dy * dy;
            float t = len2 <= 1e-9f ? 0 : ((px - a.X) * dx + (py - a.Y) * dy) / len2;
            if (butt && ((first && t < 0) || (last && t > 1))) return float.MaxValue;
            t = t < 0 ? 0 : t > 1 ? 1 : t;
            float qx = a.X + dx * t - px, qy = a.Y + dy * t - py;
            return (float)Math.Sqrt(qx * qx + qy * qy);
        }

        static List<List<P2>> DashPieces(IList<P2> pts, float[] dash)
        {
            var result = new List<List<P2>>();
            int di = 0; float left = dash[0]; bool on = true;
            var cur = new List<P2> { pts[0] };
            for (int i = 0; i + 1 < pts.Count; i++)
            {
                var a = pts[i]; var b = pts[i + 1];
                float segLen = (float)Math.Sqrt((b.X - a.X) * (b.X - a.X) + (b.Y - a.Y) * (b.Y - a.Y));
                float pos = 0;
                while (segLen - pos > left)
                {
                    pos += left;
                    float t = pos / segLen;
                    var p = new P2(a.X + (b.X - a.X) * t, a.Y + (b.Y - a.Y) * t);
                    if (on) { cur.Add(p); result.Add(cur); }
                    cur = new List<P2> { p };
                    on = !on; di = (di + 1) % dash.Length; left = dash[di];
                }
                left -= segLen - pos;
                cur.Add(b);
            }
            if (on && cur.Count > 1) result.Add(cur);
            return result;
        }

        /// <summary>Anti-aliased polygon coverage (4×4 supersampling, even-odd), as a function usable for fills and clips.</summary>
        public static Func<int, int, float> PolygonCoverage(IList<P2> poly)
        {
            var cache = new Dictionary<long, float>();
            return (x, y) =>
            {
                long key = ((long)x << 32) | (uint)y;
                if (cache.TryGetValue(key, out var v)) return v;
                int inside = 0;
                for (int sy = 0; sy < 4; sy++)
                for (int sx = 0; sx < 4; sx++)
                    if (Contains(poly, x + (sx + 0.5f) / 4f, y + (sy + 0.5f) / 4f)) inside++;
                v = inside / 16f;
                cache[key] = v;
                return v;
            };
        }

        public void FillPolygon(IList<P2> poly, Rgba c)
        {
            var cov = PolygonCoverage(poly);
            float minX = float.MaxValue, minY = float.MaxValue, maxX = float.MinValue, maxY = float.MinValue;
            foreach (var p in poly) { minX = Math.Min(minX, p.X); minY = Math.Min(minY, p.Y); maxX = Math.Max(maxX, p.X); maxY = Math.Max(maxY, p.Y); }
            for (int y = (int)Math.Floor(minY); y <= (int)Math.Ceiling(maxY); y++)
            for (int x = (int)Math.Floor(minX); x <= (int)Math.Ceiling(maxX); x++)
                Blend(x, y, c, cov(x, y));
        }

        static bool Contains(IList<P2> poly, float x, float y)
        {
            bool inside = false;
            for (int i = 0, j = poly.Count - 1; i < poly.Count; j = i++)
            {
                var a = poly[i]; var b = poly[j];
                if ((a.Y > y) != (b.Y > y) && x < (b.X - a.X) * (y - a.Y) / (b.Y - a.Y) + a.X) inside = !inside;
            }
            return inside;
        }

        // ---------- path helpers ----------

        public static void Quadratic(List<P2> path, P2 p0, P2 c, P2 p1, int steps = 24)
        {
            for (int i = 1; i <= steps; i++)
            {
                float t = i / (float)steps, u = 1 - t;
                path.Add(new P2(u * u * p0.X + 2 * u * t * c.X + t * t * p1.X, u * u * p0.Y + 2 * u * t * c.Y + t * t * p1.Y));
            }
        }

        public static void Cubic(List<P2> path, P2 p0, P2 c1, P2 c2, P2 p1, int steps = 32)
        {
            for (int i = 1; i <= steps; i++)
            {
                float t = i / (float)steps, u = 1 - t;
                float a = u * u * u, b = 3 * u * u * t, cc = 3 * u * t * t, d = t * t * t;
                path.Add(new P2(a * p0.X + b * c1.X + cc * c2.X + d * p1.X, a * p0.Y + b * c1.Y + cc * c2.Y + d * p1.Y));
            }
        }

        /// <summary>RGBA8 bytes, bottom row first (Unity's Texture2D order) when <paramref name="bottomUp"/>.</summary>
        public byte[] ToBytes(bool bottomUp)
        {
            var b = new byte[Width * Height * 4];
            for (int y = 0; y < Height; y++)
            {
                int sy = bottomUp ? Height - 1 - y : y;
                for (int x = 0; x < Width; x++)
                for (int k = 0; k < 4; k++)
                    b[(y * Width + x) * 4 + k] = (byte)(Clamp01(Px[(sy * Width + x) * 4 + k]) * 255f + 0.5f);
            }
            return b;
        }
    }
}
