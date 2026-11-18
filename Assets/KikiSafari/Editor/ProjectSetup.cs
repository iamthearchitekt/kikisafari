using System.IO;
using System.Linq;
using KikiSafari.Core;
using KikiSafari.Core.Art;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.SceneManagement;
using UnityEditor.XR.Management;
using UnityEditor.XR.Management.Metadata;
using UnityEngine;
using UnityEngine.XR.Management;

namespace KikiSafari.EditorTools
{
    /// <summary>
    /// One-click project setup, run automatically the first time the project opens (and any time from
    /// Kiki Safari ▸ Set Up Project): player settings for iPhone and Android, AR plug-ins (ARKit, ARCore, XR Simulation
    /// for the editor), the Input System, the Main scene, the six variant assets and the app icon.
    /// </summary>
    [InitializeOnLoad]
    public static class ProjectSetup
    {
        const string ScenePath = "Assets/KikiSafari/Scenes/Main.unity";
        const string VariantsDir = "Assets/KikiSafari/Resources/Variants";
        const string DoneKey = "KikiSafari.SetupDone.v1";
        public const string BundleId = "com.bigplush.kikisafari";

        static ProjectSetup()
        {
            EditorApplication.delayCall += () =>
            {
                if (SessionState.GetBool(DoneKey, false)) return;
                SessionState.SetBool(DoneKey, true);
                if (!File.Exists(ScenePath)) Run();
            };
        }

        [MenuItem("Kiki Safari/Set Up Project", priority = 0)]
        public static void Run()
        {
            PlayerSettingsSetup();
            InputHandlingSetup();
            XrSetup();
            Variants();
            Scene();
            AssetDatabase.SaveAssets();
            Debug.Log("[KikiSafari] Project set up. Press Play to try Demo Safari in the editor (no AR needed), or see docs/IPHONE-BUILDS.md.");
        }

        [MenuItem("Kiki Safari/Open Main Scene", priority = 1)]
        public static void OpenMain()
        {
            if (!File.Exists(ScenePath)) Run();
            EditorSceneManager.OpenScene(ScenePath);
        }

        static void PlayerSettingsSetup()
        {
            PlayerSettings.companyName = "Big Plush";
            PlayerSettings.productName = "KIKI SAFARI";
            PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.iOS, BundleId);
            PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Android, BundleId);
            PlayerSettings.defaultInterfaceOrientation = UIOrientation.Portrait;
            PlayerSettings.colorSpace = ColorSpace.Linear;

            // iPhone: ARKit needs Metal, arm64, iOS 15+ and a camera reason.
            PlayerSettings.iOS.cameraUsageDescription = "KIKI SAFARI uses the camera to put Kiki in the world around you.";
            PlayerSettings.iOS.locationUsageDescription = "KIKI SAFARI uses your location while you play to show the Kikis, supply stops and Rune Circles around you.";
            PlayerSettings.iOS.targetOSVersionString = "15.0";
            PlayerSettings.SetArchitecture(NamedBuildTarget.iOS, 1); // arm64
            PlayerSettings.iOS.appleEnableAutomaticSigning = false;   // signing happens in Unity Build Automation
            PlayerSettings.iOS.requiresPersistentWiFi = false;
            PlayerSettings.SetScriptingBackend(NamedBuildTarget.iOS, ScriptingImplementation.IL2CPP);

            // Android: ARCore needs API 24+, arm64, IL2CPP, and no Vulkan for the camera background on older builds.
            PlayerSettings.SetScriptingBackend(NamedBuildTarget.Android, ScriptingImplementation.IL2CPP);
            PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;
            PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel24;
            PlayerSettings.SetUseDefaultGraphicsAPIs(BuildTarget.Android, false);
            PlayerSettings.SetGraphicsAPIs(BuildTarget.Android, new[] { UnityEngine.Rendering.GraphicsDeviceType.OpenGLES3 });

            var icon = AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/KikiSafari/Resources/UI/icon.png");
            if (icon != null) PlayerSettings.SetIcons(NamedBuildTarget.Unknown, new[] { icon }, IconKind.Any);
        }

        /// <summary>Use the Input System (AR camera pose and touches). "Both" keeps any legacy code working.</summary>
        static void InputHandlingSetup()
        {
            var settings = AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/ProjectSettings.asset").FirstOrDefault();
            if (settings == null) return;
            var so = new SerializedObject(settings);
            var prop = so.FindProperty("activeInputHandler");
            if (prop != null && prop.intValue != 2)
            {
                prop.intValue = 2;
                so.ApplyModifiedProperties();
                Debug.LogWarning("[KikiSafari] Input handling set to 'Both'. Unity asks to restart once; say yes.");
            }
        }

        static void XrSetup()
        {
            Assign(BuildTargetGroup.iOS, "UnityEngine.XR.ARKit.ARKitLoader");
            Assign(BuildTargetGroup.Android, "UnityEngine.XR.ARCore.ARCoreLoader");
            // XR Simulation lets you test real AR in the editor on Windows (Project Settings ▸ XR Plug-in Management).
            Assign(BuildTargetGroup.Standalone, "UnityEngine.XR.Simulation.SimulationLoader");
        }

        static void Assign(BuildTargetGroup group, string loader)
        {
            var perTarget = GetOrCreatePerBuildTarget();
            if (!perTarget.HasSettingsForBuildTarget(group)) perTarget.CreateDefaultSettingsForBuildTarget(group);
            var general = perTarget.SettingsForBuildTarget(group);
            if (general.Manager == null)
            {
                var mgr = ScriptableObject.CreateInstance<XRManagerSettings>();
                mgr.name = $"{group} Providers";
                AssetDatabase.AddObjectToAsset(mgr, perTarget);
                general.Manager = mgr;
            }
            general.InitManagerOnStart = true;
            if (!XRPackageMetadataStore.AssignLoader(general.Manager, loader, group))
                Debug.LogWarning($"[KikiSafari] Could not enable {loader} for {group}. Enable it in Project Settings ▸ XR Plug-in Management.");
            EditorUtility.SetDirty(perTarget);
        }

        static XRGeneralSettingsPerBuildTarget GetOrCreatePerBuildTarget()
        {
            if (EditorBuildSettings.TryGetConfigObject(XRGeneralSettings.k_SettingsKey, out XRGeneralSettingsPerBuildTarget existing) && existing != null)
                return existing;
            Directory.CreateDirectory("Assets/XR");
            var created = ScriptableObject.CreateInstance<XRGeneralSettingsPerBuildTarget>();
            AssetDatabase.CreateAsset(created, "Assets/XR/XRGeneralSettingsPerBuildTarget.asset");
            EditorBuildSettings.AddConfigObject(XRGeneralSettings.k_SettingsKey, created, true);
            return created;
        }

        /// <summary>Writes the six variants as data assets so names, rarity, habitat and weights can change without code.</summary>
        static void Variants()
        {
            Directory.CreateDirectory(VariantsDir);
            foreach (var def in VariantCatalog.Defaults)
            {
                string path = $"{VariantsDir}/{def.Id}.asset";
                if (File.Exists(path)) continue;
                var v = ScriptableObject.CreateInstance<KikiVariant>();
                v.Def = new VariantDef
                {
                    Id = def.Id, DisplayName = def.DisplayName, Rarity = def.Rarity, BaseWeight = def.BaseWeight,
                    PreferredHabitats = (Habitat[])def.PreferredHabitats.Clone(), HabitatBoost = def.HabitatBoost,
                    OutsideHabitatFactor = def.OutsideHabitatFactor, TimeRule = def.TimeRule, CrewHuntBoost = def.CrewHuntBoost,
                };
                v.Look = KikiLookSpec.For(def.Id);
                AssetDatabase.CreateAsset(v, path);
            }
        }

        /// <summary>The only scene: empty except for a GameRoot. Everything else is built in code at runtime.</summary>
        static void Scene()
        {
            Directory.CreateDirectory(Path.GetDirectoryName(ScenePath));
            if (!File.Exists(ScenePath))
            {
                var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
                new GameObject("KIKI SAFARI").AddComponent<GameRoot>();
                EditorSceneManager.SaveScene(scene, ScenePath);
            }
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
        }
    }
}
