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
        ExportMap(outDir);
        Console.WriteLine("Exported to " + Path.GetFullPath(outDir));
        return 0;
    }

    /// <summary>The street map of the test neighbourhood (or a real Overpass response passed as map.json), plus placements.</summary>
    static void ExportMap(string outDir)
    {
        string jsonPath = Path.Combine(outDir, "map-source.json");
        string json = File.Exists(jsonPath) ? File.ReadAllText(jsonPath) : KikiSafari.Tests.OsmFixture.Json();
        Write(outDir, "osm-fixture.json", KikiSafari.Tests.OsmFixture.Json());
        var fc = KikiSafari.Tests.OsmFixture.Cell;
        Write(outDir, "osm-fixture-cell.json", FormattableString.Invariant($"{{\"x\":{fc.X},\"y\":{fc.Y}}}"));
        var cell = KikiSafari.Tests.OsmFixture.Cell;
        var area = OsmArea.FromOverpassJson(json, cell.Center);
        foreach (var night in new[] { false, true })
        {
            var m = StreetMapGeometry.Build(area, cell.Center, night);
            string sfx = night ? "_night" : "";
            // Map meshes are built in Unity space; ToUnitySpace() mirrors back to three.js space for the preview.
            Write(outDir, $"map_green{sfx}.obj", m.Green.ToUnitySpace().ToObj("green"));
            Write(outDir, $"map_water{sfx}.obj", m.Water.ToUnitySpace().ToObj("water"));
            Write(outDir, $"map_casing{sfx}.obj", m.Casing.ToUnitySpace().ToObj("casing"));
            Write(outDir, $"map_roads{sfx}.obj", m.Roads.ToUnitySpace().ToObj("roads"));
            Write(outDir, $"map_paths{sfx}.obj", m.Paths.ToUnitySpace().ToObj("paths"));
            Write(outDir, $"map_buildings{sfx}.obj", m.Buildings.ToUnitySpace().ToObj("buildings"));
        }
        var (stops, circles) = LandmarkPlanner.Place(area, cell);
        var sb = new StringBuilder("{\"stops\":[");
        string P(PlacedSpot s) { var (e, n) = Geo.ToLocal(cell.Center, s.Where); return FormattableString.Invariant($"{{\"e\":{e:0.0},\"n\":{n:0.0},\"name\":\"{s.Name}\",\"landmark\":{(s.Landmark ? "true" : "false")}}}"); }
        sb.Append(string.Join(",", stops.ConvertAll(P)));
        sb.Append("],\"circles\":[").Append(string.Join(",", circles.ConvertAll(P))).Append("],\"kikis\":[");
        var data = new WorldData(); data.Add(cell, area);
        var list = LiveWorldPlanner.Nearby(cell.Center, 1_800_000_000, VariantCatalog.Defaults, null, null, null, 450, data);
        var ks = new System.Collections.Generic.List<string>();
        foreach (var t in list)
            if (t.Kind == ThingKind.Kiki) { var (e, n) = Geo.ToLocal(cell.Center, t.Where); ks.Add(FormattableString.Invariant($"{{\"e\":{e:0.0},\"n\":{n:0.0},\"id\":\"{t.Variant.Id}\"}}")); }
        sb.Append(string.Join(",", ks)).Append("]}");
        Write(outDir, "map-places.json", sb.ToString());
        Console.WriteLine($"map: {area.Features.Count} features, {stops.Count} stops, {circles.Count} circles: {string.Join(", ", circles.ConvertAll(c => c.Name))}");
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
