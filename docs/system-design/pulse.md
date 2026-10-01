# Terminal Nexus — the Pulse

_How state changes: logical time, movement credit, tick order, determinism and replay, match structure, the economy and the events the simulation emits._

## 1. The Pulse

### 1.1 Logical time — RULE — `tests/rules.test.ts`

A Pulse runs a fixed number of **logical ticks** at **12 ticks per simulation second**. A tick is one
rules update. Twelve is chosen because it produces exact integer cadences at every speed the game
wants:

| Display speed | Exact rate | One-tile step every |
| ---: | ---: | ---: |
| 0.5 tiles/s | `1/2` | 24 ticks |
| 0.67 tiles/s | `2/3` | 18 ticks |
| 0.75 tiles/s | `3/4` | 16 ticks |
| 1 tile/s | `1/1` | 12 ticks |
| 1.2 tiles/s | `6/5` | 10 ticks |
| 1.33 tiles/s | `4/3` | 9 ticks |
| 1.5 tiles/s | `3/2` | 8 ticks |
| 2 tiles/s | `2/1` | 6 ticks |

Rates are rational, never floating point. `tests/rules.test.ts` reproduces the cadence table above
exactly at all eight rates on every run.

**The kernel has no real-time loop**, and **resolution speed is independent of logical time** (RULE —
`tests/playback.test.ts`, `tests/pulse-run.test.ts`). It may resolve 12 ticks in a microsecond or
over an hour. The renderer maps logical time onto wall-clock time by itself; playback speed, pause
and stepping change when a tick is shown, never what a tick does. Presentation targets **30 frames
per second**, which is 2.5 frames per tick — deliberately not an integer, because effects sample
absolute time and must not quietly start depending on a frame:tick alignment.

**What changing the rate would cost.** Content durations are authored in raw ticks (`cooldownTicks`,
`intervalTicks`, and every cooldown in a fixture), so the number 12 is baked into every one of them.
Moving the tick rate is a migration of every duration in every definition and scenario, not a
constant to edit. The alternative, authoring durations as rational seconds, buys rate-independence
at the cost of arithmetic at every use site; it was considered and rejected as the worse trade. The
rate stays cheap to change only while little content exists, and once real rosters are authored it
is expensive.

### 1.2 Movement credit — RULE — `tests/rules.test.ts`

An integer accumulator, no floating point:

- each tick, `credit += rate.numerator`
- a step costs `rate.denominator × 12`
- when `credit >= cost`, the actor attempts one step and `credit -= cost`

Check it against the table: `1/1` accrues 1 per tick against a cost of 12 — one step every 12 ticks.
`3/2` accrues 3 against a cost of 24 — every 8 ticks. It reproduces the table exactly.

Two rules govern what happens when an actor cannot step:

- **Credit is capped at one step's cost.** An actor that could not move cannot bank a sprint.
- **A blocked step keeps its credit.** An actor jostled out of a claim steps the moment the tile
  frees, rather than restarting its timer. This stops traffic jams from silently halving an army's
  speed.

The same file asserts both: the cadence holds across a second step, credit never exceeds one step's
cost over five hundred ticks, and in the jammed-corridor fixture a mover blocked on one tick steps on
the next — which is only possible if a refused step spends nothing.

### 1.3 Tick order — RULE — `src/pulse/tick.ts`, `tests/rules.test.ts`

Every phase reads the state **settled at the end of the previous phase**, so that iteration order
over entities can never decide an outcome:

1. **Tick open.** Advance the tick counter. Nothing else.
2. **Economy and production.** Scheduled resource yield; producers attempt recipes. The slot exists
   in `src/pulse/tick.ts` and is empty until the economy is built; a mid-Pulse combat spawn (a
   spawner, a unit that splits on death) runs just ahead of it.
3. **Perception.** Each actor scores and selects a target. Deterministic scoring, ties broken by
   entity id.
4. **Intents.** Each actor with movement credit declares one destination tile.
5. **Arbitration** (`src/pulse/arbitration.ts`). Group intents by destination *within a layer*.
   Contested claims resolve by speed tier — **tier 1 outranks tier 2** — with any remaining tie
   broken by one draw from the seeded stream. Entity id orders iteration and event emission, never
   outcomes. Losers hold or recalculate, under a bounded number of passes with a strictly decreasing
   progress measure.
6. **Settle.** Apply winning moves. Occupancy is now fixed for this tick.
7. **Attacks** (`src/pulse/attacks.ts`). By speed tier, **tier 1 first**. Within one tier, every
   valid attack is computed against the state at tier start and applied **simultaneously**, so no
   entity survives merely by being iterated first.
8. **Resolution** (`src/pulse/death.ts`). Apply damage, deaths, destruction, salvage. Emit ordered
   events.
9. **Objectives and victory** (`src/pulse/victory.ts`).

**Speed tier is one number meaning initiative**, used identically in both places: a lower number acts
earlier, for movement claims in step 5 and for attacks in step 7. It is not a movement rate — that is
`movementRate` (movement credit above) — and the two are deliberately independent, so a slow, heavy
unit may still strike first.

Melee is an attempt to enter an enemy-occupied tile on the same layer. When the defender dies in
step 8, the winning claimant may occupy the tile on the following tick.

**A mover's origin tile does not free within the same tick.** Every phase reads the state settled at
the end of the previous phase, so a follower steps one tick behind the actor in front of it rather
than in lockstep. This keeps "no two entities ever overlap" true by construction and keeps
arbitration's progress measure simple.

**Death can be contagious, and step 8 is a queue rather than a pass** (RULE —
`tests/ravel.test.ts`). Where content detonates on death — Ravel volatile munitions are the first
such rule, and they sit in the bench rosters — the blast damages everything inside its
radius, friend and foe, and anything reduced to zero joins the queue. **The chain is bounded because
an entity can only die once**, so the queue drains after at most one round per entity and the whole
cascade settles inside the tick that started it. Order is entity order throughout.

Ranged attacks resolve at an authoritative tick. **A projectile is normally a presentation cue drawn
between the attack event and the impact event** — it is not a simulated moving body, and it cannot
be intercepted, unless some specific mechanic later earns that complexity, which nothing has.

**Damage from a ranged attack is authoritative at the tick it resolves** — steps 7 and 8 of that same
tick, always. The attack event additionally carries a **flight window**, measured in ticks and
derived deterministically from the distance to the target as
`max(1, ceil(distance / projectileTilesPerTick))`, where the tiles-per-tick figure is a property of
the attack. It is part of the event and its hash, and it is read by **no rule**
(RULE — `tests/rules.test.ts`): it exists so that presentation knows how long the shot should appear
to take. A renderer drawing a tracer holds the impact, the damage flash, and the visible health change
until the end of that window, so what the player sees lands when the tracer does; a renderer that
draws no tracer (reduced motion, monochrome) still presents damage at the impact beat.

### 1.4 Determinism and replay — RULE — `tests/determinism.test.ts`

```text
resolvePulse(
  schemaVersion, engineVersion, contentLock,
  ticksPerSecond, initialState, committedPlans,
  pulseTickCount, gameplaySeed
) -> { finalState, orderedEvents }
```

**The named PRNG is PCG32** (RULE — `tests/rng.test.ts`) — the `pcg_setseq_64_xsh_rr_32` variant,
64-bit LCG state with a 32-bit XSH-RR output. It was chosen because its state is two 64-bit words, so
it serialises into hashed state and restores from it exactly, and because it ships **published** test
vectors rather than vectors a session generated for itself: `tests/rng.test.ts` checks it against the
expected output of the `imneme/pcg-c` repository's own check program, seeded 42/54. Streams are
separated by the `initseq` parameter, which is what PCG provides it for.

**Cosmetic randomness is a hash of an effect instance's identity, never a stream** (RULE —
`tests/effects.test.ts`, `tests/determinism.test.ts`). A stream's answers depend on how many times it
was asked, which is exactly what effect purity forbids. The two randomness sources never touch: the
cosmetic seed changes no state hash, event hash or log.

The kernel:

- uses one named PRNG with serialized state and published test vectors;
- never calls `Math.random`, reads a clock, or depends on locale-sensitive ordering (RULE —
  `tests/determinism.test.ts`, `tests/architecture.test.ts`);
- makes entity order and every tie-break explicit;
- hashes state and events through one canonical serialization;
- treats the tick rate as replay metadata that cannot change inside a ruleset version.

Verification re-runs the inputs and compares hashes. Palette, glyph pack, resize, dropped frames,
playback speed, and the cosmetic seed sit outside that boundary entirely.

A game log records schema, engine, and ruleset versions; content ids and hashes; map id and hash;
tick rate; PRNG name and seed; armies; initial state; committed plans per Build Phase; ordered events
per Pulse; final hashes; outcome; and any presentation markers, explicitly excluded from
verification. [`replay-format.md`](replay-format.md) is a first concrete schema for exactly this list;
it is GUIDANCE and not built.

---

## 2. Match structure

**A Grid Nexus is a flag on a content definition, never a content id the kernel recognises** (RULE —
`tests/ravel.test.ts`, `src/pulse/victory.ts`). An early victory condition keyed on the id
`structure.citizen.nexus` broke the moment the second faction existed. Anything a faction calls its
Grid Nexus declares itself one, and the rules read the flag.

A match alternates (RULE — `tests/pulse-run.test.ts`, `tests/mission.test.ts`):

- **Build Phase** — hidden, simultaneous, turn-based, untimed planning from the same public resolved
  state;
- **Nexus Pulse** — simultaneous reveal, then a fixed number of deterministic ticks.

One Build Phase and the Pulse that follows it is a **round**, the unit the player counts. A match
runs **as many rounds as it needs** — a campaign mission is a sequence of rounds, not one, and a
mission's triggers decide how many and what happens between them (see
[`campaigns.md`](../game-design/campaigns.md)). A Pulse may be scripted (no player plan; the player
watches) and it is still a Pulse: seeded, deterministic, replayed the same way.

**The kernel's victory condition never learns about a mission's goal.** A mission's objective is
resolved one level up, by the scenario and trigger layer, which fires an ordinary `win`/`lose` action
when its own condition holds (see [`campaigns.md`](../game-design/campaigns.md)). What follows — Grid
Nexus destroyed, one side annihilated, tick limit reached — is the unchanged fallback a battle with
no declared objective lands on: every Skirmish match, and every Challenge battle (RULE —
`src/pulse/victory.ts`).

Both players see the resolved Grid: terrain, deposits, neutral zones, known actors, health,
structures, public construction coverage. Newly committed construction and upgrade choices stay
hidden until reveal.

At Pulse start plans reveal together and valid construction becomes operational. Workers pick jobs,
producers attempt recipes, actors move and fight automatically. Playback controls cannot change the
result (RULE — `tests/pulse-run.test.ts`).

At Pulse end survivors regroup near home producers. Orphans are adopted by the nearest compatible
producer or regroup near the Grid Nexus. Production cooldowns reset to a full interval (RULE —
`src/match/recall.ts`, `tests/match.test.ts`).

**Destroying the enemy Grid Nexus wins** (RULE — `src/pulse/victory.ts`,
`tests/scenario.test.ts`). Any attacker in a legal attack position may damage it. Defences and
terrain make practical outer layers; there is no hidden exposure meter.

### 2.1 Commander

A persistent frontline unit, normally `@` — fictionally a Nexus Symbol — on the `units` layer. It may
take Nexus-specific upgrades and competes for investment with army, economy, research, and
fortification. **On death it is absent for the rest of that round's Pulse and for one full round
after it, then the Prime Nexus may replicate it again** (RULE — settled; no code holds it yet). **Commander death is not the victory
condition** (RULE — `src/pulse/victory.ts`, which reads only the Grid Nexus flag and annihilation).

### 2.2 Structures

Common roles: Grid Nexus (victory target, construction root, upgrade draft, Commander anchor);
economic structures with worker slots; warehouses for global storage; supply structures for the
shared population cap; worker producers; military producers; defences; research facilities that are
themselves tech tree nodes (below); outposts that project construction coverage; capture structures
that claim a neutral-zone bonus while connected.

Structures live on the `obstacles` layer, are operational immediately after reveal, cannot move or
be sold, and keep working while disconnected but stop projecting coverage.

**The Prime Nexus remains at its home location and replicates a smaller Grid Nexus onto the Grid;
Nexuses do not teleport** (RULE).

### 2.3 Automatic production

**Production is fixed recipes run by buildings, never direct unit purchases** (RULE — settled; no code holds it yet). No shop, no
queue. A producer attempts a fixed recipe on a recurring interval. When simultaneous attempts cannot
all be paid or supplied, every feasible attempt enters one seeded contention process: one is chosen,
paid, and spawned; feasibility is recomputed; repeat until nothing legal remains.

Players shape composition by building, protecting, upgrading, pausing, or losing producers.

### 2.4 Research, the tech tree, and Nexus powers

A Commander Army's buildable structures form a real, inspectable tech tree (see
[`commander-armies.md`](../game-design/commander-armies.md)), mostly shared across a faction's
Commanders with a few Commander-specific branches. Research facilities are not an alternative to a
"linear tech menu"; they are tree nodes like any other structure, and completing one can unlock its
dependents the same way a Nexus power's `unlockStructure` effect does — one mechanism, two triggers.
The tree is limited entirely by which structures exist, never by a second resource (the one-resource
rule in the economy below is untouched).

The Grid Nexus also offers a small draft of upgrades; research facilities modify that draft's tier,
breadth, redraws, weighting, or visibility. Structures may reach levels 1–3. Nexus powers are
content-defined legal actions or passive rules that execute through validated kernel commands.

What the draft is dealt from is settled even though the draft itself is not designed: the Commander
Army's own Nexus power pool — a subset of the faction's — dealt as a small hand at the start of every
Build Phase, from which the player keeps one. The draft's tier, size, and redraw rules are still
undesigned; they are recorded here so the shape of the draft is not accidentally foreclosed.

What a power may *do*: to a player, a power is a name and a plain description of what it does — no
classification to learn — and in code the effect is one of a small bounded union: `unlockStructure`,
`spawnUnits`, `modifyContent`, `modifyRule`, `modifyCommander`, `reveal` (see
[`commander-armies.md`](../game-design/commander-armies.md)). That union is what a Build Phase panel
actually renders, so it is worth reading before building one.

---

## 3. Economy

**A match uses one resource** (RULE). Deposits and salvage both yield it. Supply is a separate shared
population cap, not a second currency. Nexus energy is a state readout, not something a player
spends.

`ResourceCost` stays a keyed record (see [`content.md`](content.md)) so a later microgame can earn a
second resource without a schema change — but nothing before real rosters are authored may assume one
exists.

**Workers** pick the closest available job by deterministic path distance: building slots, deposits,
salvage, and later faction-specific labour. They produce in place rather than carrying bundles home,
they do not attack, they consume normal supply, and they are produced by a dedicated automatic
building. What a full store does to a working labourer is an open question (Q7, whether workers carry
or produce in place); the recommendation is that it stalls in place.

**Deposits** are finite and permanently deplete. A worker harvests from the deposit tile or one of
its four orthogonal neighbours, so five may work one deposit. A depleted tile becomes ordinary
buildable terrain.

**Destruction** returns half a structure's value to its owner automatically and drops the other half
as salvage on the Grid. Workers from either side drain salvage. Building over remaining salvage
destroys it.

**Construction territory:** the Grid Nexus roots a connected network; structures project a
construction radius (default two tiles, outposts farther; the default is an open question, Q5); a
disconnected structure keeps operating but stops projecting; a player cannot build inside enemy
coverage that was public at Build Phase start.

The radius metric, footprint-to-radius measurement, same-plan chaining, simultaneous same-cell
conflicts, path-sealing legality, and refunds for invalid revealed plans are still to be decided
when construction is built. No other system may guess those answers.

---

## 4. Events — RULE — `tests/determinism.test.ts`

Events are how presentation learns anything.

The Pulse emits an ordered list of `DomainEvent`s describing **meaning**, not appearance: an actor
moved from here to there, this attacked that with this result, this took damage, this died, this was
built, this was destroyed, this was produced, this objective changed. Events carry enough context —
the score or reason behind a target choice, the claim that was contested, the amount and kind of
damage — that a renderer never has to read mutable state to explain what it is drawing. The event
stream round-trips as JSONL and every kind it emits is a declared kind.

**Renderers never reverse-engineer glyphs, cells, or ANSI back into mechanics.** If presentation
needs to know something, the event carries it or the projection exposes it.

`PlayerView` contains only visible, legal information for one player and never exposes an unrevealed
plan.
