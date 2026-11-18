using KikiSafari.Core;
using UnityEngine;

namespace KikiSafari
{
    public static class Colors
    {
        public static Color Hex(uint rgb, float a = 1f)
            => new Color(((rgb >> 16) & 0xFF) / 255f, ((rgb >> 8) & 0xFF) / 255f, (rgb & 0xFF) / 255f, a);

        public static readonly Color Navy = Hex(Palette.NavyInk);
        public static readonly Color Sun = Hex(Palette.Sun);
        public static readonly Color SunDeep = Hex(Palette.SunDeep);
        public static readonly Color SunLight = Hex(Palette.SunLight);
        public static readonly Color Sky = Hex(Palette.Sky);
        public static readonly Color Pink = Hex(Palette.Pink);
        public static readonly Color Cream = Hex(Palette.Cream);
        public static readonly Color Muted = Hex(Palette.Muted);
        public static readonly Color UvPurple = Hex(Palette.UvPurple);
        public static readonly Color Leaf = Hex(Palette.Leaf);
        public static readonly Color BodyYellow = Hex(Palette.BodyYellow);

        public static Color RarityMain(Rarity r) => Hex(RarityInfo.MainColor(r));
        public static Color RaritySecond(Rarity r) => Hex(RarityInfo.SecondColor(r));
    }
}
