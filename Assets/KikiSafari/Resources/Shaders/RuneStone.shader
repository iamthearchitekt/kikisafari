// The Rune Stone (owner's call, replacing the orb): a smooth slate-indigo river stone with Kiki's spiral carved into
// both faces. The carving glows UV purple (#7a00ff); the outer halo is a separate UVGlow (screen blend) shell.
Shader "KikiSafari/RuneStone"
{
    Properties
    {
        _Stone ("Stone", Color) = (0.24, 0.26, 0.45, 1)
        _Speck ("Speckle", Color) = (0.42, 0.44, 0.62, 1)
        _Carve ("Carving", Color) = (0.07, 0.03, 0.16, 1)
        _GlowColor ("Rune glow", Color) = (0.478, 0, 1, 1)
        _Glow ("Rune glow amount", Range(0,4)) = 1.2
        _Radius ("Mesh radius", Float) = 0.045
        _Turns ("Spiral turns", Float) = 2.5
        _Line ("Line width", Range(0.01,0.2)) = 0.06
    }
    SubShader
    {
        Tags { "RenderType"="Opaque" "Queue"="Geometry" }
        CGPROGRAM
        #pragma surface surf StandardSpecular vertex:vert
        #pragma target 3.0

        fixed4 _Stone, _Speck, _Carve, _GlowColor;
        half _Glow, _Radius, _Turns, _Line;

        struct Input { float3 opos; float3 onrm; float3 viewDir; float3 worldNormal; };

        void vert(inout appdata_full v, out Input o)
        {
            UNITY_INITIALIZE_OUTPUT(Input, o);
            o.opos = v.vertex.xyz / _Radius;
            o.onrm = v.normal;
        }

        float hash(float3 p) { return frac(sin(dot(p, float3(127.1, 311.7, 74.7))) * 43758.5453); }

        // Distance to an Archimedean spiral from the centre to radius 0.78 (normalised units).
        float spiralDist(float2 p, float mirror)
        {
            float rho = length(p);
            float ang = atan2(p.y, p.x * mirror);
            if (ang < 0) ang += 6.2831853;
            float maxT = _Turns * 6.2831853;
            float b = 0.78 / maxT;
            float k0 = floor((rho / b - ang) / 6.2831853);
            float best = 10;
            for (int i = -1; i <= 1; i++)
            {
                float th = ang + (k0 + i) * 6.2831853;
                if (th >= 0 && th <= maxT) best = min(best, abs(b * th - rho));
            }
            return best;
        }

        void surf(Input IN, inout SurfaceOutputStandardSpecular o)
        {
            float speck = step(0.86, hash(floor(IN.opos * 28)));
            fixed3 col = lerp(_Stone.rgb, _Speck.rgb, speck * 0.6);
            // Spiral carved into the flat faces (top and bottom of the stone), mirrored on the back.
            float face = smoothstep(0.35, 0.6, abs(IN.onrm.y));
            float mirror = IN.onrm.y >= 0 ? 1 : -1;
            float d = spiralDist(IN.opos.xz, mirror);
            float carve = face * (1 - smoothstep(_Line * 0.7, _Line, d));
            col = lerp(col, _Carve.rgb, carve);
            o.Albedo = col;
            o.Specular = 0.03;
            o.Smoothness = lerp(0.35, 0.15, carve);
            half rim = pow(1 - saturate(dot(normalize(IN.viewDir), normalize(IN.worldNormal))), 3);
            o.Emission = _GlowColor.rgb * carve * _Glow + _Speck.rgb * rim * 0.15;
        }
        ENDCG
    }
    FallBack "Diffuse"
}
