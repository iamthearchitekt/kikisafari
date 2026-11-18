using System;
using System.Collections.Generic;

namespace KikiSafari.Core
{
    public enum ThrowQuality { None, Nice, Great, Excellent }

    public enum CatchResult { Caught, BrokeOut, Missed }

    public struct ThrowReport
    {
        /// <summary>Did the rune stone touch Kiki?</summary>
        public bool Hit;
        /// <summary>Timing ring size at release: 1 = largest, 0 = smallest.</summary>
        public float RingScale;
        public bool Spin;
    }

    public struct CatchOutcome
    {
        public CatchResult Result;
        /// <summary>Wobbles to play before the result: the full count on a catch, 0..N before a breakout, 0 on a miss.</summary>
        public int Wobbles;
        public ThrowQuality Quality;
        public bool Spin;
        public float ChanceUsed;
    }

    public struct RewardLine
    {
        public string Label;
        public int Amount;
        public RewardLine(string label, int amount) { Label = label; Amount = amount; }
    }

    public sealed class RewardBreakdown
    {
        public readonly List<RewardLine> Lines = new List<RewardLine>();
        public int Total { get { int t = 0; foreach (var l in Lines) t += l.Amount; return t; } }
    }

    /// <summary>
    /// Catch rules. In Demo Safari this runs on the phone; in Live Safari the server runs the same rules and is the authority.
    /// </summary>
    public static class CatchMath
    {
        public const float ExcellentMax = 0.2f;
        public const float GreatMax = 0.5f;
        public const float NiceMax = 0.8f;
        public const float SpinMultiplier = 1.3f;
        public const float MinChance = 0.02f;
        public const float MaxChance = 0.98f;

        public static ThrowQuality Quality(float ringScale)
        {
            if (ringScale <= ExcellentMax) return ThrowQuality.Excellent;
            if (ringScale <= GreatMax) return ThrowQuality.Great;
            if (ringScale <= NiceMax) return ThrowQuality.Nice;
            return ThrowQuality.None;
        }

        public static float QualityMultiplier(ThrowQuality q)
        {
            switch (q)
            {
                case ThrowQuality.Nice: return 1.3f;
                case ThrowQuality.Great: return 1.6f;
                case ThrowQuality.Excellent: return 2.0f;
                default: return 1f;
            }
        }

        public static float CatchChance(Rarity rarity, ThrowQuality q, bool spin, float oddsMultiplier = 1f)
        {
            float c = RarityInfo.BaseCatchChance(rarity) * QualityMultiplier(q) * (spin ? SpinMultiplier : 1f) * oddsMultiplier;
            return Math.Min(MaxChance, Math.Max(MinChance, c));
        }

        public static CatchOutcome Resolve(Rarity rarity, ThrowReport t, IRandom rng, float oddsMultiplier = 1f)
        {
            if (!t.Hit)
                return new CatchOutcome { Result = CatchResult.Missed, Wobbles = 0, Quality = ThrowQuality.None, Spin = t.Spin };

            var q = Quality(t.RingScale);
            float chance = CatchChance(rarity, q, t.Spin, oddsMultiplier);
            int n = RarityInfo.Wobbles(rarity);
            if (rng.NextDouble() < chance)
                return new CatchOutcome { Result = CatchResult.Caught, Wobbles = n, Quality = q, Spin = t.Spin, ChanceUsed = chance };

            // Breakout after 0..N wobbles, so a full set of wobbles is never a guaranteed catch.
            return new CatchOutcome { Result = CatchResult.BrokeOut, Wobbles = rng.Next(0, n + 1), Quality = q, Spin = t.Spin, ChanceUsed = chance };
        }

        public static string QualityWord(ThrowQuality q)
        {
            switch (q)
            {
                case ThrowQuality.Nice: return "Nice!";
                case ThrowQuality.Great: return "Great!";
                case ThrowQuality.Excellent: return "Excellent!";
                default: return null;
            }
        }

        /// <summary>
        /// Rewards shown in the count-up after a confirmed catch. Throw-quality words and the spin bonus appear only here
        /// (no spoilers before the result is real).
        /// </summary>
        public static RewardBreakdown Reward(Rarity rarity, ThrowQuality q, bool spin, bool firstOfVariant)
        {
            var r = new RewardBreakdown();
            r.Lines.Add(new RewardLine("Catch", RarityInfo.BaseReward(rarity)));
            switch (q)
            {
                case ThrowQuality.Nice: r.Lines.Add(new RewardLine("Nice throw", 10)); break;
                case ThrowQuality.Great: r.Lines.Add(new RewardLine("Great throw", 50)); break;
                case ThrowQuality.Excellent: r.Lines.Add(new RewardLine("Excellent throw", 100)); break;
            }
            if (spin) r.Lines.Add(new RewardLine("Spin bonus", 25));
            if (firstOfVariant) r.Lines.Add(new RewardLine("New in your Safari Log!", 500));
            return r;
        }
    }
}
