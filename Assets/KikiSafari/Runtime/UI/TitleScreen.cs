using System;
using UnityEngine;
using UnityEngine.UI;

namespace KikiSafari
{
    /// <summary>
    /// Title: the official meadow art, the KIKI SAFARI logo, Play (Live Safari through the camera, at your real location),
    /// the practice campground, sound and motion settings, and the launch reminder to watch your surroundings.
    /// </summary>
    public sealed class TitleScreen : MonoBehaviour
    {
        RectTransform _logo;

        public static TitleScreen Show(Transform parent, Action onPlay, Action onPractice)
        {
            var canvas = Sticker.MakeCanvas("Title", 40, parent);
            var t = canvas.gameObject.AddComponent<TitleScreen>();

            var bgTex = Resources.Load<Texture2D>("UI/meadow");
            var bg = Sticker.Rect("Meadow", canvas.transform).gameObject.AddComponent<RawImage>();
            Sticker.Stretch(bg.rectTransform);
            if (bgTex)
            {
                bg.texture = bgTex;
                // Cover the portrait screen: crop the landscape art to the centre.
                float screenAspect = (float)Screen.width / Mathf.Max(1, Screen.height), texAspect = (float)bgTex.width / bgTex.height;
                float w = screenAspect / texAspect;
                bg.uvRect = new Rect(0.5f - w / 2, 0, w, 1);
            }
            else bg.color = Colors.Sky;

            var safe = Sticker.SafeArea(canvas.transform);
            var logoTex = Resources.Load<Texture2D>("UI/logo");
            if (logoTex)
            {
                var logo = Sticker.Rect("Logo", safe).gameObject.AddComponent<RawImage>();
                logo.texture = logoTex;
                float w = 1020f, h = w * logoTex.height / logoTex.width;
                Sticker.Place(logo.rectTransform, new Vector2(0.5f, 1), new Vector2(0, -170), new Vector2(w, h));
                t._logo = logo.rectTransform;
            }

            var play = Sticker.Pill("Play", safe, "Play", Sticker.PlayGradient, Colors.Navy, () => { Destroy(canvas.gameObject); onPlay?.Invoke(); }, 84);
            Sticker.Place((RectTransform)play.transform, new Vector2(0.5f, 0), new Vector2(0, 560), new Vector2(620, 190));

            var practice = Sticker.Pill("Practice", safe, "Practice campground", Sticker.SkyGradient, Color.white, () => { Destroy(canvas.gameObject); onPractice?.Invoke(); }, 40);
            Sticker.Place((RectTransform)practice.transform, new Vector2(0.5f, 0), new Vector2(0, 400), new Vector2(560, 110));
            Sticker.StickerText(practice.GetComponentInChildren<Text>(), 3f, 5f);

            Button sound = null, motion = null;
            sound = Sticker.Pill("Sound", safe, SoundLabel(), Sticker.CreamGradient, Colors.Navy, () =>
            {
                SoundSettings.On = !SoundSettings.On;
                Sticker.SetPillText(sound, SoundLabel());
            }, 36, Sticker.Body);
            Sticker.Place((RectTransform)sound.transform, new Vector2(0.5f, 0), new Vector2(-190, 250), new Vector2(340, 110));
            motion = Sticker.Pill("Motion", safe, MotionLabel(), Sticker.CreamGradient, Colors.Navy, () =>
            {
                Accessibility.Preference = (MotionPreference)(((int)Accessibility.Preference + 1) % 3);
                Sticker.SetPillText(motion, MotionLabel());
            }, 36, Sticker.Body);
            Sticker.Place((RectTransform)motion.transform, new Vector2(0.5f, 0), new Vector2(190, 250), new Vector2(340, 110));

            var note = Sticker.Panel("Safety", safe, Colors.Cream, out var nc);
            Sticker.Place(note, new Vector2(0.5f, 0), new Vector2(0, 70), new Vector2(900, 130));
            Sticker.Label(nc, "Heads up! Watch your surroundings while you play.", 36, Colors.Navy, Sticker.Body);
            return t;
        }

        static string SoundLabel() => SoundSettings.On ? "Sound: on" : "Sound: off";

        static string MotionLabel()
        {
            switch (Accessibility.Preference)
            {
                case MotionPreference.Reduced: return "Motion: reduced";
                case MotionPreference.Full: return "Motion: full";
                default: return "Motion: auto";
            }
        }

        void Update()
        {
            // The logo bobs gently, like a sticker on a bass bin.
            if (_logo && !Accessibility.ReducedMotion)
                _logo.localScale = Vector3.one * (1f + Mathf.Sin(Time.time * Mathf.PI * 2 * 70f / 60f) * 0.012f);
        }
    }
}
