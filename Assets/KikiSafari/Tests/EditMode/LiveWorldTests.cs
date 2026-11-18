using System;
using System.Linq;
using KikiSafari.Core;
using NUnit.Framework;

namespace KikiSafari.Tests
{
    public class GeoTests
    {
        static readonly LatLon Park = new LatLon(40.7829, -73.9654);

        [Test]
        public void LocalProjectionRoundTrips()
        {
            var p = Geo.FromLocal(Park, 120, -80);
            var (e, n) = Geo.ToLocal(Park, p);
            Assert.AreEqual(120, e, 0.01);
            Assert.AreEqual(-80, n, 0.01);
            Assert.AreEqual(Math.Sqrt(120 * 120 + 80 * 80), Geo.Distance(Park, p), 0.5);
        }

        [Test]
        public void BearingsPointTheRightWay()
        {
            Assert.AreEqual(0, Geo.Bearing(Park, Geo.FromLocal(Park, 0, 50)), 0.5);
            Assert.AreEqual(90, Geo.Bearing(Park, Geo.FromLocal(Park, 50, 0)), 0.5);
            Assert.AreEqual(225, Geo.Bearing(Park, Geo.FromLocal(Park, -50, -50)), 0.5);
        }

        [Test]
        public void GridCellsContainTheirPointsAndAreAboutTheRightSize()
        {
            foreach (var lat in new[] { -60.0, -33.9, 0.1, 39.0, 64.1 })
            {
                var p = new LatLon(lat, 151.2 - lat);
                var c = WorldGrid.CellOf(p, 70);
                Assert.That(p.Lat, Is.InRange(c.SouthWest.Lat, c.SouthWest.Lat + c.DegLat));
                Assert.That(p.Lon, Is.InRange(c.SouthWest.Lon, c.SouthWest.Lon + c.DegLon));
                double width = Geo.Distance(c.SouthWest, new LatLon(c.SouthWest.Lat, c.SouthWest.Lon + c.DegLon));
                Assert.AreEqual(70, width, 3, $"cell width at lat {lat}");
                var mid = c.At(35, 35);
                Assert.AreEqual(c.X, WorldGrid.CellOf(mid, 70).X);
                Assert.AreEqual(c.Y, WorldGrid.CellOf(mid, 70).Y);
            }
        }

        [Test]
        public void CellsAroundCoverTheRadius()
        {
            var cells = WorldGrid.CellsAround(Park, 200, 70);
            Assert.That(cells.Count, Is.InRange(25, 60));
            var far = Geo.FromLocal(Park, 190, 0);
            var target = WorldGrid.CellOf(far, 70);
            Assert.IsTrue(cells.Any(c => c.X == target.X && c.Y == target.Y));
        }

        [Test]
        public void NightFollowsTheLocalSun()
        {
            // New York, 20 June: sun up at local noon (16:00 UTC), down at local 1 am (05:00 UTC).
            Assert.IsFalse(SunClock.IsNight(Park, new DateTime(2026, 6, 20, 16, 0, 0, DateTimeKind.Utc)));
            Assert.IsTrue(SunClock.IsNight(Park, new DateTime(2026, 6, 20, 5, 0, 0, DateTimeKind.Utc)));
            // Sydney at the same instant is in daytime when New York is at night.
            Assert.IsFalse(SunClock.IsNight(new LatLon(-33.87, 151.21), new DateTime(2026, 6, 20, 2, 0, 0, DateTimeKind.Utc)));
            Assert.AreEqual(73.4, SunClock.Elevation(Park, new DateTime(2026, 6, 21, 16, 57, 0, DateTimeKind.Utc)), 1.0);
        }
    }

    public class LiveWorldTests
    {
        static readonly LatLon Here = new LatLon(51.5079, -0.0877);
        const long Now = 1_800_000_000;

        [Test]
        public void SameSpotSameMomentSameWorld()
        {
            var a = LiveWorldPlanner.Nearby(Here, Now, VariantCatalog.Defaults, null, null, null);
            var b = LiveWorldPlanner.Nearby(Here, Now, VariantCatalog.Defaults, null, null, null);
            CollectionAssert.AreEqual(a.Select(t => t.Id), b.Select(t => t.Id));
            Assert.IsTrue(a.Any(t => t.Kind == ThingKind.Kiki), "there should be Kikis within 200 m");
            Assert.IsTrue(a.Any(t => t.Kind == ThingKind.Stop), "there should be a supply stop within 200 m");
        }

        [Test]
        public void KikisAreSortedAndWithinRangeAndNotACrowd()
        {
            int total = 0, samples = 0;
            for (long t = Now; t < Now + 86400; t += 3600, samples++)
            {
                var list = LiveWorldPlanner.Nearby(Here, t, VariantCatalog.Defaults, null, null, null);
                Assert.IsTrue(list.All(x => x.Distance <= LiveWorldPlanner.NearbyRange + 0.01));
                for (int i = 1; i < list.Count; i++) Assert.LessOrEqual(list[i - 1].Distance, list[i].Distance);
                total += list.Count(x => x.Kind == ThingKind.Kiki);
            }
            double avg = total / (double)samples;
            Assert.That(avg, Is.InRange(5, 40), "average Kikis within 200 m");
        }

        [Test]
        public void CaughtKikisDisappear()
        {
            var list = LiveWorldPlanner.Nearby(Here, Now, VariantCatalog.Defaults, null, null, null);
            var first = list.First(t => t.Kind == ThingKind.Kiki);
            var after = LiveWorldPlanner.Nearby(Here, Now, VariantCatalog.Defaults, null, null, new[] { first.Id });
            Assert.IsFalse(after.Any(t => t.Id == first.Id));
        }

        [Test]
        public void TestCircleHasAKeeperAndAStopBesideIt()
        {
            var circle = new TestCircle { Where = Geo.FromLocal(Here, 6, 0) };
            var list = LiveWorldPlanner.Nearby(Here, Now, VariantCatalog.Defaults, circle, new SafariProgress(), null);
            var c = list.Single(t => t.Kind == ThingKind.Circle);
            Assert.IsNotNull(c.Variant);
            Assert.IsFalse(c.Mine);
            Assert.AreEqual(SpiralRite.KeeperAttunement(c.Variant.Rarity), c.KeeperAttunement);
            Assert.IsTrue(list.Any(t => t.Id == "s:home" && t.Distance < 20));
        }

        [Test]
        public void AKikiAlwaysWandersNearTheCircle()
        {
            var circle = new TestCircle { Where = Here };
            for (long t = Now; t < Now + 6 * 3600; t += 900)
            {
                var list = LiveWorldPlanner.Nearby(Here, t, VariantCatalog.Defaults, circle, null, null);
                var w = list.Where(x => x.Id.StartsWith("wander:")).ToList();
                Assert.AreEqual(1, w.Count);
                Assert.LessOrEqual(w[0].Distance, LiveWorldPlanner.ActionRange);
            }
        }

        [Test]
        public void PortalSurgeBringsKikisToTheCircle()
        {
            var circle = new TestCircle { Where = Here };
            long surgeTime = (Now / PortalSurge.EverySeconds) * PortalSurge.EverySeconds + 60;
            Assert.IsTrue(PortalSurge.Active(surgeTime));
            var list = LiveWorldPlanner.Nearby(Here, surgeTime, VariantCatalog.Defaults, circle, null, null);
            Assert.IsTrue(list.Single(t => t.Kind == ThingKind.Circle).Surge);
            Assert.That(list.Count(t => t.Id.StartsWith("surge:")), Is.InRange(1, 4));
            Assert.IsTrue(list.Where(t => t.Id.StartsWith("surge:")).All(t => t.Distance <= 27));
            Assert.AreEqual(0, PortalSurge.SecondsUntilNext(surgeTime));
            Assert.IsFalse(PortalSurge.Active(surgeTime + PortalSurge.LastsSeconds));
        }
    }

    public class SpiralRiteTests
    {
        [Test]
        public void PerfectRunScoresFull()
        {
            var r = new SpiralRite(beats: 8);
            for (int i = 0; i < 8; i++) Assert.AreEqual(RiteJudgement.Perfect, r.Tap(r.BeatTime(i) + 0.02).Value.judgement);
            Assert.AreEqual(100, r.Attunement);
        }

        [Test]
        public void JudgesTimingWindows()
        {
            var r = new SpiralRite(beats: 4);
            Assert.AreEqual(RiteJudgement.Good, r.Tap(r.BeatTime(0) + 0.12).Value.judgement);
            Assert.IsNull(r.Tap(r.BeatTime(1) + 0.3), "too far from any beat");
            var missed = r.Advance(r.BeatTime(1) + 0.2);
            CollectionAssert.AreEqual(new[] { 1 }, missed);
            Assert.AreEqual(RiteJudgement.Miss, r.Results[1]);
        }

        [Test]
        public void AttunementRewardsStreaksAndBeatsKeepers()
        {
            var r = new SpiralRite(beats: 10);
            for (int i = 0; i < 10; i++) if (i != 5) r.Tap(r.BeatTime(i));
            r.Advance(r.Duration);
            Assert.AreEqual(86, r.Attunement); // 9/10 * 90 + 5/10 * 10
            Assert.Greater(r.Attunement, SpiralRite.KeeperAttunement(Rarity.Epic));
            Assert.Less(r.Attunement, SpiralRite.KeeperAttunement(Rarity.Legendary) + 2);
        }

        [Test]
        public void KeptCirclesPaySproutsOverTime()
        {
            var p = new SafariProgress();
            p.TakeCircle("c", VariantIds.Pine, 80, 1000);
            Assert.AreEqual(0, p.CollectCircle("c", 1000 + 1700));
            Assert.AreEqual(40, p.CollectCircle("c", 1000 + 3700));
            Assert.AreEqual(SafariProgress.KeeperSproutsCap, p.CollectCircle("c", 1000 + 3600 * 48));
            Assert.AreEqual(VariantIds.Pine, p.KeeperOf("c").VariantId);
        }
    }
}
