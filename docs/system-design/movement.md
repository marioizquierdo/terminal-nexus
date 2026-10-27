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
each distance since steps cost small whole numbers — or no further than the best walk already found when a unit only
compares walks — and it says at once, from the patch of ground a unit stands on, whether it can reach the goal at all.
A tick with 30 units costs about half a millisecond; with about 200 units and buildings in an eighth-round duel, about
5½ ms ([`scripts/profile-routes.ts`](../../scripts/profile-routes.ts) on the Crossing, Vasse against Averno with the
balanced player, seed 1, wall clock on a shared four-core machine, 2026-10-21, after the Nexus fought back and
breaching; 7 ms before the routes were tuned that day). The same script fingerprints every battle it plays, so a
change meant to make routes faster is proved to change no outcome.

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
6. **The march** (next section): every target set, who marches, and who of them yields its step to keep its place.
7. **Steps**: each walker ranks its steps on its field; arbitration settles them; credit is spent. A yielder takes no
   step of its own, and makes way for an ally held up behind it.

## 5. What a unit does by default: its states, and the army's march

The owner, 2026-10-21: "Is it possible we make that line the commander? or at least when the commander is in battle,
the other units can use that as reference. When the commander is not in battle, then a line from nexus to nexus", and
"rangers would defer to melee units while moving through the map so when they arrive at the enemy they are more or
less already prepared in formation ... Movement has many states and we should take advantage of that."

**A unit is always in one of six states**, worked out every tick from what it chose to do (`MoveState`,
`src/pulse/march.ts`); nothing about it is remembered from one tick to the next. These are what a unit does when
nobody tells it anything, which is always, until orders exist:

| State | When | What it does |
| --- | --- | --- |
| Leaving the roof | It stands on its own side's building: just trained, or a survivor of the last round standing on it | Walks to the nearest ground first, or along the roofs (the "Way off the roof" Experiment); also to make way for a wave its side owes |
| Marching | It walks for its side's goal: the level's target, or the enemy's Grid Nexus while that is beyond its engage reach (6 columns; 12 for a Commander who charges) | Walks its route, keeping its place in the formation |
| Yielding | A marcher further forward than its place this tick | Takes no step of its own; makes way for an ally held up behind it |
| Engaged | It walks to an enemy within its engage reach | Walks to where its attack reaches, as always; the formation no longer holds it |
| Standing | Its attack reaches its target, it is gathered at its side's target, or it has nothing to do | Fights or holds; it is a wall to everyone's routes |
| Fleeing | A worker with a threat near | Walks its flight map, away from every threat |

Only marchers keep the formation. A unit with no attack keeps no line, a flyer passes over the ranks, and a unit
still on its own roof keeps no place until it has stepped off.

**Progress.** Each side has one march field a tick: the walk, for a body of one tile, to its march goal over rock and
the enemy's buildings that stand; units are not walls to it, and the side's own buildings are open. A marcher's
progress is its walk on that field: smaller is further forward.

**Its line.** Each unit has a line in its army's formation (`ContentDef.line`; from its attack when the content does
not say):

| Line | Comes from | Its place behind the Commander | Waits for |
| --- | --- | --- | --- |
| Backliner | The content says so (the Ravel bomber; the bench's flanker) | Anywhere: never yields, never waited on | Nobody |
| Melee | A melee attack | Up to 2 columns ahead of her | Nobody but her |
| Short range | A heal, or a range up to 4 (Vasse, a slinger, a medic) | 4 columns behind her | Melee 4 columns ahead of it |
| Long range | A range over 4 (a marksman, the mortar) | 8 columns behind her | Melee 8 ahead, short range 4 ahead |

**The Commander is the guide.** While a side's Commander stands on the Grid she is its guide, and while she marches
herself no marcher but a backliner goes further forward than its line's place behind her. Once she fights or stands,
her army comes up to fight beside her.

**The band.** The guide line runs from her to the middle of the side's goal, or, without her, from the side's own
Nexus. A marcher more than 6 columns off it (a row counting two) takes, among its equally good steps, the one landing
nearest the line, before the turn and the draw. It never takes a longer way to stay in the band: the band gathers an
army spread across the map into a column along its way, and leaves one already in it alone.

**Formation lines.** A short- or long-range marcher yields while a marching ally of a line ahead of it, within 12
columns, is not 4 columns of progress ahead of it for each line between them: a marksman waits until a trooper is 8
ahead of it, and until a slinger is 4 ahead. Waiting goes only toward the front and the guide never waits, so no ring
of units can wait on itself.

**Closing.** The formation is for the way there. A marcher with any enemy within 12 columns of it yields no more, so a
shooter walks up into its range behind a front that has stopped to fight; that is where a line forms on its own, as
melee closes and guns stop at their reach.

**Yielding never jams a gap.** A yielder still counts as walking for the routes, so it is no wall. An ally of one tile
held up behind it swaps tiles with it — the ally forward, the yielder back — when both can pay and the yielder may
stand there; an ally too big to swap releases it, to take its own best step forward; on open ground an ally simply
steps round it. The log says when a yielder makes way (`march.made-way`), never for the ticks it waits.

**Backliners go beyond the enemy's line.** A backliner chooses first among the enemies within its reach that are not
in the melee line — a shooter, another backliner, a building that shoots — the nearest it can walk to; with none, it
chooses as every unit does. The bomber keeps its aim at the thickest crowd. **A backliner is a special unit, not an
army's mainstay**: the Ravel runner was one at first, and with every runner of Dob's army going beyond the line his front
was empty — his Nexus fell in round 1 or 2 in 20 of 24 rush duels, against 1 of the same 24 with the runner in the
melee line, where it now is.

**Fairness.** Everything is read from the state the tick began with, in whole numbers; the line is drawn alike from
either end of a map (a point exactly between two tiles takes both); two allies that would swap with one yielder are
drawn between. Shown by `march-lines`, `march-guide`, `march-narrow-gap` and `march-mirror` (`tests/march.test.ts`).

## 6. When the goal cannot be reached

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

## 7. Other ways of moving, on the same parts

Every way a unit moves is one of three things: **a new goal** for the same field machinery, **a different field**, or
**a move that is not a step**. Nothing below has a pathfinder of its own.

| Movement | What it is | Built |
| --- | --- | --- |
| Heading for the enemy Nexus | A goal: the Nexus | Yes |
| Heading for a level's target | A goal: the target's tiles | Yes |
| Leaving a roof | A goal: the nearest ground off its side's roofs, or its route along them (the "Way off the roof" Experiment) | Yes |
| Making way for a wave | The same goal, the nearest ground off its side's roofs, while a building of its side owes units it has no room for (`make-way.ts`) | Yes |
| Fleeing | A different field: the walk from every threat, turned into a "safety map" and walked downhill, so it runs from all threats into open ground, not into a corner | Yes (workers) |
| Pushed or pulled | Not a step: moved a tile at a time while its body fits, its credit untouched (`displace`) | Yes (the bulwark's Shove) |
| Going round burning ground | A weight: an anchor whose body covers a burning tile weighs four times its ground in the field, while it burns; a step's credit is the ground's own | Yes (the mortar's fire) |
| The raid's trail in the Build Phase | The same field, walked ahead of time over the plan | Yes |
| Marching in formation | The march field ranks who is ahead, the guide line breaks ties, a yielder takes no step (section 5) | Yes |
| Regrouping between rounds | A goal per unit, its slot in its side's formation across the march line, walked on the same fields beside the kernel's tick (`src/match/regroup.ts`) | Yes |
| Making room for a building | The walk to the nearest free ground off every building, pushing on whoever stands there in turn, as a round opens (`src/match/make-room.ts`) | Yes |

## 8. Where modifiers plug in

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
- **Ground that costs more** (mud, a power's slowing field): a *weight*. A step onto it costs more in credit and in
  the field, so routes go round it when that is quicker and cross it when it is not — scrub already works this way.
  Burning ground is built, as a weight in the field alone (section 7): a route goes round fire, and a unit that
  crosses it does so at its own pace.
- **Ground no one may cross** (a power's wall): a *wall* in the ground for the ticks it lasts.
- **Gathering before marching** (a beacon, the backlog's idea): a *goal* — the beacon's tiles — held until enough of
  the army stands there, then the next goal; a formation is where each unit stands round it.
- **Targeting that goes for a building first** (a siege unit, a breach-minded raider): a *perception* rule, which
  layers it prefers; the field toward that building is the same machinery.

## 9. What keeps it fair and the same everywhere

- **Pure**: built from the tick's state, never kept from one tick to the next, the same on Node and Bun.
- **Mirror-fair**: a tie between steps goes by facing, then by the seeded draw, so neither end of a map is favoured
  ([`pulse.md`](pulse.md), no side wins by where it stands).
- **Measured**: the route scenarios (`scenarios/route-*.map.json`) are each a shape a route must manage, played on
  several seeds; `node bin/measure.ts run` measures how long units stand blocked before and after a change
  ([`measurement.md`](measurement.md)).
