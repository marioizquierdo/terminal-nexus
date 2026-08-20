# Terminal Nexus — open questions register

**Document role:** Durable queue of decisions that block or shape work, with owner answers
**Status:** Canonical process document; individual answers become canon elsewhere
**Canon version:** 2.1
**Updated:** 2026-08-20
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

### Q1 — How many terminal columns does one battlefield tile occupy?

**Status:** OPEN — blocks the Gate 1A fixture composition and every later art decision.

Canon locks a 48x18 battlefield inside an 80x24 composition. That arithmetic only closes at **one
column per tile**: 48 interior + 2 border = 50, leaving 30 columns of sidebar. The concept art in
[`../concept/README.md`](../concept/README.md) is drawn at **two columns per tile**, which needs a
roughly 128x24 composition and is where its readability comes from.

This is not cosmetic. It sets the horizontal budget of every effect, whether a unit motif can be
wider than one glyph (see Q3), and how dense a late-Pulse battle looks.

| Option | Cost |
| --- | --- |
| A. One column per tile, 80x24 | Honest minimum; runs anywhere; dense battles risk becoming a wall of letters |
| B. Two columns per tile, ~128x24 minimum | Matches the concept art and reads far better; abandons the 80x24 promise |
| C. Tile width is a presentation capability: 1 at 80 columns, 2 at 128+ | Keeps the 80x24 floor and the wide-terminal look; costs one compositor parameter |

**Recommendation: C.** Tile width changes no semantics, reveals no extra tiles, and is exactly the
kind of thing [`engine.md`](engine.md) Section 10.2 already permits — a larger terminal frames the
same map without revealing extra tactical information. Gate 1A renders its fixture at both widths so
the decision is made by looking rather than by argument.

### Q2 — How many resource types does a match use?

**Status:** OPEN — does not block Gate 1A; blocks Milestone 3 UI and Milestone 4 balance.

[`engine.md`](engine.md) allows arbitrary resources (`Record<ContentId, number>`) and never commits.
The concept art disagrees with itself: one piece shows `SALVAGE` and `ENERGY` as separate readouts
alongside faction population, another shows a single `RES` counter.

| Option | Cost |
| --- | --- |
| A. One resource; salvage is the same resource recovered from wreckage | Simplest Build Phase; fits a 5-12 minute match; less economic texture |
| B. Two resources (one harvested, one from salvage/energy) | Real build-order tension; doubles worker AI, UI, and balance surface |

**Recommendation: A for Milestone 4.** A second resource is an addition the microgame can earn
later; removing one after content exists is expensive. Nexus energy should be a *Nexus state*, not a
spendable resource, until something needs it to be one.

### Q3 — Is a unit one glyph, or a motif wider than one glyph?

**Status:** OPEN — blocks Gate 1B authoring; depends on Q1.

[`engine.md`](engine.md) Section 5 says MVP actors occupy one tile.
[`terminal-nexus-lore.md`](terminal-nexus-lore.md) Section 8.2 offers `>x<` as a Ravel raider, and
the concept art draws it on the battlefield. Structures are unaffected — they legitimately have
integer footprints, so `[=H=]` is a five-cell Citizen structure and is already legal.

The occupancy answer is not in doubt: **a unit occupies exactly one tile.** The open part is
presentation. A one-tile actor may still be *drawn* across more than one column if the composition
grants it the columns — which is Q1.

| Option | Cost |
| --- | --- |
| A. One tile, one glyph, always | Never ambiguous; loses the faction-shape vocabulary the lore is built on |
| B. One tile, motif may fill the tile's full column width | `>x<` needs three columns and so needs Q1 = B or a three-column tile |
| C. One tile, one glyph, with faction shape carried by *neighbours* — formation, trail, and effect cells | Keeps 80x24 and keeps faction geometry; the shape lives in motion rather than in the actor |

**Recommendation: C, with B available at two-column tile width.** Lore Section 9 already says motion
completes the drawing; leaning on formation and trail is cheaper than widening every actor, and it
degrades gracefully at one column per tile.

### Q4 — How does Glitch corrupt the terminal without breaking the legibility law?

**Status:** OPEN — no implementation depends on it until Glitch exists; record the rule now while it
is cheap.

[`terminal-nexus-lore.md`](terminal-nexus-lore.md) Section 9 says Glitch "violates stable terminal
conventions" and appears as literal software errors. [`engine.md`](engine.md) Section 10.3 requires
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

[`engine.md`](engine.md) Section 6.4 says two tiles. The builder concept art shows `RADIUS +4`. One
of the two is stale. The distance metric is separately unlocked and belongs to Milestone 3.

**Recommendation:** keep two as the default in canon and treat `+4` as an outpost value, which is
what the art is actually showing — it is drawn on an Outpost.

### Q6 — Does packaging and remote delivery belong inside Gate 1A?

**Status:** OBSERVABLE — resolved in this revision; kept for the record.

Gate 1A previously required standalone executables, a PTY/SSH smoke test, and a browser terminal
demonstration before Gate 1B could start, while [`engine.md`](engine.md) Section 11.2 calls remote
and browser surfaces "architectural possibilities, not Milestone 1 product commitments." Those two
statements could not both be honoured.

**Resolved:** Gate 1A answers cell frame, lifecycle, and backend selection. Packaging and remote
delivery move to Gate 1D, which is authorized independently and does not block Gate 1B. See
[`milestone-1-spike-battle.md`](milestone-1-spike-battle.md).

### Q7 — Do workers carry, or produce in place?

**Status:** OPEN — blocks nothing before Milestone 4.

[`engine.md`](engine.md) Section 6.1 says workers do not carry bundles home and produce continuously
at a job, then says they return toward the Nexus when storage fills and resume "immediately" when
capacity opens. Returning-when-full is carry-shaped behaviour inside a no-carry model, and
"immediately" ignores travel time.

**Recommendation:** keep produce-in-place, and make a full store simply **stall** the worker at its
job rather than send it home. Stalled workers are readable (they stop moving), they punish
under-built storage without a walk-home animation nobody asked for, and they remove the travel-time
contradiction. Decide with the Milestone 4 microgame.

## 5. Answered

_None yet. Rows move here with the date, the decision, and the document that now owns it._

| ID | Answered | Decision | Now owned by |
| --- | --- | --- | --- |
