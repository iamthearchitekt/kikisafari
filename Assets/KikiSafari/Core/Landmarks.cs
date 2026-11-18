using System;
using System.Collections.Generic;

namespace KikiSafari.Core
{
    public sealed class PlacedSpot
    {
        public string Id;
        public string Name;
        public LatLon Where;
        /// <summary>From a real landmark (true) or filled into a quiet area (false).</summary>
        public bool Landmark;
        public string Category;
    }

    /// <summary>
    /// Turns a downloaded area into supply stops and Rune Circles (decisions doc, section 4, with the owner's Rune
    /// Circles): real landmarks first (historic sites, parks, public art, fountains, museums, libraries…), spaced out and
    /// away from anything unsafe; quiet areas get stops and circles filled into public green space or other safe spots,
    /// so the game works everywhere.
    /// </summary>
    public static class LandmarkPlanner
    {
        public const double DataCell = 800;          // metres per downloaded area
        public const double CircleSpacing = 250;
        public const int CirclesPerCell = 3;
        public const double StopSpacing = 70;
        public const double StopFillCell = 250;      // every 250 m square gets a stop
        const ulong Seed = LiveWorldPlanner.WorldSeed;

        public static int CirclePriority(OsmFeature f)
        {
            if (f.Kind == OsmKind.Park) return f.Area > 5000 ? 5 : 2;
            switch (f.Category)
            {
                case "historic": return 5;
                case "artwork": case "fountain": return 4;
                case "museum": case "gallery": case "theatre": case "arts_centre": case "townhall": case "library":
                case "viewpoint": case "attraction": return 3;
                default: return 1;
            }
        }

        static string NiceName(OsmFeature f)
        {
            if (!string.IsNullOrEmpty(f.Name)) return f.Name;
            switch (f.Category)
            {
                case "artwork": return "Public Art";
                case "fountain": return "Fountain";
                case "historic": return "Historic Site";
                case "library": return "Library";
                case "viewpoint": return "Viewpoint";
                case "park": case "garden": case "common": return "Park";
                default: return char.ToUpperInvariant(f.Category[0]) + f.Category.Substring(1).Replace('_', ' ');
            }
        }

        static ulong Hash(string s)
        {
            unchecked
            {
                ulong h = 1469598103934665603UL;
                foreach (char c in s) { h ^= c; h *= 1099511628211UL; }
                return h;
            }
        }

        public static (List<PlacedSpot> stops, List<PlacedSpot> circles) Place(OsmArea area, WorldGrid.Cell cell)
        {
            var stops = new List<PlacedSpot>();
            var circles = new List<PlacedSpot>();
            bool InCell(LatLon p) => p.Lat >= cell.SouthWest.Lat && p.Lat < cell.SouthWest.Lat + cell.DegLat && p.Lon >= cell.SouthWest.Lon && p.Lon < cell.SouthWest.Lon + cell.DegLon;

            // Candidates: real landmarks and park centres inside this cell, not in unsafe spots.
            var cands = new List<(OsmFeature f, PlacedSpot spot, int prio, ulong h)>();
            foreach (var f in area.Features)
            {
                if (f.Kind != OsmKind.Landmark && f.Kind != OsmKind.Park) continue;
                LatLon at;
                if (f.Kind == OsmKind.Park)
                {
                    if (!f.IsPolygon || f.Area < 800) continue;
                    var c = f.Centroid;
                    if (!DemoMap.Contains(f.Local, c)) continue; // odd-shaped park: skip rather than put it outside
                    at = Geo.FromLocal(area.Origin, c.East, c.North);
                }
                else at = f.Points[0];
                if (!InCell(at) || area.Unsafe(at, allowBuildings: true) != null) continue;
                var spot = new PlacedSpot { Id = "osm:" + f.Id, Name = NiceName(f), Where = at, Landmark = true, Category = f.Category };
                cands.Add((f, spot, CirclePriority(f), Hash(f.Id)));
            }

            // Rune Circles: the most notable landmarks, well spread.
            cands.Sort((a, b) => a.prio != b.prio ? b.prio.CompareTo(a.prio) : a.h.CompareTo(b.h));
            var used = new HashSet<string>();
            foreach (var c in cands)
            {
                if (circles.Count >= CirclesPerCell) break;
                if (c.prio < 3) break;
                if (TooClose(c.spot.Where, circles, CircleSpacing)) continue;
                circles.Add(new PlacedSpot { Id = "circle:" + c.spot.Id, Name = c.spot.Name + " Rune Circle", Where = c.spot.Where, Landmark = true, Category = c.spot.Category });
                used.Add(c.spot.Id);
            }

            // Supply stops: the other landmarks, spaced out.
            cands.Sort((a, b) => a.h.CompareTo(b.h));
            foreach (var c in cands)
            {
                if (used.Contains(c.spot.Id)) continue;
                if (TooClose(c.spot.Where, stops, StopSpacing) || TooClose(c.spot.Where, circles, StopSpacing)) continue;
                stops.Add(c.spot);
            }

            // Everywhere: quiet squares still get a stop, and a cell with no circle gets one, in green space if any.
            var green = new List<OsmFeature>();
            foreach (var f in area.Features)
                if ((f.Kind == OsmKind.Park || f.Kind == OsmKind.Grass || f.Kind == OsmKind.Woods) && f.IsPolygon && f.Area > 400) green.Add(f);

            int sub = (int)Math.Round(DataCell / StopFillCell);
            for (int i = 0; i < sub; i++)
            for (int j = 0; j < sub; j++)
            {
                double e0 = i * StopFillCell, n0 = j * StopFillCell;
                var squareCenter = cell.At(e0 + StopFillCell / 2, n0 + StopFillCell / 2);
                bool has = false;
                foreach (var s in stops) if (Geo.Distance(s.Where, squareCenter) < StopFillCell * 0.6) { has = true; break; }
                if (has) continue;
                var spot = FindSafe(area, cell, e0, n0, StopFillCell, green, Hash($"s{cell.X}:{cell.Y}:{i}:{j}"));
                if (spot.HasValue && !TooClose(spot.Value, stops, StopSpacing) && !TooClose(spot.Value, circles, StopSpacing))
                    stops.Add(new PlacedSpot { Id = $"fill:s:{cell.X}:{cell.Y}:{i}:{j}", Name = "Supply Stop", Where = spot.Value });
            }
            if (circles.Count == 0)
            {
                var spot = FindSafe(area, cell, DataCell * 0.2, DataCell * 0.2, DataCell * 0.6, green, Hash($"c{cell.X}:{cell.Y}"));
                if (spot.HasValue)
                {
                    stops.RemoveAll(s => Geo.Distance(s.Where, spot.Value) < StopSpacing);
                    circles.Add(new PlacedSpot { Id = $"fill:c:{cell.X}:{cell.Y}", Name = "Rune Circle", Where = spot.Value });
                }
            }
            return (stops, circles);
        }

        static bool TooClose(LatLon p, List<PlacedSpot> spots, double meters)
        {
            foreach (var s in spots) if (Geo.Distance(s.Where, p) < meters) return true;
            return false;
        }

        /// <summary>A safe spot in a square of the cell: inside green space when there is some, otherwise anywhere safe.</summary>
        static LatLon? FindSafe(OsmArea area, WorldGrid.Cell cell, double e0, double n0, double size, List<OsmFeature> green, ulong seed)
        {
            var rng = new SeededRandom(seed ^ Seed);
            for (int pass = 0; pass < 2; pass++)
                for (int tries = 0; tries < 24; tries++)
                {
                    var p = cell.At(e0 + rng.NextDouble() * size, n0 + rng.NextDouble() * size);
                    if (pass == 0)
                    {
                        bool inGreen = false;
                        var lp = area.Local(p);
                        foreach (var g in green) if (g.BoxContains(lp, 0) && DemoMap.Contains(g.Local, lp)) { inGreen = true; break; }
                        if (!inGreen) continue;
                    }
                    if (area.Unsafe(p) == null) return p;
                }
            return null;
        }
    }

    /// <summary>
    /// The real-world data the game has loaded around the player: stops, circles, spawn safety and land-cover habitats.
    /// Areas are downloaded per 800 m cell and cached on the phone.
    /// </summary>
    public sealed class WorldData
    {
        sealed class Entry { public WorldGrid.Cell Cell; public OsmArea Area; public List<PlacedSpot> Stops, Circles; }
        readonly Dictionary<(long, long), Entry> _cells = new Dictionary<(long, long), Entry>();

        public int Count => _cells.Count;

        public void Add(WorldGrid.Cell cell, OsmArea area)
        {
            var (stops, circles) = LandmarkPlanner.Place(area, cell);
            Add(cell, area, stops, circles);
        }

        /// <summary>Adds an area whose placement was already worked out (e.g. on a background thread).</summary>
        public void Add(WorldGrid.Cell cell, OsmArea area, List<PlacedSpot> stops, List<PlacedSpot> circles)
            => _cells[(cell.X, cell.Y)] = new Entry { Cell = cell, Area = area, Stops = stops, Circles = circles };

        public bool Has(WorldGrid.Cell cell) => _cells.ContainsKey((cell.X, cell.Y));

        public void Forget(WorldGrid.Cell cell) => _cells.Remove((cell.X, cell.Y));

        public bool Covers(LatLon p) => _cells.ContainsKey(Key(p));

        static (long, long) Key(LatLon p) { var c = WorldGrid.CellOf(p, LandmarkPlanner.DataCell); return (c.X, c.Y); }

        OsmArea AreaAt(LatLon p) => _cells.TryGetValue(Key(p), out var e) ? e.Area : null;

        public bool IsSafe(LatLon p) { var a = AreaAt(p); return a == null || a.Unsafe(p) == null; }

        public Habitat? HabitatAt(LatLon p) => AreaAt(p)?.HabitatAt(p);

        public IEnumerable<PlacedSpot> Stops { get { foreach (var e in _cells.Values) foreach (var s in e.Stops) yield return s; } }
        public IEnumerable<PlacedSpot> Circles { get { foreach (var e in _cells.Values) foreach (var c in e.Circles) yield return c; } }
        public IEnumerable<OsmArea> Areas { get { foreach (var e in _cells.Values) yield return e.Area; } }
    }
}
