# Gate report — Milestone 5, Gate 5C: scrolling and the adaptive layout

**Document role:** Gate evidence report for Gate 5C
**Status:** IN PROGRESS — Sections 1 and 2 written before any code
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

What exists now that did not before. Keep it to what a reviewer needs to find their way around the
diff; the diff is the detail.

## 4. Automated results

Every claim here is reproducible by a command in Section 2. Facts only — save the reading of them
for Section 6.

| Check | Result | Evidence |
| --- | --- | --- |
| | | |

Measurements:

| Metric | Value | Method | Samples |
| --- | --- | --- | --- |
| | | | |

## 5. Human observations

Only what a person actually saw, in their words where possible. Say who, when, and what they were
asked. If nobody has looked at it yet, write that — an experiential claim with no human behind it is
the one failure mode this whole process exists to prevent.

## 6. Interpretation

Now you may argue. What the numbers mean, what surprised you, what you expected and did not get.
Keep it separate from Section 4 so a later reader can disagree with your reading without losing the
data.

## 7. Failures, surprises, and discarded approaches

What did not work, and what a future session should not waste an afternoon rediscovering. This
section is often the most valuable one in the file. An empty one usually means it was not filled in
honestly.

## 8. Decision

> **PASS** / **REVISE** / **STOP** / **BLOCKED**

One paragraph on why. If REVISE, name the single comparator or change required and the criterion it
must satisfy. If BLOCKED, name exactly who or what unblocks it.

## 9. Canon impact

Proposed changes, each with the document that would own it. **Nothing here is applied until Mario
accepts the gate.**

| Proposed rule | Would live in | Earned by |
| --- | --- | --- |
| | | |

Questions raised, each already added to [`../specs/open-questions.md`](../specs/open-questions.md) with a
recommendation:

| ID | Question | Recommendation |
| --- | --- | --- |
| | | |

## 10. Next authorized action

One sentence. What the next session should do, and nothing beyond it.
