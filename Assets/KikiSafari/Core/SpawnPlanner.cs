using System;
using System.Collections.Generic;

namespace KikiSafari.Core
{
    public struct SpawnContext
    {
        public Habitat Habitat;
        public bool IsNight;
        public bool CrewHunt;
    }

    public struct PlannedSpawn
    {
        public string VariantId;
        /// <summary>Metres east of the cell's south-west corner.</summary>
        public double OffsetEast;
        /// <summary>Metres north of the cell's south-west corner.</summary>
        public double OffsetNorth;
        public long StartUnix;
        public int DurationSeconds;

        public long EndUnix => StartUnix + DurationSeconds;
        public bool IsActive(long unix) => unix >= StartUnix && unix < EndUnix;
    }

    /// <summary>
    /// Deterministic spawn planning (decisions doc, section 4). Given a cell, a time window and a world seed, every client
    /// and the server compute the same spawns. The Live server is the authority; the demo uses this directly.
    /// </summary>
    public static class SpawnPlanner
    {
        public const int WindowSeconds = 15 * 60;
        public const int MinDurationSeconds = 15 * 60;
        public const int MaxDurationSeconds = 30 * 60;

        public static float Weight(VariantDef v, SpawnContext ctx)
        {
            if (v.TimeRule == TimeOfDayRule.NightOnly && !ctx.IsNight) return 0f;
            if (v.TimeRule == TimeOfDayRule.DayOnly && ctx.IsNight) return 0f;
            float w = Math.Max(0f, v.BaseWeight);
            if (v.PreferredHabitats != null && v.PreferredHabitats.Length > 0)
                w *= v.Prefers(ctx.Habitat) ? v.HabitatBoost : v.OutsideHabitatFactor;
            if (ctx.CrewHunt) w *= v.CrewHuntBoost;
            return w;
        }

        /// <summary>Weighted pick with a roll in [0, 1). Returns null when every weight is zero.</summary>
        public static VariantDef Pick(IReadOnlyList<VariantDef> variants, SpawnContext ctx, double roll01)
        {
            float total = 0f;
            for (int i = 0; i < variants.Count; i++) total += Weight(variants[i], ctx);
            if (total <= 0f) return null;
            double target = roll01 * total, acc = 0;
            VariantDef last = null;
            for (int i = 0; i < variants.Count; i++)
            {
                float w = Weight(variants[i], ctx);
                if (w <= 0f) continue;
                last = variants[i];
                acc += w;
                if (target < acc) return variants[i];
            }
            return last;
        }

        public static long WindowIndex(long unix) => FloorDiv(unix, WindowSeconds);

        /// <summary>
        /// Plans the spawns that start in one window of one cell. Spawns from the previous one or two windows can still
        /// be alive, so callers that want "what is out right now" should use <see cref="ActiveSpawns"/>.
        /// </summary>
        public static List<PlannedSpawn> PlanWindow(IReadOnlyList<VariantDef> variants, long cellX, long cellY, long window,
            ulong worldSeed, double cellSizeMeters, int spawnsPerWindow, Func<long, SpawnContext> contextAtUnix)
        {
            var result = new List<PlannedSpawn>(spawnsPerWindow);
            var rng = new SeededRandom(SeededRandom.Hash((long)worldSeed, cellX, cellY, window));
            long windowStart = window * WindowSeconds;
            for (int i = 0; i < spawnsPerWindow; i++)
            {
                long start = windowStart + rng.Next(0, WindowSeconds);
                int duration = rng.Next(MinDurationSeconds, MaxDurationSeconds + 1);
                double east = rng.NextDouble() * cellSizeMeters;
                double north = rng.NextDouble() * cellSizeMeters;
                var pick = Pick(variants, contextAtUnix(start), rng.NextDouble());
                if (pick == null) continue;
                result.Add(new PlannedSpawn
                {
                    VariantId = pick.Id, OffsetEast = east, OffsetNorth = north, StartUnix = start, DurationSeconds = duration,
                });
            }
            return result;
        }

        /// <summary>All spawns of a cell that are alive at <paramref name="unix"/>.</summary>
        public static List<PlannedSpawn> ActiveSpawns(IReadOnlyList<VariantDef> variants, long cellX, long cellY, long unix,
            ulong worldSeed, double cellSizeMeters, int spawnsPerWindow, Func<long, SpawnContext> contextAtUnix)
        {
            var active = new List<PlannedSpawn>();
            long w = WindowIndex(unix);
            int lookBack = (MaxDurationSeconds + WindowSeconds - 1) / WindowSeconds + 1;
            for (long k = w - lookBack; k <= w; k++)
                foreach (var s in PlanWindow(variants, cellX, cellY, k, worldSeed, cellSizeMeters, spawnsPerWindow, contextAtUnix))
                    if (s.IsActive(unix)) active.Add(s);
            return active;
        }

        static long FloorDiv(long a, long b) => a >= 0 ? a / b : -((-a + b - 1) / b);
    }
}
