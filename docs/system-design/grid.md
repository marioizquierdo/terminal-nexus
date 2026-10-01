# Terminal Nexus — the Grid

_The play surface: its size and shape, orientation, the viewport and scrolling, layers and collision masks, placement and footprints, distance and movement. Split from the engine design; every unmarked statement is GUIDANCE._

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
- **Taps are counted, a hold keeps its own pace, and the fast move jumps — GUIDANCE** (built at gate 5H,
  reworked at 5J and again after the owner's third round on the menu spike, 2026-09-30, F79). A tap
  moves one tile. Taps of the same arrow each within 400 ms of the one before are a run that keeps its
  speed; the third tap since the speed last changed, or since the run began, doubles it if it came within
  300 ms of the tap before. So a run goes 1, 1, 2, then 2, 2, 4, and four is the top ("the user tap 3
  times at least before activating speed, and the last one needs to be a bit faster"). A longer gap,
  another arrow or any other key starts over at one. A held key moves at the game's own pace rather than
  the operating system's repeat rate: at most one move every 60 ms (on average exactly that when the
  keyboard repeats faster), one tile a move, two once the key has repeated for 600 ms (first guesses). A
  hold ends a run of taps. Where the terminal reports key events (the kitty keyboard protocol, behind the
  Key releases Experiment, on by default), it says which presses are repeats and when a key is let go;
  where it does not, a press of the same arrow within the hold window (an Experiment, 200 ms) of the one
  before is a repeat, and anything slower a tap. The fast move — Shift and its fallbacks — is not a speed
  but a **jump of ten tiles**, the view following by the ordinary margin rather than re-centring; held,
  it jumps again at most every 100 ms, so each jump is seen to land. Timing lives in the input path
  (`src/build/motion.ts`); the reducer receives an ordinary `move-cursor` of the chosen size and stays a
  pure function of commands. The numbers are tuned values (`src/build/tuning.ts`); the tap windows and
  the three taps are the owner's. **Every list moves the same way** (canon 2.28, F75; 2.29, F79): no
  wrapping, a first tap one row, taps counted and holds at the same pace, clamped at the ends, and the
  fast move going to the first or last row.
- **A click scrolls the view the same way, armed or not** (feedback F6, gate 5H; armed since gate 5J,
  feedback F22, reversing Q58's still view). A click inside an edge zone (a third of the view to
  start) carries the clicked tile toward the middle in proportion to its depth: all the way to the
  middle at the very edge, not at all at the zone's inner boundary (Q62; the zone's depth is a tuned
  value, the owner's). With a structure armed, the preview follows the click, so
  the player can "keep clicking on the grid with the ghost building placement cursor to keep
  scrolling". **A double click places where its first click pointed**: two left clicks on the same
  screen cell within 400 ms (a tuned value) are one "here", even if the first scrolled the view. The
  input path reads the clicks' timing, as it reads keys', and sends the reducer an ordinary click on
  the first click's tile, so a driver script means the same thing. A slow second click on a spot the
  view moved away from is a fresh first click, never a placement on a tile nobody pointed at (Q50's
  finding).
- **Everything that moves is interpolated — the camera slides and the cursor glides** (gate 5H; the
  glide at gate 5J, owner: "interpolations are easy and powerful"). Every change of camera, however
  caused, eases over a few frames (100 ms, the owner's), and every cursor move glides from the tile it
  was drawn on (100 ms), whole tiles at a time, on the screen's frame timer, which runs only
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
[`open-questions.md`](../milestones/open-questions.md) Q15 has the measurement and the recommendation — real
pathfinding, Milestone 2's, is what actually closes this; the greedy floor was never meant to.

Terrain may modify movement cost. Immutable terrain cannot be attacked; only blockers explicitly
marked destructible enter targeting and damage.

There is **no fractional authoritative position**. Between-tile positions are something the renderer
invents for smoothness and the kernel never hears about.

---
