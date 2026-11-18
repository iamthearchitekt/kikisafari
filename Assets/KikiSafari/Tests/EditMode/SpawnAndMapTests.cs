using System.Linq;
using KikiSafari.Core;
using NUnit.Framework;

namespace KikiSafari.Tests
{
    public class SpawnTests
    {
        static SpawnContext Ctx(Habitat h, bool night = false, bool crew = false) => new SpawnContext { Habitat = h, IsNight = night, CrewHunt = crew };

        [Test]
        public void MoonbeamOnlyAtNightAndMeadowOnlyByDay()
        {
            var moon = VariantCatalog.Find(VariantCatalog.Defaults, VariantIds.Moonbeam);
            var meadow = VariantCatalog.Find(VariantCatalog.Defaults, VariantIds.Meadow);
            Assert.AreEqual(0f, SpawnPlanner.Weight(moon, Ctx(Habitat.Meadow)));
            Assert.Greater(SpawnPlanner.Weight(moon, Ctx(Habitat.Meadow, night: true)), 0f);
            Assert.AreEqual(0f, SpawnPlanner.Weight(meadow, Ctx(Habitat.Meadow, night: true)));
        }

        [Test]
        public void HabitatsFavourTheirVariants()
        {
            var all = VariantCatalog.Defaults;
            var pine = VariantCatalog.Find(all, VariantIds.Pine);
            var rainbow = VariantCatalog.Find(all, VariantIds.Rainbow);
            Assert.Greater(SpawnPlanner.Weight(pine, Ctx(Habitat.Woods)), SpawnPlanner.Weight(pine, Ctx(Habitat.Town)));
            Assert.Greater(SpawnPlanner.Weight(rainbow, Ctx(Habitat.Water)), SpawnPlanner.Weight(rainbow, Ctx(Habitat.Meadow)));
        }

        [Test]
        public void GoldenSpiralIsRareButLikelierInCrewHunts()
        {
            var g = VariantCatalog.Find(VariantCatalog.Defaults, VariantIds.GoldenSpiral);
            Assert.Greater(SpawnPlanner.Weight(g, Ctx(Habitat.Town, crew: true)), SpawnPlanner.Weight(g, Ctx(Habitat.Town)));
            var rng = new SeededRandom(7);
            int golden = 0, n = 50000;
            for (int i = 0; i < n; i++)
                if (SpawnPlanner.Pick(VariantCatalog.Defaults, Ctx(Habitat.Town), rng.NextDouble()).Id == VariantIds.GoldenSpiral) golden++;
            Assert.Less(golden / (double)n, 0.02);
            Assert.Greater(golden, 0);
        }

        [Test]
        public void PlansAreDeterministicAndDifferByCell()
        {
            SpawnContext F(long _) => Ctx(Habitat.Meadow);
            var a = SpawnPlanner.PlanWindow(VariantCatalog.Defaults, 10, 20, 5000, 99, 70, 4, F);
            var b = SpawnPlanner.PlanWindow(VariantCatalog.Defaults, 10, 20, 5000, 99, 70, 4, F);
            var c = SpawnPlanner.PlanWindow(VariantCatalog.Defaults, 11, 20, 5000, 99, 70, 4, F);
            CollectionAssert.AreEqual(a.Select(s => (s.VariantId, s.OffsetEast, s.StartUnix)), b.Select(s => (s.VariantId, s.OffsetEast, s.StartUnix)));
            CollectionAssert.AreNotEqual(a.Select(s => s.OffsetEast), c.Select(s => s.OffsetEast));
        }

        [Test]
        public void SpawnsLastFifteenToThirtyMinutesAndStayInCell()
        {
            var plan = SpawnPlanner.PlanWindow(VariantCatalog.Defaults, 1, 2, 777, 3, 70, 50, _ => Ctx(Habitat.Woods));
            Assert.IsTrue(plan.All(s => s.DurationSeconds >= 15 * 60 && s.DurationSeconds <= 30 * 60));
            Assert.IsTrue(plan.All(s => s.OffsetEast >= 0 && s.OffsetEast < 70 && s.OffsetNorth >= 0 && s.OffsetNorth < 70));
        }

        [Test]
        public void ActiveSpawnsAreAliveNow()
        {
            long now = 1_800_000_000;
            var active = SpawnPlanner.ActiveSpawns(VariantCatalog.Defaults, 3, 4, now, 1, 70, 3, _ => Ctx(Habitat.Meadow));
            Assert.IsNotEmpty(active);
            Assert.IsTrue(active.All(s => s.IsActive(now)));
        }
    }

    public class MovementGuardTests
    {
        [Test]
        public void SpeedLockHasHysteresis()
        {
            Assert.IsFalse(MovementGuard.IsSpeedLocked(false, 28));
            Assert.IsTrue(MovementGuard.IsSpeedLocked(false, 35));
            Assert.IsTrue(MovementGuard.IsSpeedLocked(true, 27));
            Assert.IsFalse(MovementGuard.IsSpeedLocked(true, 20));
        }

        [Test]
        public void RejectsBadFixes()
        {
            long now = 1000;
            var good = new GeoFix { Lat = 51.5, Lon = -0.1, AccuracyMeters = 10, TimestampUnix = now };
            Assert.AreEqual(FixVerdict.Ok, MovementGuard.Check(good, null, now));
            Assert.AreEqual(FixVerdict.TooInaccurate, MovementGuard.Check(new GeoFix { AccuracyMeters = 80, TimestampUnix = now }, null, now));
            Assert.AreEqual(FixVerdict.TooOld, MovementGuard.Check(new GeoFix { AccuracyMeters = 5, TimestampUnix = now - 60 }, null, now));
            var prev = new GeoFix { Lat = 48.85, Lon = 2.35, AccuracyMeters = 5, TimestampUnix = now - 10 };
            Assert.AreEqual(FixVerdict.ImpossibleJump, MovementGuard.Check(good, prev, now));
        }

        [Test]
        public void DistanceIsSensible()
        {
            // One degree of latitude is about 111 km.
            Assert.AreEqual(111195, MovementGuard.DistanceMeters(0, 0, 1, 0), 200);
        }
    }

    public class ProgressAndThrowTests
    {
        [Test]
        public void StonesAndCatchesAreTracked()
        {
            var p = new SafariProgress { Stones = 1 };
            Assert.IsTrue(p.TryUseStone());
            Assert.IsFalse(p.TryUseStone());
            p.RefundStone();
            Assert.AreEqual(1, p.Stones);
            Assert.IsTrue(p.RecordCatch(VariantIds.Pine, 1, 100));
            Assert.IsFalse(p.RecordCatch(VariantIds.Pine, 2, 100));
            Assert.AreEqual(2, p.CountOf(VariantIds.Pine));
            Assert.AreEqual(200, p.Sprouts);
        }

        [Test]
        public void SupplyStopsHaveAPerPlayerCooldown()
        {
            var p = new SafariProgress { Stones = 0 };
            Assert.IsTrue(p.TryClaimStop("tent", 100, 300, 5));
            Assert.IsFalse(p.TryClaimStop("tent", 200, 300, 5));
            Assert.AreEqual(200, p.SecondsUntilStopReady("tent", 200, 300));
            Assert.IsTrue(p.TryClaimStop("bridge", 200, 300, 5));
            Assert.IsTrue(p.TryClaimStop("tent", 400, 300, 5));
            Assert.AreEqual(15, p.Stones);
        }

        [Test]
        public void SolvedThrowLandsOnTarget()
        {
            var from = new Vec3(0, 1.2, 0);
            var to = new Vec3(0.3, 0.2, 2.5);
            var v = ThrowMath.SolveForFlightTime(from, to, 9.81, 0.8);
            var at = ThrowMath.PositionAt(from, v, 9.81, 0.8);
            Assert.AreEqual(0, (at - to).Length, 1e-9);
        }

        [Test]
        public void AimAssistPullsTowardTarget()
        {
            var from = new Vec3(0, 1.2, 0);
            var to = new Vec3(0, 0.3, 2.5);
            var sloppy = new Vec3(1.5, 4, 3);
            double before = ThrowMath.ClosestApproach(from, sloppy, 9.81, to, 2);
            double after = ThrowMath.ClosestApproach(from, ThrowMath.ApplyAimAssist(from, to, sloppy, 9.81, 0.6), 9.81, to, 2);
            Assert.Less(after, before);
            Assert.AreEqual(0, ThrowMath.ClosestApproach(from, ThrowMath.ApplyAimAssist(from, to, sloppy, 9.81, 1), 9.81, to, 2), 0.05);
        }

        [Test]
        public void TuningClampsToSafeRanges()
        {
            var t = new TuningValues { AimAssist = 4, RingPeriod = 0, Gravity = 100 };
            t.Clamp();
            Assert.AreEqual(1f, t.AimAssist);
            Assert.GreaterOrEqual(t.RingPeriod, 0.8f);
            Assert.LessOrEqual(t.Gravity, 20f);
        }
    }

    public class DemoMapTests
    {
        const string Sample = @"{ ""type"":""FeatureCollection"", ""origin"":[0,0], ""features"":[
          {""type"":""Feature"",""properties"":{""id"":""m"",""name"":""Sunny Meadow"",""kind"":""area"",""habitat"":""meadow""},
           ""geometry"":{""type"":""Polygon"",""coordinates"":[[[0,0],[0.001,0],[0.001,0.001],[0,0.001],[0,0]]]}},
          {""type"":""Feature"",""properties"":{""id"":""w"",""name"":""Pine Hollow"",""kind"":""area"",""habitat"":""woods""},
           ""geometry"":{""type"":""Polygon"",""coordinates"":[[[0.002,0],[0.003,0],[0.003,0.001],[0.002,0.001],[0.002,0]]]}},
          {""type"":""Feature"",""properties"":{""id"":""c"",""kind"":""water""},
           ""geometry"":{""type"":""LineString"",""coordinates"":[[0.0015,-0.001],[0.0015,0.002]]}},
          {""type"":""Feature"",""properties"":{""id"":""t"",""name"":""Supply Tent"",""kind"":""stop""},
           ""geometry"":{""type"":""Point"",""coordinates"":[-1.2e-4,5e-5]}}
        ]}";

        [Test]
        public void ParsesFeaturesAndProjectsToMetres()
        {
            var map = DemoMap.FromGeoJson(Sample);
            Assert.AreEqual(4, map.Features.Count);
            var tent = map.Find("t");
            Assert.AreEqual(MapFeatureKind.Stop, tent.Kind);
            Assert.AreEqual(-13.36, tent.Points[0].East, 0.05);
            Assert.AreEqual(4, map.Find("m").Points.Count, "closing point is dropped");
        }

        [Test]
        public void HabitatComesFromAreasAndWater()
        {
            var map = DemoMap.FromGeoJson(Sample);
            Assert.AreEqual(Habitat.Meadow, map.HabitatAt(new MapPoint(50, 50)));
            Assert.AreEqual(Habitat.Woods, map.HabitatAt(new MapPoint(280, 50)));
            Assert.AreEqual(Habitat.Water, map.HabitatAt(new MapPoint(170, 50)));
            map.DefaultHabitat = Habitat.Town;
            Assert.AreEqual(Habitat.Town, map.HabitatAt(new MapPoint(-500, -500)));
        }

        [Test]
        public void JsonReaderHandlesEscapesAndNumbers()
        {
            var o = (System.Collections.Generic.Dictionary<string, object>)MiniJson.Parse(@"{""a"":""x\""yA"",""b"":[1,-2.5e2,true,null]}");
            Assert.AreEqual("x\"yA", o["a"]);
            var b = (System.Collections.Generic.List<object>)o["b"];
            Assert.AreEqual(-250.0, b[1]);
            Assert.AreEqual(true, b[2]);
            Assert.IsNull(b[3]);
            Assert.Throws<System.FormatException>(() => MiniJson.Parse("{\"a\":}"));
        }
    }
}
