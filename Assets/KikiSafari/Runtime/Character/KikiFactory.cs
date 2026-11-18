using KikiSafari.Core;
using KikiSafari.Core.Art;
using UnityEngine;

namespace KikiSafari
{
    /// <summary>Handles to a built Kiki's moving parts. Hierarchy: Root → Motion → Flip → Squash → parts.</summary>
    public sealed class KikiRig : MonoBehaviour
    {
        public string VariantId;
        /// <summary>Hops and whole-body yaw/tilt.</summary>
        public Transform Motion;
        /// <summary>Pivot at the body's centre, for flips and spins.</summary>
        public Transform Flip;
        /// <summary>Pivot at the feet, for squash and stretch.</summary>
        public Transform Squash;
        /// <summary>RightArm is on +X (the viewer's left, raised in his wave); LeftArm on -X.</summary>
        public Transform RightArm, LeftArm, Crown;
        public Transform Shadow;
        public GameObject GlowShell;
        /// <summary>Feet to the top of the egg in local units (the leaf crown adds about a third on top).</summary>
        public float BodyHeight = KikiGeometry.BodyHeight;

        public float WorldHeight => BodyHeight * transform.lossyScale.y;
        public Vector3 WorldCenter => transform.TransformPoint(new Vector3(0, KikiGeometry.GroundOffset, 0));

        public void SetVisible(bool v)
        {
            foreach (var r in GetComponentsInChildren<Renderer>(true)) r.enabled = v;
        }
    }

    /// <summary>
    /// Builds Kiki from the shared art code (Core/Art), which ports the claw game's makeMascot: egg body, chubby arms,
    /// feet, the leaf tuft, the painted face and the plush normal map. Swap for the official GLB when it arrives.
    /// </summary>
    public static class KikiFactory
    {
        /// <summary>Real-world height of a canon Kiki's body (feet to top of head, no leaves) in AR, in metres.</summary>
        public const float RealHeightMeters = 0.42f;

        public static KikiRig Build(string variantId, KikiLookSpec look, Transform parent = null, float realHeight = RealHeightMeters)
        {
            look ??= KikiLookSpec.For(variantId);
            var root = new GameObject("Kiki_" + variantId);
            if (parent != null) root.transform.SetParent(parent, false);
            root.transform.localScale = Vector3.one * (realHeight / KikiGeometry.BodyHeight * Mathf.Max(0.3f, look.Scale));

            var rig = root.AddComponent<KikiRig>();
            rig.VariantId = variantId;
            rig.Motion = Child("Motion", root.transform, Vector3.zero);
            rig.Flip = Child("Flip", rig.Motion, new Vector3(0, KikiGeometry.GroundOffset, 0));
            rig.Squash = Child("Squash", rig.Flip, new Vector3(0, -KikiGeometry.GroundOffset, 0));

            var bodyColor = Colors.Hex(look.BodyColor);
            var bodyMat = Materials.Plush(Color.white, ArtBridge.BodyAlbedo(look), normal: ArtBridge.BodyNormal(look));
            var limbMat = Materials.Plush(bodyColor);
            var leafMat = Materials.Plush(Color.white, roughness: 0.28f, specular: 0.05f, rim: 0.3f);

            var bodyMesh = ArtBridge.Cached("KikiBody", KikiGeometry.Body);
            Part("Body", rig.Squash, bodyMesh, bodyMat);
            Part("Feet", rig.Squash, ArtBridge.Cached("KikiFeet", KikiGeometry.Feet), limbMat);

            var armMesh = ArtBridge.Cached("KikiArm", KikiGeometry.Arm);
            var arms = KikiGeometry.Arms();
            rig.RightArm = Child("RightArmPivot", rig.Squash, ToV(arms[0].Pivot));
            rig.RightArm.localRotation = Quaternion.Euler(0, 0, arms[0].RestZ);
            Part("RightArm", rig.RightArm, armMesh, limbMat);
            rig.LeftArm = Child("LeftArmPivot", rig.Squash, ToV(arms[1].Pivot));
            rig.LeftArm.localRotation = Quaternion.Euler(0, 0, arms[1].RestZ);
            Part("LeftArm", rig.LeftArm, armMesh, limbMat);

            var crownMesh = ArtBridge.Cached("KikiCrown_" + variantId, () => KikiGeometry.Crown(look, ArtSeed.Of(variantId)));
            rig.Crown = Part("Crown", rig.Squash, crownMesh, leafMat).transform;

            if (look.UvGlow)
            {
                // Back-face halo shell (see UVGlow.shader): only a soft purple halo shows around the silhouette.
                var shell = Part("GlowShell", rig.Squash, bodyMesh, Materials.Glow(1.4f, 2.2f));
                shell.transform.localScale = new Vector3(1.22f, 1.14f, 1.22f);
                shell.transform.localPosition = new Vector3(0, -0.18f, 0);
                shell.AddComponent<GlowPulse>();
                rig.GlowShell = shell;
            }

            // Soft blob shadow stays on the ground (outside Motion) so hops read clearly in AR.
            var shadowMat = Materials.Unlit(new Color(0.05f, 0.04f, 0.15f, 0.42f), TextureUtil.RadialBlob());
            rig.Shadow = Part("Shadow", root.transform, MeshUtil.GroundQuad(2.7f, 2.1f, 1f, "KikiShadow"), shadowMat).transform;
            rig.Shadow.localPosition = new Vector3(0, 0.008f, 0);

            var col = root.AddComponent<SphereCollider>();
            col.center = new Vector3(0, KikiGeometry.GroundOffset, 0);
            col.radius = 1.35f;

            foreach (var r in root.GetComponentsInChildren<MeshRenderer>())
            {
                r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                r.receiveShadows = false;
            }
            return rig;
        }

        static Vector3 ToV(V3 v) => new Vector3(v.X, v.Y, v.Z);

        static Transform Child(string name, Transform parent, Vector3 localPos)
        {
            var t = new GameObject(name).transform;
            t.SetParent(parent, false);
            t.localPosition = localPos;
            return t;
        }

        static GameObject Part(string name, Transform parent, Mesh mesh, Material mat)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.AddComponent<MeshFilter>().sharedMesh = mesh;
            go.AddComponent<MeshRenderer>().sharedMaterial = mat;
            return go;
        }
    }

    /// <summary>Gentle pulse on a UV glow, like it's breathing to a bass line.</summary>
    public sealed class GlowPulse : MonoBehaviour
    {
        Material _m;
        float _base;
        void Awake() { var r = GetComponent<Renderer>(); if (r) { _m = r.material; _base = _m.GetFloat("_Intensity"); } }
        void Update()
        {
            if (_m == null) return;
            float beat = 0.5f + 0.5f * Mathf.Sin(Time.time * Mathf.PI * 2 * 70f / 60f);
            _m.SetFloat("_Intensity", _base * (0.85f + 0.3f * beat * (Accessibility.ReducedMotion ? 0.3f : 1f)));
        }
    }
}
