# Terminal Nexus — engine and gameplay framework

**Document role:** Technical architecture, rules contracts, runtime direction, rendering, determinism, and content interfaces
**Status:** Canonical direction; implementation is gated by milestone documents
**Canon version:** 2.0
**Updated:** 2026-08-19
**License:** Apache-2.0

This document defines the system Terminal Nexus intends to grow into. It is not permission to build every interface now. The active milestone identifies the smallest contracts currently justified.

The engine is not a monolith or one `BattleManager`. It is a collection of official functions, serializable data structures, narrow services, and adapters. First-party content uses those seams before they become a public modding surface.

## 1. Architectural laws

1. **Only the deterministic rules kernel mutates canonical match state.**
2. **Presentation never owns gameplay truth.** Animation may interpolate, skip, pause, accelerate, recolor, or reduce motion without changing an outcome.
3. **Hidden plans stay hidden.** Renderers receive a player-safe projection, never raw opponent state.
4. **Semantics precede cells.** The terminal renderer consumes structured meaning and composes cells; future pixel, mobile, web, accessible, or 3D renderers consume meaning directly.
5. **Gameplay and cosmetic randomness are separate labeled streams.**
6. **Content is TypeScript-first and mostly declarative.** Exceptional behavior uses constrained hooks rather than deep inheritance.
7. **Build direct code for the current proof. Extract a general contract only after a second real use reveals it.**
8. **Every authoritative state transition must be replayable, explainable, and testable without a terminal.**

## 2. Responsibility layers

| Layer | Owns | Must not own |
| --- | --- | --- |
| Rules kernel | ticks, state transitions, randomness, occupancy, movement, targeting, damage, economy, legality, victory | terminal objects, wall clocks, network calls, glyphs, prose |
| Content definitions | units, attacks, structures, upgrades, Commanders, armies, factions, maps, semantic themes | mutable match authority, backend classes |
| Scenario runtime | starting state, objectives, triggers, mission progress, win/loss requests, unlocks | direct mutation bypassing the kernel |
| Player projection | visibility-filtered state, legal public actions, visible ordered events | hidden-plan leakage, invented facts |
| Presentation | semantic cues, animation state, portraits, cell frames or graphical scenes, accessibility | damage, targeting, legal placement, victory |
| Platform adapters | terminal/browser/native input, output, resize, streams, device lifecycle | interpreting ANSI or pixels as game state |
| Application shell | CLI, configuration, content selection, saves, replays, diagnostics, composition | secret rule changes |

Import direction should keep shared contracts as leaves. Runtime flow is:

```text
content + scenario + committed plans
                 ↓
       deterministic kernel
                 ↓
 canonical state + ordered DomainEvent[]
                 ↓
 visibility projection → PlayerView + visible events
                 ├─ terminal compositor → ReadonlyCellFrame → backend
                 ├─ browser/native graphical renderer
                 └─ accessibility/spectator renderer
```

## 3. Player-facing rules contract

### 3.1 Match loop

A match alternates between:

- **Build Phase:** hidden, simultaneous, turn-based, and untimed planning from the same public resolved state;
- **Nexus Pulse:** simultaneous reveal followed by a fixed number of deterministic logical ticks.

During the Build Phase a player may spend resources, place legal structures, alter allowed production state, and select a Nexus upgrade from a small draft. New plans remain hidden until both sides commit.

Both players see the complete resolved battlefield: terrain, deposits, neutral zones, known actors, health, structures, and public construction coverage. Every newly committed construction and upgrade choice remains hidden until simultaneous reveal.

At Pulse start, plans reveal together and valid construction becomes operational. Workers select jobs; production buildings attempt recipes; actors move and fight automatically. Playback controls cannot change the resolved result.

At Pulse end, survivors regroup around home producers. Orphaned units are adopted by the nearest compatible producer or regroup near the battlefield Nexus. The Commander remains Nexus-anchored. Production cooldowns reset to a full interval for the next Pulse.

Destroying the enemy battlefield Nexus wins the match. Any attacker reaching a legal attack position may damage it. Player-built defenses and terrain create practical outer layers; there is no hidden Nexus exposure meter.

### 3.2 Commander behavior

The Commander is a persistent frontline unit, normally `@`. It may receive Nexus-specific upgrades and compete with army, economy, research, and fortification build paths.

When killed, it is absent for the remainder of that Pulse and the entire next Build Phase/Pulse cycle. The Prime Nexus may then replicate it again. Exact timing and upgrades may refine this rule, but Commander death is not the match victory condition.

### 3.3 Buildings

Common roles are:

- **Battlefield Nexus:** victory target, root of connected construction coverage, central upgrade draft, and Commander anchor.
- **Economic structures:** worker slots converting labor into resources.
- **Warehouses:** global storage capacity; no resource reservation behavior.
- **Supply structures:** population cap shared by workers and military.
- **Worker producers:** automatic labor replacement.
- **Military producers:** automatic fixed unit recipe at recurring intervals.
- **Defenses:** attack, block, redirect, protect, reveal, or strengthen positions.
- **Research facilities:** improve the Nexus draft rather than expose a conventional linear menu.
- **Outposts:** project larger construction coverage.
- **Capture structures:** claim a neutral-zone bonus while connected.

Structures become operational immediately after simultaneous reveal. They cannot move or be voluntarily sold. A disconnected building functions but no longer projects construction coverage.

Each match starts from a Commander Army package containing a battlefield Nexus, resources, Commander, workers, and a small starting force. The exact package varies by Commander.

### 3.4 Automatic production

There is no unit shop or queue. A producer attempts its fixed recipe at a recurring Pulse interval. Its cooldown begins when the structure activates and resets to a full cooldown when the Pulse ends.

If simultaneous worker and military attempts cannot all be paid or supplied, every feasible attempt joins one seeded contention process. One is selected, paid, and spawned; feasibility is recalculated; the process continues until nothing legal remains.

Players shape composition by building, protecting, upgrading, pausing, or losing producers.

### 3.5 Research and Nexus powers

The battlefield Nexus initially offers three low-tier upgrades. Research facilities modify the draft by raising tier, adding options, granting redraws, weighting a family, revealing future options, or transforming choices.

When a research facility is first built, it should eventually offer two choices from a small pool of facility improvements. Upgrading it offers two more choices from the remaining pool. The initial design target is four or five possible improvements per facility type; exact stacking and timing remain open until the integrated microgame.

Major structures may reach levels 1–3. Expensive Nexus upgrades unlock higher levels for other bases. This creates a tension between technology ceiling and immediate battlefield presence.

Nexus powers are content-defined legal actions or passive rules associated with the Commander Army. They may affect construction, drafts, the Commander, replication, or the next Pulse, but execute through validated kernel commands and events.

## 4. Logical time

The working hypothesis is **12 deterministic logical ticks per simulation second** at normal speed. A tick is a rules update. A simulation second is a design unit. A Nexus Pulse contains a fixed number of ticks.

Twelve supports exact integer cadences for useful readable speeds:

| Display | Exact rate | One-tile attempt |
| ---: | ---: | ---: |
| 0.5 tiles/s | `1/2` | every 24 ticks |
| 0.67 tiles/s | `2/3` | every 18 ticks |
| 0.75 tiles/s | `3/4` | every 16 ticks |
| 1 tile/s | `1/1` | every 12 ticks |
| 1.2 tiles/s | `6/5` | every 10 ticks |
| 1.33 tiles/s | `4/3` | every 9 ticks |
| 1.5 tiles/s | `3/2` | every 8 ticks |
| 2 tiles/s | `2/1` | every 6 ticks |

Canonical rates use rational or integer cadence data, never floating-point approximations. An integer movement-credit accumulator should support modifiers without floating-point authority.

The kernel has no real-time loop. It may process 12 ticks over one wall-clock second, one at a time, or as fast as possible. Presentation maps logical time independently. Milestone 2 must test 12 Hz and define unused movement credit after blocking, stun, failed melee entry, or speed changes before the hypothesis becomes locked.

## 5. Grid and occupancy

The battlefield is an open rectangular integer grid containing obstacles, chokepoints, finite deposits, neutral zones, and simple terrain modifiers.

- MVP actors occupy one tile.
- Structures have integer footprints.
- Multi-cell mobile units wait for an explicit later extension.
- Immutable terrain cannot be attacked.
- Only blockers designated destructible enter targeting and damage systems.
- There is no fractional authoritative position.

Units may route through friendly workers but cannot settle on them. A friendly actor whose endpoint contains a worker recalculates. Enemy units target workers normally.

### 5.1 Conceptual tick order

1. scheduled economy and production;
2. worker job/flee decisions;
3. military targeting and movement intents;
4. destination claims;
5. bounded conflict arbitration and recalculation;
6. settled occupancy;
7. attacks from faster to slower speed tiers;
8. simultaneous damage among non-conflicting attacks in one tier;
9. deaths, hostile-cell entry, destruction, salvage, and events;
10. objectives and victory.

Milestone 2 makes the exact sequence normative.

### 5.2 Routing service

The route service eventually supports:

- shortest traversable route;
- weighted terrain;
- route to a legal attack position rather than a target's occupied tile;
- temporary danger cost for workers;
- deterministic tie-breaking;
- bounded recalculation after a contested destination changes.

Worker flight prefers a route toward the friendly Nexus outside known enemy attack ranges. When no safe route exists, it minimizes cumulative threat exposure. A worker outside danger may take the closest available job before Pulse end.

### 5.3 Movement conflicts and melee

All movement intents are calculated from the same settled state. Claims resolve without duplicate occupancy.

Melee is an attempt to enter an enemy-occupied tile. Faster claims resolve first. Equal-speed conflicts use seeded deterministic arbitration. When a target dies, the winning claimant may occupy that cell in the same tick. Losing claimants recalculate or remain according to bounded rules.

No arbitration loop may be unbounded. Milestone 2 must define a progress measure and maximum number of recalculations.

### 5.4 Attacks and targeting

After movement settles, actors with valid targets may attack. Faster speed tiers resolve first. Non-conflicting attacks within one tier land simultaneously so entity iteration cannot decide survival.

Target selection is automatic and scored by unit behavior. Workers are normal candidates, neither globally protected nor always preferred. Domain events expose target score/reason, claims, attacks, damage, and death without requiring presentation to read mutable state.

Ranged attacks resolve at an authoritative tick. A visible projectile is normally a presentation cue between attack and impact events; it does not become a simulated moving body unless a specific mechanic explicitly earns that complexity.

## 6. Economy, labor, supply, and territory

### 6.1 Workers

Workers choose the closest available job by deterministic path distance. Jobs include building slots, natural deposits, salvage, returning to the Nexus when storage is full, and future faction-specific labor.

They do not carry individual bundles home. They remain at a job and produce continuously during the Pulse. When storage fills, they return toward the Nexus. When production spends resources and opens capacity, idle workers resume immediately.

Workers do not attack. They consume normal army supply and are produced by a dedicated automatic building.

### 6.2 Deposits and salvage

Natural deposits are finite and permanently deplete. A worker may harvest on the resource tile or one of four orthogonal neighbors, allowing five workers when all cells are free. A depleted tile becomes ordinary buildable terrain.

When a building is destroyed:

- half its value returns automatically to its owner;
- half becomes salvage on the map;
- workers from either side drain it continuously;
- building over remaining salvage destroys it.

### 6.3 Storage and supply

Warehouses only increase global storage. All stored resources are available to eligible production.

Workers and military share population supply. Destroying supply never deletes existing actors; spawning stops while population exceeds cap.

### 6.4 Construction territory

The battlefield Nexus roots a connected network. Buildings project a default construction radius of two tiles; outposts may project farther.

A disconnected building keeps operating but loses its projected radius until reconnected. A player cannot build inside enemy coverage that was public at Build Phase start. Individually legal hidden plans may reveal into overlapping coverage. A capture structure produces a neutral-zone bonus only while connected.

If simultaneous plans extend into the same neutral zone without occupying the same physical cell, both sides receive the temporary bonus while each maintains a connected claim. If one side loses the capture structure or a chain breach disconnects its coverage, that side loses the bonus. Same-cell structure conflicts remain for Milestone 3 to define.

Milestone 3 must lock:

- radius distance metric;
- footprint-to-radius measurement;
- same-plan chaining;
- simultaneous same-cell conflicts;
- path-sealing legality;
- refund behavior for invalid revealed plans.

Other systems must not guess these answers.

## 7. Determinism and replay authority

The eventual invariant is:

```text
simulatePulse(
  schemaVersion,
  engineVersion,
  contentLock,
  logicalTicksPerSecond,
  initialState,
  bothCommittedPlans,
  pulseTickCount,
  simulationSeed
) -> { finalState, orderedDomainEvents }
```

The kernel uses one named pseudorandom algorithm with serialized state and test vectors. It never calls `Math.random`, reads the wall clock, depends on locale-sensitive ordering, or imports presentation. Entity order and tie-breaks are explicit. State/event hashing uses canonical serialization. Tick rate is replay metadata and cannot silently change inside a ruleset version.

Playback consumes already-resolved events. Verification may re-simulate the inputs and compare state and event hashes. Palette, glyph pack, resize, frame skipping, playback speed, and cosmetic seed are outside authority.

A structured game log eventually records:

- schema, engine, and ruleset versions;
- content IDs, versions, and hashes;
- map ID/hash and logical tick rate;
- named PRNG and simulation seed;
- factions and Commander Armies;
- initial state and committed plans per Build Phase;
- ordered events per Nexus Pulse;
- final state/event hashes;
- outcome and termination reason;
- optional presentation markers explicitly excluded from verification.

## 8. Core content interfaces

These shapes describe intended boundaries, not code that Milestone 1 must generate. Exact naming changes when real content exercises them.

```ts
type ContentId = string
type EntityId = string
type Tick = number

type Coord = Readonly<{ x: number; y: number }>
type Footprint = readonly Coord[]
type Rational = Readonly<{ numerator: number; denominator: number }>

type ResourceCost = Readonly<Record<ContentId, number>>

interface UnitDefinition {
  readonly id: ContentId
  readonly roleTags: readonly string[]
  readonly maxHealth: number
  readonly supply: number
  readonly movementRate: Rational
  readonly attack?: ContentId
  readonly capabilities: readonly ContentId[]
  readonly presentation: ContentId
  readonly hooks?: readonly ContentId[]
}

interface AttackDefinition {
  readonly id: ContentId
  readonly range: number
  readonly damage: number
  readonly speedTier: number
  readonly cooldownTicks: number
  readonly targetRules: readonly ContentId[]
  readonly presentationCue: ContentId
}

interface StructureDefinition {
  readonly id: ContentId
  readonly roleTags: readonly string[]
  readonly level: 1 | 2 | 3
  readonly footprint: Footprint
  readonly maxHealth: number
  readonly cost: ResourceCost
  readonly buildRadius?: number
  readonly storage?: number
  readonly supply?: number
  readonly workerSlots?: number
  readonly production?: ProductionRecipe
  readonly attack?: ContentId
  readonly presentation: ContentId
  readonly hooks?: readonly ContentId[]
}

interface ProductionRecipe {
  readonly output: ContentId
  readonly quantity: number
  readonly cost: ResourceCost
  readonly intervalTicks: number
  readonly spawnRule: ContentId
}

interface UpgradeDefinition {
  readonly id: ContentId
  readonly family: string
  readonly tier: number
  readonly prerequisites: readonly ContentId[]
  readonly modifiers: readonly ContentId[]
  readonly presentation: ContentId
}

interface NexusPowerDefinition {
  readonly id: ContentId
  readonly timing: "build" | "reveal" | "pulse" | "passive"
  readonly cost?: ResourceCost
  readonly command?: ContentId
  readonly modifiers?: readonly ContentId[]
  readonly presentationCue: ContentId
}

interface CommanderDefinition {
  readonly id: ContentId
  readonly faction: ContentId
  readonly unit: ContentId
  readonly startingPackage: ContentId
  readonly armyRules: readonly ContentId[]
  readonly nexusPowers: readonly ContentId[]
  readonly upgradePool: readonly ContentId[]
  readonly presentation: ContentId
}

interface CommanderArmyDefinition {
  readonly id: ContentId
  readonly faction: ContentId
  readonly commander: ContentId
  readonly units: readonly ContentId[]
  readonly structures: readonly ContentId[]
  readonly upgrades: readonly ContentId[]
  readonly nexusPowers: readonly ContentId[]
  readonly startingPackage: ContentId
}
```

A Commander Army is the actual playable content boundary: the complete set of choices legally available to one player in a battle. See [`commander-armies.md`](commander-armies.md).

Prefer composable capabilities—health, movement, attack, production, storage, supply, worker slots, radius, restoration, and regroup anchors—over inheritance. Exceptional behavior may register narrow hooks for target scoring, damage modification, spawning, death, or alternate victory. Hooks receive constrained read-only context and return intents/modifiers/events for kernel validation.

A narrow hook API protects engine integrity; it is not a security sandbox. Installed TypeScript packages are arbitrary local code unless isolated by a real host boundary.

## 9. Battle Framework services

The future **Battle Framework** connects rules and content through small services and serializable contracts:

- coordinate, bounds, footprint, range, and neighborhood primitives;
- terrain, occupancy, and connectivity queries;
- deterministic routing and threat maps;
- target scoring and legal-target queries;
- movement intents and destination arbitration;
- tick scheduling and speed-tier attack batches;
- damage, death, destruction, salvage, and objectives;
- resource, supply, worker-slot, and production rules;
- placement, radius, path-access, and connectivity validation;
- canonical serialization, content locks, replay headers, and hashes;
- player-safe read models and ordered domain events;
- presentation-cue derivation, effects, render bands, and cell composition.

Milestone 1 needs an authored scene and cell boundary, not combat. Milestone 2 earns kernel contracts. Milestone 3 earns placement/map contracts. Milestone 4 reveals which content definitions deserve extraction. Only then should this list become a production package structure.

## 10. Presentation architecture

### 10.1 Player view and semantic events

`PlayerView` contains only visible, legal information. It never exposes an unrevealed plan. `DomainEvent` describes meaning: actor movement, attack, damage, destruction, construction, production, restoration, draft, or objective change.

Renderers never reverse-engineer glyphs or ANSI into mechanics.

### 10.2 Cell frames

The canonical terminal composition is initially 80×24 with a 48×18 battlefield. Larger terminals center or frame the same map and may expand inspection space without revealing extra tactical information. Below minimum size, playback pauses behind a resize gate and resumes from the same presentation time. Early milestones do not scroll or crop the battlefield.

```ts
type CellStyle = Readonly<{
  fgRole?: string
  bgRole?: string
  bold?: boolean
  dim?: boolean
  underline?: boolean
  inverse?: boolean
}>

type Cell = Readonly<{ glyph: string; style: CellStyle }>

type ReadonlyCellFrame = Readonly<{
  width: number
  height: number
  cells: readonly Cell[]
}>

interface TerminalBackend {
  start(): Promise<void>
  present(frame: ReadonlyCellFrame): void | Promise<void>
  stop(): Promise<void>
}
```

The frame has no backend objects. It is an excellent snapshot boundary for terminal output but is not the universal renderer API.

### 10.3 Accessibility and input

The game is keyboard-complete; mouse is optional direct manipulation. Core interaction eventually includes grid cursor, inspection, palette selection, placement preview, undo, commit, upgrade drafting, playback controls, and contextual help.

- ASCII-safe and Unicode packs map semantic roles separately.
- Every gameplay glyph occupies one cell; no emoji, combining mark, or ambiguous-width glyph is required.
- Monochrome, 16-color, 256-color, and truecolor are explicit modes.
- Color never carries ownership, target, danger, or health alone.
- Reduced motion keeps anticipation, impact, and settled state while removing decorative movement.
- Structured snapshots include glyph, foreground/background roles, and attributes.

Inspection may show larger ASCII portraits without obscuring required battlefield information.

### 10.4 Effects and presentation projectiles

Effects subscribe to semantic cues such as movement, ranged attack, damage, destruction, restoration, or Nexus critical state. They cannot apply damage, move actors, spend resources, or decide victory.

An effect recipe is initially a typed TypeScript function defining glyph/style output from origin, target/path/region, absolute presentation time, parameters, a cosmetic seed, render band, clipping, and reduced-motion alternative.

Effects are sampled from absolute time. The frame at `t` is the same whether every earlier frame rendered or many were skipped. Cosmetic randomness never consumes the simulation RNG.

Prefer fixed bands over unrestricted z-index:

1. `terrain`
2. `territory`
3. `ground-items`
4. `structures`
5. `units`
6. `projectiles`
7. `effects`
8. `highlights`
9. `chrome`

Each band returns sparse cells; the top defined cell replaces the lower complete cell style. Battlefield bands clip to the map. Presentation overlap never changes gameplay occupancy.

## 11. Runtime and terminal direction

Terminal Nexus stays TypeScript-first through early proofs. That does not require Node.js or any one TUI library to own the architecture.

The bounded candidates are:

- **Imperative OpenTUI on Bun:** leading terminal path because of cell buffers, input/mouse/resize support, native rendering, custom streams, SSH examples, and Bun executable packaging. Risks: pre-1.0 churn and native artifacts.
- **Direct ANSI TypeScript:** portability/control baseline under Bun plus Deno or Node. It must remain small and may not grow into an accidental widget framework.
- **Terminal Kit:** mature TypeScript contingency if direct ANSI begins recreating a library.
- **Ratatui + Crossterm:** strongest native architecture contingency if TypeScript fails measured requirements; adopting it would create a Rust boundary and content/modding cost.
- **Bubble Tea + Wish:** strongest Go hosted-SSH contingency, likewise not an early default.

Deno is valuable for a pure-TypeScript ANSI/package probe, not an assumed OpenTUI host. Node remains viable but is no longer inherited automatically from Model Chess Club. Exact runtime/library versions must be checked and pinned during the active gate.

### 11.1 Terminal lifecycle

The application uses the alternate screen and one idempotent disposer. It restores cursor, input mode, handlers, and screen after normal exit, `q`, `SIGINT`, `SIGTERM`, setup failure, and caught render failure. It cannot promise cleanup after `SIGKILL` or host failure.

Non-TTY launch emits one readable message instead of animation escapes. Diagnostics are captured and emitted after terminal cleanup. Backends report capability mode explicitly.

### 11.2 Delivery ladder

1. Local executable and ordinary remote shell/PTY.
2. Restricted public SSH command, later possibly through a session gateway.
3. Browser terminal by streaming ANSI through authenticated WebSocket to xterm.js.
4. Browser-native renderer using semantic views in Canvas/WebGL.
5. iOS/native shell beginning with web/PWA or a web wrapper; later a native renderer.
6. Optional future pixel or 3D presentation consuming the same semantic contract.

Remote, browser, mobile, pixel, and 3D surfaces are architectural possibilities, not Milestone 1 product commitments.

## 12. Tools and future modding

First-party development should use explicit definitions and fast tools:

- maps as inspectable ASCII/cell arrays plus metadata;
- armies, units, structures, upgrades, themes, and glyphs as validated TypeScript/data;
- effects as typed functions and parameter sets;
- cutscenes as tableaux, poses, timelines, and dialogue;
- missions as map, army, unlock, objective, trigger, and scene definitions;
- campaigns as mission graphs and progression state.

A battle/map editor should soon let humans and agents place actors and terrain, select a seed and Pulse length, run/step/restart a simulation, inspect routes/targets/events, and export scenarios/logs from files or CLI. The first version may be a TUI sandbox rather than a polished visual editor.

This is **modding-first architecture, not mod-loader-first development**. No public SDK, remote loader, marketplace, permission system, or compatibility promise belongs in early milestones.

If package installation exists later, it resolves immutable versions/commits, installs locally, records IDs/hashes, and requests trust for executable TypeScript. Saves and replays record exact engine, ruleset, and content locks. Portable mobile content begins as declarative data; arbitrary downloaded code is not promised.

Themes may recommend fonts, but a terminal app cannot reliably change the host font. Every package retains an ASCII-safe fallback.
