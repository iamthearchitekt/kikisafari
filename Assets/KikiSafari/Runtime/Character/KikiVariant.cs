using System;
using System.Collections.Generic;
using KikiSafari.Core;
using KikiSafari.Core.Art;
using UnityEngine;

namespace KikiSafari
{
    /// <summary>
    /// One Kiki variant as a data asset (Resources/Variants). Name, rarity, habitat and spawn weights change here without
    /// code. The look (crown, embroidery, glow) is the shared <see cref="KikiLookSpec"/>; colours are 0xRRGGBB.
    /// When no assets exist yet, <see cref="VariantLibrary"/> falls back to the built-in six.
    /// </summary>
    [CreateAssetMenu(menuName = "Kiki Safari/Kiki Variant", fileName = "KikiVariant")]
    public sealed class KikiVariant : ScriptableObject
    {
        public VariantDef Def = new VariantDef();
        public KikiLookSpec Look = new KikiLookSpec();
    }

    /// <summary>Loads variants from Resources/Variants, or uses the built-in six.</summary>
    public sealed class VariantLibrary
    {
        public readonly List<VariantDef> Defs = new List<VariantDef>();
        readonly Dictionary<string, KikiLookSpec> _looks = new Dictionary<string, KikiLookSpec>();

        public static VariantLibrary Load()
        {
            var lib = new VariantLibrary();
            var assets = Resources.LoadAll<KikiVariant>("Variants");
            if (assets != null && assets.Length > 0)
            {
                Array.Sort(assets, (a, b) => a.Def.Rarity != b.Def.Rarity ? a.Def.Rarity.CompareTo(b.Def.Rarity) : string.CompareOrdinal(a.Def.Id, b.Def.Id));
                foreach (var a in assets)
                {
                    if (a == null || string.IsNullOrEmpty(a.Def?.Id)) continue;
                    lib.Defs.Add(a.Def);
                    lib._looks[a.Def.Id] = a.Look ?? KikiLookSpec.For(a.Def.Id);
                }
            }
            if (lib.Defs.Count == 0)
            {
                lib.Defs.AddRange(VariantCatalog.Defaults);
                foreach (var d in lib.Defs) lib._looks[d.Id] = KikiLookSpec.For(d.Id);
            }
            return lib;
        }

        public VariantDef Def(string id) => VariantCatalog.Find(Defs, id) ?? Defs[0];

        public KikiLookSpec Look(string id) => _looks.TryGetValue(id, out var l) ? l : KikiLookSpec.For(id);
    }
}
