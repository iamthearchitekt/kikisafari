using System;
using System.Collections.Generic;
using UnityEngine;

namespace KikiSafari
{
    /// <summary>Procedural meshes. Every mesh gets vertex colours so the Plush shader's colour input is always defined.</summary>
    public static class MeshUtil
    {
        /// <summary>
        /// Lathe around the Y axis. <paramref name="profile"/> maps t in [0,1] (bottom to top) to (radius, height, d radius/dt, d height/dt).
        /// u runs around (0 at +X, 0.25 at +Z), v runs bottom to top.
        /// </summary>
        public static Mesh Lathe(Func<float, Vector4> profile, int rings, int segments, string name)
        {
            var verts = new List<Vector3>();
            var norms = new List<Vector3>();
            var uvs = new List<Vector2>();
            var cols = new List<Color>();
            var tris = new List<int>();
            for (int i = 0; i <= rings; i++)
            {
                float t = i / (float)rings;
                var p = profile(t);
                float r = Mathf.Max(0f, p.x), y = p.y;
                // Outward normal in the profile plane is (dy, -dr), rotated around Y.
                var n2 = new Vector2(p.w, -p.z);
                if (n2.sqrMagnitude < 1e-8f) n2 = new Vector2(0, t < 0.5f ? -1 : 1);
                n2.Normalize();
                for (int j = 0; j <= segments; j++)
                {
                    float u = j / (float)segments;
                    float a = u * Mathf.PI * 2f;
                    float c = Mathf.Cos(a), s = Mathf.Sin(a);
                    verts.Add(new Vector3(r * c, y, r * s));
                    norms.Add(new Vector3(n2.x * c, n2.y, n2.x * s).normalized);
                    uvs.Add(new Vector2(u, t));
                    cols.Add(Color.white);
                }
            }
            int row = segments + 1;
            for (int i = 0; i < rings; i++)
            for (int j = 0; j < segments; j++)
            {
                int a = i * row + j, b = a + row;
                // Clockwise from outside (Unity's front face).
                tris.Add(a); tris.Add(b); tris.Add(a + 1);
                tris.Add(a + 1); tris.Add(b); tris.Add(b + 1);
            }
            var m = new Mesh { name = name };
            m.SetVertices(verts); m.SetNormals(norms); m.SetUVs(0, uvs); m.SetColors(cols); m.SetTriangles(tris, 0);
            m.RecalculateBounds();
            m.RecalculateTangents();
            return m;
        }

        public static Mesh Sphere(float radius, int rings = 16, int segments = 24, string name = "Sphere")
            => Lathe(t =>
            {
                float th = Mathf.Lerp(-Mathf.PI / 2, Mathf.PI / 2, t);
                return new Vector4(radius * Mathf.Cos(th), radius * Mathf.Sin(th), -radius * Mathf.Sin(th), radius * Mathf.Cos(th));
            }, rings, segments, name);

        /// <summary>A flat disc on the XZ plane, facing up.</summary>
        public static Mesh Disc(float radius, int segments = 48, string name = "Disc")
        {
            var verts = new List<Vector3> { Vector3.zero };
            var uvs = new List<Vector2> { new Vector2(0.5f, 0.5f) };
            var tris = new List<int>();
            for (int i = 0; i <= segments; i++)
            {
                float a = i / (float)segments * Mathf.PI * 2;
                verts.Add(new Vector3(Mathf.Cos(a) * radius, 0, Mathf.Sin(a) * radius));
                uvs.Add(new Vector2(0.5f + Mathf.Cos(a) * 0.5f, 0.5f + Mathf.Sin(a) * 0.5f));
            }
            for (int i = 1; i <= segments; i++) { tris.Add(0); tris.Add(i + 1); tris.Add(i); }
            return Build(name, verts, uvs, tris);
        }

        /// <summary>A quad on the XZ plane, facing up, centred on the origin.</summary>
        public static Mesh GroundQuad(float width, float depth, float uvScale = 1f, string name = "Quad")
        {
            float w = width / 2, d = depth / 2;
            var verts = new List<Vector3> { new Vector3(-w, 0, -d), new Vector3(w, 0, -d), new Vector3(w, 0, d), new Vector3(-w, 0, d) };
            var uvs = new List<Vector2> { new Vector2(0, 0), new Vector2(uvScale, 0), new Vector2(uvScale, uvScale), new Vector2(0, uvScale) };
            var tris = new List<int> { 0, 2, 1, 0, 3, 2 };
            return Build(name, verts, uvs, tris);
        }

        /// <summary>Flat polygon (ear-clipping) on the XZ plane. Points are (x, z).</summary>
        public static Mesh Polygon(IList<Vector2> pts, float uvScale, string name = "Polygon")
        {
            var verts = new List<Vector3>();
            var uvs = new List<Vector2>();
            foreach (var p in pts) { verts.Add(new Vector3(p.x, 0, p.y)); uvs.Add(p * uvScale); }
            var tris = Triangulate(pts);
            return Build(name, verts, uvs, tris);
        }

        static Mesh Build(string name, List<Vector3> verts, List<Vector2> uvs, List<int> tris)
        {
            var m = new Mesh { name = name };
            var cols = new List<Color>(verts.Count);
            var norms = new List<Vector3>(verts.Count);
            for (int i = 0; i < verts.Count; i++) { cols.Add(Color.white); norms.Add(Vector3.up); }
            m.SetVertices(verts); m.SetUVs(0, uvs); m.SetColors(cols); m.SetNormals(norms); m.SetTriangles(tris, 0);
            m.RecalculateBounds();
            m.RecalculateTangents();
            return m;
        }

        /// <summary>Ear clipping for a simple polygon. Returns triangles wound to face +Y.</summary>
        public static List<int> Triangulate(IList<Vector2> pts)
        {
            var result = new List<int>();
            int n = pts.Count;
            if (n < 3) return result;
            var idx = new List<int>();
            float area = 0;
            for (int i = 0, j = n - 1; i < n; j = i++) area += pts[j].x * pts[i].y - pts[i].x * pts[j].y;
            for (int i = 0; i < n; i++) idx.Add(area > 0 ? i : n - 1 - i); // make counter-clockwise in (x, z)
            int guard = 0;
            while (idx.Count > 3 && guard++ < 10000)
            {
                bool clipped = false;
                for (int k = 0; k < idx.Count; k++)
                {
                    int ia = idx[(k + idx.Count - 1) % idx.Count], ib = idx[k], ic = idx[(k + 1) % idx.Count];
                    Vector2 a = pts[ia], b = pts[ib], c = pts[ic];
                    if (Cross(b - a, c - b) <= 0) continue;
                    bool inside = false;
                    foreach (int o in idx)
                    {
                        if (o == ia || o == ib || o == ic) continue;
                        if (InTri(pts[o], a, b, c)) { inside = true; break; }
                    }
                    if (inside) continue;
                    // CCW in (x,z) seen from above (+Y) needs reversed order for Unity's clockwise front faces.
                    result.Add(ia); result.Add(ic); result.Add(ib);
                    idx.RemoveAt(k);
                    clipped = true;
                    break;
                }
                if (!clipped) break;
            }
            if (idx.Count == 3) { result.Add(idx[0]); result.Add(idx[2]); result.Add(idx[1]); }
            return result;
        }

        static float Cross(Vector2 a, Vector2 b) => a.x * b.y - a.y * b.x;

        static bool InTri(Vector2 p, Vector2 a, Vector2 b, Vector2 c)
        {
            float d1 = Cross(b - a, p - a), d2 = Cross(c - b, p - b), d3 = Cross(a - c, p - c);
            bool neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
            return !(neg && pos);
        }

        /// <summary>A ring (annulus) in the XY plane. Use with a double-sided (Cull Off) material.</summary>
        public static Mesh Ring(float inner, float outer, int segments = 64, string name = "Ring")
        {
            var verts = new List<Vector3>();
            var uvs = new List<Vector2>();
            var tris = new List<int>();
            for (int i = 0; i <= segments; i++)
            {
                float a = i / (float)segments * Mathf.PI * 2;
                var d = new Vector3(Mathf.Cos(a), Mathf.Sin(a), 0);
                verts.Add(d * inner); verts.Add(d * outer);
                uvs.Add(new Vector2(i / (float)segments, 0)); uvs.Add(new Vector2(i / (float)segments, 1));
            }
            for (int i = 0; i < segments; i++)
            {
                int a = i * 2;
                tris.Add(a); tris.Add(a + 1); tris.Add(a + 2);
                tris.Add(a + 2); tris.Add(a + 1); tris.Add(a + 3);
            }
            return Build(name, verts, uvs, tris);
        }
    }
}
