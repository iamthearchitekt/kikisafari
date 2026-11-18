using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace KikiSafari.Core
{
    public enum OsmKind { Landmark, Road, Path, Rail, Building, Water, WaterLine, Park, Woods, Grass, Exclusion }

    public sealed class OsmFeature
    {
        public string Id;            // "n123", "w456", "r789"
        public OsmKind Kind;
        public string Name;
        /// <summary>The tag value that classified it: "artwork", "fountain", "park", "residential", "school"…</summary>
        public string Category;
        public List<LatLon> Points = new List<LatLon>();
        /// <summary>Same points in metres east/north of the area's origin.</summary>
        public List<MapPoint> Local = new List<MapPoint>();
        public bool Closed;
        public float Height;        // buildings, metres
        public double MinE, MinN, MaxE, MaxN;

        public bool IsPolygon => Closed && Local.Count >= 3;
        public MapPoint Centroid
        {
            get
            {
                double e = 0, n = 0;
                int c = Closed && Local.Count > 1 ? Local.Count - 1 : Local.Count;
                for (int i = 0; i < c; i++) { e += Local[i].East; n += Local[i].North; }
                return c == 0 ? default : new MapPoint(e / c, n / c);
            }
        }
        public double Area
        {
            get
            {
                if (!IsPolygon) return 0;
                double a = 0;
                for (int i = 0, j = Local.Count - 1; i < Local.Count; j = i++) a += Local[j].East * Local[i].North - Local[i].East * Local[j].North;
                return Math.Abs(a) / 2;
            }
        }
        public bool BoxContains(MapPoint p, double pad) => p.East >= MinE - pad && p.East <= MaxE + pad && p.North >= MinN - pad && p.North <= MaxN + pad;
    }

    /// <summary>
    /// One downloaded OpenStreetMap area (an Overpass "out geom" response), classified for the game: landmarks for
    /// supply stops and Rune Circles, streets and buildings for the map, water and green space for habitats, and the
    /// safety exclusions from the decisions doc (section 4). Map data © OpenStreetMap contributors.
    /// </summary>
    public sealed class OsmArea
    {
        public LatLon Origin;
        public readonly List<OsmFeature> Features = new List<OsmFeature>();

        public const string Attribution = "© OpenStreetMap contributors";

        /// <summary>The Overpass QL query for a bounding box (south, west, north, east).</summary>
        public static string Query(double south, double west, double north, double east)
        {
            var ci = CultureInfo.InvariantCulture;
            string bbox = string.Format(ci, "{0:0.######},{1:0.######},{2:0.######},{3:0.######}", south, west, north, east);
            return "[out:json][timeout:25][bbox:" + bbox + "];(" +
                "node[\"tourism\"~\"^(artwork|viewpoint|attraction|museum|gallery)$\"];" +
                "node[\"amenity\"~\"^(fountain|library|arts_centre|community_centre|townhall|marketplace|theatre|clock)$\"];" +
                "node[\"historic\"];" +
                "way[\"leisure\"~\"^(park|garden|nature_reserve|common|dog_park)$\"];" +
                "relation[\"leisure\"~\"^(park|nature_reserve)$\"];" +
                "way[\"landuse\"~\"^(grass|meadow|recreation_ground|village_green|forest)$\"];" +
                "way[\"natural\"~\"^(wood|water|scrub|grassland|beach)$\"];" +
                "relation[\"natural\"=\"water\"];" +
                "way[\"waterway\"~\"^(river|stream|canal)$\"];" +
                "way[\"highway\"];" +
                "way[\"railway\"~\"^(rail|light_rail|tram|subway)$\"];" +
                "way[\"building\"];" +
                "nwr[\"amenity\"~\"^(school|kindergarten|childcare|hospital|clinic|place_of_worship|prison|grave_yard)$\"];" +
                "nwr[\"landuse\"~\"^(cemetery|military|religious)$\"];" +
                "nwr[\"aeroway\"~\"^(aerodrome|runway|helipad)$\"];" +
                ");out geom qt;";
        }

        static readonly HashSet<string> ExclusionAmenity = new HashSet<string> { "school", "kindergarten", "childcare", "hospital", "clinic", "place_of_worship", "prison", "grave_yard" };
        static readonly HashSet<string> ExclusionLanduse = new HashSet<string> { "cemetery", "military", "religious" };
        static readonly HashSet<string> LandmarkTourism = new HashSet<string> { "artwork", "viewpoint", "attraction", "museum", "gallery" };
        static readonly HashSet<string> LandmarkAmenity = new HashSet<string> { "fountain", "library", "arts_centre", "community_centre", "townhall", "marketplace", "theatre", "clock" };
        static readonly HashSet<string> Paths = new HashSet<string> { "footway", "path", "pedestrian", "cycleway", "steps", "bridleway", "track", "corridor" };

        public static OsmArea FromOverpassJson(string json, LatLon origin)
        {
            var area = new OsmArea { Origin = origin };
            var root = MiniJson.Parse(json) as Dictionary<string, object>;
            if (root == null || !(root.TryGetValue("elements", out var eo) && eo is List<object> elements)) return area;
            foreach (var item in elements)
            {
                if (!(item is Dictionary<string, object> el)) continue;
                string type = S(el, "type");
                var tags = el.TryGetValue("tags", out var to) ? to as Dictionary<string, object> : null;
                if (tags == null) continue;
                string id = (type == "node" ? "n" : type == "way" ? "w" : "r") + S(el, "id");

                if (type == "node")
                {
                    var f = Classify(tags, false);
                    if (f == null) continue;
                    f.Id = id;
                    f.Points.Add(new LatLon(D(el, "lat"), D(el, "lon")));
                    area.Add(f);
                }
                else if (type == "way")
                {
                    var geom = el.TryGetValue("geometry", out var go) ? go as List<object> : null;
                    if (geom == null || geom.Count < 2) continue;
                    var pts = ReadGeometry(geom);
                    bool closed = pts.Count >= 4 && pts[0].Lat == pts[pts.Count - 1].Lat && pts[0].Lon == pts[pts.Count - 1].Lon;
                    var f = Classify(tags, closed);
                    if (f == null) continue;
                    f.Id = id; f.Points = pts; f.Closed = closed;
                    area.Add(f);
                }
                else if (type == "relation")
                {
                    // Multipolygons (big parks, lakes): each outer ring becomes its own polygon.
                    var members = el.TryGetValue("members", out var mo) ? mo as List<object> : null;
                    if (members == null) continue;
                    int k = 0;
                    foreach (var m in members)
                    {
                        if (!(m is Dictionary<string, object> mem) || S(mem, "role") != "outer") continue;
                        var geom = mem.TryGetValue("geometry", out var go) ? go as List<object> : null;
                        if (geom == null || geom.Count < 4) continue;
                        var pts = ReadGeometry(geom);
                        if (pts[0].Lat != pts[pts.Count - 1].Lat || pts[0].Lon != pts[pts.Count - 1].Lon) pts.Add(pts[0]);
                        var f = Classify(tags, true);
                        if (f == null) continue;
                        f.Id = id + ":" + k++; f.Points = pts; f.Closed = true;
                        area.Add(f);
                    }
                }
            }
            return area;
        }

        void Add(OsmFeature f)
        {
            f.MinE = f.MinN = double.MaxValue; f.MaxE = f.MaxN = double.MinValue;
            foreach (var p in f.Points)
            {
                var (e, n) = Geo.ToLocal(Origin, p);
                f.Local.Add(new MapPoint(e, n));
                f.MinE = Math.Min(f.MinE, e); f.MaxE = Math.Max(f.MaxE, e);
                f.MinN = Math.Min(f.MinN, n); f.MaxN = Math.Max(f.MaxN, n);
            }
            Features.Add(f);
        }

        static List<LatLon> ReadGeometry(List<object> geom)
        {
            var pts = new List<LatLon>(geom.Count);
            foreach (var g in geom)
                if (g is Dictionary<string, object> gd) pts.Add(new LatLon(D(gd, "lat"), D(gd, "lon")));
            return pts;
        }

        static OsmFeature Classify(Dictionary<string, object> tags, bool closed)
        {
            string T(string k) => tags.TryGetValue(k, out var v) ? Convert.ToString(v, CultureInfo.InvariantCulture) : null;
            string name = T("name");
            string amenity = T("amenity"), landuse = T("landuse"), aeroway = T("aeroway"), historic = T("historic");
            string tourism = T("tourism"), leisure = T("leisure"), natural = T("natural"), waterway = T("waterway");
            string highway = T("highway"), railway = T("railway"), building = T("building");

            // Safety first: places Kikis, stops and circles must avoid.
            if (amenity != null && ExclusionAmenity.Contains(amenity)) return new OsmFeature { Kind = OsmKind.Exclusion, Category = amenity, Name = name };
            if (landuse != null && ExclusionLanduse.Contains(landuse)) return new OsmFeature { Kind = OsmKind.Exclusion, Category = landuse, Name = name };
            if (aeroway != null) return new OsmFeature { Kind = OsmKind.Exclusion, Category = aeroway, Name = name };
            if (historic == "memorial" || T("memorial") != null) return new OsmFeature { Kind = OsmKind.Exclusion, Category = "memorial", Name = name };

            if (building != null) return new OsmFeature { Kind = OsmKind.Building, Category = building, Name = name, Height = BuildingHeight(T("height"), T("building:levels")) };
            if (highway != null) return new OsmFeature { Kind = Paths.Contains(highway) ? OsmKind.Path : OsmKind.Road, Category = highway, Name = name };
            if (railway != null) return new OsmFeature { Kind = OsmKind.Rail, Category = railway, Name = name };
            if (waterway != null) return new OsmFeature { Kind = OsmKind.WaterLine, Category = waterway, Name = name };
            if (natural == "water") return new OsmFeature { Kind = OsmKind.Water, Category = "water", Name = name };
            if (natural == "wood" || landuse == "forest") return new OsmFeature { Kind = OsmKind.Woods, Category = natural ?? landuse, Name = name };
            if (leisure != null && closed) return new OsmFeature { Kind = OsmKind.Park, Category = leisure, Name = name };
            if (landuse != null || natural != null) return new OsmFeature { Kind = OsmKind.Grass, Category = landuse ?? natural, Name = name };
            if (tourism != null && LandmarkTourism.Contains(tourism)) return new OsmFeature { Kind = OsmKind.Landmark, Category = tourism, Name = name };
            if (amenity != null && LandmarkAmenity.Contains(amenity)) return new OsmFeature { Kind = OsmKind.Landmark, Category = amenity, Name = name };
            if (historic != null) return new OsmFeature { Kind = OsmKind.Landmark, Category = "historic", Name = name };
            return null;
        }

        static float BuildingHeight(string height, string levels)
        {
            var ci = CultureInfo.InvariantCulture;
            if (height != null && float.TryParse(height.Replace("m", "").Trim(), NumberStyles.Float, ci, out var h)) return Math.Max(3, Math.Min(120, h));
            if (levels != null && float.TryParse(levels, NumberStyles.Float, ci, out var l)) return Math.Max(3, Math.Min(120, l * 3.2f));
            return 7f;
        }

        static string S(Dictionary<string, object> d, string k) => d.TryGetValue(k, out var v) && v != null ? Convert.ToString(v, CultureInfo.InvariantCulture) : null;
        static double D(Dictionary<string, object> d, string k) => d.TryGetValue(k, out var v) && v != null ? Convert.ToDouble(v, CultureInfo.InvariantCulture) : 0;

        // ---------- spot checks ----------

        public MapPoint Local(LatLon p) { var (e, n) = Geo.ToLocal(Origin, p); return new MapPoint(e, n); }

        // Spatial index: features bucketed by 50 m squares (padded by the largest check distance), built on first use,
        // so checks look at a handful of nearby features instead of thousands.
        const double Bucket = 50, Pad = 52;
        Dictionary<(int, int), List<OsmFeature>> _index;
        static readonly List<OsmFeature> None = new List<OsmFeature>();

        List<OsmFeature> Near(MapPoint p)
        {
            if (_index == null)
            {
                _index = new Dictionary<(int, int), List<OsmFeature>>();
                foreach (var f in Features)
                {
                    int x0 = (int)Math.Floor((f.MinE - Pad) / Bucket), x1 = (int)Math.Floor((f.MaxE + Pad) / Bucket);
                    int y0 = (int)Math.Floor((f.MinN - Pad) / Bucket), y1 = (int)Math.Floor((f.MaxN + Pad) / Bucket);
                    if ((long)(x1 - x0 + 1) * (y1 - y0 + 1) > 4000) { x0 = Math.Max(x0, -40); x1 = Math.Min(x1, 40); y0 = Math.Max(y0, -40); y1 = Math.Min(y1, 40); }
                    for (int x = x0; x <= x1; x++)
                        for (int y = y0; y <= y1; y++)
                        {
                            if (!_index.TryGetValue((x, y), out var l)) _index[(x, y)] = l = new List<OsmFeature>();
                            l.Add(f);
                        }
                }
            }
            return _index.TryGetValue(((int)Math.Floor(p.East / Bucket), (int)Math.Floor(p.North / Bucket)), out var list) ? list : None;
        }

        /// <summary>
        /// Why a spot is no good for a Kiki, a stop or a circle (null = fine): inside a building or water, on or right
        /// next to a road or railway, or in or near a school, hospital, place of worship, cemetery, memorial, military
        /// site, prison or airport.
        /// </summary>
        public string Unsafe(LatLon spot, bool allowBuildings = false)
        {
            var p = Local(spot);
            var near = Near(p);
            // Safety exclusions first, so the reason given is the one that matters most.
            foreach (var f in near)
            {
                if (f.Kind != OsmKind.Exclusion) continue;
                if (f.IsPolygon) { if (f.BoxContains(p, 15) && (DemoMap.Contains(f.Local, p) || DemoMap.DistanceToPolyline(p, f.Local, true) < 15)) return f.Category; }
                else if (f.Local.Count == 1) { if (f.Local[0].DistanceTo(p) < 50) return f.Category; }
                else if (f.BoxContains(p, 15) && DemoMap.DistanceToPolyline(p, f.Local, false) < 15) return f.Category;
            }
            foreach (var f in near)
            {
                switch (f.Kind)
                {
                    case OsmKind.Building:
                        if (!allowBuildings && f.IsPolygon && f.BoxContains(p, 1) && DemoMap.Contains(f.Local, p)) return "building";
                        break;
                    case OsmKind.Water:
                        if (f.IsPolygon && f.BoxContains(p, 1) && DemoMap.Contains(f.Local, p)) return "water";
                        break;
                    case OsmKind.WaterLine:
                        if (f.BoxContains(p, 10) && DemoMap.DistanceToPolyline(p, f.Local, false) < 8) return "water";
                        break;
                    case OsmKind.Road:
                        if (f.BoxContains(p, 12) && DemoMap.DistanceToPolyline(p, f.Local, false) < RoadHalfWidth(f.Category) + 3) return "road";
                        break;
                    case OsmKind.Rail:
                        if (f.BoxContains(p, 8) && DemoMap.DistanceToPolyline(p, f.Local, false) < 6) return "railway";
                        break;
                }
            }
            return null;
        }

        public static float RoadHalfWidth(string highway)
        {
            switch (highway)
            {
                case "motorway": case "trunk": return 9f;
                case "primary": return 6.5f;
                case "secondary": return 5.5f;
                case "tertiary": return 5f;
                case "residential": case "unclassified": case "living_street": return 4f;
                case "service": return 3f;
                default: return 3f;
            }
        }

        /// <summary>Land-cover habitat for a spot (decisions doc, section 4): water nearby, woods, parks and fields, or town.</summary>
        public Habitat HabitatAt(LatLon spot)
        {
            var p = Local(spot);
            var near = Near(p);
            foreach (var f in near)
            {
                if (f.Kind == OsmKind.Water && f.IsPolygon && f.BoxContains(p, 40) && (DemoMap.Contains(f.Local, p) || DemoMap.DistanceToPolyline(p, f.Local, true) < 40)) return Habitat.Water;
                if (f.Kind == OsmKind.WaterLine && f.BoxContains(p, 40) && DemoMap.DistanceToPolyline(p, f.Local, false) < 40) return Habitat.Water;
            }
            foreach (var f in near)
                if (f.Kind == OsmKind.Woods && f.IsPolygon && f.BoxContains(p, 0) && DemoMap.Contains(f.Local, p)) return Habitat.Woods;
            foreach (var f in near)
                if ((f.Kind == OsmKind.Park || f.Kind == OsmKind.Grass) && f.IsPolygon && f.BoxContains(p, 0) && DemoMap.Contains(f.Local, p)) return Habitat.Meadow;
            return Habitat.Town;
        }
    }
}
