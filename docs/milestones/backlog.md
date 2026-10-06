# Backlog — work no milestone owns yet

The campaign is built one level at a time, and a level pulls in only the piece of this list it needs, the
day its own mission needs it. Nothing here is more authorized than it was; it is guidance, not a plan.

## Completing the Pulse kernel

### What is not built yet

- **Routing.** Real pathfinding around obstacles: weighted terrain, routes to a legal attack position
  rather than to an occupied tile, temporary danger cost for fleeing workers, deterministic
  tie-breaking, and bounded recalculation when a contested destination changes. The spike's greedy
  step will strand units on rock; this is where that stops being acceptable. **Sharper since four-way
  movement** (Mario's own choice after watching the first battles): every legal step changes the distance to the
  goal, by one across or two up or down, so an actor whose approach is exactly on-axis with its goal and meets an
  obstacle has no fallback direction at all, a hard dead end rather than a stall to route around.
  [`open-questions.md`](open-questions.md) Q15 has the measurement; whichever level first needs real
  routing is where it gets an actual fix.
- **Behaviour states.** The owner's viewing: "units should have a default movement direction
  (towards the enemy Nexus, closest resources, etc) and then activate a different pathfinding mode
  when there are enemies in range... defining multiple states will allow more complex and engaging
  behaviours later." The spike has exactly one behaviour per unit (`advance`, `flee`, or `static`) and
  no notion of "moving toward an objective" versus "engaged and repositioning for a shot". A state
  machine is also the natural home for "declare a target, then find a free attack position, and rescan
  often" and for the spacing item below: a unit *advancing* wants to keep a respectful distance from its
  own side, a unit *engaged* in melee contact does not, and only a named state tells the two apart.
- **Adjacent-unit spacing.** The owner's viewing, watching two troopers converge: "two troopers with
  a space apart 'T T' look good, but together 'TT' look like they combined into a larger unit... it
  is good to keep one space when moving, with a few exceptions — when melee units attack each other,
  it is fine that they touch." Not a routing bug (the collision rules already forbid two units sharing a
  tile) but a *formation* preference layered on top of legal movement, and one that applies only
  half the time. It depends on the behaviour-states item above.
- **Economy and production.** The empty tick phases get their content: worker jobs, deposits, storage,
  salvage, supply cap, and the seeded production-contention process described in
  [`pulse.md`](../system-design/pulse.md). **Level 1 pulls in a slice of this directly**
  ([`milestone-07-worker-economy.md`](milestone-07-worker-economy.md), and step 6C for a Barracks that
  trains), so what stays here is the rest: several resource-yielding structures, storage and warehouse
  capacity, and a full deposit and salvage economy.
- **Target scoring.** Something better than nearest-enemy, with the score and reason carried on the
  event so presentation and players can both explain a choice.
- **Visibility projection.** `PlayerView` and visible-event filtering, so hidden plans stay hidden.
  Untested until something is hidden; a scripted single-player opponent
  ([`campaigns.md`](../game-design/campaigns.md), campaign opponent policies) may not need it, so a level
  pulls it in only once a mission actually hides something from the player.
- **Replay format.** The full game log: content locks, hashes, versions, committed plans per Build Phase,
  and a `verify` path that re-simulates recorded inputs rather than re-running a scenario file.
  [`replay-format.md`](../system-design/replay-format.md) is the starting design and works through why a
  persisted recording replays soundly. `grid` today hashes final state and the ordered event stream and
  `grid --verify` re-resolves a scenario, which proves the kernel is deterministic but not that a
  *recording* can be replayed. It is the first thing worth doing once a level's own save or replay needs
  force the question.

The contracts Milestone 1 built and tested (the named PRNG, stable entity ordering and tie-breaks,
canonical hashing, the tick and event order, the recalculation bound, 12 Hz and movement credit, mutual
destruction and victory ordering, death cascades, collision masks) are RULEs in
[`pulse.md`](../system-design/pulse.md) and [`grid.md`](../system-design/grid.md), each with its test.
Build on them; do not re-litigate them here.

### Questions that land in this backlog

None blocks any level from starting; each wants an answer before a level's contract that touches it is
called settled.

| Question | What was measured | Where it bites |
| --- | --- | --- |
| **Q14** — should the movement tie-break be mirror-fair? | A fixed compass order makes both sides prefer *their own left*, so formations meet at an angle. Symmetric between sides, and seed variance dominates it | Real routing replaces the greedy step this question is about; answer it as part of that |
| **Q15** — what should a mover with no route do? | Greedy routing with a sidestep leaves an actor pacing between two tiles forever. The report detects it from net progress; the kernel does not | Pathfinding makes it moot, or makes it a deliberate choice. A level authored to avoid the on-axis dead end (map layout, not a kernel fix) may ship without either, as PERIMETER's own note in [`campaigns.md`](../game-design/campaigns.md) says |
| **Q13** — where do workers flee, and what counts as annihilation? | Workers move at `1/1` and every fixture attacker at `3/4` or slower, so a fleeing worker on open ground is **never caught**. The mirror never reaches annihilation and always runs its full tick count | Real routing gives fleeing a danger cost, and an economy gives workers somewhere to be. Both change the shape of this question |

Q17 (the degenerate tie of a rank-deployed army) resolved itself when four-way movement and Manhattan
distance shipped, so target scoring owes nothing further for it; [`open-questions.md`](open-questions.md)
has the mechanism. One lesson from this work: **a fixture for a movement rule should have exactly one
thing moving**, because two movers each rounding an obstacle drag each other's targets and the fixture
then measures an orbit rather than a route.

### What a pull-in should prove

- Replaying a complete recorded input produces identical final-state and ordered-event hashes.
- Property tests over generated Grids and seeds find no duplicate occupancy within a layer, no illegal
  settled cell, no unresolved claim, no unbounded recalculation, no presentation dependency, and no
  cosmetic draw taken from the gameplay stream.
- Soak runs over many maps and seeds terminate, stay within a time budget, and never deadlock a contested
  corridor.
- Answers to Q5 and Q7 in [`open-questions.md`](open-questions.md), earned rather than assumed.

## The Pulse screen (Mario, 2026-10-01)

After playing PERIMETER across three rounds Mario named what the Pulse screen lacks, and said it can wait for
the right time ([his words](../history/feedback/2026-10-01-multi-pulse.md)). It is interface work, which he
puts before any level's balance:

- **Look at units during a Pulse.** "I should be able to hover over units and see their details, same as with
  the Explore feature": pointing at a unit while a Pulse plays (the mouse, or a cursor the keyboard moves)
  shows the card Explore Map shows in the Build Phase. Playback stays read-only.
- **Fewer numbers.** "The pulse doesn't need to track that many stats": today the panel shows, for each side,
  a count of units, a health bar and a health total, and a feed line for every shot and death. Keep what a
  player reads in a fight; drop the rest.

His third note, how many enemies are coming, is built: the Build Phase shows the coming raid, its count and
what each group goes for first (the Commander's second round).

## Intent, the next iteration (Mario, 2026-10-04)

The raid's intent is built (a trail to each group's first target, the target marked, the panel's summary), and
Mario liked it; the next pass is his ([his words](../history/feedback/2026-10-04-commander-round-3.md)):

- **Your own units' targets.** "Your units should also have a clear target to property be an auto-battler":
  show what each of the player's groups goes for first. The prediction already has it: the first kernel tick
  the raid's forecast runs (`src/match/intent.ts`) chooses a target for every unit on both sides.
- **Intent that does not look like a tower defence.** "We will iterate more about how to show intent without
  lookong like a tower defense game": lanes of arrows read as a tower defence. Ideas to try, each an Experiment:
  a mark on what each side hits first and no trail; a trail only for the group under the cursor; where two
  groups will first meet; the card saying what a unit goes for, either side.

## Posts for your squads (Mario, 2026-10-04)

A post is a place a group of the player's troops holds, rather than the level's target they head for. Mario
liked the idea and put it after placement ([his words](../history/feedback/2026-10-04-commander-round-4.md)):
"maybe this can be an experiment, perhaps that is a type of building. But before we start playing with posts,
I would like to go deep on the simple building placement first." What exists to build it on: a level names the
target the player's troops head for, and they stand there when nothing is in reach (the order "head for a
place" is built; "hold" is the half of that open question still waiting). Two shapes to try, each an
Experiment: a post as a building (a flag placed in territory that the nearest squad holds), or a post as an
order given to a group from the Build Phase.

## Decisions fine to leave open for now

Decisions that **block or shape current work** live in [`open-questions.md`](open-questions.md), with
options, costs, and a recommendation each. The list below is the longer horizon: things that are
genuinely fine to leave unanswered until the project reaches them.

- exact Citizen and Ravel commanders and Commander Armies;
- whether a Commander Army is a deck of cards at all, or a composite of separate systems that share a legality check: left for building and playing to settle;
- whether Specials earn a third Build Phase decision channel beside placement and the Nexus draft: Milestone 5 builds the slot, Milestone 6 plays the first whole loop, and only then is it defended or retired ([`commander-armies.md`](../game-design/commander-armies.md));
- drafting modes and player-defined Commanders: designed only when a milestone wants them;
- the army-breadth caps (structures and tech tree depth, Nexus powers, Specials) and the size of the hand each Build Phase deals;
- the run's exact numbers (battles, acts, offer size, tier schedule), difficulty ladders, daily seeds and leaderboards ([`game-modes.md`](../game-design/game-modes.md)), retuned by Milestone 11 on runs actually played;
- hidden reveal conflicts, and building inside enemy coverage;
- equal-tick mutual Nexus destruction;
- exact Nexus draft timing and research stacking;
- scoring and long-term skirmish progression;
- campaign cast, sequence, and ending;
- final title availability and trademark clearance;
- sound direction;
- commercial, open-source or community release model;
- multiplayer format;
- whether an LLM role proves worthwhile;
- whether the first browser path is hosted terminal parity or browser-native graphics;
- when a Rust or Go boundary becomes worth its complexity.

## Deferred systems

### Local campaign opponents

Single-player opponents begin as deterministic local policies receiving the same bounded planning view and legal action vocabulary as a human. Scripted tutorials, weighted heuristics, and limited rollouts may share that interface. A campaign policy may cheat only when the mission communicates the exception.

### Multiplayer and model-driven AI

Hidden simultaneous plans and deterministic resolution fit asynchronous or live multiplayer, but networking waits for exact replays, content locks, plan validation, reveal rules, and a balanced two-faction match.

An LLM may later return a constrained legal plan, provide dialogue, answer contextual help, or add campaign texture. It does not mutate rules or become a dependency of the core game.

### Sound

**TBD — dedicated research and design pass required.** Stable semantic presentation cues should leave a clean future subscription point for movement, attacks, destruction, restoration, and Nexus states. No sound dependency belongs in Milestone 1.

### Feedback from players beyond the playtest page

Notes made inside the game (point at something, say why, collect a few), reports routed to a pull
request, an issue or a file with enough to replay exactly what the player saw, and an agent that sorts
reports against the design documents. Mario parked it for now: the loop he uses is Experiments, the
Activity Logs and the claude.ai playtest page, with feedback in words, screenshots and voice the
ordinary way. What was considered, why it is parked, and what this game already has that would make it
cheap (exact replays, screens as text, a hit-test, state fingerprints) is in
[`docs/history/reports/2026-10-01-feedback-pipeline-parked.md`](../history/reports/2026-10-01-feedback-pipeline-parked.md).
Mario also asked to keep an eye out for a richer playtest tool someone else builds (pause, talk, point,
replay in slow motion) and to look for easy ways to plug into it.
