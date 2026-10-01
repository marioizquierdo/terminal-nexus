# Feedback loops — report

**Document role:** Evidence report for the owner's feedback-loop direction (Activity Logs, the About screen, the loop in the design)
**Status:** PASS — awaiting Mario's playtest
**Updated:** 2026-10-01
**License:** Apache-2.0

---

## 1. Frame — written before coding

- **Canon version:** 2.30 at the start; 2.31 at the end.
- **Milestone and gate:** Milestone 6 is current at gate 6A; this is the owner's direction between gates
  (feedback F87-F96, `docs/feedback/2026-10-01-feedback-loops.md`), on a pull request of its own, as the
  menu spike was. It does not start 6B.
- **Question this gate answers:** Can a pull request's build carry what it needs for precise feedback —
  a setting to feel, a record of what happened, a link that opens where the question is — and does every
  agent learn the loop from the documents it already reads?
- **Smallest artifact that can answer it:** one structured logger with a declared schema; a plain
  game-menu window that filters and exports it; demo buttons and an export box on the playtest page; the
  loop as one section of `docs/ui-patterns.md` reached from `AGENTS.md` and the skills; an About screen.
- **Automated evidence planned:** the logger's own tests (schema, levels, rotation, text round trip);
  every entry a scripted playtest logs checked against the schema; the window's keyboard and mouse
  parity; the About screen at 80 × 24; the architecture tests (the kernel and match layer never reach the
  logs); typecheck, Node and Bun suites, repository checks.
- **Human observation planned:** Mario plays the page, opens Esc → Activity logs, exports, and reads the
  About screen.
- **Explicit exclusions:** the parked pipeline (in-game notes, routing to issues, a triage agent);
  writing logs to files by default; telemetry of any kind leaving the machine; a community page (only
  researched).
- **Stop conditions:** logging that changes what the reducer decides; a log reachable from the kernel.

## 2. Environment — pinned, not remembered

| | |
| --- | --- |
| OS and architecture | Linux x86_64 (Claude Code on the web container) |
| Runtime and exact version | Node v22.22.2; Bun 1.3.11 |
| Dependencies and exact versions | typescript 7.0.2, @opentui/core 0.5.6 (`package.json`) |
| Hardware, if it affects measurements | not applicable |
| Date measured | 2026-10-01 |

```bash
npm install
npm run typecheck
npm test && npm run test:bun
./scripts/check-repository.sh
node scripts/playtest.mjs --keys "n 1 1 Enter Esc a" --activity Interactions   # the Activity logs window, and what the run recorded
bun scripts/build-web.mjs --demos evidence/demos/feedback-loops.json   # the playtest page with this round's demo
```

## 3. What was built

- **`src/log/`** — the structured logger: `levels.ts` (one vocabulary, shared with `grid`'s battle report),
  `logger.ts` (schema types, `Logger` with a ring buffer, injected clock, listeners, `entryProblems`,
  filters), `text.ts` (one line per entry, and its parser), `activity.ts` (the Activity Logs' events,
  filters, the global logger and the export format).
- **The Activity logs window** — `src/build/activity.ts`, `activitySpec` in `src/build/popup.ts`, three
  commands and three state fields in the reducer, `[a]` in the game menu; logging from `BuildSession`,
  `src/cli/spike.ts`, `src/cli/menu.ts` and the page; the exporter told which export it is.
- **The About screen** — `src/menu/about.ts`, a body for title-menu screens in `src/view/menu.ts`, Exit
  moved to `[5]`.
- **The playtest page** — an activity logs box and demo buttons (`--demos` in `scripts/build-web.mjs`).
- **Agent tooling** — `scripts/playtest.mjs --activity [filter]`.
- **Documents** — `docs/ui-patterns.md` section 15 (the feedback loop), 10.2-10.3 (the window's
  patterns), the title-menu screen shape; `AGENTS.md`, `CLAUDE.md`, three skills, the settings module's
  header; `specs/engine.md` 7.1 and 10.2 (canon 2.31); `docs/feedback-pipeline.md` cut to a parked note;
  Milestone 13 withdrawn.

## 4. Automated results

| Check | Result | Evidence |
| --- | --- | --- |
| Type check (Node and web) | clean | `npm run typecheck` |
| Node tests | 859 / 859 (after merging gate 6B from `main`) | `npm test` |
| Bun tests | all files pass | `npm run test:bun` |
| Repository checks, Markdown links | pass | `./scripts/check-repository.sh`, `node scripts/check-markdown-links.mjs` |
| Every entry a scripted run logs matches the schema | pass | `tests/build-activity.test.ts`, `tests/menu-about-screen.test.ts` |
| The reducer behaves the same whether anything is logged | pass | `tests/build-activity.test.ts` |
| The kernel and the match layer never reach the logs | pass | `tests/architecture.test.ts` |
| The built page in headless Chromium: demo button → Esc, a, e → the export box filled; Menu → 4 → About | pass, no page errors | `evidence/screenshots/page-activity-export.png`, `page-about.png` |

## 5. Human observations

Nobody has played this build yet. Mario is asked to open the page, try the demo button, export the
Activity logs into the pull request, and read the About screen.

## 6. Interpretation

The logger is small because the schema carries the weight: the types refuse an undeclared event at
compile time and `entryProblems` refuses one at test time, so the schema stays the truth about what the
game records. The window reuses the one popup shape; the only new popup abilities are a list that fills
the room (so rows above it never move), a clickable text row and a wider value box. Keeping the log out
of the reducer — read only to freeze and count the window's list — kept the Build Phase replayable.

## 7. Failures, surprises, and discarded approaches

- **`grid`'s "logger" was a report, not a logger.** It narrates a finished battle from its events, so
  sharing the level vocabulary was the coherent step; forcing its lines through the new interface would
  have changed its fixed-column grammar, which agents grep.
- **Two agents wrote the same table** turning a colour depth into other words for the logs; both now log
  the setting's own name. When two agents need the same small helper in a folder neither owns, say in
  the prompts which one writes it.
- **A popup sized to its list moved its Filter row under the mouse** each time the filter changed the
  list's length; the window now fills the pane, at the cost of blank space when few entries match.
- **The `hidden` attribute does nothing on an element whose class sets `display: flex`**; the demo row
  needed its own `[hidden]` rule.
- **The proposed feedback pipeline was parked** after an hour's design: cheap to write, cheap to drop.
- **A read-only review found the frozen list was a cut-off, not a copy**: once the log's memory was full,
  every key pressed in the window dropped its oldest rows. Now a copy, with a full-log test. It also found
  held keys logging repeats that moved nothing, a detail note that lost the event's meaning on a long
  entry, a demo with broken keys failing silently, and the whole list reformatted every frame — all
  fixed before the pull request.
- **Gate 6B merged into `main` while this was built**; a test comparing whole round contexts had to leave
  the Activity Logs out, since they rightly differ by which key moved on.

## 8. Decision

> **PASS**

Each item of his direction is built or answered (F94 with a recommendation only he can act on), every
check passes, and an agent reading `AGENTS.md` meets the loop in Sections 4 and 5 and is pointed to one
section of the design document. What remains is his playtest.

## 9. Canon impact

Applied at canon 2.31, on his direction:

| Rule | Lives in | Earned by |
| --- | --- | --- |
| One structured shape for every log; the kernel and match layer never log; nothing the rules decide reads a log | `specs/engine.md` 7.1 | F90, the architecture test |
| The playtest page may add tools around the screen (export boxes, demo buttons) | `specs/engine.md` 10.2 | F92 |

No questions opened or answered.

## 10. Next authorized action

Mario plays the page and pastes an Activity Logs export into the pull request; gate 6B still waits for
his word.
