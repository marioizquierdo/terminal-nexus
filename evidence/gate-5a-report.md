# Gate report — Milestone 5, Gate 5A: the scrolling-and-placement spike

**Document role:** Gate evidence report for Gate 5A
**Status:** In progress — Sections 1 and 2 written before any code, per the template
**Canon version:** 2.16
**Updated:** 2026-09-21
**License:** Apache-2.0

---

## 1. Frame — written before coding

- **Canon version:** 2.16.
- **Milestone and gate:** Milestone 5 — Build Phase; Gate 5A (the scrolling-and-placement spike).
  Milestone 3 was accepted by Mario on 2026-09-21 and Milestone 5 promoted to CURRENT the same day;
  this is its first gate, and the milestone's own text says the spike runs *before* the real Build
  Phase gets built.
- **Question this gate answers:** Do the two interactions Mario singled out as needing the most
  attention — moving around a map bigger than the screen, and placing a chosen building on it —
  actually hold up when you drive them, by keyboard, by mouse, and from a script, on both the
  smallest and the largest screen the game supports? And which of the keys the design assumed does a
  real terminal quietly fail to deliver?
- **Smallest artifact that can answer it:** one interactive screen, reachable from the game's own
  menu, that does exactly those two things and nothing else:
  - a Grid deliberately larger than any viewport the game will ever show (96 × 40 tiles, against a
    largest-ever viewport of 72 × 24), so scrolling is unavoidable rather than optional;
  - a cursor moved by the arrow keys, which drags the camera with it once it comes within three
    tiles of an edge — the rule the canon has stated since before Gate 1A and nothing has ever
    executed, because Gate 1A deliberately used a Grid that fit the screen whole;
  - a short list of buildings, each showing its own key, armed by pressing that key or clicking the
    row, placed at the cursor with Enter or a click on a tile, staying armed afterwards so a run of
    them is one key then arrows and Enter;
  - a legality check strict enough that placing on rock, off the map, or on top of something already
    there is refused with a short reason — enough to make placement feel real. The full side panel
    that explains *why* in the Build Phase proper is gate 5B's, not this one's;
  - the same screen driven three ways: real keystrokes, real mouse bytes, and a scripted list of
    commands, with a test proving the three produce the identical plan and the identical screen;
  - **a toggle, not an argument, for the click question.** One key flips between "a click places it
    immediately" and "a click moves the cursor there and a second click confirms." Both behaviours
    ship, the current one is named on screen, and Mario picks by trying them.
- **Automated evidence planned:**
  - the camera arithmetic, on its own: the three-tile margin honoured at every cursor position, the
    camera never leaving the Grid, the viewport clamped to between 48 × 16 and 72 × 24 tiles no
    matter how large the terminal is, and the resize gate below 80 × 24;
  - the same plan entered three ways — raw keystrokes, raw mouse bytes, and a command script —
    producing byte-identical planned placements and byte-identical frames;
  - placement legality: off the Grid, on rock, and overlapping something already placed are each
    refused with their own reason, and nothing is ever silently moved to a legal tile instead;
  - the screen composed at the viewport's minimum (80 × 24) and maximum (104 × 32) terminal size,
    asserting that the edge markers appear on exactly the sides with more Grid beyond them and that
    the footer's position readout names the visible tile range;
  - the whole existing suite staying green on both runtimes, including the Bun run, since new files
    are involved;
  - **a real-terminal survey of the modified arrow keys**, driven through tmux into a raw-mode
    reader that prints the bytes it actually received, cross-checked against what each terminal's own
    terminfo entry claims it sends. Measured, not remembered.
- **Human observation planned:** Mario, on two questions only. First: does scrolling feel like
  looking around the map, or like fighting the cursor? Second: which click behaviour does he want —
  place on the first click, or confirm on a second? Both are feel questions no test can answer, which
  is why the second one ships as a toggle rather than a decision. Screenshots at both terminal sizes
  go in `evidence/screenshots/` either way.
- **Explicit exclusions:**
  - the real Build Phase. No costs or spending, no two-group construct menu, no legality *panel*, no
    Nexus upgrade draft, no Special slot, no commit key and no confirmation — those are gates 5B, 5C
    and 5D, and this gate is explicitly the thing that runs before them;
  - the adaptive side-panel layout across the size range (gate 5C). The spike's panel is a fixed
    30 columns at every size, which is what the canon's own arithmetic already assumes;
  - anything that touches the simulation. Nothing here spends a tick, runs a Pulse, or writes to
    match state; a planned placement is a plan on a screen and never reaches the kernel;
  - PERIMETER's own map, budget or content. The spike's map is a throwaway sized to force scrolling;
  - saving anything. The spike keeps nothing between runs;
  - retuning `engine.md` 9.7's key bindings in the canon itself. The gate *reports* what the
    measurement says; changing canon waits for Mario to accept the gate.
- **Stop conditions:**
  - if the three-tile margin rule turns out to be unimplementable as stated — for instance if
    honouring it at the Grid's own edges requires the camera to leave the Grid — that is a RULE in
    tension with itself and a question for Mario, not something to quietly redefine;
  - if the mouse wheel cannot be made to scroll without introducing a second, independent camera that
    the cursor does not drive. The canon says both "the wheel scrolls the camera" and "the cursor
    drives it, no separate pan mode"; if those cannot both be true, the spike stops and says so
    rather than picking one silently;
  - if no modifier-free fallback for the five-tile jump survives contact with a real terminal, the
    gate reports that the fast pan has no portable binding rather than shipping one that only works
    on the machine it was written on.

## 2. Environment — pinned, not remembered

| | |
| --- | --- |
| OS and architecture | Ubuntu 24.04.4 LTS (container), x86_64 |
| Runtime and exact version | Node v22.22.2; Bun 1.3.11 |
| Dependencies and exact versions | `@opentui/core@0.5.6`, `typescript@7.0.2`, `@types/node@22.20.1` — unchanged by this gate |
| Terminal tooling for the survey | tmux 3.4; ncurses `infocmp` 6.4; Chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` (a renderer for the screenshots, nothing more) |
| Hardware, if it affects measurements | Not applicable — nothing here is timed |
| Date measured | 2026-09-21 |

Commands, copy-pasteable, in the order a stranger would run them:

```bash
# install
npm install

# build — there is no build step; both runtimes execute the TypeScript sources directly

# test
npm run typecheck
npm test
npm run test:bun

# run — the spike itself, from the game's own menu (Campaign, then the spike row) or directly
./bin/terminal-nexus.ts --spike
./bin/terminal-nexus.ts --spike --capability monochrome

# the modified-arrow-key survey: what terminals claim, and what one actually delivers
node scripts/probe-modified-keys.mjs

# real-terminal screenshots, at the viewport's minimum and maximum size
node scripts/capture-spike-screenshots.mjs
```

## 3. What was built

_To be filled in._

## 4. Automated results

_To be filled in._

## 5. Human observations

_To be filled in._

## 6. Interpretation

_To be filled in._

## 7. Failures, surprises, and discarded approaches

_To be filled in._

## 8. Decision

_To be filled in._

## 9. Canon impact

_To be filled in._

## 10. Next authorized action

_To be filled in._
