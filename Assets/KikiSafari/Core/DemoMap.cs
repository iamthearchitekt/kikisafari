using System;
using System.Collections.Generic;

namespace KikiSafari.Core
{
    public enum MapFeatureKind { Area, Water, Path, Landmark, Stop, Home }

    public enum MapGeometry { Point, Line, Polygon }

    public struct MapPoint
    {
        /// <summary>Metres east of the map origin.</summary>
        public double East;
        /// <summary>Metres north of the map origin.</summary>
        public double North;
        public MapPoint(double east, double north) { East = east; North = north; }
        public double DistanceTo(MapPoint o) => Math.Sqrt((East - o.East) * (East - o.East) + (North - o.North) * (North - o.North));
    }

    public sealed class MapFeature
    {
        public string Id;
        public string Name;
        public MapFeatureKind Kind;
        public MapGeometry Geometry;
        public Habitat? Habitat;
        /// <summary>The point, the line's vertices, or the polygon's outer ring (projected to metres).</summary>
        public List<MapPoint> Points = new List<MapPoint>();

        public MapPoint Center
        {
            get
            {
                if (Points.Count == 0) return default;
                double e = 0, n = 0;
                foreach (var p in Points) { e += p.East; n += p.North; }
                return new MapPoint(e / Points.Count, n / Points.Count);
            }
        }
    }

    /// <summary>
    /// The bundled demo campground, read from GeoJSON (decisions doc, section 5). Coordinates are projected to local metres
    /// around the collection's "origin" ([lon, lat]) with an equirectangular projection, which is accurate at this size.
    /// The same reader will load event zones later.
    /// </summary>
    public sealed class DemoMap
    {
        public double OriginLat, OriginLon;
        public readonly List<MapFeature> Features = new List<MapFeature>();
        /// <summary>Habitat used where no area or water says otherwise.</summary>
        public Habitat DefaultHabitat = Habitat.Meadow;
        /// <summary>Points this close to a water line count as water habitat.</summary>
        public double WaterReachMeters = 25;

        const double MetersPerDegLat = 111320.0;

        public MapPoint Project(double lon, double lat)
        {
            double east = (lon - OriginLon) * MetersPerDegLat * Math.Cos(OriginLat * Math.PI / 180);
            double north = (lat - OriginLat) * MetersPerDegLat;
            return new MapPoint(east, north);
        }

        public MapFeature Find(string id)
        {
            foreach (var f in Features) if (f.Id == id) return f;
            return null;
        }

        public IEnumerable<MapFeature> OfKind(MapFeatureKind k)
        {
            foreach (var f in Features) if (f.Kind == k) yield return f;
        }

        public Habitat HabitatAt(MapPoint p)
        {
            foreach (var f in Features)
                if (f.Kind == MapFeatureKind.Water && f.Geometry != MapGeometry.Point && DistanceToPolyline(p, f.Points, f.Geometry == MapGeometry.Polygon) <= WaterReachMeters)
                    return Habitat.Water;
            Habitat? found = null;
            foreach (var f in Features)
                if (f.Kind == MapFeatureKind.Area && f.Geometry == MapGeometry.Polygon && f.Habitat.HasValue && Contains(f.Points, p))
                    found = f.Habitat; // later features draw on top, so the last match wins
            return found ?? DefaultHabitat;
        }

        public static bool Contains(List<MapPoint> ring, MapPoint p)
        {
            bool inside = false;
            for (int i = 0, j = ring.Count - 1; i < ring.Count; j = i++)
            {
                var a = ring[i]; var b = ring[j];
                if ((a.North > p.North) != (b.North > p.North) &&
                    p.East < (b.East - a.East) * (p.North - a.North) / (b.North - a.North) + a.East)
                    inside = !inside;
            }
            return inside;
        }

        public static double DistanceToPolyline(MapPoint p, List<MapPoint> pts, bool closed)
        {
            double best = double.MaxValue;
            int n = pts.Count;
            if (n == 1) return p.DistanceTo(pts[0]);
            int segs = closed ? n : n - 1;
            for (int i = 0; i < segs; i++)
            {
                var a = pts[i]; var b = pts[(i + 1) % n];
                double dx = b.East - a.East, dy = b.North - a.North;
                double len2 = dx * dx + dy * dy;
                double t = len2 <= 0 ? 0 : ((p.East - a.East) * dx + (p.North - a.North) * dy) / len2;
                t = Math.Max(0, Math.Min(1, t));
                var q = new MapPoint(a.East + dx * t, a.North + dy * t);
                best = Math.Min(best, p.DistanceTo(q));
            }
            return best;
        }

        public static DemoMap FromGeoJson(string json)
        {
            var root = MiniJson.Parse(json) as Dictionary<string, object> ?? throw new FormatException("GeoJSON root must be an object");
            var map = new DemoMap();
            if (root.TryGetValue("origin", out var o) && o is List<object> ol && ol.Count >= 2)
            {
                map.OriginLon = Convert.ToDouble(ol[0]);
                map.OriginLat = Convert.ToDouble(ol[1]);
            }
            if (!(root.TryGetValue("features", out var fo) && fo is List<object> features)) return map;

            foreach (var item in features)
            {
                if (!(item is Dictionary<string, object> feat)) continue;
                var props = feat.TryGetValue("properties", out var po) ? po as Dictionary<string, object> : null;
                var geom = feat.TryGetValue("geometry", out var go) ? go as Dictionary<string, object> : null;
                if (props == null || geom == null) continue;

                var f = new MapFeature
                {
                    Id = Str(props, "id"),
                    Name = Str(props, "name"),
                    Kind = ParseKind(Str(props, "kind")),
                };
                var hab = Str(props, "habitat");
                if (!string.IsNullOrEmpty(hab) && Enum.TryParse(hab, true, out Habitat h)) f.Habitat = h;

                string type = Str(geom, "type");
                var coords = geom.TryGetValue("coordinates", out var co) ? co as List<object> : null;
                if (coords == null) continue;
                switch (type)
                {
                    case "Point":
                        f.Geometry = MapGeometry.Point;
                        f.Points.Add(ProjectPair(map, coords));
                        break;
                    case "LineString":
                        f.Geometry = MapGeometry.Line;
                        foreach (var c in coords) f.Points.Add(ProjectPair(map, (List<object>)c));
                        break;
                    case "Polygon":
                        f.Geometry = MapGeometry.Polygon;
                        var ring = (List<object>)coords[0];
                        foreach (var c in ring) f.Points.Add(ProjectPair(map, (List<object>)c));
                        // GeoJSON rings repeat the first point at the end; drop it.
                        if (f.Points.Count > 1 && f.Points[0].DistanceTo(f.Points[f.Points.Count - 1]) < 1e-6)
                            f.Points.RemoveAt(f.Points.Count - 1);
                        break;
                    default:
                        continue;
                }
                map.Features.Add(f);
            }
            return map;
        }

        static MapPoint ProjectPair(DemoMap map, List<object> pair)
            => map.Project(Convert.ToDouble(pair[0]), Convert.ToDouble(pair[1]));

        static string Str(Dictionary<string, object> d, string key)
            => d.TryGetValue(key, out var v) && v != null ? Convert.ToString(v, System.Globalization.CultureInfo.InvariantCulture) : null;

        static MapFeatureKind ParseKind(string s)
            => Enum.TryParse(s ?? "", true, out MapFeatureKind k) ? k : MapFeatureKind.Landmark;
    }
}
