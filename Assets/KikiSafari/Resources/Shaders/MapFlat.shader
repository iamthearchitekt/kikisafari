// Street map ground layers (parks, water, road edges, roads, paths): flat, unlit, vertex-coloured. Each layer gets its
// own render queue and writes no depth, so layers paint over each other in a fixed order with no flicker.
Shader "KikiSafari/MapFlat"
{
    Properties { _Tint ("Tint", Color) = (1,1,1,1) }
    SubShader
    {
        Tags { "Queue"="Geometry-50" "RenderType"="Opaque" }
        ZWrite Off
        Cull Off
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"
            fixed4 _Tint;
            struct appdata { float4 vertex : POSITION; fixed4 color : COLOR; };
            struct v2f { float4 pos : SV_POSITION; fixed4 color : COLOR; };
            v2f vert(appdata v) { v2f o; o.pos = UnityObjectToClipPos(v.vertex); o.color = v.color * _Tint; return o; }
            fixed4 frag(v2f i) : SV_Target { return fixed4(i.color.rgb, 1); }
            ENDCG
        }
    }
}
