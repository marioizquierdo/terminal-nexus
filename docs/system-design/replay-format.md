# Terminal Nexus — the replay format

_A design sketch of the persisted, levelled game log. **Not built:** no code reads or writes a `.replay.json` file, and AGENTS.md lists the replay format among what no step asks for yet. Everything here is GUIDANCE except the parts marked IDEA._

**Status.** Built today: `grid --headless --events file.jsonl` (one canonical `DomainEvent` per line), `--save-log`,
`--verify` (re-resolve and compare hashes), and a Skirmish's session record for playtest notes
([`skirmish-saves.md`](skirmish-saves.md)), which is not a replay. Not built: everything below. Read it as a
recommendation for whoever picks the work up; build none of it until a milestone step asks.

## Why it exists

The game log already has required contents ([`pulse.md`](pulse.md), determinism and replay): "schema, engine, and
ruleset versions; content ids and hashes; map id and hash; tick rate; PRNG name and seed; armies; initial state;
committed plans per Build Phase; ordered events per Pulse; final hashes; outcome; and any presentation markers,
explicitly excluded from verification". It does not say what file holds that or what shape it takes. Every field
below traces back to a clause in that sentence; this page adds no new commitment.

A persisted, versioned, levelled log turns a run of `grid` ([`runtime.md`](runtime.md)) from "a fight that happened
once, in a terminal, and is gone" into a durable artifact: a bug report, a regression fixture, a feedback recording,
a highlight to watch back.

## What the format leaves open

- **The Build Phase's plan.** The kernel has no notion of a plan; `committedPlans` is reserved shape, the way an API
  surface is reserved at zero cost, so that whatever defines the plan format does not reopen this file.
- **Armies.** Armies exist as data (`armies/`, [`army-authoring.md`](army-authoring.md)); `armyId` and `faction` are
  reserved fields, bare strings or references into the army registry, not pre-decided here.
- **A sandbox, rewind and fast-forward UI.** Where those live is Q19 in
  [`open-questions.md`](../milestones/open-questions.md). This page is a dependency of that question's
  recommendation (per-tick state has to be cheap to address for rewind to be arithmetic rather than
  re-simulation), not a replacement for it.
- **An implementation plan.** There is no file list and no estimate: only a schema and the reasoning behind it, so
  that an implementer chooses among informed defaults.

## The top-level shape

```ts
type ReplayFile = Readonly<{
  /** This document's own schema, independent of MatchState's schemaVersion (see "The format's own version"). */
  replayFormatVersion: number
  /** "grid-playground": one implicit build phase, one Pulse. "match": the real thing. */
  replayType: "grid-playground" | "match"
  /** == ENGINE_VERSION at record time (src/pulse/resolve.ts). */
  gridEngineVersion: string
  /** == contentLockOf(registry) at record time. */
  contentLock: string
  /** Named because the game log's contents name it, even though there is exactly one today. */
  prng: "pcg32"
  /** ISO 8601. Metadata for a human browsing saved replays. The kernel never reads it. */
  recordedAt: string
  setup: ReplaySetup
  /** Build and Pulse phases, strictly alternating, in play order. */
  phases: readonly ReplayPhase[]
  /** Mirrors the last resolved Pulse's MatchState.outcome. null means still in progress (see "A partial file is a valid file"). */
  outcome: Outcome | null
}>
```

`Outcome` is `src/state/types.ts`'s existing type, reused rather than re-declared: `{ winner:
PlayerId | null, reason: VictoryReason, tick: number }`.

### Setup — the starting point

```ts
type ReplaySetup = Readonly<{
  /** A checked-in sandbox by id, or a fully embedded one: "map id, or map ascii if not one of
   *  the core maps". Both cases exist today: BattleOpening already is a map plus a starting
   *  placement (src/skirmish/opening/types.ts). */
  map: Readonly<{ battleId: string }> | Readonly<{ opening: BattleOpening }>
  /** hashOf(the resolved BattleOpening) either way: the game log's "map id and hash". One
   *  hash function, already built (src/state/canonical.ts), no new machinery. */
  mapHash: string
  players: Readonly<Record<PlayerId, ReplayPlayerSetup>>
}>

type ReplayPlayerSetup = Readonly<{
  /** Reserved, until real armies exist. */
  armyId?: string
  /** Reserved, same reason. Today a player's faction is implicit in which content ids their
   *  a sandbox's start uses: there is nothing to record here yet, only a slot to record it into
   *  later without reopening this file's shape. */
  faction?: string
}>
```

### Phases

```ts
type ReplayPhase =
  | Readonly<{
      kind: "build"
      phaseNumber: number
      /** The game log's "committed plans per Build Phase". Reserved: the Build Phase's plan shape is not recorded yet. */
      committedPlans: Readonly<Record<PlayerId, readonly unknown[]>>
    }>
  | Readonly<{
      kind: "pulse"
      pulseNumber: number
      logLevel: LogLevel                     // src/report/levels.ts, reused as-is
      seed: number
      ticksPerSecond: number
      pulseTicks: number
      initialState: MatchState               // this Pulse's starting state, always present
      finalState: MatchState                 // always present, at every level
      events: readonly (DomainEvent | EngagementDetected)[]   // filtered by logLevel
      /** TRACE only. Full per-tick snapshots, for exact scrubbing without re-simulating:
       *  the thing rewind and fast-forward want "for free" once they exist. */
      ticksRecorded?: readonly MatchState[]
      stateHash: string                      // always present: the FULL stream's hash
      eventsHash: string                     // always present: the FULL stream's hash
    }>
```

A "grid-playground" replay has exactly one `build` phase (the sandbox's static placements, standing in
for a real Build Phase) followed by exactly one `pulse` phase. A "match" replay is the general case:
`build`, `pulse`, `build`, `pulse`, … until the last Pulse's `finalState.outcome` is non-null. Each
`build` and `pulse` pair is one round, and `pulseNumber` counts rounds.

## Log levels: a second axis

The engine tool already has five log levels for its **live headless report**: a human or an agent
watching one run scroll by right now. A stored file asks a different question wearing the same five
names: how much of a Pulse's story is worth **paying to store**, permanently, in a file that might hold
a whole match. Reusing the live report's table unchanged would be wrong: its `INFO` already includes
"every attack that landed", which is exactly the volume a stored file should not carry by default.

So: same five names, same cumulative-threshold mechanism (`src/report/levels.ts`'s `LogLevel`,
`includesLevel`, `LOG_LEVELS`, reused wholesale), **different contents**, defined for what gets
*persisted* rather than what gets *printed*:

| Level | A Pulse entry's `events` array includes |
| --- | --- |
| `ERROR` | Invariant violations. Always included regardless of configured level: an unsound run is never silently downgraded out of the file |
| `WARN` | **Engagement detection** (below), plus the anomalies the live report already calls `WARN`: an actor stuck for many ticks, arbitration hitting its pass bound, a target that vanished. Both are "noteworthy without full mechanical detail", so they share the level |
| `INFO` | `entity.spawned`, `entity.died`, `structure.destroyed`, `entity.detonated`, `salvage.dropped`, `pulse.ended`: spawns, deaths and the outcome. "Used skills" has no system to log yet (Nexus powers); when it does, its events belong here, next to death and spawn |
| `DEBUG` | Everything mechanical, one step short of a full per-tick dump: `attack.launched`, `damage.applied`, plus `entity.moved`, `move.blocked`, `move.contested`, `target.selected`, `target.lost`, `behavior.flee`, `arbitration.bounded`: the granularity the live report already calls `DEBUG`, since a stored mechanical trace and a printed one are the same information at the same cost |
| `TRACE` | Every `DomainEvent` kind, **plus** `ticksRecorded`: a full state snapshot every tick, not just the final one. This is what makes exact scrubbing to any tick possible without re-simulating. Expect it to be enormous |

### Engagement detection: the WARN-level synthesized event — IDEA

```ts
type EngagementDetected = Readonly<{
  /** Not a DomainEventKind. Computed by the replay writer from the resolved event stream, never
   *  emitted by the kernel: the kernel has no notion of "area" or "cooldown". Named distinctly so
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

The definition: "the first attack in a given area after a cooldown since the last engagement ended in
that area", with the area's unit count and accumulated power attached. Making it deterministic and
reproducible needs three things nailed down:

- **Area.** Partition the Grid into fixed square sectors: the same coarse-bucketing idea the scaling
  design proposes for perception ([`runtime.md`](runtime.md)), one mechanism serving two consumers. An
  attack's sector is the one containing the attacker's anchor at the tick of its `attack.launched`
  event. Default `ENGAGEMENT_SECTOR_SIZE = 8` tiles per side, a constant not measured against a real
  fixture, changed freely once one exists.
- **Cooldown, and why this is computed after the fact.** An engagement's last attack is the last
  `attack.launched` in its sector before a gap exceeding `ENGAGEMENT_COOLDOWN_TICKS` (default: 36
  ticks, three seconds at 12 Hz) or the Pulse's end. Knowing an engagement has *ended* requires seeing
  far enough past it to confirm the silence; this cannot be decided while a Pulse is still resolving,
  only by scanning the completed event stream afterward. That is why engagement detection belongs in
  the replay writer, as a derived read over an already-canonical event log, and never as something the
  kernel tracks: the same boundary the three worlds ([`grid-engine.md`](grid-engine.md)) draw between
  simulation and presentation applies between simulation and its own log.
- **Power.** No content definition carries a "power" scalar today (`src/content/types.ts` has `maxHp`
  and per-attack `damage`, nothing unified). Default, not locked: `totalPower = Σ (maxHp +
  attack.damage)` over every distinct unit that attacked or was attacked during the engagement, sampled
  once at the engagement's start tick, a snapshot and not a sum across time, so a unit attacking five
  times is counted once. Whether this deserves its own authored content field (a declared "point
  value", useful for AI threat-assessment too) is a real open question, but it does not block the rest
  of this format.

## Soundness

Three properties do the actual work; everything else in this document is shape.

### Hashes are computed over the full stream, never the filtered one

**This is the one rule in this document that must hold regardless of every other detail.** A Pulse's
`stateHash` and `eventsHash` are always the hash of the complete, unfiltered event stream
`resolvePulse` produces, computed before the configured `logLevel` throws anything away for storage.
The persisted `events` array is a *view*, chosen for size; the hash is the *signature*, and it does not
change with the view.

Get this wrong, and hash the array that actually got written, and two replay files of the identical
Pulse at different log levels get different `eventsHash` values, which breaks every comparison the
format exists to make possible: `grid --verify` against a saved file, one file against another, a
`TRACE` capture against a `WARN` capture of the same seed. The divergence between log levels lives
entirely in `events`' contents, never in `stateHash`/`eventsHash`.

This is also what makes a low-level file **fully verifiable despite storing almost nothing**:
verification was never "does the stored event list match"; it is "re-run the recorded seed, initial
state, content lock and engine version, and compare the resulting hashes", exactly what `grid --verify`
already does today. A `WARN`-level file re-derives its own full stream on demand; it never needs to have
stored one.

### Raising a level is always sound; lowering one is destructive

Because of the above, "save this Pulse back at a higher log level" has a precise, safe meaning:
re-resolve it from its own recorded `seed` + `initialState` + `contentLock` (refusing if the installed
`gridEngineVersion` no longer matches the recorded one), take the freshly computed full stream, filter
it to the new level, and overwrite `events` (and `ticksRecorded`, if now `TRACE`). `stateHash` and
`eventsHash` should come out identical to what was already stored; if they do not, that is itself the
finding: an engine or content drift the tool must report loudly, the same failure mode `grid --verify`
already has, never a silent overwrite.

Determinism is what makes this well-defined rather than a request to remember detail nobody captured.
The inverse, discarding detail a file already has to save space, is not unsound, but it is a
destructive edit like any other: never done implicitly, always to a new file or behind explicit
confirmation.

### Version skew is a refusal, not a silent divergence

`ENGINE_VERSION`'s own doc comment is "bumped whenever a rule changes an outcome", which means
re-resolving a file's recorded seed under a *different* installed `gridEngineVersion` than the one it
carries can legitimately produce a different result, and that is expected, not a bug. Reading or
writing back a replay file compares its recorded `gridEngineVersion` and `contentLock` against what is
currently installed and refuses to overwrite on any mismatch: write to a new file, or fail loudly and
say which of the two drifted. Never let a rule change quietly rewrite a stored history under the hashes
that were supposed to prove it never would.

### A partial file is a valid file

A "grid-playground" replay's single Pulse may end on the tick limit with `outcome: null`: a draw is not
corruption, and neither is a `.replay.json` written mid-match, before its last `build`/`pulse` pair has
happened. `ReplayFile.outcome` mirrors `MatchState.outcome` exactly for this reason: `null` means "not
decided yet", the meaning it already carries on every in-flight `MatchState`. Nothing reading this
format may assume the last entry in `phases` is a finished game.

### One canonical event encoding, two containers

`grid x.save.json --headless --events file.jsonl` already exists and already emits one `DomainEvent` per
line, canonically serialized (`src/events/serialize.ts`, held by `tests/determinism.test.ts` and
`tests/grid-cli.test.ts`). A `pulse` phase's `events` array should serialize each entry through that exact same
per-event encoding, so `hashEvents` agrees whether the events came from a `.replay.json` phase or a
standalone JSONL export of the identical run. The wrapper around phases and setup is necessarily a
single JSON document, since the file has real nested structure, but nothing about that requires a
second way to write down what an event *is*.

### The format's own version

`MatchState.schemaVersion` versions *state shape*; `replayFormatVersion` versions *this file's own
shape*: adding a phase kind, changing what a level includes. They change independently and neither
should be read as a sign about the other; conflating them would make an unrelated engine change look
like a file-format break, or the reverse.

## How `grid` would read and write these files — IDEA

Not built. The shape the tool could grow into:

- **`grid <save> --headless --save-replay <file> [--log-level LEVEL] [--type grid-playground]`**:
  today's `grid <save> --headless` plus persistence: one implicit `build` phase (the map's own
  placements), one `pulse` phase resolved and filtered to `LEVEL`, written to a new `.replay.json`.
  This is packaging, not new machinery: `resolvePulse` and the existing JSONL event encoding already do
  the work; this only adds the setup and provenance wrapper. A flag, not a subcommand: `grid`'s first
  argument is always the map or replay to load, never a verb.
- **`grid <file> --headless --replay-pulse N [--log-level LEVEL]`**: re-resolves Pulse `N` (default: the
  last one) as described under "Raising a level" and writes the richer result back in place, after the
  version-skew check.
- **`grid <file>`** (the default action, watch): a replay's `setup.map` is already a full map (embedded
  or by id), so watching a saved replay should need no new rendering: the same viewer that plays a
  `.save.json` map today plays a `.replay.json`'s setup the same way, then steps through its recorded
  Pulse the same way `grid` already steps through a live resolution.

## Naming, and the engine version

`replayType: "grid-playground"` is a single Pulse using the build phase as setup, spelled to match the tool's own
name. The engine version is recorded from the first file the format writes: `ReplayFile.gridEngineVersion` is
`ENGINE_VERSION` (`src/pulse/resolve.ts`). One gap in the current code, not in this design: `PulseRun` has no `prng`
field though the game log's required contents name one; with one PRNG nothing depends on it, and it is cheap to add
whenever `PulseRun`'s shape is next touched.

## What is still undecided

This document proposes a shape; it does not close every question inside it. Left explicitly open,
because none of them block finishing the shape and none have a fixture or a hash pinned to them:

- The exact `ENGAGEMENT_SECTOR_SIZE` and `ENGAGEMENT_COOLDOWN_TICKS` constants: proposed defaults, not
  measured against a real large-scale fixture, because none exists yet.
- Whether `totalPower` stays a derived formula over `maxHp`/`damage`, or earns its own authored content
  field once a use beyond this log line appears (AI threat-assessment is the obvious second consumer;
  extract a framework only after two real uses reveal the boundary).
- What a `committedPlans` entry actually contains: that belongs to whatever defines the plan format,
  not to this document; the field is reserved so that work does not also have to reopen this file's
  top-level shape.
- Whether `armyId`/`faction` end up as bare strings or references into a Commander Army registry:
  deliberately not pre-decided here.

None of these is a row in `open-questions.md`: none blocks anything, the register's own bar. One that starts to
earns a row then.
