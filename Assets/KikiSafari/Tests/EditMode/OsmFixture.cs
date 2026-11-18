using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;
using KikiSafari.Core;

namespace KikiSafari.Tests
{
    /// <summary>
    /// A made-up neighbourhood written in Overpass "out geom" JSON, exactly as the live service returns it. It fills
    /// one 800 m data cell: a street grid, a main road, footpaths, houses, a park with a fountain, art and a pond, a
    /// stream, a wood, a library, a historic marker, and the traps (a school with art inside it, a church beside a
    /// sculpture, a memorial). Used by the tests and the map preview.
    /// </summary>
    public static class OsmFixture
    {
        public static readonly LatLon Center = new LatLon(44.36612, -100.35071);

        public static WorldGrid.Cell Cell => WorldGrid.CellOf(Center, LandmarkPlanner.DataCell);

        /// <summary>The cell's centre, where the "player" stands in the tests.</summary>
        public static LatLon Middle => Cell.Center;

        // Landmark positions (metres east/north of the cell's south-west corner), for the tests.
        public static readonly (double e, double n) ParkMin = (430, 420), ParkMax = (650, 600);
        public static readonly (double e, double n) Fountain = (540, 510), ParkArt = (480, 560);
        public static readonly (double e, double n) SchoolMin = (100, 600), SchoolMax = (260, 720), SchoolArt = (180, 660);
        public static readonly (double e, double n) Church = (700, 150), ChurchArt = (720, 175);
        public static readonly (double e, double n) Library = (300, 300), Historic = (150, 150), Memorial = (420, 140);
        public static readonly (double e, double n) WoodsMin = (40, 300), WoodsMax = (200, 520);

        static StringBuilder _sb;
        static bool _first;
        static long _id;
        static WorldGrid.Cell _cell;

        static string F(double v) => v.ToString("0.0000000", CultureInfo.InvariantCulture);
        static LatLon At(double e, double n) => _cell.At(e, n);

        static void Begin() { if (!_first) _sb.Append(",\n"); _first = false; }

        static string Tags(params string[] kv)
        {
            var t = new StringBuilder("\"tags\":{");
            for (int i = 0; i < kv.Length; i += 2) { if (i > 0) t.Append(','); t.Append('"').Append(kv[i]).Append("\":\"").Append(kv[i + 1]).Append('"'); }
            return t.Append('}').ToString();
        }

        static void Node(double e, double n, params string[] tags)
        {
            var p = At(e, n);
            Begin();
            _sb.Append($"{{\"type\":\"node\",\"id\":{++_id},\"lat\":{F(p.Lat)},\"lon\":{F(p.Lon)},{Tags(tags)}}}");
        }

        static string Geometry(IList<(double e, double n)> pts)
        {
            var g = new StringBuilder("\"geometry\":[");
            for (int i = 0; i < pts.Count; i++)
            {
                var p = At(pts[i].e, pts[i].n);
                if (i > 0) g.Append(',');
                g.Append($"{{\"lat\":{F(p.Lat)},\"lon\":{F(p.Lon)}}}");
            }
            return g.Append(']').ToString();
        }

        static void Way(IList<(double e, double n)> pts, params string[] tags)
        {
            Begin();
            var ids = new StringBuilder();
            for (int i = 0; i < pts.Count; i++) { if (i > 0) ids.Append(','); ids.Append(1000000 + _id * 10 + i); }
            _sb.Append($"{{\"type\":\"way\",\"id\":{++_id},\"nodes\":[{ids}],{Geometry(pts)},{Tags(tags)}}}");
        }

        static List<(double, double)> Rect(double e0, double n0, double e1, double n1)
            => new List<(double, double)> { (e0, n0), (e1, n0), (e1, n1), (e0, n1), (e0, n0) };

        public static string Json()
        {
            _sb = new StringBuilder("{\"version\":0.6,\"generator\":\"Overpass API (fixture)\",\"elements\":[\n");
            _first = true; _id = 5000; _cell = Cell;

            // Street grid every 160 m, a main road through the middle, a footpath across the park.
            for (double x = 20; x <= 780; x += 160) Way(new List<(double, double)> { (x, 0), (x, 800) }, "highway", "residential", "name", "Elm Street");
            for (double y = 20; y <= 780; y += 160) Way(new List<(double, double)> { (0, y), (800, y) }, "highway", "residential");
            Way(new List<(double, double)> { (0, 395), (800, 395) }, "highway", "primary", "name", "Main Road");
            Way(new List<(double, double)> { (430, 420), (540, 500), (650, 600) }, "highway", "footway");
            Way(new List<(double, double)> { (760, 0), (760, 800) }, "railway", "rail");

            // Houses along the streets.
            for (double x = 40; x < 760; x += 40)
                for (double y = 40; y < 760; y += 160)
                {
                    bool inPark = x > 420 && x < 660 && y > 410 && y < 610;
                    bool inSchool = x > 90 && x < 270 && y > 590 && y < 730;
                    bool inWoods = x > 30 && x < 210 && y > 290 && y < 530;
                    if (inPark || inSchool || inWoods) continue;
                    Way(Rect(x, y + 12, x + 22, y + 32), "building", "house", "building:levels", "2");
                }

            // The park, its pond, fountain and sculpture.
            Way(Rect(ParkMin.e, ParkMin.n, ParkMax.e, ParkMax.n), "leisure", "park", "name", "Willow Park");
            Way(Rect(590, 450, 630, 480), "natural", "water", "name", "Duck Pond");
            Node(Fountain.e, Fountain.n, "amenity", "fountain", "name", "Willow Fountain");
            Node(ParkArt.e, ParkArt.n, "tourism", "artwork", "name", "The Big Spiral");

            // A stream and a wood.
            Way(new List<(double, double)> { (0, 250), (200, 270), (400, 240), (800, 260) }, "waterway", "stream");
            Way(Rect(WoodsMin.e, WoodsMin.n, WoodsMax.e, WoodsMax.n), "natural", "wood");

            // A library and a historic marker.
            Node(Library.e, Library.n, "amenity", "library", "name", "Elm Street Library");
            Node(Historic.e, Historic.n, "historic", "milestone", "name", "Old Mile Marker");

            // Traps: art inside a school, a sculpture beside a church, a memorial.
            Way(Rect(SchoolMin.e, SchoolMin.n, SchoolMax.e, SchoolMax.n), "amenity", "school", "name", "Elm Elementary");
            Node(SchoolArt.e, SchoolArt.n, "tourism", "artwork", "name", "Playground Mural");
            Node(Church.e, Church.n, "amenity", "place_of_worship", "religion", "christian");
            Node(ChurchArt.e, ChurchArt.n, "tourism", "artwork", "name", "Angel Statue");
            Node(Memorial.e, Memorial.n, "historic", "memorial", "name", "War Memorial");

            // A big lake as a relation multipolygon, just outside the cell to the north-east.
            Begin();
            _sb.Append($"{{\"type\":\"relation\",\"id\":{++_id},\"members\":[{{\"type\":\"way\",\"ref\":1,\"role\":\"outer\",{Geometry(Rect(820, 820, 1000, 1000))}}}],{Tags("type", "multipolygon", "natural", "water", "name", "Blue Lake")}}}");

            _sb.Append("\n]}");
            return _sb.ToString();
        }

        public static OsmArea Area() => OsmArea.FromOverpassJson(Json(), Middle);

        public static LatLon P((double e, double n) at) => Cell.At(at.e, at.n);
    }
}
