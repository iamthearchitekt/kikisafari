using System;
using System.Collections;
using System.Collections.Generic;
using KikiSafari.Core;
using KikiSafari.Core.Art;
using UnityEngine;
using UnityEngine.InputSystem;

namespace KikiSafari
{
    public enum EncounterExit { Caught, Left, OutOfStones }

    /// <summary>Decides a throw's outcome. Demo: on the phone. Live: the server (queued while offline).</summary>
    public interface ICatchResolver
    {
        void Resolve(VariantDef variant, ThrowReport report, Action<CatchOutcome> done);
    }

    public sealed class LocalCatchResolver : ICatchResolver
    {
        readonly IRandom _rng = new SystemRandom();
        public void Resolve(VariantDef variant, ThrowReport report, Action<CatchOutcome> done)
            => done(CatchMath.Resolve(variant.Rarity, report, _rng, TuningStore.Current.CatchOdds));
    }

    /// <summary>
    /// The AR encounter (decisions doc, section 7, with the owner's Rune Stone and portal). Flick the Rune Stone from the
    /// bottom centre (or tap "Tap to throw"); on a hit a UV-purple portal opens, sucks Kiki in and seals into the stone,
    /// which wobbles once per rarity step, then bursts (catch) or blasts open (breakout). Kiki never runs away.
    /// </summary>
    public sealed class EncounterController : MonoBehaviour
    {
        enum State { Placing, Ready, Dragging, Flying, Resolving, Revealing, OutOfStones, Done }

        const float HandDepth = 0.32f;
        const float FlickMinScreensPerSecond = 0.55f;
        const float SpinDegreesNeeded = 540f;

        GameRoot _game;
        VariantDef _def;
        KikiLookSpec _look;
        Action<EncounterExit> _onExit;
        ICatchResolver _resolver;

        IEncounterStage _stage;
        Transform _world;
        KikiRig _kiki;
        KikiMotion _motion;
        TimingRingView _ring;
        RuneStone _stone;
        PortalView _portal;
        EncounterHud _hud;
        RevealScreen _reveal;

        State _state;
        float _ringClock;
        bool _taughtThrow;
        Vector3 _kikiHome;
        float _groundY;

        // Flight
        Vector3 _pos, _vel;
        float _flightTime, _releaseRing;
        bool _spin;
        // Drag
        readonly List<(Vector2 p, float t)> _samples = new List<(Vector2, float)>();
        float _spinAngle;
        Vector2 _lastDir;
        bool _spinAnnounced;

        Camera Cam => _stage.Camera;
        TuningValues Tune => TuningStore.Current;

        bool _keepStage;

        /// <param name="keepStage">Leave the AR session running afterwards (the camera world view continues).</param>
        public static EncounterController Begin(GameRoot game, IEncounterStage stage, string variantId, ICatchResolver resolver, Action<EncounterExit> onExit, bool keepStage = false)
        {
            var go = new GameObject("Encounter_" + variantId);
            var c = go.AddComponent<EncounterController>();
            c._game = game;
            c._stage = stage;
            c._def = game.Library.Def(variantId);
            c._look = game.Library.Look(variantId);
            c._resolver = resolver ?? new LocalCatchResolver();
            c._onExit = onExit;
            c._keepStage = keepStage;
            c.Setup();
            return c;
        }

        void Setup()
        {
            if (_stage is ARStage ar && ar.Active) { ar.ResetPlacement(); ar.SetOcclusion(true); }
            else _stage.SetActive(true);
            _world = new GameObject("World").transform;
            _world.SetParent(transform, false);
            _hud = EncounterHud.Make(transform, _def, OnLeave, OnTapThrow);
            _hud.SetStones(_game.Progress.Stones);
            _hud.SetHint(_stage.Hint ?? "");
            _state = State.Placing;
        }

        void OnDestroy()
        {
            if (_hud) Destroy(_hud.gameObject);
            if (_reveal) Destroy(_reveal.gameObject);
        }

        void Place()
        {
            var pose = _stage.Placement;
            _world.SetPositionAndRotation(pose.position, Quaternion.identity);
            _groundY = pose.position.y;
            _kiki = KikiFactory.Build(_def.Id, _look, _world);
            _kiki.transform.localPosition = Vector3.zero;
            _kikiHome = _kiki.transform.position;
            _motion = _kiki.gameObject.AddComponent<KikiMotion>();
            FaceCamera(_kiki.transform);

            _ring = TimingRingView.Make(_world, _def.Rarity, Cam);
            _ring.transform.position = _kiki.WorldCenter;
            _ring.MaxRadius = 0.3f * _look.Scale;
            _ring.MinRadius = 0.07f * _look.Scale;

            _portal = PortalView.Make(_world, Cam);
            _portal.Size = 0.62f * _look.Scale;
            _stone = RuneStone.Make(transform);
            _stone.gameObject.SetActive(false);

            // Kiki appears with a little hop so the player sees where he is.
            _motion.Play(PopIn());
            SfxPlayer.Instance?.Play(Sfx.Pickup, 0.4f);
            Haptics.Play(HapticKind.Light);
            ReadyNextStone();
        }

        IEnumerator PopIn()
        {
            var s = _kiki.transform.localScale;
            for (float t = 0; t < 0.45f; t += Time.deltaTime)
            {
                _kiki.transform.localScale = s * Util.EaseOutBack(t / 0.45f, 2.2f);
                yield return null;
            }
            _kiki.transform.localScale = s;
        }

        void ReadyNextStone()
        {
            _hud.SetStones(_game.Progress.Stones);
            if (_game.Progress.Stones <= 0)
            {
                _state = State.OutOfStones;
                _stone.gameObject.SetActive(false);
                _hud.ShowOutOfStones(() => Finish(EncounterExit.OutOfStones));
                return;
            }
            _state = State.Ready;
            _stone.gameObject.SetActive(true);
            _stone.transform.localScale = Vector3.one;
            _stone.Body.localRotation = Quaternion.identity;
            _hud.SetTapThrowEnabled(true);
            _hud.SetHint(_taughtThrow ? "" : "Flick the Rune Stone at Kiki!");
        }

        void Update()
        {
            _stage.Tick();
            if (_state == State.Placing)
            {
                _hud.SetHint(_stage.Hint ?? "");
                if (_stage.Ready) Place();
                return;
            }
            if (_state == State.Done || _kiki == null) return;

            // The ring keeps its rhythm; it only ever shows the target size.
            _ringClock += Time.deltaTime;
            if (_ring && _ring.gameObject.activeSelf)
            {
                _ring.SetScale(TimingRing.Scale(_ringClock, Tune.RingPeriod));
                _ring.transform.position = _kiki.WorldCenter;
            }
            if (_state == State.Ready || _state == State.Dragging || _state == State.Flying) FaceCamera(_kiki.transform);

            switch (_state)
            {
                case State.Ready: UpdateReady(); break;
                case State.Dragging: UpdateDrag(); break;
                case State.Flying: UpdateFlight(); break;
            }
            _hud.SetDebug(DebugFlags.ShowOverlay ? _stage.DebugInfo + $"\nring {_ring?.Scale01:0.00}  state {_state}" : null);
        }

        void FaceCamera(Transform t)
        {
            var d = Cam.transform.position - t.position;
            d.y = 0;
            if (d.sqrMagnitude > 1e-4f) t.rotation = Quaternion.LookRotation(d.normalized, Vector3.up);
        }

        Vector3 HandPosition => Cam.transform.TransformPoint(new Vector3(0, -0.105f, HandDepth));

        void UpdateReady()
        {
            _stone.transform.position = HandPosition;
            _stone.transform.rotation = Cam.transform.rotation * Quaternion.Euler(-60f, 0, 0);
            _stone.Body.localRotation = Quaternion.Euler(0, Time.time * 40f, 0);

            var p = Pointer.current;
            if (p == null || !p.press.wasPressedThisFrame) return;
            var pos = p.position.ReadValue();
            if (_hud.IsOverControl(pos)) return;
            var stoneScreen = (Vector2)Cam.WorldToScreenPoint(HandPosition);
            bool nearStone = (pos - stoneScreen).magnitude < Screen.height * 0.12f;
            bool bottomArea = pos.y < Screen.height * 0.35f;
            if (!nearStone && !bottomArea) return;
            _state = State.Dragging;
            _samples.Clear();
            _samples.Add((pos, Time.time));
            _spinAngle = 0; _lastDir = Vector2.zero; _spinAnnounced = false;
            Haptics.Play(HapticKind.Tick);
        }

        void UpdateDrag()
        {
            var p = Pointer.current;
            if (p == null) { _state = State.Ready; return; }
            var pos = p.position.ReadValue();
            float now = Time.time;
            var last = _samples[_samples.Count - 1].p;
            var delta = pos - last;
            if (delta.magnitude > 3f)
            {
                var dir = delta.normalized;
                if (_lastDir != Vector2.zero) _spinAngle += Vector2.SignedAngle(_lastDir, dir);
                _lastDir = dir;
                _samples.Add((pos, now));
                if (_samples.Count > 90) _samples.RemoveAt(0);
            }
            bool spinning = Mathf.Abs(_spinAngle) >= SpinDegreesNeeded;
            if (spinning && !_spinAnnounced)
            {
                _spinAnnounced = true;
                Haptics.Play(HapticKind.Light);
                SparkleBurst.Spawn(_stone.transform.position, 8, Colors.UvPurple, 0.02f, Cam, 0.15f, 0.4f);
            }
            // The stone follows the finger, spinning when the player circles it.
            var world = Cam.ScreenToWorldPoint(new Vector3(pos.x, pos.y, HandDepth));
            _stone.transform.position = world;
            _stone.Body.localRotation = Quaternion.Euler(0, (spinning ? 900f : 40f) * Time.time, 0);

            if (!p.press.isPressed) Release(pos, now, spinning);
        }

        void Release(Vector2 pos, float now, bool spinning)
        {
            // Velocity from the last ~0.1 s of the gesture.
            var first = _samples[0];
            for (int i = _samples.Count - 1; i >= 0; i--)
                if (now - _samples[i].t > 0.1f) { first = _samples[i]; break; }
            float dt = Mathf.Max(0.016f, now - first.t);
            var v = (pos - first.p) / dt;
            float vyN = v.y / Screen.height, vxN = v.x / Screen.height;
            if (vyN < FlickMinScreensPerSecond)
            {
                _state = State.Ready; // too gentle: the stone goes back to the hand, nothing used
                return;
            }
            float speed = Mathf.Clamp(vyN * 2.4f, 1.5f, 11f) * Tune.ThrowStrength;
            var cam = Cam.transform;
            var vel = cam.forward * speed + cam.up * (speed * 0.28f) + cam.right * (vxN * 2.4f * Tune.ThrowStrength);
            var origin = _stone.transform.position;
            var target = _kiki.WorldCenter;
            var assisted = ThrowMath.ApplyAimAssist(V(origin), V(target), V(vel), Tune.Gravity, Tune.AimAssist);
            Launch(origin, U(assisted), spinning);
        }

        void OnTapThrow()
        {
            if (_state != State.Ready) return;
            // Tap-to-throw: always available. A good arc with a little human error, less with more aim assist.
            var origin = _stone.transform.position;
            var target = _kiki.WorldCenter + UnityEngine.Random.insideUnitSphere * (0.05f * (1f - Tune.AimAssist));
            double t = ThrowMath.NaturalFlightTime(new Vector2(target.x - origin.x, target.z - origin.z).magnitude);
            var vel = ThrowMath.SolveForFlightTime(V(origin), V(target), Tune.Gravity, t);
            Launch(origin, U(vel), false);
        }

        void Launch(Vector3 origin, Vector3 vel, bool spin)
        {
            if (!_game.Progress.TryUseStone()) { ReadyNextStone(); return; }
            _game.SaveProgress();
            _hud.SetStones(_game.Progress.Stones);
            _hud.SetTapThrowEnabled(false);
            _hud.SetHint("");
            _taughtThrow = true;
            _releaseRing = _ring.Scale01;
            _spin = spin;
            _pos = origin; _vel = vel; _flightTime = 0;
            _state = State.Flying;
            SfxPlayer.Instance?.Play(Sfx.Throw, 0.45f);
            Haptics.Play(HapticKind.Light);
        }

        void UpdateFlight()
        {
            float dt = Time.deltaTime;
            _flightTime += dt;
            _vel += Vector3.down * Tune.Gravity * dt;
            _pos += _vel * dt;
            _stone.transform.position = _pos;
            _stone.Body.localRotation = Quaternion.Euler(_flightTime * 720f, (_spin ? 1400f : 200f) * _flightTime, 0);

            var center = _kiki.WorldCenter;
            if ((_pos - center).magnitude <= Tune.HitRadius * _look.Scale + RuneStone.Radius)
            {
                Resolve(true, _pos);
                return;
            }
            bool hitGround = _pos.y <= _groundY + RuneStone.Radius * 0.5f;
            bool gone = _flightTime > 2.5f || (_pos - Cam.transform.position).magnitude > 7f;
            if (hitGround || gone) Resolve(false, _pos);
        }

        void Resolve(bool hit, Vector3 at)
        {
            _state = State.Resolving;
            var report = new ThrowReport { Hit = hit, RingScale = _releaseRing, Spin = _spin };
            _resolver.Resolve(_def, report, outcome => StartCoroutine(Present(outcome, at)));
        }

        IEnumerator Present(CatchOutcome o, Vector3 at)
        {
            var steps = RevealTimeline.Build(o, _def.Rarity, new RevealOptions { ReducedMotion = Accessibility.ReducedMotion });
            bool first = !_game.Progress.HasCaught(_def.Id);
            if (o.Result == CatchResult.Caught)
            {
                var reward = CatchMath.Reward(_def.Rarity, o.Quality, o.Spin, first);
                _game.Progress.RecordCatch(_def.Id, Util.UnixNow(), reward.Total);
                _game.SaveProgress();
            }

            foreach (var step in steps)
            {
                if (step.Kind == RevealStepKind.AwaitKeepPlaying || step.Kind == RevealStepKind.RarityStamp) break; // the reveal screen takes over
                Haptics.Play(step.Haptic);
                SfxPlayer.Instance?.Play(step.Sfx, 0.5f);
                SfxPlayer.Instance?.PlayVoice(step.Voice, step.VoiceChance);
                yield return Beat(step, at);
            }

            if (o.Result == CatchResult.Caught)
            {
                _state = State.Revealing;
                _ring.gameObject.SetActive(false);
                _hud.gameObject.SetActive(false);
                var reward = CatchMath.Reward(_def.Rarity, o.Quality, o.Spin, first);
                _reveal = RevealScreen.Show(transform, _def, _look, o, reward, first, steps, () => Finish(EncounterExit.Caught));
                yield break;
            }

            // Breakout or miss: Kiki stays put. Next stone.
            _ring.gameObject.SetActive(true);
            if (_kiki) { _kiki.SetVisible(true); _motion.Idling = true; }
            ReadyNextStone();
        }

        /// <summary>Plays one beat's visuals for its duration. Every haptic above has a matching visual here.</summary>
        IEnumerator Beat(RevealStep step, Vector3 hitPoint)
        {
            float d = step.Duration;
            var center = _kiki.WorldCenter;
            var toCam = (Cam.transform.position - center); toCam.y = 0; toCam.Normalize();
            var portalPos = center - toCam * 0.06f + Vector3.up * 0.02f;
            var hoverPos = center + toCam * 0.14f;

            switch (step.Kind)
            {
                case RevealStepKind.HitSparkle:
                    _ring.gameObject.SetActive(false);
                    SparkleBurst.Spawn(hitPoint, 14, new Color(0.85f, 0.75f, 1f), 0.035f, Cam, 0.5f, 0.5f);
                    _stone.Flash(2f);
                    for (float t = 0; t < d; t += Time.deltaTime)
                    {
                        _stone.transform.position = Vector3.Lerp(hitPoint, hoverPos, Util.EaseOutCubic(t / d));
                        yield return null;
                    }
                    break;

                case RevealStepKind.PortalOpen:
                    _motion.Stop();
                    _motion.Idling = false;
                    _portal.transform.position = portalPos;
                    _portal.Open();
                    SparkleBurst.Spawn(portalPos, 10, Colors.UvPurple, 0.03f, Cam, 0.35f, 0.6f);
                    for (float t = 0; t < d; t += Time.deltaTime)
                    {
                        _stone.transform.position = hoverPos + Vector3.up * Mathf.Sin(t * 12f) * 0.006f;
                        _stone.Body.localRotation = Quaternion.Euler(-70f, t * 300f, 0); // spiral face toward Kiki
                        yield return null;
                    }
                    break;

                case RevealStepKind.SuckIn:
                {
                    _portal.Pull(1f);
                    SparkleBurst.Implode(portalPos, 0.35f * _look.Scale, 26, Colors.UvPurple, 0.028f, Cam, d);
                    SparkleBurst.Implode(portalPos, 0.25f * _look.Scale, 12, new Color(0.55f, 0.35f, 1f), 0.02f, Cam, d * 0.9f);
                    var kt = _kiki.transform;
                    var startPos = kt.position;
                    var startScale = kt.localScale;
                    var startRot = kt.rotation;
                    bool reduced = Accessibility.ReducedMotion;
                    for (float t = 0; t < d; t += Time.deltaTime)
                    {
                        float k = t / d, e = k * k * (3 - 2 * k);
                        // Pulled toward the portal's centre, stretched toward it, spinning faster as it shrinks.
                        kt.position = Vector3.Lerp(startPos, portalPos - Vector3.up * (KikiCenterOffset * (1 - e)), e);
                        float shrink = 1f - e * e;
                        kt.localScale = new Vector3(startScale.x * shrink * (1 - 0.25f * e), startScale.y * shrink * (1 + 0.35f * e), startScale.z * shrink);
                        if (!reduced) kt.rotation = startRot * Quaternion.AngleAxis(e * e * 540f, Vector3.forward);
                        _stone.transform.position = hoverPos + Vector3.up * Mathf.Sin(t * 20f) * 0.004f;
                        yield return null;
                    }
                    _kiki.SetVisible(false);
                    kt.SetPositionAndRotation(_kikiHome, startRot);
                    kt.localScale = startScale;
                    break;
                }

                case RevealStepKind.PortalSeal:
                    _portal.Close();
                    _stone.Flash(3.5f);
                    SparkleBurst.Implode(hoverPos, 0.12f, 14, Colors.UvPurple, 0.02f, Cam, d);
                    yield return Wait(d);
                    break;

                case RevealStepKind.StoneDrop:
                {
                    var from = _stone.transform.position;
                    var to = new Vector3(from.x, _groundY + RuneStone.Radius * 0.42f, from.z);
                    for (float t = 0; t < d; t += Time.deltaTime)
                    {
                        float k = t / d;
                        float bounce = k < 0.7f ? 0 : Mathf.Sin((k - 0.7f) / 0.3f * Mathf.PI) * 0.025f;
                        _stone.transform.position = Vector3.Lerp(from, to, Mathf.Min(1, k / 0.7f) * Mathf.Min(1, k / 0.7f)) + Vector3.up * bounce;
                        _stone.Body.localRotation = Quaternion.Slerp(_stone.Body.localRotation, Quaternion.identity, k);
                        yield return null;
                    }
                    _stone.transform.rotation = Quaternion.LookRotation(Vector3.ProjectOnPlane(-toCam, Vector3.up), Vector3.up);
                    break;
                }

                case RevealStepKind.Wobble:
                {
                    // Each wobble: a tilt one way and back, with a knock of rune light at the peak.
                    float amp = Accessibility.ReducedMotion ? 10f : 24f, dir = step.Index % 2 == 0 ? -1f : 1f;
                    for (float t = 0; t < d; t += Time.deltaTime)
                    {
                        float k = t / d;
                        float tilt = Mathf.Sin(k * Mathf.PI * 2f) * amp * dir * (k < 0.75f ? 1f : (1 - k) * 4f);
                        _stone.Body.localRotation = Quaternion.Euler(0, 0, tilt);
                        if (Mathf.Abs(k - 0.25f) < Time.deltaTime / d) _stone.Flash(1.6f);
                        yield return null;
                    }
                    _stone.Body.localRotation = Quaternion.identity;
                    yield return Wait(0.18f);
                    break;
                }

                case RevealStepKind.Burst:
                    _stone.Flash(4f);
                    SparkleBurst.Spawn(_stone.transform.position + Vector3.up * 0.03f, 30, Colors.UvPurple, 0.04f, Cam, 0.9f, 0.8f);
                    SparkleBurst.Spawn(_stone.transform.position + Vector3.up * 0.03f, 16, new Color(1f, 0.85f, 0.4f), 0.03f, Cam, 0.7f, 0.7f);
                    for (float t = 0; t < d; t += Time.deltaTime)
                    {
                        _stone.transform.localScale = Vector3.one * (1f + Util.EaseOutCubic(t / d) * 0.6f) * (1f - t / d);
                        yield return null;
                    }
                    _stone.gameObject.SetActive(false);
                    break;

                case RevealStepKind.PopOpen:
                {
                    // The portal blasts back open from the stone and Kiki hops back out.
                    var sp = _stone.transform.position + Vector3.up * 0.12f;
                    _portal.transform.position = sp;
                    _portal.Snap(0.6f);
                    _portal.Close();
                    _stone.gameObject.SetActive(false);
                    SparkleBurst.Spawn(sp, 18, Colors.UvPurple, 0.035f, Cam, 0.8f, 0.6f);
                    _kiki.SetVisible(true);
                    var kt = _kiki.transform;
                    var full = kt.localScale;
                    for (float t = 0; t < d; t += Time.deltaTime)
                    {
                        float k = t / d;
                        kt.localScale = full * Util.EaseOutBack(k, 2.4f);
                        kt.position = _kikiHome + Vector3.up * Mathf.Sin(k * Mathf.PI) * 0.12f;
                        yield return null;
                    }
                    kt.localScale = full;
                    kt.position = _kikiHome;
                    break;
                }

                case RevealStepKind.SoClose:
                    _hud.Pop(step.Text, Colors.Pink);
                    if (step.Shake > 0) { StartCoroutine(Shake(_world, 0.025f * step.Shake, 0.4f)); _hud.Shake(18f * step.Shake, 0.4f); }
                    _motion.Idling = true;
                    _motion.Play(_motion.RandomIdle());
                    yield return Wait(d);
                    break;

                case RevealStepKind.Bounce:
                {
                    // Bounce off the floor (or keep falling if it went long).
                    var v = _vel; v.y = Mathf.Abs(v.y) * 0.35f; v.x *= 0.5f; v.z *= 0.5f;
                    var p = _pos; p.y = Mathf.Max(p.y, _groundY + RuneStone.Radius * 0.5f);
                    for (float t = 0; t < d; t += Time.deltaTime)
                    {
                        v += Vector3.down * Tune.Gravity * Time.deltaTime;
                        p += v * Time.deltaTime;
                        if (p.y < _groundY + RuneStone.Radius * 0.5f) { p.y = _groundY + RuneStone.Radius * 0.5f; v.y = Mathf.Abs(v.y) * 0.3f; }
                        _stone.transform.position = p;
                        yield return null;
                    }
                    break;
                }

                case RevealStepKind.Fizzle:
                {
                    // No text on a miss: the stone just fizzles out.
                    SparkleBurst.Spawn(_stone.transform.position, 8, new Color(0.6f, 0.5f, 0.9f), 0.02f, Cam, 0.2f, 0.5f);
                    for (float t = 0; t < d; t += Time.deltaTime)
                    {
                        _stone.transform.localScale = Vector3.one * (1f - t / d);
                        yield return null;
                    }
                    _stone.gameObject.SetActive(false);
                    break;
                }

                default:
                    yield return Wait(d);
                    break;
            }
        }

        float KikiCenterOffset => _kiki.WorldCenter.y - _kiki.transform.position.y;

        static IEnumerator Wait(float s) { for (float t = 0; t < s; t += Time.deltaTime) yield return null; }

        static IEnumerator Shake(Transform t, float amount, float seconds)
        {
            var home = t.localPosition;
            for (float e = 0; e < seconds; e += Time.deltaTime)
            {
                t.localPosition = home + UnityEngine.Random.insideUnitSphere * amount * (1 - e / seconds);
                yield return null;
            }
            t.localPosition = home;
        }

        void OnLeave()
        {
            if (_state == State.Flying || _state == State.Resolving || _state == State.Revealing) return;
            Finish(EncounterExit.Left);
        }

        void Finish(EncounterExit why)
        {
            if (_state == State.Done) return;
            _state = State.Done;
            if (!_keepStage) _stage.SetActive(false);
            var cb = _onExit;
            Destroy(gameObject);
            cb?.Invoke(why);
        }

        static Vec3 V(Vector3 v) => new Vec3(v.x, v.y, v.z);
        static Vector3 U(Vec3 v) => new Vector3((float)v.X, (float)v.Y, (float)v.Z);
    }
}
