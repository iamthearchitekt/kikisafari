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

- [ ] 12. **A real roster.** Grow from 6 Kiki variants to 40 to 60 creatures in evolution families, all in
      Kiki's plush style. The biggest art job.
- [ ] 13. **Elements*** (e.g. Leaf, Water, Moon, Spark, Stone) with a strength chart. Habitat spawns already work.
- [ ] 14. **Live weather boosts** from local weather (Open-Meteo: free, no key). Rain boosts Water Kikis, etc.
- [ ] 15. **Eggs.** From stops; hatch by walking 2, 5 or 10 km. (Web limit: distance only counts while the
      app is open.)
- [ ] 16. **Buddy Kiki** walks beside you on the map and earns Fluff as you walk.
- [ ] 17. **Sparkle Kikis.** Rare alternate colours, about 1 in 450.
- [ ] 18. **Research.** Three daily tasks from stops, a 7-day stamp card, and a story quest line with Kiki lore.
- [ ] 19. **Medals** for milestones: km walked, catches, elements, stops.
- [ ] 20. **Timed events.** Boosted spawns, special Kikis, bonus days. Portal Surges become event hooks.

## Phase 3: battles

- [ ] 21. **Battle system.** Each Kiki has a quick move and a charged move. Tap to attack, swipe to dodge,
      fill a meter for the charged move.
- [ ] 22. **Health and healing items*** to patch up and revive Kikis after battles.
- [ ] 23. **Rune Circle battles** against the Keeper (alongside or replacing Spiral Rite).
- [ ] 24. **Three factions*** to choose at level 5.
- [ ] 25. **Portal Surge raids.** A boss Kiki holds a Rune Circle for a time window; beat it for a chance to catch it.

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
- **New creatures:** Kiki variants only, or Kiki plus friends (other creatures in the same plush style)?
