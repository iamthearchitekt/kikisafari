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
- **Street map reliability:** map data comes from public Overpass servers, which get busy. The game tries
  overpass-api.de, then overpass.private.coffee, then overpass.kumi.systems, gives each 40 seconds, and remembers the one
  that answered. Error replies ("query timed out") are never saved on the phone. Settings ▸ Testing tools shows the
  last map problem and has "Try the map again now". For a big launch, the game should use its own map server.

## 19. Rare Kikis use names from the Big Plush game (owner)

"I have all the dumb names for the kikiwas from the big plush game ... just use some of those for the rare ones."
Sixteen of the 19 rare Kikis take a name from Big Plush's roster, matched to how they look. Their ids don't change, so
saves, trades and the server are unaffected. Lil Plush, Big Plush and Golden Ticket weren't used (the first two are
plush names; Golden Spiral is already the golden one).

| Kiki (id) | Name | Why |
|---|---|---|
| grand-meadow | High Meadow Mae | meadow |
| elder-pine | Hemlock Holly | a frosty conifer |
| oak | Hilltop Hank | big woodland Kiki |
| bloom | Sanctuary Sadie | pink, like Sadie |
| rainbow | Rainbow Bridget | rainbow |
| brook | Swimmin' Hole Sid | water, blue like Sid |
| campfire | Fire Circle Fred | campfire |
| glowcap | Fungi Phil | mushroom cap |
| boulder | Stone Circle Steve | stone |
| geode | Fairy Cairn Fern | stones, purple like Fern |
| starry | Portal Wookie | starry, like Wookie's galaxy pattern |
| nightwing | Lucid Wizard | the wise night owl |
| lantern | Disco Den Dottie | lights |
| frizz | Clown Town Coco | the big hairdo |
| volt | Ridge Road Rider | runs laps |
| sandcastle | Labyrinth Lou | castle builder |

Lotus, Frosty and Blaze Kiki keep their names (no name left that fit). Rainbow and Geode Fluff keep their short names.
The Unity project still has the old names.

## 20. No aiming circle; Kikis stand on the floor (owner)

- "The big circle for aiming covers the Kiki ... I just want it gone." The shrinking timing circle over Kiki is gone.
  Nice / Great / Excellent now come from accuracy: how close to Kiki's middle the flicked stone was heading (dead
  centre is Excellent). "Tap to throw" always lands but earns no bonus. How hard the catch is shows as a coloured dot
  on the name card.
- "Make sure Kikis are on surfaces and not floating around in a room." iPhone's browser can't detect real floors or
  tables (Safari has no WebXR), so the game assumes the floor is about phone-height below you. Kiki now appears closer
  (1 to 2.2 m, so it fits in a room), with a darker shadow, and you can tap the floor or a table top to make Kiki hop
  there: its feet land exactly where you tapped. Real surface detection would need the native (Unity, ARKit) app.

## 21. Explorers are festival-goers (owner)

"The avatars look stupid ... allow them to customize their colors", then "they have to look like wooks and festival
goers, for EDM festivals." The explorer is rebuilt as a chibi festival-goer: big head and shiny eyes, brows, ears, and
a full look the player picks in Change look (or when making their explorer), with a live 3D preview to spin:

- Skin (8 tones), eyes (6 colours).
- Hair: Short, Bob, Long, Ponytail, Space buns, Curly, Spiky, Buzz, Dreads, Mohawk, Braids, in 12 colours.
- Hat: none, bucket hat, trucker cap, beanie, cowboy hat, flower crown, bandana, ranger hat, in any colour.
- Shades: none, round, hearts, shutter shades, LED shades (colour-cycling).
- Top and bottoms: plain, tie-dye, rainbow, galaxy, checker, stripes, spots or daisies, in any colour; shorts or flowy
  pants. Shoes in any colour.
- Bag: backpack, hydration pack, fanny pack or none. Extras: kandi bracelets, LED gloves, a totem with a Kiki on top.
- Festival looks to start from: Wook, Raver, Bass Head, Flower Child. Old saves' outfits become these four.

The whole look is saved with the explorer, shown on the map and in menus, and sent with the online profile so friends
see it (the server stores the avatar as-is; older versions of the game still read its outfit and skin).

## 22. Street map data from OpenFreeMap tiles

The public Overpass servers stopped answering reliably (the main one refused connections; the mirrors timed out even on
tiny requests), so the map was stuck on "Loading the map…" / "Map servers are busy". The map now comes from
**OpenFreeMap** (tiles.openfreemap.org): free OpenStreetMap vector tiles on a CDN, no key or account, made for apps.

- `web/js/tiles.js` reads zoom-14 tiles (about 2 km square) with a small built-in vector-tile decoder and turns the
  OpenMapTiles layers into the same OpenStreetMap-style tags the game already understood (roads, paths, railways,
  water, rivers, woods, grass, parks, buildings, no-go places such as schools and hospitals, and landmarks: artwork,
  museums, galleries, theatres, libraries, fountains, monuments). Parks get their names from park labels.
- Tiles are kept on the phone for 30 days. Overpass is still tried if the tiles can't be had.
- Buildings arrive with real heights, but the map keeps them low (up to about the explorer's height) so towers never
  hide the streets; merged building blocks keep their courtyards, lakes keep their islands.
- The map credit reads "OpenFreeMap © OpenMapTiles © OpenStreetMap", as OpenFreeMap asks.
- Landmark ids changed with the new source, so Rune Circles and stops sit in new spots (and anything kept at an old
  circle is effectively retired).

## 23. Kikis on streets, more of them, and visitors (owner)

"Make sure Kikis are placed on streets. I can't wander into someone's back yard. Also make them more densely packed …
more random encounters."

- **On streets:** every wild Kiki moves to the nearest footpath, or the pavement beside the nearest street (within
  50 m), unless it's already in a public park. Driveways and car parks (service roads) don't count, so Kikis aren't
  put on someone's drive. The usual safety rules still apply after the move (not in the road itself, not by schools,
  hospitals, water…). Where nothing's mapped yet, spots stay as they were.
- **Denser:** the spawn grid is 55 m (was 70 m) with a 60% chance (was 45%): about 2 to 2.5 times as many Kikis.
  On a real Denver street that's about 40 within 200 m.
- **Visitors:** every 5 minutes a new Kiki turns up within reach (on the street if there's one close enough, otherwise
  right by you, which at home is your own garden), so there's always something to catch without walking anywhere.

## 24. Title screen: one Settings button, portal light, a fuller foreground (owner)

- Sound, Music and Motion became one **⚙ Settings** button on the title screen; it opens the same Settings as in
  the game (name, sound, music, motion, AR, battery saver, units, account, privacy). Panels, pop-ups and messages now
  sit above every screen, so they work on the title screen too.
- The portal lights the scene from behind: a purple rim light, a slowly turning glow with light rays (painted into one
  image so it stays light on phones), a pool of light on the forest floor (purple near the portal, dark green towards
  you), low drifting mist and rising magic dust.
- The clearing is carpeted with grass (one instanced mesh of simple blades), with wildflowers and glowing mushrooms
  down both sides and big leaves in the bottom corners; Kiki's spot stays clear.

## 25. Premium 3D, part 1: real foliage and film lighting (owner)

"The trees look dumb and fake … add leaves, make it look a bit more real … elevate all elements of the game that
exist in 3D … premium … that extra layer of care and dialing in."

- `web/js/foliage.js`: tapered, knobbly trunks with a painted bark texture (also its bump map), root flares, forked
  branches and twigs, and thousands of individual leaves (a folded leaf shape, one instanced mesh per tree, each leaf
  its own green, lighter on top and outside where the light reaches). Ferns have real fronds (paired leaflets along a
  curving stem); bushes are clusters of leaves with flowers. The title screen's trees, canopy, bushes and ferns use it,
  with the foliage kept off the portal and Kiki. Leaves and grass use matte shading to stay light on phones.
- `web/js/lux.js`: every renderer uses film-style tone mapping (Khronos PBR Neutral: highlights roll off, brand
  colours stay true) and a soft light environment (a sky gradient and studio softboxes, made in code) for gentle
  reflections and sheen on Kikis, stones, circles and props: day light for the map, catches, menus and stages, purple
  "cosmic" light on the title screen. Kiki skin is a touch more satin.

## 26. Premium 3D, part 2: meadow, arena, map (owner)

- `web/js/meadow.js`: a meadow to stand in, used for battles and for catches without the camera: a sky dome with
  soft clouds and a sun (a moon and stars at night), a lit ground with painted grass, a carpet of real grass blades and
  wildflowers (instanced) that leaves the Kikis' spots clear, a ring of real trees and leafy bushes in the distance,
  and fireflies at night. Moods: day, night, and a purple portal clearing for raids.
- Battles stand each side on a carved stone dais (bevelled stone with a bump map, a glowing inlaid ring that breathes)
  instead of flat discs.
- Map: building walls are darker at the foot (a soft contact shadow) and lit by direction, each building a slightly
  different shade, with a lighter rim along the roof edge. Parks and woods get stylised, faceted board-game trees
  (round trees in parks, pines mixed into woods; all instanced), kept clear of roads, buildings, water, and 16 m around
  Rune Circles and supply stops so they never hide them.

## 27. Portal, Kiki arms, beards, bald, house flicker (owner)

- **Portal** (owner: "I hate the hard black edge … a high end swirling portal animation that distorts the Kiki like
  when people get sucked into Jumanji"): the portal is one swirling vortex shader: spiral arms winding inwards and
  turning, pink streaks, a cyan sheen, a deep violet eye with a bright pinpoint, edges fading to nothing (no dark disc,
  no rim). When a stone hits, the Kiki is twisted into it on the graphics card (`vortexify` in art.js): round the line
  from the camera through the portal it swirls like water down a drain (inner parts faster), its edges smear into
  spiral arms, and it shrinks into the eye.
- **Kiki arms** (owner: "when the Kiki waves their arm comes off at the seam"): arms have a rounded shoulder buried in
  the body, set a little further in, so they never open up at the seam.
- **Explorers:** the Wook's totem lost its flag (owner); the totem is the pole with a little Kiki on top. New Beard
  choice (stubble, beard, big beard, mustache, in the hair colour); the Wook has a big beard. New Bald hairstyle.
- **Map houses flickering** (owner: "the houses have a trembling element"): overlapping faces fought on phones. Walls
  are now two non-overlapping bands (wall, then a lighter top edge); building outlines hidden behind their parts and
  floating upper parts are skipped; each footprint is pulled in 15 cm so neighbours never share a wall plane; each
  roof sits at its own height.

## 28. Pro anime 3D explorers

Owner: "the avatars have to look slightly anime … the whole look of them anatomically is crude and cheesy"; chose
"Pro anime 3D characters"; "make them believable", "don't overdo stereotypes", "one size fits all but accurate rave
references", "modern EDM festivals", "customize hair, facial hair, clothes colour, a few clothing options, hats and
sunglasses, anime adventure-hero style".

- **Made with Magnific** (project "KIKI SAFARI explorer"): one anime concept (short neat black hair, white chunky
  trainers, a black hydration pack), three outfits on it: oversized tee and cargo shorts, open windbreaker over a
  white tee with joggers, tank top and wide cargos. Each: a 2x2 view sheet, image-to-3D (Meshy 7.1), auto-rig
  (Meshy), and the Casual Walk clip from Meshy's library. The catalog idles stretched, dabbed or held an arm out, so
  standing still is posed in code (arms relaxed, breathing, a look around now and then) and cross-fades with the walk.
- **Recolouring:** the outfits were generated with key colours (bright green tops, royal blue bottoms). A shader on the
  cel-shaded material repaints those hues, the skin and the short base hair to the chosen colours, keeping every
  painted fold and shadow. The head is found from the skin weights, so the eyes stay as painted.
- **Hairstyles:** six more were generated as hair on a red mannequin head (spiky, long layered, space buns, curly,
  locs, undercut); the build script cuts the red away, greys the texture so the game can tint it, and records the
  mannequin's face so each piece is fitted onto the head bone. Bald hides the base hair and puts a smooth scalp on.
- **Beards** are painted onto the face along the jaw (stubble, beard, mustache); a big beard adds a soft shape under
  the chin. **Hats** (bucket, trucker, beanie, cowboy, flower crown, bandana, ranger) and **shades** (round, hearts,
  shutter, LED) are built in code and sized to the head and hair where they sit; hair inside a hat's crown is hidden.
- Everything gets ink outlines of a fixed screen width (smoothed normals, so they never crack at seams).
- **Files:** web/assets/explorers/ (three bodies ~850 KB each, hair ~160 KB each, meshopt-compressed, 1024 px
  textures). Your own outfit and hairstyle load first; the rest load in the background. They are not pre-cached by
  the service worker (too big for the install); each is kept in its own cache ("kiki-models-1") once loaded. Until
  they load (or if they cannot), the older chibi explorer is drawn. tools/build-explorers.mjs rebuilds them.
- The look picker now offers: festival looks, outfit, top and bottoms colours, skin, hairstyle and colour, facial
  hair, hat and colour, shades and colour. Saved looks from before keep their colours and get the nearest outfit and
  hairstyle; friends on older versions still decode.

## 29. A more mystical supply stop (owner)

Owner: "make the circle supply stop screen look cooler and more mystical". The stop screen is now a night sky (a
slowly turning nebula, twinkling motes) with the stop as a rune medallion: an engraved stone ring of glowing runes
and an inner ring turning the other way, runes shimmering one after another, a gold eight-point star, motes of light
orbiting the floating rune stone, and a soft violet aura. Spinning it rolls a flash of light outwards; it glows a
moment, then rests (dim and slow) while it restocks. All CSS and inline SVG, no images; still for reduced motion.

## 30. Explorers, round 2: basic wear, male and female, real bald, everyday shades (owner)

Owner: "the avatars aren't customizable enough. The bald option looks especially bad. Let's do some basic wear like
short sleeve and long sleeve t-shirt, jeans, shorts, skirt. Male and female, basic sunglass options, nothing too wild."

- **Ten bodies** (Magnific: concept, 4-view sheet, image-to-3D with Tripo 3.1, Meshy auto-rig, Casual Walk): male
  and female, each in a short- or long-sleeve tee with jeans or shorts, plus a skirt for the female body; all with
  white trainers. Tees are generated bright green and bottoms royal blue, so any colour can be painted on (denim
  shades first in the bottoms palette). The festival outfits of round 1 are retired; old saves get the nearest body.
- **Bald is the real head now:** the bodies were generated bald, so every hairstyle is a separate piece and "Bald"
  is simply the head as made. Hairstyles: Bald, Buzz cut (painted over the scalp to a hairline), Short, Spiky,
  Undercut, Bob, Long, Ponytail, Space buns, Curly, Locs. Eyebrows take the hair colour.
- **Sunglasses** are everyday shapes built in code: aviators (thin metal, double bridge), classic (thick
  wayfarer-style), round, a sport wrap, cat-eye; any frame colour (black, tortoise, gold, silver, white, red, navy)
  and lens tint (smoke, brown, green, blue mirror, rose, amber).
- Some auto-rigs give the head bone a turned rest pose; hair, hats and shades sit in an upright frame at the head,
  so they line up on every body.
- Files are ~450 KB per body and ~150 KB per hairstyle. Your own body and hairstyle load first; the look picker loads
  your body's outfits and the hairstyles in the background, and shows "Loading…" if you pick one that is not in yet.
  A friend's look loads when their picture is first drawn.

## 31. Real beards; hair that always covers (owner)

Owner: "the beards suck. Make sure hair and beards cover correctly."

- **3D beards grown from the face:** a beard is now a shell built from the head's own surface (every face triangle
  in the beard's area, pushed out along its normal, thickest in the middle and tapering to nothing at the edge),
  skinned to the same bones, so it sits flush on the jaw of every body and moves with the head. Its outline is cut
  per pixel from a smooth shape (not along the mesh's triangles), it has fine downward strands, and the same shape is
  painted on the skin beneath so the edges blend. Styles: stubble (painted only), short beard, full beard (hangs a
  little below the chin), mustache, goatee. Beards run up the sideburns in front of the ears to meet the hair.
- **Hair covers:** under every hairstyle the scalp is painted in the hair colour, down to the hairline at the ears and
  nape (a little higher at the forehead, which the hair covers itself), so no bald patch shows through gaps between
  locks. Undercut sides read as shaved hair. Locs have no outline (it showed through their gaps).

## 32. Beards, take 3: generated anime beards fitted to each face (owner)

Owner: "you have done a very very shitty and lazy job. This looks ridiculous" (the shell beards of section 31 were
flat shapes that did not match the hand-detailed anime hair). Beards are now made the same way as the hairstyles:
generated anime 3D pieces (short beard, full beard, mustache, goatee) on the red mannequin head. The packer measures,
for every vertex of a beard, how far it stands off the mannequin's skin along a line from a point inside the head at
mouth height (stored as the _OFFSET attribute). In the game the beard is placed like the hair, then each vertex is
moved to that same distance off our own head's skin along its line (a map of the head and neck seen from that point),
so it hugs every jaw (male and female, every body) without sinking into the face or floating off it. Per-style size
is set about the mouth point. Stubble stays painted on.

## 33. The opening plays once (owner)

Owner: "figure out why the opening video sequence restarts and plays again every time I open the app. It should play
through once." Two causes: the title scene always started from the beginning (portal opening, Kiki flying out), and
the auto-update reloaded the page at the first "quiet" moment, which included the title screen, so with a new
version waiting the opening started over a second or two in. Now the opening plays the first time only (remembered
on the phone); after that the title opens with the portal open and Kiki already in the clearing. And an update never
reloads the page while the opening is playing.

## 34. No face or scalp paint; more hairstyles; a baseball cap (owner)

Owner: "no scalp or face paint, it looks dumb"; "not a buzz cut, just no hair at all"; "add a baseball cap";
"short shoulder length with bangs, long hair, long hair with bangs, a ponytail and pigtails for female options".

- Nothing is painted on the face or scalp any more (no colour under hairstyles, no painted buzz cut or stubble, no
  brow tint). Bald is the head with no hair. Stubble and the buzz cut are retired (saved looks become no beard and
  bald).
- Hair pieces are fitted to each head: any part that dips into the skull (where a head is fuller than the mannequin
  it was made on) is pushed back out over it, so the head never pokes through. Hair is two-sided, so a parting shows
  hair. Per-body seats for the styles first made on the male head. The ponytail and space buns were regenerated to
  cover the whole back of the head.
- Each body has its own hair list. Female: shoulder-length with bangs, bob, long, long with bangs, ponytail,
  pigtails, space buns, curly, locs, bald. Male: bald, short, spiky, undercut, long, ponytail, curly, locs.
- Baseball cap: a generated six-panel cap (any colour), seated on the head; hair above its rim is pressed in under
  it, so hair shows below the rim like a real cap, and a ponytail comes out the back.

## 35. AR objects stay put (owner)

Owner: "the AR objects won't stay in place when I turn my camera on, they keep drifting off to the left or right."
Two causes. iPhone: the alignment with north was pulled towards the live compass on every sensor event (60 a
second); the compass wanders (more so with the camera running), so everything placed in the world slid sideways with
it. Android: once the compass-based orientation event was seen, the view ran on it alone, and that one swings with
magnetic noise. Now the view always follows the gyroscope-only orientation (steady), and the compass is used just to
line its zero up with north: an average over about half a second with the phone upright, at start and when the
camera turns on, then held still. A phone with no gyroscope-only orientation falls back to the compass one. A
simulated test (phone held still, compass wandering ±25°) moved objects ~25° (iPhone) and ~32° (Android) before;
now 0°, and still within ~1° of north.

## 36. AR: locked to the camera picture (owner)

Owner: "no drifting at all". A phone's gyroscope always wanders slowly, and the 3D camera's field of view never
exactly matches the lens (it was a fixed 62°; phone lenses in portrait are nearer 69°), so objects crept and slid
against the real scene. vtrack.js now pins the view to the camera picture, the way real AR does: it keeps a small map
of textured patches of the room (anchors, each with the view it was first seen from), finds the ones in view in each
frame around where the gyroscope says they should be (normalised cross-correlation on a small grey copy of the
picture), and turns the view by the median gap, cancelling the gyroscope's drift. It measures the lens from how far
the picture moves per degree of turn and sets the 3D camera's field of view to match (remembered on the phone).
Anchors that leave the screen are kept and found again when they come back. The view also has no smoothing lag any
more (that made objects trail while turning). With nothing to lock to (a blank wall, darkness) the gyroscope alone
carries on. Simulated test (a textured room filmed by a 69° camera; a gyroscope drifting 0.5°/s; the 3D camera
starting at 62°; the phone sweeping ±25° for 30 s): gyroscope only, a placed object ends up 55→194 px off and
growing; with the lock it settles to 2–5 px and stays there. With a realistic gyroscope: 1–4 px.

## 37. Shoes; full-screen AR on iOS 26 (owner)

Owner: "allow people to change between shoes, sneakers, boots, and the colour of them"; "my friend's iPhone's AR mode
isn't full screen. iPhone 17".
- Shoes: sneakers or boots, in any of twelve colours. Sneakers are the bodies' own, repainted (the white upper takes
  the colour; the chunky sole stays white). Boots are a generated lace-up ankle boot: each one is sized to that
  foot's sneaker (which is hidden, outline too), mirrored for the right foot, and carried by the foot bone so it walks
  with the foot; jeans tuck in. Switching to boots from white shoes picks brown.
- Full screen: the camera picture, sky and 3D layers are fixed to the whole physical screen (100lvh), and the 3D
  canvas, touch mapping, labels and the AR lock all use the size measured from the canvas. Before, they used the
  window's inner height, which on iOS 26 Safari stops short of the screen under the floating toolbar, leaving a band.

## 38. Kikis find a real surface and stay on it (owner)

Owner: "the Kikis don't search for a surface in a room well enough. I hate when they float. They need to find the
nearest surface and remain there during the capture process." Phone browsers have no AR depth or plane finding (iOS
Safari has no WebXR), and motion sensors only know turning, so a Kiki placed on an assumed floor slid and floated as
soon as you leaned, stepped or crouched. Now the camera picture itself decides:
- Find a surface first. In live AR (camera and motion sensors), a catch starts with a ring on the floor where you're
  aiming, low in the view. Kiki only pops out where the picture has enough findable little spots (specks, corners,
  pattern: a rug, tiles, wood, a table top; not a blank wall or empty air) and the phone is held steady, shown by the
  ring filling up. Tapping a spot puts Kiki there straight away. After 7 s any floor spot is accepted, after 14 s Kiki
  appears anyway (never stuck). AR off or no sensors: as before.
- Stay glued to it. When Kiki appears, the most findable spots around its feet are remembered (vtrack.js). Every new
  camera frame they're found again; a match only counts if it's clearly the one place that patch could be (no
  look-alike nearby: stripes, repeats) and it agrees with the others. From where they are against where turning alone
  would have put them, a small local fit gives the feet's spot, measured afresh from the first sighting each frame,
  so small errors never add up. Kiki's feet are put there. During the capture (stone, portal, wobbles on the ground)
  the whole scene moves with the surface. Patches that leave the screen are found again when they come back, across
  most of the picture if you walked meanwhile; if the spot is lost for 2 s while in view, Kiki's current spot is
  remembered afresh. Tap-to-move remembers the new spot.
- The picture is shrunk smoothly (high-quality filtering) so fine detail like wood grain doesn't shimmer, and only new
  camera frames are looked at (the camera gives ~30 a second, the screen 60).
Simulated test (a textured room; the phone held at a floor spot ~2 m away, swaying ±12°, leaning ±10 cm, crouching
12 cm and stepping 15 cm closer): gyroscope only, Kiki's feet were 18–21 px off the spot on average (worst 47 px);
with the surface lock 1 px on average (worst 2 px on a rug, 3 px carpet, 5 px wood), shake under 0.5 px per frame. A
blank floor gets no lock and behaves as before. Walking half a metre while Kiki is out of view and coming back:
found again on a rug; on harder floors Kiki is glued to the spot its feet are on when it comes back.

## 39. Speed and polish pass (owner)

Owner: "any optimisations possible? … any suggestions or things you can find in deep audits to improve overall
experiences, especially visually … any overall improvements welcomed". A measured audit of every screen (draw calls,
triangles, script time, memory, downloads) and a screenshot tour at phone size found:
- The map kept drawing at full cost behind every full-screen page (Kikis, a Kiki, the bag, shop, eggs, tasks, the
  look picker, the caught screen) and behind battles' own 3D stage. Now the game checks whether an opaque page covers
  the whole screen and draws nothing underneath. Kikis list: ~110 draws / 470k triangles a frame → 0; battle 171 /
  513k → 70 / 73k; look picker 135 / 533k → 29 / 82k; caught screen 22 / 101k → 6 / 13k.
- Every start downloaded and unpacked every outfit and hairstyle (several MB) two seconds in, for the look picker most
  visits never open. Now only your own explorer loads at start (Ranger Rue a few seconds later for returning
  explorers); the rest loads when Change look opens (it already showed a loading badge). First download 3.25 MB →
  2.4 MB (3D models 1.55 MB → 0.7 MB), and no background unpacking while you play.
- Each catch left its shapes on the graphics chip; they're freed when the catch ends.
- The title screen drew ~540 separate pieces a frame (each fern, flower, mushroom and grass tuft). The frame never
  moves, so it's baked into one mesh per material after it's placed: 540 → 203 draws, looking the same.
- Map: buildings now cast soft shadows, which makes the map read as 3D (it looked flat, especially by day). Like a
  board game's drop shadows they always fall towards the lower right of the screen, so they're seen whichever way the
  map turns. They're kept light: one convex shape per building slid on the graphics chip, never longer than the
  building is wide, darkened once where they overlap (stencil): ~30k triangles on a dense map (a first version with
  extruded sides cost 214k and was cut).
- The map credits were a three-line white box over the top-right corner, often on top of a Kiki: now one slim line.
- Full-screen pages get a softer background (a glow at the top, a faint dot pattern, a hint of purple at the bottom).

## 40. Lighter Kikis on the map (owner)

Owner picked "Kikis on the map: simpler versions in the distance". The distant Kikis are the rustling leaves (any Kiki
over 70 m away), often thirty or more at once, and they were the map's biggest cost: eight separate draws each (seven
leaves and a shadow), with new shapes and materials made for every one (and never freed as you walked on).
- A rustle's leaves only ever move together, so they're one shape, shared with its material and shadow by every
  rustle: two draws each instead of eight (a busy Denver street: 280 → 70 draws).
- Rustles over 150 m from you use a simpler tuft (a quarter of the triangles); up close they're as before.
- A Rune Circle's seven standing stones are one shape (17 → 11 draws per circle).
- Shapes every map thing of a kind uses (the rarity ring, the tap target) are made once; a thing's own shapes are
  freed from the graphics chip when it's left behind (shared ones stay).
Settled busy map, measured: 155 draws / 534k triangles a frame before today's passes, 107 / 528k now (including the
new building shadows); graphics buffers in use 2,580 → 1,260. Kikis within 70 m stay full 3D: they're the stars.

## 41. Kiki looks refined (owner)

Owner: "Fairy Cairn Fern looks like shit, so do the mushrooms, make them better … no stickers on their stomachs … the
owl Kiki looks dumb too, switch it to something else … Fuzz Kiki, find something else … you can be witchy and
celestial … Puddle Kiki can be Wooder Kiki … do a massive refinement to the Kiki variants, dial in their looks so they
don't appear dumb or half-assed". Every Kiki was rendered and reviewed; crowns that looked crude were rebuilt:
- No tummy markings on any Kiki (they read as stickers). The data stays (look.belly) but isn't drawn.
- Crowns can now have glowing parts (drawn unlit, so they shine): fairy lights, glowing mushroom spots, star bells,
  the wizard's stars, aurora ribbons, the stone circle's rune.
- Fairy Cairn Fern: a cairn of four smooth river stones (moss on the lower ones), a fern unfurling behind, open fronds
  either side, and a tiny fairy (a glowing light with wings) above. Its Fluff is Fairy Cairn Fluff.
- Shroom Kiki and Fungi Phil: proper toadstools: a domed cap with a curled rim, fine gills under it, raised spots, a
  stem that swells at the foot with a skirt, and little ones beside it. Fungi Phil's cap glows at the rim, its spots
  glow, and it has two little ones.
- The owl family is now witchy and celestial: Hoot Kiki is Hex Kiki (a floppy witch's hat, crinkled, with a band, a
  gold crescent charm and a star at the drooping tip); Lucid Wizard has a tall midnight wizard's hat with a gold band,
  gold stars and a crescent on it, and a ring of little stars circling it.
- The Fuzz family is celestial: Fuzz Kiki is Comet Kiki (a plump cushion star with three tails streaming back, gold to
  pink to lilac); Clown Town Coco wears a celestial jester's hat (midnight and violet halves, two floppy points with
  gold star bells, a gold band with Comet Kiki's star at the front).
- Puddle Kiki is Wooder Kiki (owner's spelling). The water family's waves are rebuilt as real curling waves seen
  side-on (deep blue to turquoise, white foam on the crest, spray): one for Wooder Kiki, two back to back for Swimmin'
  Hole Sid, three for Tide Kiki and Tidecaller (whose spray glows).
- Also rebuilt: Acorn Kiki (a scaly acorn cap like a beret, curly stem, oak leaves); Hilltop Hank (a little oak with
  a soft, lumpy canopy, branches and hanging acorns); Lily and Lotus Kiki (a veined lily pad worn like a beret and a
  cupped, layered flower; the lotus round a seed pod); Marshmallow Kiki (a big toasted marshmallow with a drip,
  skewered on a twig); Pebble Kiki (smooth pebbles); Stone Circle Steve (a little stone circle with a lintel on a
  grassy mound, a rune glowing in the middle); Dusk Kiki and Portal Wookie (the moon now sits on the head instead of
  floating; Portal Wookie's has a swirling portal behind it and orbiting stars); Sunburst Kiki (a sun medallion with
  wavy flame rays); Aurora Kiki (glowing ribbons of northern lights); Summit Kiki (craggy peaks with ridges, a jagged
  snowline and a flag); Hemlock Holly's frosted tips are a soft frost green instead of metallic white.
- Stars everywhere are soft cushion shapes. The heaviest Kiki is now ~33k triangles (was ~24k), still light enough
  for the map and catches.
