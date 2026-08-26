# Terminal Nexus milestones

**Document role:** Milestone index — the sequence, current status, and how this folder differs from `specs/`
**Status:** Canonical index (not a versioned canon document — see below)
**Updated:** 2026-08-26
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

Building the campaign's first level turned out to need most of the systems the game has never had at
once — a menu, a campaign screen, a real Build Phase, the Pulse loop's own player-facing moment, an
economy, a Commander, and cutscenes — so "Level 1" is not one milestone, it is this whole sequence.
Mario, describing the pivot: "this initial task actually involves doing all the milestones: UI, menus,
pulse phases, build, upgrade nexus abilities, etc. So the first level will actually be a couple of
milestones." Milestones 3 through 9 build the systems; Milestone 10 is where they get proven together
against two missions instead of pretended-proven against one.

| Milestone | Status | Question |
| --- | --- | --- |
| [1 — Grid Battles](milestone-01-grid-battles.md) | COMPLETE | Do units move, fight, and die deterministically from a seed, legibly on screen? |
| [2 — Campaign Design](milestone-02-campaign-design.md) | CURRENT | What does PERIMETER actually need to contain, before anything below builds against it? |
| [3 — Game Menu](milestone-03-game-menu.md) | GATED | Can a player launch `terminal-nexus` into a simple keyboard-driven menu? |
| [4 — Campaign Menu](milestone-04-campaign-menu.md) | GATED | Can a player start or load a campaign and see progress, army, and enemy intel? |
| [5 — Build Phase](milestone-05-build-phase.md) | GATED | Can a player place buildings, pick a Nexus upgrade, and scroll a real map during Build Phase? |
| [6 — Nexus Pulse Phase](milestone-06-pulse-phase.md) | GATED | Can a player start the Pulse, watch it resolve, and see a legible ending with Recall? |
| [7 — Worker Economy](milestone-07-worker-economy.md) | GATED | Can workers be built and gather resources deterministically during the Pulse? |
| [8 — Commander](milestone-08-commander.md) | GATED | Can Commander Vasse and a small Nexus upgrade draft exist without becoming a full Commander Army? |
| [9 — Mission Cutscenes](milestone-09-mission-cutscenes.md) | GATED | Can a mission declare and play its own briefing, exchanges, barks, and debrief? |
| [10 — First and Second Missions](milestone-10-first-and-second-missions.md) | GATED | Do PERIMETER (polished) and RIGHT OF SALVAGE (new) together read as a real campaign opening? |

Only the row marked **CURRENT** is implementation authority; every `GATED` row is planning context; it
gains authority when its own dependencies (named in its own file) are met and it is looked at and
promoted, not merely because time remains (`../AGENTS.md` Section 2's own "do not continue to the next
gate merely because time remains" applies here at the milestone level too).

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
