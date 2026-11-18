using System;
using System.Collections.Generic;

namespace KikiSafari.Core.Art
{
    public enum CrownShape { Canon, Pine, Seedling }

    /// <summary>What a Kiki variant looks like, engine-free. The body yellow and canon silhouette never change.</summary>
    [Serializable]
    public sealed class KikiLookSpec
    {
        public CrownShape Crown = CrownShape.Canon;
        public uint BodyColor = Palette.BodyYellow;
        public uint LeafColor = 0x38A626;
        /// <summary>0 = canon (the leaf just lightens toward the tip).</summary>
        public uint LeafTip = 0x92E25C;
        public bool RainbowTips;
        public bool GoldTips;
        public bool BellySpiral;
        public bool StarSeams;
        public bool UvGlow;
        public float Scale = 1f;

        public KikiLookSpec Clone() => (KikiLookSpec)MemberwiseClone();

        /// <summary>The decisions doc's section 3 table: only the leaf crown, embroidery and glow differ.</summary>
        public static KikiLookSpec For(string variantId)
        {
            switch (variantId)
            {
                case VariantIds.Pine: return new KikiLookSpec { Crown = CrownShape.Pine, LeafColor = 0x1C6B2A, LeafTip = 0x2E8B47 };
                case VariantIds.Sprout: return new KikiLookSpec { Crown = CrownShape.Seedling, LeafColor = 0x3FAE2A, LeafTip = 0x9BE36A, Scale = 0.78f };
                case VariantIds.Rainbow: return new KikiLookSpec { RainbowTips = true };
                case VariantIds.Moonbeam: return new KikiLookSpec { UvGlow = true, StarSeams = true, LeafTip = 0x9FE6C8 };
                case VariantIds.GoldenSpiral: return new KikiLookSpec { GoldTips = true, BellySpiral = true };
                default: return new KikiLookSpec();
            }
        }

        public string TextureKey => $"{BodyColor:X6}{(BellySpiral ? "b" : "")}{(StarSeams ? "s" : "")}";
    }

    /// <summary>
    /// Kiki's body texture and plush normal map: a straight port of the claw game's drawFace / faceTexture /
    /// faceNormalMap (BigPlushApp www/index.html), so both games share one face. 1024×512, u = 0.5 is the front.
    /// </summary>
    public static class KikiFaceArt
    {
        public const int W = 1024, H = 512;
        const float Cx = 512, EyeY = 190, EyeDx = 66, SpiralR = 38;
        const float My = 250, Mw = 98, Mh = 56;
        static readonly Rgba Spiral = Rgba.Hex(0x4A1A0C);
        static readonly Rgba Mouth = Rgba.Hex(0x7A0F1C);
        static readonly Rgba Tongue = Rgba.Hex(0xFF4A2E);
        static readonly Rgba Gold = Rgba.Hex(0xFFE48A), GoldDeep = Rgba.Hex(0xC97800);
        static readonly Rgba StarPurple = Rgba.Hex(0xC77DFF);

        // Belly embroidery sits on the lower front, below the grin.
        const float BellyX = 512, BellyY = 366, BellyR = 52;
        static readonly float[] SeamXs = { 256, 768 };

        public static List<P2> SpiralPath(float x, float y, float r, float dir, float turns = 2.6f, int steps = 140)
        {
            var pts = new List<P2>(steps + 1);
            for (int i = 0; i <= steps; i++)
            {
                float t = i / (float)steps, a = t * turns * (float)Math.PI * 2 * dir, rr = r * (0.1f + 0.9f * t);
                pts.Add(new P2(x + (float)Math.Cos(a) * rr, y + (float)Math.Sin(a) * rr));
            }
            return pts;
        }

        /// <summary>The open smile: flat-ish top curving up at the corners, deep round bottom.</summary>
        public static List<P2> MouthPath(float scaleX = 1, float scaleY = 1, float ox = Cx, float oy = My + 22)
        {
            var p = new List<P2>();
            P2 T(float x, float y) => new P2(ox + (x - ox) * scaleX, oy + (y - oy) * scaleY);
            var start = T(Cx - Mw, My);
            p.Add(start);
            Canvas.Quadratic(p, start, T(Cx, My - 8), T(Cx + Mw, My));
            Canvas.Cubic(p, T(Cx + Mw, My), T(Cx + Mw * 0.85f, My + Mh * 1.3f), T(Cx - Mw * 0.85f, My + Mh * 1.3f), start);
            return p;
        }

        public static Canvas Albedo(KikiLookSpec look, int seed = 1)
        {
            var c = new Canvas(W, H, Rgba.Hex(look.BodyColor));
            var rng = new Random(seed);
            // Soft fabric speckle.
            for (int i = 0; i < 3000; i++)
            {
                var col = rng.NextDouble() < 0.5 ? new Rgba(1, 1, 1, 0.05f) : new Rgba(120 / 255f, 60 / 255f, 0, 0.04f);
                c.FillRect((float)rng.NextDouble() * W, (float)rng.NextDouble() * H, 2, 2, col);
            }

            if (look.StarSeams) StarStitches(c);
            if (look.BellySpiral)
            {
                var belly = SpiralPath(BellyX, BellyY, BellyR, 1, 2.4f);
                c.Stroke(belly, 10f, GoldDeep);
                c.Stroke(belly, 5.5f, Gold);
            }

            // Eyes: soft light discs, chocolate spirals turning in opposite directions.
            for (int s = -1; s <= 1; s += 2)
            {
                c.FillCircle(Cx + s * EyeDx, EyeY, 44, new Rgba(1, 1, 1, 0.18f));
                c.Stroke(SpiralPath(Cx + s * EyeDx, EyeY, SpiralR, s, 2.4f), SpiralR * 0.26f, Spiral);
            }

            // Mouth, tongue clipped inside it, and a soft outline.
            var mouth = MouthPath();
            c.FillPolygon(mouth, Mouth);
            var clip = Canvas.PolygonCoverage(mouth);
            c.FillEllipse(Cx, My + Mh * 1.0f, Mw * 0.68f, Mh * 0.58f, Tongue, clip);
            var outline = new List<P2>(mouth) { mouth[0] };
            c.Stroke(outline, 4, new Rgba(110 / 255f, 50 / 255f, 0, 0.35f));
            return c;
        }

        static void StarStitches(Canvas c)
        {
            foreach (var sx in SeamXs)
                for (float y = 26; y < H - 20; y += 34)
                    for (int side = -1; side <= 1; side += 2)
                    {
                        float x = sx + side * 16, s = 6.5f;
                        c.Stroke(new[] { new P2(x - s, y), new P2(x + s, y) }, 2.6f, StarPurple);
                        c.Stroke(new[] { new P2(x, y - s), new P2(x, y + s) }, 2.6f, StarPurple);
                        c.Stroke(new[] { new P2(x - s * 0.55f, y - s * 0.55f), new P2(x + s * 0.55f, y + s * 0.55f) }, 1.8f, StarPurple);
                        c.Stroke(new[] { new P2(x - s * 0.55f, y + s * 0.55f), new P2(x + s * 0.55f, y - s * 0.55f) }, 1.8f, StarPurple);
                    }
        }

        /// <summary>
        /// Surface detail as a normal map: fine fabric grain, side seams (a soft groove with raised stitches), domed eye
        /// discs with spirals raised like piping, and a carved-in mouth. Returns RGBA bytes (OpenGL convention, green up).
        /// </summary>
        public static byte[] NormalMap(KikiLookSpec look, bool bottomUp, int seed = 2)
        {
            var g = new Canvas(W, H, new Rgba(0.5f, 0.5f, 0.5f));
            var rng = new Random(seed);
            for (int i = 0; i < 14000; i++)
            {
                var col = rng.NextDouble() < 0.5 ? new Rgba(1, 1, 1, 0.02f) : new Rgba(0, 0, 0, 0.02f);
                g.FillCircle((float)rng.NextDouble() * W, (float)rng.NextDouble() * H, 0.6f + (float)rng.NextDouble() * 1.2f, col);
            }
            foreach (var sx in SeamXs)
            {
                for (int w = 11; w >= 1; w -= 2)
                    g.Stroke(new[] { new P2(sx, 0), new P2(sx, H) }, w, new Rgba(0, 0, 0, 0.09f), roundCaps: false);
                for (int side = -1; side <= 1; side += 2)
                    g.Stroke(new[] { new P2(sx + side * 8, 4), new P2(sx + side * 8, H - 4) }, 3, new Rgba(1, 1, 1, 0.35f), true, new[] { 8f, 7f });
            }
            for (int s = -1; s <= 1; s += 2)
            {
                float ex = Cx + s * EyeDx;
                for (int k = 0; k < 8; k++) g.FillCircle(ex, EyeY, 50 - k * 3, new Rgba(1, 1, 1, 0.045f));
                var sp = SpiralPath(ex, EyeY, SpiralR, s, 2.4f);
                g.Stroke(sp, 14, new Rgba(1, 1, 1, 0.22f));
                g.Stroke(sp, 10, new Rgba(1, 1, 1, 0.30f));
                g.Stroke(sp, 6, new Rgba(1, 1, 1, 0.35f));
            }
            if (look.BellySpiral)
            {
                var sp = SpiralPath(BellyX, BellyY, BellyR, 1, 2.4f);
                g.Stroke(sp, 12, new Rgba(1, 1, 1, 0.2f));
                g.Stroke(sp, 7, new Rgba(1, 1, 1, 0.3f));
            }
            // Carved in, deepest at the middle: many thin steps so the slope stays smooth (no visible rings).
            for (int k = 0; k < 24; k++)
                g.FillPolygon(MouthPath(1 - k * 0.026f, 1 - k * 0.03f), new Rgba(0, 0, 0, 0.05f));

            // Height (red channel) → normals.
            var h = new float[W * H];
            for (int i = 0; i < W * H; i++) h[i] = g.Px[i * 4];
            var outB = new byte[W * H * 4];
            const float K = 5.5f;
            for (int y = 0; y < H; y++)
            {
                int yu = Math.Max(0, y - 1), yd = Math.Min(H - 1, y + 1);
                int oy = bottomUp ? H - 1 - y : y;
                for (int x = 0; x < W; x++)
                {
                    float dx = (h[y * W + (x + 1) % W] - h[y * W + (x - 1 + W) % W]) * K;
                    float dy = (h[yd * W + x] - h[yu * W + x]) * K;
                    float l = (float)Math.Sqrt(dx * dx + dy * dy + 1);
                    int o = (oy * W + x) * 4;
                    outB[o] = (byte)((-dx / l * 0.5f + 0.5f) * 255);
                    outB[o + 1] = (byte)((dy / l * 0.5f + 0.5f) * 255);
                    outB[o + 2] = (byte)((1 / l * 0.5f + 0.5f) * 255);
                    outB[o + 3] = 255;
                }
            }
            return outB;
        }
    }
}
