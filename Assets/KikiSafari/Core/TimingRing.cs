using System;

namespace KikiSafari.Core
{
    /// <summary>
    /// The timing ring shrinks from its largest to its smallest size and grows back, over and over.
    /// It only shows the target size; it never says how good a throw was before the result (no spoilers).
    /// </summary>
    public static class TimingRing
    {
        /// <summary>Ring scale in [0, 1] at time t for a full shrink-and-grow cycle of <paramref name="periodSeconds"/>.</summary>
        public static float Scale(double t, double periodSeconds)
        {
            if (periodSeconds <= 0) return 1f;
            double phase = t / periodSeconds;
            phase -= Math.Floor(phase);
            double tri = phase < 0.5 ? 1 - phase * 2 : (phase - 0.5) * 2;
            return (float)tri;
        }
    }
}
