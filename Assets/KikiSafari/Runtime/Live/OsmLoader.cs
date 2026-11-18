using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Threading.Tasks;
using KikiSafari.Core;
using UnityEngine;
using UnityEngine.Networking;

namespace KikiSafari
{
    /// <summary>
    /// Downloads OpenStreetMap data around the player, one 800 m area at a time, from the Overpass API, and keeps it on
    /// the phone for two weeks so the map and landmarks still work with no signal (decisions doc, section 5).
    /// Parsing and landmark placement run off the main thread. For launch, swap the endpoint for a self-hosted extract.
    /// </summary>
    public sealed class OsmLoader : MonoBehaviour
    {
        public const string Endpoint = "https://overpass-api.de/api/interpreter";
        const double LoadRadius = 450;
        const double CacheDays = 14;

        public WorldData Data { get; } = new WorldData();
        public event Action<WorldGrid.Cell, OsmArea> Loaded;
        public bool Loading => _busy;
        public string Problem { get; private set; }

        readonly Queue<WorldGrid.Cell> _queue = new Queue<WorldGrid.Cell>();
        readonly HashSet<(long, long)> _queued = new HashSet<(long, long)>();
        readonly Dictionary<(long, long), float> _retryAt = new Dictionary<(long, long), float>();
        bool _busy;
        float _backoffUntil;

        static string CacheDir => Path.Combine(Application.persistentDataPath, "osm");
        static string CachePath(WorldGrid.Cell c) => Path.Combine(CacheDir, $"{c.X}_{c.Y}.json");

        /// <summary>Asks for every area within reach of the player. Cheap to call often.</summary>
        public void Need(LatLon me)
        {
            foreach (var c in WorldGrid.CellsAround(me, LoadRadius, LandmarkPlanner.DataCell))
            {
                var key = (c.X, c.Y);
                if (Data.Has(c) || _queued.Contains(key)) continue;
                if (_retryAt.TryGetValue(key, out var t) && Time.realtimeSinceStartup < t) continue;
                _queued.Add(key);
                _queue.Enqueue(c);
            }
            if (!_busy && _queue.Count > 0) StartCoroutine(Run());
        }

        IEnumerator Run()
        {
            _busy = true;
            while (_queue.Count > 0)
            {
                var cell = _queue.Dequeue();
                yield return Load(cell);
                _queued.Remove((cell.X, cell.Y));
            }
            _busy = false;
        }

        IEnumerator Load(WorldGrid.Cell cell)
        {
            string json = null;
            string path = CachePath(cell);
            bool fresh = File.Exists(path) && (DateTime.UtcNow - File.GetLastWriteTimeUtc(path)).TotalDays < CacheDays;
            if (fresh) json = ReadSafe(path);

            if (json == null)
            {
                while (Time.realtimeSinceStartup < _backoffUntil) yield return null;
                var q = OsmArea.Query(cell.SouthWest.Lat, cell.SouthWest.Lon, cell.SouthWest.Lat + cell.DegLat, cell.SouthWest.Lon + cell.DegLon);
                using (var req = new UnityWebRequest(Endpoint, "POST"))
                {
                    req.uploadHandler = new UploadHandlerRaw(Encoding.UTF8.GetBytes("data=" + Uri.EscapeDataString(q)));
                    req.downloadHandler = new DownloadHandlerBuffer();
                    req.SetRequestHeader("Content-Type", "application/x-www-form-urlencoded");
                    req.timeout = 45;
                    yield return req.SendWebRequest();
                    if (req.result == UnityWebRequest.Result.Success)
                    {
                        json = req.downloadHandler.text;
                        Problem = null;
                        try { Directory.CreateDirectory(CacheDir); File.WriteAllText(path, json); } catch (Exception e) { Debug.LogWarning("[KikiSafari] map cache: " + e.Message); }
                    }
                    else
                    {
                        // Busy server (429/504) or no signal: back off, use an old copy if we have one.
                        long code = req.responseCode;
                        _backoffUntil = Time.realtimeSinceStartup + (code == 429 || code == 504 ? 30f : 10f);
                        _retryAt[(cell.X, cell.Y)] = Time.realtimeSinceStartup + 20f;
                        if (File.Exists(path)) json = ReadSafe(path);
                        if (json == null)
                        {
                            Problem = "Can't load the map here right now. Kikis still spawn; landmarks will appear when the map loads.";
                            Debug.LogWarning($"[KikiSafari] Overpass {code}: {req.error}");
                            yield break;
                        }
                    }
                }
            }

            // Parse and place off the main thread.
            var origin = cell.Center;
            var task = Task.Run(() =>
            {
                var area = OsmArea.FromOverpassJson(json, origin);
                var (stops, circles) = LandmarkPlanner.Place(area, cell);
                return (area, stops, circles);
            });
            while (!task.IsCompleted) yield return null;
            if (task.IsFaulted)
            {
                Debug.LogWarning("[KikiSafari] map parse failed: " + task.Exception?.GetBaseException().Message);
                try { File.Delete(path); } catch { }
                _retryAt[(cell.X, cell.Y)] = Time.realtimeSinceStartup + 60f;
                yield break;
            }
            var r = task.Result;
            Data.Add(cell, r.area, r.stops, r.circles);
            Loaded?.Invoke(cell, r.area);
        }

        static string ReadSafe(string path)
        {
            try { return File.ReadAllText(path); } catch { return null; }
        }

        /// <summary>Clears the map cache (tuning panel).</summary>
        public static void ClearCache()
        {
            try { if (Directory.Exists(CacheDir)) Directory.Delete(CacheDir, true); } catch { }
        }
    }
}
