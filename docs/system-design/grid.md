# Terminal Nexus — the Grid

_The play surface: its size and shape, orientation, the viewport and scrolling, layers and collision masks, placement and footprints, distance and movement._

## 1. What the Grid is

The **Grid** is the rectangular integer playfield a match is fought on. The replica of a Nexus that
sits on it is a **Grid Nexus**; the one that stays home is a **Prime Nexus**. A Grid Nexus is a flag
on a content definition, never a content id the kernel recognises (RULE — `src/content/types.ts`,
the `nexus` field).

## 2. Size and shape

A Grid may be any integer size. Content and tools standardise on a small matrix of presets so that
maps, scenarios and compositions can be reasoned about without measuring each one. The matrix is
GUIDANCE: add, drop or rename a preset when content shows a better set.

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

**RULE — `src/scenario/presets.ts`, `tests/scenario.test.ts`: the default preset is `medium-extra-wide`
(48 × 16)** and the one every early fixture uses. It is locked because both compositions are derived
from it: at one column per tile it needs 48 + 2 border + 30 sidebar = **exactly 80 columns**, and at two
columns per tile **exactly 128**. Change 48 × 16 and the 80- and 128-column layouts stop falling out
of one number (the compositions are in [`presentation.md`](presentation.md)).

A preset is a convenience, not a constraint. A scenario may declare explicit dimensions.

**The vertical chrome budget in the Build Phase is 6 rows**: 2 border, a 2-row header (the top bar's
own line, and the rule that closes the Grid's top) and a 2-row footer (the rule that closes the Grid's
bottom, then one line of contextual help). **The floor measures against 8 rows** (RULE —
`tests/build-camera.test.ts`): the resize gate uses the old 8-row budget, so 16 + 8 = **24 rows** and
80 × 24 stays a literal floor, and the two rows the one-line footer saves go to the Grid: 18 rows of
Grid at 80 × 24. Whether 80 × 24 is a hard minimum, and how many rows belong to the frame, is still
an open question (Q12). It is the same arrangement as the side panel's shared divider column below.
`grid watch`'s own view, not built on the Build Phase's frame, uses 8 rows, split 3 and 3.

## 3. Orientation is a rendering choice — RULE

A Grid has no orientation. **Portrait and landscape are presentation transforms**, chosen by the
renderer to fit the display, and they change nothing about the Grid, the Pulse or any coordinate in
an event log. A tall narrow display may transpose a `wide` Grid and lose nothing.

Map authors never think about orientation. They design a Grid; the renderer decides how to show it.

## 4. Viewport, screen size and scrolling

A Grid may be larger than the screen. The **viewport** is the window onto it, measured in **tiles**.
**RULE — `tests/build-camera.test.ts`, `src/build/camera.ts`: it is clamped at both ends.**

| | Tiles | Why |
| --- | --- | --- |
| **Minimum viewport** | 48 × 16 | The default preset. Below this the game is not playable, and the renderer shows a resize gate |
| **Maximum viewport** | 72 × 24 | The largest Grid preset. Nobody sees more of the Grid than this, however large their monitor |

The maximum exists for **fairness and for bounded arithmetic**. A player on a huge display must not
be able to see meaningfully more of the Grid than a player on a laptop, and every layout, cursor and
scroll calculation gets a fixed upper bound to reason about. Terminal space beyond the maximum is
spent on centring and on a larger inspection panel, **never on more Grid**. Cropping the Grid to fit
without scrolling is not allowed: below the minimum the renderer gates, and it never silently hides
part of the Grid.

**Fitting, in order** (RULE — `tests/build-camera.test.ts`):

1. Subtract chrome from the terminal: a border, a header, a footer, and a 29-column side panel whose
   divider is the Grid's west side (below). The resize gate and the choice of tile width still measure
   against a 30-column panel, so 80 × 24 stays the floor and two columns per tile still starts at 128.
2. Choose tile width: 2 columns per tile if the terminal can show the viewport that way, otherwise 1
   (RULE, tile width is adaptive presentation, see [`presentation.md`](presentation.md); held by
   `tests/build-camera.test.ts`).
3. `viewport = min(availableTiles, maximumViewport, gridSize)`.
4. Gate when `availableTiles < min(minimumViewport, gridSize)` at one column per tile. **A Grid smaller
   than the minimum viewport needs only its own size**, so a small tutorial Grid is never gated on a
   terminal that can show all of it. Below that, show the resize gate and freeze presentation time.

Which gives these terminal sizes:

| | Tile width 1 | Tile width 2 |
| --- | --- | --- |
| Minimum viewport (48 × 16) | **80 × 24** | 128 × 24 |
| Maximum viewport (72 × 24) | 104 × 30 | 176 × 30 |

The minimum row is the resize gate's, which measures against the 8-row budget, so it is the floor at
both tile widths. The maximum row is where the Build Phase's actual 6-row chrome first shows 24 rows
of Grid.

**80 × 24 is the floor and the acceptance target.** Everything must work there.

### Scrolling

**RULE — `tests/build-camera.test.ts`: when the Grid is larger than the viewport, the camera scrolls.
There is no minimap.**

- The camera position is in tiles and is clamped so the viewport never leaves the Grid.
- **The cursor drives it.** Move the cursor within the **scroll margin** of a viewport edge and the
  camera follows. That is the whole interaction: no separate pan mode, no modifier keys, no second
  cursor. It works identically in the Build Phase and during a Pulse. The margin is a share of the
  view's width for the sides and of its height for the top and bottom, **30%** (GUIDANCE, a tuned value
  in `src/build/tuning.ts`; `--scroll-margin <percent>` sets it), rounded, and capped so an axis's two
  margins never meet (`tests/build-motion.test.ts`). That a margin exists, and that the cursor drives
  it, is the rule; the number is not. The exact speed tiers and timings are still tuned by feel (Q54).
- **The margin is a follow rule, not an invariant** (RULE — `tests/build-camera.test.ts`). It says
  where the camera must be relative to the cursor *when it can be*. At the Grid's own edge the camera
  has nowhere left to go, so the cursor legitimately reaches the edge of the screen, which is correct
  because there is no more Grid to reveal by scrolling further. "The margin holds wherever the camera
  can still scroll" is a checkable sentence where "the margin holds" is not.
- **The UI must show that there is more Grid.** Without a minimap the burden falls on **the weight of
  the Grid pane's own sides**: every side with more Grid beyond it reads differently from a side where
  the map ends (below). The footer carries no position readout; the sides carry the signal alone.
- Small Grids that fit entirely inside the viewport never scroll, and every side of their rectangle
  reads as the map's edge. Tutorials and opening missions should use them deliberately: `small` and
  `medium` presets fit the minimum viewport, so a new player meets the game without ever learning to
  scroll.
- **The Grid pane is a closed rectangle of its own** (RULE — `tests/build-edge.test.ts`). A line runs
  directly above the Grid's first visible row and directly below its last, and down both sides, never
  a line with a header or a footer between it and the Grid. Otherwise the player cannot tell where the
  Grid ends: whatever the sides say about scrolling, they would say it rows away from the edge they are
  about.
- **The edge marker is the weight of that rectangle's sides** (RULE — `tests/build-edge.test.ts`,
  `src/view/edge.ts`). A side with **more Grid to scroll to** is the frame's own line drawn dim (`-`,
  `|`); a side that has **reached the Grid's own edge** is drawn in **the map's own edge style**, named
  in the map's definition (a solid bar, an inverse-video cell, for a map that names none; a dashed fence
  for PERIMETER's stand-in map), in the quieter edge colour (`chrome.edge`), the same weight along the
  top and bottom as down the sides, in every glyph pack and in monochrome, with no colour needed to
  read it. A corner takes the edge wherever an edge side runs into it; a patterned edge is fixed to the
  map and scrolls with it. When the whole Grid fits, every side and all four corners are the edge at
  once: "this is the whole map". The frame's outer border and the rules where they cross the side panel
  never scroll, and stay plain. The style vocabulary a map may name is solid, half, heavy, double, shade
  and fence. A `[m] Map` popup that shows the whole Grid at once is a separate idea, not built
  (**IDEA**, an open question, Q59).
- **The side panel's divider is the Grid's west side** (RULE — `tests/build-edge.test.ts`,
  `src/build/layout.ts`). One column: a plain line beside the menu's own rows and rules, and a light or
  map-edge side beside the Grid's rows. The column goes to the Grid: 49 tiles at 80 × 24, while
  `FLOOR_PANEL_COLUMNS` in `src/build/camera.ts` keeps the floor measured against 30 columns.
- **A Grid shorter than the pane closes directly under its own last row** (RULE —
  `tests/build-edge.test.ts`). The Grid pane keeps the minimum viewport's 16 rows while the terminal
  has them, because the side panel is designed at that height (see [`presentation.md`](presentation.md)),
  and a shorter Grid sits at the top of it with its own bottom edge drawn across the Grid pane alone:
  the rectangle stays closed at the Grid's real edge, never at the pane's.
- **Taps are counted, a hold keeps its own pace, and the fast move jumps** (GUIDANCE; the timing is
  held by `tests/build-motion.test.ts`, the numbers are tuned values in `src/build/tuning.ts`). A tap
  moves one tile. Taps of the same arrow each within 400 ms of the one before are a run that keeps its
  speed; the third tap since the speed last changed, or since the run began, doubles it if it came
  within 300 ms of the tap before. So a run goes 1, 1, 2, then 2, 2, 4, and four is the top. A longer
  gap, another arrow or any other key starts over at one. A held key moves at the game's own pace
  rather than the operating system's repeat rate: at most one move every 60 ms (on average exactly that
  when the keyboard repeats faster), one tile a move, two once the key has repeated for 600 ms (first
  guesses). A hold ends a run of taps. Where the terminal reports key events (the kitty keyboard
  protocol, behind the Key releases Experiment, on by default), it says which presses are repeats and
  when a key is let go; where it does not, a press of the same arrow within the hold window (an
  Experiment, 200 ms) of the one before is a repeat, and anything slower a tap. The fast move (Shift
  and its fallbacks) is not a speed but a **jump of ten tiles**, the view following by the ordinary
  margin rather than re-centring; held, it jumps again at most every 100 ms, so each jump is seen to
  land. **RULE — `tests/build-motion.test.ts`: timing lives in the input path (`src/build/motion.ts`);
  the reducer receives an ordinary `move-cursor` of the chosen size and stays a pure function of
  commands.** Every list moves the same way: no wrapping, a first tap one row, taps counted and holds
  at the same pace, clamped at the ends, and the fast move going to the first or last row
  (`tests/build-lists.test.ts`).
- **A click scrolls the view the same way, armed or not** (RULE — `tests/build-motion.test.ts`). A
  click inside an edge zone (a third of the view to start; the depth is a tuned value) carries the
  clicked tile toward the middle in proportion to its depth: all the way to the middle at the very
  edge, not at all at the zone's inner boundary. With a structure armed, the preview follows the click,
  so the player can keep clicking on the Grid with the ghost building to keep scrolling. **A double
  click places where its first click pointed**: two left clicks on the same screen cell within 400 ms
  (a tuned value) are one "here", even if the first scrolled the view. The input path reads the clicks'
  timing, as it reads keys', and sends the reducer an ordinary click on the first click's tile, so a
  driver script means the same thing. A slow second click on a spot the view moved away from is a fresh
  first click, never a placement on a tile nobody pointed at.
- **Everything that moves is interpolated: the camera slides and the cursor glides** (RULE —
  `tests/build-motion.test.ts`). Every change of camera, however caused, eases over a few frames
  (100 ms), and every cursor move glides from the tile it was drawn on (100 ms), whole tiles at a time,
  on the screen's frame timer, which runs only while something animates. Both are **tweens** (see
  [`effects.md`](effects.md)): pure functions of time, and a move in the middle of another continues
  from wherever things are drawn. The cursor glides across the view, so it rides along when only the
  map scrolls and is never drawn outside it; the armed preview travels with it. Only a resize snaps,
  and reduced motion snaps both. State, commands and scripted playtests hold the destination; the mouse
  hit-tests the drawn camera, so a click lands on the tile under the pointer.

## 5. Layers and collision masks

### 5.1 Layers — RULE

**RULE — `src/grid/types.ts`, `tests/grid.test.ts`.** The Grid is not one plane of tiles. It is five,
stacked:

| # | Layer | Holds |
| --- | --- | --- |
| 1 | `terrain` | ground type, movement cost, buildability, resource deposits |
| 2 | `obstacles` | structures, walls, rubble, destructible and immutable blockers |
| 3 | `workers` | workers and other non-combat labour |
| 4 | `units` | ground combat units, the Commander |
| 5 | `air` | air units |

**What a layer is for, and this is the only hard rule: layers define render order.** Lower numbers
draw first, higher numbers draw over them (the bands are in [`presentation.md`](presentation.md)).
Beyond that, layers are how the game *organises its assets*, a way to say what kind of thing
something is. **Layers do not define collision.** That is a separate question, and it is a query.

### 5.2 Collision masks — RULE

**RULE — `src/grid/occupancy.ts`, `tests/grid.test.ts`.** Occupancy and blocking are computed by
composing layers into a **collision mask**, a per-tile boolean grid built from a chosen set of layers
and a predicate:

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
layer: not because of a rule about layers, but because of how their masks are composed. And a unit
still collides with a building on a different layer, because its mask includes `obstacles`. Both
follow from the same mechanism, and cross-layer collision is normal.

**Make masks cheap and make them explicit.** A unit definition declares which layers it collides with.
Nothing may compute occupancy by scanning entity lists in an inner loop, and nothing may assume a
layer's collision behaviour from its position in the render order.

How masks are held is also a rule (RULE — `src/grid/occupancy.ts`), because arbitration mutates
claimed tiles part-way through a tick and a naive once-per-tick cache is stale exactly when it
matters. **A mask is never materialised:**

- one occupancy index holds, per entity layer, one integer per tile, built when a tick begins and
  mutated in place when a move settles;
- a `CollisionMask` is a **lazy view** over that index: a layer list, a terrain rule, an ignore set.
  Constructing one is `O(1)` and allocates no grid, so composing a fresh mask per query is cheap
  enough that nothing is tempted to keep one;
- arbitration writes granted claims into an **overlay** on the same index, so a query made later in
  the same phase sees tiles claimed earlier in it (tick order is in [`pulse.md`](pulse.md)).

There is no window in which a mask can answer from stale data, because there is no copy to go stale.
The cost is one indexed lookup per layer per query. **The index itself is not free of scale, even
though the mask is**: it is sized to `width * height` per layer and rebuilt every tick, so it is the
one place cost is coupled to map area rather than actor count. The fuller cost assessment at hundreds
or thousands of units is in [`runtime.md`](runtime.md).

## 6. Placement, footprint, anchor and facing

**Coordinates** (RULE — `tests/scenario.test.ts`, `src/grid/coords.ts`). `(0,0)` is the Grid's
north-west tile; `x` grows **east**, `y` grows **south**. The direction `n` points toward `y - 1`. A
scenario file's terrain and placement rows are listed north to south, so the file reads the way the
Grid draws. Every module (kernel, loader, compositor) uses this one convention; it is the cheapest
possible source of mirror-image bugs.

Every entity on the Grid has a placement (RULE — `src/grid/types.ts`):

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

- **Entities occupy one tile or many, and both are normal** (RULE — `tests/grid.test.ts`). Many units
  are one tile. Structures usually are not: a Grid Nexus or a barracks covers several. **Large units
  exist and matter strategically**: a Ravel raider drawn `>x<` is one unit spanning three tiles, and
  the collision system handles it as such. Multi-tile is a first-class case, never a later extension.
  Write the footprint loop once, at the start, and every entity is the same code path.
- **A multi-tile mover tests its whole footprint** (RULE — `tests/grid.test.ts`). A step is legal only
  if every destination tile is clear in that entity's collision mask. Damage, targeting and
  destruction apply to the entity, not to a tile: a three-tile raider hit anywhere is one raider
  taking one hit.
- **The anchor is the entity's coordinate** and its centre of authority. Events report it, targeting
  ties break on it, presentation hangs badges and portraits off it, and it is what "where is that
  thing" means.
- **Range is measured to the nearest occupied tile** of the target's footprint, not to its anchor
  (RULE — `tests/grid.test.ts`). A large structure is easier to reach because it is large, which is
  the intuitive answer.
- **Facing is presentation-only for now** (RULE for now; whether it should ever affect rules is an open
  question, Q9). It is derived from the last movement step, or from the current target when
  stationary. Nothing in the rules reads it. It exists in state because a renderer that has to guess
  facing produces jitter, and because arcs may want it later. It is the one deliberate exception to
  "state carries nothing only presentation reads" (see [`grid-engine.md`](grid-engine.md)).

## 7. Distance and movement

**Four-way movement** (the compass points, never a diagonal), uniform cost per step, and **Manhattan
distance** (`|dx| + |dy|`) for range and routing (RULE — `src/grid/coords.ts`: `DIRECTIONS` and
`gridDistance`).

Diagonal movement was the single biggest legibility problem the first watch of the Pulse found: a
unit that can cut a corner is a unit whose next tile a viewer cannot predict, and a diagonal step
covers about 1.41 times the ground of an orthogonal one. Restricting movement to the compass points
makes every step read as "up", "down", "left" or "right", and Manhattan is its natural partner: it is
exactly the count of cardinal steps between two tiles, so "in range" and "reachable in that many
steps" mean the same thing.

The cost is a sharper version of a limitation the routing floor already had. Under Manhattan, every
legal step changes distance by exactly ±1; there is no step that merely holds distance level. An actor
approaching an obstacle off-axis still has two improving directions and can slide along the
obstacle's face; an actor approaching exactly on-axis with its goal has exactly one, and if a wall
takes it there is no fallback at all. What a mover with no route should do is an open question (Q15 in
[`open-questions.md`](../milestones/open-questions.md), with the measurement and the recommendation);
real pathfinding is what closes it, and the greedy floor was never meant to.

Terrain may modify movement cost. Immutable terrain cannot be attacked; only blockers explicitly
marked destructible enter targeting and damage.

There is **no fractional authoritative position** (RULE — `src/grid/types.ts`). Between-tile
positions are something the renderer invents for smoothness and the kernel never hears about. The
integer movement credit that spaces steps in time is in [`pulse.md`](pulse.md).
