using System.Linq;
using KikiSafari.Core;
using NUnit.Framework;

namespace KikiSafari.Tests
{
    sealed class FixedRandom : IRandom
    {
        readonly double[] _d; readonly int[] _i; int _di, _ii;
        public FixedRandom(double[] doubles, int[] ints = null) { _d = doubles; _i = ints ?? new[] { 0 }; }
        public double NextDouble() => _d[_di++ % _d.Length];
        public int Next(int min, int max) { int v = _i[_ii++ % _i.Length]; return v < min ? min : v >= max ? max - 1 : v; }
    }

    public class CatchRulesTests
    {
        [TestCase(Rarity.Common, 1)]
        [TestCase(Rarity.Rare, 2)]
        [TestCase(Rarity.Epic, 3)]
        [TestCase(Rarity.Legendary, 3)]
        public void WobbleCountsMatchRarity(Rarity r, int expected) => Assert.AreEqual(expected, RarityInfo.Wobbles(r));

        [Test]
        public void SmallerRingGivesBetterQuality()
        {
            Assert.AreEqual(ThrowQuality.Excellent, CatchMath.Quality(0.1f));
            Assert.AreEqual(ThrowQuality.Great, CatchMath.Quality(0.4f));
            Assert.AreEqual(ThrowQuality.Nice, CatchMath.Quality(0.7f));
            Assert.AreEqual(ThrowQuality.None, CatchMath.Quality(0.95f));
        }

        [Test]
        public void ChanceRisesWithQualityAndSpinAndIsClamped()
        {
            float plain = CatchMath.CatchChance(Rarity.Rare, ThrowQuality.None, false);
            float great = CatchMath.CatchChance(Rarity.Rare, ThrowQuality.Great, false);
            float greatSpin = CatchMath.CatchChance(Rarity.Rare, ThrowQuality.Great, true);
            Assert.Less(plain, great);
            Assert.Less(great, greatSpin);
            Assert.LessOrEqual(CatchMath.CatchChance(Rarity.Common, ThrowQuality.Excellent, true, 10f), CatchMath.MaxChance);
            Assert.GreaterOrEqual(CatchMath.CatchChance(Rarity.Legendary, ThrowQuality.None, false, 0.01f), CatchMath.MinChance);
        }

        [Test]
        public void MissNeverWobbles()
        {
            var o = CatchMath.Resolve(Rarity.Epic, new ThrowReport { Hit = false }, new FixedRandom(new[] { 0.0 }));
            Assert.AreEqual(CatchResult.Missed, o.Result);
            Assert.AreEqual(0, o.Wobbles);
        }

        [Test]
        public void CatchPlaysFullWobbles()
        {
            var o = CatchMath.Resolve(Rarity.Rare, new ThrowReport { Hit = true, RingScale = 0.3f }, new FixedRandom(new[] { 0.0 }));
            Assert.AreEqual(CatchResult.Caught, o.Result);
            Assert.AreEqual(2, o.Wobbles);
            Assert.AreEqual(ThrowQuality.Great, o.Quality);
        }

        [Test]
        public void BreakoutWobblesStayWithinRange()
        {
            for (int k = 0; k <= 3; k++)
            {
                var o = CatchMath.Resolve(Rarity.Legendary, new ThrowReport { Hit = true, RingScale = 1f }, new FixedRandom(new[] { 0.999 }, new[] { k }));
                Assert.AreEqual(CatchResult.BrokeOut, o.Result);
                Assert.That(o.Wobbles, Is.InRange(0, 3));
            }
        }

        [Test]
        public void CatchRateRoughlyMatchesChance()
        {
            var rng = new SeededRandom(42);
            int caught = 0, n = 20000;
            for (int i = 0; i < n; i++)
                if (CatchMath.Resolve(Rarity.Common, new ThrowReport { Hit = true, RingScale = 1f }, rng).Result == CatchResult.Caught) caught++;
            Assert.AreEqual(RarityInfo.BaseCatchChance(Rarity.Common), caught / (double)n, 0.02);
        }

        [Test]
        public void RewardListsBonusesOnlyWhenEarned()
        {
            var plain = CatchMath.Reward(Rarity.Common, ThrowQuality.None, false, false);
            Assert.AreEqual(1, plain.Lines.Count);
            Assert.AreEqual(RarityInfo.BaseReward(Rarity.Common), plain.Total);

            var full = CatchMath.Reward(Rarity.Epic, ThrowQuality.Excellent, true, true);
            Assert.AreEqual(4, full.Lines.Count);
            Assert.IsTrue(full.Lines.Any(l => l.Label.Contains("Excellent")));
            Assert.IsTrue(full.Lines.Any(l => l.Label.Contains("Spin")));
        }

        [Test]
        public void TimingRingShrinksThenGrows()
        {
            Assert.AreEqual(1f, TimingRing.Scale(0, 2), 1e-5);
            Assert.AreEqual(0f, TimingRing.Scale(1, 2), 1e-5);
            Assert.AreEqual(0.5f, TimingRing.Scale(0.5, 2), 1e-5);
            Assert.AreEqual(1f, TimingRing.Scale(2, 2), 1e-5);
            Assert.Less(TimingRing.Scale(0.9, 2), TimingRing.Scale(0.2, 2));
        }
    }

    public class RevealTimelineTests
    {
        static CatchOutcome Caught(int w) => new CatchOutcome { Result = CatchResult.Caught, Wobbles = w, Quality = ThrowQuality.Great };

        [Test]
        public void CatchFollowsTreatmentOrderAndWaitsForPlayer()
        {
            var steps = RevealTimeline.Build(Caught(3), Rarity.Epic, default).Select(s => s.Kind).ToList();
            int burst = steps.IndexOf(RevealStepKind.Burst);
            Assert.AreEqual(3, steps.Count(k => k == RevealStepKind.Wobble));
            Assert.Less(steps.LastIndexOf(RevealStepKind.Wobble), burst);
            Assert.Less(burst, steps.IndexOf(RevealStepKind.RarityStamp));
            Assert.Less(steps.IndexOf(RevealStepKind.RarityStamp), steps.IndexOf(RevealStepKind.KikiDropIn));
            Assert.Less(steps.IndexOf(RevealStepKind.Dance), steps.IndexOf(RevealStepKind.CountUp));
            Assert.AreEqual(RevealStepKind.AwaitKeepPlaying, steps.Last());
            Assert.IsTrue(float.IsPositiveInfinity(RevealTimeline.Build(Caught(1), Rarity.Common, default).Last().Duration));
        }

        [Test]
        public void HitOpensAPortalThatSucksKikiIntoTheStone()
        {
            var steps = RevealTimeline.Build(Caught(1), Rarity.Common, default).Select(s => s.Kind).ToList();
            int open = steps.IndexOf(RevealStepKind.PortalOpen), suck = steps.IndexOf(RevealStepKind.SuckIn);
            int seal = steps.IndexOf(RevealStepKind.PortalSeal), drop = steps.IndexOf(RevealStepKind.StoneDrop);
            Assert.That(open, Is.GreaterThan(steps.IndexOf(RevealStepKind.HitSparkle)));
            Assert.That(suck, Is.GreaterThan(open));
            Assert.That(seal, Is.GreaterThan(suck));
            Assert.That(drop, Is.GreaterThan(seal));
            Assert.That(steps.IndexOf(RevealStepKind.Wobble), Is.GreaterThan(drop));
        }

        [Test]
        public void EveryWobbleHasAHapticKnock()
        {
            var wobbles = RevealTimeline.Build(Caught(2), Rarity.Rare, default).Where(s => s.Kind == RevealStepKind.Wobble).ToList();
            Assert.AreEqual(2, wobbles.Count);
            Assert.IsTrue(wobbles.All(w => w.Haptic != HapticKind.None));
        }

        [Test]
        public void NoSpoilersBeforeTheResult()
        {
            var steps = RevealTimeline.Build(Caught(3), Rarity.Legendary, default);
            int burst = steps.FindIndex(s => s.Kind == RevealStepKind.Burst);
            for (int i = 0; i < burst; i++) Assert.IsNull(steps[i].Text, $"step {steps[i]} shows text before the result");
            var hit = steps.First(s => s.Kind == RevealStepKind.HitSparkle);
            Assert.AreEqual(HapticKind.Medium, hit.Haptic);
        }

        [Test]
        public void MissShowsNoText()
        {
            var steps = RevealTimeline.Build(new CatchOutcome { Result = CatchResult.Missed }, Rarity.Common, default);
            Assert.IsTrue(steps.All(s => s.Text == null));
            Assert.AreEqual(RevealStepKind.Fizzle, steps.Last().Kind);
        }

        [Test]
        public void BreakoutSaysSoCloseWithWarningAndShake()
        {
            var steps = RevealTimeline.Build(new CatchOutcome { Result = CatchResult.BrokeOut, Wobbles = 1 }, Rarity.Rare, default);
            Assert.IsTrue(steps.Any(s => s.Kind == RevealStepKind.PopOpen && s.Haptic == HapticKind.Warning));
            var soClose = steps.Single(s => s.Kind == RevealStepKind.SoClose);
            Assert.AreEqual(RevealTimeline.SoCloseText, soClose.Text);
            Assert.Greater(soClose.Shake, 0f);
            Assert.AreEqual(Voice.Awww, soClose.Voice);
            Assert.AreEqual(0.5f, soClose.VoiceChance, 1e-6);
        }

        [Test]
        public void ReducedMotionRemovesShakeAndShortensWobbles()
        {
            var opt = new RevealOptions { ReducedMotion = true };
            var b = RevealTimeline.Build(new CatchOutcome { Result = CatchResult.BrokeOut, Wobbles = 2 }, Rarity.Rare, opt);
            Assert.IsTrue(b.All(s => s.Shake == 0f));
            Assert.IsTrue(b.Where(s => s.Kind == RevealStepKind.Wobble).All(s => s.Duration < RevealTimeline.WobbleSeconds));
        }

        [Test]
        public void PendingThrowStaysSealed()
        {
            var steps = RevealTimeline.Build(Caught(2), Rarity.Rare, new RevealOptions { Pending = true });
            Assert.AreEqual(RevealStepKind.PendingSealed, steps.Last().Kind);
            Assert.IsFalse(steps.Any(s => s.Kind == RevealStepKind.Wobble || s.Kind == RevealStepKind.Burst));
        }
    }
}
