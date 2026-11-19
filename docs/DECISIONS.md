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

## 13. Phase 1: the Pokémon GO play loop (owner: "lets tackle phase 1")

The owner asked for the game to play more like Pokémon GO; `docs/ROADMAP.md` lists the objectives. Same loop and
depth, with KIKI SAFARI's own creatures, names and look. Built in the web version first, since that's the test build.

- **The map is home.** This reverses the camera-first call in section 12: you walk around the street map as your
  explorer, and Kikis pop up on it. The camera is used for AR catches, with an AR on/off switch (off shows a meadow
  stand-in). The camera view for looking around is still one tap away.
- **Your explorer:** four starter outfits and five skin tones, made at the start. Ranger Rue (placeholder) is the guide.
- **Every Kiki is one of a kind:** level, three hidden stats (Cuddle, Bounce, Zest, 0 to 15), size (XS and XL are rare)
  and Plush Power. Wild Kikis are up to your explorer level (max 30), and the same spawn always has the same stats.
- **Items:** Rune Stone, Moon Stone (level 5), Star Stone (level 10), Honey Leaf (level 2: easier catch), Sun Seed (level 6:
  double Fluff). Bag of 250, collection of 200.
- **Catching:** the ring's colour shows the odds (green, yellow, orange, red). Higher-level Kikis are harder. A Kiki
  that breaks out can run away (10 to 15%); starters can't.
- **Growth:** Sprouts plus that family's Fluff power a Kiki up (up to your level + 2). 25 Fluff evolves a common:
  Meadow → Grand Meadow, Pine → Elder Pine, Sprout → Bloom (new art: fuller crowns, embroidered tummy spirals, a flower).
  Sending a Kiki home gives 1 Fluff; favourites can't be sent.
- **Explorer level:** 1,000 XP for level 2, 3,000 for 3, 6,000 for 4, 10,000 for 5 and so on, up to 40. Level-ups give
  items. Daily first catch and first stop give bonus XP, with a big bonus on day 7 in a row.
- **Spawns you catch or scare off stay gone** for you (they used to come back after reloading).
- **Saves from before Phase 1 carry over:** each earlier catch becomes its own Kiki, stones and Sprouts are kept, and
  the player just makes an explorer (no starter).

## 14. Phase 2: a world worth exploring (owner: "move onto phase 2")

- **Roster:** 48 Kikis, all Kikis (same body, face and spiral eyes) with their own body colour, crown and tummy
  embroidery. Families of two or three stages; evolving a stage 2 into stage 3 costs 50 Fluff. Data in
  `web/js/species.js`; names are placeholders.
- **Elements:** Leaf, Water, Ember, Spark, Stone, Moon. A balanced wheel: each is strong against two (×1.6 in battle)
  and weak to two. Leaf beats Water and Stone, Water beats Ember and Spark, Ember beats Leaf and Moon, Spark beats Moon
  and Leaf, Stone beats Spark and Ember, Moon beats Stone and Water.
- **Weather** from Open-Meteo (free, no key). Only a rough position (rounded to about 10 km) is sent, every 10 minutes
  while playing. Each weather boosts two elements: boosted Kikis spawn 2.5× as often, are 3 levels higher and give
  25% more Sprouts. Rain and snow fall on the map.
- **Eggs:** 30% of stop spins give an egg (bag of 9). 2 km eggs are common, 5 km sometimes, 10 km rarely. The Warm Nest
  never wears out; a Cozy Nest (3 eggs) comes every 3 levels. Walking only counts while the game is open (web limit).
- **Buddy:** walks behind your explorer on the map and finds a Fluff every 1 km (common), 3 km (rare) or 5 km.
- **Sparkle Kikis:** 1 in 450, decided by the spawn so it's the same each time. Alternate colours and twinkles.
- **Tasks:** a stop gives a task (up to 3 at a time, one per stop per day). Finishing a task on 7 different days fills
  the stamp card for a rare Kiki. The story "The Spiral Mystery" has 5 chapters, ending with the Golden Spiral Kiki.
- **Medals:** bronze, silver and gold for catches, walking, stops, the Safari Log, Excellent throws, evolving,
  hatching, Sparkles, buddy walks, tasks, and each element.
- **Events** follow a calendar every phone works out the same way: element weekends (2× Sprouts), a Kiki Parade on
  Wednesdays 6 to 8 pm (2× XP), Kiki Day on the first Saturday of the month 2 to 5 pm (3× XP, Sparkles 25× as likely),
  and Full Moon nights. Portal Surge Kikis follow the event.

## 15. Phase 3: battles (owner: "when complete phase 3")

- **Battles** are real time: tap for your quick move (it builds energy), tap the round button for the charged move
  when it's full, swipe sideways to dodge. The other side attacks on a timer and shows a red "!" before its charged
  move; dodging cuts that hit to a quarter. Each element has a quick and a charged move (Leaf Flick / Petal Storm,
  Splash / Bubble Burst, Ember Puff / Flare Spin, Zap / Thunder Hug, Pebble Pop / Rock Roll, Moon Glimmer / Dream
  Spiral). Stats come from the species plus the hidden stats: Zest is attack, Bounce defence, Cuddle HP.
- **Damage stays** after a battle. Herb Salves, Super Salves and Revival Dew (all placeholders) heal; they
  come from supply stops and level-ups from level 5.
- **Rune Circles:** today's wild Keepers (1 to 3, around your level, the same on every phone). Beat them with up to
  3 Kikis and one of yours keeps the circle in your faction's colour, gathering Sprouts until you call it home. A
  keeping Kiki can't battle or be sent home. The Spiral Rite is now a daily attunement: attunement × 3 Sprouts, once
  per circle per day.
- **Factions** at level 5 (placeholders): Dusk Weavers (purple), Tide Keepers (teal), Bloom Wardens (coral). Cosmetic
  for now; they matter more once circles are shared online (Phase 4).
- **Raids:** during a Portal Surge every circle has a boss (40% one-star rare, 40% three-star epic, 20% five-star
  legendary). Up to 6 Kikis, 3 minutes. One free raid a day, then a Portal Key (one per level-up from level 5, and from
  tasks). Win for items and XP, then catch the boss with 6 to 8 Raid Stones (2 more if your Kiki keeps that circle).
  Difficulty was tuned by simulation: one-star takes three level-20 Kikis about 40 seconds; five-star needs six and
  good dodging.
- Raids are solo in the web version. Co-op raids, shared circles and other players need the Phase 4 server.

## 16. Kikis are creatures, not plushies (owner)

"Lets strip out this idea that they are plushies, they are little creatures not stuffed animals." Kikis keep Kiki's
look (round body, spiral eyes, crowns) but have smooth skin: no seams, stitches or fabric texture. Tummy patterns and
Moonbeam's stars are natural markings, not embroidery. The healing items are now Herb Salve, Super Salve and Revival Dew
(they were Stitch Kits and Revive Pillows; saves carry over). "Plush Power" is just "Power". Kiki's origin as the Big
Plush mascot is unchanged; this is about how the game presents them.

## 17. Phase 4: online (owner: "lets move to 4 & 5", "supa base is fine i have an account")

- **Server:** the owner's Supabase project. Players sign in anonymously (no email, password or real name). The tables
  can't be read or written directly (row-level security with no policies); every action is a server function in
  `supabase/schema.sql` that checks who's asking. The game's publishable key is in `web/js/online.js`, which is fine:
  it's meant to be public. Secret keys are never in the game.
- **Anti-cheat:** each player is rate-limited (150 calls a minute). Positions sent for trades, raids and circles are
  checked for impossible speed (over 300 km/h). Kikis sent to the server are checked against the real species list,
  level and stat limits. Coins are paid only by the server when you're online.
- **Moving phones:** a one-time 8-letter moving code (Settings ▸ Online account), stored only as a hash, valid for 15
  minutes.
- **Shared circles:** up to 6 keepers of one faction. Another faction battles all of them (played by the game) to clear
  the circle. Keepers earn coins: 1 per 10 minutes, up to 50 a day, paid when they come home or are beaten.
- **Co-op raids:** same circle, same Surge. Boss HP × (1 + 0.6 for each extra player); damage adds up live every 2 s.
- **Friends:** codes, one gift a day per friend (gifts come from supply stops, 1 in 4 spins), friendship levels from
  days as friends: Friends (1), Good (7), Great (30), Best (90).
- **Trading:** both players within 100 m, a 4-digit code, both confirm. 100 Sprouts each.
- **Leagues:** Sprout (Power ≤ 500), Bloom (≤ 1500) and Open; you battle other players' saved teams, not live players,
  so nobody has to be online at once.
- **Push:** Netlify Functions with Netlify Blobs, so there's nothing to set up (the keys are made on first use). It asks
  Supabase who the player is with their own sign-in, so it needs no Supabase secrets. On iPhone, notifications only
  work from the Home Screen app (iOS 16.4+).

## 18. Phase 5: polish

- **Music:** original chiptune, generated in the browser from short composed patterns (no audio files, nothing
  licensed). Title (dreamy), map (bouncy), catch (playful), battle and raid (driving). Settings ▸ Music turns it off
  separately from sound effects. It goes quiet when the app is in the background.
- **Coins:** earned only by playing (keeping circles, medals: 10 / 25 / 50 for bronze / silver / gold). No real money.
  Bag and Kiki room go up to 500 each.
- **Battery saver:** 1× pixels and 30 frames a second on the map; catches and battles stay smooth.
- **Units:** km or miles for distances on screen. Egg names stay "2 km / 5 km / 10 km" (they're names).
- **Privacy page** (Settings ▸ Privacy) lists what stays on the phone, what goes online and to which service.
