# The Build Phase menu spike — report

**Document role:** Gate report for the owner's menu reorganisation (feedback F52-F60)
**Status:** IN PROGRESS
**Canon version:** 2.27
**Updated:** 2026-09-30
**License:** Apache-2.0

Copied from [`../specs/templates/gate-report.md`](../specs/templates/gate-report.md). The feedback it
answers is [`../docs/feedback/2026-09-30-menu-spike.md`](../docs/feedback/2026-09-30-menu-spike.md);
the definition of done is in [`../milestones/milestone-06-pulse-phase.md`](../milestones/milestone-06-pulse-phase.md)
under "The menu spike".

---

## 1. Frame — written before coding

- **Canon version:** 2.26 at the start.
- **Milestone and gate:** Milestone 6 (the Nexus Pulse Phase) is current and its gate 6A waits for
  Mario's playtest. This is the spike round 3 of 6A left for him to start (feedback F51): Build Phase
  interface work on a pull request of its own. It does not start gate 6B.
- **Question this gate answers:** Is the Build Phase menu clearer, and does the eye find the keyboard
  faster, when every row either opens a popup or gives the map something to do, an active row points
  at the map (`[x] Name  >>`), an arrow carries the eye from the menu to the cursor, the panel shows a
  card instead of help text, and the bottom of the screen is one line of contextual help?
- **Smallest artifact that can answer it:** the existing Build Phase screen, changed in place: the
  panel's rows, the active style, a building's card while placing, the focus arrow and cursor blink
  (behind Experiments), one bottom row fed by one list of hints, and a Controls and hotkeys page in the
  game menu.
- **Automated evidence planned:** unit tests for the panel geometry (resources line, no headings, the
  blank lines, the active style, the card), Left/Right keeping focus, the one flash after a placement,
  the arrow and blink timeline, the bottom row's answer-then-hint rule and a hint for every situation,
  the Controls page (open, scroll, back); the existing menu walk with Up/Down/Enter alone; typecheck,
  Node and Bun test runs, the repository validator.
- **Human observation planned:** Mario plays it (the browser page and his iTerm2), flips the focus
  arrow and cursor blink Experiments, and pastes his settings export.
- **Explicit exclusions:** menus opened from a building or a unit on the map (F52, "let's worry about
  that later"); the maximum resources shown on demand (F57, "we will implement that later"); the name
  the player reads for a Pulse (Q68, still open); gate 6B and 6C; the kernel.
- **Stop conditions:** a change that needs the kernel; a reading of his words that the screen shows to
  be wrong (registered as a question rather than guessed); the 80 × 24 floor no longer fitting.

## 2. Environment — pinned, not remembered

| | |
| --- | --- |
| OS and architecture | Linux 6.18, x86_64 (cloud container) |
| Runtime and exact version | Node 22.22.2; Bun 1.3.11 |
| Dependencies and exact versions | TypeScript 7.0.2, `@opentui/core` 0.5.6 (`package.json`, pinned) |
| Hardware, if it affects measurements | not measured here |
| Date measured | 2026-09-30 |

```bash
# install
npm ci
# test
npm run typecheck
npm test
npm run test:bun
./scripts/check-repository.sh
# run
node scripts/playtest.mjs --keys "1" --print final --png none   # a building's card
bun scripts/build-web.mjs                                        # the browser playtest page
```

## 3. What was built

(filled in after the merge)

## 4. Automated results

(filled in after the merge)

## 5. Human observations

Nobody has played it yet. Mario is asked to play it and to flip the focus arrow and cursor blink.

## 6. Interpretation

(filled in after the merge)

## 7. Failures, surprises, and discarded approaches

(filled in as they happen)

## 8. Decision

(pending)

## 9. Canon impact

(pending)

## 10. Next authorized action

(pending)
