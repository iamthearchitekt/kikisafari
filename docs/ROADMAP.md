# KIKI SAFARI roadmap: the Pokémon GO play loop

Goal: the same play loop and depth as Pokémon GO, built with KIKI SAFARI's own creatures, names and look.
Names marked * are placeholders for the owner to approve or rename.

**Already in the game:** real-world spawns from GPS; Rune Circles and supply stops on real landmarks
(OpenStreetMap); camera catch with the Rune Stone and portal; Nice/Great/Excellent throws and spin bonus;
street map with you on it; Safari Log; Sprouts; Portal Surges; Spiral Rite; speed lock; Home Screen app.

## Phase 1: the core loop (no server needed)

**Done in the web version** (`web/`, the test build). The Unity project hasn't been brought up to Phase 1 yet. Numbers
(XP per level, unlock levels, costs, odds) are in `web/js/rules.js` and covered by `web/test/core.test.mjs`.

- [x] 1. **Map is the home screen.** Walk around a stylised map, Kikis pop up on it, tap one to start an
      encounter. The camera moves into encounters, with an AR on/off switch. (Reverses the earlier
      camera-first call; owner decision.)
- [x] 2. **Your explorer on the map.** An animated festival-goer that walks when you walk, with hair, hats, shades,
      patterned clothes, bags and extras (kandi, LED gloves, a totem) in any colour.
- [x] 3. **Nearby panel.** Kikis around you, with silhouettes for ones you haven't caught. Rustling leaves on
      the map where something is hiding.
- [x] 4. **Encounters with stakes.** Kikis can break out of the stone and run away. A coloured dot on the
      name card (green, yellow, red) shows how hard each one is. (There was an aiming circle; the owner had it removed.) Every Kiki shows its Power.
- [x] 5. **Stone tiers and treats.** Rune Stone, Moon Stone*, Star Stone* with better catch rates. Honey Leaf*
      makes a catch easier; Sun Seed* doubles the reward.
- [x] 6. **Every Kiki is its own.** Power, size (XS to XL), hidden stats, catch date and place. Nickname,
      favourite, sort and filter.
- [x] 7. **Growth.** Sprouts (from everything) plus that family's Fluff* (from catching it) power a Kiki up.
      Fluff evolves it. Send extras home for more Fluff. The three commons each evolve once for now: Meadow → High
      Meadow Mae, Pine → Hemlock Holly, Sprout → Sanctuary Sadie. The full roster is Phase 2.
- [x] 8. **Limits.** A bag size and a collection size, so choices matter.
- [x] 9. **Better supply stops.** A mix of items (stones and treats; eggs join in Phase 2); the stop changes colour once used.
      First catch and first stop of the day, with a 7-day streak bonus.
- [x] 10. **Explorer level and XP** from catches, stops, new Log entries and evolutions. Level-up rewards;
      better stones unlock by level.
- [x] 11. **First-time tutorial.** Pick 1 of 3 starter Kikis, a guided first catch, then the first stop.

## Phase 2: a world worth exploring

**Done in the web version.** All 48 Kikis are Kikis (Kiki's body and spiral eyes) in new colours and crowns, since
the owner hadn't picked between "Kiki variants only" and "Kiki plus friends".

- [x] 12. **A real roster.** 48 Kikis in evolution families (some three stages), all in Kiki's style (little creatures, not stuffed toys), including
      six legendaries that only come through raids and story rewards. Listed in `web/js/species.js`.
- [x] 13. **Elements***: Leaf, Water, Ember, Spark, Stone, Moon. Each is strong against two and weak to two.
- [x] 14. **Live weather boosts** from local weather (Open-Meteo: free, no key). Rain boosts Water Kikis, etc.
- [x] 15. **Eggs.** From stops; hatch by walking 2, 5 or 10 km. (Web limit: distance only counts while the
      app is open.)
- [x] 16. **Buddy Kiki** walks beside you on the map and earns Fluff as you walk.
- [x] 17. **Sparkle Kikis.** Rare alternate colours, about 1 in 450.
- [x] 18. **Research.** Three daily tasks from stops, a 7-day stamp card, and a story quest line with Kiki lore.
- [x] 19. **Medals** for milestones: km walked, catches, elements, stops.
- [x] 20. **Timed events.** Boosted spawns, special Kikis, bonus days. Portal Surges become event hooks.

## Phase 3: battles

**Done in the web version.** Battles open at explorer level 5. Raid difficulty was tuned with a simulated player in
`web/test/core.test.mjs`. Rune Circles and raids are single-player until Phase 4 adds a server.

- [x] 21. **Battle system.** Each Kiki has a quick move and a charged move. Tap to attack, swipe to dodge,
      fill a meter for the charged move.
- [x] 22. **Health and healing items***: Herb Salves (+60 HP), Super Salves (+200 HP) and Revival Dew.
- [x] 23. **Rune Circle battles** against today's wild Keepers (1 to 3). Win and one of your Kikis keeps the circle.
      The Spiral Rite stays as a once-a-day attunement for Sprouts.
- [x] 24. **Three factions***: Dusk Weavers, Tide Keepers and Bloom Wardens, chosen at level 5.
- [x] 25. **Portal Surge raids.** One-, three- and five-star bosses (legendaries at five stars), teams of up to 6, one
      free raid a day and Portal Keys after that, then a catch with Raid Stones.

## Phase 4: online (needs a server and accounts)

**Done in the web version.** The server is Supabase (owner's account): the schema and every server function are in
`supabase/schema.sql`. Push notifications run as Netlify Functions next to the game (`netlify/functions`). Everything
online is optional: offline, the game carries on and catches up when the signal is back.

- [x] 26. **Accounts and cloud saves.** An anonymous account (no email or real name), made the first time you play.
      Progress backs up as you play. Settings ▸ Online account gives a one-time moving code for a new phone.
- [x] 27. **Faction-held Rune Circles.** Up to 6 keepers of one faction per circle; other factions battle them to take
      it. Keepers earn coins (1 per 10 minutes, up to 50 a day), paid when they come home or are beaten.
- [x] 28. **Co-op raids.** Everyone at the same circle in the same Portal Surge fights one boss together; the boss gets
      more HP for each player, and the damage everyone does adds up live.
- [x] 29. **Friends.** Friend codes, gifts (from supply stops, one a day per friend), friendship levels from days as
      friends (Friends, Good, Great, Best).
- [x] 30. **In-person trading** within 100 m, with a 4-digit trade code. Costs 100 Sprouts.
- [x] 31. **Leagues.** Sprout (Power up to 500), Bloom (up to 1500) and Open. You battle other players' saved teams (the
      game plays them, so nobody has to be online at the same time) and climb a ladder.
- [x] 32. **Push notifications** (on iPhone, from the Home Screen app, iOS 16.4+): gifts, friend requests and Portal
      Surge reminders. Egg hatching can't be pushed: walking only counts while the game is open.
- [x] 33. **Anti-cheat basics.** The server rejects moves faster than 300 km/h, checks Kikis it's sent (species, level,
      stats), rate-limits every player, and every action goes through a server function that checks who you are.

## Phase 5: polish

**Done in the web version.**

- [x] 34. **Original music and sound.** Chiptune themes made in the game (no audio files) for the title, map, catches,
      battles and raids, on top of the existing sound effects and catch fanfare.
- [x] 35. **Map look.** Day and night colours, green parks, blue water, 3D Rune Circle towers and stop markers, plus a
      soft horizon, cloud shadows by day and fireflies at night.
- [x] 36. **Battery saver** (a lighter picture and 30 frames a second on the map), smoother GPS (small wobbles are
      eased, real steps aren't), and an offline grace period (map areas stay on the phone for two weeks; online
      features catch up when the signal returns).
- [x] 37. **Settings.** Sound, music, motion, AR, battery saver, km or miles, privacy page.
- [x] 38. **Shop** with in-game coins (from keeping circles and medals) for items, Cozy Nests, a bigger bag and more Kiki
      room. No real money.

## Decisions for the owner

- ~~**Home screen:** map first, with the camera in encounters, or keep camera first.~~ Map first (owner: "lets tackle phase 1"). The camera view stays one tap away (the AR button).
- ~~**Server for Phase 4:** Supabase recommended.~~ Supabase (owner: "supa base is fine i have an account").
- **Names:** Fluff, Moon/Star Stone, Honey Leaf, Sun Seed, Ranger Rue (the guide), the hidden stats Cuddle / Bounce / Zest, elements, factions. Approve or rename.
- **New creatures:** Kiki variants only, or Kiki plus friends? Built as Kiki variants for now; say if you want friends too.
