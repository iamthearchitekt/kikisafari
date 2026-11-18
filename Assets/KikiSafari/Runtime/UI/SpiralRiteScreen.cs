using System;
using System.Collections;
using System.Collections.Generic;
using KikiSafari.Core;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UI;

namespace KikiSafari
{
    /// <summary>
    /// The Spiral Rite at a Rune Circle. Over the camera view, the circle's spiral rune pulses to the beat; a ring of UV
    /// light closes on it each beat and the player taps as it lands. Out-attune the Keeper and your Kiki takes the circle.
    /// </summary>
    public sealed class SpiralRiteScreen : MonoBehaviour
    {
        GameRoot _game;
        WorldThing _circle;
        Action<bool> _onDone;
        SpiralRite _rite;
        RectTransform _root, _rune, _ringsRoot, _dotsRow;
        Text _score, _judge, _countIn;
        readonly List<Image> _rings = new List<Image>();
        readonly List<Image> _dots = new List<Image>();
        float _start;
        bool _finished;
        int _lastBeatSound = -1;

        public static SpiralRiteScreen Show(Transform parent, GameRoot game, WorldThing circle, Action<bool> onDone)
        {
            var canvas = Sticker.MakeCanvas("SpiralRite", 25, parent);
            var s = canvas.gameObject.AddComponent<SpiralRiteScreen>();
            s._game = game; s._circle = circle; s._onDone = onDone;
            s._rite = new SpiralRite();
            s.Build(canvas.transform);
            s._start = Time.time;
            return s;
        }

        void Build(Transform canvas)
        {
            _root = Sticker.Rect("Root", canvas);
            Sticker.Stretch(_root);
            var dim = Sticker.MakeImage("Veil", _root, new Color(0.07f, 0.02f, 0.2f, 0.72f));
            Sticker.Stretch(dim.rectTransform);
            var safe = Sticker.SafeArea(_root);

            var title = Sticker.Label(safe, "The Spiral Rite", 84, Colors.Hex(0xC77DFF), Sticker.Display, TextAnchor.UpperCenter);
            title.rectTransform.offsetMax = new Vector2(0, -60);
            Sticker.StickerText(title, 5f, 9f);
            var keeper = Sticker.Label(safe, $"Keeper: {(_circle.Mine ? "your" : "a wild")} {_circle.Variant.DisplayName}  ·  attunement {_circle.KeeperAttunement}",
                36, Color.white, Sticker.Body, TextAnchor.UpperCenter);
            keeper.rectTransform.offsetMax = new Vector2(0, -180);

            _ringsRoot = Sticker.Rect("Rings", safe);
            _ringsRoot.anchorMin = _ringsRoot.anchorMax = new Vector2(0.5f, 0.52f);
            _rune = Sticker.Rect("Rune", safe);
            _rune.anchorMin = _rune.anchorMax = new Vector2(0.5f, 0.52f);
            _rune.sizeDelta = new Vector2(560, 560);
            var runeImg = _rune.gameObject.AddComponent<Image>();
            runeImg.sprite = RuneSprite(); runeImg.raycastTarget = false;
            for (int i = 0; i < 3; i++)
            {
                var ring = Sticker.MakeImage("Ring", _ringsRoot, new Color(0.78f, 0.49f, 1f, 0f), RingSprite());
                ring.type = Image.Type.Simple; ring.raycastTarget = false;
                ring.rectTransform.sizeDelta = new Vector2(560, 560);
                _rings.Add(ring);
            }

            _countIn = Sticker.Label(safe, "", 160, Colors.Sun, Sticker.Display);
            _countIn.rectTransform.anchorMin = _countIn.rectTransform.anchorMax = new Vector2(0.5f, 0.52f);
            _countIn.rectTransform.sizeDelta = new Vector2(400, 260);
            Sticker.StickerText(_countIn, 6f, 10f);

            _judge = Sticker.Label(safe, "", 72, Color.white, Sticker.Display);
            _judge.rectTransform.anchorMin = _judge.rectTransform.anchorMax = new Vector2(0.5f, 0.27f);
            _judge.rectTransform.sizeDelta = new Vector2(800, 140);
            Sticker.StickerText(_judge, 4f, 7f);

            _score = Sticker.Label(safe, "Attunement 0", 52, Color.white, Sticker.Display);
            _score.rectTransform.anchorMin = _score.rectTransform.anchorMax = new Vector2(0.5f, 0.2f);
            _score.rectTransform.sizeDelta = new Vector2(800, 100);

            _dotsRow = Sticker.Rect("Beats", safe);
            Sticker.Place(_dotsRow, new Vector2(0.5f, 0), new Vector2(0, 140), new Vector2(_rite.Beats * 46, 40));
            for (int i = 0; i < _rite.Beats; i++)
            {
                var dot = Sticker.MakeImage("Beat", _dotsRow, new Color(1, 1, 1, 0.25f), TextureUtil.RoundedRect(14));
                Sticker.Place(dot.rectTransform, new Vector2(0, 0.5f), new Vector2(i * 46 + 5, 0), new Vector2(32, 32));
                _dots.Add(dot);
            }
            var hint = Sticker.Label(safe, "Tap anywhere as each ring lands on the rune", 34, new Color(1, 1, 1, 0.8f), Sticker.BodyMedium, TextAnchor.LowerCenter);
            hint.rectTransform.offsetMin = new Vector2(0, 60);
        }

        void Update()
        {
            if (_finished) return;
            double t = Time.time - _start;

            // Count-in, then the beat.
            double lead = _rite.LeadIn;
            if (t < lead)
            {
                int n = Mathf.CeilToInt((float)((lead - t) / _rite.BeatInterval));
                _countIn.text = n > 0 && n <= 3 ? n.ToString() : "";
            }
            else _countIn.text = "";

            int beatNow = (int)Math.Floor((t - lead) / _rite.BeatInterval + 0.0001);
            if (beatNow >= 0 && beatNow < _rite.Beats && beatNow != _lastBeatSound)
            {
                _lastBeatSound = beatNow;
                SfxPlayer.Instance?.Play(Sfx.Wobble, 0.35f, 1.25f);
                StartCoroutine(Pulse(_rune, 1.06f));
            }

            // Rings: the next three beats close in.
            int ri = 0;
            for (int i = 0; i < _rite.Beats && ri < _rings.Count; i++)
            {
                if (_rite.Results[i].HasValue) continue;
                double until = _rite.BeatTime(i) - t;
                if (until > _rite.BeatInterval * 3 || until < -SpiralRite.GoodWindow) continue;
                float k = Mathf.Clamp01((float)(until / (_rite.BeatInterval * 3)));
                var ring = _rings[ri++];
                ring.rectTransform.localScale = Vector3.one * (1f + k * 2.2f);
                var col = ring.color; col.a = Mathf.Lerp(1f, 0.15f, k); ring.color = col;
            }
            for (; ri < _rings.Count; ri++) { var c = _rings[ri].color; c.a = 0; _rings[ri].color = c; }

            // Taps.
            var p = Pointer.current;
            if (p != null && p.press.wasPressedThisFrame)
            {
                var r = _rite.Tap(t);
                if (r.HasValue) Judge(r.Value.beat, r.Value.judgement);
            }
            foreach (var m in _rite.Advance(t)) Judge(m, RiteJudgement.Miss);
            _score.text = $"Attunement {_rite.Attunement}";

            if (_rite.Finished(t)) StartCoroutine(Finish());
        }

        void Judge(int beat, RiteJudgement j)
        {
            switch (j)
            {
                case RiteJudgement.Perfect:
                    _dots[beat].color = Colors.Hex(0xC77DFF);
                    Show("Perfect!", Colors.Sun);
                    Haptics.Play(HapticKind.Medium);
                    SfxPlayer.Instance?.Play(Sfx.Hit, 0.45f);
                    StartCoroutine(Pulse(_rune, 1.16f));
                    break;
                case RiteJudgement.Good:
                    _dots[beat].color = Colors.Sky;
                    Show("Good", Colors.Sky);
                    Haptics.Play(HapticKind.Light);
                    SfxPlayer.Instance?.Play(Sfx.Tick, 0.4f);
                    StartCoroutine(Pulse(_rune, 1.09f));
                    break;
                default:
                    _dots[beat].color = new Color(1, 1, 1, 0.1f);
                    Show("", Color.white);
                    break;
            }
        }

        void Show(string text, Color color) { _judge.text = text; _judge.color = color; }

        IEnumerator Pulse(RectTransform rt, float peak)
        {
            if (Accessibility.ReducedMotion) peak = 1f + (peak - 1f) * 0.3f;
            for (float e = 0; e < 0.18f; e += Time.deltaTime) { rt.localScale = Vector3.one * Mathf.Lerp(peak, 1f, e / 0.18f); yield return null; }
            rt.localScale = Vector3.one;
        }

        IEnumerator Finish()
        {
            _finished = true;
            foreach (var r in _rings) { var c = r.color; c.a = 0; r.color = c; }
            int score = _rite.Attunement;
            bool won = score > _circle.KeeperAttunement;
            yield return new WaitForSeconds(0.4f);

            var panel = Sticker.Panel("Result", _root, Colors.Cream, out var c);
            Sticker.Place(panel, new Vector2(0.5f, 0.5f), new Vector2(0, -40), new Vector2(920, 900));
            var head = Sticker.Label(c, won ? "The circle chose you!" : "SO CLOSE!", 76, won ? Colors.UvPurple : Colors.Pink, Sticker.Display, TextAnchor.UpperCenter);
            head.rectTransform.offsetMax = new Vector2(0, -40);
            Sticker.StickerTextLight(head);
            var vs = Sticker.Label(c, $"Your attunement {score}\nKeeper {_circle.KeeperAttunement}", 48, Colors.Navy, Sticker.Body, TextAnchor.UpperCenter);
            vs.rectTransform.offsetMax = new Vector2(0, -170);

            if (won)
            {
                Haptics.Play(HapticKind.Success);
                SfxPlayer.Instance?.Play(Sfx.Burst, 0.55f);
                SfxPlayer.Instance?.PlayVoice(Voice.Yay, 0.5f);
                // Pick which Kiki keeps the circle: rarest caught first; tap to cycle.
                var mine = new List<VariantDef>();
                foreach (var d in _game.Library.Defs) if (_game.Progress.HasCaught(d.Id)) mine.Add(d);
                mine.Sort((a, b) => b.Rarity.CompareTo(a.Rarity));
                int pick = 0;
                Button chooser = null;
                string Label() => mine.Count > 1 ? $"Keeper: {mine[pick].DisplayName} (tap to switch)" : $"Keeper: {mine[pick].DisplayName}";
                chooser = Sticker.Pill("Choose", c, Label(), Sticker.SkyGradient, Color.white, () =>
                {
                    pick = (pick + 1) % mine.Count;
                    Sticker.SetPillText(chooser, Label());
                }, 40);
                Sticker.Place((RectTransform)chooser.transform, new Vector2(0.5f, 0), new Vector2(0, 340), new Vector2(720, 120));
                Sticker.StickerText(chooser.GetComponentInChildren<Text>(), 3f, 5f);
                var place = Sticker.Pill("Place", c, "Place my Kiki", Sticker.PlayGradient, Colors.Navy, () =>
                {
                    _game.Progress.TakeCircle(_circle.Id, mine[pick].Id, score, Util.UnixNow());
                    _game.SaveProgress();
                    Close(true);
                }, 56);
                Sticker.Place((RectTransform)place.transform, new Vector2(0.5f, 0), new Vector2(0, 170), new Vector2(620, 140));
            }
            else
            {
                Haptics.Play(HapticKind.Warning);
                SfxPlayer.Instance?.Play(Sfx.BreakOut, 0.45f);
                SfxPlayer.Instance?.PlayVoice(Voice.Awww, 0.5f);
                var again = Sticker.Pill("Again", c, "Try again", Sticker.PlayGradient, Colors.Navy, () =>
                {
                    var parent = transform.parent;
                    var circle = _circle; var game = _game; var done = _onDone;
                    Destroy(gameObject);
                    Show(parent, game, circle, done);
                }, 56);
                Sticker.Place((RectTransform)again.transform, new Vector2(0.5f, 0), new Vector2(0, 200), new Vector2(560, 140));
            }
            var close = Sticker.Pill("Close", c, "Close", Sticker.CreamGradient, Colors.Navy, () => Close(false), 44, Sticker.Body);
            Sticker.Place((RectTransform)close.transform, new Vector2(0.5f, 0), new Vector2(0, 40), new Vector2(300, 110));
        }

        void Close(bool won)
        {
            var cb = _onDone;
            Destroy(gameObject);
            cb?.Invoke(won);
        }

        // ---------- art ----------

        static Sprite _rune, _ring;

        /// <summary>The circle's rune: Kiki's spiral glowing UV purple on a dark stone disc.</summary>
        static Sprite RuneSprite()
        {
            if (_rune) return _rune;
            int s = 512;
            var c = new Core.Art.Canvas(s, s, new Core.Art.Rgba(0, 0, 0, 0));
            for (int k = 0; k < 14; k++) c.FillCircle(256, 256, 250 - k * 6, new Core.Art.Rgba(0.48f, 0f, 1f, 0.05f));
            c.FillCircle(256, 256, 170, Core.Art.Rgba.Hex(0x241A4E));
            c.Stroke(Core.Art.KikiFaceArt.SpiralPath(256, 256, 140, 1, 2.5f), 34, Core.Art.Rgba.Hex(0x7A00FF, 0.55f));
            c.Stroke(Core.Art.KikiFaceArt.SpiralPath(256, 256, 140, 1, 2.5f), 20, Core.Art.Rgba.Hex(0x7A00FF));
            c.Stroke(Core.Art.KikiFaceArt.SpiralPath(256, 256, 140, 1, 2.5f), 8, Core.Art.Rgba.Hex(0xD9A8FF));
            var ringPts = new List<Core.Art.P2>();
            for (int i = 0; i <= 120; i++) { float a = i / 120f * Mathf.PI * 2; ringPts.Add(new Core.Art.P2(256 + Mathf.Cos(a) * 176, 256 + Mathf.Sin(a) * 176)); }
            c.Stroke(ringPts, 10, Core.Art.Rgba.Hex(0x7A00FF));
            var t = new Texture2D(s, s, TextureFormat.RGBA32, true) { name = "SpiralRune" };
            t.SetPixelData(c.ToBytes(true), 0); t.Apply(true);
            _rune = Sprite.Create(t, new Rect(0, 0, s, s), new Vector2(0.5f, 0.5f), 100);
            return _rune;
        }

        /// <summary>A thin glowing ring; scaled down onto the rune each beat.</summary>
        static Sprite RingSprite()
        {
            if (_ring) return _ring;
            int s = 512;
            var c = new Core.Art.Canvas(s, s, new Core.Art.Rgba(1, 1, 1, 0));
            var pts = new List<Core.Art.P2>();
            for (int i = 0; i <= 160; i++) { float a = i / 160f * Mathf.PI * 2; pts.Add(new Core.Art.P2(256 + Mathf.Cos(a) * 176, 256 + Mathf.Sin(a) * 176)); }
            c.Stroke(pts, 26, new Core.Art.Rgba(1, 1, 1, 0.25f));
            c.Stroke(pts, 12, new Core.Art.Rgba(1, 1, 1, 1f));
            var t = new Texture2D(s, s, TextureFormat.RGBA32, true) { name = "RiteRing" };
            t.SetPixelData(c.ToBytes(true), 0); t.Apply(true);
            _ring = Sprite.Create(t, new Rect(0, 0, s, s), new Vector2(0.5f, 0.5f), 100);
            return _ring;
        }
    }
}
