using System;
using System.Collections.Generic;
using KikiSafari.Core;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UI;

namespace KikiSafari
{
    /// <summary>
    /// Demo Safari's map: the fictional campground, the player, Kikis from the shared spawn planner and supply stops.
    /// Tap the ground to walk; drag sideways to turn the view. Ranges follow the decisions doc: Nearby list within
    /// 200 m, on the map within 70 m, tap to encounter within 40 m.
    /// </summary>
    public sealed class MapScreen : MonoBehaviour
    {
        public const float NearbyRange = 200f, VisibleRange = 70f, EncounterRange = 40f;
        const float CellSize = 70f;
        const ulong WorldSeed = 0x6B696B69UL; // "kiki"
        const int StopCooldownSeconds = 5 * 60;
        const int StopReward = 5;
        const float WalkSpeed = 6f; // brisk demo walk, so testing doesn't take all day

        GameRoot _game;
        Action<string, string> _onEncounter;
        MapWorld _world;
        Camera _cam;
        Transform _player, _rangeRing;
        Vector3 _target;
        float _yaw = 20f;
        readonly Dictionary<string, MapKiki> _shown = new Dictionary<string, MapKiki>();
        readonly List<(string key, VariantDef def, Vector3 pos, float dist)> _nearby = new List<(string, VariantDef, Vector3, float)>();
        float _nextScan;
        MapHud _hud;

        // gesture
        Vector2 _pressPos;
        float _pressTime;
        bool _dragging;
        float _yawAtPress;

        public static MapScreen Make(GameRoot game, Action<string, string> onEncounter)
        {
            var go = new GameObject("MapScreen");
            var m = go.AddComponent<MapScreen>();
            m._game = game;
            m._onEncounter = onEncounter;
            m.Build();
            return m;
        }

        void Build()
        {
            bool night = DebugFlags.IsNight;
            _world = MapWorld.Build(transform, night);

            var camGo = new GameObject("MapCamera") { tag = "MainCamera" };
            camGo.transform.SetParent(transform, false);
            _cam = camGo.AddComponent<Camera>();
            _cam.fieldOfView = 38f;
            _cam.nearClipPlane = 1f; _cam.farClipPlane = 2000f;
            _cam.clearFlags = CameraClearFlags.Skybox;
            camGo.AddComponent<AudioListener>();
            RenderSettings.skybox = night
                ? Materials.Sky(new Color(0.12f, 0.05f, 0.32f), new Color(0.32f, 0.16f, 0.55f))
                : Materials.Sky(Colors.Sky, new Color(0.85f, 0.95f, 1f));

            var sun = new GameObject("Sun").AddComponent<Light>();
            sun.transform.SetParent(transform, false);
            sun.type = LightType.Directional;
            sun.transform.rotation = Quaternion.Euler(55f, -30f, 0);
            sun.intensity = night ? 0.55f : 1.05f;
            sun.color = night ? new Color(0.7f, 0.7f, 1f) : new Color(1f, 0.96f, 0.88f);
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
            RenderSettings.ambientLight = night ? new Color(0.35f, 0.32f, 0.55f) : new Color(0.6f, 0.6f, 0.66f);

            _player = PlayerMarker();
            var start = _world.HomePoint + new Vector3(30f, 0, 25f);
            _player.position = start;
            _target = start;

            _hud = MapHud.Make(transform, _game, OnNearbyTap, () => _game.ShowLog(), () => _game.ShowTitle());
            _hud.SetStones(_game.Progress.Stones);
            Scan();
        }

        Transform PlayerMarker()
        {
            var root = new GameObject("Player").transform;
            root.SetParent(transform, false);
            var puck = new GameObject("Puck");
            puck.transform.SetParent(root, false);
            puck.AddComponent<MeshFilter>().sharedMesh = MeshUtil.Sphere(1.6f, 12, 20, "Puck");
            puck.AddComponent<MeshRenderer>().sharedMaterial = Materials.Plush(Colors.Cream, rim: 0.3f);
            puck.transform.localScale = new Vector3(1, 0.5f, 1);
            puck.transform.localPosition = new Vector3(0, 0.8f, 0);
            var ring = new GameObject("NavyRing");
            ring.transform.SetParent(root, false);
            ring.transform.localPosition = new Vector3(0, 0.25f, 0);
            ring.transform.localRotation = Quaternion.Euler(90, 0, 0);
            ring.AddComponent<MeshFilter>().sharedMesh = MeshUtil.Ring(1.7f, 2.4f, 48, "PlayerRing");
            ring.AddComponent<MeshRenderer>().sharedMaterial = Materials.Unlit(Colors.Navy);
            var arrow = new GameObject("Arrow");
            arrow.transform.SetParent(root, false);
            arrow.transform.localPosition = new Vector3(0, 0.3f, 3.2f);
            arrow.transform.localRotation = Quaternion.Euler(90, 0, 0);
            arrow.AddComponent<MeshFilter>().sharedMesh = MeshUtil.Disc(0.9f, 3, "Arrow");
            arrow.AddComponent<MeshRenderer>().sharedMaterial = Materials.Unlit(Colors.Pink);
            arrow.transform.localScale = new Vector3(1, 1, 1.4f);
            // Encounter range: a faint ring at 40 m.
            _rangeRing = new GameObject("Range").transform;
            _rangeRing.SetParent(root, false);
            _rangeRing.localPosition = new Vector3(0, 0.15f, 0);
            _rangeRing.localRotation = Quaternion.Euler(90, 0, 0);
            _rangeRing.gameObject.AddComponent<MeshFilter>().sharedMesh = MeshUtil.Ring(EncounterRange - 0.6f, EncounterRange, 96, "RangeRing");
            _rangeRing.gameObject.AddComponent<MeshRenderer>().sharedMaterial = Materials.Unlit(new Color(1f, 0.97f, 0.87f, 0.55f));
            return root;
        }

        public void SetActive(bool on)
        {
            gameObject.SetActive(on);
            if (on) { _hud.SetStones(_game.Progress.Stones); Scan(); }
        }

        void Update()
        {
            HandleInput();
            // Walk.
            var to = _target - _player.position; to.y = 0;
            if (to.magnitude > 0.3f)
            {
                var step = Vector3.ClampMagnitude(to, WalkSpeed * Time.deltaTime);
                _player.position += step;
                _player.rotation = Quaternion.Slerp(_player.rotation, Quaternion.LookRotation(to.normalized), Time.deltaTime * 10f);
                _player.GetChild(0).localPosition = new Vector3(0, 0.8f + Mathf.Abs(Mathf.Sin(Time.time * 9f)) * 0.5f, 0);
            }
            // Follow camera.
            var focus = _player.position + Vector3.up * 2f;
            var rot = Quaternion.Euler(52f, _yaw, 0);
            _cam.transform.SetPositionAndRotation(focus - rot * Vector3.forward * 95f, rot);

            if (Time.time >= _nextScan) Scan();
            UpdateStops();
            _hud.UpdateLabels(_cam, _world, _player.position);
        }

        void HandleInput()
        {
            var p = Pointer.current;
            if (p == null) return;
            var pos = p.position.ReadValue();
            if (p.press.wasPressedThisFrame)
            {
                if (_hud.IsOverUi(pos)) { _pressTime = -1; return; }
                _pressPos = pos; _pressTime = Time.time; _dragging = false; _yawAtPress = _yaw;
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
            // Kikis and stops first.
            if (Physics.Raycast(ray, out var hit, 3000f))
            {
                var kiki = hit.collider.GetComponentInParent<MapKiki>();
                if (kiki != null) { TapKiki(kiki.Key, kiki.Def, kiki.transform.position); return; }
                var stop = hit.collider.GetComponentInParent<StopMarker>();
                if (stop != null) { TapStop(stop); return; }
            }
            // Otherwise walk to the tapped ground point.
            if (new Plane(Vector3.up, Vector3.zero).Raycast(ray, out float d))
            {
                var g = ray.GetPoint(d);
                if (g.magnitude < 600f) _target = g;
                SfxPlayer.Instance?.Play(Sfx.Tick, 0.3f);
            }
        }

        void TapKiki(string key, VariantDef def, Vector3 at)
        {
            float dist = Flat(at - _player.position).magnitude;
            if (dist <= EncounterRange)
            {
                Haptics.Play(HapticKind.Medium);
                _target = _player.position;
                _onEncounter?.Invoke(key, def.Id);
            }
            else
            {
                _target = at - Flat(at - _player.position).normalized * (EncounterRange * 0.6f);
                _hud.Toast($"{def.DisplayName} is {dist:0} m away. Walking over…");
            }
        }

        void TapStop(StopMarker stop)
        {
            float dist = Flat(stop.transform.position - _player.position).magnitude;
            if (dist > EncounterRange)
            {
                _target = stop.transform.position - Flat(stop.transform.position - _player.position).normalized * 20f;
                _hud.Toast($"Walking to the {stop.Name}…");
                return;
            }
            long now = Util.UnixNow();
            if (_game.Progress.TryClaimStop(stop.Id, now, StopCooldownSeconds, StopReward))
            {
                _game.SaveProgress();
                _hud.SetStones(_game.Progress.Stones);
                SparkleBurst.Spawn(stop.transform.position, 24, Colors.UvPurple, 1.4f, _cam, 14f, 0.9f);
                SfxPlayer.Instance?.Play(Sfx.Pickup, 0.55f);
                Haptics.Play(HapticKind.Success);
                _hud.Toast($"+{StopReward} Rune Stones!");
            }
            else
            {
                long left = _game.Progress.SecondsUntilStopReady(stop.Id, now, StopCooldownSeconds);
                _hud.Toast($"The {stop.Name} restocks in {left / 60}:{left % 60:00}");
            }
        }

        void UpdateStops()
        {
            long now = Util.UnixNow();
            foreach (var s in _world.Stops.Values)
                s.SetReady(_game.Progress.SecondsUntilStopReady(s.Id, now, StopCooldownSeconds) == 0);
        }

        static Vector3 Flat(Vector3 v) { v.y = 0; return v; }

        SpawnContext ContextAt(Vector3 p, bool night) => new SpawnContext { Habitat = _world.Map.HabitatAt(new MapPoint(p.x, p.z)), IsNight = night };

        /// <summary>Recomputes nearby Kikis from the deterministic planner (same rules as Live, on the demo map).</summary>
        void Scan()
        {
            _nextScan = Time.time + 2f;
            long now = Util.UnixNow();
            bool night = DebugFlags.IsNight;
            var defs = _game.Library.Defs;
            _nearby.Clear();
            var me = _player.position;
            int cx0 = Mathf.FloorToInt((me.x - NearbyRange) / CellSize), cx1 = Mathf.FloorToInt((me.x + NearbyRange) / CellSize);
            int cz0 = Mathf.FloorToInt((me.z - NearbyRange) / CellSize), cz1 = Mathf.FloorToInt((me.z + NearbyRange) / CellSize);
            for (int cx = cx0; cx <= cx1; cx++)
            for (int cz = cz0; cz <= cz1; cz++)
            {
                var cellCenter = new Vector3((cx + 0.5f) * CellSize, 0, (cz + 0.5f) * CellSize);
                if (cellCenter.magnitude > 320f) continue; // stay on the campground
                var ctx = ContextAt(cellCenter, night);
                foreach (var s in SpawnPlanner.ActiveSpawns(defs, cx, cz, now, WorldSeed, CellSize, 1, _ => ctx))
                {
                    var pos = new Vector3(cx * CellSize + (float)s.OffsetEast, 0, cz * CellSize + (float)s.OffsetNorth);
                    AddNearby($"{cx}:{cz}:{s.StartUnix}:{s.VariantId}", VariantCatalog.Find(defs, s.VariantId), pos, me);
                }
            }
            // Kiki's home spawn by the Spiral Maze is always there (a new one each window).
            long w = SpawnPlanner.WindowIndex(now);
            var homeCtx = new SpawnContext { Habitat = Habitat.Meadow, IsNight = night };
            var homeDef = SpawnPlanner.Pick(defs, homeCtx, new SeededRandom(SeededRandom.Hash((long)WorldSeed, 7, w)).NextDouble());
            if (homeDef != null) AddNearby($"home:{w}", homeDef, _world.HomePoint + new Vector3(22f, 0, 4f), me);

            _nearby.Sort((a, b) => a.dist.CompareTo(b.dist));
            // Show/hide map Kikis within 70 m.
            var keep = new HashSet<string>();
            foreach (var n in _nearby)
            {
                if (n.dist > VisibleRange) continue;
                keep.Add(n.key);
                if (!_shown.ContainsKey(n.key)) _shown[n.key] = MapKiki.Make(transform, n.key, n.def, _game.Library.Look(n.def.Id), n.pos);
            }
            var drop = new List<string>();
            foreach (var kv in _shown) if (!keep.Contains(kv.Key)) drop.Add(kv.Key);
            foreach (var k in drop) { Destroy(_shown[k].gameObject); _shown.Remove(k); }
            _hud.SetNearby(_nearby);
        }

        void AddNearby(string key, VariantDef def, Vector3 pos, Vector3 me)
        {
            if (def == null || _game.CaughtSpawns.Contains(key)) return;
            float dist = Flat(pos - me).magnitude;
            if (dist <= NearbyRange) _nearby.Add((key, def, pos, dist));
        }

        void OnNearbyTap(string key)
        {
            foreach (var n in _nearby)
                if (n.key == key) { TapKiki(n.key, n.def, n.pos); return; }
        }
    }

    /// <summary>A Kiki standing on the map: big enough to see from above, idling, with a rarity ring.</summary>
    public sealed class MapKiki : MonoBehaviour
    {
        public string Key;
        public VariantDef Def;

        public static MapKiki Make(Transform parent, string key, VariantDef def, Core.Art.KikiLookSpec look, Vector3 at)
        {
            var go = new GameObject("MapKiki_" + key);
            go.transform.SetParent(parent, false);
            go.transform.position = at;
            var mk = go.AddComponent<MapKiki>();
            mk.Key = key; mk.Def = def;
            var rig = KikiFactory.Build(def.Id, look, go.transform, 5.2f);
            rig.transform.localRotation = Quaternion.Euler(0, 180f + UnityEngine.Random.Range(-40f, 40f), 0);
            rig.gameObject.AddComponent<KikiMotion>();
            var ring = new GameObject("RarityRing");
            ring.transform.SetParent(go.transform, false);
            ring.transform.localPosition = new Vector3(0, 0.2f, 0);
            ring.transform.localRotation = Quaternion.Euler(90, 0, 0);
            ring.AddComponent<MeshFilter>().sharedMesh = MeshUtil.Ring(3.2f, 4.2f, 48, "RarityRing");
            ring.AddComponent<MeshRenderer>().sharedMaterial = Materials.Unlit(Colors.RarityMain(def.Rarity));
            go.transform.localScale = Vector3.zero;
            mk.StartCoroutine(mk.Appear());
            return mk;
        }

        System.Collections.IEnumerator Appear()
        {
            for (float t = 0; t < 0.4f; t += Time.deltaTime) { transform.localScale = Vector3.one * Util.EaseOutBack(t / 0.4f); yield return null; }
            transform.localScale = Vector3.one;
        }
    }
}
