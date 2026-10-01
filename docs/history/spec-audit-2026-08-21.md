# Specification audit — canon 2.4 → 2.5

**Audited:** every document under `specs/` and `concept/`, plus `AGENTS.md`, `DEVELOPMENT.md`, and
`scripts/check-repository.sh`.
**Date:** 2026-08-21
**Status:** findings applied at canon 2.5. This file is the record of *why*, and of what was
deliberately not done.

## What this audit asked

Not "is the design good" — "does this document set survive being executed by isolated,
smaller-model sessions over months, with no memory of each other?" A spec for autonomous agents
fails in two opposite directions. **Under-specified**, and three sessions build three incompatible
architectures. **Over-specified**, and a session faithfully implements a guess the author made about
code they had never written. The second is the more dangerous, because it looks like diligence.

The project's defence is the RULE/GUIDANCE marker system plus "descriptive completeness is not
authorization." **The defence holds.** What follows are the places it had leaked, ranked by
cost-of-being-wrong.

---

## P0 — contradictions on Gate 1A's path *(applied)*

These would have been hit by the first implementing session. Each made two documents disagree about
a rule Gate 1A must implement, or left the flagship scenario undefined.

### P0.1 — Speed-tier order was contradictory, and speed tier was never defined

`engine.md` 4.3 step 7 said attacks resolve in **"descending speed tier"**; the milestone's fixture
said **"lower speed tier resolves first, so the marksman fires before the trooper swings."** Opposite
orders — and only the milestone's reading makes the fixture's own combat arithmetic work. Step 5
said "resolve by speed tier" with no direction at all. Nothing anywhere defined what `speedTier`
*means*: the fixture uses one number for both attack initiative and movement-claim priority, which is
a real design decision that existed only as an unlabelled column.

**Applied.** 4.3 steps 5 and 7 now both say tier 1 first. A new paragraph defines speed tier as
initiative, used identically in both places, explicitly independent of `movementRate` — so a slow
heavy unit may still strike first. Step 5's tie-break chain is now unambiguous: speed tier, then one
seeded draw, and entity id orders *iteration and event emission, never outcomes* (previously "then
entity id" was unreachable, since a seeded draw already totally orders the claimants).

### P0.2 — The viewport algorithm gated every Grid smaller than the minimum viewport

`engine.md` 3.3 (RULE) said: clamp to the minimum, "then clamp again to the Grid's own size", then
gate if the result is below the minimum. Run literally on Gate 1A's own 24 × 12 Grid: clamp to
48 × 16, clamp to 24 × 12, result is below the minimum → **resize gate, on every terminal, forever.**
The algorithm could not display the milestone's primary scenario. The intent was obvious; the step
ordering lost it.

**Applied.** Step 3 is now `viewport = min(availableTiles, maximumViewport, gridSize)` and step 4
gates on `availableTiles < min(minimumViewport, gridSize)` — a Grid smaller than the minimum viewport
needs only its own size, which is also what makes the tutorial-sized presets work as intended.

### P0.3 — The chrome arithmetic contradicted itself *(Q12)*

Section 3.1 derived the composition as 16 + 2 border + header + footer = **20 rows** (a 4-row chrome
budget). Section 3.3's table gave the maximum viewport as 104 × **28** — also 4 rows — while the same
table's minimum row, **80 × 24**, requires 8. *The two rows of one table disagreed with each other*,
so no reading made the canon consistent, and meanwhile "80 × 24 is the floor" is stated as RULE in
four places including the locked product decisions.

**Applied under the recommendation, and registered as Q12** because the trade is Mario's: the chrome
budget is now explicitly **8 rows** (2 border, 3 header, 3 footer), 3.1's derivation is corrected,
and the maximum row is now 104 × 32. Rationale: 80 × 24 is the number every other document already
repeats, it is the historic terminal standard, and 3.3 itself requires a footer carrying a position
readout and an edge-marker legend. Moving rows *between* header and footer inside the 8 needs no
canon change — only the total is fixed.

### P0.4 — The flagship scenario contradicted the rules it exercises *(Q13)*

Three problems, all inside the mirror skirmish:

1. Worker flight fled "toward the friendly Nexus" — **the mirror skirmish places no Nexus.**
2. "One side annihilated" was undefined with a flee rule in play: workers can outlive every fighter.
3. The summary example said 8 units per side; the placement overlay contains **7** (3 `m`, 2 `r`,
   2 `w`), so an agent asserting the documented example against the scenario would have failed.

**Applied.** Item 3 was a typo, corrected to 7. Items 1 and 2 are a genuine fork with game-feel
consequences, so they are **Q13**, with the recommendation written into 3.7: with no friendly Nexus,
flee directly away from the nearest threat; annihilation counts every entity on `workers`, `units`,
and `air`. The alternative — a side reduced to workers loses — is the better *game* answer and a
cheap later change; it is deliberately not taken now because nobody has watched a mirror ending yet.

### P0.5 — The ranged flight window: two documents assumed it, none defined it

The milestone said ranged attacks record "the flight window" on the event; `ascii-effects.md` said
the tracer's duration "is the gap between the attack event and the impact event, which the simulation
already provides." But `engine.md` 4.3 resolves attack and damage in the *same* tick and explicitly
refuses simulated projectiles — so where did a nonzero gap come from, in what unit, and does the
renderer show the health change at the attack beat or the impact beat? Kernel and view sessions would
have answered differently, and the difference is visible on screen as damage landing before the
tracer arrives.

**Applied.** 4.3 now states that damage is authoritative at the tick it resolves, that the event
carries a flight window in ticks derived deterministically from distance, that it is part of the
event and its hash, and that **no rule reads it** — renderers hold the impact, flash, and visible
health change until the window ends, and a renderer drawing no tracer still presents damage at the
impact beat.

---

## P1 — silent-failure gaps: what no listed check would have caught *(applied)*

Gate 1A's acceptance list was strong on determinism and collision. These are failures that would
have passed **every** check in it.

### P1.1 — Nothing tied the view to the truth

Every view check was about the view's *self-consistency*: right size, pure in its arguments, stable
under frame-skipping. **None checked that the frame showed the fight the kernel resolved.** A
compositor with a transposed axis, an off-by-one band, or a stale entity index produces
deterministic, pure, correctly-sized, monochrome-clean frames **of the wrong fight** — and the only
remaining detector was Mario's eyes on a 24 × 12 grid at 30 fps.

Worse, `run` and `watch` both load scenarios and run the kernel. If they ever diverged, Mario would
approve a fight the test suite never ran.

**Applied.** Two new checks: at a frame sampled on a tick boundary every entity's glyph stands on its
authoritative tile, asserted against the event stream; and `watch` computes the same state and event
hashes as `run`, prints them on exit, with a test asserting they match.

### P1.2 — The report could lie independently of the events

The log is the agent feedback loop, and its determinism was checked — but nothing constrained *where
it came from*. A report reading kernel internals can narrate a story the events don't contain, or
omit deaths they do, and every check still passes, because the log was only ever compared with
itself.

**Applied.** `src/report` must derive everything from the event stream and final state, asserted as
an import rule alongside the existing `src/pulse` ↛ `src/view` one. This also collapses half of P1.1
for free: if report and view both consume only events and state, the grep and the eyeballs are
guaranteed to be looking at the same fight.

### P1.3 — Determinism was only ever tested on one runtime

Twenty runs, same machine. Both Bun and Node are already present (the milestone's own Section 5), and
`engine.md` 10 makes "library and runtime are independent choices" a design claim. Cross-runtime
agreement is the cheapest possible test of both, and it targets exactly the nondeterminism class —
serialization formatting, iteration edge cases, native-library behaviour — that same-machine repeats
can never find.

**Applied** to 3.9: `verify` must produce identical hashes under Bun and under Node.

### P1.4 — The coordinate convention was nowhere written down

`Coord {x, y}`, `Direction "n" | …`, scenario terrain rows, the band compositor, and the
orientation-transpose RULE all depend on a shared answer to: where is (0,0), which way does `y` grow,
what does `n` point at? No document said. This is the cheapest possible way for the kernel, loader,
and view sessions to build mirror-image worlds that each pass their own tests.

**Applied** to `engine.md` 3.5 and echoed in `AGENTS.md`: (0,0) is north-west, `x` east, `y` south,
`n` is `y - 1`, scenario rows north to south.

### P1.5 — Resize was a RULE with no home in Gate 1A

`engine.md` 9.6 (RULE) requires a resize gate that freezes presentation time. Gate 1A's view section
and checks never mentioned resize — neither implemented, tested, nor excluded. The first person to
drag a terminal edge would get undefined behaviour.

**Applied.** The gate is now in 3.8 and its check in 3.9. Scrolling stays out of scope, so this is
the gate and nothing more — the disposer work was being done anyway and the gate is a dozen lines.

### P1.6 — The log's grammar was load-bearing and unversioned

The fixed-column promise is what lets agents assert on behaviour, but the grammar existed only as an
example. As rules arrive, sessions would add kinds ad hoc and reshape columns, silently rotting every
existing grep-based assertion.

**Applied.** The grammar `[tick] LEVEL kind subject [-> object] detail…` is now part of the report
module's tested surface, and it grows **by adding kinds, never by reshaping columns**. Tests needing
structure assert on `--events` JSONL, which was already the real machine surface — the log is for
humans and story-level asserts.

### P1.7 — An experiential claim was hiding in the automated list

"The Pulse is legible in monochrome" sat in the automated acceptance list, in a project whose
governance explicitly forbids treating automated tests as proof of experiential claims.

**Applied.** The automated list now checks the mechanical half (monochrome renders without error, no
cell depends on colour to exist); the experiential half moved to 3.10 next to "Mario has watched a
mirror skirmish run", as its own checkbox.

### Verdict on 3.10, the definition of done

Otherwise honest, and worth saying so: nine of eleven items are mechanically checkable by the agent
that did the work, and the two needing a human are explicit about it. That is the right shape. The
only structural gap was P1.1 — the checklist proved the kernel right and the view deterministic, but
nothing proved the view *true*.

---

## P2 — authority-system integrity *(applied)*

The RULE/GUIDANCE defence mostly held. `engine.md` Section 0 is well written, the milestone actively
reminds sessions not to build Section 8, and Section 8 opens by disclaiming itself. **The obvious
suspect was already defused** — the audit came hunting for it and found sketches, explicitly labelled
as sketches, trimmed to what the fixture foreshadows. It was left alone.

### P2.1 — Presentation data lived in hashed canonical state

`facing` is in every placement (RULE), read by no rule, with Q9 still open on whether it ever will
be. So presentation-only data sat in authoritative state, participated in the canonical state hash,
and changed every tick a unit turned. The cost is minor; **the precedent is not** — the next session
wanting interpolation hints or animation state in the kernel could point at it. This was the one
place the three-worlds separation leaked inside the spec itself.

**Applied.** Section 1 now carries the fence: canonical state carries nothing that only presentation
reads; facing is the single deliberate exception pending Q9; interpolation hints, animation state,
and camera position belong to the presentation model. If Q9 resolves to "presentation only", the
cheaper design is to drop facing from state and let the projection derive it from movement events.

### P2.2 — A RULE prescribed a cache it had not earned

3.4.1's mask-*composition* concept is genuinely load-bearing and correctly RULE. But the same RULE
also prescribed an implementation: "the kernel builds the mask once per tick per distinct layer set
and reuses it." That granularity assumes an occupancy lifecycle the tick order never defines —
arbitration losers recalculate mid-tick, *against what?* A once-per-tick mask is stale the moment the
first claim wins. An agent honouring the sentence literally either ships stale-mask bugs or quietly
violates a RULE to make arbitration work. **This is the guessed-algorithm failure mode this audit was
sent to hunt: the intent (no O(entities) scans in inner loops) wearing the costume of a mechanism.**

**Applied.** The intent is kept as RULE; the caching prescription is replaced with an explicit
statement that granularity — and how arbitration sees tiles claimed earlier in the same tick — is the
spike's to design and the gate report's to record.

### P2.3 — Q4 was answered everywhere except in the register

The corruption law was RULE in `engine.md` 9.4, restated in the lore, listed among the **locked
product decisions**, and echoed in `AGENTS.md` — while Q4 still sat in the register as OPEN, "waiting
on Mario". The register is how a session knows what is settled; the first time an agent finds it
contradicting the canon, it stops trusting the file, and that trust is the entire point.

**Applied.** Q4 moved to Answered as bookkeeping, with the reasoning stated and an explicit
invitation to reopen it if the locked-decisions entry was not intended as acceptance.

### P2.4 — Governance locked what the engine marked GUIDANCE

Governance locked the Grid preset matrix while `engine.md` 3.1 marked it GUIDANCE and said "a preset
is a convenience, not a constraint" — telling an agent both that it may depart and that departing
changes a locked decision. But the **default preset genuinely is load-bearing**: the 80- and
128-column compositions are derived from 48 × 16.

**Applied.** 3.1 is now "GUIDANCE, except the default preset, which is RULE", and the governance row
says the same. Separately, the scrolling micro-parameters (3-tile margin above all) are now marked
locked *direction* that Milestone 3 may retune on evidence — they came from Mario so the lock is
legitimate, but they describe an interaction nobody has performed yet.

Noted and deliberately left alone: `engine.md` 3.2 (orientation as a presentation transform) is RULE
though nothing depends on it yet and no renderer exists. By Section 0's strict definition it is
GUIDANCE wearing a badge — but it is a cheap RULE to carry and re-marking it would churn four
documents to no benefit.

### P2.5 — Stale section cross-references

The 2.2/2.3 renumbering left references the validator cannot see. Main had already fixed most.
Remaining and now corrected: `open-questions.md` Q1 (twice, 10.2 → 9.3) and `ascii-art-references.md`
(10.3 → 9.6).

**Not fixed by tooling, on purpose.** Teaching the validator to check section *numbers* is the
obvious move and the wrong one: numbers move on every restructure. The cheaper convention is to cite
sections by name as well — `engine.md §9.4 "Bands"` — so a grep survives renumbering. Recorded in
`DEVELOPMENT.md` as the thing to do at the next renumbering, not before.

### P2.6 — Milestone 1 promised an answer it cannot earn

Section 6 listed "answers to Q7 and Q9" among Milestone 1's durable outputs. Q7 is
workers-carry-versus-produce-in-place — **storage behaviour, in a milestone with no economy at all**,
whose own register row says "decide with the Milestone 4 microgame". A diligent session would either
invent economy to satisfy the completion list or report the milestone incomplete.

**Applied.** The line now promises an answer to Q9 plus any newly registered questions, and says
explicitly why not Q7.

Checked in the other direction too: **no OPEN question silently blocks authorized 1A work.** Q5, Q7,
and Q8 genuinely don't bite before Milestones 3–4; Q9 carries an explicit proceed-under
recommendation. The forks that *did* block 1A were unregistered — they are P0.3 and P0.4, now Q12 and
Q13.

---

## P3 — long-horizon decay *(applied)*

### P3.1 — What is actually irreversible, and whether the spec is honest about it

Honest and correctly locked: the seven-bit ASCII baseline, one-cell glyphs, the three worlds, the
cell frame, determinism and replay authority. Correctly deferred: serialization, hashing, and the
PRNG lock at Milestone 2 — *before* replay logs accumulate, which is the right moment.

The one under-acknowledged commitment: **content durations are authored in raw ticks**
(`cooldownTicks`, `intervalTicks`, every fixture cooldown), baking 12 Hz into every content number.
If evidence moves the tick rate, that is a manual migration of every duration in every definition and
scenario, and nothing said so.

**Applied** to 4.1, including the rejected alternative (rational seconds, which buys
rate-independence at the cost of arithmetic everywhere) and the reason the timing works out: Milestone
1 is where the hypothesis gets tested precisely because the fixture is six rows long and the
migration is an afternoon. It will not be an afternoon in Milestone 4.

**On the 12 Hz / movement-credit / tick-order stack** — the three deepest assumptions in the design.
Stress-tested, and the design has real defences. The credit accumulator reproduces the cadence table
exactly (verified by hand: `1/1`→12 ticks, `3/2`→8, `2/3`→18). The cap and keep-credit-on-block rules
are stated and tested. Tick rate is replay metadata that cannot drift inside a ruleset version. Most
importantly, **the first thing the project builds is the instrument that would falsify all three**,
with Mario watching. If 12 Hz is wrong it is found in weeks at the cost of retuning a six-row fixture,
not in months. The riskiest phase is arbitration — the only RNG consumer in Gate 1A, which is worth
stating explicitly because it makes determinism audits trivial — and the jammed-corridor bound test
targets exactly it. This is what earning a hypothesis is supposed to look like.

### P3.2 — Where canon will drift from code first

`check-repository.sh` compares documents against documents. The moment code exists there are two
copies of the cadence table, the preset matrix, the band list, the layer names, and the log grammar,
with nothing comparing them.

**Applied** to governance Section 9: every RULE table in `engine.md` gets a test named for its
section — `engine-4.1-cadence`, `engine-9.4-bands` — so drift becomes a failing test with the
specification section in its name. Same trick as the validator, applied to the half of the project it
cannot see.

Also applied: `AGENTS.md` now declares a canon version and the validator checks it. It restates ~20
invariants as a summary and carried no version, so a canon bump could leave it stale with nothing to
notice. (The check was negative-tested — set it to 2.4 and the build fails.)

### P3.3 — Parallel sessions, and the smallest set that must be agreed first

The architecture genuinely admits parallel work: kernel, view, effects, and CLI meet only through
serializable contracts, and the pure-function effect contract means Gate 1B can be built against
recorded event streams with no kernel session in sight. **The one real collision point is
`src/events`** — imported by pulse, report, view, and effects, and churning with every rule that
lands.

**Applied** to milestone 3.2: the five things to agree before splitting work — the coordinate
convention, the `DomainEvent` union and its serialization, the scenario module API, the log grammar,
and the `CellStyle` role vocabulary. Four are now written down; the role vocabulary is flagged as the
one that is not, for whoever opens the gate to commit first.

---

## What is genuinely working — do not touch

- **Section 0 and the two-marker system.** The reduction from three markers to two was right, and
  *"if you find yourself building something because it is in this document, stop"* is the single best
  sentence in the canon. The milestone reinforces it at the exact moment of temptation.
- **`engine.md` Section 8.** Already defused. Sketches, disclaimed, trimmed to what the fixture
  foreshadows.
- **The open-questions register.** Protocol, permanent IDs, mandatory recommendations,
  validator-enforced. Q8's options-and-costs table is a model of the form.
- **The validator's design stance** — deriving invariants rather than grepping literals, after
  learning that lesson the hard way. The `stale-ok` exemption is exactly right for a docs-only repo.
- **The Pulse Playground reframing.** Headless run and view built together, log-on-stderr /
  summary-on-stdout, scenario-file-per-rule as regression suite *and* documentation, "write the
  report before the rules get complicated." The best feedback-loop design in the document set.
- **The fixture arithmetic.** The trooper/marksman walkthrough is exactly consistent with the stat
  table under the credit rules. Someone did the math. The hauler-in-the-fixture reasoning
  ("an afternoon in Gate 1A; a week in Milestone 4") is the right kind of paranoia.
- **The gate-report template**, especially Sections 5 and 7, and the instruction to fill Section 1
  in before coding.
- **Evidence hygiene.** Standing evidence marked indicative with "re-measure anything you cite";
  OpenTUI churn quantified rather than hand-waved; Deno dropped for a measured reason.

## Open items for Mario

| ID | Question | Applied under |
| --- | --- | --- |
| Q12 | Vertical chrome budget: 8 rows and an 80 × 24 floor, or 4 rows and 80 × 20? | 8 rows, floor stays 80 × 24 |
| Q13 | Worker flight and annihilation on a Nexus-less Grid | Flee from nearest threat; workers count toward annihilation |
| Q4 | Closed as bookkeeping — reopen if the locked-decisions entry was not acceptance | Closed |
