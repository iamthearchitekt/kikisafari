namespace KikiSafari.Core
{
    /// <summary>The treatment's seven-pattern haptic vocabulary. Every haptic is paired with a visual.</summary>
    public enum HapticKind { None, Tick, Light, Medium, Heavy, Success, Warning, Error }

    /// <summary>Short sound cues. The Unity layer maps each to a clip or a synthesized chiptune blip.</summary>
    public enum Sfx { None, Tick, Throw, Hit, PortalOpen, SuckIn, Seal, Wobble, Burst, Stamp, CountTick, BreakOut, Bounce, Fizzle, Button, Pickup }

    public enum Voice { None, Yay, Awww }
}
