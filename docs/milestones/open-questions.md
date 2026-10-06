# Terminal Nexus — open questions

The register of decisions waiting on Mario. Each question has its options, what each costs, and a
recommendation; a question without a recommendation is unfinished. Ids are permanent: never renumbered,
never reused. When Mario answers, or the code settles it, the question moves to
[answered-questions.md](../history/answered-questions.md) and the decision goes into the design document
that owns it.

- `OPEN` — waiting on Mario, or parked until the milestone or backlog entry named in "Waits on".
- `OBSERVABLE` — deferred on purpose; an Experiment or a later step will show both answers.
- `ANSWERED` — decided; recorded in [answered-questions.md](../history/answered-questions.md).
- `DROPPED` — no longer relevant; the entry stays and says why.

Decide it yourself if it is reversible, make it observable with an Experiment if you can, register it here only
when it is genuinely his call, state the assumption you proceed under, then keep working
([`DEVELOPMENT.md`](../../DEVELOPMENT.md), "Changing the design").

## Index

Two are ready for Mario to decide now ("Mario, now"); every other question is parked until the
milestone or backlog entry named, and nothing in the current milestone is blocked by any of them.

| Id | Question | Status | Waits on |
| --- | --- | --- | --- |
| [Q5](#q5--what-is-the-default-construction-radius) | What is the default construction radius? | OBSERVABLE | Mario's playtest of the Build range Experiment |
| [Q7](#q7--do-workers-carry-or-produce-in-place) | Do workers carry, or produce in place? | OPEN | Milestone 7 (worker economy), for the storage half |
| [Q13](#q13--where-do-workers-flee-and-what-counts-as-annihilation-on-a-grid-with-no-nexus) | Where do workers flee, and what counts as annihilation, with no Nexus? | OPEN | Backlog: routing and economy |
| [Q14](#q14--should-the-movement-tie-break-be-mirror-fair-or-is-a-fixed-compass-order-enough) | Should the movement tie-break be mirror-fair? | OPEN | Backlog: routing |
| [Q15](#q15--what-should-a-mover-with-no-route-do-circle-or-stop) | What should a mover with no route do? | OPEN | Backlog: routing |
| [Q19](#q19--where-should-a-sandbox-placement-mode-rewind-and-fast-forward-and-a-feedback-replay-engine-live) | Where do a sandbox, rewind and a feedback replay live? | OPEN | Backlog: replay format |
| [Q20](#q20--when-target-selection-is-capped-by-radius-for-scale-what-should-a-unit-with-nothing-in-range-do) | What does a unit with nothing in range do, once targeting is capped for scale? | OPEN | Backlog: scale, once perception is a measured cost |
| [Q22](#q22--should-movement-carry-deterministic-terrain-based-jitter) | Should movement carry deterministic jitter? | OPEN | Backlog: movement feel |
| [Q23](#q23--how-does-an-army-reach-its-first-engagement-faster-beyond-raw-movement-speed) | How does an army reach its first engagement faster? | OPEN | Backlog: multi-Pulse regrouping via outposts |
| [Q26](#q26--is-a-unit-that-spawns-other-units-a-combat-ability-rather-than-production-or-does-mario-need-to-sign-off-before-real-content-uses-it) | Is a unit that spawns units a combat ability or production? | OPEN | Milestone 7 (worker economy) and Milestone 12 (content) |
| [Q27](#q27--should-ground-cannot-target-air-be-the-schemas-default-not-an-opt-in-field) | Should "ground cannot target air" be the default? | OPEN | Milestone 12 (first played air roster) |
| [Q28](#q28--can-a-spawner-only-side-become-permanently-un-annihilatable) | Can a spawner-only side become un-annihilatable? | OPEN | Milestone 12 (first spawner roster) |
| [Q31](#q31--what-shape-does-an-unlock-record-take-with-no-save-system-yet) | What shape does an unlock record take? | OPEN | Milestone 4 (campaign menu) |
| [Q35](#q35--what-counts-as-discovered-enemy-intel-and-when-is-it-recorded) | What counts as "discovered" enemy intel? | OPEN | Milestone 4 (campaign menu) |
| [Q38](#q38--does-perimeters-own-map-need-real-scrolling-or-does-milestone-5-prove-scrolling-on-different-content) | Does PERIMETER's own map need real scrolling? | OPEN | Mario, now |
| [Q40](#q40--within-a-run-what-persists-from-one-battle-to-the-next) | Within a run, what persists from one battle to the next? | OPEN | Milestone 11 (Challenge runs) |
| [Q51](#q51--when-should-the-game-get-a-real-accent-colour-palette-with-variations-per-faction) | When does the game get a real accent-colour palette per faction? | OPEN | Milestone 8 (second faction on screen) |
| [Q53](#q53--does-the-game-want-a-jump-to-my-next-structure-key-and-which-one) | Does the game want a "jump to my next structure" key? | OPEN | Backlog: keyboard play |
| [Q59](#q59--should-an-m-map-popup-show-the-whole-grid-at-once) | Should an `[m] Map` popup show the whole Grid? | OPEN | Backlog: map popup spike |
| [Q63](#q63--should-the-mouse-wheel-move-the-jump-distance-rather-than-5) | Should the wheel move the jump distance rather than 5? | OPEN | Mario's trackpad |
| [Q67](#q67--do-buildings-get-letter-hotkeys-or-stay-on-digits) | Do buildings get letter hotkeys, or stay on digits? | OPEN | Mario, now |
| [Q69](#q69--should-units-be-able-to-hold-withdraw-or-head-for-a-place-so-a-scripted-group-can-follow-an-order) | Should units be able to hold, withdraw or head for a place? | OPEN (heading for a place built) | Posts, in the backlog |
| [Q73](#q73--how-strong-should-by-the-book-vasses-aura-be) | How strong should By the Book, Vasse's aura, be? | OBSERVABLE | The By the Book Experiment |

## Open

### Q5 — What is the default construction radius?

**Status:** OBSERVABLE — built 2026-10-04 as the Build range Experiment; waits on Mario's playtest of it.

[`pulse.md`](../system-design/pulse.md) said two tiles. The builder concept art shows `RADIUS +4`. One
of the two is stale.

Construction territory is built (Mario, 2026-10-04: buildings "can only be built within the build-range of the
other buildings"), with the radius as the **Build range** Experiment: 2, 3 or 4 tiles, 3 to begin with, measured
as range is (Manhattan, from the footprint). Measured on PERIMETER at the start: at 2 the Barracks beside the
Nexus is cut off, 24 tiles are buildable and no Turret placed then reaches the raid's way in; at 3 the base
links and 82 tiles are buildable; at 4, 120.

**Recommendation:** 3, the smallest radius at which the starting base is linked while chaining still matters;
treat `+4` as an outpost value, which is what the art is actually showing — it is drawn on an Outpost.

### Q7 — Do workers carry, or produce in place?

**Status:** OPEN — parked until a level has a storage cap; Milestone 7 harvests in place and does not need the answer.

[`pulse.md`](../system-design/pulse.md) (the economy) says workers do not carry bundles home and produce continuously
at a job, then says they return toward the Nexus when storage fills and resume "immediately" when
capacity opens. Returning-when-full is carry-shaped behaviour inside a no-carry model, and
"immediately" ignores travel time.

**Recommendation:** keep produce-in-place, and make a full store simply **stall** the worker at its
job rather than send it home. Stalled workers are readable (they stop moving), they punish
under-built storage without a walk-home animation nobody asked for, and they remove the travel-time
contradiction. Decide it with the first level that adds a storage cap.

### Q13 — Where do workers flee, and what counts as annihilation, on a Grid with no Nexus?

**Status:** OPEN — option A is what is built; parked under the backlog's routing and economy work.

A threatened worker flees "away from it toward the friendly Nexus", but the mirror skirmish places no
structures at all, and "one side annihilated" ends a Pulse only if workers count. Neither half was stated.

| Option | Cost |
| --- | --- |
| A. No friendly Nexus → flee directly away from the nearest threat. Annihilation = every entity on `workers`, `units`, and `air` is dead | Literal and simple. Risks a worker-hunt anticlimax after the fighting is decided |
| B. Annihilation = no entity that can attack remains; a side reduced to workers loses | Ends the run at the interesting moment. Makes "annihilation" slightly a lie, and changes the outcome of every fixture containing workers |
| C. Require every scenario to place a Grid Nexus | Removes the ambiguity. Taxes the single-rule fixtures that are meant to stay cheap and obvious |

**Recommendation: A** — simplest, honest, and consistent with the documented rule. B is the better
*game* answer and a cheap change later; take it if watching a mirror ending shows it visibly dragging.

**What was measured** (full account in
[`../history/reports/2026-08-21-pulse-playground.md`](../history/reports/2026-08-21-pulse-playground.md)):
a Citizen worker moves at `1/1` and every attacker in either fixture at `3/4` or slower, so a fleeing
worker on open ground is never caught. The mirror skirmish never reaches annihilation and always runs
its full 240 ticks, the last eighty empty; `worker-flight.ts` ends only because an east wall corners the
worker. Whether the dragging is visible still wants someone to watch it.

### Q14 — Should the movement tie-break be mirror-fair, or is a fixed compass order enough?

**Status:** OPEN — parked under the backlog's routing work, whose rewrite is likely to make it moot.

When two steps close the same distance, the tie breaks on turn cost and then on a fixed compass order
(`n, ne, e, se, s, sw, w, nw`). Both sides prefer their own left, so in the mirror skirmish player A's
formation drifts north and player B's south, and the squads meet at an angle. Swapping which player owns
which side flips the result exactly, so there is no bias tied to identity; across seeds the mirror lands
3-3, 4-4, 4-4, 5-1 and 4-4, which is seed variance. The artifact is real, small, and visible.

| Option | Cost |
| --- | --- |
| A. **Keep the fixed compass order.** Document the drift | Free, and the cheapest thing to reason about. Leaves a geometric artifact a sharp player could eventually exploit |
| B. Break equal-distance ties with a draw from the seeded gameplay stream | Removes the artifact and stays deterministic. Spends draws every tick on something no player perceives as a choice, and ties movement replay to stream position |
| C. Derive the preference from the target vector, so the tie leans toward the target's secondary axis | Deterministic with no draws. A rule harder to explain than "the compass order", and still arbitrary when the target is exactly on an axis |

**Recommendation: A, and decide it with the routing work**, which replaces greedy routing wholesale and
is likely to make this moot. If the formations sliding past each other reads as broken rather than as
manoeuvre, take C.

### Q15 — What should a mover with no route do: circle, or stop?

**Status:** OPEN — parked as the opening case of the backlog's routing work.

Greedy routing has no memory. Under Manhattan distance and four-way movement every legal step changes
distance by exactly one, so an actor approaching an obstacle **off-axis** still slides along its face
until it clears (`obstacle-routing.map.json`), but an actor approaching **on-axis** has exactly one
improving direction and, if a wall takes it, no fallback: a hard stop, reported correctly by the
`move.blocked` streak warning but never recovering. The older two-tile pacing case is
`hauler-two-tile-gap`. The owner hit the on-axis case in a playtest ("Two units on the top of the screen
around tick 200 got stuck"); `scenarios/on-axis-deadlock.map.json` isolates it and `tests/report.test.ts`
asserts the `WARN stuck` it raises.

| Option | Cost |
| --- | --- |
| A. **Leave it and report it.** The log names the actor and the tile it wants | Free, and honest. A unit standing still in front of a wall forever reads as broken |
| B. Kernel-side no-progress detection that parks the actor until its goal or the obstacle changes | Cheap, and a stopped unit reads as stuck rather than idle. Still does not get the unit where it was going |
| C. Do nothing now; real pathfinding makes it moot | Free. Bets that routing arrives before anyone watches a unit stall on-axis, which is not a safe bet |

**Recommendation: A for now, then treat this as the routing work's opening case**, scoped to solve the
on-axis dead end (a real search, or at minimum a goal offset that avoids exact axis alignment), not just
report it more politely. B alone would ship a unit that visibly gives up.

**Confirmed at large footprints** (a bug audit of the existing greedy router; the colossus and leviathan
fixtures `colossus-two-tile-gap.map.json` and the 5x2 leviathan case): a 3x3 or 5x2 body against a gap it
cannot pass does not pace, it hard-stops flush against the gap. And a single occupied tile anywhere in a
large mover's footprint vetoes the whole step, because arbitration grants one winner per bridged conflict
group rather than per contested tile. Fixing that is the same routing-priority redesign, not a bug fix.

### Q19 — Where should a sandbox placement mode, rewind and fast-forward, and a feedback replay engine live?

**Status:** OPEN — parked under the backlog's replay format; the owner asked for it to be kept in mind and registered, explicitly not built now.

The owner, after playing the Pulse Playground (now `grid`): "I will want to start improving the Pulse
Playground to have 'sandbox mode' starting with an empty map... have the cursor that can choose units
and place them wherever, then run the simulation. I will love to implement rewind and fast forward (1, 5,
10, 20 turns)... a full replay engine that will also be used to replay existing games, which will be
really good for us to get feedback from users." He was explicit it is forward-looking: "Just keep this in
mind... but not needed for now." Three things are bundled:

- **A full replay format** is already backlog territory ([`backlog.md`](backlog.md), the one contract the
  first milestone did not lock). [`replay-format.md`](../system-design/replay-format.md) is a first concrete
  schema for it — still GUIDANCE, still unbuilt.
- **Rewind and fast-forward at named granularities** is presentation on top of that format. The one
  consequence now: it should keep every tick's state cheaply addressable (or cheaply re-derivable) so
  scrubbing is cheap later. `src/terminal/playback.ts` already addresses presentation time arbitrarily; scrubbing
  backward and by named tick counts is the new part.
- **Sandbox placement** is an early, reduced battle editor, but lighter in purpose than the competitive Build
  Phase: a fast unit-matchup tool for exploring the kernel, with no cost, supply or hidden plan.

| Option | Cost |
| --- | --- |
| A. **Fold all three into a future battle editor** | One editor, one thing to build. The sandbox waits for the editor's much larger scope |
| B. **A lightweight placement mode in `grid` itself**, ahead of any editor: a cursor, the existing fixture rosters, and `run` | Keeps the ask small and close to what exists; two placement UIs to reconcile later |
| C. **Do nothing until a battle editor is scheduled** | Free. The owner said this is fine |

**Recommendation: C for now, then B if the owner wants to play with matchups sooner.** Whichever step first
designs a real replay format should keep per-tick state cheaply addressable regardless.

### Q20 — When target selection is capped by radius for scale, what should a unit with nothing in range do?

**Status:** OPEN — parked until perception's cost is a measured problem, not a projected one; registered now because the tradeoffs are cheap to write down before any fixture depends on the answer.

Perception (`hostilesOf` + `selectTarget`, `src/pulse/tick.ts`) is the one hot path that is O(N²) every
tick: every attack-capable actor scans every hostile actor. At dozens of actors it is invisible; at the
hundreds or thousands the owner has in mind it dominates ([`runtime.md`](../system-design/runtime.md), scaling
toward hundreds or thousands of units, has the assessment). The undisputed fix is capping the scan to a
radius around the actor using a coarse spatial index built from the occupancy index's own mutations. What
is undetermined is what a unit finds when nothing is within the radius.

| Option | Cost |
| --- | --- |
| A. **Full-scan fallback**: if nothing is within the radius, scan everything | Behaviour never changes, but defeats the point on a sparse map |
| B. **Hold idle / keep the last target** until something enters the radius | Cheap and bounded, but a visible behaviour change: a unit that would have crossed the map to engage a straggler now ignores it. Changes fixture hashes for sparse scenarios |
| C. **A new non-targeting `Behavior`**, such as advancing toward a fixed point (the enemy Nexus) | Bounded and intentional, but new surface: `Behavior` is `"advance" \| "flee" \| "static"` and a new one needs its own fixture and test before it is a rule |

**Recommendation: none of these until the radius is actually needed.** Landing the cap inert/off by
default is the right amount of design-now, build-later; picking a fallback is a hash-affecting decision
that is expensive to reconsider once a fixture is pinned to it. When needed, B is the cheapest and most
honest first cut, and A quietly reintroduces the cost the cap exists to remove. C is worth doing only once
"advance on the enemy Nexus" is a rule the game wants anyway.

### Q22 — Should movement carry deterministic, terrain-based jitter?

**Status:** OPEN — presentation, but it touches the state/presentation boundary closely enough to need a real answer; parked under the backlog's movement feel.

Owner playtest, 2026-08-22: "moving units at slight different speeds also helps a lot to see nicer
movement. I wonder if we should build in some movement jitter based on terrain (pseudo-random but
deterministic so we can replay)." Speeds already vary *across unit types*, but identical units of the same
type step in lockstep, which makes ten troopers read as one shape. Cosmetic randomness is already a hash of
an actor's identity, never a stream ([`effects.md`](../system-design/effects.md);
[`pulse.md`](../system-design/pulse.md)), so determinism is not the question. The question is **which side
of the state/presentation line the jitter lives on**.

| Option | Cost |
| --- | --- |
| A. **Pure presentation: interpolation only.** A hash of `(ordinal, from, to)` perturbs only how `Playback` draws the in-between frames, never the tick the kernel resolved | Cheap and safe, same shape as `fx.move.trail`. Ceiling on variety: two troopers still arrive on the same tick |
| B. **A per-actor cosmetic "phase"**, assigned at spawn from a hash, shifting when in its cadence window a step visibly commits, without changing the tick arithmetic | More convincing desync. A per-entity value threaded from spawn to the view without a rule ever reading it (the discipline `facing` gets), plus a test proving it never perturbs the hashes |
| C. **Terrain-keyed rather than actor-keyed**: a rocky tile jitters more than plain ground | Most literal reading, but conflates an individual's gait with ground that is hard to cross. If terrain should change the *feel* of crossing, that is a `movementRate` modifier, a real rule and a bigger question |

**Recommendation: A first**, built and shown side by side with jitter off. If A does not deliver enough
visible variety once someone is watching, B is the next step. C is not recommended on its own.

### Q23 — How does an army reach its first engagement faster, beyond raw movement speed?

**Status:** OPEN — parked under the backlog (multi-Pulse regrouping via outposts); registered so the ask is not lost.

Owner playtest, 2026-08-22: "we should probably think about how to reach the initial conflict faster. Maybe
outposts regroup units next to them so next pulses resolve faster." The idea: an **outpost** reassembles
retreating or newly-produced units near itself between Pulses, so the *next* Pulse's armies start closer
together. Raw speed helps every Pulse; regrouping would specifically help the second and later ones.

Missions are now multi-Pulse ([`campaigns.md`](../game-design/campaigns.md)) and PERIMETER plays three
rounds, so "regroup between Pulses" is no longer hypothetical. What is still unowned is the outpost
itself: no structure does it, and Recall already walks units home to their buildings at the end of a Pulse.

| Option | Cost |
| --- | --- |
| A. **Fold into whichever backlog work adds real routing and production** ([`backlog.md`](backlog.md)): an outpost becomes a structure with a "units spawn or return near me" behaviour | Keeps it with the systems it depends on |
| B. **A named placeholder in `commander-armies.md` or `backlog.md`** now | Cheap, but there is little to say beyond one sentence |
| C. **Do nothing until a mission's design needs it**, and rely on this row | Free, and the same shape Q19 was handled in |

**Recommendation: C.** A real idea worth keeping, but it presupposes outposts and production. The place to
design it is alongside the routing and worker-economy work.

### Q26 — Is a unit that spawns other units a combat ability rather than "production", or does Mario need to sign off before real content uses it?

**Status:** OPEN — blocks nothing (the spawn primitive lives only in disposable bench content, `src/content/proving-grounds.ts`); matters the day any real roster wants a unit that creates other units.

The unit-design-architecture spike ([`../history/reports/2026-09-10-unit-architecture-spike.md`](../history/reports/2026-09-10-unit-architecture-spike.md))
built `ContentDef.spawn` and `pulse/spawn.ts` at Mario's direct request for "spawner, large unit that
creates smaller units", reasoning that a unit periodically creating a minion (a Clash Royale Graveyard, a
StarCraft Broodmother) is a *combat ability*, not the economy the worker-economy milestone owns: no cost, no
resource. That reasoning was never put to Mario directly.

| Option | Cost |
| --- | --- |
| A. **Confirm the framing**: a spawn ability with no cost and no resource is combat, and stays legal content for any future roster | Keeps the capability available. Risks being wrong about where Mario draws the line, especially once a spawn interacts with the supply cap the worker economy will introduce |
| B. **Hold it back until the worker economy is accepted**: no Commander Army may use `spawn`/`splitOnDeath` until then | Conservative and cheap to enforce, but delays the finding for no clearer reason than caution |
| C. **Drop the capability from anything but the bench**: delete `spawn.ts` before any real content exists | Loses working, tested code for a hypothetical concern |

**Recommendation: A**, with the framing stated explicitly: a spawn ability with no cost or resource is a
combat rule shape, judged the way volatile munitions was — by whether it makes a faction's philosophy
legible without a word of lore ([`lore.md`](../game-design/lore.md)), not by whether it creates entities.
Revisit if a real Commander Army's spawn needs a cost; at that point it is the worker economy's.

The Commander's fifth round settled half of it, for buildings the player places: they make units in waves, as
production (Mario, 2026-10-05; the campaign's Hatchery by the same rule as the Barracks). A spawner stays a
combat rule shape only for a unit that makes units, which is what this question still asks.

### Q27 — Should "ground cannot target air" be the schema's default, not an opt-in field?

**Status:** OPEN — blocks nothing until a played roster mixes air and ground. Air is real content now (the Ravel buzzard and corsair, `src/content/ravel.ts`, `scenarios/air-crossing.map.json`), but no real unit sets `targetLayers`.

`ContentDef.targetLayers` is opt-in: undefined means every layer is a legal target, which kept every
existing definition and hash untouched. Only the bench grunt (`src/content/proving-grounds.ts`) sets it. So
the *typical* ground melee unit, whose author never thinks about air, can by default hit a flyer standing on
its tile — a live possibility, since ground and air deliberately share tiles. Nothing enforces "remember to
restrict this" except author discipline.

| Option | Cost |
| --- | --- |
| A. **Keep the opt-in default.** Undefined means "every layer" | Free, zero risk to existing content. Every future ground-melee author must remember the restriction, and nothing fails loudly if they forget |
| B. **Flip the default for ground-layer content**: a `units`/`workers` entity with no `targetLayers` cannot target `air` unless it opts in | Closer to what most designs want. A breaking semantic change to a new field, with every existing hash at stake |
| C. **A loader-time or test-time lint**: flag (not reject) a ground-layer `attack` with no `targetLayers` | Cheap; catches the discipline risk without changing runtime behaviour |

**Recommendation: A for now, reconsider at C's cost the day a played roster first mixes air and ground
units** (Milestone 12 at the latest). Changing the default later costs nothing extra compared with now.

### Q28 — Can a spawner-only side become permanently un-annihilatable?

**Status:** OPEN — confirmed only in bench content (`bench-hatchery-spawn.map.json`); blocks nothing before a real roster fields a structure whose starting force is entirely non-mobile (Milestone 12 at the earliest).

Annihilation for a side with no Nexus requires every entity on `workers`, `units` and `air` to be dead
(Q13), and `PulseContext.roster[player].hasMobile` is computed **once**, from the initial entities, so a side
that starts with only workers is not declared annihilated for having no soldiers yet. The spike's spawner
(`structure.bench.hatchery`) has no initial mobile entities at all, so `hasMobile` is `false` at tick 0 and
never re-evaluated, and `victory()`'s annihilation check can never fire: in `bench-hatchery-spawn.map.json`
the hatchery and both spawned children are dead by tick 167 and the match still runs to a draw at tick 300.

| Option | Cost |
| --- | --- |
| A. **Leave it.** No accepted roster is spawner-only, and the fixture is bench content built to surface this | Free. Reaches a real match only if a Commander Army's opening force is entirely non-mobile |
| B. **Extend `hasMobile`**: a side counts if its initial roster has a mobile entity *or* one with `spawn` | Closes the gap cheaply. But a live spawner between cycles with all children dead would read as annihilated: a **false** annihilation mid-match |
| C. **Redefine annihilation for a spawn-having side**: the spawning structure itself must also be dead | Avoids B's false positive, but starts to be a second victory condition ("destroy the production"): a product-model decision |

**Recommendation: A for now.** Both real fixes trade one edge case for a subtler one, and neither should be
picked without a real roster to test it against (Q20's own reasoning). Revisit the moment a Commander Army
opens with an entirely non-mobile force.

### Q31 — What shape does an "unlock record" take, with no save system yet?

**Status:** OPEN — parked until Milestone 4 (campaign menu) needs to write one; the recommendation is already assumed by [`milestone-04-campaign-menu.md`](milestone-04-campaign-menu.md).

Mario: "after each level, we unlock new units and powers." [`campaigns.md`](../game-design/campaigns.md) has an
`unlocks: readonly string[]` field on a mission, but nothing says what a session writes down when Level 1
grants one, and the real save and replay format ([`replay-format.md`](../system-design/replay-format.md)) does
not exist.

| Option | Cost |
| --- | --- |
| A. **A flat, checked-in list** (JSON or a small TypeScript module) naming what completing PERIMETER makes available. No persistence, no player-facing menu | Cheapest, and enough for "the next level's contract may assume these exist", the only consumer today |
| B. **Build a minimal save and progression system now** | Real infrastructure for one campaign and one mission, and a second persistence format risks being incompatible with the replay format it should share a schema with |

**Recommendation: A.** A real save system belongs with the replay format, for whichever level first needs an
unlock state that outlives an authoring session.

**Widened since, and A is now the floor rather than the answer.** The Campaign opens with a choice of
Commander and a player may keep several campaigns in progress, so progress is **per save slot, each slot
naming its Commander**, and bonus goals unlock content for Challenge mode, so the record outlives a single
campaign. A flat list still serves the first playable mission; Milestone 4 is where the difference gets
designed rather than discovered.

### Q35 — What counts as "discovered" enemy intel, and when is it recorded?

**Status:** OPEN — parked until Milestone 4 builds the enemy-intel panel; the recommendation is already assumed by [`milestone-04-campaign-menu.md`](milestone-04-campaign-menu.md).

Mario's campaign-menu description asks for "enemy intel (discovered enemy units, buildings, nexus powers,
enemy generals, and mission reports)." `PlayerView` ([`pulse.md`](../system-design/pulse.md), visibility) is a
**live, per-Pulse filter**: it decides what a player may be shown this instant and remembers nothing between
missions. So "discovered" needs a definition before the panel can be built.

| Option | Cost |
| --- | --- |
| A. **Anything the player's own `PlayerView` has ever rendered, logged the instant it is first seen** | Simplest rule, no per-mission authoring, derived from existing machinery the way the report module already derives from the event stream |
| B. **Only entities that survive to a Pulse's end** | More conservative, but hard to explain ("I saw it and it isn't in my intel?") and needs an extra pass |
| C. **Explicit, mission-authored reveals only** | Precise control over the belief ramp's information pacing (Mission 2's whole itch is the Nexus knowing something nobody entered). Per-mission authoring for every enemy type, forever |

**Recommendation: A**, with C available later as an *addition*: a mission that wants to reveal something the
player never saw adds an explicit entry on top of the automatic log (Mission 2's "names Speaker Corvane
before any contact"). Do not build C's authoring surface before a mission uses it.

### Q38 — Does PERIMETER's own map need real scrolling, or does Milestone 5 prove scrolling on different content?

**Status:** OPEN — decision-ready. Scrolling is built; PERIMETER is still played on the Build Phase's placeholder map ([`next-steps.md`](next-steps.md)), so its real map is the open part. The recommendation is already assumed by [`docs/history/milestones/milestone-02-campaign-design.md`](../history/milestones/milestone-02-campaign-design.md).

The belief ramp in [`campaigns.md`](../game-design/campaigns.md) describes PERIMETER's teaching goal as the
"Build Phase / Nexus Pulse loop on **a small Grid that never scrolls**", written as GUIDANCE before the
campaign-first pivot. Milestone 5's charter says real scrolling is built "against a Grid sized to actually
need it". If PERIMETER's real map stays small by design, scrolling has no mission of its own to be proved
against.

| Option | Cost |
| --- | --- |
| A. **Let PERIMETER's map grow just large enough to want a little scrolling.** "Never scrolls" was a reasonable early assumption, not a locked narrative requirement | Free, keeps the scrolling acceptance check real rather than synthetic, and amends one row of GUIDANCE nothing has been built against |
| B. **Prove scrolling on a dedicated fixture** and keep PERIMETER exactly as small as the belief ramp describes | Preserves the ramp literally, but the capability's first real use is a synthetic fixture, not the mission that was supposed to need it |
| C. **Defer real scrolling to a later mission's large map** (RIGHT OF SALVAGE, Milestone 10, or later) | Keeps the framing as written, but overstates what Milestone 5 delivers and defers proof of a RULE-adjacent viewport contract |

**Recommendation: A.** Size PERIMETER's real map to genuinely need a little scrolling. It costs nothing the
fiction depends on, and it means the scrolling work is judged on the mission that motivated it. Mario's own
input notes call scrolling "the part that needs more attention", so a PERIMETER that never scrolls would leave
the game's most-scrutinised interaction proved on a fixture the campaign never plays.

### Q40 — Within a run, what persists from one battle to the next?

**Status:** OPEN — parked until Milestone 11's first step; it proceeds under the recommendation. Registered with the Challenge mode itself ([`game-modes.md`](../game-design/game-modes.md)).

A run is a series of battles with the army changing between them. The army composition (structures and Nexus
power pool) obviously persists. What is not obvious is whether anything *on the Grid* does. The concept's
promise that "persistence creates short stories — survivors matter" ([`concept.md`](../game-design/concept.md))
is stated for the Pulses of one match; carrying it across battles would be a new claim.

| Option | Cost |
| --- | --- |
| A. **Deck and Commander only.** Every battle starts from a fresh Grid with the starting package | The smallest run, the cheapest to build, and the one every reference deckbuilder uses. Loses the "veterans" fantasy |
| B. **Deck, Commander, and surviving units**, capped by supply | Into the Breach's pilots at army scale: real attachment. Costs a between-battle roster state, a supply rule for what a fresh Grid can field at tick 0, and a snowballing balance problem |
| C. **Deck, Commander, and a carried resource** | Cheap, rewards efficient play without roster snowballing. Interacts with the worker economy, which does not exist yet |

**Recommendation: A for the first step, with B made observable as a toggle in the second if it is cheap, and
judged by playing both.** C waits for an economy to carry.

### Q51 — When should the game get a real accent-colour palette, with variations per faction?

**Status:** OPEN — parked until a second faction has content on screen; only the Citizen faction does today.

Mario, reviewing step 5C: "at some point, we should also think about a balanced color palette for accent
colours, that will give visual identity to the game, and have variations for each faction." `src/view/roles.ts`
has one dark and one light theme, and `player.a`/`player.b` carry *ownership*, not faction identity
([`presentation.md`](../system-design/presentation.md): "faction identity lives in the glyph family and the
effect language; ownership keeps the colour", the rule Q18 settled).

| Option | Cost |
| --- | --- |
| A. **Design the palette now**, against the Citizen faction alone | Gets the system in place early, but a palette designed against one faction is a guess about what needs to differ from what |
| B. **Wait until a second faction has content on screen**, then design against both | Nothing to design against until then, but the wait is short: Milestone 8 is Commander Vasse, and four more factions (Ravel, Feudal, Glitch, Alder) will need it |

**Recommendation: B.** A palette's whole job is to make faction A read differently from faction B at a glance;
revisit when a second faction's structures or units are drawn — Milestone 8 at the latest.

### Q53 — Does the game want a "jump to my next structure" key, and which one?

**Status:** OPEN — parked under the backlog's keyboard play; a real trade, not a blocker.

Tab already toggles keyboard focus between the side menu and the Grid, as the owner asked on 2026-09-26
([`input.md`](../system-design/input.md), bindings; it is built). That retired the older GUIDANCE that gave Tab
and Shift+Tab the job of jumping the cursor to the player's next or previous own structure. What remains is
whether that jump should exist at all, on some other key.

| Option | Cost |
| --- | --- |
| A. **Drop the structure-jump idea entirely.** Nothing has ever used it | Loses a useful RTS convention ("go to my barracks, build next to it") that the project itself named as the reason for the original binding |
| B. **Give structure-jump a different key later**, once the keymap (Tab, Esc, Delete, the digits) is settled and shown not to be crowded | Keeps the idea alive without deciding a key before there is a keymap to fit it into |

**Recommendation: B.** Revisit structure-jump as a small addition when a mission has enough structures that
finding your own is slow, rather than solve for a key nothing currently claims.

### Q59 — Should an `[m] Map` popup show the whole Grid at once?

**Status:** OPEN — keep in mind, not needed yet; registered at the owner's request, the same shape Q19 was.

The owner, reviewing the retired scrollbar experiment (2026-09-26): "Perhaps we should have a '[m] Map' hotkey
that opens a popup in the middle with the whole map. Take note of this, we may develop it later on another
session spike, because everything needs a special representation for the minimap, but it seems it would be
really useful for checking large maps, navigation, and checking for status during large pulses."
[`grid.md`](../system-design/grid.md) still says there is no minimap; a popup the player opens is a different
thing from one always on screen, but it shares the hard part — drawing a Grid larger than the maximum viewport
in a fraction of the cells.

| Option | Cost |
| --- | --- |
| A. **A spike of its own**, once some map is bigger than the maximum viewport (72 × 24) | Waits for a real need; the spike's question is the downsampled representation, which nothing else answers |
| B. Build it inside the Build Phase work | No mission map needs it yet; the representation would be answered against a test Grid, not a real one |

**Recommendation: A.** `m` is reserved for it ([`grid.md`](../system-design/grid.md)) so nothing else takes the
key. The natural moment is the first mission map that does not fit the maximum viewport, or the first Pulse
large enough that watching it needs an overview.

### Q63 — Should the mouse wheel move the jump distance rather than 5?

**Status:** OPEN — blocks nothing; registered when Shift's jump was retuned.

One wheel notch moves the cursor **5 tiles** (`WHEEL_TILES`, `src/build/mouse.ts`), the same as the keyboard
jump once did. The jump (Shift or Option with an arrow, PageUp/PageDown, Home/End) is now **10 tiles** by
default, the owner's settled value, and is itself an Experiment ("Jump distance", 5 to 20, in Settings, `d`;
`src/build/all-settings.ts`). So the wheel and the jump differ. Trackpads send wheel events in bursts, so a
larger wheel step may overshoot.

| Option | Cost |
| --- | --- |
| A. **Keep 5** | The wheel and the jump differ |
| B. Follow the jump distance | One number for "fast"; may overshoot on a trackpad |

**Recommendation: A** until the owner has tried the wheel on his own trackpad.

### Q67 — Do buildings get letter hotkeys, or stay on digits?

**Status:** OPEN — decision-ready; registered 2026-09-29 (the owner's feedback wrote "press 'b' to build a barracks", read as the building's own key; the ambiguity is recorded so it is not lost).

Buildings are picked by the digit of their menu row (`[1] Barracks`), one digit sequence for the whole menu
so no hotkey moves when content arrives ([`input.md`](../system-design/input.md), RULE). Letters are already
spoken for: `e`, `n`, `p`, `q`, `u`, `x`, `s`, `r`, `d`. The owner's example used a letter.

| Option | Cost |
| --- | --- |
| A. **Digits only** (as built) | A digit means nothing about the building; nothing moves when a row is added |
| B. A mnemonic letter per building (`b` Barracks) | Collides quickly (Barracks and Bunker) and with the command letters; a letter moves or breaks when content changes; needs a per-language rule |
| C. Digits stay the address, and a letter is *shown* beside the name where it is unique and free | Two keys for one row; some rows have none |

**Recommendation: A**, unless the owner says he meant letters — in which case C, shown in the row, so the
digit contract stays a rule. Ask him once whether `b` was an example of a key or a request for letters.

### Q69 — Should units be able to hold, withdraw or head for a place, so a scripted group can follow an order?

**Status:** OPEN — decision-ready; registered 2026-09-30.

[`campaigns.md`](../game-design/campaigns.md) gives the trigger runner an `order` action — a group "advances,
holds, or withdraws toward a region" — and the owner asked for incoming units to show their intention. **The
kernel has one movement rule: every unit engages the nearest enemy.** It has no field for an order and no phase
that reads one. So `order` is built with one verb, `advance`, which means exactly what the kernel already does;
the region it names is the stated destination, shown to the player as intention, not a path the kernel steers
by. `hold` and `withdraw` are refused when a mission is loaded, with this question's number in the message.

| Option | Cost |
| --- | --- |
| A. **Keep `advance` only**; intentions stay words the mission writes | Free; but a raid can never feint, wait at the ridge, or pull back, and "Break through at the ridge" is a promise the kernel keeps only because the nearest enemy happens to be that way |
| B. **An order field on an entity and a goal in the intents phase**: a group holds (never moves, still fires), withdraws (moves away from the region), or heads for a region before it engages | A kernel change: a new `EntityState` field (a schema bump), a rule in the intents phase with its own named scenario, the determinism suite. It is also the seam the Campaign's opponent AI needs ([`scripted-opponent.md`](../game-design/scripted-opponent.md)) |
| C. **Orders as scripted content swaps** (a "holding" variant of a unit with a static behaviour) | No kernel change, but a unit's identity changes under it and every unit needs variants: content bloat to avoid a rule |

**Recommendation: B, as its own small step**, scoped to `hold` and "head for a region, then engage", because
that is what a readable intention needs and what the Campaign's scripted opponent will be made of.

**Built in part, 2026-10-04.** Mario, on the Commander's fourth round: "The campaign levels should have a target
well defined so it is predictable where your troops are moving", and of posts, "before we start playing with
posts, I would like to go deep on the simple building placement first". So heading for a place is built for a
whole side, as a level's target (`target` in a mission, `targets` in the state; [`pulse.md`](../system-design/pulse.md),
a side's target), and the inert `order` is removed. Holding a post and withdrawing still wait: posts are in the
backlog, after placement; a raid group's own plan would reuse the target rule for one group.

### Q73 — How strong should By the Book, Vasse's aura, be?

**Status:** OBSERVABLE — registered 2026-10-04; the "By the Book" Experiment shows each answer.

The owner asked for Commanders as heroes with skills that work on their own: "Vasse should provide boost to nearby
units." Her aura is built: she and the units of her side within 3 tiles of her take less damage from every hit.
How strong: enough to feel that she is there, never so strong that standing beside her is the whole plan.
Measured on PERIMETER's last round, beside the level's target for the player's troops:

| Option | On PERIMETER |
| --- | --- |
| A. Off | A Hatchery or a Barracks alone loses the last round |
| B. 10% less | A single Turret loses |
| C. **25% less** (the first guess) | Nothing built loses; one building placed toward the raid holds |
| D. 40% less | Nearly every plan holds; nothing built still loses, by a second |

**Recommendation: C**, and play D and A once each to feel the difference.
