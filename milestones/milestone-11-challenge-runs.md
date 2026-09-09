# Milestone 11 — Challenge Mode: Runs

**Document role:** Milestone tracker — a seeded run of battles with a run draft between them, playable end to end
**Status:** GATED
**Depends on:** Milestone 5 (Build Phase), Milestone 6 (the Pulse loop and a result), Milestone 8 (a Commander exists and the Nexus draft deals from an army's pool); Milestone 3's mode select hands off here
**Updated:** 2026-09-09
**License:** Apache-2.0

> **The replayable mode, and the one that needs no writing.** Mario, canon 2.11: "implementing
> 'runs', where each battle ends on a new draft upgrade or removals that further polish the build
> for the next battle. This could have huge replayability value." A run exercises the army-as-deck
> model ([`../specs/commander-armies.md`](../specs/commander-armies.md) Section 2.1) harder than any
> mission, needs no authored text, and is where the game's long-term value lives. It is built as
> soon as the match UX can carry it, before the Campaign's own second mission, for exactly those
> reasons. [`../specs/game-modes.md`](../specs/game-modes.md) Section 3.2 is the design this builds
> against; its numbers are starting values this milestone retunes.

## 1. Question

Can a player start a seeded run from the game menu, play a short series of battles against
escalating Commander Armies, change their army between battles through a run draft — add a card,
remove one, or upgrade one — and finish, win or lose, with a summary they can learn from, such that
**the same seed produces the same run every time**?

## 2. Gates — small, in order, each closable on its own

- **11A — Run skeleton.** A `RunDefinition` (`seed`, the Commander chosen at run start per Q46, acts,
  the battle list generated from the seed);
  three battles on existing fixture maps against the Ravel fixture army under a static or simple
  heuristic policy; a plain "next battle" screen between them; a run summary at the end. The driver
  ([`../specs/engine.md`](../specs/engine.md) 9.7) plays it end to end. Seed determinism asserted:
  same seed and same driver script, same battles, same outcomes, same summary.
- **11B — The run draft.** The between-battle screen offers **add one of three**, **remove one**, or
  **upgrade one** (structure levels 1–3, `engine.md` 5.2). The dealer implements `game-modes.md`
  Sections 3.2 and 4: rarity weights, the tier schedule against the battle index, the pity offset,
  role variety before rarity. Every card on the bench carries its `rarity`/`tier`/`role` tags. A test
  deals many hands from a fixed seed and checks the distribution against the declared weights.
- **11C — Escalation and bosses.** Opponents strengthen by act; each act ends in a named Commander's
  army (Milestone 8's Commander mechanic, a second time). The "commons can win at base difficulty"
  rule of `game-modes.md` Section 4 is checked by a driver-played run that only ever picks commons —
  pass, or the finding is recorded and the tuning changed.
- **11D — Run shell UX.** The run map (acts and battles ahead), the summary (deck, seed, every draft
  taken, the losing battle's report), seed entry when starting a run; every item by hotkey, click,
  and driver; adaptive across the viewport range like every other screen.

## 3. Explicitly not this milestone

Daily seeds, leaderboards, an ascension-style difficulty ladder, any online feature; meta-progression
beyond unlocks into the pool (Q41); veterans carrying over between battles (Q40 — if a toggle is
cheap, make it observable, but do not design around it); Campaign text or missions; multiplayer;
authoring the real rosters (Milestone 12 — this milestone runs on bench content and says so in its
report).

## 4. Acceptance

Automated: 11A's seed determinism across runs and both runtimes; 11B's dealer distribution within
tolerance; 11C's commons-only run recorded either way; every run screen at all four capability tiers
and monochrome; the driver plays a whole run with no terminal.

Human, and this is the real gate: Mario plays a run, can say afterwards why he won or lost from the
summary alone, and wants to start another. The second half of that sentence is the mode's entire
reason to exist.

## 5. Definition of done

- [ ] 11A through 11D closed, each with its own short evidence note in one gate report;
- [ ] `game-modes.md` Section 3.2's table updated with the numbers the run was actually tuned to,
      and why they moved;
- [ ] Q40 and Q41 either answered by Mario or explicitly proceeded-under-recommendation in the
      report;
- [ ] the report states plainly that the run played on bench content, so nobody mistakes it for
      balance evidence about a roster that does not exist yet;
- [ ] `./scripts/check-repository.sh` passes.
