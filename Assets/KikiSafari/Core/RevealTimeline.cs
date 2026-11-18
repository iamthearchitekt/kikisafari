using System.Collections.Generic;

namespace KikiSafari.Core
{
    public enum RevealStepKind
    {
        // Shared start after a hit
        HitSparkle,
        /// <summary>A UV-purple spiral portal tears open behind Kiki.</summary>
        PortalOpen,
        /// <summary>Kiki stretches, spins and is sucked into the portal in a stream of purple energy.</summary>
        SuckIn,
        /// <summary>The portal collapses into the rune stone, sealing Kiki inside.</summary>
        PortalSeal,
        StoneDrop,
        Wobble,
        // Catch (treatment section 5)
        Burst,
        RarityStamp,
        KikiDropIn,
        Dance,
        CountUp,
        AwaitKeepPlaying,
        // Breakout: the portal blasts back open and Kiki hops out.
        PopOpen,
        SoClose,
        // Miss
        Bounce,
        Fizzle,
        // Live, offline
        PendingSealed,
    }

    public struct RevealStep
    {
        public RevealStepKind Kind;
        public float Duration;
        public HapticKind Haptic;
        public Sfx Sfx;
        public Voice Voice;
        /// <summary>Chance the voice clip plays at all (quiet and occasional: about half the time).</summary>
        public float VoiceChance;
        /// <summary>Screen shake strength for this step; 0 under reduced motion.</summary>
        public float Shake;
        /// <summary>1-based index for repeated steps such as Wobble.</summary>
        public int Index;
        /// <summary>Text to show, if any. Misses show no text.</summary>
        public string Text;

        public override string ToString() => Index > 0 ? $"{Kind}#{Index}" : Kind.ToString();
    }

    public struct RevealOptions
    {
        public bool ReducedMotion;
        /// <summary>Live Safari throw queued with no signal: the rune stone stays sealed until the server confirms.</summary>
        public bool Pending;
    }

    /// <summary>
    /// Turns a catch outcome into the ordered beats the presenter plays. Keeping this pure means the rules in the decisions
    /// doc (section 7) are unit-tested: wobble counts, no spoilers, Keep playing never auto-closes, no text on a miss.
    /// </summary>
    public static class RevealTimeline
    {
        public const float WobbleSeconds = 0.8f;
        public const float WobbleSecondsReduced = 0.45f;
        public const string SoCloseText = "SO CLOSE!";
        public const string PendingText = "Pending: reveal when you're back in signal";
        public const string SlippedAwayText = "That one slipped away";

        public static List<RevealStep> Build(CatchOutcome o, Rarity rarity, RevealOptions opt)
        {
            var s = new List<RevealStep>();
            if (o.Result == CatchResult.Missed)
            {
                s.Add(new RevealStep { Kind = RevealStepKind.Bounce, Duration = 0.5f, Sfx = Sfx.Bounce, Haptic = HapticKind.Light });
                s.Add(new RevealStep { Kind = RevealStepKind.Fizzle, Duration = 0.5f, Sfx = Sfx.Fizzle });
                return s;
            }

            float wobble = opt.ReducedMotion ? WobbleSecondsReduced : WobbleSeconds;
            s.Add(new RevealStep { Kind = RevealStepKind.HitSparkle, Duration = 0.25f, Haptic = HapticKind.Medium, Sfx = Sfx.Hit });
            s.Add(new RevealStep { Kind = RevealStepKind.PortalOpen, Duration = opt.ReducedMotion ? 0.3f : 0.45f, Sfx = Sfx.PortalOpen });
            s.Add(new RevealStep { Kind = RevealStepKind.SuckIn, Duration = opt.ReducedMotion ? 0.5f : 0.8f, Haptic = HapticKind.Light, Sfx = Sfx.SuckIn });
            s.Add(new RevealStep { Kind = RevealStepKind.PortalSeal, Duration = 0.35f, Haptic = HapticKind.Medium, Sfx = Sfx.Seal });
            s.Add(new RevealStep { Kind = RevealStepKind.StoneDrop, Duration = 0.4f, Haptic = HapticKind.Light, Sfx = Sfx.Bounce });

            if (opt.Pending)
            {
                s.Add(new RevealStep { Kind = RevealStepKind.PendingSealed, Duration = 0f, Text = PendingText });
                return s;
            }

            for (int i = 1; i <= o.Wobbles; i++)
                s.Add(new RevealStep { Kind = RevealStepKind.Wobble, Index = i, Duration = wobble, Haptic = HapticKind.Heavy, Sfx = Sfx.Wobble });

            if (o.Result == CatchResult.BrokeOut)
            {
                s.Add(new RevealStep { Kind = RevealStepKind.PopOpen, Duration = 0.4f, Haptic = HapticKind.Warning, Sfx = Sfx.BreakOut });
                s.Add(new RevealStep
                {
                    Kind = RevealStepKind.SoClose, Duration = 1.1f, Text = SoCloseText,
                    Shake = opt.ReducedMotion ? 0f : 1f, Voice = Voice.Awww, VoiceChance = 0.5f,
                });
                return s;
            }

            s.Add(new RevealStep { Kind = RevealStepKind.Burst, Duration = 0.5f, Haptic = HapticKind.Success, Sfx = Sfx.Burst });
            s.Add(new RevealStep { Kind = RevealStepKind.RarityStamp, Duration = 0.5f, Haptic = HapticKind.Heavy, Sfx = Sfx.Stamp, Text = RarityInfo.Label(rarity) });
            s.Add(new RevealStep { Kind = RevealStepKind.KikiDropIn, Duration = 0.6f, Haptic = HapticKind.Medium, Voice = Voice.Yay, VoiceChance = 0.5f });
            s.Add(new RevealStep { Kind = RevealStepKind.Dance, Duration = opt.ReducedMotion ? 1.0f : 1.8f });
            s.Add(new RevealStep { Kind = RevealStepKind.CountUp, Duration = 1.4f, Haptic = HapticKind.Tick, Sfx = Sfx.CountTick });
            // Never auto-closes: the presenter waits for the player to tap Keep playing.
            s.Add(new RevealStep { Kind = RevealStepKind.AwaitKeepPlaying, Duration = float.PositiveInfinity, Text = "Keep playing" });
            return s;
        }
    }
}
