# Milestone 11 — Challenge Mode: Runs

**Status:** CURRENT
**Current step:** 11A — the run skeleton: three battles from a seed, each a duel against a Commander Army played on the Build Phase screen.
**Depends on:** Milestone 5 (Build Phase), Milestone 6 (the Battle Round loop and a result), Milestone 8 (a Commander exists and the Nexus Pulse deals from an army's pool); Milestone 3's mode select hands off here

Made current on 2026-10-22, when the owner closed Pathfinding: "For now, we want to focus on building a basic game
loop. Let's move into the next most important milestone" ([his words](../history/feedback/2026-10-21-pathfinding-wrap-up.md)).
Since this plan was written, duels were built (`src/duel/`, [`duels.md`](../system-design/duels.md)): two Commander
Armies fought round by round, each planned by a script or a model under the Build Phase's own rules. **A run's battle
is a duel**: the player plans one side on the Build Phase screen, a scripted player plans the Commander Army on the
other. That is the "heuristic policy driving a Commander Army" the design names, already built and measured.

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

- [x] A run's definition from its seed: the player's Commander, and three battles, each against Dob Hunter's Ravel
      army (the "Ravel fixture army" this step first named) on a duel map, with a battle seed of its own.
- [x] **A run battle is a duel played on the Build Phase screen**: the player plans one side as in a campaign level
      (the menu, the Nexus Pulse's hand, the Battle Round), a scripted duel player plans the Commander Army on the
      other; plans reveal together; the battle goes round by round until a Nexus falls or its rounds run out.
- [x] A plain "next battle" screen between battles, and a run summary at the end; a lost battle ends the run.
- [x] The title menu's Challenge row starts a run, its seed shown; `challenge?seed=<n>` opens one from the command
      line, the scripted playtest and the browser page.
- [x] The driver plays the run end to end, headless, through the same functions the screen uses.
- [x] Seed determinism is asserted: the same seed and driver script give the same battles, outcomes and summary.

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
within tolerance; step 11C's commons-only run recorded either way; every run screen at every colour depth; the driver plays a whole run with no terminal.

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
