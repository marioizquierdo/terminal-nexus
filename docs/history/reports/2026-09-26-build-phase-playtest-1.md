# Gate report — Milestone 5, Gate 5E: the owner's playtest, the small and local half

**Document role:** Gate evidence report for Gate 5E
**Status:** COMPLETE — PASS, awaiting the owner's look
**Canon version:** 2.19
**Updated:** 2026-09-26
**License:** Apache-2.0

---

## 1. Frame — written before coding

- **Canon version:** 2.19 (bumped by this gate's own canon changes, all in the same pull request).
- **Milestone and gate:** Milestone 5 — Build Phase, gate 5E, opened 2026-09-26 by Mario's own
  feedback after playing the merged gates 5A-5D in iTerm2 on macOS.
- **Question this gate answers:** which parts of the owner's playtest feedback can be built as
  small, local changes to the screen that exists — and is everything else written down precisely
  enough that the next session builds it from canon rather than from a feedback transcript?
- **Smallest artifact that can answer it:** the Build Phase spike (`./bin/terminal-nexus.ts --spike`)
  with every small item changed in place, tests for each, regenerated real-terminal screenshots, and
  gates 5F-5H written into the milestone tracker with the open forks registered.
- **Automated evidence planned:** a test per behaviour change; the full suite on Node and Bun;
  `tsc`; the repository validator; screenshots through tmux at the sizes that matter.
- **Human observation planned:** Mario, in his own terminal: does the Grid now read as a clear
  rectangle whose edge is where the map ends; is the interface visible in daylight; do the two-click
  placement, Space, and the refusal on the status line feel right.
- **Explicit exclusions:** anything that reshapes the screen (the side panel moving left, keyboard
  focus, the Nexus Powers popup — gate 5F), the Debug Mode panel (5G), and anything that needs a
  clock (speed tiers, easing, a cursor flash — 5H).
- **Stop conditions:** a feedback item that cannot be built without deciding one of the forks the
  owner has not answered — register it instead.

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
node scripts/lib/key-echo.mjs      # what each key actually sends, in the terminal it runs in
```

## 3. What was built

- **The Grid is a closed rectangle of its own** (`src/build/layout.ts`'s `gridBox`, `src/build/camera.ts`'s
  2-row header and 4-row footer): a rule directly above the Grid's first row and directly below its
  last, running the whole width, so the top bar and the bottom bar read as bars. `drawChrome`
  (`src/view/build.ts`) now builds every frame line as a set of joins and derives each cell's glyph —
  straight run, corner, tee, crossing — from which way its lines run, so moving a line moves its
  junctions (the side panel moving left in gate 5F is a layout change, not a redraw).
- **The edge marker is the rectangle's weight**: a side with more Grid is the frame's own line drawn
  dim; a side where the map ends is heavy (`=` / bold `|`; `━` / `┃` in the Unicode pack); every side
  and the rectangle's four corners are heavy when the whole Grid fits. The scrollbar option is gone.
- **Contrast**: the frame lines moved off ANSI "bright black"; the key help, the header subtitle, the
  panel's overflow key help and the Nexus draft's descriptions are no longer dimmed.
- **Placement**: a second click on the same tile places (Q52); Space is Enter; the tile just built
  on shows the plan and absorbs a repeated Enter until the cursor moves — or an undo, a removal, a
  disarm or a re-arm changes what the tile means.
- **One derivation of "what Enter would do"** (`armedPreview` in `src/build/state.ts`): the reducer's
  `place()` acts on it and the view draws it — the ghost, the status line, the panel's effect line —
  replacing three separate recomputations in the view that had disagreed twice before.
- **The status line** (`src/status.ts`, `src/view/status.ts`): a typed message — text, a tone
  (`neutral`, `success`, `warning`, `danger`), and the tile it is about. The last replaces a separate
  `tileScopedAt` field that could drift from the message it described. Tones resolve onto style roles
  in one function.
- **Refusals** moved from the panel to the status line, with their tile: quiet (neutral) while the
  armed preview only sits on the tile, red and bold (danger) once a placement is tried; the preview's
  block of `x` is grey rather than red. The panel keeps the armed row's effect line.
- **Key help** trimmed to arrows move, enter/space place, esc disarm, q quit, shift+arrow fast move,
  bksp remove, u undo.
- **Option+Arrow** (`ESC b`, `ESC f`, `ESC` + arrow) is the fast move, and `keysFromChunk`
  (`src/view/playback.ts`) keeps a meta key whole instead of splitting it into Escape plus a letter.
- **Three small bugs**: the budget read "130 of 100" after a +30 power (now "130 of 130"); the panel's
  overflow key help overwrote the NEXUS and SPECIAL rows on a short Grid; the placeholder draft
  descriptions were cut mid-word at 80 columns.
- **Canon and tracker**: `engine.md` 3.1, 3.3, 9.2 and 9.7 (canon 2.19); `open-questions.md` Q54-Q56
  revised and Q57-Q59 added; the milestone tracker's gates 5F, 5G and 5H defined with their own
  definitions of done; `AGENTS.md`, `project-governance.md` and `DEVELOPMENT.md` brought level.

## 4. Automated results

| Check | Result | Evidence |
| --- | --- | --- |
| Type check | pass | `npm run typecheck` |
| Node suite | 392 tests, 392 pass, 0 fail | `npm test` |
| Bun suite | 391 pass, 0 fail, every file | `./scripts/run-tests.sh bun` |
| Repository validator | pass, canon 2.19 | `./scripts/check-repository.sh` |
| The Grid rectangle is closed on all four sides, with real junctions, in both packs | pass | `tests/build-view.test.ts`, "the Grid pane is a closed rectangle" |
| Sides are soft where there is more Grid, heavy where not; soft is `-`/`|`, not `.`; corners heavy only when the whole Grid fits | pass | `tests/build-view.test.ts`, the `engine-3.3-markers` tests |
| The status line names the refusal and its tile; affordability first, with no tile | pass | "the status line says why a placement would be refused…", "selecting something unaffordable…" |
| Looking is quiet, trying is red; the ghost is grey | pass | "looking at an illegal tile reads quietly, trying to build there reads in red" |
| The commit question owns the status line, and no ghost is drawn behind it | pass | "while the commit question is open…" |
| Undo or remove on the just-placed tile lets it be built on again at once | pass | "undoing the placement just made…" |
| On a short Grid the overflow key help never overwrites NEXUS/SPECIAL | pass | "on a small Grid the panel's bindings never draw over…" |
| The budget counts the picked power in its total | pass | `tests/build-nexus.test.ts`, "the budget on screen counts the picked power's share…" |
| A meta key is one key, never Escape plus a letter; Option+Right moves five without leaving | pass | `tests/playback.test.ts`, `tests/build-spike.test.ts` |
| The same plan by keyboard, mouse and driver is the same state and the same frame | pass | `tests/build-spike.test.ts`, `tests/build-nexus.test.ts` (unchanged tests, still green) |
| Every glyph one cell wide, both packs, three sizes | pass | "every glyph on the frame is one cell wide…" |

Screenshots, regenerated through tmux (`evidence/screenshots/`): `spike-minimum`, `spike-maximum`,
`spike-wide-tiles`, `spike-armed-preview`, `spike-illegal`, `spike-scrolled`, `spike-crater`,
`spike-mouse-place`, `build-just-placed`, `build-spent-down`, `build-idle`, `spike-monochrome`,
`spike-resize-gate`, `build-nexus-draft`, `build-nexus-confirm`, `build-nexus-committed`, and a new
`build-grid-edge` — the cursor at the Grid's north-west corner, the top and left sides heavy, the
bottom and right light. `spike-scrollbar.png` is left in place as gate 5C's evidence of the retired
option.

## 5. Human observations

Mario, 2026-09-26, after running the merged gates 5A-5D in iTerm2, in two messages — quoted where
the wording carries the decision:

- **Contrast**: "During day time, I was not able to tell where the UI is... The general UI should be
  more visible, not so greyed out."
- **The Grid's edge**: "When I go up-left, I notice the cursor ends at what it seems arbitrary, and
  the same in the bottom. The lines separating the in-game-ui... should be a clear rectangle."
- **Placing**: "the default should require a second click"; "should also work with space, that was
  my reflex"; the red `x` right after placing "looks like something failed".
- **Refusals**: "the red color seems a bit too intense, we should try grey instead, and if the user
  tries to click, then flash the cursor"; the refusal "would make more sense... on the low bar where
  it says 'Barracks selected'... just doesn't need to be uppercase".
- **Key help**: "just say arrows move, shift+arrow fast move, leave pgup/home keys out".
- **Status line**: "Let's solidify this UI panel as the action context... should be enums so the
  status reporting stays consistent across the game."
- **Edges**: "let's settle on no scrollbar, but improving the borders of the screen so they are
  softer/lighter when there's more to scroll, and harder when the border has been reached. One idea
  is to use '---' UI, and '===' for the map edge."
- Everything else he raised — the menu on the left, keyboard focus, the Nexus Powers popup, speed
  tiers, a wider margin, recentring, easing, Debug Mode, a map popup — is gates 5F-5H or Q59.

**Nobody has looked at this build yet.** The experiential claims — that the rectangle now reads as
the map's edge, that the interface is visible in daylight, that quiet-then-red reads as intended —
are Mario's to confirm in his own terminal.

## 6. Interpretation

The feedback split cleanly along one line: whether an item changes *what is on the screen where*, or
only *how something already there looks or answers*. Everything in the second group was local — a
style, a key, a message, a guard — and is built. Everything in the first group touches the layout,
the hit-testing, and the drawing order together, and building it piecemeal would have meant moving
the same geometry three times, so it is gate 5F in one piece.

The one item that looked local and was not is the most important finding of the round. "Softer
when there's more to scroll, harder when the border has been reached" reads like a glyph swap on the
border; built that way, the heavy `===` would have been drawn three rows above the Grid's actual top
edge, because two blank header rows sat between them — which was the real reason the cursor seemed
to stop "at an arbitrary place". Closing the Grid into its own rectangle is what makes the weight
mean anything. The 8-row chrome budget absorbed it by moving one row from the header to the footer.

Quiet-while-looking, red-when-trying is a reading of two separate requests ("grey instead" for the
preview, "red colors... when actions are not allowed" for the status line) as one rule: the screen
escalates only when the player acts. It also gives the refused attempt an acknowledgement today —
the tone change — while the cursor flash waits for a frame timer.

## 7. Failures, surprises, and discarded approaches

- **The first version of the heavy edge was drawn on the outer frame**, three rows from the Grid.
  No test caught it: every border test checked the frame's top row, which was exactly where the code
  drew. A screenshot did. `layout.gridBox` now names where the Grid's sides actually are, and a test
  asserts the top rule sits directly on the Grid's first row — the thing that was wrong, rather than
  the thing that was drawn.
- **Gate 5C's dotted soft edge used the ground lattice's own glyph** — `.`, the same dim grey, beside
  a field of the same dots. Retired for the frame's own line, drawn dim, in both packs (the Unicode
  pack's dashed `┄`/`┆` was considered and dropped so the rule is one sentence for both).
- **The live refusal on the status line was drawn over the commit question.** With something armed
  over an illegal tile, pressing `p` showed "Cannot build here" where "Start Nexus Pulse? [y]es /
  [n]o" belonged, and the ghost stayed drawn behind the confirmation and after commit. The fix was to
  have one derivation (`armedPreview`) that is `null` whenever the screen is locked, used by the
  reducer and the view alike.
- **The just-placed tile outlived an undo.** Place, press `u`, press Enter on the same tile: the
  Enter was silently swallowed on an empty tile, because nothing but a cursor move or a re-arm cleared
  the marker. Undo, remove and disarm clear it now.
- **A separate `tileScopedAt` field could disagree with the message it described**: a refusal set it,
  a later "barracks undone" did not clear it, and the next cursor move then erased a message that was
  about the last action, not the tile. The tile now lives on the message itself.
- **Option+Left left the screen.** A Mac sends it as `ESC b`; the input splitter treated `ESC` plus
  anything but `[` or `O` as a lone Escape followed by a letter, and a bare Escape with nothing armed
  is "back". It is bound from the terminals' documentation, not measured on iTerm2 —
  `node scripts/lib/key-echo.mjs` in that terminal settles it.
- **A screenshot had been captioned wrongly since gate 5D.** `build-spent-down` claimed to show an
  unaffordable barracks, but the real spike's first Nexus power adds 30, so two barracks left 50 —
  still enough. It was showing an overlap refusal instead; the old wait text ("CANNOT BUILD HERE")
  matched either. Found only when the wait text became the specific unaffordable sentence and timed
  out. The shot now places a hatchery too, leaving 20.
- **The screenshot script tripped over Q52's known asymmetry itself.** With the header one row
  shorter, its hand-computed click landed inside the scroll margin; the first click scrolled the view,
  the second — same screen cell — was correctly a first click on a new tile, and "planned at" never
  appeared. Moved to a tile well inside the margin. At the ~20% margin the owner asked for, this is a
  fifth of the pane on every side: Q58.
- **"130 of 100"**, the panel's key help overwriting NEXUS/SPECIAL on a short Grid, and a cut-off
  draft description were all found by rendering frames as text and reading them, not by any test.
  Each has a test now.
- **Considered and deferred: moving the side panel left in this round.** It is the single most
  visible item in the feedback, but it changes hit-testing and the header's position along with the
  panel, and gate 5F's focus model changes the same code; one pass beats two. The line-join rewrite of
  `drawChrome` was done now so that pass is smaller.

## 8. Decision

> **PASS** — pending the owner's look.

Every small, local item in the feedback is built, tested on two runtimes, and pictured in a real
terminal; every larger item is a defined gate with its own definition of done, and every fork the
owner has not answered is registered with a recommendation. What stays open is experiential and
Mario's: whether the rectangle and its weights read as the map's edge, whether the interface is now
visible in daylight, and whether bold alone carries ASCII's heavy vertical (Q56).

## 9. Canon impact

Applied in the same pull request at canon 2.19, because each is the owner's own direction rather
than a hypothesis this gate is proposing:

| Rule | Lives in | Earned by |
| --- | --- | --- |
| A second click on the same tile places (Q52, reversing Q50) | `engine.md` 9.7 | Owner, 2026-09-26 |
| The Grid pane is a closed rectangle; its sides' weight is the edge marker (light: more Grid; heavy: the map ends) | `engine.md` 3.3; the 2 + 4 chrome split in 3.1 | Owner's feedback, and this gate's finding that the old frame was three rows from the edge |
| A refused placement is answered on the status line with its tile; quiet while looking, red once tried; the panel carries none | `engine.md` 9.2 (replaces gate 5B's panel RULE) | Owner, 2026-09-26 |
| The status line is a typed message: text, tone, the tile it is about | `engine.md` 9.2 | Owner, 2026-09-26 |
| The side panel moves left; keyboard focus; smart cursor; Nexus Powers popup; Debug Mode; movement feel | `engine.md` 9.2, 9.7, 3.3 as GUIDANCE, each with its gate | Owner, 2026-09-26 |

Questions raised or revised, each in `open-questions.md` with a recommendation:

| ID | Question | Recommendation |
| --- | --- | --- |
| Q54 | The speed tiers' numbers | Build the owner's shape in 5H; every number a Debug Mode field |
| Q55 | Smart cursor and easing | Smart cursor in 5F (the focus flow needs it), easing in 5H |
| Q56 | ASCII's heavy vertical | Built as recommended (bold `\|`); owner to judge |
| Q57 | Where focus goes after a placement, and which key returns it | Back to wherever the arming came from; Esc returns it; Backspace stays "remove" |
| Q58 | May an armed click scroll the view? | No — the confirming click must land on the same tile |
| Q59 | A whole-map `[m]` popup | Its own spike, once a real map outgrows the maximum viewport |

## 10. Next authorized action

Gate 5F — layout and keyboard focus — per the milestone tracker's own definition of done.

### Notes for the next session

Written for the agent that picks up 5F, not for Mario:

- **Moving the panel left** is `buildLayout`'s job: `gridBox`, `dividerColumn`, `origin`,
  `panelColumn`, and the header's column (`drawHeaderAndFooter` still writes the title at
  `offset.column + 2` over the Grid pane). `drawChrome` needs no change — it derives every junction
  from `gridBox` and `dividerColumn`. Mouse hit-testing reads the same layout. Hand-computed click
  bytes in `scripts/capture-spike-screenshots.mjs` (`spike-mouse-place`) will move; the tests derive
  theirs from `cellForTile`/`constructLines` and will not.
- **`armedPreview` is the one answer to "what would Enter do"**: keep `place()` and the view on it,
  and compute the smart cursor from the same `legalityAt`. It returns `null` whenever `lockReason`
  locks the screen — so when the "may not be skipped" refusal narrows to the commit alone, split
  `lockReason` (a lock on editing vs a lock on committing) rather than loosening it, or the preview
  will draw behind the popup and the commit question.
- **Focus is reducer state** beside `armed`, and a command changes it, so the driver can assert it;
  the key help must say where focus is (convention 1 of `engine.md` 9.7). `src/menu/list.ts` has the
  highlight/activate shape to reuse.
- **The popup is the first overlay**: draw it in a band above the Grid, give it the keyboard while
  open, and let Esc close it. Do not extract an overlay framework yet — gate 5G's Debug Mode is the
  second use, and the extraction belongs there.
- **Letters**: `d` (Debug) and `m` (map) are reserved; `p`, `q`, `u` are taken; `y`/`n` answer the
  commit question. The Nexus Powers hotkey is a letter, and the report says why that one.
- **Status line**: add tones or effects to `src/status.ts` and resolve them in `src/view/status.ts`
  only; a message about a tile carries `tile` so it lapses on a cursor move.
