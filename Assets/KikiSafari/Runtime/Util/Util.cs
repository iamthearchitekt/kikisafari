using UnityEngine;

namespace KikiSafari
{
    public static class Util
    {
        public static void SafeDestroy(Object o)
        {
            if (o == null) return;
            if (Application.isPlaying) Object.Destroy(o);
            else Object.DestroyImmediate(o);
        }

        public static long UnixNow() => System.DateTimeOffset.UtcNow.ToUnixTimeSeconds();

        /// <summary>Ease with a little overshoot, for pops and stamps.</summary>
        public static float EaseOutBack(float t, float s = 1.70158f)
        {
            t = Mathf.Clamp01(t) - 1;
            return t * t * ((s + 1) * t + s) + 1;
        }

        public static float EaseOutCubic(float t) { t = 1 - Mathf.Clamp01(t); return 1 - t * t * t; }
        public static float EaseInOut(float t) => Mathf.SmoothStep(0, 1, t);

        /// <summary>Damped spring back to rest: 1 at t=0, settling to 0.</summary>
        public static float Wobble(float t, float freq = 3f, float damping = 4f)
            => Mathf.Exp(-damping * t) * Mathf.Cos(t * freq * Mathf.PI * 2);
    }
}
