# Milestone 16 — Pathfinding

**Status:** PLANNED
**Depends on:** nothing new; the kernel's tick order, its collision masks and the rule that no side wins by where it
stands (all built). Where it sits in the build order is Mario's call; the recommendation is next, after Commander
Armies, because every battle on every map goes through it.

The owner, 2026-10-19 ([his words](../history/feedback/2026-10-13-commander-armies.md)), after watching raiders stand
behind rocks in PERIMETER: "pathfinding code will also need improvements soon ... The general game will point troop
movements towards enemy nexus, but we will likely implement banners to point at priority rally points during a battle
round." And the same day: "This is a solved problem in many videogames, please do some initial research to identify
the typical situations and algorithms. Then contrast with our specific situation, our units move like in a RTS or
tactical auto-battler, using ticks, but all units are automated. Units need to move towards a target, dodge
obstacles, identify enemies on their vision radius, crowd control (e.g. walking through a small passage), react to
dynamic obstacles during the battle (e.g. units pushed after an explosion, a magnet ability or new units spawned),
different terrains, and worker units being able to walk over other friendly units."

## Question

Does every unit get where it is going, on any map the game ships, through crowds and narrow gaps and a Grid
that changes under it, by a route a player watching would call sensible, while a Battle Round stays deterministic,
fair from either end of the map, and fast enough to play on a phone?

## What the kernel does today

There is no pathfinding. Each tick a unit looks at its four neighbouring tiles and takes one that brings it
**strictly closer** to its goal, measured by the Grid's own distance (a row counts two columns); among equally good
steps it prefers the one straight at the goal, then a fixed compass order (`src/pulse/movement.ts`, `rankedSteps`).
It never steps sideways or back. When no step brings it closer, it stands and reports itself blocked.

That works on open ground and fails in three shapes, all seen in PERIMETER played headless with no buildings:

- **The dead end.** A unit straight above its goal with rock between them has exactly one step that brings it closer,
  into the rock, and stands there for good. In round 3 a slinger walks along the top of the north-west wall until it
  is directly above the Grid Nexus and stops, and two raiders queue behind it; all three are still there when the
  round ends. `scenarios/on-axis-deadlock.map.json` is the same shape on a small Grid.
- **The pocket.** A wall the unit approaches at an angle is slid along to the point nearest the goal, which may be the
  bottom of a pocket: the north-west wall's corner, the crater's rim, the space behind the ridge.
- **The queue.** A unit behind an ally never steps round it, because that step does not bring it closer. Melee raiders
  wait seventy to a hundred and fifty ticks behind the one already fighting at the Nexus; units walking the top of
  the ridge wait half a minute for the one in front to move.

What already exists and the routing builds on:

- **The tick order.** Intents, then arbitration (contested steps go by speed tier, then a seeded draw), then settle;
  a mover's old tile does not free in the same tick (`pulse.md`, tick order).
- **Movement credit.** A step across costs one beat, a step up or down two, so every distance is walked at one pace
  (`pulse.md`, movement credit).
- **Collision masks.** Each content lists the layers it collides with; air ignores terrain; a trooper already walks
  over a worker and a worker over a trooper, of either side, because neither collides with the other's layer
  (`share-tile-worker-unit`).
- **Footprints.** Units up to three tiles wide and buildings up to 3x3 and more; a wide mover measures from its nose.
- **Goals.** An enemy (the nearest, held, or weakest, then a draw), a side's target area (a campaign level's), or for
  a worker, away from a threat.
- **Fairness.** Every tie a rule breaks goes by what the unit faces, then a seeded draw, never by reading or compass
  order (`pulse.md`, "No side wins by where it stands").

## What other games do

Pathfinding on a grid is a solved problem; what differs between games is which of its situations they face. The
research, short:

| Situation | The usual answer | Where it comes from |
| --- | --- | --- |
| One unit, one goal, static map | **A\*** search with a distance heuristic | The standard since 1968; Amit Patel's [A\* pages](https://theory.stanford.edu/~amitp/GameProgramming/index.html) and [Red Blob Games](https://www.redblobgames.com/pathfinding/) are the reference write-ups for games |
| Many units, one goal | **A distance field** (a Dijkstra map, a flow field): one search outward from the goal gives every tile its walking distance, and a unit anywhere steps downhill. A pushed or newly spawned unit already has its route | Tower defence ([Red Blob Games](https://www.redblobgames.com/pathfinding/tower-defense/)), roguelikes' Dijkstra maps, Fieldrunners 2, and **Supreme Commander 2**, whose flow fields let hundreds of units share one search ([a summary](https://gamedev.net/forums/topic/701267-flow-field-architecture-advice/5401826/)) |
| Large maps | **Hierarchy**: a coarse search between sectors, a fine one inside them (HPA\*, flow-field tiles) | Supreme Commander 2's sectors; Botea, Müller and Schaeffer's HPA\* (2004) |
| Units of different sizes | **Clearance**: each tile records the largest body that fits there, so one map serves every size | Harabor and Botea's annotated A\* for multi-size agents (2008) |
| Units in each other's way | **Local avoidance** on top of the route: wait, step aside, swap places, or steer (boids, RVO/ORCA velocity obstacles). StarCraft II's units push through allies and step aside for them | StarCraft II's GDC 2011 talk ([a discussion](https://www.gamedev.net/forums/topic/563819-whats-starcraft2s-pathfinding-tech/)); ORCA (van den Berg et al.), used where SC2's own code is closed ([SMAClite](https://arxiv.org/pdf/2305.05566)) |
| Units planning around each other in time | **Cooperative pathfinding**: a reservation table of who holds which tile at which tick, searched in space and time over a short window (WHCA\*) | Silver, "Cooperative Pathfinding", AIIDE 2005; Sturtevant and Buro's variable-speed extension ([paper](https://ojs.aaai.org/index.php/AIIDE/article/download/18750/18527/22420)) |
| Terrain that slows | **Weighted costs**: a tile costs more to cross; Dijkstra and A\* handle it, Jump Point Search does not | All of the above |
| Auto-battlers (TFT, Dota Underlords) | A small board: each unit picks its nearest reachable target and takes one step of a short search toward a free tile beside it, re-chosen often | Genre convention; the boards are too small to need more |

## Our situation, against it

Terminal Nexus is closest to a tower-defence map crossed by RTS armies, with an auto-battler's automation: nobody
steers a unit, every unit decides every tick, and the whole battle must replay identically from a seed.

| What the owner named | What it means here | What fits |
| --- | --- | --- |
| **Move toward a target** | Few goals and many units: a side heads for one place (the enemy Nexus, its level's target, a banner) and most units share it | A distance field per goal, shared by every unit that heads for it. Recomputed only when the map under it changes |
| **Dodge obstacles** | Rock, the crater, the long walls; buildings, which stand for a round and fall during it | The field routes round them by construction: no dead end, no pocket. A goal that cannot be reached at all is said so, and the unit heads for the reachable tile nearest it |
| **Identify enemies in its vision radius** | Today a unit turns to fight what comes within its engage reach, measured straight; a rock between them is not counted | Perception that measures how far an enemy is **to walk** for a melee unit (an enemy across a wall is not near), and straight for a shot. A sight radius as a named stat, and whether rock blocks sight, is a design choice this milestone puts behind an Experiment |
| **Crowds and narrow passages** | The ridge's gap, the crater's mouth, a corridor between two buildings; a melee crowd round one target | Local rules on top of the field, each a rule in the tick order: an ally in the way is waited for, stepped round when the field allows a sideways step, or swapped with when it is walking the other way; units that reach a target spread round it to the free tiles beside it instead of queuing behind one another. Arbitration already resolves two claims on a tile fairly |
| **Dynamic obstacles** | A unit pushed by a blast or pulled by a magnet, units spawned mid-round, a building that falls or rises | Fields are per goal, not per unit, so a moved or new unit just reads the field where it now stands. A building rising or falling marks the fields it touches stale and they are rebuilt once, at the next tick's start. Nothing displaces a unit yet; the milestone adds the rule a push or a pull will use, so the first such power has it ready |
| **Different terrains** | Plain, rock and deposit today; air ignores all of them | A cost per terrain (rock impassable, a slow ground costing more), read by the field. Air keeps its own field over nothing but other air |
| **Workers walk over friendly units** | Collision today is by layer, not by side: a worker crosses every unit, its own side's and the enemy's | Masks that can say "my side's units are not in my way": a worker crosses its own troops and not the enemy's. A rule change to the collision masks, with a scenario of its own |

What makes this game's version its own:

- **Determinism.** Integer costs only, a fixed order of expansion, no clock and no `Math.random`; the same seed hashes
  the same on Node and Bun. A field is worked out from the state the tick began with, like every phase before the
  moves settle.
- **Fairness.** A route is chosen, at every tie, by what the unit faces and then a seeded draw, so two mirrored sides
  take mirrored routes and mirror duels still split evenly. The compass order the step rule still uses goes.
- **A row counts two columns.** Costs are the movement-credit costs already in use: one across, two up or down.
- **Footprints.** A three-wide raider needs a three-wide gap: a field per body size (clearance), not one per unit.
- **The budget.** The starter map is 96 x 40, under four thousand tiles; one field is a few thousand steps. A dozen
  fields rebuilt now and then fit a tick with room; the milestone measures it against the frame budget the browser
  page already holds.
- **Readable on screen.** A unit should look like it knows where it is going: no pacing, no hugging one wall when the
  open way is visible. The Activity Logs say why a unit took the route it did.

## Steps

Not started. Each waits for Mario's word, and the order is a first guess.

### Step 16A — The bench and the measure

- [ ] Route scenarios that fail today, each with one thing moving where it can (the lesson from the first routing): the
      dead end above a wall, a pocket, the ridge's gap with a squad, a three-wide raider and a two-wide gap, a crowd
      round one target, a corridor two ways at once, a building that falls mid-round and opens a way.
- [ ] A measure run on every scenario and on PERIMETER, the duels and the campaign levels: ticks each unit stands
      blocked, how long the longest walk takes against its shortest route, and the time a tick takes. Today's
      numbers written down, so each step says what it changed.

### Step 16B — Routes round the map

- [ ] A distance field per goal and body size, over terrain and buildings, integer costs, rebuilt only when what it
      was made from changes. A unit steps downhill on it; ties go by facing, then a draw.
- [ ] The dead end, the pocket and PERIMETER's north-west wall walked round; an unreachable goal heads for the
      nearest reachable tile and the log says so. What a unit with no route at all does is settled here.
- [ ] Mirror duels still split evenly; every re-pinned battle says why it moved.

### Step 16C — Crowds

- [ ] Allies in the way: wait, step round, or swap, as rules in the tick order with their scenarios.
- [ ] Spreading round a target to the free tiles beside it; a melee unit picks a tile it can reach, not the one
      behind its friend.
- [ ] A narrow gap with two sides pushing through it never jams for good (a soak over seeds says so).

### Step 16D — A Grid that changes

- [ ] Fields go stale and rebuild when a building rises or falls; spawned units route from where they stand.
- [ ] The kernel's rule for moving a unit that did not walk (a push, a pull), with a test effect behind a bench card,
      so the first power that pushes has it ready.
- [ ] Perception by route: a melee unit turns to fight the enemy nearest to walk to, not the one nearest across a wall.

### Step 16E — Terrain and who passes whom

- [ ] A cost per terrain, and one slow ground on a bench map to show it.
- [ ] Workers cross their own side's units and not the enemy's.
- [ ] A fleeing worker routes away from danger, not only away from the nearest threat.

### Step 16F — Goals as data, and banners

- [ ] One goal type for everything a unit heads for: the enemy's Grid Nexus by default, a level's target, and a
      rally point, each a field. What a banner is on screen, and when a player sets it, waits on Mario's answer below.

## Waiting on Mario

- **When is a banner set?** In the Build Phase as part of the plan, or live while the Battle Round plays (which makes
  the battle depend on a player's timing, and its replay on recorded commands). The recommendation and the costs are
  in [the open questions](open-questions.md#q81--when-does-a-player-set-a-banner-in-the-build-phase-or-during-the-battle-round).
- **Where it goes in the build order.**

## Out of scope

Formations and spacing between moving units (they wait on behaviour states, in the backlog), holding and withdrawing
on an order (posts, in the backlog), what a banner looks like beyond a marker, line of sight for shots, diagonal
movement, and a map larger than the starter map.
