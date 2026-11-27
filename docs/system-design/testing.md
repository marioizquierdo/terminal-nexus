# Terminal Nexus — testing

_Unit tests and verifiers and the layer each belongs at, how to verify through the `skirmish` command, what the suite proves, how a test is named, what only a person can judge, and the balance measures that will matter later; every unmarked statement is GUIDANCE._

The suite lives in `tests/` and runs on Node and on Bun (`scripts/run-tests.sh`); how to run it, and the order a change
is developed in, is in `DEVELOPMENT.md`, "Developing and testing a change". This page says what the tests are *for*.
Every engine defect should reduce to a state, seed and tick count; every balance claim should identify a reproducible
set of battles.

## Two kinds of check: unit tests and verifiers

A **unit test** is kept: it lives in `tests/`, runs on every build and pull request on Node and Bun, and is fast. It holds
one rule, at the layer that owns the rule ([`architecture.md`](architecture.md), the layers), named for that rule, and it
stays true for every later change. The suite is the sum of them, and its cost is paid on every push, so a slow test or a
test at the wrong layer is a defect.

A **verifier** is the check a session runs to show that its own task works: a `skirmish` run that shows the new unit
fighting, a `measure` comparison of before and after, a scripted playtest that presses the keys a feature needs, a probe
in the scratchpad, or a test written for the task. It answers the task's question once and is not kept, unless its rule
must hold for every later change: then it becomes a unit test at the right layer, small and fast. A session that cares
about something no other session will is a verifier's job, never the suite's.

| The question | The layer | A unit test | A verifier |
| --- | --- | --- | --- |
| Does a rule of the Battle Round hold (a hit, a death, a step, an ability, an effect on state)? | the battle engine | a state written in the test (`defineOpening`, `openBattle`) or a sandbox, run with `resolvePulse` or `playSandboxRound`, asserted on events and state | a sandbox played by `skirmish --load <sandbox> --play-to next --show 0,end --log-level info` |
| Is the opening of a round built right (the regroup, a banner, a Commander's return, training)? | the rules between rounds | `src/match/` called directly | `skirmish --load <save> --play-to next --show 0` |
| Does the game play right over rounds (credits, the hand, build actions, who wins)? | the game | `src/battle/` or `src/skirmish/` called directly, or the `skirmish` command with a build file | the `skirmish` command, a save and build files or scripts, one battle or many seeds |
| Did a change move the balance? | the game, many battles | none: a pin of a measured number only where a rule depends on it | the `measure` command, before and after ([`measurement.md`](measurement.md)) |
| Does a screen read and respond right? | the doors | the screen's frame from a stand-in terminal, keys as bytes | the scripted playtest, its text and pictures read |

A sandbox is a save whose `start` sets the battlefield up by hand ([`skirmish-saves.md`](skirmish-saves.md), a battlefield written by
hand): the engine's context for one rule, effect, movement or ability. It measures what happens on the battlefield (damage,
deaths, paths, timings), not who wins a game.

## Verifying through the `skirmish` command

**A Skirmish played headless is the one the screen plays** (RULE — `src/skirmish/play.ts`, `tests/skirmish-save.test.ts`):
the same save, seed and build actions give the same battle, hash for hash, on Node and Bun. Every option, with
examples, is in the command's manual (`npm run skirmish -- --help`); the `skirmish` skill has the procedures. The shapes
a verifier takes, cheapest first:

- **One Battle Round from a battlefield set up by hand**: a sandbox, or a copy of one changed for the question (another unit
  in the legend, another seed, more ticks). `--show 0,60,end` draws the battlefield at those ticks, `--log <file>
  --log-level info` keeps every event.
- **A battle from where a save stands**: a save at a Build Phase, its slots played by scripts (`--p1 script:turtle`) or
  build files (`--p1 build:b.json`, one round or a list by round), `--play-to next`, a round, or `end`.
- **Many battles**: `--seeds 1-20` for a tally, `--commanders all` for every pairing from both ends. Swap the slots'
  scripts and play again before reading a side into it.
- **A model a slot**: both slots players; each round the session hands each slot's brief to its own small agent and
  plays the build actions it answers with (`-f <file> --p1 build:<a> --p2 build:<b> --play-to next`).
- **A moment for a person**: every save the command writes opens on the game's screen (`terminal-nexus --load <file>`),
  so an agent prepares the round Mario should play and hands over one line.

**What these battles are and are not.** A scripted or small-model player is not a good player: it shows what an army
does in the hands of a plain plan, where its strengths come from, and where the rules or the brief let a player down.
It does not show balance. Read the numbers for direction, the reports for why, and say so every time.

## Invariant tests: every reading counted two ways

Most of what a tester has caught could have been caught by one number counted two ways. So **a new reading (a number
the brief, a report, a log or a measurement states) ships with a second way to count it, and the comparison is a test**:
an invariant, named for the rule it holds ("an engagement's damage sums to its side's total damage", "the other side's
private fields are absent from a brief"). Held today in `tests/reading.test.ts`: the damage in a side's engagements against the damage it dealt, and the other side's
private fields absent from the JSON brief. A blocked count set beside a count of units that struck
([`measurement.md`](measurement.md), what the numbers say) is the same habit.

Done when the test fails if either count is wrong: break the reading once on purpose and watch it go red.

## Tester agents: one goal each

Tests with an assertion miss what a tester with a goal finds: six agents, one job each, found in an hour two bugs the
suite passed (engagements that dropped every killing blow; a brief that carried the other side's credits). Each goal
becomes an invariant, so the next change meets it as a test. The goals worth sending after a step:

| Goal | The tester |
| --- | --- |
| Audit a reading | counts it two ways and reports every disagreement |
| Play to win | plays one side against a script, from the brief alone, and reports what it wanted and could not see |
| Break the command | gives `skirmish` or `measure` odd input: a flag with a value it does not use, a seed or tick out of range, two options that contradict. Every one is refused or says what is not done; a flag that ignores its input is a bug |
| Check the documents against the code | reads a page and runs what it claims |

Give each tester one goal, one command to start from and the order to report counts, not opinions. **Sonnet for most; one
Opus at a milestone's end** for contradictions and adversarial play: the quicker model finds the gap (a player that won in round
3 wanted the enemy's credits and a refusal's reason), the stronger finds the contradiction (a player that won in round 1
found a brief with no units beside a Nexus at 400). Both readings are worth having; the second costs more.
Findings are fixed, and the lessons logged in [`docs/history/lessons-learned.md`](../history/lessons-learned.md),
before Mario is asked to play anything.

## What the suite proves

### Determinism and the battle engine's purity

RULE — `tests/determinism.test.ts`, `tests/architecture.test.ts`, `tests/rng.test.ts`.

- The same opening, seed and tick count produce identical final-state and event hashes across twenty
  runs of every checked-in sandbox, and the same INFO log; the suite runs on Node and on Bun, which one runtime can
  never check alone.
- Resolving in one call equals resolving tick by tick. A different gameplay seed can change the fight,
  and the same one never does. State and the event stream round-trip through their canonical
  serialization and hash identically.
- The battle engine calls no clock and no `Math.random`: asserted both by replacing them with functions that
  throw during a real resolve, and by scanning the source of every deterministic folder for them and for
  the terminal.
- The import graph is held in one place: `src/engine` imports nothing above it but the content definitions;
  `src/view` never reaches the engine; the simulation never reaches a glyph; armies are data; no
  source file imports a package the repository has not pinned.
- Changing only the cosmetic seed changes nothing about state, events or the log. The gameplay generator
  is checked against published PCG32 vectors.

### The battlefield's occupancy and masks

RULE — `tests/layers.test.ts`, `tests/rules.test.ts`.

- No two entities overlap in a collision mask that includes both their layers, at any tick of any
  sandbox; a worker and a ground unit may share a tile; a ground unit is blocked by a structure on a
  different layer; an air unit crosses terrain a ground unit never could.
- A multi-tile entity is tested by its whole footprint: a three-wide hauler is refused a two-tile gap
  and admitted a three-tile one, range measures to the nearest occupied tile, and the entity is damaged
  and destroyed as one.
- Arbitration terminates under a bounded pass count with a decreasing progress measure, and contested
  claims resolve by speed tier before the seeded stream is consulted. Movement credit reproduces the
  cadence table at every rate and never exceeds one step's cost.

### Every engine rule has a test at the engine

RULE — `tests/sandboxes.test.ts`, `tests/rules.test.ts`, `tests/proving-grounds.test.ts`, `tests/sandbox-spawn.test.ts`.
An engine rule is asserted through events and hashes from a state on a map: a state written in the test, or a checked-in
sandbox named for what it shows (`melee-kill`, `worker-flight`, `hauler-two-tile-gap`, `settle-delay`, the `route-*`
shapes and the rest of `sandboxes/`). Every sandbox reads as a save, every problem at once, loads with an id that matches
its name and gives each side that fights somewhere to go; every unit and building the content holds stands alone in a
slice and runs without failing. The rules between rounds (openings, the regroup, the Commander's return) are held by
`tests/match.test.ts`, `tests/regroup.test.ts` and `tests/commander.test.ts`; routing's own parts are tested alone on small
battlefields and mazes, against a plain search (`tests/routing.test.ts`).

### Structured-cell snapshots across backends

RULE — `tests/view.test.ts`, `tests/backend-opentui.test.ts`, `tests/roles.test.ts`,
`tests/see-through.test.ts`. The frame is engine-owned, so two backends drawing the same frame must
produce the same characters. Frames are exactly the composition size, a tile to a column at every terminal size; every glyph
is one printable ASCII cell; identical arguments give identical frames and skipping frames changes
nothing; at a tick boundary every entity stands on the tile the engine put it on; monochrome renders
every sandbox with no cell depending on colour to exist; the compositor emits only roles from the
committed vocabulary. Direct ANSI, OpenTUI (where its native core loads) and the canvas resolve one
mixed cell to the same colours, and turning effects off changes only the picture (`tests/effects.test.ts`).

### The terminal lifecycle through one disposer

RULE — `tests/lifecycle-backend.test.ts`, `tests/lifecycle-build-phase.test.ts`, `tests/lifecycle-title-menu.test.ts`. Each
runs a real screen loop against fake streams, because the lifecycle cases matter more than the frame
rate. `q`, an interrupt byte, `SIGINT`, `SIGTERM`, a setup failure and a caught render failure all reach
the same idempotent disposer exactly once; raw mode, the alternate screen, mouse reporting and the key
event flags are left off on every one of those paths and never popped when never pushed; a non-TTY
launch writes no escape sequences at all; below 80 × 24 the screen gates and resumes from the same
instant. A renderer that leaves the terminal in raw mode is a reason to reject it.

### Keyboard, mouse and driver parity

RULE — `tests/title-menu-adapters.test.ts`, `tests/key-events.test.ts`, `tests/playtest.test.ts`,
`tests/build-motion.test.ts`. Keyboard, mouse and the scripted driver must reach the identical named
command from *raw input*: every case starts from a byte or an SGR mouse sequence, never a hand-built
command, and mouse coordinates come from the same layout functions the composer draws with. The same
intent as timed presses and as press, repeat and release events lands on the same tile. A script's key
names map to the exact bytes a terminal sends, an unknown name fails loudly, and a click goes through
the mouse adapter wherever the tile is drawn.

### The Build Phase's test base

Most Build Phase tests open on the starter map's Skirmish (`saves/starter.save.json`, `starterContext`) laid out as
`testBase` (`tests/starter-fixture.ts`): a Barracks standing beside the Nexus, a menu of four and War Chest beside the
hand, the base the screen's tests were written against. A test that plays the round's battle uses the starter round
itself, `barracksLevel` when it needs that Barracks in the battle, or the test battle (`tests/pulse-helpers.ts`), whose
raid and squads it sets. The Commander's fixtures (`tests/commander-fixture.ts`) are a battle she falls in and one she
fights in.

### Armies load whole or are refused whole

RULE — `tests/armies.test.ts`. The shipped armies load, and a broken one is refused with every problem at once, each
naming where: a card or a Commander from an army it does not require, a content id that does not exist, a duplicate
id, a schedule that deals a rarity before its act ([`content.md`](content.md)). (Story's files and their levels were
loaded and checked here too until Story stopped, 2026-11-26.)

### Every route opens where it says

RULE — `tests/route.test.ts`, `tests/route-open.test.ts`. Each route parses to its place or is refused
with every problem at once; each title menu place opens through the title menu's loop and each level at
each round through the Build Phase's, on a stand-in terminal; a row and its route draw the same frame; a
route to round 2 is the screen the keys reach ([`routing.md`](routing.md)). A route, a settings text and a
key script are read as one launch, once, for the game, the scripted playtest, the page's address and a demo:
what cannot be read is said part by part and left out, a route that is not a place opens the host's own
start, and every launch part reaches the game's argument parser as an option (RULE — `tests/launch.test.ts`).

### The browser page held to the terminal

RULE — `tests/web.test.ts`. The page must run the terminal's own code, never a copy of it, and four
checks stop it drifting: nothing Node-only is reachable from the page (checked on the import graph and
by the build itself); the bundled code, run in a sandbox with no Node features, fingerprints a battle, a
Build Phase and a menu exactly as Node does (Bun only, since the bundler is Bun's); the canvas paints
the same characters and colours as the terminal; and the page's keys are the playtest's keys, one table
of what a terminal sends.

### Timing features as pure functions of time

RULE — `tests/effects.test.ts`, `tests/animation.test.ts`, `tests/tween.test.ts`,
`tests/playback.test.ts`, `tests/build-motion.test.ts`. Anything with a duration is tested as a function
of a number, never by waiting: an effect sampled at *t* alone equals the same effect after every
intervening frame; a track's frame is a pure function of its requests; a tween retargets from where it
is drawn; presentation time advances by speed and freezes behind the resize gate; the Build Phase's
animations and key timing take the time as an argument and name no clock (`tests/architecture.test.ts`).
`tests/performance.test.ts` measures thirty frames a second for sixty seconds, judged by what a player
would see rather than the single slowest sample.

### Not yet tested

Not built, so not claimed: property tests over occupancy, resources and supply; soak tests over generated
maps and seeds; replay round trips ([`replay-format.md`](replay-format.md)); clean-install and packaging tests.

## How a test is named

A test is named for the rule it holds, in words: "a vacated tile stays blocked for
`DEATH_SETTLE_TICKS` after the entity on it dies", never for the place the rule is written down. The
reason is drift. The validator compares documents against documents, and the moment code exists there
are two copies of every table with nothing comparing them; a test named for the rule turns drift into
a failing test whose name says what broke. A RULE in a design document points at the test or module
that holds it, and the test never points back at a section number, so splitting or moving a document
never renumbers anything.

A prefix naming a document section (`engine-3.3-markers`) is retired and no test carries one.

## Human playtests

A passing test is not proof of how something feels, and a screen that is correct can still read badly.
Only a person can judge recognition (does a letter read as a soldier), emotional impact, comprehension
of what a screen is asking, strategy, and whether they want to watch again; and only Mario can judge a
timing, a look or whether a feature should exist: whether the banner feels strategic, whether a screen reads, whether a
battle is fun. Those judgements are kept apart from automated results: a settings export or playtest note is feedback to
settle, never a test result, and no automated check stands in for it. Numbers and testers reach everything else
first, so Mario's time goes only where they cannot. The scripted playtest returns every screen as text and pictures so a
change can be seen before it is claimed.

## What earlier rounds learned

- **Set a battle up as the game sets it up.** A rule once seemed to cut blocked time by nine tenths: its units had
  stopped trying, on maps that gave no side a target.
- **Check a battlefield before trusting it.** A battlefield drawn as mirrors gave one end 27 battles to 7: a Nexus placed by its
  corner. Play it from both ends.
- **Vary the opening and play enough.** One layout turns on tie draws alone; both ends and a dozen seeds before a few
  percent means anything.
- **Read the whole report**, not only who won: units at a narrow pass once changed target every tick, at four times the
  route work, while their win rate gave no sign of it.
- **Look at one battle** (`--show`, `--log`) before believing a number that moved a lot.

## Balance metrics

Once there is content to balance, the numbers to watch are win rate, match length, resource flow,
worker uptime, production contention, supply stalls, unit survival, building lifetime, salvage
recovery, territory coverage, upgrade selection, commander uptime, Nexus damage timing and comeback
frequency. Statistics diagnose; they do not define fun.
