# The rally point, 2026-11-24 and 2026-11-25

_Two messages: the first after reading how to test the banner in a Skirmish, the second after playing it. Each
point's status says what was done; the work is on the `skirmish-banner` branch._

### F303 — the troops ignore the banner

> Wow, the rally point looks nice, and it is easy to move. However, the troops are not following it. They seem to be
> ignoring the rally point

**Built.** The Skirmish screen showed the banner but never handed it to the battle, so the army always marched on the
enemy Nexus. A battle's plan now carries it, and the round sends the side there; with none, every battle plays as
before.

### F304 — key locations a map defines

> I believe the easiest and most flexible way is to let the map define a few key locations, the first of which is on
> the enemy nexus, but there could be others around to flank or collect resources.

**Open.** Not this round: the rally point goes on any tile for now. Worth taking up when maps grow resources to
collect and flanks worth naming.

### F305 — a building's own rally point

> Individual buildings can have their own rally point, that by default is the army rally point, but individual
> buildings could send their spawned troops to a different location.

**Open.** The design already has it as the secondary banner ([`movement.md`](../../system-design/movement.md),
banners); it waits for its own step.

### F306 — units follow the Commander

> I would like to try a variation where the units move towards the commander, so when the commander dies and is back
> to the base, the units naturally come back as well. This could be configured on the commander rally point:
> aggressive, deffensive, and an option to "units follow commander" or "units rally to destination".

**Open.** A third value for the Rally point Experiment (F307) is the natural place for it, once the simpler rally
point has been played.

### F307 — no aggressive or defensive

> Yes, the banner works really well. So we can simplify it. Don't think we need any options to do aggressive or
> defensive.

> Perhaps not in a rock, but in a building is okay. It's just the direction where it goes.

**Built**, with an open question. The rally point asks no stance. What the troops do once there was not said, so it
is the **Rally point** Experiment: hold (the default: they gather and stay, so where it stands is the whole order;
on the enemy Nexus that is an attack) or push on (they gather, then march on the enemy Nexus).

### F308 — Start goes straight to the rally point

> And I don't think there needs to be options to select the banner or replace the banner. I think as soon as the user
> clicks on Start Battle, the cursor should go straight into the banner and the user can move the banner around and
> press Enter.

> So basically, the flow is build phase. When ready, press Start. That immediately brings the cursor to the banner.

> And when you accept, then the battle begins.

**Scheduled.**

### F309 — the words on the map, beside the rally point

> After pressing Enter, there should be a little text next to the banner. No need to be on the left side menu. It can
> be right on the banner that just says Rally and Start.

> And that text next to the banner will say place rally point.

**Scheduled.** Read as: while it is being moved, a short label beside it says "Place rally point" with its key, and
nothing opens in the side panel.

### F310 — a movement that draws the eye there

> It will also be nice to have a movement effect similar to when building that draws your eyes towards the place where
> the banner is.

**Scheduled.**

### F311 — call it the rally point

> The rally point, which I think is the best name for this, is a rally point rather than banner. We call it banner,
> but the banner is basically the flag that stays there, but it's a rally point.

**Built** in the glossary: the **rally point** is where the troops head; the **banner** is the flag drawn there.

### F312 — one arrow, from the Nexus

> The rally point arrows that go from the nexus to the rally point look good. The double arrow, having one from the
> nexus, another one from the commander, does not look that good. So a single arrow would be better.

**Scheduled.**

### F313 — arrows during the battle

> During the battle, there can be an effect, the same arrows that move all the way to the banner, but maybe every 5
> seconds, there will be like 2 or 3 arrows that go, kind of that remind the player that the banner is in there.

**Scheduled.** The pace and the count are tuned values (`rallyArrowsEveryMs`, `rallyArrowsCount`).

### F314 — the enemy's rally point at the start

> And when the battle begins, I would like to see the enemy banner as well, with the same, a single effect that shows
> a couple of arrows that go to the banner, and at least you know what it is, and then you will see the units moving
> over there. It will be enough.

**Scheduled.**

### F315 — straight back to the Build Phase

> When the battle ends, it will be nice that it goes directly to build mode.

> Whenever it's over, it just goes into build mode again, which means you immediately see the units retreating and all
> of that.

**Scheduled.**

### F316 — replay the last battle from the menu

> But when you're in build mode, you should be able to replay the previous battle if you want to. I'm not so sure
> where to put that menu to replay. It would probably be in the menu, in the general menu, replay previous battle.
> But generally, you don't need to replay it.

**Scheduled.**

### F317 — on a building

> Another thing, the banner is, it doesn't seem like I can place it on a building, but it should be able to place on
> top of a building. Perhaps not in a rock, but in a building is okay.

**Scheduled.** It could already be placed on any building, by keys or mouse, but nothing showed it there: a building's
glyphs are drawn over the banner, so it seemed refused. It needs to be seen on a building.

### F318 — it was fun

> So yeah, this will be great feedback to implement for now. It was actually fun to play.
