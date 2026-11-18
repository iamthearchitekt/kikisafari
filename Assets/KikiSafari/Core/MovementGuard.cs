using System;

namespace KikiSafari.Core
{
    public struct GeoFix
    {
        public double Lat, Lon;
        /// <summary>Horizontal accuracy in metres (smaller is better).</summary>
        public double AccuracyMeters;
        public long TimestampUnix;
    }

    public enum FixVerdict { Ok, TooInaccurate, TooOld, ImpossibleJump }

    /// <summary>
    /// Speed lock and GPS checks (decisions doc, section 4). The server applies the same checks and is the authority;
    /// the client uses them to show the "moving fast" notice early.
    /// </summary>
    public static class MovementGuard
    {
        public const double SpeedLockKmh = 30;
        /// <summary>Unlock only below this speed so the lock doesn't flicker at the boundary.</summary>
        public const double SpeedUnlockKmh = 25;
        public const double MaxAccuracyMeters = 50;
        public const long MaxAgeSeconds = 30;
        /// <summary>Faster than this between fixes is treated as a spoof or a glitch.</summary>
        public const double ImpossibleKmh = 300;
        public const string MovingFastText = "Looks like you're moving fast";

        const double EarthRadius = 6371008.8;

        public static double DistanceMeters(double lat1, double lon1, double lat2, double lon2)
        {
            double r = Math.PI / 180;
            double dLat = (lat2 - lat1) * r, dLon = (lon2 - lon1) * r;
            double a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                       Math.Cos(lat1 * r) * Math.Cos(lat2 * r) * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
            return 2 * EarthRadius * Math.Asin(Math.Min(1, Math.Sqrt(a)));
        }

        public static double SpeedKmh(GeoFix a, GeoFix b)
        {
            double dt = Math.Abs(b.TimestampUnix - a.TimestampUnix);
            if (dt < 1) dt = 1;
            return DistanceMeters(a.Lat, a.Lon, b.Lat, b.Lon) / dt * 3.6;
        }

        public static FixVerdict Check(GeoFix fix, GeoFix? previous, long nowUnix)
        {
            if (fix.AccuracyMeters > MaxAccuracyMeters) return FixVerdict.TooInaccurate;
            if (nowUnix - fix.TimestampUnix > MaxAgeSeconds) return FixVerdict.TooOld;
            if (previous.HasValue && SpeedKmh(previous.Value, fix) > ImpossibleKmh) return FixVerdict.ImpossibleJump;
            return FixVerdict.Ok;
        }

        /// <summary>Next lock state with hysteresis.</summary>
        public static bool IsSpeedLocked(bool currentlyLocked, double speedKmh)
            => currentlyLocked ? speedKmh >= SpeedUnlockKmh : speedKmh > SpeedLockKmh;
    }
}
