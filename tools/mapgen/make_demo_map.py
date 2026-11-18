"""Generates Assets/KikiSafari/Resources/DemoMap/demo-campground.json (GeoJSON).

The campground is fictional. Coordinates are written as degrees around [0, 0] so nothing points at a real place.
Edit the shapes here in metres and re-run:  python tools/mapgen/make_demo_map.py
"""
import json, math, os

M = 1 / 111320.0  # degrees per metre at the equator

def pt(e, n):
    return [round(e * M, 7), round(n * M, 7)]

def rect(cx, cy, w, h):
    return [pt(cx - w/2, cy - h/2), pt(cx + w/2, cy - h/2), pt(cx + w/2, cy + h/2), pt(cx - w/2, cy + h/2), pt(cx - w/2, cy - h/2)]

def blob(cx, cy, r, n=10, wobble=0.18, seed=1):
    ring = []
    for i in range(n):
        a = 2 * math.pi * i / n
        k = 1 + wobble * math.sin(a * 3 + seed)
        ring.append(pt(cx + math.cos(a) * r * k, cy + math.sin(a) * r * k * 0.8))
    ring.append(ring[0])
    return ring

def feature(props, gtype, coords):
    return {"type": "Feature", "properties": props, "geometry": {"type": gtype, "coordinates": coords}}

creek = [pt(15 + 22 * math.sin(n / 45.0), n) for n in range(-170, 181, 15)]

features = [
    feature({"id": "sunny-meadow", "name": "Sunny Meadow", "kind": "area", "habitat": "meadow"}, "Polygon", [blob(-105, 40, 95, 12, seed=0.5)]),
    feature({"id": "pine-hollow", "name": "Pine Hollow", "kind": "area", "habitat": "woods"}, "Polygon", [blob(125, 75, 80, 12, seed=2.0)]),
    feature({"id": "tent-yard", "kind": "area", "habitat": "town"}, "Polygon", [rect(85, -85, 90, 60)]),
    feature({"id": "creek", "kind": "water"}, "LineString", creek),
    feature({"id": "path-main", "kind": "path"}, "LineString", [pt(-70, -95), pt(-20, -70), pt(15, -30), pt(60, -10), pt(100, 30)]),
    feature({"id": "path-tent", "kind": "path"}, "LineString", [pt(15, -30), pt(50, -60), pt(80, -80)]),
    feature({"id": "path-meadow", "kind": "path"}, "LineString", [pt(-20, -70), pt(-60, -10), pt(-100, 40)]),
    feature({"id": "spiral-maze", "name": "Spiral Maze", "kind": "home", "habitat": "meadow"}, "Point", pt(-75, -105)),
    feature({"id": "creek-footbridge", "name": "Creek Footbridge", "kind": "stop"}, "Point", pt(15 + 22 * math.sin(-30 / 45.0), -30)),
    feature({"id": "supply-tent", "name": "Supply Tent", "kind": "stop"}, "Point", pt(85, -85)),
    feature({"id": "pine-hollow-sign", "name": "Pine Hollow", "kind": "landmark"}, "Point", pt(125, 75)),
    feature({"id": "sunny-meadow-sign", "name": "Sunny Meadow", "kind": "landmark"}, "Point", pt(-105, 40)),
]

doc = {
    "type": "FeatureCollection",
    "name": "Demo Safari campground (fictional)",
    "origin": [0, 0],
    "features": features,
}

here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, "..", "..", "Assets", "KikiSafari", "Resources", "DemoMap", "demo-campground.json")
with open(out, "w") as f:
    json.dump(doc, f, indent=1)
print("wrote", os.path.normpath(out))
