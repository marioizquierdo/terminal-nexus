# The Build Phase menu spike — report

**Document role:** Gate report for the owner's menu reorganisation (feedback F52-F60, and his second round F61-F76)
**Status:** COMPLETE — PASS, round 2 built, awaiting the owner's playtest
**Canon version:** 2.28
**Updated:** 2026-09-30
**License:** Apache-2.0

Copied from [`../specs/templates/gate-report.md`](../specs/templates/gate-report.md). The feedback it
answers is [`../docs/feedback/2026-09-30-menu-spike.md`](../docs/feedback/2026-09-30-menu-spike.md);
the definition of done is in [`../milestones/milestone-06-pulse-phase.md`](../milestones/milestone-06-pulse-phase.md)
under "The menu spike". Sections 1-10 are round 1, left as they were written; **the owner's second
round** ([`../docs/feedback/2026-09-30-menu-spike-round-2.md`](../docs/feedback/2026-09-30-menu-spike-round-2.md),
F61-F76 and his settings export) has its own report at the end, in the same order.

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

---

# Round 2 — the owner's play of the spike (F61-F76), 2026-09-30

## R1. Frame

- **Canon version:** 2.27 at the start; 2.28 at the end.
- **Question:** does the menu read as calmer and more deliberate when a refused key only greys the
  words, an active row is one colour and one `>`, a building holds the keyboard until it is placed or
  cancelled, the chosen row travels up to become its card, Explore Map sends a see-through cursor
  instead of the building's arrow, `x` never opens the game menu, and every list stops at its ends? And
  are his exported numbers right as the defaults, with only the questions still being felt left as
  Experiments?
- **Smallest artifact:** the same screen and branch, changed in place; one new style field for the
  see-through cursor, carried by every renderer; one table of tuned values.
- **Automated evidence planned:** tests for each item (the grey flicker keeping the bar, the panel's
  order and credits line, the header's own hotkey cancelling, the lock and its message, `x` stopping at
  the menu, right click as `x`, lists stopping and jumping and ramping, the see-through mix at every
  colour depth, the card reveal's beats and its reduced-motion snap, the arrow leaving from the row),
  the export round-trip with five Experiments, typecheck, Node and Bun, the validator, the pictures.
- **Human observation planned:** Mario plays it and flips the Focus arrow and Card reveal Experiments.
- **Exclusions:** gate 6B and 6C; the kernel; menus opened from the map (still F52's "later").
- **Stop conditions:** as round 1; and a see-through style that needs a literal colour in the frame
  (it must stay colour roles).

## R3. What was built

Four agents in parallel, split by files (the renderers; the reducer and adapters; the view and live
loop; the interface rules document), then a fifth that settled the Experiments once the others were
merged; the canon was written beside them.

- **A refused key greys the row's words and keeps the bar** (F61; `drawMenuRow` in
  `src/view/build.ts`): the words take the bar's background role under inverse, so they read as grey on
  the bar; `chrome.edge` at 16 colours; dim in monochrome.
- **The active row is the hotkey colour and one `>`, no underline, and a card's header keeps the row's
  own hotkey** (F67, F70; `menuRowSpec`, `ACTIVE_VALUE`); the row's own key cancels (`armItem` in
  `src/build/state.ts`), and the placing hint says so.
- **The panel's order** (F71, F72; `src/build/layout.ts`): Explore Map, Nexus, the credits line
  (`RESOURCE_ROW`, the amount right-aligned after the map's deposit glyph, `drawCredits`), the
  buildings, Start Pulse. No credits on a card.
- **The focus arrow leaves from the row's own place** (F63; `handoffOrigin`), and **the card reveal**
  (F68; `drawCard`'s transition, `CARD_BEATS`, `cardKey` and `cardRevealAt` in
  `src/view/build-live.ts`): the other rows fade, the row slides up, the card fades in with its text
  typed and the building's placement frames on its icon. The Card reveal Experiment (150 ms default).
- **The see-through cursor** (F64, F65): a new `overlay: {role, alpha}` on a cell's style
  (`src/view/frame.ts`, `src/view/roles.ts` — `mixOverlay`, `overlayColours`), drawn by the ANSI
  writer, the canvas backend and OpenTUI, exact at truecolor, nearest at 256, the plain cursor at 16
  colours and in monochrome from half opacity. `drawGhostCursor` sends it with a three-cell trail.
- **Explore Map finds clear ground** (F66; `openExplore`, `armingSpot` with a one-tile footprint), only
  when opened from the menu.
- **The lock** (F69; `refuseWhileArmed`): another building's digit, `e`, `s` and `p` are refused while
  one is armed, the header greying and the bottom line naming the way out.
- **Back and cancel** (F62, F73; the `cancel` and `back` commands in `src/build/keyboard.ts`,
  `mouse.ts`): Esc is `cancel`, `x` and a right click are `back`, which does nothing on the menu or once
  the plan is committed; the game menu and the export lose their `[esc] Back` rows.
- **Lists** (F75; `src/menu/list-keys.ts`): one step function for every list, stopping at the ends,
  `jump` for Shift, PageUp/PageDown and Home/End; the Build Phase's lists take the map cursor's ramp
  through `src/build/motion.ts`.
- **The settings export as defaults** (F76; `src/build/tuning.ts`, `src/build/experiments.ts`): every value
  in his export is the default. Twenty-two settled numbers live in one table of tuned values, each
  saying who chose it and when (two more, where arming looks for a spot and how much a step up or down
  costs, joined it in the review below); seven settled choices became simply how the code works (clicks
  scroll at the edges armed or not, a jump drags the view rather than re-centring it, a placement lights
  with a plain flash and a few sparks, the ending centres on the Nexus and blushes red when it is hurt);
  five Experiments remain — the focus arrow, the card reveal, the hold window, and the placeholder
  Pulse's raid and crew. An old export's settled names are skipped quietly.
- **The interface rules rewritten** (F74; `docs/ui-patterns.md`), pointed to from `AGENTS.md` and
  `CLAUDE.md`.

## R4. Automated results

@@RESULTS@@

## R5. Human observations

Nobody has played round 2 yet. Mario is asked on the pull request to play it and to flip the Focus
arrow and Card reveal Experiments.

## R6. Interpretation

The round's common thread is **calm**: a refused key that no longer looks like a press, one `>` instead
of two, no underline, a building that cannot be swapped under the player's hand, `x` that can be
pressed without fear. Each of those removes something the eye had to check. The two new motions go the
other way — they add something to watch — and both carry the eye to where the keyboard went, which is
the one thing motion earns its place for in this interface.

Settling the Experiments changed what Settings is for: from 28 dials to five open questions. The
numbers did not disappear; they moved to one table in the code where each says who chose it and when,
which is where the next person tuning a feel will look.

## R7. Failures, surprises, and discarded approaches

- **The see-through mix had to be a style, not a colour.** Working it out in the view would have put
  literal colours in the frame, which the frame forbids (cells carry roles). It became a field the
  renderer resolves against its own palette, which is also why 16 colours and monochrome can fall back
  to the plain cursor rather than to a wrong colour.
- **The evidence pictures dimmed whole cells**, background and all, where a terminal only dims the
  glyph; the grey flicker looked like a hole in the bar. The capture script now mixes only the text
  colour (`scripts/lib/terminal-capture.mjs`).
- **Opening Explore Map from the map moved the cursor away from what the player had just pointed at.**
  The clear-ground rule is for arriving from the menu; from the map it stays put. Found by the docs
  agent writing the rule down, not by a test.
- **`x` on a committed plan** would have walked back into a state that no longer exists; it now does
  nothing there, like on the menu.
- **OpenTUI ignores a role background on an ordinary cell**, so the grey words on the bar do not show
  under Bun's OpenTUI renderer. The other three renderers show it; recorded in `docs/next-steps.md`.
- **Removing Experiments shifted every `Down*N` in the capture flows and tests again** @@DOWN@@

## R8. The general review (the owner's request, 2026-09-30)

Mario asked, before playing round 2, for "a general review ... opportunities to simplify and to make the
code more expressive and related with the actual functionality it implements, more in line with the
concepts and vocabulary we use in the design docs". Four read-only reviewers read the pull request
against `main` by area (the reducer and input, the view and live loop, the renderers and Experiments,
the tests) and returned about seventy-five findings; three were real bugs.

- **Names, as the design says them** (done by hand first, so every agent after built on them): the
  open popup was `overlay` in the code while the rules say popup everywhere — now `popup`
  (`src/build/popup.ts`); round 2 had also given "overlay" to the see-through cursor's cell style, now
  `seeThrough`; the Experiments were still `debug` from Debug Mode — now `src/build/experiments.ts`,
  `Experiments`, `BuildState.experiments`, `experiment-adjust`; the game menu's popup is `game-menu`, the
  start question is the `battle-round` popup opened by `open-battle-round` and answered by
  `start-pulse`; `returnTo` (where finishing goes back to), `noSpotFound`, `jump`, `CREDITS_ROW`,
  `panelLastRow`, `refuse-row`, `RowAck`, `refusedTry`, `handoffFlight`.
- **Bugs fixed**: a double click on the armed building's own tile placed and then undid the return to
  the menu; a click outside a popup that sat over a card dropped the building and moved the highlight to
  a hidden row; under OpenTUI a refused row's grey words never showed (it ignored a role background).
  Also: `--settings "focusArrowMs=ms"` set the arrow to 0; a driver could pick a Nexus power with
  Settings open; the row sliding up in the card reveal was drawn pressed rather than active.
- **Simpler shapes**: every popup's keys come from the same rows its clicks read; Settings counts its
  rows in the order they are shown, like every other list, with one `select-row` command; the popup
  stack keeps each level's return row; one table of arrow-key bytes serves the map and every list; one
  `mapMode` says where the keyboard is; one `resolveCell` is where a cell's style becomes what each of
  the three renderers draws; the view is split by concept (`build-frame`, `build-grid`, `build-menu`,
  `build-card`, `build-handoff`, `build-popup`); the live frame is the composition input plus one number;
  the scripts read settings and palette from `src` rather than keeping copies.
- **The tests** reorganised by concept: @@TESTS@@
- **Kept on purpose**: the restart machinery for Experiments (no Experiment needs a restart today, but
  the next one that does would have to rebuild it; it is small and tested); the stored mode fields as
  they are (one `mapMode` derives the four places; folding them into one union was judged too risky for
  the gain); the menu rows' labels in the view rather than in the menu entries (it crosses two layers for
  little).

Every step was checked the same way: the type check for Node and the browser page, the Node and Bun
test runs, the repository check, and scripted playtests of the flows each change touched; the view's
split was checked frame by frame against the code before it (tens of thousands of frames, the only
differences being the card reveal fix).

## R9. Decision

> **PASS**

Every item of F61-F76 is built, tested and in the canon; the 80 × 24 floor holds; the kernel is
untouched; the two looks only Mario can judge ship behind Experiments.

## R10. Canon impact

Applied at canon 2.28:

| Rule | Lives in | Earned by |
| --- | --- | --- |
| A cell style may carry a see-through overlay (a role and an alpha); the mix and its fallbacks | `engine.md` 9.1 | F64, F65 |
| The scroll margin is 30%; the hold window 350 ms, fast after 200 ms; a Shift jump is 10 tiles every 100 ms and does not re-centre; the Esc wait 50 ms | `engine.md` 3.3 | F76 |
| Every list stops at its ends and jumps with Shift, PageUp/PageDown, Home/End | `engine.md` 3.3, 9.7 | F75 |
| The panel order and the credits line; the active row as the hotkey colour and one `>`; a refused row greys its words | `engine.md` 9.2 | F61, F67, F71, F72 |
| A building being placed holds the keyboard; its own key cancels | `engine.md` 9.2, 9.7 | F69, F70 |
| Esc is cancel and opens the game menu; `x` and a right click are back and never open it; no `[esc]` rows | `engine.md` 9.7 | F62, F73 |
| The see-through cursor and the card reveal | `ascii-effects.md` 5 | F64, F68 |

No new question.

## R11. Next authorized action

Wait for Mario's playtest of round 2 and his settings export; settle the two looks' Experiments from
it. Gate 6B still waits for his word.
