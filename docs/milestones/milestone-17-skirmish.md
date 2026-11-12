# Milestone 17 — Skirmish: setup and save files

**Status:** CURRENT
**Current step:** 17K — the owner plays the session this milestone is for (17C to 17J are built; 17A, the banner, waits on his playtest).
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

**While 17A waits on Mario's playtest**, the steps that do not depend on his answer about the banner go on (his word,
2026-11-12: "Keep going until the whole Skirmish design is implemented"). The first content pass (units that counter each other, Milestone 12) may run beside this milestone: it needs
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

- [x] The title menu's rows: Skirmish, Story, Settings, About, Exit. Skirmish starts one battle with the defaults
      (Vasse as the player against Dob Hunter's `balanced` script on the Crossing, a seed from the clock) until the setup
      screen lands (the seam: `openSkirmish`, `src/cli/skirmish-open.ts`).
- [x] The names in the code, the files and the routes: `skirmish`, `skirmish?seed=<n>` and `skirmish?load=<file>`;
      `story` and `story?mission=<id>&round=<n>` for a mission; the `campaigns/` folder (now `stories/`, each
      `story.json`) and the `campaign` words become Story's. `campaign` and `challenge` routes are refused with what
      replaced them.
- [x] The run retired: its draft, its next-battle screen and its summary, `src/run/`, the army files' `run` field and the
      routes that open it, and `duel run`. What a Skirmish needs from it (a duel on the Build Phase screen, the result
      dialog) moves to Skirmish (`src/cli/skirmish-play.ts`), backed by the save model, and the player's side fields the
      Commander's whole army, not the run's small one. The result offers the same battle again (Enter) or a new seed (`n`).
- [x] The Story row opens what Campaign opened: a placeholder screen until the Story menu (Milestone 4).
- [x] The tests that pinned a run are deleted with it or re-pinned on a Skirmish, each with a reason.
- [x] The playable browser page opens on a Skirmish.

### Step 17D — The save file, headless

Taken before 17C on the owner's word (2026-11-12, [his words](../history/feedback/2026-11-12-skirmish-command.md)): "start
working on implementing the skirmish save files, and then convert the current testing scenarios", with one `skirmish`
command in place of `play`, `round` and `brief`, and the slots numbered `p1` and `p2`.

- [x] The save file's format ([`skirmish-saves.md`](../system-design/skirmish-saves.md), the save file): `setup` (map,
      seed, slots, goal, modifiers, rounds, round length), `state` (the battle after the regroup, without the map's
      ground) and `draft`; a JSON Schema checked in beside the examples (`saves/save.schema.json`). A file the loader
      refuses is refused by name, every problem at once. `start` waits for 17J, which needs it.
- [x] **`skirmish`**, one command: `--map` or `--load`/`-f`; with no plan the brief of every slot a player plans; with a
      plan given at its slot (`--p1 build:plan.json`) the plan checked by the Build Phase's rules, each refusal with its
      reason; with `--battle` both sides built and the Battle Round played; `--save` writes the next Build Phase.
      `npm run skirmish`. `duel` folded into it on 2026-11-12 (step 17J, the last item).
- [x] Slots as `--p1`/`--p2` with `build:<file>` or `script:<name>`; a load keeps each slot's controller unless one is
      named; a loaded battle refuses a new map, seed or Commander. The log is never in a save.
- [x] **Determinism holds across a save**: saving after every round, loading and playing on gives the same hashes as
      playing straight through, on Node and Bun.
- [x] Saves checked in as examples, each loaded and played a round by a test: a fresh setup, a mirror (spectating),
      round 4 of a battle, and a short battle of four rounds on the Pocket. A Commander against another with units
      already in place waits for `start` (17J).


### Step 17E — Slots, profiles, the goal and modifiers

- [x] **Script profiles** in `players/scripts/`: one file per profile naming its script (today's `balanced`, `rush`,
      `turtle` and their variants, the same ones the measurements play), its options and a line saying how it plays.
      The opponent's credits are an option of every profile, a share of the curve (100% unless set): there is no
      difficulty setting (the owner, 2026-11-11).
- [x] **Agent profiles** in `players/agents/`: the folder and one example Markdown file, so the format reserves
      `agent:<profile>`. Loading one says plainly that agent players are not built yet (Milestone 21).
- [x] **The goal**: Elimination, the only one built; the setup names it so others can follow.
- [x] **Two modifiers**, `fast-rounds` and `double-income`, as named rules over a battle, each with a test; the list is a
      place to experiment, and the ones that do not earn a place are removed.
- [x] More on the command line (the owner, 2026-11-12): two plans of one's own against each other, `--battles <n>`,
      `--play-until-win`, `--seeds` with a tally, `--out` for every round's save and report, `--log` for the battle's log,
      and `--p1-credits`/`--p2-credits`.

### Step 17F — The setup screen, and spectating

- [x] Skirmish on the title menu opens **New game** and **Load game** (`skirmish?setup`). New game: the map, then each
      slot's Commander and controller (`Player: <name>`, `Scripted: <profile>` with its credits share, `Agent: curious`
      dimmed), the goal, the modifiers, the seed (typed). Every row has a default and the screen opens on Start, so Enter
      starts at once (`src/cli/title-screens.ts`, `src/skirmish/setup.ts`).
- [x] Load game lists the save files (the saves folder, then `saves/`); for the one chosen, the controllers, their credits
      shares and the modifiers may be changed before it opens, not the map or the Commanders. The settings are the
      Settings screen's.
- [x] **Spectating**: with no `Player:` slot, the Build Phase offers only Explore Map and Start next round, and plays the
      scripts' plans. Every round on screen is played by `playNext` with the profiles, as headless (a test holds them
      equal); the browser page carries the profiles and example saves as JSON imports.
- [x] Keys, mouse and driver, its hotkeys shown, on the title menu's 80 × 24 frame
      ([`ui-patterns.md`](../system-design/ui-patterns.md), the setup screen). Two `Player:` slots, an agent and p2 as the
      only player are refused, the reason said. The scripted playtest drives the title menu too (`src/playtest/game.ts`).
- [x] The result dialog offers the same battle again, a new seed, or the setup screen (`[m]`, New game on that battle's
      setup).

### Step 17G — Save game

- [x] **Save game** on the game menu (Esc, `[v]`; the owner, 2026-11-12: "on the main menu settings "[esc]" instead of in
      the side menu") writes a save file named by the player, offering the file loaded or last saved to, or a new name in
      the saves folder beside the settings, with the plan so far as its draft; loading it returns to exactly that screen,
      which then plays as the uninterrupted one. Saving and loading happen only at a Build Phase (the owner, 2026-11-12):
      Save game is dimmed on a story mission and refused once the plan is locked in.
- [x] The playtest script and the game open a save directly: `--load <file>`, with the same `--p1`/`--p2` as the
      `skirmish` command (a plan file for p1 is laid on the first Build Phase); the route is `skirmish?load=<file>`.
      `--modifiers` waits for the modifiers (17E).

### Step 17H — Notes from a playtest

The parked idea of notes made inside the game ([why it was parked](../history/reports/2026-10-01-feedback-pipeline-parked.md)),
brought back on 2026-11-12, built on save files: a note is the moment itself, not a paragraph describing how to reach it.

- [x] **A note key**, `!`, on every screen: one line to type (Enter alone is fine), and it saves a note file: the save as the
      round's Build Phase opened, the named commands pressed since, with their times, the screen as text, the line, and the
      last Activity Logs events, into `~/.terminal-nexus/notes/` (`src/cli/notes.ts`). The browser page copies the same
      note as text to paste.
- [x] **A note replays**: the game and the playtest script open a note at its moment (`--note <file>`), so an agent sees
      exactly what the player saw. The browser page opening one is not built: a note is too long for its address.
- [x] The feedback round skill reads note files the way it reads a settings export.
- [ ] Optional, behind an Experiment: one keypress at the end of a round to rate it, 1 to 5, kept in the note.

A note is not the replay format (still in the backlog): no content locks, no version checks; only the game that wrote it
promises to replay it.

### Step 17I — Skirmish, the place to test

- [x] The playtest script, its skill, the browser page and the screenshot capture start from a save file instead of
      PERIMETER (`saves/crossing-new.save.json` when told nowhere; the capture's battle shots from saves); a mission is
      still opened by its route when a change is about a mission.
- [x] The testing pages, the `duel` skill (renamed `skirmish`) and the playtest skill say which save shows which rule,
      and how an agent plays round by round ([`skirmish-saves.md`](../system-design/skirmish-saves.md), how an agent
      plays a Skirmish). Said (DEVELOPMENT.md's table of saves, the testing ground, the playtest and `skirmish` skills).

### Step 17J — The testing saves

Shaped on 2026-11-12 ([his words](../history/feedback/2026-11-12-skirmish-saves.md)): keep the maps that still test
something, in a folder of their own (`skirmish-testing/`), remove those that no longer add much, and drop the old word
for the concept from the files, the documents and the code.

- [x] A save's `start`: what each slot has on the Grid before round 1, by hand (its units and buildings as rows and a
      legend, starting health included, and where its troops head). A save with a `start` is a **testing save**: one
      Battle Round, both slots `script:idle`, its map drawn inline (a `legend` for ground beyond `. # *`; `nexus` and
      `hold` optional), its slots' Commanders optional. `readSave` names every problem at once, the units' fit
      included. A side's credits and roster in `start` wait for a save that needs them.
- [x] The engine's rule, unit, movement, bench and showcase maps are testing saves in `skirmish-testing/`, by folder,
      with the trial files in `skirmish-testing/trials/`; converted by a script, and every Battle Round opens to the
      same state hash and plays to the same events as before (every pinned hash unchanged, on Node and Bun). One map
      removed: the colossus before a two-tile gap, which its own notes called a confirmation of the hauler's, not a
      new case.
- [x] `grid`, the trials (`--against` an older commit included), the measurement, `profile-routes`, the picture scripts,
      the browser page's two showcase battles and every test read testing saves; the old loader is the opening a
      testing save starts from (`src/skirmish/opening/`). `skirmish --load <testing save> --play-to next` plays the same
      Battle Round and prints `grid`'s report.
- [x] The duel maps as files in `maps/` (`crossing.map.json`, `pocket.map.json`, the shape a save draws a map in), read by
      `src/duel/maps.ts` and offered by id.
- [x] **`duel` folded into `skirmish`** ([his words](../history/feedback/2026-11-12-skirmish-command.md): "there's no
      need to have two commands for the same thing"): every pairing of Commanders from both sides over seeds
      (`--commanders`), and a finished battle's every report on loading it. The command's file is its manual and its options alone; the work is in its modules, the
      steps the screen shares in `src/skirmish/request.ts`; each document says the command at its own level (the
      manual in the code, the testing uses in the testing ground, the duel's rules in its page, the game in the game
      modes). The `cmd:` player, a command run each round, is gone: a model plays through the save file.
- [x] **No turns, build actions, `--play-to`** ([his words](../history/feedback/2026-11-12-skirmish-command.md): "in
      Terminal Nexus there are no turns"): a round's "plan" is now **build actions** everywhere (code, command, brief,
      documents); a build file holds them by round (`"round": 3`, `"2-4"`, `"*"`), played blind; `--play-to next|n|end`
      replaces `--battle`, `--battles` and `--play-until-win`, stopping at a Build Phase with the briefs of the slots
      that have nothing for it; the two-session `--wait` and `--ready` are gone (either slot hands its actions in alone,
      in any order). The rule written into the concept: every player answers the same brief, and clashes, powers and
      upgrades settle together as the Battle Round starts (two Nexuses falling on one tick is a draw, tested). Build
      files with conditions are the next pull request's proposal ([`build-files-with-conditions.md`](build-files-with-conditions.md)).

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
played by a test; `skirmish --play-to next` turns a save and build actions into the next save; the setup screen at every colour depth and
across the viewport range; the driver plays a whole Skirmish, spectating included, with no terminal.

Human: Mario's session above, start to save to load to an agent's report, without asking how.

## Done when

- [ ] Steps 17A, 17C to 17K are built and tested (17B only if the stance replaced the banner).
- [ ] No mode, route, file or screen says Campaign or Challenge, and every document outside the history calls a hand-written Battle Round a testing save.
- [ ] `./scripts/check-repository.sh` passes.
