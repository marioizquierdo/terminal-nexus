# Terminal Nexus — troop movement

_How troops move during a Battle Round, and why: first what a player should be able to predict from the Build Phase,
then the machinery underneath. The rules themselves, each with its test, are in [`pulse.md`](pulse.md) (routes, a
side's target, the march) and [`grid.md`](grid.md) (distance, walking, setting a group down); this page explains how
they fit together. Every unmarked statement is GUIDANCE; what is not built is marked IDEA._

The owner, 2026-10-26: "in this game 'pathfinding' is more than just moving, it is 'troops movement' ... building
placement is both defensive and offensive. Defensive because it disrupts the enemy path-finding towards the nexus or
valuable resources. Offensive because it initiates the troop formation which makes the troops more efficient ... Units
should be smart enough, smooth, but even more important, predictable."

The owner, 2026-10-21: "a proper pathfinding chapter in the grid architecture that explains how things move ... in
simple terms that are actually efficient, because later we're going to have modifiers to that."

The review that reshaped this page, with the games it borrows from and what to change next, is
[`2026-10-26-troop-movement-review.md`](../history/reports/2026-10-26-troop-movement-review.md).

## What a player should be able to predict

**The test of this design is whether a player can say what their troops will do before pressing Start.** Everything
below adds up to seven rules, and a player who knows them can plan a Build Phase:

1. **Troops only move in a Battle Round.** In the Build Phase they stand where the last round left them, on their
   buildings' roofs.
2. **The army marches on the enemy's Grid Nexus** (or on the level's target), by the shortest walk round rock and
   buildings.
3. **The Commander leads.** No one but a flanker walks ahead of her; melee walks beside her, short range 4 columns
   behind, long range 8 behind.
4. **A troop fights anything that comes within 6 columns of it** (3 rows), building or unit, and the nearest first.
5. **It walks until its attack reaches, then it stands and fights**, and a standing fight is a wall the others walk
   round.
6. **Buildings are walked round, never through**, until there is no way round: then the troops break the fewest
   buildings in the way. Rock is never broken.
7. **Workers never fight**: they run from anything that can hit them.

Rules 4 and 6 are why building placement is the game: a building within 6 columns of the enemy's way pulls its troops
off the march to fight there, and a line of buildings bends the way they walk or, sealed, chooses where they break
through. Production placement is the offensive half: a building's wave comes out 5 seconds into the round, about
when the armies first meet, so where the building stands decides how soon its wave joins the fight, and a building
near the front reinforces sooner and is razed sooner.

## Build Phase and Battle Round — the will of the Nexus

RULE ([`pulse.md`](pulse.md), match structure). **In the Build Phase nothing moves.** Troops stand, idle, where Recall
set them down; the player plans. **In the Battle Round nothing waits for the player**: every unit moves and fights by
the rules on this page, and the same plan, map and seed give the same battle every time.

At the end of a Battle Round **Recall** sends every survivor home: onto the roof of the building that trained it, as
near the tile it came out on as there is room, keeping room for one wave; a Commander or a unit with no building goes
beside the Grid Nexus. So **every round starts from the base**, from positions the player can see in the Build Phase,
and the movement of a round never depends on where the last fight happened to end. Nothing about a unit's movement is
remembered from one tick to the next either: what it does is worked out fresh every tick from what stands on the Grid.

## The enemy Nexus — where an army goes

RULE (`headsForNexus`, `src/pulse/perception.ts`; a side's target, `src/pulse/target.ts`). **An army's goal is the
enemy's Grid Nexus.** A level may name a target instead (a region the side heads for and holds), and a duel's side may
**hold** in front of its own Nexus (the duel's stance, `src/duel/`); the Build Phase of a run has no stance yet, so a
run's troops always attack.

**How the way is found.** The game does not draw one path from Nexus to Nexus. It works out a **distance field**: a
number on every tile saying how far it is, walking, to the goal, shared by every unit going there. A unit takes the
step that leaves the shortest walk, so it goes round rock, buildings and standing fights by construction, and one
pushed off its way, trained mid-battle or stepping round a friend never has to ask again. The field is worked out
again every tick from that tick's Grid, so a building falling or a fight forming is in the next tick's way at once.

**The guide line.** What the army keeps to, where several ways are equally short, is a line from its Commander to the
goal (from its own Nexus when she is not on the Grid). A marcher more than 6 columns off it takes, among equally good
steps, the one nearest the line. It never takes a longer way to stay near it: it gathers an army spread across the map
into a column, and leaves one already in it alone. Today the line is straight, through rock if rock is in the way;
**IDEA**: the line becomes the **march route**, the field walked downhill from the Commander or the Nexus, and both
sides' march routes are drawn on the Build Phase, redrawn as a building is placed (an open question; the review).

**When the way is closed.**

- **By rock**: the unit walks to the tiles it *can* reach nearest the goal and stands there, saying so (`move.blocked`,
  no route). A body too wide for a gap stands before it.
- **By the enemy's buildings** (the owner, 2026-10-21: "the pathfinding should know the difference between rocks and
  buildings and should decide to target one of the buildings"): when nothing can be walked to, a second field is worked
  out with the enemy's buildings open, each step onto one weighing eight steps of open ground, so the way through the
  fewest buildings is taken. The first enemy building on it is the unit's target; it breaks it, and the next tick's
  field walks the gap (`TickRoutes.breachOf`, `scenarios/route-breach.map.json`). A unit that cannot strike a building
  walks as near as it can get.
- **By its own crowd**: it waits for a walker ahead, and walks round allies who are stuck (the detour).

## Banners — IDEA

The owner, 2026-10-26: "placing a checkpoint in the map in offensive or defensive mode that units prioritize. The
default location is the enemy nexus in offensive mode ... I also want to experiment with a secondary 'skirmish' banner
that could be used from some buildings to send spawned troops to a different location. The commander always follows
the primary banner." Earlier (2026-10-20): set in the Build Phase, as part of the plan, "when we can prove there is a
good plan for it" on screen.

**None of this is built.** It is designed to be one more goal for the same machinery, so that building it is small:

| Banner | What the troops do | What it is, in the machinery |
| --- | --- | --- |
| No banner | March on the enemy Nexus | As today: the default is an attack banner on the enemy Nexus |
| **Primary, attack** | March to the banner, then on to the enemy Nexus; fight what comes within reach on the way | A waypoint: a marcher heads for the banner until it stands as near the enemy Nexus as the banner does, by the march field, then for the Nexus. Nothing is remembered: a unit already past the banner, or trained beyond it, never turns back |
| **Primary, hold** | Gather at the banner and hold it; fight what comes within reach; come back to it after | A side's target, as a campaign level's is (built): fill it, stand, fight within the engage reach |
| **Skirmish** (a building's) | That building's waves follow its own banner, attack or hold, instead of the primary | The same two rules, with the goal read from the unit's building (`EntityState.home`) rather than its side |

**The Commander always follows the primary banner**, so the primary also moves the guide line, and with it the whole
army's formation. Skirmish waves keep no place behind her: they march as an army without a Commander does, guided from
their own building.

**How it should be staged**, each stage behind the "Banners" Experiment until it is settled: first the duel's stance
brought into a run's Build Phase (attack, or hold in front of the Nexus: one key, no placement); then a primary banner
placed on the map; then skirmish banners, if the primary proved readable. The open question is in the register; the
review explains the order.

## Troop spawning

RULE (`src/pulse/spawn.ts`, `src/pulse/production.ts`, `src/pulse/make-way.ts`). **A building that trains sends one
wave a round**, a few seconds into the Battle Round (5 seconds, a tuned setting): a Barracks four troopers, a Den five
runners. The wave comes out **on the building's own roof**, on the tiles nearest where the side is heading, so a
base's units come out on the side facing the fight, east or west alike.

**Off the roof.** A unit standing on its own side's roofs walks the roofs toward the enemy and steps down where its way
goes (the "Way off the roof" Experiment: `route`, the default, or `nearest`, stepping down at once). Survivors of the
last round start the round there too.

**A wave with no room waits.** If the roof is full, the building owes the rest of its wave and sets each unit down the
first tick there is room; meanwhile anything standing idle on its side's roofs **makes way**, walking to the nearest
ground off them. A unit in the middle of its windup fires first. A wave the army's supply holds back moves nobody.

**Then it marches**, and takes its place in the formation from its first step off the roof.

## Troop formation

RULE (`src/pulse/march.ts`, `tests/march.test.ts`). The owner, 2026-10-21: "rangers would defer to melee units while
moving through the map so when they arrive at the enemy they are more or less already prepared in formation ...
Movement has many states and we should take advantage of that."

**A unit is always in one of six states**, worked out every tick from what it chose to do (`MoveState`):

| State | When | What it does |
| --- | --- | --- |
| Leaving the roof | It stands on its own side's building: just trained, or home from the last round | Walks off the roofs as the "Way off the roof" Experiment says; also to make way for a wave its side owes |
| Marching | It walks for its side's goal: the level's target, or the enemy's Grid Nexus while that is beyond its engage reach | Walks its route, keeping its place in the formation |
| Yielding | A marcher further forward than its place this tick | Takes no step of its own; makes way for an ally held up behind it |
| Engaged | An enemy came within its engage reach | Walks to where its attack reaches; the formation no longer holds it |
| Standing | Its attack reaches its target, it is gathered at its side's target, or it has nothing to do | Fights or holds; it is a wall to everyone's routes |
| Fleeing | A worker with a threat near | Walks its flight map, away from every threat |

**Its line.** Each unit has a line (`ContentDef.line`; from its attack when the content does not say):

| Line | Comes from | Its place behind the Commander | Waits for |
| --- | --- | --- | --- |
| Melee | A melee attack | Up to 2 columns ahead of her | Nobody but her |
| Short range | A heal, or a range up to 4 (Vasse, a slinger, a medic) | 4 columns behind her | Melee 4 columns ahead of it |
| Long range | A range over 4 (a marksman, the mortar) | 8 columns behind her | Melee 8 ahead, short range 4 ahead |
| Backliner | The content says so (the Ravel bomber; the bench's flanker) | Anywhere: never yields, never waited on | Nobody |

"Backliner" is the code's word for a unit that goes for what stands behind the enemy's front; the player's word should
say that it *goes behind*, and "flanker" is the recommendation (an open question). This page says flanker where it
speaks to a player.

**The Commander is the guide.** While she marches, no marcher but a flanker goes further forward than its line's
place behind her; once she fights or stands, her army comes up to fight beside her. She is also the muster for what
stands when the round opens: she starts beside the Nexus, so survivors on roofs ahead of her wait for her to come
level. **The round's waves are reinforcements, not part of that column**: they come out 5 seconds in, on their
buildings' roofs, and on the Crossing the first clash comes at a median of 5.7 seconds (62 attack rounds of 24
scripted duels, 2026-10-26), so a wave walks up to a fight already going, sooner the nearer the front its building stands. Without
her (she fell this round, or sits a round out) the lines still order themselves on each other, and the guide line
runs from the Nexus.

**Progress.** "Ahead" is measured on one march field a side: the walk, for a body of one tile, to the march goal over
rock and the enemy's standing buildings (units ignored, its own buildings open). Smaller is further forward.

**Formation lines.** A short- or long-range marcher yields while a marching ally of a line ahead of it, within 12
columns, is not 4 columns of progress ahead of it for each line between them: a marksman waits until a trooper is 8
ahead of it, and until a slinger is 4 ahead. Waiting goes only toward the front and the guide never waits, so no ring
of units can wait on itself.

**What it looks like** (`scenarios/march-lines.map.json`, watched tick by tick on 2026-10-26): the marksmen and the
mortar, set down ahead of the troopers, stand still for two to three seconds while the troopers pass them, then all
walk in step, the troopers in front, the marksmen 8 to 9 columns behind, the mortar behind them. Shooters do not
stutter, because a marksman and a trooper step at the same pace; a line faster than the line ahead of it would stop
and go, one step in every few.

**Closing.** The formation is for the way there. A marcher with any enemy within 12 columns of it yields no more, so a
shooter walks up into its range behind a front that has stopped to fight; that is where the line forms on its own, as
melee closes and guns stop at their reach.

**Yielding never jams a gap.** A yielder still counts as walking for the routes, so it is no wall. An ally of one tile
held up behind it swaps tiles with it; an ally too big to swap releases it to take its own best step forward; on open
ground an ally simply steps round it. The log says when a yielder makes way (`march.made-way`), never for the ticks it
waits.

**Flankers go behind the enemy's line.** A flanker chooses first among the enemies within its reach that are not in
the melee line — a shooter, another flanker, a building that shoots — the nearest it can walk to; with none, it
chooses as every unit does. The bomber keeps its aim at the thickest crowd. **A flanker is a special unit, not an
army's mainstay**: with every runner of Dob's army a flanker his front was empty, and his Nexus fell in round 1 or 2
in 20 of 24 rush duels, against 1 of the same 24 with the runner in the melee line, where it now is.

## Targeting and attacking

RULE (`src/pulse/perception.ts`, `src/pulse/attacks.ts`, `tests/heading.test.ts`).

**From marching to fighting.** A marching unit turns to fight an enemy that comes within its **engage reach**: 6
columns across, 3 rows up or down, measured from its body as range is — 12 for a Commander who charges (Averno), or its
own attack's range when that is longer. **Buildings count**: anything of the enemy's in reach is a candidate, a Barracks
as much as a trooper, unless the unit's content narrows what it strikes (`targetLayers`: the mortar and the bomber
strike only units and workers; the Nexus's own guns units, workers and flyers). The enemy Nexus is always a candidate, wherever it is, so a unit with nothing in reach
walks on to it.

**Choosing a target.** Among its candidates, **the nearest**; among equally near ones, the one it already holds, then
the one closest to falling (least health), so a squad that meets a line fires into the same enemy; then a seeded draw.
Never a reading order, which would favour a side by where it stands. Three refinements, all from what a unit is for:

- **A melee unit fights the nearest to walk to**, not the nearest across a wall; heading for its goal, it turns only to
  an enemy it could walk to within its engage reach.
- **A gun keeps the nearest by range**, shooting over rock, but passes over an enemy it cannot get in range of for the
  nearest it can.
- **A unit that aims at a crowd** (the bomber, the mortar) first narrows to the enemies with the most of their side round
  them; a flanker first to the enemies behind the melee line; a healer chooses among wounded allies instead.

**It chooses again every tick.** A unit keeps its target only while nothing is strictly nearer, so a marksman shooting
a trooper at 6 turns to a runner that comes to 5. A melee unit touching its target is rarely pulled off it, since
little can be nearer than touching; a gun is pulled off its target by anything that walks closer. **IDEA**: lock-on, where a unit that has begun attacking keeps its target until it falls or
leaves reach (an open question; the review).

**Moving in battle.** An engaged unit walks to where its attack reaches its target, and its route ends exactly there:
touching for a sword, within range for a gun, so the walk, the shot and the hold never disagree about "close enough".
**A unit that fights stands**, and a standing unit is a wall to everyone's routes, so a crowd round one target spreads
to the tiles still free round it, and the next ones walk round the fight rather than queue behind it. A ranged unit
stops at its reach and fires over the front.

**The Nexus fights back**: one shot every three seconds, 40 damage, at a marksman's reach of 6, at units, workers and
flyers.

## Workers

The worker economy is Milestone 7 ([`milestone-07-worker-economy.md`](../milestones/milestone-07-worker-economy.md));
today a worker only runs.

**What is built** (RULE — `src/pulse/routes.ts`, `tests/route-scenarios.test.ts`, [`grid.md`](grid.md), collision
masks):

- **A worker never fights** and follows no target or banner. It keeps to no line.
- **It runs from any threat that comes within that threat's range and two more** (a trooper's touch: 4 columns, 2
  rows), and from all of them at once, by its **flight map**: the walk from every enemy that can strike, scaled and
  worked out again from every tile, walked downhill, so it runs toward open ground rather than into a corner (the
  roguelikes' "safety map"; `worker-flight-between`).
- **It walks through its own side's troops, and not the enemy's**; a trooper the same through its own workers.
- **Enemy troops strike workers** as they strike anything else in reach: a raid on the workers is a real plan.

**What is planned**, as GUIDANCE for Milestone 7, in the same machinery:

- **A worker walks to the nearest free job**, by the walk, not the straight line: one distance field toward every free
  job slot (a deposit's tile and its four neighbours, five a deposit), shared by every worker, as troops share one
  toward a Nexus. Two workers wanting the last slot are settled as two units wanting one tile are.
- **It works in place** and carries nothing home (the recommendation in the open question on carrying).
- **It flees with a margin, and comes back with a wider one**: it runs at the threat's range and two, and goes back to
  work only when no threat is within the threat's range and four. Without the gap a worker at the edge of a threat's
  reach steps out, steps back and steps out again, every tick.
- **Fleeing ends at the job, not at the Nexus**: once safe, it walks back to the nearest free job, which is usually the
  one it left.

## The machinery

Everything above is made of five small parts, each tested alone (`src/routing/`, `tests/routing.test.ts`), put
together by the tick (`src/pulse/routes.ts`, `src/pulse/intents.ts`).

### In one paragraph

A unit decides **what** it wants (an enemy to strike, its side's target, the enemy Nexus), the tick works out **one
map of the way there** for everyone who wants the same thing, and each unit takes **one step downhill** on that map,
stepping round what is in its way. The map is a *distance field*: a number on every tile saying how far it is, walking,
to the goal. It is worked out once a tick and shared, so a hundred troopers heading for one Nexus cost one search, not
a hundred; and it is built from what stands on the Grid that tick, so a fallen building or a moved crowd is in the
next tick's map with nothing to keep up to date.

### The general path, and the way round obstacles

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

### The building blocks

**1. Ground: where a body may stand.** Rock, and everything that stands still this tick on a layer the body collides
with (a building, a unit fighting, a unit with nowhere to go), is a wall. A body bigger than one tile may stand where
every tile of it is free. A walker is not a wall: it will have moved by the time anyone gets there.

**2. Goal: where the walk ends.** Every place from which the unit's attack reaches its target — touching for a sword,
within range for a gun, measured as range is — or from which it stands inside its side's target.

**3. Distance field: how far, from everywhere.** From the goal outward, each tile gets the walk from it to the nearest
goal: one for a step across a column, two for a step up or down a row (a row is twice as tall on screen), times what
the ground weighs (scrub weighs two, burning ground four). Below, the numbers the code gives on a small map with a wall
of rock (`#`) and the goal at 0: a unit at the bottom left, 25 away, walks up and over the wall, never into it.

```
 17 16 15 14 13 12 11 10  9  8  9
 19 18 17 16  # 10  9  8  7  6  7
 21 20 19 18  #  8  7  6  5  4  5
 23 22 21 20  #  6  5  4  3  2  3
 25 24 23 22  #  4  3  2  1  0  1
```

**4. Step choice: which of four steps.** A unit ranks its four steps by the walk each leaves. Steps that are as good
go by the guide line for a marcher far off it, then by how little each turns from the way the unit faces, then by a
draw from the seeded stream — never by a compass order, which would favour one side of the map.

**5. Arbitration: who steps where.** Every walker says where it wants to go; the tick settles who gets a tile two want
(the tick order, [`pulse.md`](pulse.md)), lets two allies who want each other's tiles swap, and spends each step's
movement credit, so a unit's speed and the ground's weight decide how often it steps.

### A tick, in order

1. **Perception**: each unit picks what it wants, by distance (the nearest enemy in reach, its side's target, the
   enemy Nexus).
2. **Who walks**: from those choices, who will move this tick (`purposeOf`). Everyone else stands, and is a wall.
3. **The tick's fields** (`TickRoutes`): ground and fields, worked out as asked and shared by everyone with the same
   body, the same walls and the same goal.
4. **Choosing again by what can be reached**: a sword fights the enemy nearest *to walk to*; a gun passes over a target
   it cannot get in range of for one it can.
5. **Walls of buildings are broken, walls of rock are not.**
6. **The march**: every target set, who marches, and who of them yields its step to keep its place.
7. **Steps**: each walker ranks its steps on its field; arbitration settles them; credit is spent. A yielder takes no
   step of its own, and makes way for an ally held up behind it.

### Other ways of moving, on the same parts

Every way a unit moves is one of three things: **a new goal** for the same field machinery, **a different field**, or
**a move that is not a step**. Nothing below has a pathfinder of its own.

| Movement | What it is | Built |
| --- | --- | --- |
| Heading for the enemy Nexus | A goal: the Nexus | Yes |
| Heading for a level's target, or holding (a duel's stance) | A goal: the target's tiles | Yes |
| Leaving a roof | A goal: the nearest ground off its side's roofs, or its route along them (the "Way off the roof" Experiment) | Yes |
| Making way for a wave | The same goal, the nearest ground off its side's roofs, while a building of its side owes units it has no room for | Yes |
| Fleeing | A different field: the walk from every threat, turned into a "safety map" and walked downhill | Yes (workers) |
| Pushed or pulled | Not a step: moved a tile at a time while its body fits, its credit untouched (`displace`) | Yes (the bulwark's Shove) |
| Going round burning ground | A weight: four times its ground in the field while it burns; a step's credit is the ground's own | Yes (the mortar's fire) |
| The raid's trail in the Build Phase | The same field, walked ahead of time over the plan | Yes |
| Marching in formation | The march field ranks who is ahead, the guide line breaks ties, a yielder takes no step | Yes |
| A banner, attack or hold | A goal: the banner, then the Nexus; or the banner's tiles, held | IDEA |
| A worker's job | A goal: every free job slot | IDEA (Milestone 7) |

### Where modifiers plug in

The modifiers the owner named, and the ones the design already expects, each touch one building block. **IDEA**: none
is built; this is where each would go, so that adding one is small.

- **Stepping back to avoid damage** (kiting): a *purpose*. A ranged unit that has just fired, with its next shot some
  time away and a threat closing, walks its flight map uphill from that threat for the steps its cooldown allows, then
  turns back to its target. The flight map exists (fleeing workers use it); the new part is the moment it is chosen,
  in `purposeOf`, and the rule for when it stops.
- **Leaping forward** (a blink, a jump, a charge): *a move that is not a step*. The unit looks along its own field up
  to its leap's length, and lands on the furthest tile there its body fits; it says so (`entity.leaped`), and walks on
  from where it landed by the same field. Because the field already holds the way round rock, a leap never lands on
  the wrong side of a wall.
- **Faster or slower units**: not routing. Movement credit (a unit's rate and the ground's weight) decides how often a
  unit steps; an aura or a power that hastes changes the rate.
- **Ground that costs more** (mud, a power's slowing field): a *weight*, as scrub and burning ground are.
- **Ground no one may cross** (a power's wall): a *wall* in the ground for the ticks it lasts.
- **Gathering before marching** (a beacon, the backlog's idea): a *goal* — the beacon's tiles — held until enough of
  the army stands there, then the next goal. A hold banner is most of it.
- **Targeting that goes for a building first** (a siege unit, a breach-minded raider): a *perception* rule, which
  layers it prefers; the field toward that building is the same machinery.

### What keeps it fair and the same everywhere

- **Pure**: built from the tick's state, never kept from one tick to the next, the same on Node and Bun.
- **Mirror-fair**: everything is read from the state the tick began with, in whole numbers; the guide line is drawn
  alike from either end of a map; a tie between steps goes by facing, then by the seeded draw, so neither end of a map
  is favoured ([`pulse.md`](pulse.md), no side wins by where it stands; `march-mirror`).
- **Measured**: the route scenarios (`scenarios/route-*.map.json`) and the march scenarios (`scenarios/march-*.map.json`)
  are each a shape movement must manage, played on several seeds; `node bin/measure.ts run` measures how long units
  stand blocked before and after a change ([`measurement.md`](measurement.md)).
