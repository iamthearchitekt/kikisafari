// The capture portal: a swirling vortex of UV-purple energy, screen-blended (the glow rule). Draw it on a disc that
// faces the camera; _Open scales it in and out, _Speed spins the arms, _Pull drags the arms toward the centre.
Shader "KikiSafari/Portal"
{
    Properties
    {
        _GlowColor ("Glow", Color) = (0.478, 0, 1, 1)
        _Accent ("Accent", Color) = (0.25, 0.05, 0.85, 1)
        _Intensity ("Intensity", Range(0,4)) = 1.15
        _Speed ("Spin speed", Float) = 3
        _Arms ("Arms", Float) = 4
        _Twist ("Twist", Float) = 3.2
        _Pull ("Pull", Float) = 1.5
    }
    SubShader
    {
        Tags { "Queue"="Transparent+5" "RenderType"="Transparent" "IgnoreProjector"="True" }
        Blend OneMinusDstColor One
        ZWrite Off
        Cull Off
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"
            fixed4 _GlowColor, _Accent;
            half _Intensity, _Speed, _Arms, _Twist, _Pull;
            struct v2f { float4 pos : SV_POSITION; float2 uv : TEXCOORD0; };
            v2f vert(appdata_base v) { v2f o; o.pos = UnityObjectToClipPos(v.vertex); o.uv = v.texcoord.xy; return o; }
            fixed4 frag(v2f i) : SV_Target
            {
                float2 c = i.uv * 2 - 1;
                float r = length(c);
                if (r > 1) discard;
                float ang = atan2(c.y, c.x);
                float t = _Time.y;
                // Logarithmic spiral arms rotating inward.
                float arms = pow(0.5 + 0.5 * cos(ang * _Arms + log(r + 0.04) * _Twist * _Arms * 0.5 + t * _Speed), 3);
                float streams = pow(0.5 + 0.5 * cos(ang * 9 - log(r + 0.04) * 6 + t * _Speed * 1.7 + r * _Pull * 8), 8);
                float edge = smoothstep(1.0, 0.72, r);
                float rim = smoothstep(0.75, 0.92, r) * edge;
                float core = pow(saturate(1 - r * 1.6), 2);
                float k = (arms * 0.75 + streams * 0.35 + rim * 0.9 + core * 1.3) * edge;
                fixed3 col = lerp(_Accent.rgb, _GlowColor.rgb, saturate(arms + core));
                return fixed4(col * k * _Intensity, 1);
            }
            ENDCG
        }
    }
}
