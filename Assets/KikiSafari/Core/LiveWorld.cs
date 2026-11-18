using System;
using System.Collections.Generic;

namespace KikiSafari.Core
{
    public enum ThingKind { Kiki, Stop, Circle }

    /// <summary>Something in the real world near the player.</summary>
    public sealed class WorldThing
    {
        public ThingKind Kind;
        public string Id;
        public string Name;
        public LatLon Where;
        /// <summary>Kikis: the variant. Circles: the Keeper's variant.</summary>
        public VariantDef Variant;
        /// <summary>Circles: kept by the player.</summary>
        public bool Mine;
        public int KeeperAttunement;
        public bool Surge;
        public double Distance;
        public double Bearing;
    }

    public sealed class TestCircle
    {
        public LatLon Where;
        public string Name = "Home Rune Circle";
    }

    /// <summary>
    /// What's around the player anywhere on Earth (decisions doc, section 4, with the owner's Rune Circles). Deterministic
    /// from the place and the time, so everyone nearby sees the same Kikis and stops; the server will become the
    /// authority for Live Safari. For testing there is one Rune Circle, pinned on the owner's phone.
    /// </summary>
    public static class LiveWorldPlanner
    {
        public const double KikiCell = 70;
        /// <summary>Share of spawn slots that produce a Kiki (keeps it to a handful nearby, not a crowd).</summary>
        public const double SpawnChance = 0.45;
        public const double StopCell = 250;
        public const double NearbyRange = 200, VisibleRange = 70, ActionRange = 40;
        public const ulong WorldSeed = 0x4B494B4953414641UL; // "KIKISAFA"

        /// <param name="data">Real-world map data, when loaded: landmark stops and circles, spawn safety, habitats.</param>
        public static List<WorldThing> Nearby(LatLon me, long now, IReadOnlyList<VariantDef> variants, TestCircle circle,
            SafariProgress progress, ICollection<string> caught, double range = NearbyRange, WorldData data = null)
        {
            var list = new List<WorldThing>();
            var utc = DateTimeOffset.FromUnixTimeSeconds(now).UtcDateTime;
            bool mapped = data != null && data.Covers(me);

            foreach (var cell in WorldGrid.CellsAround(me, range, KikiCell))
            {
                var ctx = new SpawnContext
                {
                    Habitat = (mapped ? data.HabitatAt(cell.Center) : null) ?? WorldGrid.RotatingHabitat(cell.Center, now, WorldSeed),
                    IsNight = SunClock.IsNight(cell.Center, utc),
                };
                foreach (var s in SpawnPlanner.ActiveSpawns(variants, cell.X, cell.Y, now, WorldSeed, KikiCell, 1, _ => ctx, SpawnChance))
                {
                    var at = cell.At(s.OffsetEast, s.OffsetNorth);
                    // Spawn safety: never on roads or railways, in water or buildings, or near schools and the like.
                    if (data != null && !data.IsSafe(at)) continue;
                    AddKiki(list, $"k:{cell.X}:{cell.Y}:{s.StartUnix}", s.VariantId, at, variants, caught);
                }
            }

            if (mapped)
            {
                foreach (var s in data.Stops)
                    list.Add(new WorldThing { Kind = ThingKind.Stop, Id = s.Id, Name = s.Name, Where = s.Where });
                foreach (var c in data.Circles)
                    AddCircle(list, c.Id, c.Name, c.Where, now, utc, variants, progress, caught, data);
            }
            else
            {
                foreach (var cell in WorldGrid.CellsAround(me, range, StopCell))
                {
                    var rng = new SeededRandom(SeededRandom.Hash((long)WorldSeed, cell.X, cell.Y, 5));
                    var at = cell.At(StopCell * (0.15 + 0.7 * rng.NextDouble()), StopCell * (0.15 + 0.7 * rng.NextDouble()));
                    list.Add(new WorldThing { Kind = ThingKind.Stop, Id = $"s:{cell.X}:{cell.Y}", Name = "Supply Stop", Where = at });
                }
            }

            if (circle != null)
            {
                AddCircle(list, "circle:home", circle.Name, circle.Where, now, utc, variants, progress, caught, data);
                // A supply stop beside the home circle, so testing at home always has a refill.
                list.Add(new WorldThing { Kind = ThingKind.Stop, Id = "s:home", Name = "Circle Supply Stop", Where = Geo.FromLocal(circle.Where, 9, -6) });
            }

            foreach (var t in list) { t.Distance = Geo.Distance(me, t.Where); t.Bearing = Geo.Bearing(me, t.Where); }
            list.RemoveAll(t => t.Kind == ThingKind.Circle ? t.Distance > CircleRange : t.Distance > range);
            list.Sort((a, b) => a.Distance.CompareTo(b.Distance));
            return list;
        }

        /// <summary>Rune Circles are visible from further away (their light column).</summary>
        public const double CircleRange = 400;

        static void AddCircle(List<WorldThing> list, string id, string name, LatLon where, long now, DateTime utc,
            IReadOnlyList<VariantDef> variants, SafariProgress progress, ICollection<string> caught, WorldData data)
        {
            bool Safe(LatLon p) => data == null || data.IsSafe(p);
            {
                bool surge = PortalSurge.Active(now);
                var keeper = progress?.KeeperOf(id);
                VariantDef keeperDef;
                int attune;
                if (keeper != null)
                {
                    keeperDef = VariantCatalog.Find(variants, keeper.VariantId) ?? variants[0];
                    attune = keeper.Attunement;
                }
                else
                {
                    // A wild Keeper, chosen fresh each day, different at each circle.
                    long day = (long)Math.Floor(now / 86400.0);
                    keeperDef = SpawnPlanner.Pick(variants, new SpawnContext { Habitat = Habitat.Meadow, IsNight = SunClock.IsNight(where, utc) },
                        new SeededRandom(SeededRandom.Hash((long)WorldSeed, day, 77, (long)(LandmarkHash(id) & 0x7fffffff))).NextDouble()) ?? variants[0];
                    attune = SpiralRite.KeeperAttunement(keeperDef.Rarity);
                }
                list.Add(new WorldThing
                {
                    Kind = ThingKind.Circle, Id = id, Name = name, Where = where, Variant = keeperDef,
                    Mine = keeper != null, KeeperAttunement = attune, Surge = surge,
                });
                long salt = (long)(LandmarkHash(id) & 0x7fffffff);

                // A wanderer: one Kiki always hangs around each circle (a new one each spawn window).
                {
                    long w = SpawnPlanner.WindowIndex(now);
                    var rng = new SeededRandom(SeededRandom.Hash((long)WorldSeed, w, 55, salt));
                    var ctx = new SpawnContext { Habitat = WorldGrid.RotatingHabitat(where, now, WorldSeed), IsNight = SunClock.IsNight(where, utc) };
                    var v = SpawnPlanner.Pick(variants, ctx, rng.NextDouble());
                    double a = rng.NextDouble() * Math.PI * 2, r = 10 + rng.NextDouble() * 14;
                    // Try a few directions until the spot is safe (not in the road, a building or water).
                    for (int k = 0; k < 8 && v != null; k++)
                    {
                        var at = Geo.FromLocal(where, Math.Cos(a + k * 0.8) * r, Math.Sin(a + k * 0.8) * r);
                        if (!Safe(at)) continue;
                        AddKiki(list, $"wander:{salt}:{w}", v.Id, at, variants, caught);
                        break;
                    }
                }

                // Portal Surge: rarer Kikis pour out around the circle.
                if (surge)
                {
                    long surgeIndex = now / PortalSurge.EverySeconds;
                    var rng = new SeededRandom(SeededRandom.Hash((long)WorldSeed, surgeIndex, 99, salt));
                    var ctx = new SpawnContext { Habitat = Habitat.Meadow, IsNight = SunClock.IsNight(where, utc), CrewHunt = true };
                    for (int i = 0; i < 4; i++)
                    {
                        double a = rng.NextDouble() * Math.PI * 2, r = 8 + rng.NextDouble() * 18;
                        var v = SpawnPlanner.Pick(variants, ctx, rng.NextDouble());
                        if (v == null) continue;
                        var at = Geo.FromLocal(where, Math.Cos(a) * r, Math.Sin(a) * r);
                        if (Safe(at)) AddKiki(list, $"surge:{salt}:{surgeIndex}:{i}", v.Id, at, variants, caught);
                    }
                }
            }
        }

        static ulong LandmarkHash(string s)
        {
            unchecked
            {
                ulong h = 1469598103934665603UL;
                foreach (char c in s) { h ^= c; h *= 1099511628211UL; }
                return h;
            }
        }

        static void AddKiki(List<WorldThing> list, string id, string variantId, LatLon at, IReadOnlyList<VariantDef> variants, ICollection<string> caught)
        {
            if (caught != null && caught.Contains(id)) return;
            var def = VariantCatalog.Find(variants, variantId);
            if (def == null) return;
            list.Add(new WorldThing { Kind = ThingKind.Kiki, Id = id, Name = def.DisplayName, Where = at, Variant = def });
        }
    }
}
