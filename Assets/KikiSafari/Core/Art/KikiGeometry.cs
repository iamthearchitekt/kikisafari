using System;
using System.Collections.Generic;

namespace KikiSafari.Core.Art
{
    /// <summary>One arm: its mesh (around a pivot at the shoulder) and where the pivot sits.</summary>
    public struct ArmPart
    {
        public V3 Pivot;
        /// <summary>Rest rotation about Z in Unity degrees.</summary>
        public float RestZ;
        public bool Raised;
    }

    /// <summary>
    /// Kiki's geometry, ported from the claw game's makeMascot (eggGeometry, leafGeometry, GEO.arm, GEO.ball and the
    /// leaf-tuft layers), so KIKI SAFARI's Kiki has the same silhouette as Big Plush. Units: the egg is 2.3 tall and
    /// about 2 wide. <see cref="GroundOffset"/> lifts everything so the feet stand on y = 0. Output is in Unity space.
    /// </summary>
    public static class KikiGeometry
    {
        public const float EggH = 1.15f;
        /// <summary>Distance from the egg's centre down to the bottom of the feet.</summary>
        public const float GroundOffset = EggH + 0.12f;
        /// <summary>Feet to the top of the egg (no leaves).</summary>
        public const float BodyHeight = GroundOffset + EggH;

        static readonly Dictionary<string, MeshData> Cache = new Dictionary<string, MeshData>();

        static MeshData Cached(string key, Func<MeshData> make)
        {
            lock (Cache)
            {
                if (!Cache.TryGetValue(key, out var m)) Cache[key] = m = make();
                return m;
            }
        }

        static float Smooth(float a, float b, float x) { float t = Math.Max(0, Math.Min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

        /// <summary>The egg body in three space, centred on the origin, face (u = 0.5) toward +Z.</summary>
        static MeshData EggThree()
        {
            var pts = new List<(float, float)>();
            for (int i = 0; i <= 40; i++)
            {
                double a = i / 40.0 * Math.PI;
                float y = (float)(-Math.Cos(a) * EggH), k = y / EggH;
                // The claw game's egg, made chubbier toward the official art: a fuller, blunter lower half (pear) and a
                // rounded dome on top.
                double sa = Math.Sin(a);
                double fullness = k < 0 ? Math.Pow(sa, 0.78) : sa;
                float r = (float)(1.04 * fullness * (1 - 0.16 * k) * (k > 0 ? 1 - 0.24 * k * k : 1));
                pts.Add((Math.Max(r, 0.0001f), y));
            }
            var g = MeshData.Lathe(pts, 48);
            // rotateY(π): the face (u = 0.5) points to +Z.
            g = g.Transformed(Mat4.Compose(0, 0, 0, 0, (float)Math.PI, 0, 1, 1, 1));
            // Soft shading under the belly and under the leaves, baked into vertex colour (the claw game does it in-shader).
            for (int i = 0; i < g.VertexCount; i++)
            {
                float y = g.Pos[i].Y;
                float s = (0.72f + 0.28f * Smooth(-1.2f, -0.25f, y)) * (1 - 0.2f * Smooth(0.82f, 1.12f, y));
                g.Col[i] = new Rgba(s, s, s);
            }
            return g;
        }

        public static MeshData Body() => Cached("body", () =>
        {
            var m = EggThree().ToUnitySpace();
            m.Translate(new V3(0, GroundOffset, 0));
            return m;
        });

        /// <summary>Short chubby arm, extending up from its pivot (rotate the pivot to pose it).</summary>
        public static MeshData Arm() => Cached("arm", () =>
        {
            var pts = new List<(float, float)>();
            for (int i = 0; i <= 14; i++)
            {
                float t = i / 14f, tip = Math.Max(0, (t - 0.72f) / 0.28f);
                pts.Add((Math.Max(0.0001f, (0.3f - 0.07f * t) * (float)Math.Sqrt(1 - tip * tip)), -0.12f + 0.62f * t));
            }
            return MeshData.Lathe(pts, 16).ToUnitySpace();
        });

        /// <summary>Arm pivots: the viewer's-left arm is raised in his signature wave, the other rests down.</summary>
        public static ArmPart[] Arms()
        {
            // three: pivot (s * .88, .02, .05), rotation.z = s < 0 ? .55 : -2.25 (radians). Mirror X and negate Z rotation for Unity.
            const float R2D = 180f / (float)Math.PI;
            return new[]
            {
                new ArmPart { Pivot = new V3(0.9f, 0.0f + GroundOffset, 0.05f), RestZ = -0.62f * R2D, Raised = true },
                new ArmPart { Pivot = new V3(-0.9f, -0.05f + GroundOffset, 0.05f), RestZ = 2.15f * R2D, Raised = false },
            };
        }

        public static MeshData Feet() => Cached("feet", () =>
        {
            var ball = MeshData.Sphere(1, 14, 10);
            var m = new MeshData();
            for (int s = -1; s <= 1; s += 2)
                m.Append(ball.Transformed(Mat4.Compose(s * 0.44f, -EggH + 0.08f, 0.14f, 0, 0, 0, 0.33f, 0.22f, 0.38f)));
            m = m.ToUnitySpace();
            m.Translate(new V3(0, GroundOffset, 0));
            return m;
        });

        /// <summary>
        /// One leaf, 1 unit from stem (z = 0) to tip (z = 1): a broad pointed oval with edges folded up along the
        /// midrib and the tip curling down. <paramref name="width"/> 0.42 is canon; smaller is more needle-like.
        /// Vertex colours: darker at the stem, lighter at the tip and along the vein.
        /// </summary>
        static MeshData LeafThree(float width, float roundness, Rgba baseCol, Rgba tipCol, bool strongTip)
        {
            // Finer than the claw game's 8×12 so the fold and arch stay smooth up close in AR.
            var g = MeshData.Sphere(1, 14, 22);
            g = g.Transformed(Mat4.Compose(0, 0, 0, (float)Math.PI / 2, 0, 0, 1, 1, 1));
            for (int i = 0; i < g.VertexCount; i++)
            {
                var p = g.Pos[i];
                float u = (p.Z + 1) / 2;
                float r = Math.Max(1e-4f, (float)Math.Sqrt(p.X * p.X + p.Y * p.Y));
                float k = (float)Math.Pow(Math.Sin(Math.PI * Math.Pow(u, 0.75)), roundness) / r;
                float nx = p.X * k * width;
                // V-fold along the midrib (edges up), then an arch that droops at the tip.
                float ny = p.Y * k * 0.05f + Math.Abs(nx) * 0.6f - 0.26f * u * u;
                g.Pos[i] = new V3(nx, ny, u);
                float vein = Math.Max(0, 1 - Math.Abs(nx) / 0.03f);
                float shade = Math.Min(1, 0.7f + 0.26f * u + 0.14f * vein);
                float tipMix = strongTip ? Smooth(0.55f, 0.95f, u) : 0;
                var c = Rgba.Lerp(baseCol, tipCol, tipMix);
                g.Col[i] = new Rgba(c.R * shade, c.G * shade, c.B * shade * 0.95f);
            }
            g.ComputeNormals();
            return g;
        }

        struct Layer { public int N; public float Len, Pitch, Spin; }

        /// <summary>The leaf crown for a look, merged into one mesh (three space → Unity space), standing on the ground offset.</summary>
        public static MeshData Crown(KikiLookSpec look, int seed)
        {
            var rng = new Random(seed);
            float Rand(float a, float b) => a + (float)rng.NextDouble() * (b - a);
            var leafCol = Rgba.Hex(look.LeafColor);
            var m = new MeshData();
            Layer[] layers;
            float width = 0.46f, round = 0.8f, baseY = EggH * 0.88f;

            switch (look.Crown)
            {
                case CrownShape.Pine:
                    // Darker, needle-like: many narrow leaves.
                    width = 0.13f; round = 0.8f;
                    layers = new[]
                    {
                        new Layer { N = 9, Len = 1.0f, Pitch = 0.85f, Spin = 0 },
                        new Layer { N = 7, Len = 0.92f, Pitch = 1.12f, Spin = 0.35f },
                        new Layer { N = 4, Len = 0.72f, Pitch = 1.4f, Spin = 0.9f },
                    };
                    break;
                case CrownShape.Seedling:
                {
                    // A 3-leaf seedling on a short stem.
                    var stemPts = new List<(float, float)>();
                    for (int i = 0; i <= 6; i++) { float t = i / 6f; stemPts.Add((0.075f * (1 - 0.35f * t), baseY - 0.08f + t * 0.36f)); }
                    var stem = MeshData.Lathe(stemPts, 10);
                    for (int i = 0; i < stem.VertexCount; i++) stem.Col[i] = Rgba.Lerp(leafCol, Rgba.Hex(0x7FCF5A), stem.V[i] * 0.6f);
                    m.Append(stem);
                    width = 0.6f; round = 0.7f;
                    for (int i = 0; i < 3; i++)
                    {
                        float yaw = i / 3f * (float)Math.PI * 2 + 0.3f + Rand(-0.08f, 0.08f);
                        float s = 0.7f * Rand(0.95f, 1.05f);
                        var leaf = LeafThree(width, round, leafCol, TipFor(look, i, 3), look.LeafTip != 0 || look.RainbowTips || look.GoldTips);
                        // Perky V: leaves angle up about 50° from level.
                        m.Append(leaf.Transformed(Mat4.Compose(0, baseY + 0.27f, 0, -(0.88f + Rand(-0.06f, 0.06f)), yaw, 0, s, s, s)));
                    }
                    m = m.ToUnitySpace();
                    m.Translate(new V3(0, GroundOffset, 0));
                    return m;
                }
                default:
                    // Like the mascot art: a wide fan of broad leaves arching out, a taller middle ring, and two small
                    // leaves sprouting straight up from the centre.
                    layers = new[]
                    {
                        new Layer { N = 6, Len = 0.84f, Pitch = 0.82f, Spin = 0 },
                        new Layer { N = 4, Len = 0.78f, Pitch = 1.15f, Spin = 0.4f },
                        new Layer { N = 2, Len = 0.6f, Pitch = 1.45f, Spin = 1.1f },
                    };
                    break;
            }

            int total = 0; foreach (var L in layers) total += L.N;
            int index = 0;
            foreach (var L in layers)
                for (int i = 0; i < L.N; i++, index++)
                {
                    float yaw = i / (float)L.N * (float)Math.PI * 2 + L.Spin + Rand(-0.12f, 0.12f), s = L.Len * Rand(0.92f, 1.08f);
                    var leaf = LeafThree(width, round, leafCol, TipFor(look, index, total), look.LeafTip != 0 || look.RainbowTips || look.GoldTips);
                    m.Append(leaf.Transformed(Mat4.Compose(0, baseY, 0, -(L.Pitch + Rand(-0.08f, 0.08f)), yaw, 0, s, s, s)));
                }
            m = m.ToUnitySpace();
            m.Translate(new V3(0, GroundOffset, 0));
            return m;
        }

        static Rgba TipFor(KikiLookSpec look, int i, int n)
        {
            if (look.GoldTips) return Rgba.Hex(0xFFD23F);
            if (look.RainbowTips) return Hsv((i * 0.61803f) % 1f, 0.75f, 1f);
            if (look.LeafTip != 0) return Rgba.Hex(look.LeafTip);
            return Rgba.Hex(look.LeafColor);
        }

        public static Rgba Hsv(float h, float s, float v)
        {
            float r = Math.Abs(h * 6 - 3) - 1, g = 2 - Math.Abs(h * 6 - 2), b = 2 - Math.Abs(h * 6 - 4);
            Func<float, float> c = x => Math.Max(0, Math.Min(1, x));
            return new Rgba(((c(r) - 1) * s + 1) * v, ((c(g) - 1) * s + 1) * v, ((c(b) - 1) * s + 1) * v);
        }

        /// <summary>The Rune Stone: a flattened river pebble (three SphereGeometry squashed), in Unity space.</summary>
        public static MeshData RuneStone(float radius) => Cached("stone" + radius, () =>
            MeshData.Sphere(radius, 32, 20).Transformed(Mat4.Compose(0, 0, 0, 0, 0, 0, 1f, 0.42f, 0.86f)).ToUnitySpace());
    }
}

namespace KikiSafari.Core.Art
{
    public static class ArtSeed
    {
        /// <summary>Stable FNV-1a hash (string.GetHashCode differs between runs and runtimes).</summary>
        public static int Of(string s)
        {
            unchecked
            {
                uint h = 2166136261;
                foreach (char ch in s ?? "") { h ^= ch; h *= 16777619; }
                return (int)(h & 0x7fffffff);
            }
        }
    }
}
