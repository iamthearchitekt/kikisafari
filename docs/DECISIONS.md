# KIKI SAFARI: Design Decisions

Addendum to `big-plush-character-treatment.md` and the KIKI SAFARI build prompt. Updated 2026-11-18.
Items marked **(owner)** were decided by the owner. Everything else is Claude's call, made because the owner said "the rest I'll leave to your judgment". Change anything here.

## 1. Changes from the build prompt (owner)
- The yellow Big Plush character **is Kikiwawa** ("Kiki").
- **Live Safari is worldwide and not tied to Big Dub for now.** Kikis spawn anywhere in the world, around players, the way location-based creature games work. Only the mechanic is shared. Following the originality rule in section 6 of the treatment, no names, art or terms are copied from any existing game.
- **What this replaces:** the festival-specific parts of the prompt, meaning the Four Quarters Farm map and staff-drawn zones and routes for one site.
- **What stays:**
  - The festival look and feel. Kiki is still the Big Dub mascot.
  - Event zones, as a general feature, so a festival can come back later as a special event.
- **Unchanged:**
  - Demo Safari and the AR encounter
  - server validation and offline pending throws
- **Changed:** the first milestone is now a complete Demo Safari AR catch on the owner's **iPhone** (see section 11).
- **Changed again, 2026-11-18 (owner):** the real world is the whole point. **Live Safari through the phone camera** is the main game. The live camera is the main screen, with Kikis, supply stops and Rune Circles pinned at their real GPS spots and a radar for what's around. The fictional campground is now only a practice mode: for when there's no location, and for players under the digital age of consent (section 6).
- **Gyms become Rune Circles (owner: "something mystical instead of gym").** See section 12.
- **Testing (owner):** one Rune Circle for now, at the owner's home. It's pinned on the phone at the first good GPS fix (or with "Move test Rune Circle here" in the tuning panel). The address is never looked up online or written into the project.

## 2. Character
- In KIKI SAFARI he is always called Kikiwawa or Kiki.
- Every variant must follow section 3 of the treatment:
  - egg-shaped body with a leaf crown
  - mirrored spiral eyes on cream discs
  - a big open grin
  - a matte plush finish (roughness about 0.4, metalness 0)
  - **no nose, never shiny, no clothing**
- Placeholder model: ported from the claw game's own `makeMascot()` (egg body, arms, feet, leaf fan, painted face and plush normal map), then tuned toward the official mascot art: a chubbier pear body, a bigger grin and bolder spirals, and a brighter leaf fan. It gets swapped for the official GLB when one is available.

## 3. The six variants
All six keep the yellow body (`#ffc928`) and the canon silhouette. Only the leaf crown, embroidery and glow change. Each variant is a data asset, so names, rarity, habitat and spawn weights can change without code. Demo Safari uses the same six on its fictional map.

| Variant | Rarity | What makes it different | Where and when it appears |
|---|---|---|---|
| Meadow Kiki | Common | the canon look | grass, parks and fields, in daytime |
| Pine Kiki | Common | darker, needle-like leaf crown | woods and forests |
| Sprout Kiki | Common | smaller, with a 3-leaf seedling crown | anywhere, most often in towns |
| Rainbow Kiki | Rare | rainbow-striped leaf tips | near water: rivers, lakes, coast |
| Moonbeam Kiki | Epic | UV-purple screen-blend glow, star-stitched seams | anywhere, at night (local sunset to sunrise) |
| Golden Spiral Kiki | Legendary | gold-thread spiral embroidered on the belly, gold leaf tips (matte thread, not metal) | anywhere, very rare, and more likely in Crew Hunts |

Rarity colors come from section 4 of the treatment.

## 4. Worldwide spawning (Live Safari)
- **The server makes the spawns.** It generates Kikis for each small map cell, about 70 m across, in time windows. Everyone nearby sees the same Kikis in the same places. Each spawn lasts 15–30 minutes.
- **Habitats:** each neighborhood-sized cell, about 1 km across, has a habitat that sets which variants are likely.
  - Version 1 rotates habitats every two weeks, which is the prompt's "rotating habitats". This works anywhere with no extra map data.
  - Later versions also use real land cover from the map: parks and fields favor Meadow, woods favor Pine, and water favors Rainbow.
- **Ranges:**
  - Within about 200 m, Kikis show in a Nearby list.
  - Within about 70 m, they appear on the map.
  - Within 40 m, the player can tap one to open the AR encounter. The player catches from where they stand, so they never have to step onto the exact spot.
- **Playable everywhere:** a minimum spawn density keeps rural and quiet areas playable, and a cap in busy areas keeps crowds from bunching up.
- **Supply stops:** placed at public landmarks from OpenStreetMap, such as public art, fountains, historic markers, libraries and park entrances. Where there are none, the server adds stops in public spaces. Each stop has a cooldown for each player.
- **Speed lock:** above about 30 km/h, no encounters or supply stops, with a "Looks like you're moving fast" notice.
- **GPS checks:** the server rejects a position that is less accurate than about 50 m, older than about 30 seconds, or an impossible jump from the last one.
- **Spawn safety:** spawns and supply stops avoid:
  - roads, railways, water and buildings, where map data shows them
  - schools and kindergartens, hospitals, cemeteries, places of worship, memorials, military sites, prisons and airports
  - every place on the opt-out list. Property owners and venues can ask to have a location removed, and staff can add exclusion zones anywhere.
- **Events:** staff can set up event zones and scheduled spawns anywhere in the world.
- **Crew Hunts:** scheduled at supply stops worldwide. Players in range join a shared timer kept by the server, and each one gets their own AR catch attempt. Golden Spiral is more likely here.
- **Field tasks and routes:** supply stops give out field tasks. Checkpoint routes are picked by staff at first; routes made by players come later.

## 5. Map
- **Live map:** OpenStreetMap-based vector map tiles, drawn by the game's own lightweight renderer and saved on the phone so the map keeps working with no signal. The map shows "© OpenStreetMap contributors", as the map data's license requires. GeoJSON is still used for the demo map and for event zones.
- **Map data (updated 2026-11-18):** the game downloads OpenStreetMap data itself, one 800 m area at a time, and draws streets, parks, water and buildings in its own sticker style. The same data places stops and Rune Circles, enforces the safety rules and sets habitats. It's cached on the phone for 14 days.
  - Development uses the free public Overpass API, with no key needed.
  - Launch uses a self-hosted extract on low-cost storage, so map costs don't grow with the number of players and the public service isn't overloaded.
- **Map view:** Camera is the main view (owner). A Map button flips to the street map, and the camera switches off there to save battery.
- **Map mood:** "sunny meadow" by day and "cosmic set" at night, by local time.
- **Demo map:** Demo Safari keeps its bundled fictional campground with invented names: Spiral Maze, Creek Footbridge, Sunny Meadow, Pine Hollow and Supply Tent. Kiki's home spawn is by the Spiral Maze.

## 6. Privacy, safety and age
- Location is used only while the game is open. There is no background tracking.
- The server uses an exact position only to check that one request, then keeps at most a coarse map cell. Players never see where other players are.
- Live Safari asks for age at name entry. Players under 13, or under the local age of digital consent (up to 16 in parts of the EU), get Demo Safari only until there is a parental-consent flow.
- At launch, a short reminder to watch your surroundings. With the speed lock, there are no encounters while driving.

## 7. Rune Stone and catch sequence
- **Rune Stone (owner):** the thrown item is a rune stone, not an orb. It's a smooth slate-indigo river stone with Kiki's spiral carved into both faces. The carving glows UV purple, with a UV-purple halo. It's deliberately nothing like a two-tone split ball.
- **Portal (owner):** when the stone hits Kiki, a UV-purple energy portal opens and sucks him in. In order:
  1. Hit sparkles.
  2. A swirling spiral portal opens behind Kiki, a dark void with UV-purple arms.
  3. Kiki stretches and spins as he's pulled in, with purple energy streaming inward.
  4. The portal seals into the stone.
  5. The stone drops to the ground.
- **Catch:** then follows the reveal in section 5 of the treatment.
  1. The stone wobbles, its spiral flaring at each knock: 1 time (Common), 2 (Rare), 3 (Epic and Legendary). Each wobble has a haptic knock.
  2. It bursts in purple energy, and the rarity label stamps in.
  3. Kiki drops in on a cosmic spiral background and does a random dance.
  4. The reward counts up.
  5. The player taps **Keep playing**. The screen never closes by itself.
- **Glow in daylight:** glows stay UV purple with a screen blend. A light purple tint goes under the screen blend so the halo doesn't wash out to lavender over a bright camera feed.
- **Breakout:** the portal blasts back open from the stone and Kiki hops back out, with "SO CLOSE!", a screen shake, the warning haptic and an occasional quiet "awww".
- **Miss:** the stone bounces off the ground and fizzles. No text.
- **Kiki never runs away mid-encounter.** The treatment says it's never punishing, always "almost!". A Live encounter ends only when its spawn window closes or the player walks out of range.
- **No spoilers:**
  - The timing ring shows only the target size.
  - A hit gets sparkles and a medium haptic, with no words.
  - Throw-quality words (Nice, Great, Excellent) and the spin bonus appear only in the count-up after a confirmed catch.
- **Live, offline:** a queued throw leaves the stone sealed, with "Pending: reveal when you're back in signal". The reveal plays when the server confirms. If the throw expires, the player sees "That one slipped away" and gets the stone back, because the server applies the stone use and the catch together or not at all.

## 8. Accounts and leaderboard
- **Demo:** no account. Everything is stored on the phone.
- **Live:** name entry works like the claw game: type a name, and rude names become "Plush Fan". Behind it is Supabase anonymous sign-in, so the server can still check rune stones and catches. No email or password.
- **Leaderboard:** not in version 1. When it's added, a Safari Log completion board gets its own board, following section 7 of the treatment: same name entry, rude-name filter, offline queue, and Today and All time tabs. Its data comes from the server-checked catches in Supabase.
- **Cross-game rewards ("Plush Pass"):** later, not version 1.

## 9. Look, sound and feel
- **UI:** sticker style, using the treatment's palette tokens. Lilita One and Baloo 2 fonts ship with the app (both are open-licensed). Glows are always UV purple with a screen blend.
- **Kiki in AR:** uses the treatment's idles and five celebration dances, picked at random.
- **Audio:** short chiptune blips. The "yay" and "awww" clips are quiet and play about half the time.
- **Haptics:** the treatment's seven-pattern vocabulary, native on Android and iPhone. Every haptic has a matching visual.
- **Accessibility:**
  - Reduced motion: no screen shake, no spins, shorter wobbles.
  - Sound can be turned off.
  - Aim assist and tap-to-throw are always available.
- **One-handed portrait play:** the player flicks from the bottom center of the screen.
- **Tone:** everyone-friendly, no drug references, no real-money purchases.

## 10. Logo and assets
- **Logo (owner):** KIKI SAFARI gets a logo in the same style as the BIG PLUSH logo:
  - puffy bubble letters, with "KiKi" in yellow and "SAFARI" in sky blue
  - a thin white rim inside one thick navy sticker outline
  - leaves tucked behind the letters, the yellow spiral sun with sparkle ticks
  - Kiki waving on the left
  - spiral dots on both i's, mirrored like his eyes

  The source is `tools/logo/` and the output is `docs/brand/kiki-safari-logo.png`. The font is Fredoka, which is open-licensed.
- **From the live claw game** (big-plush.netlify.app): `mascot.webp`, `meadow.webp`, `win.mp3` ("yay") and `slip.mp3` ("awww") are in the project. The app icon is made from the mascot art.
- **Still wanted:** a GLB export of `makeMascot()`, and `icon-only.png` / `splash.png` if they differ from what's here.

## 11. Test devices and builds (owner)
- The owner tests on an **iPhone** and develops on **Windows**, with no Mac. The first milestone is a complete Demo Safari AR catch on that iPhone. Android stays a supported target. It's built and tested whenever an ARCore phone is available.
- **iPhone builds without a Mac.** Apple's final build and signing step needs Xcode, which runs only on a Mac, so iPhone builds run on a Mac in the cloud.
  - The project lives in a private Git repository. Unity Build Automation, Unity's own cloud build service, builds it on a Mac and charges per build minute. The app then installs on the iPhone through TestFlight.
  - This needs the Apple Developer Program ($99 a year), which an App Store release needs anyway. Enrolling can take a day or two, so it's worth starting early.
  - Signing can all be set up from Windows: OpenSSL makes the certificate request and the .p12 file, and everything else happens on Apple's developer website.
  - Getting a code change onto the iPhone takes about an hour: the cloud build, then TestFlight processing.
- **Keeping iPhone round trips rare:**
  - Day-to-day work runs in the Unity editor with AR Foundation's XR Simulation.
  - A hidden tuning panel on the phone changes throw strength, timing-ring speed, aim assist and catch odds live, without a rebuild.
  - Optional: a used ARCore Android phone, around $100, installs over USB from Windows in a few minutes. That makes tuning the feel of the throw much faster.
- **Occlusion:** iPhones with LiDAR (Pro models from the 12 Pro on) get full depth occlusion, so real objects can hide Kiki. Other ARKit iPhones get people occlusion (A12 chip and newer) or none. The game checks this at runtime and falls back gracefully.
- **Automated tests** run in the Unity editor on Windows with XR Simulation, so no phone is needed for them.

## 12. Rune Circles (owner: mystical, instead of gyms)
- **What they are:** rings of seven carved standing stones with Kiki's spiral glowing UV purple on each, a low dais, a swirling portal above, a ring of UV light on the ground, and a column of light rising from the portal so you can spot one from down the street. Each has a **Keeper Kiki** standing on the dais.
- **Spiral Rite (Claude's call):** the challenge. The circle's spiral rune pulses to a slow beat (84 BPM, 16 beats). A ring of light closes on it each beat, and the player taps as it lands.
  - Scoring: Perfect is within 75 ms and Good within 160 ms. Attunement runs from 0 to 100, with a small bonus for streaks.
  - Out-attune the Keeper and your Kiki takes the circle. It gathers 20 Sprouts every half hour, up to 12 hours, to collect on your next visit.
  - Wild Keepers' attunement: 55 (Common), 65 (Rare), 75 (Epic), 85 (Legendary). No fighting and no teams.
- **Portal Surges (Claude's call):** every 2 hours, for 15 minutes, a circle's portal opens wide and rarer Kikis pour out around it for everyone nearby. This is the Crew Hunts idea from section 4, held at Rune Circles; Golden Spiral is likelier.
- **A wanderer:** one Kiki always hangs around each circle (a new one every 15-minute spawn window).
- **Placement (Claude's call):** at real landmarks from OpenStreetMap.
  - Priority: historic sites and parks over 5,000 m² first; then public art and fountains; then museums, galleries, theatres, arts centres, town halls, libraries, viewpoints and attractions.
  - Up to three circles per 800 m area, at least 250 m apart. Other landmarks become supply stops, at least 70 m apart.
  - Every 250 m square gets a stop, and every area gets a circle (in green space when there is some), so it works everywhere.
  - Everything follows the safety rules in section 4.
  - The home test circle stays until it's switched off in the tuning panel.
  - Until a server holds Keepers, a captured circle is remembered on the player's phone.
