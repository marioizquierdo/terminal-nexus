# Terminal Nexus — engine design

**Document role:** How the engine is meant to be shaped, and which parts of that are settled
**Status:** Canonical direction; implementation is gated by milestone documents
**Canon version:** 2.6
**Updated:** 2026-08-21
**License:** Apache-2.0

## 0. How to read this document

This is a **design document, not a rulebook.** Most of it is a recommendation written before the
thing existed. It is here so that a session facing a fork has something better than a coin flip —
not so that a session builds an interface nobody has needed yet.

Every section carries an authority marker. Respect it literally:

| Marker | Means | What you may do |
| --- | --- | --- |
| **RULE** | Committed. It is load-bearing, and something else already depends on it | Follow it. Changing it needs owner acceptance and a canon version bump |
| **GUIDANCE** | A recommendation, not yet earned by working code | Follow it by default. Depart when the work shows better — and record why in the gate report |

Most of this document is GUIDANCE. Where a section describes something that is not designed yet, it
says so in its own words; that is still GUIDANCE, and it still means *do not build this today*.

Two rules apply everywhere and outrank convenience:

1. **Descriptive completeness is not authorization.** A shape described here is not a shape you may
   build today. The milestone marked CURRENT decides what gets built.
2. **Direct code beats a framework.** Write the specific thing the current proof needs. Extract a
   general contract only after a *second* real use shows you where the seam actually is. Most of the
   interfaces below are sketches of seams we have not found yet.

If you find yourself building something in this document because it is in this document, stop.

---

## 1. The three worlds

**Authority: RULE.** This is the separation the whole engine exists to protect. Everything else is
detail.

Terminal Nexus keeps three things apart that most games blend together:

```text
┌─ STATE ────────────────────────────────────────────────────────────┐
│  What is true. The Grid, its layers, every entity's placement,      │
│  health, resources, and ownership. Plain serializable data.         │
│  Knows nothing about time passing, and nothing about drawing.       │
└────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─ PULSE ────────────────────────────────────────────────────────────┐
│  How state changes. A pure function stepping state forward in       │
│  fixed logical ticks. All randomness comes from one seeded stream.  │
│  Same inputs → same outputs, forever, on any machine.               │
│  Emits ordered events describing what happened and why.             │
│  Has no clock, no terminal, no frames, no colour.                   │
└────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─ PRESENTATION ─────────────────────────────────────────────────────┐
│  What it looks like. Consumes state and events, samples them at     │
│  an arbitrary wall-clock time, and composes cells. Interpolates,    │
│  animates, throws particles, shakes, recolours, and lies about      │
│  timing freely — because none of it can change an outcome.          │
│  Has its own separate cosmetic random stream.                       │
└────────────────────────────────────────────────────────────────────┘
```

The three laws that follow from this:

1. **Only the Pulse mutates state.** Nothing else writes to it. Not presentation, not input, not a
   scenario script, not a content hook.
2. **Presentation cannot influence the Pulse.** Frame rate, dropped frames, playback speed, pause,
   window size, colour depth, and reduced motion are all invisible to it. A Pulse resolved on a
   machine with no screen at all resolves identically.
3. **The two random streams never touch.** Gameplay randomness is seeded, serialized, and replayed.
   Cosmetic randomness is whatever it wants to be. A particle must never consume a draw from the
   gameplay stream, and the gameplay stream must never be asked for something a particle needs.

The practical test: **you must be able to resolve an entire match with the renderer deleted**, and
you must be able to rewrite the entire renderer without a single simulation test changing.

One corollary, because it is the seam most likely to erode quietly: **canonical state carries nothing
that only presentation reads.** Facing (Section 3.5) is the single deliberate exception, pending Q9 —
it is in state so that a renderer does not have to guess a direction and produce jitter. Do not add a
second one. Interpolation hints, animation state, and camera position are presentation's, and they
belong in the presentation model of Section 2, not in the state the Pulse hashes.

---

## 2. Responsibility layers

**Authority: GUIDANCE.** The boundaries are right; the exact module names will move as code arrives.

| Layer | Owns | Must not own |
| --- | --- | --- |
| Rules kernel | ticks, state transitions, randomness, occupancy, movement, targeting, damage, economy, legality, victory | terminal objects, wall clocks, network calls, glyphs, prose |
| Content definitions | units, attacks, structures, upgrades, Commanders, armies, factions, maps, semantic themes | mutable match authority, backend classes |
| Scenario runtime | starting state, objectives, triggers, mission progress, win/loss requests, unlocks | direct mutation bypassing the kernel |
| Player projection | visibility-filtered state, legal public actions, visible ordered events | hidden-plan leakage, invented facts |
| Presentation | semantic cues, animation state, portraits, cell frames or graphical scenes, accessibility | damage, targeting, legal placement, victory |
| Platform adapters | terminal, browser, native input, output, resize, streams, device lifecycle | interpreting ANSI or pixels as game state |
| Application shell | CLI, configuration, content selection, saves, replays, diagnostics, composition | secret rule changes |

Runtime flow:

```text
content + scenario + committed plans
                 ↓
       deterministic kernel  ── seeded gameplay RNG
                 ↓
 canonical state + ordered DomainEvent[]
                 ↓
 visibility projection → PlayerView + visible events
                 ↓
      presentation model  ── separate cosmetic RNG
                 ├─ terminal compositor → ReadonlyCellFrame → backend
                 ├─ browser or native graphical renderer
                 └─ accessibility or spectator renderer
```

Shared contracts stay leaves of the import graph. Nothing downstream of the kernel may be imported
by the kernel.

---

## 3. The Grid

**Authority: RULE** for the layer model and occupancy; **GUIDANCE** for sizes, metric, and movement.

The **Grid** is the rectangular integer playfield a match is fought on. It replaces the older word
"Grid" everywhere, including in the name of the Nexus replica that sits on it: a **Grid
Nexus** is the replica, a **Prime Nexus** is the one that stays home.

### 3.1 Size and shape — GUIDANCE, except the default preset, which is RULE

A Grid may be any integer size. Content and tools standardise on a small matrix of presets so that
maps, scenarios, and compositions can be reasoned about without measuring each one.

The **matrix below is GUIDANCE** — add, drop, or rename a preset when content shows a better set. The
**default preset `medium-extra-wide` (48 × 16) is RULE**, because the compositions in Sections 9.2
and 9.3 are derived from it: change 48 × 16 and the 80- and 128-column layouts stop falling out of
one number.

**Shape** is the ratio of width to height in tiles, treating a tile as square:

| Shape | Width : height |
| --- | --- |
| `squared` | 1 : 1 |
| `wide` | 2 : 1 |
| `extra-wide` | 3 : 1 |

**Size** sets the short side:

| Size | Short side, in tiles |
| --- | --- |
| `small` | 12 |
| `medium` | 16 |
| `large` | 20 |
| `extra-large` | 24 |

Which gives twelve presets:

| | `squared` | `wide` | `extra-wide` |
| --- | --- | --- | --- |
| `small` | 12 × 12 | 24 × 12 | 36 × 12 |
| `medium` | 16 × 16 | 32 × 16 | **48 × 16** |
| `large` | 20 × 20 | 40 × 20 | 60 × 20 |
| `extra-large` | 24 × 24 | 48 × 24 | 72 × 24 |

**`medium-extra-wide` (48 × 16) is the default preset** and the one every early fixture uses. The
arithmetic is not a coincidence: at one column per tile it needs 48 + 2 border + 30 sidebar =
**exactly 80 columns**, and at two columns per tile **exactly 128**. The two compositions in
Section 9.2 fall out of one number.

**The vertical chrome budget is 8 rows** — 2 border, 3 header, 3 footer (the footer carries the
position readout and edge-marker legend that Section 3.3 requires). So 16 + 8 = **24 rows**, and
80 × 24 is a literal floor rather than an approximate one. Pending Q12: an earlier draft implied a
4-row budget and a 20-row composition, which would have made "80 × 24 is the floor" false by the
spec's own arithmetic.

A preset is a convenience, not a constraint. A scenario may declare explicit dimensions.

### 3.2 Orientation is a rendering choice — RULE

A Grid has no orientation. **Portrait and landscape are presentation transforms**, chosen by the
renderer to fit the display, and they change nothing about the Grid, the Pulse, or any coordinate in
an event log. A tall narrow display may transpose a `wide` Grid and lose nothing.

Map authors never think about orientation. They design a Grid; the renderer decides how to show it.

### 3.3 Viewport, screen size, and scrolling — RULE

A Grid may be larger than the screen. The **viewport** is the window onto it, measured in **tiles**,
and it is clamped at both ends:

| | Tiles | Why |
| --- | --- | --- |
| **Minimum viewport** | 48 × 16 | The default preset. Below this the game is not playable, and the renderer shows a resize gate |
| **Maximum viewport** | 72 × 24 | The largest Grid preset. Nobody sees more of the Grid than this, however large their monitor |

The maximum exists for **fairness and for bounded arithmetic**. A player on a huge display must not
be able to see meaningfully more of the Grid than a player on a laptop, and every layout, cursor,
and scroll calculation gets a fixed upper bound to reason about. Terminal space beyond the maximum is
spent on centring and on a larger inspection panel — **never on more Grid**.

**Fitting, in order:**

1. Subtract chrome from the terminal: a border, a header, a footer, and a 30-column side panel.
2. Choose tile width — 2 columns per tile if the terminal can show the viewport that way, otherwise 1
   (Section 9.3).
3. `viewport = min(availableTiles, maximumViewport, gridSize)`.
4. Gate when `availableTiles < min(minimumViewport, gridSize)` at one column per tile — **a Grid
   smaller than the minimum viewport needs only its own size**, so a small tutorial Grid is never
   gated on a terminal that can show all of it. Below that, show the resize gate and freeze
   presentation time.

Which gives these terminal sizes:

| | Tile width 1 | Tile width 2 |
| --- | --- | --- |
| Minimum viewport (48 × 16) | **80 × 24** | 128 × 24 |
| Maximum viewport (72 × 24) | 104 × 32 | 176 × 32 |

Both rows use the same 8-row vertical chrome budget from Section 3.1 (Q12). An earlier draft printed
28 for the maximum, which assumed a 4-row budget the minimum row did not — the two rows disagreed
with each other, whichever floor was intended.

**80 × 24 remains the floor and the acceptance target.** Everything must work there.

**Scrolling — RULE.** When the Grid is larger than the viewport, the camera scrolls. There is **no
minimap.**

- The camera position is in tiles and is clamped so the viewport never leaves the Grid.
- **The cursor drives it.** Move the cursor within a **scroll margin of 3 tiles** of a viewport edge
  and the camera follows. That is the whole interaction — no separate pan mode, no modifier keys, no
  second cursor. It works identically in the Build Phase and during a Pulse.
- **The UI must show that there is more Grid.** Without a minimap the burden falls on two cheap
  signals, and both are required: **edge markers on the frame border** for each side with more Grid
  beyond it, and a **position readout** in the footer naming the visible tile range and the Grid size.
- Small Grids that fit entirely inside the viewport never scroll and show no edge markers. Tutorials
  and opening missions should use them deliberately: `small` and `medium` presets fit the minimum
  viewport, so a new player meets the game without ever learning to scroll.

Cropping the Grid to fit without scrolling is not allowed. Below the minimum the renderer gates; it
never silently hides part of the Grid.

### 3.4 Layers — RULE

The Grid is not one plane of tiles. It is five, stacked:

| # | Layer | Holds |
| --- | --- | --- |
| 1 | `terrain` | ground type, movement cost, buildability, resource deposits |
| 2 | `obstacles` | structures, walls, rubble, destructible and immutable blockers |
| 3 | `workers` | workers and other non-combat labour |
| 4 | `units` | ground combat units, the Commander |
| 5 | `air` | air units |

**What a layer is for — and this is the only hard rule: layers define render order.** Lower numbers
draw first, higher numbers draw over them (Section 9.4). Beyond that, layers are how the game
*organises its assets* — a way to say what kind of thing something is.

**Layers do not define collision.** That is a separate question, and it is a query.

### 3.4.1 Collision masks — RULE

Occupancy and blocking are computed by composing layers into a **collision mask** — a per-tile
boolean grid built from a chosen set of layers and a predicate:

```ts
type CollisionMask = { blocked(tile: Coord): boolean }

function maskFrom(
  grid: Grid,
  layers: readonly GridLayer[],
  predicate?: (entity: Entity) => boolean,
): CollisionMask
```

Different questions compose different masks, and that is the point:

| Question | Mask |
| --- | --- |
| Where may a ground unit step? | `terrain` (impassable) + `obstacles` + `units` |
| Where may a worker step? | `terrain` (impassable) + `obstacles` + `workers` |
| Where may an air unit fly? | `air` only |
| Where may a structure be placed? | `terrain` (unbuildable) + `obstacles` + `workers` + `units` |
| What can this unit see or shoot? | every layer holding a hostile entity |

So a worker and a soldier may share a tile, because neither one's movement mask includes the other's
layer — not because of a rule about layers, but because of how their masks are composed. And a unit
still collides with a building on a different layer, because its mask includes `obstacles`. Both
follow from the same mechanism.

**Make masks cheap and make them explicit.** A unit definition declares which layers it collides with.
Nothing may compute occupancy by scanning entity lists in an inner loop, and nothing may assume a
layer's collision behaviour from its position in the render order.

*How* masks are cached was deliberately left to the spike, because arbitration (Section 4.3, step 5)
mutates claimed tiles part-way through a tick and a naive once-per-tick cache is stale exactly when
it matters. **Gate 1A answered it by never materialising one**, and that answer is now the rule:

- one occupancy index holds, per entity layer, one integer per tile, built when a tick begins and
  mutated in place when a move settles;
- a `CollisionMask` is a **lazy view** over that index — a layer list, a terrain rule, an ignore set.
  Constructing one is `O(1)` and allocates no grid, so composing a fresh mask per query is cheap
  enough that nothing is tempted to keep one;
- arbitration writes granted claims into an **overlay** on the same index, so a query made later in
  the same phase sees tiles claimed earlier in it.

There is no window in which a mask can answer from stale data, because there is no copy to go stale.
The cost is one indexed lookup per layer per query, which did not appear in any Milestone 1
measurement.

### 3.5 Placement, footprint, anchor, and facing — RULE

**Coordinates.** `(0,0)` is the Grid's north-west tile; `x` grows **east**, `y` grows **south**. The
direction `n` points toward `y - 1`. A scenario file's terrain and placement rows are listed north to
south, so the file reads the way the Grid draws. Every session — kernel, loader, compositor — uses
this one convention; it is the cheapest possible source of mirror-image bugs.

Every entity on the Grid has a placement:

```ts
type Coord = Readonly<{ x: number; y: number }>
type Footprint = readonly Coord[]          // offsets relative to the anchor
type Direction = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw"

interface Placement {
  readonly layer: GridLayer
  readonly anchor: Coord                   // the entity's coordinate
  readonly footprint: Footprint            // [{x:0,y:0}] for a one-tile actor
  readonly facing: Direction
}
```

- **Entities occupy one tile or many, and both are normal.** Many units are one tile. Structures
  usually are not — a Grid Nexus or a barracks covers several. **Large units exist and matter
  strategically**: a Ravel raider drawn `>x<` is one unit spanning three tiles, and the collision
  system has to handle it as such. Multi-tile is a first-class case, never a later extension. Write
  the footprint loop once, at the start, and every entity is the same code path.
- **A multi-tile mover tests its whole footprint.** A step is legal only if every destination tile is
  clear in that entity's collision mask. Damage, targeting, and destruction apply to the entity, not
  to a tile — a three-tile raider hit anywhere is one raider taking one hit.
- **The anchor is the entity's coordinate** and its centre of authority. Events report it, targeting
  ties break on it, presentation hangs badges and portraits off it, and it is what "where is that
  thing" means.
- **Range is measured to the nearest occupied tile** of the target's footprint, not to its anchor.
  A large structure is easier to reach because it is large, which is the intuitive answer.
- **Facing is presentation-only for now** (Q9). It is derived from the last movement step, or from
  the current target when stationary. Nothing in the rules reads it yet. It exists in state because
  a renderer that has to guess facing produces jitter, and because arcs may want it later.

### 3.6 Distance and movement — GUIDANCE

Eight-way movement, uniform cost per step, **Chebyshev distance** (`max(|dx|, |dy|)`) for range and
routing. This is the standard grid-game answer, it keeps range rings compact and readable, and it
avoids fractional diagonal costs fighting the integer movement credit in Section 4.2.

The known artifact: a diagonal step covers more ground than an orthogonal one, so diagonal travel is
about 1.41× faster in real terms. That is an accepted simplification, and it is listed here rather
than hidden so a later milestone can revisit it deliberately.

Terrain may modify movement cost. Immutable terrain cannot be attacked; only blockers explicitly
marked destructible enter targeting and damage.

There is **no fractional authoritative position**. Between-tile positions are something the renderer
invents for smoothness and the kernel never hears about.

---

## 4. The Pulse

**Authority: RULE** for determinism and the separation of time; **GUIDANCE** for the exact tick order
and credit rules until Milestone 1 tests them.

### 4.1 Logical time — RULE, earned by Milestone 1

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

Rates are rational, never floating point. Presentation targets **30 frames per second**, which is
2.5 frames per tick — deliberately not an integer, because effects sample absolute time and must not
quietly start depending on a frame:tick alignment.

**The kernel has no real-time loop.** It may resolve 12 ticks in a microsecond or over an hour. The
renderer maps logical time onto wall-clock time by itself.

**Confirmed by Milestone 1 (canon 2.6).** Gate 1A reproduced the cadence table above exactly at all
eight rates, and `tests/rules.test.ts` asserts it on every run, so 12 ticks per second is now RULE
rather than a hypothesis. The hypothesis this section was written to test — that a fixture six rows
long makes the rate cheap to change — was never exercised, because nothing asked for a different
rate. It stops being cheap at Milestone 4; that warning stands.

**What changing the rate would cost, stated honestly.** Content durations are authored in raw ticks
(`cooldownTicks`, `intervalTicks`, and every cooldown in a fixture), so the number 12 is baked into
every one of them. If evidence moves the tick rate, that is a migration of every duration in every
definition and scenario — not a constant to edit. The alternative, authoring durations as rational
seconds, buys rate-independence at the cost of arithmetic at every use site; it was considered and
rejected as the worse trade while the rate is still cheap to change. Milestone 1 is deliberately the
place this hypothesis gets tested, because the fixture is six rows long and the migration is an
afternoon. It will not be an afternoon in Milestone 4.

### 4.2 Movement credit — RULE, earned by Milestone 1

An integer accumulator, no floating point:

- each tick, `credit += rate.numerator`
- a step costs `rate.denominator × 12`
- when `credit >= cost`, the actor attempts one step and `credit -= cost`

Check it against the table: `1/1` accrues 1 per tick against a cost of 12 — one step every 12 ticks.
`3/2` accrues 3 against a cost of 24 — every 8 ticks. It reproduces the table exactly.

Two rules that a previous draft left open, and **that Gate 1A confirmed**:

- **Credit is capped at one step's cost.** An actor that could not move cannot bank a sprint.
- **A blocked step keeps its credit.** An actor jostled out of a claim steps the moment the tile
  frees, rather than restarting its timer. This stops traffic jams from silently halving an army's
  speed.

Both are asserted in `tests/rules.test.ts`: the cadence holds across a second step, credit never
exceeds one step's cost over five hundred ticks, and in the jammed-corridor fixture a mover blocked
on one tick steps on the next — which is only possible if a refused step spends nothing.

### 4.3 Tick order — RULE, earned by Milestone 1

Every phase reads the state **settled at the end of the previous phase**, so that iteration order
over entities can never decide an outcome:

1. **Tick open.** Advance the tick counter. Nothing else.
2. **Economy and production.** Scheduled resource yield; producers attempt recipes.
3. **Perception.** Each actor scores and selects a target. Deterministic scoring, ties broken by
   entity id.
4. **Intents.** Each actor with movement credit declares one destination tile.
5. **Arbitration.** Group intents by destination *within a layer*. Contested claims resolve by speed
   tier — **tier 1 outranks tier 2** — with any remaining tie broken by one draw from the seeded
   stream. Entity id orders iteration and event emission, never outcomes. Losers hold or recalculate,
   under a bounded number of passes with a strictly decreasing progress measure.
6. **Settle.** Apply winning moves. Occupancy is now fixed for this tick.
7. **Attacks.** By speed tier, **tier 1 first**. Within one tier, every valid attack is computed
   against the state at tier start and applied **simultaneously**, so no entity survives merely by
   being iterated first.
8. **Resolution.** Apply damage, deaths, destruction, salvage. Emit ordered events.
9. **Objectives and victory.**

**Speed tier is one number meaning initiative**, used identically in both places: a lower number acts
earlier, for movement claims in step 5 and for attacks in step 7. It is not a movement rate — that is
`movementRate` (Section 4.2) — and the two are deliberately independent, so a slow, heavy unit may
still strike first.

Melee is an attempt to enter an enemy-occupied tile on the same layer. When the defender dies in
step 8, the winning claimant may occupy the tile on the following tick.

**A mover's origin tile does not free within the same tick** (Gate 1A). Every phase reads the state
settled at the end of the previous phase, so a follower steps one tick behind the actor in front of
it rather than in lockstep. This keeps "no two entities ever overlap" true by construction and keeps
arbitration's progress measure simple.

**Death can be contagious, and step 8 is a queue rather than a pass.** Where content detonates on
death — Ravel volatile munitions are the first such rule, and they live on the Playground bench, not
in canon — the blast damages everything inside its radius, friend and foe, and anything reduced to
zero joins the queue. **The chain is bounded because an entity can only die once**, so the queue
drains after at most one round per entity and the whole cascade settles inside the tick that started
it. Order is entity order throughout.

Ranged attacks resolve at an authoritative tick. **A projectile is normally a presentation cue drawn
between the attack event and the impact event** — it is not a simulated moving body, and it cannot
be intercepted, unless some specific mechanic later earns that complexity, which nothing has.

**Damage from a ranged attack is authoritative at the tick it resolves** — steps 7 and 8 of that same
tick, always. The attack event additionally carries a **flight window**, measured in ticks and
derived deterministically from the distance to the target as
`max(1, ceil(distance / projectileTilesPerTick))`, where the tiles-per-tick figure is a property of
the attack (Gate 1A). It is part of the event and its hash, and
it is read by **no rule**: it exists so that presentation knows how long the shot should appear to
take. A renderer drawing a tracer holds the impact, the damage flash, and the visible health change
until the end of that window, so what the player sees lands when the tracer does; a renderer that
draws no tracer (reduced motion, monochrome) still presents damage at the impact beat.

### 4.4 Determinism and replay — RULE

```text
resolvePulse(
  schemaVersion, engineVersion, contentLock,
  ticksPerSecond, initialState, committedPlans,
  pulseTickCount, gameplaySeed
) -> { finalState, orderedEvents }
```

**The named PRNG is PCG32** — the `pcg_setseq_64_xsh_rr_32` variant, 64-bit LCG state with a 32-bit
XSH-RR output (Gate 1A). It was chosen because its state is two 64-bit words, so it serialises into
hashed state and restores from it exactly, and because it ships **published** test vectors rather
than vectors a session generated for itself: `tests/rng.test.ts` checks it against the expected
output of the `imneme/pcg-c` repository's own check program, seeded 42/54. Streams are separated by
the `initseq` parameter, which is what PCG provides it for.

The kernel:

- uses one named PRNG with serialized state and published test vectors;
- never calls `Math.random`, reads a clock, or depends on locale-sensitive ordering;
- makes entity order and every tie-break explicit;
- hashes state and events through one canonical serialization;
- treats the tick rate as replay metadata that cannot change inside a ruleset version.

Verification re-runs the inputs and compares hashes. Palette, glyph pack, resize, dropped frames,
playback speed, and the cosmetic seed sit outside that boundary entirely.

A game log records schema, engine, and ruleset versions; content ids and hashes; map id and hash;
tick rate; PRNG name and seed; armies; initial state; committed plans per Build Phase; ordered events
per Pulse; final hashes; outcome; and any presentation markers, explicitly excluded from
verification.

---

## 5. Match structure

**Authority: RULE** for the loop and the victory condition; **GUIDANCE** for everything inside it.

**A Grid Nexus is a flag on a content definition, never a content id the kernel recognises**
(canon 2.6). Gate 1A keyed its victory condition on the id `structure.citizen.nexus`, and the second
faction broke it within an hour of existing. Anything a faction calls its Grid Nexus declares itself
one, and the rules read the flag.

A match alternates:

- **Build Phase** — hidden, simultaneous, turn-based, untimed planning from the same public resolved
  state;
- **Nexus Pulse** — simultaneous reveal, then a fixed number of deterministic ticks.

Both players see the resolved Grid: terrain, deposits, neutral zones, known actors, health,
structures, public construction coverage. Newly committed construction and upgrade choices stay
hidden until reveal.

At Pulse start plans reveal together and valid construction becomes operational. Workers pick jobs,
producers attempt recipes, actors move and fight automatically. Playback controls cannot change the
result.

At Pulse end survivors regroup near home producers. Orphans are adopted by the nearest compatible
producer or regroup near the Grid Nexus. Production cooldowns reset to a full interval.

**Destroying the enemy Grid Nexus wins.** Any attacker in a legal attack position may damage it.
Defences and terrain make practical outer layers; there is no hidden exposure meter.

### 5.1 Commander — GUIDANCE

A persistent frontline unit, normally `@`, on the `units` layer. It may take Nexus-specific upgrades
and competes for investment with army, economy, research, and fortification. On death it is absent
for the rest of that Pulse and one full Build Phase and Pulse, after which the Prime Nexus may
replicate it again. **Commander death is not the victory condition.**

### 5.2 Structures — GUIDANCE

Common roles: Grid Nexus (victory target, construction root, upgrade draft, Commander anchor);
economic structures with worker slots; warehouses for global storage; supply structures for the
shared population cap; worker producers; military producers; defences; research facilities that
improve the Nexus draft rather than exposing a linear tech menu; outposts that project construction
coverage; capture structures that claim a neutral-zone bonus while connected.

Structures live on the `obstacles` layer, are operational immediately after reveal, cannot move or
be sold, and keep working while disconnected but stop projecting coverage.

### 5.3 Automatic production — GUIDANCE

No shop, no queue. A producer attempts a fixed recipe on a recurring interval. When simultaneous
attempts cannot all be paid or supplied, every feasible attempt enters one seeded contention process:
one is chosen, paid, and spawned; feasibility is recomputed; repeat until nothing legal remains.

Players shape composition by building, protecting, upgrading, pausing, or losing producers.

### 5.4 Research and Nexus powers — GUIDANCE

The Grid Nexus offers a small draft of upgrades; research facilities modify that draft's tier,
breadth, redraws, weighting, or visibility. Structures may reach levels 1–3. Nexus powers are
content-defined legal actions or passive rules that execute through validated kernel commands.

None of this is designed. It is recorded so the shape of the draft is not accidentally foreclosed.

---

## 6. Economy — GUIDANCE

**A match uses one resource.** Deposits and salvage both yield it. Supply is a separate shared
population cap, not a second currency. Nexus energy is a state readout, not something a player spends.

`ResourceCost` stays a keyed record in Section 8 so a later microgame can earn a second resource
without a schema change — but nothing through Milestone 4 may assume one exists.

**Workers** pick the closest available job by deterministic path distance: building slots, deposits,
salvage, and later faction-specific labour. They produce in place rather than carrying bundles home,
they do not attack, they consume normal supply, and they are produced by a dedicated automatic
building. What a full store does to a working labourer is Q7 — the recommendation is that it stalls
in place.

**Deposits** are finite and permanently deplete. A worker harvests from the deposit tile or one of
its four orthogonal neighbours, so five may work one deposit. A depleted tile becomes ordinary
buildable terrain.

**Destruction** returns half a structure's value to its owner automatically and drops the other half
as salvage on the Grid. Workers from either side drain salvage. Building over remaining salvage
destroys it.

**Construction territory:** the Grid Nexus roots a connected network; structures project a
construction radius (default two tiles, outposts farther — Q5); a disconnected structure keeps
operating but stops projecting; a player cannot build inside enemy coverage that was public at Build
Phase start.

Milestone 3 must lock the radius metric, footprint-to-radius measurement, same-plan chaining,
simultaneous same-cell conflicts, path-sealing legality, and refunds for invalid revealed plans. No
other system may guess those answers.

---

## 7. Events

**Authority: RULE.** Events are how presentation learns anything.

The Pulse emits an ordered list of `DomainEvent`s describing **meaning**, not appearance: an actor
moved from here to there, this attacked that with this result, this took damage, this died, this was
built, this was destroyed, this was produced, this objective changed. Events carry enough context —
the score or reason behind a target choice, the claim that was contested, the amount and kind of
damage — that a renderer never has to read mutable state to explain what it is drawing.

**Renderers never reverse-engineer glyphs, cells, or ANSI back into mechanics.** If presentation
needs to know something, the event carries it or the projection exposes it.

`PlayerView` contains only visible, legal information for one player and never exposes an unrevealed
plan.

---

## 8. Content interfaces — GUIDANCE

These are sketches. Names and shapes will change the first time real content touches them, and that
is expected. **Do not build these interfaces before content needs them.**

```ts
type ContentId = string
type EntityId = string
type Tick = number
type Rational = Readonly<{ numerator: number; denominator: number }>
type ResourceCost = Readonly<Record<ContentId, number>>

interface UnitDefinition {
  readonly id: ContentId
  readonly layer: "workers" | "units" | "air"
  readonly roleTags: readonly string[]
  readonly footprint: Footprint
  readonly maxHealth: number
  readonly supply: number
  readonly movementRate: Rational
  readonly speedTier: number
  readonly attack?: ContentId
  readonly capabilities: readonly ContentId[]
  readonly presentation: ContentId
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
}

interface ProductionRecipe {
  readonly output: ContentId
  readonly quantity: number
  readonly cost: ResourceCost
  readonly intervalTicks: number
  readonly spawnRule: ContentId
}
```

Upgrades, Nexus powers, Commanders, and Commander Armies follow the same pattern and are described in
[`commander-armies.md`](commander-armies.md). A **Commander Army** is the playable content boundary:
the complete set of choices legally available to one player in one match.

Prefer composable capabilities — health, movement, attack, production, storage, supply, worker slots,
radius, restoration, regroup anchor — over inheritance. Exceptional behaviour may register narrow
hooks that receive read-only context and return intents for the kernel to validate. A hook API
protects engine integrity; it is **not** a security sandbox, and installed TypeScript is arbitrary
local code.

---

## 9. Presentation

**Authority: RULE** for the cell boundary, bands, and the accessibility rules; **GUIDANCE** for
composition details.

### 9.1 The cell frame — RULE

```ts
type CellStyle = Readonly<{
  fgRole?: string          // a role, never a colour
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

No backend object ever appears inside a frame. Style carries **roles** —
`fgRole: "faction.citizen"`, never `"#ff8800"` — and the capability mode resolves roles to colour,
which is what makes monochrome a setting rather than a rewrite.

This is the terminal boundary and an excellent snapshot surface. It is **not** the universal renderer
API; a future graphical renderer consumes events and `PlayerView`, not cells.

**Capability modes are four, and they buy fidelity rather than facts** (Milestone 1): monochrome,
16-colour, 256-colour, and truecolor, resolving one role table. Every tier puts identical glyphs on
screen — a test asserts it — so nothing a player needs is available only to a colour terminal.
Monochrome is the floor, not the degraded mode.

**A glyph pack is optional, and it changes the field and the frame, never the actors.** Units stay
letters in every pack, because letter case carries ownership and the glyph family carries faction;
prettier symbols do not improve that, and they would break the one system that survives monochrome.
ASCII is the baseline and the acceptance target, and a pack may only draw from a curated
single-width set.

**One band write carries no glyph at all.** A style-only write keeps the glyph beneath it and applies
its attributes — the mechanism `fx.damage.flash` needs, and the only way an effect may touch a cell
an entity is standing on.

### 9.2 Composition depends on the phase — GUIDANCE

The two phases need different amounts of screen, and pretending otherwise wastes the Grid:

**Both phases share the same frame**: a Grid pane, a 30-column side panel, a header, and a footer.
Both support the cursor, selection, inspection, and scrolling — a player watching a Pulse can hover a
unit to read its state in real time, and can scroll the Grid, exactly as they can while building.
Keeping one composition means one cursor, one scroll rule, and one set of muscle memory.

What differs is what the side panel holds:

| | Side panel carries |
| --- | --- |
| **Build Phase** | Construct menu, selected item's cost and effect, the placement-legality panel that says *why*, radius preview, legend |
| **Nexus Pulse** | Pulse number, both Nexus states, force totals, playback controls, and — when something is selected — that entity's live state |

**The Pulse view shows everything by default.** Selection is an addition the player reaches for, never
a prerequisite for following the fight. If a Pulse can only be understood by clicking things, the
presentation has failed and no panel will rescue it.

### 9.3 Tile width — RULE

One Grid tile occupies **one terminal column** at 80 columns and **two** at 128 or wider. Same tiles,
same actors, same revealed information; only the composition changes. **80 × 24 is the acceptance
target** — anything authored for the wide composition must degrade to the narrow one.

One honest consequence: at one column per tile the Grid is squashed 2:1 horizontally, because a
terminal cell is about twice as tall as it is wide. A radius that is square in tiles looks like a
wide rectangle. Range previews and area effects must be authored in tiles and must be checked at
both widths.

Effects are authored against **tile coordinates**, never column counts, so one effect written once
works at both widths.

### 9.4 Bands — RULE

Fixed bands, not free z-indexes. The layers of Section 3.4 map onto them directly, which is the point:

| Band | Fed by |
| --- | --- |
| 1 `terrain` | `terrain` layer |
| 2 `territory` | construction coverage |
| 3 `ground-items` | salvage, rubble, deposits |
| 4 `structures` | `obstacles` layer |
| 5 `units` | `workers` and `units` layers |
| 6 `air` | `air` layer |
| 7 `projectiles` | presentation only |
| 8 `effects` | presentation only |
| 9 `highlights` | selection, cursor, preview, range |
| 10 `chrome` | frame, sidebar, status strip |

Each band returns sparse cells; the topmost defined cell replaces the lower complete cell style.
Grid bands clip to the Grid. **Presentation overlap never changes occupancy.**

**The corruption law — RULE.** Effects that deliberately degrade the display — Glitch identity, Nexus
authority, Commander restoration, catastrophic destruction — live in `effects` or above, never in
`units` or `structures`. They may add, overdraw, and unsettle. They may never remove or replace the
only cell carrying a required semantic cue. The screen may look wrong; the player must still be able
to see what is attacking them.

**The compositor enforces it; recipes are not asked to remember** (Milestone 1B). An effect cell that
would replace an entity's own glyph is dropped on that tile, and the only write allowed onto an
occupied cell is a glyphless attribute change. The first frame ever composed with effects on put a
clash mark on the defender's own cell — removing the only thing saying the defender was there — and
a test written for Gate 1A caught it immediately. A structural guarantee is worth more here than
eleven recipes each remembering a rule.

### 9.5 Effects and particles

Effects subscribe to semantic cues and cannot apply damage, move actors, spend resources, or decide
victory. They sample **absolute presentation time**, so the frame at time *t* is identical whether
every earlier frame rendered or most were skipped. Cosmetic randomness never touches the gameplay
stream.

The particle system, its contract, its starter vocabulary, and the craft rules that make ASCII motion
read as weight are specified in **[`ascii-effects.md`](ascii-effects.md)**.

### 9.6 Accessibility and input — RULE

- Keyboard-complete; mouse is optional direct manipulation.
- Every gameplay glyph occupies exactly one cell. No emoji, combining mark, or ambiguous-width glyph
  is ever required.
- ASCII-safe is the baseline; Unicode packs map the same semantic roles separately.
- Monochrome, 16-colour, 256-colour, and truecolor are explicit modes.
- **Colour never carries ownership, target, danger, or health alone.**
- Reduced motion keeps anticipation, impact, and settled state; it removes decorative movement only.
- Structured snapshots include glyph, foreground and background roles, and attributes.
- Below minimum size, playback pauses behind a resize gate and resumes from the same presentation
  time. Early milestones do not scroll or crop.

The simulation knows semantic ids such as `unit.worker` and `structure.nexus`. **It never knows a
glyph.**

---

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
screen after normal exit, `q`, `SIGINT`, `SIGTERM`, setup failure, and caught render failure. It
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

---

## 11. Tools and modding — GUIDANCE

First-party development uses explicit definitions and fast tools: maps as inspectable ASCII arrays
plus metadata; armies, units, structures, upgrades, themes, and glyphs as validated TypeScript;
effects as typed functions; cutscenes as tableaux and timelines; missions as map, army, objective,
trigger, and scene definitions.

The **Pulse Playground** — a scenario file plus a CLI that defines a Grid, places entities, takes a
seed and a tick count, runs or steps a Pulse, and reports what happened — is worth building **first**,
not eventually. It is the fastest feedback loop the project will have, for humans and agents alike,
and it is permanent infrastructure rather than spike residue: every future unit gets tested on it.

Two outputs, and the split matters. A **levelled log on stderr** (default `INFO`) carries the story of
the run in fixed, greppable columns, so an agent can assert on behaviour without parsing prose and a
designer can read what happened. A **summary on stdout** carries the outcome, the losses, and the
hashes. `playground run x.ts > report.txt 2> run.log` separates them; by default they interleave in
the terminal, which is what a person wants. See
[`milestone-1-spike-battle.md`](milestone-1-spike-battle.md) Section 3.3.

This is **modding-first architecture, not mod-loader-first development.** No public SDK, remote
loader, marketplace, permission system, or compatibility promise belongs in early milestones. Themes
may recommend fonts, but a terminal application cannot reliably change the host font, so every pack
keeps an ASCII-safe fallback.
