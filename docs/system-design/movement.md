# Terminal Nexus — how things move

_The pathfinding chapter: how a unit gets where it is going, in plain words, from its building blocks up, and where a
new way of moving plugs in. The rules themselves, each with its test, are in [`pulse.md`](pulse.md) (routes) and
[`grid.md`](grid.md) (distance, walking, setting a group down); this page explains how they fit together. Every
unmarked statement is GUIDANCE._

The owner, 2026-10-21: "a proper pathfinding chapter in the grid architecture that explains how things move ... in
simple terms that are actually efficient, because later we're going to have modifiers to that. There's going to be
units that step back, for example, to avoid damage. Other units will kind of teleport forward. So just defining the
basic building blocks for pathfinding will work."

## 1. In one paragraph

A unit decides **what** it wants (an enemy to strike, its side's target, the enemy Nexus), the tick works out **one
map of the way there** for everyone who wants the same thing, and each unit takes **one step downhill** on that map,
stepping round what is in its way. The map is a *distance field*: a number on every tile saying how far it is, walking,
to the goal. It is worked out once a tick and shared, so a hundred troopers heading for one Nexus cost one search, not
a hundred; and it is built from what stands on the Grid that tick, so a fallen building or a moved crowd is in the
next tick's map with nothing to keep up to date.

## 2. The general path, and the way round obstacles

The owner, 2026-10-21: "I do like the idea of having a general path that is resolved once from Nexus to Nexus, and then
the units do something similar to A+ [A*], but only to find their way through the general path, so they move in the
general direction and they can walk around obstacles when they find them."

**That is what is built**, with one difference in when the general path is worked out:

| His idea | What the game does |
| --- | --- |
| A general path from Nexus to Nexus, resolved once | A distance field toward each goal (the enemy Nexus, a target, an enemy), shared by every unit heading there: the general path, for every tile at once rather than one line |
| Resolved once a match | Worked out again every tick, from that tick's Grid, as far as it is asked (below): a building placed, a building fallen, a fight that stands still, are in it at once |
| Each unit finds its own way round obstacles along it | What stands still is a wall in the field, so the general path already goes round rock, buildings and a standing fight; a unit held up behind allies who are themselves stuck works out a field of its own that counts them as walls (the detour), which is the "local A\*" of his idea |

Why a field and not a path: a path is one line from one place; a field answers "which way from here?" for every tile,
so a unit pushed off its line, made mid-battle, or stepping round a friend never has to ask again. It is the "flow
field" of crowd games (Supreme Commander 2 made it known), and the "Dijkstra map" of roguelikes.

Why every tick and not once: the Grid changes under a battle — buildings fall, crowds form and break — and a field is
cheap. It is worked out lazily, from the goal outward, only as far as the furthest unit asking needs, with a bucket for
each distance since steps cost small whole numbers. A tick with 30 units costs under a millisecond; with 200 units in
an eighth-round duel about 14 ms ([the measurement](../history/reports/2026-10-20-pathfinding-measured.md), before the Nexus fought back and before breaching; not measured since).

## 3. The building blocks

Five parts, each small and tested alone (`src/routing/`, `tests/routing.test.ts`), then put together by the tick
(`src/pulse/routes.ts`, `src/pulse/intents.ts`).

**1. Ground: where a body may stand.** Rock, and everything that stands still this tick on a layer the body collides
with (a building, a unit fighting, a unit with nowhere to go), is a wall. A body bigger than one tile may stand where
every tile of it is free. A walker is not a wall: it will have moved by the time anyone gets there.

**2. Goal: where the walk ends.** Every place from which the unit's attack reaches its target — touching for a sword,
within range for a gun, measured as range is — or from which it stands inside its side's target. A route ends where an
attack begins, so the walk, the shot and the hold never disagree about "close enough".

**3. Distance field: how far, from everywhere.** From the goal outward, each tile gets the walk from it to the nearest
goal: one for a step across a column, two for a step up or down a row (a row is twice as tall on screen), times what
the ground weighs (scrub weighs two). Below, the numbers the code gives on a small map with a wall of rock (`#`) and the
goal at 0: a unit at the bottom left, 25 away, walks up and over the wall, never into it.

```
 17 16 15 14 13 12 11 10  9  8  9
 19 18 17 16  # 10  9  8  7  6  7
 21 20 19 18  #  8  7  6  5  4  5
 23 22 21 20  #  6  5  4  3  2  3
 25 24 23 22  #  4  3  2  1  0  1
```

**4. Step choice: which of four steps.** A unit ranks its four steps by the walk each leaves. Steps that are as good
go by how little each turns from the way the unit faces, then by a draw from the seeded stream — never by a compass
order, which would favour one side of the map.

**5. Arbitration: who steps where.** Every walker says where it wants to go; the tick settles who gets a tile two want
(the tick order, [`pulse.md`](pulse.md)), lets two allies who want each other's tiles swap, and spends each step's
movement credit, so a unit's speed and the ground's weight decide how often it steps.

## 4. A tick, in order

1. **Perception**: each unit picks what it wants, by distance (the nearest enemy, its side's target, the enemy Nexus).
2. **Who walks**: from those choices, who will move this tick (`purposeOf`). Everyone else stands, and is a wall.
3. **The tick's fields** (`TickRoutes`): ground and fields, worked out as asked and shared by everyone with the same
   body, the same walls and the same goal.
4. **Choosing again by what can be reached**: a sword fights the enemy nearest *to walk to*, not the nearest across a
   wall; a gun passes over a target it cannot get in range of for one it can.
5. **Walls of buildings are broken, walls of rock are not** (below).
6. **Steps**: each walker ranks its steps on its field; arbitration settles them; credit is spent.

## 5. When the goal cannot be reached

- **Rock closes the way**: the unit walks to the tiles it *can* reach that are nearest the goal, and stands there,
  saying so (`move.blocked`, no route). A body too wide for a gap stands before it.
- **The enemy's buildings close the way** (the owner, 2026-10-21: "if the enemy blocks the entrance with buildings,
  then the pathfinding should know the difference between rocks and buildings and should decide to target one of the
  buildings"): the tick works out a second field over the same ground with the enemy's buildings open, each step onto
  one weighing eight steps of open ground, so the way through the fewest buildings is taken. Walking it downhill, the
  first enemy building in the way is the unit's target; it breaks it, and the next tick's field walks through the gap
  it leaves (`TickRoutes.breachOf`, `scenarios/route-breach.map.json`). Rock is never broken; a unit that cannot
  strike a building walks as near as it can get.
- **Its own crowd is in the way**: it waits for a walker ahead, and walks round allies who are stuck (the detour).

## 6. Other ways of moving, on the same parts

Every way a unit moves is one of three things: **a new goal** for the same field machinery, **a different field**, or
**a move that is not a step**. Nothing below has a pathfinder of its own.

| Movement | What it is | Built |
| --- | --- | --- |
| Heading for the enemy Nexus | A goal: the Nexus | Yes |
| Heading for a level's target | A goal: the target's tiles | Yes |
| Leaving a roof | A goal: the nearest ground off its side's roofs, or its route along them (the "Way off the roof" Experiment) | Yes |
| Fleeing | A different field: the walk from every threat, turned into a "safety map" and walked downhill, so it runs from all threats into open ground, not into a corner | Yes (workers) |
| Pushed or pulled | Not a step: moved a tile at a time while its body fits, its credit untouched (`displace`) | Yes (the bulwark's Shove) |
| The raid's trail in the Build Phase | The same field, walked ahead of time over the plan | Yes |

## 7. Where modifiers plug in

The modifiers the owner named, and the ones the design already expects, each touch one building block. **IDEA**: none
is built; this is where each would go, so that adding one is small.

- **Stepping back to avoid damage** (kiting): a *purpose*. A ranged unit that has just fired, with its next shot some
  time away and a threat closing, walks its flight map uphill from that threat for the steps its cooldown allows, then
  turns back to its target. The flight map exists (fleeing workers use it); the new part is the moment it is chosen,
  in `purposeOf`, and the rule for when it stops.
- **Leaping forward** (a blink, a jump, a charge): *a move that is not a step*. The unit looks along its own field —
  the same one it would walk — up to its leap's length, and lands on the furthest tile there its body fits; it says so
  (`entity.leaped`), its credit is spent as the ability says, and it walks on from where it landed by the same field.
  Because the field already holds the way round rock, a leap never lands on the wrong side of a wall.
- **Faster or slower units**: not routing. Movement credit (a unit's rate and the ground's weight) decides how often a
  unit steps; an aura or a power that hastes changes the rate.
- **Ground that costs more** (burning ground, mud, a power's slowing field): a *weight*. A step onto it costs more in
  credit and in the field, so routes go round it when that is quicker and cross it when it is not — scrub already
  works this way.
- **Ground no one may cross** (a power's wall): a *wall* in the ground for the ticks it lasts.
- **Gathering before marching** (a beacon, the backlog's idea): a *goal* — the beacon's tiles — held until enough of
  the army stands there, then the next goal; a formation is where each unit stands round it.
- **Targeting that goes for a building first** (a siege unit, a breach-minded raider): a *perception* rule, which
  layers it prefers; the field toward that building is the same machinery.

## 8. What keeps it fair and the same everywhere

- **Pure**: built from the tick's state, never kept from one tick to the next, the same on Node and Bun.
- **Mirror-fair**: a tie between steps goes by facing, then by the seeded draw, so neither end of a map is favoured
  ([`pulse.md`](pulse.md), no side wins by where it stands).
- **Measured**: the route scenarios (`scenarios/route-*.map.json`) are each a shape a route must manage, played on
  several seeds; `node bin/measure.ts run` measures how long units stand blocked before and after a change
  ([`measurement.md`](measurement.md)).
