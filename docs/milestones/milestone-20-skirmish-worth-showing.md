# Milestone 20 — A Skirmish worth showing

**Status:** PLANNED
**Depends on:** Milestone 17 (Skirmish set up, saved and played headless), the first content pass of Milestone 12 (units
that counter each other) and the narrow worker economy of Milestone 7, so a battle is measured on the rules friends
will play

The owner, 2026-11-12 ([his words](../history/feedback/2026-11-12-the-new-focus.md)): "now we have to rush a little more
towards making sure the UI is comfortable, placing banners actually feels strategic and it is also comfortable and
clear, showing visual feedback about what the enemy is doing in a skirmish mode… Before we get there, we have to make
sure that the basic game at least is fun and it can be configured in a few different ways." Split from the Skirmish
milestone on 2026-11-12 ([the review](../history/feedback/2026-11-12-skirmish-saves.md)): that one makes any battle
something to set up and save; this one makes a battle worth playing again. **Its last step is friends playing.**

## Question

Against an enemy on equal ground, does a player read what the enemy did, answer it with their build and their banner,
see the answer matter, and finish a battle that stayed open long enough to want another; and do friends who have never
seen the game say the same?

## Steps

Not started; the order is a first guess, and each step is played by an agent before Mario is asked.

### Step 20A — The banner as a decision

- [ ] The duel scripts place a banner, so a kept front has an answer: a script whose front is beaten holds or falls
      back.
- [ ] **Strategic, measured**: over seeds, a script that plants well beats the same script planting at the default, and
      rush and turtle reach each other's Nexus. A banner that never changes an outcome is decoration, and the step says so.

### Step 20B — Reading the opponent

The owner, 2026-11-11 after showing the game ([his words](../history/feedback/2026-11-11-showing-the-game.md)): "when
the battle begins, see what they built, and… go back and analyze their base"; and 2026-11-12: "So you can see what the
enemy plays new and how they're plotting to counter your build." The plans stay hidden while both sides build.

- [ ] **The reveal**: as the Battle Round starts, what the enemy did this Build Phase is marked on the Grid for a few
      seconds and said in one line: its new buildings and upgrades, its Nexus power, its banner and stance.
- [ ] **After the battle**: in the next Build Phase the enemy's base stands as it is, its new things still marked until
      the player has looked, and the panel says in a line or two what changed on its side (built, lost, its army now).
      Explore Map's card on any enemy structure says when it was built; `g` again jumps on to the enemy Nexus.
- [ ] **During the battle**: pointing at a unit shows its card, as Explore Map does in the Build Phase. Playback stays
      read-only.
- [ ] Measured by eye: a playtest at 80 × 24 and at the largest size reads the reveal without pausing. A Nexus power
      of the `reveal` kind ([`commander-armies.md`](../game-design/commander-armies.md)) is checked against this view, so
      the two show different things.

### Step 20C — A script that answers

What the Skirmish milestone's test runs found (2026-11-12, `skirmish --play-until-win --seeds`): on the Pocket, over
four seeds and every pairing of Commanders, the script decided every battle and the Commander never did — `steady`
(balanced) beat `agro` (rush) and `defensive` (turtle) four to nothing (three to one in the Dob mirror), and
`defensive` beat `agro` four to nothing. With the sides swapped, `steady` in the east won 22 of 24 the same way, so it is
the scripts, not the west. A strict order, nothing that answers anything.

- [ ] One script profile that reads what the player did (the brief a duel already writes) and answers it: a kept front,
      a rush, a turtle, an army it is losing to, the counter to what it saw built. Measured against the existing scripts
      over seeds, then offered as the default opponent if it is better.

### Step 20D — A battle that stays open, and one that ends

The duels found that an early lead decides a battle: the side ahead after round 2 wins 50 of 54
([the report](../history/reports/2026-10-21-the-march.md)). A battle decided in round 2 is not one a player wants to
finish. The other end is as bad, found while testing the Skirmish milestone (2026-11-12): on the Crossing, `agro`
(Vasse) against `defensive` (Dob Hunter) played to round 100 on all six seeds tried without either Nexus taking a hit,
"won by damage" — the rush never reaches a turtle on the big map. Eight rounds hide it behind a judged result. And on
the Pocket a player can lose in round 1 before doing anything: a plan whose buildings are all refused (the forward
ground clashes with Dob's) meets Dob's rush with only the starting troops, and the Nexus fell at tick 206.

- [ ] Measured: how often a battle on Skirmish's defaults ends by a Nexus falling, by map, and the longest battles; the
      Crossing's stalemate and the Pocket's round-1 loss each looked at and answered (a fix, or a reason they are fine).

- [ ] Measured first, on Skirmish's defaults with the economy and the counters in: how often the side ahead after round
      1, 2 and 3 wins, and by how much; how gathered resource and the round's credits combine is settled here (the
      economy milestone's open half).
- [ ] Two or three ways to keep a battle open, each behind an Experiment and measured over seeds (for example: the side
      behind earns more, the Nexus fights back harder when hurt, the kept front gives ground). Mario plays the best and
      picks; the question goes to the register with a recommendation.
- [ ] The opponent's credits measured at a few shares, each script against the others, so the setup screen says plainly
      how much harder each share plays.

### Step 20E — The battle screen reads

The owner's notes on the battle screen ([his words](../history/feedback/2026-10-01-multi-pulse.md)) and what the demo
showed:

- [ ] Fewer numbers: keep what a player reads in a fight, drop the rest.
- [ ] The battle feed says one line a wave, not a line a unit, with each unit's own name.
- [ ] An army past its supply cap says its buildings have stopped training, rather than `units 41/12`.

### Step 20F — An agent plays first

- [ ] The playtest skill plays a whole Skirmish from a save through the driver and writes a short player's diary: what
      confused it, how many keys the common tasks took (placing a building, placing the banner, starting a round), how
      long the screen stood with nothing to decide, and which choices made no difference. Every step that changes the
      screen runs it before Mario is asked.

### Step 20G — Playing it, then friends

- [ ] Before friends: the browser page played on a real phone and an iPad with a keyboard; a host-conformance test (a key
      script through the terminal path and the page gives the same frames); GitHub Discussions linked from the About
      screen.
- [ ] Mario plays Skirmish against each Commander and script, with the note key; his notes become feedback rounds. What
      makes a battle enjoyable becomes the defaults.
- [ ] When he says the basic game is fun, the browser page goes to his friends with the note key, and their notes are
      the next feedback round.

## Out of scope

- Agent players (Milestone 21), a deeper planner (Milestone 19), Story.
- New effects, art and visual polish beyond what a step above needs to be read.
- Pausing and rewinding a battle.

## How it is judged

Automated: the measurements of steps 20A, 20C and 20D, kept for the record; the reveal at every colour depth and across
the viewport range; the agent's diary on every step that changes the screen.

Human, and this is the real test: Mario reads what the enemy did, answers it, can say why he won or lost, and wants
another with a different Commander. Then his friends do.

## Done when

- [ ] Steps 20A to 20G are built and tested, and friends have played.
- [ ] `./scripts/check-repository.sh` passes.
