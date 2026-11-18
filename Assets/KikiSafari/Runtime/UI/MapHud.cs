using System;
using System.Collections;
using System.Collections.Generic;
using KikiSafari.Core;
using UnityEngine;
using UnityEngine.UI;

namespace KikiSafari
{
    /// <summary>Map overlay: home and Safari Log buttons, the logo, Rune Stone count, place labels and the Nearby list.</summary>
    public sealed class MapHud : MonoBehaviour
    {
        RectTransform _safe, _labels, _nearbyRow;
        Text _stones;
        Canvas _canvas;
        readonly List<RectTransform> _controls = new List<RectTransform>();
        readonly Dictionary<string, (RectTransform rt, Vector3 at)> _placeLabels = new Dictionary<string, (RectTransform, Vector3)>();
        Action<string> _onNearby;
        string _nearbySig = "";

        public static MapHud Make(Transform parent, GameRoot game, Action<string> onNearby, Action onLog, Action onHome)
        {
            var canvas = Sticker.MakeCanvas("MapHUD", 10, parent);
            var hud = canvas.gameObject.AddComponent<MapHud>();
            hud._canvas = canvas;
            hud._onNearby = onNearby;
            hud._labels = Sticker.Rect("PlaceLabels", canvas.transform);
            Sticker.Stretch(hud._labels);
            hud._safe = Sticker.SafeArea(canvas.transform);

            var home = Sticker.Pill("Home", hud._safe, "Home", Sticker.CreamGradient, Colors.Navy, onHome, 40);
            Sticker.Place((RectTransform)home.transform, new Vector2(0, 1), new Vector2(36, -36), new Vector2(180, 110));
            hud._controls.Add((RectTransform)home.transform);

            var log = Sticker.Pill("Log", hud._safe, "Safari Log", Sticker.SkyGradient, Color.white, onLog, 40);
            Sticker.Place((RectTransform)log.transform, new Vector2(0, 1), new Vector2(236, -36), new Vector2(270, 110));
            Sticker.StickerText(log.GetComponentInChildren<Text>(), 3f, 5f);
            hud._controls.Add((RectTransform)log.transform);

            var stones = Sticker.Panel("Stones", hud._safe, Colors.Cream, out var sc);
            Sticker.Place(stones, new Vector2(1, 1), new Vector2(-36, -36), new Vector2(230, 110));
            var icon = Sticker.MakeImage("Icon", sc, Color.white, IconSprites.RuneStone());
            icon.type = Image.Type.Simple; icon.preserveAspect = true;
            Sticker.Place(icon.rectTransform, new Vector2(0, 0.5f), new Vector2(12, 0), new Vector2(84, 84));
            hud._stones = Sticker.Label(sc, "0", 54, Colors.Navy, Sticker.Display, TextAnchor.MiddleRight);
            hud._stones.rectTransform.offsetMax = new Vector2(-22, 0);
            hud._controls.Add(stones);

            var logoTex = Resources.Load<Texture2D>("UI/logo");
            if (logoTex)
            {
                var logo = Sticker.Rect("Logo", hud._safe).gameObject.AddComponent<RawImage>();
                logo.texture = logoTex; logo.raycastTarget = false;
                float h = 120f, w = h * logoTex.width / logoTex.height;
                Sticker.Place(logo.rectTransform, new Vector2(0.5f, 1), new Vector2(0, -180), new Vector2(w, h));
            }

            hud._nearbyRow = Sticker.Rect("Nearby", hud._safe);
            Sticker.Place(hud._nearbyRow, new Vector2(0.5f, 0), new Vector2(0, 40), new Vector2(1040, 190));
            hud._controls.Add(hud._nearbyRow);
            return hud;
        }

        public void SetStones(int n) => _stones.text = n.ToString();

        public bool IsOverUi(Vector2 screen)
        {
            foreach (var c in _controls)
                if (c && c.gameObject.activeInHierarchy && RectTransformUtility.RectangleContainsScreenPoint(c, screen, null)) return true;
            return false;
        }

        public void Toast(string message) => Sticker.Toast(this, _safe, message);

        /// <summary>The Nearby list: up to five chips, nearest first; tap one to head to that Kiki.</summary>
        public void SetNearby(List<(string key, VariantDef def, Vector3 pos, float dist)> nearby)
        {
            var sig = new System.Text.StringBuilder();
            for (int i = 0; i < Mathf.Min(5, nearby.Count); i++) sig.Append(nearby[i].key).Append((int)(nearby[i].dist / 10));
            if (sig.ToString() == _nearbySig) return;
            _nearbySig = sig.ToString();
            foreach (Transform c in _nearbyRow) Destroy(c.gameObject);

            if (nearby.Count == 0)
            {
                var p = Sticker.Panel("Empty", _nearbyRow, Colors.Cream, out var ec);
                Sticker.Stretch(p, 140, 40, 140, 30);
                Sticker.Label(ec, "No Kikis nearby. Go explore!", 40, Colors.Muted, Sticker.Body);
                return;
            }
            var title = Sticker.Label(_nearbyRow, "NEARBY", 32, Colors.Navy, Sticker.Display, TextAnchor.UpperLeft);
            title.rectTransform.offsetMin = new Vector2(10, 0);
            Sticker.StickerTextLight(title);
            int n = Mathf.Min(5, nearby.Count);
            float w = 1040f / 5f;
            for (int i = 0; i < n; i++)
            {
                var item = nearby[i];
                var chip = Sticker.Panel("Chip", _nearbyRow, item.dist <= MapScreen.EncounterRange ? Colors.SunLight : Colors.Cream, out var cc, radius: 24);
                chip.anchorMin = chip.anchorMax = new Vector2(0, 0);
                chip.pivot = new Vector2(0, 0);
                chip.anchoredPosition = new Vector2(i * w + 6, 0);
                chip.sizeDelta = new Vector2(w - 14, 140);
                var dot = Sticker.MakeImage("Rarity", cc, Colors.RarityMain(item.def.Rarity), TextureUtil.RoundedRect(14));
                Sticker.Place(dot.rectTransform, new Vector2(0.5f, 1), new Vector2(0, -12), new Vector2(46, 14));
                var name = Sticker.Label(cc, item.def.DisplayName.Replace(" Kiki", ""), 30, Colors.Navy, Sticker.Display);
                name.rectTransform.offsetMax = new Vector2(-6, -18); name.rectTransform.offsetMin = new Vector2(6, 40);
                var dist = Sticker.Label(cc, item.dist <= MapScreen.EncounterRange ? "Tap!" : $"{item.dist:0} m", 28, Colors.Muted, Sticker.Body, TextAnchor.LowerCenter);
                dist.rectTransform.offsetMin = new Vector2(0, 10);
                var b = chip.gameObject.AddComponent<Button>();
                b.transition = Selectable.Transition.None;
                string key = item.key;
                b.onClick.AddListener(() => { SfxPlayer.Instance?.Play(Sfx.Button, 0.35f); _onNearby?.Invoke(key); });
            }
        }

        /// <summary>Sticker labels for the campground's named places, kept over their spots.</summary>
        public void UpdateLabels(Camera cam, MapWorld world, Vector3 player)
        {
            if (_placeLabels.Count == 0)
                foreach (var f in world.Map.Features)
                {
                    if (string.IsNullOrEmpty(f.Name) || f.Kind == MapFeatureKind.Area || _placeLabels.ContainsKey(f.Name)) continue;
                    var p = Sticker.Panel("Place_" + f.Name, _labels, Colors.Cream, out var c, radius: 22);
                    p.sizeDelta = new Vector2(f.Name.Length * 22 + 70, 76);
                    p.pivot = new Vector2(0.5f, 0);
                    Sticker.Label(c, f.Name, 36, Colors.Navy, Sticker.Display);
                    var ctr = f.Center;
                    _placeLabels[f.Name] = (p, new Vector3((float)ctr.East, f.Kind == MapFeatureKind.Stop ? 16f : 8f, (float)ctr.North));
                }
            var canvasRt = (RectTransform)_canvas.transform;
            float scale = canvasRt.rect.width / Screen.width;
            foreach (var kv in _placeLabels)
            {
                var sp = cam.WorldToScreenPoint(kv.Value.at);
                bool on = sp.z > 0 && (kv.Value.at - player).magnitude < 260f;
                kv.Value.rt.gameObject.SetActive(on);
                if (!on) continue;
                kv.Value.rt.anchorMin = kv.Value.rt.anchorMax = Vector2.zero;
                kv.Value.rt.anchoredPosition = new Vector2(sp.x, sp.y) * scale;
            }
        }
    }

    /// <summary>The Safari Log: all six variants, caught counts, and the player's Sprouts.</summary>
    public sealed class SafariLogScreen : MonoBehaviour
    {
        public static SafariLogScreen Show(Transform parent, GameRoot game, Action onClose)
        {
            var canvas = Sticker.MakeCanvas("SafariLog", 30, parent);
            var s = canvas.gameObject.AddComponent<SafariLogScreen>();
            var dim = Sticker.MakeImage("Dim", canvas.transform, new Color(0.09f, 0.14f, 0.48f, 0.55f));
            Sticker.Stretch(dim.rectTransform);
            var safe = Sticker.SafeArea(canvas.transform);
            var panel = Sticker.Panel("Log", safe, Colors.Cream, out var c);
            Sticker.Stretch(panel, 50, 120, 50, 120);
            var title = Sticker.Label(c, "Safari Log", 84, Colors.Sun, Sticker.Display, TextAnchor.UpperCenter);
            title.rectTransform.offsetMax = new Vector2(0, -30);
            Sticker.StickerText(title, 5f, 9f);
            int caughtKinds = 0;
            foreach (var d in game.Library.Defs) if (game.Progress.HasCaught(d.Id)) caughtKinds++;
            var sub = Sticker.Label(c, $"{caughtKinds} of {game.Library.Defs.Count} found  ·  {game.Progress.Sprouts} Sprouts", 40, Colors.Muted, Sticker.Body, TextAnchor.UpperCenter);
            sub.rectTransform.offsetMax = new Vector2(0, -150);

            float y = -240;
            foreach (var d in game.Library.Defs)
            {
                int n = game.Progress.CountOf(d.Id);
                var row = Sticker.Panel("Row", c, n > 0 ? Color.white : new Color(0.93f, 0.92f, 0.86f), out var rc, radius: 24);
                row.anchorMin = new Vector2(0, 1); row.anchorMax = new Vector2(1, 1); row.pivot = new Vector2(0.5f, 1);
                row.offsetMin = new Vector2(40, y - 150); row.offsetMax = new Vector2(-40, y);
                var dot = Sticker.MakeImage("Rarity", rc, Colors.RarityMain(d.Rarity), TextureUtil.RoundedRect(28));
                Sticker.Place(dot.rectTransform, new Vector2(0, 0.5f), new Vector2(26, 0), new Vector2(70, 70));
                var name = Sticker.Label(rc, n > 0 ? d.DisplayName : "???", 50, Colors.Navy, Sticker.Display, TextAnchor.MiddleLeft);
                name.rectTransform.offsetMin = new Vector2(120, 34);
                var rar = Sticker.Label(rc, RarityInfo.Label(d.Rarity), 30, Colors.RaritySecond(d.Rarity), Sticker.Body, TextAnchor.MiddleLeft);
                rar.rectTransform.offsetMin = new Vector2(122, 0); rar.rectTransform.offsetMax = new Vector2(0, -60);
                var count = Sticker.Label(rc, n > 0 ? $"×{n}" : "", 56, Colors.Navy, Sticker.Display, TextAnchor.MiddleRight);
                count.rectTransform.offsetMax = new Vector2(-30, 0);
                y -= 168;
            }
            var close = Sticker.Pill("Close", c, "Back to the map", Sticker.PlayGradient, Colors.Navy, () => { Destroy(canvas.gameObject); onClose?.Invoke(); }, 54);
            Sticker.Place((RectTransform)close.transform, new Vector2(0.5f, 0), new Vector2(0, 40), new Vector2(600, 130));
            return s;
        }
    }
}
