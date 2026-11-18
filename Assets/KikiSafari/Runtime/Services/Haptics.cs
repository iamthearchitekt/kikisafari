using System;
using System.Runtime.InteropServices;
using KikiSafari.Core;
using UnityEngine;

namespace KikiSafari
{
    /// <summary>
    /// The seven-pattern haptic vocabulary, native on iPhone (UIKit feedback generators) and Android (VibrationEffect).
    /// Every haptic has a matching visual; <see cref="Played"/> lets the debug overlay show them in the editor.
    /// </summary>
    public static class Haptics
    {
        public static event Action<HapticKind> Played;
        public static bool Enabled = true;

#if UNITY_IOS && !UNITY_EDITOR
        [DllImport("__Internal")] static extern void KikiNative_Haptic(int kind);
        [DllImport("__Internal")] static extern void KikiNative_PrepareHaptics();
#endif

        public static void Prepare()
        {
#if UNITY_IOS && !UNITY_EDITOR
            try { KikiNative_PrepareHaptics(); } catch { }
#endif
        }

        public static void Play(HapticKind kind)
        {
            if (kind == HapticKind.None) return;
            Played?.Invoke(kind);
            if (!Enabled) return;
#if UNITY_IOS && !UNITY_EDITOR
            try { KikiNative_Haptic((int)kind); } catch { }
#elif UNITY_ANDROID && !UNITY_EDITOR
            AndroidHaptics.Play(kind);
#endif
        }
    }

#if UNITY_ANDROID
    static class AndroidHaptics
    {
        static AndroidJavaObject _vibrator;
        static int _sdk = -1;
        // Referenced so Unity adds the VIBRATE permission to the Android manifest. Never true at runtime.
        static bool _neverTrue;

        static AndroidJavaObject Vibrator
        {
            get
            {
                if (_vibrator != null) return _vibrator;
                if (_neverTrue) Handheld.Vibrate();
                using (var player = new AndroidJavaClass("com.unity3d.player.UnityPlayer"))
                using (var activity = player.GetStatic<AndroidJavaObject>("currentActivity"))
                    _vibrator = activity.Call<AndroidJavaObject>("getSystemService", "vibrator");
                using (var version = new AndroidJavaClass("android.os.Build$VERSION"))
                    _sdk = version.GetStatic<int>("SDK_INT");
                return _vibrator;
            }
        }

        public static void Play(HapticKind kind)
        {
            try
            {
                var v = Vibrator;
                if (v == null) return;
                using (var effect = new AndroidJavaClass("android.os.VibrationEffect"))
                {
                    AndroidJavaObject e;
                    if (_sdk >= 29 && (kind == HapticKind.Tick || kind == HapticKind.Light || kind == HapticKind.Medium || kind == HapticKind.Heavy))
                    {
                        // EFFECT_TICK = 2, EFFECT_CLICK = 0, EFFECT_HEAVY_CLICK = 5
                        int id = kind == HapticKind.Tick ? 2 : kind == HapticKind.Heavy ? 5 : 0;
                        e = effect.CallStatic<AndroidJavaObject>("createPredefined", id);
                    }
                    else if (_sdk >= 26)
                    {
                        switch (kind)
                        {
                            case HapticKind.Success: e = effect.CallStatic<AndroidJavaObject>("createWaveform", new long[] { 0, 30, 60, 50 }, new[] { 0, 160, 0, 255 }, -1); break;
                            case HapticKind.Warning: e = effect.CallStatic<AndroidJavaObject>("createWaveform", new long[] { 0, 60, 80, 40 }, new[] { 0, 220, 0, 140 }, -1); break;
                            case HapticKind.Error: e = effect.CallStatic<AndroidJavaObject>("createWaveform", new long[] { 0, 50, 50, 50, 50, 50 }, new[] { 0, 255, 0, 200, 0, 150 }, -1); break;
                            case HapticKind.Tick: e = effect.CallStatic<AndroidJavaObject>("createOneShot", 8L, 60); break;
                            case HapticKind.Light: e = effect.CallStatic<AndroidJavaObject>("createOneShot", 12L, 100); break;
                            case HapticKind.Medium: e = effect.CallStatic<AndroidJavaObject>("createOneShot", 20L, 170); break;
                            default: e = effect.CallStatic<AndroidJavaObject>("createOneShot", 35L, 255); break;
                        }
                    }
                    else
                    {
                        v.Call("vibrate", kind == HapticKind.Tick ? 8L : 25L);
                        return;
                    }
                    using (e) v.Call("vibrate", e);
                }
            }
            catch (Exception ex)
            {
                Debug.LogWarning("[KikiSafari] Android haptic failed: " + ex.Message);
            }
        }
    }
#endif
}
