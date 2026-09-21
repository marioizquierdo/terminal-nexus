# Gate report — Milestone 5, Gate 5B: the construct menu and legality

**Document role:** Gate evidence report for Gate 5B
**Status:** In progress — Sections 1 and 2 written before any code, per the template
**Canon version:** 2.17
**Updated:** 2026-09-21
**License:** Apache-2.0

---

## 1. Frame — written before coding

- **Canon version:** 2.17.
- **Milestone and gate:** Milestone 5 — Build Phase; Gate 5B (the construct menu and legality).
  Gate 5A was accepted on 2026-09-21 and Mario asked for this one directly.
- **Question this gate answers:** Can a player pick what to build from a menu that shows what each
  thing costs and does, spend a limited budget on it, and — when a placement is refused — be told
  *why* clearly enough to fix it, rather than just being told no? And can the screen say all of that
  while saying **less** than the spike did?
- **Smallest artifact that can answer it:**
  - **a construct menu in two groups** — the common tier and the army tier — under one run of
    digits, with each row showing its own hotkey, its name and its cost. PERIMETER's army group is
    empty, so the empty group is drawn honestly rather than assumed away: the layout must not
    quietly depend on there never being one;
  - **a cost and an effect for every item**, and a budget to spend them against. One short authored
    line per item saying what it does — not derived from its stats, because "120 hp, 3x2" is not
    what a player is deciding between;
  - **spending that is as revisable as the plan is.** Placing spends, removing and undoing refund.
    A plan that cannot be afforded is refused with its own reason, like any other illegal placement;
  - **a legality panel that says why** — the side panel's own block, not a line in the footer that
    scrolls away behind the next message. It names the reason and, where the reason is a tile, which
    tile;
  - **less text.** Mario, accepting 5A: *"still has too much text focused on demo instead of trying
    to be as simple and direct as possible."* The gate number, the subtitle naming the spike, the
    line promising nothing reaches the simulation, and the developer diagnostics in the header all
    go. The rule I am applying: **every line left on screen is something a player needs while
    deciding where to build**, and the one row of diagnostics Mario still needs (the scroll margin
    he deferred judging) moves into the footer row that is already diagnostics.
- **Automated evidence planned:**
  - the two-group menu addressed by one digit sequence: `3` picks the third row overall, whichever
    group it falls in, and a digit past the end of both groups means nothing;
  - the same plan built by hotkeys, by clicks and from a script produces an identical plan, an
    identical budget and an identical screen — the gate 5A equivalence proof, extended to spending;
  - spending arithmetic: placing deducts, removing and undoing refund exactly, and no sequence of
    placements and removals can leave the budget wrong or negative;
  - a placement that costs more than is left is refused with its own reason and changes nothing;
  - every legality reason reaches the panel, and the panel says which tile when the reason is a tile;
  - the frame still composes identically across capability tiers, is one cell per glyph in both
    glyph packs, and fits at 80 x 24 with no line truncated — the check that caught two bugs in 5A;
  - the whole suite green on both runtimes.
- **Human observation planned:** Mario, on one question — does the screen now read as something you
  *use* rather than something being demonstrated to you? That is his own criterion and only he can
  score it. Screenshots at 80 x 24 and 104 x 32, before and after, so the comparison is lookable.
- **Explicit exclusions:**
  - **radius preview** (Q30, recommending exactly this): nothing PERIMETER places has a radius worth
    previewing, and building the preview now is a framework before its first real use;
  - the Nexus upgrade draft, the Special slot, the commit key and its confirmation — gate 5D;
  - the side panel's adaptive layout across the viewport range, and edge-marker/readout retuning —
    gate 5C. This gate keeps 5A's fixed 30-column panel;
  - how the resource is *earned*. Milestone 7 owns the worker economy; this gate spends a starting
    allotment and nothing more, per Milestone 2's own decision;
  - real PERIMETER content. The catalog stays disposable bench content with a real shape;
  - anything that touches the simulation. Still nothing here spends a tick or reaches the kernel.
- **Stop conditions:**
  - if a two-group menu under one digit sequence turns out to need a mode or a focus concept to
    disambiguate, that collides with the input model's "no modes" convention and is a canon question
    for Mario, not something to paper over with a second key;
  - if "say why" cannot be done in the panel's 28 columns without abbreviating to the point of
    uselessness, the gate reports that the panel is too narrow for its job rather than shipping
    truncated reasons — the 30-column panel is derived from the 80-column floor, so that would be a
    real finding about the composition, not a layout preference;
  - if cutting the explanatory text makes the screen unusable without a manual, that is evidence the
    text was load-bearing rather than decorative, and the gate says so instead of quietly keeping it.

## 2. Environment — pinned, not remembered

| | |
| --- | --- |
| OS and architecture | Ubuntu 24.04.4 LTS (container), x86_64 |
| Runtime and exact version | Node v22.22.2; Bun 1.3.11 |
| Dependencies and exact versions | `@opentui/core@0.5.6`, `typescript@7.0.2`, `@types/node@22.20.1` — unchanged by this gate |
| Terminal tooling | tmux 3.4; Chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, a renderer for the screenshots and nothing more |
| Starting point | `main` at the gate 5A merge, plus the canon 2.17 acceptance pass |
| Baseline test counts | 332 on Node, 331 on Bun |
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

# run
./bin/terminal-nexus.ts --spike
./bin/terminal-nexus.ts --spike --capability monochrome

# real-terminal screenshots, at every terminal size that means something
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
