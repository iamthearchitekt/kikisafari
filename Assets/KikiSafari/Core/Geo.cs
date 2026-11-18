using System;

namespace KikiSafari.Core
{
    [Serializable]
    public struct LatLon
    {
        public double Lat, Lon;
        public LatLon(double lat, double lon) { Lat = lat; Lon = lon; }
        public override string ToString() => $"{Lat:0.000000}, {Lon:0.000000}";
    }

    /// <summary>Small-area geo maths. Accurate to well under a metre over the few hundred metres the game cares about.</summary>
    public static class Geo
    {
        public const double MetersPerDegLat = 111320.0;

        public static double MetersPerDegLon(double lat) => MetersPerDegLat * Math.Cos(lat * Math.PI / 180.0);

        /// <summary>Metres east and north of <paramref name="origin"/>.</summary>
        public static (double east, double north) ToLocal(LatLon origin, LatLon p)
            => ((p.Lon - origin.Lon) * MetersPerDegLon(origin.Lat), (p.Lat - origin.Lat) * MetersPerDegLat);

        public static LatLon FromLocal(LatLon origin, double east, double north)
            => new LatLon(origin.Lat + north / MetersPerDegLat, origin.Lon + east / MetersPerDegLon(origin.Lat));

        public static double Distance(LatLon a, LatLon b) => MovementGuard.DistanceMeters(a.Lat, a.Lon, b.Lat, b.Lon);

        /// <summary>Compass bearing from a to b in degrees (0 = north, 90 = east).</summary>
        public static double Bearing(LatLon a, LatLon b)
        {
            var (e, n) = ToLocal(a, b);
            double deg = Math.Atan2(e, n) * 180.0 / Math.PI;
            return deg < 0 ? deg + 360.0 : deg;
        }
    }

    /// <summary>
    /// A worldwide grid of roughly square cells (decisions doc, section 4): rows are bands of latitude; within a row the
    /// cell width in degrees grows with latitude so cells stay about <c>size</c> metres across. Deterministic everywhere,
    /// so every player and the server agree on which cell a spot belongs to.
    /// </summary>
    public static class WorldGrid
    {
        public struct Cell
        {
            public long X, Y;
            public double SizeMeters;
            public LatLon SouthWest;
            public double DegLat, DegLon;
            public LatLon Center => new LatLon(SouthWest.Lat + DegLat / 2, SouthWest.Lon + DegLon / 2);
            public LatLon At(double eastMeters, double northMeters)
                => new LatLon(SouthWest.Lat + northMeters / Geo.MetersPerDegLat, SouthWest.Lon + eastMeters / (DegLon > 0 ? SizeMeters / DegLon : 1));
        }

        public static Cell CellOf(LatLon p, double size) => CellAt((long)Math.Floor(p.Lat * Geo.MetersPerDegLat / size), p.Lon, size);

        static Cell CellAt(long y, double lon, double size)
        {
            double degLat = size / Geo.MetersPerDegLat;
            double bandLat = (y + 0.5) * degLat;
            double degLon = size / Math.Max(1.0, Geo.MetersPerDegLon(bandLat));
            long x = (long)Math.Floor(lon / degLon);
            return Make(x, y, size);
        }

        public static Cell Make(long x, long y, double size)
        {
            double degLat = size / Geo.MetersPerDegLat;
            double bandLat = (y + 0.5) * degLat;
            double degLon = size / Math.Max(1.0, Geo.MetersPerDegLon(bandLat));
            return new Cell { X = x, Y = y, SizeMeters = size, DegLat = degLat, DegLon = degLon, SouthWest = new LatLon(y * degLat, x * degLon) };
        }

        /// <summary>Every cell whose area comes within <paramref name="radius"/> metres of <paramref name="p"/>.</summary>
        public static System.Collections.Generic.List<Cell> CellsAround(LatLon p, double radius, double size)
        {
            var list = new System.Collections.Generic.List<Cell>();
            double degLat = size / Geo.MetersPerDegLat;
            long y0 = (long)Math.Floor((p.Lat - radius / Geo.MetersPerDegLat) / degLat);
            long y1 = (long)Math.Floor((p.Lat + radius / Geo.MetersPerDegLat) / degLat);
            for (long y = y0; y <= y1; y++)
            {
                double bandLat = (y + 0.5) * degLat;
                double degLon = size / Math.Max(1.0, Geo.MetersPerDegLon(bandLat));
                double dLon = radius / Math.Max(1.0, Geo.MetersPerDegLon(p.Lat));
                long x0 = (long)Math.Floor((p.Lon - dLon) / degLon), x1 = (long)Math.Floor((p.Lon + dLon) / degLon);
                for (long x = x0; x <= x1; x++) list.Add(Make(x, y, size));
            }
            return list;
        }

        /// <summary>
        /// Version 1 habitats (decisions doc, section 4): each ~1 km neighbourhood gets a habitat that rotates every two
        /// weeks, so every place sees every habitat over time with no map data. Land cover replaces this later.
        /// </summary>
        public static Habitat RotatingHabitat(LatLon p, long unix, ulong worldSeed)
        {
            var c = CellOf(p, 1000);
            long fortnight = (long)Math.Floor(unix / (14.0 * 86400));
            double r = new SeededRandom(SeededRandom.Hash((long)worldSeed, c.X, c.Y, fortnight, 31)).NextDouble();
            if (r < 0.35) return Habitat.Meadow;
            if (r < 0.70) return Habitat.Town;
            if (r < 0.90) return Habitat.Woods;
            return Habitat.Water;
        }
    }

    /// <summary>Local sunset to sunrise (Moonbeam's window and the night map mood), from the NOAA solar position formulas.</summary>
    public static class SunClock
    {
        /// <summary>Sun elevation in degrees at a place and time (UTC).</summary>
        public static double Elevation(LatLon p, DateTime utc)
        {
            double jd = utc.ToOADate() + 2415018.5;
            double t = (jd - 2451545.0) / 36525.0;
            double l0 = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
            double m = 357.52911 + t * (35999.05029 - 0.0001537 * t);
            double e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
            double mr = m * Math.PI / 180;
            double c = Math.Sin(mr) * (1.914602 - t * (0.004817 + 0.000014 * t)) + Math.Sin(2 * mr) * (0.019993 - 0.000101 * t) + Math.Sin(3 * mr) * 0.000289;
            double trueLong = l0 + c;
            double omega = 125.04 - 1934.136 * t;
            double lambda = trueLong - 0.00569 - 0.00478 * Math.Sin(omega * Math.PI / 180);
            double eps0 = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
            double eps = eps0 + 0.00256 * Math.Cos(omega * Math.PI / 180);
            double decl = Math.Asin(Math.Sin(eps * Math.PI / 180) * Math.Sin(lambda * Math.PI / 180));
            double y = Math.Tan(eps * Math.PI / 360); y *= y;
            double l0r = l0 * Math.PI / 180;
            double eqTime = 4 * 180 / Math.PI * (y * Math.Sin(2 * l0r) - 2 * e * Math.Sin(mr) + 4 * e * y * Math.Sin(mr) * Math.Cos(2 * l0r)
                - 0.5 * y * y * Math.Sin(4 * l0r) - 1.25 * e * e * Math.Sin(2 * mr));
            double minutes = utc.TimeOfDay.TotalMinutes;
            double trueSolar = (minutes + eqTime + 4 * p.Lon) % 1440;
            if (trueSolar < 0) trueSolar += 1440;
            double hourAngle = trueSolar / 4 < 0 ? trueSolar / 4 + 180 : trueSolar / 4 - 180;
            double latr = p.Lat * Math.PI / 180, har = hourAngle * Math.PI / 180;
            double cosZen = Math.Sin(latr) * Math.Sin(decl) + Math.Cos(latr) * Math.Cos(decl) * Math.Cos(har);
            double zenith = Math.Acos(Math.Max(-1, Math.Min(1, cosZen))) * 180 / Math.PI;
            return 90 - zenith;
        }

        /// <summary>Night = the sun's centre is below the horizon including refraction (standard sunrise/sunset).</summary>
        public static bool IsNight(LatLon p, DateTime utc) => Elevation(p, utc) < -0.833;
    }
}
