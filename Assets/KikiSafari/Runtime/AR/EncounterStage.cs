using System.Collections.Generic;
using Unity.XR.CoreUtils;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.XR.ARFoundation;
using UnityEngine.XR.ARSubsystems;
using InputTrackedPoseDriver = UnityEngine.InputSystem.XR.TrackedPoseDriver;

namespace KikiSafari
{
    /// <summary>Where an encounter happens: the real world through AR, or a meadow stand-in when AR isn't available.</summary>
    public interface IEncounterStage
    {
        Camera Camera { get; }
        /// <summary>True once there is somewhere to put Kiki.</summary>
        bool Ready { get; }
        bool IsAR { get; }
        /// <summary>A hint for the player while not ready.</summary>
        string Hint { get; }
        /// <summary>Kiki's spot: on the floor, facing the camera, 1.4–2.6 m away.</summary>
        Pose Placement { get; }
        string DebugInfo { get; }
        void Tick();
        void SetActive(bool active);
    }

    static class StageLighting
    {
        public static Light Make(Transform parent)
        {
            var go = new GameObject("Sun");
            go.transform.SetParent(parent, false);
            go.transform.rotation = Quaternion.Euler(48f, -35f, 0f);
            var l = go.AddComponent<Light>();
            l.type = LightType.Directional;
            l.color = new Color(1f, 0.96f, 0.88f);
            l.intensity = 1.05f;
            l.shadows = LightShadows.None;
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
            RenderSettings.ambientLight = new Color(0.58f, 0.58f, 0.66f);
            return l;
        }
    }

    /// <summary>
    /// AR Foundation rig built in code: AR Session, XR Origin with camera, plane detection, raycasts and occlusion.
    /// Occlusion: LiDAR iPhones get environment depth; A12+ get people occlusion; others none. Requested modes that a
    /// device can't do are ignored by the subsystem, so this degrades gracefully at runtime.
    /// </summary>
    public sealed class ARStage : IEncounterStage
    {
        readonly GameObject _root;
        readonly ARSession _session;
        readonly ARRaycastManager _raycasts;
        readonly ARPlaneManager _planes;
        readonly AROcclusionManager _occlusion;
        readonly Transform _reticle;
        readonly List<ARRaycastHit> _hits = new List<ARRaycastHit>();
        float _stableFor;
        Pose _candidate;
        bool _placed;

        public Camera Camera { get; }
        public bool IsAR => true;
        public bool Ready => _placed;
        public Pose Placement { get; private set; }

        public string Hint
        {
            get
            {
                switch (ARSession.state)
                {
                    case ARSessionState.CheckingAvailability:
                    case ARSessionState.Installing:
                    case ARSessionState.SessionInitializing: return "Waking up the camera…";
                    case ARSessionState.NeedsInstall: return "This phone needs AR support installed";
                }
                if (ARSession.notTrackingReason == NotTrackingReason.InsufficientLight) return "It's a bit dark here. Find some light!";
                if (ARSession.notTrackingReason == NotTrackingReason.ExcessiveMotion) return "Hold steady a moment…";
                return _placed ? null : "Point your phone at the ground and move it slowly";
            }
        }

        public bool Unsupported => ARSession.state == ARSessionState.Unsupported;
        public bool Tracking => ARSession.state == ARSessionState.SessionTracking;

        /// <summary>Height of the floor: the lowest horizontal plane 0.5–2.2 m below the camera.</summary>
        public bool TryGetFloorY(out float y)
        {
            y = float.MaxValue;
            float camY = Camera.transform.position.y;
            foreach (var p in _planes.trackables)
            {
                if (p.alignment != PlaneAlignment.HorizontalUp) continue;
                float py = p.transform.position.y, below = camY - py;
                if (below > 0.5f && below < 2.2f && py < y) y = py;
            }
            return y != float.MaxValue;
        }

        /// <summary>Depth occlusion on (encounters) or off (the world view, so distant beacons aren't hidden by walls).</summary>
        public void SetOcclusion(bool on)
        {
            _occlusion.requestedEnvironmentDepthMode = on ? EnvironmentDepthMode.Best : EnvironmentDepthMode.Disabled;
            _occlusion.requestedHumanStencilMode = on ? HumanSegmentationStencilMode.Fastest : HumanSegmentationStencilMode.Disabled;
            _occlusion.requestedHumanDepthMode = on ? HumanSegmentationDepthMode.Fastest : HumanSegmentationDepthMode.Disabled;
        }

        public bool Active => _root.activeSelf;

        public ARStage(Transform parent)
        {
            _root = new GameObject("AR Stage");
            _root.transform.SetParent(parent, false);
            _root.SetActive(false); // configure everything before any OnEnable runs

            var sessionGo = new GameObject("AR Session");
            sessionGo.transform.SetParent(_root.transform, false);
            _session = sessionGo.AddComponent<ARSession>();
            _session.attemptUpdate = true;
            sessionGo.AddComponent<ARInputManager>();

            var originGo = new GameObject("XR Origin");
            originGo.transform.SetParent(_root.transform, false);
            var origin = originGo.AddComponent<XROrigin>();
            var offset = new GameObject("Camera Offset");
            offset.transform.SetParent(originGo.transform, false);

            var camGo = new GameObject("AR Camera") { tag = "MainCamera" };
            camGo.transform.SetParent(offset.transform, false);
            Camera = camGo.AddComponent<Camera>();
            Camera.clearFlags = CameraClearFlags.SolidColor;
            Camera.backgroundColor = Color.black;
            Camera.nearClipPlane = 0.05f;
            Camera.farClipPlane = 30f;
            camGo.AddComponent<ARCameraManager>();
            camGo.AddComponent<ARCameraBackground>();
            _occlusion = camGo.AddComponent<AROcclusionManager>();
            _occlusion.requestedEnvironmentDepthMode = EnvironmentDepthMode.Best;
            _occlusion.requestedHumanDepthMode = HumanSegmentationDepthMode.Fastest;
            _occlusion.requestedHumanStencilMode = HumanSegmentationStencilMode.Fastest;
            _occlusion.requestedOcclusionPreferenceMode = OcclusionPreferenceMode.PreferEnvironmentOcclusion;
            camGo.AddComponent<AudioListener>();

            var tpd = camGo.AddComponent<InputTrackedPoseDriver>();
            tpd.trackingType = InputTrackedPoseDriver.TrackingType.RotationAndPosition;
            tpd.updateType = InputTrackedPoseDriver.UpdateType.UpdateAndBeforeRender;
            tpd.positionInput = new InputActionProperty(new InputAction("Position", InputActionType.Value, "<HandheldARInputDevice>/devicePosition", expectedControlType: "Vector3"));
            tpd.rotationInput = new InputActionProperty(new InputAction("Rotation", InputActionType.Value, "<HandheldARInputDevice>/deviceRotation", expectedControlType: "Quaternion"));
            tpd.trackingStateInput = new InputActionProperty(new InputAction("Tracking State", InputActionType.Value, "<HandheldARInputDevice>/trackingState", expectedControlType: "Integer"));

            origin.Camera = Camera;
            origin.CameraFloorOffsetObject = offset;
            origin.RequestedTrackingOriginMode = XROrigin.TrackingOriginMode.Device;

            _planes = originGo.AddComponent<ARPlaneManager>();
            _planes.requestedDetectionMode = PlaneDetectionMode.Horizontal;
            _raycasts = originGo.AddComponent<ARRaycastManager>();

            StageLighting.Make(_root.transform);
            _reticle = Reticle.Make(_root.transform);
        }

        public void SetActive(bool active)
        {
            _root.SetActive(active);
            if (active) ResetPlacement();
        }

        /// <summary>Starts looking for a new spot for Kiki, without restarting the AR session.</summary>
        public void ResetPlacement()
        {
            _placed = false;
            _stableFor = 0;
            if (_reticle) _reticle.gameObject.SetActive(false);
        }

        public void Tick()
        {
            if (_placed || ARSession.state < ARSessionState.SessionTracking) return;
            var center = new Vector2(Screen.width * 0.5f, Screen.height * 0.42f);
            if (_raycasts.Raycast(center, _hits, TrackableType.PlaneWithinPolygon))
            {
                var hit = _hits[0].pose;
                var cam = Camera.transform.position;
                var flatFwd = Vector3.ProjectOnPlane(Camera.transform.forward, Vector3.up);
                if (flatFwd.sqrMagnitude < 1e-4f) flatFwd = Vector3.forward;
                flatFwd.Normalize();
                // Clamp to a comfortable throwing distance; keep the floor height from the hit.
                var flatDelta = Vector3.ProjectOnPlane(hit.position - cam, Vector3.up);
                float dist = Mathf.Clamp(Vector3.Dot(flatDelta, flatFwd), 1.4f, 2.6f);
                var pos = new Vector3(cam.x, hit.position.y, cam.z) + flatFwd * dist;
                var rot = Quaternion.LookRotation(-flatFwd, Vector3.up);
                if ((pos - _candidate.position).sqrMagnitude < 0.04f) _stableFor += Time.deltaTime; else _stableFor = 0;
                _candidate = new Pose(pos, rot);
                _reticle.gameObject.SetActive(true);
                _reticle.SetPositionAndRotation(pos + Vector3.up * 0.003f, rot);
                if (_stableFor > 0.6f)
                {
                    Placement = _candidate;
                    _placed = true;
                    _reticle.gameObject.SetActive(false);
                }
            }
            else
            {
                _stableFor = 0;
                _reticle.gameObject.SetActive(false);
            }
        }

        public string DebugInfo
        {
            get
            {
                string occ = "occlusion: n/a";
                try
                {
                    var d = _occlusion.descriptor;
                    if (d != null) occ = $"depth: {d.environmentDepthImageSupported}, people: {d.humanSegmentationStencilImageSupported}";
                }
                catch { }
                return $"AR {ARSession.state} / {ARSession.notTrackingReason}\nplanes: {_planes.trackables.count}\n{occ}";
            }
        }
    }

    /// <summary>No-AR stand-in: a sunny meadow (or cosmic night) with Kiki 2.2 m away. Used in the editor and on phones without AR.</summary>
    public sealed class FallbackStage : IEncounterStage
    {
        readonly GameObject _root;
        public Camera Camera { get; }
        public bool IsAR => false;
        public bool Ready => true;
        public string Hint => null;
        public Pose Placement => new Pose(new Vector3(0, 0, 2.2f), Quaternion.Euler(0, 180f, 0));
        public string DebugInfo => "No AR: fallback meadow stage";

        public FallbackStage(Transform parent)
        {
            _root = new GameObject("Fallback Stage");
            _root.transform.SetParent(parent, false);
            var camGo = new GameObject("Stage Camera") { tag = "MainCamera" };
            camGo.transform.SetParent(_root.transform, false);
            camGo.transform.SetPositionAndRotation(new Vector3(0, 1.35f, 0), Quaternion.Euler(14f, 0, 0));
            Camera = camGo.AddComponent<Camera>();
            Camera.nearClipPlane = 0.05f;
            Camera.farClipPlane = 200f;
            Camera.fieldOfView = 62f;
            Camera.clearFlags = CameraClearFlags.Skybox;
            camGo.AddComponent<AudioListener>();

            var ground = new GameObject("Ground");
            ground.transform.SetParent(_root.transform, false);
            ground.AddComponent<MeshFilter>().sharedMesh = MeshUtil.GroundQuad(120, 120, 30, "Ground");
            ground.AddComponent<MeshRenderer>().sharedMaterial = Materials.Plush(Color.white, TextureUtil.Meadow(DebugFlags.IsNight));
            StageLighting.Make(_root.transform);
        }

        public void Tick() { }

        public void SetActive(bool active)
        {
            _root.SetActive(active);
            if (active)
            {
                Camera.transform.SetPositionAndRotation(new Vector3(0, 1.35f, 0), Quaternion.Euler(14f, 0, 0));
                bool night = DebugFlags.IsNight;
                RenderSettings.skybox = night
                    ? Materials.Sky(new Color(0.12f, 0.05f, 0.32f), new Color(0.32f, 0.16f, 0.55f))
                    : Materials.Sky(Colors.Sky, new Color(0.85f, 0.95f, 1f));
            }
        }
    }

    /// <summary>Sticker-style placement ring shown on the floor while AR looks for a spot.</summary>
    static class Reticle
    {
        public static Transform Make(Transform parent)
        {
            var go = new GameObject("Reticle");
            go.transform.SetParent(parent, false);
            var outer = new GameObject("Navy");
            outer.transform.SetParent(go.transform, false);
            outer.transform.localRotation = Quaternion.Euler(90, 0, 0);
            outer.AddComponent<MeshFilter>().sharedMesh = MeshUtil.Ring(0.13f, 0.17f, 64, "ReticleOuter");
            outer.AddComponent<MeshRenderer>().sharedMaterial = Materials.Unlit(Colors.Navy);
            var inner = new GameObject("Cream");
            inner.transform.SetParent(go.transform, false);
            inner.transform.localPosition = new Vector3(0, 0.001f, 0);
            inner.transform.localRotation = Quaternion.Euler(90, 0, 0);
            inner.AddComponent<MeshFilter>().sharedMesh = MeshUtil.Ring(0.14f, 0.16f, 64, "ReticleInner");
            inner.AddComponent<MeshRenderer>().sharedMaterial = Materials.Unlit(Colors.Cream);
            go.AddComponent<Spin>().DegreesPerSecond = 40f;
            go.SetActive(false);
            return go.transform;
        }
    }

    public sealed class Spin : MonoBehaviour
    {
        public float DegreesPerSecond = 30f;
        public Vector3 Axis = Vector3.up;
        void Update() => transform.Rotate(Axis, DegreesPerSecond * Time.deltaTime, Space.Self);
    }
}
