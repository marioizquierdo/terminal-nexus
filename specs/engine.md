# Terminal Nexus — engine design

**Document role:** How the engine is meant to be shaped, and which parts of that are settled
**Status:** Canonical direction; implementation is gated by milestone documents
**Canon version:** 2.28
**Updated:** 2026-09-30
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
| Platform adapters | terminal, browser, native input, output, resize, streams, device lifecycle; the keyboard, mouse, and driver input adapters that turn events into shell commands (Section 9.7) | interpreting ANSI or pixels as game state; giving one adapter a command another cannot issue |
| Application shell | CLI, configuration, content selection, saves, replays, diagnostics, composition, the command vocabulary every input adapter feeds | secret rule changes |

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

**The vertical chrome budget is 6 rows since the owner's menu spike (canon 2.27, 2026-09-30)** — 2
border, a 2-row header (the top bar's own line, and the rule that closes the Grid's top) and a 2-row
footer (the rule that closes the Grid's bottom, then one line of contextual help, Section 9.2). The
owner: "The bottom of the UI currently uses 3 rows. We have to reduce that to 1 row." **The floor did
not move**: the resize gate still measures against the old 8-row budget (Q12) — 16 + 8 = **24 rows** —
so 80 × 24 stays a literal floor, and the two rows the one-line footer saves go to the Grid: 18 rows of
Grid at 80 × 24, never a smaller floor. (It is the same arrangement as the side panel's shared
divider column in Section 3.3.) Until canon 2.27 the footer had four rows — the rule, the position
readout, the key help and the status line; canon 2.19 had moved one row there from the header when
the Grid pane became a closed rectangle of its own. `grid watch`'s own view, not rebuilt on the Build
Phase's frame, still uses 8 rows, split 3 and 3.

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

1. Subtract chrome from the terminal: a border, a header, a footer, and a 29-column side panel whose
   divider is the Grid's west side (below). The resize gate and the choice of tile width still measure
   against a 30-column panel, so 80 × 24 stays the floor and two columns per tile still starts at 128.
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
| Maximum viewport (72 × 24) | 104 × 30 | 176 × 30 |

The minimum row is the resize gate's, which measures against the 8-row budget of Q12, so it is the
floor at both tile widths; the maximum row is where the Build Phase's actual 6-row chrome (Section
3.1, canon 2.27) first shows 24 rows of Grid — 104 × 32 until the footer became one line. An earlier
draft printed 28 for the maximum, which assumed a 4-row budget the minimum row did not.

**80 × 24 remains the floor and the acceptance target.** Everything must work there.

**Scrolling — RULE.** When the Grid is larger than the viewport, the camera scrolls. There is **no
minimap.**

- The camera position is in tiles and is clamped so the viewport never leaves the Grid.
- **The cursor drives it.** Move the cursor within the **scroll margin** of a viewport edge — a share
  of the view along each axis, 30% (the owner's settings export, 2026-09-30; GUIDANCE, a tuned value in
  `src/build/tuning.ts`; three tiles until gate 5H, 20% until gate 5K, 25% until canon 2.28)
  — and the camera follows. That is the whole interaction — no separate pan mode, no modifier keys, no
  second cursor. It works identically in the Build Phase and during a Pulse.
- **The margin is a follow rule, not an invariant** (gate 5A). It says where the camera must be
  relative to the cursor *when it can be*. At the Grid's own edge the camera has nowhere left to go,
  so the cursor legitimately reaches the edge of the screen — which is correct, because there is no
  more Grid to reveal by scrolling further. Stated because the rule is otherwise unimplementable as
  written, and because "the margin holds wherever the camera can still scroll" is a checkable
  sentence where "the margin holds" is not. Since gate 5H the margin is a share of the view's width for the sides and of its height for
  the top and bottom — 30% since canon 2.28 — rounded, and capped so an axis's two margins never meet;
  `--scroll-margin <percent>` sets it (it was
  three tiles from gate 5A, which the owner's 2026-09-26 playtest found too few: "about 20% of the
  height or width").
  (Q54). That a margin exists, and that the cursor drives it, is unchanged.
- **The UI must show that there is more Grid.** Without a minimap the burden falls on **the weight of
  the Grid pane's own sides**: every side with more Grid beyond it reads differently from a side where
  the map ends (below). A **position readout** in the footer, naming the visible tile range and the
  Grid size, was a second required signal until the owner took it out (canon 2.27, 2026-09-30: "The
  'view x y' position is not needed"); the sides carry the signal alone.
- Small Grids that fit entirely inside the viewport never scroll, and every side of their rectangle
  reads as the map's edge (below). Tutorials
  and opening missions should use them deliberately: `small` and `medium` presets fit the minimum
  viewport, so a new player meets the game without ever learning to scroll.
- **The Grid pane is a closed rectangle of its own — RULE, canon 2.19.** A line runs directly above
  the Grid's first visible row and directly below its last, and down both sides — never a line with a
  header or a footer between it and the Grid. The owner's 2026-09-26 playtest could not tell where the
  Grid ended ("the cursor ends at what it seems arbitrary") because two blank header rows sat between
  the Grid's top and the nearest line and the footer sat against its bottom with none: whatever the
  sides said about scrolling, they said it three rows away from the edge they were about.
- **The edge marker is the weight of that rectangle's sides — RULE, decided 2026-09-26; the map's own
  edge since canon 2.26.** A side with **more Grid to scroll to** is the frame's own line drawn dim
  (`-`, `|`); a side that has **reached the Grid's own edge** is drawn in **the map's own edge style**,
  named in the map's definition — a solid bar (an inverse-video cell) for a map that names none; a
  dashed fence for PERIMETER's stand-in map — in the quieter edge colour (`chrome.edge`), the same
  weight along the top and bottom as down the sides, in every glyph pack and in monochrome, with no
  colour needed to read it. A corner takes the edge wherever an edge side runs into it; a patterned
  edge is fixed to the map and scrolls with it. When the whole Grid fits, every side and all four
  corners are the edge at once: "this is the whole map". The frame's outer border and the rules where
  they cross the side panel never scroll, and stay plain. History: canon 2.19's `=` and bold `|`
  became the solid bar at 2.21 (Q56: "the rectangle needs to be a rectangle"); gate 5J made the
  glyph, the colour and a shared west side Experiments (feedback F25), and the owner's playtest of
  2026-09-29 chose (F38): "using map-specific borders looks a lot better! Even in ascii mode, the
  rugged border style applied to the UI border when reaching the map edge is an awesome UI touch …
  quiet and merged with the west side." The style vocabulary a map may name is solid, half, heavy,
  double, shade and fence (`src/view/edge.ts`). The switchable `--edge-style scrollbar` and gate 5C's
  dotted soft edge stay retired; a `[m] Map` popup that shows the whole Grid at once is a separate
  idea for later (Q59).
- **The side panel's divider is the Grid's west side — RULE, canon 2.26** (owner, 2026-09-29,
  reversing canon 2.21's separate column). One column: a plain line beside the menu's own rows and
  rules, and a light or map-edge side beside the Grid's rows. Canon 2.21 gave the Grid a column of its
  own because a solid bar on the divider read as a heavy menu border; the quieter edge colour and the
  map's own styles removed that reason, and the column goes to the Grid: 49 tiles at 80 × 24
  (`src/build/layout.ts`; `src/build/camera.ts`'s `FLOOR_PANEL_COLUMNS` keeps the floor measured
  against 30 columns).
- **A Grid shorter than the pane closes directly under its own last row** (gate 5F): the Grid pane
  keeps the minimum viewport's 16 rows while the terminal has them, because the side panel is
  designed at that height (9.2), and a shorter Grid sits at the top of it with its own bottom edge
  drawn across the Grid pane alone — the rectangle stays closed at the Grid's real edge, never at the
  pane's.
- **Cursor movement ramps, and the fast move jumps — GUIDANCE, built at gate 5H, reworked at gate 5J**
  (the owner's playtest of 2026-09-28; his numbers from the settings export of 2026-09-30). A single
  press moves one tile. A press of the same arrow soon after the one before — within the hold window,
  350 ms — is a run, whether it is the terminal's auto-repeat of a held key or quick tapping, and moves
  two tiles a press at once; once the run has lasted 200 ms, four. A different arrow, or any other key, starts again at one; there is no
  slow step (the gate 5H "slow after a turn" rule is deleted: "we don't need to implement slow
  speed"). The fast move — Shift and its fallbacks — is not a speed but a **jump of ten tiles**, and
  the view follows by the ordinary margin rather than re-centring; held, it jumps again at most every
  100 ms, so each jump is seen to land. Terminals send no key-up, so "held" is read from the gaps
  between presses. Timing lives in the input path (`src/build/motion.ts`); the reducer receives an
  ordinary `move-cursor` of the chosen size and stays a pure function of commands. The numbers are
  tuned values (`src/build/tuning.ts`), the owner's; the hold window stays an Experiment because it
  depends on each keyboard's repeat delay. **Every list moves the same way** (canon 2.28, F75): no
  wrapping, a tap one row, a held Up or Down ramping with these numbers and clamped at the ends, and the
  fast move going to the first or last row.
- **A click scrolls the view the same way, armed or not** (feedback F6, gate 5H; armed since gate 5J,
  feedback F22, reversing Q58's still view). A click inside an edge zone (a third of the view to
  start) carries the clicked tile toward the middle in proportion to its depth: all the way to the
  middle at the very edge, not at all at the zone's inner boundary; the Experiment's alternatives are
  "always centre" and "margin only" (Q62). With a structure armed, the preview follows the click, so
  the player can "keep clicking on the grid with the ghost building placement cursor to keep
  scrolling". **A double click places where its first click pointed**: two left clicks on the same
  screen cell within 400 ms (an Experiment) are one "here", even if the first scrolled the view. The
  input path reads the clicks' timing, as it reads keys', and sends the reducer an ordinary click on
  the first click's tile, so a driver script means the same thing. A slow second click on a spot the
  view moved away from is a fresh first click, never a placement on a tile nobody pointed at (Q50's
  finding). The Experiment "Armed click scrolls" switches back to a still view.
- **Everything that moves is interpolated — the camera slides and the cursor glides** (gate 5H; the
  glide at gate 5J, owner: "interpolations are easy and powerful"). Every change of camera, however
  caused, eases over a few frames (150 ms to start), and every cursor move glides from the tile it
  was drawn on (100 ms to start), whole tiles at a time, on the screen's frame timer, which runs only
  while something animates. Both are **tweens** (`ascii-effects.md` 1.2): pure functions of time, and
  a move in the middle of another continues from wherever things are drawn. The cursor glides across
  the view, so it rides along when only the map scrolls and is never drawn outside it; the armed
  preview travels with it. Only a resize snaps, and reduced motion snaps both. State, commands and
  scripted playtests hold the destination; the mouse hit-tests the drawn camera, so a click lands on
  the tile under the pointer.

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
measurement. **The index itself is not free of scale, even though the mask is**: it is sized to
`width * height` per layer and rebuilt every tick, so it is the one place cost is coupled to map
area rather than actor count. Section 11.1 has the fuller cost assessment at "hundreds or thousands
of units" scale, which this section's own numbers were not measured against.

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

### 3.6 Distance and movement — GUIDANCE, revised after Milestone 1 playtesting

**Four-way movement** (the compass points, never a diagonal), uniform cost per step, **Manhattan
distance** (`|dx| + |dy|`) for range and routing — `src/grid/coords.ts`, `DIRECTIONS` and
`gridDistance`. This superseded the gate's original choice — eight-way movement and Chebyshev
distance (`max(|dx|, |dy|)`), the standard grid-game answer, kept here as a footnote rather than
deleted so the reasoning stays visible:

> Eight-way movement and Chebyshev distance keep range rings compact and readable, and avoid
> fractional diagonal costs fighting the integer movement credit in Section 4.2. The known artifact:
> a diagonal step covers more ground than an orthogonal one, so diagonal travel is about 1.41× faster
> in real terms — an accepted simplification, listed rather than hidden.

The owner's first watch of the Pulse Playground found diagonal movement to be the single biggest
legibility problem: a unit that can cut a corner is a unit whose next tile a viewer cannot predict.
Restricting movement to the compass points makes every step read as "up," "down," "left," or "right"
— nothing else about the kernel's shape changes. Manhattan is the natural distance partner: it is
exactly the count of cardinal steps between two tiles, so "in range" and "reachable in that many
steps" mean the same thing again, which Chebyshev and eight-way together already promised but
Chebyshev and *four-way* would not have.

This traded one artifact for a sharper version of a limitation the routing floor already had. Under
Manhattan, every legal step changes distance by exactly ±1 — there is no step that merely holds
distance level, the way a diagonal sidestep once could. An actor approaching an obstacle off-axis
still has two improving directions and can slide along the obstacle's face; an actor approaching
exactly on-axis with its goal has exactly one, and if a wall takes it there is no fallback at all.
[`open-questions.md`](open-questions.md) Q15 has the measurement and the recommendation — real
pathfinding, Milestone 2's, is what actually closes this; the greedy floor was never meant to.

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
rate. It stops being cheap at Milestone 12; that warning stands.

**What changing the rate would cost, stated honestly.** Content durations are authored in raw ticks
(`cooldownTicks`, `intervalTicks`, and every cooldown in a fixture), so the number 12 is baked into
every one of them. If evidence moves the tick rate, that is a migration of every duration in every
definition and scenario — not a constant to edit. The alternative, authoring durations as rational
seconds, buys rate-independence at the cost of arithmetic at every use site; it was considered and
rejected as the worse trade while the rate is still cheap to change. Milestone 1 is deliberately the
place this hypothesis gets tested, because the fixture is six rows long and the migration is an
afternoon. It will not be an afternoon in Milestone 12.

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
death — Ravel volatile munitions are the first such rule, and they live on the bench, not
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
verification. [`replay-format.md`](replay-format.md) is a first concrete schema for exactly this list
— GUIDANCE, not built, written so Milestone 2 starts from a design rather than this one sentence.

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

It alternates **as many times as the match needs** — a campaign mission is a sequence of these
cycles, not one Pulse, and a mission's triggers decide how many and what happens between them
([`campaigns.md`](campaigns.md) Section 2.1). A Pulse may be scripted (no player plan; the player
watches) and it is still a Pulse: seeded, deterministic, replayed the same way.

**This section's own victory condition never learns about a mission's goal.** A mission's objective
([`campaigns.md`](campaigns.md) Section 2.2) is resolved one level up, by the scenario/trigger layer,
which fires an ordinary `win`/`lose` action when its own condition holds. What follows — Grid Nexus
destroyed, one side annihilated, tick limit reached — stays the unchanged fallback a battle with no
declared objective lands on: every Skirmish match, and every Challenge battle.

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
shared population cap; worker producers; military producers; defences; research facilities that are
themselves tech tree nodes (below); outposts that project construction coverage; capture structures
that claim a neutral-zone bonus while connected.

Structures live on the `obstacles` layer, are operational immediately after reveal, cannot move or
be sold, and keep working while disconnected but stop projecting coverage.

### 5.3 Automatic production — GUIDANCE

No shop, no queue. A producer attempts a fixed recipe on a recurring interval. When simultaneous
attempts cannot all be paid or supplied, every feasible attempt enters one seeded contention process:
one is chosen, paid, and spawned; feasibility is recomputed; repeat until nothing legal remains.

Players shape composition by building, protecting, upgrading, pausing, or losing producers.

### 5.4 Research, the tech tree, and Nexus powers — GUIDANCE

**A Commander Army's buildable structures form a real, inspectable tech tree — canon 2.16**
([`commander-armies.md`](commander-armies.md) Section 2.1), mostly shared across a faction's
Commanders with a few Commander-specific branches. This corrects this section's own earlier framing:
research facilities are not an alternative to a "linear tech menu," they are tree nodes like any
other structure, and completing one can unlock its dependents the same way a Nexus power's
`unlockStructure` effect does (Section 5.4 below) — one mechanism, two triggers. Gated entirely by
which structures exist, never by a second resource (Section 6's one-resource rule is untouched).

The Grid Nexus also offers a small draft of upgrades; research facilities modify that draft's tier,
breadth, redraws, weighting, or visibility. Structures may reach levels 1–3. Nexus powers are
content-defined legal actions or passive rules that execute through validated kernel commands.

**What the draft is dealt from is settled at canon 2.10, even though the draft itself is not
designed:** the Commander Army's own Nexus power pool — a subset of the faction's — dealt as a small
hand at the start of every Build Phase, from which the player keeps one
([`commander-armies.md`](commander-armies.md) Section 2.1). The draft's tier, size, and redraw rules
are still undesigned; recorded so the shape of the draft is not accidentally foreclosed.

**What a power may *do* is settled at canon 2.13** (Q42): to a player, a power is a name and a plain
description of what it does — no classification to learn — and in code the effect is one of a small
bounded union: `unlockStructure`, `spawnUnits`, `modifyContent`, `modifyRule`, `modifyCommander`,
`reveal` ([`commander-armies.md`](commander-armies.md) Section 4.5). That union is what a Build Phase
panel actually renders, so it is worth reading before building one.

---

## 6. Economy — GUIDANCE

**A match uses one resource.** Deposits and salvage both yield it. Supply is a separate shared
population cap, not a second currency. Nexus energy is a state readout, not something a player spends.

`ResourceCost` stays a keyed record in Section 8 so a later microgame can earn a second resource
without a schema change — but nothing through Milestone 12 may assume one exists.

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
the complete set of choices legally available to one player in one match — a Nexus and faction, a
Commander, starting units and structures, blueprints and a tech tree, upgrades, Nexus powers, and
Specials, bounded against its faction's pools
([`commander-armies.md`](commander-armies.md) Section 2.1). The match, the Pulse, and every renderer
see an army; none of them ever sees a faction.

Prefer composable capabilities — health, movement, attack, production, storage, supply, worker slots,
radius, restoration, regroup anchor — over inheritance. Exceptional behaviour may register narrow
hooks that receive read-only context and return intents for the kernel to validate. A hook API
protects engine integrity; it is **not** a security sandbox, and installed TypeScript is arbitrary
local code.

---

## 9. Presentation

**Authority: RULE** for the cell boundary, bands, and the accessibility rules; **GUIDANCE** for
composition details.

The working list of interaction and drawing patterns every interactive screen follows — focus, back
and cancel, the mouse, menu row states, popups, panels — is
[`../docs/ui-patterns.md`](../docs/ui-patterns.md); it is not canon until the owner accepts it and it
is promoted here.

### 9.1 The cell frame — RULE

```ts
type CellStyle = Readonly<{
  fgRole?: string          // a role, never a colour
  bgRole?: string
  bold?: boolean
  dim?: boolean
  underline?: boolean
  inverse?: boolean
  fade?: number            // 0-1, fgRole only: 0 the role's own colour, 1 the theme's background
  tint?: { role: string; amount: number } // 0-1, fgRole pulled toward another role (canon 2.24)
  seeThrough?: { role: string; alpha: number } // 0-1, a see-through cursor over the cell (canon 2.28)
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

**`fade` — added at canon 2.8 (Q25, `open-questions.md`).** A continuous scalar the resolver blends
toward the active theme's background before quantizing to the capability tier; the cell still carries
only a role and a number, so "never a colour" stays literally true. It resolves at `color256` and
`truecolor` only — `color16` and `monochrome` have no continuum to express it on and ignore it
entirely, unchanged from before this field existed. It is `fgRole`-only: a background is never faded.
Scope is deliberately narrow, not a general fade-out licence for effects — `ascii-effects.md` craft
rule 7 still holds everywhere except the one recorded departure it names.

**`tint` — added at canon 2.24 (gate 5I).** `tint?: { role, amount }` pulls the cell's `fgRole` part
of the way (`amount` 0–1) toward another role; the cell still carries only roles and a number.
`truecolor` interpolates the two roles' colours; `color256` interpolates, then takes the nearest
palette colour; `color16` has no continuum and steps onto the other role's own colour from 0.5 up;
`monochrome` ignores it. It is applied before `fade`. Scope: a placed building's light in the Build
Phase. The rainbow's six hue roles (`fx.hue.red` … `fx.hue.magenta`) are ordinary roles with a colour
per theme.

**`seeThrough` — added at canon 2.28 (the menu spike's round 2, feedback F64-F65).** A see-through
cursor over the cell: `{ role, alpha }`, a role and a number from 0 to 1, never a colour — "the cursor,
drawn in `role`, at opacity `alpha`, over what this cell shows". The cell's fill becomes `alpha` of the
role's colour and `1 − alpha` of what was there, which is itself 80% the cell's background and 20% its
glyph's colour, the glyph being taken to cover about a fifth of the cell (the owner's definition). The
glyph stays, drawn `alpha` of the way toward the colour the real cursor draws glyphs in (the theme's
background, the cursor being inverse video). The glyph's colour is its role after tint and fade; the
background is the cell's `bgRole` or the theme's; an inverse cell is swapped first; a blank cell is just
its background mixed toward the role. `truecolor` mixes exactly, `color256` takes the nearest palette
entry, `color16` shows the plain cursor (inverse in the role's colour) from an alpha of one half and
nothing below, `monochrome` the same step as inverse alone. Where it shows it replaces the cell's
colours, inverse and dim; bold and underline stay. It is written by a glyphless write, so the glyph
beneath always survives, and a later see-through write on a cell replaces an earlier one. One function resolves it
(`seeThroughColours` in `src/view/roles.ts`), and every renderer reaches it through `resolveCell` — the
one place a cell's style becomes what the ANSI writer, the browser page's canvas and OpenTUI draw: its
colours, its inverse video, its dim and its see-through style. Scope: the Explore Map hand-off's
travelling cursor. **`fade` is also used on the Build Phase panel's own text** for the card reveal
(below), chrome rather than an effect's glyph.

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

**Both phases share the same frame**: a **top bar**, the **Grid pane** closed into its own rectangle
(3.3), a 30-column **side panel**, and a **bottom bar**. The top bar and the bottom bar run the whole
width: at the 80-column floor the Grid pane is 49 columns, and the bottom bar's line is longer than
that. What each part is for is the owner's own description (2026-09-26): the top bar carries the
game's title and where the player is (the phase today; the mission and Pulse number once there are
some), the bottom bar is **one line of contextual help** (canon 2.27, below), and the side panel carries
actions and their status. Both phases support the cursor,
selection, inspection, and scrolling — a player watching a Pulse can hover a unit to read its state
in real time, and can scroll the Grid, exactly as they can while building. Keeping one composition
means one cursor, one scroll rule, and one set of muscle memory.

**The side panel moves to the left of the Grid — GUIDANCE, gate 5F.** Gates 5A-5E drew it on the
right. The owner, after playing it: "The build menu should definitely be on the left. I can think of
build games like sim-city. My eyes were on the left and I didn't notice that I needed to select the
things to build on the right... since build goes first, it seems better to keep the GUI on the left."
The frame's lines are derived from where the panel is rather than drawn around a fixed side
(`src/view/build-frame.ts`'s `drawChrome`), so the move is a layout change, not a redraw of every line.

What differs between the phases is what the side panel holds:

| | Side panel carries |
| --- | --- |
| **Build Phase** | what is left to spend on its top line, then `[e] Explore Map` and `[n] Nexus` (9.7), the buildings with each row's cost, and `[s] Start Pulse` on its last line — or, while Explore Map is open or a building is being placed, a card in the menu's place (below) |
| **Nexus Pulse** | Pulse number, both Nexus states, force totals, playback controls, and — when something is selected — that entity's live state |

**A refused placement is answered on the status line, and names its tile — RULE.** Built at gate 5B
as a block on the panel, and moved at canon 2.19 on the owner's own direction: "it would make more
sense to show that feedback on the low bar where it says 'Barracks selected', so we keep that low bar
for cursor status feedback... just doesn't need to be uppercase." A refusal names its reason, and the
tile when the reason is a tile, so the player can fix it rather than guess. **Affordability is
reported before any tile problem**: telling somebody a rock is in the way when they cannot afford the
building sends them to fix the wrong thing. **Looking and trying read differently**: while the armed
preview merely sits on a tile Enter would refuse, the status line says why in its ordinary tone and
the preview is a grey block of `x` (the owner found an all-red ghost "a bit too intense"); once the
player actually tries — Enter, Space, or a confirming click — the same sentence takes the refusal
tone, red where colour exists and bold everywhere, which is the acknowledgement that the attempt
arrived. A brief cursor flash on that attempt, the owner's other suggestion, needs a frame timer and
lands with gate 5H. The panel carries no refusal of its own any more.

**The bottom bar is one line, the contextual line — RULE for what it is, GUIDANCE for its words and
tones, canon 2.27** (owner, 2026-09-30, feedback F59: "The only thing that is useful is having a single
row that offers contextual help ... with an easy-to-use interface to show help as needed"). It is the
one place any screen answers "what just happened, or why not" — and, when nothing did, "what can I do
here". **It says the last command's answer while that command said something** ("Barracks placed
(resources: 60) - [u] undo", "Cannot build here: rock in the way at 8,5."), **and otherwise a hint for
where the keyboard is**: the highlighted menu row's description and cost, how to place, how to leave
Explore Map, what an open popup's keys do — from **one list of situations in the code**, a line each
(`HINTS` in `src/build/help.ts`), so a new situation is one line in one place. **An answer lapses at the
next command that says nothing**, so the hint comes back on its own; a message about a tile also lapses
the moment the cursor leaves that tile. During a Nexus Pulse the line says what the Pulse is doing,
unless a popup over it holds the keyboard. The position readout and the key help that shared the bottom
bar with it until canon 2.27 are gone: the map's sides say there is more map (3.3), and every key is on
the Controls and hotkeys page (9.7).

A message on that line is a small typed value, not a string: its text, a **tone** (`neutral`,
`success`, `warning`, `danger`, and `hint`, which reads quieter than any answer), and optionally **the
tile it is about** (`src/status.ts`). A tone resolves onto existing style
roles in exactly one place (`src/view/status.ts`) and never names a colour itself, so monochrome gets
the same message by weight alone. The owner asked for exactly this ("the game code should be able to
easily change the status text with options for highlight, bold, color, etc, and later maybe also
effects, that should be enums"); an effect — a flash, a fade — is a later field on the same value, not
a second mechanism.

**Hints are written the way the screen writes keys — GUIDANCE, canon 2.27.** Named keys in brackets,
as the menu rows and the top bar show them (`[enter]`, `[esc]`, `[e]`); arrows, up/down and
left/right as plain words, since they are directions. Each fits the bottom bar at the 80-column floor,
and a line wider than a narrower bar loses whole words, never half of one. The trimmed key help this
replaced (owner, 2026-09-26: "just say arrows move, shift+arrow fast move, leave pgup/home keys out")
opened with the mode's name in capitals; a hint names the situation in its own words instead.

**Planned buildings are drawn at full strength — GUIDANCE, canon 2.21** (owner, 2026-09-27: "Not
sure why they are greyed out; it will look better if they are fully built"). A planned structure uses
the same glyphs, role and weight as a standing one. What keeps a plan revisable was never the grey:
it is undo and remove, which work until the Nexus Pulse starts, and the status line after a placement
says so — `Hatchery placed (resources: 70) - [u] undo`, what is left to spend and the way back.

**The Build Phase menu is one list — GUIDANCE, canon 2.27, reordered at 2.28** (owner, 2026-09-30,
feedback F56-F58: "I want consistency and simplicity"; then F71-F72). `[e] Explore Map` is the panel's
first line and `[n] Nexus` sits straight under it, with the number of picks waiting and how many powers
are active ("Do not leave a space between Explore and Nexus items"). Then the **credits line**: blank on
the left and, in the column the building costs are in, the map's own resource-deposit symbol and what
is left to spend — `* 130`, `◆ 130` in the Unicode pack — the symbol from the same table the map draws
deposits with, in the deposit's colour, the amount bold, with no label and no maximum ("on the empty
line right before the build/construction list ... the same as the symbol used on the map to represent
resources"); a maximum can be shown when the player reaches it, later. The credits are on the menu
alone — not on a card, the committed summary or a Nexus Pulse — and list movement skips their line.
Then **every building as one list** in catalog order, one row each, numbered in that order, and
`[s] Start Pulse` pinned to the panel's last line. **No group headings and no Special row** ("Remove the categories for now. We
don't know how many items will be on a real game"): headings come back if a real game shows a list too
long to read. A building row the panel has no room for is neither drawn nor a click target. **The panel
carries no help text**: the key help that used to overflow into it and the line saying what the
highlighted row does are gone, and what a row does is the bottom line's to say. The rule that an empty
construct group is drawn, not skipped, so no hotkey moves when content arrives (gate 5B), retired with
the groups; it returns with them.

**A card replaces the menu while something has the map's attention — GUIDANCE, canon 2.21, reshaped
at canon 2.25, 2.26 and 2.27** (owner, 2026-09-27 to 2026-09-30). **Explore Map** — the menu's first
entry, and where the screen opens — gives the Grid the keyboard with nothing armed, and the panel
describes whatever is under the cursor **as the cursor moves**, no key needed. **Placing a building**
does the same for the building being placed (F58: "the menu should change to the full card that shows
details about that building ... This will create visual consistency for anything that gains focus on
the map"). Either way the card's header is **the row that opened it, drawn active on the panel's first
line** — `[e] Explore Map  >` or `[1] Barracks  >` — a separator runs under it, and
the card follows: the building's own glyphs as its icon, its name, a word on where it stands (planned,
standing, to build), what it is for wrapped between words (never cut mid-word), then its numbers as
label/value rows — cost where the menu sells it, health, size, attack where it has one. On bare ground
the card names the terrain in one line and gives the tile. Start Pulse hides with the rest of the menu.
**The header's own hotkey cancels** (F70: "cancelation is "esc", "x" or the same hotkey ... that is
already on the title"): `e` closes Explore Map and a building's digit cancels it, as `x`, Esc or a click
anywhere on the panel do, back to where the card was opened from (9.7). **A building being placed holds
the menu** (F69, canon 2.28): until it is placed or cancelled, another building's digit, `e` and `s` are
refused — the header flickers and the bottom line names the way on — while popups that belong to no row
choice (the Nexus powers, the game menu, Controls, Settings) open over it and give it back, and never
move the menu's highlight. Explore Map holds nothing: a digit while exploring arms from the map. Arming
and opening Explore Map put nothing on the bottom line but its hint. Tab and a click on the map arrive in
plain navigation instead, the menu left beside the map, so the next click can arm from it. It is a first
version of the presentation card the owner described; a larger ASCII art version waits for content
that has one, and live numbers wait for the Nexus Pulse view.

**The card opens with a short transition — GUIDANCE, canon 2.28** (F68: "all the menu disappears except
for the currently selected menu item ... interpolates (moves) the item to the top, and then the detail
card appears"). Whenever the panel turns into a card — Explore Map opened, or a building armed from the
menu or by a digit on the map — it plays over the "Card reveal" Experiment's length (150 ms; off to 800)
in three beats: the other rows fade out (a quarter); the chosen row, drawn active, slides a row at a time
to the header line (under a third); the separator and the card fade in, its name, subtitle and
description typed and a building's icon playing its own placement frames (the rest). From one card
straight to another only the last beat plays. Closing is instant, reduced motion shows the card at once,
and a still frame is the finished card. It is presentation timed by the live loop, which watches the
state become a card; the reducer never hears of it.

**A menu row has two states — RULE, canon 2.26; the active look since canon 2.27** (owner, 2026-09-29,
feedback F32: "we can standardize on the same style we use for buildings"): **highlighted**, the
keyboard's inverse bar, drawn only while the menu has focus; and **active**, while its action is under
way — a building armed, Explore Map open, the Nexus popup open, the Battle Round screen open. An active
row reads **`[1] Barracks  >`** (F53, then F67 and F70 at canon 2.28): its own hotkey, which ends what
it started (with Esc and `x`), and one `>` in place of its value, pointing at the map ("This will help
with the visual aid about the selected item having an effect on the grid"); the whole row in the hotkey
colour and bold, no underline, no bar — legible in monochrome by the `>` and the bold. A pressed flash
still wins, drawn as the bar — except on the row a card reveal carries up from the menu, which is
drawn active all the way (F68). **A refused flicker changes only the words** (F61): they turn grey — the
muted role, dim — and the row's background stays exactly as it was, the highlight bar included, so it
reads "nothing here" rather than a press. Every menu row either opens a popup or gives the map something to do (F52), and both kinds
share the one look. One function decides and draws it for every row, so a change of style reaches them
all.

**Popups have one shape — RULE for the shape as data, GUIDANCE for its look, canon 2.21, grown at
2.26.** Every popup — the Nexus powers, the start-the-Pulse question, the game menu, Settings, the
export, and a message — is a title and a list of rows, some of them options that name the command a
click on them sends, and **at most one run of rows that scrolls** (`src/build/popup.ts`). The frame
draws a popup from the same placed shape the mouse adapter hit-tests, so a click can never land on
anything the frame drew somewhere else — the guarantee `src/build/layout.ts` already gives the side
panel. Drawn to be unmissable (the owner clicked Nexus, did not notice the popup, and thought the mouse
had stopped working): centred over the Grid pane, bordered in a solid bar, the title in the top border,
and a one-cell shadow that blanks what is behind it. **No popup carries `[esc]`** since gate 5K: the
top bar's right end names what Esc does — `close [esc]` while a popup is open — and is its click
target (9.7, feedback F37). While its scrolling rows overflow, **the right border beside them is a
scroll bar**: an up symbol, a track with a thumb showing the share in view, and a down symbol, in every
glyph pack; a click on its upper half scrolls up and on its lower half down, and the wheel and Up/Down
walk the highlight as before (F36). **A message is the shape with nothing to choose**: a title and
wrapped text, closed by Esc (or `x`, or a right click) or a click outside, and by nothing else (F34:
"This popup does not have an action, it's just a warning message"). A popup holds the keyboard and
the mouse until it closes, and nothing opens one but the player — a message only as the answer to
something the player just did. It sits on top of everything else without a drawing band of its own
(9.4).

**No radius preview until something placed has a radius.** An earlier draft of the table's Build
Phase row listed one; nothing in the content that exists has a radius, and a preview of nothing is a framework built
before its first use (Q30).

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
| 10 `chrome` | frame, sidebar, status strip, popups |

Each band returns sparse cells; the topmost defined cell replaces the lower complete cell style.
Grid bands clip to the Grid. **Presentation overlap never changes occupancy.**

**A popup has no band of its own** (canon 2.21). It is drawn last in the `chrome` band: within one
band a later write replaces an earlier one, so a popup drawn after the frame, the side panel and the
bottom bar sits on top of all of them, and over the Grid bands beneath. The bands stay the fixed list
above; an eleventh band for overlays would be the free z-index this section exists to refuse.

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

**Placement juice — GUIDANCE, gate 5I.** A structure may carry **placement frames**: a short list of
footprint-sized frames played before its finished art as it is placed (a space is empty ground). Only
the Build Phase view reads them; a structure without them gets a generic run derived from its finished
art, so no content waits on an artist. It is presentation only: the live loop times each placement
from the first frame that drew it, the view draws a pure function of the plan and the time since
placement, and a placement that leaves the plan stops at once. **A placement is one *play* of its
frames on that building's animation track, and the light (`fx.light.flash`, shading — `tint`, above)
and the sparks (`fx.sparks.burst`, particles) are that play's follow-ups, scheduled when its last frame
ends** (gate 5J). Reduced motion shows it finished at once. Every duration and intensity is an
Experiment. The four families of presentation — animations, particles, shading and tweens — and the
animation track are defined in [`ascii-effects.md`](ascii-effects.md) Section 1.2.

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

### 9.7 Input model — RULE for the command vocabulary, the three adapters, and displayed hotkeys; GUIDANCE for the bindings

**Owner direction, canon 2.10**, written before any interactive screen exists so that Milestones 3
and 5 build against one model instead of two. Mario: "When a player is proficient in the game, they
should be able to move fast by just typing in the keyboard... The menu should also work with the
mouse... We have to support keyboard, mouse, and agent interfaces."

**One command vocabulary — RULE.** Everything a player can do on an interactive screen — pick a
menu item, move keyboard focus, move the cursor, arm a structure for placement, place it, inspect a
tile, remove it, pick a Nexus power, go back one level, commit the Build Phase, start the Pulse,
advance a cutscene, ask to leave, quit — is a **named command**. Commands
are the only way input reaches the application shell, and a command's effect never depends on which
adapter produced it. Three adapters exist, and all three are first-class:

| Adapter | Produces commands from | Exists for |
| --- | --- | --- |
| **Keyboard** | key events, through one displayed keymap | the primary way to play; keyboard-complete stays the accessibility floor (9.6) |
| **Mouse** | click, wheel, and, where the terminal reports it, motion — converted from terminal cells to tiles and menu rows by the adapter alone | direct manipulation: every menu item is clickable, and a click that activates it does exactly what its hotkey does. Since canon 2.25 a click **activates what it lands on**, from any focus (owner, 2026-09-28: "using the mouse should activate what is being clicked"); only the keyboard has a "highlighted, not yet chosen" state (the bindings table below) |
| **Driver** | a scripted list of commands, or of raw key and mouse events, from a file or a test | agents and tests: Claude playtesting the game without a terminal, and every input assertion the project makes |

The driver is not a test-only afterthought. It is Section 1's practical test — "resolve an entire
match with the renderer deleted" — applied to the shell: the whole game, menus and Build Phase
included, must be playable from a command stream, and its output read back as the engine-owned cell
frame (9.1) and structured snapshots rather than as pixels or ANSI. Two things follow:

- **the driver injects raw key and mouse events into the real adapters, not only commands.** A test
  that only sends commands proves the command works; it does not prove that `[2]` on screen means
  what pressing `2` does, or that a click on that row means the same. The mapping is the thing most
  likely to drift, so it is the thing under test. `controlForKey` and `keysFromChunk` in
  `src/view/playback.ts`, and the fake stdin `tests/lifecycle.test.ts` drives `watch` with, are the
  seed of this — one key map both the view and a test agree on. The driver generalises it to mouse
  events and to every screen;
- **mouse geometry lives only in the mouse adapter.** A click arrives as a terminal cell; the adapter
  converts it to a tile using the tile width (9.3) and the composition's layout, and emits a command
  that names a tile or a menu item. Nothing downstream ever learns a cell coordinate, so a change of
  tile width or panel layout changes one adapter and no command.

**Menus — RULE.** Every menu item displays its hotkey before its label — `[1] Barracks`,
`[s] Start Pulse` — and pressing that key activates the item. **A hotkey that is not displayed
does not exist.** Arrow keys and Enter also work on every list, and Esc backs out of it: the hotkey is
the fast path, never the only one (a menu can always be walked with Up, Down and Enter alone). Hotkeys are stable — the same item keeps the same key across
screens, sessions, and terminal sizes — so muscle memory transfers. The bracketed key is the carrier
that survives monochrome; a style role (`chrome.hotkey`) colours it where colour exists, and colour
never carries it alone (9.6).

**The Grid cursor — RULE for what it is, GUIDANCE for the numbers.** One cursor, on the Grid, moved
by the arrow keys one tile at a time, with a modifier for a longer jump; it drives scrolling exactly
as 3.3 already states. Clicking a Grid tile moves the cursor to it. In the Build Phase, a structure is
*armed* from the construct menu by its hotkey, by Enter or Space on its highlighted row, or by a
click, and placed at the cursor with Enter or Space (or a second click on the same tile — Q52, below).

**The menu orchestrates the Build Phase — RULE, canon 2.21; finishing returns to where it began
since canon 2.26** (owner, 2026-09-27, Q57; refined 2026-09-29, feedback F30). Keyboard focus is
reducer state, on the menu or on the Grid, and the screen is always in one of four plain modes:
**the menu** (the highlight bar, no Grid cursor), **placing** (focus on the Grid with a structure
armed: its row drawn active, the cursor carrying its ghost), **Explore Map** (focus on the Grid,
nothing armed, the tile panel in the menu's place) and **plain navigation** (focus on the Grid,
nothing armed, the bare cursor and the menu beside it). **A structure is armed only while the Grid has
focus**, so a stale ghost can never sit on the map while the player works the menu. **Finishing goes
back to where it began**: a placement, or Esc while placing, goes back — disarmed — to plain
navigation when the arming began on the map (a digit pressed there), and to the menu, on the row just
used, when it began on the menu (Enter/Space or a click on its row, or a digit while the menu had
focus); Explore Map follows the same rule. With the mouse, "back to the menu" leaves no highlight bar
(9.2). **Arming puts the building where the cursor is** — its digit, Enter/Space on its row or a click
on it — when it fits there; otherwise the spot within reach of the cursor that costs the least to
reach, a tile up or down costing more than a tile sideways (the reach and the cost are the owner's
tuned values, `armSearchTiles` and `armVerticalCost` in `src/build/tuning.ts`), trying first spots that leave one free
tile between it and every structure and only then spots that merely fit (ties: the more horizontal
move, then east, then south); with none in reach the cursor steps one right and one down and the
building is drawn as itself, not refused, until the player moves or tries to place. The cursor opens
on the Grid Nexus. The owner's own flow (2026-09-29): find a good area, press a building's key — it
stays under the cursor — place it, press the key again, and the next one lands a free column to the
right. This retires Q55's smart cursor, which placed the next building beside the last one planned
wherever the cursor was.

**Bindings — GUIDANCE**, the starting keymap. Milestones 3 and 5 retune on evidence and record why:

| Key | Command | Note |
| --- | --- | --- |
| `1`–`9`, `0` | select item *n* of the panel's current list — construct menu, Nexus draft, or a menu screen's options. While a building is being placed its own digit cancels it and every other building's digit is refused until it is placed or cancelled (canon 2.28, F69-F70) | digits always address the list; they never mean anything else. The construct menu is one list since canon 2.27 (no groups); if groups come back, **they share one digit sequence** (gate 5B): a hotkey addresses the whole menu, never a position within a group, because per-group numbering needs a focused group and that is the mode this convention exists to forbid |
| Arrows | on the Grid: move the cursor one tile. On the menu and in every list: Up/Down move the highlight, stopping at the first and last row (no wrapping, canon 2.28), a held Up or Down ramping with the map cursor's numbers; Left and Right have nothing to do there, so the highlighted row flickers, and **the keyboard stays on the menu** | the cursor drives the camera at the scroll margin (3.3); one press moves one tile, a held or quickly tapped arrow two a press and then four (3.3's ramp). The flicker is the owner's (2026-09-27: "pressing right/left should flicker the item so the user understands the focus is on the menu"); a second Right moved focus to the Grid until canon 2.27 (2026-09-30, F55: "on second thought, it's better that the focus stays on the menu, but it is good that the menu item blinks when pressing left or right") |
| Shift+Arrow | the fast move: a **jump of 10 tiles** (the owner's settings export, 2026-09-30; 5 until gate 5H, 8 until gate 5J, 12 until canon 2.28), the view following by the ordinary margin; held, it jumps again at most every 100 ms. **In a list, the fast move goes to the first or last row** (canon 2.28) | fast pan across a scrolling Grid (owner, 2026-09-28: "Holding shift should behave fundamentally different, instead of just speed up to 8, it should move the cursor 12 tiles"). **Two sequence families, both bound** (gate 5A): xterm's `CSI 1;<modifier>` and rxvt's `CSI a/b/c/d`. Any modifier counts, not Shift alone — nothing else on these screens binds a modified arrow, so a terminal that eats Shift but passes Alt or Ctrl still gives its player the fast pan. **Option+Arrow as a Mac sends it is the same move** (owner, 2026-09-26: "we should also allow option (it is typical to move word by word)"): macOS terminals send Option+Left/Right as `ESC b`/`ESC f`, and one set to treat Option as Meta sends `ESC` before an ordinary arrow. Before canon 2.19 the input splitter broke both into a bare Escape plus a stray key — and a bare Escape with nothing armed leaves the screen. Bound from the terminals' documented defaults; **not yet measured on the owner's own iTerm2** — `node scripts/lib/key-echo.mjs`, run in that terminal, prints exactly what each key sends |
| PageUp / PageDown, Home / End | the fast move — the modifier-free fallback | **Required, not optional** (gate 5A): four surveyed terminal families send no shifted arrow at all, so without this they would have no fast pan. Decoded from a table, because Home and End have three live spellings between xterm, screen/tmux/linux and rxvt |
| Enter, Space | on the menu: activate the highlighted entry — arm a structure (focus moves to the Grid), open the Nexus powers, or explore. On the Grid while placing: place the armed structure at the cursor. On the map after a click brought the keyboard there: open Explore Map (9.2). In the Nexus powers popup: pick the highlighted power (the two questions answer to their own letters) | Space added 2026-09-26 (owner: "should also work with space, that was my reflex") — an alias of Enter everywhere on this screen, never a second meaning of its own |
| Esc, `x` | **go back one level** — Esc is the `cancel` command, `x` the `back` command: close the open popup, returning to the popup it was opened from if any (Settings to the game menu, the export to Settings); else leave placing or Explore Map for where it began, disarming; else leave plain navigation for the menu; else, on the menu, **Esc** opens the **game menu** (`[s] Settings`, `[c] Controls and hotkeys`, `[r] Restart`, `[q] Quit`) while **`x` does nothing** — no message, no flicker, on the menu, a committed plan or a Nexus Pulse alike — so `x x x` always lands on the menu (owner, 2026-09-30, F62: "the only exception to the rule of esc and x are the same"). No popup has a row that only goes back (F73) | **RULE since canon 2.21: Esc never leaves the game by itself — leaving always asks.** `x` is Esc everywhere but there (owner, 2026-09-27: "it should be equivalent to do [esc], and x"), and a right click is `x`. A lone Esc at the end of a read waits a short timeout (50 ms, a tuned value) for the rest of a sequence; Esc then a letter or digit in one read is two keys; Esc then an arrow in one read is Option+Arrow, so anything scripting keys pauses after Esc (gate 5H) |
| Tab | toggle keyboard focus between the side panel's menu and the Grid (arriving on the Grid in plain navigation, nothing armed); does nothing while a popup is open | **Gate 5F, owner-requested 2026-09-26.** This row previously read "jump the cursor to the player's next / previous own structure" — GUIDANCE, never built, now retired from Tab (Q53 keeps the idea for another key). **Focus is its own state beside `armed`**, and the rule above holds: a structure is armed only while the Grid has focus, and finishing returns focus to where it began (Q57, answered 2026-09-27, refined 2026-09-29). **Convention 1 below applies: the bottom line's hint is written for where focus is**, because focus makes arrows mean two things |
| Backspace, Delete | on the Grid: remove the planned, uncommitted placement under the cursor | plans are revisable until commit (Milestone 5). The Mac key labelled "delete" sends Backspace, so it cannot also return focus to the menu, as the owner's first sketch of the focus toggle had it — Esc does (Q57). On the menu, where the cursor is hidden, it is refused: the row flickers, as Left and Right do |
| `u` | undo the last planned placement | |
| `s`, `p` | Start Nexus Pulse — the menu's last row, `[s] Start Pulse`; `p`, its first key, still works | moves focus to the menu and opens the Battle Round screen, where Enter, Space or `s` again start it and Esc goes back (gate 6A, feedback F47-F50); the one action that must not fire by accident. Refused while a dealt Nexus power is still waiting to be picked |
| `n` | open the Nexus powers popup — the menu's `[n] Nexus` entry | pressed again inside the popup, closes it |
| `e` | Explore Map — the menu's first entry, `[e] Explore Map`: focus to the Grid with nothing armed, the side panel describing what is under the cursor as it moves (9.2). Opened from the menu, the cursor first moves to clear ground by the arming rule for a one-tile footprint (F66, canon 2.28); opened from the map it stays | added 2026-09-27 (owner: "Pressing [e] changes the focus to the map in navigation mode"); first, renamed and self-explaining at gate 5J (feedback F23); a toggle, its row drawn active while open, since gate 5K (F32). Tab arrives in plain navigation instead |
| `q` | open the game menu | never quits outright, so a stray press cannot lose a plan; only the game menu's own `[q]` (or Enter or a click on its Quit row) quits. The top bar's `menu [esc]` is Esc, which on the menu opens it (gate 5J, owner: "When pressing [esc] or explicitly opening the main menu, there should be an option for '[s] Settings' along with '[q] Quit'") |
| Ctrl+C | quit at once | the one immediate way out, from anywhere |
| `?` | the **Controls and hotkeys** page — every key and click, grouped by where the player is; also the game menu's `[c]` row | built at canon 2.27 (owner, 2026-09-30, feedback F60: "an option for 'Controls and hotkeys' that opens a section that explains how to use the keyboard, hotkeys and mouse clicks. This will be enough for offering help"). One scrolling popup, from one table (`src/build/help.ts`); opened from the game menu, Esc goes back to it; opened with `?`, Esc closes it |
| `q`, Space, `.`, `,`, `[`, `]`, `r` | unchanged from `grid` during a Pulse: quit, pause, step, speed, restart | one keymap across `grid` and `terminal-nexus` |
| Mouse: click a menu row | **activate at once**, whatever had focus: arm the building (its preview at the cursor when it fits there, else at the nearest good spot (the arming rule above); what a row click starts returns to the menu), open the Nexus powers, or open Explore Map — the row's hotkey. While a card covers the menu (Explore Map, or a building being placed), a click on the panel only gives the menu back | owner, 2026-09-28 (feedback F22), reversing 2026-09-27's highlight-first: "The selected state only makes sense when using the keyboard, but using the mouse should activate what is being clicked." After the mouse works the menu no highlight bar is drawn; the first menu key only shows it again, on the row it remembers. An armed row is marked as armed (`[x] … >>`, underlined), never with the keyboard's bar. The whole row is the target, the width its highlight bar is drawn |
| Mouse: click a Grid tile | move focus to the Grid and the cursor to the tile, the armed preview with it; **a second click on the same tile places it, and so does a quick double click on the same spot** (3.3). With nothing armed it only moves the cursor: in Explore Map the panel follows it; from the menu, the menu stays drawn beside the map | Q52, reversing Q50 — the terminal caveats below have the reasoning. A click near an edge scrolls in proportion, armed or not (3.3, Q62, F22). A `Shift+click` to place in one click is still planned |
| Mouse: click outside an open popup | close the popup and move focus to where the click landed — and nothing more | a dismissing click never also places, picks or activates (owner, 2026-09-27: he clicked Nexus, missed the popup in the middle of the screen, and thought the mouse was broken). A click on the top bar's `close [esc]` goes back one level, as Esc does, where a click outside closes every popup at once; a click on one of its options chooses it |
| Mouse: click the top bar's right end | Esc — the `cancel` command, one level back | the right end names what Esc does now: `menu [esc]` on the menu (or a committed Build Phase), `back [esc]` while the Grid has focus, `close [esc]` while a popup is open (owner, 2026-09-29, feedback F37: "we can reverse the title and hotkey for some actions that navigate 'back'"). It is the one place Esc is named on screen |
| Mouse: wheel | **move the cursor five tiles**; the camera follows it, as it follows every other cursor move | the mouse's Shift+Arrow, literally. An independent camera would be the separate pan mode 3.3 forbids, and would strand the cursor off screen (gate 5A). Inside a popup, the wheel walks its list |
| Mouse: right click | `x` — go back one level, never opening the game menu | the RTS convention for "cancel"; since canon 2.28 (F62) it is `x`, not Esc, so a stray right click cannot open a menu |

**Letters are spoken for before they are built**, so a new binding does not collide with a planned
one: `d` opens Settings at its Experiments, and `m` is kept for a whole-map popup (Q59); inside
their own popups `s` is Settings (the game menu) and `e` is Export (Settings) — outside them `e` is
still Explore Map. The
entries above the construct groups get **letters**, never digits — a digit would renumber every
construct row beneath it, which is exactly what one digit sequence per menu (the first row of the
table above) exists to prevent: `[e] Explore Map` and `[n] Nexus`. Inside the game menu `c` is
Controls and hotkeys. `p`, `q`, `s`, `u` and `x` are taken.

Three conventions behind that table, so a retune keeps them:

1. **No modes but focus.** A key means one thing on a screen. Digits always address the list,
   letters always name commands, from either focus. That is why `h`/`j`/`k`/`l` are *not* cursor
   aliases even though a terminal audience expects them: letters belong to the hotkey vocabulary, and
   a modal cursor is the classic source of "why is my key not working." The one exception is the one
   this convention always allowed: a panel that genuinely needs arrow keys of its own (the menu, since
   gate 5F) takes them through keyboard focus, so arrows and Enter/Space — and nothing else — follow
   focus, Tab moves it, and the bottom line's hint is written for where it is (9.2).
2. **The screen documents itself.** The bottom line says what can be done where the keyboard is, the
   Controls and hotkeys page (`?`, or the game menu's `[c]`) carries every key and click, and every
   menu row carries its own. Nothing is discoverable only from a manual.
3. **Standards over cleverness.** Enter confirms, Esc cancels, `?` helps, digits pick, wheel scrolls,
   right-click cancels. A player who has used a terminal editor, a roguelike, or an RTS should guess
   the first key right.

**The Nexus power pick is a popup the player opens, not a screen forced on them — GUIDANCE, revised
2026-09-26, gate 5F.** Gate 5D built the pick as its own full-screen step that opens the Build Phase
and blocks everything else until answered. The owner's own later playtest asked for something
friendlier: a "Nexus (1)" entry — the count is the number of picks waiting — as **the top
entry of the side panel's menu**, that opens a popup **in the middle of the screen** only when the
player actively selects it, never forced open the instant the Build Phase begins; inside it they make
a pending pick by keyboard or mouse, read what each power does, and review the ones already active.
The popup is the first thing the game draws **over** the Grid pane, holding the keyboard and the
mouse until it closes. The start-the-Pulse question and the exit question became popups too, so with
three real uses the shape was extracted at gate 5F's second round (the one popup shape of 9.2); the
Settings popup (below) is the fourth. **The popup closes on the pick — GUIDANCE, canon 2.21**
(owner, 2026-09-27, answering Q60): open, pick, and the player is back on the menu; the status line
and the entry's "1 active" confirm it, and reopening the popup lists the pick as active. Esc, `n` or
a click outside close it without a pick. The entry itself is `[n] Nexus`, with the number of picks
waiting after its name — "(1)" — in the hotkey's colour. The owner scoped it to the interface ("only build the UI for now"): the powers
behind it stay gate 5D's two placeholders until Milestone 8. **A dealt Nexus power still may not
be skipped** (`commander-armies.md` Section 4.5, unchanged) — but where that gets enforced has to move
for the popup to actually feel optional. Gate 5D refused every state-changing command with "Pick a
Nexus power first" the instant a pick was outstanding, which was exactly right for a forced full
screen but would make an *optional* popup feel just as forced — every other action would still nag
until it was opened. Gate 5F narrowed the check to the one place the invariant actually has to hold:
only the commit itself (`p`, and its confirmation) is refused while a pick is outstanding, and arming,
placing, undoing and removing proceed freely regardless (`commitLock` in `src/build/state.ts`).
Nothing about the invariant's own guarantee changes — the Build Phase still cannot
end without a pick — only where the refusal fires.

**Two related ideas from the same feedback, each with a gate now** (Q55): a **smart cursor** (built at gate 5F, replaced at gate 5K by arming where the cursor is, above) that,
when a structure is armed from the menu and focus moves to the Grid, puts the cursor on the nearest
tile where it can legally go — toward the centre of the map, aligned with what is already planned and
leaving one tile free between structures — in practice one tile beside the last thing planned,
aligned with it — so the owner's "down, down, space, place, space, place" lays out a tidy row without
the arrow keys: each placement returns to the menu on the same row, and Space arms it again beside
the one just placed (gate 5F, with the focus it belongs to; it is a deterministic rule of the
plan, so the reducer can own it); and **a frame timer** for the Grid pane (built at gate 5H), so camera and cursor moves
can ease toward their target over a few frames instead of jumping — the same "presentation may
interpolate without changing simulation" latitude Section 1 already grants, on a screen that has
only ever redrawn once per input event (`src/cli/spike.ts`'s `render()`) (gate 5H).

**Settings and Experiments — GUIDANCE, gate 5G as Debug Mode, gate 5J as Settings** (owner
direction, 2026-09-26 and 2026-09-28: "Let's solidify this as Settings"). The game menu's
`[s] Settings` is one scrolling popup, the same shape as every other. First come **the player's own
settings** — background (dark or light), colour depth, symbols, reduced motion — which apply at once
and are saved through the same store as the title menu's Settings. Then, clearly apart at the bottom,
**Experiments**: live-editable playtest flags — a border glyph, a colour, a scroll-margin share, a
step size, an easing time — so the owner can try an idea during a playtest instead of asking for a
new command-line flag and a rebuild. A row is a name and a value; one that only takes effect when the
Build Phase starts over says so on the status line when changed and, when Settings closes with such a
change pending, once in a message popup (F34). **Every Experiment names the question it serves and is normally deleted before its pull
request is accepted**, a few staying longer or graduating into real settings; they are Build Phase
state, per session, **never saved**, because their defaults change from build to build. The reducer
reads those that change what a command does, the input path and the live loop read the timing ones,
and the game menu's `[r] Restart` starts the Build Phase over keeping every setting and experiment. `d` opens
Settings straight at the Experiments. A row shows its value between `<` and `>`, Left/Right change it,
and each half of the value box is a click target; the title says where the highlight is
(`SETTINGS (6/28)`), the list keeps it in view with a scroll bar in the right border, and what the
highlighted row is for is written under a line below the list (F35). **Export settings** — the list's
last row, and `[e]` from anywhere in it — shows every setting and
experiment as `name = value` text — the experiments that differ from this build's defaults first,
each with the default it replaced, then the settings, then the rest, with the build's commit near the
top — so the owner can paste what felt right into a pull request comment. The adapter, never the
reducer, also copies it to the clipboard (OSC 52 in a terminal, the clipboard API on the browser page)
and saves it to a file beside the settings. `--settings "<text>"` (the terminal game and the scripted
playtest) and `#settings=` (the browser page) read it back, skipping an unknown name or a bad value
one at a time, so an agent sees exactly what the owner saw. It replaced the one-flag-at-a-time
`--scroll-margin`/`--edge-style` pattern of gates 5A-5C, and gate 5G's `[d] debug` popup, as the way
this project shows the owner two answers side by side. The title menu's Settings screen has the
player settings only.

**Terminal caveats, verified rather than assumed** (Q37; measured by gate 5A on 2026-09-21,
`evidence/gate-5a-report.md` Section 4.1 has the table and the ten terminals it could *not* test):

- **Modified arrows are not universal, and not single-valued.** Measured: xterm, xterm-256color,
  tmux and tmux-256color send `CSI 1;2A` and its siblings; rxvt and rxvt-unicode send a completely
  different, shorter form (`CSI a`/`b`/`c`/`d`); and **screen, screen-256color, the Linux virtual
  console, vt100, vt220 and ansi define no shifted arrow at all** — on those, Shift+Up is simply Up.
  Both families are bound, and the modifier-free fallback above is required rather than a courtesy.
  PageUp and PageDown exist on every terminal description surveyed except vt100 and ansi, which
  makes them better supported than the binding this table recommends first. Both are displayed.
  **An emulator this project has not measured is not a supported one**: PuTTY, Alacritty, kitty,
  WezTerm, Ghostty, iTerm2, the GNOME/VTE family, Windows Terminal, Konsole and foot are all
  untested, and their own documentation is not evidence this project has gathered. The owner plays
  in **iTerm2 on macOS**, which makes it the first one worth measuring: `node scripts/lib/key-echo.mjs`
  run there, with Shift, Option and plain arrows pressed in turn, settles what this table only
  assumes about it.
- **Mouse reporting is opt-in and must be undone.** A terminal reports the mouse only after the
  program asks (SGR extended mode, `1006`, over `1000`/`1002`); the disposer of 10.1 switches it off
  on every exit path. A game that leaves mouse reporting on is rejected for the same reason as one
  that leaves raw mode on. Where no mouse arrives — a plain SSH session, the driver, a non-TTY —
  nothing is lost, because the keyboard is complete.
- **A second click on the same tile places the armed structure — RULE, revised** (Q52, 2026-09-26,
  reversing Q50's 2026-09-21 decision — see `open-questions.md` for both). A first click on a tile
  only moves the cursor there and shows the armed preview, the same as arriving there by arrow keys;
  a second click **on that same tile** is what commits the placement. This deliberately reopens the
  asymmetry Q50's own writeup found and rejected at the time — a first click within the scroll margin
  can slide the Grid under the pointer, so a second click at the same *screen position* can land on a
  different *tile* — but it is safe this time for the reason it was not safe as a toggle: the check is
  on tile identity, never on screen position, so a camera-shifted second click is correctly read as a
  fresh first click on a new tile (one more click confirms it), not a placement on the wrong one. A
  later `Shift+click` is planned as a one-click escape hatch for a proficient player who wants the old
  behaviour back; not built yet. Keyboard placement (Enter, and now Space) is unaffected and stays a
  single press, which already asks for two deliberate actions (arm, then place) the way a first click
  now also does. A camera-shifted second click is safe but still a surprise — the player clicked the
  same spot twice and nothing was placed — and a wider scroll margin (Q54) makes it common, which is
  why Q58 recommends that an armed click never scroll the view at all.
  **What still makes any of this safe is that a plan is revisable** — undo, remove-under-cursor, and
  nothing committed until the commit key. If a future Build Phase action is genuinely irreversible,
  confirmation belongs on that one action, never back on every click.
- **The tile just built on never reads as a refusal — RULE** (2026-09-26 owner playtest). The
  moment after a structure is placed, the tile under the cursor is occupied by that same structure;
  a preview that redrew its normal legality check there would report the tile as taken and show the
  illegal-placement block on top of what the player had just correctly built, reading as a failure.
  Gate 5E answered it with a special case: the just-placed tile absorbed a repeated place command
  until the cursor moved, with the structure still armed. **Since canon 2.21 it holds by
  construction instead**: every placement disarms and returns focus to the menu (the menu
  orchestrates, above), so no ghost is left on the Grid to recheck the tile, and the status line
  reports the success — `Barracks placed (resources: 60) - [u] undo`. The special case is gone with
  the armed state it existed for; the rule it protected, no false refusal over a correct placement,
  is unchanged and still tested.

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
screen after normal exit, `q`, `SIGINT`, `SIGTERM`, setup failure, and caught render failure — and,
once the mouse adapter exists (9.7), it switches terminal mouse reporting off on the same paths. It
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
[`../milestones/milestone-01-grid-battles.md`](../milestones/milestone-01-grid-battles.md) Section 3.3.

This is **modding-first architecture, not mod-loader-first development.** No public SDK, remote
loader, marketplace, permission system, or compatibility promise belongs in early milestones. Themes
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
   pinned to a specific contract. [`open-questions.md`](open-questions.md) Q20 has the options and a
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
