// A soft column of UV light rising from a Rune Circle's portal, so you can spot it from down the street.
// Alpha-blended UV purple (stays purple over a bright sky), soft at the edges, fading out toward the top.
Shader "KikiSafari/LightBeam"
{
    Properties
    {
        _GlowColor ("Glow", Color) = (0.478, 0, 1, 1)
        _Strength ("Strength", Range(0,1)) = 0.6
        _Height ("Height (object units)", Float) = 1
    }
    SubShader
    {
        Tags { "Queue"="Transparent+20" "RenderType"="Transparent" "IgnoreProjector"="True" }
        Blend SrcAlpha OneMinusSrcAlpha
        ZWrite Off
        Cull Off
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"
            fixed4 _GlowColor; half _Strength, _Height;
            struct v2f { float4 pos : SV_POSITION; float h : TEXCOORD0; float3 n : TEXCOORD1; float3 v : TEXCOORD2; };
            v2f vert(appdata_base v)
            {
                v2f o;
                o.pos = UnityObjectToClipPos(v.vertex);
                o.h = saturate(v.vertex.y / _Height);
                o.n = UnityObjectToWorldNormal(v.normal);
                o.v = normalize(WorldSpaceViewDir(v.vertex));
                return o;
            }
            fixed4 frag(v2f i) : SV_Target
            {
                half edge = pow(abs(dot(normalize(i.n), normalize(i.v))), 2.5);
                half a = edge * pow(1 - i.h, 1.6) * smoothstep(0, 0.04, i.h) * _Strength;
                return fixed4(_GlowColor.rgb, a);
            }
            ENDCG
        }
    }
}
