# Report — Feedback loops: the Activity Logs, the About screen, and the loop written into the design

---

## 1. Frame — written before coding

- **Milestone and step:** between steps of Milestone 6 — Mario's direction on feedback loops
  (`docs/history/feedback/2026-10-01-feedback-loops.md`), on a pull request of its own, as the menu spike
  was. It is not a milestone step and does not start the next one.
- **Question this change answers:** Can a pull request's build carry what it needs for precise feedback —
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
bun scripts/build-web.mjs --demos scripts/demos/feedback-loops.json   # the playtest page with this round's demo
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
- **Documents** — `docs/system-design/ui-patterns.md` (the feedback loop, the window's patterns, the
  title-menu screen shape), `runtime.md` (logs, and the playtest page's tools), `grid-engine.md` and
  `input.md` (one row, one menu entry); `AGENTS.md`, `CLAUDE.md`, `DEVELOPMENT.md`, three skills, the
  settings module's header; the parked pipeline kept as `2026-10-01-feedback-pipeline-parked.md` here,
  with an entry in `docs/milestones/backlog.md`; the proposed Milestone 13 withdrawn.

## 4. Automated results

| Check | Result | Evidence |
| --- | --- | --- |
| Type check (Node and web) | clean | `npm run typecheck` |
| Node tests | 860 / 860 (after merging step 6B and the documentation reorganisation from `main`) | `npm test` |
| Bun tests | all files pass | `npm run test:bun` |
| Repository checks, Markdown links | pass | `./scripts/check-repository.sh`, `node scripts/check-markdown-links.mjs` |
| Every entry a scripted run logs matches the schema | pass | `tests/build-activity.test.ts`, `tests/menu-about-screen.test.ts` |
| The reducer behaves the same whether anything is logged | pass | `tests/build-activity.test.ts` |
| The kernel and the match layer never reach the logs | pass | `tests/architecture.test.ts` |
| The built page in headless Chromium: demo button → Esc, a, e → the export box filled; Menu → 4 → About | pass, no page errors | `docs/screenshots/page-activity-export.png`, `page-about.png` |

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
- **Step 6B merged into `main` while this was built**; a test comparing whole round contexts had to leave
  the Activity Logs out, since they rightly differ by which key moved on.
- **A documentation reorganisation then landed too** (five folders into three shelves, no versions, the
  words "canon" and "gate" retired). The merge took its documents wholesale and re-applied this change's
  additions in their new places and words; every code comment this branch had added in the old citation
  style (feedback numbers, section numbers, dates) was rewritten in words.

## 8. Decision

> **PASS**

Each part of the direction is built or answered (the question of where to post public updates is answered
with a recommendation only Mario can act on), every check passes, and an agent reading `AGENTS.md` meets
the loop in two sentences and is pointed to one section of the interface rules. What remains is his
playtest.

## 9. Design changes

Applied on his direction:

| Rule | Lives in | Held by |
| --- | --- | --- |
| One structured shape for every log; the kernel and match layer never log; nothing the rules decide reads a log | `docs/system-design/runtime.md`, the invariants table in `grid-engine.md` | `tests/log.test.ts`, `tests/architecture.test.ts` |
| The playtest page may add tools around the screen (export boxes, demo buttons) | `docs/system-design/runtime.md`, `ui-patterns.md` | `tests/web.test.ts`, `tests/build-activity.test.ts` |
| The Activity logs window; the title-menu words-only screen; the list that fills the room | `docs/system-design/ui-patterns.md` | `tests/build-activity.test.ts`, `tests/menu-about-screen.test.ts` |

No questions opened or answered.

## 10. Next step

Mario plays the page and pastes an Activity Logs export into the pull request; the next milestone step
still waits for his word.
