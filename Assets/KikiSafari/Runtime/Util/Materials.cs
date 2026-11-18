using System.Collections.Generic;
using UnityEngine;

namespace KikiSafari
{
    /// <summary>Material factory. Shaders live in Resources/Shaders so Shader.Find works in player builds.</summary>
    public static class Materials
    {
        static readonly Dictionary<string, Shader> Shaders = new Dictionary<string, Shader>();

        public static Shader Get(string name)
        {
            if (Shaders.TryGetValue(name, out var s) && s != null) return s;
            s = Shader.Find(name);
            if (s == null)
            {
                Debug.LogError($"[KikiSafari] Shader '{name}' not found. Is Assets/KikiSafari/Resources/Shaders imported?");
                s = Shader.Find("Unlit/Color") ?? Shader.Find("Standard");
            }
            Shaders[name] = s;
            return s;
        }

        /// <summary>Matte plush (or glossy leaf) material. Roughness 0.4 and metalness 0 match the treatment.</summary>
        public static Material Plush(Color color, Texture tex = null, bool doubleSided = false, Texture normal = null,
            float roughness = 0.42f, float specular = 0.025f, float rim = 0.4f)
        {
            var m = new Material(Get("KikiSafari/Plush")) { name = "Plush" };
            m.SetColor("_Color", color);
            if (tex != null) m.SetTexture("_MainTex", tex);
            if (normal != null) { m.SetTexture("_BumpMap", normal); m.SetFloat("_BumpScale", 0.9f); }
            m.SetFloat("_Roughness", roughness);
            m.SetFloat("_Specular", specular);
            m.SetFloat("_RimStrength", rim);
            m.SetFloat("_Cull", doubleSided ? 0f : 2f);
            return m;
        }

        public static Material Glow(float intensity = 1f, float power = 2f)
        {
            var m = new Material(Get("KikiSafari/UVGlow")) { name = "UVGlow" };
            m.SetColor("_GlowColor", Colors.UvPurple);
            m.SetFloat("_Intensity", intensity);
            m.SetFloat("_Power", power);
            return m;
        }

        public static Material RuneStone(float meshRadius)
        {
            var m = new Material(Get("KikiSafari/RuneStone")) { name = "RuneStone" };
            m.SetFloat("_Radius", meshRadius);
            return m;
        }

        public static Material Portal() => new Material(Get("KikiSafari/Portal")) { name = "Portal" };

        public static Material Unlit(Color color, Texture tex = null, bool additive = false, bool alwaysOnTop = false)
        {
            var m = new Material(Get("KikiSafari/UnlitTransparent")) { name = "Unlit" };
            m.SetColor("_Color", color);
            if (tex != null) m.SetTexture("_MainTex", tex);
            m.SetFloat("_DstBlend", additive ? (float)UnityEngine.Rendering.BlendMode.One : (float)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha);
            m.SetFloat("_ZTest", alwaysOnTop ? (float)UnityEngine.Rendering.CompareFunction.Always : (float)UnityEngine.Rendering.CompareFunction.LessEqual);
            return m;
        }

        public static Material Sky(Color top, Color bottom)
        {
            var m = new Material(Get("KikiSafari/SkyGradient")) { name = "Sky" };
            m.SetColor("_Top", top);
            m.SetColor("_Bottom", bottom);
            return m;
        }
    }
}
