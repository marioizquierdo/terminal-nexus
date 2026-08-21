# Terminal Nexus — open questions register

**Document role:** Durable queue of decisions that block or shape work, with owner answers
**Status:** Canonical process document; individual answers become canon elsewhere
**Canon version:** 2.5
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
