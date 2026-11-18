#if UNITY_IOS
using System.IO;
using UnityEditor;
using UnityEditor.Callbacks;
using UnityEditor.iOS.Xcode;

namespace KikiSafari.EditorTools
{
    /// <summary>
    /// iPhone build tweaks applied to the generated Xcode project (runs in Unity Build Automation too):
    /// declares no non-exempt encryption so TestFlight builds don't stop for export compliance, and requires ARKit.
    /// </summary>
    public static class IosPostBuild
    {
        [PostProcessBuild(100)]
        public static void OnPostprocessBuild(BuildTarget target, string path)
        {
            if (target != BuildTarget.iOS) return;
            string plistPath = Path.Combine(path, "Info.plist");
            var plist = new PlistDocument();
            plist.ReadFromFile(plistPath);
            var root = plist.root;
            root.SetBoolean("ITSAppUsesNonExemptEncryption", false);
            var caps = root["UIRequiredDeviceCapabilities"] as PlistElementArray ?? root.CreateArray("UIRequiredDeviceCapabilities");
            bool hasArkit = false;
            foreach (var v in caps.values) if (v.AsString() == "arkit") hasArkit = true;
            if (!hasArkit) caps.AddString("arkit");
            plist.WriteToFile(plistPath);
        }
    }
}
#endif
