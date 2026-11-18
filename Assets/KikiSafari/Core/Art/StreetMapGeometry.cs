using System;
using System.Collections.Generic;

namespace KikiSafari.Core.Art
{
    /// <summary>The street map's meshes, by layer, in Unity space: x = metres east, z = metres north, y = up.</summary>
    public sealed class MapMeshes
    {
        /// <summary>Flat layers (unlit, vertex-coloured), drawn in this order: green, water, road casings, roads, paths.</summary>
        public MeshData Green = new MeshData(), Water = new MeshData(), Casing = new MeshData(), Roads = new MeshData(), Paths = new MeshData();
        /// <summary>Lit, vertex-coloured, extruded buildings.</summary>
        public MeshData Buildings = new MeshData();
    }

    /// <summary>
    /// Builds the street map from OpenStreetMap data in the game's sticker style: soft green parks, darker woods,
    /// turquoise water, white streets with a navy-grey edge (main roads sun-yellow), tan footpaths, and lavender-cream
    /// buildings raised just enough to read in 3D. Day and night palettes.
    /// </summary>
    public static class StreetMapGeometry
    {
        public struct Palette
        {
            public Rgba Park, Woods, Grass, Water, Casing, Road, MainRoad, Path, Rail, Roof, Wall;
        }

        public static readonly Palette Day = new Palette
        {
            Park = Rgba.Hex(0x8FD45E), Woods = Rgba.Hex(0x4FA046), Grass = Rgba.Hex(0xA6DC74), Water = Rgba.Hex(0x45D6E6),
            Casing = Rgba.Hex(0xB9BEDD), Road = Rgba.Hex(0xFFFFFF), MainRoad = Rgba.Hex(0xFFE58A), Path = Rgba.Hex(0xF3DFA8),
            Rail = Rgba.Hex(0x6B6F8C), Roof = Rgba.Hex(0xF4ECFF), Wall = Rgba.Hex(0xCFC4EA),
        };

        public static readonly Palette Night = new Palette
        {
            Park = Rgba.Hex(0x2E5A63), Woods = Rgba.Hex(0x22434F), Grass = Rgba.Hex(0x34636B), Water = Rgba.Hex(0x2E4C8C),
            Casing = Rgba.Hex(0x1C2350), Road = Rgba.Hex(0x5A5F9A), MainRoad = Rgba.Hex(0x8B6FD8), Path = Rgba.Hex(0x4A4F7A),
            Rail = Rgba.Hex(0x14183A), Roof = Rgba.Hex(0x6B5FA8), Wall = Rgba.Hex(0x463D7A),
        };

        static bool Major(string hw) => hw == "motorway" || hw == "trunk" || hw == "primary" || hw == "secondary";

        public static MapMeshes Build(OsmArea area, LatLon origin, bool night)
        {
            var pal = night ? Night : Day;
            var m = new MapMeshes();
            var (oe, on) = Geo.ToLocal(origin, area.Origin);
            V3 L(MapPoint p, float y) => new V3((float)(p.East + oe), y, (float)(p.North + on));

            foreach (var f in area.Features)
            {
                switch (f.Kind)
                {
                    case OsmKind.Park: if (f.IsPolygon) Flat(m.Green, f.Local, L, 0.02f, pal.Park); break;
                    case OsmKind.Grass: if (f.IsPolygon) Flat(m.Green, f.Local, L, 0.015f, pal.Grass); break;
                    case OsmKind.Woods: if (f.IsPolygon) Flat(m.Green, f.Local, L, 0.025f, pal.Woods); break;
                    case OsmKind.Water: if (f.IsPolygon) Flat(m.Water, f.Local, L, 0.03f, pal.Water); break;
                    case OsmKind.WaterLine: Ribbon(m.Water, f.Local, L, f.Category == "river" ? 14f : 5f, 0.032f, pal.Water); break;
                    case OsmKind.Road:
                    {
                        float w = OsmArea.RoadHalfWidth(f.Category) * 2f;
                        Ribbon(m.Casing, f.Local, L, w + 2.2f, 0.04f, pal.Casing);
                        Ribbon(m.Roads, f.Local, L, w, 0.05f, Major(f.Category) ? pal.MainRoad : pal.Road);
                        break;
                    }
                    case OsmKind.Path: Ribbon(m.Paths, f.Local, L, f.Category == "pedestrian" ? 6f : 2.4f, 0.055f, pal.Path); break;
                    case OsmKind.Rail: Ribbon(m.Paths, f.Local, L, 2.2f, 0.058f, pal.Rail); break;
                    case OsmKind.Building: if (f.IsPolygon) Building(m.Buildings, f, L, pal); break;
                }
            }
            return m;
        }

        // ---------- primitives ----------

        static readonly V3 Up = new V3(0, 1, 0);

        /// <summary>Adds a triangle wound so its face points along <paramref name="facing"/> (Unity: clockwise from the front).</summary>
        static void Tri(MeshData m, int a, int b, int c, V3 facing)
        {
            var n = V3.Cross(m.Pos[b] - m.Pos[a], m.Pos[c] - m.Pos[a]);
            if (n.X * facing.X + n.Y * facing.Y + n.Z * facing.Z < 0) { m.Tri.Add(a); m.Tri.Add(c); m.Tri.Add(b); }
            else { m.Tri.Add(a); m.Tri.Add(b); m.Tri.Add(c); }
        }

        static int V(MeshData m, V3 p, V3 n, Rgba c)
        {
            m.Pos.Add(p); m.Nrm.Add(n); m.U.Add(p.X / 8f); m.V.Add(p.Z / 8f); m.Col.Add(c);
            return m.Pos.Count - 1;
        }

        /// <summary>A flat polygon (holes ignored), ear-clipped.</summary>
        static void Flat(MeshData m, List<MapPoint> ring, Func<MapPoint, float, V3> L, float y, Rgba c)
        {
            var pts = Ring(ring);
            if (pts.Count < 3) return;
            int b = m.Pos.Count;
            foreach (var p in pts) V(m, L(p, y), Up, c);
            foreach (var (i, j, k) in EarClip(pts)) Tri(m, b + i, b + j, b + k, Up);
        }

        /// <summary>A polyline as a flat strip with mitred joins (miters capped at 2× the half-width) and square ends.</summary>
        static void Ribbon(MeshData m, List<MapPoint> line, Func<MapPoint, float, V3> L, float width, float y, Rgba c)
        {
            int n = line.Count;
            if (n < 2) return;
            float hw = width / 2;
            int b = m.Pos.Count;
            for (int i = 0; i < n; i++)
            {
                var p = line[i];
                (double x, double z) d0 = i > 0 ? Dir(line[i - 1], p) : Dir(p, line[i + 1]);
                (double x, double z) d1 = i < n - 1 ? Dir(p, line[i + 1]) : d0;
                double nx = -(d0.z + d1.z), nz = d0.x + d1.x; // left normal, averaged
                double len = Math.Sqrt(nx * nx + nz * nz);
                if (len < 1e-6) { nx = -d0.z; nz = d0.x; len = 1; }
                nx /= len; nz /= len;
                double dot = nx * -d0.z + nz * d0.x;
                double scale = hw / Math.Max(0.5, dot);
                // Square ends: extend the first and last points a little so strips overlap cleanly at junctions.
                double ext = (i == 0 ? -1 : i == n - 1 ? 1 : 0) * hw * 0.5;
                var dd = i == 0 ? d0 : d1;
                var pe = new MapPoint(p.East + dd.x * ext, p.North + dd.z * ext);
                V(m, L(new MapPoint(pe.East + nx * scale, pe.North + nz * scale), y), Up, c);
                V(m, L(new MapPoint(pe.East - nx * scale, pe.North - nz * scale), y), Up, c);
            }
            for (int i = 0; i < n - 1; i++)
            {
                int a = b + i * 2;
                Tri(m, a, a + 1, a + 2, Up);
                Tri(m, a + 1, a + 3, a + 2, Up);
            }
        }

        static (double x, double z) Dir(MapPoint a, MapPoint b)
        {
            double dx = b.East - a.East, dz = b.North - a.North, l = Math.Sqrt(dx * dx + dz * dz);
            return l < 1e-9 ? (1, 0) : (dx / l, dz / l);
        }

        /// <summary>An extruded building: walls (flat-shaded) and a roof. Heights are trimmed so tall towers don't hide the street.</summary>
        static void Building(MeshData m, OsmFeature f, Func<MapPoint, float, V3> L, Palette pal)
        {
            var pts = Ring(f.Local);
            if (pts.Count < 3) return;
            float h = Math.Min(24f, f.Height * 0.8f);
            // Counter-clockwise (east/north), so the outward normal of edge a→b is (dz, -dx).
            if (SignedArea(pts) < 0) pts.Reverse();
            for (int i = 0; i < pts.Count; i++)
            {
                var a = pts[i]; var bpt = pts[(i + 1) % pts.Count];
                double dx = bpt.East - a.East, dz = bpt.North - a.North, l = Math.Sqrt(dx * dx + dz * dz);
                if (l < 1e-6) continue;
                var outward = new V3((float)(dz / l), 0, (float)(-dx / l));
                // Lighter on the sunny side, so the 3D reads.
                float shade = 0.82f + 0.18f * Math.Max(0, outward.X * -0.5f + outward.Z * -0.85f);
                var c = new Rgba(pal.Wall.R * shade, pal.Wall.G * shade, pal.Wall.B * shade);
                int v0 = V(m, L(a, 0.06f), outward, c), v1 = V(m, L(bpt, 0.06f), outward, c);
                int v2 = V(m, L(bpt, h), outward, c), v3 = V(m, L(a, h), outward, c);
                Tri(m, v0, v1, v2, outward);
                Tri(m, v0, v2, v3, outward);
            }
            int rb = m.Pos.Count;
            foreach (var p in pts) V(m, L(p, h), Up, pal.Roof);
            foreach (var (i, j, k) in EarClip(pts)) Tri(m, rb + i, rb + j, rb + k, Up);
        }

        /// <summary>The ring without its repeated closing point.</summary>
        static List<MapPoint> Ring(List<MapPoint> ring)
        {
            var pts = new List<MapPoint>(ring);
            if (pts.Count > 1 && pts[0].DistanceTo(pts[pts.Count - 1]) < 1e-6) pts.RemoveAt(pts.Count - 1);
            return pts;
        }

        static double SignedArea(List<MapPoint> p)
        {
            double a = 0;
            for (int i = 0, j = p.Count - 1; i < p.Count; j = i++) a += p[j].East * p[i].North - p[i].East * p[j].North;
            return a / 2;
        }

        /// <summary>Ear clipping for a simple polygon (east/north). Returns index triples.</summary>
        public static List<(int, int, int)> EarClip(List<MapPoint> pts)
        {
            var result = new List<(int, int, int)>();
            int n = pts.Count;
            if (n < 3) return result;
            var idx = new List<int>();
            bool ccw = SignedArea(pts) > 0;
            for (int i = 0; i < n; i++) idx.Add(ccw ? i : n - 1 - i);
            int guard = 0;
            while (idx.Count > 3 && guard++ < 20000)
            {
                bool clipped = false;
                for (int k = 0; k < idx.Count; k++)
                {
                    int ia = idx[(k + idx.Count - 1) % idx.Count], ib = idx[k], ic = idx[(k + 1) % idx.Count];
                    var a = pts[ia]; var b = pts[ib]; var c = pts[ic];
                    double cross = (b.East - a.East) * (c.North - b.North) - (b.North - a.North) * (c.East - b.East);
                    if (cross <= 0) continue;
                    bool inside = false;
                    foreach (int o in idx)
                    {
                        if (o == ia || o == ib || o == ic) continue;
                        if (InTri(pts[o], a, b, c)) { inside = true; break; }
                    }
                    if (inside) continue;
                    result.Add((ia, ib, ic));
                    idx.RemoveAt(k);
                    clipped = true;
                    break;
                }
                if (!clipped) break; // degenerate: give up on the rest rather than loop
            }
            if (idx.Count == 3) result.Add((idx[0], idx[1], idx[2]));
            return result;
        }

        static bool InTri(MapPoint p, MapPoint a, MapPoint b, MapPoint c)
        {
            double C(MapPoint u, MapPoint v, MapPoint w) => (v.East - u.East) * (w.North - u.North) - (v.North - u.North) * (w.East - u.East);
            double d1 = C(a, b, p), d2 = C(b, c, p), d3 = C(c, a, p);
            bool neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
            return !(neg && pos);
        }
    }
}
