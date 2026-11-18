using System.Collections;
using KikiSafari.Core;
using UnityEngine;

namespace KikiSafari
{
    /// <summary>
    /// The Rune Stone (owner's call): a smooth slate-indigo river stone with Kiki's spiral carved into both faces,
    /// glowing UV purple, with a screen-blend halo. Thrown at Kiki, it opens a portal that sucks him inside.
    /// </summary>
    public sealed class RuneStone : MonoBehaviour
    {
        public const float Radius = 0.04f;
        Transform _body;
        Material _stoneMat, _haloMat;
        float _boost;

        /// <summary>The stone mesh, for tumbling and wobbling without moving the stone's position.</summary>
        public Transform Body => _body;

        public static RuneStone Make(Transform parent)
        {
            var go = new GameObject("RuneStone");
            go.transform.SetParent(parent, false);
            var rs = go.AddComponent<RuneStone>();
            rs._body = new GameObject("Stone").transform;
            rs._body.SetParent(go.transform, false);
            // A flattened river pebble (shared art code); the carved spiral faces are its top and bottom.
            var mesh = ArtBridge.Cached("RuneStone", () => Core.Art.KikiGeometry.RuneStone(Radius));
            rs._body.gameObject.AddComponent<MeshFilter>().sharedMesh = mesh;
            rs._stoneMat = Materials.RuneStone(Radius);
            rs._body.gameObject.AddComponent<MeshRenderer>().sharedMaterial = rs._stoneMat;
            var halo = new GameObject("Halo");
            halo.transform.SetParent(rs._body, false);
            halo.transform.localScale = Vector3.one * 1.45f;
            halo.AddComponent<MeshFilter>().sharedMesh = mesh;
            rs._haloMat = Materials.Glow(0.7f, 1.8f);
            halo.AddComponent<MeshRenderer>().sharedMaterial = rs._haloMat;
            return rs;
        }

        /// <summary>A burst of rune light (sealing, each wobble's knock).</summary>
        public void Flash(float amount = 2.5f) => _boost = Mathf.Max(_boost, amount);

        void Update()
        {
            _boost = Mathf.MoveTowards(_boost, 0f, Time.deltaTime * 4f);
            float beat = 0.5f + 0.5f * Mathf.Sin(Time.time * Mathf.PI * 2 * 70f / 60f);
            _stoneMat.SetFloat("_Glow", 1.0f + 0.4f * beat + _boost);
            _haloMat.SetFloat("_Intensity", 0.6f + 0.25f * beat + _boost * 0.6f);
        }
    }

    /// <summary>
    /// The capture portal: a dark void with a swirling UV-purple vortex on top (screen blend). Always faces the camera.
    /// </summary>
    public sealed class PortalView : MonoBehaviour
    {
        Transform _disc;
        Camera _cam;
        Material _vortex, _void;
        float _open, _target, _speedBoost;
        public float Size = 0.55f;

        public float Openness => _open;

        public static PortalView Make(Transform parent, Camera cam)
        {
            var go = new GameObject("Portal");
            go.transform.SetParent(parent, false);
            var p = go.AddComponent<PortalView>();
            p._cam = cam;
            p._disc = new GameObject("Disc").transform;
            p._disc.SetParent(go.transform, false);
            var quad = Quad();
            p._void = Materials.Unlit(Color.white, TextureUtil.PortalVoid());
            var v = new GameObject("Void");
            v.transform.SetParent(p._disc, false);
            v.AddComponent<MeshFilter>().sharedMesh = quad;
            v.AddComponent<MeshRenderer>().sharedMaterial = p._void;
            p._vortex = Materials.Portal();
            var vx = new GameObject("Vortex");
            vx.transform.SetParent(p._disc, false);
            vx.transform.localPosition = new Vector3(0, 0, -0.002f);
            vx.AddComponent<MeshFilter>().sharedMesh = quad;
            vx.AddComponent<MeshRenderer>().sharedMaterial = p._vortex;
            p._disc.localScale = Vector3.zero;
            return p;
        }

        static Mesh _quadMesh;
        static Mesh Quad()
        {
            if (_quadMesh != null) return _quadMesh;
            _quadMesh = new Mesh { name = "PortalQuad" };
            _quadMesh.SetVertices(new[] { new Vector3(-0.5f, -0.5f), new Vector3(0.5f, -0.5f), new Vector3(0.5f, 0.5f), new Vector3(-0.5f, 0.5f) });
            _quadMesh.SetUVs(0, new[] { new Vector2(0, 0), new Vector2(1, 0), new Vector2(1, 1), new Vector2(0, 1) });
            _quadMesh.SetColors(new[] { Color.white, Color.white, Color.white, Color.white });
            _quadMesh.SetNormals(new[] { Vector3.back, Vector3.back, Vector3.back, Vector3.back });
            _quadMesh.SetTriangles(new[] { 0, 2, 1, 0, 3, 2 }, 0);
            return _quadMesh;
        }

        public void Open() { _target = 1f; _speedBoost = 0f; }
        public void Close() => _target = 0f;
        /// <summary>Spin the vortex faster while it pulls.</summary>
        public void Pull(float amount) => _speedBoost = amount;
        public void Snap(float openness) { _open = _target = openness; Apply(); }

        void Update()
        {
            float rate = _target > _open ? 3.2f : 4.5f;
            _open = Mathf.MoveTowards(_open, _target, Time.deltaTime * rate);
            Apply();
        }

        void Apply()
        {
            float s = _target >= _open ? Util.EaseOutBack(_open) : _open * _open;
            _disc.localScale = Vector3.one * Size * s;
            _vortex.SetFloat("_Speed", 3f + _speedBoost * 6f);
            _vortex.SetFloat("_Pull", 1.5f + _speedBoost * 3f);
            _vortex.SetFloat("_Intensity", 1.15f + _speedBoost * 0.5f);
        }

        void LateUpdate()
        {
            if (_cam) transform.rotation = Quaternion.LookRotation(transform.position - _cam.transform.position, Vector3.up);
        }
    }

    /// <summary>
    /// The timing ring around Kiki. It only shows the target size: smaller is better, but it never rates the throw
    /// (no spoilers). Drawn as a billboard so it always faces the camera.
    /// </summary>
    public sealed class TimingRingView : MonoBehaviour
    {
        Transform _scaler;
        Camera _cam;
        public float MinRadius = 0.08f, MaxRadius = 0.32f;
        public float Scale01 { get; private set; } = 1f;

        public static TimingRingView Make(Transform parent, Rarity rarity, Camera cam)
        {
            var go = new GameObject("TimingRing");
            go.transform.SetParent(parent, false);
            var view = go.AddComponent<TimingRingView>();
            view._cam = cam;
            view._scaler = new GameObject("Scaler").transform;
            view._scaler.SetParent(go.transform, false);
            AddRing(view._scaler, 0.86f, 1.14f, Colors.Navy, 0f);
            AddRing(view._scaler, 0.92f, 1.08f, Colors.RarityMain(rarity), -0.0015f);
            return view;
        }

        static void AddRing(Transform parent, float inner, float outer, Color c, float z)
        {
            var go = new GameObject("Ring");
            go.transform.SetParent(parent, false);
            go.transform.localPosition = new Vector3(0, 0, z);
            go.AddComponent<MeshFilter>().sharedMesh = MeshUtil.Ring(inner, outer, 72, "TimingRing");
            go.AddComponent<MeshRenderer>().sharedMaterial = Materials.Unlit(c);
        }

        public void SetScale(float s01)
        {
            Scale01 = s01;
            float r = Mathf.Lerp(MinRadius, MaxRadius, s01);
            // Ring thickness stays constant on screen-ish by scaling X/Y only and keeping a fixed width band.
            _scaler.localScale = new Vector3(r, r, 1f);
        }

        void LateUpdate()
        {
            if (_cam == null) return;
            transform.rotation = Quaternion.LookRotation(transform.position - _cam.transform.position, Vector3.up);
        }
    }

    /// <summary>Tiny additive star sprites that fly out and fade. Used for hits, bursts and pickups.</summary>
    public sealed class SparkleBurst : MonoBehaviour
    {
        Transform[] _stars;
        Vector3[] _vel;
        float _life, _age, _size;
        Camera _cam;
        Material _mat;
        Color _color;

        static Mesh _quad;

        Vector3 _sink;
        bool _implode;

        /// <summary>Purple energy streaming inward to a point (the portal's pull).</summary>
        public static void Implode(Vector3 sink, float radius, int count, Color color, float size, Camera cam, float life = 0.8f)
        {
            Spawn(sink, count, color, size, cam, 0f, life);
            var b = _last;
            b._implode = true;
            b._sink = sink;
            for (int i = 0; i < b._stars.Length; i++)
            {
                var off = Random.onUnitSphere * radius * Random.Range(0.6f, 1f);
                b._stars[i].position = sink + off;
                // Tangential swirl plus inward pull.
                b._vel[i] = Vector3.Cross(off, Vector3.up).normalized * radius * 1.5f;
            }
        }

        static SparkleBurst _last;

        public static void Spawn(Vector3 at, int count, Color color, float size, Camera cam, float speed = 0.6f, float life = 0.7f)
        {
            if (_quad == null)
            {
                _quad = new Mesh { name = "SparkleQuad" };
                _quad.SetVertices(new[] { new Vector3(-0.5f, -0.5f), new Vector3(0.5f, -0.5f), new Vector3(0.5f, 0.5f), new Vector3(-0.5f, 0.5f) });
                _quad.SetUVs(0, new[] { new Vector2(0, 0), new Vector2(1, 0), new Vector2(1, 1), new Vector2(0, 1) });
                _quad.SetColors(new[] { Color.white, Color.white, Color.white, Color.white });
                _quad.SetTriangles(new[] { 0, 2, 1, 0, 3, 2 }, 0);
            }
            var go = new GameObject("Sparkles");
            go.transform.position = at;
            var b = go.AddComponent<SparkleBurst>();
            b._cam = cam;
            b._life = life;
            b._size = size;
            b._color = color;
            b._mat = Materials.Unlit(color, TextureUtil.Sparkle(), additive: true);
            _last = b;
            b._stars = new Transform[count];
            b._vel = new Vector3[count];
            for (int i = 0; i < count; i++)
            {
                var s = new GameObject("Star");
                s.transform.SetParent(go.transform, false);
                s.AddComponent<MeshFilter>().sharedMesh = _quad;
                s.AddComponent<MeshRenderer>().sharedMaterial = b._mat;
                b._stars[i] = s.transform;
                b._vel[i] = Random.onUnitSphere * speed * Random.Range(0.4f, 1f) + Vector3.up * speed * 0.3f;
            }
        }

        void Update()
        {
            _age += Time.deltaTime;
            float k = _age / _life;
            if (k >= 1f) { Destroy(_mat); Destroy(gameObject); return; }
            var c = _color; c.a = 1f - k * k;
            _mat.SetColor("_Color", c);
            for (int i = 0; i < _stars.Length; i++)
            {
                if (_implode)
                {
                    var toSink = _sink - _stars[i].position;
                    _vel[i] += toSink * (18f * Time.deltaTime);
                    _vel[i] *= 1f - Time.deltaTime * 3f;
                }
                else _vel[i] *= 1f - Time.deltaTime * 2.5f;
                _stars[i].position += _vel[i] * Time.deltaTime;
                if (_cam) _stars[i].rotation = Quaternion.LookRotation(_stars[i].position - _cam.transform.position) * Quaternion.Euler(0, 0, _age * 180f + i * 37f);
                _stars[i].localScale = Vector3.one * _size * (1f - k * 0.6f);
            }
        }
    }
}
