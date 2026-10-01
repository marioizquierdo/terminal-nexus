# Documentation reorganization — the plan

**What this is:** a proposal for where every document in this repository goes, what each one is for, and
in what order the move happens. Nothing has moved yet. Once the structure is agreed, this file is the
checklist for the work and is deleted at the end of it.

**Date:** 2026-10-01 · **Status:** proposal, revised after a second opinion (§10), waiting for Mario's review

---

## 1. What is wrong today, in one paragraph each

**Three kinds of document are mixed together.** What is true now (the design, the architecture, how to
run things), what is planned (milestones, open questions, carry-over), and what happened (gate reports,
feedback logs, ledgers, change logs) sit side by side in five folders — `specs/`, `docs/`, `milestones/`,
`evidence/`, `concept/` — and in three root files. A new agent cannot tell from the path which kind it
is reading, so it reads all of it. Measured: 25,000 lines of Markdown, of which roughly 9,000 are
history that nobody needs on a normal day.

**The versioning ceremony costs more than it protects.** Every design document carries a `Canon version`
that must agree with every other one (16 files today); the validator fails the build when one is missed;
prose says "canon 2.19" instead of saying what was decided; `AGENTS.md` carries the version too and
restates the rules so it can be checked against them. A session that closed one step of a milestone
reported editing seven places to say the same thing — the entry file, the ledger, the progress history,
the development guide, the milestone tracker, the questions register, the engine document — plus the
version bump across every file. Git and pull requests already record what changed and when. The one
useful idea underneath — RULE versus GUIDANCE, per statement — is worth keeping and sharpening. The word
"canon" appears 69 times in code and tests alone.

**The entry point is a history book.** `AGENTS.md` is 663 lines, and its Section 2 ("current
authorization") is 230 lines of dated gate-by-gate narrative that every session reads first and that
grows by a paragraph per gate. `DEVELOPMENT.md` is 761 lines, a third of it a change log that stops in
August. Both repeat each other, the governance document, the milestone index and the specs index.

**Code comments cite the ceremony.** 368 lines mention a feedback item by number (`F66`), 74 an open
question (`Q57`), 398 a gate, 378 a spike, 164 an `engine.md` section number. A reader of the code has to
open a feedback log to learn why a line exists. Section numbers will shift the moment a design document
is split, so they are a liability as references.

## 2. The principle: three shelves, one home per fact

Every document lives on exactly one of three shelves, and the path says which:

| Shelf | Question it answers | Who reads it | Lifetime |
| --- | --- | --- | --- |
| **Current** | What is the game, how is it built, how do we work? | Every agent, every session | Edited in place; a merged pull request *is* the change |
| **Planning** | What is next, what is undecided, what is waiting? | An agent starting work | Short; items are deleted when done |
| **History** | What happened, what did we learn, what did Mario say? | Only when explicitly asked | Append-only; never required reading |

Three rules follow from it:

- **A current document never narrates.** It says what *is*, not how it came to be. If the history
  matters, one parenthesis names the pull request or the date; the story stays on the history shelf.
- **Nothing on the history shelf is linked from an agent's reading order.** It is findable (an index
  lists it) but not required.
- **Every fact has one home; everything else links.** Before writing a sentence that already exists in
  another file, link to it. The test of the new structure is that **finishing a milestone step touches
  two places**: the checkbox in the milestone file and one line in the history timeline. `AGENTS.md`
  never changes because a step closed.

And the project is simply **Terminal Nexus 0.1** until it is public. There is no canon and no canon
version. A design document describes the current design; when a pull request changes the design, it
changes the document in the same pull request, and that is the whole protocol.

## 3. The proposed layout

```text
.
├── README.md                      What the game is, how to play what exists, how to run tests. For a person.
├── AGENTS.md                      The entry point for any coding agent. ~100 lines. Points, never repeats.
├── CLAUDE.md                      Claude-specific notes only (web sessions, branches, pull requests). Imports AGENTS.md.
├── DEVELOPMENT.md                 How we work: toolchain, commands, tests, playtest tools, milestones, spikes,
│                                  the feedback loop, writing for Mario, writing design docs. ~300 lines, no history.
├── CONTRIBUTING.md                Human contributors and licensing. Short, as now.
│
├── docs/
│   ├── README.md                  One-screen index: every document, one line each, grouped by shelf.
│   │
│   ├── game-design/               CURRENT — what the game is. Mostly CC BY-SA.
│   │   ├── concept.md                 one-page product definition          (specs/terminal-nexus-concept.md)
│   │   ├── lore.md                    universe, factions, voice            (specs/terminal-nexus-lore.md)
│   │   ├── game-modes.md              Campaign and Challenge               (specs/game-modes.md)
│   │   ├── commander-armies.md        factions, Commanders, army shape     (specs/commander-armies.md)
│   │   ├── campaigns.md               missions, PERIMETER, cutscenes       (specs/campaigns.md)
│   │   ├── scripted-opponent.md       waves and intentions (working)      (docs/scripted-opponent.md)
│   │   ├── decisions.md               the settled product decisions, flat  (project-governance.md §7)
│   │   ├── ascii-art-references.md    reading list for terminal art        (specs/ascii-art-references.md)
│   │   └── concept-art/               the images and their index           (concept/*.png, concept/README.md)
│   │
│   ├── system-design/             CURRENT — how the software is shaped. Apache-2.0.
│   │   ├── architecture.md            the one-page invariants list and the code vocabulary (AGENTS.md §4, trimmed)
│   │   ├── engine.md                  the engine design, as today          (specs/engine.md; split later, §6)
│   │   ├── effects.md                 animations, particles, shading, tweens (specs/ascii-effects.md)
│   │   ├── ui-patterns.md             every screen, menu, popup, key       (docs/ui-patterns.md)
│   │   ├── replay-format.md           the unbuilt replay design (GUIDANCE) (specs/replay-format.md)
│   │   ├── portability.md             what a host must provide (working)   (docs/portability.md)
│   │   └── testing.md                 what the suite proves and how        (AGENTS.md §7, governance §9)
│   │
│   ├── planning/                  PLANNING — what is next.
│   │   ├── README.md                  the milestone sequence and status    (milestones/README.md)
│   │   ├── next-steps.md              waiting on Mario, carry-over, queue  (docs/next-steps.md)
│   │   ├── open-questions.md          OPEN questions only, with recommendations (open-questions.md §1-4)
│   │   ├── pulse-backlog.md           the deferred kernel work             (specs/backlog-pulse-completion.md)
│   │   ├── deferred.md                sound, multiplayer, the long horizon (governance §8, §10)
│   │   └── milestone-NN-*.md          CURRENT and future milestones only   (milestones/milestone-04, 06..12)
│   │
│   ├── history/                   HISTORY — read only when asked. Append-only.
│   │   ├── README.md                  a dated timeline, one line per accepted step, with pull request links
│   │   │                              (replaces governance §5 ledger, §6 history, DEVELOPMENT.md change log)
│   │   ├── lessons-learned.md         dated lessons                        (docs/lessons-learned.md)
│   │   ├── answered-questions.md      the Answered table                   (open-questions.md §5)
│   │   ├── feedback/                  Mario's words, item by item           (docs/feedback/)
│   │   ├── reports/                   every gate and spike report          (evidence/*.md)
│   │   ├── milestones/                COMPLETE milestones                  (milestones/milestone-01, 02, 03, 05)
│   │   ├── spec-audit-2026-08-21.md   the August audit                     (docs/spec-audit-2026-08-21.md)
│   │   └── original-spec-2026-08-19.md the pre-split spec, verbatim        (concept/2026-08-19 - original spec.md)
│   │
│   ├── screenshots/               Pictures of the current build, regenerated by scripts (evidence/screenshots/)
│   └── claude-web.md              Setting up Claude Code on the web (stays; trimmed)
│
├── .claude/skills/                grid, playtest, grid-screenshots, pr-description, feedback-round (rewritten);
│                                  `canon` deleted, its useful mechanics folded into DEVELOPMENT.md
└── scripts/check-repository.sh    still the one validator, with the version ceremony removed (§5)
```

Folders that disappear: `specs/`, `milestones/`, `evidence/`, `concept/`. Everything in them moves;
nothing is deleted except the things §4 names.

### Why these four shelves inside `docs/`

- **game-design** and **system-design** are both "current", split by audience and by licence: game
  design is what a player or a writer cares about and is mostly CC BY-SA; system design is what a
  programmer cares about and is Apache-2.0. The licence split the README already explains falls out of
  the folder.
- **planning** is one folder, not two, because a milestone, an open question and a carry-over item are
  all the same kind of thing: work that is not done. Completed milestones leave it.
- **history** is one flat shelf with sub-folders only where there are many files of one kind.

### `DEVELOPMENT.md` and the skills: what and why versus exact steps

`DEVELOPMENT.md` is the practices manual: for each thing an agent does (test, see a change, plan a
milestone, run a spike, run a feedback round, change the design, write for Mario) it says **what the
practice is and why it is shaped that way**, in a page or less. A skill is the **exact, runnable
procedure** for one of those practices (`playtest`, `grid-screenshots`, `feedback-round`,
`pr-description`), linked from the practice it belongs to. Neither repeats the other.

## 4. What happens to each document

### Root files

| File | Today | Proposal |
| --- | --- | --- |
| `AGENTS.md` | 663 lines; version-stamped; §2 is 230 lines of gate history; §4 restates engine rules | **Full rewrite, ~100 lines.** What the project is in three sentences; the three shelves and where to find each; the development loop in ten lines (orient, scope, build, test, playtest, pull request, feedback); the handful of hard rules (kernel purity, one command vocabulary, write in plain English for Mario, ask through an Experiment); then links. No version, no history, no restated rules. **It changes only when a rule of working changes, never when a step closes.** |
| `CLAUDE.md` | 34 lines; repeats AGENTS.md advice plus web-session rules | **Keep small.** Only what is Claude-specific: branch and pull-request rules for web sessions, the skills to use. Everything general moves to AGENTS.md. |
| `DEVELOPMENT.md` | 761 lines: commands, tooling, environments, discipline, canon protocol, a change log | **Rewrite as the practices manual, ~300 lines**, organised by what an agent wants to *do*: set up and run; test (both runtimes, timeouts, flaky timing tests); see a change (playtest script, screenshots, GIFs, the browser page); plan work (milestones: what one is, how it is written, how it closes); try something (spikes: when, how small, how reported); run a feedback round (log his words, Experiments, the settings export, Claude artifacts, the pull request); change the design (edit the design document in the same pull request; RULE/GUIDANCE; register a question; what a session decides alone); write for Mario. The change log, the canon protocol and every dated reference leave. |
| `README.md` | Project status is stale (says there is no Build Phase); structure tree is stale | **Refresh**: status as of today, the new tree, "Terminal Nexus 0.1" framing, commands unchanged. |
| `CONTRIBUTING.md` | Fine; references the canon reading order | **Trim the reading order** to AGENTS.md and the docs index. |
| `package.json` | description says "Milestone 3, Gate 3A"; version 0.0.0 | description "Terminal Nexus — an ASCII strategy game for the terminal"; version `0.1.0`. |

### `specs/` → `docs/game-design/` and `docs/system-design/`

Each moves with its `Canon version` line removed and its "canon 2.x" narration stripped (§5 says how).
Two are not pure moves:

- **`project-governance.md` is dissolved**, not moved — and its sections map onto destinations without
  rewording, so the dissolving happens in the move pass. §1 (canon is a document set) is retired; §2
  (what a session decides alone), §3 (evidence loop) and §4 (how a design change lands) go into
  `DEVELOPMENT.md`; §5 and §6 (ledger, history) become the timeline in `docs/history/README.md`; §7
  (locked decisions) becomes `docs/game-design/decisions.md`, with each decision later folded into the
  document that owns it as a RULE and the list shrinking as that happens; §8 and §10 (long horizon,
  deferred systems) become `docs/planning/deferred.md`; §9 (test strategy) becomes
  `docs/system-design/testing.md`.
- **`open-questions.md` is split**: §1–3 (why, protocol, statuses) shrink to a short preamble in
  `docs/planning/open-questions.md` with the OPEN and OBSERVABLE rows (38 questions, about 1,100 lines);
  §5 (the Answered table, 32 rows) goes to `docs/history/answered-questions.md`. Question ids stay
  permanent and are never reused; the validator keeps checking that any `Q<n>` cited in a document
  exists in one of the two files. **Every open question's heading becomes a sentence a person can
  read** — "Q57 — Where does the keyboard go after a building is placed?" — so the id is a label, never
  the name.
- **`templates/gate-report.md` is dropped.** The pull request template is the report (its "Project
  bookkeeping" block shrinks to "Design documents changed" and "Questions opened or answered"). A
  change big enough to need a long-form write-up gets one in `docs/history/reports/`, linked from the
  pull request, in whatever shape fits — the template's useful sections become a short checklist in
  `DEVELOPMENT.md`, with **surprises and discarded approaches first**, since that was the most-read
  part of every report.

### `milestones/`

- The index becomes `docs/planning/README.md`: the sequence table, the status column, the build order,
  "why this order". Its history paragraphs ("what this sequence replaced", "why milestones live here")
  go to the history timeline.
- **COMPLETE milestones (1, 2, 3, 5) move to `docs/history/milestones/`.** They are records now; the
  index still links to them.
- **CURRENT and future milestones (4, 6–12) stay on the planning shelf**, rewritten lightly: the
  header loses nothing but its narration; the per-gate "built and reported, awaiting Mario" paragraphs
  become a checkbox list; "canon 2.x" references become the decision in words.
- The validator keeps enforcing exactly one CURRENT milestone that names what is active.

### `evidence/`

- Every report → `docs/history/reports/`, renamed by date and subject (the manifest in §11 has the
  exact names). They move as they are: trimming 25 history files nobody is required to read is not worth
  an afternoon, and git keeps them anyway.
- `screenshots/` → `docs/screenshots/`. These are not history: nine scripts regenerate them, the
  playtest skill writes there for pull-request pictures, and pull requests link them by commit SHA
  (so old links keep working after the move). The scripts' default output path changes with them.
- `frames/` and the two `.txt` summaries → `docs/history/reports/pulse-playground-fixtures/`
  (checked in the move pass: `scripts/capture-frames.mjs` writes there and nothing reads it).

### `concept/`

- The images and their index → `docs/game-design/concept-art/`.
- The original spec → `docs/history/original-spec-2026-08-19.md`, still verbatim, still exempt from the
  terminology check (the validator's archive list is updated).

### `docs/`

- `ui-patterns.md`, `portability.md` → `system-design/`; `scripted-opponent.md` → `game-design/`;
  `next-steps.md` → `planning/`; `lessons-learned.md`, `feedback/`, `spec-audit-2026-08-21.md` →
  `history/`; `claude-web.md` stays, trimmed of its gate references.
- `ui-patterns.md`'s closing "where the rules came from" list of feedback logs stays as the one
  permitted link from a current document into history, because it is the provenance of the whole file.

### `.claude/skills/`

| Skill | Proposal |
| --- | --- |
| `canon` | **Delete.** The parts worth keeping (decide alone vs. ask; how to register a question; how a design change lands) go into `DEVELOPMENT.md`. The glossary of gate, ledger and governance terms is no longer needed. |
| `feedback-round` | **Rewrite** without the canon bump, the ledger row, the gate report and the version stamp. Keep: log his words, split by files, pin the SHA, merge order, regenerate pictures, republish the page, rewrite the pull request, wait lightly. |
| `pr-description` | **Trim** the footer rules to the new bookkeeping block; drop "gate letters allowed in the title". |
| `grid`, `playtest`, `grid-screenshots` | Path fixes only. |

### `scripts/check-repository.sh`

Keep it — a mechanical check that runs in CI is the cheapest reviewer — but make it check the new rules:

- **Removed:** the canon version agreement (check 2), the five-field metadata header (check 3), the
  `AGENTS.md` version.
- **Kept:** required files (a shorter list), exactly one CURRENT milestone with an active item,
  `Q<n>` references resolve and OPEN questions carry a recommendation (now across the two question
  files), retired terminology with the archive exemption, links, fences, whitespace, the devcontainer.
- **Added:** `canon`, `canon version`, `gate report` and `evidence/` join the retired-terms list for
  everything outside `docs/history/` — so the vocabulary change is enforced, not remembered. The
  authority-marker check learns the markers §6 proposes.
- Its closing lines print the current milestone and point at `AGENTS.md`.

`.github/CODEOWNERS` (`/specs/ @marioizquierdo`) becomes `/docs/game-design/` and
`/docs/system-design/`.

## 5. Vocabulary: what is retired, what stays

| Word | Today | Proposal |
| --- | --- | --- |
| **canon**, canon version, canon bump, "per canon" | everywhere | **Retired everywhere**, including lore. "The design", "the design documents", or just the fact itself. The validator rejects it outside `docs/history/`. |
| **gate** | the unit of work inside a milestone; also the ceremony around closing one | **Retired as vocabulary.** A milestone has *steps* (a checkbox list); a step is done when its pull request merges and Mario has played it. Old names (`gate 5F`) stay in history files and in old pull requests. |
| **spike** | both "a quick experiment" and the name of the Build Phase screen (`--spike`, `src/cli/spike.ts`, `SPIKE_CATALOG`) | **Kept as a practice** — a small throwaway build to answer one question, described in `DEVELOPMENT.md`. **Dropped as the name of the Build Phase screen** (code pass, §7). |
| **milestone** | planning unit; also narrated in every entry document | **Kept as the planning unit.** Only the planning shelf names which one is current. |
| **evidence** | a folder; a ceremony word ("evidenced") | **Retired.** Pictures are screenshots; a long write-up is a report; test output is test output. |
| **authority / authorization / authorized** | "the active gate authorizes"; "descriptive completeness is not authorization" | **Replaced by scope.** "In scope for the current milestone"; "a design document describes, it does not schedule." |
| **RULE / GUIDANCE** | per section in `engine.md`; sparse elsewhere | **Kept and extended** (§6). |
| **Experiment**, settings export, Build Phase, Nexus Pulse, Grid, Commander Army… | game and tooling words | Unchanged. |
| **F<n>**, **Q<n>** | feedback and question ids, cited from code | Ids stay inside their own registers. Code and current documents stop citing `F<n>`; a current document may cite `Q<n>` only in the open-questions file and the planning file that waits on it. |

## 6. RULE and GUIDANCE, developed

The marker is the one piece of the old system that earns its keep, because it answers the question an
agent actually has at a fork: *may I change this?* Proposed, for every design document on both current
shelves:

| Marker | Means | An agent may |
| --- | --- | --- |
| **RULE** | Built and depended on. The code implements it and a named test holds it. | Follow it. Changing it is a design change: the pull request changes the code, the test and this sentence together, and says so in its description for Mario. |
| **GUIDANCE** | The recommended default, written before the thing existed or chosen without playing it. **This is the default: anything unmarked is GUIDANCE.** | Follow it by default. Depart when the work shows better, and say why in the pull request. |
| **IDEA** | A sketch kept so it is not lost. Nothing depends on it; it is not a plan. | Read it for context. Build it only when a milestone asks for it. |

Four practices on top of the markers:

1. **Unmarked means GUIDANCE.** Mark only RULE and IDEA, so a page of recommendation does not need a
   label on every heading and a RULE stands out when it appears.
2. **A RULE names what holds it.** "RULE — `tests/build-camera.test.ts`" or "RULE —
   `src/pulse/arbitration.ts`". Today `project-governance.md` §9 asks for tests named after section
   numbers (`engine-3.3-markers`); the proposal flips the pointer: the document names the test, and the
   test is named for the rule in words (`"the viewport is clamped between 48 x 16 and 72 x 24"`), so
   splitting a document never renumbers anything.
3. **Markers go on statements, not only on sections.** A section can hold one RULE line inside a page
   of GUIDANCE. `engine.md` already does this in places; the others (`campaigns.md`,
   `commander-armies.md`, `game-modes.md`, `ui-patterns.md`) get the same treatment during the rewrite.
4. **The former "locked decisions" list dissolves into RULEs.** Each entry in `decisions.md` is moved
   into the document that owns it, as a RULE statement with its holder, and deleted from the list.
   The list is allowed to shrink to nothing.

Every design document opens with two lines: what it covers, and which licence applies. Nothing else in
its header.

What is deliberately *not* proposed: a marker for "Mario decided this". Who decided is history; what
holds today is the marker.

## 7. The code pass (after the documents)

Done last, in its own pull requests by area, once the documents have their final names:

- **Comments.** Remove `F<n>` references (368 lines), `Q<n>` references (74), "gate", "spike" and
  "canon <version>" narration, and `engine.md 9.7`-style section citations (164). Keep the *reason* a
  line exists, in words; where provenance genuinely matters, cite the pull request. A comment that only
  said "F66" and nothing else is deleted.
- **The Build Phase is not a spike.** `terminal-nexus --spike` → `terminal-nexus --build-phase` (keep
  `--spike` as a hidden alias for one release so scripts and pasted commands keep working);
  `src/cli/spike.ts` → `src/cli/build-phase.ts`; `SPIKE_CATALOG`, `SPIKE_ALLOTMENT`, `spikeGrid`… →
  `PLACEHOLDER_*` or `STARTER_*`; `tests/build-spike.test.ts` and `scripts/capture-spike-screenshots.mjs`
  renamed to match; the playtest script and the browser page follow.
- **Test names** that cite a section number are renamed for the rule in words (15 today).
- **Script defaults** write to `docs/screenshots/`.
- **One vocabulary for the code.** `architecture.md` gets a short glossary — menu, card, popup,
  message, hand-off, Experiment, tuned value, Build Phase, Nexus Pulse, Battle Round, mission, round,
  wave — and the code pass aligns module, type and function names with it (`experiments.ts`,
  `tuning.ts`, `all-settings.ts` are already right; `catalog.ts`, `status.ts` and the `SPIKE_*`
  constants are the ones to look at).

## 8. Order of work

Each step is one pull request, reviewed before the next starts, so a mistake in the structure is caught
before the rewrites bake it in. Two passes never mix in one commit: **moving text** and **changing what
it says**.

1. **Agree this plan** (this file; edits welcome, and the open choices in §9).
2. **Move pass** — the manifest in §11, applied with `git mv`, one commit per source folder so it can
   be reviewed and reverted folder by folder; strip the `Canon version` lines and the five-field headers;
   dissolve governance by moving its sections; split the questions file; update every link; update the
   validator, CI, CODEOWNERS, script output paths and the skills' paths; add the retired words. No prose
   rewritten beyond what a link needs. Validator and tests green after every commit.
3. **Rewrite pass** — `AGENTS.md`, `CLAUDE.md`, `DEVELOPMENT.md`, `README.md`, `docs/README.md`,
   `docs/history/README.md` (the timeline); write `architecture.md` and `testing.md`; strip narration
   from the current and future milestones; question headings in words; rewrite the two skills; shrink
   the pull request template. Two pull requests: entry points first, then the planning shelf.
4. **Design-document pass** — markers on statements, RULE holders named, the decisions list folded in,
   and (recommended, see §9) `engine.md` split by subject.
5. **Code pass** — §7, by area.
6. Delete this file.

Milestone 6's current step is built and waiting for Mario's playtest, so nothing in flight conflicts
with this; if his feedback arrives mid-way, it is handled on its own branch and the move pass rebases.

## 9. Choices for Mario

Each has a recommendation; the plan proceeds under it unless you say otherwise.

1. **Completed milestones: history shelf or planning shelf?** Recommended: history (`docs/history/milestones/`),
   with the planning index linking to them. The alternative — all milestones in one folder, told apart by
   a status line — keeps the folder together but puts 1,600 lines of done work next to the live one.
2. **Split `engine.md`?** It is 1,664 lines covering the three worlds, the Grid, the Pulse, economy,
   events, content, presentation, input, runtime and tools. Recommended: yes, in step 4, into
   `architecture.md` (the three worlds, layers, coordinates), `grid.md`, `pulse.md`, `content.md`,
   `presentation.md`, `input.md` (the command vocabulary, keyboard, mouse, driver — the most-cited
   section in the code) and `runtime.md`, under `system-design/` — this is where your "grid, particle
   effects, logging, settings" list lands. The code pass removing section-number citations makes the
   split safe. Cost: a day of careful editing.
3. **Retire the word "gate", or keep it for the unit inside a milestone?** Recommended: retire it in
   favour of "step"; the ceremony is what made it heavy, and a checkbox list reads the same without it.
   The second opinion would keep it; the cost of keeping it is that every current document has to
   define it, and new readers already have "milestone" and "spike" to learn.
4. **Keep a long-form report at all?** Recommended: not by default — the pull request description is the
   record — but allow one in `docs/history/reports/` when a change needs more than a page (a spike's
   findings, a measurement series), linked from the pull request.
5. **Rename `--spike` now or later?** Recommended: in the code pass, with the alias, so no pasted command
   breaks while the documents settle.
6. **A changelog file?** Recommended: no root `CHANGELOG.md`. The dated timeline in
   `docs/history/README.md` — one line per accepted milestone step, with the pull request link — is
   the useful part of the ledger, the progress history and the old change log combined, and the pull
   requests hold the rest.

## 10. The second opinion, and what was taken from it

Mario asked another session for ideas (2026-10-01). It had worked the early Build Phase steps and read
today's `main`. Where it agrees with this plan it says the same things in different words: one home per
fact, an entry file that never changes when a step closes, history out of the files agents re-read,
plain-language question titles, a move pass before a wording pass, one area per commit. Taken into this
revision: the "touches two places" test (§2), the GUIDANCE-by-default rule (§6), the question headings
in words (§4), `input.md` in the engine split (§9), surprises-first in reports (§4), the code vocabulary
glossary (§7), and its measurement of seven edits to close one step (§1).

Where it differs, this plan keeps its own answer, for these reasons:

| Its suggestion | This plan | Why |
| --- | --- | --- |
| Keep one canon version in the specs index, bump it only for a RULE change, drop the agreement check | No version at all | Mario's own note: no versioning until the game is public; a merged pull request is the change. A single stamp still has to be remembered, and nothing reads it. |
| Keep "canon" in agent-facing files, replace it only in what Mario reads | Retire the word everywhere | One vocabulary for both readers is the point; agents write what Mario reads. |
| Keep "gate" as the reviewed slice of a milestone | Retire it for "step" | §9, choice 3. |
| `DEVELOPMENT.md` lists commands and nothing else; the skills hold every procedure | `DEVELOPMENT.md` is the practices manual; skills are the exact steps | Mario asked for exactly that manual (milestones, spikes, the feedback loop in one place). Skills stay the runnable layer under it (§3). |
| Prune every gate report to 60–100 lines, archive the old ones, merge round-2 reports | Move them as they are | History is not required reading; trimming 25 files is work with no reader. The index gives each one line. |
| Keep `specs/` and `evidence/` as folder names | Four shelves under `docs/` | Mario's note: one `docs/` folder with semantic categories, and the path says which shelf a file is on. |
| Leave a one-line redirect where a section used to be | No redirects | The link checker and `git mv` handle it; a stub is clutter in a folder that is being emptied. |
| Keep the architectural invariants inside `AGENTS.md` (~150 lines) | Move them to `system-design/architecture.md`; `AGENTS.md` ~100 lines of pointers | Mario: the entry point should be "way smaller", organising practices and pointing at files. The invariants are a design document, not an entry point. |

## 11. The move manifest

What the move pass executes, in commit order. Links, headers and the validator are updated in the same
commit as each folder.

| From | To |
| --- | --- |
| `specs/terminal-nexus-concept.md` | `docs/game-design/concept.md` |
| `specs/terminal-nexus-lore.md` | `docs/game-design/lore.md` |
| `specs/game-modes.md` | `docs/game-design/game-modes.md` |
| `specs/commander-armies.md` | `docs/game-design/commander-armies.md` |
| `specs/campaigns.md` | `docs/game-design/campaigns.md` |
| `specs/ascii-art-references.md` | `docs/game-design/ascii-art-references.md` |
| `specs/engine.md` | `docs/system-design/engine.md` |
| `specs/ascii-effects.md` | `docs/system-design/effects.md` |
| `specs/replay-format.md` | `docs/system-design/replay-format.md` |
| `specs/backlog-pulse-completion.md` | `docs/planning/pulse-backlog.md` |
| `specs/open-questions.md` §1–4 | `docs/planning/open-questions.md` |
| `specs/open-questions.md` §5 | `docs/history/answered-questions.md` |
| `specs/project-governance.md` §2, §3, §4 | `DEVELOPMENT.md` (appended; rewritten in step 3) |
| `specs/project-governance.md` §5, §6 | `docs/history/README.md` |
| `specs/project-governance.md` §7 | `docs/game-design/decisions.md` |
| `specs/project-governance.md` §8, §10 | `docs/planning/deferred.md` |
| `specs/project-governance.md` §9 | `docs/system-design/testing.md` |
| `specs/project-governance.md` §1 | deleted |
| `specs/README.md` | `docs/README.md` (the index; rewritten in step 3) |
| `specs/templates/gate-report.md` | deleted; its checklist into `DEVELOPMENT.md` |
| `milestones/README.md` | `docs/planning/README.md` |
| `milestones/milestone-01-grid-battles.md` | `docs/history/milestones/milestone-01-grid-battles.md` |
| `milestones/milestone-02-campaign-design.md` | `docs/history/milestones/milestone-02-campaign-design.md` |
| `milestones/milestone-03-game-menu.md` | `docs/history/milestones/milestone-03-game-menu.md` |
| `milestones/milestone-05-build-phase.md` | `docs/history/milestones/milestone-05-build-phase.md` |
| `milestones/milestone-04-*.md`, `-06-*` … `-12-*.md` | `docs/planning/` (same names) |
| `evidence/report.md` | `docs/history/reports/2026-08-21-pulse-playground.md` |
| `evidence/gate-1b-report.md` | `docs/history/reports/2026-08-26-quality-and-effects.md` |
| `evidence/unit-architecture-spike.md` | `docs/history/reports/2026-09-10-unit-architecture-spike.md` |
| `evidence/gate-3a-report.md` | `docs/history/reports/2026-09-13-menu.md` |
| `evidence/gate-3b-report.md` | `docs/history/reports/2026-09-21-settings-screen.md` |
| `evidence/gate-3c-report.md` | `docs/history/reports/2026-09-21-mode-select.md` |
| `evidence/gate-5a-report.md` | `docs/history/reports/2026-09-21-scrolling-and-placement.md` |
| `evidence/gate-5b-report.md` | `docs/history/reports/2026-09-21-construct-menu.md` |
| `evidence/gate-5c-report.md` | `docs/history/reports/2026-09-21-adaptive-layout.md` |
| `evidence/gate-5d-report.md` | `docs/history/reports/2026-09-22-nexus-draft-and-commit.md` |
| `evidence/gate-5e-report.md` | `docs/history/reports/2026-09-26-build-phase-playtest-1.md` |
| `evidence/gate-5f-report.md` | `docs/history/reports/2026-09-26-layout-and-focus.md` |
| `evidence/gate-5f-round-2-report.md` | `docs/history/reports/2026-09-27-build-phase-playtest-2.md` |
| `evidence/gate-5g-report.md` | `docs/history/reports/2026-09-27-debug-mode.md` |
| `evidence/browser-playtest-report.md` | `docs/history/reports/2026-09-27-browser-playtest-page.md` |
| `evidence/gate-5h-report.md` | `docs/history/reports/2026-09-28-movement-feel.md` |
| `evidence/gate-5i-report.md` | `docs/history/reports/2026-09-28-placement-juice.md` |
| `evidence/gate-5j-report.md` | `docs/history/reports/2026-09-28-build-phase-playtest-3.md` |
| `evidence/gate-5k-report.md` | `docs/history/reports/2026-09-29-build-phase-playtest-4.md` |
| `evidence/gate-6a-report.md` | `docs/history/reports/2026-09-29-pulse-start-end-recall.md` |
| `evidence/menu-spike-report.md` | `docs/history/reports/2026-09-30-menu-spike.md` |
| `evidence/gate-6b-report.md` | `docs/history/reports/2026-09-30-round-loop-and-missions.md` |
| `evidence/frames/`, `evidence/*.txt` | `docs/history/reports/pulse-playground-fixtures/` |
| `evidence/screenshots/` | `docs/screenshots/` |
| `concept/*.png`, `concept/*.PNG`, `concept/README.md` | `docs/game-design/concept-art/` |
| `concept/2026-08-19 - original spec.md` | `docs/history/original-spec-2026-08-19.md` |
| `docs/ui-patterns.md` | `docs/system-design/ui-patterns.md` |
| `docs/portability.md` | `docs/system-design/portability.md` |
| `docs/scripted-opponent.md` | `docs/game-design/scripted-opponent.md` |
| `docs/next-steps.md` | `docs/planning/next-steps.md` |
| `docs/lessons-learned.md` | `docs/history/lessons-learned.md` |
| `docs/feedback/` | `docs/history/feedback/` |
| `docs/spec-audit-2026-08-21.md` | `docs/history/spec-audit-2026-08-21.md` |
| `docs/claude-web.md` | unchanged |
| `.claude/skills/canon/` | deleted; mechanics into `DEVELOPMENT.md` |
| `AGENTS.md` §4 | `docs/system-design/architecture.md` (trimmed in step 3) |
| `AGENTS.md` §7 | `docs/system-design/testing.md` |
| `DEVELOPMENT.md` "Change log" | `docs/history/README.md` |

## 12. Done when

- Finishing a milestone step touches two places: the milestone's checkbox and one timeline line.
- `AGENTS.md` is about 100 lines and has not changed because a step closed.
- A new agent finds the current milestone, the open questions and the run commands from
  `./scripts/check-repository.sh` and two links.
- No current document, code comment or test name cites a canon version, a gate letter, an `F<n>` or a
  section number; the validator rejects the retired words outside `docs/history/`.
- Every design document says what it covers in its first two lines, and every RULE names what holds it.
- The validator passes and the test suite is green on both runtimes after every pull request.
