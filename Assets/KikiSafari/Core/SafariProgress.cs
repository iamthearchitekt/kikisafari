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
