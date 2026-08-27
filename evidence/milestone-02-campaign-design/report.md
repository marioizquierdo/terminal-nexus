# Gate report — Milestone 2, Campaign Design (brainstorm pass)

**Document role:** Gate report closing Milestone 2's design pass
**Status:** Complete; awaiting owner review
**Canon version:** 2.9
**Updated:** 2026-08-27
**License:** Apache-2.0; the narrative material this report points at is CC BY-SA 4.0

Copied from [`../../specs/templates/gate-report.md`](../../specs/templates/gate-report.md). Nothing is
deleted; headings that do not apply say so.

---

## 1. Frame — written before coding

- **Canon version:** 2.9
- **Milestone and gate:** Milestone 2 — Campaign Design. One design pass; this milestone is not
  sub-gated.
- **Question this gate answers:** What does the campaign's first arc need to contain — and what
  systems does it need for unlocks and teaching — such that milestones 3 through 10 can build against
  it without each re-deriving it?
- **Smallest artifact that can answer it:** written design, in the options + cost + recommendation
  shape the open-questions register already uses, applied to campaign concept rather than to
  engineering forks. No code. Milestone 2's own charter says so at its top: "Design work, not code."
- **Automated evidence planned:** `./scripts/check-repository.sh` at the start and again before
  handoff. That is the whole automated surface available — this gate produces documents, and there is
  nothing here for `grid` or `npm test` to resolve.
- **Human observation planned:** Mario reads the four registered questions (Q39–Q42) and either
  confirms the recommendations or names a different answer. Q39 in particular is a product-direction
  call and is explicitly not a session's to make.
- **Explicit exclusions:** no content authoring (no new unit, structure, or upgrade ids — every unlock
  is named as a *role*); no `.map.json` file checked in; no code; no canon promotion; nothing from
  `AGENTS.md` Section 2's do-not-build list; no second Commander Army; no closure of Q32/Q33 while Q39
  is open.
- **Stop conditions:** if the brainstorm had found that the existing plan was unworkable rather than
  merely unexamined, the right move was to stop and report that rather than design a replacement
  unilaterally. It did not — it found the plan sound and one improvement to it — so the pass
  continued.

## 2. Environment — pinned, not remembered

| | |
| --- | --- |
| OS and architecture | Linux 6.18.44 x86_64 (Claude Code on the web container) |
| Runtime and exact version | Node.js as provisioned in the container; used only to run the repository validator and one throwaway layout script |
| Dependencies and exact versions | None added. No install step was run |
| Hardware, if it affects measurements | Not applicable — no measurements were taken |
| Date measured | 2026-08-27 |

Commands, copy-pasteable, in the order a stranger would run them:

```bash
# install
# (none — this gate adds no dependency and runs no build)

# build
# (none)

# test
./scripts/check-repository.sh

# run
# (nothing to run — the artifacts are documents)
```

## 3. What was built

Six design documents in `evidence/milestone-02-campaign-design/`, four new rows in the open-questions
register, and an updated milestone tracker.

| File | Contents |
| --- | --- |
| [`research-notes.md`](research-notes.md) | Nine games, each read for one specific mechanism, each cited. Ends with the four claims they agree on and the one question none of them answers |
| [`progression-system.md`](progression-system.md) | The unlock system (the **Manifest**), the eight refused alternatives, the **One Lesson Rule**, the telegraph precondition, and two explicit teaching curricula — one for the upgrade pick, one for the support-capable base |
| [`campaign-concepts.md`](campaign-concepts.md) | The incumbent plan versus three genuinely different campaign concepts on six axes, with a recommendation and a statement of what would change it |
| [`story-and-cast.md`](story-and-cast.md) | The story in a few words; three ways to open through Nexus events; the escalation ladder; Vasse's narrative introduction; the second-Commander mission; the lose-everything set-piece |
| [`perimeter-sketch.md`](perimeter-sketch.md) | The milestone's concrete Definition-of-Done items: fixture confirmation, a 60 × 20 map layout with real coordinates, and the scripted-raid trigger shape |
| [`two-audiences-audit.md`](two-audiences-audit.md) | Ten recommendations checked against the player's experience and the developer's |

Register additions: **Q39** (which campaign concept), **Q40** (fixed unlock versus a choice),
**Q41** (where the lose-everything set-piece sits), **Q42** (the second Commander). Each carries
options, costs, and a recommendation.

[`../../milestones/milestone-02-campaign-design.md`](../../milestones/milestone-02-campaign-design.md)
gains a pointer at its top marking Section 4 as a first draft under review, and its Definition of Done
is updated with what is done, what is deliberately held, and why.

## 4. Automated results

| Check | Result | Evidence |
| --- | --- | --- |
| `./scripts/check-repository.sh` at session start | Pass — canon 2.9, current gate "2 — Campaign Design" | Run before any file was touched |
| `./scripts/check-repository.sh` before handoff | Pass | Section 2's commands, run verbatim |
| Every `OPEN` question carries a recommendation | Pass (validator check 5) | Q39–Q42 each contain a `**Recommendation` line |
| Every referenced question id is defined | Pass (validator check 5) | Q39–Q42 are referenced from the milestone tracker and defined in the register |
| Local Markdown links resolve | Pass (`scripts/check-markdown-links.mjs`) | One broken link was introduced and caught mid-pass — see Section 7 |
| Map layout row widths | Pass — all 20 rows are exactly 60 characters | Asserted by the throwaway generator script that produced the layout; the assertion is the reason the layout is trustworthy rather than eyeballed |

Measurements:

| Metric | Value | Method | Samples |
| --- | --- | --- | --- |
| — | — | No measurements. This gate produces design, not behaviour | — |

The absence of a measurements table is the honest result, not an omission. The one number in the
design that *looks* measured — `pulseTicks: 720` — is explicitly labelled arithmetic rather than
evidence in [`perimeter-sketch.md`](perimeter-sketch.md) Section 2.4, with the exact command that
would turn it into evidence named for Milestone 6.

## 5. Human observations

**Nobody has looked at any of this yet.** That is the state as of handoff, and it is the whole point
of the gate: the four registered questions exist precisely because they are Mario's to answer, and the
milestone's own Definition of Done ends on "Mario has looked at the decisions above," still unchecked.

What Mario is being asked to look at, in priority order:

1. **Q39** — the campaign concept. The recommendation is to keep the existing plan and graft one idea
   onto it; the alternative worth arguing for is named explicitly in the row.
2. **Q40** — whether an unlock is fixed or chosen. Cheap to answer, and it shapes Milestone 4.
3. **Q41 / Q42** — both deliberately far ahead of any build, registered so they are not decided by
   accident inside some future mission's authoring session.

## 6. Interpretation

**The existing plan survived the pressure test, and that is a result rather than a formality.** Three
alternatives were designed properly — each with an opening, a tone, a faction pairing, and a real
accounting of what it would cost — and the incumbent won on five of six axes. What the exercise
actually produced was not a replacement but a diagnosis: Concept 0's single weakness is that its first
minute is a competent genre opening, and that weakness is fixable for the price of one cutscene
without touching anything else. A comparison that changes one thing and confirms the rest is a
comparison that was worth running.

**The most useful thing in the pass is not the campaign material — it is the telegraph.** Into the
Breach's design goal ("every death felt like your own fault") is achievable only because everything
needed to predict the outcome is on screen before commit. The Nexus Pulse is non-interactive in
exactly the same way, and nothing in the canon had previously named the consequence: *an un-steerable
resolution is only fair if the Build Phase telegraphs it.* That is a design constraint on every
mission this game will ever ship, it was discovered by reading one game carefully rather than by
reasoning from the canon, and — the part that made it worth writing down — PERIMETER's *already
written* briefing promises exactly that telegraph, in a sentence written for flavour long before
anyone knew the design required it.

**The One Lesson Rule and the Manifest are the two artifacts most likely to still be true in a year.**
Both are small, both are checkable, and both derive from the same observation: a six-mission campaign
does not have enough missions to support a second progression axis, so every proposal to add one
should be refused by default. The eight refused alternatives in
[`progression-system.md`](progression-system.md) Section 2.5 are, in practice, the most valuable table
in the pass — not because refusing them was hard, but because writing down *which* eight were on the
table stops a later session from re-adding one by drift.

**The pass came in under its own scope on purpose.** Q32 and Q33 could have been moved to Answered —
Milestone 2's Definition of Done asks for it — and were deliberately not, because both are
PERIMETER-specific and Q39 could still change whether PERIMETER opens the campaign. Closing them now
would mean closing them twice.

## 7. Failures, surprises, and discarded approaches

**The alternatives argument that failed.** Concept A (open on the Ravels) looked strong for two hours
of work and then collapsed on one fact already in the canon: `commander-armies.md` Section 4.2 assigns
the Ravels *maximal variance* as their doctrine, and Section 1 records that their two unproven rule
shapes — jackpot drafts and scrap doctrine — are exactly the ones a Ravel campaign would need first.
Teaching an autobattler with the high-variance faction means the player cannot reproduce the lesson
they just learned. That argument is not obvious from the outside and would have cost a later session a
real amount of work to rediscover, which is why it is written into the Q39 row rather than only here.

**The trigger list nearly shipped with a verb it does not need.** The first draft of the scripted-raid
shape had two verbs, `spawn` and `activate`, on the reasoning that "already visible but not yet moving"
is a nice telegraph. It is — but `activate` needs a held state and a release event in the *kernel*,
while the telegraph is better served by drawing the arrival marker during Build Phase, which is
presentation reading authored data and needs nothing from the kernel at all. One verb does PERIMETER
completely. The general lesson, and the reason this is here: **a feature justified by a presentation
goal should be checked against a presentation solution before it is built into the simulation.**

**A rule that would have contradicted itself.** An early draft of the unlock system had Mission 5
unlocking "replay and report access," which reads well until it meets the system's own rule that an
unlock must change the construct menu or the draft. A replay viewer changes neither. Rather than weaken
the rule, the resolution was to say that a menu feature gated by campaign progress is a *different
system* with a different owner — which is itself part of the simplification. Recorded because the
temptation to widen a definition to fit one case is exactly how a small system becomes a large one.

**One broken link, caught by the validator, not by me.** The milestone tracker was updated to point at
this report before this report existed, and `scripts/check-markdown-links.mjs` failed the run. Trivial,
and worth noting only because it is the class of mistake a documentation-only pass is most likely to
make and least likely to notice by reading: a pointer written in good faith to a file that does not
exist yet. The validator caught it in under a second, which is a small argument that a docs-only gate
should still run the full check rather than assume it has nothing to fail.

**What I could not do and did not fake.** No mission was played, because none exists to play. Every
claim in this pass about how something will *feel* — that the mirror match teaches twice, that the
prologue's contrast is worth its cost, that 720 ticks is roughly right — is a design argument, not an
observation, and each is labelled as one where it appears. The single cheapest thing a future session
could do to improve this pass is run `grid` against a hand-built approximation of
[`perimeter-sketch.md`](perimeter-sketch.md)'s layout and find out how long the raid actually takes.

## 8. Decision

> **PASS**

The gate's question was what the first arc needs to contain and what systems it needs, written down
precisely enough that milestones 3 through 10 do not each re-derive it. That is answered: an unlock
system with five rules and eight named refusals, a mechanic-introduction rule with a cheap enforcement
path, a telegraph precondition that applies to every mission the game will ship, two explicit teaching
curricula, a 60 × 20 map with real coordinates and a stated routing constraint, and a scripted-opponent
shape with six determinism rules. The four decisions that are genuinely the owner's are registered with
recommendations rather than guessed, and the pass kept working on everything those answers do not touch
— which is nearly all of it.

It is a PASS rather than a REVISE because nothing here is waiting on a comparator or a rerun; it is
waiting on a reader. The milestone itself does not close until Mario has looked, which is its own
Definition of Done's last line and not something a session can check off.

## 9. Canon impact

**Nothing below is applied.** Every row is a proposal contingent on this gate being accepted.

| Proposed rule | Would live in | Earned by |
| --- | --- | --- |
| The Build Phase must telegraph the Pulse: everything needed to evaluate a Build Phase decision is on screen before commit | `specs/engine.md` Section 9 (presentation), as GUIDANCE until a mission proves it | Reading Into the Breach's stated design goal against the fact that the Nexus Pulse is non-interactive in the same sense; corroborated by PERIMETER's own briefing already promising it |
| The unlock system (the Manifest): one content id, granted on mission completion, at most one per mission, must change the construct menu or the draft, additive and never subtractive | `specs/campaigns.md` Section 3, replacing the current one-paragraph treatment of unlocks | The StarCraft II model, the Slay the Spire pool-dilution warning, and the FTL discovery-model refusal — all three named in `research-notes.md` |
| The One Lesson Rule: a mission declares exactly one `teaches`, the lesson is load-bearing for the outcome, and a mission's unlock enables the next mission's lesson | `specs/campaigns.md` Section 3, as a checkable form of what that section already says in prose | Advance Wars' Field Training structure, made explicit |
| A mission's scripted opponent is a `script` array of `{ atTick, spawn }` entries in the map file, with one verb, spawns resolving at a named point in the tick order, and out-of-place spawns skipped with a `WARN` | `specs/engine.md` Section 4 (the tick order point is a RULE) and the scenario format | Q32's Option A, made precise; the one-verb simplification earned by checking a presentation goal against a presentation solution |
| PERIMETER's map is 60 × 20 (`large-extra-wide`), sized so it scrolls at the 80 × 24 floor and fits whole at the viewport maximum; `campaigns.md` Section 4.1's "a small Grid that never scrolls" is amended to describe the feel rather than the geometry | `specs/campaigns.md` Section 4.1 | Q38's Option A, with the viewport arithmetic filled in |
| Nothing may sit on-axis with the Nexus footprint on a mission map whose opponent approaches on a fixed lane | A note in the scenario-authoring guidance, not a kernel rule | Q33's Option A, turned from "author around it" into a constraint a future edit can violate and be caught for |

Questions raised, each already added to
[`../../specs/open-questions.md`](../../specs/open-questions.md) with a recommendation:

| ID | Question | Recommendation |
| --- | --- | --- |
| Q39 | Which campaign concept does the first arc actually build? | Concept 0 (the existing PERIMETER opening), with Concept B's cold open grafted on and Concept C reserved as the arc-2 opening |
| Q40 | Is a mission's unlock fixed, or does the player choose one of two? | Fixed, implemented as a one-element list so widening it later is a data change |
| Q41 | Where does the "epic opening, then lose everything, then rebuild" set-piece sit? | After the belief ramp as the arc-2 turn; the prologue version stays an ambition and gets built last if ever |
| Q42 | Which Commander other than Vasse appears, as what, and where in the arc? | Marshal Teag — a constraining voice at Mission 4, and the playable Commander opening arc 2 |

## 10. Next authorized action

Mario answers Q39 (and ideally Q40); the session that follows closes Q32 and Q33 against that answer
and updates Milestone 2's Section 4 to match, and nothing beyond that until Milestone 2 is accepted.
