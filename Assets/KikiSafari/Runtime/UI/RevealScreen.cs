using System;
using System.Collections;
using System.Collections.Generic;
using KikiSafari.Core;
using KikiSafari.Core.Art;
using UnityEngine;
using UnityEngine.UI;

namespace KikiSafari
{
    /// <summary>
    /// The catch reveal (treatment section 5): the rarity label stamps in, Kiki drops in on a cosmic spiral background and
    /// does a random dance, the reward counts up (throw-quality words and the spin bonus appear only here), and the player
    /// taps Keep playing. It never closes by itself.
    /// </summary>
    public sealed class RevealScreen : MonoBehaviour
    {
        RectTransform _root, _bg;
        RawImage _kikiView;
        RenderTexture _rt;
        GameObject _stage;
        KikiRig _kiki;
        KikiMotion _motion;
        Action _onClose;
        bool _spinBg;

        public static RevealScreen Show(Transform parent, VariantDef def, KikiLookSpec look, CatchOutcome outcome, RewardBreakdown reward,
            bool firstCatch, List<RevealStep> steps, Action onClose)
        {
            var canvas = Sticker.MakeCanvas("Reveal", 20, parent);
            var r = canvas.gameObject.AddComponent<RevealScreen>();
            r._onClose = onClose;
            r.Build(canvas.transform, def, look);
            r.StartCoroutine(r.Run(def, outcome, reward, firstCatch, steps));
            return r;
        }

        void Build(Transform canvas, VariantDef def, KikiLookSpec look)
        {
            _root = Sticker.Rect("Root", canvas);
            Sticker.Stretch(_root);
            var dim = Sticker.MakeImage("Deep", _root, new Color(0.09f, 0.04f, 0.24f));
            Sticker.Stretch(dim.rectTransform);

            // Cosmic spiral background, square and oversized so it can turn slowly without showing corners.
            _bg = Sticker.Rect("Cosmic", _root);
            _bg.anchorMin = _bg.anchorMax = new Vector2(0.5f, 0.55f);
            _bg.sizeDelta = new Vector2(2600, 2600);
            var raw = _bg.gameObject.AddComponent<RawImage>();
            raw.texture = TextureUtil.CosmicSpiral();
            raw.raycastTarget = false;
            _spinBg = !Accessibility.ReducedMotion;

            // Kiki is rendered by a small camera far below the world into a transparent texture.
            _rt = new RenderTexture(1024, 1024, 24, RenderTextureFormat.ARGB32) { name = "RevealKiki", antiAliasing = 4 };
            _stage = new GameObject("RevealStage");
            _stage.transform.position = new Vector3(0, -500, 0);
            var camGo = new GameObject("RevealCamera");
            camGo.transform.SetParent(_stage.transform, false);
            camGo.transform.localPosition = new Vector3(0, 0.33f, -1.55f);
            camGo.transform.localRotation = Quaternion.Euler(4f, 0, 0);
            var cam = camGo.AddComponent<Camera>();
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color(0, 0, 0, 0);
            cam.fieldOfView = 30f;
            cam.nearClipPlane = 0.05f; cam.farClipPlane = 6f;
            cam.targetTexture = _rt;
            var light = new GameObject("Key").AddComponent<Light>();
            light.transform.SetParent(_stage.transform, false);
            light.type = LightType.Spot; light.range = 6f; light.spotAngle = 70f; light.intensity = 2.2f;
            light.color = new Color(1f, 0.95f, 0.9f);
            light.transform.localPosition = new Vector3(-0.8f, 1.6f, -1.6f);
            light.transform.LookAt(_stage.transform.position + Vector3.up * 0.25f);

            _kiki = KikiFactory.Build(def.Id, look, _stage.transform);
            _kiki.transform.localRotation = Quaternion.identity; // faces +Z... the camera is at -Z, so turn around:
            _kiki.transform.localRotation = Quaternion.Euler(0, 180f, 0);
            _motion = _kiki.gameObject.AddComponent<KikiMotion>();
            _motion.Idling = false;
            _kiki.gameObject.SetActive(false);

            _kikiView = Sticker.Rect("Kiki", _root).gameObject.AddComponent<RawImage>();
            _kikiView.texture = _rt;
            _kikiView.raycastTarget = false;
            var kr = _kikiView.rectTransform;
            kr.anchorMin = kr.anchorMax = new Vector2(0.5f, 0.56f);
            kr.sizeDelta = new Vector2(1000, 1000);
        }

        void Update()
        {
            if (_spinBg && _bg) _bg.localRotation = Quaternion.Euler(0, 0, -Time.time * 6f);
        }

        void OnDestroy()
        {
            if (_stage) Destroy(_stage);
            if (_rt) { _rt.Release(); Destroy(_rt); }
        }

        IEnumerator Run(VariantDef def, CatchOutcome outcome, RewardBreakdown reward, bool first, List<RevealStep> steps)
        {
            // UV-purple flash carrying over from the burst.
            var flash = Sticker.MakeImage("Flash", _root, Colors.UvPurple);
            Sticker.Stretch(flash.rectTransform);
            for (float t = 0; t < 0.35f; t += Time.deltaTime) { var c = flash.color; c.a = 1 - t / 0.35f; flash.color = c; yield return null; }
            Destroy(flash.gameObject);

            foreach (var step in steps)
            {
                switch (step.Kind)
                {
                    case RevealStepKind.RarityStamp:
                        Feedback(step);
                        yield return Stamp(def, first, step.Duration);
                        break;
                    case RevealStepKind.KikiDropIn:
                        Feedback(step);
                        yield return DropIn(step.Duration);
                        break;
                    case RevealStepKind.Dance:
                        _motion.Play(_motion.Dance(_motion.RandomDance()));
                        for (float t = 0; t < step.Duration || _motion.Busy; t += Time.deltaTime) { if (t > 4f) break; yield return null; }
                        _motion.Idling = true;
                        break;
                    case RevealStepKind.CountUp:
                        yield return CountUp(outcome, reward, step);
                        break;
                    case RevealStepKind.AwaitKeepPlaying:
                        KeepPlaying(step.Text);
                        yield break;
                }
            }
        }

        static void Feedback(RevealStep s)
        {
            Haptics.Play(s.Haptic);
            SfxPlayer.Instance?.Play(s.Sfx, 0.55f);
            SfxPlayer.Instance?.PlayVoice(s.Voice, s.VoiceChance);
        }

        IEnumerator Stamp(VariantDef def, bool first, float d)
        {
            var label = Sticker.Label(_root, RarityInfo.Label(def.Rarity), 150, Colors.RarityMain(def.Rarity), Sticker.Display);
            Sticker.StickerText(label, 8f, 14f);
            var rt = label.rectTransform;
            rt.anchorMin = rt.anchorMax = new Vector2(0.5f, 0.86f);
            rt.sizeDelta = new Vector2(1000, 220);
            var name = Sticker.Label(_root, def.DisplayName, 74, Color.white, Sticker.Display);
            Sticker.StickerText(name, 5f, 8f);
            name.rectTransform.anchorMin = name.rectTransform.anchorMax = new Vector2(0.5f, 0.78f);
            name.rectTransform.sizeDelta = new Vector2(1000, 140);
            name.gameObject.SetActive(false);
            for (float t = 0; t < 0.28f; t += Time.deltaTime)
            {
                float k = t / 0.28f;
                rt.localScale = Vector3.one * Mathf.Lerp(2.6f, 1f, Util.EaseOutCubic(k));
                rt.localRotation = Quaternion.Euler(0, 0, Mathf.Lerp(-18f, -6f, k));
                yield return null;
            }
            rt.localScale = Vector3.one;
            name.gameObject.SetActive(true);
            if (first)
            {
                var badge = Sticker.Panel("New", _root, Colors.Pink, out var bc);
                Sticker.Place(badge, new Vector2(0.5f, 0.78f), new Vector2(380, 40), new Vector2(210, 100));
                badge.localRotation = Quaternion.Euler(0, 0, 12f);
                Sticker.StickerText(Sticker.Label(bc, "NEW!", 54, Color.white, Sticker.Display), 3f, 4f);
            }
            yield return new WaitForSeconds(Mathf.Max(0, d - 0.28f));
        }

        IEnumerator DropIn(float d)
        {
            _kiki.gameObject.SetActive(true);
            var t0 = _kiki.transform;
            var home = Vector3.zero;
            for (float t = 0; t < d; t += Time.deltaTime)
            {
                float k = Mathf.Clamp01(t / (d * 0.7f));
                t0.localPosition = home + Vector3.up * (1.6f * (1 - k * k));
                yield return null;
            }
            t0.localPosition = home;
            Haptics.Play(HapticKind.Light);
        }

        IEnumerator CountUp(CatchOutcome outcome, RewardBreakdown reward, RevealStep step)
        {
            var panel = Sticker.Panel("Reward", _root, Colors.Cream, out var c);
            Sticker.Place(panel, new Vector2(0.5f, 0.2f), Vector2.zero, new Vector2(820, 140 + reward.Lines.Count * 70));
            var lines = new List<Text>();
            float y = -26;
            foreach (var line in reward.Lines)
            {
                var row = Sticker.Label(c, "", 42, Colors.Navy, Sticker.Body, TextAnchor.UpperLeft);
                row.rectTransform.offsetMin = new Vector2(44, 0); row.rectTransform.offsetMax = new Vector2(-44, y);
                lines.Add(row);
                y -= 70;
            }
            var total = Sticker.Label(c, "", 60, Colors.Navy, Sticker.Display, TextAnchor.LowerCenter);
            total.rectTransform.offsetMin = new Vector2(0, 22);

            int running = 0;
            for (int i = 0; i < reward.Lines.Count; i++)
            {
                var l = reward.Lines[i];
                lines[i].text = $"{l.Label}  <color=#3fae2a>+{l.Amount}</color>";
                lines[i].supportRichText = true;
                SfxPlayer.Instance?.Play(Sfx.CountTick, 0.4f);
                int from = running, to = running + l.Amount;
                float dur = Mathf.Min(0.5f, step.Duration / reward.Lines.Count);
                int ticks = 0;
                for (float t = 0; t < dur; t += Time.deltaTime)
                {
                    running = (int)Mathf.Lerp(from, to, t / dur);
                    total.text = $"+{running} Sprouts";
                    if (++ticks % 4 == 0) { Haptics.Play(HapticKind.Tick); SfxPlayer.Instance?.Play(Sfx.CountTick, 0.25f, 1f + t); }
                    yield return null;
                }
                running = to;
                total.text = $"+{running} Sprouts";
            }
            if (outcome.Spin) Haptics.Play(HapticKind.Light);
        }

        void KeepPlaying(string label)
        {
            var b = Sticker.Pill("KeepPlaying", _root, string.IsNullOrEmpty(label) ? "Keep playing" : label, Sticker.PlayGradient, Colors.Navy, Close, 64);
            Sticker.Place((RectTransform)b.transform, new Vector2(0.5f, 0.06f), Vector2.zero, new Vector2(620, 150));
            StartCoroutine(PopIn((RectTransform)b.transform));
        }

        static IEnumerator PopIn(RectTransform rt)
        {
            for (float t = 0; t < 0.3f; t += Time.deltaTime) { rt.localScale = Vector3.one * Util.EaseOutBack(t / 0.3f); yield return null; }
            rt.localScale = Vector3.one;
        }

        void Close()
        {
            var cb = _onClose;
            _onClose = null;
            Destroy(gameObject);
            cb?.Invoke();
        }
    }
}
