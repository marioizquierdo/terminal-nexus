# Gate report — Milestone 5, Gate 5F: layout and keyboard focus

**Document role:** Gate evidence report for Gate 5F
**Status:** COMPLETE — PASS, awaiting the owner's look
**Canon version:** 2.19
**Updated:** 2026-09-26
**License:** Apache-2.0

---

## 1. Frame — written before coding

- **Canon version:** 2.19, unchanged by this gate (Section 9 lists what it proposes).
- **Milestone and gate:** Milestone 5 — Build Phase, gate 5F, defined at the end of gate 5E from the
  owner's own playtest in iTerm2 on macOS (2026-09-26).
- **Question this gate answers:** can the Build Phase be played from the menu on the left with the
  keyboard alone — Tab between the menu and the Grid, arrows and Enter/Space on each, the cursor
  landing where a structure can go — and can the Nexus power pick become something the player opens
  rather than something forced on them, without breaking "the same plan by keyboard, mouse or driver
  is the same state and the same screen"?
- **Smallest artifact that can answer it:** the Build Phase spike (`./bin/terminal-nexus.ts --spike`)
  with the panel moved, focus as reducer state, a smart-cursor rule, and the popup — plus a test file
  of its own and regenerated real-terminal screenshots.
- **Automated evidence planned:** tests for the layout at every supported size, for focus and every
  key it changes, for the smart cursor's rule and its fallbacks, for the popup's keyboard and mouse
  handling and for "may not be skipped" narrowing to the commit; the keyboard/mouse/driver identity
  tests extended to the focus flow; the whole suite on Node and Bun; `tsc`; the validator.
- **Human observation planned:** Mario, in iTerm2: does the menu on the left read first; does Tab,
  Up/Down and Space feel like the flow he sketched; does the cursor land where he would have put the
  building; does the popup feel optional.
- **Explicit exclusions:** Debug Mode and the overlay shape it shares with this popup (gate 5G);
  anything needing a clock — speed tiers, easing, a cursor flash, a timed Escape (gate 5H); real
  Nexus power content (Milestone 8).
- **Stop conditions:** a fork that cannot be built under any recommendation already in the canon.
  None came up; the two forks this gate touched (Q55, Q57) both had recommendations.

## 2. Environment — pinned, not remembered

| | |
| --- | --- |
| OS and architecture | Linux 6.18.44 x86_64 (the cloud session's container) |
| Runtime and exact version | Node 22.22.2; Bun 1.3.11 |
| Dependencies and exact versions | `typescript` 7.0.2, `@types/node` 22.20.1, `@opentui/core` 0.5.6; tmux 3.4 for screenshots |
| Hardware, if it affects measurements | Not applicable — nothing here is a timing measurement |
| Date measured | 2026-09-26 |

```bash
# install
npm install
# build — none; Node runs the TypeScript directly
# test
npm run typecheck
npm test
./scripts/run-tests.sh bun
./scripts/check-repository.sh
# run
./bin/terminal-nexus.ts --spike
node scripts/capture-spike-screenshots.mjs
```

## 3. What was built

In plain terms first: **the menu is on the left, the screen opens with the keyboard on it, and the
whole Build Phase can be played with Up/Down, Space and Tab.** Down, down, Space arms the Hatchery and
puts the cursor one tile east of the Nexus; Space places it and hands the keyboard back to the menu;
Space again arms the next one and moves the cursor on. The Nexus power choice is an entry at the top
of the menu, "[n] Nexus Powers (1)", that opens a box over the map only when asked.

- **Layout** (`src/build/layout.ts`): the side panel's 30 columns moved from the right of the Grid to
  the left. The divider between them now runs only between the two rules, so the top bar and the
  bottom bar each run the whole width. The Grid rectangle's west side is the divider and its east
  side the frame's border; `drawChrome` derived every junction from the new geometry without change.
  The panel reads, top to bottom: the Nexus Powers entry, the budget, the construct groups, the
  Special slot, one line saying what the row in question does, and any key help the bottom bar had
  no room for.
- **A short Grid** keeps a pane of at least 16 rows (when the terminal has them) and closes on its
  own bottom edge inside it — see Section 7 for why this became necessary.
- **Focus** (`src/build/state.ts`): `focus`, `menuHighlight`, `armedFrom`, `overlay` and
  `overlayHighlight` are reducer state, and four commands move them — `focus`, `highlight`,
  `activate`, and `open-nexus-powers`/`close-overlay`. The keyboard adapter maps arrows and
  Enter/Space by focus and nothing else by it: a digit arms from anywhere, `u`, Backspace and `p` do
  what they always did.
- **Esc is one level of cancel**: on the Grid it hands focus to the menu, disarming on the way; on
  the menu it disarms; only a menu with nothing armed leaves the screen. Inside the popup it closes
  the popup, and while the commit question is open it answers "no".
- **Where focus goes after a placement** is Q57's recommendation: back to wherever the arming came
  from — the menu for a menu-driven arm, the Grid for a digit or a click on a row — so the owner's
  flow and the digit-then-arrows fast path both work. The two other answers are one context field
  (`focusAfterPlace`) away, for gate 5G's Debug Mode.
- **The smart cursor** (`smartCursorTile`, Q55): arming from the menu puts the cursor beside the last
  thing planned — or the Grid Nexus, before anything is — one tile apart and aligned with it, trying
  the side facing the map's centre first; failing that, the nearest spot anywhere that leaves a free
  tile around it; failing that, the nearest spot at all; failing that, it stays put. A pure function
  of the plan, so the driver asserts it. Arming by digit never moves the cursor: that player is
  already pointing. `smartCursor: false` turns it off for Debug Mode.
- **The Nexus Powers popup**: `n`, Enter on the entry, or a click on it opens a box centred over the
  Grid, listing the powers waiting to be picked (with their one line of description) and the ones
  already active, and a clickable `[esc] Close`. It holds the keyboard and the mouse until closed.
  Nothing else opens it.
- **"A dealt power may not be skipped" now refuses only the commit.** `lockReason` was split into
  `editLock` (committed, the commit question, an open popup) and `commitLock` (all of those, plus a
  pick still waiting). `armedPreview` reads `editLock`, so no placement ghost is drawn behind the
  popup or the question. The refusal names the key: "Pick a Nexus power first: [n] Nexus Powers."
- **The key help says where focus is**: it opens with `MENU`, `GRID`, `NEXUS POWERS`,
  `START PULSE?` or `COMMITTED` in the title's weight, then that focus's own keys. `p start pulse` is
  now listed on the menu's key help — the commit key had been displayed nowhere since gate 5D.
- **Two marks on a menu row**: `>` means armed; an inverse bar across the whole row means "the
  keyboard is here" — the highlight while the menu has focus, the armed row while the Grid has it
  (which is exactly how the armed row looked before). The whole row width is now its click target.
- **The empty army group** is drawn as one line, "ARMY — none available", the same form as the
  Special row: still drawn rather than skipped, one row shorter.
- **Screenshots** (`scripts/capture-spike-screenshots.mjs`): every shot re-driven for the new flow,
  five new ones, and the capture helper picks a power with `n`, `1`, `n` rather than ever sending Esc
  (Section 7).

## 4. Automated results

| Check | Result | Evidence |
| --- | --- | --- |
| Type check | pass | `npm run typecheck` |
| Node suite | 414 tests, 414 pass, 0 fail | `npm test` |
| Bun suite | 413 pass, 0 fail, every file | `./scripts/run-tests.sh bun` |
| Repository validator | pass, canon 2.19 | `./scripts/check-repository.sh` |
| The panel is on the left at 80x24, 92x28, 104x32 and 128x24; 1 + 30 + 48 + 1 still makes 80 | pass | `tests/build-focus.test.ts`, "the side panel is on the left…" |
| No line crosses the top bar or the bottom bar; the divider starts at the top rule | pass | "the top bar and the bottom bar run the whole width…" |
| A Grid shorter than 16 rows closes under its own last row; the menu stays whole | pass | "a Grid shorter than the panel still closes…"; `tests/build-view.test.ts`, the two small-Grid tests |
| Opens on the menu, on the Nexus Powers entry; Tab toggles; the key help names the focus | pass | "the Build Phase opens with the menu focused…", "Tab moves focus…" |
| Up/Down wrap; Enter/Space activates; a digit arms from either focus without moving the cursor | pass | three tests of those names |
| Esc: Grid → menu (disarming), menu → disarm, then back | pass | "Esc on the Grid hands focus back…"; the updated keyboard test in `tests/build-spike.test.ts` |
| Q57: focus returns to where the arming came from; both other answers selectable | pass | the two "Q57" tests |
| The owner's own flow places two hatcheries at (21,10) and (21,13) with no arrow key | pass | "the owner's own flow — down, down, space, place, space, place…" |
| A menu run of six barracks is aligned, one tile apart, and no two structures touch | pass | "a run from the menu lays out a tidy row…" |
| The smart cursor lands on a legal tile, independent of where the cursor was; falls back; stays put when nothing fits; can be switched off | pass | three smart-cursor tests |
| A waiting pick refuses the commit and nothing else; nothing but the player opens the popup | pass | `tests/build-nexus.test.ts`, the first three tests |
| The popup holds keyboard and mouse; picks by digit, arrows+Enter or click; no ghost behind it | pass | `tests/build-nexus.test.ts`, the popup tests |
| Every bound key is named on screen at 80x24, in both focuses | pass | `tests/build-view.test.ts`, "every key the adapters bind…" |
| The same pick-build-commit plan by keyboard bytes, mouse bytes and driver: identical state **and** frame | pass | `tests/build-nexus.test.ts`, last test |
| The focus flow by keyboard bytes and the same commands by driver: identical state and frame; by mouse: the identical plan | pass | `tests/build-focus.test.ts`, last test |

Screenshots, regenerated through tmux (`evidence/screenshots/`), each looked at: new — `build-idle`
(the opening screen), `build-focus-grid`, `build-smart-cursor`, `build-menu-run`,
`build-nexus-popup`, `build-nexus-popup-picked` (104x32); updated — `spike-minimum` (80x24),
`spike-maximum` (104x32), `spike-wide-tiles` (128x24), `build-grid-edge`, `spike-armed-preview`,
`spike-illegal`, `spike-scrolled`, `spike-crater`, `spike-mouse-place`, `build-just-placed`,
`build-spent-down`, `spike-monochrome`, `spike-resize-gate`, `build-nexus-confirm`,
`build-nexus-committed`. `build-nexus-draft.png` is left in place as gate 5D's evidence of the
retired full-screen draft, the way `spike-scrollbar.png` was kept for gate 5C's.

## 5. Human observations

**Nobody has played this build yet.** What Mario is asked to judge, in iTerm2:

- Does the menu on the left read first, and does the whole-width top and bottom bar look right?
- Does Tab / Up / Down / Space feel like the flow you sketched, and does the key help make it clear
  whether the arrows are moving the menu or the cursor?
- Does the cursor land where you would have put the building? `build-menu-run.png` shows three
  barracks placed with the space bar alone.
- Two defaults this gate chose that you may want the other way — both are one-line changes and both
  are natural Debug Mode fields in gate 5G:
  - the screen **opens with the keyboard on the menu**, on the Nexus Powers entry, so Enter opens the
    choice the commit will eventually insist on. The other option opens on the Grid;
  - **after a pick, the popup stays open** showing it as active, until Esc — the tracker's "holds
    focus until Esc". Closing it on the pick saves a key (Q60).
- Esc on the Grid now always returns focus to the menu, even for someone who armed with a digit.
  That is Q57's recommendation for "what returns focus"; it means a digit player who presses Esc and
  then an arrow moves the menu highlight, not the cursor.

## 6. Interpretation

The gate's question has a yes: the menu-driven flow the owner described works end to end with the
space bar, the digit fast path from gate 5A still works untouched beside it, and the popup made the
"may not be skipped" rule cheaper, not weaker — it now costs the player exactly one refusal, at the
one moment it matters, naming the key that fixes it.

The pieces depended on each other in the order the tracker listed them, and one more way besides:
**the smart cursor is what makes returning focus to the menu tolerable.** Without it, every
menu-driven placement would need arrow keys after the Space, and "back to the menu" would cost a Tab
each time; with it, the menu is where the player's hand already is.

The mechanism that did the most work was keeping focus in the reducer rather than in the keyboard
adapter. It is what let the driver assert focus, the key help read it, a click on the Grid take it,
and — the thing the identity tests needed — let the keyboard's focus flow and a driver's `highlight`/
`activate` script land on byte-identical frames.

## 7. Failures, surprises, and discarded approaches

- **Moving the top bar to the whole width cost the panel two rows**, and on a Grid shorter than the
  panel the menu then ran over the rule and the bottom bar (on an 8x6 test Grid, "[3] Turret" was
  drawn over the position readout). Found by rendering the small-Grid tests' frames as text, not by
  their assertions, which only checked two rows. The panel had been borrowing the top bar's row and
  the rule's row all along. Fixed at the root — the pane between the two rules is never shorter than
  the minimum viewport's 16 rows while the terminal has them, and a short Grid closes on its own
  bottom edge inside it — and the panel is clipped to its own rows as a backstop on a terminal too
  short for even that. A test now asserts the whole menu and the readout on a 20x10 Grid.
- **The highlight bar was three colours.** Drawn from each part's own style role — teal hotkey,
  white label, grey cost — the inverse bar read as three blocks side by side. Found only in the
  screenshots. Inside the bar every part now takes the bar's role; the cost keeps its dimness, which
  in the bar is the one useful signal ("no longer affordable").
- **A screenshot race looked like a bug**: `spike-wide-tiles` came out with the popup still open. The
  capture waited for "1 active", which appears the moment the pick is made, one key before the `n`
  that closes the popup is drawn. The three shots that stop there now wait for the menu's key help.
- **Esc and the next key in one read are one key.** The input splitter (`keysFromChunk`, gate 5E)
  reads `ESC` followed by a printable character as an Option+key sequence — which is how Option+Left
  stopped leaving the screen. Since this gate Esc is used far more (close the popup, return focus), so
  anything that sends input programmatically must not send Esc back to back with another key: Esc
  then Down in one read is the Option+Down fast move, and Esc then `1` is an unbound Meta-1. A person
  typing produces separate reads and is unaffected. The capture script closes the popup with `n`
  instead. The real fix is a short timeout that tells a lone Esc from the start of a sequence, which
  needs the frame timer gate 5H introduces; noted there in the tracker.
- **Two wrong test expectations, both corrected rather than the code**: the smart cursor's nearest
  pocket tile from (1,1) is (8,2), not the pocket's centre — the rule says nearest, and nearest it
  was; and the bars' own text legitimately passes through the divider's column, so "no line crosses
  the bar" is asserted as "no line glyph there", not "a blank".
- **Considered and not built**: an eleventh band for overlays. Bands are fixed (a RULE, `engine.md`
  9.4), and within one band a later write replaces an earlier one, so the popup is drawn last in the
  chrome band and sits on top of everything with no rule change. Gate 5G, extracting the overlay
  shape from two real uses, is the place to revisit that if Debug Mode needs more.
- **Considered and not built**: the smart cursor on a digit arm too. A digit is gate 5A's fast path
  for a player already pointing; moving their cursor would break it.

## 8. Decision

> **PASS** — pending the owner's look.

Every line of gate 5F's definition of done is met and tested; the owner's own keyboard flow is a
test that passes; keyboard, mouse and driver still produce identical state and frames. What stays
open is experiential and Mario's: whether the layout reads left-first, whether the focus flow feels
like his sketch, whether the cursor lands where he would build, and the two defaults in Section 5.

## 9. Canon impact

No canon change in this gate — these stay proposals until Mario accepts it:

| Proposed rule | Would live in | Earned by |
| --- | --- | --- |
| The pane between the two full-width rules is never shorter than the minimum viewport while the terminal has the rows; a shorter Grid closes on its own edge inside it | `engine.md` 3.1 and 3.3 | The small-Grid overflow, Section 7 |
| An empty construct group is one line, its label and "none available", like the Special row | `engine.md` 9.2 | The two rows the panel lost to the whole-width top bar |
| Esc is one level of cancel: popup, then Grid focus (disarming), then disarm, then leave | `engine.md` 9.7, Esc row | Built and tested |
| `>` marks the armed row; an inverse bar marks where the keyboard is | `engine.md` 9.7 | Built; the bar colour finding |
| An overlay is drawn last in the chrome band; no band of its own | `engine.md` 9.4 | Section 7 |
| Q55's smart-cursor rule as built (Section 3) | `open-questions.md` Q55 → answered | Built and tested |

Questions touched, each in `open-questions.md`:

| ID | Question | State after this gate |
| --- | --- | --- |
| Q55 | Smart cursor | Built to its defined rule; awaiting the owner's feel, off-switch ready for Debug Mode |
| Q57 | Where focus goes after a placement | Built to its recommendation (back to where the arming came from); both alternatives one field away |
| Q60 | Does the popup close itself after a pick? | New; recommendation: keep it open until Esc, and offer the other in Debug Mode |

## 10. Next authorized action

Mario's look at this build. After that, gate 5G — Debug Mode — per the tracker; its first fields
are waiting for it here: `focusAfterPlace` (Q57), `smartCursor` (Q55), the popup-after-pick default
(Q60), and which focus the screen opens on.

### Notes for the next session

Written for the agent that picks up 5G, not for Mario:

- **The overlay seam**: `BuildState.overlay` is `"nexus-powers" | null`; the keyboard adapter's
  `overlayCommand`, the mouse adapter's `ui.popup` branch, `editLock`'s overlay line and
  `drawNexusPopup` are the four places an overlay touches. Extract from those four, with Debug Mode
  as the second case — not before.
- **Debug fields already exist as context options**: `BuildContext.smartCursor` and
  `BuildContext.focusAfterPlace`. They are context, not state, today; a live-edited Debug Mode field
  that changes them mid-session needs either the context to become state or the session to swap its
  context — decide that in 5G.
- **Popup geometry** is `nexusPopupLayout(layout, pending, active)` — its height depends on the
  counts, so hit-testing must be given the same counts the composer drew with (`BuildSession`
  computes them from `nexusPowers`).
- **Panel rows** are `NEXUS_ROW`, `RESOURCE_ROW` and `constructBlock` in `layout.ts`; `summaryRows`
  now returns only `special`. `menuEntryAt` makes the whole panel row the click target.
- **Esc and a following key in one read are one key** (Section 7). Anything scripted must separate
  them; 5H's timer is where a lone Esc gets its timeout.
