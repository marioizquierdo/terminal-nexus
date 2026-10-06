# Terminal Nexus — testing

_What the test suite proves, how a test is named, what only a person can judge, and the balance measures that will matter later; every unmarked statement is GUIDANCE._

The suite lives in `tests/` and runs on Node and on Bun (`scripts/run-tests.sh`); how to run it is in
`DEVELOPMENT.md`. This page says what it is *for*. Every engine defect should reduce to a state, plan,
seed or event fixture; every balance claim should identify a reproducible cohort.

## What the suite proves

### Determinism and the kernel's purity

RULE — `tests/determinism.test.ts`, `tests/architecture.test.ts`, `tests/rng.test.ts`.

- The same scenario, seed and tick count produce identical final-state and event hashes across twenty
  runs of every checked-in scenario, and the same INFO log. `tests/grid-cli.test.ts` repeats the check across
  runtimes, which one machine and one runtime can never do alone.
- Resolving in one call equals resolving tick by tick. A different gameplay seed can change the fight,
  and the same one never does. State and the event stream round-trip through their canonical
  serialization and hash identically.
- The kernel calls no clock and no `Math.random`: asserted both by replacing them with functions that
  throw during a real resolve, and by scanning the source of every deterministic folder for them and for
  the terminal.
- The import graph is held in one place: `src/pulse` never reaches the view, the report or the shell;
  `src/view` never reaches the kernel; the simulation never reaches a glyph; missions are data; no
  source file imports a package the repository has not pinned.
- Changing only the cosmetic seed changes nothing about state, events or the log. The gameplay generator
  is checked against published PCG32 vectors.

### The Grid's occupancy and masks

RULE — `tests/grid.test.ts`, `tests/rules.test.ts`.

- No two entities overlap in a collision mask that includes both their layers, at any tick of any
  scenario; a worker and a ground unit may share a tile; a ground unit is blocked by a structure on a
  different layer; an air unit crosses terrain a ground unit never could.
- A multi-tile entity is tested by its whole footprint: a three-wide hauler is refused a two-tile gap
  and admitted a three-tile one, range measures to the nearest occupied tile, and the entity is damaged
  and destroyed as one.
- Arbitration terminates under a bounded pass count with a decreasing progress measure, and contested
  claims resolve by speed tier before the seeded stream is consulted. Movement credit reproduces the
  cadence table at every rate and never exceeds one step's cost.

### Every rule has a named scenario

RULE — `tests/scenario.test.ts`, `tests/proving-grounds.test.ts`, `scenarios/`. Every rule that can be
shown on a small map has a checked-in, runnable scenario file named for what it exercises
(`melee-kill`, `mutual-kill`, `worker-flight`, `salvage-drop`, `hauler-two-tile-gap`, `settle-delay`
and the rest of `scenarios/`), and every file loads with an id that matches its name. A scenario asserts the
rule through events and hashes, and `grid <map> --verify` (see [`runtime.md`](runtime.md)) re-resolves
it ten times from the command line.
The rules layer above the kernel (openings, Recall, missions) is held the same way by
`tests/match.test.ts` and `tests/mission.test.ts`.

### Structured-cell snapshots across backends

RULE — `tests/view.test.ts`, `tests/backend-opentui.test.ts`, `tests/roles.test.ts`,
`tests/see-through.test.ts`. The frame is engine-owned, so two backends drawing the same frame must
produce the same characters. Frames are exactly the composition size, a tile to a column at every terminal size; every glyph
is one printable ASCII cell; identical arguments give identical frames and skipping frames changes
nothing; at a tick boundary every entity stands on the tile the kernel put it on; monochrome renders
every scenario with no cell depending on colour to exist; the compositor emits only roles from the
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

### Armies load whole or are refused whole

RULE — `tests/armies.test.ts`, `tests/levels.test.ts`. The shipped armies load, and a broken one is refused
with every problem at once, each naming where: a card, a Commander or an unlock from an army it does not
require, a content id that does not exist, a duplicate id, an unlock an earlier level already gave, a mission
with a bad shape. What a level offers adds up level by level in the order first unlocked, and is what its
Build Phase offers: the menu, the credits and the Nexus draft. PERIMETER and the cadence level are pinned by
a hash of each, so moving them into data changed nothing they play ([`content.md`](content.md)).

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

The old convention, an `engine-3.3-markers` style prefix for a document section, is retired; fifteen
tests in `tests/build-camera.test.ts` and `tests/build-view.test.ts` still carry it and are being renamed.

## Human playtests

A passing test is not proof of how something feels, and a screen that is correct can still read badly.
Only a person can judge recognition (does a letter read as a soldier), emotional impact, comprehension
of what a screen is asking, strategy, and whether they want to watch again; and only Mario can judge a
timing, a look or whether a feature should exist. Those judgements are kept apart from automated
results: a settings export or playtest note is feedback to settle, never a test result, and no
automated check stands in for it. The scripted playtest returns every screen as text and pictures so a
change can be seen before it is claimed, and agents can act as invariant hunters and replay critics.

## Balance metrics

Once there is content to balance, the numbers to watch are win rate, match length, resource flow,
worker uptime, production contention, supply stalls, unit survival, building lifetime, salvage
recovery, territory coverage, upgrade selection, commander uptime, Nexus damage timing and comeback
frequency. Statistics diagnose; they do not define fun.
