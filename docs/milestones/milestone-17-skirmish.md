# Milestone 17 — Skirmish: setup and save files

**Status:** CURRENT
**Current step:** 17A — the banner (the prototype built in the runs milestone, waiting on the owner's playtest).
**Depends on:** [the runs milestone](../history/milestones/milestone-11-challenge-runs.md) (duels on the Build Phase screen, building actions, the kept front, troop movement, the
banner prototype), Milestone 14 (three Commander Armies and the duel scripts)

Made current on 2026-11-11 ([the owner's words](../history/feedback/2026-11-11-game-modes.md)): "Let's turn Skirmish into
the center stone for game design and testing." Shaped on 2026-11-12 ([his words](../history/feedback/2026-11-12-skirmish-saves.md)):
a Skirmish is set up by map, then a Commander and a controller for each slot, then a goal and modifiers; "scenarios
basically become saved skirmish saves… that works both from the UI and from the CLI"; and an agent plays it headless,
round by round, from save to save. The design is [`skirmish-saves.md`](../system-design/skirmish-saves.md) for the setup,
the save file and the command line, and [`game-modes.md`](../game-design/game-modes.md) for what Skirmish is for.

What makes a Skirmish worth showing friends (reading the opponent, a battle that stays open, the banner as a decision)
is the next milestone, [20](milestone-20-skirmish-worth-showing.md). This one makes every battle something anyone can set
up, save, load, hand to an agent and replay.

**While 17A waits on Mario's playtest**, the next session takes step 17C, then 17D; neither depends on his answer about
the banner. The first content pass (units that counter each other, Milestone 12) may run beside this milestone: it needs
no playtime.

## Question

Can Mario start the game, choose Skirmish, pick a map, a Commander and a controller for each slot, play a few rounds,
save, come back later, load and carry on where he stopped; and can an agent take the same save, change who plays each
side, and play it headless, round by round or to the end?

## Steps

Small, in order, each finishable on its own and each one pull request. Every step that changes the screen is played by
an agent before it is offered to Mario (DEVELOPMENT.md, the feedback loop).

### Step 17A — The banner

Moved from the runs milestone. The owner, 2026-10-31 ([his words](../history/feedback/2026-10-31-banner-first.md)):
"test placing the banner on the map first, because the UX to do it is the big question… if we can't, we will fallback
to the stance." Tried behind the Battle banner Experiment.

- [x] **The placement, as a prototype**: Start Battle docks a panel over the menu with the target and stance, the camera
      on the banner; Change Target makes the cursor a pulsing banner that names the spot under it, refuses ground troops
      cannot reach, and plants with a ring and a stance choice ([`ui-patterns.md`](../system-design/ui-patterns.md),
      "The battle banner"). Where no enemy Nexus stands, the default is the level's own target.
- [x] The march line runs to the banner, from the Nexus and from the Commander, and on to the enemy when aggressive.
- [ ] The owner plays it in a Challenge battle (a Skirmish once 17C lands: an enemy Nexus to aim at, which PERIMETER
      lacks) and says whether it is comfortable and clear, or a stance row replaces it (step 17B).
- [ ] **A banner** placed in the Build Phase, aggressive or defensive; by default on the enemy Nexus, aggressive.
      Aggressive elsewhere: the army goes there first, then on to the enemy Nexus. Defensive: it holds the line there.
      Duels carry it: a plan names a banner, and the brief says where each side's stood last round.

The scripts planting it well, and whether where it goes changes who wins, are the next milestone's first step.

### Step 17B — The stance row, only if the banner fails

Built only if the owner chooses the stance over the banner in step 17A.

- [ ] A Build Phase row for the army's stance for the coming round: aggressive, hold the line, defensive; duels carry it.

### Step 17C — Skirmish on the title menu, and the names

- [ ] The title menu's rows: Skirmish, Story, Settings, About, Exit. Skirmish starts one battle with the defaults
      (Vasse as the player against Dob Hunter's `balanced` script on the Crossing, a seed from the clock) until the setup
      screen lands.
- [ ] The names in the code, the files and the routes: `skirmish` and `skirmish?seed=<n>`; `story` and
      `story?mission=<id>&round=<n>` for a mission; the `campaigns/` folder and the `campaign` words become Story's.
- [ ] The run retired: its draft, its next-battle screen and its summary, `src/run/`, the army files' `run` field and the
      routes that open it. What a Skirmish needs from it (a duel on the Build Phase screen, the result dialog) moves to
      Skirmish, and the player's side fields the Commander's whole army, not the run's small one.
- [ ] The Story row opens what Campaign opens today: a placeholder screen until the Story menu (Milestone 4).
- [ ] The tests that pinned a run are deleted with it or re-pinned on a Skirmish, each with a reason.
- [ ] The playable browser page opens on a Skirmish.

### Step 17D — The save file, headless

- [ ] The save file's format ([`skirmish-saves.md`](../system-design/skirmish-saves.md), the save file): `setup` (map,
      seed, slots, goal, modifiers, rounds, round length, settings), `start` (what a person adds to round 1), `round`,
      `state` and `draft`; a JSON Schema checked in beside it. A file the loader refuses is refused by name, every problem
      at once.
- [ ] **`skirmish`**: `bin/duel.ts` renamed and given `--load`: `play` (a whole battle), `round` (one round from a save,
      plans for some slots and scripts for the rest, writing the next save and the round's report), `brief` (what a slot
      knows), `bench`, and the file flow (`new`, `wait`, `submit`, `status`). `npm run skirmish`.
- [ ] Slots on the command line as `<commander>:<controller>` (`dob:script:rush`); `--slot B=<controller>` changes a
      loaded save's controller. The log is written beside, never inside (`--log <file>`).
- [ ] **Determinism holds across a save**: saving at any round, loading and playing on gives the same hashes as playing
      straight through, on Node and Bun.
- [ ] A few saves checked in as examples, each played by a test: a fresh setup, a mirror, a Commander against another
      with units already in place, round 4 of a battle, and a short battle of four rounds on the Pocket, so a playtest
      fits in ten minutes.

### Step 17E — Slots, profiles, the goal and modifiers

- [ ] **Script profiles** in `players/scripts/`: one file per profile naming its script (today's `balanced`, `rush`,
      `turtle` and their variants, the same ones the measurements play), its options and a line saying how it plays.
      The opponent's credits are an option of every profile, a share of the curve (100% unless set): there is no
      difficulty setting (the owner, 2026-11-11).
- [ ] **Agent profiles** in `players/agents/`: the folder and one example Markdown file, so the format reserves
      `agent:<profile>`. Loading one says plainly that agent players are not built yet (Milestone 21).
- [ ] **The goal**: Elimination, the only one built; the setup names it so others can follow.
- [ ] **Two modifiers**, `fast-rounds` and `double-income`, as named rules over a battle, each with a test; the list is a
      place to experiment, and the ones that do not earn a place are removed.

### Step 17F — The setup screen, and spectating

- [ ] Skirmish on the title menu opens **New game** and **Load game**. New game: the map, then each slot's Commander and
      controller (`Player: <name>`, `Scripted: <profile>` with its options), the goal, the modifiers, the seed. Every row has
      a default, so Enter starts at once.
- [ ] Load game lists the save files; for the one chosen, the controllers, their options, the modifiers and the settings
      may be changed before it opens, not the map or the Commanders.
- [ ] **Spectating**: with no `Player:` slot, the Build Phase offers only Explore Map and Start next round, and plays the
      scripts' plans.
- [ ] Keys, mouse and driver, its hotkeys shown, adapting across the viewport range like every other screen
      ([`ui-patterns.md`](../system-design/ui-patterns.md), the checklist for a new screen). Two `Player:` slots are
      refused until Versus.
- [ ] The result dialog offers the same battle again, a new seed, or the setup screen.

### Step 17G — Save game

- [ ] **Save game** on the Build Phase's game menu writes a new save file (named by the player, or over the one loaded),
      with the plan so far as its draft; loading it returns to exactly that screen. Saving and loading happen only at a
      Build Phase (the owner, 2026-11-12).
- [ ] The playtest script and the game open a save directly: `--load <file>`, with the same `--slot` and `--modifiers`
      as the `skirmish` command; the route is `skirmish?load=<file>`.

### Step 17H — Notes from a playtest

The parked idea of notes made inside the game ([why it was parked](../history/reports/2026-10-01-feedback-pipeline-parked.md)),
brought back on 2026-11-12, built on save files: a note is the moment itself, not a paragraph describing how to reach it.

- [ ] **A note key**, on every screen: one line to type (Enter alone is fine), and it saves a note file: the save as the
      round's Build Phase opened, the named commands pressed since, with their times, the screen as text, the line, and the
      last Activity Logs events. The browser page copies the same note as text to paste.
- [ ] **A note replays**: the game, the playtest script and the browser page open a note at its moment (`--note <file>`),
      so an agent sees exactly what the player saw.
- [ ] The feedback round skill reads note files the way it reads a settings export.
- [ ] Optional, behind an Experiment: one keypress at the end of a round to rate it, 1 to 5, kept in the note.

A note is not the replay format (still in the backlog): no content locks, no version checks; only the game that wrote it
promises to replay it.

### Step 17I — Skirmish, the place to test

- [ ] The playtest script, its skill, the browser page and the screenshot capture start from a save file instead of
      PERIMETER; a mission is still opened by its route when a change is about a mission.
- [ ] The testing pages, the `duel` skill (renamed `skirmish`) and the playtest skill say which save shows which rule,
      and how an agent plays round by round ([`skirmish-saves.md`](../system-design/skirmish-saves.md), how an agent
      plays a Skirmish).

### Step 17J — Scenarios become saves

- [ ] The engine's rule and bench maps (`scenarios/`) and the duel maps (`src/duel/maps.ts`) move into the format:
      maps to `maps/`, scenarios to `saves/` (a rule map is a save with its map drawn inline and `script:idle` slots).
      Converted by a script; every test and every recorded hash unchanged.
- [ ] `grid` and the measurement read save files; the scenario loader is deleted once nothing reads it.

### Step 17K — Playing it

- [ ] Mario plays the session this milestone is for: Skirmish, New game, a map and two slots, a few rounds, Save game;
      later Load game and carries on; then asks an agent to play his save on with scripts on both sides and say how it
      ends. His notes become a feedback round.

## Out of scope

- Reading the opponent, a battle that stays open, the scripts planting the banner, a script that answers, friends
  playing: Milestone 20.
- Agent players beyond the reserved profile folder: Milestone 21.
- Goals beyond Elimination, modifiers beyond two, Versus and anything over a network.
- Pausing and rewinding a battle, and the replay format.
- The worker economy (Milestone 7) and new units (Milestone 12), which may be built beside it.

## How it is judged

Automated: a save played on after loading hashes as the uninterrupted battle on Node and Bun; every save checked in is
played by a test; `skirmish round` turns a save and a plan into the next save; the setup screen at every colour depth and
across the viewport range; the driver plays a whole Skirmish, spectating included, with no terminal.

Human: Mario's session above, start to save to load to an agent's report, without asking how.

## Done when

- [ ] Steps 17A, 17C to 17K are built and tested (17B only if the stance replaced the banner).
- [ ] No mode, route, file or screen says Campaign or Challenge, and no document says scenario where it means a save.
- [ ] `./scripts/check-repository.sh` passes.
