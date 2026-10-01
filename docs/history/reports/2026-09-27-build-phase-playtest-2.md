# Gate report — Milestone 5, Gate 5F round 2: the owner's playtest of 5F

---

## 1. Frame — written before coding

- **Canon version:** 2.19, unchanged; the design-document edits this feedback owes are listed for the
  orchestrator (`docs/history/feedback/2026-09-27-build-phase-playtest.md`, "Design documents owed an update").
- **Milestone and gate:** Milestone 5 — Build Phase, gate 5F, second round, opened by Mario's playtest
  of the merged gate 5F (2026-09-27) — the same shape as gate 5C's second round.
- **Question this round answers:** can the Build Phase's keyboard and mouse follow one small set of
  consistent patterns — one "you are here", one "back", a menu that orchestrates, popups that cannot be
  missed — as the owner described them, and can those patterns be written down so the next screens
  follow them too?
- **Smallest artifact:** the Build Phase spike with the focus model reworked, one popup shape for
  every question, an information panel, and `docs/system-design/ui-patterns.md`; each feedback item logged with what
  happened to it.
- **Automated evidence planned:** tests for every changed behaviour; the full suite on Node and Bun;
  `tsc`; the validator; screenshots regenerated in-process (gate 5F's tooling) and looked at.
- **Human observation planned:** Mario, in iTerm2 — see Section 5.
- **Explicit exclusions:** placement animation, particles and colour interpolation (a new gate after
  5H; they need its frame timer); proportional click-scrolling (5H); the larger ASCII art in the
  information panel (content not authored); the browser/iPhone rendering layer (researched separately,
  waiting on his decisions).
- **Stop conditions:** none reached.

## 2. Environment — pinned, not remembered

| | |
| --- | --- |
| OS and architecture | Linux 6.18.44 x86_64 (the cloud session's container) |
| Runtime and exact version | Node 22.22.2; Bun 1.3.11 |
| Dependencies and exact versions | `typescript` 7.0.2, `@types/node` 22.20.1, `@opentui/core` 0.5.6, `gifenc` 1.0.3, `pngjs` 7.0.0 |
| Date measured | 2026-09-27 |

```bash
npm install
npm run typecheck
npm test
./scripts/run-tests.sh bun
./scripts/check-repository.sh
./bin/terminal-nexus.ts --spike
node scripts/capture-spike-screenshots.mjs
node scripts/playtest.mjs --keys "Down*3 Space*4" --gif
```

## 3. What was built

In plain terms: **the screen is always in one of three plain modes, and every way of saying "back"
does the same thing.** The menu has the keyboard (no map cursor); a building is being placed (its row
marked, its ghost on the cursor); or you are exploring the map (no row marked, the bare cursor).
Placing always hands the keyboard back to the menu.

- **Focus** (`src/build/state.ts`): a building is armed only while the map has focus; every way off
  the map disarms. Placing returns to the menu, on the same row (Q57 answered: always the menu).
  `[e] Explore`, Tab, a click on the map, or Right twice on the menu (the first one flickers) go to
  the map exploring.
- **One cancel** (`cancel` command): Esc, `x` and right click. It closes a popup, then the information
  panel, then leaves the map for the menu, then asks "Exit the game?". `q` asks the same question; its
  own `[q]` quits; Ctrl+C quits at once. "q quit" is gone from the key help.
- **Clicks are semantic** (`click-menu`, `click-tile`): the reducer decides from what is on screen. A
  first click on the menu from elsewhere highlights; a click with the menu focused activates. A click
  outside a popup closes it and moves focus there, and does nothing else.
- **One popup shape** (`src/build/overlay.ts`, new): each popup is data — a title and rows, options
  naming their command — placed once and read by both the drawing and the mouse. Three uses: the Nexus
  powers, the start-the-Pulse question (was a panel), and the exit question (new). Drawn with a solid
  border, the title and `[esc]` in the top border, and a shadow. This is the extraction gate 5G was
  going to do; three real uses made it due now.
- **Row states** (`src/view/build.ts`): plain, selected, pressed (bold, underlined, hotkey colour),
  refused (dimmed flicker), plus disabled and `>` armed. An unaffordable row can no longer be armed:
  it flickers and the status line gives the cost.
- **Flash timing** (`src/cli/spike.ts`): the reducer records an acknowledgement with a sequence number;
  the live loop shows it for 90 ms (pressed) or 140 ms (refused) and redraws. The reducer still has no
  clock.
- **Information panel**: exploring, Enter/Space or a click on a building replaces the menu with the
  building's glyphs, name, one wrapped line of what it is for, and health, size, cost and attack.
  Bare ground says what it is.
- **The map edge** is a solid bar on every side that has reached the map's edge, corners included
  (Q56 answered).
- **Placement**: buildings drawn at full strength; the status line reads
  `Hatchery placed (resources: 70) - [u] undo`.
- **Menu**: `[n] Nexus` (renamed) and `[e] Explore` at the top.
- **Removed**: the "just-placed tile absorbs a repeated Enter" rule — a placement now disarms, so it
  could never trigger; the `back` command and `onBack` (only the exit question leaves);
  `focusAfterPlace`/`armedFrom` (Q57 is answered).
- **Docs**: `docs/system-design/ui-patterns.md` (new) — the patterns as rules for the next screens;
  `docs/history/feedback/2026-09-27-build-phase-playtest.md` (new) — each item and what happened to it.

## 4. Automated results

| Check | Result | Evidence |
| --- | --- | --- |
| Type check | pass | `npm run typecheck` |
| Node suite | 427 tests, 427 pass | `npm test` |
| Bun suite | all files pass | `./scripts/run-tests.sh bun` |
| Repository validator | pass | `./scripts/check-repository.sh` |
| Three modes: menu (no cursor), placing (row + ghost), exploring (bare cursor) | pass | `tests/build-focus.test.ts` |
| Esc/x/right-click one cancel; the stack ends in the exit question; q asks, its q quits | pass | `tests/build-focus.test.ts`, `tests/build-spike.test.ts`, `tests/build-lifecycle.test.ts` |
| Right twice goes to the map; anything between resets it | pass | `tests/build-focus.test.ts` |
| Row states drawn as described, at monochrome | pass | "a menu row is drawn in four states" |
| Every activation asks for a pressed flash (Enter, hotkey, click) | pass | "every activation asks for a pressed flash" |
| First click highlights, second activates; a click outside a popup dismisses and focuses | pass | `tests/build-focus.test.ts`, `tests/build-nexus.test.ts` |
| Information panel: name, stats, wrapped description, bare ground | pass | two tests in `tests/build-focus.test.ts` |
| Solid map edge on all four sides and corners; a whole small map solid all round | pass | `tests/build-view.test.ts` |
| Placement returns to the menu, disarmed, with the new status line | pass | three tests |
| An unaffordable row cannot be armed, flickers, names the cost | pass | `tests/build-view.test.ts` |
| Same plan by keyboard, mouse and driver: identical state and frames | pass | `tests/build-spike.test.ts`, `tests/build-nexus.test.ts`, `tests/build-focus.test.ts` |
| The playtest tool's own flow test, updated for the Explore row | pass | `tests/playtest.test.ts` |

Screenshots (`docs/screenshots/`), each looked at: new `build-info-panel`, `build-exit-question`;
updated `build-hatchery-run.gif`, `build-idle`, `spike-minimum`, `build-focus-grid`,
`build-smart-cursor`, `build-menu-run`, `build-nexus-popup`, `build-nexus-popup-picked`,
`build-grid-edge`, `spike-maximum`, `spike-wide-tiles`, `spike-armed-preview`, `spike-illegal`,
`spike-crater`, `build-just-placed`, `build-spent-down`, `build-nexus-confirm`,
`build-nexus-committed`, `spike-scrolled`, `spike-mouse-place`, `spike-monochrome`.

## 5. Human observations

Nobody has played this round yet. For Mario:

- Do the three modes read at a glance, and does "placing always returns to the menu" feel right with
  the digit path too (digit, arrows, Enter — per building now)?
- The solid map edge: `build-grid-edge.png`. And the one thing that looks off to me: when the view
  is at the map's west edge, the solid bar sits right against the menu, so it reads as a thick panel
  border (F17).
- The pressed and refused flashes only exist live — try Right on the menu, and `1` with no money
  left.
- The information panel is a first version; it wants the larger art you described.

## 6. Interpretation

Most of the feedback was one idea stated many ways: **fewer, clearer modes**. Once "armed only while
the map has focus" and "one cancel" were in the reducer, several separate asks fell out of them —
the cursor showing only on the map, the menu never marked while exploring, Esc walking a stack, the
Grid never keeping a stale ghost. Several older mechanisms had existed only to paper over the old
ambiguity (the just-placed-tile rule, `back`, where-focus-goes options) and could be deleted.

Making clicks semantic commands, rather than having the mouse adapter decide, is what kept keyboard,
mouse and driver identical through all of it: every "what does this click mean here" answer now lives
in the reducer beside the keyboard's.

## 7. Failures, surprises, and discarded approaches

- **The smart cursor beat the test.** A mouse test clicked a tile twice to place a second barracks;
  the smart cursor had already put the cursor on exactly that tile, so the first click placed and the
  second opened the information panel. Kept as an assertion: arming from the menu predicted the tile.
- **The information panel cut its own description mid-sentence** ("Lose it, lose the") — found only
  in the screenshot. Word-wrapping added; the rule is now in `docs/system-design/ui-patterns.md`.
- **Opening the Nexus popup could replace the start-the-Pulse question** — the old code cleared any
  open overlay first. Caught by the modal test, fixed by letting the popup rules alone decide.
- **Every test that assumed "stays armed after placing" broke** (about 35), as expected: that was the
  behaviour the owner reversed. Each was rewritten to the new rule rather than deleted, except those
  whose premise can no longer happen (an armed item becoming unaffordable), which were replaced by
  the test of the new refusal.
- **Considered and not done: a separate eleventh band for popups** — still unnecessary (a later
  write in the chrome band wins).
- **Considered and not done: the flash in the reducer.** Timing in the reducer would break "no clock";
  a sequence-numbered acknowledgement keeps it pure.

## 8. Decision

> **PASS** — pending the owner's look.

## 9. Canon impact

Q56 and Q57 are answered in the register (owner direction). The design-document edits this owes are
listed in `docs/history/feedback/2026-09-27-build-phase-playtest.md` for the orchestrator. No canon version
change.

## 10. Next authorized action

Mario's look, and his decisions on the browser playtest proposal; then the orchestrator's pass over
the feedback log; then gate 5G (Debug Mode). With the overlay shape already extracted here, 5G is
smaller: a fourth popup and its fields (Q55's smart cursor, Q60, the flash durations).
