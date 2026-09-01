# Terminal Nexus specifications

**Document role:** Canon index and reading order
**Status:** Canonical
**Canon version:** 2.10
**Updated:** 2026-09-01
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

**The roadmap went campaign-first at canon 2.8, and the milestones moved out at 2.9.** Rather than
complete the Pulse kernel horizontally (routing, economy, production, visibility, replay format, all
at once), the project now builds its campaign one level at a time. Building the first level turned
out to need most of the game's still-unbuilt systems at once — a menu, a campaign screen, a real
Build Phase, the Pulse's own player-facing moment, an economy, a Commander, cutscenes — so it is not
one milestone, it is a sequence of ten, tracked in their own **[`../milestones/`](../milestones/)**
folder rather than versioned here: they are notes for upcoming work, task trackers during work, and
historical reference after, which is a different job than a document that only changes at a named
canon version. The horizontal contract this replaced is preserved, unbuilt, in
[`backlog-pulse-completion.md`](backlog-pulse-completion.md).

**Canon 2.10 recorded the owner's design notes on three things the campaign milestones build
against**: the input model ([`engine.md`](engine.md) Section 9.7 — one command vocabulary behind
keyboard, mouse, and an agent driver, with displayed hotkeys), the Commander Army as a deck drawn
from its faction's pool ([`commander-armies.md`](commander-armies.md) Section 2.1), and missions as
multi-Pulse trigger lists ([`campaigns.md`](campaigns.md) Section 2.1). Milestones 3, 5, 6, 8, and 9
cite them; Q39 (declarative triggers versus a scripting API) is the one fork left for Mario.

For a new coding session, read:

1. [`terminal-nexus-concept.md`](terminal-nexus-concept.md) — the one-page game definition.
2. [`../milestones/README.md`](../milestones/README.md) — the milestone sequence and its **CURRENT**
   entry. Only that entry's own **Active gate** is authorized.
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
  cutscenes, opponent policies, authoring tools. PERIMETER (Mission 1) is in active implementation
  across [`../milestones/`](../milestones/)'s ten-milestone sequence.
- [`backlog-pulse-completion.md`](backlog-pulse-completion.md) — the horizontal "finish the kernel"
  contract this roadmap replaced: routing, economy, production, visibility, replay hardening.
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

Milestones are tracked in **[`../milestones/`](../milestones/)**, not here — see that folder's own
`README.md` for the full ten-milestone sequence, its current entry, and why milestones get a lighter,
unversioned header instead of this document's own canon-version lockstep. The only thing repeated
here is the shape: Milestone 1 (Grid Battles) is **COMPLETE** and accepted; the campaign's first level
is being built as milestones 2 through 10, one focused, checkable slice at a time, rather than as a
single "Level 1" contract or a horizontal "finish the kernel" pass (preserved, unbuilt, in
[`backlog-pulse-completion.md`](backlog-pulse-completion.md)).

Packaging, standalone binaries, SSH, and browser delivery are **deferred entirely**. They answer no
question the game currently has, and they were previously blocking the questions it does have.

Only the milestone marked **CURRENT** in [`../milestones/README.md`](../milestones/README.md) is
implementation authority, and only through its own **Active gate**. Future milestones are planning
context and must be looked at and promoted, not built merely because time remains.

## Rules this index enforces

The repository validator checks these mechanically, so they are worth knowing:

- every document under `specs/` and `concept/` declares the same canon version as this file, and so
  does `AGENTS.md`, which restates canon invariants as a summary and would otherwise drift silently;
- every document carries **Document role**, **Status**, **Canon version**, **Updated**, and
  **License** — `../milestones/*.md` files carry the same four fields minus **Canon version**, since
  they are trackers, not versioned canon (`../milestones/README.md` explains why);
- exactly one file in `../milestones/` is `CURRENT`, it declares an **Active gate**, and
  `../milestones/README.md`'s own table agrees with it;
- every `Q<n>` referenced anywhere under `specs/`, `concept/`, or `milestones/` is defined in
  [`open-questions.md`](open-questions.md), and every `OPEN` question carries a recommendation;
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
