# Milestone 11 — Challenge Mode: Runs

**Status:** PLANNED
**Depends on:** Milestone 5 (Build Phase), Milestone 6 (the Battle Round loop and a result), Milestone 8 (a Commander exists and the Nexus Pulse deals from an army's pool); Milestone 3's mode select hands off here

This is the replayable mode, and the one that needs no writing. Mario's brief: "implementing 'runs',
where each battle ends on a new draft upgrade or removals that further polish the build for the next
battle. This could have huge replayability value." A run exercises the Commander Army composition
model ([`docs/game-design/commander-armies.md`](../game-design/commander-armies.md)) harder than any
mission. The structures, upgrades, Nexus powers and Specials are all real pools a run draft can touch,
though the old "deck" framing is retracted. A run needs no authored text, and it is where the game's
long-term value lives. It is built as soon as the match experience can carry it, before the Campaign's
second mission. [`docs/game-design/game-modes.md`](../game-design/game-modes.md) is the design this
builds against; its numbers are starting values this milestone retunes.

## Question

Can a player start a seeded run from the game menu, play a short series of battles against escalating
Commander Armies, change their army between battles through a run draft (add a card, remove one, or
upgrade one), and finish, win or lose, with a summary they can learn from, such that **the same seed
produces the same run every time**?

## Steps

Small, in order, each finishable on its own.

### Step 11A — Run skeleton

- [ ] A `RunDefinition` holds the `seed`, the Commander chosen at run start from Challenge's own
      unlocked roster (basic packages from the outset, more unlocked by playing Challenge itself; Q46),
      the acts, and the battle list generated from the seed.
- [ ] Three battles on existing fixture maps against the Ravel fixture army, under a static or simple
      heuristic policy.
- [ ] A plain "next battle" screen between battles, and a run summary at the end.
- [ ] The driver plays the run end to end.
- [ ] Seed determinism is asserted: the same seed and driver script give the same battles, outcomes and
      summary.

### Step 11B — The run draft

- [ ] The between-battle screen offers add one of three, remove one, or upgrade one (structure levels
      1 to 3).
- [ ] The dealer follows the game-modes design: rarity weights, the tier schedule against the battle
      index, the pity offset, and role variety before rarity.
- [ ] Every card on the bench carries its `rarity`, `tier` and `role` tags.
- [ ] A test deals many hands from a fixed seed and checks the distribution against the declared
      weights.

### Step 11C — Escalation and bosses

- [ ] Opponents strengthen by act, and each act ends in a named Commander's army (Milestone 8's
      Commander mechanic, used a second time).
- [ ] The rule that commons can win at base difficulty is checked by a driver-played run that only ever
      picks commons. Either it passes, or the finding is recorded and the tuning changed.

### Step 11D — Run shell

- [ ] The run map (acts and battles ahead).
- [ ] The summary: army, seed, every draft taken, and the losing battle's report.
- [ ] Seed entry when starting a run.
- [ ] Every item works by hotkey, click and driver, and adapts across the viewport range like every
      other screen.

## Out of scope

- Daily seeds, leaderboards, an ascension-style difficulty ladder, and any online feature.
- Progression beyond unlocks into the pool (Q41).
- Veterans carrying over between battles (Q40). If a toggle is cheap, make it observable, but do not
  design around it.
- Campaign text or missions.
- Multiplayer.
- Authoring the real rosters (Milestone 12). This milestone runs on bench content and says so.

## How it is judged

Automated: step 11A's seed determinism across runs and both runtimes; step 11B's dealer distribution
within tolerance; step 11C's commons-only run recorded either way; every run screen at all four
capability tiers and monochrome; the driver plays a whole run with no terminal.

Human, and this is the real test: Mario plays a run, can say afterwards why he won or lost from the
summary alone, and wants to start another. The second half of that sentence is the mode's entire
reason to exist.

## Done when

- [ ] Steps 11A through 11D are built and tested.
- [ ] The tuning table in the game-modes design shows the numbers the run was actually tuned to, and
      why they moved.
- [ ] Q40 and Q41 are either answered by Mario or proceeded under their recommendation, and the pull
      request says which.
- [ ] The pull request states plainly that the run played on bench content, so nobody mistakes it for
      a judgement of balance for a roster that does not exist yet.
- [ ] `./scripts/check-repository.sh` passes.
