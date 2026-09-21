# Gate report — Milestone 5, Gate 5B: the construct menu and legality

**Document role:** Gate evidence report for Gate 5B
**Status:** BUILT — Section 8 concludes PASS on every automated check; the one question only the owner can answer (Section 5) is outstanding
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

**A construct menu that is a choice rather than a list.** Three rows, each with its hotkey, its name
and what it costs, split into the two groups a Commander Army has — the faction's common structures
and the army-specific ones. PERIMETER has none of the latter, so that group is drawn as empty rather
than skipped: a group that vanishes when empty is a panel that reflows the first time content fills
it, and a hotkey that moves is a hotkey nobody can learn.

**A budget, and spending that is as revisable as the plan.** A 100-point starting allotment; placing
spends, removing and undoing refund. The total is summed from the plan itself rather than tracked
beside it — two numbers that have to agree are one number too many, and a stored total drifts the
first time a code path forgets to refund.

**A panel that says why.** When the armed structure cannot go where the cursor is, the side panel
carries the reason and, when the reason is about a tile, which tile: "rock in the way / at 8,5",
"the nexus is here", "costs 40, 20 left". Affordability is reported before any tile problem, because
it is true wherever the cursor is and reporting a rock the player could simply move off would send
them to fix the wrong thing.

**Less text.** Gate 5A's header carried a gate number, a line of viewport diagnostics and a promise
that nothing reached the simulation; its panel had a subtitle naming the spike and a running
commentary on what was armed and planned. All of it is gone. What is left follows one rule — every
line is something a player needs while deciding where to build — and the panel is mostly blank until
they are actually doing something. The diagnostics that are still genuinely wanted (the scroll margin
Mario has not finished judging) moved to the footer row that was already diagnostics.

Under it: `ConstructItem` grew a group, a cost and a one-line authored effect; `legalityAt` grew
affordability and a tile; `constructLines` is the grouped row geometry that the composer draws from
and the mouse adapter hit-tests against, replacing the flat `menuIndexAt` arithmetic that stops being
true the moment a heading sits between two rows.

## 4. Automated results

| Check | Result | Evidence |
| --- | --- | --- |
| Whole suite, Node 22.22.2 | 342 pass, 0 fail | `npm test` |
| Whole suite, Bun 1.3.11 | 341 pass, 0 fail | `npm run test:bun` |
| Type checking, strict | clean | `npm run typecheck` |
| Canon invariants | pass | `./scripts/check-repository.sh` |
| This milestone's own tests | 64 pass | `node --test tests/build-{camera,spike,view,lifecycle}.test.ts` |
| Two groups under one digit sequence; `3` arms the third row of the whole menu | holds | `tests/build-spike.test.ts` |
| The empty army group is drawn, and every item row stays distinct and ordered | holds | same file |
| Placing spends, removing and undoing refund exactly; the allotment comes back whole | holds | same file |
| The budget runs out in normal play, and never goes negative | holds, driven until refused | same file |
| A placement that cannot be afforded is refused and changes nothing — not the plan, not the budget | holds | same file |
| Affordability is reported before a tile problem | holds | same file |
| Every catalog row names real content, costs something, says what it does, and fits the panel | holds | same file |
| The panel says why, and names the tile when the reason is a tile | holds, for rock and for an occupant | `tests/build-view.test.ts` |
| …and stops saying it the moment the placement is legal again | holds | same file |
| The panel says nothing about an item until one is selected | holds | same file |
| The budget on screen is the budget the reducer enforces | holds | same file |
| An unaffordable row is dimmed; an affordable one is not | holds | same file |
| The same plan by raw keys, raw mouse bytes and a script: identical state and identical frame | holds, unchanged from 5A | `tests/build-spike.test.ts` |
| A click on a grouped construct row still does exactly what its digit does | holds | same file |
| Every capability tier puts identical glyphs on screen | holds | `tests/build-view.test.ts` |
| Every glyph is one cell wide, at three terminal sizes in both glyph packs | holds | same file |
| No header or footer line is cut off at the 80-column floor | holds | same file |
| The footer never names a key the adapter does not bind | holds | same file |
| Every exit path leaves raw mode, the alternate screen and mouse reporting off | holds | `tests/build-lifecycle.test.ts` |
| No raw escape byte reached a source file | holds | `grep -rlP '\x1b' src tests scripts` |

Twelve real-terminal screenshots in `evidence/screenshots/`. The two worth looking at side by side
are `build-idle.png` (nothing selected — the panel is the menu, the budget and two keys) and
`build-spent-down.png` (two barracks placed, 20 left, the rows that no longer fit dimmed and the
selected one saying why it cannot be built).

## 5. Human observations

_Awaiting Mario._ One question, and it is his own criterion: **does the screen now read as something
you use rather than something being demonstrated to you?** Everything else in this gate is
mechanically checkable and checked.

The comparison is lookable rather than described: `evidence/screenshots/build-idle.png` against gate
5A's own shots in the same directory. What came off the screen, line by line — the gate number in the
header, the viewport diagnostics beside it, "Nothing here reaches the simulation", the panel's
"scrolling + placement spike" subtitle, "ARMED / nothing - press 1, 2 or 3", "PLANNED / nothing
planned yet", "UNDER CURSOR / plain", and the opening status line telling the player what to do. What
went on: a cost per row, a budget, a group structure, and a reason when a placement is refused.

## 6. Interpretation

**The panel got shorter by saying more.** That is not a paradox and it is worth stating plainly,
because it is the whole of what Mario's note asked for. Gate 5A's panel had six labelled blocks, four
of which reported state the player could already see — what was armed (the row is inverted), how many
structures were planned (they are on the Grid), what terrain was under the cursor (it is under the
cursor). Replacing them with a cost per row, one effect line and a reason-when-refused left the panel
shorter *and* answered questions the old one could not: what will this cost me, what is it for, and
why will it not go there. **A panel that narrates state is long; a panel that answers questions is
short.** I would not have found that by staring at the old screen — it took someone saying the screen
talked too much.

**Two groups under one digit sequence needed no mode**, which was the stop condition. The hotkey
addresses the whole menu, not a position within a group, so a heading is a line the layout knows
about and the input model never hears of. What it did cost is the flat-list hit-test: `menuIndexAt`
computes a row with one multiply, which is exactly and quietly wrong once a heading sits between two
items. Grouped rows needed their own geometry, shared by the composer and the adapter the same way
the flat one is.

**Ordering the legality checks turned out to be a design decision, not an implementation detail.**
Affordability before tiles is not an optimisation; it is about which sentence sends the player
somewhere useful. "Rock in the way" when the real problem is that they are broke is a true answer
that wastes their next thirty seconds.

**On the fourth decision channel** — the milestone asks each gate to notice whether a Build Phase
feels short of one. Now that there is a budget and a menu, there are two real channels (what to build,
where to put it) and they interact: the budget is what makes placement a trade-off rather than a
layout exercise. That is the first evidence this milestone has produced on the question, and it
points mildly *against* needing a third: two channels that constrain each other already make a
decision. The upgrade pick (5D) and the Special slot are still untested, and Milestone 6 is where the
whole loop gets played, so this stays an observation rather than a conclusion.

**What is deliberately still missing**, so the next session does not mistake this for a finished Build
Phase: no radius preview (Q30, and nothing here has a radius), no Nexus upgrade draft, no Special
slot, no commit key, and no side-panel layout that adapts across the viewport range — that is 5C, and
the panel's blocks still sit at the top of a tall screen rather than spreading out.

## 7. Failures, surprises, and discarded approaches

**The dim-when-unaffordable test was testing the wrong row, and the failure was the finding.** It
armed a structure and then asserted its row was dimmed. It was not: a selected row is inverse video,
which is what "selected" means on every list in this game, and inverse beats dim. The instinct was to
make the selected row dim too. That would have been wrong — a selected unaffordable row already gets
the whole CANNOT BUILD HERE block spelling out the cost against what is left, which is strictly more
information than a dimmer glyph. Dimming is for scanning the rows you have *not* selected. The test
now checks an unselected row and its affordable neighbour, and a second test covers the selected
case where it actually lives.

**Nine tests broke on the panel rewrite, and that was the system working.** Every one asserted a
string gate 5A's screen used to print — "Still armed", "rock at", "1 structure", the old header line.
Nothing subtle broke. Worth recording because the temptation with a screenful of failures is to
loosen the assertions; the right move was to update each one to what the screen says now, which is
also how I noticed that three of them had been asserting the *narration* rather than the behaviour.

**Screenshot wait-texts are test assertions in disguise**, and they broke the same way — the capture
script waits for "Armed" and "rock at" and "Placed" to appear before it shoots, and all three
messages changed. They failed loudly, which is right, but it is worth knowing that the screenshot
pipeline has its own coupling to on-screen strings and will need updating whenever wording does.

**The costs are not balance and should not be read as any.** They are three round numbers chosen so
the allotment buys some of the menu and not all of it, because a budget that affords everything is
not a budget. The test that guards this asserts the *behaviour* — place repeatedly and the refusal
arrives — rather than arithmetic over the three constants, after a first version that asserted
`whole + cheapest > allotment` and failed on numbers that were perfectly fine. An assertion about
constants was a worse test than an assertion about what happens.

**Nothing was discarded wholesale.** The scope Q30 recommended a year of documents ago — build the
menu and the legality panel, skip the radius preview — was the right scope, and skipping the preview
cost nothing because nothing in the catalog has a radius to preview.

## 8. Decision

> **PASS**

The menu has two groups, one digit sequence and no mode; every row carries its cost; the budget is
spent and refunded exactly and cannot go negative or be overspent; a refused placement says why in
the panel and names its tile; and the screen says all of it in fewer lines than gate 5A used to say
less. 64 tests across this milestone's four files, green on both runtimes, with the whole suite at
342 and 341.

PASS means the automated evidence holds. The one thing only Mario can score — whether the screen now
reads as something you use rather than something being demonstrated — is in Section 5 and
outstanding, as the project's own convention requires.

## 9. Canon impact

**Nothing is applied. All of it waits for Mario to accept the gate.**

| Proposed rule | Would live in | Earned by |
| --- | --- | --- |
| The Build Phase panel is the construct menu, the budget, the selected item's cost and effect, and the reason a placement was refused. **No radius preview until something has a radius** | `engine.md` 9.2's Build Phase row, which currently lists a radius preview | Q30's own recommendation, now built. Nothing in the catalog has a radius, so the preview would be a framework before its first use |
| **A construct menu's groups share one digit sequence**; a hotkey addresses the whole menu, never a position within a group | `engine.md` 9.7, beside the "digits always address the list" convention | Built and tested. The alternative needs a focus concept, which is the mode that convention exists to forbid |
| **An empty content group is drawn, not skipped** | `commander-armies.md` 2.1, where the two groups are named | A group that vanishes when empty reflows the panel and moves hotkeys the first time it fills — and 9.7 requires hotkeys to be stable so muscle memory transfers |
| **A refused placement is answered in the panel, not only the status line**, with the tile named when the reason is a tile; and **affordability is reported before any tile problem** | `engine.md` 9.2 | Gate 5B's own reason to exist. The ordering is Section 6: the wrong true answer sends the player to fix the wrong thing |

Questions raised: **none.** Q30, which this gate was built against, is answered by building it — its
recommendation was followed exactly, and it should move to the register's answered section when Mario
accepts this gate.

## 10. Next authorized action

Gate 5C — cursor-driven scrolling across the full viewport range and the side panel's own adaptive
layout, which is also where the edge markers' weight and placement finally get tuned rather than left
as they are. Not before Mario has looked at this one, and no other gate in the meantime.
