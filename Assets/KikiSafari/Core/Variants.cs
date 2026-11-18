using System;
using System.Collections.Generic;

namespace KikiSafari.Core
{
    /// <summary>Habitat of a neighbourhood cell (Live) or a demo-map area.</summary>
    public enum Habitat { Meadow, Woods, Town, Water }

    /// <summary>When a variant may appear.</summary>
    public enum TimeOfDayRule { Any, DayOnly, NightOnly }

    /// <summary>
    /// Gameplay data for one Kiki variant. Visuals live in the Unity layer; this is what spawning and catching need.
    /// Every field can be changed from data (the KikiVariant asset) without code changes.
    /// </summary>
    [Serializable]
    public sealed class VariantDef
    {
        public string Id;
        public string DisplayName;
        public Rarity Rarity;
        /// <summary>Relative spawn weight before habitat and time adjustments.</summary>
        public float BaseWeight = 1f;
        public Habitat[] PreferredHabitats = Array.Empty<Habitat>();
        /// <summary>Weight multiplier inside a preferred habitat.</summary>
        public float HabitatBoost = 1f;
        /// <summary>Weight multiplier outside every preferred habitat (only when PreferredHabitats is not empty).</summary>
        public float OutsideHabitatFactor = 1f;
        public TimeOfDayRule TimeRule = TimeOfDayRule.Any;
        /// <summary>Weight multiplier during a Crew Hunt.</summary>
        public float CrewHuntBoost = 1f;

        public bool Prefers(Habitat h) => Array.IndexOf(PreferredHabitats, h) >= 0;
    }

    public static class VariantIds
    {
        public const string Meadow = "meadow";
        public const string Pine = "pine";
        public const string Sprout = "sprout";
        public const string Rainbow = "rainbow";
        public const string Moonbeam = "moonbeam";
        public const string GoldenSpiral = "golden-spiral";
    }

    /// <summary>The six launch variants (decisions doc, section 3). Used when no data assets are present.</summary>
    public static class VariantCatalog
    {
        public static IReadOnlyList<VariantDef> Defaults { get; } = new[]
        {
            new VariantDef
            {
                Id = VariantIds.Meadow, DisplayName = "Meadow Kiki", Rarity = Rarity.Common, BaseWeight = 10f,
                PreferredHabitats = new[] { Habitat.Meadow }, HabitatBoost = 3f, OutsideHabitatFactor = 0.6f,
                TimeRule = TimeOfDayRule.DayOnly,
            },
            new VariantDef
            {
                Id = VariantIds.Pine, DisplayName = "Pine Kiki", Rarity = Rarity.Common, BaseWeight = 10f,
                PreferredHabitats = new[] { Habitat.Woods }, HabitatBoost = 3f, OutsideHabitatFactor = 0.4f,
            },
            new VariantDef
            {
                Id = VariantIds.Sprout, DisplayName = "Sprout Kiki", Rarity = Rarity.Common, BaseWeight = 10f,
                PreferredHabitats = new[] { Habitat.Town }, HabitatBoost = 2f, OutsideHabitatFactor = 1f,
            },
            new VariantDef
            {
                Id = VariantIds.Rainbow, DisplayName = "Rainbow Kiki", Rarity = Rarity.Rare, BaseWeight = 2.5f,
                PreferredHabitats = new[] { Habitat.Water }, HabitatBoost = 4f, OutsideHabitatFactor = 0.25f,
            },
            new VariantDef
            {
                Id = VariantIds.Moonbeam, DisplayName = "Moonbeam Kiki", Rarity = Rarity.Epic, BaseWeight = 1.2f,
                TimeRule = TimeOfDayRule.NightOnly,
            },
            new VariantDef
            {
                Id = VariantIds.GoldenSpiral, DisplayName = "Golden Spiral Kiki", Rarity = Rarity.Legendary, BaseWeight = 0.15f,
                CrewHuntBoost = 6f,
            },
        };

        public static VariantDef Find(IReadOnlyList<VariantDef> list, string id)
        {
            for (int i = 0; i < list.Count; i++)
                if (list[i].Id == id) return list[i];
            return null;
        }
    }
}
