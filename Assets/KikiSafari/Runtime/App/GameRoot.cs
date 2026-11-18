using System.Collections;
using System.Collections.Generic;
using KikiSafari.Core;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.UI;
using UnityEngine.XR.ARFoundation;

namespace KikiSafari
{
    /// <summary>
    /// The whole game boots from here, in any scene: title → Demo Safari map → AR encounter → back to the map.
    /// Everything is built in code so the project needs no hand-made prefabs or scenes.
    /// </summary>
    public sealed class GameRoot : MonoBehaviour
    {
        public static GameRoot Instance { get; private set; }

        public SafariProgress Progress { get; private set; }
        public VariantLibrary Library { get; private set; }
        /// <summary>Spawns caught this session, hidden from the map until they expire.</summary>
        public readonly HashSet<string> CaughtSpawns = new HashSet<string>();

        Transform _ui;
        MapScreen _map;
        ARStage _ar;
        FallbackStage _fallback;
        EncounterController _encounter;
        Camera _clearCam;
        bool _arChecked, _arSupported;

        // Hidden tuning panel gesture
        int _cornerTaps;
        float _cornerFirst;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void Boot()
        {
            if (FindAnyObjectByType<GameRoot>() == null) new GameObject("KIKI SAFARI").AddComponent<GameRoot>();
        }

        void Awake()
        {
            if (Instance != null && Instance != this) { Destroy(gameObject); return; }
            Instance = this;
            DontDestroyOnLoad(gameObject);
            Application.targetFrameRate = 60;
            Screen.sleepTimeout = SleepTimeout.NeverSleep;
            Screen.orientation = ScreenOrientation.Portrait;

            // Our screens bring their own cameras and lights; quiet any the scene came with.
            foreach (var c in FindObjectsByType<Camera>(FindObjectsSortMode.None)) c.enabled = false;
            foreach (var l in FindObjectsByType<Light>(FindObjectsSortMode.None)) l.enabled = false;

            Progress = ProgressStore.Load();
            Library = VariantLibrary.Load();
            gameObject.AddComponent<SfxPlayer>();
            Haptics.Prepare();
            EnsureEventSystem();

            _ui = new GameObject("UI").transform;
            _ui.SetParent(transform, false);

            // A camera that just clears the screen behind full-screen menus.
            var cc = new GameObject("ClearCamera");
            cc.transform.SetParent(transform, false);
            _clearCam = cc.AddComponent<Camera>();
            _clearCam.clearFlags = CameraClearFlags.SolidColor;
            _clearCam.backgroundColor = Colors.Sky;
            _clearCam.cullingMask = 0;
            _clearCam.depth = -100;

            StartCoroutine(CheckAR());
        }

        void Start() => ShowTitle();

        static void EnsureEventSystem()
        {
            if (FindAnyObjectByType<EventSystem>() != null) return;
            var es = new GameObject("EventSystem");
            es.AddComponent<EventSystem>();
            es.AddComponent<InputSystemUIInputModule>();
            DontDestroyOnLoad(es);
        }

        IEnumerator CheckAR()
        {
            if (ARSession.state == ARSessionState.None || ARSession.state == ARSessionState.CheckingAvailability)
                yield return ARSession.CheckAvailability();
            if (ARSession.state == ARSessionState.NeedsInstall)
                yield return ARSession.Install();
            _arSupported = ARSession.state >= ARSessionState.Ready;
            _arChecked = true;
            Debug.Log($"[KikiSafari] AR {(_arSupported ? "available" : "not available, using the meadow stage")} ({ARSession.state})");
        }

        public void ShowTitle()
        {
            if (_map) _map.SetActive(false);
            TitleScreen.Show(_ui, ShowMap);
        }

        public void ShowMap()
        {
            if (_map == null) _map = MapScreen.Make(this, StartEncounter);
            else _map.SetActive(true);
        }

        public void ShowLog() => SafariLogScreen.Show(_ui, this, null);

        public void SaveProgress() => ProgressStore.Save(Progress);

        void StartEncounter(string spawnKey, string variantId)
        {
            if (_encounter != null) return;
            StartCoroutine(StartEncounterWhenReady(spawnKey, variantId));
        }

        IEnumerator StartEncounterWhenReady(string spawnKey, string variantId)
        {
            while (!_arChecked) yield return null;
            _map.SetActive(false);
            IEncounterStage stage;
            if (_arSupported)
            {
                _ar ??= new ARStage(transform);
                stage = _ar;
            }
            else
            {
                _fallback ??= new FallbackStage(transform);
                stage = _fallback;
            }
            _encounter = EncounterController.Begin(this, stage, variantId, new LocalCatchResolver(), exit =>
            {
                _encounter = null;
                if (exit == EncounterExit.Caught) CaughtSpawns.Add(spawnKey);
                ShowMap();
            });
        }

        void Update()
        {
            // Hidden tuning panel: triple-tap the top-right corner (over the Rune Stone count) within a second.
            var p = Pointer.current;
            if (p == null || !p.press.wasPressedThisFrame) return;
            var pos = p.position.ReadValue();
            float corner = Mathf.Min(Screen.width, Screen.height) * 0.12f;
            if (pos.x < Screen.width - corner || pos.y < Screen.height - corner) { _cornerTaps = 0; return; }
            if (_cornerTaps == 0 || Time.unscaledTime - _cornerFirst > 1f) { _cornerTaps = 0; _cornerFirst = Time.unscaledTime; }
            if (++_cornerTaps >= 3)
            {
                _cornerTaps = 0;
                if (FindAnyObjectByType<TuningPanel>() == null) TuningPanel.Show(_ui, this);
            }
        }

        void OnApplicationFocus(bool focus) { if (focus) Accessibility.Refresh(); }
        void OnApplicationPause(bool paused) { if (paused && Progress != null) SaveProgress(); }
        void OnApplicationQuit() { if (Progress != null) SaveProgress(); }
    }
}
