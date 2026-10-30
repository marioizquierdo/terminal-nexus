# Terminal Nexus — the Pulse

_How state changes: logical time, movement credit, tick order, determinism and replay, match structure, the economy and the events the simulation emits._

## 1. The Pulse

### 1.1 Logical time — RULE — `tests/rules.test.ts`

A Pulse runs a fixed number of **logical ticks** at **12 ticks per simulation second**. A tick is one
rules update. Twelve is chosen because it produces exact integer cadences at every speed the game
wants:

| Speed across | Exact rate | A step across every |
| ---: | ---: | ---: |
| 0.5 columns/s | `1/2` | 24 ticks |
| 0.67 columns/s | `2/3` | 18 ticks |
| 0.75 columns/s | `3/4` | 16 ticks |
| 1 column/s | `1/1` | 12 ticks |
| 1.2 columns/s | `6/5` | 10 ticks |
| 1.33 columns/s | `4/3` | 9 ticks |
| 1.5 columns/s | `3/2` | 8 ticks |
| 2 columns/s | `2/1` | 6 ticks |

A step up or down takes twice as many ticks.

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

### 1.2 Movement credit — RULE — `tests/rules.test.ts`, `tests/rows.test.ts`

An integer accumulator, no floating point:

- a unit's **beat** is the whole number of ticks a step across takes: `ceil(12 × rate.denominator /
  rate.numerator)`
- each tick, `credit += rate.numerator`
- a step costs a beat's worth of credit, `rate.numerator × beat`, for each column of distance it covers
  (`stepCost`, `stepLength`): a step across costs one beat's worth, and a step up or down twice that, since a
  row counts two columns ([`grid.md`](grid.md), distance, reach and movement)
- when `credit >= cost` of the step it wants, the actor attempts that step and `credit -= cost`

So a step across takes exactly one beat and a step up or down exactly two, at every rate: a walk takes as many
beats as its distance. Check it against the table: `1/1` has a beat of 12 and accrues 1 against a cost of 12 — one step every
12 ticks; `3/2` a beat of 8, accruing 3 against 24 — every 8 ticks. It reproduces the table exactly. A rate whose
numerator does not divide `12 × denominator` rounds its step across up to whole ticks: a raider's `8/3`
steps across every 5 ticks (40 credit) and down every 10 (80).

Two rules govern what happens when an actor cannot step:

- **Credit is capped at one step's cost** — the dearest step's, when steps differ. An actor that could not
  move cannot bank a sprint: it waits for the step it wants rather than taking a cheaper one it likes less, and
  once it can pay, its credit is capped at that step's own cost, so saving up for a step down never buys two
  quick steps across. A loser of a contested tile is offered only steps it can pay for, and the step it is
  granted spends that step's cost from credit capped at it, so losing a claim on a step down never buys two
  quick steps across either.
- **A blocked step keeps its credit.** An actor jostled out of a claim steps the moment the tile
  frees, rather than restarting its timer. This stops traffic jams from silently halving an army's
  speed.

`tests/rules.test.ts` asserts both: the cadence holds across a second step, credit never exceeds one step's
cost over five hundred ticks, and in the jammed-corridor fixture a mover blocked on one tick steps on
the next — which is only possible if a refused step spends nothing.

Which step a unit wants is its route's (section 1.6): the step along a shortest walk to where its attack reaches its
target. A step down costs two beats and a step across one, so a route counts a row as two columns, and a unit walks
the screen's diagonal, two columns across for each row down (`tests/rows.test.ts`).

### 1.3 Tick order — RULE — `src/pulse/tick.ts`, `tests/rules.test.ts`

Every phase reads the state **settled at the end of the previous phase**, so that iteration order
over entities can never decide an outcome:

1. **Tick open.** Advance the tick counter. Nothing else.
2. **Economy and production.** Scheduled resource yield; producers attempt recipes. Only the
   recipes exist so far (`src/pulse/production.ts`, below); the yield waits for the worker economy. A
   mid-Pulse combat spawn (a spawner, a unit that splits on death) runs just ahead of it.
3. **Perception.** Each actor scores and selects a target: the nearest; among equally near ones the one it
   already holds, then the one with least health (a squad fires into the same enemy), then a seeded draw; a unit that
   aims at a crowd first takes the enemies with the most of their side round them (below). Then the
   tick's routes are built from who walks and who stands (section 1.6), and a unit that would walk chooses again by
   what it can reach: a melee unit the enemy nearest to walk to, any unit one it can reach at all. Every target set,
   who marches and who of them walks at half speed (the march, section 1.6).
4. **Intents.** Each actor with movement credit declares one destination tile: the best step of its route it
   fits now. A unit held up behind allies that are stuck walks round them; two allies that want each other's tile
   swap. A marcher walking at half speed accrues its movement credit on every second tick only; an ally of higher priority
   held up behind it swaps with it.
5. **Arbitration** (`src/pulse/arbitration.ts`). Group intents by destination *within a layer*.
   Contested claims resolve by speed tier — **tier 1 outranks tier 2** — with any remaining tie
   broken by one draw from the seeded stream. Entity id orders iteration and event emission, never
   outcomes. Losers hold or recalculate, under a bounded number of passes with a strictly decreasing
   progress measure.
6. **Settle.** Apply winning moves: each mover's credit is capped at the cost of the step it was granted, then
   that cost is spent. Occupancy is now fixed for this tick.
7. **Attacks** (`src/pulse/attacks.ts`). By speed tier, **tier 1 first**. Within one tier, every
   valid attack is computed against the state at tier start and applied **simultaneously**, so no
   entity survives merely by being iterated first. Then each ability's tick (below), then **burning ground** burns
   what stands on it, and what has burnt its time goes out (`src/pulse/burning.ts`, below).
8. **Resolution** (`src/pulse/death.ts`). Apply damage, deaths, destruction, salvage. Emit ordered
   events.
9. **Objectives and victory** (`src/pulse/victory.ts`).

**Speed tier is one number meaning initiative**, used identically in both places: a lower number acts
earlier, for movement claims in step 5 and for attacks in step 7. It is not a movement rate — that is
`movementRate` (movement credit above) — and the two are deliberately independent, so a slow, heavy
unit may still strike first.

Melee is an attempt to enter an enemy-occupied tile on the same layer. When the defender dies in
step 8, the winning claimant may occupy the tile on the following tick.

**Melee is touching** (RULE — `src/pulse/shared.ts`, `tests/rows.test.ts`): a melee attack reaches what is
within its range in steps along the Grid's sides, so a trooper swings at an enemy straight above it as at one
beside it. Everything else that reaches — a shot, a heal, an aura, a blast or splash, a vision, a worker's
flight and a contact detonator's trigger — is measured as range is, to the nearest tile of each footprint, a row
counting two columns, and a reach of one or more always includes what touches.

**A mover's origin tile does not free within the same tick.** Every phase reads the state settled at
the end of the previous phase, so a follower steps one tick behind the actor in front of it rather
than in lockstep. This keeps "no two entities ever overlap" true by construction and keeps
arbitration's progress measure simple.

**Death can be contagious, and step 8 is a queue rather than a pass** (RULE —
`tests/ravel.test.ts`). Where content detonates on death — Ravel volatile munitions are the first
such rule, and they sit in the bench rosters — the blast damages everything inside its
radius, friend and foe — or only the other side's, where the content says it hits enemies alone — and anything
reduced to zero joins the queue. **The chain is bounded because
an entity can only die once**, so the queue drains after at most one round per entity and the whole
cascade settles inside the tick that started it. Order is entity order throughout.

Ranged attacks resolve at an authoritative tick. **A projectile is normally a presentation cue drawn
between the attack event and the impact event** — it is not a simulated moving body, and it cannot
be intercepted, unless some specific mechanic later earns that complexity, which nothing has.

**Damage from a ranged attack is authoritative at the tick it resolves** — steps 7 and 8 of that same
tick, always. The attack event additionally carries a **flight window**, measured in ticks and
derived deterministically from the distance to the target as
`max(1, ceil(distance / projectileTilesPerTick))`, the distance counted as range is, where the tiles-per-tick
figure is a property of the attack: a shot two rows up takes as long as one four columns across. It is part of the event and its hash, and it is read by **no rule**
(RULE — `tests/rules.test.ts`, `tests/rows.test.ts`): it exists so that presentation knows how long the shot should appear
to take. A renderer drawing a tracer holds the impact, the damage flash, and the visible health change
until the end of that window, so what the player sees lands when the tracer does; a renderer that
draws no tracer (reduced motion, monochrome) still presents damage at the impact beat.

**An ability is decided by the kernel, from a table** (RULE — `src/pulse/abilities.ts`, `src/abilities/`,
`tests/abilities.test.ts`, `tests/aura.test.ts`, the `aura-by-the-book` and `dob-bounty` scenarios). What a unit does
on its own is content's `abilities`, each one an entry of the abilities table (`PulseContext.abilities`, the shipped
`ABILITIES` by default), and the kernel calls each kind at four fixed moments: as the attacks begin it asks every
kind for the tick's damage modifiers, on a read-only view of the bodies; as each attack lands (heals and blasts
excluded) it asks the attacker's kinds about the hit; after the attacks, each kind's tick; and as each unit falls,
each kind's death. A kind changes the world only through what it is handed: a draw from the gameplay stream, a
heal, a damage, a note that becomes an `ability.triggered` event. The table order and the bodies' order decide only
in what order things are said, so a run hashes the same.

- **An aura guards or boosts the units beside its bearer** (`src/abilities/aura.ts`). Its radius is measured as
  range is; it covers every unit of the bearer's side within it, the bearer included, and a building with an aura
  covers itself too. A guard (`damageTakenPercent`, Vasse's By the Book at 75) makes a covered unit take that share
  of every hit that tick, blasts included, rounded down and never below 1; a boost (`damageDealtPercent`, Averno's
  Forward Order at 125) makes its every hit that share of itself, rounded down and never less than the hit. Several
  auras never stack: the strongest of each applies. A hit is boosted by its source first, then guarded by its
  target's aura. A bearer who falls still covers that tick. The hit's `damage.applied` names the guard
  (`guardedBy`); no rule reads it.
- **A bounty pays for enemies that fall near its bearer** (`src/abilities/bounty.ts`, Dob Hunter): credits a
  fall within its radius, noted on `ability.triggered`; the rules between rounds add them to the side's credits
  (`src/match/earnings.ts`). Nothing in a Pulse reads them.
- **Loaded dice make a hit sometimes count several times over** (Dob's, one in four for triple) (`src/abilities/loaded-dice.ts`): a seeded draw on
  each of the bearer's attacks.

**A unit may aim at a crowd** (RULE — the owner, 2026-10-21; `ContentDef.aim`, `src/pulse/perception.ts`,
`tests/area-damage.test.ts`, the `bomber-crowd` scenario). A unit whose content says `aim: "crowd"` chooses among the
enemies it could target the ones with the most units and workers of their own side within its area round them —
its attack's `burn` radius, else its `splash` radius, else its `detonation`'s, measured as range is, from the
candidate's body, the candidate counted — and among those as every unit chooses: the nearest, the one it holds, the
weakest, a draw. Walking to it, it passes over one it cannot reach for the thickest it can, as a shot does. The Ravel
bomber and the Citizen mortar aim so; every other unit takes the nearest, as it always did. The choice's
`target.selected` says the crowd it counted (`crowd`); no rule reads it.

**Burning ground** (RULE — the owner, 2026-10-21; `AttackDef.burn`, `MatchState.burning`, `src/pulse/burning.ts`,
`tests/area-damage.test.ts`, the `mortar-burning-ground` scenario). A landing hit of an attack that `burn`s lights a
patch round its target's anchor tile — the point its splash is centred on — on the tick it lands, which is the tick
it is launched. The patch is kept in the state with its place, its radius, its damage, its beat and its lifetime
(`startedTick`, `untilTick = startedTick + ticks`) and the shooter's id. On each tick a whole number of beats after it
was lit, up to its last tick, every unit and worker within its radius of its centre, measured as range is, of either
side, takes its damage — never a flyer, never a building. It burns in its own step after the attacks and the
abilities' ticks and before the deaths settle; every patch's victims are added up and applied at once, as a splash's
are, so two patches on one tile are one hit, named by the first patch kept (patches are kept by when they were lit,
then by the shooter's ordinal). A guard still softens it; a boost round the shooter does not, since the fire is not a
blow the shooter strikes where it stands. A kill by fire is the shooter's, named by its id whether it still stands or
not, and gives no killer's pause. A patch whose time is up goes out after it burns its last (`ground.lit`,
`ground.burned`, `ground.out`). The state carries `burning` only while something burns, so a state without fire hashes
as it did before fire existed. Routes weigh it while it burns (section 1.6), and it is put out between rounds (section 2). The
Citizen mortar's shell is the first that burns, and it has two jobs (the owner, 2026-10-21): its burst, 12 within 2,
hurts only the enemy (an area's `hits: "enemies"`, which a splash and a death's blast both read; without it an area
hurts friend and foe), and the fire it leaves, 8 a second within 4 for four seconds (48 ticks), hurts everyone on it,
either side.

**A healer heals the nearest wounded ally, and a building heals only within its reach** (RULE —
`src/pulse/perception.ts`, `tests/aid-station.test.ts`, the `aid-station-repair` scenario). A healer — content's
`behavior: "support"` with a heal `attack` — chooses the nearest wounded ally rather than the nearest enemy, ties
broken as a target's are (below), and one that names `targetLayers` chooses only among what stands on them, as an attacker's
layers narrow its enemies. A building never moves, so a building that heals reaches that ally only once it stands
within its reach, measured as range is: one heal each time its cooldown allows, never past full health
(`heal.applied`, never a negative `damage.applied`). A heal lands in its tier of the attacks step, after the blows
of earlier tiers, so at tier 9 a unit a blow kills that tick is not saved. The Aid Station, what Aid Station Permit
adds, names the units' layers: it heals units, never a building, itself included, and never the enemy. The
bench medic names none and heals every wounded ally, as it always did.

### 1.3a No side wins by where it stands — RULE — `tests/fairness.test.ts`

The owner, 2026-10-19: "the solution should be deterministic independently of the side or top vs down or
diagonal". **Every tie a rule breaks goes first by what the deciding unit faces — the enemy, or where it is headed —
and what is still tied after that by one draw from the seeded stream** (`drawAmong`, `src/pulse/shared.ts`). Never
by reading order, compass order or entity id: the opening hands ids out in reading order, so each of those favours
the side the map put west, north or first. Before this rule one end of the map won nearly every mirror duel: the west with a rushing plan, the east with a
balanced one.

- **Blows land together.** Every hit of a speed tier is worked out against the state as the tier began and applied
  at once (the attacks step), so two equal units that strike each other in the same tick both fall.
- **A building sets its units down facing the fight**: on the tile of its roof nearest where they head — its side's
  target if it follows one, else the enemy's Grid Nexus, else the nearest enemy as the tick began — ties drawn; with
  nowhere to head, the roof's own order. Neighbouring buildings set theirs down front first, nearest the enemy, and two as far forward in
  a drawn order (`src/pulse/spawn.ts`), so neither claims the ground between them by its id.
- **A step as good as another** goes by the turn from the way the unit faces its goal, then a draw (section 1.6),
  never by compass order.
- **A unit's target among equally near enemies** is the one it holds, then the weakest, then a draw (perception). A
  unit that aims at a crowd counts each candidate's crowd from where bodies stand and whose they are, never an order,
  and breaks a tie between equal crowds the same way.
- **A wide unit measures its walk from its nose**: its tile nearest the goal, and the enemy tile nearest it.
- **The march** reads only where bodies stand and whose they are: who is in whose sight and the band are distances, the
  guide line is drawn alike from either end (a point exactly between two tiles takes both), half speed is credit on the
  tick's parity (the same on either side), and two allies that would swap with one slower unit are drawn between; a
  mirrored march stays a mirror tick for tick (`march-mirror`).
- **Between rounds** (`src/match/`), where nothing is drawn: a group set down round a point, a Commander's return and a mission's
  arrivals break a tie toward the enemy's Grid Nexus (`enemyNexusMiddle`); the regroup's slots and the order units make
  room for a building go by what a side faces, and the sides alternate. Forces whose
  musters meet are set down in turns, a unit of each at a time, the order reversed each turn, so the first listed does
  not take all the ground between them. A duel places a building by its footprint's middle, not its north-west
  corner.

One order is left inside a side: of several attackers whose blows kill a unit in the same tick, the lowest id is
named its killer and takes a killer's pause. It never decides which side gains, only which of one side's units
waits; changing it tipped the campaign's empty-base walks (a route to a later round plays the rounds before it
building nothing) more than anything else did, so it waits for a
reason of its own.

A mirror battle with nothing tied stays a mirror tick for tick; with ties, each side wins it as often over seeds, and
mirror duels split about evenly (`tests/fairness.test.ts`, over forty-eight duels; `tests/route-scenarios.test.ts`,
two squads in one corridor). Entity id still orders iteration and the events.

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

### 1.5 A side's target — RULE — `src/pulse/target.ts`, `tests/target.test.ts`

A side may have a **target**: a rectangle of the map, kept in the state as `targets` and set only by the
trigger runner, never by the kernel (the owner, 2026-10-04: "The campaign levels should have a target well
defined so it is predictable where your troops are moving"). Every unit of that side that moves and fights heads
for it. On the way it turns on an enemy within its vision (6, six columns across and three rows up and
down — 12 for a Commander who charges, content's `vision`, Averno's — or its own attack's range when longer, rounded up to whole rows; measured as range is) and fights it as
every unit does. When nothing is in range it walks on, and at the target
it stands. Units fill the target first, each toward the nearest free tile of it; one that cannot get in stands
beside one that did, or beside its own building in the target, and claims no tile. **A side with no target heads for
the enemy's Grid Nexus** (the owner, 2026-10-20: "It's just going to be going to the enemy nexus"): its fighting units
turn on an enemy within the same vision on the way, a melee unit only on one it could walk to without a long detour (twice its vision), and
otherwise keep walking to the Nexus; a unit that cannot strike a Nexus, or a map with none, still engages the nearest
enemy wherever it is (`headsForNexus`, `src/pulse/perception.ts`, `tests/heading.test.ts`). Workers that flee,
healers and buildings never follow a target. `targets` is absent when no side has one, so such a state hashes as it
always did. The named scenario is `target-head-engage-stand`.

### 1.6 Routes — RULE — `src/routing/`, `src/pulse/routes.ts`, `tests/routing.test.ts`, `tests/route-scenarios.test.ts`

The owner, 2026-10-19, watching raiders stand behind rocks: units must get where they are going, round obstacles,
through crowds and narrow gaps, on a Grid that changes ([the milestone](../history/milestones/milestone-16-pathfinding.md)).
Routes are built from small parts, each tested alone (`src/routing/`): where a body of a given shape may stand, the
anchors from which it reaches a goal, a distance field from a goal outward, and the ranking of a unit's four steps.
How they fit together, in plain words, and where a new way of moving plugs in, is [`movement.md`](movement.md).

- **A unit walks its distance field downhill.** A field gives every anchor the walking cost to the nearest goal
  anchor, one a column and two a row, whole numbers; a unit takes the step that leaves the shortest walk, so it goes
  round rock and out of pockets by construction. A field is worked out only as far as it is asked, the same values
  whatever order it is asked in, and shared by every unit of the same shape heading for the same goal on the same
  ground. It is built from the state the tick began with and kept for that tick only.
- **A route ends where an attack begins.** A unit's goal is every anchor from which its attack reaches its target —
  touching it for a melee unit, within range for a shot or a heal, measured as range is — or from which it stands
  inside its side's target (`goalsNear`, `goalsInside`): the same tests the attacks step and the hold use, so the three
  never disagree. A unit with no attack heads for a tile beside its target.
- **What stands still is a wall; what walks is not.** Who walks this tick is decided from the targets perception
  chose (`purposeOf`): a unit whose attack does not reach its target yet, or heading for its side's target, or
  fleeing. Every other entity on a layer a body collides with — a building, a unit fighting, a unit at its side's
  target, a unit that cannot move — is a wall to that body's fields. So a crowd round one target spreads to the tiles
  still free round it, and a route goes round a fight rather than queuing behind it. A walker is no wall: it will
  have moved, and the tick order settles who steps where.
- **Equally good steps** go by how far each turns from the way the unit faces its goal, then by a seeded draw.
- **A goal that cannot be reached**: a unit heads for the anchors it can reach that are nearest the goal's tile,
  walking downhill to the nearest of them to walk to (one field toward them all, shared by every unit on the same
  patch of ground; a patch is the ground a body can walk between, `patchesOf`), and standing on one it has no route:
  it says so (`move.blocked`, reason `no-route`) and stands. A wide body before a gap too narrow for it stands as near
  as it can get. A field asked about an anchor on no goal's patch says unreachable at once, without searching.
- **Rock and buildings are not the same wall** (the owner, 2026-10-21; `TickRoutes.breachOf`, `route-breach`). When
  nothing a unit wants can be walked to, a second field toward its target is worked out with the enemy's buildings
  open, a step onto one weighing eight of open ground; walked downhill from the unit, the first enemy building in the
  way becomes its target, if it can strike a building. It breaks it and walks the gap. Rock, and what is not the
  enemy's, is never broken: a unit walled off by them walks as near as it can get, as above.
- **Targeting knows what can be reached.** Once routes are built, a unit that would walk to its target chooses again:
  a melee unit fights the enemy nearest to walk to — by the walk to a tile beside it, then the one it holds, the
  weakest, a draw — and, heading for its side's target, turns to what is within its vision by range and that it can
  walk to without a detour of more than twice its vision (a walk a little longer than vision is no reason to drop an
  enemy at the edge of it); any other unit keeps the nearest by range, shots reaching over rock, but passes over one it
  cannot get within range of for the nearest it can. When it can reach none of what it sees, and breaking a building
  would not open the way, a unit looks for the nearest enemy up to four times its sight away that it can walk to
  (`searchWider`, `SEARCH_SIGHTS`); with none it keeps its choice and stands as near as it can get, saying it has no
  route.
- **A unit holds its target** (`keptTarget`, `COMMIT_TICKS`, `tests/commitment.test.ts`; how it reads in
  [`movement.md`](movement.md), Targeting and attacking). A unit with an enemy target keeps it until it falls or stops
  being one the unit may choose, or until it has gone 30 ticks unable to strike it: the count starts again on every tick
  the target is in attack range and every tick the unit comes nearer to it than ever since it chose it, and otherwise adds
  one. While it holds, perception makes no choice for it (no `selectTarget`, no flanker's line, no crowd aim, no
  `chooseByRoute`); at 30 it chooses afresh without the one it let go of, which it takes again only when nothing else
  qualifies. A held target the unit can neither strike from where it stands nor walk to — walled in by the fight round
  it — is let go at once, not after 30 ticks (`walksToIt`), and the unit chooses afresh by what it can reach. The enemy
  Nexus as the march's goal beyond vision is not held; a healer holds its patient while it is
  wounded; a building that shoots takes only what its attack reaches. The count is `commitGap` and `commitStall` in the
  state, absent while nothing is held.
- **Crowds.** An ally in the way is waited for while it walks. A unit held up behind allies that are stuck — with no
  route, or in a ring of units each waiting on the next — walks round them by a field of its own that counts them as
  walls; one that only waits behind a walker that will step on soon waits, since walking round a queue and back would
  pace. Two allies of one tile each that want each other's tile swap, together.
- **The march** (the owner, 2026-10-21 and 2026-10-27; `src/pulse/march.ts`, `tests/march.test.ts`, how it reads in
  [`movement.md`](movement.md), the three states and troop formation). A unit is in one of three states
  (`MoveState`): it **marches** with no enemy to turn to (walking for its side's goal — its target, or the enemy's Grid
  Nexus while that is beyond its vision — stepping off its roof, holding at its target), is in **battle** when it walks
  to an enemy or fights one, and **retreats** when it runs. Every unit with an attack, other than a flyer and a unit on
  its own roof, has a place in one priority list (`formationRank`, `src/content/types.ts`): its type (flanker, melee,
  ranged), then its attack's range, shorter first, then its class (tank, fighter, support, siege). **The one rule: a
  marching unit walks at half speed — it accrues its movement credit on every second tick only — while a marching ally
  of strictly higher priority is within its vision** (`vision`, measured as range is). It slows and never stops,
  equals never slow each other, and a unit in battle neither slows nor is slowed. An ally of higher priority held up
  behind a slower one swaps tiles with it (`march.made-way`), the slower stepping back onto its tile, so an army
  sorts itself on the march and a one-wide corridor never jams. The Commander is a regular troop: she leads nothing. A
  marcher more than 6 columns off the line from its side's own Nexus to its goal breaks a tie between equally good steps
  toward the line. A flanker chooses first among the enemies within its reach that are not melee, the nearest it can
  walk to.
- **Slow ground** (`TerrainKind.stepWeight`): a step onto scrub costs twice its length, in credit and in a route, so
  a unit crosses it at half pace and a route goes round it when that is quicker. Credit is capped at the dearest step
  from where a unit stands, so it can save up for a step onto scrub ([`grid.md`](grid.md), terrain).
- **Burning ground is dear ground** (`TickRoutes.weightsOf`, `BURNING_WEIGHT`; `tests/area-damage.test.ts`). While
  anything burns, an anchor where a unit's or a worker's body covers a burning tile weighs four times its ground in
  that body's fields, so a walker goes round a patch when the way round is less than four times as long and walks
  through it when it is not. Only the route weighs it: a step onto burning ground costs the credit its ground does, so
  a unit that crosses fire crosses it at its own pace. The patches are those burning as the tick began; what the
  attacks light weighs from the next tick. A flyer flies over it.
- **Workers cross their own side's troops, and not the enemy's**; a trooper the same with workers ([`grid.md`](grid.md),
  collision masks). The enemy's are walls to their routes.
- **A unit that flees walks a flight map** (`TickRoutes.safetyOf`): the walk from every enemy that can strike, scaled
  by 1.2 and worked out again from every anchor at once, walked downhill. It runs from all threats, not only the
  nearest, and toward open ground rather than into a corner (the roguelikes' "safety map"; `worker-flight-between`).
- **A unit that did not walk** (`displace`, `src/pulse/shared.ts`): a push or a pull moves a unit a tile at a time
  in one direction, each tile only if its whole body fits there, and stops at the first that does not; a building
  never moves. Its credit is untouched, it says so (`entity.displaced`), and it walks on from where it landed. The
  bench bulwark's Shove is its test (`bench-bulwark-shove`); the first power that pushes uses the same rule.
- **The raid's forecast walks the same routes** (`src/match/intent.ts`): the way drawn on the Build Phase is the
  field walked downhill over the terrain and the buildings, ending beside what the raid goes for.

What a tick's routes cost is measured in `tests/routing.test.ts`: twelve fields worked out over the whole starter
map take a third of a frame at most, and a battle's stop far sooner. A whole tick's is profiled by
`scripts/profile-routes.ts` ([`movement.md`](movement.md), the general path).

## 2. Match structure

**A Grid Nexus is a flag on a content definition, never a content id the kernel recognises** (RULE —
`tests/ravel.test.ts`, `src/pulse/victory.ts`). An early victory condition keyed on the id
`structure.citizen.nexus` broke the moment the second faction existed. Anything a faction calls its
Grid Nexus declares itself one, and the rules read the flag.

A match alternates (RULE — `tests/pulse-run.test.ts`, `tests/mission.test.ts`):

- **Build Phase** — hidden, simultaneous, turn-based, untimed planning from the same public resolved
  state;
- **Battle Round** — simultaneous reveal, then a fixed number of deterministic ticks: the Pulse this
  document describes.

Each round opens with the **Nexus Pulse**, when the Grid Nexus deals its Commander a hand of Nexus powers,
one of which the player may keep during the Build Phase (a rule outside the kernel, section 2.4). One
Nexus Pulse, one Build Phase and one Battle Round, in that order, are a **round**, the unit the player
counts. A match runs **as many rounds as it needs** — a campaign mission is a sequence of rounds, not
one, and a mission's triggers decide how many and what happens between them (see
[`campaigns.md`](../game-design/campaigns.md)). A Battle Round may be scripted (no player plan; the player
watches) and it is still a Pulse: seeded, deterministic, replayed the same way.

**The kernel's victory condition never learns about a mission's goal.** A mission's objective is
resolved one level up, by the scenario and trigger layer, which fires an ordinary `win`/`lose` action
when its own condition holds (see [`campaigns.md`](../game-design/campaigns.md)). What follows — Grid
Nexus destroyed, a side with no Nexus standing annihilated, tick limit reached — is the fallback a
battle with no declared objective lands on: every Skirmish match, and every Challenge battle (RULE —
`src/pulse/victory.ts`).

Both players see the resolved Grid: terrain, deposits, neutral zones, known actors, health,
structures, public construction coverage. Newly committed construction and upgrade choices stay
hidden until reveal.

At Pulse start plans reveal together and valid construction becomes operational. Workers pick jobs,
producers attempt recipes, actors move and fight automatically. Playback controls cannot change the
result (RULE — `tests/pulse-run.test.ts`).

**At Pulse end every survivor stays on the Grid and regroups** (RULE — the owner, 2026-10-26: "double down the RTS
style, leaving troops on the map"; `src/match/regroup.ts`, `tests/regroup.test.ts`, `tests/kept-front.test.ts`). The
Nexus announces a pause and the troops respect it: nothing attacks or trains, and for 10 seconds (120 ticks, the
Build Phase's first 10 seconds on screen) they move. For 2 seconds those within 12 of an enemy step back toward their
own Grid Nexus; for 6 more each side forms up in ranks across its march line — from its Commander, or its own Nexus
while she is out, toward its level's target, else the enemy Nexus — in the formation's priority list, front to back:
flankers, melee, then ranged by range, tank to siege within a range, then what does not fight (the Commander takes the
place her attack gives her, in the middle of her rank); the last 2 seconds let the slowest arrive. Survivors more
than 24 columns behind the front form their own group where they stand; facing fronts are held at least 6 columns
apart. A side with neither a Commander nor a Nexus (a mission's raid) stands where it is. Units walk on the routes'
distance fields at their own pace, never through one another, rock or an enemy's building; the sides alternate who
moves and who claims a slot first, and ties go by what a side faces, so a mirrored end gives a mirrored regroup. It is
worked out from the round's last state and the content alone, never from the Build Phase, so a scripted battle plays
the same every time. The numbers are a starting point (the owner: "the idea is what matters right now"), named in
`src/match/types.ts`. Every mode plays by it; nothing is sent home.

**A building placed where units stand pushes them out** (RULE — the owner, 2026-10-26; `src/match/make-room.ts`,
`tests/kept-front.test.ts`), the player's or the enemy's alike; a flyer stays put. As a round opens, each planned
building in turn (a duel's two sides interleaved) sends the units under it, nearest its middle first, the shortest way
to the nearest free tile off every building; a unit standing there is pushed on as the pusher arrives, a ripple. The
Build Phase draws those walks for the player's own plan as it is placed. A carried building that the Build Phase
upgraded or switched opens the Pulse as its new content id (`refits`, [`content.md`](content.md)); its health and place
are its own. A carried unit opens the next Pulse where the regroup left it. A producer's waves start afresh (its first
wave its recipe's delay away, none come yet, nothing owed), and a producer carried into the next Pulse starts on the
recipe that Pulse runs (RULE — `src/match/regroup.ts`, `src/match/opening.ts`, `tests/match.test.ts`,
`tests/production.test.ts`). **Burning ground is put out between rounds** (RULE — `src/match/regroup.ts`,
`tests/area-damage.test.ts`): the next Pulse opens with nothing burning.

**The Grid Nexus mends between rounds** (RULE — the owner, 2026-10-21: "perhaps we add like a little bit of
self-healing"; `ContentDef.mends`, `src/match/regroup.ts`, `tests/match.test.ts`). Between rounds a structure whose
definition `mends` regains that much health, never past its full: the Citizen and the Ravel Grid Nexus 40 of their
400, so an early raid that hurt the Nexus is not a wound it carries all match. Nothing else mends between rounds; a
building or a unit stays as hurt as it was. How much a Nexus mends may differ by faction and be raised by a
Nexus power, later.

**Destroying the enemy Grid Nexus wins** (RULE — `src/pulse/victory.ts`,
`tests/scenario.test.ts`). Any attacker in a legal attack position may damage it. Defences and
terrain make practical outer layers; there is no hidden exposure meter.

**The Grid Nexus fights back** (RULE — the owner, 2026-10-21: "the Nexus have a single attack that deals enough
damage to kill a trooper"; `src/content/citizen.ts`, `src/content/ravel.ts`, `scenarios/rules/nexus-fights-back.map.json`,
`tests/nexus-fights-back.test.ts`). It is an ordinary ranged attack on its definition, so no rule knows a Nexus
shoots: 40 damage every three seconds, at a marksman's reach of 6, at units, workers and flyers, never at a
building. A trooper or a runner falls to one shot; a raider takes two. It matters most early, when a raid is a few
units and the Nexus alone can turn it, and less as armies grow. The Citizen and the Ravel Nexus are alike for now;
the factions' Nexuses may differ, and a Nexus power may raise either, later. The engine's own test maps that ask
about routes and endings stand the bench's passive Grid Nexus (`structure.bench.nexus`) instead, the Nexus as it
was before, so a lone trooper sent round a wall is not shot on arrival.

**A side whose Grid Nexus stands is never wiped out** (RULE — Mario, 2026-10-01; `src/pulse/victory.ts`,
`scenarios/rules/nexus-stands.map.json`, `tests/scenario.test.ts`). Its Pulse goes on until the Nexus falls or
the time runs out, and a mission may add a losing condition of its own; a side with no Nexus, a raid, is
still beaten by losing every unit. So a defence round no longer stops with the raid at the gate when the
player's units fall: the raid comes on to the Nexus, and the round ends when it falls or the time is up.
Before this, every side was wiped out by losing its last unit, and a defence round could end with the
Nexus untouched and count as held.

### 2.1 Commander

A persistent frontline unit, normally `@` — fictionally a Nexus Symbol — on the `units` layer. It may
take Nexus-specific upgrades and competes for investment with army, economy, research, and
fortification. **On death it is absent for the rest of that round's Pulse and for as many whole rounds after it as
its definition says (`roundsOut`, none when it says nothing), then the Prime Nexus replicates it again**
(RULE — `src/match/commander.ts`, `tests/commander.test.ts`): it falls in round R and is back as round
R + 1 + roundsOut opens. Vasse sits none out, so the Nexus restores her as the round after she falls opens
(the owner, 2026-10-14: "Base will just come back immediately after"); sitting rounds out is a disadvantage
a Commander may be given, proven on a test-only Commander who sits one round out, and one who sits two. **Commander death is not the victory condition** (RULE —
`src/pulse/victory.ts`, which reads only the Grid Nexus flag and annihilation).

What is built is that cadence, for the Commanders in `armies/` (Vasse, Averno and Dob Hunter, each in her own army). A unit is a
Commander by a flag on its content (`commander`), which only the rules between rounds read: the kernel
sees a unit like any other, so she fights and dies by the ordinary rules and nothing in a Pulse brings her
back. When she falls, the round loop carries an absence beside the state — whose, which, the round she fell
in and the round she is due — and as that round begins, after the regroup and before its Build Phase, the
Nexus sets her down on the free tile nearest her side's Grid Nexus: a new body, at full health, standing
there through the Build Phase like any survivor. "May replicate" is taken as "does", as the campaign's
third mission reads it ("the next restores her"); a side with no Grid Nexus standing has nowhere to
restore her to, so her absence goes on until it has one. At a Pulse's end she regroups with her army, in the
middle of her rank. A mission brings its Commander once (`src/mission/validate.ts`
refuses a second arrival, or two of her), and the Commander it brings for the player is its campaign's
(`src/armies/load.ts` refuses another). How much she can take is her army's data, settled at 80 for Vasse. Her skill, By the Book, is an ability the kernel
keeps (above); its strength is an Experiment while it is tuned (**By the Book**). Where she goes is her side's: where a level names
a target for the player's troops she heads there with them, fights what comes within reach and stands with them
(a side's target, above). Holding a post waits (posts, in the backlog).

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

**Production is fixed recipes run by buildings, never direct unit purchases** (RULE —
`src/pulse/production.ts`, `tests/production.test.ts`). No shop, no queue. A producer attempts a fixed
recipe on a recurring interval. When simultaneous attempts cannot all be paid or supplied, every
feasible attempt enters one seeded contention process: one is chosen, paid, and spawned; feasibility is
recomputed; repeat until nothing legal remains.

What is built is the smallest slice of that: **a building with a recipe spawns its unit in waves** (RULE —
`src/pulse/production.ts`, `tests/production.test.ts`). A wave is the units a building sets down at once:
every unit of it comes out on the same tick, one after another **on the building's own roof**, on the tiles nearest
where they head (section 1.3a), so it stands together on the side facing the fight (the owner, 2026-10-05:
"spawning units: should happen simultaneously at the beginning of the round, creating a more predictable squad
formation"). The recipe says
how many a wave, how many waves a Pulse, when the first comes and the gap to the next; the schedule never
slips. A building short of room never spawns fewer: what fits on its roof comes out on the wave's tick, and the
rest on the first tick there is room, as the first walk off. While any of its side's buildings owes units its army has
room for, a unit on its side's roofs steps down to the nearest ground first and then carries on, unless it is part way
through its windup (`src/pulse/make-way.ts`), so a roof that units stand on empties for the wave. A wave its side's
supply holds back waits for a place in the army, not for the roof, and moves nobody: sending everyone on the roofs down
for it jammed a crowded base round its own target (the curve level, measured 2026-10-21). A unit a building trains
remembers that building and the tile it came out on (`EntityState.home`, `homeAt`).

**Units walk out over the roofs** (RULE — `src/pulse/spawn.ts`, `src/pulse/shared.ts` `onRoof`, `tests/roofs.test.ts`;
the owner, 2026-10-20: "they will just keep walking on the rooftops on the natural direction where their destination
is, this will help keep the troop waves together when they spawn"). A building sets the units it makes down on its
roof: every anchor from which a unit's body covers some of the building, never two on one tile, those wholly on the
roof first, so a unit as wide as its building comes out on top of it too. **A unit is on the roofs while any tile of
it stands over one of its own side's buildings**, read from where it stands: while it is, its side's buildings are
ground it may walk (its collision mask and its route's ground both say so), so it walks the roofs by its ordinary
route toward where it is going and steps down on the side that faces it. Once all of it stands on ground they are
walls to it again, its own included, and it never climbs back. A unit on a roof fights and is hit as on the ground;
an enemy that cannot reach it passes it over (section 1.6, targeting knows what can be reached), and a blast hits it
by the tiles it covers. A building that falls with units on it leaves them standing where they were, now on
ground. A unit in the air, and one a unit makes, is set down round its maker as before. **How it leaves** is the
building's (`ProductionRecipe.exit`): along its route, Mario's idea and the default, or to the nearest open ground
first while the "Way off the roof" Experiment says nearest (`src/pulse/routes.ts`, `offTheRoofFirst`), which a
simulated game shows spills a block's wave off every side ([formations](../history/reports/2026-10-20-formations.md)). A recipe costs nothing yet, because a Pulse has no resource, so no two attempts
can compete and the contention process has nothing to decide; it is not built, and arrives with cost and
supply in the worker economy. A unit a building spawned says so on its `entity.spawned` event (`trainedBy`),
which is how the battle feed and the Activity Logs tell it from an arrival.

**What a building spawns is its own** (RULE — `src/armies/load.ts`, `src/match/training.ts`,
`tests/armies.test.ts`, `tests/production.test.ts`). Its card in its army carries `spawns`: the unit, how many
a wave, how many waves a round and the seconds between waves, each a whole number above zero. Every building a
campaign level offers spawns in that level's battles as its card says. When the first wave comes is the same
for every building, a tuned value (`firstWave`, five seconds in). The Barracks sends four troopers and the
Hatchery three swarmers, one wave a round each; a Nexus power that gives a building a second or third wave
raises its `waves` and nothing else. **No content spawns this way by default** (RULE — `withProduction`,
`src/content/index.ts`): a `grid` scenario's buildings, and a map that merely has a barracks on it, resolve
exactly as they always did. **A building makes its units one way in a battle**: one given a recipe loses any
spawner of its own, so a campaign's Hatchery breeds only its wave, while the bench Hatchery in its `grid`
scenario keeps its timer. A producer's counters (ticks to its next wave, waves come this Pulse, units still
owed) are on its state only while it has a recipe, so a state without one serializes byte for byte as before.

Players shape composition by building, protecting, upgrading, pausing, or losing producers.

### 2.4 Research, the tech tree, and Nexus powers

A Commander Army's buildable structures form a real, inspectable tech tree (see
[`commander-armies.md`](../game-design/commander-armies.md)), mostly shared across a faction's
Commanders with a few Commander-specific branches. It holds buildings and building upgrades, and the
answers to a threat, the hard counters, are its buildings: always reachable by building, never by a deal.
Research facilities are not an alternative to a "linear tech menu"; they are tree nodes like any other
structure, and completing one unlocks its dependents. Only the tree unlocks: a Nexus power adds, never
unlocks, and what it adds the tree does not hold. The tree is limited entirely by which structures exist,
never by a second resource (the one-resource rule in the economy below is untouched).

The Grid Nexus also offers a small draft of upgrades; research facilities modify that draft's tier,
breadth, redraws, weighting, or visibility. A structure has no levels: it has actions of its own — an upgrade kept by
that building alone, a mode, an order for one round ([`commander-armies.md`](../game-design/commander-armies.md), what
changes between rounds). Nexus powers are
content-defined legal actions or passive rules that execute through validated kernel commands.

**The Nexus Pulse** (RULE — `src/armies/deal.ts`, `src/cli/pulse-run.ts`, `tests/nexus-draft.test.ts`): the
Commander Army's own Nexus power pool — a subset of the faction's, built as what a level offers (`src/armies/`) —
dealt as a small hand as every round opens, before its Build Phase: three powers by a schedule of rarities, War
Chest (the owner's testing tool) beside them, of which the player keeps one, or for now none. Which rarity each card
is comes from the round's schedule (the game's `DEFAULT_SCHEDULE`, or a level's own, which may name a power to make
sure of); a card is drawn from the powers of its rarity whose requirements hold — a power kept, a building standing
for the player as the round opens, a round reached — preferring a role the hand does not hold yet, each as likely as
its chance this round, and an upgrade only once the power it upgrades is kept. The hand is gameplay randomness,
seeded by the mission's seed and the round on a PCG32 stream of its own (`STREAM_DRAFT`), never the kernel's: the same
round deals the same hand every time, and dealing never moves a battle's draws. A power kept lasts the rest of the mission and is
not dealt again unless it may be kept again. What it does reaches the battle through the round's own inputs, never a
rule the kernel reads: the content the Pulse runs on (a Commander's aura reach, a building's waves), the build
menu (a building added), and the units set down at its opening — a power's **called-up units** muster on the
player's Grid Nexus at tick 0, after the mission's own arrivals, and are survivors like any other once the round
ends. The whole of how the Nexus Pulse deals — rarities, roles, the schedule and a level's own, chance,
requirements, upgrades — is in [`commander-armies.md`](../game-design/commander-armies.md); the legendary hand every
few rounds and what a Commander may bend are designed there and not built.

What a power may *do*: to a player, a power is a name and a plain description of what it does — no
classification to learn — and in code the effect is one of a small bounded union: `addBuilding`,
`spawnUnits`, `addWaves`, `setDetonation`, `modifyAbility`, and, designed, `modifyRule` and `reveal` (see
[`commander-armies.md`](../game-design/commander-armies.md)). That union is what a Build Phase panel
actually renders, so it is worth reading before building one.

---

## 3. Economy

**A match uses one resource** (RULE). Deposits and salvage both yield it. Supply is a separate shared
population cap, not a second currency. Nexus energy is a state readout, not something a player
spends.

**Credits every round** (RULE — `src/cli/pulse-run.ts`, `src/armies/curve.ts`, `tests/mission-loop.test.ts`; the
owner, 2026-10-15). What a Build Phase did not spend carries over, and each round after the first adds the power
curve's credits for it — 120 in round 2, 140 in round 3, up to 430 from round 9 ([`commander-armies.md`](../game-design/commander-armies.md),
the expected power curve); a level gives round 1's. The same in every mode: until workers gather, this is how a
round's resources arrive, and the worker economy will earn on top of it or replace it.

**Supply** (RULE — `src/content/supply.ts`, `src/pulse/production.ts`, `tests/production.test.ts`; the owner,
2026-10-16: "go with your recommendation, supply cap", and "Supply should be controlled by another building"). An
army fields so many units at once: what its standing buildings give (`supplyProvided`: the Grid Nexus 12, a Supply
Depot 8 more). A unit takes its `supplyCost` places (1 when it says nothing; a pikeman 2; a Commander none). A
building whose next unit would take its side past its supply keeps the unit owed and waits, so once an army is full
a new unit comes only as an old one falls. Units a mission or a Nexus power sets down are never held back, and count
once they stand. A side whose buildings give none has no cap, so every scenario from before supply resolves as it
did. The Build Phase shows it on the credits line, `units 5/12`: the places the round starts with, of what the
buildings give, a planned Supply Depot counted, since it stands when the Battle Round begins.

**A building held this round sends no wave** (RULE — `src/match/opening.ts`, `tests/building-actions.test.ts`): a
building's action, Hold production ([`ui-patterns.md`](ui-patterns.md), a building's actions). Its Pulse opens it with
every wave already sent; the kernel is untouched, and the next round it trains again.

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

**Construction territory** (RULE — `src/build/territory.ts`, `tests/build-territory.test.ts`). The player may
build only inside their *build range* (the owner, 2026-10-04: "they also can only be built within the
build-range of the other buildings"). The Grid Nexus roots it, and every structure that projects one (a
content definition with a `constructionRadius`; today every building the player places) lets its player build
within that reach of it, measured as range is, to the nearest tile of its footprint, a row counting two
columns: a build range of 6 reaches 6 columns across and 3 rows up and down (`tests/rows-view.test.ts`). Two of
the player's structures are linked when their ranges meet, sharing a tile, so their footprints are at most the
two radii apart. Everything linked to the Nexus, step by step, is the network, and only a structure in the
network projects. One cut off from it keeps working (it trains, it shoots) and gives no build range; a
structure that projects nothing joins only where the network's range reaches it. **Only what stands projects**
(the owner, 2026-10-05: "building range should only count for buildings already placed from previous round ...
Expansing territory is only done at next round"): a building planned in this Build Phase gives no build range
until it stands, next round, so the range is the same all phase, and removing or undoing a planned building
never leaves another outside it. **A new building may be placed where at least one tile of its footprint is
inside the range** (the owner: "This is important for large buildings otherwise they have no space to build");
rock, another building and the map's edge are still refused tile by tile. A range passes over rock, which is
refused on its own. While the "Build range" Experiment is felt, its value (4, 6 or 8; 6 to begin with)
is every projecting structure's radius; outposts that reach farther wait for outposts (Q5). With no Grid Nexus
of the player's standing there is no network and nothing can be built. The Build Phase enforces this and the
kernel never reads it, since the Build Phase is the only way a player's plan is made.

**Buildings may touch** (RULE — `src/build/state.ts`, `tests/build-territory.test.ts`). A building that makes units
sets them on its own roof (section 2, units walk out over the roofs), so it keeps no room round it: two Barracks may
stand side by side, and a block of them is a choice of where an army forms. The room each once kept, and the
"Spawn space" Experiment with it, went with the pathfinding milestone.

Still open, because nothing reaches them yet: building inside enemy coverage that was public at Build Phase
start (no raid stands a building at the start of a Build Phase), simultaneous same-cell conflicts and refunds
for invalid revealed plans (two plans meeting), and path-sealing legality.

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
