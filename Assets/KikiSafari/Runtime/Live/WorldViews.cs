using KikiSafari.Core;
using UnityEngine;

namespace KikiSafari
{
    /// <summary>Base for things shown in the camera world view at their real-world spot.</summary>
    public abstract class WorldView : MonoBehaviour
    {
        public WorldThing Thing;
        Vector3 _target;
        bool _placed;

        /// <summary>Smoothly moves to where GPS says the thing is (GPS wobbles; this hides it).</summary>
        public void SetTarget(Vector3 p)
        {
            _target = p;
            if (!_placed) { transform.position = p; _placed = true; }
        }

        protected virtual void Update()
        {
            transform.position = Vector3.Lerp(transform.position, _target, 1f - Mathf.Exp(-Time.deltaTime * 3f));
        }

        protected static Mesh Cylinder(float bottom, float top, float height, string name)
            => MeshUtil.Lathe(t => new Vector4(Mathf.Lerp(bottom, top, t), t * height, top - bottom, height), 1, 32, name);

        protected static GameObject Part(string name, Transform parent, Mesh mesh, Material mat, Vector3 pos)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = pos;
            go.AddComponent<MeshFilter>().sharedMesh = mesh;
            var r = go.AddComponent<MeshRenderer>();
            r.sharedMaterial = mat;
            r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            return go;
        }

        /// <summary>A soft column of light so the thing can be spotted from far away.</summary>
        protected static Transform Beacon(Transform parent, Color color, float height, float radius, float strength, float baseY = 0)
        {
            var b = Part("Beacon", parent, Cylinder(radius * 0.6f, radius, height, "Beacon"), Materials.LightBeam(color, strength, height), new Vector3(0, baseY, 0));
            return b.transform;
        }
    }

    /// <summary>A wild Kiki in the world: the real model, plus a beacon in its rarity colour while it's far away.</summary>
    public sealed class KikiWorldView : WorldView
    {
        KikiRig _rig;
        Transform _beacon;
        Camera _cam;

        public static KikiWorldView Make(Transform parent, WorldThing t, Core.Art.KikiLookSpec look, Camera cam)
        {
            var go = new GameObject("Kiki_" + t.Id);
            go.transform.SetParent(parent, false);
            var v = go.AddComponent<KikiWorldView>();
            v.Thing = t; v._cam = cam;
            v._rig = KikiFactory.Build(t.Variant.Id, look, go.transform, 0.6f);
            v._rig.gameObject.AddComponent<KikiMotion>();
            v._beacon = Beacon(go.transform, Colors.RarityMain(t.Variant.Rarity), 7f, 0.22f, 0.45f, 0.3f);
            return v;
        }

        protected override void Update()
        {
            base.Update();
            if (_cam == null) return;
            var d = _cam.transform.position - transform.position; d.y = 0;
            float dist = d.magnitude;
            if (d.sqrMagnitude > 0.01f) _rig.transform.rotation = Quaternion.LookRotation(d.normalized);
            // Grow a little with distance so far Kikis stay findable; real size up close.
            transform.localScale = Vector3.one * Mathf.Clamp(dist / 12f, 1f, 2.6f);
            _beacon.gameObject.SetActive(dist > 10f);
        }
    }

    /// <summary>A supply stop: a big Rune Stone hovering and turning, pink beacon when ready, dim while restocking.</summary>
    public sealed class StopWorldView : WorldView
    {
        Transform _stone;
        Material _beaconMat;
        bool _ready = true;

        public static StopWorldView Make(Transform parent, WorldThing t)
        {
            var go = new GameObject("Stop_" + t.Id);
            go.transform.SetParent(parent, false);
            var v = go.AddComponent<StopWorldView>();
            v.Thing = t;
            var stone = RuneStone.Make(go.transform);
            stone.transform.localScale = Vector3.one * 7f; // about 56 cm across
            stone.transform.localPosition = new Vector3(0, 1.9f, 0);
            v._stone = stone.transform;
            var beacon = Beacon(go.transform, Colors.Pink, 6f, 0.3f, 0.4f, 2.1f);
            v._beaconMat = beacon.GetComponent<MeshRenderer>().sharedMaterial;
            var col = go.AddComponent<CapsuleCollider>();
            col.center = new Vector3(0, 1.9f, 0); col.radius = 0.6f; col.height = 2.5f;
            return v;
        }

        public void SetReady(bool ready)
        {
            if (_ready == ready) return;
            _ready = ready;
            _beaconMat.SetColor("_GlowColor", ready ? Colors.Pink : new Color(0.55f, 0.57f, 0.72f));
            _beaconMat.SetFloat("_Strength", ready ? 0.4f : 0.15f);
        }

        protected override void Update()
        {
            base.Update();
            _stone.localRotation = Quaternion.Euler(-70f, Time.time * (_ready ? 60f : 12f), 0);
            _stone.localPosition = new Vector3(0, 1.9f + Mathf.Sin(Time.time * 2f) * 0.08f, 0);
        }
    }

    /// <summary>
    /// A Rune Circle: seven carved standing stones around a low dais, the Keeper Kiki on the dais, a swirling portal
    /// above, a ring of UV light on the ground and a column of light rising from the portal. Faster and bigger during
    /// a Portal Surge.
    /// </summary>
    public sealed class CircleWorldView : WorldView
    {
        PortalView _portal;
        Camera _cam;
        Transform _beacon;
        KikiRig _keeper;
        string _keeperId;
        bool _surge;

        public const float Radius = 2.6f;

        public static CircleWorldView Make(Transform parent, WorldThing t, Camera cam, VariantLibrary lib)
        {
            var go = new GameObject("RuneCircle_" + t.Id);
            go.transform.SetParent(parent, false);
            var v = go.AddComponent<CircleWorldView>();
            v.Thing = t; v._cam = cam;

            var stoneMesh = ArtBridge.Cached("StandingStone", Core.Art.KikiGeometry.StandingStone);
            var stoneMat = Materials.StandingStone();
            const int n = 7;
            for (int i = 0; i < n; i++)
            {
                float a = i / (float)n * Mathf.PI * 2 + 0.2f;
                float h = 1.3f * (0.9f + 0.2f * ((i * 37) % 7) / 7f);
                var s = Part("Stone" + i, go.transform, stoneMesh, stoneMat, new Vector3(Mathf.Cos(a) * Radius, h * 0.43f, Mathf.Sin(a) * Radius));
                s.transform.localScale = Vector3.one * (h / 2f);
                s.transform.localRotation = Quaternion.Euler(0, -a * Mathf.Rad2Deg + 90f, ((i * 53) % 9 - 4) * 0.7f);
            }
            Part("Dais", go.transform, Cylinder(1.15f, 1.0f, 0.16f, "Dais"), Materials.Plush(Colors.Hex(0x3D4275), roughness: 0.8f, rim: 0.15f), Vector3.zero);
            var ring = Part("GlowRing", go.transform, MeshUtil.Ring(3.15f, 3.32f, 96, "CircleRing"), Materials.Unlit(new Color(0.48f, 0f, 1f, 0.85f)), new Vector3(0, 0.02f, 0));
            ring.transform.localRotation = Quaternion.Euler(90, 0, 0);

            v._portal = PortalView.Make(go.transform, cam);
            v._portal.transform.localPosition = new Vector3(0, 2.25f, 0);
            v._portal.Size = 1.9f;
            v._portal.Open();
            v._beacon = Beacon(go.transform, Colors.UvPurple, 16f, 0.5f, 0.6f, 2.25f);

            var col = go.AddComponent<CapsuleCollider>();
            col.center = new Vector3(0, 1.4f, 0); col.radius = Radius + 0.4f; col.height = 3f;
            v.SetKeeper(t, lib);
            return v;
        }

        public void SetKeeper(WorldThing t, VariantLibrary lib)
        {
            Thing = t;
            if (_keeperId == t.Variant.Id && _keeper != null) return;
            if (_keeper) Destroy(_keeper.gameObject);
            _keeperId = t.Variant.Id;
            _keeper = KikiFactory.Build(t.Variant.Id, lib.Look(t.Variant.Id), transform, 0.65f);
            _keeper.transform.localPosition = new Vector3(0, 0.16f, 0);
            _keeper.gameObject.AddComponent<KikiMotion>();
        }

        public void SetSurge(bool surge)
        {
            if (_surge == surge) return;
            _surge = surge;
            _portal.Size = surge ? 2.8f : 1.9f;
            _portal.Pull(surge ? 0.8f : 0f);
            _portal.Snap(1f);
        }

        protected override void Update()
        {
            base.Update();
            if (_cam && _keeper)
            {
                var d = _cam.transform.position - transform.position; d.y = 0;
                if (d.sqrMagnitude > 0.01f) _keeper.transform.rotation = Quaternion.LookRotation(d.normalized);
            }
            if (_surge && Random.value < Time.deltaTime * 6f)
                SparkleBurst.Spawn(_portal.transform.position + Random.insideUnitSphere * 0.8f, 3, Colors.UvPurple, 0.08f, _cam, 0.6f, 0.8f);
        }
    }
}
