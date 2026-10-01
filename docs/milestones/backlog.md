# Backlog — work no milestone owns yet

## Completing the Pulse kernel

### Why this document exists

An earlier plan described the next horizontal pass after the Pulse Playground: finish routing, add the economy, add production, add visibility, lock the
replay format — the whole kernel, completed in one wide sweep, before anything narrower was built on
top of it.

Mario redirected the roadmap instead: **campaign-first, one level at a time.** Each level is a small
vertical slice — a Build Phase, a Pulse, a story wrapper, one map — and a level pulls in only the
piece of this backlog it actually needs, when it needs it, rather than waiting for all of it to land
first. That became [`docs/milestones/`](README.md)'s milestone sequence once it was clear the first
level needed most of the game's unbuilt systems at once; this document is where the original
horizontal plan still lives, so none of that design work is lost and a future level can cite it.

**Nothing here is deleted, and nothing here is more authorized than it was.** This is still GUIDANCE
and locked-contract material exactly as it was under the old Milestone 2 — the only thing that changed
is that no single gate owns "build all of this" any more. Treat a section below as live the day some
level's own contract cites it, and not before.

### What the spike deferred, and no single gate now owns outright

- **Routing.** Real pathfinding around obstacles: weighted terrain, routes to a legal attack position
  rather than to an occupied tile, temporary danger cost for fleeing workers, deterministic
  tie-breaking, and bounded recalculation when a contested destination changes. The spike's greedy
  step will strand units on rock; this is where that stops being acceptable. **Sharper since four-way
  movement** (Mario's own choice after watching the first battles): under Manhattan distance every legal step changes
  distance by exactly ±1, so an actor whose approach is exactly on-axis with its goal and meets an
  obstacle has no fallback direction at all — not a stall to route around, a hard dead end.
  `docs/milestones/open-questions.md` Q15 has the measurement; whichever level first needs real routing is where
  it gets an actual fix.
- **Behaviour states.** The owner's viewing: "units should have a default movement direction
  (towards the enemy Nexus, closest resources, etc) and then activate a different pathfinding mode
  when there are enemies in range... defining multiple states will allow more complex and engaging
  behaviours later." The spike has exactly one behaviour per unit (`advance`, `flee`, or `static`)
  and no notion of "moving toward an objective" versus "engaged and repositioning for a shot" — the
  same state the whole session. A state machine is also the natural home for "declare a target, then
  find a free attack position, and rescan often" (the owner's routing note two lines up) and for the
  adjacent-unit spacing item below: a unit *advancing* wants to keep a respectful distance from its
  own side, a unit *engaged* in melee contact does not, and only a named state distinguishes the two
  cases cleanly.
- **Adjacent-unit spacing.** The owner's viewing, watching two troopers converge: "two troopers with
  a space apart 'T T' look good, but together 'TT' look like they combined into a larger unit... it
  is good to keep one space when moving, with a few exceptions — when melee units attack each other,
  it is fine that they touch." Not a routing bug — the spike's collision rules already forbid two
  units sharing a tile — but a *formation* preference layered on top of legal movement, and one that
  needs to know "am I advancing or already in a fight" to apply only half the time. Depends on the
  behaviour-states item above rather than standing alone.
- **Economy and production.** The empty tick phases get their content: worker jobs, deposits, storage,
  salvage, supply cap, and the seeded production-contention process from
  [`engine.md`](../system-design/grid-engine.md) Section 5.3. **Level 1 pulls in a slice of this directly** — see
  [`docs/milestones/milestone-07-worker-economy.md`](milestone-07-worker-economy.md) — so
  this item is already partially in motion; what stays here is the parts that milestone does not need:
  multiple resource-yielding structures, storage/warehouse capacity, and a full deposit/salvage economy.
- **Target scoring.** Something better than nearest-enemy, with the score and reason carried on the
  event so presentation and players can both explain a choice.
- **Visibility projection.** `PlayerView` and visible-event filtering, so hidden plans stay hidden.
  Untested until something is hidden. A scripted single-player opponent (campaigns.md Section 6) may
  not need this at all — a level only pulls this in once a mission actually hides something from the
  player, which none of the belief-ramp's early missions currently need to teach.
- **Replay format.** The full game log of [`engine.md`](../system-design/grid-engine.md) Section 4.4: content locks, hashes,
  versions, and a `verify` path that re-simulates recorded inputs. [`replay-format.md`](../system-design/replay-format.md)
  is the starting design.

### Contracts locked by Milestone 1

These were promoted rather than invented: each one is a thing the Playground built, ran and asserted,
and each is now RULE in the document that owns it. **Do not re-litigate them; build on them.** The
citation is where the evidence lives. This table is unrelated to the campaign-first pivot — it is
restated here only because it lived in this document before the pivot, and nothing about it changed.

| Contract | Locked as | Evidence |
| --- | --- | --- |
| **The named PRNG and its published vectors** | PCG32, the `pcg_setseq_64_xsh_rr_32` variant. Streams separated by `initseq` | [`engine.md`](../system-design/grid-engine.md) 4.4; `tests/rng.test.ts` checks it against `imneme/pcg-c`'s own expected output, seeded 42/54 |
| **Stable entity ordering and every tie-break** | An entity's ordinal is assigned at scenario load, scanning north to south then west to east, and never reused. All iteration and every tie-break uses it. Contested claims resolve by speed tier, then by **one** draw from the seeded stream. Ordinals order event emission, never outcomes | [`engine.md`](../system-design/grid-engine.md) 4.3; `tests/rules.test.ts`, `tests/determinism.test.ts` |
| **Canonical serialization and hashing** | Keys sorted at every depth, integers only — a non-integer is refused rather than rounded — then sha256. Events are one canonical JSON object per line | [`engine.md`](../system-design/grid-engine.md) 4.4; `parse(serialize(state))` hashes identically for every scenario, and Bun and Node agree on every hash |
| **The exact normative tick and event order** | The nine phases of [`engine.md`](../system-design/grid-engine.md) 4.3, now RULE. Economy and production are phases 2 and 3; a level fills them the way it needs them, without moving them | [`engine.md`](../system-design/grid-engine.md) 4.3 |
| **The recalculation progress measure and its bound** | The number of unresolved movers, which strictly decreases every pass because each conflict group yields exactly one winner. The bound is the intent count plus one, and reaching it emits a `WARN` | [`engine.md`](../system-design/grid-engine.md) 4.3; `tests/rules.test.ts` drives a jammed corridor and asserts the bound is never reached |
| **12 Hz and the movement-credit rules** | **Confirmed and promoted to RULE.** The cadence table reproduces exactly at all eight rates; credit is capped at one step's cost; a blocked step keeps its credit and moves the tick the tile frees | [`engine.md`](../system-design/grid-engine.md) 4.1 and 4.2; `tests/rules.test.ts` |
| **Mutual destruction and victory ordering** | Attacks resolve by speed tier, lowest first; within a tier every attack is computed against the state at tier start and applied together, so two actors that kill each other both die. Victory is checked in phase 9 in this order: Grid Nexus destroyed, annihilation, tick limit. A side is only eligible to lose a condition it could have lost — a side that never had a mobile entity is not "annihilated" at tick one | [`engine.md`](../system-design/grid-engine.md) 4.3 and 5; `tests/rules.test.ts`, `tests/scenario.test.ts` |
| **Death is a queue, and it can cascade** | Where content detonates on death, the blast damages friend and foe and anything reduced to zero joins the queue. Bounded because an entity can only die once, so the cascade settles inside its own tick | [`engine.md`](../system-design/grid-engine.md) 4.3; `tests/ravel.test.ts` |
| **Collision masks** | Lazy views over one incrementally maintained occupancy index, with an overlay so arbitration sees tiles claimed earlier in the same tick. Never a materialised boolean grid | [`engine.md`](../system-design/grid-engine.md) 3.4.1 |

#### The one contract Milestone 1 did **not** lock

**Replay input, authority, and verification.** `grid` hashes final state and the ordered event
stream, and `grid --verify` re-resolves a scenario and compares — which proves the kernel is
deterministic, not that a *recording* can be replayed. The full game log of
[`engine.md`](../system-design/grid-engine.md) 4.4 — content locks, versions, committed plans per Build Phase, and a
`verify` path that re-simulates recorded inputs rather than re-running a scenario file — is still
unowned by any single gate. It is the first thing worth doing once a level's own save/replay needs
force the question, because everything else here is easier to trust once a run can be replayed from
its record. [`replay-format.md`](../system-design/replay-format.md) is a first concrete schema for it, written up
ahead of any level needing it rather than from nothing — GUIDANCE, not a locked contract, meant to be
a starting point whichever level first needs it accepts, amends, or replaces.

### What Milestone 1 left unresolved here

Three registered questions land squarely in this backlog's scope. None blocks any level from
starting; each wants an answer before a level's contract that touches it is called locked.

| Question | What Milestone 1 measured | Where it bites |
| --- | --- | --- |
| **Q14** — should the movement tie-break be mirror-fair? | A fixed compass order makes both sides prefer *their own left*, so formations meet at an angle. Symmetric between sides, and seed variance dominates it | Real routing replaces the greedy step this question is about; answer it as part of that |
| **Q15** — what should a mover with no route do? | Greedy routing with a sidestep leaves an actor pacing between two tiles forever. The report detects it from net progress; the kernel does not | Pathfinding makes it moot, or makes it a deliberate choice. A level authored to avoid the on-axis dead end (map layout, not a kernel fix) may ship without either — see `docs/milestones/completed/milestone-02-campaign-design.md` Section 4.3's own note on this for PERIMETER specifically |
| **Q13** — where do workers flee, and what counts as annihilation? | Workers move at `1/1` and every fixture attacker at `3/4` or slower, so a fleeing worker on open ground is **never caught**. The mirror never reaches annihilation and always runs its full tick count | Real routing gives fleeing a danger cost, and an economy gives workers somewhere to be. Both change the shape of this question |

**Q17 dropped off this table, resolved, since it was written**: the step that shipped
four-way movement and Manhattan distance (Q15's own fix) removed Q17's degenerate tie as a side
effect — a rank-deployed army no longer puts every enemy at the same distance under Manhattan the way
it did under Chebyshev. Verified against `citizen-mirror-skirmish.ts`, not assumed. See
[`open-questions.md`](open-questions.md) Q17 for the mechanism. Target scoring inherits the fix
rather than owing anything further here.

One further thing Milestone 1 learned that is not a question: **a fixture for a movement rule should
have exactly one thing moving.** Three fixtures appeared to fail before anyone noticed that two
movers each rounding an obstacle drag each other's targets around, so the fixture was measuring an
orbit rather than a route.

### Evidence a future pull-in should still produce

Replaying a complete recorded input produces identical final-state and ordered-event hashes —
[`replay-format.md`](../system-design/replay-format.md) Section 4 is where the soundness of that claim is worked
through for a persisted, levelled recording rather than an in-memory `PulseRun`.

Property tests over generated Grids and seeds find no duplicate occupancy within a layer, no illegal
settled cell, no unresolved claim, no unbounded recalculation, no presentation dependency, and no
cosmetic draw taken from the gameplay stream.

Soak runs over many maps and seeds terminate, stay within a time budget, and never deadlock a
contested corridor.

Answers to Q5 and Q7 in [`open-questions.md`](open-questions.md), earned rather than assumed.

## Decisions fine to leave open for now

Decisions that **block or shape current work** live in [`open-questions.md`](open-questions.md), with
options, costs, and a recommendation each. The list below is the longer horizon: things that are
genuinely fine to leave unanswered until the project reaches them.

- exact Citizen and Ravel commanders and Commander Armies;
- **whether a Commander Army is well modeled as a deck of cards at all**, versus a composite of separate systems (units, structures, a Commander, faction rules, Nexus powers) that only share a legality check — retracted as a claim, deliberately left for building and playing to settle;
- **whether Specials earn a third Build Phase decision channel at all**, beside placement and the Nexus draft — the newest and least-evidenced part of the composition (`commander-armies.md` Section 2.1), left the same way: Milestone 5 builds the slot, Milestone 6 plays the first whole loop, and only then is it defended or retired;
- drafting modes and player-defined Commanders — kept possible by the pool shape of `commander-armies.md` Section 2.1, designed only when a milestone wants them;
- the army-breadth caps (army structures/tech tree depth, Nexus powers, Specials) and the size of the hand each Build Phase deals;
- the run's exact numbers (battles, acts, offer size, tier schedule), difficulty ladders, daily seeds, and leaderboards — `game-modes.md` Section 6, retuned by Milestone 11 on runs actually played;
- radius metric, same-plan chaining, and hidden reveal conflicts;
- equal-tick mutual Nexus destruction;
- exact Nexus draft timing and research stacking;
- scoring and long-term skirmish progression;
- campaign cast, sequence, and ending;
- final title availability and trademark clearance;
- sound direction;
- commercial/open-source/community release model;
- multiplayer format;
- whether an LLM role proves worthwhile;
- whether the first browser path is hosted terminal parity or browser-native graphics;
- when a Rust or Go boundary becomes worth its complexity.

(12 logical ticks per second and the movement-credit rules were once on this list; Milestone 1
confirmed them and they are RULEs in [`pulse.md`](../system-design/pulse.md).)

## Deferred systems

### Local campaign opponents

Single-player opponents begin as deterministic local policies receiving the same bounded planning view and legal action vocabulary as a human. Scripted tutorials, weighted heuristics, and limited rollouts may share that interface. A campaign policy may cheat only when the mission communicates the exception.

### Multiplayer and model-driven AI

Hidden simultaneous plans and deterministic resolution fit asynchronous or live multiplayer, but networking waits for exact replays, content locks, plan validation, reveal rules, and a balanced two-faction match.

An LLM may later return a constrained legal plan, provide dialogue, answer contextual help, or add campaign texture. It does not mutate rules or become a dependency of the core game.

### Sound

**TBD — dedicated research and design pass required.** Stable semantic presentation cues should leave a clean future subscription point for movement, attacks, destruction, restoration, and Nexus states. No sound dependency belongs in Milestone 1.
