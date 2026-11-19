// The first-time tutorial (Phase 1): Ranger Rue says hello, you make your explorer, three starter Kikis appear around
// you on the map, you catch one (it can't escape), and Rue points you at supply stops. Saves made before Phase 1 skip
// the starter and just set up an explorer.
import * as C from './core.js';
import { guide, outfitPicker } from './ui.js';

const STARTERS = ['meadow', 'pine', 'sprout'];

/** Three starters, 18 m from you, spread around you and clear of any Rune Circle right next to you. */
export function spawnStarters(app) {
  const me = app.loc.fix, circle = app.world.things.find(t => t.kind === 'circle' && t.distance < 40);
  const h = circle ? circle.bearing + 90 : app.world.orient.facing - 60;
  app.extraThings = STARTERS.map((id, i) => {
    const b = (h + i * (circle ? 90 : 60)) * Math.PI / 180, v = C.variant(id);
    return { kind: 'kiki', id: 'starter:' + id, name: v.name, variant: v, where: C.fromLocal(me, Math.sin(b) * 18, Math.cos(b) * 18), starter: true };
  });
  app.world.nextPlan = 0;
}

const waitForFix = app => new Promise(res => { const t = setInterval(() => { if (app.loc.fix) { clearInterval(t); res(); } }, 300); });

export async function runTutorial(app) {
  const p = app.progress;
  if (app.tutorialRunning || p.tutorial === 'done') return;
  app.tutorialRunning = true;
  try {
    if (p.tutorial === 'explorer') {
      await guide("Welcome back! Kiki Safari just got bigger: every Kiki you catch is now one of a kind, with its own power and size. Let's set up your explorer first.", [['ok', 'OK']]);
      await new Promise(res => outfitPicker(app, { first: true, onDone: res }));
      p.tutorial = 'done'; app.save();
      await guide('All set! Your Kikis, the Safari Log and your bag are in the menu: the big stone at the bottom. Have fun out there!', [['ok', 'Thanks!']]);
      return;
    }
    if (p.tutorial === 'start') {
      await guide("Welcome to <b>KIKI SAFARI</b>! I'm Ranger Rue. Kikis are hiding all over the real world: in parks, by the water, right down your street.", [['ok', 'Next']]);
      await guide("Walk around and they'll pop up on your map. Tap one to catch it with a Rune Stone. But first, tell me about you!", [['ok', "Let's go"]]);
      await new Promise(res => outfitPicker(app, { first: true, onDone: res }));
      p.tutorial = 'starter'; app.save();
    }
    if (p.tutorial === 'starter') {
      await waitForFix(app);
      spawnStarters(app);
      await guide(`Nice to meet you, ${p.explorer.name || 'explorer'}! Look, three young Kikis came to say hi. Tap the one you like best to catch it.`, [['ok', 'OK']]);
      await new Promise(res => { app.onStarterCaught = res; });
      app.onStarterCaught = null; app.extraThings = []; app.world.nextPlan = 0;
      p.tutorial = 'stop'; app.save();
      await guide('You caught your first Kiki! Every Kiki is one of a kind. Open the menu (the big stone) to see its power and size.', [['ok', 'Next']]);
    }
    if (p.tutorial === 'stop') {
      await guide("You'll need more stones. Pink <b>supply stops</b> sit at real places near you. Get inside the white circle around you, tap a stop, then swipe the stone to spin it.", [['ok', 'Got it']]);
      p.tutorial = 'done'; app.save();
    }
  } finally { app.tutorialRunning = false; }
}
