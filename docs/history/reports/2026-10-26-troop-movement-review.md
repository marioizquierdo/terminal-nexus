# Troop movement, reviewed

_2026-10-26. Mario asked how troops move in Terminal Nexus, explained from the general idea down to the details; why
it works that way, against other games; and whether the explanation itself is smooth, simple, intuitive and gives a
player strategies to exploit, "at the end of the day, the explanation in text is not as important as the actual game in
movement". His words are in [`2026-10-26-troop-movement.md`](../feedback/2026-10-26-troop-movement.md). The design
itself now lives in [`movement.md`](../../system-design/movement.md), restructured as a chapter on troop movement;
this report is the reasoning behind it and the evaluation. No rule was changed._

_Mario's answers, the next day ([F223 to F230](../feedback/2026-10-26-troop-movement.md)), changed three things this
report assumed: the Commander does not lead (she is a regular troop, and the central path runs from the Nexus); the
formation is a priority list with one half-speed rule rather than places and waiting; and troops are no longer
recalled (the kept front). Lock-on, banners in stages and "flanker" were agreed; drawing the march route waits. The
chapter is written on his answers; this report stays as it was written._

## How troops move, from the top down

**In one sentence**: each round the army walks from its base to the enemy's Grid Nexus, the Commander at its head and
its guns behind its blades, and every troop turns to fight whatever comes within six columns of it.

**In seven rules**, the version a player needs:

1. Troops only move in a Battle Round; in the Build Phase they stand on their buildings' roofs, where Recall left them.
2. The army marches on the enemy's Grid Nexus (or a level's target), by the shortest walk round rock and buildings.
3. The Commander leads: melee beside her, short range 4 columns behind, long range 8 behind, flankers anywhere.
4. A troop fights anything within 6 columns of it (3 rows), building or unit, the nearest first.
5. It walks until its attack reaches, then stands and fights; a standing fight is a wall the others walk round.
6. Buildings are walked round, never through, until there is no way round: then the troops break the fewest buildings
   in the way. Rock is never broken.
7. Workers never fight; they run from anything that can hit them.

**In detail**, a round goes like this. At tick 0 every survivor stands on its building's roof and the Commander beside
the Nexus. Each tick, every unit chooses what it wants (the nearest enemy within its reach, else the march goal); the
tick works out one distance field per goal, the walk from every tile to that goal round everything standing still,
shared by every unit going there; each unit takes the step downhill, unless it is ahead of its place in the formation,
in which case it waits. Survivors ahead of the Commander wait for her to come level. At 5 seconds each building's wave
comes out on its roof, on the side facing the enemy, and walks after the army. Around 6 seconds the fronts meet on the
Crossing: whoever comes within 6 columns of an enemy stops marching, walks until its attack reaches, and stands to
fight; the shooters, no longer held back once an enemy is within 12 columns of them, walk up into range behind the
melee. A unit chooses again every tick, the nearest enemy by walk for a blade and by range for a gun. When a fight
stands in a gap, the next units walk round it, through another gap, or, if the enemy's buildings seal every way, break
the cheapest of them. At the end of the round, Recall sends everyone home.

The full design, with every number and the parts underneath, is [`movement.md`](../../system-design/movement.md).

## Why it works this way

### A distance field, not A\*

Mario's picture was "a central A\* path that goes from your Nexus to the enemy Nexus". What is built is close to it in
effect and different in kind: a **distance field**, a number on every tile saying how far it is to walk to the goal.

| Approach | Where it is used | What it is good at | Why not here |
| --- | --- | --- | --- |
| A\* per unit | Most RTS games for a single unit's order; StarCraft II over a navigation mesh | One unit, one goal, a big map | A hundred units with the same goal search a hundred times, and replan every time a building falls or a crowd moves |
| Jump point search | Uniform grids in many indie games | A\* made fast on a grid where every step costs the same | Our steps do not cost the same: a row counts two columns, scrub two, burning ground four |
| Hierarchical A\* | Large maps (Factorio's biters search chunks first, then tiles) | Maps of hundreds of thousands of tiles | Ours are a few thousand tiles; a whole field is microseconds |
| Navigation mesh and steering | StarCraft II, most 3D games | Smooth movement in continuous space; units flock and slide round each other | The Grid is whole tiles and whole ticks; steering is continuous and its results are hard to make identical on two machines |
| **Flow field / Dijkstra map** | Supreme Commander 2 and Planetary Annihilation for crowds; Brogue and other roguelikes for monsters | Many units, few goals; every tile answers "which way from here"; a change to the map is in the next field for free | **Chosen** |

What decided it:

- **Many units, few goals.** A side has one march goal and a handful of targets. One field toward the enemy Nexus
  serves every unit going there; a crowd of a hundred costs one search.
- **The Grid changes under the battle.** Buildings fall, fights stand still and break up. A field worked out each
  tick from that tick's Grid needs no repair and holds no stale route.
- **Pushed off the line costs nothing.** A unit that steps round a friend, is shoved, or is trained mid-battle reads
  the field where it stands. An A\* path would have to be searched again.
- **Fairness is easy to prove.** Whole numbers, no order of reading, ties broken by facing and then the seeded stream:
  a mirrored map plays mirrored.
- **Fleeing comes free.** The same machinery, turned round, is the roguelikes' "safety map": the walk away from every
  threat at once, toward open ground and not into a corner.

What it gives up: there is no single line to show. The field is everywhere at once, and today the only line the army
keeps to is a straight one from the Commander to the goal, used to break ties between equally good steps. That is the
first thing this review recommends changing (below).

### Formation: Age of Empires' lines, without its orders

Age of Empires II's formations put melee in front and ranged behind, and march the group at its slowest unit's pace.
Terminal Nexus has no orders, so its formation is a default: each unit knows its line (melee, short range, long
range, flanker), and a marcher waits while it is ahead of its place. The pace question is answered by content: a
trooper and a marksman step at the same pace, so the wait happens once (the shooters let the melee pass, two to three
seconds at the start) and then everyone walks in step. A line faster than the line ahead of it would stop and go.

### Targeting: the auto-battlers and Clash Royale

Every game where the player does not command units in battle has had to make targeting readable:

- **Clash Royale**: a troop walks toward the nearest enemy building in its lane, turns to a troop that comes within its
  sight range, and **locks on** once it starts attacking. Players learned to exploit every part of that: a building
  placed in the middle "pulls" a Hog Rider off its way to the tower; a cheap troop tanks the first hits; a spell that
  resets the lock breaks a charge.
- **Mechabellum**, the round-based model this game's rounds already follow: units go for the nearest enemy, so cheap
  "chaff" draws the first volleys and placement decides who meets whom.
- **Warcraft III's Castle Fight and StarCraft II's Desert Strike**: buildings send waves on a timer that walk the lane
  on their own; where a building stands and what it sends are the whole game.

Terminal Nexus takes the same shape: nearest first, within a fixed reach, buildings included. It does not have
Clash Royale's lock-on.

### Breaching: tower defence, and the games where the horde breaks walls

In mazing tower-defence games (Desktop Tower Defense, Gem TD) the creeps walk round whatever the player builds, so the
player builds a maze, and the rule that a maze may never close the way completely is what keeps it a game. In They Are
Billions and Factorio the attackers break what stands in their way. Terminal Nexus does both: troops walk round
buildings while there is a way, and break the fewest when there is none. The engage reach keeps mazing honest: a unit
walking past a building within 6 columns turns to fight it, so a maze's walls are bait, and a long maze is torn down,
not walked.

## Is it good? The explanation as a test

### Is it simple?

**The player's version is seven rules, and that is a good sign.** The engine underneath has about twenty numbers,
but most of them never need to reach a player:

| A player needs | A player never needs |
| --- | --- |
| Engage reach: 6 columns, 3 rows (12 for a Commander who charges) | The guide band (6 columns), how near an ally must be to be waited on (12) |
| The formation's places: melee beside the Commander, short 4 behind, long 8 behind | The spacing between lines (4 a line), what "ahead" is measured on |
| A building's wave: 5 seconds into the round, from its roof | Roofs keeping room for a wave, making way |
| The Nexus: 40 a shot every 3 seconds, at a reach of 6 | A building weighing 8 steps when breaching; burning ground weighing 4 |
| Workers run from a threat's range and 2 | The flight map's scale (1.2) |

The left column fits on a unit's card and a line of a tutorial. The right column only shapes how it looks.

**The weak point is that none of it is on screen.** A player cannot see the 6 columns, cannot see the way their army
or the enemy's will walk (except a mission's raid trail), and cannot see when a building's wave will arrive. The rules
are simple; the player still has to take them on faith.

### Is it smooth?

What was watched, tick by tick, in text (not on a terminal):

- **The march** (`march-lines`): shooters set down ahead of the troopers stand still for two to three seconds while
  the troopers pass, then the army walks in step, the troopers in front, the marksmen 8 or 9 columns behind, the mortar
  behind them. Every unit steps on its own cadence, every 4 ticks for a trooper and a marksman, with no stutter once
  the lines are sorted. **The first motion of a round is shooters waiting.** Whether that reads as discipline or as
  hesitation is for Mario's eye.
- **A duel's attack round** (Vasse against Dob, the Crossing, seed 1, round 3): the Commander and the veterans march
  as one column; the round's waves come out 5 seconds in and trail it by about 15 columns. Producers built behind the
  Nexus, as the play strategies advise, send waves that are still walking up 20 seconds later, a slow, steady
  trickle into the fight.
- **Crowds** spread round a fight rather than queue behind it, and in a narrow gap a yielder swaps with the ally
  behind it; the route scenarios hold both.

### Is it predictable?

It is **deterministic**: the same plan, map and seed give the same battle. Whether a player can **predict** it is
another matter, and three things get in the way, each measured on scripted duels on the Crossing with the balanced
and the rush players (scratch scripts, not kept as a measurement): target changes over 12 duels (Vasse against Dob,
Vasse against Averno, Averno against Dob, seeds 1 and 2), first clashes over 24 (those and Dob against Vasse, seeds 1
to 3, to round 4):

1. **The route is invisible.** A player who places a building to bend the enemy's way cannot see whether it did.
2. **Units change targets often.** Troopers changed target 6,818 times and landed 4,316 hits; 2,884 times a trooper
   turned away from an enemy unit still alive, 741 of them while touching it. Marksmen dropped a target they could
   still shoot 82 times in 701 shots. Most of a trooper's changes are while walking ("the nearest one moved"), which
   reads naturally; the ones in reach are what makes a fight hard to read and baiting unreliable.
3. **Waves are reinforcements, not the opening army.** The first clash came at a median of 5.7 seconds (62 attack
   rounds, earliest 4.1, latest 9.1); the waves come out at 5. The formation the player sees in the march is the
   veterans', and what a building contributes is decided by how far it stands from the front.

### Can a player exploit it?

Yes, and that is the strongest thing about the current design. What a player can already do on purpose:

- **Bait.** A cheap building within 6 columns of the enemy's way pulls its front off the march, under your guns or
  your Nexus's. (Duels found the converse: a side's own buildings in the enemy's road are razed.)
- **Funnel.** Rock and buildings together leave one gap; the enemy walks round your buildings to it; a mortar's fire
  on the gap is fire on the whole army.
- **Choose the breach.** Seal every way, and the enemy breaks the cheapest point: make one point thinner, and you
  chose where they come through.
- **Place production for the trade-off.** Behind the Nexus is safe and slow to reinforce; forward reinforces fast and
  is razed.
- **Spread against area damage, block against a line clash** (measured, in the play strategies).
- **Hold.** In duels, holding in front of the Nexus under its guns is a real strategy for a defender.
- **Chaff and flankers.** Nearest-first means cheap fast units soak the first volleys, and a flanker goes for the
  shooters behind them.

What a player cannot do yet: send the army somewhere other than the enemy Nexus (banners), see any of the above
happening before the round, or count on a bait holding a unit once a closer enemy walks by.

### Does it feel intuitive in motion?

This review could not answer that, and the text cannot. The scenarios that show each part, for Mario to watch:
`./bin/grid.ts scenarios/march-lines` (the shooters wait, then the army walks in step), `scenarios/march-guide`
(the Commander leads), `scenarios/route-breach` (troops break the one building in the way),
`scenarios/route-crowd` (a crowd spreads round a fight), and a run's battle from the title screen for all of it at
once.

## What to change, in order

Each is a question in the register with a recommendation; none is built.

1. **Show the march route, and make it the guide.** Both sides' march routes, the field walked downhill from the
   Commander (or the Nexus) to the goal over rock and buildings, drawn on the Build Phase map and redrawn as a building
   is placed; the guide line the formation keeps to becomes that route instead of a straight line through rock. It is
   Mario's "central path", it makes rule 6 visible, and it is the line a banner bends. Small in the kernel (the march
   field already exists), larger on screen.
2. **Lock-on once in reach**, behind an Experiment: a unit whose attack reaches its target keeps it until it falls or
   leaves reach, and still chooses the nearest while walking. It removes the switching that makes a fight hard to
   read, and makes bait and tanking reliable, as in Clash Royale. Measured before and after.
3. **Banners, staged**: first the duel's stance in a run's Build Phase (attack, or hold before the Nexus: one key);
   then a primary banner placed on the map, attack or hold, the Commander following it; then skirmish banners on
   buildings, if the primary proved readable. The machinery is ready: hold is a side's target (built), attack is a
   waypoint that needs no memory (`movement.md`, banners).
4. **Call the backliner a flanker.** "Backliner" reads as a unit that stays at the back, which is the opposite of
   what it does; flanker says it goes round the front, and the bench already has a unit by that name.
5. **Workers, when Milestone 7 builds them**: the nearest free job by walk (one shared field), flight with a margin
   and a wider margin to come back, and back to work after (written into `movement.md` as guidance).
6. **Waves as reinforcements: keep, and show.** That a forward building reinforces sooner is a real trade-off, and the
   kind Mario asked for ("tradeoffs that pay off on later rounds"). What is missing is seeing it: the Build Phase could
   say when and where each wave comes out. The first wave's time is a tuned setting (5 seconds) if the waves should
   leave with the army instead.

What to keep as it is: the shared field rebuilt each tick, every round starting from the base, nothing about a unit
remembered between ticks, and one engage reach for everyone. Each is part of why the seven rules are enough.

## Addendum, 2026-10-28: why units changed target so often

Mario asked "what's wrong with so much re-targeting". The same 12 duels were played again on the kept front and every
change of target was classified by the step of target choice that dropped the old one (scratch scripts, not kept).

- **Troopers held a living target a median of 4 ticks** (a third of a second); 3,389 of their 6,661 changes left a
  target still alive, 500 of them while it was already in reach.
- **The largest cause is a mismatch**: whether an enemy is within reach is measured by range, but a melee unit then
  asks how far it is to *walk*, and drops the target when the walk is longer than the reach. A unit at the edge of its
  reach dropped and picked again every few ticks: about 1,540 of the troopers' changes, and 298 times it dropped a
  target and picked the same one again within a second.
- **The second is taking the nearest afresh every tick**, by range and then by walk, with the old target only a
  tie-break. It is almost all of the marksmen's changes, and the Nexus's gun re-aimed 864 times.
- **Not causes**: switching between the march and an enemy (4 cases), breaching (under 100), flankers.

A simulated rule — keep the target until it falls, or until 30 ticks pass without being able to strike it or closing
on it — would have kept 99% of those changes from happening. That is the rule built, with the walk-too-long drop fixed
at its root.
