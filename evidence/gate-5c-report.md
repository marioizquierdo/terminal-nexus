# Gate report — Milestone 5, Gate 5C: scrolling and the adaptive layout

**Document role:** Gate evidence report for Gate 5C
**Status:** BUILT — Section 8 concludes PASS; the two questions only the owner can answer (Section 1) are outstanding
**Canon version:** 2.18
**Updated:** 2026-09-21
**License:** Apache-2.0

---

## 1. Frame — written before coding

- **Canon version:** 2.18
- **Milestone and gate:** Milestone 5 — Build Phase, gate 5C — scrolling and the adaptive layout.
- **Question this gate answers:** does the Build Phase screen hold up at **every** terminal size the
  game supports — not just the two that were screenshotted — and does the furniture that replaces the
  minimap (the edge markers and the position readout) do its job without adding noise?
- **Smallest artifact that can answer it:** the same spike, with three changes. Scrolling and layout
  checked at every viewport size in the supported range rather than at the ends. The edge markers
  measured in **tiles** instead of terminal columns, so their density does not halve when the tile
  width doubles. And one budget shared between the footer and the side panel, so a binding that does
  not fit the footer is shown in the panel instead of disappearing.
- **Automated evidence planned:**
  - every viewport width and height in the 48x16–72x24 clamp, walked: the camera keeps the cursor's
    3-tile margin except where the Grid's own edge legitimately prevents it;
  - the composed frame at both ends of the range, and at the 80x24 floor, with every header, footer
    and panel line asserted whole — no line cut mid-word, nothing drawn over the footer;
  - **every binding the input adapters accept is displayed somewhere on screen at 80x24** — the check
    that catches a key nobody can find;
  - edge markers appear on exactly the sides with more Grid beyond them, at both tile widths, at the
    same density in tiles;
  - real-terminal screenshots regenerated at the sizes the range's ends actually occur at.
- **Human observation planned:** Mario, on the larger manual test he has already said he wants to
  run. Two questions: does scrolling read as *looking around* rather than fighting the cursor, and
  are the edge markers enough to tell him there is more Grid without a minimap? The 3-tile margin is
  still his to judge, and `--scroll-margin` stays on the command line for it.
- **Explicit exclusions:** the Nexus draft slot, the Special slot and the commit key (all 5D); any
  change to the construct menu, the budget or the legality rules (5B's, accepted and settled);
  anything that touches the simulation. No minimap, in any disguise — including an edge marker that
  tries to say *how much* more Grid there is.
- **Stop conditions:** if checking the whole viewport range turns up a scrolling defect that needs
  the camera rule itself changed rather than the code corrected, that is a canon question and the
  gate stops with it registered. If the shared footer/panel budget turns out to need a focus or mode
  concept to work, stop — the input model forbids one, and that would be a design question rather
  than a layout call.

## 2. Environment — pinned, not remembered

| | |
| --- | --- |
| OS and architecture | Linux 6.18.44-fc-v37, x86_64 |
| Runtime and exact version | Node 22.22.2 (primary), Bun 1.3.11 (second runtime) |
| Dependencies and exact versions | TypeScript 7.0.2 for typechecking only; no runtime dependencies. tmux and headless Chromium for the real-terminal screenshots |
| Hardware, if it affects measurements | Container; no frame-time budget is claimed in this gate |
| Date measured | 2026-09-21 |

Commands, copy-pasteable, in the order a stranger would run them:

```bash
# install
npm install

# build - there is none; Node and Bun run the TypeScript directly
npm run typecheck

# test
npm test
npm run test:bun

# run
./bin/terminal-nexus.ts --spike
./bin/terminal-nexus.ts --spike --scroll-margin 5

# real-terminal screenshots
node scripts/capture-spike-screenshots.mjs
```

## 3. What was built

Three changes to a screen that already existed, and no new one.

- **`src/view/build.ts` — one list of bindings, split across two surfaces.** `bindingLines(footerLimit,
  panelLimit)` hands the footer as many bindings as its width holds and packs the rest into
  panel-width rows drawn at the bottom of the side panel. It replaces `controlsLine`, which filled
  the footer and silently dropped whatever was left, and the two bindings that used to be hard-coded
  into the panel. The nine bindings are now listed once, in priority order, and the three jump
  families are separate entries rather than one long compound, because the terminal survey found
  emulators that deliver only one of them.
- **Edge markers, retuned on the screenshots rather than on the source.** Horizontal spacing is
  counted in **tiles** (it stepped terminal columns, so it halved the moment a tile became two
  columns wide). Vertical spacing is gone: every row of the side borders carries its marker, and they
  are drawn at the border's own weight instead of bold.
- **The position readout stopped carrying the scroll margin** unless `--scroll-margin` overrode it.
- **`BuildLayout.footerLimit`**, so the composer and the binding split read one number instead of
  recomputing the same arithmetic in two places.

Everything else in the diff is tests, and a pass over the comments in `src/build/` and `src/view/` to
say what the code does now rather than which gate changed it and why.

## 4. Automated results

| Check | Result | Evidence |
| --- | --- | --- |
| `./scripts/check-repository.sh` | passes at canon 2.18 | run before and after |
| `npm run typecheck` | clean | `tsc --noEmit`, strict with `exactOptionalPropertyTypes` |
| `npm test` (Node 22.22.2) | **351 pass, 0 fail** | four Build Phase test files plus the rest of the suite |
| `npm run test:bun` (Bun 1.3.11) | **350 pass, 0 fail** | one Node-only test does not run under Bun |
| The margin holds at every viewport size in the range | 25 widths x 9 heights, both axes, both directions | `tests/build-camera.test.ts` — the cursor stays on screen, and the margin holds wherever the Grid still has room to scroll |
| Every key the adapters bind is named on screen at 80x24 | 9 of 9 | `tests/build-view.test.ts` — each one checked against `buildKeyboardCommand` and then found on the composed frame |
| Nothing is lost or cut in the footer/panel split | every footer width from 10 to 82, at three panel widths | the two surfaces' bindings, concatenated, equal the whole list exactly |
| A wide terminal needs no panel rows | 160x40 | the footer holds all nine and the panel block is empty |
| Nothing is drawn over anything, across the range | 27 widths x 9 heights | the frame stays the terminal's size, all three footer rows survive, and the refusal block stays on screen |
| Edge-marker spacing is the same in tiles at both tile widths | 80x24 and 160x40 | measured off the composed frame, divided by the tile width |
| The side markers are an unbroken run | every viewport row | both borders, at the minimum size |
| Real-terminal screenshots | 12 regenerated | `evidence/screenshots/`, tmux -> `capture-pane -e` -> headless Chromium |

Measurements:

| Metric | Value | Method | Samples |
| --- | --- | --- | --- |
| Viewport sizes walked for the margin rule | 225 | every integer size from 48x16 to 72x24 | 2 axes x 2 directions each |
| Cursor positions stepped per size | 272 | 96 east, 96 back, 40 south, 40 back | 61,200 total steps |
| Bindings displayed at 80x24 | 9 of 9 | 5 in the footer, 4 in the panel | — |
| Bindings displayed at 160x40 | 9 of 9 | all in the footer | — |

## 5. Human observations

**None yet.** Mario has said he wants to run a larger manual test, and this gate is built for exactly
that: the two questions in Section 1 are his, and the screenshots in `evidence/screenshots/` are the
starting point rather than the answer.

One observation of my own, since it changed the code and a person should be able to disagree with it:
the old edge markers were wrong in a way no test could see. `evidence/screenshots/spike-scrolled.png`
as it stood before this gate showed `> [1] Barracks`, `> ARMY` and `> home end jump 5` — an arrow on
the rule between the Grid and the panel, beside a panel row, reading as a caret pointing at that row.
Three rows looked selected. The frame's *text* was correct and every assertion about it passed.

## 6. Interpretation

**The screen's adaptation to its own size turned out to be one rule, not a layout.** The obvious
reading of "the side panel's layout across the viewport's minimum-to-maximum span" is that the panel
should rearrange itself as the terminal grows. It should not: the panel is 30 columns at every size
the game supports, because that is what the composition arithmetic fixes, and a panel that reflows is
a panel whose hotkeys move. What genuinely varies with width is **how much the footer can hold**, and
once the footer and the panel share one list, the whole adaptation is that sentence. At 80 columns
four bindings live in the panel; at 160 none do and those rows are simply blank.

That also fixed a real defect rather than only tidying one. Before this gate, `home end jump 5` was
displayed **nowhere** at the acceptance size: the footer cut it off and the panel did not know about
it. The modifier-free jump is required precisely because several terminals send no shifted arrow at
all — so on exactly those terminals, the only fast pan a player had was the one the screen never
mentioned. The test that catches it is the one worth keeping: every key the adapter binds, looked up
on the composed frame at 80x24.

**The scrolling rule itself needed no change.** Walking all 225 viewport sizes on both axes found
nothing — which is a result, not a non-result: the rule was written years before anything executed
it, and the one thing gate 5A had to add to make it implementable (the margin is a follow rule, not
an invariant) holds at every size, not just the two that were screenshotted.

**Edge markers are a picture problem.** The two changes here were both found by looking at a PNG and
neither was visible in a frame dump. A marker step counted in columns is invisible in text because
the text is right — the markers are there, they are just half as dense on a wide terminal. A caret
that looks like a selection is invisible in text because the glyph is correct and only its
*neighbour* makes it wrong.

## 7. Failures, surprises, and discarded approaches

- **Two failed attempts at the side markers, both kept until a screenshot rejected them.** The first
  was the one already in the code: a marker every two rows, at bold weight. On screen it reads as
  three or four carets pointing into the panel. The second was every row, still bold: unmistakably an
  edge now, but loud enough to compete with the construct menu it sits beside. The third — every row,
  at the border's own weight — reads as what it is, a border made of arrows. The lesson is the one
  gate 3A already wrote down and this gate confirmed at a cost of two attempts: for anything on the
  frame border, the text dump cannot referee.
- **The frame-time budget test is load-sensitive and failed twice during this gate**, both times
  while the screenshot pipeline was driving tmux and headless Chromium in the same container. Three
  consecutive clean runs afterwards, with no code change in between. It measures wall-clock time
  against a fixed budget, so this is the test doing its job badly rather than a regression; recorded
  rather than fixed, because the fix is a decision about how a budget test should behave under load
  and nothing in this gate's scope earns it.
- **A test asserted a west edge marker that legitimately was not there.** The cursor was moved 20
  tiles east on a 96-tile Grid in a 48-tile viewport, which leaves the camera at zero — there is no
  more Grid to the west, so there is correctly no marker. The test was wrong, not the code, and the
  fix was to move the cursor far enough in that all four sides have Grid beyond them.
- **Not done, deliberately: nothing was added to fill the panel's blank middle.** At 104x32 and up
  there are a dozen blank panel rows with nothing in them. Filling them would be the demo text the
  last gate removed, wearing a layout argument as a disguise.

## 8. Decision

> **PASS**

Every automated claim in Section 4 holds, the scrolling rule is now checked across its whole
supported range rather than at the two sizes somebody screenshotted, and the gate turned up and fixed
a binding that was reachable but displayed nowhere at the acceptance size. The two things left are
Mario's to judge and cannot be automated: whether scrolling reads as looking around, and whether the
edge markers say "there is more Grid" clearly enough without a minimap.

## 9. Canon impact

Proposed changes, each with the document that would own it. **Nothing here is applied until Mario
accepts the gate.**

| Proposed rule | Would live in | Earned by |
| --- | --- | --- |
| **The footer and the side panel share one list of bindings**: the footer takes what its width holds, the panel shows the remainder. A binding is never dropped, only moved | `engine.md` 9.7, beside "the footer already shows the most important ones" | At 80 columns the footer cannot hold them all, and before this gate the ones it could not hold were displayed nowhere |
| **Edge-marker spacing is counted in tiles, not terminal columns**, and the side markers run unbroken | `engine.md` 3.3, which requires the markers but says nothing about their density | A step in columns halves at two columns per tile; a broken run beside the side panel reads as a caret pointing at a panel row |
| **The side panel is 30 columns at every supported size**; what adapts with width is what the footer holds, not the panel's layout | `engine.md` 9.2 | Built. A panel that reflows moves hotkeys, which 9.7 forbids, and the composition arithmetic fixes the width anyway |

Questions raised, each already added to [`../specs/open-questions.md`](../specs/open-questions.md) with a
recommendation:

| ID | Question | Recommendation |
| --- | --- | --- |
| — | None | — |

## 10. Next authorized action

Gate 5D — the Nexus upgrade slot against a placeholder option, `p` and its one confirmation, the
hotkey-versus-click identical-plan test, and the Special slot's own space in the layout. Not before
Mario has looked at this one, and no other gate in the meantime.
