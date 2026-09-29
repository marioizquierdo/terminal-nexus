# Gate report — Milestone 6, Gate 6A: Start, end, Recall

**Document role:** Gate evidence report for Gate 6A
**Status:** IN PROGRESS — frame written before coding; the rest is filled in as the work proceeds
**Canon version:** 2.26
**Updated:** 2026-09-29
**License:** Apache-2.0

---

## 1. Frame — written before coding

- **Canon version:** 2.26 (no change planned; canon proposals go to Section 9 and wait for acceptance).
- **Milestone and gate:** Milestone 6 — Nexus Pulse Phase, gate 6A, "Start, end, Recall"
  (`milestones/milestone-06-pulse-phase.md`). Promoted to CURRENT on 2026-09-29 when Mario accepted
  Milestone 5.
- **Question this gate answers:** can a player press `p`, answer yes, watch the Build Phase's plan
  become a Nexus Pulse that the unmodified kernel resolves, and then tell — unprompted — that the Pulse
  ended, why (won, lost, or ran out of time), and that the survivors went home?
- **Smallest artifact that can answer it:** the existing `--spike` screen (terminal and browser page),
  with the `p` question's "yes" now handing the committed plan to the kernel through the application
  shell. Everything new is a connection, not a rewrite:
  - **Start**: the committed plan (standing structures + planned buildings) plus a placeholder
    starting force and a placeholder raid, as data on the Build Phase's context (like the placeholder
    Nexus powers), becomes the kernel's opening state and is resolved once (`buildTimeline`, ~60 ms).
  - **The Pulse on screen**: the Build Phase's own frame (top bar, closed Grid rectangle with the map's
    edge, panel on the left, bottom bar, popups), drawing the resolved Pulse through the same
    cursor-driven camera — because a 96 × 40 map does not fit the 48 × 16 pane the old Pulse view
    draws. The panel carries the forces, the recent events and the controls.
  - **The end**: the sequence Mario sketched (`milestone-06-pulse-phase.md` Section 2.2) as a pure
    function of presentation time — an alarm, the fight stopping, effects in flight finishing, survivors
    walking home, then a result that names the outcome and its reason. Four timings are Experiments.
  - **Recall**: the rule `engine.md` Section 5 already states (survivors regroup near home producers,
    orphans near the Grid Nexus, production cooldowns reset), as a pure end-of-Pulse function in a new
    rules-layer folder (`src/match/`), beside the kernel and never inside its tick.
- **Automated evidence planned:**
  - the kernel is unchanged: `git diff origin/main -- src/pulse src/state src/scenario src/grid
    src/content/types.ts` is empty, and every existing determinism and rules test stays green;
  - the opening state is deterministic and validated (overlaps, rock, bounds); the same plan gives the
    same state and event hashes across repeated runs, and effects, cosmetic seed, glyph pack, speed and
    pause change none of them;
  - Recall: survivors land on free tiles near their home (a compatible producer, else the Nexus, else
    they stay), never overlap under their collision masks, and cooldowns reset; deterministic;
  - the ending plan: phases in order at every Experiment value; the result appears once the walk-back
    ends; walk-back positions run from where the fight left each unit to its Recall tile;
  - all three endings (won, lost, timed out) reachable from the spike's own data and legible in frames,
    in monochrome too — the words carry the cue, not the colour;
  - keyboard, mouse and driver start the Pulse identically; the playback keys are named commands with a
    click on their panel rows; a restart from the game menu goes back to a fresh Build Phase;
  - the Build Phase's reducer and the rules layer still name no clock; the view still never reaches the
    kernel; `tests/architecture.test.ts` says so.
- **Human observation planned:** Mario plays the merged build, watches the ending, flips the four
  ending Experiments in Settings (`d`), and pastes his export. He is asked whether the alarm reads as
  anticipation or noise, and whether the result is clear without being told.
- **Explicit exclusions:** the loop back into a second Build Phase, the trigger runner, waves and
  `win`/`lose` triggers, Q36's defender-wins-on-time-out rule (all 6B); automatic production (6C);
  PERIMETER's real map, units and three waves; live numbers on the map cursor; sound; hiding the
  enemy's opening from the Build Phase; routing for the walk home (a straight glide); any kernel change.
- **Stop conditions:** the Pulse cannot start or end legibly without changing `src/pulse` (that is a
  finding, and the gate stops there); a clock creeps into the reducer or `src/match`; keyboard, mouse and
  driver stop producing the same start; a state field only presentation reads is needed in `MatchState`
  (Recall would need a "home producer" link in state — a schema change that is not this gate's).

## 2. Environment — pinned, not remembered

| | |
| --- | --- |
| OS and architecture | Linux 6.18 (x86-64 container) |
| Runtime and exact version | Node v22.22.2; Bun 1.3.11 |
| Dependencies and exact versions | from `package-lock.json` (`npm ci`): TypeScript 7.0.2, `@opentui/core` 0.5.6, `gifenc` 1.0.3, `pngjs` 7.0.0, `@types/node` 22.20.1 |
| Hardware, if it affects measurements | container CPU; timings below are indicative only |
| Date measured | 2026-09-29 |

Commands, copy-pasteable, in the order a stranger would run them:

```bash
# install
npm ci
# build
bun scripts/build-web.mjs
# test
npm run typecheck && npm test && npm run test:bun && ./scripts/check-repository.sh
# run
./bin/terminal-nexus.ts --spike
./bin/terminal-nexus.ts --spike --keys "n 2 1 Enter p y"       # open already in the Pulse
node scripts/playtest.mjs --keys "n 2 1 Enter p y wait~4000*8" --print final
```

Baseline before this gate (the merged Milestone 5 build): typecheck clean, Node 585 / 585.

## 3. What was built

(filled in as the work lands)

## 4. Automated results

(filled in as the work lands)

## 5. Human observations

Nobody has looked at this yet. (To be filled in from what a person actually saw.)

## 6. Interpretation

(after the results)

## 7. Failures, surprises, and discarded approaches

**Found before writing any code:**

- **The Recall rule does not run.** `open-questions.md` Q29's answer says the end-of-Pulse regroup
  "already runs", and `milestone-06-pulse-phase.md` calls it "already correct, unbuilt as a
  presentation beat". A search of `src/` and `tests/` for `regroup` and `recall` finds nothing: the
  rule is written in `engine.md` Section 5 and implemented nowhere, and `MatchState` has no link from a
  unit to a producer. So Recall is built here as a state change, not only a beat.
- **The old Pulse view cannot draw the Build Phase's map.** `composeFrame` draws every tile at a fixed
  48 × 16 pane with the pre-5F chrome (a panel on the right, "the grid tool" in the header). The
  Build Phase's Grid is 96 × 40.
- **The spike's Barracks does nothing in the kernel** (no `spawn`, and the production phase is empty),
  so "Trains troopers each Pulse" is not yet true. 6C's job; noted so nobody is surprised.

## 8. Decision

(after the work)

## 9. Canon impact

(proposals, once built)

## 10. Next authorized action

(after the work)
