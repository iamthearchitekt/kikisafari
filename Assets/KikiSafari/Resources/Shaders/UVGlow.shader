// The glow rule (treatment section 4): UV purple #7a00ff with a screen blend. Never white or pale lavender.
// Drawn on the BACK faces of a slightly larger shell, so the body hides the middle and only a soft halo shows around
// the silhouette: strongest next to the body, fading to nothing at the shell's edge.
Shader "KikiSafari/UVGlow"
{
    Properties
    {
        _GlowColor ("Glow", Color) = (0.478, 0, 1, 1)
        _Intensity ("Intensity", Range(0,3)) = 1
        _Power ("Falloff", Range(0.5,8)) = 2
        _Inner ("Inner fill", Range(0,1)) = 0.05
        _Tint ("Daylight tint", Range(0,1)) = 0.6
    }
    SubShader
    {
        Tags { "Queue"="Transparent+10" "RenderType"="Transparent" "IgnoreProjector"="True" }
        ZWrite Off
        Cull Front
        // Pass 1: tint toward deep UV purple, so the halo stays saturated over a bright daytime camera feed
        // (a screen blend alone always lightens, which reads as pale lavender in daylight).
        Pass
        {
            Blend SrcAlpha OneMinusSrcAlpha
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"
            fixed4 _GlowColor; half _Intensity, _Power, _Inner, _Tint;
            struct v2f { float4 pos : SV_POSITION; float3 n : TEXCOORD0; float3 v : TEXCOORD1; };
            v2f vert(appdata_base v)
            {
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                o.n = UnityObjectToWorldNormal(v.normal);
                o.v = normalize(WorldSpaceViewDir(v.vertex));
                return o;
            }
            fixed4 frag(v2f i) : SV_Target
            {
                half d = saturate(-dot(normalize(i.n), normalize(i.v)));
                half k = saturate(pow(d, _Power) * _Intensity);
                return fixed4(_GlowColor.rgb * 0.55, k * _Tint);
            }
            ENDCG
        }
        // Pass 2: the screen-blended UV glow itself.
        Pass
        {
            Blend OneMinusDstColor One
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"
            fixed4 _GlowColor; half _Intensity, _Power, _Inner;
            struct v2f { float4 pos : SV_POSITION; float3 n : TEXCOORD0; float3 v : TEXCOORD1; };
            v2f vert(appdata_base v)
            {
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                o.n = UnityObjectToWorldNormal(v.normal);
                o.v = normalize(WorldSpaceViewDir(v.vertex));
                return o;
            }
            fixed4 frag(v2f i) : SV_Target
            {
                half d = saturate(-dot(normalize(i.n), normalize(i.v)));
                half k = saturate(pow(d, _Power) * _Intensity + _Inner * d);
                return fixed4(_GlowColor.rgb * k, 1);
            }
            ENDCG
        }
    }
}
