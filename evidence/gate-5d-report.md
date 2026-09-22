# Gate report — Milestone 5, Gate 5D: the Nexus draft slot and commit

**Document role:** Gate evidence report for Gate 5D
**Status:** IN PROGRESS — Sections 1 and 2 written before any code
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
