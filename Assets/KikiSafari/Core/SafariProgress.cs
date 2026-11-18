using System;
using System.Collections.Generic;

namespace KikiSafari.Core
{
    [Serializable]
    public sealed class VariantCount
    {
        public string VariantId;
        public int Count;
        public long FirstCaughtUnix;
    }

    [Serializable]
    public sealed class StopClaim
    {
        public string StopId;
        public long LastClaimUnix;
    }

    /// <summary>A Rune Circle this player's Kiki currently keeps.</summary>
    [Serializable]
    public sealed class CircleKeeper
    {
        public string CircleId;
        public string VariantId;
        public int Attunement;
        public long SinceUnix;
        public long LastCollectUnix;
    }

    /// <summary>
    /// Demo Safari save data, kept on the phone (no account). Field layout is JsonUtility-friendly: public fields, lists, no dictionaries.
    /// </summary>
    [Serializable]
    public sealed class SafariProgress
    {
        public const int StartingStones = 30;
        public const int Version = 1;

        public int SaveVersion = Version;
        public int Stones = StartingStones;
        public long Sprouts;
        public int TotalThrows;
        public int TotalCatches;
        public List<VariantCount> Catches = new List<VariantCount>();
        public List<StopClaim> StopClaims = new List<StopClaim>();
        public List<CircleKeeper> Keepers = new List<CircleKeeper>();

        /// <summary>Sprouts a kept circle pays: 20 per half hour held since the last collection, up to 480 (12 hours).</summary>
        public const int KeeperSproutsPerHalfHour = 20;
        public const int KeeperSproutsCap = 480;

        public CircleKeeper KeeperOf(string circleId)
        {
            foreach (var k in Keepers) if (k.CircleId == circleId) return k;
            return null;
        }

        /// <summary>The player's Kiki takes the circle.</summary>
        public void TakeCircle(string circleId, string variantId, int attunement, long now)
        {
            var k = KeeperOf(circleId);
            if (k == null) Keepers.Add(k = new CircleKeeper { CircleId = circleId });
            k.VariantId = variantId; k.Attunement = attunement; k.SinceUnix = now; k.LastCollectUnix = now;
        }

        /// <summary>Collects Sprouts earned by a kept circle since the last visit.</summary>
        public int CollectCircle(string circleId, long now)
        {
            var k = KeeperOf(circleId);
            if (k == null) return 0;
            long halfHours = Math.Max(0, now - k.LastCollectUnix) / 1800;
            int earned = (int)Math.Min(KeeperSproutsCap, halfHours * KeeperSproutsPerHalfHour);
            if (earned > 0) { k.LastCollectUnix += halfHours * 1800; Sprouts += earned; }
            return earned;
        }

        public int CountOf(string variantId)
        {
            foreach (var c in Catches) if (c.VariantId == variantId) return c.Count;
            return 0;
        }

        public bool HasCaught(string variantId) => CountOf(variantId) > 0;

        /// <summary>Uses one rune stone. Returns false when there are none left.</summary>
        public bool TryUseStone()
        {
            if (Stones <= 0) return false;
            Stones--;
            TotalThrows++;
            return true;
        }

        /// <summary>Gives a rune stone back, e.g. when a pending Live throw expires ("That one slipped away").</summary>
        public void RefundStone() { Stones++; if (TotalThrows > 0) TotalThrows--; }

        /// <summary>Records a catch and returns true when it is the first of that variant.</summary>
        public bool RecordCatch(string variantId, long unix, int reward)
        {
            TotalCatches++;
            Sprouts += Math.Max(0, reward);
            foreach (var c in Catches)
            {
                if (c.VariantId != variantId) continue;
                c.Count++;
                return false;
            }
            Catches.Add(new VariantCount { VariantId = variantId, Count = 1, FirstCaughtUnix = unix });
            return true;
        }

        public long SecondsUntilStopReady(string stopId, long nowUnix, int cooldownSeconds)
        {
            foreach (var s in StopClaims)
                if (s.StopId == stopId) return Math.Max(0, s.LastClaimUnix + cooldownSeconds - nowUnix);
            return 0;
        }

        /// <summary>Claims a supply stop if its per-player cooldown has passed.</summary>
        public bool TryClaimStop(string stopId, long nowUnix, int cooldownSeconds, int stones)
        {
            if (SecondsUntilStopReady(stopId, nowUnix, cooldownSeconds) > 0) return false;
            bool found = false;
            foreach (var s in StopClaims)
                if (s.StopId == stopId) { s.LastClaimUnix = nowUnix; found = true; }
            if (!found) StopClaims.Add(new StopClaim { StopId = stopId, LastClaimUnix = nowUnix });
            Stones += stones;
            return true;
        }
    }
}
