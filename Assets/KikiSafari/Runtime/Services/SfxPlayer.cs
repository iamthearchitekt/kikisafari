using System.Collections.Generic;
using KikiSafari.Core;
using UnityEngine;

namespace KikiSafari
{
    /// <summary>
    /// Short chiptune blips (square and triangle waves), synthesized at start-up so no audio files are needed.
    /// Voice clips ("yay", "awww") load from Resources/Audio when the claw game's files are added; until then a quiet
    /// synthesized squeak stands in. Voices are quiet and play about half the time.
    /// </summary>
    public sealed class SfxPlayer : MonoBehaviour
    {
        const int Rate = 44100;
        const float VoiceVolume = 0.35f;

        readonly Dictionary<Sfx, AudioClip> _clips = new Dictionary<Sfx, AudioClip>();
        AudioClip _yay, _awww;
        AudioSource _source, _voice;

        public static SfxPlayer Instance { get; private set; }

        void Awake()
        {
            Instance = this;
            _source = gameObject.AddComponent<AudioSource>();
            _source.playOnAwake = false;
            _voice = gameObject.AddComponent<AudioSource>();
            _voice.playOnAwake = false;
            _voice.volume = VoiceVolume;
            Build();
            AudioListener.volume = SoundSettings.On ? 1f : 0f;
        }

        public void Play(Sfx s, float volume = 0.5f, float pitch = 1f)
        {
            if (s == Sfx.None || !_clips.TryGetValue(s, out var c)) return;
            _source.pitch = pitch;
            _source.PlayOneShot(c, volume);
        }

        public void PlayVoice(Voice v, float chance)
        {
            if (v == Voice.None || Random.value > chance) return;
            var c = v == Voice.Yay ? _yay : _awww;
            if (c != null) _voice.PlayOneShot(c, 1f);
        }

        enum Wave { Square, Triangle, Noise }

        struct Note
        {
            public float From, To, Seconds, Volume; public Wave Wave;
            public Note(Wave w, float from, float to, float seconds, float volume = 1f) { Wave = w; From = from; To = to; Seconds = seconds; Volume = volume; }
        }

        void Build()
        {
            _clips[Sfx.Tick] = Synth("tick", new Note(Wave.Square, 1800, 1800, 0.02f, 0.4f));
            _clips[Sfx.Button] = Synth("button", new Note(Wave.Square, 880, 1320, 0.05f, 0.5f));
            _clips[Sfx.Throw] = Synth("throw", new Note(Wave.Triangle, 300, 900, 0.16f));
            _clips[Sfx.Hit] = Synth("hit", new Note(Wave.Square, 1200, 1700, 0.05f, 0.6f), new Note(Wave.Triangle, 2400, 2600, 0.08f, 0.5f));
            _clips[Sfx.Wobble] = Synth("wobble", new Note(Wave.Triangle, 230, 150, 0.13f), new Note(Wave.Noise, 0, 0, 0.03f, 0.25f));
            _clips[Sfx.Burst] = Synth("burst", new Note(Wave.Square, 1047, 1047, 0.06f, 0.6f), new Note(Wave.Square, 1319, 1319, 0.06f, 0.6f),
                new Note(Wave.Square, 1568, 1568, 0.06f, 0.6f), new Note(Wave.Square, 2093, 2093, 0.18f, 0.6f));
            _clips[Sfx.Stamp] = Synth("stamp", new Note(Wave.Noise, 0, 0, 0.04f, 0.5f), new Note(Wave.Square, 160, 110, 0.12f, 0.8f));
            _clips[Sfx.CountTick] = Synth("count", new Note(Wave.Square, 2000, 2000, 0.015f, 0.3f));
            _clips[Sfx.BreakOut] = Synth("breakout", new Note(Wave.Square, 700, 300, 0.22f, 0.6f));
            _clips[Sfx.Bounce] = Synth("bounce", new Note(Wave.Triangle, 320, 190, 0.09f));
            _clips[Sfx.Fizzle] = Synth("fizzle", new Note(Wave.Noise, 0, 0, 0.3f, 0.35f));
            _clips[Sfx.Pickup] = Synth("pickup", new Note(Wave.Square, 784, 784, 0.05f, 0.5f), new Note(Wave.Square, 1175, 1175, 0.05f, 0.5f), new Note(Wave.Square, 1568, 1568, 0.1f, 0.5f));

            _yay = Resources.Load<AudioClip>("Audio/yay") ?? Synth("yay", new Note(Wave.Triangle, 520, 760, 0.12f, 0.8f), new Note(Wave.Triangle, 760, 1040, 0.22f, 0.8f));
            _awww = Resources.Load<AudioClip>("Audio/awww") ?? Resources.Load<AudioClip>("Audio/slip") ?? Synth("awww", new Note(Wave.Triangle, 660, 600, 0.12f, 0.7f), new Note(Wave.Triangle, 600, 330, 0.45f, 0.7f));
        }

        static AudioClip Synth(string name, params Note[] notes)
        {
            int total = 0;
            foreach (var n in notes) total += Mathf.CeilToInt(n.Seconds * Rate);
            var data = new float[total];
            int i = 0;
            uint noise = 22222;
            foreach (var n in notes)
            {
                int len = Mathf.CeilToInt(n.Seconds * Rate);
                double phase = 0;
                for (int k = 0; k < len; k++, i++)
                {
                    float t = k / (float)len;
                    float f = Mathf.Lerp(n.From, n.To, t);
                    phase += f / Rate;
                    float p = (float)(phase - System.Math.Floor(phase));
                    float s;
                    switch (n.Wave)
                    {
                        case Wave.Square: s = p < 0.5f ? 1f : -1f; break;
                        case Wave.Triangle: s = 4f * Mathf.Abs(p - 0.5f) - 1f; break;
                        default: noise ^= noise << 13; noise ^= noise >> 17; noise ^= noise << 5; s = (noise / (float)uint.MaxValue) * 2 - 1; break;
                    }
                    // Short attack, smooth release: no clicks.
                    float env = Mathf.Min(1f, k / (Rate * 0.004f)) * Mathf.Pow(1f - t, 1.5f);
                    data[i] = s * env * n.Volume * 0.35f;
                }
            }
            var clip = AudioClip.Create(name, total, 1, Rate, false);
            clip.SetData(data, 0);
            return clip;
        }
    }
}
