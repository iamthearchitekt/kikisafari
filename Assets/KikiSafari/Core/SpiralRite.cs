using System;
using System.Collections.Generic;

namespace KikiSafari.Core
{
    public enum RiteJudgement { Perfect, Good, Miss }

    /// <summary>
    /// The Spiral Rite: the Rune Circle's challenge. The circle's spiral rune pulses to a slow festival beat; a ring of
    /// light closes on the rune each beat and the player taps as it lands. Attunement (0–100) is how well they kept time.
    /// Out-attune the circle's Keeper and your Kiki becomes the new Keeper. No fighting, no teams.
    /// </summary>
    public sealed class SpiralRite
    {
        public const double PerfectWindow = 0.075;
        public const double GoodWindow = 0.16;
        public readonly double Bpm;
        public readonly int Beats;
        /// <summary>Seconds of count-in before the first scored beat.</summary>
        public readonly double LeadIn;
        readonly List<RiteJudgement?> _results;

        public SpiralRite(int beats = 16, double bpm = 84, double leadIn = 2.0)
        {
            Beats = beats; Bpm = bpm; LeadIn = leadIn;
            _results = new List<RiteJudgement?>(new RiteJudgement?[beats]);
        }

        public double BeatInterval => 60.0 / Bpm;
        public double BeatTime(int i) => LeadIn + i * BeatInterval;
        public double Duration => BeatTime(Beats - 1) + GoodWindow + 0.3;
        public IReadOnlyList<RiteJudgement?> Results => _results;

        /// <summary>Scores a tap at time <paramref name="t"/> against the nearest unjudged beat. Returns null if no beat is close.</summary>
        public (int beat, RiteJudgement judgement)? Tap(double t)
        {
            int best = -1; double bestErr = double.MaxValue;
            for (int i = 0; i < Beats; i++)
            {
                if (_results[i].HasValue) continue;
                double err = Math.Abs(t - BeatTime(i));
                if (err < bestErr) { bestErr = err; best = i; }
            }
            if (best < 0 || bestErr > GoodWindow) return null;
            var j = bestErr <= PerfectWindow ? RiteJudgement.Perfect : RiteJudgement.Good;
            _results[best] = j;
            return (best, j);
        }

        /// <summary>Marks every beat whose window has passed as a miss; returns the beats that just became misses.</summary>
        public List<int> Advance(double t)
        {
            var missed = new List<int>();
            for (int i = 0; i < Beats; i++)
                if (!_results[i].HasValue && t > BeatTime(i) + GoodWindow) { _results[i] = RiteJudgement.Miss; missed.Add(i); }
            return missed;
        }

        public bool Finished(double t) => t >= Duration;

        /// <summary>0–100. Perfect = full credit, Good = 60%, plus up to 10 points for the longest unbroken streak.</summary>
        public int Attunement
        {
            get
            {
                double sum = 0; int streak = 0, bestStreak = 0;
                foreach (var r in _results)
                {
                    if (r == RiteJudgement.Perfect) { sum += 1; streak++; }
                    else if (r == RiteJudgement.Good) { sum += 0.6; streak++; }
                    else streak = 0;
                    bestStreak = Math.Max(bestStreak, streak);
                }
                double score = sum / Beats * 90 + (double)bestStreak / Beats * 10;
                return (int)Math.Round(Math.Max(0, Math.Min(100, score)));
            }
        }

        /// <summary>How hard a Keeper is to out-attune, by rarity (a wild Keeper's attunement).</summary>
        public static int KeeperAttunement(Rarity r)
        {
            switch (r)
            {
                case Rarity.Common: return 55;
                case Rarity.Rare: return 65;
                case Rarity.Epic: return 75;
                default: return 85;
            }
        }
    }

    /// <summary>
    /// Portal Surges: on a schedule, a Rune Circle's portal opens wide and rarer Kikis pour out around it for everyone
    /// nearby (the decisions doc's Crew Hunts, at Rune Circles). Golden Spiral is likelier then.
    /// </summary>
    public static class PortalSurge
    {
        public const int EverySeconds = 2 * 3600;
        public const int LastsSeconds = 15 * 60;

        public static bool Active(long unix) => Mod(unix, EverySeconds) < LastsSeconds;

        /// <summary>Seconds until the next surge starts (0 while one is on).</summary>
        public static long SecondsUntilNext(long unix) => Active(unix) ? 0 : EverySeconds - Mod(unix, EverySeconds);

        public static long SecondsLeft(long unix) => Active(unix) ? LastsSeconds - Mod(unix, EverySeconds) : 0;

        static long Mod(long a, long b) => ((a % b) + b) % b;
    }
}
