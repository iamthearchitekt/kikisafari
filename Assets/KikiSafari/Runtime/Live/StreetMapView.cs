using System.Collections.Generic;
using KikiSafari.Core;
using KikiSafari.Core.Art;
using UnityEngine;
using UnityEngine.InputSystem;

namespace KikiSafari
{
    /// <summary>
    /// The street map: your real streets from OpenStreetMap in the sticker style, with you, the Kikis, supply stops and
    /// Rune Circles on it. Drag to turn, pinch (or scroll) to zoom, tap something to interact (within 40 m).
    /// </summary>
    public sealed class StreetMapView : MonoBehaviour
    {
        LiveScreen _screen;
        GameRoot _game;
        Camera _cam;
        Transform _layers, _things, _player;
        LatLon _origin;
        bool _hasOrigin, _night;
        readonly Dictionary<(long, long), GameObject> _built = new Dictionary<(long, long), GameObject>();
        readonly Dictionary<string, Transform> _views = new Dictionary<string, Transform>();
        float _yaw, _dist = 420f;
        Vector3 _playerPos;

        // gestures
        Vector2 _pressPos; float _pressTime = -1; float _yawAtPress; bool _dragging;
        float _pinchStart, _distAtPinch;

        public bool Showing => gameObject.activeSelf;

        public static StreetMapView Make(Transform parent, LiveScreen screen, GameRoot game)
        {
            var go = new GameObject("StreetMap");
            go.transform.SetParent(parent, false);
            var v = go.AddComponent<StreetMapView>();
            v._screen = screen; v._game = game;
            v._layers = new GameObject("Layers").transform; v._layers.SetParent(go.transform, false);
            v._things = new GameObject("Things").transform; v._things.SetParent(go.transform, false);

            var camGo = new GameObject("MapCamera");
            camGo.transform.SetParent(go.transform, false);
            v._cam = camGo.AddComponent<Camera>();
            v._cam.fieldOfView = 38f;
            v._cam.nearClipPlane = 2f; v._cam.farClipPlane = 4000f;
            v._cam.clearFlags = CameraClearFlags.SolidColor;
            camGo.AddComponent<AudioListener>();

            var sun = new GameObject("MapSun").AddComponent<Light>();
            sun.transform.SetParent(go.transform, false);
            sun.type = LightType.Directional;
            sun.transform.rotation = Quaternion.Euler(55f, -30f, 0);
            sun.intensity = 1.0f;

            v._player = v.PlayerMarker();
            go.SetActive(false);
            return v;
        }

        public Camera Camera => _cam;

        public void Show(bool on, float heading)
        {
            if (on && !gameObject.activeSelf) _yaw = heading;
            gameObject.SetActive(on);
        }

        Transform PlayerMarker()
        {
            var root = new GameObject("You").transform;
            root.SetParent(transform, false);
            var puck = new GameObject("Puck");
            puck.transform.SetParent(root, false);
            puck.AddComponent<MeshFilter>().sharedMesh = MeshUtil.Sphere(3.2f, 14, 22, "MapPuck");
            puck.AddComponent<MeshRenderer>().sharedMaterial = Materials.Plush(Colors.Cream, rim: 0.3f);
            puck.transform.localScale = new Vector3(1, 0.5f, 1);
            puck.transform.localPosition = new Vector3(0, 1.6f, 0);
            Flat(root, "Ring", MeshUtil.Ring(3.4f, 4.8f, 48, "YouRing"), Colors.Navy, 0.5f, 1990);
            var arrow = Flat(root, "Arrow", MeshUtil.Disc(1.8f, 3, "YouArrow"), Colors.Pink, 0.6f, 1991);
            arrow.localPosition = new Vector3(0, 0.6f, 6.5f);
            arrow.localScale = new Vector3(1, 1, 1.5f);
            Flat(root, "Range", MeshUtil.Ring(LiveWorldPlanner.ActionRange - 0.9f, LiveWorldPlanner.ActionRange, 128, "YouRange"), new Color(1, 1, 1, 0.9f), 0.4f, 1989);
            return root;
        }

        static Transform Flat(Transform parent, string name, Mesh mesh, Color c, float y, int queue)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = new Vector3(0, y, 0);
            if (name != "Arrow") go.transform.localRotation = Quaternion.Euler(90, 0, 0);
            go.AddComponent<MeshFilter>().sharedMesh = mesh;
            var m = Materials.MapFlat(c);
            m.renderQueue = queue;
            go.AddComponent<MeshRenderer>().sharedMaterial = m;
            return go.transform;
        }

        Vector3 Local(LatLon p)
        {
            var (e, n) = Geo.ToLocal(_origin, p);
            return new Vector3((float)e, 0, (float)n);
        }

        /// <summary>Builds the map for a newly loaded area.</summary>
        public void AddArea(WorldGrid.Cell cell, OsmArea area)
        {
            var key = (cell.X, cell.Y);
            if (_built.ContainsKey(key)) return;
            if (!_hasOrigin) { _origin = cell.Center; _hasOrigin = true; _night = SunClock.IsNight(cell.Center, System.DateTime.UtcNow) || DebugFlags.ForceNight; ApplyMood(); }
            var meshes = StreetMapGeometry.Build(area, _origin, _night);
            var root = new GameObject($"Area_{cell.X}_{cell.Y}");
            root.transform.SetParent(_layers, false);
            Layer(root.transform, "Green", meshes.Green, 1950);
            Layer(root.transform, "Water", meshes.Water, 1951);
            Layer(root.transform, "Casing", meshes.Casing, 1952);
            Layer(root.transform, "Roads", meshes.Roads, 1953);
            Layer(root.transform, "Paths", meshes.Paths, 1954);
            if (meshes.Buildings.VertexCount > 0)
            {
                var b = new GameObject("Buildings");
                b.transform.SetParent(root.transform, false);
                b.AddComponent<MeshFilter>().sharedMesh = ArtBridge.ToMesh(meshes.Buildings, "Buildings");
                b.AddComponent<MeshRenderer>().sharedMaterial = Materials.Plush(Color.white, roughness: 0.9f, rim: 0.08f);
            }
            _built[key] = root;
        }

        static readonly Dictionary<int, Material> FlatMats = new Dictionary<int, Material>();

        static void Layer(Transform parent, string name, MeshData data, int queue)
        {
            if (data.VertexCount == 0) return;
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.AddComponent<MeshFilter>().sharedMesh = ArtBridge.ToMesh(data, name);
            if (!FlatMats.TryGetValue(queue, out var m) || m == null)
            {
                m = Materials.MapFlat(Color.white);
                m.renderQueue = queue;
                FlatMats[queue] = m;
            }
            go.AddComponent<MeshRenderer>().sharedMaterial = m;
        }

        void ApplyMood()
        {
            _cam.backgroundColor = _night ? Colors.Hex(0x22304F) : Colors.Hex(0xE9F3D6);
            var ground = new GameObject("Land");
            ground.transform.SetParent(_layers, false);
            ground.AddComponent<MeshFilter>().sharedMesh = MeshUtil.Disc(6000, 64, "MapLand");
            var m = Materials.MapFlat(_cam.backgroundColor);
            m.renderQueue = 1940;
            ground.AddComponent<MeshRenderer>().sharedMaterial = m;
        }

        /// <summary>Keeps the map in step with the player and what's around.</summary>
        public void Tick(LatLon me, float heading, List<WorldThing> things)
        {
            if (!_hasOrigin) { _origin = me; _hasOrigin = true; _night = SunClock.IsNight(me, System.DateTime.UtcNow) || DebugFlags.ForceNight; ApplyMood(); }
            var target = Local(me);
            _playerPos = Vector3.Lerp(_playerPos == Vector3.zero ? target : _playerPos, target, 1f - Mathf.Exp(-Time.deltaTime * 4f));
            _player.position = _playerPos;
            _player.rotation = Quaternion.Euler(0, heading, 0);

            HandleInput();
            var rot = Quaternion.Euler(54f, _yaw, 0);
            _cam.transform.SetPositionAndRotation(_playerPos - rot * Vector3.forward * _dist, rot);

            var keep = new HashSet<string>();
            foreach (var t in things)
            {
                if (t.Distance > 400) continue;
                keep.Add(t.Id);
                if (!_views.TryGetValue(t.Id, out var v)) _views[t.Id] = v = MakeThing(t);
                v.position = Vector3.Lerp(v.position, Local(t.Where), 1f - Mathf.Exp(-Time.deltaTime * 4f));
                var mt = v.GetComponent<MapThing>(); mt.Thing = t;
            }
            var drop = new List<string>();
            foreach (var kv in _views) if (!keep.Contains(kv.Key)) drop.Add(kv.Key);
            foreach (var id in drop) { Destroy(_views[id].gameObject); _views.Remove(id); }
        }

        Transform MakeThing(WorldThing t)
        {
            var go = new GameObject("Map_" + t.Id);
            go.transform.SetParent(_things, false);
            go.transform.position = Local(t.Where);
            go.AddComponent<MapThing>().Thing = t;
            var col = go.AddComponent<SphereCollider>();
            switch (t.Kind)
            {
                case ThingKind.Kiki:
                {
                    var rig = KikiFactory.Build(t.Variant.Id, _game.Library.Look(t.Variant.Id), go.transform, 6f);
                    rig.transform.localRotation = Quaternion.Euler(0, 180f, 0);
                    rig.gameObject.AddComponent<KikiMotion>();
                    Flat(go.transform, "Rarity", MeshUtil.Ring(3.4f, 4.6f, 48, "MapRarity"), Colors.RarityMain(t.Variant.Rarity), 0.3f, 1980);
                    col.center = new Vector3(0, 3, 0); col.radius = 5f;
                    break;
                }
                case ThingKind.Stop:
                {
                    var stone = RuneStone.Make(go.transform);
                    stone.transform.localScale = Vector3.one * 70f;
                    stone.transform.localPosition = new Vector3(0, 7f, 0);
                    stone.gameObject.AddComponent<Spin>().DegreesPerSecond = 50f;
                    Flat(go.transform, "Ring", MeshUtil.Ring(4.5f, 6f, 48, "MapStopRing"), Colors.Pink, 0.3f, 1980);
                    col.center = new Vector3(0, 5, 0); col.radius = 7f;
                    break;
                }
                default:
                {
                    var c = CircleWorldView.Make(go.transform, t, _cam, _game.Library);
                    c.transform.localPosition = Vector3.zero;
                    c.transform.localScale = Vector3.one * 3.2f;
                    c.SetTarget(go.transform.position);
                    c.enabled = false; // positioned by the map, not by GPS smoothing
                    col.center = new Vector3(0, 4, 0); col.radius = 11f;
                    break;
                }
            }
            return go.transform;
        }

        void HandleInput()
        {
            var ts = Touchscreen.current;
            // Pinch to zoom.
            if (ts != null && ts.touches.Count >= 2 && ts.touches[0].press.isPressed && ts.touches[1].press.isPressed)
            {
                float d = (ts.touches[0].position.ReadValue() - ts.touches[1].position.ReadValue()).magnitude;
                if (_pinchStart <= 0) { _pinchStart = d; _distAtPinch = _dist; }
                else _dist = Mathf.Clamp(_distAtPinch * _pinchStart / Mathf.Max(1, d), 160f, 1100f);
                _pressTime = -1;
                return;
            }
            _pinchStart = 0;
            var mouse = Mouse.current;
            if (mouse != null)
            {
                float scroll = mouse.scroll.ReadValue().y;
                if (Mathf.Abs(scroll) > 0.01f) _dist = Mathf.Clamp(_dist * (scroll > 0 ? 0.9f : 1.1f), 160f, 1100f);
            }

            var p = Pointer.current;
            if (p == null) return;
            var pos = p.position.ReadValue();
            if (p.press.wasPressedThisFrame)
            {
                if (_screen.HudBlocks(pos)) { _pressTime = -1; return; }
                _pressPos = pos; _pressTime = Time.time; _yawAtPress = _yaw; _dragging = false;
            }
            if (_pressTime < 0) return;
            if (p.press.isPressed)
            {
                float dx = pos.x - _pressPos.x;
                if (Mathf.Abs(dx) > Screen.width * 0.03f) _dragging = true;
                if (_dragging) _yaw = _yawAtPress + dx / Screen.width * 180f;
            }
            if (p.press.wasReleasedThisFrame)
            {
                if (!_dragging && Time.time - _pressTime < 0.5f) Tap(pos);
                _pressTime = -1;
            }
        }

        void Tap(Vector2 screen)
        {
            var ray = _cam.ScreenPointToRay(screen);
            MapThing best = null; float bestD = float.MaxValue;
            foreach (var hit in Physics.RaycastAll(ray, 5000f))
            {
                var mt = hit.collider.GetComponentInParent<MapThing>();
                if (mt != null && hit.distance < bestD) { best = mt; bestD = hit.distance; }
            }
            if (best != null) _screen.Interact(best.Thing);
        }
    }

    /// <summary>Marks a map object with the world thing it stands for.</summary>
    public sealed class MapThing : MonoBehaviour { public WorldThing Thing; }
}
