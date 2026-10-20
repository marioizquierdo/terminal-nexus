# Milestone 16 — Pathfinding

**Status:** CURRENT
**Current step:** 16A — a clean slate, and how a battle is measured.
**Depends on:** nothing new. It builds on the kernel's tick order, its collision masks and the rule that no side
wins by where it stands, all built. Commander Armies is closed, and its last step, the catch-up measure, is measured here at the end.

On 2026-10-19 the owner watched raiders stand behind rocks in PERIMETER and asked for this milestone
([his words](../history/feedback/2026-10-13-commander-armies.md)): "This is a solved problem in many videogames,
please do some initial research to identify the typical situations and algorithms. Then contrast with our specific
situation." He named what units must do: move toward a target, dodge obstacles, notice enemies within sight, get a
crowd through a narrow passage, cope with a Grid that changes mid-round (a unit pushed by a blast or pulled by a
magnet, new units appearing), cross different terrains, and let workers walk over their own side's units. On its
place in the order: "We can work on that anytime. It's kind of independent, but the sooner the better, because that
will make the other tests better."

Made current on 2026-10-20, when he closed Commander Armies: "Make sure to split the pathfinding architecture in
smaller compartments that are each testable, then build up from the primitives into more complex behaviors, and
close up with full commander deck duels. This will be a key component of the grid architecture and very relevant to
gameplay. Pathfinding also has to work well with targeting, attacking, adding new units, etc. Go ahead, take your
time, implement slow."

## Question

Does every unit get where it is going, on every map the game ships, through crowds, narrow gaps and a Grid that
changes under it, by a route a player watching would call sensible, while a Battle Round stays deterministic, fair
from either end of the map, and fast enough to play on a phone? And can a player, by where they build, send their
army out as a tight block or a loose line, so that how it stands is a choice that wins or loses fights?

## What the kernel does today

There is no pathfinding. Each tick a unit looks at its four neighbouring tiles and takes one that brings it
**strictly closer** to its goal, by the Grid's own distance (a row counts two columns). Among equally good steps it
prefers the one straight at the goal, then a fixed compass order (`rankedSteps` in `src/pulse/movement.ts`). It never
steps sideways or back; when no step brings it closer, it stands and reports itself blocked.

That works on open ground and fails in three shapes, all seen in PERIMETER played headless with nothing built:

- **The dead end.** A unit straight above its goal, with rock between them, has one step that brings it closer:
  into the rock. It stands there for good. In round 3 a slinger walks along the top of the north-west wall until it is
  directly above the Grid Nexus and stops, two raiders queue behind it, and all three are still there when the round
  ends. `scenarios/on-axis-deadlock.map.json` is the same shape on a small Grid.
- **The pocket.** A unit meeting a wall at an angle slides along it to the point nearest its goal, which can be the
  bottom of a pocket: the corner of the north-west wall, the crater's rim, the space behind the ridge.
- **The queue.** A unit behind an ally never steps round it, because that step does not bring it closer. Melee raiders
  wait seventy to a hundred and fifty ticks behind the one already fighting at the Nexus; units on the ridge wait
  half a minute for the one in front to move.

What already exists, and what routing builds on:

- **The tick order.** Every unit states what it wants; contested steps are settled by speed, then a seeded draw; then
  the moves land. A mover's old tile does not free in the same tick (`pulse.md`, the tick order).
- **Movement credit.** A step across costs one beat and a step up or down two, so every distance is walked at one
  pace (`pulse.md`, movement credit).
- **Collision masks.** Each unit and building lists the layers it collides with. Air ignores terrain. A trooper already
  walks over a worker and a worker over a trooper, of either side, because neither collides with the other's layer.
- **Footprints.** Units up to three tiles wide, buildings of 3x3 and more; a wide unit measures distance from its
  nose.
- **Goals.** An enemy (the nearest, the one it already holds, or the weakest, then a draw), a campaign level's
  target area, or, for a worker, away from a threat.
- **Fairness.** Every tie a rule breaks goes by what the unit faces, then a seeded draw, never by reading order or a
  compass (`pulse.md`, "No side wins by where it stands").

## What other games do

Pathfinding on a grid is solved; games differ in which of its situations they face.

| Situation | The usual answer | Where it comes from |
| --- | --- | --- |
| One unit, one goal, a map that does not change | **A\*** search with a distance estimate | The standard since 1968; Amit Patel's [A\* pages](https://theory.stanford.edu/~amitp/GameProgramming/index.html) and [Red Blob Games](https://www.redblobgames.com/pathfinding/) are the write-ups game developers use |
| Many units, one goal | **A distance field** (a Dijkstra map, a flow field): one search outward from the goal gives every tile its walking distance, and a unit anywhere steps downhill. A unit pushed or newly made already has its route | Tower defence ([Red Blob Games](https://www.redblobgames.com/pathfinding/tower-defense/)), roguelikes' Dijkstra maps, Fieldrunners 2, and **Supreme Commander 2**, whose flow fields let hundreds of units share one search ([a summary](https://gamedev.net/forums/topic/701267-flow-field-architecture-advice/5401826/)) |
| Large maps | **Hierarchy**: a coarse search between sectors, a fine one inside them (HPA\*, flow-field tiles) | Supreme Commander 2's sectors; Botea, Müller and Schaeffer's HPA\* (2004) |
| Units of different sizes | **Clearance**: each tile records the largest body that fits there, so one map serves every size | Harabor and Botea, annotated A\* for agents of several sizes (2008) |
| Units in each other's way | **Local avoidance** on top of the route: wait, step aside, swap places, or steer (boids, RVO/ORCA velocity obstacles). StarCraft II's units push through allies and step aside for them | StarCraft II's GDC 2011 talk ([a discussion](https://www.gamedev.net/forums/topic/563819-whats-starcraft2s-pathfinding-tech/)); ORCA (van den Berg et al.), used where StarCraft II's own code is closed ([SMAClite](https://arxiv.org/pdf/2305.05566)) |
| Units planning round each other in time | **Cooperative pathfinding**: a table of who holds which tile at which tick, searched in space and time over a short window (WHCA\*) | Silver, "Cooperative Pathfinding", AIIDE 2005; Sturtevant and Buro's extension to units of several speeds ([paper](https://ojs.aaai.org/index.php/AIIDE/article/download/18750/18527/22420)) |
| Terrain that slows | **Weighted costs**: a tile costs more to cross. Dijkstra and A\* handle it; Jump Point Search does not | All of the above |
| Auto-battlers (Teamfight Tactics, Dota Underlords) | A small board: each unit picks the nearest target it can reach and takes one step of a short search toward a free tile beside it, chosen again often | The genre's habit; the boards are too small to need more |

## Our situation, against it

Terminal Nexus is closest to a tower-defence map crossed by RTS armies, with an auto-battler's automation: nobody
steers a unit, every unit decides every tick, and the whole battle must replay identically from a seed.

| What the owner named | What it means here | What fits |
| --- | --- | --- |
| **Move toward a target** | Few goals, many units: a side heads for one place (the enemy Nexus, or its level's target) and most of its units share it | A distance field per goal, shared by every unit heading there, worked out again only when the map under it changes |
| **Dodge obstacles** | Rock, the crater, the long walls; buildings, which stand for a round and can fall during it | The field routes round them by construction, so there is no dead end and no pocket. A goal that cannot be reached is said so, and the unit heads for the reachable tile nearest it |
| **Notice enemies within sight** | Today a unit turns to fight what comes within its engage reach, measured in a straight line; rock between them does not count | For a melee unit, how far an enemy is **to walk** (an enemy across a wall is not near); for a shot, the straight line. Whether sight is a stat of its own and whether rock blocks it is a design choice, put behind an Experiment |
| **Crowds and narrow passages** | The ridge's gap, the crater's mouth, a corridor between two buildings; a melee crowd round one target | Rules on top of the field, each in the tick order: an ally in the way is waited for, stepped round when the field allows a sideways step, or swapped with when it walks the other way. Units that reach a target spread to the free tiles round it instead of queuing behind each other. Contested tiles are already settled fairly |
| **A Grid that changes** | A unit pushed by a blast or pulled by a magnet, units appearing mid-round, a building that rises or falls | Fields belong to goals, not units, so a moved or new unit reads the field where it now stands. A building that rises or falls marks the fields it touches as stale, and each is rebuilt once, at the start of the next tick. Nothing moves a unit that did not walk yet; the milestone adds the rule a push or a pull will use |
| **Different terrains** | Plain, rock and deposit today; air ignores all of them | A cost per terrain (rock impassable, slow ground dearer), read by the field. Air keeps its own field, blocked only by other air |
| **Workers walk over their own units** | Collision is by layer, not by side: a worker crosses every unit, its own side's and the enemy's | Masks that can say "my own side's units are not in my way": a worker crosses its own troops and not the enemy's. A change to the collision rule, with a scenario of its own |

What makes this game's version its own:

- **Determinism.** Whole-number costs, a fixed order of search, no clock and no `Math.random`: the same seed hashes
  the same on Node and Bun. A field is worked out from the state the tick began with.
- **Fairness.** Every tie on a route goes by what the unit faces, then a seeded draw, so two mirrored sides take
  mirrored routes and mirror duels still split evenly. The compass order the step rule still uses goes.
- **A row counts two columns.** Costs are the movement-credit costs already in use: one across, two up or down.
- **Footprints.** A three-wide raider needs a three-wide gap, so there is a field per body size, not one per unit.
- **The budget.** The starter map is 96 x 40, under four thousand tiles, and one field is a few thousand steps. A
  dozen fields rebuilt now and then fit in a tick with room to spare; the milestone measures that against the frame
  budget the browser page already keeps.
- **Readable on screen.** A unit should look like it knows where it is going: no pacing, no hugging one wall when the
  open way is in plain sight. The Activity Logs say why a unit took the route it did.

## How it is built: from small parts up

Routing is built as parts that each do one thing and are each tested alone, on Grids a few tiles wide, before
anything in a battle leans on them. Each layer uses only the ones under it.

1. **The parts** (`src/routing/`). Pure functions of a Grid, with no tick, no state and no draw:
   - **Ground**: which tiles a body of a given size and shape can stand on, given the terrain and what stands still
     on it. One answer per body, not per unit.
   - **Costs**: what a step costs, one across and two up or down, and later more on slow ground.
   - **Goals**: the tiles a body must reach to do what it came for: touching an enemy for a melee unit, within
     its range for a shot, inside an area for a side's target. A goal is a set of tiles, so "a place I can attack
     from" is one idea for every unit.
   - **Distance fields**: from a goal outward, every tile's walking cost to it, in whole numbers. Worked out only as
     far as someone asks, and shared by everyone heading for the same goal with the same body.
   - **The choice of a step**: from a tile, the steps that follow the field downhill, best first; equally good ones
     go by what the unit faces, and what is still tied is left for the caller's seeded draw.
2. **The tick's routes** (`src/pulse/routes.ts`). Once a tick: who stands still this tick (a building, a unit
   fighting, a unit that cannot move) and so is a wall to everyone else, and the fields the tick needs, built from
   that and kept for the tick. A field is a pure function of the state the tick began with, so a run replays the same
   on Node and Bun.
3. **Behaviours** on top, each a rule in the tick order with a scenario of its own: walking a route, waiting for or
   stepping round an ally, choosing a target that can be reached, standing where an attack reaches, units that
   appear mid-round, a Grid that changes under a unit, and units walking out over the roofs.
4. **Measurement** over all of it: the route scenarios, the bench, the campaign levels and full Commander duels,
   measured the same way before and after (the first step).

Routing must agree with targeting and attacking at every point: a unit walks toward a place its attack reaches
from, it stands once it is there, and it chooses a target it can reach. The same functions answer all three, so the
three can never disagree.

## Steps

Mario asked for the whole milestone, built slowly in this order. Each step lands with its tests and the battles it
moves re-pinned, saying why.

### Step 16A — A clean slate, and how a battle is measured

The owner, 2026-10-20: "We should also invalidate the older maps and the data we have on them that decide what
something is better than another thing. Maybe this is time to write a summary in some design file, a spec, and just
forget about that old data." Every result so far was measured on units that stand behind rocks, so none of it says
what is better than what once units find their way.

- [ ] **A spec of how a battle is measured**, a design document of its own, and one command that runs it all:
  - what is measured: who wins and in which round, how long a round runs, what each side loses, when a Commander
    falls, how long units stand blocked, how evenly a mirror splits between the two ends of the map, and how tight
    or loose an army stands when it first meets the enemy;
  - on what: the route scenarios, the duels between Commanders, and every campaign level played with a fixed set of
    plans (nothing built, a defended base);
  - over which seeds, and how each result is written down, with the build and the date it was measured on.
- [ ] **The old results set aside**, not deleted. They move to one history report, "measured before routing", and
  every sentence that states one as current fact is rewritten to say what is designed and that its numbers wait for
  the new routes. They are in the Commander Armies design (the power curve, Averno beside Vasse), the next steps,
  the open questions (the aura's strength per plan, the old mirror drift), the duels document, the campaign design
  (who falls in which round), and the notes in the campaign and army files. The reports already in history stay as
  they are; the new report points to them.
- [ ] **The old route maps retired.** The scenarios that only show the greedy step's shapes (the on-axis dead end,
  the two- and three-tile gaps, the rock spine slid along, the crowded raider's tail) are replaced by this step's own,
  rather than kept passing for a rule that is about to go.
- [ ] **Route scenarios that fail today**, each with one thing moving where it can: the dead end above a wall, a
  pocket, a squad through the ridge's gap, a three-wide raider at a two-wide gap, a crowd round one target, a
  corridor walked both ways at once, and a building that falls mid-round and opens a way.
- [ ] **A baseline**: the spec run once on today's step rule, kept only to compare each later step with: the ticks
  each unit stands blocked, the longest walk against its shortest route, and the time a tick takes.
- [ ] **The tests that pin a battle's outcome or hash** listed with what each claims, so the steps that change
  routes re-pin them knowingly and drop a claim that only held for the old rule.

### Step 16B — The parts, each tested alone

Nothing in a battle changes in this step: the parts exist, with their tests, and nothing calls them yet.

- [ ] **Ground** for a body: a tile is open to it when every tile its body covers is in the Grid, not rock, and not
  under something that stands still. Wide and tall bodies, the Grid's edges and a body that fits a gap exactly, each
  tested.
- [ ] **Goals** as sets of tiles: touching a footprint (melee), within a range of it (a shot, measured as range is),
  inside an area. A goal under a wall or off the Grid is left out; a goal with no tile left is said so.
- [ ] **A distance field** from a goal: exact whole-number walking costs, a row two columns, worked out outward only
  as far as it is asked, the same values whichever tile is asked first. Tested against a plain search on small
  Grids, on mazes, and on a goal that cannot be reached.
- [ ] **The choice of a step**: the steps along a shortest route first, then those that keep the cost level, and
  ties by the turn from the way the unit faces its goal. Mirrored Grids give mirrored choices.
- [ ] **Their cost measured**: a field over the starter map, and a tick's worth of them, against the frame budget the
  browser page already keeps.

### Step 16C — Routes round the map

- [ ] Units walk their field downhill: the dead end, the pocket and PERIMETER's north-west wall are walked round,
  and the greedy step goes, with its compass order.
- [ ] What stands still is a wall to the field for this tick: a building, a unit fighting. What walks is not, and
  the tick order settles who steps where, as it does today.
- [ ] A unit whose goal cannot be reached heads for the reachable tile nearest it, and the log says so; a unit with
  no route at all stands, and says that.
- [ ] Mirror duels still split evenly, and every re-pinned battle says why it moved.

### Step 16D — Crowds

- [ ] An ally in the way is waited for while it walks; one that stands is routed round, because it is a wall to
  the field; two allies that want each other's tile swap.
- [ ] Units spread round a target to the free tiles that reach it, because those tiles are the goal: a melee unit
  heads for a free tile beside its target, not the one behind its friend.
- [ ] A unit blocked for a while by units that walk routes round them for itself, so no crowd stands still for
  good. A narrow gap with both sides pushing through it never jams for good (a run over many seeds says so).

### Step 16E — Targeting, attacking and new units agree with routes

- [ ] A unit chooses among the enemies it can reach: one walled off, or deep in a block where nothing reaches it,
  is passed over for one it can reach ("same as usual": what it can reach, the building first if that is all).
- [ ] A melee unit turns to fight the enemy nearest to walk to, not the one nearest across a wall.
- [ ] A unit stands once its attack reaches its target, and its route ends exactly where its attack begins: the
  same test for both, as today.
- [ ] Units that appear mid-round (a wave, a spawner, a unit that splits on death) route from where they appear on
  their first tick.
- [ ] A building that rises or falls changes the routes from the next tick; a unit pushed or pulled reads its route
  from where it lands. The rule for moving a unit that did not walk, with a test effect behind a bench card, so the
  first power that pushes has it ready.

### Step 16F — Terrain, and who passes whom

- [ ] A cost per terrain, and one slow ground on a bench map to show it.
- [ ] Workers cross their own side's units and not the enemy's.
- [ ] A fleeing worker routes away from danger, not only away from the nearest threat.

### Step 16G — Where a side heads

- [ ] One kind of goal for everything a unit heads for, each with its field: the enemy's Grid Nexus by default, and a
  campaign level's target where the level names one (the owner: "It's just going to be going to the enemy nexus. Or
  maybe we have to define the target position for campaign as well").
- [ ] No banner. A banner is set in the Build Phase as part of the plan, and waits for a way to show that plan on
  screen (the backlog); this step leaves it as one more goal to add.

### Step 16H — Units walk out over the roofs

The owner, 2026-10-20, on why: "since army position and formation is so important to win or lose a battle, the users
will have a lot of control over where their units are positioned, and that is decided indirectly by placing the
buildings right now. So if units spawn around the building, there is a lot of space that is being taken in between
units, so they naturally not be able to cluster before attacking the enemy, and being able to cluster or disperse the
units seems like a great way to add a strategy for area of damage or not." His idea: units appear on top of the
building that made them and walk out, so buildings can stand side by side with no gap between them.

Today a building that makes units sets each one down on a free tile round it, and keeps a ring of tiles round itself
where nothing may be built (the Spawn space Experiment, 1 or 2 tiles). Two Barracks can never touch, and a wave stands
spread along a building's face before it moves.

What the step builds, as he described it; he also said the real test is a simulated game, not the description ("this
is just what I think it would work, but the real test is playing a simulated game and checking if it is possible to
make good unit formations that can foster interesting strategies"):

- [ ] **Units appear on the roof.** A wave appears on top of the building that made it, small units and wide ones
  alike, never two on one tile, so a big wave files out over a few ticks instead of all at once.
- [ ] **They walk the roofs toward where they are going**, not to the nearest free ground. A unit's route out is its
  ordinary route to its goal, with its own side's buildings counted as open ground, so it leaves by the side that
  faces the enemy and the wave comes off the roofs together. The owner: "they will just keep walking on the rooftops
  on the natural direction where their destination is, this will help keep the troop waves together when they
  spawn."
- [ ] **A unit is on the roofs until all of it stands on ground.** A wide unit with part of its body over an open tile
  keeps walking the roofs, across that tile, until every tile it covers is ordinary ground. Then it is out: from then
  on buildings are walls to it, its own included, and it never climbs back.
- [ ] **No room round a building.** Buildings that make units may touch, the ring of free tiles round them goes, and
  the Spawn space Experiment with it.
- [ ] **They fight from the roof.** A unit on a roof with an enemy in reach shoots or strikes at once, as it would
  from the ground.
- [ ] **They are hit like any unit.** An enemy hits a unit on a roof as it would on the ground; when the unit dies the
  enemy picks a new target as usual, which may be the building under it. An enemy that cannot reach the unit (a melee
  enemy, a unit in the middle of a block) attacks the building or whatever else it can reach, as usual (the targeting
  of the step before). A blast that hits an area hits units on a roof as it would on the ground.
- [ ] **A building that falls with units on it** leaves them standing where they are, on what is now open ground; they
  are out. This follows the owner's "same as usual" and is the step's reading, not his word yet.
- [ ] **On screen**, a unit on a roof is drawn over its building on its own tiles only, and its card or the log says
  it is coming out.
- [ ] **The test he set: formations in a simulated game.** Using the spec from the first step, sides built three ways
  (a block of four Barracks side by side, four set apart, a long line of them) are played against each other and
  against a blast that hits an area, over many seeds. Done when it shows, in plain words, how tight each army stands
  when it first meets the enemy, and that each shape beats something and loses to something. If the shapes come out
  the same, the step says so and tries the variant below before calling it built.
- [ ] **An Experiment for the way out**, if the simulation leaves it open: along the route to the goal (his idea), or
  to the nearest open ground, so he can watch both on the playable page.

This step is the first half of a choice that is still in the backlog, a sparse formation where units prefer not to
stand straight behind one another (next steps, "a sparse formation, when he says"): this step lets a player decide how
their army leaves; that one would decide how it keeps its shape on the way.

### Step 16I — Measure again, with full Commander duels

The owner: "close up with full commander deck duels", and "use the pending commander checks as part of pathfinding
validation at the end". The checks Commander Armies left are measured here, on the new routes.

- [ ] **The whole spec run on the new routes**: every Commander against every other from both ends of the map,
  drafting from their whole decks over many seeds; the bench; every campaign level with its plans. Written down as
  the spec says: the first results under the new rules.
- [ ] **The catch-up measure** (Commander Armies' last step): how often a lucky early hand predicts the winner, over
  the duels. The power curve's guidelines revised by what it shows; any catch-up mechanic it suggests registered with
  a recommendation, not built.
- [ ] **The Commander checks, measured**: the six-round curve level played by its plans (supply, the Garrison,
  holding a wave home); Averno beside Vasse on the same curve; and the three duel findings re-measured (Averno winning
  most games, Ravel buildings training about half the strength a credit of Citizen ones, Dob without a campaign).
- [ ] **What they show, in plain words**: which Commander, building or plan is now stronger, and which level no
  longer plays as designed (a raid that now walks round the wall it used to stand behind). Levels are retuned only
  where one breaks; the rest of balance stays later work, as the owner has said.

## Waiting on Mario

Nothing: he asked for the whole milestone, built slowly, one step after another.

## Out of scope

Formations a player orders units into, and spacing kept between moving units (they wait on behaviour states, in the
backlog); the shape an army leaves its buildings in is in, as above. Holding and withdrawing on an order (posts, in
the backlog), banners, line of sight for shots, diagonal movement, and maps larger than the starter map.
