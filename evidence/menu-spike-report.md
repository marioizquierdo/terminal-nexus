# The Build Phase menu spike — report

**Document role:** Gate report for the owner's menu reorganisation (feedback F52-F60)
**Status:** COMPLETE — PASS, awaiting the owner's playtest
**Canon version:** 2.27
**Updated:** 2026-09-30
**License:** Apache-2.0

Copied from [`../specs/templates/gate-report.md`](../specs/templates/gate-report.md). The feedback it
answers is [`../docs/feedback/2026-09-30-menu-spike.md`](../docs/feedback/2026-09-30-menu-spike.md);
the definition of done is in [`../milestones/milestone-06-pulse-phase.md`](../milestones/milestone-06-pulse-phase.md)
under "The menu spike".

---

## 1. Frame — written before coding

- **Canon version:** 2.26 at the start; 2.27 at the end.
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

Everything is in the Build Phase; the kernel and `src/match/` are untouched. Two agents built it in
parallel, split by files, and the second rebased onto the first before handing back.

- **The menu is one list** (F56, F57; `src/build/layout.ts`, `drawPanel` in `src/view/build.ts`):
  `$ 100` on the panel's top line in the cost column, `[e] Explore Map`, a blank line, `[n] Nexus`, a
  blank line, the buildings in catalog order, `[s] Start Pulse` on the last line. The group headings,
  the "none available" lines and the Special row are gone; a row with no room is neither drawn nor
  clickable.
- **The active look is `[x] Name  >>`** (F53; `menuRowSpec` and `drawMenuRow`), for every row whose
  action is under way.
- **A card replaces the menu** (F58; `cardShowing`, `drawCardPanel`, `drawBuildingCard`): Explore
  Map's, and now the armed building's, under its own row drawn active. A click on the panel goes back;
  the panel carries no help text. Arming and opening Explore Map set no status.
- **Left and Right stay on the menu**, and a placement back on the menu flashes its row once (F55;
  `nudge` and `place` in `src/build/state.ts`; the `nudged` field is gone).
- **The focus arrow and the cursor blink** (F54): the reducer records a hand-off with a sequence
  number (`BuildState.handoff`, bumped only when a menu row gives the keyboard to the map); the live
  loop times it (`handoffSchedule`, `handoffAt` in `src/view/build-live.ts`); the view draws the arrow
  (`drawFocusArrow`, glyphs in `src/view/theme.ts`) and the blink (`drawCursor`). Two Experiments,
  first in the list: `focusArrowMs` and `cursorBlinks`.
- **One bottom row** (F59; `src/build/camera.ts`, `src/build/help.ts`): six rows of chrome, the map
  49 × 18 at 80 × 24, the resize gate still measuring against eight (`FLOOR_CHROME_ROWS`), so the floor
  is still 80 × 24. `bottomLine` shows the last command's answer or else `hint`, from one table of
  situations (`HINTS`); `lapseStatus` clears an answer at the next command that says nothing; a `hint`
  tone. The key help, the position readout and the Pulse's key help are deleted.
- **Controls and hotkeys** (F60): a `controls` popup, the game menu's `[c]` row, `?` from the game,
  one table (`controlsPage`), scrolling the export's way; a `?` key on the browser page's key bar.
- **Around it:** the playtest script's step summary prints the bottom line; the capture script's
  expectations follow the new screen and gain five shots (below); canon 2.27.

## 4. Automated results

| Check | Result | Evidence |
| --- | --- | --- |
| `npm run typecheck` (Node and web configs) | clean | run 2026-09-30 |
| `npm test` (Node) | 707 of 707 pass (670 before the spike) | run 2026-09-30 |
| `npm run test:bun` | every file passes | run 2026-09-30 |
| `./scripts/check-repository.sh` | passes, canon 2.27 | run 2026-09-30 |
| The menu walked with Up/Down/Enter alone | passes (`tests/build-focus.test.ts`) | now 3 + catalog entries |
| New: `tests/build-menu.test.ts` | 15 tests: the panel's rows, `$`, no headings, the active look, the card, Left/Right, the one flash, the hand-off | |
| New: `tests/build-handoff.test.ts` | 13 tests: the arrow and blink timeline, reduced motion, stopping, a live `runSpike` with a fake clock, the export round-trip | |
| New: `tests/build-help.test.ts` | 12 tests: one bottom row, 49 × 18, answer then hint, a hint for every situation within 76 columns, the Controls page by `c`, Enter, a click and `?`, back, scrolling | |
| `node scripts/capture-spike-screenshots.mjs` | every shot's expectation met; all pictures regenerated | `evidence/screenshots/` |

New pictures: `build-card.png` (the Barracks' card while placing), `build-menu-hint.png` (the menu
with the Hatchery's hint), `build-controls.png` (the Controls page), `build-focus-arrow.gif` and
`build-focus-arrow-far.gif` (the arrow and the blink, at 20% speed, ASCII and Unicode). Every other
Build Phase picture was regenerated for the new panel and bottom row.

## 5. Human observations

Nobody has played it yet. Mario is asked, on the pull request, to play it, to flip the Focus arrow and
Cursor blink Experiments, to say whether `$ 100` sits where he meant, and to paste his settings export.

## 6. Interpretation

The menu reads shorter and more regular: six kinds of line became three (a row, a blank, the `$`
line), and the panel's only text is what the player chooses from or reads about. The two rows the
bottom bar gave up went to the map, which matters more at 80 × 24 than anywhere. Whether the arrow
helps is exactly the question the Experiment exists for; a still frame cannot answer it, and the
slow-motion GIF only shows that it is legible, not that it is worth having.

The status lapse rule is the one change with reach beyond this screen's looks: an answer now lives for
one key. It is what lets a hint show at all, and it changed the meaning of several older tests (an
action's message no longer survives a cursor move; a refusal left on screen reads quietly after the
next key). A player who wants to reread an answer has to not press anything, which is how most games
behave.

## 7. Failures, surprises, and discarded approaches

- **Two agents, overlapping files.** The split was by files, but both halves had to touch
  `src/view/build.ts` and `src/build/state.ts`. The bottom-bar half finished first and was merged; the
  panel half was asked, while still working, to rebase onto it as its last step and keep both sides.
  That worked: it resolved four conflicts in the view knowing both intents, and added the one thing the
  merge needed (the menu staying unlit behind the Controls page), with a test.
- **The arrow's first trail was a staircase.** Every trail cell took the line's overall slant, so a
  shallow line read `\\\\`. Drawing each cell as the step that reached it (level, upright or diagonal)
  makes it read as a drawn line. Found by rendering frames at fixed progress values, not by a test.
- **The position readout was a test oracle.** Several evidence shots and tests waited for `cursor x,y`
  or `view x`, and three live terminal captures waited for it before taking the picture. They now wait
  for a hint and a still screen, or read the card's tile.
- **Keeping the floor.** Six rows of chrome would have let 80 × 22 play; the resize gate keeps
  measuring against the old eight so 80 × 24 stays the floor and the saved rows go to the map — the
  same arrangement as the shared divider column.
- **A canon bump by search and replace also rewrote two old gate reports' version lines**; they were put
  back. A report records the canon it was written under.
- **One timing test flaked once under load** (the title menu's settings test) while both agents ran;
  it passed alone and in every later full run. Nothing in it was touched.
- **Read, not guessed, and said so**: "top right of the menu" was read as the panel's own top line,
  and the other reading is offered on the pull request; the active look was applied to popup rows too,
  for one pattern.

## 8. Decision

> **PASS**

Every item of F52-F60 is built, tested and in the canon, the 80 × 24 floor holds, the kernel is
untouched, and the one thing only Mario can judge — whether the arrow and blink help — ships behind
two Experiments.

## 9. Canon impact

Applied at canon 2.27, because the owner's words reversed RULEs (the position readout, the empty-group
rule) and a stale RULE misleads the next session:

| Rule | Lives in | Earned by |
| --- | --- | --- |
| Six rows of chrome; the resize gate still measures against eight, so 80 × 24 stays the floor | `engine.md` 3.1, 3.3 | F59 |
| The map's side weight is the only "more map" signal; the position readout retired | `engine.md` 3.3 | F59 |
| The bottom bar is one contextual line: the answer, else a hint from one list; an answer lapses at the next silent command; a `hint` tone | `engine.md` 9.2 | F59 |
| The menu is one list with `$` on top; no headings; no help text in the panel; the empty-group rule retired | `engine.md` 9.2, `commander-armies.md` 2.1 | F56-F58 |
| A card replaces the menu for Explore Map and for placing | `engine.md` 9.2 | F58 |
| The active look is `[x] Name  >>` | `engine.md` 9.2 | F53 |
| Left and Right stay on the menu; `?` and `[c]` open Controls and hotkeys | `engine.md` 9.7 | F55, F60 |
| The focus arrow and the cursor blink | `ascii-effects.md` 5 | F54 |

No new question. Q68 (what the player calls a Pulse) is still open; the spike did not change the words.

## 10. Next authorized action

Wait for Mario's playtest and settings export of this pull request, and settle the Experiments it
answers; gate 6B still waits for his word.
