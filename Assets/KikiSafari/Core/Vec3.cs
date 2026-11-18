using System;

namespace KikiSafari.Core
{
    /// <summary>Minimal vector type so throw maths stays engine-free and testable. Y is up.</summary>
    public struct Vec3
    {
        public double X, Y, Z;
        public Vec3(double x, double y, double z) { X = x; Y = y; Z = z; }
        public static Vec3 operator +(Vec3 a, Vec3 b) => new Vec3(a.X + b.X, a.Y + b.Y, a.Z + b.Z);
        public static Vec3 operator -(Vec3 a, Vec3 b) => new Vec3(a.X - b.X, a.Y - b.Y, a.Z - b.Z);
        public static Vec3 operator *(Vec3 a, double k) => new Vec3(a.X * k, a.Y * k, a.Z * k);
        public static Vec3 Lerp(Vec3 a, Vec3 b, double t) => a + (b - a) * t;
        public double Length => Math.Sqrt(X * X + Y * Y + Z * Z);
        public double HorizontalLength => Math.Sqrt(X * X + Z * Z);
        public override string ToString() => $"({X:0.###}, {Y:0.###}, {Z:0.###})";
    }

    /// <summary>Throw maths for the flick and tap-to-throw (decisions doc, sections 7 and 9).</summary>
    public static class ThrowMath
    {
        /// <summary>Position after t seconds of a ballistic flight.</summary>
        public static Vec3 PositionAt(Vec3 origin, Vec3 velocity, double gravity, double t)
            => new Vec3(origin.X + velocity.X * t, origin.Y + velocity.Y * t - 0.5 * gravity * t * t, origin.Z + velocity.Z * t);

        /// <summary>Launch velocity that reaches <paramref name="target"/> after exactly <paramref name="flightTime"/> seconds.</summary>
        public static Vec3 SolveForFlightTime(Vec3 origin, Vec3 target, double gravity, double flightTime)
        {
            var d = target - origin;
            double t = Math.Max(0.05, flightTime);
            return new Vec3(d.X / t, (d.Y + 0.5 * gravity * t * t) / t, d.Z / t);
        }

        /// <summary>A comfortable arc time for a given horizontal distance, used by tap-to-throw and aim assist.</summary>
        public static double NaturalFlightTime(double horizontalDistance) => 0.45 + 0.12 * Math.Max(0, horizontalDistance);

        /// <summary>
        /// Blends a flicked velocity toward the ideal velocity. 0 = no help, 1 = always perfect.
        /// Only the sideways and vertical error are corrected; how hard the player flicked still matters.
        /// </summary>
        public static Vec3 ApplyAimAssist(Vec3 origin, Vec3 target, Vec3 flicked, double gravity, double assist01)
        {
            assist01 = Math.Max(0, Math.Min(1, assist01));
            if (assist01 <= 0) return flicked;
            var ideal = SolveForFlightTime(origin, target, gravity, NaturalFlightTime((target - origin).HorizontalLength));
            return Vec3.Lerp(flicked, ideal, assist01);
        }

        /// <summary>
        /// Closest approach between a flight path and a point, sampled over <paramref name="maxTime"/>.
        /// Used by tests and by the encounter to predict a hit for tap-to-throw.
        /// </summary>
        public static double ClosestApproach(Vec3 origin, Vec3 velocity, double gravity, Vec3 point, double maxTime, double step = 1.0 / 120)
        {
            double best = double.MaxValue;
            for (double t = 0; t <= maxTime; t += step)
            {
                double d = (PositionAt(origin, velocity, gravity, t) - point).Length;
                if (d < best) best = d;
            }
            return best;
        }
    }
}
