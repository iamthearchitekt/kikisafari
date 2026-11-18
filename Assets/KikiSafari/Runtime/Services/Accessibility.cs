using System.Runtime.InteropServices;
using UnityEngine;

namespace KikiSafari
{
    public enum MotionPreference { Auto, Reduced, Full }

    /// <summary>
    /// Reduced motion (decisions doc, section 9): no screen shake, no spins, shorter wobbles. "Auto" follows the phone's
    /// own setting (iOS Reduce Motion, Android "Remove animations").
    /// </summary>
    public static class Accessibility
    {
        const string Key = "kiki.motion";
        static bool? _system;

        public static MotionPreference Preference
        {
            get => (MotionPreference)PlayerPrefs.GetInt(Key, 0);
            set { PlayerPrefs.SetInt(Key, (int)value); PlayerPrefs.Save(); }
        }

        public static bool ReducedMotion
        {
            get
            {
                switch (Preference)
                {
                    case MotionPreference.Reduced: return true;
                    case MotionPreference.Full: return false;
                    default: return SystemReducedMotion;
                }
            }
        }

        public static bool SystemReducedMotion
        {
            get
            {
                if (!_system.HasValue) _system = QuerySystem();
                return _system.Value;
            }
        }

        /// <summary>Call when the app regains focus; the player may have changed the setting.</summary>
        public static void Refresh() => _system = null;

#if UNITY_IOS && !UNITY_EDITOR
        [DllImport("__Internal")] static extern bool KikiNative_IsReduceMotionEnabled();
#endif

        static bool QuerySystem()
        {
#if UNITY_IOS && !UNITY_EDITOR
            try { return KikiNative_IsReduceMotionEnabled(); } catch { return false; }
#elif UNITY_ANDROID && !UNITY_EDITOR
            try
            {
                using (var player = new AndroidJavaClass("com.unity3d.player.UnityPlayer"))
                using (var activity = player.GetStatic<AndroidJavaObject>("currentActivity"))
                using (var resolver = activity.Call<AndroidJavaObject>("getContentResolver"))
                using (var global = new AndroidJavaClass("android.provider.Settings$Global"))
                {
                    float scale = global.CallStatic<float>("getFloat", resolver, "animator_duration_scale", 1f);
                    return scale == 0f;
                }
            }
            catch { return false; }
#else
            return false;
#endif
        }
    }

    public static class SoundSettings
    {
        const string Key = "kiki.sound";
        public static bool On
        {
            get => PlayerPrefs.GetInt(Key, 1) == 1;
            set { PlayerPrefs.SetInt(Key, value ? 1 : 0); PlayerPrefs.Save(); AudioListener.volume = value ? 1f : 0f; }
        }
    }
}
