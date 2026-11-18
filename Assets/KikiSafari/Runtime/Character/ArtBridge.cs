using System.Collections.Generic;
using KikiSafari.Core.Art;
using UnityEngine;

namespace KikiSafari
{
    /// <summary>Turns the engine-free art (Core/Art) into Unity meshes and textures, cached.</summary>
    public static class ArtBridge
    {
        static readonly Dictionary<string, Mesh> Meshes = new Dictionary<string, Mesh>();
        static readonly Dictionary<string, Texture2D> Textures = new Dictionary<string, Texture2D>();

        public static Mesh ToMesh(MeshData d, string name)
        {
            var m = new Mesh { name = name };
            if (d.VertexCount > 65000) m.indexFormat = UnityEngine.Rendering.IndexFormat.UInt32;
            var v = new Vector3[d.VertexCount];
            var n = new Vector3[d.VertexCount];
            var uv = new Vector2[d.VertexCount];
            var c = new Color[d.VertexCount];
            for (int i = 0; i < d.VertexCount; i++)
            {
                v[i] = new Vector3(d.Pos[i].X, d.Pos[i].Y, d.Pos[i].Z);
                n[i] = new Vector3(d.Nrm[i].X, d.Nrm[i].Y, d.Nrm[i].Z);
                uv[i] = new Vector2(d.U[i], d.V[i]);
                c[i] = new Color(d.Col[i].R, d.Col[i].G, d.Col[i].B, 1f);
            }
            m.vertices = v; m.normals = n; m.uv = uv; m.colors = c;
            m.SetTriangles(d.Tri, 0);
            m.RecalculateBounds();
            m.RecalculateTangents();
            return m;
        }

        public static Mesh Cached(string key, System.Func<MeshData> make)
        {
            if (Meshes.TryGetValue(key, out var m) && m != null) return m;
            m = ToMesh(make(), key);
            Meshes[key] = m;
            return m;
        }

        /// <summary>Kiki's body colour texture (sRGB) for a look.</summary>
        public static Texture2D BodyAlbedo(KikiLookSpec look)
        {
            string key = "alb" + look.TextureKey;
            if (Textures.TryGetValue(key, out var t) && t != null) return t;
            var canvas = KikiFaceArt.Albedo(look);
            t = new Texture2D(canvas.Width, canvas.Height, TextureFormat.RGBA32, true, false)
            { name = "KikiAlbedo_" + look.TextureKey, wrapMode = TextureWrapMode.Repeat, filterMode = FilterMode.Trilinear, anisoLevel = 4 };
            t.SetPixelData(canvas.ToBytes(bottomUp: true), 0);
            t.Apply(true, true);
            Textures[key] = t;
            return t;
        }

        /// <summary>Kiki's plush normal map (linear): seams, raised spiral piping, carved mouth, fabric grain.</summary>
        public static Texture2D BodyNormal(KikiLookSpec look)
        {
            string key = "nrm" + look.TextureKey;
            if (Textures.TryGetValue(key, out var t) && t != null) return t;
            t = new Texture2D(KikiFaceArt.W, KikiFaceArt.H, TextureFormat.RGBA32, true, true)
            { name = "KikiNormal_" + look.TextureKey, wrapMode = TextureWrapMode.Repeat, filterMode = FilterMode.Trilinear, anisoLevel = 4 };
            t.SetPixelData(KikiFaceArt.NormalMap(look, bottomUp: true), 0);
            t.Apply(true, true);
            Textures[key] = t;
            return t;
        }
    }
}
