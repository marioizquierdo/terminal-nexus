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

**Scheduled** (this round). Vasse gets a deck of her own, defined once with the content: her Commander, the
credits she starts with, what she can build and her Nexus power pool. Any mode that lets a player pick her
reads it whole. A mission names the deck it plays and may override any part of it: the Campaign develops the
deck mission by mission, so each level says what of it is unlocked. This answers the open question about
building Vasse early without authoring the whole Citizens army: the deck is built now, at the size of what
exists (the bench buildings and the placeholder Nexus powers), and a real roster still waits. It reverses the
design's line that no Commander Army is built before the microgame milestone, by his words: what stays
deferred is roster breadth and balance, not the deck's shape.

### F106 — Vasse visible, prominent, and introduced

> The important thing to verify here is that Vasse is sisible on the map. She should have an intro highlight
> when she shows up.
>
> In any case, just make aure vasse is visible, prominent, and don't worry that much about level balance yet.

**Scheduled** (this round). Played as a player before this round, she was a faint `@` in the same dim colour
as the squads arriving with her, easy to miss. She gets a look of her own, bold at full strength wherever she
is drawn, and a highlight when she shows up: as PERIMETER opens, and again the round she is restored.

### F107 — Intros: a dialog at the bottom

> We should start thinking about how to implement intros, perhaps a new tyle of popup at the bottom that
> shows dialogs.

**Scheduled** (this round). A first version of the campaign design's `say`: a dialog box at the bottom of the
screen, a speaker and a line, advanced by Enter or a click and skipped by Esc, the camera on whoever is
talking. A mission writes its lines as data, beside its triggers. PERIMETER opens with its pre-battle
exchange, the lines already written in the campaign design. Portrait cards, barks and scripted Pulses come
later.

### F108 — The enemy visible without a Nexus power

> The enemy units should be visible without nexus powers, reading the enemy intent is very important for basic
> ui/ux interaction.

**Scheduled** (this round). This answers the open question about how much of what is coming a player sees
without spending a pick: everything about the coming raid is free (where, how many, of what, when, and what
it means to do). The Incoming wave Experiment, which could hide the raid, is settled as shown and removed. A
Nexus power that reveals must show something beyond this, which is the Nexus draft step's to design.

### F109 — Intent that makes you plan

> If you try to play a round pretending to be a player, you should feel that the enemy intent makes you think
> about strategy, where to place the buildings, how to use your credits, how to protect the target, etc.

**Scheduled** (this round). Played as a player before this round, the raid was a faint group at the top of
the map with nothing saying what it would do unless explored tile by tile. The Build Phase is to show, without
looking for it, what each group will go for first, along which way, and how many are coming when. The
prediction is the kernel's own, run on the plan as it stands, so placing a building changes it. The round is
then played as a player, and the pull request says what it made one think about.
