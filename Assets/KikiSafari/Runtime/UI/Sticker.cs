using System;
using System.Collections;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace KikiSafari
{
    /// <summary>
    /// Sticker-style UI built in code (treatment section 4): cream panels with a 2–3 px navy border and a hard, unblurred
    /// navy drop shadow straight down; pill buttons with vertical gradients that press down 5 px.
    /// Reference resolution is 1080×1920 portrait.
    /// </summary>
    public static class Sticker
    {
        public const float Border = 6f;   // 3 px at 2x
        public const float ShadowDrop = 12f;
        public const float PressDepth = 10f; // 5 px at 2x

        static Font _display, _body, _bodyMedium;
        public static Font Display => _display ??= LoadFont("Fonts/LilitaOne-Regular");
        public static Font Body => _body ??= LoadFont("Fonts/Baloo2-Bold");
        public static Font BodyMedium => _bodyMedium ??= LoadFont("Fonts/Baloo2-Medium");

        static Font LoadFont(string path)
        {
            var f = Resources.Load<Font>(path);
            if (f == null)
            {
                Debug.LogWarning($"[KikiSafari] Font {path} missing; using the built-in font.");
                f = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            }
            return f;
        }

        public static Sprite PlayGradient => TextureUtil.GradientPill(Colors.SunLight, Colors.Sun, Colors.SunDeep);
        public static Sprite PinkGradient => TextureUtil.GradientPill(Colors.Hex(0xFF9DBA), Colors.Pink, Colors.Hex(0xE23A6E));
        public static Sprite SkyGradient => TextureUtil.GradientPill(Colors.Hex(0x9ADCFF), Colors.Sky, Colors.Hex(0x1F8FD6));
        public static Sprite CreamGradient => TextureUtil.GradientPill(Color.white, Colors.Cream, Colors.Hex(0xEFE3B8));

        public static Canvas MakeCanvas(string name, int sortingOrder, Transform parent = null)
        {
            var go = new GameObject(name, typeof(RectTransform));
            if (parent != null) go.transform.SetParent(parent, false);
            var canvas = go.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvas.sortingOrder = sortingOrder;
            var scaler = go.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1080, 1920);
            scaler.matchWidthOrHeight = 0.5f;
            go.AddComponent<GraphicRaycaster>();
            return canvas;
        }

        /// <summary>A full-screen child that keeps content inside the iPhone's safe area (notch, home indicator).</summary>
        public static RectTransform SafeArea(Transform canvas)
        {
            var rt = Rect("SafeArea", canvas);
            Stretch(rt);
            rt.gameObject.AddComponent<SafeAreaFitter>();
            return rt;
        }

        public static RectTransform Rect(string name, Transform parent)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent, false);
            return (RectTransform)go.transform;
        }

        public static void Stretch(RectTransform rt, float left = 0, float top = 0, float right = 0, float bottom = 0)
        {
            rt.anchorMin = Vector2.zero; rt.anchorMax = Vector2.one;
            rt.offsetMin = new Vector2(left, bottom); rt.offsetMax = new Vector2(-right, -top);
        }

        /// <summary>Anchors at a point (0..1), with the pivot at the same point, offset and sized in reference pixels.</summary>
        public static RectTransform Place(RectTransform rt, Vector2 anchor, Vector2 offset, Vector2 size)
        {
            rt.anchorMin = rt.anchorMax = anchor;
            rt.pivot = anchor;
            rt.anchoredPosition = offset;
            rt.sizeDelta = size;
            return rt;
        }

        public static Image MakeImage(string name, Transform parent, Color color, Sprite sprite = null)
        {
            var rt = Rect(name, parent);
            var img = rt.gameObject.AddComponent<Image>();
            img.color = color;
            if (sprite != null) { img.sprite = sprite; img.type = UnityEngine.UI.Image.Type.Sliced; }
            return img;
        }

        /// <summary>A sticker panel. Returns the root; put content in the returned "Content" child.</summary>
        public static RectTransform Panel(string name, Transform parent, Color fill, out RectTransform content, bool shadow = true, int radius = 28)
        {
            var root = Rect(name, parent);
            var sprite = TextureUtil.RoundedRect(radius);
            if (shadow)
            {
                var sh = MakeImage("Shadow", root, Colors.Navy, sprite);
                Stretch(sh.rectTransform, 0, ShadowDrop, 0, -ShadowDrop);
                sh.raycastTarget = false;
            }
            var border = MakeImage("Border", root, Colors.Navy, sprite);
            Stretch(border.rectTransform);
            var face = MakeImage("Fill", border.transform, fill, sprite);
            Stretch(face.rectTransform, Border, Border, Border, Border);
            content = Rect("Content", face.transform);
            Stretch(content);
            return root;
        }

        public static Text Label(Transform parent, string text, int size, Color color, Font font = null, TextAnchor align = TextAnchor.MiddleCenter, bool outline = false)
        {
            var rt = Rect("Label", parent);
            Stretch(rt);
            var t = rt.gameObject.AddComponent<Text>();
            t.font = font ?? Body;
            t.text = text;
            t.fontSize = size;
            t.color = color;
            t.alignment = align;
            t.horizontalOverflow = HorizontalWrapMode.Wrap;
            t.verticalOverflow = VerticalWrapMode.Overflow;
            t.raycastTarget = false;
            if (outline) StickerText(t);
            return t;
        }

        /// <summary>Big chunky title text: navy stroke plus a hard navy drop shadow.</summary>
        public static void StickerText(Text t, float stroke = 5f, float drop = 9f)
        {
            var o = t.gameObject.AddComponent<Outline>();
            o.effectColor = Colors.Navy;
            o.effectDistance = new Vector2(stroke, -stroke);
            var o2 = t.gameObject.AddComponent<Outline>();
            o2.effectColor = Colors.Navy;
            o2.effectDistance = new Vector2(-stroke, stroke);
            var s = t.gameObject.AddComponent<Shadow>();
            s.effectColor = Colors.Navy;
            s.effectDistance = new Vector2(0, -drop);
        }

        /// <summary>A lighter sticker stroke for small labels on busy backgrounds.</summary>
        public static void StickerTextLight(Text t)
        {
            var o = t.gameObject.AddComponent<Outline>();
            o.effectColor = Color.white;
            o.effectDistance = new Vector2(3, -3);
        }

        /// <summary>Pill button: navy shadow, navy border, gradient face. Presses down 5 px when tapped.</summary>
        public static Button Pill(string name, Transform parent, string label, Sprite face, Color textColor, Action onClick, int fontSize = 56, Font font = null)
        {
            var root = Rect(name, parent);
            var pill = TextureUtil.GradientPill(Color.white, Color.white, Color.white);

            var shadow = MakeImage("Shadow", root, Colors.Navy, pill);
            Stretch(shadow.rectTransform, 0, ShadowDrop, 0, -ShadowDrop);
            shadow.raycastTarget = false;

            var faceRoot = Rect("Face", root);
            Stretch(faceRoot);
            var border = MakeImage("Border", faceRoot, Colors.Navy, pill);
            Stretch(border.rectTransform);
            var fill = MakeImage("Fill", border.transform, Color.white, face);
            Stretch(fill.rectTransform, Border, Border, Border, Border);
            fill.raycastTarget = false;
            var text = Label(faceRoot, label, fontSize, textColor, font ?? Display);
            text.rectTransform.offsetMin = new Vector2(24, 0);
            text.rectTransform.offsetMax = new Vector2(-24, 4);

            var button = root.gameObject.AddComponent<Button>();
            button.targetGraphic = border;
            button.transition = Selectable.Transition.None;
            button.onClick.AddListener(() =>
            {
                SfxPlayer.Instance?.Play(KikiSafari.Core.Sfx.Button, 0.35f);
                Haptics.Play(KikiSafari.Core.HapticKind.Light);
                onClick?.Invoke();
            });
            var press = root.gameObject.AddComponent<PressDown>();
            press.Face = faceRoot;
            press.Shadow = shadow.rectTransform;
            return button;
        }

        public static void SetPillText(Button b, string text)
        {
            var t = b.GetComponentInChildren<Text>();
            if (t) t.text = text;
        }

        /// <summary>A short sticker message near the top of the screen.</summary>
        public static void Toast(MonoBehaviour host, Transform canvas, string message, float seconds = 2.2f, Color? fill = null)
        {
            var panel = Panel("Toast", canvas, fill ?? Colors.Cream, out var content);
            Place(panel, new Vector2(0.5f, 1f), new Vector2(0, -230), new Vector2(860, 150));
            Label(content, message, 46, Colors.Navy, Body);
            host.StartCoroutine(ToastLife(panel, seconds));
        }

        static IEnumerator ToastLife(RectTransform panel, float seconds)
        {
            var cg = panel.gameObject.AddComponent<CanvasGroup>();
            cg.blocksRaycasts = false;
            for (float t = 0; t < 0.25f; t += Time.unscaledDeltaTime)
            {
                if (!panel) yield break;
                panel.localScale = Vector3.one * Util.EaseOutBack(t / 0.25f);
                yield return null;
            }
            if (!panel) yield break;
            panel.localScale = Vector3.one;
            yield return new WaitForSecondsRealtime(seconds);
            for (float t = 0; t < 0.25f; t += Time.unscaledDeltaTime)
            {
                if (!panel) yield break;
                cg.alpha = 1 - t / 0.25f;
                yield return null;
            }
            if (panel) UnityEngine.Object.Destroy(panel.gameObject);
        }
    }

    /// <summary>Moves a button's face down while pressed, shrinking its shadow, like pressing a sticker.</summary>
    public sealed class PressDown : MonoBehaviour, IPointerDownHandler, IPointerUpHandler, IPointerExitHandler
    {
        public RectTransform Face, Shadow;
        bool _down;

        public void OnPointerDown(PointerEventData e) => Set(true);
        public void OnPointerUp(PointerEventData e) => Set(false);
        public void OnPointerExit(PointerEventData e) => Set(false);

        void Set(bool down)
        {
            if (_down == down || Face == null) return;
            _down = down;
            float d = down ? -Sticker.PressDepth : 0f;
            Face.offsetMin = new Vector2(0, d);
            Face.offsetMax = new Vector2(0, d);
            if (Shadow) Shadow.offsetMin = new Vector2(0, -Sticker.ShadowDrop + (down ? Sticker.PressDepth : 0));
        }
    }

    /// <summary>Fits a RectTransform to Screen.safeArea.</summary>
    public sealed class SafeAreaFitter : MonoBehaviour
    {
        Rect _last;
        void Update()
        {
            var sa = Screen.safeArea;
            if (sa == _last || Screen.width == 0) return;
            _last = sa;
            var rt = (RectTransform)transform;
            rt.anchorMin = new Vector2(sa.xMin / Screen.width, sa.yMin / Screen.height);
            rt.anchorMax = new Vector2(sa.xMax / Screen.width, sa.yMax / Screen.height);
            rt.offsetMin = rt.offsetMax = Vector2.zero;
        }
    }
}
