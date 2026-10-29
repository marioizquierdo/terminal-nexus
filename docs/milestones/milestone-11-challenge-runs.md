# Milestone 11 — Challenge Mode: Runs

**Status:** CURRENT
**Current step:** 11E — troop movement.
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

### Step 11B — Building actions: upgrades, modes and orders

The owner, 2026-10-22 ([his words](../history/feedback/2026-10-22-runs.md)): "buildings can be selected and buildings
themselves can have actions ... That is the part that I want to formalize and that I want to make sure that our
framework can absorb." The rule is in [`commander-armies.md`](../game-design/commander-armies.md), what changes between
rounds.

- [x] A building card in an army file declares its actions, of three kinds: an **upgrade** (bought with credits, kept
      by that one building for the rest of the match), a **mode** (one of the building's named states, switched between
      rounds and kept until switched again), and an **order** (for the coming Battle Round only). The loader checks them.
- [x] What an upgrade or a mode changes is that building's own content — its attack, its wave, what it trains —
      applied to that building alone and to nothing else of its kind; the kernel resolves the battle unchanged.
- [x] Hold production is an order of this kind, as it plays today.
- [x] Selected in the Build Phase, a building of the player's lists its actions with their keys and prices; an upgrade
      it has is said on its card. Never during a Battle Round, and never on a unit.
- [x] Recall and the next round carry each building's upgrades and mode; a duel side and a run battle play them too.
- [x] First content, to prove it: a Barracks upgrade (its production line: one more trooper a wave) and a Turret
      upgrade, each this building's alone; the Turret's two firing modes (it is the bench's own turret, so the modes show in the game).

### Step 11C — The run army and the draft

The owner, 2026-10-24 ([his words](../history/feedback/2026-10-24-runs-gameplay.md)): "Runs are very exciting! I think
here is where we can start building proper gameplay ... define a full game where I could playtest my ability to
strategically navigate a dynamic environment." The whole run is designed in [`runs.md`](../game-design/runs.md); the steps
from 11C on build it, each playable on its own.

- [x] The run army: a run starts with a small army (Vasse: Barracks, Supply Depot and Turret; Reserve Callup and Drill
      Schedule in the pool) and the battle plays on it, so what is drafted changes what can be built and dealt.
- [x] Every card a run can offer carries `rarity`, `tier` and `role`: the buildings too (the loader checks them), and the
      first Doctrines, written from effects that exist.
- [x] The dealer: three cards by rarity weight, the tier schedule against the battle's place in the run, the pity offset,
      and a family or role the offer lacks before rarity. A test deals many hands from a fixed seed against the weights.
- [x] After a won battle the player drafts: take one of three, or remove a card, or take 15 requisition. The army carries
      into the next battle; the driver drafts through the same functions the screen uses.
- [x] Seed determinism: the same seed and the same drafts give the same run.

### Step 11D — The kept front

The owner, 2026-10-26 ([his words](../history/feedback/2026-10-26-core-loop.md)), after the measured experiment in
[`core-loop.md`](core-loop.md): "double down the RTS style, leaving troops on the map, so they can keep moving forward."
Every mode plays by it ([his next note](../history/feedback/2026-10-26-core-loop.md)): nothing is sent home any more, the
campaign's missions included.

- [x] **Battle Rounds of 30 seconds**, and the number of rounds a battle lasts measured again for it.
- [x] **The regroup.** When a Battle Round ends, survivors stay on the Grid: they disengage, step back and re-form facing
      the enemy, about 10 seconds in all (the idea is the owner's; the numbers are a starting point). It is worked out
      by the rules from the round's last state alone, the same whatever the player does in the Build Phase, so a
      scripted battle stays deterministic.
- [x] **A formation**: each side's survivors form up across its march line, melee in front and ranged behind, the
      Commander in it; reinforcements walk out to it in the next round.
- [x] **Played during the Build Phase**: the regroup is the Build Phase's first 10 seconds on the map, while the player
      builds; placement reads where the troops will stand.
- [x] **A building placed on troops**, friendly or enemy, pushes them out along the ground, the same way every time; on
      screen they move smoothly and may push the troops round them on.
- [x] **One mechanism for every mode**: the walk home is removed; campaign levels play the kept front, their side on the
      level's automatic target or a defensive stand, and their tests are re-pinned to it.
- [x] Duels, the duel scripts and runs play it; the measurement is run again and the snowball read.

### Step 11E — Troop movement

The owner, 2026-10-27 ([his words](../history/feedback/2026-10-26-troop-movement.md)), after the troop movement review:
"Units should be smart enough, smooth, but even more important, predictable." The kept front leaves armies on the map,
so how they move, sort themselves and choose what to fight is what a player reads in every Build Phase. The design is
[`movement.md`](../system-design/movement.md).

- [x] **The chapter**: troop movement as seven rules a player can predict, then each part, what is still to smooth, and
      the strategies it opens.
- [x] **Three states** in the code: march, battle, retreat (`moveStateOf`).
- [ ] The three states in the log, so a filter can show a unit changing state (needs a new event kind).
- [x] **Vision**, 6 columns by default, set per unit in content (`vision`, where `engageRange` was).
- [x] **Commitment**: a unit keeps its target until it falls or it has gone 2½ seconds unable to strike it; what made
      units change target so often is found and written down.
- [x] **The formation's priority list** (flanker, melee, ranged; then range; then class) and its one rule: half speed on
      the march while an ally of higher priority is in vision. The Commander is a regular troop; the regroup forms the
      same order.
- [x] **"Flanker"** for the line that goes behind the enemy's front, in content and code.
- [x] The tests that pin a battle are re-pinned with a reason each, never loosened; the quick spec measured before
      and after each half (stalled units 274 → 528 with the formation, → 420 with commitment).
- [ ] The full spec measured and kept in the history, as a change to how common units choose asks.
- [x] **A target a unit cannot reach is let go at once**, and a unit that can reach none in sight looks further afield
      for one it can; with none it stands as near as it can get. Measured against holding it: no-route standing is 28%
      lower on the Crossing's duels and 69% lower on the open Pocket's, and a fair battle through a narrow pass blocks
      11% to 19% fewer unit-ticks. (Marching on past the fight was built and measured twice and left out: the same on
      every measure.)
- [x] **The engage scenarios**: six battles of the same armies on open ground, gaps, a corridor and lanes, to read speed and
      how many units strike against ([`measurement.md`](../system-design/measurement.md)); and what was tried to speed
      engagement up (the chapter's "To smooth later" lists it: nothing beyond 5%).
- [ ] The queue that is left: melee troops waiting behind a striking front at a gap, mostly geometry, and tested ten ways
      without a gain beyond noise ([the chapter](../system-design/movement.md), "To smooth later"). More ways round (a
      map with more gaps), and what holds flyers back where the ground is tight, are the next things to settle.
- [ ] Units pacing between two tiles at a door (about five a battle at a one- or two-row gap), the same before this step.

Left for later, on purpose: the march route drawn on the Build Phase (the owner: "not yet"), smoothing (the chapter's
list), and the workers' jobs (Milestone 7).

### Step 11F — The stance

- [ ] A Build Phase row for the army's stance for the coming round: **aggressive** (march on the enemy Nexus, as today),
      **hold the line** (stand in formation where the regroup left them and fight what comes in reach), **defensive**
      (fall back to the base and defend it). Carried out in the Battle Round like a building's order.
- [ ] **The march line drawn** on the Build Phase map: from the Commander to where the stance sends the army, Nexus to
      Nexus while she is out.
- [ ] The duel scripts choose a stance (hold or fall back when their front is beaten), so a kept front has an answer.
- [ ] Campaign levels keep their automatic target.

### Step 11G — The banner

- [ ] **A banner** placed in the Build Phase, aggressive or defensive; by default on the enemy Nexus, aggressive.
      Aggressive elsewhere: the army goes there first, then on to the enemy Nexus (a route). Defensive: it holds the line
      there (map control, or the base defended). It replaces the stance row.
- [ ] The march line runs to the banner; the duel scripts place one.

Two banners — the Commander following the main one, buildings set to send their units after a second — are the
direction after this ([`core-loop.md`](core-loop.md)); they wait until the map holds resources and bonuses worth
splitting an army for.

### Step 11H — The route

- [ ] The route from the seed: three acts of three steps and a boss, stops by kind, intel one step ahead, every offer from
      a stream of its own so a path never moves what another would have offered.
- [ ] The Nexus's health carries from battle to battle; requisition is earned and spent.
- [ ] The route screen: choose the next stop with the keys, the mouse and the driver; every stop's kind and reward shown.
- [ ] Exchange and Workshop stops, built on the draft's cards and the Nexus's health.

### Step 11I — Opponents, bosses and signals

- [ ] An enemy's kit (plan, cards kept, credits) by act, a Stronghold's and a boss's; each act ends in a named Commander.
- [ ] Signals: the three templates, in the interface's own voice.
- [ ] A driver-played run that only takes commons either wins at the base difficulty or the finding is recorded and the
      tuning changed.

### Step 11J — The run shell

- [ ] The summary: the route taken, every draft taken and refused, the Nexus's health battle by battle, and the lost
      battle's report. Seed entry when starting a run, and a short run of one act.
- [ ] Every item works by hotkey, click and driver, and adapts across the viewport range like every other screen.

### Step 11K — Playing it

- [ ] Mario plays runs and his notes become a feedback round; the numbers in `runs.md` move to what was played, and
      the tuning table says why.

## Out of scope

- Daily seeds, leaderboards, an ascension-style difficulty ladder, and any online feature.
- Progression beyond unlocks into the pool (Q41).
- Veterans carrying over between battles (Q40). If a toggle is cheap, make it observable, but do not
  design around it.
- Campaign text or missions.
- Multiplayer.
- Authoring the real rosters (Milestone 12). This milestone runs on bench content and says so.

## How it is judged

Automated: step 11A's seed determinism across runs and both runtimes; step 11C's dealer distribution
within tolerance; step 11I's commons-only run recorded either way; every run screen at every colour depth; the driver plays a whole run with no terminal.

Human, and this is the real test: Mario plays a run, can say afterwards why he won or lost from the
summary alone, and wants to start another. The second half of that sentence is the mode's entire
reason to exist.

## Done when

- [ ] Steps 11A through 11K are built and tested.
- [ ] The tuning table in the game-modes design shows the numbers the run was actually tuned to, and
      why they moved.
- [ ] Q40 and Q41 are either answered by Mario or proceeded under their recommendation, and the pull
      request says which.
- [ ] The pull request states plainly that the run played on bench content, so nobody mistakes it for
      a judgement of balance for a roster that does not exist yet.
- [ ] `./scripts/check-repository.sh` passes.
