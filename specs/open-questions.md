# Terminal Nexus — open questions register

**Document role:** Durable queue of decisions that block or shape work, with owner answers
**Status:** Canonical process document; individual answers become canon elsewhere
**Canon version:** 2.6
**Updated:** 2026-08-21
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

### Q17 — Should a Chebyshev tie in target selection break on distance, or on entity id?

**Status:** OPEN — Gate 1B proceeds under the recommendation; the answer moves every hash, so the
timing matters more than usual.

Target selection is "nearest enemy by Chebyshev distance, ties broken by entity id"
([`milestone-1-spike-battle.md`](milestone-1-spike-battle.md) 3.7), and Gate 1A was explicit that
resisting the urge to improve it was part of that gate. Gate 1B's first asymmetric fixture showed
what it costs. On a 48 × 16 Grid with each army deployed in a rank — which is exactly how Citizens
are described as deploying — **every enemy is the same Chebyshev distance away**, because the
horizontal gap dominates. The tie therefore decides, it always decides the same way, and both
armies converge on one enemy each and stampede into a corner together.

Staggering both sides across columns fixes the fixture, and that is what
`citizens-versus-ravels.ts` does. It does not fix the rule.

| Option | Cost |
| --- | --- |
| A. **Keep "nearest, ties by entity id"** and stagger fixtures | Free, and it is the contract Gate 1A's evidence was measured against. Any scenario that deploys in ranks produces a stampede, and ranks are a faction identity |
| B. **Break the tie on squared Euclidean distance, then entity id** | One line, still integer arithmetic, still deterministic and replay-exact. Units pick the enemy actually in front of them, which is what "nearest" already meant. **Changes every state and event hash in the repository**, including the ones `evidence/report.md` quotes |
| C. Spread targets deliberately — prefer an enemy nobody else has claimed | The best-looking fights, and a real target-assignment pass inside perception. That is Milestone 2 work, and it is a rule a player would have to learn |

**Recommendation: B, but not until Gate 1A is accepted.** It is the honest reading of "nearest
enemy" and it costs one line — but Gate 1A's report quotes exact hashes and exact fixture
arithmetic, and moving those while the owner is about to watch the run they describe would make the
evidence stale in the worst possible week. Take A until then, which is what Gate 1B ships. C is a
better game answer and belongs to whichever milestone owns perception.

### Q18 — In a same-faction mirror match, should colour follow ownership or the faction?

**Status:** OPEN — Gate 1B proceeds under the recommendation; the answer only touches presentation.

`engine.md`'s stated RULE is "faction identity lives in the glyph family and the effect language;
ownership keeps the colour, so a mirror match stays legible and monochrome stays whole"
(`playerRole()` in `src/view/theme.ts`: player A is always `player.a`, player B is always
`player.b`, regardless of which roster either side is playing). The owner's playtest asked the
question behind that RULE directly: "How can we color mirror-matches? make sure you include citizen
vs citizen and ravel vs ravel" — and floated "their secondary colour" and, further out, a full
skins system with a player-chosen third colour.

Made observable this session: `ravel-mirror-skirmish.ts` is the Ravel counterpart to the existing
`citizen-mirror-skirmish.ts`, and a truecolor capture of it is what the RULE actually produces —
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

The owner's own words, after playing the Pulse Playground: "I will want to start improving the
Pulse Playground to have 'sandbox mode' starting with an empty map, maybe some pre-seeded units, and
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
| A. **Fold all three into Milestone 3's battle editor**, since it already owns placement and validation | One editor, one thing to build. The owner's sandbox use case (quick, no economy, no validation, built to explore the kernel — closer in spirit to this Playground than to a competitive Build Phase) waits for the full editor's much larger scope, including parts a kernel-exploration tool does not need |
| B. **A lightweight placement mode added to the Pulse Playground itself**, ahead of Milestone 3 — no cost, no validation, no hidden plan, just a cursor, the existing fixture rosters, and `run` — with the real Build Phase editor arriving in Milestone 3 as the validated, competitive version | Keeps the owner's actual ask (a fast kernel-exploration tool) small and close to what exists today; two placement UIs to eventually reconcile, one lightweight and one full, unless B is later folded into or replaced by Milestone 3's |
| C. **Do nothing until Milestone 3 is scheduled** | Free. The owner explicitly said this is fine ("not needed for now") |

**Recommendation: C until Milestone 2 is accepted, then B before Milestone 3 if the owner wants to
play with matchups sooner than the full editor arrives** — it is a small, self-contained addition
(cursor, placement, run; no cost or validation) that reuses this Playground's own rendering and
kernel rather than waiting on Milestone 3's much larger contract. Milestone 2's replay-format design
should keep per-tick state cheaply addressable regardless of which option is picked, since rewind
depends on it either way and it is nearly free to keep in mind while that format is still being
designed rather than retrofitted after.

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
