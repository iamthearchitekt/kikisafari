using System;
using KikiSafari.Core;
using UnityEngine;
using UnityEngine.UI;

namespace KikiSafari
{
    /// <summary>
    /// Hidden tuning panel (decisions doc, section 11): triple-tap the top-right corner. Changes throw strength, ring speed,
    /// aim assist, catch odds, gravity and hit size live on the phone, with no rebuild. Also debug switches.
    /// </summary>
    public sealed class TuningPanel : MonoBehaviour
    {
        GameRoot _game;

        public static TuningPanel Show(Transform parent, GameRoot game)
        {
            var canvas = Sticker.MakeCanvas("Tuning", 100, parent);
            var p = canvas.gameObject.AddComponent<TuningPanel>();
            p._game = game;
            p.Build(canvas.transform);
            return p;
        }

        void Build(Transform canvas)
        {
            var dim = Sticker.MakeImage("Dim", canvas, new Color(0.05f, 0.07f, 0.25f, 0.6f));
            Sticker.Stretch(dim.rectTransform);
            var safe = Sticker.SafeArea(canvas);
            var panel = Sticker.Panel("Panel", safe, Colors.Cream, out var c);
            Sticker.Stretch(panel, 40, 90, 40, 90);
            var title = Sticker.Label(c, "Tuning", 70, Colors.Navy, Sticker.Display, TextAnchor.UpperCenter);
            title.rectTransform.offsetMax = new Vector2(0, -24);

            var t = TuningStore.Current;
            float y = -130;
            Slider(c, ref y, "Throw strength", 0.3f, 3f, t.ThrowStrength, v => t.ThrowStrength = v, "0.00");
            Slider(c, ref y, "Ring cycle (s)", 0.8f, 6f, t.RingPeriod, v => t.RingPeriod = v, "0.0");
            Slider(c, ref y, "Aim assist", 0f, 1f, t.AimAssist, v => t.AimAssist = v, "0.00");
            Slider(c, ref y, "Catch odds ×", 0.1f, 5f, t.CatchOdds, v => t.CatchOdds = v, "0.00");
            Slider(c, ref y, "Gravity (m/s²)", 2f, 20f, t.Gravity, v => t.Gravity = v, "0.0");
            Slider(c, ref y, "Hit size (m)", 0.1f, 1f, t.HitRadius, v => t.HitRadius = v, "0.00");

            y -= 10;
            Toggle(c, ref y, "Force night (Moonbeam)", DebugFlags.ForceNight, v => DebugFlags.ForceNight = v);
            Toggle(c, ref y, "Debug overlay", DebugFlags.ShowOverlay, v => DebugFlags.ShowOverlay = v);

            var row = Sticker.Rect("Buttons", c);
            row.anchorMin = new Vector2(0, 0); row.anchorMax = new Vector2(1, 0); row.pivot = new Vector2(0.5f, 0);
            row.offsetMin = new Vector2(30, 30); row.offsetMax = new Vector2(-30, 170);
            var reset = Sticker.Pill("Reset", row, "Reset", Sticker.CreamGradient, Colors.Navy, () => { TuningStore.Reset(); Reopen(); }, 38, Sticker.Body);
            Sticker.Place((RectTransform)reset.transform, new Vector2(0, 0.5f), Vector2.zero, new Vector2(220, 110));
            var stones = Sticker.Pill("Stones", row, "+30 stones", Sticker.SkyGradient, Color.white, () => { _game.Progress.Stones += 30; _game.SaveProgress(); }, 36, Sticker.Body);
            Sticker.Place((RectTransform)stones.transform, new Vector2(0.5f, 0.5f), new Vector2(-40, 0), new Vector2(260, 110));
            var done = Sticker.Pill("Done", row, "Done", Sticker.PlayGradient, Colors.Navy, () => { TuningStore.Save(); Destroy(gameObject); }, 44);
            Sticker.Place((RectTransform)done.transform, new Vector2(1, 0.5f), Vector2.zero, new Vector2(220, 110));
        }

        void Reopen()
        {
            var parent = transform.parent;
            Destroy(gameObject);
            Show(parent, _game);
        }

        static void Slider(RectTransform parent, ref float y, string label, float min, float max, float value, Action<float> set, string fmt)
        {
            var l = Sticker.Label(parent, "", 36, Colors.Navy, Sticker.Body, TextAnchor.UpperLeft);
            l.rectTransform.offsetMin = new Vector2(50, 0); l.rectTransform.offsetMax = new Vector2(-50, y);
            void Render(float v) => l.text = $"{label}: <b>{v.ToString(fmt)}</b>";
            l.supportRichText = true;
            Render(value);

            var root = Sticker.Rect("Slider", parent);
            root.anchorMin = new Vector2(0, 1); root.anchorMax = new Vector2(1, 1); root.pivot = new Vector2(0.5f, 1);
            root.offsetMin = new Vector2(60, y - 120); root.offsetMax = new Vector2(-60, y - 60);
            var bg = Sticker.MakeImage("Track", root, Colors.Navy, TextureUtil.RoundedRect(14));
            Sticker.Stretch(bg.rectTransform, 0, 20, 0, 20);
            var fillArea = Sticker.Rect("FillArea", root); Sticker.Stretch(fillArea, 4, 24, 4, 24);
            var fill = Sticker.MakeImage("Fill", fillArea, Colors.Sun, TextureUtil.RoundedRect(12));
            fill.rectTransform.sizeDelta = Vector2.zero;
            var handleArea = Sticker.Rect("HandleArea", root); Sticker.Stretch(handleArea, 30, 0, 30, 0);
            var handle = Sticker.MakeImage("Handle", handleArea, Colors.Pink, TextureUtil.RoundedRect(28));
            handle.rectTransform.sizeDelta = new Vector2(60, 0);
            var s = root.gameObject.AddComponent<Slider>();
            s.fillRect = fill.rectTransform;
            s.handleRect = handle.rectTransform;
            s.targetGraphic = handle;
            s.minValue = min; s.maxValue = max; s.value = value;
            s.onValueChanged.AddListener(v => { set(v); Render(v); TuningStore.Save(); });
            y -= 150;
        }

        static void Toggle(RectTransform parent, ref float y, string label, bool value, Action<bool> set)
        {
            Button b = null;
            bool state = value;
            string Caption() => $"{label}: {(state ? "on" : "off")}";
            b = Sticker.Pill("Toggle", parent, Caption(), Sticker.CreamGradient, Colors.Navy, () => { state = !state; set(state); Sticker.SetPillText(b, Caption()); }, 36, Sticker.Body);
            var rt = (RectTransform)b.transform;
            rt.anchorMin = new Vector2(0, 1); rt.anchorMax = new Vector2(1, 1); rt.pivot = new Vector2(0.5f, 1);
            rt.offsetMin = new Vector2(60, y - 110); rt.offsetMax = new Vector2(-60, y);
            y -= 135;
        }
    }
}
