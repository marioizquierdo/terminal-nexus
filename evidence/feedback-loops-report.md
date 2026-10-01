# Feedback loops — report

**Document role:** Evidence report for the owner's feedback-loop direction (Activity Logs, the About screen, the loop in the design)
**Status:** WORKING — filled in as the work goes
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
node scripts/playtest.mjs --keys "1 Enter Esc a" --text final   # the Activity logs window
bun scripts/build-web.mjs --demos <demos.json>                   # the playtest page with demo buttons
```

## 3. What was built

_(filled in after the merge)_
