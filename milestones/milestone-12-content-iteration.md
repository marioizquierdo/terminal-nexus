# Milestone 12 — Content and Balance Iteration

**Document role:** Milestone tracker — the repeating pass that adds cards with rarity and tier, authors the real rosters, and tunes both modes on playtests
**Status:** GATED
**Depends on:** Milestone 11 (a run to play new content in) and Milestone 10 (missions to teach it in); this milestone repeats rather than closes once
**Updated:** 2026-09-09
**License:** Mechanical definitions Apache-2.0; creative identity of any roster CC BY-SA 4.0

> **Content comes after the experience, on purpose.** Mario, canon 2.11: "Once we create some
> vocabulary and structure for the single player modes, we should jump right away into building the
> actual game experience and UX. And later, when we have the UI/UX working, we can start adding new
> units and upgrades, iterating on the game modes as we do more playtesting." Everything before this
> milestone runs on disposable bench content. This is where the real Citizens and Ravels rosters —
> the "Commander Army selection" workstream
> [`../specs/project-governance.md`](../specs/project-governance.md) Section 5 has kept gated since
> canon 2.0 — finally get authored, one card at a time, each judged in a run and in a mission.

## 1. Question

With the UX working and both modes playable, does each new card make a run more interesting and let
a mission teach it — measured, not asserted, by runs the driver plays and runs people play?

## 2. Gates — a loop, not a line

- **12A — The first real rosters.** The smallest Citizens and Ravels Commander Armies per
  [`../specs/commander-armies.md`](../specs/commander-armies.md) Sections 5 and 6: common tier,
  army tier, Nexus power pool, one Commander each (Vasse and Corvane), every card tagged with
  `rarity`/`tier`/`role`, and the faction rule shapes of Section 4.1 that Milestone 1 already proved
  cheap (volatile munitions, shared cadence). Bench content retires or is promoted card by card;
  nothing carries over by default.
- **12B — Measure.** Pick rate and win rate per card, per tier, per act, from driver-played runs
  under a few simple policies and from human sessions, into a small report the way `grid`'s report
  already derives everything from events. The Slay the Spire discipline
  ([`../specs/game-modes.md`](../specs/game-modes.md) Section 5): weekly-sized changes, metrics read
  with suspicion, fun judged by people.
- **12C — Tune and add.** Retune rarity, tier, and cost from 12B; add the next few cards; return to
  12B. A second Commander per faction only once the first plays distinctly
  (`commander-armies.md` Section 6, step 4).

## 3. Explicitly not this milestone

Glitch, Feudals, or Alder content (lore and art direction until Citizens and Ravels prove the loop,
`commander-armies.md` Section 6); new modes; multiplayer; a public mod loader — content contracts are
kept mod-shaped ([`../specs/engine.md`](../specs/engine.md) Section 11) without building the loader.

## 4. Acceptance

Automated: every card has a named scenario exercising its rule (`../AGENTS.md` Section 7's own
convention), determinism holds across runs and runtimes after every content change, and 12B's report
regenerates from logs alone.

Human: a player who has never read the lore can state each faction's philosophy from a run
([`../specs/terminal-nexus-lore.md`](../specs/terminal-nexus-lore.md) Section 8.6 — the alignment
test, now applied to real rosters rather than bench fixtures).

## 5. Definition of done — per pass

- [ ] the pass's cards are authored with tags, scenarios, and a line each in the report;
- [ ] 12B's numbers are in the gate report, with the interpretation kept separate from them;
- [ ] `commander-armies.md` and `game-modes.md` updated with what the pass actually learned;
- [ ] `./scripts/check-repository.sh` passes.
