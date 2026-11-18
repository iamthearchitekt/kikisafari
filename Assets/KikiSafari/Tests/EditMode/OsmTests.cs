using System.Linq;
using KikiSafari.Core;
using NUnit.Framework;

namespace KikiSafari.Tests
{
    public class OsmTests
    {
        static readonly OsmArea Area = OsmFixture.Area();

        [Test]
        public void ParsesAndClassifiesOverpassData()
        {
            int Count(OsmKind k) => Area.Features.Count(f => f.Kind == k);
            Assert.Greater(Count(OsmKind.Building), 50);
            Assert.AreEqual(11, Count(OsmKind.Road));
            Assert.AreEqual(1, Count(OsmKind.Path));
            Assert.AreEqual(1, Count(OsmKind.Rail));
            Assert.AreEqual(1, Count(OsmKind.Park));
            Assert.AreEqual(1, Count(OsmKind.Woods));
            Assert.AreEqual(1, Count(OsmKind.WaterLine));
            Assert.AreEqual(2, Count(OsmKind.Water), "pond + the lake's outer ring");
            Assert.AreEqual(6, Count(OsmKind.Landmark), "fountain, three artworks, library, historic marker");
        }

        [Test]
        public void SafetyRulesKeepThingsOutOfBadSpots()
        {
            Assert.AreEqual("road", Area.Unsafe(OsmFixture.P((20, 100))));
            Assert.AreEqual("building", Area.Unsafe(OsmFixture.P((51, 62))));
            Assert.AreEqual("school", Area.Unsafe(OsmFixture.P((230, 630))));
            Assert.AreEqual("place_of_worship", Area.Unsafe(OsmFixture.P(OsmFixture.ChurchArt)));
            Assert.AreEqual("memorial", Area.Unsafe(OsmFixture.P((425, 150))));
            Assert.AreEqual("water", Area.Unsafe(OsmFixture.P((610, 465))));
            Assert.AreEqual("railway", Area.Unsafe(OsmFixture.P((762, 300))));
            Assert.IsNull(Area.Unsafe(OsmFixture.P((470, 450))), "a lawn in the park is fine");
        }

        [Test]
        public void HabitatsComeFromLandCover()
        {
            Assert.AreEqual(Habitat.Meadow, Area.HabitatAt(OsmFixture.P((470, 450))));
            Assert.AreEqual(Habitat.Water, Area.HabitatAt(OsmFixture.P((610, 465))));
            Assert.AreEqual(Habitat.Water, Area.HabitatAt(OsmFixture.P((300, 230))));
            Assert.AreEqual(Habitat.Woods, Area.HabitatAt(OsmFixture.P((100, 420))));
            Assert.AreEqual(Habitat.Town, Area.HabitatAt(OsmFixture.P((330, 700))));
        }

        [Test]
        public void QueryAsksForTheRightThings()
        {
            var q = OsmArea.Query(1, 2, 3, 4);
            StringAssert.Contains("[bbox:1,2,3,4]", q);
            StringAssert.Contains("out geom", q);
            foreach (var k in new[] { "artwork", "fountain", "historic", "school", "hospital", "place_of_worship", "cemetery", "military", "aerodrome", "building", "highway" })
                StringAssert.Contains(k, q);
        }
    }

    public class LandmarkTests
    {
        static readonly OsmArea Area = OsmFixture.Area();
        static readonly (System.Collections.Generic.List<PlacedSpot> stops, System.Collections.Generic.List<PlacedSpot> circles) Placed = LandmarkPlanner.Place(Area, OsmFixture.Cell);

        [Test]
        public void CirclesGoToTheMostNotableLandmarksWellSpread()
        {
            var c = Placed.circles;
            Assert.That(c.Count, Is.InRange(1, LandmarkPlanner.CirclesPerCell));
            Assert.IsTrue(c.All(x => x.Landmark));
            Assert.IsTrue(c.Any(x => x.Name.Contains("Willow") || x.Name.Contains("Old Mile Marker") || x.Name.Contains("Big Spiral")), string.Join(", ", c.Select(x => x.Name)));
            for (int i = 0; i < c.Count; i++)
                for (int j = i + 1; j < c.Count; j++)
                    Assert.GreaterOrEqual(Geo.Distance(c[i].Where, c[j].Where), LandmarkPlanner.CircleSpacing);
        }

        [Test]
        public void NothingLandsInUnsafeSpots()
        {
            var all = Placed.stops.Concat(Placed.circles).ToList();
            Assert.IsFalse(all.Any(s => s.Name == "Playground Mural"), "art inside a school is skipped");
            Assert.IsFalse(all.Any(s => s.Name == "Angel Statue"), "art beside a church is skipped");
            foreach (var s in all) Assert.IsNull(Area.Unsafe(s.Where, allowBuildings: true), s.Name);
            foreach (var s in all.Where(x => !x.Landmark)) Assert.IsNull(Area.Unsafe(s.Where), s.Id);
        }

        [Test]
        public void StopsAreSpacedAndCoverTheWholeCell()
        {
            var s = Placed.stops;
            for (int i = 0; i < s.Count; i++)
                for (int j = i + 1; j < s.Count; j++)
                    Assert.GreaterOrEqual(Geo.Distance(s[i].Where, s[j].Where), LandmarkPlanner.StopSpacing);
            Assert.IsTrue(s.Any(x => x.Landmark), "real landmarks become stops");
            Assert.IsTrue(s.Any(x => !x.Landmark), "quiet squares get filled");
            // Every 250 m square has a stop or circle within reach.
            var cell = OsmFixture.Cell;
            for (double e = 125; e < 750; e += 250)
                for (double n = 125; n < 750; n += 250)
                {
                    var p = cell.At(e, n);
                    double nearest = s.Concat(Placed.circles).Min(x => Geo.Distance(x.Where, p));
                    Assert.Less(nearest, 260, $"square at {e},{n}");
                }
        }

        [Test]
        public void PlacementIsDeterministic()
        {
            var again = LandmarkPlanner.Place(OsmFixture.Area(), OsmFixture.Cell);
            CollectionAssert.AreEqual(Placed.stops.Select(x => x.Id), again.stops.Select(x => x.Id));
            CollectionAssert.AreEqual(Placed.circles.Select(x => x.Id), again.circles.Select(x => x.Id));
        }

        [Test]
        public void TheLiveWorldUsesRealData()
        {
            var data = new WorldData();
            data.Add(OsmFixture.Cell, Area);
            var me = OsmFixture.Middle;
            Assert.IsTrue(data.Covers(me));
            for (long t = 1_800_000_000; t < 1_800_000_000 + 4 * 3600; t += 1800)
            {
                var list = LiveWorldPlanner.Nearby(me, t, VariantCatalog.Defaults, null, new SafariProgress(), null, data: data);
                Assert.IsTrue(list.Where(x => x.Kind == ThingKind.Stop).All(x => x.Id.StartsWith("osm:") || x.Id.StartsWith("fill:")));
                Assert.IsTrue(list.Any(x => x.Kind == ThingKind.Circle));
                foreach (var k in list.Where(x => x.Kind == ThingKind.Kiki))
                    Assert.IsTrue(data.IsSafe(k.Where), $"{k.Id} spawned somewhere unsafe: {Area.Unsafe(k.Where)}");
            }
        }
    }
}
