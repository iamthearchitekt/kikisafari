// Native iPhone helpers for KIKI SAFARI: haptics (the treatment's seven patterns) and the Reduce Motion setting.
// Called from Haptics.cs and Accessibility.cs through [DllImport("__Internal")].
#import <UIKit/UIKit.h>

static UIImpactFeedbackGenerator *kikiLight;
static UIImpactFeedbackGenerator *kikiMedium;
static UIImpactFeedbackGenerator *kikiHeavy;
static UISelectionFeedbackGenerator *kikiTick;
static UINotificationFeedbackGenerator *kikiNotify;

static void KikiEnsureGenerators(void)
{
    if (kikiNotify != nil) return;
    kikiLight = [[UIImpactFeedbackGenerator alloc] initWithStyle:UIImpactFeedbackStyleLight];
    kikiMedium = [[UIImpactFeedbackGenerator alloc] initWithStyle:UIImpactFeedbackStyleMedium];
    kikiHeavy = [[UIImpactFeedbackGenerator alloc] initWithStyle:UIImpactFeedbackStyleHeavy];
    kikiTick = [[UISelectionFeedbackGenerator alloc] init];
    kikiNotify = [[UINotificationFeedbackGenerator alloc] init];
}

extern "C" {

void KikiNative_PrepareHaptics(void)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        KikiEnsureGenerators();
        [kikiLight prepare]; [kikiMedium prepare]; [kikiHeavy prepare]; [kikiTick prepare]; [kikiNotify prepare];
    });
}

// Matches KikiSafari.Core.HapticKind: 0 None, 1 Tick, 2 Light, 3 Medium, 4 Heavy, 5 Success, 6 Warning, 7 Error.
void KikiNative_Haptic(int kind)
{
    dispatch_async(dispatch_get_main_queue(), ^{
        KikiEnsureGenerators();
        switch (kind) {
            case 1: [kikiTick selectionChanged]; [kikiTick prepare]; break;
            case 2: [kikiLight impactOccurred]; [kikiLight prepare]; break;
            case 3: [kikiMedium impactOccurred]; [kikiMedium prepare]; break;
            case 4: [kikiHeavy impactOccurred]; [kikiHeavy prepare]; break;
            case 5: [kikiNotify notificationOccurred:UINotificationFeedbackTypeSuccess]; [kikiNotify prepare]; break;
            case 6: [kikiNotify notificationOccurred:UINotificationFeedbackTypeWarning]; [kikiNotify prepare]; break;
            case 7: [kikiNotify notificationOccurred:UINotificationFeedbackTypeError]; [kikiNotify prepare]; break;
            default: break;
        }
    });
}

bool KikiNative_IsReduceMotionEnabled(void)
{
    return UIAccessibilityIsReduceMotionEnabled();
}

}
