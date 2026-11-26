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

**Built.** Start Battle Round puts the cursor straight on the rally point and the camera on it; the arrows and the
mouse move it; Enter (or Space, `s`, the Start row, a second click) places it and starts the round at once; Esc goes
back with nothing changed. No panel opens. From the menu to a running battle with the rally point moved ten tiles
takes 12 keys, from 14.
### F309 — the words on the map, beside the rally point

> After pressing Enter, there should be a little text next to the banner. No need to be on the left side menu. It can
> be right on the banner that just says Rally and Start.

> And that text next to the banner will say place rally point.

**Built.** While it is being moved, `[enter] Place rally point` stands beside it on the map, to its right, or left at
the view's edge, never over the flag; a refusal says why in the same place.
### F310 — a movement that draws the eye there

> It will also be nice to have a movement effect similar to when building that draws your eyes towards the place where
> the banner is.

**Built.** As it becomes the cursor, rings close in on it for about half a second; reduced motion skips them.
### F311 — call it the rally point

> The rally point, which I think is the best name for this, is a rally point rather than banner. We call it banner,
> but the banner is basically the flag that stays there, but it's a rally point.

**Built** in the glossary: the **rally point** is where the troops head; the **banner** is the flag drawn there.

### F312 — one arrow, from the Nexus

> The rally point arrows that go from the nexus to the rally point look good. The double arrow, having one from the
> nexus, another one from the commander, does not look that good. So a single arrow would be better.

**Built.** One line, from the Nexus; the Commander's is gone. With the Rally point Experiment on push on, a fainter
line runs on to the enemy.
### F313 — arrows during the battle

> During the battle, there can be an effect, the same arrows that move all the way to the banner, but maybe every 5
> seconds, there will be like 2 or 3 arrows that go, kind of that remind the player that the banner is in there.

**Built.** Every five seconds, three arrows run from your Nexus along the troops' way to the rally point, its flag
showing while they run; they stop once the troops are released from it. The pace and the count are tuned values
(`rallyArrowsEveryMs`, `rallyArrowsCount`).
### F314 — the enemy's rally point at the start

> And when the battle begins, I would like to see the enemy banner as well, with the same, a single effect that shows
> a couple of arrows that go to the banner, and at least you know what it is, and then you will see the units moving
> over there. It will be enough.

**Built.** As the battle begins, two arrows run once from the enemy's Nexus to its rally point, and its flag shows
for four seconds. The scripts plant none yet, so it is their default: your Nexus, or their own holding ground.
### F315 — straight back to the Build Phase

> When the battle ends, it will be nice that it goes directly to build mode.

> Whenever it's over, it just goes into build mode again, which means you immediately see the units retreating and all
> of that.

**Built.** The Next round Experiment gains `straight`, its new default: when a fight stops and the battle goes on,
the next Build Phase opens at once, its opening showing the survivors regroup. A battle won or lost still shows its
result.
### F316 — replay the last battle from the menu

> But when you're in build mode, you should be able to replay the previous battle if you want to. I'm not so sure
> where to put that menu to replay. It would probably be in the menu, in the general menu, replay previous battle.
> But generally, you don't need to replay it.

**Built.** The game menu's `[b] Replay last battle` plays the last Battle Round again; its result says it is a
replay, and Enter comes back to the Build Phase as it stood. Dimmed, saying why, until a round has ended.
### F317 — on a building

> Another thing, the banner is, it doesn't seem like I can place it on a building, but it should be able to place on
> top of a building. Perhaps not in a rock, but in a building is okay.

**Built.** It could already be placed on any building, by keys or mouse, but a building's glyphs are drawn over the
flag, so nothing showed it. Now the whole building takes the rally point's look, its glyphs kept, and the words name
it: "Place rally point on your Barracks".
### F318 — it was fun

> So yeah, this will be great feedback to implement for now. It was actually fun to play.

Noted. The Battle banner Experiment that the rally point sits behind (off: the old start popup) is answered "on" by
this round; it stays until the pull request that removes the old popup, since the Story missions read it too.

## The second playtest, 2026-11-25

### F319 — nothing on the map but the line

> However, it seems like the banner text is getting in the way of the lines that show where the troops are going. So
> I think to make it better, we should not have the text that says enter to place the banner. We should use the bottom
> of the screen that is already reserved for showing what to do with these actions.

> That contextual part could also have the same icon for the flag or the ASCII that represents the flag, and then says
> rally point, and simply say enter, place the rally point, and begin the battle. That's really all is needed.

> The text that says where the banner is being placed also should be at the bottom, so there's basically nothing in
> the middle that is covering the line, because that makes it a little more confusing.

**Built.** Nothing is written on the map: the bottom line opens with the flag and says "Rally point on open ground.
[enter] place it and begin the battle."; a refusal says why on the same line. For a long spot name the fixed words
shorten first.

### F320 — the arrows once, for both sides

> Then during the battle, the constant arrows that go out every 5 seconds actually is a little bit too noisy. So let's
> do that only once. You place it, the units are moving. 5 seconds later, you can see those lines. And when they do,
> you don't need to show the banner on the building. There's those lines going over to the destination and only
> showing the banner at the very end when the arrows arrive, and only once. And do the same for the enemy as well. So
> you can see both rally points going at the beginning of the battle.

**Built.** Once, five seconds in (`rallyArrowsAtMs`), both sides together, each in its colour; each flag shows for a
second and a half as its arrows arrive, then nothing more; nothing is drawn on a building or a unit.

### F321 — the line goes straight through buildings

> The banner line goes around your own buildings, which is interesting. It seems that the units coming out of the
> Nexus need to work around. However, it's not true. The units usually come out of the barracks or of the other
> things. So for the line that connects the Nexus to the destination, I will ignore your own buildings. Just skip
> your buildings, go straight. Only go around obstacles and enemy buildings. No, just obstacles. Like the line just
> needs to go skip buildings, because usually what's going to happen is when the units get there, they're not going to
> work around. They're going to destroy the building.

**Built.** In the Build Phase and in the battle, the line goes round rock only, through every building, either
side's; whether a spot can be reached is read on the terrain alone too.

### F322 — the rally point starts in front of the base

> The other thing, instead of by default having the rally at the enemy nexus, I think it would be better to have it
> 10% of the distance or 30% of the distance. So basically in front of your base, because I notice for now that's how
> I am playing. I always start by leaving the units in front of the base so I can form an army. And that takes usually
> 2 or 3 pulses, which is interesting, and I hope this dynamic changes once we have resources around the map. But right
> now, it's better for me to be there until I put enough units that I feel confident that I can attack. And this AI
> that I am, this script that I am playing against seems to be doing the same, and it's better that I start being
> aggressive because the initial units are not so different.

**Built.** The **Rally point start** Experiment: 20% of the way from your Nexus to the enemy's by default (between
his 10 and 30, both offered), on open ground; 100 is the enemy Nexus as before. On the Crossing, 20% is 18,14, a
dozen tiles ahead of the Nexus and short of the ridge.

### F323 — the placement is good

> Besides that, I think the whole banner placement is looking good.

> Yeah, let's try those changes for now.

## The third round, 2026-11-26

### F324 — the enemy places its rally point too; the stance goes

> enemy script: we have to change this, even if it is a deep refactor. We no longer implement Defensive or Offensive
> stands on the banner. Before, the enemy could just declare "offensive", but now they have to place the banner. It
> should be easy, instead of defensive, the script places the banner at the home nexus. Instead of offensive, they
> place the banner on the enemy nexus. This is a new operation on the battle interface, that is recorded on the build
> phase for that player. The values to place a rally point should be a map placement object, that could be
> coordinates, or a constant to declare subjective spots like ENEMY_NEXUS and HOME_NEXUS (those are the ones that the
> scripts can use), and later when we implement map hostpots, it could be one of those locations, or a specific player
> base, etc.

**Scheduled.** Read with the review's point that stance and rally point say the same thing twice: the build actions'
stance goes, and a `rally` takes its place, a tile or `HOME_NEXUS` / `ENEMY_NEXUS`; the troops gather there and hold
it (the Rally point Experiment settles on hold, so nothing releases a side mid-round any more).

### F325 — Story stops; Skirmish is where the game grows

> We should cleanup the story missions. They were preliminary tests, now we are leaning into skirmish mode as the main
> one. We are stopping story mission development, please note that for now we will develop all the new mechanics on
> skirmish, and story maps have to translate and migrate to use the same as in skirmish, or otherwise delete those maps
> (it's not worth complicating for now). When skirmish mode is complete, and all the gameplay is properly defined, and
> we have at least a few decent commander armies, then we can start building the story mode for real, by adding an
> extra layer of scripting on top.

**Scheduled** as the next pull request, on his word (asked 2026-11-26: PERIMETER is the starter map under some forty
test files and the scripted playtest's default opening). Until then, nothing new is built for missions.

### F326 — the eye drawn by the cursor, then four arrows and three flashes

> About the arrows effect that goes from the origin (home nexus) to the placed rally point: The initial circle effect
> that closes into the banner is TOO INTENSE, the effect needs to happen faster, and with thinner icons that should
> also be 50% transparent; a little movement/flash/sparkle on that area is all that is needed   to bring the eye's
> attention. Actually don't make a circle, instead, send the cursor as usual (same effect as when starting a building)
> and when it arrives, show four directional arrows around the battner, andflash the banner and the arrows together (3
> quick flashes should be enough).

**Scheduled.**

### F327 — what already reads well

> The line is good, skipping over ally buildings looks good, and marking the building/nexus when selected also looks
> good. Placing with the mouse works well. Going to the menu and back goes to the build phase again, that makes sene.

### F328 — Esc and Backspace go back; Enter begins

> Canceling (esc/backspace) in the middle of the banner placement should go back to the build mode, pressing enter
> begins the battle.

**Scheduled.**

### F329 — the bottom line: the two actions, no place names

> The status bar at the bottom should show the available acctions: "[arrows] Set Rally Point. [enter] Start battle."
> There's no need to label every location (your base, enemy nexus, etc.).

**Scheduled.**

### F330 — a reminder when the player waits

> If the user doesn't move the arrow for a second, display and flash the directional arrows again, and right after
> flash the keys part of the text on the status bottom menu ("[arrows] Set Rally Point." => "[      ] Set Rally
> Point.") (3 quick flash as usual, or whatever is the default for the flash effect) Doing it in succession, the banner
> arrows first, and then the keys at the bottom of the text, should bring the player attention. Do this every 5
> seconds.

**Scheduled.**

### F331 — Enter: the arrows at once, for both sides

> When the user presses enter, that sets the location for the banner and the battle phase begins. The line effect
> should not wait 5 seconds, it should happen right away. The lines  are removed, the cursor goes away, and the same
> effect that happens now sending 3 arrows towards the banner should happen inmediately, for both players. The banner
> can stay for a second like it does now, then goes away.

**Scheduled.**

### F332 — the enemy's new buildings revealed, one by one

> This is also the time when the UI would show the new buildings that the enemy has placed. If you can do this now,
> please go ahead. During the build mode, the player cannot see it, but right before the battle starts, the enemy
> script plans the move and places the banner, so the first thing to show then the rally point is placed is the enemy
> buildings or unites that appear: they should appear with the cool building placement animarion, and do it one by
> one, starting from the ones that were placed closer to the nexus, in quick succession (e.g. one every 200 ms). If
> there is a building conflict, it is resolved here with the right animation. Then the battle can officially start!

**Scheduled.**

### F333 — the battle's first seconds marked as its last are

> During the first few seconds of the battle, the UI could use the same effect as during the last few seconds (when
> the nexus pulse is about to stop the battle).

**Scheduled.**

### F334 — buildings cancelled between rounds

> I exprienced a bug, it seems some buildings were canceled at the end of battle/beginning of the next build phase;
> but I'm pretty sure I placed them at the right location. Perhaps you can see this on the replay save file.

**Scheduled.** No save or note was written on his machine (only `settings.json`, all defaults), so it is reproduced
by play.

### F335 — a review of the branch (pasted by the owner)

> Two ways to release a rally point inside a round [...] The route line is worked out twice [...] The rally point's
> area is worked out twice [...] A game rule sits in the command-line code [...] Defaults disagree between the two
> doors [...] A new public field uses the old word [...] The same mapping appears three times [...] Stale text [...]
> Settle the Battle banner Experiment and delete the old popup [...] Stance and rally point are now two ways to say
> where the troops go [...] The "Replay last battle" item sits on `[b]` in the game menu.

**Scheduled**, every point: one release path (none: hold only), one route walk, one area, the default rally point in
the battle rules so the `skirmish` command plays it too, the field named `rally`, the stale lines, the Battle banner
Experiment settled and its old popup deleted, the stance folded into the rally point (F324), and Replay off `b`.
