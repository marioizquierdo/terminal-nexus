# Terminal Nexus — the replay format

**Document role:** Design for `.replay.json`, the persisted game log — schema, log levels, and how
`grid` reads and writes it
**Status:** GUIDANCE throughout. Nothing here is built. Written to give Milestone 2 a concrete
starting design rather than a blank page, and because the owner asked for it directly this session
**Canon version:** 2.7
**Updated:** 2026-08-23
**License:** Apache-2.0

## 0. What this is, and what it is not

This is a schema and a set of design decisions for a file format that does not exist yet. No code in
this repository reads or writes a `.replay.json` file. Nothing in Milestone 1 Gate 1B is blocked on
it, and nothing here authorizes building it — `engine.md` Section 2's authority table still applies:
this whole document is GUIDANCE, a recommendation for whoever picks up Milestone 2's locked contract,
not a spike-ahead of it.

It exists because `engine.md` 4.4 (RULE) already commits the project to a game log with specific
contents — "schema, engine, and ruleset versions; content ids and hashes; map id and hash; tick rate;
PRNG name and seed; armies; initial state; committed plans per Build Phase; ordered events per Pulse;
final hashes; outcome; and any presentation markers, explicitly excluded from verification" — without
ever saying what file holds it or what shape it takes. Every field below traces back to a clause in
that sentence. This document does not add a new commitment; it is the first attempt at fulfilling an
existing one.

It also exists because of where the tool the game log lives in has landed: `grid` is not spike
residue, it is "permanent infrastructure... every future unit gets tested on it" (`engine.md` 11).
The owner's own framing this session was blunter still: "we should really focus on this tool because
it is going to be the backbone of all development... perhaps we are already building the actual grid
engine here." A persisted, versioned, levelled game log is the thing that turns a run of `grid` from
"a fight that happened once, in a terminal, and is gone" into a durable artifact — a bug report, a
regression fixture, a feedback recording from a real playtester, a highlight to watch back. That is
worth designing for before it is needed, the same way the collision-mask and layer rules were
designed before Gate 1A needed them.

## 1. Non-goals, right now

- **No Build Phase exists to record.** The kernel has no notion of construction, cost, or a hidden
  simultaneous-reveal plan (`engine.md` Section 2's authorized scope stops well short of it). Every
  Build Phase field below is reserved shape, not working code — the same move as Section 11.1's
  "reserve the API surface at zero cost" rule, applied to a file format instead of a function
  signature.
- **No Commander Army exists to reference.** `commander-armies.md` says rosters are "intentionally
  undefined," and `AGENTS.md` explicitly forbids authoring one before Milestone 4. `armyId` and
  `faction` are reserved fields for the same reason Build Phase fields are: so Milestone 4 does not
  have to reopen this file's shape to add them.
- **No sandbox, rewind, or fast-forward UI.** That is Q19, still open, still deliberately deferred.
  This document is a dependency of Q19's recommendation (per-tick state needs to be cheap to address
  for rewind to be arithmetic rather than a re-simulation), not a replacement for it.
- **This is not an implementation plan.** There is no file list, no PR, no estimate. It is a schema
  and the reasoning behind it, so that whoever does implement it is choosing among informed defaults
  rather than inventing the shape from nothing.

## 2. The top-level shape

```ts
type ReplayFile = Readonly<{
  /** This document's own schema, independent of MatchState's schemaVersion — Section 7.5. */
  replayFormatVersion: number
  /** "grid-playground": one implicit build phase, one pulse (Section 9). "match": the real thing. */
  replayType: "grid-playground" | "match"
  /** == ENGINE_VERSION at record time (src/pulse/resolve.ts). Renamed alongside the tool — Section 9. */
  gridEngineVersion: string
  /** == contentLockOf(registry) at record time. */
  contentLock: string
  /** Named because engine.md 4.4 names it, even though there is exactly one today. */
  prng: "pcg32"
  /** ISO 8601. Metadata for a human browsing saved replays. The kernel never reads it. */
  recordedAt: string
  setup: ReplaySetup
  /** Build and Pulse phases, strictly alternating, in play order. */
  phases: readonly ReplayPhase[]
  /** Mirrors the last resolved pulse's MatchState.outcome. null means still in progress — Section 7.4. */
  outcome: Outcome | null
}>
```

`Outcome` is `src/state/types.ts`'s existing type, reused rather than re-declared — `{ winner:
PlayerId | null, reason: VictoryReason, tick: number }`.

### 2.1 Setup — the starting point

```ts
type ReplaySetup = Readonly<{
  /** A checked-in scenario by id, or a fully embedded one — "map id, or map ascii if not one of
   *  the core maps," the owner's own words. Both cases exist today: ScenarioDefinition already is
   *  a map plus a starting placement (src/scenario/types.ts). */
  map: Readonly<{ scenarioId: string }> | Readonly<{ scenario: ScenarioDefinition }>
  /** hashOf(the resolved ScenarioDefinition) either way — engine.md 4.4's "map id and hash." One
   *  hash function, already built (src/state/canonical.ts), no new machinery. */
  mapHash: string
  players: Readonly<Record<PlayerId, ReplayPlayerSetup>>
}>

type ReplayPlayerSetup = Readonly<{
  /** Reserved. Milestone 4 is what gives this real values (Section 1). */
  armyId?: string
  /** Reserved, same reason. Today a player's faction is implicit in which content ids their
   *  scenario placements use — there is nothing to record here yet, only a slot to record it into
   *  later without reopening this file's shape. */
  faction?: string
}>
```

### 2.2 Phases

```ts
type ReplayPhase =
  | Readonly<{
      kind: "build"
      phaseNumber: number
      /** engine.md 4.4's own words: "committed plans per Build Phase." Reserved — Section 1. */
      committedPlans: Readonly<Record<PlayerId, readonly unknown[]>>
    }>
  | Readonly<{
      kind: "pulse"
      pulseNumber: number
      logLevel: LogLevel                     // src/report/levels.ts, reused as-is — Section 3
      seed: number
      ticksPerSecond: number
      pulseTicks: number
      initialState: MatchState               // this pulse's starting state, always present
      finalState: MatchState                 // always present, at every level — Section 4.1
      events: readonly (DomainEvent | EngagementDetected)[]   // filtered by logLevel — Section 3
      /** TRACE only. Full per-tick snapshots, for exact scrubbing without re-simulating — the
       *  thing Q19's rewind/fast-forward wants "for free" once it exists. */
      ticksRecorded?: readonly MatchState[]
      stateHash: string                      // always present — the FULL stream's hash, Section 4.1
      eventsHash: string                     // always present — the FULL stream's hash, Section 4.1
    }>
```

A "grid-playground" replay (Section 9) has exactly one `build` phase (the scenario's static
placements, standing in for a real Build Phase) followed by exactly one `pulse` phase. A "match"
replay is the general case: `build`, `pulse`, `build`, `pulse`, … until the last pulse's
`finalState.outcome` is non-null.

## 3. Log levels — a second axis, not a re-skin of Section 3.3's

`milestone-1-spike-battle.md` 3.3 already defines five log levels for `grid`'s **live headless
report** — a human or an agent watching one run scroll by right now. The owner's ask this session was
for a *different* thing wearing the same five names: how much of a pulse's story is worth **paying to
store**, permanently, in a file that might hold a whole match. These are not the same question, and
answering it by reusing 3.3's table unchanged would be wrong — 3.3's `INFO` already includes "every
attack that landed," which is exactly the volume of detail the owner's new `DEBUG` is meant to spare
a stored file from carrying by default.

So: same five names, same cumulative-threshold mechanism (`src/report/levels.ts`'s `LogLevel`,
`includesLevel`, `LOG_LEVELS` — reused wholesale, not reinvented), **different contents**, defined
here for what gets *persisted* rather than what gets *printed*:

| Level | A pulse entry's `events` array includes |
| --- | --- |
| `ERROR` | Invariant violations. Always included regardless of configured level — an unsound run is never silently downgraded out of the file |
| `WARN` | **Engagement detection** (Section 3.1, the owner's own ask) — plus the anomalies 3.3 already calls `WARN`: an actor stuck for many ticks, arbitration hitting its pass bound, a target that vanished. Both are "noteworthy without full mechanical detail," so they share the level rather than one displacing the other |
| `INFO` | `entity.spawned`, `entity.died`, `structure.destroyed`, `entity.detonated`, `salvage.dropped`, `pulse.ended` — spawns, deaths, and the outcome. "Used skills" is the owner's own phrase for a system that does not exist yet (Nexus powers, Milestone 2+); when it does, its events belong here, next to death and spawn, not invented now |
| `DEBUG` | Everything mechanical, one step short of a full per-tick dump: `attack.launched`, `damage.applied` (the owner's own two), plus `entity.moved`, `move.blocked`, `move.contested`, `target.selected`, `target.lost`, `behavior.flee`, `arbitration.bounded` — matching the granularity 3.3 already calls `DEBUG` for the live report, since a stored mechanical trace and a printed one are the same information at the same cost |
| `TRACE` | Every `DomainEvent` kind, **plus** `ticksRecorded`: a full state snapshot every tick, not just the final one. This is what makes exact scrubbing to any tick possible without re-simulating — Q19's rewind, paid for here rather than retrofitted later. "Expect it to be enormous" (3.3's own words) applies at least as much to a stored file as a scrolling terminal |

### 3.1 Engagement detection — the WARN-level synthesized event

```ts
type EngagementDetected = Readonly<{
  /** Not a DomainEventKind. Computed by the replay writer from the resolved event stream, never
   *  emitted by the kernel — the kernel has no notion of "area" or "cooldown." Named distinctly so
   *  no consumer mistakes an aggregate for something the simulation itself asserted. */
  kind: "engagement.detected"
  startTick: number
  endTick: number
  sector: Coord
  unitsInvolved: number
  totalPower: number
  firstAttack: Readonly<{ attacker: string; target: string }>
}>
```

The owner's definition: "the first attack in a given area after a cooldown [since] the last
engagement ended in that area," with the area's unit count and accumulated power attached. Turning
that into something deterministic and reproducible needs three things nailed down:

- **Area.** Partition the Grid into fixed square sectors — the same coarse-bucketing idea Section
  11.1's Rule 3 proposes for perception scaling, one mechanism serving two consumers. An attack's
  sector is the one containing the attacker's anchor at the tick of its `attack.launched` event.
  Default `ENGAGEMENT_SECTOR_SIZE = 8` tiles per side — a GUIDANCE constant, not measured against a
  real fixture yet, changed freely once one exists.
- **Cooldown, and why this must be computed after the fact.** An engagement's last attack is the
  last `attack.launched` in its sector before a gap exceeding `ENGAGEMENT_COOLDOWN_TICKS` (GUIDANCE
  default: 36 ticks, three seconds at 12 Hz) or the Pulse's end. Knowing an engagement has *ended*
  requires seeing far enough past it to confirm the silence — this cannot be decided while a Pulse is
  still resolving, only by scanning the completed event stream afterward. That is not a limitation to
  work around; it is why engagement detection belongs in the replay writer, as a derived read over an
  already-canonical event log, and never as something the kernel itself tracks. The same boundary
  Section 1 (three worlds) already draws between simulation and presentation applies here between
  simulation and its own log.
- **Power.** No content definition carries a "power" scalar today (`src/content/types.ts` has `maxHp`
  and per-attack `damage`, nothing unified). Recommended default, GUIDANCE and explicitly not locked:
  `totalPower = Σ (maxHp + attack.damage)` over every distinct unit that attacked or was attacked
  during the engagement, sampled once at the engagement's start tick — a snapshot, not a sum across
  time, so a unit attacking five times is counted once. Whether this deserves its own authored content
  field (a declared "point value," useful for AI threat-assessment too, not only for a log line) is a
  real open question, but not one that blocks the rest of this format — it is a formula that can
  change without touching anything else here.

## 4. Soundness

The owner asked specifically that this pass verify the format is sound. Three properties do the
actual work; everything else in this document is shape.

### 4.1 Hashes are computed over the full stream, never the filtered one

**This is the one rule in this document that must hold regardless of every other detail here.** A
pulse's `stateHash` and `eventsHash` are always the hash of the complete, unfiltered event stream
`resolvePulse` produces — computed before the configured `logLevel` throws anything away for storage.
The persisted `events` array is a *view*, chosen for size; the hash is the *signature*, and it does
not change with the view.

Get this wrong — hash the array that actually got written — and two replay files of the identical
pulse at different log levels get different `eventsHash` values, which breaks every comparison the
format exists to make possible: `grid verify` against a saved file, one file against another, a
`TRACE` capture against a `WARN` capture of the same seed. The divergence between log levels is
supposed to live entirely in `events`' contents, never in `stateHash`/`eventsHash`.

This is also what makes a low-level file **fully verifiable despite storing almost nothing**:
verification per `engine.md` 4.4 was never "does the stored event list match" — it is "re-run the
recorded seed, initial state, content lock, and engine version, and compare the resulting hashes,"
exactly what `grid verify` already does today. A `WARN`-level file re-derives its own full stream on
demand; it never needs to have stored one.

### 4.2 Raising a level is always sound; lowering one is destructive

Because of 4.1, "save this pulse back at a higher log level" has a precise, safe meaning: re-resolve
it from its own recorded `seed` + `initialState` + `contentLock` (refusing if the installed
`gridEngineVersion` no longer matches the recorded one — Section 4.3), take the freshly computed full
stream, filter it to the new level, and overwrite `events` (and `ticksRecorded`, if now `TRACE`).
`stateHash`/`eventsHash` should come out identical to what was already stored; if they don't, that is
itself the finding — an engine or content drift the tool must report loudly, the same failure mode
`grid verify` already has, never a silent overwrite.

Determinism is what makes this well-defined rather than a request to remember detail nobody captured.
The inverse — discarding detail a file already has, to save space — is not unsound, but it is a
destructive edit like any other: never done implicitly, always to a new file or behind explicit
confirmation, the same standing rule that applies to overwriting anything else worth looking at first.

### 4.3 Version skew is a refusal, not a silent divergence

`ENGINE_VERSION`'s own doc comment is "bumped whenever a rule changes an outcome" — which means
re-resolving a file's recorded seed under a *different* installed `gridEngineVersion` than the one it
carries can legitimately produce a different result, and that is expected, not a bug. Reading or
writing back a replay file must compare its recorded `gridEngineVersion` and `contentLock` against
what is currently installed and refuse to overwrite on any mismatch — write to a new file, or fail
loudly and say which of the two drifted. Never let a rule change quietly rewrite a stored history
under the hashes that were supposed to prove it never would.

### 4.4 A partial file is a valid file

A "grid-playground" replay's single Pulse may end on the tick limit with `outcome: null` — a draw is
not corruption, and neither is a `.replay.json` written mid-match, before its last `build`/`pulse`
pair has happened. `ReplayFile.outcome` mirrors `MatchState.outcome` exactly for this reason: `null`
means "not decided yet," the same meaning it already carries on every in-flight `MatchState`. Nothing
reading this format may assume the last entry in `phases` is a finished game.

### 4.5 One canonical event encoding, two containers

`grid x.map.json --headless --events file.jsonl` already exists and already emits one `DomainEvent` per line,
canonically serialized (`src/events/serialize.ts`). A pulse phase's `events` array should serialize
each entry through that exact same per-event encoding, so `hashEvents` agrees whether the events came
from a `.replay.json` phase or a standalone JSONL export of the identical run. The wrapper around
phases and setup is necessarily a single JSON document — the file has real nested structure — but
nothing about that requires a second way to write down what an event *is*.

### 4.6 The replay format's own version is a separate axis

`MatchState.schemaVersion` versions *state shape*; `replayFormatVersion` versions *this file's own
shape* — adding a phase kind, changing what a level includes. They change independently and neither
should be read as evidence about the other; conflating them would make an unrelated engine change
look like a file-format break, or the reverse.

## 5. How `grid` would read and write these files

Not built. Description of the shape the tool should grow into, so Milestone 2 has a target:

- **`grid <map> --headless --save-replay <file> [--log-level LEVEL] [--type grid-playground]`** —
  today's `grid <map> --headless` plus persistence: one implicit `build` phase (the map's own
  placements), one `pulse` phase resolved and filtered to `LEVEL`, written to a new `.replay.json`.
  This is packaging, not new machinery — `resolvePulse` and the existing JSONL event encoding already
  do the work; this only adds the setup/provenance wrapper described in Section 2. (Naming a new flag
  here rather than a subcommand follows this session's redesign: `grid`'s first argument is always the
  map or replay to load, never a verb.)
- **`grid <file> --headless --replay-pulse N [--log-level LEVEL]`** — re-resolves pulse `N` (default:
  the last one) per Section 4.2 and writes the richer result back in place, after the version-skew
  check in Section 4.3.
- **`grid <file>`** (the default action, watch) — a replay's `setup.map` is already a full map
  (embedded or by id), so watching a saved replay should need no new rendering: the same viewer that
  plays a `.map.json` map today plays a `.replay.json`'s setup the same way, then steps through its
  recorded pulse the same way `grid` already steps through a live resolution.

## 6. Naming: "grid-playground" replays, and why the engine version gets recorded now

The owner's own words: a replay "could contain a single pulse only (the replay type would be 'grid
playground', using the build phase as setup)." `replayType: "grid-playground"` (Section 2) is that
case exactly, spelled to match the tool's own name after this session's rename (Section 9 of the
session's broader work) rather than its old one.

The owner also asked, separately, to "definitely start recording the grid engine version and save it
on the replay files." That is already `ReplayFile.gridEngineVersion` (Section 2) — nothing new to
design, it is `ENGINE_VERSION` (`src/pulse/resolve.ts`) under the field name this format uses, present
on every phase's provenance from the first file this format ever writes. Worth flagging as a gap in
the *current* implementation, not this design: `PulseRun` today has no `prng` field, even though
`engine.md` 4.4 already names "PRNG name" as part of the RULE-level game log contents. One named PRNG
exists, so nothing depends on the field yet — but it is a cheap thing to add whenever `PulseRun`'s
shape is next touched, rather than a gap this document should carry forward silently.

## 7. What Milestone 2 still has to decide

This document proposes a shape; it does not close every question inside it. Left explicitly open,
because none of them block finishing the shape and none of them have a fixture or a hash pinned to
them yet:

- The exact `ENGAGEMENT_SECTOR_SIZE` and `ENGAGEMENT_COOLDOWN_TICKS` constants (Section 3.1) —
  proposed defaults, not measured against a real large-scale fixture, because none exists yet.
- Whether `totalPower` (Section 3.1) stays a derived formula over `maxHp`/`damage`, or earns its own
  authored content field once a use beyond this log line appears (AI threat-assessment is the obvious
  second consumer, per `AGENTS.md`'s "extract a framework only after two real uses reveal the
  boundary").
- What a `committedPlans` entry (Section 2.2) actually contains — that is Milestone 3's battle editor
  to define, not this document's; the field is reserved so that work does not also have to reopen this
  file's top-level shape.
- Whether `armyId`/`faction` (Section 2.1) end up as bare strings or references into a Commander Army
  registry — Milestone 4's call, deliberately not pre-decided here.

None of these are registered as `Q<n>` entries in `open-questions.md`: none of them currently blocks
anything, which is the register's own bar for a row. If one of them starts blocking real Milestone 2
work before this document has been revisited, it earns a row then, with whatever evidence exists by
that point — the same procedure as every other fork this canon has hit so far.
