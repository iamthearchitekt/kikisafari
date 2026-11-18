namespace KikiSafari.Core
{
    /// <summary>Palette tokens from the treatment (section 3 character colours, section 4 UI tokens). 0xRRGGBB.</summary>
    public static class Palette
    {
        // Character (section 3)
        public const uint BodyYellow = 0xFFC928;
        public const uint BodyHighlight = 0xFFE14D;
        public const uint BodyShadow = 0xF5A300;
        public const uint LeafDark = 0x2F9E22;
        public const uint Leaf = 0x3FAE2A;
        public const uint EyeSpiral = 0x4A1A0C;
        public const uint MouthInside = 0x7A0F1C;
        public const uint Tongue = 0xFF4A2E;

        // UI (section 4)
        public const uint NavyInk = 0x18237A;
        public const uint Sun = 0xFFCF2E;
        public const uint SunDeep = 0xF5A300;
        public const uint SunLight = 0xFFF27A;
        public const uint Sky = 0x36B6FF;
        public const uint Pink = 0xFF5D8F;
        public const uint Cream = 0xFFF8DE;
        public const uint Muted = 0x4D5AA6;
        public const uint UvPurple = 0x7A00FF;
    }
}
