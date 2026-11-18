using System.Collections;
using KikiSafari.Core;
using UnityEngine;
using UnityEngine.InputSystem;

namespace KikiSafari
{
    /// <summary>
    /// GPS and compass while the game is open (decisions doc, section 6: no background tracking). In the editor the
    /// location is simulated: WASD or the arrow keys walk (hold Shift to run), Q and E turn.
    /// </summary>
    public sealed class DeviceLocation : MonoBehaviour
    {
        public static DeviceLocation Instance { get; private set; }

        public bool Ready { get; private set; }
        public bool Simulated { get; private set; }
        public LatLon Fix { get; private set; }
        public double AccuracyMeters { get; private set; } = 999;
        public long FixUnix { get; private set; }
        /// <summary>Degrees from true north the phone is facing (camera direction).</summary>
        public float Heading { get; private set; }
        public bool HeadingValid { get; private set; }
        public double SpeedKmh { get; private set; }
        public bool SpeedLocked { get; private set; }
        public string Problem { get; private set; }
        /// <summary>Increments whenever a new fix arrives.</summary>
        public int FixCount { get; private set; }

        const string SimKey = "kiki.simLocation";
        static readonly LatLon DefaultSim = new LatLon(40.7829, -73.9654); // a public park; only used in the editor
        GeoFix? _lastGood;
        double _lastTimestamp;

        void Awake() { Instance = this; }

        IEnumerator Start()
        {
#if UNITY_EDITOR
            Simulated = true;
#endif
            if (Simulated)
            {
                Fix = LoadSim();
                AccuracyMeters = 5;
                FixUnix = Util.UnixNow();
                HeadingValid = true;
                Ready = true;
                FixCount++;
                yield break;
            }

#if UNITY_ANDROID
            if (!UnityEngine.Android.Permission.HasUserAuthorizedPermission(UnityEngine.Android.Permission.FineLocation))
            {
                UnityEngine.Android.Permission.RequestUserPermission(UnityEngine.Android.Permission.FineLocation);
                float t0 = Time.realtimeSinceStartup;
                while (!UnityEngine.Android.Permission.HasUserAuthorizedPermission(UnityEngine.Android.Permission.FineLocation) && Time.realtimeSinceStartup - t0 < 30f)
                    yield return null;
            }
#endif
            // On iPhone, Start() itself shows the "While Using the App" permission prompt.
            Input.compass.enabled = true;
            Input.location.Start(3f, 1f);
            float start = Time.realtimeSinceStartup;
            while (Input.location.status == LocationServiceStatus.Initializing && Time.realtimeSinceStartup - start < 25f)
                yield return null;
            if (Input.location.status != LocationServiceStatus.Running)
            {
                Problem = Input.location.isEnabledByUser
                    ? "Couldn't get your location. Step outside or check Settings."
                    : "Location is off. Turn it on in Settings to find Kikis near you.";
                yield break;
            }
            Ready = true;
        }

        void Update()
        {
            if (Simulated) { SimulateWalk(); return; }
            if (!Ready) return;
            var d = Input.location.lastData;
            if (d.timestamp != _lastTimestamp)
            {
                _lastTimestamp = d.timestamp;
                var fix = new GeoFix { Lat = d.latitude, Lon = d.longitude, AccuracyMeters = d.horizontalAccuracy, TimestampUnix = (long)d.timestamp };
                var verdict = MovementGuard.Check(fix, _lastGood, Util.UnixNow());
                AccuracyMeters = d.horizontalAccuracy;
                if (verdict == FixVerdict.Ok || (verdict == FixVerdict.TooOld && FixCount == 0))
                {
                    if (_lastGood.HasValue)
                    {
                        SpeedKmh = MovementGuard.SpeedKmh(_lastGood.Value, fix);
                        SpeedLocked = MovementGuard.IsSpeedLocked(SpeedLocked, SpeedKmh);
                    }
                    _lastGood = fix;
                    Fix = new LatLon(d.latitude, d.longitude);
                    FixUnix = (long)d.timestamp;
                    FixCount++;
                }
            }
            if (Input.compass.enabled)
            {
                Heading = Input.compass.trueHeading > 0 ? Input.compass.trueHeading : Input.compass.magneticHeading;
                HeadingValid = Input.compass.timestamp > 0;
            }
        }

        void SimulateWalk()
        {
            var kb = Keyboard.current;
            if (kb == null) return;
            float turn = (kb.eKey.isPressed ? 1 : 0) - (kb.qKey.isPressed ? 1 : 0);
            Heading = Mathf.Repeat(Heading + turn * 90f * Time.deltaTime, 360f);
            float fwd = ((kb.wKey.isPressed || kb.upArrowKey.isPressed) ? 1 : 0) - ((kb.sKey.isPressed || kb.downArrowKey.isPressed) ? 1 : 0);
            float side = ((kb.dKey.isPressed || kb.rightArrowKey.isPressed) ? 1 : 0) - ((kb.aKey.isPressed || kb.leftArrowKey.isPressed) ? 1 : 0);
            if (fwd == 0 && side == 0) return;
            float speed = kb.leftShiftKey.isPressed ? 6f : 1.6f;
            float h = Heading * Mathf.Deg2Rad;
            double east = (Mathf.Sin(h) * fwd + Mathf.Cos(h) * side) * speed * Time.deltaTime;
            double north = (Mathf.Cos(h) * fwd - Mathf.Sin(h) * side) * speed * Time.deltaTime;
            Fix = Geo.FromLocal(Fix, east, north);
            FixUnix = Util.UnixNow();
            FixCount++;
            if (Time.frameCount % 30 == 0)
                PlayerPrefs.SetString(SimKey, string.Format(System.Globalization.CultureInfo.InvariantCulture, "{0:R},{1:R}", Fix.Lat, Fix.Lon));
        }

        static LatLon LoadSim()
        {
            var s = PlayerPrefs.GetString(SimKey, "");
            var parts = s.Split(',');
            if (parts.Length == 2 && double.TryParse(parts[0], System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var lat)
                && double.TryParse(parts[1], System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var lon))
                return new LatLon(lat, lon);
            return DefaultSim;
        }

        void OnDestroy()
        {
            if (!Simulated && Input.location.status == LocationServiceStatus.Running) Input.location.Stop();
        }
    }

    /// <summary>The single test Rune Circle, pinned on this phone only (never in the project files).</summary>
    public static class TestCircleStore
    {
        const string Key = "kiki.testCircle";

        public static bool TryGet(out LatLon where)
        {
            where = default;
            var parts = PlayerPrefs.GetString(Key, "").Split(',');
            var ci = System.Globalization.CultureInfo.InvariantCulture;
            if (parts.Length == 2 && double.TryParse(parts[0], System.Globalization.NumberStyles.Float, ci, out var lat)
                && double.TryParse(parts[1], System.Globalization.NumberStyles.Float, ci, out var lon))
            {
                where = new LatLon(lat, lon);
                return true;
            }
            return false;
        }

        public static void Set(LatLon where)
        {
            PlayerPrefs.SetString(Key, string.Format(System.Globalization.CultureInfo.InvariantCulture, "{0:R},{1:R}", where.Lat, where.Lon));
            PlayerPrefs.Save();
        }

        /// <summary>Pins the circle a few metres in front of the player.</summary>
        public static LatLon PinInFront(LatLon me, float headingDeg, double meters = 7)
        {
            double h = headingDeg * System.Math.PI / 180;
            var at = Geo.FromLocal(me, System.Math.Sin(h) * meters, System.Math.Cos(h) * meters);
            Set(at);
            return at;
        }
    }
}
