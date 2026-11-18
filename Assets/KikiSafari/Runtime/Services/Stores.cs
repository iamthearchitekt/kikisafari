using System;
using System.IO;
using KikiSafari.Core;
using UnityEngine;

namespace KikiSafari
{
    /// <summary>Demo Safari progress, stored on the phone as JSON (no account).</summary>
    public static class ProgressStore
    {
        static string PathOnDisk => System.IO.Path.Combine(Application.persistentDataPath, "safari-progress.json");

        public static SafariProgress Load()
        {
            try
            {
                if (File.Exists(PathOnDisk))
                {
                    var p = JsonUtility.FromJson<SafariProgress>(File.ReadAllText(PathOnDisk));
                    if (p != null) return p;
                }
            }
            catch (Exception e)
            {
                Debug.LogWarning("[KikiSafari] Could not read progress, starting fresh: " + e.Message);
            }
            return new SafariProgress();
        }

        public static void Save(SafariProgress p)
        {
            try
            {
                string tmp = PathOnDisk + ".tmp";
                File.WriteAllText(tmp, JsonUtility.ToJson(p));
                if (File.Exists(PathOnDisk)) File.Delete(PathOnDisk);
                File.Move(tmp, PathOnDisk);
            }
            catch (Exception e)
            {
                Debug.LogWarning("[KikiSafari] Could not save progress: " + e.Message);
            }
        }

        public static void Reset() { try { File.Delete(PathOnDisk); } catch { } }
    }

    /// <summary>Live tuning values from the hidden panel, kept in PlayerPrefs.</summary>
    public static class TuningStore
    {
        const string Key = "kiki.tuning";
        public static TuningValues Current { get; private set; } = Load();
        public static event Action Changed;

        static TuningValues Load()
        {
            var json = PlayerPrefs.GetString(Key, "");
            TuningValues t = null;
            if (!string.IsNullOrEmpty(json)) { try { t = JsonUtility.FromJson<TuningValues>(json); } catch { } }
            t ??= new TuningValues();
            t.Clamp();
            return t;
        }

        public static void Save()
        {
            Current.Clamp();
            PlayerPrefs.SetString(Key, JsonUtility.ToJson(Current));
            PlayerPrefs.Save();
            Changed?.Invoke();
        }

        public static void Reset() { Current = new TuningValues(); Save(); }
    }

    /// <summary>Debug switches from the tuning panel.</summary>
    public static class DebugFlags
    {
        public static bool ForceNight
        {
            get => PlayerPrefs.GetInt("kiki.forceNight", 0) == 1;
            set { PlayerPrefs.SetInt("kiki.forceNight", value ? 1 : 0); PlayerPrefs.Save(); }
        }

        /// <summary>Testing: treat every moment as a Portal Surge.</summary>
        public static bool ForceSurge
        {
            get => PlayerPrefs.GetInt("kiki.forceSurge", 0) == 1;
            set { PlayerPrefs.SetInt("kiki.forceSurge", value ? 1 : 0); PlayerPrefs.Save(); }
        }

        public static bool ShowOverlay
        {
            get => PlayerPrefs.GetInt("kiki.debugOverlay", 0) == 1;
            set { PlayerPrefs.SetInt("kiki.debugOverlay", value ? 1 : 0); PlayerPrefs.Save(); }
        }

        /// <summary>Night by the phone's local clock (map mood and Moonbeam spawns). Demo has no location, so 19:00–07:00.</summary>
        public static bool IsNight
        {
            get
            {
                if (ForceNight) return true;
                int h = DateTime.Now.Hour;
                return h >= 19 || h < 7;
            }
        }
    }
}
