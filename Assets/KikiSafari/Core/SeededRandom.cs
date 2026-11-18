using System;

namespace KikiSafari.Core
{
    public interface IRandom
    {
        /// <summary>Uniform in [0, 1).</summary>
        double NextDouble();
        /// <summary>Uniform integer in [minInclusive, maxExclusive).</summary>
        int Next(int minInclusive, int maxExclusive);
    }

    /// <summary>
    /// Small deterministic RNG (SplitMix64). The same seed gives the same sequence on every device and on the server,
    /// which is what makes "everyone nearby sees the same Kikis" possible.
    /// </summary>
    public sealed class SeededRandom : IRandom
    {
        ulong _state;

        public SeededRandom(ulong seed) { _state = seed; }

        public static ulong Hash(params long[] parts)
        {
            ulong h = 0x9E3779B97F4A7C15UL;
            foreach (var p in parts)
            {
                h ^= (ulong)p + 0x9E3779B97F4A7C15UL + (h << 6) + (h >> 2);
                h = Mix(h);
            }
            return h;
        }

        static ulong Mix(ulong z)
        {
            z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9UL;
            z = (z ^ (z >> 27)) * 0x94D049BB133111EBUL;
            return z ^ (z >> 31);
        }

        public ulong NextULong()
        {
            _state += 0x9E3779B97F4A7C15UL;
            return Mix(_state);
        }

        public double NextDouble() => (NextULong() >> 11) * (1.0 / (1UL << 53));

        public int Next(int minInclusive, int maxExclusive)
        {
            if (maxExclusive <= minInclusive) return minInclusive;
            return minInclusive + (int)(NextDouble() * (maxExclusive - minInclusive));
        }

        public double Range(double min, double max) => min + NextDouble() * (max - min);
    }

    /// <summary>Non-deterministic RNG for local, unshared rolls (dance choice, idle timing).</summary>
    public sealed class SystemRandom : IRandom
    {
        readonly Random _r;
        public SystemRandom(int? seed = null) { _r = seed.HasValue ? new Random(seed.Value) : new Random(); }
        public double NextDouble() => _r.NextDouble();
        public int Next(int minInclusive, int maxExclusive) => maxExclusive <= minInclusive ? minInclusive : _r.Next(minInclusive, maxExclusive);
    }
}
