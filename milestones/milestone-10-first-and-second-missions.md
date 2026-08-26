# Milestone 10 — First and Second Missions

**Document role:** Milestone tracker — polish PERIMETER, author and build RIGHT OF SALVAGE
**Status:** GATED
**Depends on:** Milestones 2 through 9 (every mechanism this milestone exercises for real)
**Updated:** 2026-08-26
**License:** Technical work is Apache-2.0; new mission material is CC BY-SA 4.0

> **This is where milestones 4 and 9's "mostly empty for now" finally fills in.** The campaign menu's
> progress/army/enemy-intel panels and the cutscene mechanism were both built and accepted against a
> first mission with nothing yet to show. A second mission is the actual test of whether either was
> built the right shape — not a nice-to-have, the intended second use
> (`../AGENTS.md` Section 4: "extract a framework only after two real uses reveal the boundary").

## 1. Question

Do PERIMETER, polished, and RIGHT OF SALVAGE, newly authored on the infrastructure milestones 3-9
built, together read as the opening of a real campaign — unlocks that mean something, enemy intel
that has something in it, a story that continues rather than repeats?

## 2. What gets built

**PERIMETER polish.** Whatever milestones 3 through 9 individually left rough gets fixed here, once
the whole loop can be played start to finish and judged as one thing rather than nine separate gates.

**RIGHT OF SALVAGE, authored for real.** Unlike PERIMETER, this mission's text does not exist yet —
[`../specs/campaigns.md`](../specs/campaigns.md) Section 4.1 has only the belief-ramp's one-row
summary ("The Nexus is a tool we are learning" → "First itch: the tool knows things nobody entered" →
teaches "Salvage economy and contested wrecks" → the interface "Names Speaker Corvane before any
contact. Vasse: 'Who filed that?'"). Writing the full briefing, pre-battle exchange, barks, debrief,
and artifact entry — `campaigns.md` Section 4.2's own PERIMETER write-up is the template for shape and
weight — is real creative work this milestone owns, not a mechanism to build against existing text.

**The salvage economy, pulled forward from backlog.** [`../specs/engine.md`](../specs/engine.md)
Section 6 already describes it: destruction returns half a structure's value to its owner and drops
the other half as salvage on the Grid; workers from either side can drain it; building over remaining
salvage destroys it. `../specs/backlog-pulse-completion.md` held this as unowned; RIGHT OF SALVAGE is
what needs it, so it lands here rather than staying deferred.

**Unlocks and intel, exercised for real.** PERIMETER's completion should populate the unlock record
(`../specs/open-questions.md` Q31) with something RIGHT OF SALVAGE's own campaign-menu screen
(Milestone 4) actually displays — and by the second mission, enemy intel (Q35) has real Ravel content
in it from the first. If either screen reads wrong once there is something to show, that is this
milestone's finding to act on, not a defect to carry forward.

## 3. Explicitly not this milestone

Missions 3 through 6 of the belief ramp (RESTORATION, PRECOMMITTED, TWELVE OF TWELVE, ANNEX ZERO);
any faction beyond Citizens and Ravels; a real save/progression system beyond the flat unlock record;
multiplayer.

## 4. Acceptance

Automated: RIGHT OF SALVAGE gets the same determinism bar as every other mission and kernel change —
named scenarios, hash-stable across runs and runtimes, diffed against the state before this milestone
the same way every prior kernel-adjacent change in this project has been.

Human, and this is the real gate — mirroring the old Milestone 4 and 5 pass-evidence this replaces
(`../specs/backlog-pulse-completion.md` and this document's own history hold the originals): a fresh
player finishes PERIMETER, sees a real, correct unlock and a mission report on the campaign menu,
plays RIGHT OF SALVAGE, understands why Speaker Corvane being named before contact unsettles Vasse,
and can summarize one answered question and one larger mystery across the two missions together —
[`../specs/campaigns.md`](../specs/campaigns.md) Section 3's own per-mission teaching contract, now
checked against two missions instead of asserted about one.

## 5. Definition of done

- [ ] PERIMETER plays start to finish without a rough edge introduced by an earlier milestone's narrow
      scope;
- [ ] RIGHT OF SALVAGE's full text is written and reviewed;
- [ ] the salvage economy works correctly on RIGHT OF SALVAGE's own map;
- [ ] the campaign menu's progress/army/enemy-intel panels show real, correct content after
      PERIMETER's completion;
- [ ] a gate report exists, ending in **PASS / REVISE / STOP / BLOCKED**;
- [ ] `./scripts/check-repository.sh` passes;
- [ ] Mario has played or watched both missions back to back.
