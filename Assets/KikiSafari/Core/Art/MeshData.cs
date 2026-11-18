using System;
using System.Collections.Generic;

namespace KikiSafari.Core.Art
{
    public struct V3
    {
        public float X, Y, Z;
        public V3(float x, float y, float z) { X = x; Y = y; Z = z; }
        public static V3 operator +(V3 a, V3 b) => new V3(a.X + b.X, a.Y + b.Y, a.Z + b.Z);
        public static V3 operator -(V3 a, V3 b) => new V3(a.X - b.X, a.Y - b.Y, a.Z - b.Z);
        public static V3 operator *(V3 a, float k) => new V3(a.X * k, a.Y * k, a.Z * k);
        public static V3 Cross(V3 a, V3 b) => new V3(a.Y * b.Z - a.Z * b.Y, a.Z * b.X - a.X * b.Z, a.X * b.Y - a.Y * b.X);
        public float Length => (float)Math.Sqrt(X * X + Y * Y + Z * Z);
        public V3 Normalized { get { float l = Length; return l > 1e-12f ? this * (1 / l) : new V3(0, 1, 0); } }
    }

    /// <summary>Column-major-free 4×4 affine matrix (rows), enough for three.js-style Matrix4.compose with Euler 'YXZ'.</summary>
    public struct Mat4
    {
        public float M00, M01, M02, M03, M10, M11, M12, M13, M20, M21, M22, M23;

        /// <summary>Translation × rotation (Euler order YXZ: R = Ry·Rx·Rz) × scale, like three.js Matrix4.compose.</summary>
        public static Mat4 Compose(float x, float y, float z, float rx, float ry, float rz, float sx, float sy, float sz)
        {
            float cx = (float)Math.Cos(rx), sxr = (float)Math.Sin(rx), cy = (float)Math.Cos(ry), syr = (float)Math.Sin(ry), cz = (float)Math.Cos(rz), szr = (float)Math.Sin(rz);
            // three.js makeRotationFromEuler, order YXZ
            float ce = cy * cz, cf = cy * szr, de = syr * cz, df = syr * szr;
            var m = new Mat4
            {
                M00 = ce + df * sxr, M01 = de * sxr - cf, M02 = cx * syr,
                M10 = cx * szr, M11 = cx * cz, M12 = -sxr,
                M20 = cf * sxr - de, M21 = df + ce * sxr, M22 = cx * cy,
            };
            m.M00 *= sx; m.M10 *= sx; m.M20 *= sx;
            m.M01 *= sy; m.M11 *= sy; m.M21 *= sy;
            m.M02 *= sz; m.M12 *= sz; m.M22 *= sz;
            m.M03 = x; m.M13 = y; m.M23 = z;
            return m;
        }

        public V3 Point(V3 p) => new V3(M00 * p.X + M01 * p.Y + M02 * p.Z + M03, M10 * p.X + M11 * p.Y + M12 * p.Z + M13, M20 * p.X + M21 * p.Y + M22 * p.Z + M23);
        public V3 Vector(V3 p) => new V3(M00 * p.X + M01 * p.Y + M02 * p.Z, M10 * p.X + M11 * p.Y + M12 * p.Z, M20 * p.X + M21 * p.Y + M22 * p.Z);
    }

    /// <summary>Engine-free mesh buffers. Built in three.js space (right-handed) and converted once to Unity space.</summary>
    public sealed class MeshData
    {
        public readonly List<V3> Pos = new List<V3>();
        public readonly List<V3> Nrm = new List<V3>();
        public readonly List<float> U = new List<float>(), V = new List<float>();
        public readonly List<Rgba> Col = new List<Rgba>();
        public readonly List<int> Tri = new List<int>();

        public int VertexCount => Pos.Count;

        public void AddVertex(V3 p, float u, float v, Rgba c)
        {
            Pos.Add(p); Nrm.Add(new V3(0, 1, 0)); U.Add(u); V.Add(v); Col.Add(c);
        }

        /// <summary>three.js LatheGeometry: points (radius, height) swept around Y; u = i/segments, v = j/(n-1).</summary>
        public static MeshData Lathe(IList<(float r, float y)> pts, int segments)
        {
            var m = new MeshData();
            int n = pts.Count;
            for (int i = 0; i <= segments; i++)
            {
                double phi = i / (double)segments * Math.PI * 2;
                float s = (float)Math.Sin(phi), c = (float)Math.Cos(phi);
                for (int j = 0; j < n; j++)
                    m.AddVertex(new V3(pts[j].r * s, pts[j].y, pts[j].r * c), i / (float)segments, j / (float)(n - 1), new Rgba(1, 1, 1));
            }
            for (int i = 0; i < segments; i++)
            for (int j = 0; j < n - 1; j++)
            {
                int b = j + i * n;
                int a = b, bb = b + n, cc = b + n + 1, d = b + 1;
                m.Tri.AddRange(new[] { a, bb, d, cc, d, bb });
            }
            m.ComputeNormals();
            return m;
        }

        /// <summary>three.js SphereGeometry(radius, widthSegments, heightSegments).</summary>
        public static MeshData Sphere(float r, int ws, int hs)
        {
            var m = new MeshData();
            var grid = new int[hs + 1, ws + 1];
            int idx = 0;
            for (int iy = 0; iy <= hs; iy++)
            {
                float v = iy / (float)hs;
                float uOff = iy == 0 ? 0.5f / ws : iy == hs ? -0.5f / ws : 0;
                for (int ix = 0; ix <= ws; ix++)
                {
                    float u = ix / (float)ws;
                    double ph = u * Math.PI * 2, th = v * Math.PI;
                    var p = new V3((float)(-r * Math.Cos(ph) * Math.Sin(th)), (float)(r * Math.Cos(th)), (float)(r * Math.Sin(ph) * Math.Sin(th)));
                    m.AddVertex(p, u + uOff, 1 - v, new Rgba(1, 1, 1));
                    grid[iy, ix] = idx++;
                }
            }
            for (int iy = 0; iy < hs; iy++)
            for (int ix = 0; ix < ws; ix++)
            {
                int a = grid[iy, ix + 1], b = grid[iy, ix], c = grid[iy + 1, ix], d = grid[iy + 1, ix + 1];
                if (iy != 0) m.Tri.AddRange(new[] { a, b, d });
                if (iy != hs - 1) m.Tri.AddRange(new[] { b, c, d });
            }
            m.ComputeNormals();
            return m;
        }

        /// <summary>Area-weighted vertex normals, welded across seams (vertices at the same position share a normal).</summary>
        public void ComputeNormals()
        {
            var acc = new Dictionary<(int, int, int), V3>();
            (int, int, int) Key(V3 p) => ((int)Math.Round(p.X * 1e4), (int)Math.Round(p.Y * 1e4), (int)Math.Round(p.Z * 1e4));
            for (int t = 0; t < Tri.Count; t += 3)
            {
                var a = Pos[Tri[t]]; var b = Pos[Tri[t + 1]]; var c = Pos[Tri[t + 2]];
                var n = V3.Cross(b - a, c - a); // right-handed, counter-clockwise front faces
                for (int k = 0; k < 3; k++)
                {
                    var key = Key(Pos[Tri[t + k]]);
                    acc[key] = acc.TryGetValue(key, out var s) ? s + n : n;
                }
            }
            for (int i = 0; i < Pos.Count; i++)
                Nrm[i] = acc.TryGetValue(Key(Pos[i]), out var s) ? s.Normalized : new V3(0, 1, 0);
        }

        public MeshData Transformed(Mat4 m)
        {
            var o = new MeshData();
            for (int i = 0; i < Pos.Count; i++)
            {
                o.Pos.Add(m.Point(Pos[i])); o.Nrm.Add(m.Vector(Nrm[i]).Normalized);
                o.U.Add(U[i]); o.V.Add(V[i]); o.Col.Add(Col[i]);
            }
            o.Tri.AddRange(Tri);
            o.ComputeNormals(); // correct under non-uniform scale
            return o;
        }

        public void Append(MeshData other)
        {
            int off = Pos.Count;
            Pos.AddRange(other.Pos); Nrm.AddRange(other.Nrm); U.AddRange(other.U); V.AddRange(other.V); Col.AddRange(other.Col);
            foreach (var t in other.Tri) Tri.Add(t + off);
        }

        public void Translate(V3 d) { for (int i = 0; i < Pos.Count; i++) Pos[i] = Pos[i] + d; }

        /// <summary>
        /// three.js (right-handed) to Unity (left-handed) by mirroring X: the front still faces +Z and the viewer's left
        /// stays on the viewer's left. Winding is reversed so faces stay front-facing.
        /// </summary>
        public MeshData ToUnitySpace()
        {
            var o = new MeshData();
            for (int i = 0; i < Pos.Count; i++)
            {
                o.Pos.Add(new V3(-Pos[i].X, Pos[i].Y, Pos[i].Z));
                o.Nrm.Add(new V3(-Nrm[i].X, Nrm[i].Y, Nrm[i].Z));
                o.U.Add(U[i]); o.V.Add(V[i]); o.Col.Add(Col[i]);
            }
            for (int t = 0; t < Tri.Count; t += 3) { o.Tri.Add(Tri[t]); o.Tri.Add(Tri[t + 2]); o.Tri.Add(Tri[t + 1]); }
            return o;
        }

        /// <summary>Wavefront OBJ (for previews and checks outside Unity). Writes in the mesh's own space.</summary>
        public string ToObj(string name)
        {
            var sb = new System.Text.StringBuilder();
            var ci = System.Globalization.CultureInfo.InvariantCulture;
            sb.Append("o ").Append(name).Append('\n');
            for (int i = 0; i < Pos.Count; i++)
                sb.AppendFormat(ci, "v {0} {1} {2} {3} {4} {5}\n", Pos[i].X, Pos[i].Y, Pos[i].Z, Col[i].R, Col[i].G, Col[i].B);
            for (int i = 0; i < Pos.Count; i++) sb.AppendFormat(ci, "vt {0} {1}\n", U[i], V[i]);
            for (int i = 0; i < Pos.Count; i++) sb.AppendFormat(ci, "vn {0} {1} {2}\n", Nrm[i].X, Nrm[i].Y, Nrm[i].Z);
            for (int t = 0; t < Tri.Count; t += 3)
                sb.AppendFormat("f {0}/{0}/{0} {1}/{1}/{1} {2}/{2}/{2}\n", Tri[t] + 1, Tri[t + 1] + 1, Tri[t + 2] + 1);
            return sb.ToString();
        }
    }
}
