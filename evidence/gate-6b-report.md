# Gate report — Milestone 6, Gate 6B: The loop and the trigger runner

**Document role:** Gate evidence report for Gate 6B
**Status:** IN PROGRESS — frame written before coding
**Canon version:** 2.30
**Updated:** 2026-09-30
**License:** Apache-2.0

---

## 1. Frame — written before coding

- **Canon version:** 2.30 (no change planned; canon proposals go to Section 9 and wait for acceptance).
- **Milestone and gate:** Milestone 6 — Nexus Pulse Phase, gate 6B, "The loop and the trigger runner's
  simulation band" (`milestones/milestone-06-pulse-phase.md`). Active since 2026-09-30, when Mario
  accepted gate 6A.
- **Question this gate answers:** after Recall, does the player land in the next Build Phase with what
  survived — and does a mission, written as data, decide what each Pulse brings and when the whole
  thing is won or lost, on the unmodified kernel, hash-stable across runs and runtimes?
- **Smallest artifact that can answer it:**
  - **A mission as data** (`src/mission/`): named regions and a trigger list — a condition and a list of
    actions — with the simulation band at the size PERIMETER needs: `spawn` (units at a region, with a
    group name, an order and an optional line of intention), `order`, `commitPlan` (the raid's own
    structures for a Pulse), `win`, `lose`. Conditions: a moment in a Pulse (`{ pulse, tick }`), a Pulse's
    end, a side's Nexus destroyed. Validated when loaded: every reference, every range, and that the
    mission always ends.
  - **A trigger runner** (`src/match/`), beside the kernel: builds a Pulse's opening state from what the
    last Pulse left (after Recall), the new plan and the tick-0 actions; steps the kernel's own
    `stepTick` and applies a later `spawn` between ticks with the kernel's own conventions and events;
    then reads the Pulse-end triggers for the mission's verdict — continue, won or lost.
  - **The loop on screen**: after the result, `[enter] Next round` (or, as an Experiment, on its own) opens
    Build Phase 2 on what survived — the player's buildings and units where Recall put them, the raid's
    leftovers where they stood, the unspent credits — and the round's Battle Round screen says what the
    mission wrote for it. The last round's result says whether the mission was won or lost.
  - **PERIMETER's three waves** on the Build Phase's map, replacing the placeholder Pulse and its Raid and
    Your units Experiments.
  - **The start of intentions** (the owner's direction at 6A's acceptance): the next Pulse's arrivals are
    shown on the map during the Build Phase, and a spawned group may carry a line of intention the
    Explore Map card reads. On/off as an Experiment.
- **Automated evidence planned:**
  - the kernel is unchanged: `git diff origin/main -- src/pulse src/state src/scenario src/grid
    src/content/types.ts src/events src/rng` is empty;
  - validation refuses, by name, every broken mission shape (unknown region, unit or structure, a
    `spawn` at a Pulse's end, a tick past the Pulse, a Pulse past the mission, duplicate ids, an order
    for a group nobody spawned, an order the kernel cannot carry out, a last Pulse that decides nothing);
  - a whole mission resolved twice, and on Node and Bun, gives the same state and event hashes per Pulse;
    resolving tick by tick equals the runner; the cosmetic seed and every Experiment but the plan change
    nothing about state;
  - a mid-Pulse spawn appears at its tick with the kernel's own `entity.spawned` event, and counts for
    victory;
  - the carried state: survivors keep their health and ids, destroyed buildings stay gone, a building
    planned on a unit moves the unit aside;
  - the three endings a mission can have reachable from PERIMETER's own data (won, lost on a fallen
    Nexus, and a round lost but the mission going on);
  - keyboard, mouse and a driver play a round into the next Build Phase identically; Restart restarts
    the mission;
  - `tests/architecture.test.ts`: the Build Phase and the view still never reach the kernel.
- **Human observation planned:** Mario plays PERIMETER through, flips **Next round** and **Incoming
  wave**, pastes his export, and says whether the loop reads without being told.
- **Explicit exclusions:** automatic production (6C); the presentation band (`focus`, `card`, `say`,
  `bark` — Milestone 9); a real opponent policy; PERIMETER's own map (Q38); an order the kernel can carry
  out other than "engage the nearest enemy"; saving a mission; any kernel change.
- **Stop conditions:** a wave cannot arrive, or the verdict cannot be decided, without changing
  `src/pulse` (a finding, and the gate stops there); a clock or unseeded randomness enters `src/mission`
  or `src/match`; keyboard, mouse and driver stop landing in the same next Build Phase.
