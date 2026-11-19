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
- [x] 2. **Your explorer on the map.** An animated avatar that walks when you walk, with a few starter outfits.
- [x] 3. **Nearby panel.** Kikis around you, with silhouettes for ones you haven't caught. Rustling leaves on
      the map where something is hiding.
- [x] 4. **Encounters with stakes.** Kikis can break out of the stone and run away. A coloured catch ring
      (green, yellow, red) shows how hard each one is. Every Kiki shows its Plush Power*.
- [x] 5. **Stone tiers and treats.** Rune Stone, Moon Stone*, Star Stone* with better catch rates. Honey Leaf*
      makes a catch easier; Sun Seed* doubles the reward.
- [x] 6. **Every Kiki is its own.** Plush Power, size (XS to XL), hidden stats, catch date and place. Nickname,
      favourite, sort and filter.
- [x] 7. **Growth.** Sprouts (from everything) plus that family's Fluff* (from catching it) power a Kiki up.
      Fluff evolves it. Send extras home for more Fluff. The three commons each evolve once for now: Meadow → Grand
      Meadow*, Pine → Elder Pine*, Sprout → Bloom*. The full roster is Phase 2.
- [x] 8. **Limits.** A bag size and a collection size, so choices matter.
- [x] 9. **Better supply stops.** A mix of items (stones and treats; eggs join in Phase 2); the stop changes colour once used.
      First catch and first stop of the day, with a 7-day streak bonus.
- [x] 10. **Explorer level and XP** from catches, stops, new Log entries and evolutions. Level-up rewards;
      better stones unlock by level.
- [x] 11. **First-time tutorial.** Pick 1 of 3 starter Kikis, a guided first catch, then the first stop.

## Phase 2: a world worth exploring

**Done in the web version.** All 48 Kikis are Kikis (Kiki's body and spiral eyes) in new colours and crowns, since
the owner hadn't picked between "Kiki variants only" and "Kiki plus friends".

- [x] 12. **A real roster.** 48 Kikis in evolution families (some three stages), all in Kiki's plush style, including
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
- [x] 22. **Health and healing items***: Stitch Kits (+60 HP), Super Stitch Kits (+200 HP) and Revive Pillows.
- [x] 23. **Rune Circle battles** against today's wild Keepers (1 to 3). Win and one of your Kikis keeps the circle.
      The Spiral Rite stays as a once-a-day attunement for Sprouts.
- [x] 24. **Three factions***: Dusk Weavers, Tide Keepers and Bloom Wardens, chosen at level 5.
- [x] 25. **Portal Surge raids.** One-, three- and five-star bosses (legendaries at five stars), teams of up to 6, one
      free raid a day and Portal Keys after that, then a catch with Raid Stones.

## Phase 4: online (needs a server and accounts)

- [ ] 26. **Accounts and cloud saves.** Play on any device, never lose progress.
- [ ] 27. **Faction-held Rune Circles.** Leave a Kiki to defend; other players battle to take it; earn coins*
      while it holds.
- [ ] 28. **Co-op raids** with other players at the same circle.
- [ ] 29. **Friends.** Friend codes, gifts from stops, friendship levels.
- [ ] 30. **In-person trading** (within 100 m).
- [ ] 31. **Player-vs-player battles** in leagues.
- [ ] 32. **Push notifications** (iPhone Home Screen app, iOS 16.4+): surges, eggs hatching, defender knocked out.
- [ ] 33. **Anti-cheat basics.** Server-side checks for GPS spoofing and teleporting.

## Phase 5: polish

- [ ] 34. **Original music and sound.** Map theme, encounter theme, catch fanfare.
- [ ] 35. **Map look.** Day and night colours, green parks, blue water, 3D Rune Circle towers and stop markers.
- [ ] 36. **Battery saver**, smoother GPS, offline grace period.
- [ ] 37. **Settings.** Units, sound, AR on/off, privacy.
- [ ] 38. **Shop** with in-game coins for bag and collection space and incubators. No real money for now.

## Decisions for the owner

- ~~**Home screen:** map first, with the camera in encounters, or keep camera first.~~ Map first (owner: "lets tackle phase 1"). The camera view stays one tap away (the AR button).
- **Server for Phase 4:** Supabase recommended (free tier, works with Netlify).
- **Names:** Plush Power, Fluff, Moon/Star Stone, Honey Leaf, Sun Seed, Ranger Rue (the guide), Grand Meadow / Elder Pine /
  Bloom Kiki, the hidden stats Cuddle / Bounce / Zest, elements, factions. Approve or rename.
- **New creatures:** Kiki variants only, or Kiki plus friends? Built as Kiki variants for now; say if you want friends too.
