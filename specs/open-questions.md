# Terminal Nexus — open questions register

**Document role:** Durable queue of decisions that block or shape work, with owner answers
**Status:** Canonical process document; individual answers become canon elsewhere
**Canon version:** 2.4
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

### Q4 — How does Glitch corrupt the terminal without breaking the legibility law?

**Status:** OPEN — no implementation depends on it until Glitch exists; record the rule now while it
is cheap.

[`terminal-nexus-lore.md`](terminal-nexus-lore.md) Section 9 says Glitch "violates stable terminal
conventions" and appears as literal software errors. [`engine.md`](engine.md) Section 9.6 requires
that every gameplay glyph occupy one cell, that colour never carry meaning alone, and that reduced
motion preserve anticipation, impact, and settled state. A faction whose identity is illegibility
collides with a law that requires legibility.

**Recommendation:** adopt this as a rule rather than leaving it to taste — *Glitch corruption is
applied in the `effects` band and above, never in the `units` or `structures` bands. Corruption may
add, overdraw, and unsettle; it may never remove or replace a cell that is the only carrier of a
required semantic cue.* That preserves the identity (the screen looks wrong) and the contract (you
can still see what is attacking you), and gives reduced-motion an obvious fallback.

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

### Q10 — May campaign presentation misreport authoritative state?

**Status:** OPEN — blocks nothing before Milestone 5; record the rule now while it is cheap.

The campaign belief ramp ([`campaigns.md`](campaigns.md) Section 4.1) wants one mission in which the
interface lies: on-screen totals disagree with what the player watched, and discovering the seam is
the story. The three-worlds law ([`engine.md`](engine.md) Section 1) is not violated — presentation
cannot influence the Pulse, and a lying screen does not — but legibility is the product's spine, so
deception needs a fence, not a shrug.

| Option | Cost |
| --- | --- |
| A. Never — the interface is always truthful | Loses the strongest storytelling instrument available to a game whose medium *is* the interface; the ramp's fifth mission collapses into narrated text |
| B. Campaigns may misreport freely | Erodes trust in the only surface the player has; a defect and a fiction become indistinguishable ("is my readout lying or broken?") |
| C. Mission-scoped diegetic deception under three constraints: only where the mission definition declares it; the deterministic report, event log, and replay stay truthful — the screen lies, the log never does; and the mission surfaces the seam in play, so the player can always catch the lie | A small presentation capability and authoring discipline; skirmish and every non-campaign surface never lie |

**Recommendation: C.** It converts the engine's own honesty — the levelled report, the event log,
the replay — into a narrative instrument: the log becomes the in-fiction incorruptible witness. It
also keeps faith with the deliberate-mysteries rule that the interface may misbehave but never
testify ([`terminal-nexus-lore.md`](terminal-nexus-lore.md) Section 7).

### Q11 — Is Alder's refusal of Nexus power mechanical, and how?

**Status:** OPEN — blocks nothing before a milestone selects Alder; shapes their identity now.

Refusing Nexus power is Alder's central identity and moral claim
([`terminal-nexus-lore.md`](terminal-nexus-lore.md) Section 8.5). The Nexus upgrade draft
([`engine.md`](engine.md) Section 5.4) is a core cross-faction system. If Alder drafts Nexus
upgrades like everyone else, the faction's philosophy is contradicted by its own interface verb every
match — the exact failure the alignment test exists to catch.

| Option | Cost |
| --- | --- |
| A. Alder has no draft; a parallel "cultivation" progression replaces it | Strongest characterisation; a second progression system to design, balance, and teach, and one faction bypasses shared machinery |
| B. Alder drafts normally, flavored as reluctant containment | Cheapest; fiction and mechanics disagree at the precise point the faction's identity lives — fails the no-lore-player test |
| C. Same draft machinery, different source: Alder drafts from a faction-owned cultivation pool (their own biology and cycles); Nexus-derived options simply never appear for them | Keeps one teaching surface and one implementation while making refusal visible in every single draft; costs a per-faction draft-pool capability the draft likely wants anyway |

**Recommendation: C.** A is the fallback if C proves too thin to carry the fantasy; B should be
rejected on sight.

## 5. Answered

Rows move here with the date, the decision, and the document that now owns it.

| ID | Answered | Decision | Now owned by |
| --- | --- | --- | --- |
| Q1 | 2026-08-20 | **Tile width is adaptive presentation capability**: one column per tile in the 80x24 composition, two columns per tile at 128 columns or wider. Same tiles, same actors, same revealed information — only the composition changes. The 80x24 floor is preserved and the concept art's look is reachable on a wide terminal | [`engine.md`](engine.md) Section 10.2 |
| Q2 | 2026-08-20 | **One resource.** Salvage recovers the same resource rather than a second one. Nexus energy is a state readout, not a currency. A second resource is an addition a later microgame may earn; it is not assumed | [`engine.md`](engine.md) Section 6 |
| Q3 | 2026-08-20 | **Units may span multiple tiles.** Large units are a normal, strategically important case, not a later extension — a Ravel raider drawn `>x<` is one unit occupying three tiles. The collision system tests a mover's whole footprint against its mask; damage and destruction apply to the entity, not the tile | [`engine.md`](engine.md) Section 3.5 |
| Q6 | 2026-08-20 | **Packaging and remote delivery leave Milestone 1.** First split into an independent gate, then deferred out of the milestone entirely when it was refocused onto the Pulse — they answer no question the game currently has | [`milestone-1-spike-battle.md`](milestone-1-spike-battle.md) |

### Q3 — answered

Recorded in full in the Git history of this file at canon 2.2. Mario settled it directly: large units
exist and matter. [`engine.md`](engine.md) Section 3.5 carries the placement rule and Section 3.4.1
carries the collision consequence.

### Q1 — answered

Recorded in full in the Git history of this file at canon 2.1. The decision above is the durable
part; [`engine.md`](engine.md) Section 10.2 now carries the rule.

### Q2 — answered

Recorded in full in the Git history of this file at canon 2.1. [`engine.md`](engine.md) Section 6
now carries the rule.

### Q6 — answered

Recorded in full in the Git history of this file at canon 2.1. Superseded in scope at canon 2.2 when
Milestone 1 was refocused onto the Pulse and delivery left the milestone altogether.
[`milestone-1-spike-battle.md`](milestone-1-spike-battle.md) carries the gate structure;
[`project-governance.md`](project-governance.md) Section 5 carries delivery as its own gated
workstream.
