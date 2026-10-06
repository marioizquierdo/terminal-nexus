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

**Shape** is the ratio of width to height in tiles. A tile is twice as tall as it is wide (section 7), so on screen,
and by the rules' own distance, a `wide` Grid is as wide as it is tall and a `squared` one twice as tall as it is
wide:

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
(48 × 16)** and the one every early scenario uses. It is locked because the floor is derived from it: a
tile is one column ([`presentation.md`](presentation.md)), so 48 tiles + 2 border + a 30-column side panel =
**exactly 80 columns**, and 16 rows of Grid within the 8-row chrome budget below = **exactly 24 rows**. Change
48 × 16 and the 80 × 24 floor stops falling out of one number.

A preset is a convenience, not a constraint. A scenario may declare explicit dimensions.

**The vertical chrome budget in the Build Phase is 6 rows**: 2 border, a 2-row header (the top bar's
own line, and the rule that closes the Grid's top) and a 2-row footer (the rule that closes the Grid's
bottom, then one line of contextual help). **The floor measures against 8 rows** (RULE —
`tests/build-camera.test.ts`): the resize gate uses the old 8-row budget, so 16 + 8 = **24 rows** and
80 × 24 stays a literal floor, and the two rows the one-line footer saves go to the Grid: 18 rows of
Grid at 80 × 24. Whether 80 × 24 is a hard minimum, and how many rows belong to the frame, is still
settled (Q12, answered). It is the same arrangement as the side panel's shared divider column below.
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

The clamp is a range, not a size: a terminal shows however many tiles fit between the two ends. An
80 × 24 terminal shows 49 × 18 tiles, one point inside the range (the floor guarantees at least
48 × 16, and the shared divider column and the one-line footer give it a little more).

The maximum exists for **fairness and for bounded arithmetic**. A player on a huge display must not
be able to see meaningfully more of the Grid than a player on a laptop, and every layout, cursor and
scroll calculation gets a fixed upper bound to reason about. Terminal space beyond the maximum is
spent on centring and on a larger inspection panel, **never on more Grid**. Cropping the Grid to fit
without scrolling is not allowed: below the minimum the renderer gates, and it never silently hides
part of the Grid.

**Fitting, in order** (RULE — `tests/build-camera.test.ts`):

1. Subtract chrome from the terminal: a border, a header, a footer, and a 29-column side panel whose
   divider is the Grid's west side (below). What is left is the tiles the terminal has room for, a tile
   to a column ([`presentation.md`](presentation.md)).
2. `viewport = min(availableTiles, maximumViewport, gridSize)`.
3. Gate when `availableTiles < min(minimumViewport, gridSize)`, measured against the floor's own 30-column
   panel and 8-row budget, so 80 × 24 stays the floor. **A Grid smaller than the minimum viewport needs only
   its own size**, so a small tutorial Grid is never gated on a terminal that can show all of it. Below that,
   show the resize gate and freeze presentation time.

Which gives these terminal sizes:

| | Terminal |
| --- | --- |
| Minimum viewport (48 × 16) | **80 × 24** |
| Maximum viewport (72 × 24) | 103 × 30 |

The minimum row is the resize gate's, which measures against the floor's 30-column panel and 8-row
budget. The maximum row is where the Build Phase's actual 29-column panel and 6-row chrome first show
72 × 24 tiles: 72 + 2 + 29 = 103 columns and 24 + 6 = 30 rows. The shots and the camera test use 104 × 30,
one column past it. Any terminal larger than that buys margin, never more Grid and never a wider tile: at
128 columns the view is still 72 tiles, centred.

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
  it, is the rule; the number is not. The exact speed tiers and timings were settled by tap counting and a hold pace (Q54, answered).
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
  for the starter map), in the quieter edge colour (`chrome.edge`), the same weight along the
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
  (RULE — `tests/grid.test.ts`), in the distance section 7 describes. A large structure is easier to reach
  because it is large, which is the intuitive answer.
- **Facing is presentation-only for now** (RULE for now; whether it should ever affect rules is an open
  question, Q9, answered as no). It is derived from the last movement step, or from the current target when
  stationary. Nothing in the rules reads it. It exists in state because a renderer that has to guess
  facing produces jitter, and because arcs may want it later. It is the one deliberate exception to
  "state carries nothing only presentation reads" (see [`grid-engine.md`](grid-engine.md)).

## 7. Distance, reach and movement

The Grid's geometry fits in one sentence: **a unit stands two squares tall.** A terminal cell is about twice as tall
as it is wide, and a tile is one cell. Cut every tile across its middle and the ground is a grid of squares, each a
column wide and half a row tall, so every tile is two squares, one above the other. How far is far, what a reach
covers, how long a walk takes, what touching means and why a squad fights wider than it fights deep all follow
from that. The marked pictures below are drawn by the game's own code (`scripts/grid-pictures.ts`), and
`tests/grid-pictures.test.ts` fails if one stops being what the game does.

### 7.1 A row counts two columns

**Distance is counted on the squares, the four ways a unit walks** (RULE — `gridDistance` and `ROW_DISTANCE`,
`src/grid/coords.ts`; `tests/rows.test.ts`). A tile across is one square away, and a tile up or down is two:

```text
distance = columns across + 2 × rows up or down
```

Every tile's distance from a unit at `T`:

<!-- grid-picture: distance -->
```text
876545678
654323456
4321T1234
654323456
876545678
```

Read it the way the screen shows it, not as a table: each number stands about that many columns from `T`,
whichever way it lies. The 4 that stands four columns to the right and the 4 that stands two rows up are the same
length from `T` on screen, because a row is as tall as two columns are wide, so equal numbers ring `T` as wide as
they are tall. Every range, reach and
radius in the game is this distance, measured between the nearest tiles of two footprints (section 6), and every
distance is worked out by the functions in `src/grid/coords.ts` and `src/grid/reach.ts`, never by hand.

**Touching is a side shared** (RULE — `gridSteps`, `footprintSteps`): beside, or straight above or below. It asks
whether two bodies meet, not how far apart their middles are, so it is the one count in which a row is one step,
the same as a column. Each letter on the right is one square:

```text
                on screen      on the squares

side by side       rt               rt
                                    rt

one above          r                r
the other          t                r
                                    t
                                    t
```

Side by side, two tall bodies meet along their long sides, their middles one square apart. One above the other,
they meet end to end, their middles two squares apart. Both touch: **melee reaches what touches it**, a unit stands
beside what it touches, and two units meeting at a corner do not touch.

### 7.2 A reach is a diamond that looks round

**Within a reach of R** is every tile at distance R or less; **a reach of 1 is touching**, the tiles beside and the
tiles straight above and below, and every longer reach covers what touches too (RULE — `footprintWithin`,
`tilesWithin` in `src/grid/reach.ts`):

<!-- grid-picture: reaches -->
```text
                                            .
                            .             .....
   .           .          .....         .........
  .T.        ..T..      ....T....     ......T......
   .           .          .....         .........
                            .             .....
                                            .

reach 1     reach 2      reach 4         reach 6
5 tiles     7 tiles     21 tiles        43 tiles
```

In tiles, a reach is a diamond twice as wide as it is tall. Every row is two squares tall, so on screen the same
diamond is as tall as it is wide: a square standing on one corner, and for an even reach exactly R columns from
its middle to each of its four points. Every reach the game draws is made of it (a Turret's round its ghost, a marksman's when explored, Vasse's
aura, the build range's dotted ground), and a card says it in words: "6 across, 3 up/down" (`reachShape`; the
cards in [`ui-patterns.md`](ui-patterns.md)).

**The arithmetic is tidy** (RULE — `tests/grid-pictures.test.ts`). The tiles exactly r away form a ring of exactly
2r tiles, whatever r is: an odd ring crosses r rows with a tile at each end of every one, and an even ring crosses
r + 1 rows, with a single tile at its top and its bottom. So a reach of R, from 2 up, holds 1 + 2 + 4 + 6 + … + 2R
= **R² + R + 1** tiles: 7 for a reach of 2, 21 for 4, 43 for 6. A reach of 1 holds the five of touching: its own
tile, the two beside and the two straight above and below.

**Reaches are whole rows** (RULE for the content — `tests/rows.test.ts`). A reach of R covers R ÷ 2 rows up and
down, rounded down (`rowsWithin`): a reach of 4 and a reach of 5 cover the same two rows, and the fifth point buys
only a column at each end of each row.

<!-- grid-picture: whole-rows -->
```text
        .                        ...
      .....                    .......
    ....T....                .....T.....
      .....                    .......
        .                        ...

     reach 4                   reach 5
2 rows up and down        2 rows up and down
```

An even reach ends on a single tile at its top and bottom, so its last point is a whole row. Every reach the content
and the Experiments offer is even, except 1, which means touching, and a reach the rules work out from them — the
reach a unit turns to fight within, a worker's flight from its attacker (the attacker's range and two more) — is
rounded up to whole rows (`wholeRows`): a worker runs from a melee attacker within 4.

**A diamond, not a circle.** Units walk the four ways and a step takes as long as the distance it covers (7.3), so
the tiles a unit can reach in a given time form exactly this diamond: every tile on its edge is the same walk away,
straight along a row or round a corner. A circle would promise reach along the diagonals that no walk delivers in
the same time. With a diamond, "in range" and "can get there in that time" are one question.

### 7.3 Walking: a row takes two beats

**Four-way movement**: the compass points, never a diagonal (RULE — `DIRECTIONS`). Every step reads as up, down,
left or right, so a viewer can always say where a unit goes next.

**A step takes as long as the distance it covers** (RULE — `stepLength`, and `stepCost` in
`src/pulse/movement.ts`; `tests/rows.test.ts`): a unit's **beat** is the whole number of ticks its step across
takes, and a step up or down takes exactly two beats. The integer movement credit that spaces the steps in time is
in [`pulse.md`](pulse.md). So walking time is distance for every unit, and on screen every unit crosses the same
ground per second whichever way it walks. Two troopers set off on the same tick, one eight
columns across and one four rows down:

<!-- grid-picture: walking -->
```text
t>>>>>>>X    8 columns across: there at 2.7 s

t
v
v
v
X            4 rows down: there at 2.7 s
```

**A walk to a corner is a staircase along the screen's own diagonal** (RULE — `directionOf` and `rankedSteps`).
Every step toward a goal gains distance in proportion to the time it takes, so no step is better than another by
pace alone, and the way straight at the goal decides: a mover steps along whichever way has more columns left, a
row counting two. It walks two columns across for every row down, and two columns by one row is the screen's 45°:

<!-- grid-picture: stairs -->
```text
t>
 v>>
   v>>
     v>>
       vX
```

The staircase takes exactly as long as the L along its two sides, which is why every tile on a reach's edge is the
same walk away.

**A shot is drawn flying at one speed on screen**: its flight lasts the distance over the shot's speed, rounded up
(`flightWindowTicks`, [`pulse.md`](pulse.md)), so a shot two rows up lands when one four columns across does.

### 7.4 Formations: more fit side by side

A tile holds one unit and tiles are tall, so a squad that looks square on screen is twice as wide in tiles as it is
deep, and it meets twice as many enemies facing up or down as facing sideways:

```text
the same two squads, eight units each

facing up and down      facing sideways
       rrrr                rrrrtttt
       rrrr                rrrrtttt
       tttt
       tttt
  four pairs touch       two pairs touch
```

Fronts across the screen are wide and their fights go fast; fronts down the screen are narrow and last longer.
What stays the same whichever way a squad faces: it holds as many units for its area on screen; a gap of one width
on screen lets troops through at one rate, four abreast at half the pace going down or two abreast at the full pace
going across; and every unit crosses the same ground per second. The Controls page says it in one line: units stand
tall, so more fit side by side than one behind another.

**IDEA — a sparse formation** (the owner's, for the step after this one): units prefer a free column beside them,
and not to stand straight above or below another, so a group spreads into a staggered grid whose fronts are nearer
even both ways. A preference, never a block: a unit behind waits a beat for the one ahead to move on, and the space
between can still be taken.

```text
 t t t . . t
t t t t . . t
```

**IDEA, held in reserve — square bodies**: every unit two columns wide, a footprint of two tiles across, would make
fronts match both ways, at the cost of two-character art for every unit and half as many units across.

### 7.5 Setting a group down

**A group set down round a point fills the rings of the Grid's own distance**, nearest first and in reading order
within a ring (RULE — `nearestFit` in `src/match/placement.ts`, `ringOffsets`; `tests/match.test.ts`), so it comes
out round on screen. The opening's musters, the forecast of them, a mission's arrivals and Recall's regrouping all
search the same rings. The first thirteen places, `a` first:

<!-- grid-picture: rings -->
```text
  hdi
jebacfk
  lgm
```

### 7.6 Where greedy steps stop

Every four-way step changes the distance to a goal, by one across or two up or down; no step merely holds it level.
An actor approaching an obstacle off-axis still has two improving directions and can slide along the obstacle's
face; an actor exactly on-axis with its goal has one, and if a wall takes it there is no fallback at all. What a
mover with no route should do is an open question (Q15 in [`open-questions.md`](../milestones/open-questions.md),
with the measurement and the recommendation); real pathfinding is what closes it, and greedy steps were never
meant to.

### 7.7 Terrain and positions

Terrain may modify movement cost. Immutable terrain cannot be attacked; only blockers explicitly marked
destructible enter targeting and damage.

There is **no fractional authoritative position** (RULE — `src/grid/types.ts`). A unit stands on a whole tile, both
its squares at once; between-tile positions are something the renderer invents for smoothness and the kernel never
hears about.
