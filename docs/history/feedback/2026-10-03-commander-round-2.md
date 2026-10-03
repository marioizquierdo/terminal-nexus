# The Commander, round 2 — the owner's notes on her pull request (2026-10-03)

Mario read the Commander pull request (60) and sent one message about what the milestone is for. It
continues [`2026-10-01-multi-pulse.md`](2026-10-01-multi-pulse.md)'s numbering. He asked for no balance work
and for three things to be right: Vasse's deck, organized so other modes can pick her and a campaign level can
override it; Vasse herself, visible and introduced; and the raid's intent, readable enough to plan against.
They are built on the same pull request as a second round of the Commander step. Status values: **Built**,
**Scheduled**, **Open**, **Contested**.

### F104 — The concept, not the balance

> this milestone is more about building the concept of the commander and less about polishong this mission
> or vasse's health.

**Built.** Nothing in PERIMETER is retuned and Vasse's numbers stay as they are. The pull request stops asking
about her health: the Experiment stays for anyone who wants to watch her fall, at the same first guess. The
known issue that she falls in PERIMETER's last round stays recorded, not fixed.

### F105 — Her deck, organized, and the campaign overriding it

> Make sure that the commander deck is properly organized, and properly integrated with the campaign. The
> idea is that players should be able to pick Vasse on the other game modes. Here in the campaign we are
> developing (unlocking) the deck, so a campaign level should be able to override the actual deck.

**Built.** Vasse has a deck of her own (`src/content/armies.ts`), defined once beside the content: her
Commander, the credits a Build Phase starts with, what she can build and her Nexus power pool. Any mode that
lets a player pick her reads it whole. A mission names the deck it plays and overrides any part of it (an id
unlocks the deck's own entry, a whole entry is the level's own), and the Build Phase offers exactly the
result; validation refuses an unknown deck or an override that names what the deck does not hold. PERIMETER
names her deck and lists what mission 1 unlocks of it, which today is all of it: the three bench buildings
and the two placeholder powers. This answers the open question about building Vasse early: the deck's shape
is built now, and the Citizens' roster, its balance and her four designed powers still wait. It reverses the
design's line that no Commander Army is built before the microgame milestone, by his words.

### F106 — Vasse visible, prominent, and introduced

> The important thing to verify here is that Vasse is sisible on the map. She should have an intro highlight
> when she shows up.
>
> In any case, just make aure vasse is visible, prominent, and don't worry that much about level balance yet.

**Built.** Vasse is drawn bold at full strength wherever she stands, never dim or washed: arriving with her
squads in round 1 (who carry the arrivals' wash around her), beside the Nexus after Recall, and while a Pulse
plays. As PERIMETER opens, the dialog's first line is hers and the camera is on her, a soft light breathing in
a ring around her (her cell inverted in monochrome); the round she is restored opens on one line, "Vasse is
back beside the Nexus.", with the same light.

### F107 — Intros: a dialog at the bottom

> We should start thinking about how to implement intros, perhaps a new tyle of popup at the bottom that
> shows dialogs.

**Built.** The dialog: a popup docked at the bottom of the map, the speaker's name as its title in their
side's colour (with their glyph when they are on the map), one line at a time. Enter, Space or a click reads
on, Esc, `x` or a right click skips the rest, and each line moves the camera to what it is about. A mission
writes its lines as data (`say`, at a round's `build.start`), checked when it loads; PERIMETER opens with
Vasse's bark and its pre-battle exchange with Corvane, the lines the campaign design already had. The game,
the browser page and the playtest play it; key scripts start with `Esc` to skip it. Portrait cards, barks,
timeouts and scripted Pulses come later.

### F108 — The enemy visible without a Nexus power

> The enemy units should be visible without nexus powers, reading the enemy intent is very important for basic
> ui/ux interaction.

**Built.** The coming raid is always drawn, with no Nexus power and no Experiment: the Incoming wave
Experiment is settled as shown and removed. Arriving units are washed in their side's colour where colours
blend and drawn at full strength otherwise, so they are never faint; "not here yet" is said in words. The
open question is answered and moved to the answered register; a reveal power now has to show what this free
view cannot.

### F109 — Intent that makes you plan

> If you try to play a round pretending to be a player, you should feel that the enemy intent makes you think
> about strategy, where to place the buildings, how to use your credits, how to protect the target, etc.

**Built.** In the Build Phase each coming group has a trail to what it goes for first, and that target is
marked; the side panel's free rows say, under when it comes, how many, of what, from where, and what it goes
for ("goes for your Barracks"). The first target is the kernel's own choice on the Pulse's first tick, worked
out on the plan as it stands, so placing a Turret on a trail makes it the target at once. Played as a player:
round 1's trail said the probe comes west along the ridge and round its end to the Barracks, so a Turret where
it rounds the end became bait; in round 2 one Turret on the flank's row pulled both groups; in round 3 ringing
the Turret both groups converged on held the mission with Vasse alive. It made the player think about bait,
keeping the Barracks and Vasse out of first contact, and spending where trails meet. What it does not show: where
the fight goes after first contact, since the raid retargets as it advances.
