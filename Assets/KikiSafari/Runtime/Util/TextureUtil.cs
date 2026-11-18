using System.Collections.Generic;
using UnityEngine;

namespace KikiSafari
{
    /// <summary>Procedural textures and sprites, cached. Nothing here needs imported art.</summary>
    public static class TextureUtil
    {
        static readonly Dictionary<string, Object> Cache = new Dictionary<string, Object>();

        static T Cached<T>(string key, System.Func<T> make) where T : Object
        {
            if (Cache.TryGetValue(key, out var o) && o != null) return (T)o;
            var v = make();
            Cache[key] = v;
            return v;
        }

        static Texture2D NewTex(int w, int h, string name, bool mips = false)
            => new Texture2D(w, h, TextureFormat.RGBA32, mips) { name = name, wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear };

        /// <summary>Signed distance to a rounded rectangle centred at the origin.</summary>
        static float RoundRectSdf(Vector2 p, Vector2 half, float r)
        {
            var q = new Vector2(Mathf.Abs(p.x) - half.x + r, Mathf.Abs(p.y) - half.y + r);
            return new Vector2(Mathf.Max(q.x, 0), Mathf.Max(q.y, 0)).magnitude + Mathf.Min(Mathf.Max(q.x, q.y), 0) - r;
        }

        /// <summary>White rounded rectangle, 9-sliced, for sticker panels. Tint with Image.color.</summary>
        public static Sprite RoundedRect(int radius = 28)
            => Cached("rr" + radius, () =>
            {
                int size = radius * 2 + 8;
                var t = NewTex(size, size, "RoundedRect");
                var half = new Vector2(size / 2f, size / 2f);
                var px = new Color32[size * size];
                for (int y = 0; y < size; y++)
                for (int x = 0; x < size; x++)
                {
                    float d = RoundRectSdf(new Vector2(x + 0.5f, y + 0.5f) - half, half, radius);
                    byte a = (byte)(Mathf.Clamp01(0.5f - d) * 255);
                    px[y * size + x] = new Color32(255, 255, 255, a);
                }
                t.SetPixels32(px); t.Apply();
                float b = radius + 2;
                return Sprite.Create(t, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), 100, 0, SpriteMeshType.FullRect, new Vector4(b, b, b, b));
            });

        /// <summary>
        /// Pill sprite with a vertical three-stop gradient baked in (e.g. the Play button: #fff27a → #ffcf2e → #f5a300).
        /// 9-sliced horizontally so it stretches to any width.
        /// </summary>
        public static Sprite GradientPill(Color top, Color mid, Color bottom)
            => Cached($"pill{ColorUtility.ToHtmlStringRGB(top)}{ColorUtility.ToHtmlStringRGB(mid)}{ColorUtility.ToHtmlStringRGB(bottom)}", () =>
            {
                int h = 128, w = 160, r = h / 2;
                var t = NewTex(w, h, "GradientPill");
                var half = new Vector2(w / 2f, h / 2f);
                var px = new Color[w * h];
                for (int y = 0; y < h; y++)
                {
                    float v = y / (float)(h - 1); // 0 bottom, 1 top
                    var c = v > 0.5f ? Color.Lerp(mid, top, (v - 0.5f) * 2) : Color.Lerp(bottom, mid, v * 2);
                    for (int x = 0; x < w; x++)
                    {
                        float d = RoundRectSdf(new Vector2(x + 0.5f, y + 0.5f) - half, half, r);
                        var cc = c; cc.a = Mathf.Clamp01(0.5f - d);
                        px[y * w + x] = cc;
                    }
                }
                t.SetPixels(px); t.Apply();
                return Sprite.Create(t, new Rect(0, 0, w, h), new Vector2(0.5f, 0.5f), 100, 0, SpriteMeshType.FullRect, new Vector4(r, 0, r, 0));
            });

        /// <summary>Soft radial falloff (white, alpha from 1 at the centre to 0 at the edge). Blob shadows and glows.</summary>
        public static Texture2D RadialBlob(int size = 128, float power = 1.6f)
            => Cached("blob" + size + power, () =>
            {
                var t = NewTex(size, size, "RadialBlob");
                var px = new Color32[size * size];
                for (int y = 0; y < size; y++)
                for (int x = 0; x < size; x++)
                {
                    float dx = (x + 0.5f) / size * 2 - 1, dy = (y + 0.5f) / size * 2 - 1;
                    float a = Mathf.Pow(Mathf.Clamp01(1 - Mathf.Sqrt(dx * dx + dy * dy)), power);
                    px[y * size + x] = new Color32(255, 255, 255, (byte)(a * 255));
                }
                t.SetPixels32(px); t.Apply();
                return t;
            });

        /// <summary>The portal's dark centre: deep indigo, nearly opaque, soft at the rim, so the purple vortex reads on any background.</summary>
        public static Texture2D PortalVoid(int size = 128)
            => Cached("void" + size, () =>
            {
                var t = NewTex(size, size, "PortalVoid");
                var px = new Color32[size * size];
                for (int y = 0; y < size; y++)
                for (int x = 0; x < size; x++)
                {
                    float dx = (x + 0.5f) / size * 2 - 1, dy = (y + 0.5f) / size * 2 - 1;
                    float r = Mathf.Sqrt(dx * dx + dy * dy);
                    float a = Mathf.Pow(Mathf.Clamp01((1 - r) / 0.35f), 1.2f) * 0.94f;
                    px[y * size + x] = new Color32(20, 5, 51, (byte)(a * 255));
                }
                t.SetPixels32(px); t.Apply();
                return t;
            });

        /// <summary>Four-point sparkle star.</summary>
        public static Texture2D Sparkle(int size = 64)
            => Cached("sparkle" + size, () =>
            {
                var t = NewTex(size, size, "Sparkle");
                var px = new Color32[size * size];
                for (int y = 0; y < size; y++)
                for (int x = 0; x < size; x++)
                {
                    float dx = Mathf.Abs((x + 0.5f) / size * 2 - 1), dy = Mathf.Abs((y + 0.5f) / size * 2 - 1);
                    float star = Mathf.Clamp01(1 - (Mathf.Sqrt(dx) + Mathf.Sqrt(dy)) * 0.9f);
                    float core = Mathf.Clamp01(1 - Mathf.Sqrt(dx * dx + dy * dy) * 3);
                    float a = Mathf.Clamp01(star * 2.2f + core);
                    px[y * size + x] = new Color32(255, 255, 255, (byte)(a * 255));
                }
                t.SetPixels32(px); t.Apply();
                return t;
            });

        /// <summary>
        /// The "cosmic set" background (treatment section 4): deep purple and indigo, spiral galaxy arms in teal, purple
        /// and gold, twinkling stars.
        /// </summary>
        public static Texture2D CosmicSpiral(int size = 512)
            => Cached("cosmic" + size, () =>
            {
                var t = NewTex(size, size, "CosmicSpiral");
                var px = new Color[size * size];
                var deep = new Color(0.09f, 0.04f, 0.24f);
                var indigo = new Color(0.20f, 0.08f, 0.45f);
                var arms = new[] { new Color(0.15f, 0.85f, 0.80f), new Color(0.62f, 0.30f, 1f), new Color(1f, 0.80f, 0.25f) };
                var rng = new System.Random(7);
                for (int y = 0; y < size; y++)
                for (int x = 0; x < size; x++)
                {
                    float dx = (x + 0.5f) / size * 2 - 1, dy = (y + 0.5f) / size * 2 - 1;
                    float r = Mathf.Sqrt(dx * dx + dy * dy);
                    float ang = Mathf.Atan2(dy, dx);
                    var c = Color.Lerp(indigo, deep, Mathf.Clamp01(r * 1.1f));
                    for (int k = 0; k < 3; k++)
                    {
                        // Logarithmic spiral arm: angle grows with log(r).
                        float phase = ang - Mathf.Log(r + 0.02f) * 2.2f + k * (Mathf.PI * 2 / 3);
                        float band = Mathf.Pow(0.5f + 0.5f * Mathf.Cos(phase), 6f);
                        float fade = Mathf.Clamp01(1.15f - r) * Mathf.Clamp01(r * 6f);
                        c += arms[k] * band * fade * 0.55f;
                    }
                    c += new Color(0.5f, 0.3f, 1f) * Mathf.Pow(Mathf.Clamp01(1 - r * 3), 2) * 0.8f;
                    c.a = 1;
                    px[y * size + x] = c;
                }
                for (int i = 0; i < size * size / 260; i++)
                {
                    int sx = rng.Next(size), sy = rng.Next(size);
                    float b = 0.5f + (float)rng.NextDouble() * 0.5f;
                    px[sy * size + sx] = Color.Lerp(px[sy * size + sx], Color.white, b);
                }
                t.SetPixels(px); t.Apply();
                t.wrapMode = TextureWrapMode.Clamp;
                return t;
            });

        /// <summary>Grass with tiny wildflowers for the "sunny meadow" ground. Tiles.</summary>
        public static Texture2D Meadow(bool night)
            => Cached("meadow" + night, () =>
            {
                int size = 256;
                var t = NewTex(size, size, "Meadow", true);
                t.wrapMode = TextureWrapMode.Repeat;
                var px = new Color[size * size];
                var rng = new System.Random(3);
                var a = night ? new Color(0.13f, 0.20f, 0.33f) : new Color(0.42f, 0.74f, 0.27f);
                var b = night ? new Color(0.16f, 0.25f, 0.40f) : new Color(0.50f, 0.80f, 0.32f);
                for (int i = 0; i < px.Length; i++) px[i] = Color.Lerp(a, b, (float)rng.NextDouble());
                var flowers = night
                    ? new[] { new Color(0.6f, 0.4f, 1f), new Color(0.4f, 0.9f, 0.9f) }
                    : new[] { Color.white, new Color(1f, 0.85f, 0.2f), new Color(1f, 0.45f, 0.65f) };
                for (int i = 0; i < 70; i++)
                {
                    int cx = rng.Next(size), cy = rng.Next(size);
                    var fc = flowers[rng.Next(flowers.Length)];
                    for (int oy = -1; oy <= 1; oy++)
                    for (int ox = -1; ox <= 1; ox++)
                        if (Mathf.Abs(ox) + Mathf.Abs(oy) <= 1)
                            px[((cy + oy + size) % size) * size + (cx + ox + size) % size] = fc;
                }
                t.SetPixels(px); t.Apply(true);
                return t;
            });

        /// <summary>Rainbow stripes (the footbridge), repeating along U.</summary>
        public static Texture2D RainbowStripes()
            => Cached("rainbow", () =>
            {
                var cols = new[] { "#ff5d5d", "#ff9f3a", "#ffd23f", "#5fd068", "#36b6ff", "#7a5cff" };
                var t = NewTex(cols.Length, 1, "Rainbow");
                t.filterMode = FilterMode.Point;
                t.wrapMode = TextureWrapMode.Repeat;
                for (int i = 0; i < cols.Length; i++) { ColorUtility.TryParseHtmlString(cols[i], out var c); t.SetPixel(i, 0, c); }
                t.Apply();
                return t;
            });

        public static Color RainbowAt(float h01) => Color.HSVToRGB(Mathf.Repeat(h01, 1f), 0.75f, 1f);
    }
}
