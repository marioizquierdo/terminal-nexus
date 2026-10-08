# Terminal Nexus — runtime and tools

_The terminal library and runtime choices, the terminal lifecycle, the delivery ladder, logs, the engine tool and modding seams, and scaling; every unmarked statement is GUIDANCE._

## 1. Runtime and terminal direction

Terminal Nexus is TypeScript-first. That does not require any one runtime or terminal library to own
the architecture.

**The terminal library and the JavaScript runtime are independent choices; neither implies the
other.** RULE — `tests/lifecycle-backend.test.ts` ("an explicit backend choice resolves", "auto falls back to
direct ANSI where OpenTUI's native core cannot load"), `tests/backend-opentui.test.ts` (the same frame
through both backends, whichever runtime is running), `scripts/run-tests.sh` (the whole suite on Node
and on Bun). Choose the library on cell-frame behaviour and the runtime on packaging and availability,
separately. Today `@opentui/core` is pinned in `package.json`; its native core loads under Bun and
refuses to build a renderer under Node, and `auto` then falls back to direct ANSI, so the same game
runs on both.

- **OpenTUI imperative core** — the leading path. `OptimizedBuffer.setCell`, mouse, resize, arbitrary
  streams, and a testing harness with a manual clock and frame recorder. Its risks are pre-1.0 churn
  and weight (a 21 MB native library, a 140 MB standalone binary), not capability.
- **Direct ANSI** — the control and the fallback. It must stay small. If it starts needing capability
  discovery, robust input parsing or mouse decoding, that is a measured result, not a to-do list.
- **Terminal Kit** — contingency if direct ANSI starts recreating a library.
- **Ratatui + Crossterm** — **IDEA**, a native contingency. Adopting it creates a Rust boundary and a
  content cost. Not designed; do not assume it.
- **Bubble Tea + Wish** — **IDEA**, a Go hosted-SSH contingency. Not designed; do not assume it.

Bun and Node are both present in the project's environments; Deno is not, and nothing measured needs
it. Versions are pinned in `package.json` and the toolchain is described in `DEVELOPMENT.md`.

## 2. Terminal lifecycle — RULE

RULE — `src/cli/lifecycle.ts`, `tests/lifecycle-backend.test.ts`, `tests/lifecycle-build-phase.test.ts`,
`tests/lifecycle-title-menu.test.ts`.

One alternate screen, **one idempotent disposer**. It restores cursor, input mode, handlers and screen
after normal exit, `q`, `SIGINT`, `SIGTERM`, setup failure and caught render failure. It also switches
terminal mouse reporting off on the same paths, and the kitty keyboard protocol too when the Build
Phase switched it on (see [`input.md`](input.md)). It cannot promise anything after `SIGKILL`. Calling
it twice is harmless. Every screen loop (the engine tool's watch view, the menu, the Build Phase)
builds on the one implementation in `src/cli/lifecycle.ts`; there must not be a second.

Non-TTY launch prints one readable line and no escape sequences. Diagnostics are buffered and emitted
**after** cleanup. Backends report their capability mode explicitly.

A renderer that drops frames is a tuning problem. A renderer that leaves the terminal in raw mode is a
reason to reject it.

## 3. Delivery ladder

Local executable and ordinary PTY; restricted public SSH; browser terminal streaming ANSI to xterm.js;
browser-native renderer consuming events; mobile shell; optional pixel or 3D presentation on the same
semantic contract.

Every rung above the first is an **IDEA**: an architectural possibility, not a commitment. Packaging
and delivery beyond running from the repository are deferred: RULE — a scope rule in `AGENTS.md` (no
code or test holds it).

**The browser playtest page is a development tool, never a platform or a rung.** RULE —
`tests/web.test.ts`, `src/web/`. It exists so the game can be played from a phone during review
(`bun scripts/build-web.mjs`), and it must run the terminal's own screen loops (the menu, the Build
Phase, Battle Round playback) handed a stand-in terminal: it converts frames to pixels, taps and keys to
terminal bytes, and settings to browser storage, and decides nothing about what the game shows or
does. A terminal at 80 × 24 stays the acceptance target; the page never is one. Tools **around** the
screen are the page's to add because they serve the feedback loop (see [`ui-patterns.md`](ui-patterns.md)):
text boxes holding the settings and Activity Logs exports, and demo buttons that open the game at a
route ([`routing.md`](routing.md)), from a key script with given settings. The game's own screen and behaviour stay the terminal's. What a host
would have to provide to run the game elsewhere is in [`portability.md`](portability.md).

## 4. Logs

A log is a record of what happened, for the people and agents who read it afterwards — never an input.
One structured shape serves every log (`src/log/`). RULE — `tests/log.test.ts`.

- **An event is declared before it is logged**: its name, its default level (error, warn, info, debug,
  trace), a sentence on what it means, and each property's type and meaning. An entry is a sequence
  number, a timestamp, a level, the event and its plain JSON properties (string, number, boolean,
  null), kept in memory with the oldest dropped past a limit. A logger takes its clock as an argument,
  and logging never throws.
- **The kernel and the match layer never log, and nothing the rules decide reads a log.** RULE —
  `tests/architecture.test.ts`. The kernel has no clock; its record is its ordered events
  ([`pulse.md`](pulse.md)), from which `grid`'s battle report is derived afterwards, at the same levels.
- **The Activity Logs** record what a player did and what the game answered — commands, refusals,
  placements, settings, a Battle Round's start and result, errors — from the shells and the Build Phase's
  session, never from inside a reducer. The Build Phase's state reads them only to show them in the
  Activity logs window. Which events exist is GUIDANCE: an agent adds one for the interaction a pull
  request asks about and removes it once answered ([`ui-patterns.md`](ui-patterns.md), Feedback loops).

## 5. Tools and modding

First-party development uses explicit definitions and fast tools: maps as inspectable ASCII arrays
plus metadata; armies, units, structures, upgrades, themes and glyphs as validated TypeScript; effects
as typed functions; cutscenes as tableaux and timelines; missions as map, army, objective, trigger and
scene definitions.

**`grid`** — a `.map.json` map file plus a CLI that defines a Grid, places entities, takes a seed and a
tick count, runs or steps a Pulse, and reports what happened — is permanent infrastructure, not spike
residue: it is the fastest feedback loop the project has, for humans and agents alike, and every future
unit gets tested on it. `grid` is the editor and replay tool, not the game; the `terminal-nexus`
executable is what launches the game built on it. What "replay tool" means concretely — reading and
writing a persisted, levelled game log rather than only resolving a map fresh each time — is designed,
not built, in [`replay-format.md`](replay-format.md).

RULE — `tests/grid-cli.test.ts`. There is no subcommand: `grid <map>` takes a path to a `.map.json` file
(the suffix is optional) and defaults to `watch`, the ASCII view; `--headless` resolves without a
terminal and `--verify` re-resolves 10 times and fails on any hash disagreement. One output stream, not
two: a headless run's **levelled log** (default `WARN`) carries the story in fixed, greppable columns,
closed by a `report` line carrying the outcome, the losses and the hashes, so an agent can assert on
behaviour without parsing prose and a designer can read what happened without a second stream to
catch. `--save-log <file>` writes the same lines to a file in any action, and `--turn <tick>` seeks
straight to a tick instead of playing from the start, in `watch`, `--headless` and `--verify` alike.

**Modding-first architecture, not mod-loader-first development.** Seams are kept so that content,
themes and maps could one day be extended from outside; no public SDK, remote loader, marketplace,
permission system or compatibility promise is built. RULE — a scope rule in `AGENTS.md` (no code or
test holds it). Themes may recommend fonts, but a terminal application cannot reliably change the host
font, so every pack keeps an ASCII-safe fallback.

### Scaling toward hundreds or thousands of units

The test scenarios top out at a few dozen actors on a preset Grid. Whether the kernel's shape holds at
"hundreds or thousands of units, and possible future epic-large maps" has not been measured, and
nothing here claims it has. This section records what a code review found about *where* cost would
appear first, and which design moves are cheap to take now versus expensive to retrofit later.

Grid size (`A`, tile count) and actor count (`N`) are different axes, and the kernel does not couple
them uniformly:

| Phase | Cost | Coupled to |
| --- | --- | --- |
| Occupancy rebuild (`OccupancyIndex`, `src/grid/occupancy.ts`) | O(A) | map area: four `Int32Array`s sized to `width * height`, rebuilt every tick (`src/pulse/tick.ts`) |
| Collision queries (`CollisionMask`, see [`grid.md`](grid.md)) | O(1) per query | neither: a lazy view, allocates nothing |
| Movement and routing (`rankedSteps`, intents) | O(N) | actor count, cheap |
| Arbitration (contested tiles) | O(N) typical, O(C²) at one chokepoint | contestants at a single tile, bounded and self-reporting (`arbitration.bounded`) |
| **Perception and targeting** (`hostilesOf` + `selectTarget`, `src/pulse/perception.ts`) | **O(N²), every tick, unconditionally** | actor count: the confirmed primary risk |
| Attacks | O(N × T), T = distinct speed tiers | small today, not architecturally bounded |
| Death resolution | O(N) per death, O(N·D) for D simultaneous deaths | actor count × deaths in one tick: a volley or a detonation chain is exactly this |

Perception is the one place cost is quadratic in actor count with no cap at all, so it is the first
thing to bound before "hundreds or thousands" is a real target. The other rows scale acceptably at that
range or are already bounded.

Two cheap fixes are already in, because they cost nothing and change nothing observable (verified
hash-identical across every scenario, the multi-death chain in `ravel-cascade` included): attacks
bucket actors by speed tier once per tick instead of re-scanning every actor per tier, and death
resolution uses a reverse `target → observers` index, maintained at the few places a target is
written, instead of scanning every observer. The kernel's tick is one file per phase under
`src/pulse/`.

**Four design rules, adoptable without building real spatial pathfinding:**

1. **Treat grid size as a declared mode with a sane upper bound, not an unbounded input.** RULE —
   `src/scenario/load.ts` (`MAX_DECLARED_GRID_TILES`), `tests/scenario.test.ts` ("a custom grid over
   the declared-mode tile cap"). A custom grid over 10,000 tiles (roughly five times the largest
   preset) is rejected at load time, loudly, rather than degrading silently every tick: with no
   autoscroll or streamed geography, an unbounded grid is an unbounded per-tick allocation.
2. **Reserve a spatial-query shape on perception's signature before anything uses it.** Zero cost, zero
   behaviour change: pure API-surface insurance. Any change to how a target is chosen moves every hash
   pinned to the current behaviour, so the earlier the eventual shape is visible in the types, the
   fewer call sites change later.
3. **`OccupancyIndex` is the place to build a coarse spatial index from, not a new structure next to
   it.** It already owns every placement mutation (add, remove and move at settle, death, and the
   tick-start rebuild), which are exactly the events a sibling sector index needs to stay current.
   Bucketing perception's search through it, rather than scanning `context.actors` directly, bounds the
   O(N²) toward O(N·k) with no fidelity cost, provided iteration inside a bucket stays ordinal-sorted
   the way every other pass already is.
4. **A radius cap on target selection, with an explicit and deterministic fallback, is the real fix,
   and it is a design decision, not an engineering one.** Capping "nearest enemy anywhere" to "nearest
   enemy within R" is cheap once rule 3 exists; deciding what a unit with nothing in R does instead
   changes emergent behaviour and is expensive to reconsider once a scenario is pinned to a specific
   contract. What such a unit should do waits on an open question (Q20 in
   [`open-questions.md`](../milestones/open-questions.md), with the options and a recommendation). Land
   it inert and off by default until a scenario actually needs it.

**What this section is not.** It is not a commitment to build real pathfinding, a spatial index or a
radius cap, and not a claim that the scenarios are slow: nothing here is a measurement, only an
assessment of where a future measurement would first go red.
