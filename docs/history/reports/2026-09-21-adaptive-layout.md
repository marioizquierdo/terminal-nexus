# Gate report — Milestone 5, Gate 5C: scrolling and the adaptive layout

**Document role:** Gate evidence report for Gate 5C
**Status:** BUILT — Section 8 concludes PASS; four questions only the owner can answer (Sections 1 and 5) are outstanding, the last two added by a second round acting on his own live feedback
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

### Round 2 — owner feedback on the merged screen

Mario reviewed the merged screen and, rather than accepting or rejecting it outright, brought a set
of concrete ideas about the two required-but-undesigned signals (the edge markers and the armed-item
marker). None of it touches a canon RULE, so it was built directly rather than registered as a
question first:

- **The arrow-run edge markers are gone.** A border segment beside the Grid pane is now solid where a
  side truly ends and a dim dashed line where there is more to scroll — `drawChrome` chooses the
  glyph per segment instead of overlaying discrete `^`/`v`/`<`/`>` characters on top of a plain
  border. This also removes a defect a subagent review caught: the old unbroken east run was drawing
  a `>` beside *every* panel row, which read as a bullet in front of "ARMY" and "none for this
  Commander" alike.
- **The armed construct row carries an explicit `> ` marker**, alongside the inverse-video bar it
  already had — unambiguous now that the border no longer prints one of its own next to it.
- **A second, switchable option**: `--edge-style scrollbar` turns the bottom and west borders into a
  proportional thumb (`scrollThumb` in `camera.ts`), showing roughly *where* the visible slice sits
  rather than only that there is more of it — Mario's own suggestion, tried as a real alternative
  rather than argued about. North and east stay a plain yes/no in both modes: a **partial** thumb
  right beside the side panel would reintroduce the exact caret-like confusion the plain run was
  built to avoid, so the richer treatment only goes where nothing sits beside it.
- **Three bugs found while building the above** (Section 7 has the detail): a selected-but-unaffordable
  row's cost was styled dim and bold at once, cancelling out; the cursor was nearly invisible on bare
  ground because inverting an already-dim glyph is still a dim one; and a refusal's footer message
  survived after the cursor moved off the tile it was about.
- **Deferred, not built**: a transient pointer toward an off-screen objective (there is no second
  player or enemy Nexus in this spike to point at yet — registered nowhere, since it needs game state
  a later milestone will add, not a decision), and a real accent-colour palette (Q51, recommending it
  wait for a second faction to design against).

## 4. Automated results

| Check | Result | Evidence |
| --- | --- | --- |
| `./scripts/check-repository.sh` | passes at canon 2.18 | run before and after |
| `npm run typecheck` | clean | `tsc --noEmit`, strict with `exactOptionalPropertyTypes` |
| `npm test` (Node 22.22.2) | **364 pass, 0 fail** | four Build Phase test files plus the rest of the suite |
| `npm run test:bun` (Bun 1.3.11) | **363 pass, 0 fail** | one Node-only test does not run under Bun |
| The margin holds at every viewport size in the range | 25 widths x 9 heights, both axes, both directions | `tests/build-camera.test.ts` — the cursor stays on screen, and the margin holds wherever the Grid still has room to scroll |
| Every key the adapters bind is named on screen at 80x24 | 9 of 9 | `tests/build-view.test.ts` — each one checked against `buildKeyboardCommand` and then found on the composed frame |
| Nothing is lost or cut in the footer/panel split | every footer width from 10 to 82, at three panel widths | the two surfaces' bindings, concatenated, equal the whole list exactly |
| A wide terminal needs no panel rows | 160x40 | the footer holds all nine and the panel block is empty |
| Nothing is drawn over anything, across the range | 27 widths x 9 heights | the frame stays the terminal's size, all three footer rows survive, and the refusal block stays on screen |
| Edge-marker spacing is the same in tiles at both tile widths | 80x24 and 160x40 | measured off the composed frame, divided by the tile width |
| The side markers are an unbroken run | every viewport row | both borders, at the minimum size |
| The bindings block never draws over the construct menu | an 8x6 Grid at 80x24 | `tests/build-view.test.ts` — every menu row still on its own line; found by the pre-merge review, reproduced, then fixed |
| The border is soft only over the Grid pane's own segment, at both tile widths | corner, middle, and the panel's own top border | `tests/build-view.test.ts` — checked against `style.dim` directly rather than the glyph, and against the panel's border segment staying solid |
| The armed row carries `> `, an unarmed row carries none | one screen | text match |
| A selected-but-unaffordable row's cost is never both dim and bold | the exact cell `rightAlign` writes | style check |
| The cursor is bold and undimmed over bare ground, and leaves a planned structure's own dim alone | idle screen; a placed-and-disarmed plan under the cursor | two style checks |
| A refusal's message clears when the cursor leaves the tile, an action message survives a cursor move | a hand-built 10x10 grid with one rock tile | `tests/build-spike.test.ts` |
| `scrollThumb` never exceeds its own track, and sits flush at either end | every track length 1-48, every position 0-48 | `tests/build-camera.test.ts` |
| `--edge-style scrollbar`: bottom and west carry a thumb, north and east stay a plain yes/no | scrolled to the middle | `tests/build-view.test.ts`, checked against `scrollThumb`'s own arithmetic |
| Real-terminal screenshots | 13 (12 regenerated, 1 new: the scrollbar option), regenerated again after the two bugs below were fixed | `evidence/screenshots/`, tmux -> `capture-pane -e` -> headless Chromium |

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

**Round 2, on the merged screen, Mario gave specific direction rather than a general verdict** — he
liked the fixed-width panel and the idea of an explicit selection marker, and proposed two concrete
alternatives to the arrow markers (a hard/soft border, and a scrollbar). Both got built; his read on
which one to keep — or whether to keep both, one per situation — is the open question this round
leaves for him, alongside the two from round 1 (does scrolling read as looking around, and is the
signal enough without a minimap). `evidence/screenshots/spike-scrollbar.png` sits next to
`spike-scrolled.png` (the default hard/soft treatment, same scrolled position) for exactly that
comparison.

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

**A style-only overlay merges onto whatever is beneath it, and that cuts both ways.** The cursor's
whole mechanism — "keep the glyph, change the attributes" — depends on `composeBands` spreading the
band beneath before applying the overlay's own style keys. That is exactly right for preserving a
structure's glyph and its dim-versus-built distinction. It is exactly wrong for the first version of
the contrast fix, which added `bold` without clearing the ground's own `dim` — so the two attributes
sat in the same merged style object, fighting for the same intensity slot, and the fix did nothing
visible. The general lesson, not just this one cell: a style-only write has to state everything it
means to change, including turning something *off*, or the layer beneath keeps a vote.

**A quiet second bug from the same cause.** The unaffordable-cost fix (`dim` and `bold` never both
true) and the cursor fix (`dim: false` alongside `bold`) are the same bug in two places — one found by
a subagent's fresh read of a screenshot, the other found by writing this report and asking why the
"fixed" cursor still looked the same in the next screenshot. Neither would have been caught by
reasoning about the style object in isolation; both needed the actual rendered cell, or the actual
merge rule, checked directly.

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
- **The pre-merge review found the defect this gate introduced, and it is the same shape as the one
  it found last gate.** Pinning the overflow bindings to the bottom of the panel and growing them
  upward gave them no lower bound, so on a panel short enough — an 8x6 Grid at 80x24, which
  `isGated` deliberately passes because it fits the screen entirely — four binding rows drew straight
  over the construct menu: `shift+arrow jump 5        15` where `[3] Turret 15` belongs. The detail
  block already had the symmetric guard from gate 5B; this did not, and the single pinned row it
  replaced could only ever clobber one line, so the change *widened* an existing hole rather than
  opening a new one. A hidden menu row is worse than a hidden binding, because it stays a live click
  target, so the menu wins and the lowest-priority binding lines are dropped. Reproduced against a
  failing test before the fix. The blast radius on anything shipped today is zero — the 96x40 Grid
  never gets a panel that short — which is exactly why no test and no screenshot would have found it.
- **A consequence worth stating: on a Grid that small the jump keys are displayed nowhere.** The
  footer holds the four essentials and the panel has no room. That is the right trade at a size
  nothing is wired up at, and the honest place to fix it is the `?` help overlay `engine.md` 9.7
  already specifies and nothing has built.
- **Not done, deliberately: nothing was added to fill the panel's blank middle.** At 104x32 and up
  there are a dozen blank panel rows with nothing in them. Filling them would be the demo text the
  last gate removed, wearing a layout argument as a disguise.

### Round 2

- **The cursor contrast fix did not work on the first attempt, and looked like it might have.**
  Adding `bold: true` alongside `inverse: true` typechecked, tested green (the test only checked that
  `bold` was set, not what it accomplished), and produced a screenshot that looked unchanged. The
  cause was the merge rule above: the ground's own `dim: true` survived underneath and the two
  attributes cancelled. Fixed by explicitly clearing `dim` — and, since clearing `dim` unconditionally
  would have quietly promoted a planned structure to looking built the moment the cursor sat on it,
  the fix had to check what is actually under the cursor before deciding whether dim means "faint
  ground" or "still just a plan."
- **Even the corrected attribute fix was visually subtle**, because whether "bold" brightens a
  background at all under inverse video is a rendering-pipeline question, not a code one. The
  eventual fix adds an explicit bright role (`chrome.title`, the same one the armed menu row already
  uses) rather than relying on attribute intensity alone — deterministic across capability tiers,
  where the bold-only version was not.
- **A test I wrote to lock in the cursor-on-a-plan case failed against my own fix, correctly.** The
  scenario left the item still armed, so the ghost preview drew its own "illegal" overlay on the same
  cell my assertion was inspecting — the test was checking the preview, not the plan. Fixed by
  disarming before the assertion, matching the existing "reads differently" test's own setup, which
  had gotten this right already.
- **Q37, from the very first gate, said the click-to-place-versus-click-to-confirm choice should be
  "observable as a toggle rather than argued about."** The same principle applied here almost by
  itself: rather than pick between the hard/soft border and the scrollbar from a description, both
  got built as a real, switchable `--edge-style` option, and the choice is Mario's from a screenshot
  comparison rather than a paragraph.
- **A pre-merge review found two real bugs in the scrollbar option, both confirmed by running the
  code before being fixed.** First: the west border's thumb represents the Y axis, but was gated by
  `markers.west` — an X-axis fact — so scrolling flush to the west edge made the whole vertical
  scrollbar disappear even with real vertical scroll room left, because the wrong axis's boolean
  happened to be false. The symmetric mistake existed for the bottom border and the Y-axis boolean.
  The fix stopped mixing the two axes' facts at all: each of the two thumb borders is gated solely by
  whether *its own* axis has scroll room (`scrollThumb` returning non-null), never by the other
  axis's marker. Second, in the same review: the stale-message fix from earlier in this round cleared
  a refusal on *every* cursor-move command, including one that `clampToGrid` reduces to a no-op —
  pressing further into the Grid's own edge cleared a still-correct refusal, because the code checked
  "did a move command run" rather than "did the cursor actually leave the tile." Fixed by comparing
  the clamped tile against the one the cursor already had.

## 8. Decision

> **PASS**

Every automated claim in Section 4 holds, the scrolling rule is now checked across its whole
supported range rather than at the two sizes somebody screenshotted, and the gate turned up and fixed
a binding that was reachable but displayed nowhere at the acceptance size. Round 2 acted on Mario's own
follow-up feedback directly (a reversible presentation choice, not a canon question), fixed three real
bugs it found along the way, and built the scrollbar as a second, switchable option rather than a
replacement. Four things are now his to judge and none of them can be automated: whether scrolling
reads as looking around; whether the hard/soft border says "there is more Grid" clearly enough; the
same question for the scrollbar option, and which of the two (or both, in different situations) to
keep; and whether the armed-item marker and the brighter cursor read as intended.

## 9. Canon impact

Proposed changes, each with the document that would own it. **Nothing here is applied until Mario
accepts the gate.**

| Proposed rule | Would live in | Earned by |
| --- | --- | --- |
| **The footer and the side panel share one list of bindings**: the footer takes what its width holds, the panel shows the remainder. A binding is never dropped, only moved | `engine.md` 9.7, beside "the footer already shows the most important ones" | At 80 columns the footer cannot hold them all, and before this gate the ones it could not hold were displayed nowhere |
| **Edge-marker spacing is counted in tiles, not terminal columns**, and the side markers run unbroken | `engine.md` 3.3, which requires the markers but says nothing about their density | A step in columns halves at two columns per tile; a broken run beside the side panel reads as a caret pointing at a panel row |
| **The side panel is 30 columns at every supported size**; what adapts with width is what the footer holds, not the panel's layout | `engine.md` 9.2 | Built. A panel that reflows moves hotkeys, which 9.7 forbids, and the composition arithmetic fixes the width anyway |
| **A border segment beside the Grid pane is solid where a side ends and dim/dashed where there is more to scroll** — replacing the discrete arrow glyphs | `engine.md` 3.3, which requires the signal but not its exact shape | Built. Also removes the accidental `>` beside every panel row that the previous unbroken arrow run was drawing |
| **The armed construct row carries an explicit marker glyph**, not only inverse video | `engine.md` 9.7, beside the digit/hotkey conventions | Built, and specifically requested: an attribute alone is not "a symbol a player can point to and name" |
| **Not proposed as a rule**: `--edge-style scrollbar`. Built and screenshotted as a real alternative, per Q37's own precedent for exactly this kind of choice, but which one (or whether both stay, for different situations) is Mario's call, not a conclusion this report reaches | would live in `engine.md` 3.3 if kept | Section 5 |

Questions raised, each already added to [`../specs/open-questions.md`](../specs/open-questions.md) with a
recommendation:

| ID | Question | Recommendation |
| --- | --- | --- |
| Q51 | When should the game get a real accent-colour palette, with faction variations? | Wait for a second faction's content to exist, so the palette has more than one thing to differentiate |

## 10. Next authorized action

Gate 5D — the Nexus upgrade slot against a placeholder option, `p` and its one confirmation, the
hotkey-versus-click identical-plan test, and the Special slot's own space in the layout. Not before
Mario has looked at this one — now including his read on the edge-style comparison — and no other
gate in the meantime.
