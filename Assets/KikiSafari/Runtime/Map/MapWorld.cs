using System.Collections.Generic;
using KikiSafari.Core;
using KikiSafari.Core.Art;
using UnityEngine;

namespace KikiSafari
{
    /// <summary>
    /// Builds the Demo Safari campground in 3D from its GeoJSON (Resources/DemoMap/demo-campground.json): meadow and
    /// woods areas, the creek, paths, the Spiral Maze hedge, the rainbow Creek Footbridge, the striped Supply Tent and
    /// supply-stop markers. Metres: x = east, z = north. "Sunny meadow" by day, "cosmic set" at night.
    /// </summary>
    public sealed class MapWorld : MonoBehaviour
    {
        public DemoMap Map { get; private set; }
        public readonly Dictionary<string, StopMarker> Stops = new Dictionary<string, StopMarker>();
        public Vector3 HomePoint { get; private set; }
        public bool Night { get; private set; }

        public static MapWorld Build(Transform parent, bool night)
        {
            var go = new GameObject("MapWorld");
            go.transform.SetParent(parent, false);
            var w = go.AddComponent<MapWorld>();
            w.Night = night;
            var json = Resources.Load<TextAsset>("DemoMap/demo-campground");
            w.Map = DemoMap.FromGeoJson(json != null ? json.text : "{\"type\":\"FeatureCollection\",\"features\":[]}");
            w.Construct();
            return w;
        }

        static Vector3 W(MapPoint p, float y = 0) => new Vector3((float)p.East, y, (float)p.North);

        void Construct()
        {
            var grass = Materials.Plush(Color.white, TextureUtil.Meadow(Night), roughness: 0.95f, rim: 0f);
            grass.mainTextureScale = new Vector2(110, 110); // the disc's UVs span 1.8 km; tile every ~16 m
            Make("Ground", MeshUtil.Disc(900, 64, "MapGround"), grass, Vector3.zero);

            foreach (var f in Map.Features)
            {
                switch (f.Kind)
                {
                    case MapFeatureKind.Area: Area(f); break;
                    case MapFeatureKind.Water: Creek(f); break;
                    case MapFeatureKind.Path: Path(f); break;
                }
            }
            foreach (var f in Map.Features)
            {
                switch (f.Kind)
                {
                    case MapFeatureKind.Home: SpiralMaze(f); break;
                    case MapFeatureKind.Stop: Stop(f); break;
                }
            }
        }

        GameObject Make(string name, Mesh mesh, Material mat, Vector3 pos, Transform parent = null)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent ? parent : transform, false);
            go.transform.localPosition = pos;
            go.AddComponent<MeshFilter>().sharedMesh = mesh;
            var r = go.AddComponent<MeshRenderer>();
            r.sharedMaterial = mat;
            r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            r.receiveShadows = false;
            return go;
        }

        void Area(MapFeature f)
        {
            if (f.Geometry != MapGeometry.Polygon || !f.Habitat.HasValue) return;
            var pts = new List<Vector2>();
            foreach (var p in f.Points) pts.Add(new Vector2((float)p.East, (float)p.North));
            Color tint; Texture tex = TextureUtil.Meadow(Night);
            switch (f.Habitat.Value)
            {
                case Habitat.Woods: tint = Night ? new Color(0.55f, 0.6f, 0.8f) : new Color(0.55f, 0.75f, 0.5f); break;
                case Habitat.Town: tint = Night ? new Color(0.5f, 0.5f, 0.7f) : Colors.Hex(0xF3DFA8); tex = null; break;
                default: tint = Night ? new Color(0.85f, 0.8f, 1f) : new Color(1.12f, 1.1f, 0.85f); break;
            }
            Make("Area_" + f.Id, MeshUtil.Polygon(pts, 1f / 8f, "Area"), Materials.Plush(tint, tex, roughness: 0.95f, rim: 0f), new Vector3(0, 0.05f, 0));
            if (f.Habitat.Value == Habitat.Woods) Trees(f, pts);
        }

        void Trees(MapFeature f, List<Vector2> poly)
        {
            var rng = new System.Random(ArtSeed.Of(f.Id));
            float minX = float.MaxValue, maxX = float.MinValue, minZ = float.MaxValue, maxZ = float.MinValue;
            foreach (var p in poly) { minX = Mathf.Min(minX, p.x); maxX = Mathf.Max(maxX, p.x); minZ = Mathf.Min(minZ, p.y); maxZ = Mathf.Max(maxZ, p.y); }
            var trunkMat = Materials.Plush(Colors.Hex(0x7A4A24), roughness: 0.9f);
            var leafA = Materials.Plush(Night ? Colors.Hex(0x1E4A5A) : Colors.Hex(0x1F7A35), roughness: 0.7f, rim: 0.25f);
            var leafB = Materials.Plush(Night ? Colors.Hex(0x245868) : Colors.Hex(0x2E9444), roughness: 0.7f, rim: 0.25f);
            var cone = MeshUtil.Lathe(t => new Vector4(Mathf.Lerp(1f, 0.02f, t), t * 1.6f, -1f, 1.6f), 4, 10, "Cone");
            var trunk = MeshUtil.Lathe(t => new Vector4(0.18f, t * 0.9f, 0, 0.9f), 1, 8, "Trunk");
            var root = new GameObject("Trees").transform;
            root.SetParent(transform, false);
            int placed = 0;
            for (int i = 0; i < 400 && placed < 34; i++)
            {
                var p = new Vector2(Mathf.Lerp(minX, maxX, (float)rng.NextDouble()), Mathf.Lerp(minZ, maxZ, (float)rng.NextDouble()));
                if (!DemoMap.Contains(ToMap(poly), new MapPoint(p.x, p.y))) continue;
                float s = 3.2f + (float)rng.NextDouble() * 2.6f;
                var tree = new GameObject("Pine").transform;
                tree.SetParent(root, false);
                tree.localPosition = new Vector3(p.x, 0, p.y);
                tree.localScale = Vector3.one * s;
                Make("Trunk", trunk, trunkMat, Vector3.zero, tree);
                for (int k = 0; k < 3; k++)
                {
                    var tier = Make("Tier", cone, k % 2 == 0 ? leafA : leafB, new Vector3(0, 0.6f + k * 0.75f, 0), tree);
                    tier.transform.localScale = Vector3.one * (1.25f - k * 0.3f);
                }
                placed++;
            }
        }

        static List<MapPoint> ToMap(List<Vector2> poly)
        {
            var l = new List<MapPoint>(poly.Count);
            foreach (var p in poly) l.Add(new MapPoint(p.x, p.y));
            return l;
        }

        LineRenderer Line(string name, List<MapPoint> pts, float width, Color color, float y, bool loop = false)
        {
            var go = new GameObject(name);
            go.transform.SetParent(transform, false);
            go.transform.rotation = Quaternion.Euler(90, 0, 0); // with TransformZ alignment the ribbon lies flat
            var lr = go.AddComponent<LineRenderer>();
            lr.useWorldSpace = true;
            lr.alignment = LineAlignment.TransformZ;
            lr.loop = loop;
            lr.widthMultiplier = width;
            lr.numCornerVertices = 6;
            lr.numCapVertices = 6;
            lr.sharedMaterial = Materials.Unlit(color);
            lr.positionCount = pts.Count;
            for (int i = 0; i < pts.Count; i++) lr.SetPosition(i, W(pts[i], y));
            lr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            return lr;
        }

        void Creek(MapFeature f)
        {
            Line("CreekBank", f.Points, 10f, Night ? Colors.Hex(0x1C2E5C) : Colors.Hex(0x2BA3B8), 0.08f);
            Line("Creek", f.Points, 6.5f, Night ? Colors.Hex(0x2E4C8C) : Colors.Hex(0x45D6E6), 0.1f);
            Line("CreekShine", f.Points, 1.6f, Night ? Colors.Hex(0x6A7FD0) : Colors.Hex(0xBFF6FF), 0.12f);
        }

        void Path(MapFeature f)
        {
            Line("Path_" + f.Id, f.Points, 4.2f, Night ? Colors.Hex(0x4A4F7A) : Colors.Hex(0xF3DFA8), 0.09f);
        }

        void SpiralMaze(MapFeature f)
        {
            // A spiral hedge (the Spiral Maze), Kiki's home.
            var c = f.Center;
            HomePoint = W(c);
            var lawn = Make("MazeLawn", MeshUtil.Disc(19, 48, "MazeLawn"), Materials.Plush(Night ? new Color(0.35f, 0.42f, 0.6f) : Colors.Hex(0x8FD45E), roughness: 0.95f, rim: 0f), W(c, 0.06f));
            var spiral = new List<MapPoint>();
            for (int i = 0; i <= 140; i++)
            {
                float t = i / 140f, a = t * 2.6f * Mathf.PI * 2, r = 16f * (0.12f + 0.88f * t);
                spiral.Add(new MapPoint(c.East + Mathf.Cos(a) * r, c.North + Mathf.Sin(a) * r));
            }
            var hedgeMat = Materials.Plush(Night ? Colors.Hex(0x234E58) : Colors.Hex(0x2F7D22), roughness: 0.8f);
            // Hedge as a chain of short boxes so it has height.
            var box = MeshUtil.Lathe(t => new Vector4(1f, t * 1.4f, 0, 1.4f), 1, 10, "HedgeSeg");
            var root = new GameObject("Hedge").transform;
            root.SetParent(transform, false);
            for (int i = 0; i < spiral.Count; i += 2)
            {
                var seg = Make("H", box, hedgeMat, W(spiral[i]), root);
                seg.transform.localScale = new Vector3(1.1f, 1f, 1.1f);
            }
        }

        void Stop(MapFeature f)
        {
            var at = W(f.Center);
            if (f.Id == "supply-tent") Tent(at);
            if (f.Id == "creek-footbridge") Bridge(f);
            var marker = StopMarker.Make(transform, f.Id, f.Name, at + Vector3.up * (f.Id == "supply-tent" ? 9f : 6f));
            Stops[f.Id] = marker;
        }

        void Tent(Vector3 at)
        {
            // Striped festival tent: pink and cream panels, with a little flag.
            var tent = new GameObject("SupplyTent").transform;
            tent.SetParent(transform, false);
            tent.localPosition = at;
            var stripes = new Texture2D(8, 1) { wrapMode = TextureWrapMode.Repeat, filterMode = FilterMode.Point };
            for (int i = 0; i < 8; i++) stripes.SetPixel(i, 0, i % 2 == 0 ? Colors.Pink : Colors.Cream);
            stripes.Apply();
            var body = MeshUtil.Lathe(t => new Vector4(Mathf.Lerp(6f, 0.2f, t * t), t * 7f, -8f * t, 7f), 6, 8, "Tent");
            Make("Tent", body, Materials.Plush(Color.white, stripes, roughness: 0.7f), Vector3.zero, tent);
            var pole = MeshUtil.Lathe(t => new Vector4(0.15f, t * 3f, 0, 3f), 1, 6, "Pole");
            Make("Pole", pole, Materials.Plush(Colors.Navy), new Vector3(0, 6.8f, 0), tent);
            var flag = Make("Flag", MeshUtil.GroundQuad(1.6f, 1f, 1, "Flag"), Materials.Unlit(Colors.Sun), new Vector3(0.8f, 9.3f, 0), tent);
            flag.transform.localRotation = Quaternion.Euler(-90, 0, 0);
        }

        void Bridge(MapFeature f)
        {
            // Rainbow-striped footbridge across the creek.
            var at = W(f.Center);
            var creek = Map.OfKind(MapFeatureKind.Water);
            Vector3 dir = Vector3.forward;
            foreach (var c in creek)
            {
                // Bridge runs perpendicular to the creek's local direction.
                int best = 0; double bd = double.MaxValue;
                for (int i = 0; i < c.Points.Count; i++) { var d = c.Points[i].DistanceTo(f.Center); if (d < bd) { bd = d; best = i; } }
                int j = Mathf.Min(best + 1, c.Points.Count - 1), k = Mathf.Max(best - 1, 0);
                var along = W(c.Points[j]) - W(c.Points[k]);
                dir = Vector3.Cross(along.normalized, Vector3.up);
                break;
            }
            var deck = Make("Bridge", MeshUtil.GroundQuad(4f, 16f, 1f, "BridgeDeck"), Materials.Plush(Color.white, TextureUtil.RainbowStripes(), roughness: 0.6f), at + Vector3.up * 0.4f);
            deck.transform.rotation = Quaternion.LookRotation(dir, Vector3.up) * Quaternion.Euler(0, 90, 0);
            var rails = Make("Rails", MeshUtil.GroundQuad(4.6f, 16.6f, 1, "Rails"), Materials.Plush(Colors.Navy), at + Vector3.up * 0.3f);
            rails.transform.rotation = deck.transform.rotation;
        }
    }

    /// <summary>A supply stop: a big Rune Stone hovering and turning, pink ring when ready, muted while cooling down.</summary>
    public sealed class StopMarker : MonoBehaviour
    {
        public string Id, Name;
        Transform _stone;
        Material _ring;
        bool _ready = true;

        public static StopMarker Make(Transform parent, string id, string name, Vector3 at)
        {
            var go = new GameObject("Stop_" + id);
            go.transform.SetParent(parent, false);
            go.transform.position = at;
            var m = go.AddComponent<StopMarker>();
            m.Id = id; m.Name = name;
            var stone = RuneStone.Make(go.transform);
            stone.transform.localScale = Vector3.one * 55f;
            m._stone = stone.transform;
            var ring = new GameObject("Ring");
            ring.transform.SetParent(go.transform, false);
            ring.transform.position = new Vector3(at.x, 0.2f, at.z);
            ring.transform.rotation = Quaternion.Euler(90, 0, 0);
            ring.AddComponent<MeshFilter>().sharedMesh = MeshUtil.Ring(4.2f, 5.4f, 64, "StopRing");
            m._ring = Materials.Unlit(Colors.Pink);
            ring.AddComponent<MeshRenderer>().sharedMaterial = m._ring;
            var col = go.AddComponent<SphereCollider>();
            col.radius = 5f;
            return m;
        }

        public void SetReady(bool ready)
        {
            _ready = ready;
            _ring.SetColor("_Color", ready ? Colors.Pink : new Color(0.6f, 0.62f, 0.75f));
        }

        void Update()
        {
            _stone.localRotation = Quaternion.Euler(-65f, Time.time * (_ready ? 60f : 15f), 0);
            _stone.localPosition = Vector3.up * Mathf.Sin(Time.time * 2f) * 0.6f;
        }
    }
}
