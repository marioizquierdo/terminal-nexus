# Terminal Nexus — runtime and tools

_The terminal lifecycle, the delivery ladder, the engine tool and modding seams, and scaling. Split from the engine design; every unmarked statement is GUIDANCE._

## 10. Runtime and terminal direction — GUIDANCE

Terminal Nexus stays TypeScript-first through early proofs. That does not require any one runtime or
TUI library to own the architecture.

**Library and runtime are independent choices.** Measurement on 2026-08-20 established that
`@opentui/core@0.5.4` publishes an explicit `node` export, imports cleanly on Node 22, and ships its
native core as prebuilt per-platform packages rather than needing a Zig toolchain. Choose the library
on cell-frame behaviour and the runtime on packaging and availability, separately.

- **OpenTUI imperative core** — the leading path. `OptimizedBuffer.setCell`, mouse, resize, arbitrary
  streams, and a testing harness with a manual clock and frame recorder. Risks are pre-1.0 churn (318
  published versions in its first year) and weight (21 MB native library, 140 MB standalone binary),
  not capability.
- **Direct ANSI** — the control and the fallback. Must stay small. If it starts needing capability
  discovery, robust input parsing, or mouse decoding, that is a measured result, not a to-do list.
- **Terminal Kit** — contingency if direct ANSI starts recreating a library.
- **Ratatui + Crossterm** — native contingency; adopting it creates a Rust boundary and a content
  cost. Not designed; do not assume it.
- **Bubble Tea + Wish** — Go hosted-SSH contingency. Not designed; do not assume it.

Bun and Node are both present in the project's environments; Deno is not, and nothing measured needs
it. Versions are re-checked and pinned during the active gate, and the pins live in the gate report.

### 10.1 Terminal lifecycle — RULE

One alternate screen, **one idempotent disposer**. It restores cursor, input mode, handlers, and
screen after normal exit, `q`, `SIGINT`, `SIGTERM`, setup failure, and caught render failure — and,
once the mouse adapter exists (9.7), it switches terminal mouse reporting off on the same paths —
and, since canon 2.29, the kitty keyboard protocol too, when the Build Phase switched it on (9.7). It
cannot promise anything after `SIGKILL`. Calling it twice is harmless.

Non-TTY launch prints one readable line and no escape sequences. Diagnostics are buffered and emitted
**after** cleanup. Backends report their capability mode explicitly.

A renderer that drops frames is a tuning problem. A renderer that leaves the terminal in raw mode is
a reason to reject it.

### 10.2 Delivery ladder — GUIDANCE

Local executable and ordinary PTY; restricted public SSH; browser terminal streaming ANSI to
xterm.js; browser-native renderer consuming events; mobile shell; optional pixel or 3D presentation
on the same semantic contract.

Every rung above the first is an architectural possibility, not a commitment. None of it is
authorized by this document.

**The browser playtest page is a development tool, not a rung** (owner, 2026-09-27). It exists so the
game can be played from a phone during review (`bun scripts/build-web.mjs`, `src/web/`), and it must
run the terminal's own screen loops — the menu, the Build Phase, Pulse playback — handed a stand-in
terminal: it converts frames to pixels, taps and keys to terminal bytes, and settings to browser
storage, and decides nothing about what the game shows or does. A terminal at 80 × 24 stays the
acceptance target; the page never is one.

---

## 11. Tools and modding — GUIDANCE

First-party development uses explicit definitions and fast tools: maps as inspectable ASCII arrays
plus metadata; armies, units, structures, upgrades, themes, and glyphs as validated TypeScript;
effects as typed functions; cutscenes as tableaux and timelines; missions as map, army, objective,
trigger, and scene definitions.

**`grid`** — a `.map.json` map file plus a CLI that defines a Grid, places entities, takes a seed and a
tick count, runs or steps a Pulse, and reports what happened — is worth building **first**, not
eventually. It is the fastest feedback loop the project will have, for humans and agents alike, and
it is permanent infrastructure rather than spike residue: every future unit gets tested on it. It
grew out of Milestone 1's Pulse Playground and stayed the engine's own name — `grid` is the editor
and replay tool, not the game; a future `terminal-nexus` executable is what launches a campaign
built on it. What "replay tool" means concretely — reading and writing a persisted, levelled game
log rather than only resolving a map fresh each time — is designed, not built, in
[`replay-format.md`](replay-format.md).

There is no subcommand: `grid <map>` takes a path to a `.map.json` file (the suffix is optional) and
defaults to `watch`, the ASCII view; `--headless` resolves without a terminal and `--verify`
re-resolves 10 times and fails on any hash disagreement. One output stream, not two — a headless
run's **levelled log** (default `WARN`) carries the story in fixed, greppable columns, closed by a
`report` line carrying the outcome, the losses, and the hashes, so an agent can assert on behaviour
without parsing prose and a designer can read what happened without a second stream to catch.
`--save-log <file>` writes the same lines to a file in any action, and `--turn <tick>` seeks straight
to a tick instead of playing from the start, in `watch`, `--headless`, and `--verify` alike. See
[`docs/milestones/completed/milestone-01-grid-battles.md`](../milestones/completed/milestone-01-grid-battles.md) Section 3.3.

This is **modding-first architecture, not mod-loader-first development.** No public SDK, remote
loader, marketplace, permission system, or compatibility promise belongs in early docs/milestones. Themes
may recommend fonts, but a terminal application cannot reliably change the host font, so every pack
keeps an ASCII-safe fallback.

### 11.1 Scaling toward hundreds or thousands of units — GUIDANCE

Milestone 1's fixtures top out at a few dozen actors on a preset Grid. The owner has asked, ahead of
any evidence forcing the question, whether the kernel's current shape holds at "hundreds or
thousands of units, and possible future epic-large maps." It has not been measured at that scale and
nothing here claims it has been — this section writes down what a code review found about *where*
cost would appear first, and which design moves are cheap to take now versus expensive to retrofit
later, so the answer is prepared rather than improvised when it stops being hypothetical.

**Where cost actually lives, as of Gate 1B.** Grid size (`A`, tile count) and actor count (`N`) are
different axes and the kernel does not couple them uniformly:

| Phase | Cost | Coupled to |
| --- | --- | --- |
| Occupancy rebuild (`OccupancyIndex`, `src/grid/occupancy.ts`) | O(A) | map area — four `Int32Array`s sized to `width * height`, rebuilt every tick (`src/pulse/tick.ts:856`) |
| Collision queries (`CollisionMask`, Section 3.4.1) | O(1) per query | neither — a lazy view, allocates nothing |
| Movement and routing (`rankedSteps`, intents) | O(N) | actor count, cheap |
| Arbitration (contested tiles) | O(N) typical, O(C²) at one chokepoint | contestants at a single tile, bounded and self-reporting (`arbitration.bounded`) |
| **Perception and targeting** (`hostilesOf` + `selectTarget`) | **O(N²), every tick, unconditionally** | actor count — the confirmed primary risk |
| Attacks | O(N × T), T = distinct speed tiers | small today, not architecturally bounded |
| Death resolution | O(N) per death → O(N·D) for D simultaneous deaths | actor count × deaths in one tick — a volley or a detonation chain is exactly this |

Perception is the one place cost is quadratic in actor count with no cap at all, so it is the first
thing to bound before "hundreds or thousands" is a real target. The other rows scale acceptably at
that range or are already bounded; they are listed so a later session does not have to re-derive
this table from scratch.

**Four design rules, adoptable now without building real spatial pathfinding:**

1. **Treat grid size as a declared mode with a sane upper bound, not an unbounded input.** There is
   no autoscroll or streamed geography yet, so an unbounded custom grid is an unbounded per-tick
   allocation, not just a slow one. **Done this session**: `src/scenario/load.ts` rejects a custom
   grid over `MAX_DECLARED_GRID_TILES` (10,000 tiles, roughly 5x the largest preset) at load time,
   loudly, rather than letting a mistyped or exploratory scenario degrade silently every tick.
2. **Reserve a spatial-query shape on perception's signature now, even before anything uses it.**
   Zero cost, zero behavior change — pure API-surface insurance. Q17 is the cautionary tale: any
   change to how a target is chosen moves every hash pinned to the current behavior, so the earlier
   the eventual shape is visible in the types, the fewer call sites have to change later.
3. **`OccupancyIndex` is the right place to build a coarse spatial index from, not a new structure
   next to it.** It already owns every placement mutation — `add`/`remove`/`move` at settle
   (`tick.ts:514`), death (`:771`), and the tick-start rebuild (`:856`) — which are exactly the
   events a sibling sector index would need to stay current. Bucketing perception's search through
   it (rather than scanning `context.actors` directly) bounds the O(N²) toward O(N·k) with no
   fidelity cost, provided iteration inside a bucket stays ordinal-sorted the way every other pass
   already is.
4. **A radius cap on target selection, with an explicit and deterministic fallback, is the real
   fix — and it is a design decision, not an engineering one.** Capping "nearest enemy anywhere" to
   "nearest enemy within R" is cheap once Rule 3 exists; deciding what a unit with nothing in R does
   instead changes emergent behavior and, like Q17, is expensive to reconsider once a fixture is
   pinned to a specific contract. [`open-questions.md`](../milestones/open-questions.md) Q20 has the options and a
   recommendation. Land it inert and off by default until a scenario actually needs it.

**What this section is not.** It is not a commitment to build real pathfinding, a spatial index, or
a radius cap in the current gate — the owner was explicit that design rules now are enough. It is
not a claim that Milestone 1's fixtures are slow; nothing here is a measurement, only an assessment
of where a future measurement would first go red. Two further findings from the same review were
adopted immediately because they are free and change nothing observable: `attacks()` (`tick.ts`) now
buckets actors by speed tier once per tick instead of re-scanning every actor per tier, which removed
an O(N × T) re-filter with no behavior change (verified hash-identical across every fixture). A
matching fix for death resolution's O(N·D) observer scan — a reverse `target → observers` index,
maintained at the same handful of `targetOrdinal` write sites perception already touches — has
since been built and verified hash-identical across every fixture too, `ravel-cascade.ts`'s
multi-death chain included. The same pass also split the kernel's single `tick.ts` into one file
per tick phase under `src/pulse/`, pure code motion with no behavior change.
