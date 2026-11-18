namespace KikiSafari.Core
{
    public enum Rarity { Common, Rare, Epic, Legendary }

    /// <summary>Rarity rules. Colours are the treatment's section 4 rarity tokens.</summary>
    public static class RarityInfo
    {
        /// <summary>Rune stone wobbles before a catch: 1 (Common), 2 (Rare), 3 (Epic and Legendary).</summary>
        public static int Wobbles(Rarity r)
        {
            switch (r)
            {
                case Rarity.Common: return 1;
                case Rarity.Rare: return 2;
                default: return 3;
            }
        }

        public static string Label(Rarity r) => r.ToString().ToUpperInvariant();

        public static uint MainColor(Rarity r)
        {
            switch (r)
            {
                case Rarity.Common: return 0xFFFFFF;
                case Rarity.Rare: return 0x4CC3FF;
                case Rarity.Epic: return 0xC77DFF;
                default: return 0xFFD23F;
            }
        }

        public static uint SecondColor(Rarity r)
        {
            switch (r)
            {
                case Rarity.Common: return 0x8FD3FF;
                case Rarity.Rare: return 0x1F6FD6;
                case Rarity.Epic: return 0x7A2FD6;
                default: return 0xFF8A00;
            }
        }

        /// <summary>Catch chance for a plain hit with no ring bonus and no spin.</summary>
        public static float BaseCatchChance(Rarity r)
        {
            switch (r)
            {
                case Rarity.Common: return 0.65f;
                case Rarity.Rare: return 0.45f;
                case Rarity.Epic: return 0.30f;
                default: return 0.15f;
            }
        }

        public static int BaseReward(Rarity r)
        {
            switch (r)
            {
                case Rarity.Common: return 100;
                case Rarity.Rare: return 250;
                case Rarity.Epic: return 500;
                default: return 1000;
            }
        }
    }
}
