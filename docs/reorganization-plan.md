# Documentation reorganization — the plan

**What this is:** the agreed plan for where every document in this repository goes, what each one is
for, and the passes that get it there. Mario settled the open choices on 2026-10-01 (§10). This file is
the checklist for the work and is deleted by the last pass.

**Status:** in progress. Pass 1 (the move) merged in pull request 52. Pass 2 (the entry points) is the
next pull request. Passes 3 to 6 remain.

---

## 1. Why

**Three kinds of document are mixed together.** What is true now (the design, the architecture, how to
run things), what is planned (milestones, open questions, carry-over) and what happened (reports,
feedback logs, ledgers, change logs) sit side by side in five folders and three root files. A new
agent cannot tell from a path which kind it is reading, so it reads all of it: 25,000 lines of
Markdown, roughly 9,000 of them history nobody needs on a normal day.

**The versioning ceremony costs more than it protects.** Sixteen files carry a "canon version" that must
agree; the validator fails the build when one is missed; prose says "canon 2.19" where it should say
what was decided; the entry file restates the rules so it can be checked against them. Closing one step
of a milestone meant editing seven places plus the version stamp. Git and pull requests already record
what changed and when. The one idea underneath worth keeping is RULE versus GUIDANCE, per statement.

**The entry point is a history book.** `AGENTS.md` is 663 lines, 230 of them a dated step-by-step
narrative read first by every session and grown by a paragraph per step. `DEVELOPMENT.md` is 761 lines:
commands, then two hundred lines describing the game's screens step by step, then a change log that
stops in August. **Code comments cite the ceremony**: 368 lines name a feedback item by number, 74 an
open question, 398 a gate, 378 a spike, 164 an `engine.md` section number.

## 2. The principle: three shelves, one home per fact

Every document lives on exactly one shelf, and the path says which.

| Shelf | Question it answers | Who reads it | Lifetime |
| --- | --- | --- | --- |
| **Current** | What is the game, how is it built, how do we work? | Every agent, every session | Edited in place; a merged pull request *is* the change |
| **Planning** | What is next, what is undecided, what is waiting? | An agent starting work | Short; an item is deleted when it is done |
| **History** | What happened, what did we learn, what did Mario say? | Only when asked | Append-only; never required reading |

Three rules follow:

- **A current document never narrates.** It says what *is*, not how it came to be. If the provenance
  matters, one parenthesis names the pull request or the date; the story stays on the history shelf.
- **Nothing on the history shelf is in an agent's reading order.** The index lists it; nothing requires it.
- **Every fact has one home; everything else links.** The test: **finishing a milestone step touches two
  places** — the step's checkbox in the milestone file and one line in the history timeline. `AGENTS.md`
  never changes because a step closed.

The project is **Terminal Nexus 0.1** until it is public. There is no canon and no version of the
design. A design document describes the current design; a pull request that changes the design changes
the document, the code and the test together. That is the whole protocol.

## 3. The layout

```text
.
├── README.md                    What the game is, how to play what exists, how to run tests. For a person.
├── AGENTS.md                    The entry point for any coding agent. ~100 lines. Points, never repeats.
├── CLAUDE.md                    Claude-specific notes only (web sessions, branches, pull requests). Imports AGENTS.md.
├── DEVELOPMENT.md               The practices manual: toolchain, tests, seeing a change, milestones, spikes,
│                                the feedback loop, changing the design, writing for Mario. ~300 lines, no history.
├── CONTRIBUTING.md              Human contributors and licensing. Short, as now.
│
├── docs/
│   ├── README.md                One screen: every document, one line each, grouped by shelf.
│   │
│   ├── game-design/             CURRENT — what the game is. CC BY-SA unless a file says otherwise.
│   │   ├── concept.md               one-page product definition
│   │   ├── lore.md                  universe, factions, voice
│   │   ├── game-modes.md            Campaign and Challenge
│   │   ├── commander-armies.md      factions, Commanders, the army shape
│   │   ├── campaigns.md             missions, PERIMETER, cutscenes
│   │   ├── scripted-opponent.md     waves and intentions (working design)
│   │   ├── decisions.md             the settled product decisions, flat; shrinks as each becomes a RULE in its home
│   │   ├── ascii-art-references.md  reading list for terminal art
│   │   └── concept-art/             the images and their index
│   │
│   ├── system-design/           CURRENT — how the software is shaped. Apache-2.0.
│   │   ├── grid-engine.md           the overview: the three worlds, layers, coordinates, the invariants, the code
│   │   │                            vocabulary, and a map of the documents below (today's engine.md, split in pass 4)
│   │   ├── grid.md                  size, viewport, layers, collision masks, placement, distance   (pass 4)
│   │   ├── pulse.md                 logical time, movement credit, tick order, determinism, match structure,
│   │   │                            economy, events                                                (pass 4)
│   │   ├── content.md               content interfaces                                             (pass 4)
│   │   ├── presentation.md          the cell frame, composition, tile width, bands, accessibility   (pass 4)
│   │   ├── input.md                 the command vocabulary, keyboard, mouse, driver, bindings       (pass 4)
│   │   ├── runtime.md               terminal lifecycle, delivery, tools, scaling                    (pass 4)
│   │   ├── effects.md               animations, particles, shading, tweens
│   │   ├── ui-patterns.md           every screen, menu, popup, key
│   │   ├── testing.md               what the suite proves and how
│   │   ├── replay-format.md         the unbuilt replay design (GUIDANCE)
│   │   └── portability.md           what a host must provide (working design)
│   │
│   ├── milestones/              PLANNING — what is next.
│   │   ├── README.md                the sequence, each milestone's status, the build order and why
│   │   ├── milestone-NN-*.md        the CURRENT milestone and the future ones
│   │   ├── completed/               milestones that are done, kept as records
│   │   ├── next-steps.md            waiting on Mario, carry-over, the cleanup queue
│   │   ├── open-questions.md        OPEN and OBSERVABLE questions, each with a recommendation
│   │   └── backlog.md               work no milestone owns yet: the deferred kernel work, deferred systems,
│   │                                and the long-horizon decisions
│   │
│   ├── history/                 HISTORY — read only when asked. Append-only.
│   │   ├── README.md                a dated timeline: one line per accepted step, with its pull request
│   │   ├── lessons-learned.md       dated lessons
│   │   ├── answered-questions.md    the Answered table
│   │   ├── feedback/                Mario's words, item by item
│   │   ├── reports/                 long-form reports, dated
│   │   ├── spec-audit-2026-08-21.md
│   │   └── original-spec-2026-08-19.md
│   │
│   ├── screenshots/             pictures of the current build, regenerated by scripts; pull requests link them by commit
│   └── claude-web.md            setting up Claude Code on the web
│
├── .claude/skills/              grid, playtest, grid-screenshots, pr-description, feedback-round. `canon` is deleted.
└── scripts/check-repository.sh  the one validator, checking the rules in §8
```

`specs/`, `milestones/`, `evidence/` and `concept/` disappear. Everything in them moves; §7 names the
few things deleted.

**Why these folders.** *game-design* and *system-design* are both current, split by reader and by
licence: a player or a writer versus a programmer, CC BY-SA versus Apache. *milestones* is the whole
planning shelf — a milestone, an open question and a carry-over item are all work not yet done, and
the folder's name is the thing people look for. *history* is flat, with sub-folders only where many
files share a kind.

**`DEVELOPMENT.md` and the skills.** The manual says, for each practice, **what it is and why it is
shaped that way**, in a page or less. A skill is the **exact runnable procedure** for one practice
(`playtest`, `grid-screenshots`, `feedback-round`, `pr-description`), linked from the practice it
serves. Neither repeats the other.

## 4. Vocabulary

| Word | Decision |
| --- | --- |
| **canon**, canon version, canon bump, "per canon" | **Retired everywhere, lore included.** Say "the design", "the design documents", or the fact itself. The validator rejects the word outside `docs/history/`. |
| **gate** | **Retired.** A milestone has **steps**: a checkbox list, each step one pull request, done when it is merged and Mario has played it. The milestone's header names its **current step**. "Gate 5F" survives only in history files and old pull requests. The *resize gate* (the TERMINAL TOO SMALL screen) is a game concept and keeps its name. |
| **spike** | **Kept as a practice**: a small throwaway build that answers one question (the manual's spikes section). **Dropped as the name of the Build Phase screen** (`--spike`, `src/cli/spike.ts`, `SPIKE_*`): pass 5. |
| **milestone** | **Kept** as the planning unit. Only `docs/milestones/` says which one is current. |
| **evidence** | **Retired.** Pictures are screenshots; a long write-up is a report; test output is test output. |
| **authority, authorization, authorized** | **Replaced by scope.** "In scope for the current step"; "a design document describes, it does not schedule." |
| **RULE / GUIDANCE** | **Kept and extended** (§5). |
| **F<n>**, **Q<n>** | Ids stay inside their registers. Code and current documents stop citing `F<n>`. `Q<n>` is cited only from `open-questions.md`, `next-steps.md` and the milestone that waits on it. |
| Experiment, settings export, Build Phase, Nexus Pulse, Battle Round, Grid, Commander Army… | Unchanged. |

## 5. RULE, GUIDANCE and IDEA

The marker answers the question an agent actually has at a fork: *may I change this?*

| Marker | Means | An agent may |
| --- | --- | --- |
| **RULE** | Built and depended on. The code implements it and a named test or module holds it. | Follow it. Changing it is a design change: one pull request changes the sentence, the code and the test, and says so for Mario. |
| **GUIDANCE** | The recommended default, written before the thing existed or chosen without playing it. **Anything unmarked is GUIDANCE.** | Follow it by default. Depart when the work shows better, and say why in the pull request. |
| **IDEA** | A sketch kept so it is not lost. Nothing depends on it; it is not a plan. | Read it for context. Build it only when a milestone step asks for it. |

Practices:

1. **Unmarked means GUIDANCE.** Only RULE and IDEA are labelled, so a RULE stands out.
2. **A RULE names what holds it**: "RULE — `tests/build-camera.test.ts`". The document points at the
   test; the test is named for the rule in words, never for a section number, so a split never renumbers.
3. **Markers go on statements, not only on sections.** A page of GUIDANCE can hold one RULE line.
4. **`decisions.md` dissolves into RULEs.** Each entry moves into the document that owns it, as a RULE
   with its holder, and leaves the list. The list may shrink to nothing.
5. **A design document opens with one sentence saying what it covers**, then a licence line only when it
   differs from its folder's. No other header.
6. **Strip narration when rewriting.** Before: "*Reversed at canon 2.19 (Q52), after the owner lived
   with gate 5A: a second click on the same tile places the armed structure.*" After: "*A second click on
   the same tile places the armed structure, compared by tile, never by screen position (RULE —
   `tests/build-placement.test.ts`).*"

## 6. The passes

Six pull requests, each reviewed before the next starts. **Moving text and changing what it says never
share a commit.**

### Pass 1 — move (one pull request, one commit per source folder)

The manifest in §9, applied with `git mv`. In the same commit as each folder:

- rewrite every link to the moved files (`grep -rl` over `*.md`, `.claude/`, `scripts/`, `tests/`,
  `src/`; the link checker then proves it);
- delete the `**Canon version:**` line and the four other header fields from every moved document (a
  document keeps its title and its first descriptive paragraph; the two-line header of §5 comes in pass 4);
  milestone files keep `Status` and `Current step`, and the status `GATED` becomes `PLANNED`;
- rename the milestone field `**Active gate:**` to `**Current step:**` (the validator reads it);
- dissolve `project-governance.md` by moving its sections to the destinations in §9 — no rewording;
- split `open-questions.md` at its "## 5. Answered" heading;
- concatenate `backlog.md` from the Pulse backlog and governance §8 and §10, under headings;
- change the scripts' default output folder to `docs/screenshots/` (nine scripts, listed in §9);
- update `.github/CODEOWNERS` to `/docs/game-design/` and `/docs/system-design/`;
- update the validator (§8) and the five skills' paths; delete the `canon` skill.

Validator and both test runtimes green after every commit. Reviewable as "did anything get lost".

### Pass 2 — the entry points (one pull request)

**`AGENTS.md`, ~100 lines:**

1. What this is: the game in three sentences; Terminal Nexus 0.1; the three shelves.
2. Start here: run `./scripts/check-repository.sh`; read `docs/README.md`; read the current milestone
   to its current step; skim the open questions' titles.
3. How we work, in ten lines: scope is the current step; one pull request per step; tests on both
   runtimes; see it with the playtest script; a design change edits the document in the same pull
   request; a fork becomes an Experiment or a registered question with a recommendation; write what Mario
   reads in plain English; stop with the pull request, never continue to the next step.
4. The hard rules, eight at most, each one line, linking to `grid-engine.md` for the rest: the kernel
   imports no terminal, clock or renderer; presentation never influences simulation; every action is a
   named command behind three adapters; cells carry roles, never colours; Nexuses are named for factions,
   never people; the lore is a platform, not a plot.
5. Where things are: the folder table.
6. Finishing a session: the checklist.
7. Licensing, one line.

`AGENTS.md` changes only when a rule of working changes. Never when a step closes.

**`CLAUDE.md`, ~20 lines:** imports `AGENTS.md`; the web-session rules (task branch, pull request through
the `pr-description` skill, never push `main`); the skills to use and when.

**`DEVELOPMENT.md`, ~300 lines, by what an agent wants to do:**

1. Toolchain and commands — install, typecheck, test, run `grid`, run `terminal-nexus`, the pinned
   versions table.
2. Testing — both runtimes; Bun's per-test timeout; timing tests under load; the live-loop test that
   looks like a hang; the determinism checks; what each test file area covers.
3. Seeing a change — the playtest script, screenshots, GIFs, the browser page, `--keys` and `--settings`,
   the log as the feedback loop.
4. Planning: milestones and steps — what a milestone file holds (its question, what it depends on, its
   steps as checkboxes, each step's definition of done); how one becomes current; one step per session;
   a step is done when its pull request is merged and Mario has played it; `next-steps.md` for what
   belongs to no step.
5. Spikes — when (a question reading cannot answer), how (a branch, throwaway code, the smallest thing
   that answers it), how reported (the pull request; `docs/history/reports/` only when it needs more
   than a page, surprises and discarded approaches first).
6. The feedback loop — Experiments and tuned values; the settings export and `--settings`; his words
   logged item by item in `docs/history/feedback/`; the Demo sized to the change; the browser page as a
   private Claude page; the `feedback-round` and `pr-description` skills.
7. Changing the design — the markers; sentence, code and test in one pull request; what a session
   decides alone and what it asks (from governance §2); registering a question with a recommendation;
   the retired words and what the validator checks.
8. Writing for Mario — the plain-English rule, with the good and bad examples.
9. Environments — local, Codespaces, Claude Code on the web (`docs/claude-web.md`).
10. Licensing, one line.

The two hundred lines describing the game's screens leave: the rules they state are already in
`ui-patterns.md`, and `README.md` gets a short "what exists today". The change log leaves (§9).

**`README.md`:** status as of today (the Build Phase, the Pulse, PERIMETER's three rounds exist), the
new tree, 0.1 framing; commands unchanged. **`CONTRIBUTING.md`:** reading order becomes `AGENTS.md`
and `docs/README.md`. **`package.json`:** description "Terminal Nexus — an ASCII strategy game for the
terminal", version `0.1.0`. **`.github/pull_request_template.md`:** the bookkeeping block becomes
"Design documents changed" and "Questions opened or answered". **`docs/README.md`:** the index by
shelf, one line per document, and the three rules of §2. **`docs/claude-web.md`:** gate references
out.

### Pass 3 — the planning and history shelves (one pull request)

- `docs/milestones/README.md`: the sequence table with a Status column (CURRENT, planned, completed,
  linking into `completed/`), the build order and why; its history paragraphs go to the timeline.
- The current and future milestone files: the header keeps the question, what it depends on and the
  current step; the dated "built and reported, awaiting Mario" paragraphs become the step list with
  checkboxes; every "canon 2.x" becomes the decision in words.
- `open-questions.md`: the preamble shrinks to the protocol in ten lines; **every question's heading
  becomes a sentence** — "Q57 — Where does the keyboard go after a building is placed?" — with the id as
  a label.
- `next-steps.md`: trimmed to what is actually waiting; everything that is a step goes to its milestone.
- `docs/history/README.md`: the timeline, built from governance §5 and §6, the milestones' acceptance
  dates and `git log --merges` (51 pull requests): one line per accepted step or merged round — date, what
  it was in words, the pull request, the report if one exists.
- The two skills: `feedback-round` loses the version bump, the ledger row and the gate report;
  `pr-description` loses "gate letters allowed in the title" and the old footer.

### Pass 4 — the design documents (one or two pull requests)

- **Split `grid-engine.md`** (today's `engine.md`, 1,664 lines) by its own sections:
  §0–2 stay as the overview, joined by `AGENTS.md` §4's invariants and a glossary of the code
  vocabulary (menu, card, popup, message, hand-off, Experiment, tuned value, Build Phase, Nexus Pulse,
  Battle Round, mission, round, wave); §3 → `grid.md`; §4–7 → `pulse.md`; §8 → `content.md`; §9.1–9.6 →
  `presentation.md`; §9.7 → `input.md`; §10–11 → `runtime.md`. The overview ends with a map: one line per
  document, what it covers. Section numbers inside the parts restart at 1; nothing may cite them.
- Markers on statements; every RULE names its holder; `decisions.md` entries move into their homes.
- The two-line header on every design document (§5).
- Candidates for their own pages, written only where the material already exists: `logging.md` (the
  levelled log grammar, today in `DEVELOPMENT.md` and `replay-format.md` §3) and `settings.md` (tiers,
  sections, the export; today in `ui-patterns.md` §10.3 and §15 and `src/build/all-settings.ts`).

### Pass 5 — the code (pull requests by area: build, view, pulse and content, tests, scripts)

- **Comments.** Remove `F<n>` (368 lines), `Q<n>` (74), "gate", "spike" and "canon <version>" narration,
  and `engine.md 9.7`-style citations (164). Keep the *reason* a line exists, in words; cite a pull
  request where provenance genuinely matters; delete a comment that said only "F66".
- **The Build Phase is not a spike.** `--spike` → `--build-phase`, with `--spike` kept as an alias; both
  carry a comment saying they are temporary and should give way to flags that mean something — a
  scenario to load, a screen to open, a state to start in — rather than a screen's nickname.
  `src/cli/spike.ts` → `src/cli/build-phase.ts`; `SPIKE_CATALOG`, `SPIKE_ALLOTMENT`, `spikeGrid`… →
  `STARTER_*`; `tests/build-spike.test.ts` and `scripts/capture-spike-screenshots.mjs` renamed to
  match; the playtest script and the browser page follow.
- **Test names** that cite a section number become the rule in words (15 today).
- **Names aligned with the glossary**: `catalog.ts`, `status.ts` and the `STARTER_*` constants are the
  ones to look at; `experiments.ts`, `tuning.ts`, `all-settings.ts` are already right.

### Pass 6

Delete this file.

Milestone 6's current step is built and waiting for Mario's playtest, so nothing in flight conflicts.
If his feedback arrives mid-way, it is handled on its own branch and the running pass rebases.

## 7. What is deleted

- `specs/project-governance.md` §1 (canon is a document set) and `specs/README.md`'s canon-map prose —
  replaced by `docs/README.md`.
- `specs/templates/gate-report.md` — the pull request template is the report; its useful sections
  become the checklist in the manual's §5.
- `DEVELOPMENT.md`'s change log and screen-by-screen description — git keeps them; the timeline keeps
  the dates.
- `.claude/skills/canon/` — its mechanics (decide alone or ask, register a question, land a design
  change) go into the manual's §7.
- Every `**Canon version:**`, `**Document role:**`, `**Status:**`, `**Updated:**` and `**License:**`
  header line outside `docs/milestones/` (milestones keep `Status` and `Current step`).

## 8. The validator after pass 1

`scripts/check-repository.sh` keeps running in CI and checks:

1. **Required files**: the five root documents, the licences, `docs/README.md`,
   `docs/milestones/README.md`, `docs/milestones/open-questions.md`,
   `docs/history/answered-questions.md`, the devcontainer, the CI workflow.
2. **Exactly one CURRENT milestone** in `docs/milestones/` (not `completed/`), declaring a
   `**Current step:**`; the index table agrees; every other milestone is `PLANNED`, and everything in
   `completed/` is `COMPLETE`.
3. **Questions**: every `Q<n>` cited anywhere in `docs/` resolves to a heading in `open-questions.md`
   or a row in `answered-questions.md`; every `OPEN` question has a recommendation.
4. **Markers**: only RULE, GUIDANCE and IDEA; `LAW` and `UNPROVEN` stay retired.
5. **Retired words**, outside `docs/history/` and lines marked `<!-- stale-ok -->`: the existing list,
   plus `\bcanon\b`, `canon version`, `[Gg]ates? [0-9]`, `gate-[0-9]`, `[Aa]ctive gate`, `gate report`,
   `GATED`, and the old root paths `specs/` and `evidence/`. `canonical` is not `canon` and stays; the
   resize gate is a game concept and matches none of these.
6. **Links resolve, fences balance, no whitespace errors, the devcontainer parses, `CLAUDE.md` imports
   `AGENTS.md`** — unchanged.

Its last lines print the current milestone and its step, and point at `AGENTS.md`. The canon-version
agreement, the five-field header check and the `AGENTS.md` version check are deleted. Until pass 6,
this file is on the exemption list.

## 9. The move manifest

Pass 1 executes this, in order, one commit per source folder.

| From | To |
| --- | --- |
| `specs/terminal-nexus-concept.md` | `docs/game-design/concept.md` |
| `specs/terminal-nexus-lore.md` | `docs/game-design/lore.md` |
| `specs/game-modes.md` | `docs/game-design/game-modes.md` |
| `specs/commander-armies.md` | `docs/game-design/commander-armies.md` |
| `specs/campaigns.md` | `docs/game-design/campaigns.md` |
| `specs/ascii-art-references.md` | `docs/game-design/ascii-art-references.md` |
| `specs/engine.md` | `docs/system-design/grid-engine.md` (split in pass 4) |
| `specs/ascii-effects.md` | `docs/system-design/effects.md` |
| `specs/replay-format.md` | `docs/system-design/replay-format.md` |
| `specs/open-questions.md` §1–4 | `docs/milestones/open-questions.md` |
| `specs/open-questions.md` §5 | `docs/history/answered-questions.md` |
| `specs/backlog-pulse-completion.md` + governance §8, §10 | `docs/milestones/backlog.md` |
| `specs/project-governance.md` §2, §3, §4 | `DEVELOPMENT.md` (appended; rewritten in pass 2) |
| `specs/project-governance.md` §5, §6 | `docs/history/README.md` |
| `specs/project-governance.md` §7 | `docs/game-design/decisions.md` |
| `specs/project-governance.md` §9 | `docs/system-design/testing.md` |
| `specs/project-governance.md` §1 | deleted |
| `specs/README.md` | `docs/README.md` (rewritten in pass 2) |
| `specs/templates/gate-report.md` | deleted |
| `milestones/README.md` | `docs/milestones/README.md` |
| `milestones/milestone-01-grid-battles.md` | `docs/milestones/completed/milestone-01-grid-battles.md` |
| `milestones/milestone-02-campaign-design.md` | `docs/milestones/completed/milestone-02-campaign-design.md` |
| `milestones/milestone-03-game-menu.md` | `docs/milestones/completed/milestone-03-game-menu.md` |
| `milestones/milestone-05-build-phase.md` | `docs/milestones/completed/milestone-05-build-phase.md` |
| `milestones/milestone-04-*.md`, `-06-*.md` … `-12-*.md` | `docs/milestones/` (same names) |
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
| `concept/2026-08-19 - original spec.md` | `docs/history/original-spec-2026-08-19.md` (still verbatim, still exempt) |
| `docs/ui-patterns.md` | `docs/system-design/ui-patterns.md` |
| `docs/portability.md` | `docs/system-design/portability.md` |
| `docs/scripted-opponent.md` | `docs/game-design/scripted-opponent.md` |
| `docs/next-steps.md` | `docs/milestones/next-steps.md` |
| `docs/lessons-learned.md` | `docs/history/lessons-learned.md` |
| `docs/feedback/` | `docs/history/feedback/` |
| `docs/spec-audit-2026-08-21.md` | `docs/history/spec-audit-2026-08-21.md` |
| `docs/claude-web.md` | unchanged |
| `.claude/skills/canon/` | deleted |
| `AGENTS.md` §4 | `docs/system-design/grid-engine.md` (merged in pass 4) |
| `AGENTS.md` §7 | `docs/system-design/testing.md` |
| `DEVELOPMENT.md` "Change log" | `docs/history/README.md` |

Scripts whose default output path changes to `docs/screenshots/`: `capture-screenshots.mjs`,
`capture-spike-screenshots.mjs`, `capture-menu-screenshot.mjs`, `capture-engagement.mjs`,
`capture-damage-flash-fade.mjs`, `render-palette.mjs`, `prototype-sub-explosions-illustration.mjs`,
`playtest.mjs` (its `--out` advice), and `capture-frames.mjs` (to the fixtures folder). Pull requests
link screenshots by commit SHA, so old links keep working.

## 10. Decisions (Mario, 2026-10-01)

1. Completed milestones live in `docs/milestones/completed/`, so every milestone is in one place.
2. `engine.md` is split; the remainder is `grid-engine.md`, an overview of the architecture with
   references to the parts, in line with the other system-design documents.
3. "Step" replaces "gate".
4. No long-form report by default; `docs/history/reports/` stays for the ones that need it, cleaned up
   later if it grows.
5. `--spike` is renamed in the code pass, with an alias and a comment saying the flag is temporary and
   should give way to flags that mean something.
6. No changelog; the dated timeline in `docs/history/README.md` is the record, with the pull requests.

A second session's review of the same problem was read alongside this plan. It agreed on the shape
(one home per fact, an entry file that never changes when a step closes, history out of the reading
order, a move pass before a wording pass); its "two places" test, the GUIDANCE-by-default rule, the
question headings in words and `input.md` were taken from it. Its suggestions to keep a single version
stamp, keep "canon" in agent-facing files and reduce the manual to a command list were not.

## 11. Done when

- Finishing a milestone step touches two places: the step's checkbox and one timeline line.
- `AGENTS.md` is about 100 lines and has not changed because a step closed.
- A new agent finds the current milestone and step, the open questions and the run commands from
  `./scripts/check-repository.sh` and two links.
- No current document, code comment or test name cites a canon version, a gate letter, an `F<n>` or a
  section number; the validator rejects the retired words outside `docs/history/`.
- Every design document says what it covers in its first line, and every RULE names what holds it.
- The validator passes and the test suite is green on both runtimes after every pull request.
