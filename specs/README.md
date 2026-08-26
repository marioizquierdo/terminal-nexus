# Terminal Nexus specifications

**Document role:** Canon index and reading order
**Status:** Canonical
**Canon version:** 2.8
**Updated:** 2026-08-26
**License:** Apache-2.0

The project canon is this document set, not one monolithic file. Each document has one job, and the
milestone marked **CURRENT** controls implementation scope.

Run `./scripts/check-repository.sh` first — it prints the canon version and the active gate, and it
enforces the invariants below rather than trusting anyone to remember them.

## Start here

**There is code now, and Milestone 1 is accepted.** Milestone 1 built the Pulse Playground: a
deterministic kernel, a scenario format, a levelled report, and an ASCII view you can watch. It runs
as `grid` (`./bin/grid.ts`) — the engine, editor, and replay tool; a separate `terminal-nexus`
executable, not built yet, is what will launch the actual game. `DEVELOPMENT.md` has the commands,
and `evidence/report.md` and `evidence/gate-1b-report.md` are what the two gates found — including
the places where the canon turned out to be wrong.

**The roadmap went campaign-first at canon 2.8.** Rather than complete the Pulse kernel horizontally
(routing, economy, production, visibility, replay format, all at once), the project now builds its
campaign one level at a time, each a small vertical slice pulling in only what that level needs.
Milestone 2 is now **Level 1: Perimeter**, not the horizontal contract it used to be — that contract
is preserved, unbuilt, in [`backlog-pulse-completion.md`](backlog-pulse-completion.md).

For a new coding session, read:

1. [`terminal-nexus-concept.md`](terminal-nexus-concept.md) — the one-page game definition.
2. [`milestone-2-deterministic-pulse.md`](milestone-2-deterministic-pulse.md) — the active
   implementation contract (Level 1: Perimeter). Only its **Active gate** is authorized.
3. [`open-questions.md`](open-questions.md) Section 4 — what is undecided, and what you may decide
   alone.
4. [`project-governance.md`](project-governance.md) — authority, evidence loop, execution ledger, and
   locked decisions.
5. Only the sections of the supporting canon named by the active gate.
6. Existing source, tests, and evidence before changing code.

For game design or fiction, open the relevant document below rather than feeding an agent the whole
repository.

## How much authority does a statement have?

Not every sentence in this canon carries the same weight, and treating them as if they did is how a
sketch becomes an accidental requirement. Every section of [`engine.md`](engine.md) — and, where it
matters, of the other documents — declares one of:

| Marker | Means | What you may do |
| --- | --- | --- |
| **RULE** | Committed. Something already depends on it | Follow it. Changing it needs owner acceptance and a canon bump |
| **GUIDANCE** | A recommendation, not yet earned by working code | Follow it by default. Depart when the work shows better, and record why |

Most of the design canon is **GUIDANCE**. It exists so that a session facing a fork has something
better than a coin flip — not so that a session builds an interface nobody has needed yet.

**Descriptive completeness is not authorization.** A shape described here is not a shape you may build
today; the milestone marked CURRENT decides that.

## Canon map

**Product and world**

- [`terminal-nexus-concept.md`](terminal-nexus-concept.md) — audience, match, promise,
  differentiators, current scope.
- [`terminal-nexus-lore.md`](terminal-nexus-lore.md) — universe, Prime Nexuses, Nexus Symbols,
  Ancients, Originals, factions, ASCII semiotics, voice, story seeds.

**Systems**

- [`engine.md`](engine.md) — the three worlds (state, Pulse, presentation), the Grid and its layers,
  logical time, determinism, events, content sketches, rendering, and runtime direction. Start at its
  Section 0.
- [`ascii-effects.md`](ascii-effects.md) — the particle and effect system: the pure-function contract,
  the starter vocabulary, and the craft rules behind it.
- [`replay-format.md`](replay-format.md) — the `.replay.json` design: schema, log levels, and
  soundness. Nothing here is built; it is a starting design for whichever level first needs it.
- [`commander-armies.md`](commander-armies.md) — playable packages of Commander, units, structures,
  upgrades, and Nexus powers. Rosters intentionally undefined.
- [`campaigns.md`](campaigns.md) — mission and campaign structure, teaching, Citizen opening,
  cutscenes, opponent policies, authoring tools. PERIMETER (Mission 1) is Milestone 2, in active
  implementation.
- [`backlog-pulse-completion.md`](backlog-pulse-completion.md) — the horizontal "finish the kernel"
  contract Milestone 2 used to be: routing, economy, production, visibility, replay hardening.
  Preserved verbatim, pulled in level by level rather than built as one pass.

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
| [1 — the Pulse Playground](milestone-1-spike-battle.md) | Put units on a Grid and let them fight: deterministic from a seed, legible on screen, worth watching? | **COMPLETE** — both gates built, merged, and formally accepted 2026-08-26 |
| [2 — Level 1: Perimeter](milestone-2-deterministic-pulse.md) | Build the campaign's first mission as a real vertical slice — Build Phase, the Pulse, a scripted opponent, the mission's own story — end to end? | **CURRENT** — Gate 2A open |
| [3 — Build Phase and battle editor](milestone-3-builder-editor.md) | Is arranging a compact base pleasant enough to carry player agency? | GATED — backlog, pulled in per level |
| [4 — Citizens versus Ravels](milestone-4-citizens-ravels.md) | Do the parts together make a match worth replaying? | GATED — backlog, pulled in per level |
| [5 — Citizen campaign fragment](milestone-5-campaign-fragment.md) | Does brief ASCII fiction turn matches into a campaign? | GATED — superseded in shape; the fragment is now being built one level at a time starting with Milestone 2 |
| [Backlog — completing the Pulse](backlog-pulse-completion.md) | What "Milestone 2" used to mean: routing, economy, production, visibility, replay hardening | GATED — preserved verbatim, pulled in the day a level needs a specific piece of it |

Packaging, standalone binaries, SSH, and browser delivery are **deferred entirely**. They answer no
question the game currently has, and they were previously blocking the questions it does have.

Only the gate marked **CURRENT** is implementation authority. Future documents are planning context
and must be expanded with exact fixtures before work begins.

## Rules this index enforces

The repository validator checks these mechanically, so they are worth knowing:

- every document under `specs/` and `concept/` declares the same canon version as this file, and so
  does `AGENTS.md`, which restates canon invariants as a summary and would otherwise drift silently;
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
