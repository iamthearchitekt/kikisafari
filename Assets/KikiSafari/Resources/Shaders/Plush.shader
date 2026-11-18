// Matte plush fabric (treatment section 3): roughness ~0.4, metalness 0, a soft velvety rim, never shiny or chrome.
// Optional normal map for the face (raised spiral piping, carved mouth, seams). Vertex colours carry the soft shading
// under the belly and the leaves' colours; every generated mesh has them (white when unused).
Shader "KikiSafari/Plush"
{
    Properties
    {
        _Color ("Tint", Color) = (1,1,1,1)
        _MainTex ("Albedo", 2D) = "white" {}
        [Normal] _BumpMap ("Normal map", 2D) = "bump" {}
        _BumpScale ("Normal strength", Range(0,2)) = 0.9
        _Roughness ("Roughness", Range(0,1)) = 0.42
        _Specular ("Specular level", Range(0,0.08)) = 0.025
        _RimPower ("Rim power", Range(0.5,8)) = 2.4
        _RimStrength ("Rim strength", Range(0,1)) = 0.4
        [Enum(UnityEngine.Rendering.CullMode)] _Cull ("Cull", Float) = 2
    }
    SubShader
    {
        Tags { "RenderType"="Opaque" "Queue"="Geometry" }
        Cull [_Cull]
        CGPROGRAM
        #pragma surface surf StandardSpecular fullforwardshadows vertex:vert
        #pragma target 3.0

        sampler2D _MainTex, _BumpMap;
        fixed4 _Color;
        half _BumpScale, _Roughness, _Specular, _RimPower, _RimStrength;

        struct Input
        {
            float2 uv_MainTex;
            float3 viewDir;
            float4 vcol;
        };

        void vert(inout appdata_full v, out Input o)
        {
            UNITY_INITIALIZE_OUTPUT(Input, o);
            o.vcol = v.color;
        }

        void surf(Input IN, inout SurfaceOutputStandardSpecular o)
        {
            fixed4 c = tex2D(_MainTex, IN.uv_MainTex) * _Color * IN.vcol;
            o.Albedo = c.rgb;
            o.Normal = UnpackScaleNormal(tex2D(_BumpMap, IN.uv_MainTex), _BumpScale);
            o.Specular = _Specular.xxx;
            o.Smoothness = 1.0 - _Roughness;
            // o.Normal is written, so viewDir is in tangent space, the same space as o.Normal.
            half rim = pow(1.0 - saturate(dot(normalize(IN.viewDir), o.Normal)), _RimPower);
            o.Emission = c.rgb * rim * _RimStrength;
            o.Alpha = 1;
        }
        ENDCG
    }
    FallBack "Diffuse"
}
