// Background for the no-AR fallback stage and the demo map: a vertical gradient, day ("sunny meadow") or night ("cosmic set").
Shader "KikiSafari/SkyGradient"
{
    Properties
    {
        _Top ("Top", Color) = (0.21, 0.71, 1, 1)
        _Bottom ("Bottom", Color) = (0.82, 0.94, 1, 1)
    }
    SubShader
    {
        Tags { "Queue"="Background" "RenderType"="Background" "PreviewType"="Skybox" }
        Cull Off ZWrite Off
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"
            fixed4 _Top, _Bottom;
            struct v2f { float4 pos : SV_POSITION; float3 dir : TEXCOORD0; };
            v2f vert(appdata_base v) { v2f o; o.pos = UnityObjectToClipPos(v.vertex); o.dir = v.vertex.xyz; return o; }
            fixed4 frag(v2f i) : SV_Target
            {
                float t = saturate(normalize(i.dir).y * 1.6 + 0.15);
                return lerp(_Bottom, _Top, t);
            }
            ENDCG
        }
    }
}
