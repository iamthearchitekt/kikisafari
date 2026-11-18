using System;
using System.Collections.Generic;
using KikiSafari.Core;
using UnityEngine;
using UnityEngine.InputSystem;

namespace KikiSafari
{
    /// <summary>
    /// Live Safari through the phone camera (owner's call): the real world, with Kikis, supply stops and the Rune Circle
    /// pinned at their real GPS spots. AR tracking keeps them steady between GPS updates; the compass points the AR
    /// world at true north. Without AR (the editor, or a phone without it) a meadow stand-in turns with the compass.
    /// </summary>
    public sealed class LiveScreen : MonoBehaviour
    {
        GameRoot _game;
        IEncounterStage _stage;
        DeviceLocation _loc;
        LiveHud _hud;
        Transform _worldRoot;
        OsmLoader _osm;
        StreetMapView _map;
        bool _mapMode;
        readonly Dictionary<string, WorldView> _views = new Dictionary<string, WorldView>();
        List<WorldThing> _things = new List<WorldThing>();
        float _nextPlan;
        int _seenFix = -1;

        // AR ↔ GPS alignment
        bool _aligned;
        float _northYaw;      // AR-world yaw of true north
        Vector3 _anchorAR;    // a point in AR space…
        LatLon _anchorGeo;    // …and where it is on Earth
        bool _anchored;
        float _groundY;

        // Taps
        Vector2 _pressPos; float _pressTime = -1;

        public Camera Cam => _stage.Camera;

        public static LiveScreen Make(GameRoot game, IEncounterStage stage, DeviceLocation loc)
        {
            var go = new GameObject("LiveScreen");
            var s = go.AddComponent<LiveScreen>();
            s._game = game; s._stage = stage; s._loc = loc;
            s._worldRoot = new GameObject("LiveWorld").transform;
            s._worldRoot.SetParent(go.transform, false);
            s._osm = go.AddComponent<OsmLoader>();
            s._map = StreetMapView.Make(go.transform, s, game);
            s._osm.Loaded += (cell, area) => s._map.AddArea(cell, area);
            s._hud = LiveHud.Make(go.transform, game, s);
            s.Activate();
            return s;
        }

        public void SetActive(bool on)
        {
            gameObject.SetActive(on);
            if (on) Activate();
        }

        void Activate()
        {
            if (_mapMode)
            {
                // Map mode: camera off to save battery.
                if (_stage is ARStage a) { if (a.Active) a.SetActive(false); }
                else _stage.SetActive(false);
                _worldRoot.gameObject.SetActive(false);
                _map.Show(true, _loc.Heading);
            }
            else
            {
                _map.Show(false, _loc.Heading);
                if (_stage is ARStage ar) { if (!ar.Active) ar.SetActive(true); ar.SetOcclusion(false); }
                else _stage.SetActive(true);
                _worldRoot.gameObject.SetActive(true);
                _anchored = false; _aligned = false; // re-anchor AR to GPS after the camera restarts
            }
            _hud.SetMapMode(_mapMode);
            _nextPlan = 0;
            _hud.SetStones(_game.Progress.Stones);
        }

        public bool MapMode => _mapMode;

        public void ToggleMap()
        {
            _mapMode = !_mapMode;
            Activate();
        }

        public bool HudBlocks(Vector2 screen) => _hud.IsOverUi(screen);

        static readonly Dictionary<string, WorldView> NoViews = new Dictionary<string, WorldView>();

        void Update()
        {
            if (!_loc.Ready)
            {
                _hud.SetStatus(_loc.Problem ?? "Finding where you are…");
                return;
            }

            if (_mapMode)
            {
                if (Time.time >= _nextPlan) Plan();
                _map.Tick(Me, _loc.Heading, _things);
                _hud.Tick(_map.Camera, _things, NoViews, _loc);
                _hud.SetStatus(StatusText());
                return;
            }

            UpdateAlignment();

            if (_loc.FixCount != _seenFix)
            {
                _seenFix = _loc.FixCount;
                OnFix();
            }
            if (Time.time >= _nextPlan) Plan();

            foreach (var v in _views.Values) v.SetTarget(WorldPos(v.Thing.Where, v.Thing.Kind));
            UpdateStops();
            HandleTaps();
            _hud.Tick(Cam, _things, _views, _loc);
            _hud.SetStatus(StatusText());
        }

        string StatusText()
        {
            if (_loc.SpeedLocked) return MovementGuard.MovingFastText;
            if (_mapMode && !_osm.Data.Covers(Me)) return _osm.Problem ?? "Loading the map…";
            if (!_loc.Simulated && _loc.AccuracyMeters > MovementGuard.MaxAccuracyMeters) return "Weak GPS. Things may wander a bit.";
            if (!_mapMode && _stage is ARStage ar && !ar.Tracking) return ar.Hint ?? "Waking up the camera…";
            return null;
        }

        // ---------- placement ----------

        void UpdateAlignment()
        {
            var cam = Cam.transform;
            if (_stage.IsAR)
            {
                var f = cam.forward;
                if (Mathf.Abs(f.y) < 0.85f && _loc.HeadingValid)
                {
                    float camYaw = Mathf.Atan2(f.x, f.z) * Mathf.Rad2Deg;
                    float sample = camYaw - _loc.Heading;
                    _northYaw = !_aligned ? sample : Mathf.LerpAngle(_northYaw, sample, 1f - Mathf.Exp(-Time.deltaTime * 0.6f));
                    _aligned = true;
                }
                float camFloor = cam.position.y - 1.35f;
                _groundY = _stage is ARStage ar && ar.TryGetFloorY(out var fy) ? fy : camFloor;
            }
            else
            {
                // No AR: the stand-in camera turns with the compass; north is world +Z.
                cam.rotation = Quaternion.Euler(8f, _loc.Heading, 0);
                _northYaw = 0; _aligned = true;
                _groundY = 0;
                _anchorAR = new Vector3(cam.position.x, 0, cam.position.z);
                _anchorGeo = _loc.Fix;
                _anchored = true;
            }
        }

        void OnFix()
        {
            if (!_stage.IsAR) return;
            var camFlat = Flat(Cam.transform.position);
            if (!_anchored)
            {
                _anchorAR = camFlat; _anchorGeo = _loc.Fix; _anchored = true;
                return;
            }
            // Where AR tracking says we are vs where GPS says: nudge the anchor part of the way toward GPS.
            var d = Quaternion.Euler(0, -_northYaw, 0) * (camFlat - _anchorAR);
            var predicted = Geo.FromLocal(_anchorGeo, d.x, d.z);
            var (errE, errN) = Geo.ToLocal(predicted, _loc.Fix);
            double k = _loc.AccuracyMeters <= 10 ? 0.25 : _loc.AccuracyMeters <= 25 ? 0.12 : 0.04;
            _anchorGeo = Geo.FromLocal(_anchorGeo, errE * k, errN * k);
        }

        /// <summary>AR-world position of a real-world spot.</summary>
        public Vector3 WorldPos(LatLon where, ThingKind kind = ThingKind.Kiki)
        {
            var (e, n) = Geo.ToLocal(_anchorGeo, where);
            var p = _anchorAR + Quaternion.Euler(0, _northYaw, 0) * new Vector3((float)e, 0, (float)n);
            p.y = _groundY;
            return p;
        }

        /// <summary>The player's real position (AR-tracked between GPS fixes).</summary>
        public LatLon Me
        {
            get
            {
                if (_mapMode || !_stage.IsAR || !_anchored) return _loc.Fix;
                var d = Quaternion.Euler(0, -_northYaw, 0) * (Flat(Cam.transform.position) - _anchorAR);
                return Geo.FromLocal(_anchorGeo, d.x, d.z);
            }
        }

        public float Heading => _loc.Heading;

        static Vector3 Flat(Vector3 v) { v.y = 0; return v; }

        // ---------- what's around ----------

        TestCircle Circle
        {
            get
            {
                if (DebugFlags.HomeCircle && TestCircleStore.TryGet(out var where)) return new TestCircle { Where = where };
                return null;
            }
        }

        void Plan()
        {
            _nextPlan = Time.time + 1f;
            var me = Me;
            _osm.Need(me);
            if (DebugFlags.HomeCircle && !TestCircleStore.TryGet(out _) && (_loc.Simulated || _loc.AccuracyMeters <= 35))
            {
                TestCircleStore.PinInFront(me, _loc.Heading);
                _hud.Toast("Your test Rune Circle is pinned right here!");
            }
            long now = Util.UnixNow();
            if (DebugFlags.ForceSurge && !PortalSurge.Active(now)) now = now / PortalSurge.EverySeconds * PortalSurge.EverySeconds + 60;
            _things = LiveWorldPlanner.Nearby(me, now, _game.Library.Defs, Circle, _game.Progress, _game.CaughtSpawns, data: _osm.Data);

            if (_mapMode) return; // the map draws its own
            var keep = new HashSet<string>();
            foreach (var t in _things)
            {
                bool show = t.Kind == ThingKind.Circle ? t.Distance <= 250 : t.Distance <= LiveWorldPlanner.VisibleRange;
                if (!show) continue;
                keep.Add(t.Id);
                if (_views.TryGetValue(t.Id, out var v))
                {
                    v.Thing = t;
                    if (v is CircleWorldView cv) { cv.SetKeeper(t, _game.Library); cv.SetSurge(t.Surge); }
                    continue;
                }
                WorldView made;
                switch (t.Kind)
                {
                    case ThingKind.Kiki: made = KikiWorldView.Make(_worldRoot, t, _game.Library.Look(t.Variant.Id), Cam); break;
                    case ThingKind.Stop: made = StopWorldView.Make(_worldRoot, t); break;
                    default: var c = CircleWorldView.Make(_worldRoot, t, Cam, _game.Library); c.SetSurge(t.Surge); made = c; break;
                }
                made.SetTarget(WorldPos(t.Where, t.Kind));
                _views[t.Id] = made;
            }
            var drop = new List<string>();
            foreach (var kv in _views) if (!keep.Contains(kv.Key)) drop.Add(kv.Key);
            foreach (var id in drop) { Destroy(_views[id].gameObject); _views.Remove(id); }
        }

        void UpdateStops()
        {
            long now = Util.UnixNow();
            foreach (var v in _views.Values)
                if (v is StopWorldView s) s.SetReady(_game.Progress.SecondsUntilStopReady(s.Thing.Id, now, StopCooldownSeconds) == 0);
        }

        public const int StopCooldownSeconds = 5 * 60;
        const int StopReward = 5;

        // ---------- taps ----------

        void HandleTaps()
        {
            var p = Pointer.current;
            if (p == null) return;
            var pos = p.position.ReadValue();
            if (p.press.wasPressedThisFrame)
            {
                if (_hud.IsOverUi(pos)) { _pressTime = -1; return; }
                _pressPos = pos; _pressTime = Time.time;
            }
            if (_pressTime >= 0 && p.press.wasReleasedThisFrame)
            {
                if (Time.time - _pressTime < 0.5f && (pos - _pressPos).magnitude < Screen.height * 0.03f) Tap(pos);
                _pressTime = -1;
            }
        }

        void Tap(Vector2 screen)
        {
            var ray = Cam.ScreenPointToRay(screen);
            WorldView best = null; float bestDist = float.MaxValue;
            foreach (var hit in Physics.RaycastAll(ray, 400f))
            {
                var v = hit.collider.GetComponentInParent<WorldView>();
                if (v != null && hit.distance < bestDist) { best = v; bestDist = hit.distance; }
            }
            if (best != null) Interact(best.Thing);
        }

        public void Interact(WorldThing t)
        {
            if (_loc.SpeedLocked) { _hud.Toast(MovementGuard.MovingFastText); return; }
            double dist = Geo.Distance(Me, t.Where);
            if (dist > LiveWorldPlanner.ActionRange)
            {
                _hud.Toast($"{t.Name} is {dist:0} m away. Get within {LiveWorldPlanner.ActionRange:0} m.");
                return;
            }
            switch (t.Kind)
            {
                case ThingKind.Kiki:
                    Haptics.Play(HapticKind.Medium);
                    _game.StartEncounter(t.Id, t.Variant.Id);
                    break;
                case ThingKind.Stop:
                    ClaimStop(t);
                    break;
                case ThingKind.Circle:
                    Haptics.Play(HapticKind.Light);
                    _hud.ShowCircle(t);
                    break;
            }
        }

        void ClaimStop(WorldThing t)
        {
            long now = Util.UnixNow();
            if (_game.Progress.TryClaimStop(t.Id, now, StopCooldownSeconds, StopReward))
            {
                _game.SaveProgress();
                _hud.SetStones(_game.Progress.Stones);
                if (_views.TryGetValue(t.Id, out var v)) SparkleBurst.Spawn(v.transform.position + Vector3.up * 1.9f, 22, Colors.UvPurple, 0.12f, Cam, 1.2f, 0.9f);
                SfxPlayer.Instance?.Play(Sfx.Pickup, 0.55f);
                Haptics.Play(HapticKind.Success);
                _hud.Toast($"+{StopReward} Rune Stones!");
            }
            else
            {
                long left = _game.Progress.SecondsUntilStopReady(t.Id, now, StopCooldownSeconds);
                _hud.Toast($"This stop restocks in {left / 60}:{left % 60:00}");
            }
        }

        /// <summary>Called by the Rune Circle panel.</summary>
        public void BeginRite(WorldThing circle)
        {
            SpiralRiteScreen.Show(transform, _game, circle, won =>
            {
                _nextPlan = 0;
                _hud.SetStones(_game.Progress.Stones);
            });
        }

        public void RepinCircle()
        {
            TestCircleStore.PinInFront(Me, _loc.Heading);
            _nextPlan = 0;
            _hud.Toast("Test Rune Circle moved here.");
        }
    }
}
