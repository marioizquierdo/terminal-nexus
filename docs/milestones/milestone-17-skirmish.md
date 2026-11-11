# Milestone 17 — Skirmish

**Status:** CURRENT
**Current step:** 17A — the banner (the prototype built in the runs milestone, waiting on the owner's playtest).
**Depends on:** [the runs milestone](../history/milestones/milestone-11-challenge-runs.md) (duels on the Build Phase screen, building actions, the kept front, troop movement, the
banner prototype), Milestone 14 (three Commander Armies and the duel scripts)

Made current on 2026-11-11 ([the owner's words](../history/feedback/2026-11-11-game-modes.md)): "Let's turn Skirmish into
the center stone for game design and testing." The design it builds against is [`game-modes.md`](../game-design/game-modes.md).
Most of it exists, since a Challenge battle is already a duel on the Build Phase screen against a script.

**While 17A waits on Mario's playtest**, the next session takes step 17C: it does not depend on his answer about the
banner. Steps 17D to 17H follow in order.

## Question

Can a player start a Skirmish from the title menu or a battle file — any Commander against any, on a chosen map and
difficulty — and play one battle they want to play again; and is a Skirmish the place where every change to the game is
seen and tested?

## Steps

Small, in order, each finishable on its own and each one pull request.

### Step 17A — The banner

Moved from the runs milestone. The owner, 2026-10-31 ([his words](../history/feedback/2026-10-31-banner-first.md)):
"test placing the banner on the map first, because the UX to do it is the big question… if we can't, we will fallback
to the stance." Tried behind the Battle banner Experiment.

- [x] **The placement, as a prototype**: Start Battle docks a panel over the menu with the target and stance, the camera
      on the banner; Change Target makes the cursor a pulsing banner that names the spot under it, refuses ground troops
      cannot reach, and plants with a ring and a stance choice ([`ui-patterns.md`](../system-design/ui-patterns.md),
      "The battle banner"). Where no enemy Nexus stands, the default is the level's own target.
- [x] The march line runs to the banner, from the Nexus and from the Commander, and on to the enemy when aggressive.
- [ ] The owner plays it and says whether it is easy and intuitive, or a stance row replaces it (step 17B).
- [ ] **A banner** placed in the Build Phase, aggressive or defensive; by default on the enemy Nexus, aggressive.
      Aggressive elsewhere: the army goes there first, then on to the enemy Nexus. Defensive: it holds the line there.
- [ ] The duel scripts place one, so a kept front has an answer: a script whose front is beaten holds or falls back.
      Duels carry it, and the measurement says whether rush and turtle now reach each other's Nexus.

### Step 17B — The stance row, only if the banner fails

Built only if the owner chooses the stance over the banner in step 17A.

- [ ] A Build Phase row for the army's stance for the coming round: aggressive, hold the line, defensive.
- [ ] The duel scripts choose one, as step 17A's last item says for the banner.

### Step 17C — Skirmish on the title menu, and the names

- [ ] The title menu's rows: Skirmish, Story, Settings, About, Exit. Skirmish starts one battle with the defaults
      (Vasse against Dob Hunter's `balanced` script on the Crossing, a seed from the clock).
- [ ] The names in the code, the files and the routes: `skirmish` and `skirmish?seed=<n>`; `story` and
      `story?mission=<id>&round=<n>` for a mission; the `campaigns/` folder and the `campaign` words become Story's.
- [ ] The run retired: its draft, its next-battle screen and its summary, `src/run/`, the army files' `run` field and the
      routes that open it. What a Skirmish needs from it (a duel on the Build Phase screen, the result dialog) moves to
      Skirmish, and the player's side fields the Commander's whole army, not the run's small one.
- [ ] The Story row opens what Campaign opens today: a placeholder screen until the Story menu (Milestone 4).
- [ ] The tests that pinned a run are deleted with it or re-pinned on a Skirmish, each with a reason.

### Step 17D — The setup screen

- [ ] A screen before the battle with every required setting the screen sets ([`game-modes.md`](../game-design/game-modes.md),
      what a Skirmish is set up with): your Commander, the opponent's Commander and script, difficulty, the map, the
      seed. Every row has a default, so Enter starts at once.
- [ ] Keys, mouse and driver, its hotkeys shown, adapting across the viewport range like every other screen
      ([`ui-patterns.md`](../system-design/ui-patterns.md), the checklist for a new screen).
- [ ] The result dialog offers the same battle again, a new seed, or the setup screen.

### Step 17E — The battle file

- [ ] `--battle <file>` starts a Skirmish from a JSON battle file: every required setting, including each side's
      credits, roster, and buildings and units already on the Grid, and a settings text.
- [ ] The duel commands take a battle file too, so the same file is played on screen and measured headless.
- [ ] A file the loader refuses is refused by name, every problem at once.
- [ ] Two or three battle files checked in as examples and demos (a mirror, a Commander against another with units
      already in place), each played by a test.

### Step 17F — Difficulty

- [ ] Difficulty as a handicap on the opponent's credits, at the start and each round, by named steps (Q92 proceeds
      under its recommendation).
- [ ] Measured: over seeds, the scripts against each other at each step, so each step is shown to be harder than the
      one before it.

### Step 17G — Skirmish, the place to test

- [ ] The playtest script, its skill, the browser page and the screenshot capture start from a Skirmish (or a battle
      file) instead of PERIMETER; a mission is still opened by its route when a change is about a mission.
- [ ] The testing pages say which battle file shows which rule ([`testing-ground.md`](../system-design/testing-ground.md)).

### Step 17H — Playing it

- [ ] Mario plays Skirmish against each Commander and script; his notes become a feedback round. What makes a battle
      enjoyable becomes the defaults, and the first idea of the later list worth building is named.

## Out of scope

Each is in the later list of [`game-modes.md`](../game-design/game-modes.md) and waits for its own step or milestone:

- Versus, and anything over a network.
- A Build Phase clock, modifiers, a pre-battle pick, more than two sides, random maps.
- A smarter opponent than the duel scripts (Q92's second option).
- The endless stand, and every mission (Story's milestones).
- The worker economy (Milestone 7).

## How it is judged

Automated: a Skirmish is deterministic (the same battle file, seed and plans give the same hash on Node and Bun); every
battle file checked in is played by a test; the setup screen at every colour depth and across the viewport range; the
driver plays a whole Skirmish with no terminal.

Human, and this is the real test: Mario starts a Skirmish in a key or two, plays it to the end, can say why he won or
lost, and wants another with a different Commander.

## Done when

- [ ] Steps 17A, 17C to 17H are built and tested (17B only if the stance replaced the banner).
- [ ] No mode, route, file or screen says Campaign or Challenge.
- [ ] `./scripts/check-repository.sh` passes.
