# Terminal Nexus milestones

**Document role:** Milestone index — the sequence, current status, and how this folder differs from `specs/`
**Status:** Canonical index (not a versioned canon document — see below)
**Updated:** 2026-09-12
**License:** Apache-2.0

## Why milestones live here, not in `specs/`

Through canon 2.8, milestone contracts lived in `specs/milestone-N-*.md`, versioned in lockstep with
the rest of the canon. Mario asked for a cleaner split: "they are a bit different than specs, because
they work both as notes for upcoming work, but also task trackers during work and historical
references after work." A `specs/` document changes at a named canon version, deliberately, as part
of a ceremony (`../AGENTS.md` Section 9). A milestone gets its checkboxes ticked mid-week, independent
of any canon bump — forcing it to carry a matching `**Canon version:**` would either freeze it between
bumps or force a bump for every checked box. So milestones get their own folder and their own lighter
header contract:

- `**Document role:**`, `**Status:**`, `**Updated:**`, `**License:**` are required
  (`./scripts/check-repository.sh` checks it, the same as any `specs/` document, minus the
  canon-version field);
- `**Status:**` is one of `COMPLETE`, `CURRENT`, `GATED`, `REVISE`, `BLOCKED`, `STOPPED` — the same
  vocabulary `../specs/project-governance.md` Section 5 already uses, so the meaning does not need
  relearning;
- exactly one `milestones/milestone-*.md` file may be `CURRENT` at a time, and it must declare an
  `**Active gate:**` — the validator enforces both, cross-checked against the table below rather than
  against `project-governance.md`'s own execution ledger (which stays the slower-moving governance
  record; keeping it *roughly* in sync is good practice, but this table is the fast, checked
  source of truth for "what is a session authorized to work on right now");
- a milestone may still cite canon (`../specs/engine.md`, `../specs/campaigns.md`,
  `../specs/commander-armies.md`, and so on) freely — those documents are unchanged, still versioned,
  still the authority a milestone builds against. A milestone is where that authority gets turned into
  a specific, scoped, checkable plan, not a second copy of it.

`AGENTS.md` Section 1's reading order still applies: start with the canon, then the milestone marked
**CURRENT** below, through its own **Active gate**.

## The sequence

**Milestone numbers are identities, not an order** — the same convention as `Q<n>` ids in
[`../specs/open-questions.md`](../specs/open-questions.md): a number is never renumbered or reused,
because prose across the canon cites it. The **build order** is the column below, and it changed at
canon 2.11 when Mario re-scoped Milestone 2 to design and orientation and asked for the game's
experience and UX to be built next, with content and modes iterated on top once it works
([`../specs/game-modes.md`](../specs/game-modes.md) Section 1 has the direction in his words).

Building the campaign's first level had already turned out to need most of the systems the game has
never had at once — a menu, a real Build Phase, the Pulse loop's own player-facing moment, an
economy, a Commander, cutscenes. Canon 2.11 kept that decomposition and reordered it: **the match UX
core first** (3, 5, 6), then **the two mode shells** (8 gives both modes their draft and Commander;
11 is the run, 4 the campaign), then **depth** (7, 9), then **proof and content** (10, 12).

| Milestone | Status | Build order | Question |
| --- | --- | --- | --- |
| [1 — Grid Battles](milestone-01-grid-battles.md) | COMPLETE | done | Do units move, fight, and die deterministically from a seed, legibly on screen? |
| [2 — Design and Orientation](milestone-02-campaign-design.md) | COMPLETE | done | What vocabulary and structure do the single-player modes need, and what few PERIMETER decisions does the UX build need, before milestones 3-6 build the game's experience? |
| [3 — Game Menu](milestone-03-game-menu.md) | CURRENT | 2 | Can a player launch `terminal-nexus` into a menu with displayed hotkeys, mouse parity, and a driver, and pick a mode? |
| [5 — Build Phase](milestone-05-build-phase.md) | GATED | 3 | Can a player place buildings, pick a Nexus upgrade, and scroll a real map during Build Phase — by keyboard, mouse, and driver? |
| [6 — Nexus Pulse Phase](milestone-06-pulse-phase.md) | GATED | 4 | Can a player start the Pulse, watch it resolve, see a legible ending with Recall, and land in the next Build Phase? |
| [8 — Commander](milestone-08-commander.md) | GATED | 5 | Can Commander Vasse and a Nexus draft dealt from an army's pool exist without becoming a full Commander Army? |
| [11 — Challenge Mode: Runs](milestone-11-challenge-runs.md) | GATED | 6 | Can a player play a seeded run of battles with a run draft between them, and does the same seed give the same run? |
| [4 — Campaign Menu](milestone-04-campaign-menu.md) | GATED | 7 | Can a player start or load a campaign and see progress, army, and enemy intel? |
| [7 — Worker Economy](milestone-07-worker-economy.md) | GATED | 8 | Can workers be built and gather resources deterministically during the Pulse? |
| [9 — Mission Cutscenes](milestone-09-mission-cutscenes.md) | GATED | 9 | Can a mission declare and play its own briefing, exchanges, barks, and debrief? |
| [10 — First and Second Missions](milestone-10-first-and-second-missions.md) | GATED | 10 | Do PERIMETER (polished) and RIGHT OF SALVAGE (new) together read as a real campaign opening? |
| [12 — Content and Balance Iteration](milestone-12-content-iteration.md) | GATED | 11, repeating | Does each new card make a run more interesting and let a mission teach it — measured, not asserted? |

Only the row marked **CURRENT** is implementation authority; every `GATED` row is planning context; it
gains authority when its own dependencies (named in its own file) are met and it is looked at and
promoted, not merely because time remains (`../AGENTS.md` Section 2's own "do not continue to the next
gate merely because time remains" applies here at the milestone level too).

**Every milestone now lists its gates** — small, separately closable steps (3A, 3B, …), the unit a
single session should pick up. A session takes one gate, evidences it, and stops; the milestone
closes when its gates do. This is Milestone 1's own 1A/1B shape applied everywhere, at Mario's
request that the next agent get "smaller and focused tasks."

Two orderings inside the table are choices, not consequences, and Mario may swap them: **11 before
4** because a run exercises the Commander Army composition model harder than a campaign shell and
needs no writing; **7
after 11** because a run can start on a per-battle allotment the way Mechabellum's rounds do
(`game-modes.md` Section 5), and the worker economy is what makes it feel like Terminal Nexus rather
than what makes it playable.

## After the build order

Milestone 12 repeats: each pass adds cards and retunes both modes on what the last pass measured.
Beyond it, what comes next is not detailed here on purpose — naming further milestones ahead of a
playable run and a played campaign opening would be guessing at what those two will teach.

Two shapes look likely enough to name lightly, so a later session doesn't have to reconstruct them
from nothing — without pretending either is decided:

- **one milestone per remaining belief-ramp mission.** [`../specs/campaigns.md`](../specs/campaigns.md)
  Section 4.1 names four missions after RIGHT OF SALVAGE — RESTORATION, PRECOMMITTED, TWELVE OF TWELVE,
  ANNEX ZERO — each teaching something the prior ones didn't. If the pattern that got the systems built
  (milestones 3-9, one per system) followed by proving them on a mission (milestone 10) holds up in
  practice, it likely repeats: a later milestone authoring RESTORATION the way Milestone 10 authored
  RIGHT OF SALVAGE, and so on through ANNEX ZERO — interleaved with Milestone 12's content passes,
  since each mission teaches cards a run then deals.
- **a distinct release-readiness pass**, once all six missions exist, that no per-mission milestone
  covers on its own: packaging, a title/credits sequence, whatever playtesting the finished belief ramp
  surfaces as missing, and anything [`../specs/project-governance.md`](../specs/project-governance.md)'s
  deferred-systems list still owes before the campaign is called a first release.

Neither is a milestone file yet, and no number is reserved for either — this section is a note about
shape, not a claim about the sequence's own length. Each earns its own file the way Milestone 2 earned
PERIMETER's: once the milestone immediately before it is close enough to done that guessing its
contents stops being guessing.

## What this sequence replaced

The single "Milestone 2 — Level 1: Perimeter" contract, built at canon 2.8 in one pass (Gate 2A/2B),
is superseded by the ten-milestone breakdown above — formalized at Mario's own request rather than
kept as a rougher first cut. Its content is redistributed above with citation, not deleted:
Q29 through Q33 (recall, GUI scope, unlock-record shape, scripted-opponent format, the Q15 workaround)
are answered or reassigned to the milestone that now owns each decision — see
[`../specs/open-questions.md`](../specs/open-questions.md). The old `specs/milestone-2-deterministic-
pulse.md`, `-3-builder-editor.md`, `-4-citizens-ravels.md`, and `-5-campaign-fragment.md` are retired
the same way: their genuinely unique content is cited from whichever milestone above now owns it, and
`../specs/backlog-pulse-completion.md` still holds the horizontal kernel-completion work none of these
ten milestones needs yet (real routing, a second resource, the full replay format, visibility
filtering).
