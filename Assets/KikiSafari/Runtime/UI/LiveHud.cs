using System;
using System.Collections.Generic;
using KikiSafari.Core;
using UnityEngine;
using UnityEngine.UI;

namespace KikiSafari
{
    /// <summary>
    /// Overlay for the camera world view: Safari Log, logo, Rune Stone count, a compass radar, floating sticker labels
    /// over what you can see, a Nearby strip with direction arrows, status banners, and the Rune Circle panel.
    /// </summary>
    public sealed class LiveHud : MonoBehaviour
    {
        GameRoot _game;
        LiveScreen _screen;
        Canvas _canvas;
        RectTransform _safe, _labels, _radar, _radarDots, _nearby, _status, _panelRoot;
        Text _stones, _statusText;
        Button _mapButton;
        RectTransform _attribution;
        readonly List<RectTransform> _controls = new List<RectTransform>();
        readonly List<Image> _dotPool = new List<Image>();
        readonly Dictionary<string, (RectTransform rt, Text text)> _labelPool = new Dictionary<string, (RectTransform, Text)>();
        readonly List<(RectTransform rt, Text name, Text dist, RectTransform arrow, Image dot)> _chips = new List<(RectTransform, Text, Text, RectTransform, Image)>();
        const float RadarRange = 100f;
        const float RadarSize = 330f;

        public static LiveHud Make(Transform parent, GameRoot game, LiveScreen screen)
        {
            var canvas = Sticker.MakeCanvas("LiveHUD", 10, parent);
            var h = canvas.gameObject.AddComponent<LiveHud>();
            h._game = game; h._screen = screen; h._canvas = canvas;
            h._labels = Sticker.Rect("Labels", canvas.transform);
            Sticker.Stretch(h._labels);
            h._safe = Sticker.SafeArea(canvas.transform);

            var log = Sticker.Pill("Log", h._safe, "Safari Log", Sticker.SkyGradient, Color.white, () => game.ShowLog(), 40);
            Sticker.Place((RectTransform)log.transform, new Vector2(0, 1), new Vector2(36, -36), new Vector2(270, 110));
            Sticker.StickerText(log.GetComponentInChildren<Text>(), 3f, 5f);
            h._controls.Add((RectTransform)log.transform);

            var home = Sticker.Pill("Home", h._safe, "Home", Sticker.CreamGradient, Colors.Navy, () => game.ShowTitle(), 40);
            Sticker.Place((RectTransform)home.transform, new Vector2(0, 1), new Vector2(36, -166), new Vector2(180, 100));
            h._controls.Add((RectTransform)home.transform);

            var stones = Sticker.Panel("Stones", h._safe, Colors.Cream, out var sc);
            Sticker.Place(stones, new Vector2(1, 1), new Vector2(-36, -36), new Vector2(230, 110));
            var icon = Sticker.MakeImage("Icon", sc, Color.white, IconSprites.RuneStone());
            icon.type = Image.Type.Simple; icon.preserveAspect = true;
            Sticker.Place(icon.rectTransform, new Vector2(0, 0.5f), new Vector2(12, 0), new Vector2(84, 84));
            h._stones = Sticker.Label(sc, "0", 54, Colors.Navy, Sticker.Display, TextAnchor.MiddleRight);
            h._stones.rectTransform.offsetMax = new Vector2(-22, 0);

            var logoTex = Resources.Load<Texture2D>("UI/logo");
            if (logoTex)
            {
                var logo = Sticker.Rect("Logo", h._safe).gameObject.AddComponent<RawImage>();
                logo.texture = logoTex; logo.raycastTarget = false;
                float lh = 96f;
                Sticker.Place(logo.rectTransform, new Vector2(0.5f, 1), new Vector2(40, -42), new Vector2(lh * logoTex.width / logoTex.height, lh));
            }

            h._status = Sticker.Panel("Status", h._safe, Colors.Cream, out var stc);
            Sticker.Place(h._status, new Vector2(0.5f, 1), new Vector2(0, -300), new Vector2(900, 110));
            h._statusText = Sticker.Label(stc, "", 38, Colors.Navy, Sticker.Body);
            h._status.gameObject.SetActive(false);

            h.BuildRadar();
            h.BuildNearby();

            h._mapButton = Sticker.Pill("MapToggle", h._safe, "Map", Sticker.SkyGradient, Color.white, () => screen.ToggleMap(), 44);
            Sticker.Place((RectTransform)h._mapButton.transform, new Vector2(1, 0), new Vector2(-36, 50 + RadarSize + 24), new Vector2(240, 110));
            Sticker.StickerText(h._mapButton.GetComponentInChildren<Text>(), 3f, 5f);
            h._controls.Add((RectTransform)h._mapButton.transform);

            // Required credit for the map data.
            h._attribution = Sticker.Panel("Attribution", h._safe, new Color(1, 0.97f, 0.87f, 0.9f), out var ac, shadow: false, radius: 16);
            Sticker.Place(h._attribution, new Vector2(0, 0), new Vector2(36, 50), new Vector2(430, 56));
            Sticker.Label(ac, OsmArea.Attribution, 26, Colors.Navy, Sticker.BodyMedium);
            h._attribution.gameObject.SetActive(false);
            return h;
        }

        void BuildRadar()
        {
            _radar = Sticker.Panel("Radar", _safe, Colors.Cream, out var c, radius: (int)(RadarSize / 2 - 2));
            Sticker.Place(_radar, new Vector2(0, 0), new Vector2(36, 50), new Vector2(RadarSize, RadarSize));
            var inner = Sticker.MakeImage("Range40", c, new Color(0.24f, 0.26f, 0.45f, 0.10f), TextureUtil.RoundedRect(60));
            float r40 = (RadarSize - 24) * 0.5f * (LiveWorldPlanner.ActionRange / RadarRange) * 2f;
            Sticker.Place(inner.rectTransform, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(r40, r40));
            _radarDots = Sticker.Rect("Dots", c);
            Sticker.Stretch(_radarDots);
            var me = Sticker.MakeImage("Me", c, Colors.Navy, ArrowSprite());
            me.type = Image.Type.Simple;
            Sticker.Place(me.rectTransform, new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(40, 46));
            var n = Sticker.Label(c, "N", 30, Colors.Pink, Sticker.Display);
            n.rectTransform.anchorMin = n.rectTransform.anchorMax = new Vector2(0.5f, 0.5f);
            n.rectTransform.sizeDelta = new Vector2(40, 40);
            n.name = "North";
        }

        void BuildNearby()
        {
            _nearby = Sticker.Rect("Nearby", _safe);
            _nearby.anchorMin = new Vector2(0, 0); _nearby.anchorMax = new Vector2(1, 0); _nearby.pivot = new Vector2(1, 0);
            _nearby.offsetMin = new Vector2(RadarSize + 60, 50); _nearby.offsetMax = new Vector2(-30, 50 + RadarSize);
            for (int i = 0; i < 3; i++)
            {
                var chip = Sticker.Panel("Chip" + i, _nearby, Colors.Cream, out var cc, radius: 24);
                chip.anchorMin = new Vector2(0, 1 - (i + 1) / 3f); chip.anchorMax = new Vector2(1, 1 - i / 3f);
                chip.offsetMin = new Vector2(0, 8); chip.offsetMax = new Vector2(0, -8);
                var dot = Sticker.MakeImage("Rarity", cc, Color.white, TextureUtil.RoundedRect(14));
                Sticker.Place(dot.rectTransform, new Vector2(0, 0.5f), new Vector2(18, 0), new Vector2(26, 26));
                var name = Sticker.Label(cc, "", 34, Colors.Navy, Sticker.Display, TextAnchor.MiddleLeft);
                name.rectTransform.offsetMin = new Vector2(58, 0); name.rectTransform.offsetMax = new Vector2(-170, 0);
                var dist = Sticker.Label(cc, "", 32, Colors.Muted, Sticker.Body, TextAnchor.MiddleRight);
                dist.rectTransform.offsetMax = new Vector2(-70, 0);
                var arrow = Sticker.MakeImage("Arrow", cc, Colors.Pink, ArrowSprite());
                arrow.type = Image.Type.Simple;
                Sticker.Place(arrow.rectTransform, new Vector2(1, 0.5f), new Vector2(-34, 0), new Vector2(36, 42));
                arrow.rectTransform.pivot = new Vector2(0.5f, 0.5f);
                _chips.Add((chip, name, dist, arrow.rectTransform, dot));
            }
        }

        static Sprite _arrow;
        static Sprite ArrowSprite()
        {
            if (_arrow) return _arrow;
            int s = 64;
            var c = new Core.Art.Canvas(s, s, new Core.Art.Rgba(1, 1, 1, 0));
            c.FillPolygon(new[] { new Core.Art.P2(32, 4), new Core.Art.P2(58, 58), new Core.Art.P2(32, 44), new Core.Art.P2(6, 58) }, new Core.Art.Rgba(1, 1, 1));
            var t = new Texture2D(s, s, TextureFormat.RGBA32, false);
            t.SetPixelData(c.ToBytes(true), 0); t.Apply();
            _arrow = Sprite.Create(t, new Rect(0, 0, s, s), new Vector2(0.5f, 0.5f), 100);
            return _arrow;
        }

        public void SetStones(int n) => _stones.text = n.ToString();

        public void SetMapMode(bool map)
        {
            Sticker.SetPillText(_mapButton, map ? "Camera" : "Map");
            _radar.gameObject.SetActive(!map);
            _labels.gameObject.SetActive(!map);
            _attribution.gameObject.SetActive(map);
        }

        public void SetStatus(string text)
        {
            bool on = !string.IsNullOrEmpty(text);
            if (_status.gameObject.activeSelf != on) _status.gameObject.SetActive(on);
            if (on) _statusText.text = text;
        }

        public void Toast(string message) => Sticker.Toast(this, _safe, message);

        public bool IsOverUi(Vector2 screen)
        {
            if (_panelRoot) return true;
            foreach (var c in _controls)
                if (c && c.gameObject.activeInHierarchy && RectTransformUtility.RectangleContainsScreenPoint(c, screen, null)) return true;
            return (_radar.gameObject.activeInHierarchy && RectTransformUtility.RectangleContainsScreenPoint(_radar, screen, null))
                || RectTransformUtility.RectangleContainsScreenPoint(_nearby, screen, null);
        }

        static Color KindColor(WorldThing t) =>
            t.Kind == ThingKind.Kiki ? Colors.RarityMain(t.Variant.Rarity) : t.Kind == ThingKind.Stop ? Colors.Pink : Colors.UvPurple;

        public void Tick(Camera cam, List<WorldThing> things, Dictionary<string, WorldView> views, DeviceLocation loc)
        {
            float heading = loc.Heading;
            float half = (RadarSize - 24) * 0.5f;

            // Radar: up is the way the phone faces.
            int d = 0;
            foreach (var t in things)
            {
                if (t.Distance > RadarRange) continue;
                if (d >= _dotPool.Count)
                {
                    var img = Sticker.MakeImage("Dot", _radarDots, Color.white, TextureUtil.RoundedRect(14));
                    img.raycastTarget = false;
                    _dotPool.Add(img);
                }
                var dot = _dotPool[d++];
                dot.gameObject.SetActive(true);
                dot.color = KindColor(t);
                float size = t.Kind == ThingKind.Circle ? 34 : t.Kind == ThingKind.Stop ? 22 : 26;
                dot.rectTransform.sizeDelta = new Vector2(size, size);
                float a = (float)(t.Bearing - heading) * Mathf.Deg2Rad, r = (float)t.Distance / RadarRange * half;
                dot.rectTransform.anchorMin = dot.rectTransform.anchorMax = new Vector2(0.5f, 0.5f);
                dot.rectTransform.anchoredPosition = new Vector2(Mathf.Sin(a) * r, Mathf.Cos(a) * r);
            }
            for (int i = d; i < _dotPool.Count; i++) _dotPool[i].gameObject.SetActive(false);
            var north = _radar.Find("Border/Fill/Content/North") as RectTransform;
            if (north) { float na = -heading * Mathf.Deg2Rad; north.anchoredPosition = new Vector2(Mathf.Sin(na), Mathf.Cos(na)) * (half - 18); }

            // Nearby strip: the three nearest Kikis or circles, with an arrow toward each.
            int c = 0;
            foreach (var t in things)
            {
                if (c >= _chips.Count) break;
                if (t.Kind == ThingKind.Stop) continue;
                var ch = _chips[c++];
                ch.rt.gameObject.SetActive(true);
                ch.name.text = t.Kind == ThingKind.Circle ? "Rune Circle" : t.Name.Replace(" Kiki", "");
                ch.dist.text = t.Distance <= LiveWorldPlanner.ActionRange ? "Tap it!" : $"{t.Distance:0} m";
                ch.dot.color = KindColor(t);
                ch.arrow.localRotation = Quaternion.Euler(0, 0, -(float)(t.Bearing - heading));
            }
            for (int i = c; i < _chips.Count; i++) _chips[i].rt.gameObject.SetActive(false);

            // Floating labels over what's in view.
            var canvasRt = (RectTransform)_canvas.transform;
            float scale = canvasRt.rect.width / Mathf.Max(1, Screen.width);
            var used = new HashSet<string>();
            foreach (var kv in views)
            {
                var v = kv.Value; var t = v.Thing;
                float lift = t.Kind == ThingKind.Circle ? 3.9f : t.Kind == ThingKind.Stop ? 2.8f : 1.1f * v.transform.localScale.y;
                var sp = cam.WorldToScreenPoint(v.transform.position + Vector3.up * lift);
                if (sp.z <= 0) continue;
                used.Add(kv.Key);
                if (!_labelPool.TryGetValue(kv.Key, out var lab))
                {
                    var p = Sticker.Panel("Label", _labels, Colors.Cream, out var lc, radius: 20);
                    p.pivot = new Vector2(0.5f, 0);
                    var tx = Sticker.Label(lc, "", 30, Colors.Navy, Sticker.Display);
                    lab = (p, tx);
                    _labelPool[kv.Key] = lab;
                }
                string txt = t.Kind == ThingKind.Circle ? $"{t.Name} · {t.Distance:0} m"
                    : t.Kind == ThingKind.Stop ? $"Supply Stop · {t.Distance:0} m"
                    : $"{t.Name} · {t.Distance:0} m";
                if (t.Distance <= LiveWorldPlanner.ActionRange && t.Kind != ThingKind.Circle) txt = t.Kind == ThingKind.Stop ? "Supply Stop · tap!" : $"{t.Name} · tap!";
                lab.text.text = txt;
                lab.rt.sizeDelta = new Vector2(txt.Length * 17 + 56, 66);
                lab.rt.anchorMin = lab.rt.anchorMax = Vector2.zero;
                lab.rt.anchoredPosition = new Vector2(sp.x, sp.y) * scale;
                lab.rt.gameObject.SetActive(true);
                float k = Mathf.Clamp(1.3f - (float)t.Distance / 90f, 0.7f, 1.1f);
                lab.rt.localScale = Vector3.one * k;
            }
            var stale = new List<string>();
            foreach (var kv in _labelPool) if (!used.Contains(kv.Key)) { if (!views.ContainsKey(kv.Key)) stale.Add(kv.Key); else kv.Value.rt.gameObject.SetActive(false); }
            foreach (var k in stale) { Destroy(_labelPool[k].rt.gameObject); _labelPool.Remove(k); }
        }

        // ---------- Rune Circle panel ----------

        public void ShowCircle(WorldThing t)
        {
            if (_panelRoot) Destroy(_panelRoot.gameObject);
            _panelRoot = Sticker.Rect("CirclePanelRoot", _safe);
            Sticker.Stretch(_panelRoot);
            var dim = Sticker.MakeImage("Dim", _panelRoot, new Color(0.09f, 0.04f, 0.24f, 0.45f));
            Sticker.Stretch(dim.rectTransform);
            var p = Sticker.Panel("Circle", _panelRoot, Colors.Cream, out var c);
            Sticker.Place(p, new Vector2(0.5f, 0.5f), new Vector2(0, -60), new Vector2(940, 1040));

            var title = Sticker.Label(c, t.Name, 68, Colors.UvPurple, Sticker.Display, TextAnchor.UpperCenter);
            title.rectTransform.offsetMax = new Vector2(0, -30);
            Sticker.StickerTextLight(title);

            long now = Util.UnixNow();
            string surge = PortalSurge.Active(now)
                ? $"PORTAL SURGE! Rare Kikis are pouring out ({PortalSurge.SecondsLeft(now) / 60} min left)"
                : $"Next Portal Surge in {PortalSurge.SecondsUntilNext(now) / 3600}h {PortalSurge.SecondsUntilNext(now) % 3600 / 60:00}m";
            var surgeText = Sticker.Label(c, surge, 34, PortalSurge.Active(now) ? Colors.Pink : Colors.Muted, Sticker.Body, TextAnchor.UpperCenter);
            surgeText.rectTransform.offsetMax = new Vector2(-40, -130); surgeText.rectTransform.offsetMin = new Vector2(40, 0);

            string keeperLine = t.Mine
                ? $"Your {t.Variant.DisplayName} keeps this circle.\nAttunement {t.KeeperAttunement}"
                : $"Keeper: a wild {t.Variant.DisplayName}\nAttunement {t.KeeperAttunement}";
            var keeper = Sticker.Label(c, keeperLine, 44, Colors.Navy, Sticker.Body, TextAnchor.UpperCenter);
            keeper.rectTransform.offsetMax = new Vector2(-40, -250); keeper.rectTransform.offsetMin = new Vector2(40, 0);

            string how = t.Mine
                ? "While your Kiki keeps it, the circle gathers Sprouts for you. Come back to collect them."
                : "Begin the Spiral Rite: tap as each ring of light lands on the rune. Out-attune the Keeper and your Kiki takes the circle.";
            var howText = Sticker.Label(c, how, 36, Colors.Muted, Sticker.BodyMedium, TextAnchor.UpperCenter);
            howText.rectTransform.offsetMax = new Vector2(-60, -420); howText.rectTransform.offsetMin = new Vector2(60, 0);

            if (t.Mine)
            {
                var collect = Sticker.Pill("Collect", c, "Collect Sprouts", Sticker.PlayGradient, Colors.Navy, () =>
                {
                    int got = _game.Progress.CollectCircle(t.Id, Util.UnixNow());
                    _game.SaveProgress();
                    Toast(got > 0 ? $"+{got} Sprouts from the circle!" : "Nothing yet. Circles gather 20 Sprouts every half hour.");
                    if (got > 0) { Haptics.Play(HapticKind.Success); SfxPlayer.Instance?.Play(Sfx.Pickup, 0.5f); }
                }, 54);
                Sticker.Place((RectTransform)collect.transform, new Vector2(0.5f, 0), new Vector2(0, 200), new Vector2(620, 140));
            }
            else
            {
                bool hasKiki = _game.Progress.Catches.Count > 0;
                var begin = Sticker.Pill("Begin", c, hasKiki ? "Begin the Spiral Rite" : "Catch a Kiki first", Sticker.PlayGradient, Colors.Navy, () =>
                {
                    if (!hasKiki) { Toast("Catch a Kiki first, then come back to challenge the Keeper."); return; }
                    CloseCircle();
                    _screen.BeginRite(t);
                }, 52);
                Sticker.Place((RectTransform)begin.transform, new Vector2(0.5f, 0), new Vector2(0, 200), new Vector2(680, 140));
                if (!hasKiki) begin.gameObject.AddComponent<CanvasGroup>().alpha = 0.6f;
            }
            var close = Sticker.Pill("Close", c, "Close", Sticker.CreamGradient, Colors.Navy, CloseCircle, 44, Sticker.Body);
            Sticker.Place((RectTransform)close.transform, new Vector2(0.5f, 0), new Vector2(0, 50), new Vector2(300, 110));
        }

        void CloseCircle()
        {
            if (_panelRoot) Destroy(_panelRoot.gameObject);
            _panelRoot = null;
        }
    }
}
