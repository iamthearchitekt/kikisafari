using System.Collections;
using KikiSafari.Core;
using UnityEngine;

namespace KikiSafari
{
    public enum KikiDance { SpinJump, TripleBounceFlip, WiggleDance, TiptoeTwirl, JellyPancake }

    /// <summary>
    /// Procedural idles and celebration dances (treatment section 3, "How he moves"). Bouncy squash and stretch: every
    /// landing squashes him and every jump stretches him tall. Picks at random with slight random height, tempo and
    /// direction so no two look the same. Reduced motion drops the spins and shrinks the moves.
    /// </summary>
    [RequireComponent(typeof(KikiRig))]
    public sealed class KikiMotion : MonoBehaviour
    {
        public bool Idling = true;

        KikiRig _rig;
        Coroutine _current;
        readonly IRandom _rng = new SystemRandom();
        float _nextIdle;
        Quaternion _rightRest, _leftRest;
        /// <summary>Old animations were authored for a body 1.2 units tall; heights scale with the real model.</summary>
        static readonly float U = Core.Art.KikiGeometry.BodyHeight / 1.2f;
        Vector3 _shadowScale;

        public bool Busy => _current != null;

        void Awake()
        {
            _rig = GetComponent<KikiRig>();
            _rightRest = _rig.RightArm.localRotation;
            _leftRest = _rig.LeftArm.localRotation;
            if (_rig.Shadow) _shadowScale = _rig.Shadow.localScale;
            _nextIdle = Time.time + 0.5f;
        }

        void Update()
        {
            if (!Idling || _current != null) return;
            // Gentle breathing between idles.
            float b = Mathf.Sin(Time.time * 2.2f) * 0.015f * Amp;
            SetSquash(1f + b);
            if (Time.time >= _nextIdle)
            {
                Play(RandomIdle());
                _nextIdle = Time.time + Rand(1.6f, 3.4f);
            }
        }

        float Amp => Accessibility.ReducedMotion ? 0.5f : 1f;
        float Rand(float a, float b) => a + (float)_rng.NextDouble() * (b - a);
        float Vary => Rand(0.85f, 1.15f);
        float Dir => _rng.NextDouble() < 0.5 ? -1f : 1f;

        public void Play(IEnumerator routine)
        {
            Stop();
            _current = StartCoroutine(Run(routine));
        }

        public void Stop()
        {
            if (_current != null) StopCoroutine(_current);
            _current = null;
            ResetPose();
        }

        IEnumerator Run(IEnumerator routine)
        {
            yield return routine;
            ResetPose();
            _current = null;
        }

        public void ResetPose()
        {
            if (_rig == null) return;
            _rig.Motion.localPosition = Vector3.zero;
            _rig.Motion.localRotation = Quaternion.identity;
            _rig.Flip.localRotation = Quaternion.identity;
            SetSquash(1f);
            _rig.RightArm.localRotation = _rightRest;
            _rig.LeftArm.localRotation = _leftRest;
            SetHop(0f);
        }

        /// <summary>Volume-preserving squash: s &gt; 1 stretches tall, s &lt; 1 squashes flat.</summary>
        void SetSquash(float s)
        {
            s = Mathf.Max(0.1f, s);
            float w = 1f / Mathf.Sqrt(s);
            _rig.Squash.localScale = new Vector3(w, s, w);
        }

        void SetHop(float h)
        {
            var p = _rig.Motion.localPosition; p.y = h; _rig.Motion.localPosition = p;
            if (_rig.Shadow) _rig.Shadow.localScale = _shadowScale * Mathf.Lerp(1f, 0.6f, Mathf.Clamp01(h / (0.8f * U)));
        }

        /// <summary>
        /// Poses both arms by how far each is raised: degrees above horizontal, pointing outward (90 = straight up,
        /// 0 = out to the side, -60 = down). RightArm is on +X, LeftArm on -X.
        /// </summary>
        void Arms(float rightRaise, float leftRaise)
        {
            _rig.RightArm.localRotation = Quaternion.Euler(0, 0, rightRaise - 90f);
            _rig.LeftArm.localRotation = Quaternion.Euler(0, 0, 90f - leftRaise);
        }

        void RightArmRaise(float raise) => _rig.RightArm.localRotation = Quaternion.Euler(0, 0, raise - 90f);

        // ---------- Idles ----------

        public IEnumerator RandomIdle()
        {
            switch (_rng.Next(0, 4))
            {
                case 0: return Rock();
                case 1: return TinyHops();
                case 2: return Wave();
                default: return LookAround();
            }
        }

        IEnumerator Rock()
        {
            float dur = 1.6f * Vary, amp = 7f * Amp * Vary, dir = Dir;
            for (float t = 0; t < dur; t += Time.deltaTime)
            {
                float k = Mathf.Sin(t / dur * Mathf.PI * 4) * Mathf.Sin(t / dur * Mathf.PI);
                _rig.Motion.localRotation = Quaternion.Euler(0, 0, k * amp * dir);
                yield return null;
            }
        }

        IEnumerator TinyHops()
        {
            int hops = _rng.Next(2, 4);
            for (int i = 0; i < hops; i++) yield return Hop(0.12f * U * Amp * Vary, 0.32f * Vary, 0.12f);
        }

        IEnumerator Wave()
        {
            // His signature pose: one arm raised in a wave, the other resting. Wave it a little higher, then settle.
            float dur = 1.5f * Vary;
            float rest = 90f + _rightRest.eulerAngles.z; // resting raise of the +X arm
            if (rest > 180f) rest -= 360f;
            for (float t = 0; t < dur; t += Time.deltaTime)
            {
                float up = Mathf.SmoothStep(0, 1, Mathf.Min(1, t / 0.25f)) * Mathf.SmoothStep(0, 1, Mathf.Min(1, (dur - t) / 0.25f));
                float wave = Mathf.Sin(t * 14f) * 16f * Amp;
                RightArmRaise(Mathf.Lerp(rest, 75f + wave, up));
                _rig.Motion.localRotation = Quaternion.Euler(0, 0, 3f * up);
                yield return null;
            }
        }

        IEnumerator LookAround()
        {
            float dur = 2.2f * Vary, amp = 22f * Amp, dir = Dir;
            for (float t = 0; t < dur; t += Time.deltaTime)
            {
                float k = Mathf.Sin(t / dur * Mathf.PI * 2) * dir;
                _rig.Motion.localRotation = Quaternion.Euler(0, k * amp, k * 3f);
                yield return null;
            }
        }

        // ---------- Building blocks ----------

        /// <summary>Crouch (squash), leap (stretch), land (squash), recover.</summary>
        IEnumerator Hop(float height, float airTime, float crouch, System.Action<float> duringAir = null)
        {
            for (float t = 0; t < crouch; t += Time.deltaTime) { SetSquash(1f - 0.18f * Amp * (t / crouch)); yield return null; }
            for (float t = 0; t < airTime; t += Time.deltaTime)
            {
                float k = t / airTime;
                SetHop(4f * height * k * (1 - k));
                SetSquash(1f + 0.16f * Amp * (1 - Mathf.Abs(k * 2 - 1)));
                duringAir?.Invoke(k);
                yield return null;
            }
            SetHop(0f);
            duringAir?.Invoke(1f);
            for (float t = 0; t < 0.22f; t += Time.deltaTime) { SetSquash(1f - 0.22f * Amp * Util.Wobble(t / 0.22f, 1.2f, 3f)); yield return null; }
            SetSquash(1f);
        }

        // ---------- Celebration dances ----------

        public IEnumerator Dance(KikiDance d)
        {
            switch (d)
            {
                case KikiDance.SpinJump: return SpinJump();
                case KikiDance.TripleBounceFlip: return TripleBounceFlip();
                case KikiDance.WiggleDance: return Wiggle();
                case KikiDance.TiptoeTwirl: return TiptoeTwirl();
                default: return JellyPancake();
            }
        }

        public KikiDance RandomDance()
        {
            if (Accessibility.ReducedMotion)
                return _rng.NextDouble() < 0.5 ? KikiDance.WiggleDance : KikiDance.JellyPancake;
            return (KikiDance)_rng.Next(0, 5);
        }

        IEnumerator SpinJump()
        {
            // Crouch, leap with a full spin, arms flapping.
            float dir = Dir;
            yield return Hop(0.75f * U * Vary, 0.7f * Vary, 0.18f, k =>
            {
                _rig.Motion.localRotation = Quaternion.Euler(0, 360f * Util.EaseInOut(k) * dir, 0);
                float flap = Mathf.Sin(k * Mathf.PI * 8) * 35f;
                Arms(35f + flap, 35f + flap);
            });
        }

        IEnumerator TripleBounceFlip()
        {
            // Three bounces, the last with a flip.
            yield return Hop(0.25f * U * Vary, 0.32f, 0.1f);
            yield return Hop(0.3f * U * Vary, 0.34f, 0.08f);
            float dir = Dir;
            yield return Hop(0.8f * U * Vary, 0.75f, 0.14f, k =>
            {
                _rig.Flip.localRotation = Quaternion.Euler(-360f * Util.EaseInOut(k) * dir, 0, 0);
                Arms(75f, 75f);
            });
        }

        IEnumerator Wiggle()
        {
            // Side-to-side hip wiggle, arms waving.
            float dur = 1.8f * Vary, speed = 9f * Vary, amp = Amp;
            for (float t = 0; t < dur; t += Time.deltaTime)
            {
                float s = Mathf.Sin(t * speed);
                _rig.Motion.localPosition = new Vector3(s * 0.06f * U * amp, 0, 0);
                _rig.Motion.localRotation = Quaternion.Euler(0, 0, -s * 10f * amp);
                float wave = Mathf.Sin(t * speed * 2) * 40f * amp;
                Arms(30f + wave, 30f - wave);
                SetSquash(1f + Mathf.Abs(s) * 0.05f * amp);
                yield return null;
            }
        }

        IEnumerator TiptoeTwirl()
        {
            // A slow ballerina spin on his toes.
            float dur = 2.0f * Vary, dir = Dir, turns = Rand(1f, 1.5f);
            for (float t = 0; t < dur; t += Time.deltaTime)
            {
                float k = t / dur;
                float up = Mathf.Sin(k * Mathf.PI);
                SetHop(0.05f * U * up);
                SetSquash(1f + 0.1f * up);
                _rig.Motion.localRotation = Quaternion.Euler(0, 360f * turns * Util.EaseInOut(k) * dir, 0);
                Arms(Mathf.Lerp(-30f, 80f, up), Mathf.Lerp(-30f, 80f, up));
                yield return null;
            }
        }

        IEnumerator JellyPancake()
        {
            // Flops flat like jelly, then springs back up.
            float amp = Amp;
            for (float t = 0; t < 0.3f; t += Time.deltaTime) { SetSquash(Mathf.Lerp(1f, 1f - 0.72f * amp, Util.EaseOutCubic(t / 0.3f))); Arms(Mathf.Lerp(-30, 0, t / 0.3f), Mathf.Lerp(-30, 0, t / 0.3f)); yield return null; }
            float hold = 0.35f * Vary;
            for (float t = 0; t < hold; t += Time.deltaTime) { SetSquash(1f - 0.72f * amp + Mathf.Sin(t * 30f) * 0.03f); yield return null; }
            yield return Hop(0.35f * U * Vary * amp, 0.45f, 0.02f, k => Arms(Mathf.Lerp(80, -30, k), Mathf.Lerp(80, -30, k)));
        }
    }
}
