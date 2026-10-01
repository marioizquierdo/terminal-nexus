# Gate report — Milestone 5, Gate 5D: the Nexus draft slot and commit

**Document role:** Gate evidence report for Gate 5D
**Status:** COMPLETE — PASS
**Canon version:** 2.18
**Updated:** 2026-09-22
**License:** Apache-2.0

---

## 1. Frame — written before coding

- **Canon version:** 2.18
- **Milestone and gate:** Milestone 5 — Build Phase, gate 5D — the Nexus draft slot and commit.
- **Question this gate answers:** does the mechanism behind a Nexus power actually work end to end —
  offer a choice, accept a pick, apply its effect — and does committing the Build Phase (`p`, one
  confirmation) work the same whichever adapter drives it? Also: does the Special slot's own empty
  space in the layout feel like it is missing something, or does PERIMETER genuinely not need one?
- **Smallest artifact that can answer it:** two placeholder Nexus powers (not real Milestone-8
  content — plain numbers, so nothing here reads as an attempt at real design), offered once at the
  start of the Build Phase, picked by digit or click; a `p` key that asks once, `[y]es`/`[n]o`,
  before committing; a labelled, empty Special section, drawn the same way the empty army group
  already is (5B); and a driver test that plays the same pick-then-build-then-commit script once by
  raw keystrokes and once by raw mouse bytes and checks the two committed states are identical.
- **Automated evidence planned:**
  - drafting blocks every state-changing command (arm, place, remove, undo, disarm, commit) with a
    named reason, and unblocks the moment a pick is made;
  - picking applies its effect exactly once, and the pick cannot be changed afterward;
  - `p` opens the confirmation and does not commit anything by itself; any key other than `y`, `n`,
    or Esc leaves the confirmation open; `n` and Esc both cancel without changing state;
  - once committed, every state-changing command is refused and the plan does not change;
  - the same script — pick a power, place a couple of structures, commit, confirm — produces an
    identical final `BuildState` whether driven by keyboard bytes or mouse bytes;
  - real-terminal screenshots of the draft screen, the confirmation, and the committed screen.
- **Human observation planned:** Mario, on the one question this gate cannot answer for itself —
  whether the Build Phase felt short a decision channel with the Special slot empty, which the report
  states as a finding either way rather than leaving for him to notice.
- **Explicit exclusions:** real Nexus power content (Milestone 8's own — Commander Vasse's actual
  draft); any content for the Special slot (PERIMETER has none); anything that touches the
  simulation or an actual Nexus Pulse (Milestone 6 — committing here ends the interactive loop with a
  message, not a running Pulse); the two open questions gate 5C round 2 left for Mario (which border
  treatment, whether the selection marker reads right) — unrelated axes of the same screen, addressed
  nowhere in this gate.
- **Stop conditions:** if proving the mechanism turns out to need real Nexus power content to be
  convincing (rather than two placeholder numbers), that is a scope question for Mario, not a reason
  to author Commander Army content early. If the Special slot's empty space turns out to need
  interactive behaviour to evaluate honestly, the report says so and recommends deferring the
  question to Milestone 6 rather than inventing content to fill it.

## 2. Environment — pinned, not remembered

| | |
| --- | --- |
| OS and architecture | Linux 6.18.44-fc-v37, x86_64 |
| Runtime and exact version | Node 22.22.2 (primary), Bun 1.3.11 (second runtime) |
| Dependencies and exact versions | TypeScript 7.0.2 for typechecking only; no runtime dependencies. tmux and headless Chromium for the real-terminal screenshots |
| Hardware, if it affects measurements | Container; no frame-time budget is claimed in this gate |
| Date measured | 2026-09-22 |

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

# real-terminal screenshots
node scripts/capture-spike-screenshots.mjs
```

## 3. What was built

A gate on the front of the screen 5A–5C already built, and a gate at its back.

- **The Nexus power draft is the Build Phase's opening screen.** Two placeholder powers
  (`SPIKE_NEXUS_DRAFT` in `src/build/catalog.ts`) — "Reserve Fund" and "War Chest," each just a plain
  bump to the starting allotment, so nothing here reads as an attempt at real Milestone-8 design — are
  offered before anything else happens. `BuildState.nexusPick` starts `null`; every state-changing
  command (`arm`, `place`, `remove`, `undo`) is refused with "Pick a Nexus power first" until a pick
  is made, because Section 4.5 of `commander-armies.md` already says a dealt Nexus power may not be
  skipped. Picking applies the chosen option's `bonusAllotment` to `remaining()` exactly once and
  cannot be repeated or changed.
- **`p` commits, once, through a single yes/no confirmation.** It opens `confirmingCommit: true` and
  changes nothing else; `y` (or a click on the "Yes" row) sets `committed: true` and ends the
  interactive loop with a message naming what would happen next ("Nexus Pulse would begin here
  (Milestone 6)"); `n` or Esc cancels back to normal building with no side effect. While confirming,
  every other state-changing command is refused with "Answer the Nexus Pulse prompt first."
- **`lockReason(state)`** is the one guard every state-changing reducer case now starts with:
  committed beats confirming beats undrafted, in that order, each with its own message. Adding a
  fourth gate later is one more `if` in one function, not a change repeated at every call site.
- **The panel gained two rows it did not have — NEXUS and SPECIAL** — between the construct groups
  and the per-item detail block. NEXUS names the picked power once one exists; SPECIAL always reads
  "none available," drawn the same way gate 5B already draws the empty ARMY group, so the fourth
  place `commander-armies.md` Section 2.1 names for a Build Phase decision (construct menu's two
  groups, the Nexus draft, and a Special) exists in the layout as a real, visible row rather than an
  assumption. Fitting both rows meant compacting the illegal-placement detail block by one row each
  in three places (Section 7 has the detail) — the panel was already at zero spare rows at the 80x24
  floor before this gate.
- **Four panel views share one screen.** `composeBuildFrame` now branches on `state.committed` /
  `state.confirmingCommit` / `state.nexusPick === null` to choose which of `drawNexusDraftPanel`,
  `drawConfirmPanel`, `drawCommittedPanel`, or the ordinary construct-menu panel to draw — but the
  Grid, the cursor, the chrome, the header, and the footer render exactly the same in all four, so
  scrolling and looking around never stop working, including after commit (cursor movement is not one
  of the commands `lockReason` gates).
- **The keyboard and mouse adapters both route on "whichever list the panel is showing," in the same
  priority order.** A digit picks a draft option while drafting, answers y/n while confirming
  (`y`/`n`/`p` are also bound directly, not only as list items), or arms a construct row otherwise —
  one `if`/`else` chain in `buildKeyboardCommand`, mirrored in `buildMouseCommand`'s hit-testing
  order. Both the draft list and the confirmation list are built from `src/menu/layout.ts`'s existing
  flat-list geometry (`MenuLayout`, `menuItemLabel`, `menuIndexAt`) rather than a third hand-rolled
  layout — the second and third real use of that shape, which is what justified extracting it as
  reusable when the menu screen first needed it.
- **`tests/build-nexus.test.ts` is a new, dedicated suite (15 tests)** for the draft/confirm/commit
  mechanism specifically: every state-changing command refused at each of the three gates and
  unblocked past it; a pick's effect applied exactly once and never repeated; an out-of-range pick
  ignored; confirming answered by `y`/`n`/Esc and by nothing else; keyboard and mouse routing at each
  screen; and one end-to-end test that plays pick → arm → move → place → move → place → commit →
  confirm once by raw keyboard bytes, once by raw mouse bytes, and once by a driver command script,
  asserting all three finish in the identical `BuildState`.
- **The existing Build Phase suites (`build-lifecycle`, `build-spike`, `build-view`) were adapted, not
  rewritten**, to start every session already past the new draft gate — a `readyBuildSession` helper
  that auto-picks a neutral, zero-effect placeholder power (`bonusAllotment: 0`) so none of those
  tests' existing budget arithmetic shifts underneath them. The handful of tests that check the draft
  gate itself construct a `BuildSession` directly instead, past that helper.

## 4. Automated results

Every claim here is reproducible by a command in Section 2. Facts only — save the reading of them
for Section 6.

| Check | Result | Evidence |
| --- | --- | --- |
| `./scripts/check-repository.sh` | passes at canon 2.18, active gate correctly reads 5D | run before and after |
| `npm run typecheck` | clean | `tsc --noEmit`, strict with `exactOptionalPropertyTypes` |
| `npm test` (Node 22.22.2) | **383 pass, 0 fail** | whole suite, including four Build Phase files |
| `npm run test:bun` (Bun 1.3.11) | **382 pass, 0 fail** | one Node-only test does not run under Bun (unchanged from gate 5C) |
| `tests/build-nexus.test.ts` (new) | 15 of 15 | drafting, picking, confirming, committing, both adapters, the driver |
| `tests/build-lifecycle.test.ts` | 7 of 7 | real stdin/stdout lifecycle through `runSpike`, adapted to open on the draft |
| `tests/build-spike.test.ts` | 30 of 30 | placement, legality, budget, both adapters |
| `tests/build-view.test.ts` | 39 of 39 | frame composition, including the four new gate-5D-specific tests |
| Every state-changing command refused before a pick, unblocked the instant one is made | `arm`, `place`, `remove`, `undo` | `tests/build-nexus.test.ts` |
| A pick's `bonusAllotment` changes `remaining()` exactly once; a second pick attempt is a no-op | both draft options, and out-of-range indices | `tests/build-nexus.test.ts` |
| `commit` is refused before a pick, and while already confirming or committed | `lockReason`'s own priority order, all three gates | `tests/build-nexus.test.ts` |
| `y`/`n`/Esc are the only three keys that change a pending confirmation; every other key is inert | digits, letters, arrows | `tests/build-nexus.test.ts` |
| Once committed, every state-changing command is refused and the plan is byte-for-byte unchanged | `arm`, `place`, `remove`, `undo`, a second `commit` | `tests/build-nexus.test.ts` |
| The pick-build-commit-confirm script produces an identical final `BuildState` by keyboard bytes, by mouse bytes, and from a driver script | one script, three adapters | `tests/build-nexus.test.ts` |
| A digit addresses the draft while drafting, the confirmation while confirming, and the construct menu otherwise — for both adapters | keyboard and mouse, all three screens | `tests/build-nexus.test.ts` |
| The normal panel names the picked power and the always-empty Special row | one screen | `tests/build-view.test.ts` |
| The draft screen carries none of the construct menu's own content (no RESOURCE, COMMON, or SPECIAL row) | one screen | `tests/build-view.test.ts` |
| The confirmation screen asks only y/n, with none of the construct menu's own content | one screen | `tests/build-view.test.ts` |
| The committed screen names the pick and the plan count; the footer carries the full sentence | one screen | `tests/build-view.test.ts` |
| No existing budget, legality, scrolling, or adapter-equivalence test's numbers shifted | all four pre-existing Build Phase suites | full suite, unchanged pass count plus the new tests |
| Real-terminal screenshots | 16 (13 regenerated with a leading pick, 3 new: the draft, the confirmation, the committed screen) | `evidence/screenshots/`, tmux -> `capture-pane -e` -> headless Chromium |

Measurements:

| Metric | Value | Method | Samples |
| --- | --- | --- | --- |
| Rows the panel gained without growing | 2 (NEXUS, SPECIAL) | compaction of the illegal-placement detail block (one row removed in three places) | measured directly against `available`/`detail.length` at the 80x24 floor before and after |
| New tests added for gate 5D | 19 | 15 in `tests/build-nexus.test.ts`, 4 in `tests/build-view.test.ts` | — |
| Total automated tests, Node | 383 (was 364 at gate 5C) | `npm test` | — |

## 5. Human observations

**None yet.** Nobody has played the draft/commit flow by hand — Mario's own manual test of gate 5C
(border style, selection marker) is still outstanding too, and the two are genuinely separate axes of
the same screen (Section 1's exclusions). The specific things worth trying by hand are in the
check-in message alongside this report, not only here, so they do not get lost in a document he has
to go find.

## 6. Interpretation

**A screen is its states, and this gate is the first time the Build Phase had more than one.**
Gates 5A–5C all built one panel that changed its content but never its own shape. Adding a mechanism
that must run to completion before the rest of the screen means anything — the draft — turned "the
panel" into four mutually exclusive views (drafting, normal, confirming, committed) chosen by three
booleans (well, `nexusPick === null`, `confirmingCommit`, `committed`) rather than one flag. Keeping
the Grid, camera, chrome, header and footer rendering identically underneath all four turned out to
be the cheap part — they already did not know about `armed` or `planned` either — and is also the
part that matters most: a player who has just committed can still scroll around and look at what they
built, because nothing about locking the *plan* had to lock the *screen*.

**`lockReason` earns its existence by being reused, not by being elegant.** A single ordered function
that four call sites all start with is a small thing, but the alternative — the same three-way
if/else copied into `arm`, `place`, `remove`, and `undo` — is exactly the kind of duplication that
drifts the moment a fifth gate is added later and only three of the four copies get updated. This is
the second time this gate reused something built for one purpose in a second one (menu list geometry
being the first, see below); both reuses happened only after there were genuinely two or more call
sites needing the same shape, which is the point of the project's own stated preference for
extracting only after real duplication shows up.

**Reusing `src/menu/layout.ts` for the draft and confirmation lists, rather than inventing a third
list geometry, held up.** The construct menu already has its own row layout (`constructLines`,
`constructIndexAt`) because it draws costs and groups the flat menu system does not need to. The
draft and confirmation lists need neither, so treating them as two more flat menus was a better fit
than extending the construct menu's own geometry to cases it was not built for — no group headers, no
per-row cost column, just a hotkey and a label. Both screens hit-test through the exact same
`menuIndexAt` the top-level game menu uses.

**The Special-channel finding this gate can actually make is a narrower one than the milestone's own
question asks.** `commander-armies.md` Section 2.1 already says the real verdict — is a third
decision channel missed, or should Specials fold back into the Nexus power pool — lands at
Milestone 6, "when the first whole loop is played." Nothing this gate builds could move that judgment
earlier: PERIMETER has no Special, so there is nothing to miss yet, and the honest answer to "does the
Build Phase feel short a channel" is that a channel with zero content in it cannot be felt as missing.
What this gate *can* report is narrower and still real: the slot fits. Drawing SPECIAL as an always-
visible "none available" row, the same way ARMY already draws empty, cost two rows at a floor that had
none spare, and it fit without the screen feeling crowded or the detail block losing anything a player
needs. That is weak evidence for "the layout can hold three decision channels without strain" and no
evidence at all for "a Build Phase wants three." Milestone 6 is where the real read happens.

## 7. Failures, surprises, and discarded approaches

- **A global find-and-replace across test files clobbered its own helper function.** Making every
  `BuildSession` in `tests/build-spike.test.ts` and `tests/build-view.test.ts` start past the drafting
  gate meant swapping ~25 call sites from `new BuildSession(...)` to a wrapper that auto-picks first.
  Doing that with a blind substring replace of `new BuildSession(` -> `readyBuildSession(` also
  rewrote the wrapper's *own* body, turning `const build = new BuildSession(options)` into
  `const build = readyBuildSession(options)` — infinite self-recursion. Caught immediately by the
  test run (a stack overflow, not a subtle failure), fixed by hand in `build-spike.test.ts` and
  avoided the second time in `build-view.test.ts` by masking the wrapper's own line with a placeholder
  string before running the same replace. Worth remembering: a scripted rename over a file that
  *defines* the name being substituted needs the definition protected first, not fixed after.
- **The auto-pick silently changed ~7 existing tests' budget arithmetic**, because the first version
  of the wrapper picked the real `SPIKE_NEXUS_DRAFT[0]` ("Reserve Fund," `bonusAllotment: 30`) —
  every existing assertion written against a 100-point allotment started failing against 130. Fixed
  by giving the test files their own separate, zero-effect placeholder draft
  (`NEUTRAL_NEXUS_DRAFT`, `bonusAllotment: 0`) for the wrapper to pick from, so every pre-existing
  test still sees exactly the numbers its own assertions assume.
- **That fix then created a second, subtler bug**: the wrapper built the `BuildSession`'s internal
  state against the neutral context, but several tests separately called `spikeContext()` again for
  their own rendering call, getting back the *real* draft. The state's `nexusPick: 0` pointed at
  index 0 of the neutral array; the renderer looked up index 0 of the real one. Two tests that
  actually check the rendered Nexus power's name (`"the normal panel names the picked Nexus
  power..."`, `"the committed screen names the pick..."`) failed, showing "Reserve Fund" where "Test
  Pick" was expected — everything else was unaffected because nothing else reads
  `context.nexusDraft[state.nexusPick]`. Fixed by making the context construction itself
  (`neutralContext()` in `build-view.test.ts`, the equivalent in `build-spike.test.ts`) the single
  source of truth: build it with the neutral draft once, and pass that same object to both session
  construction and every later render, rather than calling `spikeContext()` a second time and hoping
  the two calls agree. The general lesson: a helper that silently substitutes part of its input is a
  trap the moment any caller keeps its own reference to the original.
- **The panel had zero spare rows before this gate, not some.** The plan going in was to add NEXUS and
  SPECIAL with the same blank-line rhythm the construct groups already use. That overflowed the
  detail block at the 80x24 floor (four pre-existing tests failed, all about the "why refused" text
  surviving on screen) — measured directly with small Node scripts computing `available` versus
  `detail.length` before touching anything, which showed `available === detail.length` already,
  meaning the panel was exactly full before this gate added anything. Fixed by compacting the detail
  block itself (dropping its own internal blank separator, folding the refused tile's coordinate onto
  the reason's own line) rather than only adding rows and hoping there was room. The floor really is a
  floor: it has been exactly full since before this gate, and the next one that wants a panel row
  needs to find a row to give up, not assume there is slack.
- **The perf-budget tests (`thirty frames a second...`, `the worst case stays inside the budget...`)
  flaked twice during this work**, both confirmed as the same pre-existing load-sensitive flake noted
  in earlier gates by simply re-running the suite — not a regression, and not investigated further
  for the same reason it was not in gate 5C.

## 8. Decision

> **PASS**

Every item in Section 1's automated evidence plan is built and passing: drafting blocks every
state-changing command and unblocks on a pick; a pick applies its effect exactly once and cannot be
repeated; `p`/`y`/`n`/Esc behave exactly as specified and commit locks everything after it; the same
pick-build-commit-confirm script produces an identical final state across all three adapters; the
Special slot has its own always-visible row; and real-terminal screenshots exist for the draft, the
confirmation, and the committed screen. The one item Section 1 flagged as answerable only partially —
whether the Special slot's empty space feels like a missing channel — got the honest partial answer
Section 6 gives, rather than an invented one: the slot fits, and the real verdict is Milestone 6's by
the canon's own design. No stop condition was hit; the placeholder content stayed placeholder, and no
Commander Army content was authored.

## 9. Canon impact

Proposed changes, each with the document that would own it. **Nothing here is applied until Mario
accepts the gate.**

| Proposed rule | Would live in | Earned by |
| --- | --- | --- |
| A dealt Nexus power draft blocks every other Build Phase action until one is picked, and a pick cannot be changed afterward | `specs/engine.md` (Build Phase input section) | `lockReason`'s drafting gate, and the pick-cannot-repeat test |
| Committing the Build Phase is a single `y`/`n` confirmation behind one key, and accepting it locks every other action | `specs/engine.md` (Build Phase input section) | the confirm/commit reducer cases and their tests |
| A Build Phase panel with an empty decision channel (Special, and already Army from gate 5B) draws that channel's own row rather than hiding it | `specs/engine.md` Section 9.2 | the SPECIAL row and the precedent it follows |

Questions raised, each already added to [`../specs/open-questions.md`](../specs/open-questions.md) with a
recommendation:

None. This gate's own exclusions (Section 1) already named the two forks it touches without settling
— which border/scrollbar style, and whether the selection marker reads right — and both are gate 5C's
open questions, already registered there, not new ones this gate raises.

## 10. Next authorized action

Mario runs the manual test described in the accompanying check-in message — the two still-open gate
5C comparisons, plus the new draft/commit flow — and either accepts gate 5D or sends back what to
change; 5D is the last gate this milestone's own tracker lists, so accepting it closes Milestone 5 and
the next session's authorized work becomes whichever milestone `milestones/README.md`'s build order
names next.
