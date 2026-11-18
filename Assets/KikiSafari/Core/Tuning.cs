using System;

namespace KikiSafari.Core
{
    /// <summary>
    /// Values the hidden on-phone tuning panel edits live, so the feel of the throw can be tuned without a rebuild
    /// (decisions doc, section 11).
    /// </summary>
    [Serializable]
    public sealed class TuningValues
    {
        /// <summary>Multiplies flick speed of the rune stone.</summary>
        public float ThrowStrength = 1f;
        /// <summary>Seconds for one full shrink-and-grow of the timing ring.</summary>
        public float RingPeriod = 2.4f;
        /// <summary>0 = no help, 1 = always on target.</summary>
        public float AimAssist = 0.35f;
        /// <summary>Multiplies catch chance. Demo only; Live odds live on the server.</summary>
        public float CatchOdds = 1f;
        /// <summary>Gravity on the rune stone in m/s². Lower feels floatier.</summary>
        public float Gravity = 9.81f;
        /// <summary>Radius of Kiki's catch zone in metres.</summary>
        public float HitRadius = 0.26f;

        public TuningValues Clone() => (TuningValues)MemberwiseClone();

        public void Clamp()
        {
            ThrowStrength = Math.Max(0.3f, Math.Min(3f, ThrowStrength));
            RingPeriod = Math.Max(0.8f, Math.Min(6f, RingPeriod));
            AimAssist = Math.Max(0f, Math.Min(1f, AimAssist));
            CatchOdds = Math.Max(0.1f, Math.Min(5f, CatchOdds));
            Gravity = Math.Max(2f, Math.Min(20f, Gravity));
            HitRadius = Math.Max(0.1f, Math.Min(1f, HitRadius));
        }
    }
}
