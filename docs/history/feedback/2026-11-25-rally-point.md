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

**Built.** A plan's `rally` is a tile, `HOME_NEXUS` or `ENEMY_NEXUS` (a list, so hotspots can join it); the stance
is gone, and an old file's `stance` or `banner` is read as a rally point with a problem said. The scripts place
`HOME_NEXUS` where they held and `ENEMY_NEXUS` where they attacked; the troops hold it and nothing releases them.
Measured (seeds 1-6, 8 rounds): Vasse against Dob on the Crossing 10-2 before, 12-0 after; on the Pocket the Commanders
came closer (12 seeds: Vasse against Averno 18-6 before, 11-13 after), with the west side ahead 42-30 after, 33-39
before, worth watching.
### F325 — Story stops; Skirmish is where the game grows

> We should cleanup the story missions. They were preliminary tests, now we are leaning into skirmish mode as the main
> one. We are stopping story mission development, please note that for now we will develop all the new mechanics on
> skirmish, and story maps have to translate and migrate to use the same as in skirmish, or otherwise delete those maps
> (it's not worth complicating for now). When skirmish mode is complete, and all the gameplay is properly defined, and
> we have at least a few decent commander armies, then we can start building the story mode for real, by adding an
> extra layer of scripting on top.

**Scheduled** as the next pull request, on his word (asked 2026-11-26: PERIMETER is the starter map under some forty
test files and the scripted playtest's default opening). Until then, nothing new is built for missions.

**Built** (2026-11-26). PERIMETER, the mission runner (`src/match/mission.ts`, `src/mission/`), the story files
(`stories/`), the Story row of the title menu and the `story` routes left the game. The starter map plays as a Skirmish
save (`saves/starter.save.json`): it is what the Build Phase's tests and the scripted playtest's own default open; the
tests that played PERIMETER's rounds play the starter map's Skirmish or a small test battle instead. The Story design
pages say Story waits, their design kept. The Skirmish tallies on both maps are byte for byte what they were.

### F326 — the eye drawn by the cursor, then four arrows and three flashes

> About the arrows effect that goes from the origin (home nexus) to the placed rally point: The initial circle effect
> that closes into the banner is TOO INTENSE, the effect needs to happen faster, and with thinner icons that should
> also be 50% transparent; a little movement/flash/sparkle on that area is all that is needed   to bring the eye's
> attention. Actually don't make a circle, instead, send the cursor as usual (same effect as when starting a building)
> and when it arrives, show four directional arrows around the battner, andflash the banner and the arrows together (3
> quick flashes should be enough).

**Built.** The rings are gone: the focus arrow flies from the Start row to the rally point, as it does when a
building is armed, and four thin, half-faded arrows round the flag flash three times with it.
### F327 — what already reads well

> The line is good, skipping over ally buildings looks good, and marking the building/nexus when selected also looks
> good. Placing with the mouse works well. Going to the menu and back goes to the build phase again, that makes sene.

### F328 — Esc and Backspace go back; Enter begins

> Canceling (esc/backspace) in the middle of the banner placement should go back to the build mode, pressing enter
> begins the battle.

**Built.** Esc, `x`, Backspace and a right click go back with nothing changed; Enter, Space, `s`, the Start row
or a second click place it and begin.
### F329 — the bottom line: the two actions, no place names

> The status bar at the bottom should show the available acctions: "[arrows] Set Rally Point. [enter] Start battle."
> There's no need to label every location (your base, enemy nexus, etc.).

**Built**, word for word, with no place names; a refusal says only why.
### F330 — a reminder when the player waits

> If the user doesn't move the arrow for a second, display and flash the directional arrows again, and right after
> flash the keys part of the text on the status bottom menu ("[arrows] Set Rally Point." => "[      ] Set Rally
> Point.") (3 quick flash as usual, or whatever is the default for the flash effect) Doing it in succession, the banner
> arrows first, and then the keys at the bottom of the text, should bring the player attention. Do this every 5
> seconds.

**Built.** After a second unmoved, the arrows flash, then the keys flash, every five seconds.
### F331 — Enter: the arrows at once, for both sides

> When the user presses enter, that sets the location for the banner and the battle phase begins. The line effect
> should not wait 5 seconds, it should happen right away. The lines  are removed, the cursor goes away, and the same
> effect that happens now sending 3 arrows towards the banner should happen inmediately, for both players. The banner
> can stay for a second like it does now, then goes away.

**Built.** At Enter the line and cursor go, and both sides' arrows run at once; each flag stays a second.
### F332 — the enemy's new buildings revealed, one by one

> This is also the time when the UI would show the new buildings that the enemy has placed. If you can do this now,
> please go ahead. During the build mode, the player cannot see it, but right before the battle starts, the enemy
> script plans the move and places the banner, so the first thing to show then the rally point is placed is the enemy
> buildings or unites that appear: they should appear with the cool building placement animarion, and do it one by
> one, starting from the ones that were placed closer to the nexus, in quick succession (e.g. one every 200 ms). If
> there is a building conflict, it is resolved here with the right animation. Then the battle can officially start!

**Built.** A prelude before the fight's first tick: the enemy's new buildings and units come in with the placement
animation, nearest their Nexus first, 200 ms apart (at most 2.7 s in all); a clash plays first and is thrown down; the
timer starts after it.
### F333 — the battle's first seconds marked as its last are

> During the first few seconds of the battle, the UI could use the same effect as during the last few seconds (when
> the nexus pulse is about to stop the battle).

**Built.** The light round the border and the timer flash run in the fight's first three seconds too.
### F334 — buildings cancelled between rounds

> I exprienced a bug, it seems some buildings were canceled at the end of battle/beginning of the next build phase;
> but I'm pretty sure I placed them at the right location. Perhaps you can see this on the replay save file.

**Built.** Found by about 1,500 scripted rounds: the round never refuses a building the screen accepted, except in
a clash (rare against the steady script). What he most likely saw is buildings destroyed in their first battle, which
the game never said: a quarter of new buildings against steady, a third of those within five seconds, beside enemy
troops regrouped in the base. The next round now opens on "Lost in the battle: a Barracks, 2 Turret." and a clash on
one line with the refund. Whether the Build Phase should warn about building beside enemy troops is an open question.
### F335 — a review of the branch (pasted by the owner)

> Two ways to release a rally point inside a round [...] The route line is worked out twice [...] The rally point's
> area is worked out twice [...] A game rule sits in the command-line code [...] Defaults disagree between the two
> doors [...] A new public field uses the old word [...] The same mapping appears three times [...] Stale text [...]
> Settle the Battle banner Experiment and delete the old popup [...] Stance and rally point are now two ways to say
> where the troops go [...] The "Replay last battle" item sits on `[b]` in the game menu.

**Built**, every point: one area, one refusal and one route (`src/match/rally.ts`); the default rally point in the
battle rules (`src/battle/rally.ts`), so the `skirmish` command plays it too; the field named `rally`; no release; the
Battle banner Experiment and its old popup deleted; the stale lines rewritten; Watch last battle on `w`.
## The fourth round, 2026-11-26

### F336 — arrows that ask for the keys

> The arrows around the banner are tiny and pointing at the banner. I mean arrows that represent the moevement keys,
> pointing outwards so it seems that is asking for pressing the keys. The could flash with a delay fromt the banner so
> they visually create movement. The idea is that when a player starts a battle round, they may not realize they can
> move the banner, so this aid tries to make that clear.

**Built.** The movement keys' arrows stand round the flag pointing outward (`▲ ▼ ◀ ▶` with Unicode symbols), bold; the
flag lights, then the arrows half a beat later, three times, so the light runs outward.
### F337 — the regroup faces the enemy; army groups

> there was a bug [a picture]. At the end of round 2, the units retreated to the bottom of the map, instead of standing
> behind the banner. I think since we simplified how the banner behaves, then we have to infer if they need to regroup
> behind it or on top of it. Please explore the best way to represent this. The idea is that if units are in conflict,
> they should retreat and regroup so when the next battle round begins, they are better possitioned to battle. The
> formation should be facing the enemy, not necesarily the lines towards the banner. This may also count for unit
> formation, the rule that says a unit with more targeting priority moves at half speed to allow the melee units move
> to the front, that should be relative to the closest enemy army. I think we defined some rules to identify army
> groups (I think we called them battalions or something like that?), perhaps this is a good time to re-define that
> concept, maybe based on density and if their enemy commander is on a cluster then the commander represents the center
> of the group. The enemy nexus is always a group. Offensive buildings also count as units on a single group. As units
> move during the battle round, the groups could be re-defined, but it doesn't have to be on every frame, every second
> or so should be enough. Once the key groups are identified, along with the mission targets (the enemy nexus), then it
> should be easier to define what is "on front" or "on the back". Armies move towards the banner, but face the enemy.
> Feel free to grill this with me if I am not making sense. I also need to get used to our vocabulary to describe the
> intended behavior, that I am myself discovering as I playtest (if this is not obvious, please encode it on the
> development docs).

> Army is the whole set of units, Army group is a cluster of units that can fight together. We already defined
> something similar during the skirmish milestone, in order to report the results of a battle round [...] I don't want
> to make a new definition, we should use the same one. We are polishing the concept of army group, that can be used to
> report a battle engagement and also to aim units during the battle round when marching or re-grouping into fomation.
> Army, Army group, Army group formation, re-grouping, marching (towards the rally point), rally point (banner is the
> visual representation of the rally point), engaging in combat, re-targeting. All should be properly explained on the
> glossary of the toop movement spec. For the battle simluation, we need to make sure that the in-game times are
> properly identified: differentiate tick, frame, and a second (which is a "in-game second"), we should refer to real
> time durations specifically, usually outside of the simiulation.

**Built** (the regroup) **and scheduled** (army groups). Cause: between rounds a side formed its ranks across the line from its Commander to
its target, and the target is now the rally point, so a Commander beside or past it turned the ranks sideways or
backwards. Asked (2026-11-26): now, the regroup forms up on the rally point (or falls back to it), facing the enemy,
and the words go into the glossary and the troop movement page; **army groups** (named so by him; the same 5-tile reach
as an engagement) are built as the next pull request. Now each side forms its ranks across the line from its rally point toward the
middle of the enemy's fighting units nearest it (else the enemy Nexus); one that fought past its rally point falls back
to it, one short of it forms where it stands. Measured (seeds 1-6, 8 rounds): the Crossing 18-18 before and after; the
Pocket 21-15 before, 18-18 after.

**Army groups built** (2026-11-27, the pull request after the rally point's; the owner's answers to its questions the
day before): a side's units that fight and its buildings that shoot, chained within 5 tiles, worked out every tick; the
half-speed rule within an army group, ahead meaning nearer its nearest enemy army group (the smallest gap); the regroup
forms the main army group facing its nearest enemy army group, and reinforcement units join it if they can walk there in
time, else fall back beside the building that trained them. Measured in
[army groups, measured](../reports/2026-11-27-army-groups.md).

### F338 — the troops always march to the rally point

> Another round, my troops ignored the rally point and staid back in my base. That is not acceptable; if the UX shows
> that I can place the banner, then the units should march towards the new location. Note that the march direction is
> not strict. If they cannot reach the location, they will attack the buildings on the way, or walk around and attack
> things they find. We don't allow placing the rally point on a rock, but even if we did, the units should still walk
> towards the intended location. Units should know when their group already arrived at the banner, and change into
> formation (which means they don't need to be exactly at the banner location, only the group needs to be close to it)
> when there are no battle engagement.

**Built.** Cause, found by checking every spot the Build Phase accepts against the round: the enemy builds in secret
the same round, and when its new buildings filled the rally point's area (a ring round its Nexus) the round refused the
spot and quietly sent the troops to the default in front of the base (424 such spots in rounds 5-8 of 35 battles;
none after). Now the round refuses only a spot off the battlefield; rock becomes its nearest open ground; anything else
stays the target, and the troops walk as near as they can and breach. Arriving and forming up by army group: built
2026-11-27, an army group whose centre is within 5 tiles of the rally point with no enemy in sight or in reach forms
up there in ranks facing its nearest enemy army group.
### F339 — fast-forward a settled round

> During the first rounds, if I am playing defensive, the unit groups arrive at the rally point, and nothing happens
> until the round ends. The game should fast forward to the end of the round. We may be able to identify this by
> calculating the end state of the round, and comparing with it each second to see if the units are very close to that
> state (e.g. no active conflict engagements and half units at the exact destination, other units within 1 tile, and no
> more than 2 units within 2 tiles), then the game can fast fowrward to the end of the battle. Later when we have
> workers, they are ignored from the final location because they would keep moving and collecting, but that can also
> be fast forward as long as the player can see all the collected resources. Please think about this mechanic and see
> how to implement it on this PR as well.

**Built.** Checked once an in-game second from the last hit: at least half the units exactly where they end, the rest
within a tile, at most two within two tiles. From there to the last seconds it plays at 8x, `Fast forward` beside the
speed; any key returns to normal speed and still does its own work.
### F340 — no warning beside enemy troops

> Building next to enemy troops -- no need to warn, it is obvious from the battlefield state.

**Answered**: no warning.

### F341 — balance waits

> Pocket -- no bias to record yet. Let's not worry about balance for now, we are focusing on the UX

### F342 — the rally point starts at 30%

> Rally point at start: 30% looks good

**Built**: Rally point start's default is 30.
