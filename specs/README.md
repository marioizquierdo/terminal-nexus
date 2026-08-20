# Terminal Nexus specifications

**Document role:** Canon index and reading order
**Status:** Canonical
**Canon version:** 2.1
**Updated:** 2026-08-20
**License:** Apache-2.0

The project canon is this document set, not one monolithic file. Each document has one job, and the
milestone marked **CURRENT** controls implementation scope.

Run `./scripts/check-repository.sh` first — it prints the canon version and the active gate, and it
enforces the invariants below rather than trusting anyone to remember them.

## Start here

For a new coding session, read:

1. [`terminal-nexus-concept.md`](terminal-nexus-concept.md) — the one-page game definition.
2. [`milestone-1-spike-battle.md`](milestone-1-spike-battle.md) — the active implementation contract.
   Only its **Active gate** is authorized.
3. [`open-questions.md`](open-questions.md) Section 4 — what is undecided, and what you may decide
   alone.
4. [`project-governance.md`](project-governance.md) — authority, evidence loop, execution ledger, and
   locked decisions.
5. Only the sections of the supporting canon named by the active gate.
6. Existing source, tests, and evidence before changing code.

For game design or fiction, open the relevant document below rather than feeding an agent the whole
repository.

## Canon map

**Product and world**

- [`terminal-nexus-concept.md`](terminal-nexus-concept.md) — audience, match, promise,
  differentiators, current scope.
- [`terminal-nexus-lore.md`](terminal-nexus-lore.md) — universe, Prime Nexuses, Nexus Symbols,
  Ancients, Originals, factions, ASCII semiotics, voice, story seeds.

**Systems**

- [`engine.md`](engine.md) — gameplay contracts, deterministic architecture, grid, combat, economy,
  content interfaces, rendering, runtime direction, replay, tools, modding seams.
- [`commander-armies.md`](commander-armies.md) — playable packages of Commander, units, structures,
  upgrades, and Nexus powers. Rosters intentionally undefined.
- [`campaigns.md`](campaigns.md) — mission and campaign structure, teaching, Citizen opening,
  cutscenes, opponent policies, authoring tools.

**Process**

- [`project-governance.md`](project-governance.md) — canon maintenance, bounded autonomy, evidence
  process, execution ledger, locked decisions, tests, deferred systems.
- [`open-questions.md`](open-questions.md) — the durable queue of decisions waiting on Mario, each
  with a recommendation.
- [`templates/gate-report.md`](templates/gate-report.md) — the fill-in template that closes a gate.

**Reference (non-authoritative)**

- [`ascii-art-references.md`](ascii-art-references.md) — where to learn terminal art and what to take
  from each source.
- [`../concept/README.md`](../concept/README.md) — concept art index and the canon deltas each piece
  implies.

## Milestones

| Milestone | Question | Status |
| --- | --- | --- |
| [1 — prove the ASCII battle](milestone-1-spike-battle.md) | Can we own a terminal surface, and is watching symbols fight any good? | **CURRENT** |
| [2 — deterministic Nexus Pulse](milestone-2-deterministic-pulse.md) | Can combat look simultaneous while staying deterministic and replayable? | GATED |
| [3 — Build Phase and battle editor](milestone-3-builder-editor.md) | Is arranging a compact base pleasant enough to carry player agency? | GATED |
| [4 — Citizens versus Ravels](milestone-4-citizens-ravels.md) | Do the parts together make a match worth replaying? | GATED |
| [5 — Citizen campaign fragment](milestone-5-campaign-fragment.md) | Does brief ASCII fiction turn matches into a campaign? | GATED |

Only the gate marked **CURRENT** is implementation authority. Future documents are planning context
and must be expanded with exact fixtures before work begins.

## Rules this index enforces

The repository validator checks these mechanically, so they are worth knowing:

- every document under `specs/` and `concept/` declares the same canon version as this file;
- every document carries **Document role**, **Status**, **Canon version**, **Updated**, and
  **License**;
- exactly one milestone is `CURRENT`, it declares an **Active gate**, and the governance ledger
  agrees with it;
- every `Q<n>` referenced anywhere is defined in [`open-questions.md`](open-questions.md), and every
  `OPEN` question carries a recommendation;
- retired terminology stays retired. A line that must quote it — the concept-art index does — is
  marked exempt.

## Updating canon

After an accepted gate, update the narrowest authoritative document, the execution ledger, the
progress history, and the next milestone. Increment the shared canon version for semantic changes;
the validator will tell you which documents you forgot.

Do not duplicate a rule across files unless one location is explicitly a short summary linking to its
authority. Lore facts belong in the lore document; implementation contracts belong in the engine;
playable options belong in Commander Armies; mission content belongs in campaigns; undecided things
belong in the open-questions register rather than in a hedge inside a specification.
