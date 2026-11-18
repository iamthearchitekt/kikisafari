using System;
using System.IO;
using System.IO.Compression;
using System.Text;
using KikiSafari.Core;
using KikiSafari.Core.Art;

static class Program
{
    static int Main(string[] args)
    {
        string outDir = args.Length > 0 ? args[0] : "preview-out";
        Directory.CreateDirectory(outDir);
        // Previews render in three.js (right-handed); ToUnitySpace() is its own inverse, so it maps back.
        Write(outDir, "body.obj", KikiGeometry.Body().ToUnitySpace().ToObj("body"));
        Write(outDir, "feet.obj", KikiGeometry.Feet().ToUnitySpace().ToObj("feet"));
        Write(outDir, "arm.obj", KikiGeometry.Arm().ToUnitySpace().ToObj("arm"));
        var manifest = new StringBuilder("{\n \"arms\": [");
        var arms = KikiGeometry.Arms();
        for (int i = 0; i < arms.Length; i++)
        {
            var a = arms[i];
            // back to three space: mirror X, negate Z rotation (radians)
            manifest.Append(FormattableString.Invariant($"{{\"x\":{-a.Pivot.X},\"y\":{a.Pivot.Y},\"z\":{a.Pivot.Z},\"rz\":{-a.RestZ * Math.PI / 180}}}"));
            if (i + 1 < arms.Length) manifest.Append(',');
        }
        manifest.Append("],\n \"variants\": [");
        bool first = true;
        var written = new System.Collections.Generic.HashSet<string>();
        foreach (var v in VariantCatalog.Defaults)
        {
            var look = KikiLookSpec.For(v.Id);
            Write(outDir, $"crown_{v.Id}.obj", KikiGeometry.Crown(look, ArtSeed.Of(v.Id)).ToUnitySpace().ToObj("crown"));
            string key = look.TextureKey;
            if (written.Add(key))
            {
                var c = KikiFaceArt.Albedo(look);
                Png(Path.Combine(outDir, $"albedo_{key}.png"), c.Width, c.Height, c.ToBytes(bottomUp: false));
                Png(Path.Combine(outDir, $"normal_{key}.png"), KikiFaceArt.W, KikiFaceArt.H, KikiFaceArt.NormalMap(look, bottomUp: false));
            }
            if (!first) manifest.Append(',');
            first = false;
            manifest.Append($"\n  {{\"id\":\"{v.Id}\",\"name\":\"{v.DisplayName}\",\"rarity\":\"{v.Rarity}\",\"tex\":\"{key}\",\"scale\":{look.Scale.ToString(System.Globalization.CultureInfo.InvariantCulture)},\"glow\":{(look.UvGlow ? "true" : "false")},\"body\":\"#{look.BodyColor:X6}\"}}");
        }
        manifest.Append("\n ]\n}\n");
        Write(outDir, "manifest.json", manifest.ToString());
        Write(outDir, "stone.obj", KikiGeometry.RuneStone(1f).ToUnitySpace().ToObj("stone"));
        Write(outDir, "standing.obj", KikiGeometry.StandingStone().ToUnitySpace().ToObj("standing"));
        Console.WriteLine("Exported to " + Path.GetFullPath(outDir));
        return 0;
    }

    static void Write(string dir, string name, string text) => File.WriteAllText(Path.Combine(dir, name), text);

    // Minimal PNG writer (RGBA8, no filtering).
    static void Png(string path, int w, int h, byte[] rgba)
    {
        using var fs = File.Create(path);
        fs.Write(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 });
        var ihdr = new byte[13];
        BE(ihdr, 0, w); BE(ihdr, 4, h); ihdr[8] = 8; ihdr[9] = 6;
        Chunk(fs, "IHDR", ihdr);
        using var raw = new MemoryStream();
        for (int y = 0; y < h; y++) { raw.WriteByte(0); raw.Write(rgba, y * w * 4, w * 4); }
        using var z = new MemoryStream();
        using (var zs = new ZLibStream(z, CompressionLevel.Optimal, true)) raw.WriteTo(zs);
        Chunk(fs, "IDAT", z.ToArray());
        Chunk(fs, "IEND", Array.Empty<byte>());
    }

    static void BE(byte[] b, int o, int v) { b[o] = (byte)(v >> 24); b[o + 1] = (byte)(v >> 16); b[o + 2] = (byte)(v >> 8); b[o + 3] = (byte)v; }

    static void Chunk(Stream s, string type, byte[] data)
    {
        var len = new byte[4]; BE(len, 0, data.Length); s.Write(len);
        var td = new byte[4 + data.Length];
        Encoding.ASCII.GetBytes(type).CopyTo(td, 0); data.CopyTo(td, 4);
        s.Write(td);
        var crc = new byte[4]; BE(crc, 0, (int)Crc(td)); s.Write(crc);
    }

    static uint Crc(byte[] d)
    {
        uint c = 0xFFFFFFFF;
        foreach (var b in d) { c ^= b; for (int k = 0; k < 8; k++) c = (c & 1) != 0 ? 0xEDB88320 ^ (c >> 1) : c >> 1; }
        return ~c;
    }
}
