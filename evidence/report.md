# Gate report — Milestone 1A, the Pulse Playground

**Document role:** Gate evidence report for Gate 1A
**Status:** In progress
**Canon version:** 2.5
**Updated:** 2026-08-21
**License:** Apache-2.0

---

## 1. Frame — written before coding

- **Canon version:** 2.5
- **Milestone and gate:** Milestone 1 — the Pulse Playground; Gate 1A (CURRENT).
- **Question this gate answers:** Does a scenario file plus a seed resolve into a byte-identical
  report every time, and can a person watch that same Pulse and follow what happened?
- **Smallest artifact that can answer it:** one TypeScript source tree with no build step, holding a
  deterministic rules kernel (Grid, collision masks, tick loop, movement credit, arbitration,
  attacks, damage, victory), a scenario file format and loader, a levelled report derived only from
  events plus state, a minimal ASCII view over `ReadonlyCellFrame`, and a `playground` CLI with
  `run`, `watch`, and `verify`. Plus one scenario per rule in `scenarios/`, and the tests of
  Section 3.9.
- **Automated evidence planned:**
  - determinism: 20-run hash equality per scenario; one-call resolve equals tick-by-tick; kernel
    touches no clock and no `Math.random` and imports nothing from `src/view`; PRNG matches vectors
    generated from the public-domain C reference; cosmetic seed changes nothing; `parse(serialize())`
    hashes identically; **identical hashes under Bun 1.3.11 and Node 22.22.2**;
  - Grid and collision: no overlap in any mask including both layers at any tick; worker and ground
    unit may share a tile; cross-layer blocking by a structure; the 3x1 hauler refused a two-tile
    gap and admitted to a three-tile one; footprints never leave the Grid; range to the nearest
    occupied tile; arbitration bounded with a strictly decreasing progress measure under a jammed
    corridor;
  - rules: the movement-credit cadence table at every rate; blocked actors keep credit; mutual kills
    kill both; one named scenario file per rule;
  - view: exact composition size, width-one glyphs, pure `snapshotAt`, frame-skip independence,
    30 fps over 60 s with p95, one disposer on every lifecycle path, resize gate freezing and
    resuming presentation time, **glyphs on authoritative tiles asserted against the event stream**,
    `watch` and `run` agreeing on hashes, monochrome rendering without error.
- **Human observation planned:** Mario watches `playground watch scenarios/citizen-mirror-skirmish.ts`
  in colour and again in monochrome, and is asked: could you follow who moved, who shot whom, and
  who died? The monochrome answer is the gate's legibility check and no automated test substitutes
  for it (governance Section 2).
- **Explicit exclusions:** Gate 1B render tiers and effects; economy, production, supply, upgrades,
  the Commander, visibility filtering, the Build Phase, selection, inspection, scrolling; every
  faction except Citizens; packaging, SSH, browser delivery, multiplayer, sound, mod loading; any
  Rust or Go migration. Economy and production exist as **empty tick phases** only.
- **Stop conditions:**
  - the same seed and scenario produce different hashes on one machine, or between Bun and Node, and
    the cause is not fixable inside this gate — **STOP**, since every later question depends on it;
  - the ASCII view cannot show a mirror skirmish legibly at 80x24 in monochrome — **REVISE** on the
    composition, named;
  - OpenTUI fails exact cell control, 30 fps on a 24x12 Grid, the lifecycle of Section 3.8, or a
    version pin that holds still for the gate — **REVISE with that criterion named**, per
    Section 3.8, and ship the direct-ANSI fallback;
  - a named contract in the milestone turns out to be wrong — **REVISE** naming the contract, which
    the milestone explicitly calls a good result.

## 2. Environment — pinned, not remembered

| | |
| --- | --- |
| OS and architecture | Linux 6.18.44 x86_64, Debian-based Claude Code web container |
| Runtime and exact version | Node.js v22.22.2 and Bun 1.3.11 (both present; both run TypeScript with no build step) |
| Dependencies and exact versions | (recorded in Section 4 once the backend decision is evidenced) |
| Hardware, if it affects measurements | Container CPU; frame-time numbers are indicative of this container only |
| Date measured | 2026-08-21 |

Commands, copy-pasteable, in the order a stranger would run them:

```bash
# install
# build
# test
# run
```

## 3. What was built

To be filled in as the work lands.

## 4. Automated results

| Check | Result | Evidence |
| --- | --- | --- |
| | | |

Measurements:

| Metric | Value | Method | Samples |
| --- | --- | --- | --- |
| | | | |

## 5. Human observations

Nobody has watched it yet.

## 6. Interpretation

To be written after Section 4 is complete.

## 7. Failures, surprises, and discarded approaches

To be filled in as they happen.

## 8. Decision

> Pending.

## 9. Canon impact

| Proposed rule | Would live in | Earned by |
| --- | --- | --- |
| | | |

Questions raised, each already added to [`../specs/open-questions.md`](../specs/open-questions.md)
with a recommendation:

| ID | Question | Recommendation |
| --- | --- | --- |
| | | |

## 10. Next authorized action

Pending the decision in Section 8.
