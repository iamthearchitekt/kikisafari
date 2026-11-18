using System;
using System.Collections;
using KikiSafari.Core;
using UnityEngine;
using UnityEngine.UI;

namespace KikiSafari
{
    /// <summary>
    /// Encounter overlay: back to the map, Kiki's name sticker, the Rune Stone count, the always-available
    /// "Tap to throw" button, hints, and the "SO CLOSE!" pop. One-handed portrait: controls sit in the corners and the
    /// throw area is the bottom centre.
    /// </summary>
    public sealed class EncounterHud : MonoBehaviour
    {
        RectTransform _safe, _shakeRoot;
        Text _stones, _hint, _debug;
        Button _tapThrow, _back;
        RectTransform _hintPanel;
        Canvas _canvas;

        public static EncounterHud Make(Transform parent, VariantDef def, Action onBack, Action onTapThrow)
        {
            var canvas = Sticker.MakeCanvas("EncounterHUD", 10, parent);
            var hud = canvas.gameObject.AddComponent<EncounterHud>();
            hud._canvas = canvas;
            hud._shakeRoot = Sticker.Rect("Shake", canvas.transform);
            Sticker.Stretch(hud._shakeRoot);
            hud._safe = Sticker.SafeArea(hud._shakeRoot);

            hud._back = Sticker.Pill("Back", hud._safe, "Map", Sticker.SkyGradient, Color.white, onBack, 44);
            Sticker.Place((RectTransform)hud._back.transform, new Vector2(0, 1), new Vector2(36, -36), new Vector2(230, 110));
            Sticker.StickerText(hud._back.GetComponentInChildren<Text>(), 3f, 5f);

            var name = Sticker.Panel("Name", hud._safe, Colors.Cream, out var nc);
            Sticker.Place(name, new Vector2(0.5f, 1), new Vector2(0, -160), new Vector2(560, 150));
            var t = Sticker.Label(nc, def.DisplayName, 54, Colors.Navy, Sticker.Display);
            t.rectTransform.offsetMax = new Vector2(0, -12); t.alignment = TextAnchor.UpperCenter;
            var r = Sticker.Label(nc, RarityInfo.Label(def.Rarity), 34, Colors.RaritySecond(def.Rarity), Sticker.Body);
            r.alignment = TextAnchor.LowerCenter; r.rectTransform.offsetMin = new Vector2(0, 10);

            var stones = Sticker.Panel("Stones", hud._safe, Colors.Cream, out var sc);
            Sticker.Place(stones, new Vector2(1, 1), new Vector2(-36, -36), new Vector2(230, 110));
            var icon = Sticker.MakeImage("Icon", sc, Color.white, IconSprites.RuneStone());
            icon.type = Image.Type.Simple; icon.preserveAspect = true;
            Sticker.Place(icon.rectTransform, new Vector2(0, 0.5f), new Vector2(12, 0), new Vector2(84, 84));
            hud._stones = Sticker.Label(sc, "0", 54, Colors.Navy, Sticker.Display, TextAnchor.MiddleRight);
            hud._stones.rectTransform.offsetMax = new Vector2(-22, 0);

            hud._tapThrow = Sticker.Pill("TapThrow", hud._safe, "Tap to throw", Sticker.PinkGradient, Color.white, onTapThrow, 46);
            Sticker.Place((RectTransform)hud._tapThrow.transform, new Vector2(1, 0), new Vector2(-36, 60), new Vector2(330, 120));
            Sticker.StickerText(hud._tapThrow.GetComponentInChildren<Text>(), 3f, 5f);

            hud._hintPanel = Sticker.Panel("Hint", hud._safe, Colors.Cream, out var hc);
            Sticker.Place(hud._hintPanel, new Vector2(0.5f, 0.5f), new Vector2(0, 180), new Vector2(880, 130));
            hud._hint = Sticker.Label(hc, "", 44, Colors.Navy, Sticker.Body);

            hud._debug = Sticker.Label(hud._safe, "", 28, Color.white, Sticker.BodyMedium, TextAnchor.UpperLeft);
            hud._debug.rectTransform.offsetMin = new Vector2(40, 0); hud._debug.rectTransform.offsetMax = new Vector2(0, -200);
            var sh = hud._debug.gameObject.AddComponent<Shadow>(); sh.effectColor = Colors.Navy; sh.effectDistance = new Vector2(2, -2);
            return hud;
        }

        public void SetStones(int n) => _stones.text = n.ToString();

        public void SetHint(string text)
        {
            _hint.text = text ?? "";
            _hintPanel.gameObject.SetActive(!string.IsNullOrEmpty(text));
        }

        public void SetTapThrowEnabled(bool on)
        {
            _tapThrow.interactable = on;
            if (!_tapThrow.TryGetComponent<CanvasGroup>(out var cg)) cg = _tapThrow.gameObject.AddComponent<CanvasGroup>();
            cg.alpha = on ? 1f : 0.45f;
        }

        public void SetDebug(string text)
        {
            _debug.gameObject.SetActive(!string.IsNullOrEmpty(text));
            if (!string.IsNullOrEmpty(text)) _debug.text = text;
        }

        /// <summary>True when a screen point is on one of the HUD's buttons (so it isn't a throw).</summary>
        public bool IsOverControl(Vector2 screen)
        {
            foreach (var b in new[] { _back, _tapThrow })
                if (b && b.gameObject.activeInHierarchy && RectTransformUtility.RectangleContainsScreenPoint((RectTransform)b.transform, screen, null))
                    return true;
            return false;
        }

        /// <summary>A big sticker word that pops in and out ("SO CLOSE!").</summary>
        public void Pop(string text, Color color)
        {
            var t = Sticker.Label(_safe, text, 140, color, Sticker.Display);
            Sticker.StickerText(t, 7f, 12f);
            t.rectTransform.anchorMin = t.rectTransform.anchorMax = new Vector2(0.5f, 0.62f);
            t.rectTransform.sizeDelta = new Vector2(1000, 220);
            StartCoroutine(PopLife(t.rectTransform));
        }

        IEnumerator PopLife(RectTransform rt)
        {
            for (float e = 0; e < 0.3f; e += Time.deltaTime) { rt.localScale = Vector3.one * Util.EaseOutBack(e / 0.3f, 2.5f); rt.localRotation = Quaternion.Euler(0, 0, -6f); yield return null; }
            rt.localScale = Vector3.one;
            yield return new WaitForSeconds(0.8f);
            var g = rt.GetComponent<Text>();
            for (float e = 0; e < 0.25f; e += Time.deltaTime) { if (g) { var c = g.color; c.a = 1 - e / 0.25f; g.color = c; } yield return null; }
            Destroy(rt.gameObject);
        }

        public void Shake(float pixels, float seconds) => StartCoroutine(ShakeRoutine(pixels, seconds));

        IEnumerator ShakeRoutine(float px, float seconds)
        {
            for (float e = 0; e < seconds; e += Time.deltaTime)
            {
                _shakeRoot.anchoredPosition = UnityEngine.Random.insideUnitCircle * px * (1 - e / seconds);
                yield return null;
            }
            _shakeRoot.anchoredPosition = Vector2.zero;
        }

        public void ShowOutOfStones(Action onMap)
        {
            var p = Sticker.Panel("OutOfStones", _safe, Colors.Cream, out var c);
            Sticker.Place(p, new Vector2(0.5f, 0.5f), new Vector2(0, -80), new Vector2(860, 420));
            var t = Sticker.Label(c, "Out of Rune Stones!", 64, Colors.Navy, Sticker.Display);
            t.alignment = TextAnchor.UpperCenter; t.rectTransform.offsetMax = new Vector2(0, -36);
            var s = Sticker.Label(c, "Grab more at a Supply Tent.\nKiki will wait for you.", 40, Colors.Muted, Sticker.Body);
            s.rectTransform.offsetMax = new Vector2(0, -20);
            var b = Sticker.Pill("Map", c, "Back to the map", Sticker.PlayGradient, Colors.Navy, onMap, 50);
            Sticker.Place((RectTransform)b.transform, new Vector2(0.5f, 0), new Vector2(0, 36), new Vector2(520, 120));
            SetHint("");
            _tapThrow.gameObject.SetActive(false);
        }
    }

    /// <summary>Small procedural icons.</summary>
    public static class IconSprites
    {
        static Sprite _stone;

        /// <summary>The Rune Stone seen from above: slate pebble with Kiki's spiral glowing UV purple.</summary>
        public static Sprite RuneStone()
        {
            if (_stone) return _stone;
            int s = 128;
            var c = new Core.Art.Canvas(s, s, new Core.Art.Rgba(0, 0, 0, 0));
            c.FillEllipse(64, 66, 58, 50, Core.Art.Rgba.Hex(0x18237A));
            c.FillEllipse(64, 64, 52, 44, Core.Art.Rgba.Hex(0x3D4275));
            c.FillEllipse(56, 52, 28, 16, Core.Art.Rgba.Hex(0x5A5F96, 0.6f));
            c.Stroke(Core.Art.KikiFaceArt.SpiralPath(64, 64, 32, 1, 2.3f), 7.5f, Core.Art.Rgba.Hex(0x7A00FF));
            c.Stroke(Core.Art.KikiFaceArt.SpiralPath(64, 64, 32, 1, 2.3f), 3f, Core.Art.Rgba.Hex(0xC77DFF));
            var t = new Texture2D(s, s, TextureFormat.RGBA32, false) { name = "RuneStoneIcon" };
            t.SetPixelData(c.ToBytes(true), 0); t.Apply();
            _stone = Sprite.Create(t, new Rect(0, 0, s, s), new Vector2(0.5f, 0.5f), 100);
            return _stone;
        }
    }
}
