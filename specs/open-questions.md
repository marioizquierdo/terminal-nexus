# Terminal Nexus — open questions register

**Document role:** Durable queue of decisions that block or shape work, with owner answers
**Status:** Canonical process document; individual answers become canon elsewhere
**Canon version:** 2.7
**Updated:** 2026-08-24
**License:** Apache-2.0

## 1. Why this file exists

An agent working alone will reach a fork the canon does not answer. Without somewhere to put the
question, one of three bad things happens: the session stalls, the agent guesses and the guess
silently becomes canon, or the question is asked in a pull-request comment and is lost.

This register is the queue. It survives sessions, it is diffable, and it separates *what Mario must
decide* from *what an agent may decide alone*.

## 2. Protocol

When an agent hits an underdetermined fork:

1. Check whether the fork is genuinely the owner's. Reversible module boundaries, names, local data
   shapes, and test organization are **not** — decide those and move on
   ([`project-governance.md`](project-governance.md) Section 2).
2. Prefer making the fork **observable** rather than asking. A parameter, toggle, fixture, or side
   by side comparison that lets Mario look at both answers is worth more than a paragraph of
   speculation, and costs less than a stalled session.
3. If it is still a real decision, add a row to Section 4 with: the question, why it blocks, the
   options, the cost of each, and **a recommendation**. A question without a recommendation is an
   unfinished question.
4. State the assumption you are proceeding under, then **keep working on everything the answer does
   not touch**. Only stop entirely when proceeding under any assumption would waste the work.
5. When Mario answers, move the row to Section 5, promote the decision into the narrowest
   authoritative document, and cite the question ID in the commit.

Question IDs are permanent. Never renumber, never reuse.

## 3. Status values

| Status | Meaning |
| --- | --- |
| `OPEN` | Waiting on Mario |
| `OBSERVABLE` | Deferred on purpose; an authorized gate will produce evidence for it |
| `ANSWERED` | Decided; recorded in Section 5 and promoted into canon |
| `DROPPED` | No longer relevant; keep the row and say why |

## 4. Open

### Q5 — What is the default construction radius?

**Status:** OPEN — trivial to answer; blocks nothing before Milestone 3.

[`engine.md`](engine.md) Section 6 says two tiles. The builder concept art shows `RADIUS +4`. One
of the two is stale. The distance metric is separately unlocked and belongs to Milestone 3.

**Recommendation:** keep two as the default in canon and treat `+4` as an outpost value, which is
what the art is actually showing — it is drawn on an Outpost.

### Q7 — Do workers carry, or produce in place?

**Status:** OPEN — blocks nothing before Milestone 4.

[`engine.md`](engine.md) Section 6 says workers do not carry bundles home and produce continuously
at a job, then says they return toward the Nexus when storage fills and resume "immediately" when
capacity opens. Returning-when-full is carry-shaped behaviour inside a no-carry model, and
"immediately" ignores travel time.

**Recommendation:** keep produce-in-place, and make a full store simply **stall** the worker at its
job rather than send it home. Stalled workers are readable (they stop moving), they punish
under-built storage without a walk-home animation nobody asked for, and they remove the travel-time
contradiction. Decide with the Milestone 4 microgame.

### Q8 — When does an air unit first exist?

**Status:** OPEN — blocks nothing; answer before content authoring starts.

[`engine.md`](engine.md) Section 3.4 gives the Grid an `air` layer, because a five-layer occupancy
model costs nothing more than a four-layer one and retrofitting a layer later is expensive. No air
unit is authored, and none of the five factions currently has one in its identity.

| Option | Cost |
| --- | --- |
| A. Layer exists from day one; **no air unit before Milestone 3** | Free. The model is honest about what it supports, and content stays at the size the milestone can balance |
| B. Author an air unit in the Milestone 1 fixture | Proves the layer really works. Adds a unit nobody asked for to a mirror fight whose whole value is being boring |
| C. Remove the layer until something needs it | Smallest model. Guarantees a painful retrofit the first time a faction wants a flyer |

**Recommendation: A.** Build the layer, leave it empty, and add one test that asserts an air entity
can share a tile with a ground entity — so the rule is proven without the content existing.

**Evidence from Milestone 1:** done exactly that. `tests/grid.test.ts` builds an air definition
inside the test file, asserts it shares a tile with a ground unit in both directions, and no air
content was authored. The layer costs nothing and works.

### Q9 — Does facing affect rules, or only presentation?

**Status:** OPEN — Milestone 1 proceeds under the recommendation; confirm before Milestone 3.

[`engine.md`](engine.md) Section 3.5 puts `facing` in every placement. It is currently read by nothing
in the rules — it exists so the renderer does not have to guess a direction and produce jitter.

| Option | Cost |
| --- | --- |
| A. **Presentation only.** Derived from the last step, or from the current target when stationary | Free. Facing stays a rendering hint and can never surprise a player with a rule they cannot see |
| B. Facing gates attacks: firing arcs, rear damage bonuses, turn cost | Real tactical depth, and a good fit for Feudal caste formations. Costs a turn-cost rule inside the movement credit, and makes every attack outcome depend on something one cell cannot display well |

**Recommendation: A for now.** B is a genuinely interesting mechanic, but it is a Milestone 3 or 4
conversation, and adopting it early would mean every unit's readable state includes an orientation
that a single character struggles to show. Keep facing in state, keep it out of the rules, and
revisit when there is a faction that wants it.

**Evidence from Milestone 1, and it sharpens the question:** facing was maintained all the way
through both gates — derived from the last step, or from the current target when stationary — and
**nothing read it.** Not the rules, which was the point; but not the renderer either. The compositor
draws letters, which have no orientation, and the effect system takes its direction from the move
and attack events rather than from state. So facing is currently a field that is hashed into every
state comparison and consulted by nobody. That does not make option A wrong, but it removes the
justification the question was resting on: it is in state so a renderer need not guess, and no
renderer has needed it yet. A third option now exists — **drop it until something asks** — and it
would make every state hash slightly smaller and one field less load-bearing.

### Q12 — What is the vertical chrome budget, and is 80 × 24 a literal floor?

**Status:** OPEN — Gate 1A proceeds under the recommendation, which is already written into
[`engine.md`](engine.md) Sections 3.1 and 3.3.

The canon stated two incompatible arithmetics. Section 3.1 derived the composition as
16 + 2 border + header + footer = **20 rows**, implying a 4-row chrome budget; Section 3.3's table
gave the maximum viewport as 104 × **28**, which also implies 4 rows — while the same table's minimum
row, **80 × 24**, implies 8. The two rows of one table disagreed with each other, so no reading made
the canon consistent. Meanwhile "80 × 24 is the floor and the acceptance target" is repeated as RULE
in Section 3.3, Section 9.3, `project-governance.md` Section 7, and `AGENTS.md`.

| Option | Cost |
| --- | --- |
| A. **8-row chrome budget** — 2 border, 3 header, 3 footer; minimum composition 80 × 24, maximum 104 × 32 | Keeps every "80 × 24" statement literally true, and gives the footer room for the position readout and edge-marker legend that Section 3.3 already requires. Costs 4 rows of the maximum composition |
| B. **4-row budget** — 2 border, 1 header, 1 footer; minimum composition 80 × 20, maximum 104 × 28 | Most Grid per terminal. Requires rewording the floor in four places, and squeezes the required footer content into one row |

**Recommendation: A**, and it is applied. The floor is the number every other document already
repeats, a 24-row terminal is the historic standard the product targets anyway, and the footer has
real work to do. If Gate 1A finds three header rows wasteful, moving rows between header and footer
inside the 8 is free and needs no canon change — only the total is fixed here.

**Evidence from Milestone 1:** the 8-row budget was built and all eight rows are in use. The header
carries the title strip, the scenario name and the seed; the footer carries the position readout the
canon requires, the controls, and a status line. Nothing was wasted and nothing had to be squeezed,
at 80 columns and at 128.

### Q13 — Where do workers flee, and what counts as annihilation, on a Grid with no Nexus?

**Status:** OPEN — Gate 1A proceeds under the recommendation, which is already written into
[`milestone-1-spike-battle.md`](milestone-1-spike-battle.md) Section 3.7.

The Gate 1A flee rule sends a threatened worker "away from it toward the friendly Nexus", but the
mirror skirmish — the scenario the whole gate is named after — places no structures at all. The same
section's victory list includes "one side annihilated", and with a flee rule in play workers can
outlive every fighter, so whether they count decides the outcome and the ending of every Nexus-less
fixture. Neither half was stated.

| Option | Cost |
| --- | --- |
| A. No friendly Nexus → flee directly away from the nearest threat. Annihilation = every entity on `workers`, `units`, and `air` is dead | Literal, simple, and matches the summary example. Risks a worker-hunt anticlimax after the fighting is decided — bounded in the mirror by the marksman's range of 5 |
| B. Annihilation = no entity that can attack remains; a side reduced to workers loses | Ends the run at the interesting moment. Makes "annihilation" slightly a lie, and changes the outcome of every fixture containing workers |
| C. Require every scenario to place a Grid Nexus | Removes the ambiguity entirely. Taxes the ten single-rule fixtures that Section 3.9 wants to stay cheap and obvious |

**Recommendation: A** for Gate 1A — simplest, honest, and consistent with the documented summary. B
is the better *game* answer and is a cheap change later; take it if Gate 1B viewing shows mirror
endings visibly dragging, with someone having actually watched one. C trades a real cost for a
problem A already solves.

**Evidence from Milestone 1, and it is stronger than the row predicted.** A Citizen worker moves at
`1/1` and every attacker in either fixture moves at `3/4` or slower, so a fleeing worker on open
ground is **never caught at all** — not "a worker-hunt anticlimax", an unreachable one. The mirror
skirmish therefore never reaches annihilation and always runs its full 240 ticks, with the last
eighty of them empty. `worker-flight.ts` only ends because the Grid has an east wall to corner the
worker against. Option B would end those fixtures at the interesting moment. Whether the dragging is
*visible* still wants someone to watch it, which is the one thing this evidence cannot supply.

### Q14 — Should the movement tie-break be mirror-fair, or is a fixed compass order enough?

**Status:** OPEN — Gate 1A proceeds under the recommendation; nothing before Milestone 2 depends on
the answer.

Gate 1A routes with a greedy step plus a deterministic sidestep. When two steps close the same
distance, the tie breaks on turn cost and then on a fixed compass order (`n, ne, e, se, s, sw, w,
nw`). That makes both sides prefer *their own left*, so in the mirror skirmish player A's formation
drifts north while player B's drifts south, and the two squads meet at an angle rather than head on.

Measured: swapping which player owns which side flips the result exactly, so there is no bias tied
to a player's identity. Across seeds the mirror lands 3-3, 4-4, 4-4, 5-1 and 4-4 — the lopsided runs
are seed variance, not a systematic advantage. The artifact is real but small, and it is visible on
screen as two formations sliding past each other.

| Option | Cost |
| --- | --- |
| A. **Keep the fixed compass order.** Document the drift | Free, and the cheapest thing to reason about. Leaves a geometric artifact a sharp player could eventually learn to exploit |
| B. Break equal-distance ties with a draw from the seeded gameplay stream | Removes the directional artifact and stays deterministic. Spends draws every tick on something no player will ever perceive as a choice, and makes movement replay depend on stream position far more heavily |
| C. Derive the preference from the target vector, so the tie leans toward the target's secondary axis | Keeps determinism and removes the mirror artifact without spending draws. Costs a rule that is harder to explain than "the compass order", and it is still arbitrary when the target is exactly on an axis |

**Recommendation: A for Gate 1A, and decide it in Milestone 2**, which owns routing. The drift is
documented, it is symmetric between the two sides, and replacing greedy routing wholesale is likely
to make this question moot. If Gate 1B viewing shows the formations sliding past each other reads as
broken rather than as manoeuvre, take C.

### Q15 — What should a mover with no route do: circle, or stop?

**Status:** OPEN — Gate 1A proceeds under the recommendation; blocks nothing before Milestone 2.

Greedy routing with a sidestep has no memory, so an actor whose goal is unreachable does not stop —
it steps back and forth between two equally good tiles forever. The `hauler-two-tile-gap` fixture
shows it exactly: a 3x1 hauler that cannot fit a two-tile opening paces between `(10,5)` and
`(11,5)` for the whole Pulse.

The report catches it — the log watches net progress and raises `WARN stuck` when an actor's last
two dozen ticks revisit the same two tiles — but the kernel keeps moving it.

**Sharper since diagonal movement left** (owner playtest, Milestone 1 acceptance pass): under
Manhattan distance and four-way movement, every legal step changes distance by exactly ±1, so the
"sidestep that holds distance level" the old eight-way router relied on to skirt an obstacle no
longer exists (`src/pulse/movement.ts`, `rankedSteps`). An actor approaching an obstacle **off-axis**
still has two improving directions and can slide along the obstacle's face, one tile at a time, until
it clears — that is what `obstacle-routing.ts` now exercises. An actor approaching **on-axis** (same
row or column as its goal) has exactly one improving direction, and if a wall takes it there is no
fallback at all: not a circle, a hard stop, reported correctly by the existing `move.blocked` streak
warning but never recovering on its own. This is a strictly worse failure mode than circling — a
circling actor is at least visibly doing something — and it is not a corner case: any unit walking a
straight line at an enemy structure now hits it whenever the obstacle happens to sit exactly on that
line.

| Option | Cost |
| --- | --- |
| A. **Leave it and report it.** The log names the actor and the tile it wants | Free, and honest. On screen a unit standing still in front of a wall forever reads as broken, more so than circling did |
| B. Kernel-side no-progress detection that parks the actor until its goal or the obstacle changes | Cheap, and it makes the failure legible: a stopped unit reads as stuck rather than as idle. Still doesn't get the unit where it was going — it only stops pretending to try |
| C. Do nothing now; real pathfinding in Milestone 2 makes it moot | Free. Bets that Milestone 2 arrives before anyone watches a unit stall on-axis, which — given this session's own scenario needed redesigning to avoid it — is not a safe bet |

**Recommendation: A for Gate 1A, then treat this as Milestone 2's opening case**, not a stopgap
detail. Milestone 2's routing work should be scoped to actually solve the on-axis dead end (a real
search, or at minimum a goal offset that avoids exact axis alignment), not just report it more
politely — B alone would ship a unit that visibly gives up, which is not better than one that visibly
paces.

**Confirmed on the real fixture** (owner playtest, 2026-08-22): "Two units on the top of the screen
around tick 200 got stuck: `t▓▓X`. The pathfinding algorithm is failing here." That is this exact
failure — a trooper and a runner squared off on the same row across a two-tile rock, each one's only
distance-closing direction pointed straight into it, and neither ever tried the one-tile detour that
would have cleared it. `scenarios/on-axis-deadlock.map.json` isolates it to two entities and one line of
log (`tests/report.test.ts` asserts it fires the `WARN stuck` recommendation A already calls for);
`tests/report.test.ts` also asserts, across every checked-in scenario, that no `stuck` warning ever
reports an impassable tile as an actor's own position — a second, smaller bug this same investigation
found in the log line itself, now fixed, unrelated to the routing gap below. Nothing else about the
gap moves: still a real fork, still Milestone 2's job, recommendation unchanged.

**Confirmed again at a genuinely large footprint, and sharpened with a second manifestation of the
same code path** (a subagent audit, requested alongside the large-unit work that added the colossus and
leviathan, scoped explicitly to finding bugs in the existing greedy router rather than to designing
real pathfinding). Two findings, neither a new failure mode — both the on-axis case above, reached by a
wider body:

- **The hard-stop variant, not the pacing one.** `hauler-two-tile-gap.map.json`'s 3x1 hauler paces
  between two tiles in front of a gap it cannot fit through, because there is still room on either side
  of it to try. A 3x3 colossus given the identical wall and gap does not pace — it takes one approach
  step, then hard-stops flush against the gap and reports `move.blocked reason:terrain` every tick from
  then on, correctly caught by the same stuck-streak detector. There is no room left to try a second
  tile once a body this wide is flush against an opening it cannot pass. `scenarios/colossus-two-tile-
  gap.map.json` is the checked-in confirmation (`tests/report.test.ts`); the same audit reproduced the
  identical hard stop on the widest thing on the bench, a 5x2 leviathan against a four-tile gap, and
  confirmed the off-axis slide (`obstacle-routing.map.json`'s case) still works correctly at this size —
  the mechanism is not broken for large footprints, it degrades exactly the way this entry already
  describes.
- **A related but distinct manifestation, not yet given its own fixture: a single occupied tile
  anywhere in a large mover's needed footprint vetoes the entire step, not just that one tile.**
  `arbitration.ts`'s conflict grouping unions every mover whose destination footprint touches a
  contested tile and grants only one winner per group per pass — for a one-tile mover that is exactly
  right, but for a nine- or ten-tile body it means one unrelated small unit occupying any single one of
  those tiles can block the whole move, even when the other movers in the same bridged group were never
  actually contesting each other. Reproduced deterministically (every mover's movement credit
  pre-charged to remove natural cadence stagger as a confound) rather than assumed; not observed in any
  checked-in scenario's natural cadence, so it is real but currently rare in practice, and mechanically
  it is the identical on-axis dead-end code path as the terrain case above, just triggered by a
  transient occupant instead of a wall — one that becomes just as permanent if that occupant holds
  position, which a unit stopping to fight naturally does. No code change: fixing this without real
  pathfinding would mean picking arbitration winners per contested tile rather than per bridged group,
  which is the same routing-priority redesign this entry already defers to Milestone 2, not a bug fix
  available under this gate.

Nothing here moves the recommendation: still A for Gate 1A, still Milestone 2's opening case, now with
the large-unit case confirmed rather than only inferred from the 3x1 evidence above.

### Q16 — When the Grid is smaller than the viewport, where does the leftover space go?

**Status:** OPEN — Gate 1A proceeds under the recommendation; the answer changes only presentation.

[`engine.md`](engine.md) Section 3.3 says terminal space beyond the *maximum* viewport is spent on
centring and on a larger inspection panel, never on more Grid. It does not say what happens below
the *minimum*: a `small-wide` Grid is 24 × 12 inside a 48 × 16 pane, so Gate 1A centres it and
leaves twelve blank columns on each side. Screenshots of the real terminal are in
`evidence/screenshots/`; at 80 columns roughly a third of the frame is empty.

| Option | Cost |
| --- | --- |
| A. **Centre the Grid in the full 48 × 16 pane.** What Gate 1A ships | Free, and the frame is identical whatever scenario is loaded, which keeps snapshots and muscle memory stable. Looks empty on a tutorial-sized Grid |
| B. Shrink the pane to the Grid and give the recovered columns to the side panel | Uses the whole frame. The panel changes width with the map, so every panel layout has to work at two or three widths, and the composition stops falling out of one number |
| C. Shrink the whole frame to the Grid and centre the frame in the terminal | Tightest picture. The frame is no longer 80 × 24, which is the acceptance target repeated as RULE in four documents |

**Recommendation: A for Gate 1A**, and decide it when the Build Phase gives the side panel real
content to hold — a construct menu and a placement-legality panel will want the width far more than
a Pulse feed does. C should be refused: the floor is a RULE and a moving frame size is worse than a
quiet margin.

### Q18 — In a same-faction mirror match, should colour follow ownership or the faction?

**Status:** OPEN — Gate 1B proceeds under the recommendation; the answer only touches presentation.

`engine.md`'s stated RULE is "faction identity lives in the glyph family and the effect language;
ownership keeps the colour, so a mirror match stays legible and monochrome stays whole"
(`playerRole()` in `src/view/theme.ts`: player A is always `player.a`, player B is always
`player.b`, regardless of which roster either side is playing). The owner's playtest asked the
question behind that RULE directly: "How can we color mirror-matches? make sure you include citizen
vs citizen and ravel vs ravel" — and floated "their secondary colour" and, further out, a full
skins system with a player-chosen third colour.

Made observable this session: `ravel-mirror-skirmish.map.json` is the Ravel counterpart to the existing
`citizen-mirror-skirmish.map.json`, and a truecolor capture of it is what the RULE actually produces —
player A's Ravels in Citizen rust orange, player B's Ravels in Ravel green, because ownership colour
is hardcoded per player slot, not derived from the roster each side happens to be playing. The two
armies **are** clearly distinguishable — that half of the ask already works, and is what the RULE
was written to guarantee — but a Ravel force rendered in the other faction's signature colour reads
as slightly wrong to look at, which is the itch behind "their secondary colour."

| Option | Cost |
| --- | --- |
| A. **Keep ownership-primary colour as the RULE states.** Glyph family already carries faction identity, so a mirror match still reads as "same faction" from the letters alone | Free — no code changes. One side of a same-faction mirror wears a colour that belongs to the other faction, which this session's screenshot shows plainly once you go looking for it |
| B. **Faction-primary colour, ownership as a secondary shade** — each faction keeps one signature hue; player A gets it at full saturation, player B gets a darkened/lightened variant of the *same* hue. Citizen-vs-Ravel keeps today's high-contrast look (the shades of two different hues are already far apart); a mirror match now reads as "same faction, two shades" rather than "two unrelated factions" | Every role that currently reads `player.a`/`player.b` needs to become a function of (faction, player) instead of player alone — `playerRole()`'s signature, every call site, and the `StyleRole` vocabulary itself (`player.a`/`player.b` become something like `player.citizen.a`/`player.citizen.b`/`player.ravel.a`/`player.ravel.b`, or a role plus a shade multiplier). Changes the RULE in `engine.md`, needs a canon bump, and needs re-proving that monochrome (which currently separates the sides on colour alone dropping to nothing, relying on case) still stays legible without any hue at all |
| C. **Skins**: let a player choose a faction's colour identity per match, banked as a third axis alongside the theme (dark/light) this session added. The owner's own long-term want, and the natural home for "players will love to choose their faction skin" | A real feature, not a palette tweak — persistence, a selection UI (even a CLI flag needs a place to keep the choice across a Pulse), and a data model for what a skin actually overrides. Squarely Milestone 2+ scope; nothing here needs it to work today |

**Recommendation: A for now, B when a mirror match is common enough on the schedule to be worth the
refactor, C only inside a real themes/skins system.** The RULE's actual job — tell two players apart
— already holds, proven by both mirror fixtures existing and rendering distinctly; what's missing is
faction fidelity in the rarer same-faction case, which is a real but purely cosmetic gap, not a
legibility bug. B is a mechanical, well-scoped change whenever it's prioritized (the type system
already forces every `playerRole()` call site to be found). C is not a "fix" at all — register it
as the owner's long-term direction and let a themes-focused milestone pick it up deliberately, not
as a rider on a mirror-colour question.

### Q19 — Where does sandbox placement, rewind/fast-forward, and a feedback replay engine live?

**Status:** OPEN — not needed for Gate 1B or Milestone 2; the owner asked for it to be kept in mind
and registered, explicitly not built now.

The owner's own words, after playing the Pulse Playground (now `grid`): "I will want to start
improving the Pulse Playground to have 'sandbox mode' starting with an empty map, maybe some pre-seeded units, and
have the cursor that can choose units and place them wherever, then run the simulation. I will love
to implement rewind and fast forward (1, 5, 10, 20 turns)... If we also add the ability to define new
buildings and upgrades in between pulses, then we will have a full replay engine that will also be
used to replay existing games, which will be really good for us to get feedback from users." He was
explicit this is forward-looking, not a request for this session: "Just keep this in mind (perhaps
use to edit the spec), but not needed for now."

Three things are bundled in that paragraph, and they are not all the same size or the same
milestone:

- **A full replay format** — content locks, hashes, versions, a `verify` path that re-simulates
  *recorded input* rather than a scenario file — is already Milestone 2's, explicitly: "the one
  contract Milestone 1 did **not** lock" (`milestone-2-deterministic-pulse.md`). Nothing new to
  register here; the owner's ask is confirmation this direction is wanted, not a new requirement.
  [`replay-format.md`](replay-format.md), written this session at the owner's direct request, is a
  first concrete schema and log-level design for it — still GUIDANCE, still unbuilt, but no longer a
  blank page for whoever starts Milestone 2.
- **Rewind/fast-forward at named granularities (1/5/10/20 ticks)** is presentation on top of that
  format: once a Pulse's states are addressable by tick, jumping to `tick - 20` is arithmetic, not a
  new capability. The only design consequence *now* is a constraint on Milestone 2's replay format:
  it should keep every tick's state cheaply addressable (or cheaply re-derivable) rather than only
  the final one, so scrubbing is cheap later rather than needing a second format change.
  `src/view/playback.ts`'s `Playback` class already addresses presentation time arbitrarily
  (`step-frame`/`step-tick`/pause/resume) for exactly this reason — the mechanism the owner is asking
  for already exists one layer down; scrubbing *backward* and by *named tick counts* is the new part.
- **Sandbox placement — an empty or pre-seeded Grid, a cursor, choosing and placing units, then
  running** — reads as an early, reduced form of Milestone 3's battle editor
  (`milestone-3-builder-editor.md`: "a text/CLI-accessible battle editor... build-radius preview,
  connectivity, outpost, defense, producer, cost, undo, validation"), but the owner's framing is
  lighter and different in purpose: a fast unit-matchup sandbox for *exploring the kernel*, not the
  competitive Build Phase with cost, validation, and a hidden simultaneous-reveal plan. Placing a
  trooper and a runner nose to nose to see who wins does not need a supply cap or an outpost radius.

| Option | Cost |
| --- | --- |
| A. **Fold all three into Milestone 3's battle editor**, since it already owns placement and validation | One editor, one thing to build. The owner's sandbox use case (quick, no economy, no validation, built to explore the kernel — closer in spirit to `grid` than to a competitive Build Phase) waits for the full editor's much larger scope, including parts a kernel-exploration tool does not need |
| B. **A lightweight placement mode added to `grid` itself**, ahead of Milestone 3 — no cost, no validation, no hidden plan, just a cursor, the existing fixture rosters, and `run` — with the real Build Phase editor arriving in Milestone 3 as the validated, competitive version | Keeps the owner's actual ask (a fast kernel-exploration tool) small and close to what exists today; two placement UIs to eventually reconcile, one lightweight and one full, unless B is later folded into or replaced by Milestone 3's |
| C. **Do nothing until Milestone 3 is scheduled** | Free. The owner explicitly said this is fine ("not needed for now") |

**Recommendation: C until Milestone 2 is accepted, then B before Milestone 3 if the owner wants to
play with matchups sooner than the full editor arrives** — it is a small, self-contained addition
(cursor, placement, run; no cost or validation) that reuses `grid`'s own rendering and kernel rather
than waiting on Milestone 3's much larger contract. Milestone 2's replay-format design
should keep per-tick state cheaply addressable regardless of which option is picked, since rewind
depends on it either way and it is nearly free to keep in mind while that format is still being
designed rather than retrofitted after.

### Q20 — When target selection is capped by radius for scale, what should a unit with nothing in range do?

**Status:** OPEN — not needed until perception's cost is a measured problem, not a projected one;
registered now because the tradeoffs are cheap to write down before any fixture or hash depends on
the answer, exactly the situation Q17 was found in after the fact.

A code-quality and scalability review this session (`engine.md` Section 11.1 has the assessment)
found perception — `hostilesOf` + `selectTarget`, `src/pulse/tick.ts` — is the one hot path that is
O(N²) every tick, unconditionally: every attack-capable actor scans every hostile actor, every tick,
with no cap. At Milestone 1's scale (dozens of actors) this is invisible; at "hundreds or thousands
of units" (the owner's own framing, this session) it is the dominant cost, and there is no scenario
or measurement yet proving how far it can be pushed before that matters.

The fix nobody disputes is bounding the scan: cap target selection to a radius R around the
searching actor, using a coarse spatial index built from `OccupancyIndex`'s own placement mutations
(`add`/`remove`/`move`, already touched at every placement change, `src/pulse/tick.ts:514`, `:771`,
`:856`) rather than a wholly separate structure. What's genuinely undetermined is what a unit finds
when nothing is within R.

| Option | Cost |
| --- | --- |
| A. **Full-scan fallback** — if nothing is within R, fall back to today's unbounded scan | Correct in the sense that behavior never changes, but defeats the point on a sparse map: the expensive case is exactly the one this rule exists to bound |
| B. **Hold idle / keep the last target** — a unit with nothing in R does not search further; it holds its current order (or idles) until something enters R | Cheap and bounded, but a visible, emergent behavior change: a unit that would have crossed the map to engage a lone straggler now ignores it. Changes fixture hashes for any scenario sparse enough to hit the cap |
| C. **A new non-targeting `Behavior`** — something like advancing toward a fixed point (the enemy Nexus) rather than toward a discovered target, so a unit with nothing in R still has purposeful movement, just not target-seeking | Bounded and intentional rather than an accidental idle, but it is new surface: `Behavior` is currently `"advance" \| "flee" \| "static"` (`src/content/types.ts`), and per AGENTS.md's own convention ("every rule has a named scenario file") it needs its own fixture and test coverage before it is a rule rather than a guess |

**Recommendation: none of these until R is actually needed.** Landing the radius cap itself
inert/off by default — as GUIDANCE, not as shipped behavior — is the right amount of design-now,
build-later; picking a fallback is a real, hash-affecting decision (like Q17's tie-break) that is
expensive to reconsider once a fixture is pinned to it, so it should wait for a scenario that
actually forces the question rather than being guessed at now. When it is needed, B is the cheapest
and most honest first cut — a unit going idle at the edge of its own perception is at least legible
on screen, where a full-scan fallback (A) quietly reintroduces the exact cost the cap exists to
remove, and C is worth doing only once "advance on the enemy Nexus" is a rule the game wants anyway,
not manufactured to serve this cap.

### Q21 — Does the palette need more contrast, and specifically where?

**Status:** OPEN — presentation only; blocks nothing.

Owner playtest, 2026-08-22, after otherwise positive feedback: "Perhaps we have to work on the
colors to ensure more contrast." Both gate reports (`evidence/report.md`, `evidence/gate-1b-report.md`)
say the same thing about colour: the human half of the gate — someone actually watching — never
happened before now, so this is new information, not confirmation of something already checked. Two
earlier contrast bugs did already get fixed from an owner playtest this same session cycle
(`chrome.muted` compounding with the `dim` SGR attribute, and `player.a`/`player.b`'s ANSI-16 codes
not matching the hue their 256-colour and truecolor entries already committed to — both recorded in
`src/view/roles.ts`'s own comment), so "check contrast" is not a new category of ask, but this is the
first time it has been raised as still not enough.

Measured rather than guessed at, using WCAG's relative-luminance contrast ratio against the truecolor
values in `src/view/roles.ts`:

| Pair | Dark theme | Light theme |
| --- | ---: | ---: |
| `player.a` vs background | 5.80:1 | 4.45:1 |
| `player.b` vs background | 12.06:1 | 4.11:1 |
| **`player.a` vs `player.b`** | **2.08:1** | **1.08:1** |
| `terrain.rock` vs background | 5.26:1 | 8.75:1 |

Each side against the background clears WCAG AA's 3:1 floor for a UI component in both themes. The
two sides **against each other** do not, and the light theme is close to a real failure: 1.08:1 means
Citizen rust and Ravel green sit at almost identical brightness in light mode, separated only by hue
— fine for most vision, a real problem for the red-green colour-blindness the palette's own hue
choice (orange vs green) is already close to. This reads as the specific thing behind "more
contrast": each side is individually legible against the field, but the two sides are not maximally
distinct from each other, especially in light mode.

| Option | Cost |
| --- | --- |
| A. **Leave it.** Each side already clears the accepted floor against the background, and the RULE this palette serves — ownership keeps the colour, faction keeps the glyph family (Q18) — never promised the two sides would be *maximally* far apart, only distinguishable | Free. Doesn't answer what the owner actually saw; a note this specific after an otherwise glowing pass is unlikely to be nothing |
| B. **Retune `player.a`/`player.b`'s lightness (not hue)** in each theme so their mutual contrast ratio clears a real floor (WCAG's 3:1, say), keeping today's hues — rust stays rust, green stays green — since case (upper/lower) and glyph family already carry the primary distinction and colour is reinforcement, not the only signal | Small, mechanical, two swatches in one table per theme; the light-theme fix (1.08:1) is the one that actually matters, dark's 2.08:1 is a smaller gap. Directly answers the measured problem without opening the mirror-match hue redesign Q18 already scoped separately |
| C. **A fuller palette pass** — reconsider every role pair's contrast, not just player-vs-player, informed by real screenshots at real fight moments rather than isolated swatch math | Most thorough, but bigger than what the note asks for, and swatch math in isolation already found the one pair worth fixing; a full pass is better justified once there's a second concrete complaint to anchor it |

**Recommendation: B**, scoped to the light theme's `player.a`/`player.b` pair specifically (the
measured 1.08:1), since it is the one number here that reads as an actual accessibility gap rather
than a stylistic preference, and it does not touch the hue identity Q18 already owns. Left unbuilt
rather than shipped speculatively: retuning a lightness value without a screenshot in front of
someone is exactly the kind of presentation choice with a tradeoff (today's hues were chosen
deliberately against `terminal-nexus-lore.md`'s faction palettes) that this session's own protocol
says is the owner's call, not a guess to ship quietly.

### Q22 — Should movement carry deterministic, terrain-based jitter?

**Status:** OPEN — presentation, but touches the state/presentation boundary closely enough to need
a real answer rather than an assumption; blocks nothing before it is built.

Owner playtest, 2026-08-22: "moving units at slight different speeds also helps a lot to see nicer
movement. I wonder if we should build in some movement jitter based on terrain (pseudo-random but
deterministic so we can rep[l]ay). I think that will cause the whole animation of having an army
engage another army work much better." This session's own 1.5x speed pass already varies rate
*across unit types* (trooper, marksman, hauler, and all five Ravel units now step at different
cadences — see the speed-pass commit) — real, and already shipped — but that is not what "jitter"
asks for: identical units of the *same* type still step in perfect lockstep with each other, tile for
tile, tick for tick, which is what makes a formation of ten troopers currently read as one shape
moving rather than ten individuals.

The engine already draws a hard line the jitter idea sits right on top of: **the two random streams —
seeded gameplay, free cosmetic — never touch** (`AGENTS.md` Section 4; `engine.md`'s PCG32/hash-of-
identity split; `ascii-effects.md` Section 1's whole reason cosmetic randomness is a *hash*, never a
*stream*). "Pseudo-random but deterministic so we can replay" is exactly the cosmetic-hash shape
`fx.*` recipes already use (`instanceHash`, `src/view/effects/recipes.ts`) — a hash of the actor's own
identity plus its tile, salted, sampled at presentation time. The open question is not *whether* it
can be deterministic (it can, the same way every effect already is), but **which side of the state/
presentation line the jitter itself lives on**:

| Option | Cost |
| --- | --- |
| A. **Pure presentation: interpolation only.** The simulation still moves an actor from tile to tile on its exact tick; a hash of `(ordinal, from, to)` perturbs only *how* `Playback`'s interpolation draws the in-between frames (a slightly bowed path, a few ms of lead/lag on the arrival beat) without moving the tick the kernel resolved. Never touches `stateHash` or `eventsHash` | The cheap, safe answer — same shape as `fx.move.trail` already interpolating between tiles today. Ceiling on how much variety it can show: two troopers still arrive at their tile on the *same tick*, only the path between looks less uniform |
| B. **Presentation offset with a state-side hook: a per-actor cosmetic "phase"** — assigned once at spawn from a hash of the actor's identity, shifting *when in its own cadence window* it visibly commits to a step, without changing the tick arithmetic `movement.ts` uses for arbitration. More convincing desync than A, since two troopers now visibly step at different moments, not just travel differently between fixed steps | Real new surface: a per-entity value that has to be threaded from spawn through to the view without ever being read by a rule (the same discipline `facing` already gets — presentation-only, fenced out of the hash). Needs its own small test proving it never perturbs `stateHash`/`eventsHash`, the same proof `ascii-effects.md` Section 6 already requires of every recipe |
| C. **Terrain-keyed rather than actor-keyed**, so the jitter is a property of the tile a mover is crossing (a rocky tile jitters more than plain ground) rather than of the mover itself — closer to the owner's literal phrase "based on terrain" | Most literal reading of the ask, but conflates two different visual causes (an individual's gait varying, versus ground that is hard to cross) into one mechanism; A or B already deliver "an army looks like individuals, not one shape" without needing terrain to carry a new presentation property it does not have today |

**Recommendation: A first**, as a small, self-contained addition to `Playback`'s existing
interpolation, built and shown side by side with jitter off — the cheapest way to test the owner's
own claim ("I think that will cause the whole animation... work much better") before committing to
B's larger surface. If A does not deliver enough visible variety once someone is actually watching
it, B is the next step, keeping the phase strictly presentation-side and proving it with the same
kind of test every effect already carries. C is not recommended on its own; if terrain should
influence the *feel* of crossing it, that reads more like a `movementRate` terrain modifier — a real
rule, not a presentation jitter — and is a different, bigger question than this one.

### Q23 — How does an army reach its first engagement faster, beyond raw movement speed?

**Status:** OPEN — Milestone 2/3 scope (Build Phase, outposts); nothing here is authorized to build
now, registered so the ask is not lost between now and whenever those milestones open.

Owner playtest, 2026-08-22, immediately after asking for faster movement (already shipped, this
session's speed pass): "we should probably think about how to reach the initial conflict faster. Maybe
outposts regroup units next to them so next pulses resolve faster." AGENTS.md Section 2 is explicit
that economy, production, the Build Phase, and outposts are not authorized before Mario accepts
Milestone 1, so nothing in this note is built here regardless of how reasonable it sounds — this row
exists so the idea is on record rather than re-derived from a chat transcript whenever Milestone 2 or
3 opens.

The idea itself: an **outpost** (a forward structure, presumably built during a future Build Phase)
that reassembles retreating or newly-produced units near itself between Pulses, so the *next* Pulse's
armies start closer together than the map's raw geometry would otherwise put them — shortening the
"how long until anyone is doing anything interesting" gap this session's speed pass only partially
closes (raw movement speed helps every Pulse; regrouping would specifically help the *second and
later* Pulses of a match, where geography has already been fought over once).

| Option | Cost |
| --- | --- |
| A. **Fold into Milestone 2's routing/production work directly** — an outpost becomes a structure type with a "units spawn or return near me" behavior, designed alongside production once Milestone 2 actually has production | Keeps it with the systems it depends on (there is no Build Phase, no production, and no multi-Pulse match yet to regroup *between*) |
| B. **A named placeholder in `commander-armies.md` or `milestone-2-deterministic-pulse.md`** now, so the shape is captured even before Milestone 2 opens | Cheap, but there is little to say yet beyond the one sentence above — Milestone 2's contracts are already locked per the execution ledger, and reopening them for one line is more ceremony than the idea currently earns |
| C. **Do nothing until Milestone 2 opens**, and rely on this row | Free, and consistent with how Q19's sandbox/replay ask was handled — registered, explicitly deferred, picked up when its milestone actually starts |

**Recommendation: C**, same shape as Q19. This is a real idea worth keeping, but it presupposes
structures, production, and multiple Pulses in a single match, none of which exist yet; the right
place to design it is alongside Milestone 2's routing work and Milestone 3's Build Phase, not as a
speculative addition to a milestone still officially unauthorized.

### Q24 — Does the terminal cell's own aspect ratio distort movement and fire enough to fix?

**Status:** OPEN — the owner asked this be noted and set aside, not explored now; blocks nothing.

Owner playtest, 2026-08-22, raised while watching movement and diagonal fire, then explicitly
deferred in his own words: "I wonder if we should do something about that, because it makes movement
and diagonal shooting look a bit distorted; too fast when moving up and down, too slow when moving
sideways... If the tiles were landscape that would be better... however the vertical lines being
taller does not make sense for perspective. Let's explore the vertical-rectangle issue later, for now
just take note." Recorded verbatim rather than acted on, per that instruction.

This is not a new observation about the underlying cause — `engine.md` Section 9.3 already names it
as a RULE-level fact and a RULE-level mitigation: "a terminal cell is about twice as tall as it is
wide... a radius that is square in tiles looks like a wide rectangle," and the fix already shipped is
adaptive tile width — one terminal column per Grid tile at 80 columns (the acceptance target, and
where the distortion is at its worst), two columns per tile at 128 or wider (`--tile-width 2`, closer
to square). What is new is the owner watching the *default*, one-column acceptance target in motion
and feeling the distortion in movement pacing specifically — a moving actor covers vertical distance
in fewer visual terminal-rows than it takes to cover the same number of tiles horizontally, so a
vertical approach reads as sped up and a horizontal one as dragging, even though the *simulation*
timing is identical in both directions (movement cost is uniform per tile, not per screen pixel). The
same physical distortion the RULE already accepted for radius previews turns out to also read as a
*timing* problem once things are actually moving, not just a *shape* problem for a static circle.

The owner's own three ideas, each with a real cost:

| Option | Cost |
| --- | --- |
| A. **Leave it — the two-column mode is the existing answer.** `--tile-width 2` already exists and already reads closer to square; the fix is "use the wide mode," which the acceptance-target default cannot do without abandoning 80 columns | Free. Does not help anyone watching at the 80-column acceptance target, which `engine.md` 9.3 fixes as *the* target, not a fallback — so the actual complaint (default mode reads distorted) stays exactly as it was |
| B. **Landscape tiles** (the owner's own suggestion) — draw each Grid tile as two or more terminal columns even at the "narrow" composition, trading Grid width shown for squareness | Owner's own stated objection applies here too: fixes the shape/timing distortion, but is presentation choosing to show less Grid rather than more, at exactly the acceptance-target size `engine.md` treats as fixed |
| C. **Compensate movement's presentation timing directionally** — since the distortion here is specifically about *pacing* (vertical reads fast, horizontal reads slow) rather than shape, interpolate a vertical step over more presentation-time than a horizontal one of the same tile-distance, so both *look* like they take the same real time even though the kernel's tick cost is identical either way | Presentation-only in principle (no state or hash impact — same shape as Q22's interpolation-only option), but it is compensating for a display artifact by lying more, in a specific and asymmetric direction, which needs someone actually watching it to judge whether it reads as "fixed" or as "the diagonal ones now look weird instead" |
| D. **Change the acceptance target itself** — the owner's own "vertical lines taller does not make sense for perspective" caveat already argues against the literal landscape-tile idea; a more square terminal composition (more rows, fewer columns, or a different floor than 80×24) is the harder version of the same question | The owner flagged this as the one he does *not* currently want pursued ("does not make sense for perspective") — named for completeness, not recommended |

**Recommendation: none, per the owner's own instruction to set this aside.** If this returns, C is
the narrowest starting point — it treats the newly-noticed problem (motion *pacing* reads uneven) as
distinct from the older, already-answered one (a static shape looks stretched), rather than reopening
`engine.md` 9.3's tile-width RULE to solve a timing complaint a wider tile does not by itself fix.

### Q25 — Should the palette derive its lower tiers from one truecolor source, and should a cell be able to be transparent?

**Status:** OPEN — the transparency half amends a RULE-marked type and cannot be decided by a
session; the derivation half is measurable and mostly answered below.

Owner, 2026-08-24, after watching the sixth round's effects: "I think the color scheme needs to
define *transparency* that would adapt the color to the backend color. The code would process the
final true color, and then the final pass would turn that into monochrome or 16 colors by closest
approximation. If we are not doing this already, make sure this architecture is part of the grid tech
and the effects."

**Half of this is already the architecture.** A cell carries `fgRole`, never a colour
([`engine.md`](engine.md) Section 9.1, RULE), and roles are resolved to colour at the very last pass —
`frameToAnsi` → `sgrOf` → `sgrFor` (`src/view/frame.ts`, `src/view/roles.ts`). Nothing composes in
colour and nothing stores one. So "process the colour, then a final pass turns it into the tier" is
the shape that already runs. What is *not* derived is the table: `PALETTE[theme][role]` hand-authors
three independent values per role — `ansi`, `indexed`, `rgb` — and `sgrFor` picks one. The question is
whether `rgb` should become the single source and the other two a computation.

**Measured, not assumed** (nearest-match by squared RGB distance, against the xterm renderings the
project's own capture tooling already uses, dark theme):

| Tier | Roles whose derived value differs from the hand-authored one |
| --- | ---: |
| 256-colour | 10 of 18 differ, but 11 of 18 land within 12 RGB units — mostly the same colour |
| **16-colour** | **9 of 18 differ, and three of the differences are damaging** |

The 16-colour failures are specific and they are not tuning noise:

- **`chrome.muted` derives to ANSI 90** — the exact "bright black" value an owner playtest already
  had removed, because it compounds with the `dim` attribute every `chrome.muted` cell also carries.
  `src/view/roles.ts`'s own comment records that fix. A naive derivation reinstates a fixed bug.
- **`player.a` and `player.b` both derive to ANSI 90** — the two sides collapse to the *same grey*.
  That is the Q21 contrast complaint made maximally worse, at the one tier with the least room.

A perceptual metric does not rescue it: OKLab, with and without chroma weighting, reproduces the
hand-authored choice on 0–1 of the 9 disputed roles and still sends `player.a` to grey. The cause is
structural rather than a bad formula — **the 16-colour palette contains no desaturated entries**, only
eight hues, eight brights, and greys. Any nearest-match of a deliberately muted design colour lands on
grey, because grey genuinely *is* the nearest colour. The hand-authored 16-colour row is not
approximating the RGB badly; it is answering a different question — *which of eight hues keeps these
things apart* — which is exactly what the file's own comment claims it is for.

The transparency half is a separate decision with a separate gate. `CellStyle`'s shape is printed
inside a **RULE** block in [`engine.md`](engine.md) Section 9.1; adding a field to it needs owner
acceptance and a canon bump ([`AGENTS.md`](../AGENTS.md) Section 3). It also brushes craft rule 7 in
[`ascii-effects.md`](ascii-effects.md) Section 3 — "Terminals have no alpha. Decay is not fade-out" —
which is GUIDANCE, and would need an explicit, recorded departure rather than a quiet one. What it
buys is real and already wanted: the compositor's lighting stack
(`src/view/effects/composite.ts`, built for the owner's "the white color can stack... then dim
slowly") currently has only the four steps `dim`/plain/`bold`/`inverse` to express intensity, because
there is no continuum to express it on.

| Option | Cost |
| --- | --- |
| A. **Derive 256 only; keep 16 hand-authored; monochrome unchanged.** One truecolor source of truth, one computed tier, one tier that stays a deliberate distinguishability table with a comment saying why | Small and measured. Keeps every fix the 16-colour row already encodes, removes the hand-authoring burden where it buys nothing (11 of 18 already agree within 12 RGB units), and leaves the pipeline honest: the owner's "final pass" exists, it is just a lookup on one leg. Does not by itself deliver transparency |
| B. **Derive every tier, with a per-role override table for where derivation is wrong** | Superficially the owner's ask in full. In practice the 16-colour leg needs overrides on roughly half its roles, at which point it is a hand-authored table wearing a computation's clothes — more machinery, same values, and a new way to silently regress when someone adds a role and forgets the override |
| C. **A + transparency: add one scalar to `CellStyle`** (`fade` / `alpha`, 0–1), applied *by the resolver* — blend the role's RGB toward the theme's `BACKGROUND_RGB`, then quantize. The cell still carries a role and a number, so 9.1's "never a colour" stays literally true | Delivers what the owner actually described, and upgrades the flash-stacking continuum already asked for. Costs a canon amendment to a RULE-marked type, a recorded departure from craft rule 7, and an honest limit: direct ANSI does not paint a background, so this blends toward an *assumed* theme background, not the terminal's real one (OSC 11 probing was already rejected as unreliable, `roles.ts`) |
| D. **True alpha over whatever is beneath in the band stack**, rather than over the background | The version that sounds most like "transparency" and costs the most: `composeBands` is deliberately colour- and capability-agnostic, so this moves colour resolution earlier, into composition, and gives up the property that one composed frame serves every tier — which a test currently asserts by comparing tiers. Not worth it for the effect being chased |

**Recommendation: C, in two steps, and only after looking at it.** Do A first and put it in front of
the owner as a side-by-side at both tiers — it is cheap, it is measurable, and if the derived
256-colour tier reads worse than the hand-authored one on a real fight frame, that is worth knowing
before anything larger is built on it. Then bring C's one-scalar amendment to the owner as an explicit
canon change with a screenshot of what it buys, rather than shipping a new `CellStyle` field and
asking afterwards. **Do not do B or D**: B is measured above as machinery that reproduces a hand table,
and D pays for an architecture change with a property the test suite currently relies on.

Q21 (palette contrast) overlaps this directly and should be answered in the same pass — its
recommendation is a lightness retune of `player.a`/`player.b`, and the truecolor values are the thing
a derived pipeline would make the single source of truth.

## 5. Answered

Rows move here with the date, the decision, and the document that now owns it.

| ID | Answered | Decision | Now owned by |
| --- | --- | --- | --- |
| Q1 | 2026-08-20 | **Tile width is adaptive presentation capability**: one column per tile in the 80x24 composition, two columns per tile at 128 columns or wider. Same tiles, same actors, same revealed information — only the composition changes. The 80x24 floor is preserved and the concept art's look is reachable on a wide terminal | [`engine.md`](engine.md) Section 9.3 |
| Q2 | 2026-08-20 | **One resource.** Salvage recovers the same resource rather than a second one. Nexus energy is a state readout, not a currency. A second resource is an addition a later microgame may earn; it is not assumed | [`engine.md`](engine.md) Section 6 |
| Q3 | 2026-08-20 | **Units may span multiple tiles.** Large units are a normal, strategically important case, not a later extension — a Ravel raider drawn `>x<` is one unit occupying three tiles. The collision system tests a mover's whole footprint against its mask; damage and destruction apply to the entity, not the tile | [`engine.md`](engine.md) Section 3.5 |
| Q4 | 2026-08-21 | **The corruption law.** Corruption is drawn in the `effects` band and above, never in `units` or `structures`; it may add, overdraw, and unsettle, but never remove or replace the only cell carrying a required semantic cue. Recorded as decided because the rule was already RULE in the engine, restated in the lore, and listed among the locked product decisions — the register was the only document still calling it open | [`engine.md`](engine.md) Section 9.4 |
| Q6 | 2026-08-20 | **Packaging and remote delivery leave Milestone 1.** First split into an independent gate, then deferred out of the milestone entirely when it was refocused onto the Pulse — they answer no question the game currently has | [`milestone-1-spike-battle.md`](milestone-1-spike-battle.md) |
| Q10 | 2026-08-21 | **DROPPED as mis-scoped.** Engine determinism was never in question: the kernel, its event log, and replay stay exact, and the features that depend on them are untouched. Whether a mission's *interface* misreports a total for narrative effect is campaign writing, decided when campaigns are designed | [`campaigns.md`](campaigns.md), at Milestone 5 |
| Q11 | 2026-08-21 | **Alder refuse artificial Nexus power — conceptual.** Simplicity and growth instead: little or no Nexus draft, and more complexity in the structures they can build. Direction, not a locked mechanic | [`terminal-nexus-lore.md`](terminal-nexus-lore.md) Section 8.5 and [`commander-armies.md`](commander-armies.md) Section 4 |
| Q17 | 2026-08-21 | **Resolved by an unrelated fix, not decided among its options.** Four-way movement and Manhattan distance (Q15's fix, shipped for legibility) removed the degenerate tie itself: under Chebyshev a rank-deployed army had every enemy at the same distance; under Manhattan the same layout does not, because the axis the old metric ignored (`min(|dx|,|dy|)`) is exactly the one Manhattan keeps. Verified, not assumed: `citizen-mirror-skirmish.ts` (rank-deployed) now pairs each attacker with a distinct nearest opponent from tick 1, no stampede | [`grid/coords.ts`](../src/grid/coords.ts) `gridDistance`; `specs/open-questions.md` Q15 |

### Q17 — answered

Closed as bookkeeping on 2026-08-21, by empirical re-check rather than by choosing among its own
options: nobody decided to break Chebyshev ties differently. Q15's four-way-movement fix (a
legibility change, unrelated to targeting) changed the distance metric from Chebyshev
(`max(|dx|,|dy|)`) to Manhattan (`|dx|+|dy|`), and that alone dissolves the specific problem this
question was about.

The mechanism: under Chebyshev, two armies facing each other across a wide horizontal gap with `dy`
small have `max(|dx|,|dy|) = |dx|` for every pair — `dy` is *discarded* by the metric whenever the
horizontal gap dominates, which is exactly "deployed in a rank" — so every enemy really was the same
distance away, and the tie-break decided everything. Manhattan never discards either axis: distance
is `|dx| + |dy|`, so two defenders at the same `dx` but different `dy` are no longer tied. Checked
directly rather than assumed: running `citizen-mirror-skirmish.ts` — a rank-deployed fixture, the
same shape Q17's finding was measured against — now produces `engage` events pairing each attacker
with a distinct, natural opposite number (`A:trooper#1 -> B:trooper#2`, `A:trooper#3 -> B:trooper#4`,
...) from the first tick, not a stampede onto one target.

None of Q17's three options were chosen. Option A ("keep nearest, ties by entity id") turned out to
already be the right answer once the metric changed — no rule was rewritten. `citizens-versus-ravels.ts`'s
column-staggered deployment is no longer load-bearing for this specific reason, but it is still kept:
it is also good asymmetric-army design, not only a stampede workaround, and re-arranging a working,
evidenced fixture on a "no longer strictly necessary" technicality is not worth the churn.

### Q11 — answered

Mario, 2026-08-21, at concept level: **Alder refuse artificial power from the Nexus.** They want
simplicity and growth instead. Mechanically that reads as *less* where the Nexus is involved and
*more* where their own biology is: little or no Nexus draft, and a wider, more varied catalogue of
structures they can grow.

This is lore direction rather than a locked mechanic. Whether the draft is absent entirely or a small
grown pool, and how far the structure catalogue widens to compensate, stays undefined until a
milestone authorizes Alder content. The three options the register offered are superseded — the
answer keeps A's honesty about refusal while moving the depth into structures rather than into a
second progression system.

### Q4 — answered

Closed as bookkeeping on 2026-08-21, during the canon-consistency audit, rather than by a fresh
decision. The recommendation the row carried had already been promoted everywhere it mattered:
[`engine.md`](engine.md) Section 9.4 carries it as **RULE**, `terminal-nexus-lore.md` Section 9
restates it, `project-governance.md` Section 7 lists it among the locked product decisions, and
`AGENTS.md` repeats it as an architectural invariant. The register was the last document still
describing it as waiting on Mario, and a register that contradicts the canon is worse than no
register — the whole value of this file is that it can be trusted about what is settled.

If the locked-decisions entry was not intended as acceptance, reopen this row; nothing else changes.

### Q10 — dropped

Mario, 2026-08-21: the question conflated two separate things. The deterministic kernel is one — and
replay and fast-forward depend on it, so nothing narrative may touch it. Campaign story writing is
the other, and campaigns are designed later.

Nothing in the belief ramp asks the kernel, the event log, or a replay to be anything but exact; the
device only concerned what a mission's *interface* displays. That is a writing decision belonging to
the mission that wants it, so it needs no canon fork. [`campaigns.md`](campaigns.md) Section 4.1
keeps one line of guidance — the engine's record is never part of a narrative device — and the rest
waits for Milestone 5.

### Q3 — answered

Recorded in full in the Git history of this file at canon 2.2. Mario settled it directly: large units
exist and matter. [`engine.md`](engine.md) Section 3.5 carries the placement rule and Section 3.4.1
carries the collision consequence.

### Q1 — answered

Recorded in full in the Git history of this file at canon 2.1. The decision above is the durable
part; [`engine.md`](engine.md) Section 9.3 now carries the rule.

### Q2 — answered

Recorded in full in the Git history of this file at canon 2.1. [`engine.md`](engine.md) Section 6
now carries the rule.

### Q6 — answered

Recorded in full in the Git history of this file at canon 2.1. Superseded in scope at canon 2.2 when
Milestone 1 was refocused onto the Pulse and delivery left the milestone altogether.
[`milestone-1-spike-battle.md`](milestone-1-spike-battle.md) carries the gate structure;
[`project-governance.md`](project-governance.md) Section 5 carries delivery as its own gated
workstream.
