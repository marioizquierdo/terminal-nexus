# Milestone 2 write-up — the campaign design pass

**Document role:** The process write-up the repository asks for at the end of a milestone
**Status:** Complete; waiting on Mario
**Canon version:** 2.9
**Updated:** 2026-08-28
**License:** Apache-2.0; the story material it points at is CC BY-SA 4.0

Mario does not need to read this — [`README.md`](README.md) is the one to read. This exists because
the project asks every milestone to close with the same shape: what question it answered, what it did,
what it could not verify, and what it decided.

---

## 1. The frame, written before starting

- **The question:** what does the campaign's first arc need to contain, so that the eight milestones
  pointed at it do not each invent an answer separately?
- **The smallest thing that could answer it:** written design — alternatives, what each costs, and a
  recommendation. Not code. The milestone's own charter says design, not code.
- **How it would be checked:** the repository validator, at the start and again before handing back.
  That is the whole automated surface: this milestone produces documents, and there is nothing here for
  the simulation tools or the test suite to resolve.
- **Who looks at it:** Mario, at five decisions that are genuinely his — where the campaign starts, what
  the Commander does for a living, whether an unlock is fixed or chosen, where the lose-everything
  set-piece goes, and whether a second Commander appears.
- **What it deliberately would not do:** invent units, structures or numbers; add code; add a map file
  the game loads; change any rule; author a second faction's content; or close the two open questions
  that depend on where the campaign starts.
- **What would have stopped it:** if the existing plan had turned out unworkable rather than merely
  unexamined, the right move was to say so rather than silently design a replacement. It did not — the
  plan turned out to be *narrower than the real question*, which is a different and more useful finding.

## 2. Environment

| | |
| --- | --- |
| OS | Linux 6.18.44 x86_64, in the hosted session container |
| Runtime | Node.js as provisioned; used only for the repository validator and one throwaway script that drew the map |
| Dependencies added | None. No install step was run |
| Date | 2026-08-28 |

```bash
# install — none; this pass adds no dependency and runs no build
# build   — none
# test
./scripts/check-repository.sh
# run     — nothing to run; the artifacts are documents
```

## 3. What exists now that did not before

Eight documents in this folder, five decisions filed in the open-questions register (Q39 through Q43),
an updated milestone tracker, and one new instruction in the agent files.

The instruction is worth naming separately because it came from Mario mid-pass and it changed
everything else. The first version of these documents was written in the repository's own shorthand —
"proceeding under Q38's recommendation," "per Section 4.1's belief ramp" — which is unreadable to
anyone who does not have the section numbers memorised, and that is the person the documents were for.
AGENTS.md now carries a rule: anything a human reads names the actual idea, not the document it lives
in; internal shorthand is for notes aimed at the next agent, and this folder has one file for exactly
that.

## 4. What was checked

| Check | Result |
| --- | --- |
| Repository validator, at session start | Pass |
| Repository validator, before handing back | Pass |
| Every open question carries a recommendation | Pass — Q39 through Q43 |
| Every referenced question number is defined | Pass |
| Local links resolve | Pass, after catching three broken ones during the rewrite |
| Map layout row widths | All 20 rows are exactly 60 characters — asserted by the script that generated them, which is why the layout is trustworthy rather than eyeballed |

**No measurements were taken, and that is the honest result rather than an omission.** This pass
produces design, not behaviour. The one number in it that looks measured — a round length of 720 steps
— is labelled arithmetic where it appears, with the exact command that would turn it into evidence.

## 5. Who has looked at it

**Nobody yet.** That is the state, and it is the point: five decisions are filed because they are
Mario's, and the milestone's own last line is "Mario has looked at the decisions," still unchecked.

Mid-pass, Mario read the first version and reported that he could not follow it — the documents
referred to specification sections he does not have memorised, and to decisions a previous session had
made while the project was still being defined. That is the only human observation this pass has, and
it is the most valuable thing in the report: **the first version failed on legibility, not on content.**
Everything here was rewritten in response.

## 6. What I make of it

**The real finding is that the question had been asked too narrowly.** The earlier framing assumed the
campaign concept was settled and asked what its first mission should contain. Mario's actual open
questions are more basic — how missions look, who the general is, where to start — and once the
question is asked that way, several of the earlier decisions turn out to be answers to a question
nobody had asked yet. Rewriting the "which campaign concept" question into "which moment of the story
does the player start in" is a small edit that makes the decision answerable.

**The most useful thing in the pass came from reading one game carefully.** Into the Breach's stated
design goal — that every death should feel like the player's own fault — is achievable only because
everything needed to predict the outcome is on screen before committing. The Pulse has exactly the same
property, and nothing in this project had written down the consequence: *a fight you cannot steer is
only fair if the build phase telegraphs it.* That is a constraint on every mission the game will ever
ship. The detail that made it worth writing up: the already-written first-mission briefing promises
precisely that telegraph, in a sentence written for flavour long before anyone knew the design needed
it.

**Two artifacts are most likely to still be true in a year:** the one-thing-per-mission rule, and the
unlock system with its eight named refusals. Both come from the same observation — a six-mission
campaign does not have enough missions to carry a second progression system, so every proposal to add
one should be refused by default. Writing down *which* eight were considered is worth more than the
refusals themselves; it is what stops one of them creeping back in six months from now.

**The pass deliberately came in under its own stated scope.** Two open questions could have been closed
— the milestone asks for it — and were not, because both are specific to the raid-defence mission and
the question of which mission opens the campaign is still open. Closing them now would mean closing
them twice.

## 7. What went wrong, and what a future session should not rediscover

**The first version of this pass was written for the wrong reader, and that is the main lesson.** It was
accurate and unusable. The failure was not that the shorthand was wrong; it was assuming the audience
shared it. Anything a person reads has to name the idea, not its filing location. The rule is now in
AGENTS.md so it does not have to be relearned.

**An alternative that looked strong and collapsed.** Opening the campaign by playing the Ravels was
genuinely attractive for a while — the outsider frame is honest teaching, since a player who is told "I
do not know what this is either" is in the same position as the character. It died on one fact already
written down: the Ravels' whole identity is *maximum variance*, and the two mechanics that identity most
needs have never been built or tested. Teaching an autobattler with the high-variance faction means the
player cannot reproduce the lesson they just learned. Not obvious from the outside, and expensive to
rediscover.

**The enemy schedule nearly shipped with a verb it does not need.** The first draft had two: one to
place reinforcements on a timer, one to make an already-visible group start moving. The second is
appealing because "visible but not yet moving" is a nice way to telegraph a threat — but it needs the
simulation to hold a unit still and then release it, which is new machinery in the part of the code that
must stay simple. The telegraph is better drawn during the build phase, which touches the simulation
not at all. The general lesson: **a feature justified by a presentation goal should be checked against a
presentation solution before it is built into the simulation.**

**A rule that would have contradicted itself.** An early draft had mission five unlocking "replay and
report access," which reads well until it meets the rule that an unlock must change the build menu. A
replay viewer changes nothing there. Rather than weaken the rule, the fix was to say that a menu feature
which opens up as you progress is a different system with a different owner. Recorded because widening a
definition to fit one awkward case is exactly how a small system becomes a large one.

**What could not be done and was not faked.** No mission was played, because none exists. Every claim
here about how something will *feel* — that a mirror match teaches twice, that the prologue's contrast
is worth its cost, that 720 steps is roughly right — is an argument, not an observation, and is labelled
as one where it appears. The cheapest thing a future session could do to improve this pass is build a
rough version of the map and find out how long the raid actually takes.

## 8. Decision

> **PASS**

The question was what the first arc needs to contain and what systems it needs, written down precisely
enough that eight milestones do not each invent it. That is answered: an unlock system with five rules
and eight named refusals, a one-idea-per-mission rule with a cheap way to enforce it, a telegraph
constraint that applies to every mission the game will ever ship, two teaching curricula, a worked map
with real coordinates and a stated routing constraint, and an enemy-schedule format with five
predictability rules. The five decisions that are genuinely Mario's are filed with recommendations
rather than guessed, and everything those answers do not touch was finished.

PASS rather than REVISE because nothing here is waiting on a rerun or a comparison — it is waiting on a
reader.

## 9. What would change in the specifications if this is accepted

**Nothing is applied yet.** Every row is a proposal.

| Proposal | Where it would live | What earned it |
| --- | --- | --- |
| The build phase must show the player what the Pulse will bring | The presentation rules, as guidance until a mission proves it | Reading Into the Breach's stated design goal against the fact that the Pulse cannot be steered — and finding the first mission's own briefing already promising it |
| The unlock system: one thing per mission, granted on completion, always visible in the build menu, only ever additive | The campaigns document, replacing its one paragraph on unlocks | StarCraft II's model, Slay the Spire's pool-dilution warning, and FTL's discovery model refused |
| One new idea per mission, declared, load-bearing for the outcome, with the unlock feeding the next mission's lesson | The campaigns document, as a checkable form of what it already says in prose | Advance Wars' tutorial structure made explicit |
| A mission's scripted enemy is a list of timed arrivals in the map file, with one verb, arrivals resolving at a named point in the tick, and blocked arrivals skipped with a warning | The engine rules (the tick-order point is a rule) and the map format | An existing open question's recommendation made precise, plus the one-verb simplification |
| The first mission's map is 60 × 20, sized to scroll on the smallest supported terminal and fit whole on a large one; "a small Grid that never scrolls" becomes a description of the feel rather than the geometry | The campaigns document's mission table | The viewport arithmetic, filled in |
| Nothing may sit directly in line with the base on a map whose enemy approaches down a fixed lane | Map-authoring guidance, not a rule in the engine | Turning "author around the routing gap" into a constraint a future edit can violate and be caught for |

Questions filed, each with a recommendation:

| ID | Question | Recommendation |
| --- | --- | --- |
| Q39 | Where does the campaign start? | The raid defence, with a short pyramid-wakes-up scene in front of it |
| Q40 | Fixed unlock, or a choice of two? | Fixed, stored as a list so widening it later is a data change |
| Q41 | Where does the lose-everything set-piece go? | After the opening arc, not before it; built last, if at all |
| Q42 | Does a second Commander appear, and when? | A voice at mission four; playable at the start of the next arc |
| Q43 | What does the Citizen Commander do for a living? | An engineering officer, with the survey scientist as a second, non-commanding voice |

## 10. What the next session should do

Wait for Mario's answers to Q39 and Q43, then close Q32 and Q33 against them and rewrite Section 4 of
the milestone tracker to match. Nothing beyond that.
