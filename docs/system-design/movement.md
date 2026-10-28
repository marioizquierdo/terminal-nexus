# Terminal Nexus — troop movement

_How troops move, and why: first what a player should be able to predict from the Build Phase, then each part of it,
then the machinery underneath, what still needs smoothing, and the strategies it opens. The rules themselves, each with
its test, are in [`pulse.md`](pulse.md) (routes, a side's target, the march, the regroup) and [`grid.md`](grid.md)
(distance, walking, setting a group down); this page explains how they fit together. Every unmarked statement is
GUIDANCE; what is not built is marked IDEA._

The owner, 2026-10-26: "in this game 'pathfinding' is more than just moving, it is 'troops movement' ... building
placement is both defensive and offensive. Defensive because it disrupts the enemy path-finding towards the nexus or
valuable resources. Offensive because it initiates the troop formation which makes the troops more efficient ... Units
should be smart enough, smooth, but even more important, predictable."

The review behind this page, with the games it borrows from, is
[`2026-10-26-troop-movement-review.md`](../history/reports/2026-10-26-troop-movement-review.md); the owner's answers to
it are in [`2026-10-26-troop-movement.md`](../history/feedback/2026-10-26-troop-movement.md).

## What a player should be able to predict

**The test of this design is whether a player can say what their troops will do before the Battle Round starts.**
Everything below adds up to seven rules:

1. **Troops fight only in a Battle Round.** Between rounds they stop, step back and form up where they fought, and the
   front stays on the map.
2. **The army marches on the enemy's Grid Nexus** (or a level's target), by the shortest walk round rock and buildings.
3. **A troop marches, fights or retreats.** It marches while no enemy is in its vision, fights once one is, and
   retreats only when the rules pull it back (a worker in danger, the step back between rounds).
4. **Vision is 6 columns** (3 rows) for most troops, and it sees buildings as well as units: whatever of the enemy's
   comes into it, it fights, the nearest first.
5. **A troop commits to its target**: it fights it until it falls, and lets go only when it has not been able to strike
   it for 2½ seconds.
6. **The formation sorts itself on the march**: flankers in front, then melee, then ranged, shorter range before longer.
   A troop that should be further back walks at half speed while one that should be ahead of it is in its vision.
7. **Buildings are walked round until there is no way round; then the troops breach** the fewest buildings in the way.
   Rock is never broken. Workers never fight: they run.

Rules 4 and 7 are the defensive half of building placement: a building within 6 columns of the enemy's way pulls its
troops off the march to fight there, and a line of buildings bends the way they walk or, sealed, chooses where they
breach. Rule 6 and where production stands are the offensive half: a building's wave comes out a few seconds into
every round and walks up to the front, sorting itself into the formation as it goes.

## Build Phase and Battle Round — the will of the Nexus

RULE ([`pulse.md`](pulse.md), match structure; `src/match/regroup.ts`). **In the Battle Round nothing waits for the
player**: for 30 seconds every unit moves and fights by the rules on this page, and the same plan, map and seed give the
same battle every time. **Then the Nexus calls a pause.** Nothing fights or trains; for the first 10 seconds of the Build
Phase the survivors regroup on the map while the player builds:

- **2 seconds stepping back**: a unit in a fight walks toward its own Nexus.
- **6 seconds forming up** across its side's march line, in ranks by the formation's order (below).
- **2 seconds standing formed**, while the slowest walk in.

The regroup is worked out from how the round ended alone, never from what the player does, so a scripted battle plays
the same on every machine. **A building placed on troops pushes them out**, anyone's, to the nearest free ground, and
they push the troops round them on in a ripple (`src/match/make-room.ts`). So the front a player reads in the Build
Phase is where the next round starts, and nothing about a unit's movement is remembered beyond what the state holds:
what it does is worked out fresh every tick from what stands on the Grid.

## Where an army goes — the enemy Nexus

RULE (`headsForNexus`, `src/pulse/perception.ts`; a side's target, `src/pulse/target.ts`). **An army's goal is the
enemy's Grid Nexus.** A campaign level may name a target instead, a region the side heads for and holds; a duel's side
may hold in front of its own Nexus (the duel's stance). The stance and banners in the Build Phase come next (below).

**How the way is found: a distance field, not a path.** The game does not search a path for each unit. It works out a
number on every tile saying how far it is, walking, to the goal, shared by every unit going there; a unit takes the step
that leaves the shortest walk. So it goes round rock, buildings and standing fights by construction, and one pushed off
its way, trained mid-battle or stepping round a friend never has to ask again. The field is worked out again every tick
from that tick's Grid, so a building destroyed or a fight forming is in the next tick's way at once.

**The central path.** Where several ways are equally short, a marcher keeps near the line from its own Nexus to the
goal: one more than 6 columns off it takes, among equally good steps, the one nearest the line. It never takes a longer
way to stay near it; it gathers an army spread across the map into a column, and leaves one already in it alone. The
Commander spawns at the Nexus, so she walks the central path more closely than most. **IDEA**: the line becomes the
march route, the field walked downhill (round rock, not through it), drawn on the Build Phase, perhaps from the
Commander, who might also become the army's point to regroup on. Not yet: other movement comes first.

**When rock closes the way**, a unit walks to the tiles it can reach nearest the goal and stands there, saying so
(`move.blocked`, no route). A body too wide for a gap stands before it. **When its own crowd is in the way**, it waits
for a walker ahead and walks round allies who are stuck (the detour). When the enemy's buildings close it: breaching,
below.

## Banners — IDEA

The owner, 2026-10-26, in the core loop ([`core-loop.md`](../milestones/core-loop.md)): orders grow from none, to a
stance, to a banner, to two banners. **The stance** is one setting for the army: aggressive (march on the enemy Nexus,
as today), hold the line, or defensive. **A banner** is placed on the map, aggressive or defensive; by default on the
enemy Nexus, aggressive. Aggressive elsewhere, the army goes there first and then on to the enemy Nexus, so it sets a
route; defensive, it holds the line there. **Two banners**: the Commander follows the main one, and a building can be
set to send its units after a secondary "skirmish" banner.

None is built. Each is one more goal for the machinery on this page:

| Order | What the troops do | In the machinery |
| --- | --- | --- |
| None, or aggressive | March on the enemy Nexus | As today |
| Hold the line, or a defensive banner | Gather at the place and hold it; fight what comes into vision; come back to it after | A side's target, as a campaign level's is (built) |
| An aggressive banner | March to the banner, then on to the enemy Nexus | A waypoint that needs no memory: a marcher heads for the banner until it stands as near the enemy Nexus as the banner does, by the march field, then for the Nexus; a unit already past it never turns back |
| A skirmish banner (a building's) | That building's waves follow its banner instead | The same rules, the goal read from the unit's building (`EntityState.home`) |

They arrive in that order, each behind a "Banners" Experiment until it is settled; the stance and the banner are steps
of the runs milestone.

## Troop spawning

RULE (`src/pulse/spawn.ts`, `src/pulse/production.ts`, `src/pulse/make-way.ts`). **A building that trains sends one
wave a round**, a few seconds into the Battle Round (5 seconds, a tuned setting), so every building's production
restarts and lines up with the round: a Barracks sends four troopers, a Den five runners. The wave comes out **on the
building's own roof**, on the tiles nearest where the side is heading, so a base's units come out on the side facing
the fight.

- **Off the roof**: a unit on its own side's roofs walks the roofs toward the enemy and steps down where its way goes
  (the "Way off the roof" Experiment: `route`, the default, or `nearest`, stepping down at once).
- **A wave with no room waits**: the building owes the rest and sets each unit down the first tick there is room;
  meanwhile anything idle on its side's roofs makes way, to the nearest ground off them. A wave the army's supply holds
  back moves nobody.
- **Waves are reinforcements.** The front is already out on the map when a wave comes out, so a wave walks up to it,
  sorting itself into the formation as it goes; how soon it gets there is where its building stands.

## The three states: march, battle, retreat

The owner, 2026-10-27: "we should explain and implement this as states: march (exploring and walking), in battle or
retreating." A unit is always in one of three, worked out every tick from what it sees (`MoveState`,
`src/pulse/march.ts`):

| State | When | What it does |
| --- | --- | --- |
| **March** | No enemy in its vision, and no target it is committed to | Walks for its side's goal, keeping its place in the formation; steps off its roof first; holds when it has arrived at its side's target; makes way for a wave its side owes |
| **Battle** | An enemy is in its vision, or it is committed to a target | Walks to where its attack reaches its target, stands and strikes; the formation no longer holds it |
| **Retreat** | The rules pull it back | Walks away: a worker from every threat (its flight map); every survivor in a fight, during the regroup's step back. Later, a defensive stance and units that step back from damage |

**Vision** is how far a unit sees an enemy to turn to it: 6 columns across and 3 rows up or down by default, measured
from its body as range is, and its own attack's range when that is longer. Content may set it for a unit (`vision`): a
Commander who charges (Averno) sees 12.

## Troop formation

The owner, 2026-10-27: "Let's define Formation priority starting from 3 formation types: flankers, melee, and ranged.
When same type, pick priority by range, and then by class (e.g. tank, healer, bomber, etc), that way we can make a clear
priority list for the formation arrangements. The formation happens passively during march state ... half speed if
another unit with higher priority is in vision range."

**The priority list.** Every unit with an attack has a place in one list, front first:

1. **Its type**: **flankers** first (units that go round the front for what stands behind it: the Ravel bomber, the
   bench's flanker), then **melee**, then **ranged** (guns and healers). Content may say the type (`line`); otherwise
   it comes from the attack.
2. **Its range**, among units of the same type: shorter first (a slinger before a marksman, a marksman before a
   mortar of longer reach).
3. **Its class**, among units of the same type and range: **tank**, then **fighter**, then **support**, then
   **siege**. Content may say the class (`class`); otherwise a healer is support, a unit whose attack hits an area is
   siege, and anything else a fighter.

Units with no attack (workers) and flyers keep no place; a unit with no attack whose content names a type, the Ravel
bomber (a flanker that bursts instead of striking), has the place of its type, at range 0.

**The rule, passive and only on the march**: a marching unit walks at **half speed** while a marching ally of higher
priority is in its vision. Nothing else. A marksman near a trooper slows, the trooper walks on, and the marksman settles
about its vision behind; a mortar settles behind the marksmen. Units of equal priority never slow each other. Because
the rule only slows, never stops, an army sorts itself on the move instead of standing still while the front passes,
and no unit can wait on itself. In a lane one tile wide the slower unit cannot be stepped round: a unit held up by an
ally of lower priority that marches in front of it **swaps tiles with it** (`march.made-way`), the slower stepping back
onto the tile the other left. (A body too big to swap waits behind it, and the slower unit keeps walking at half speed.)

**The Commander is a regular troop**: she takes the place her attack gives her (Vasse, with a short gun, is ranged;
Averno, melee) and slows and is slowed like anyone. She does not lead the march.

**Closing.** The formation is for the march. A unit with an enemy in its vision is in battle and walks at its own
pace, and an ally already in battle slows no one; so as the front stops to fight, the ranged behind it walk up into
range at full speed, and the line forms on its own as melee closes and guns stop at their reach.

**Between rounds the regroup forms the same order** (`src/match/regroup.ts`): ranks across the march line, the
priority list front to back.

**Flankers go behind the enemy's line.** A flanker chooses first among the enemies in its vision that are not melee — a
shooter, another flanker, a building that shoots — the nearest it can walk to; with none, it chooses as every unit
does. The bomber keeps its aim at the thickest crowd. **A flanker is a special unit, not an army's mainstay**: with
every runner of Dob's army a flanker his front was empty and his Nexus fell in round 1 or 2 in 20 of 24 rush duels,
against 1 of 24 with the runner melee, where it now is.

## Targeting and attacking

The owner, 2026-10-27: "our units should have simple targeting ... It's ok to re-target if a unit is unable to attack
the target for 2-3 seconds but otherwise they should try to commit to their own." Clash Royale is the reference: a
troop locks on once it starts attacking.

**From march to battle.** When an enemy comes into a unit's vision, it turns to it. **Buildings count**: anything of the
enemy's in vision is a candidate, a Barracks as much as a trooper, unless the unit's content narrows what it strikes
(`targetLayers`: the mortar and the bomber strike only units and workers; the Nexus's guns units, workers and flyers).
The enemy Nexus is the march's goal wherever it stands, so a unit with nothing in vision walks on to it.

**Choosing a target.** Among the enemies in its vision, **the nearest**; among equally near ones, the one closest to
falling, so a squad that meets a line fires into the same enemy; then a seeded draw. Never a reading order, which would
favour a side by where it stands. Three refinements, from what a unit is for:

- **A melee unit fights the nearest to walk to**, not the nearest across a wall.
- **A gun takes the nearest by range**, shooting over rock, but passes over an enemy it cannot get in range of.
- **A unit that aims at a crowd** (the bomber, the mortar) first narrows to the enemies with the most of their side
  round them; a flanker first to the enemies behind the melee line; a healer chooses among wounded allies.

**Commitment.** Once chosen, a target is kept until it falls, or until the unit has gone **2½ seconds without being able
to strike it** (out of reach and not closing, walled off, or behind a crowd); then it chooses again. A nearer enemy
walking past does not pull it off. A healer keeps its patient until it is mended or out of reach as long. Some units
may be exceptions later; commitment is the default.

**Moving in battle.** A unit in battle walks to where its attack reaches its target, and its route ends exactly there:
touching for a sword, within range for a gun, so the walk, the shot and the hold never disagree about "close enough".
**A unit that fights stands**, and a standing unit is a wall to everyone's routes, so a crowd round one target spreads
to the tiles still free round it, and the next ones walk round the fight rather than queue behind it. A ranged unit
stops at its reach and fires over the front.

**The Nexus fights back**: one shot every three seconds, 40 damage, at a reach of 6, at units, workers and flyers.

## Breaching

RULE (`TickRoutes.breachOf`, `scenarios/route-breach.map.json`). Troops already fight the buildings they see, so a
building in the way is usually fought before it is ever a wall. When the enemy's buildings close every way to what a
unit wants, it **breaches**: a second field is worked out with the enemy's buildings open, each step onto one weighing
eight steps of open ground, so the way through the fewest buildings is taken; the first enemy building on it becomes
the unit's target; it breaks it, and the next tick's field walks the gap. Rock, and what is not the enemy's, is never
broken; a unit that cannot strike a building walks as near as it can get.

## Workers

The worker economy is Milestone 7 ([`milestone-07-worker-economy.md`](../milestones/milestone-07-worker-economy.md));
today a worker only runs.

**Built** (RULE — `src/pulse/routes.ts`, `tests/route-scenarios.test.ts`, [`grid.md`](grid.md), collision masks):

- **A worker never fights** and follows no target or banner. It keeps no place in the formation.
- **It retreats from any threat that comes within that threat's range and two more** (a trooper's touch: 4 columns, 2
  rows), and from all of them at once, by its **flight map**: the walk from every enemy that can strike, scaled and
  worked out again from every tile, walked downhill, so it runs toward open ground rather than into a corner (the
  roguelikes' "safety map").
- **It walks through its own side's troops, and not the enemy's**; a trooper the same through its own workers.
- **Enemy troops strike workers** as they strike anything else in vision: a raid on the workers is a real plan.

**Planned**, as GUIDANCE for Milestone 7:

- **A worker walks to the nearest free job**, by the walk: one distance field toward every free job slot (a deposit's
  tile and its four neighbours, five a deposit), shared by every worker.
- **It works in place** and carries nothing home.
- **It flees with a margin and comes back with a wider one**: it runs at the threat's range and two, and goes back to
  work only when no threat is within the threat's range and four, so it does not step out and back every tick at the
  edge of a threat's reach.
- **Once safe, it walks back to the nearest free job**, usually the one it left.

## The machinery

Everything above is made of five small parts, each tested alone (`src/routing/`, `tests/routing.test.ts`), put
together by the tick (`src/pulse/routes.ts`, `src/pulse/intents.ts`).

### In one paragraph

A unit decides **what** it wants (an enemy to strike, its side's target, the enemy Nexus), the tick works out **one
map of the way there** for everyone who wants the same thing, and each unit takes **one step downhill** on that map,
stepping round what is in its way. The map is a *distance field*: a number on every tile saying how far it is, walking,
to the goal. It is worked out once a tick and shared, so a hundred troopers heading for one Nexus cost one search, not
a hundred.

### Why a field, not A\*

The owner, 2026-10-27: "no A*, i agree, using each tile's distance is much better."

- **Many units, few goals**: one field toward the enemy Nexus serves every unit going there.
- **The Grid changes under the battle**: buildings fall, fights stand and break; a field rebuilt each tick needs no
  repair.
- **Pushed off the line costs nothing**: a unit reads the field where it stands.
- **Fairness is easy to prove**: whole numbers, no reading order, ties broken by facing and then the seeded stream.
- **Fleeing comes free**: the same machinery turned round is the flight map.

It is the "flow field" of crowd games (Supreme Commander 2 made it known) and the "Dijkstra map" of roguelikes. It is
worked out lazily, from the goal outward, only as far as the furthest unit asking needs, with a bucket for each
distance since steps cost small whole numbers, and it says at once, from the patch of ground a unit stands on, whether
it can reach the goal at all. About 200 units and buildings in an eighth-round duel cost about 5½ ms a tick
([`scripts/profile-routes.ts`](../../scripts/profile-routes.ts), 2026-10-21); the same script fingerprints every battle
it plays, so a change meant to make routes faster is proved to change no outcome.

### The building blocks

**1. Ground: where a body may stand.** Rock, and everything that stands still this tick on a layer the body collides
with (a building, a unit fighting, a unit with nowhere to go), is a wall. A body bigger than one tile may stand where
every tile of it is free. A walker is not a wall: it will have moved by the time anyone gets there.

**2. Goal: where the walk ends.** Every place from which the unit's attack reaches its target, or from which it stands
inside its side's target.

**3. Distance field: how far, from everywhere.** From the goal outward, each tile gets the walk from it to the nearest
goal: one for a step across a column, two for a step up or down a row (a row is twice as tall on screen), times what
the ground weighs (scrub two, burning ground four). On a small map with a wall of rock (`#`) and the goal at 0, a unit
at the bottom left, 25 away, walks up and over the wall, never into it:

```
 17 16 15 14 13 12 11 10  9  8  9
 19 18 17 16  # 10  9  8  7  6  7
 21 20 19 18  #  8  7  6  5  4  5
 23 22 21 20  #  6  5  4  3  2  3
 25 24 23 22  #  4  3  2  1  0  1
```

**4. Step choice: which of four steps.** A unit ranks its four steps by the walk each leaves. Steps that are as good
go by the central path for a marcher far off it, then by how little each turns from the way the unit faces, then by a
draw from the seeded stream, never by a compass order.

**5. Arbitration: who steps where.** Every walker says where it wants to go; the tick settles who gets a tile two want,
lets two allies who want each other's tiles swap, and spends each step's movement credit, so a unit's speed, the
ground's weight and the formation's half speed decide how often it steps.

### A tick, in order

1. **Perception**: each unit keeps its committed target, or picks what it wants: the nearest enemy in vision, its
   side's target, the enemy Nexus.
2. **Who walks**: from those choices, who will move this tick (`purposeOf`). Everyone else stands, and is a wall.
3. **The tick's fields** (`TickRoutes`): ground and fields, worked out as asked and shared by everyone with the same
   body, the same walls and the same goal.
4. **Choosing again by what can be reached**: a sword fights the enemy nearest to walk to; a gun passes over a target
   it cannot get in range of.
5. **Breaching**, when buildings close the way.
6. **The march**: each unit's state, and who of the marchers walks at half speed.
7. **Steps**: each walker ranks its steps on its field; arbitration settles them; credit is spent.

### Other ways of moving, on the same parts

Every way a unit moves is one of three things: **a new goal** for the same field machinery, **a different field**, or
**a move that is not a step**. Nothing has a pathfinder of its own.

| Movement | What it is | Built |
| --- | --- | --- |
| Heading for the enemy Nexus | A goal: the Nexus | Yes |
| Heading for a level's target, or holding | A goal: the target's tiles | Yes |
| Leaving a roof, making way for a wave | A goal: the nearest ground off its side's roofs, or its route along them | Yes |
| Fleeing | A different field: the walk from every threat, turned into a flight map | Yes (workers) |
| Pushed or pulled | Not a step: moved a tile at a time while its body fits (`displace`) | Yes (the bulwark's Shove) |
| Going round burning ground | A weight: four times its ground while it burns | Yes (the mortar's fire) |
| The raid's trail in the Build Phase | The same field, walked ahead of time over the plan | Yes |
| Regrouping between rounds | A goal per unit, its slot in its side's formation across the march line, walked beside the kernel's tick (`src/match/regroup.ts`) | Yes |
| Making room for a building | The walk to the nearest free ground off every building, pushing on whoever stands there in turn (`src/match/make-room.ts`) | Yes |
| A banner | A goal: the banner, then the Nexus; or the banner's tiles, held | IDEA |
| A worker's job | A goal: every free job slot | IDEA (Milestone 7) |

### Where modifiers plug in

**IDEA**: none is built; this is where each would go, so that adding one is small.

- **Stepping back to avoid damage** (kiting): a *retreat*. A ranged unit that has just fired, its next shot some time
  away and a threat closing, walks its flight map from that threat for the steps its cooldown allows, then turns back.
- **Leaping forward** (a blink, a jump, a charge): *a move that is not a step*, landing on the furthest tile along its
  own field that its body fits; because the field holds the way round rock, a leap never lands on the wrong side of a
  wall.
- **Faster or slower units**: movement credit; an aura or a power that hastes changes the rate.
- **Ground that costs more, or that no one may cross** (mud, a power's wall): a *weight*, or a *wall* for the ticks it
  lasts.
- **Gathering before marching** (a beacon): a *goal* held until enough of the army stands there. A defensive banner is
  most of it.
- **Targeting that goes for a building first** (a siege unit): a *perception* rule, which layers it prefers.
- **Exceptions to commitment** (a skirmisher that always takes the nearest): a content flag read where the target is
  kept.

### What keeps it fair and the same everywhere

- **Pure**: built from the tick's state, the same on Node and Bun; what a unit remembers (its target and how long it has
  not struck it) is in the state and hashed.
- **Mirror-fair**: everything is read from the state the tick began with, in whole numbers; a tie between steps goes by
  facing, then by the seeded draw ([`pulse.md`](pulse.md), no side wins by where it stands; `march-mirror`).
- **Measured**: the route and march scenarios (`scenarios/route-*.map.json`, `scenarios/march-*.map.json`) are each a
  shape movement must manage; `node bin/measure.ts run` measures how long units stand blocked before and after a change
  ([`measurement.md`](measurement.md)).

## To smooth later

The owner, 2026-10-27: "take notes, we will work on smoothing the movement as well later." What to watch and what to
try, none of it built:

- **Half speed at the edge of vision**: a ranged unit near the 6-column edge may walk half, full, half. Try a margin (slow
  inside 6, full again only past 8).
- **Lockstep**: identical units step on the same tick and read as one shape; deterministic jitter in how a step is
  drawn is an open question (movement feel).
- **The regroup's timing** (2 seconds back, 6 forming, 2 standing) is a starting point; it may want to be subtler.
- **Waves arriving in pieces**: a wave walks up alone to a front far from its building; the formation sorts it, but
  it arrives after the fight began.
- **Stair-stepping**: four directions on a grid make a diagonal walk a staircase; the trail drawn follows it, so it at
  least never lies.
- **The draw at a tie**: two equally good steps are broken by facing and then the seeded stream, which is fair but can
  look like a unit hesitating.

## Strategies

What a player (and a model playing a duel) can do on purpose with these rules. The measured advice is in
[`play-strategies.md`](../game-design/play-strategies.md); this is what the rules make possible.

- **Bait.** A cheap building within 6 columns of the enemy's way pulls its front off the march to fight there, under
  your Turrets or your Nexus. With commitment, a bait holds a unit until it falls or the unit cannot reach it.
- **Tank.** A sturdy unit at the front takes the commitment of every enemy that sees it first; commitment means they
  stay on it while your guns work.
- **Funnel.** Rock and buildings together leave one gap; the enemy walks round your buildings to it; a mortar's fire on
  the gap is fire on the whole army.
- **Choose the breach.** Seal every way and the enemy breaches the cheapest point: make one point thinner, and you
  chose where they come through.
- **Place production for the trade-off.** Behind the Nexus is safe and slow to reinforce the front; forward reinforces
  fast and is razed.
- **Spread against area damage, block against a line clash** (measured in duels).
- **Read the regroup.** The Build Phase opens on the front the next round starts from: build where it is thin, and place a
  building on the enemy's troops to push them back.
- **Chaff and flankers.** Nearest-first means cheap fast units soak the first volleys; flankers go round them for the
  shooters behind.
- **Hold** (duels today, the stance next): a defender that holds in front of its Nexus, under its guns, lets the enemy
  come to it.
