---
name: skirmish
description: The skirmish command (bin/skirmish.ts), the game played headless: a Battle Round from a board written by hand (a sandbox), a battle from a save or a new setup, every Commander pairing, many seeds, build actions by script or model agent. Use to verify a rule, unit, ability or army change, to debug a Battle Round from its log, to write a sandbox, to play a person's save on, and when Mario asks how armies compare.
---

# The `skirmish` command: the game, headless

The same Skirmish the screen plays, for an agent: every Battle Round runs on the battle engine the game runs on, so what a
run shows is what a player meets. It is the verifier for most changes ([`testing.md`](../../../docs/system-design/testing.md),
unit tests and verifiers); a rule that must stay true becomes a unit test at its layer. A script is not a person: a
result says where to look, and Mario's play says how it feels.

This page is the procedure; the owners of each meaning:

- **The command's manual** is the comment [`src/cli/skirmish.ts`](../../../src/cli/skirmish.ts) opens with
  (`npm run skirmish -- --help`): every option, what it refuses, the exit codes.
- **Which check at which layer, and the shapes a verifier takes**: [`testing.md`](../../../docs/system-design/testing.md).
- **The rules, the brief, the build actions, formations, biases, the maps for testing and how a battle is read**:
  [`battles.md`](../../../docs/system-design/battles.md).
- **The save file, and a board written by hand (a sandbox) with what it leaves out**:
  [`skirmish-saves.md`](../../../docs/system-design/skirmish-saves.md).

## 0. One Battle Round from a board written by hand

For an engine question (a hit, a death, a step, an ability, an effect on state, how units engage on a kind of ground):
a sandbox, the engine with nothing of the game around it. Done when the log shows the decision that produced the
outcome and the pictures show where it happened.

```bash
npm run sandboxes                                                         # the checked-in boards
npm run skirmish -- --load sandboxes/rules/melee-kill.save.json --play-to next --show 0,20,end
npm run skirmish -- --load <sandbox> --play-to next --log-level debug --log run.log   # every decision, per tick
```

- **Write one** by copying the nearest (`sandboxes/rules/melee-kill.save.json` is the smallest; a multi-tile unit is
  `sandboxes/showcase/heavies-clash.save.json`) into the scratchpad, `notes` saying the one thing it shows. Draw only
  what the question needs: the map inline, both slots `script:idle`, `rounds` 1, a box of units per slot; a symbol is a
  unit's centre tile, `(0,0)` the north-west tile, `p1` side A (west). Give each side that fights somewhere to go: a
  `target`, or an enemy Nexus. A wrong board is refused whole, naming slot, symbol and tile.
- **Another seed, more ticks, another unit** is a copy with `seed`, `roundTicks` or a legend changed: one way to play a
  board, no second tool.
- **The log**: one stream, `[tick] LEVEL kind subject [-> object] detail`, fixed columns, closed by the `report` line
  (outcome, losses, state and event hashes). Levels add up: `warn` (the default: stuck actors, arbitration at its bound,
  and the report), `info` (spawns, engagements, attacks that landed, deaths, victory), `debug` (target scoring,
  movement intents, arbitration), `trace` (every entity every tick). An `ERROR` line fails the run. `grep` it for an
  entity (`A:trooper#1`) or a kind (`engage`).
- **Keep it** only when its rule must hold for every later change: check it in under `sandboxes/<folder>/` (`rules/`,
  `units/`, `movement/`, `engage/`, `showcase/`) and assert on its events in a test; run the Bun suite too, since a test
  looping over every sandbox needs an explicit `{ timeout }`. Otherwise it stays in the scratchpad.

## 1. Every pairing first (seconds, free)

```bash
npm run skirmish -- --map crossing --p1 script:steady --p2 script:steady --commanders all --seeds 1-6 --rounds 8 --play-to end
```

Every pair of Commanders, each from both ends of the map, once a seed. Run it again with other scripts (`agro`,
`defensive`, or one by name: `rush`, `turtle-area`). Read a pairing across both sides: neither end of the map is
favoured (`tests/fairness.test.ts`), but a seed's hand is its own. Done when every lopsided sweep (12-0 under one
script, say) has an explanation from a battle's report (`--out <dir>` keeps every round's, `--log` the Battle Round's
own lines); until then it is a lead, not a result.

## 2. One battle, read closely

```bash
npm run skirmish -- --map crossing --p1 script:agro --p2 script:defensive --rounds 8 --play-to end --out .playtest/rounds --log .playtest/battle.log
npm run skirmish -- --load .playtest/rounds/round-3.save.json --p1 script:steady --play-to next     # play on from any round
npm run skirmish -- --load .playtest/rounds/round-3.save.json --play-to next --show 0,120,240,end   # see round 4 at those ticks
```

Pick the map for the question: the Pocket for rounds 1 and 2, a rush and its answer, a Nexus under fire; the Crossing
for the long game, the kept front and scaling (`battles.md`, "The maps for testing").

**Read before you guess.** Every brief gives the score (who leads, on Nexus health or on damage) and, under the last
round, the battle reading: each army as it opened and ended and what it lost (in credits), buildings standing,
damaged and destroyed (and by what), the advance (0% your Nexus, 100% theirs), damage taken by source (your own blasts
included), and each engagement (where and when, who engaged, who lost what). Each round's report prints both sides' Build
Phase record and battle numbers, then the engagements: the battle numbers are the round's reading (`report.reading`,
in the save's `state.history`), and `report.sides` is the Build Phase record only. All of it is public; credits, the hand and build actions are private. A reading a test
needs is one new file in `src/battle/reading/`, and the brief and every script get it at once; `script:reactive` plays
from the reading, a better sparring partner than the fixed scripts.

Mechanics worth knowing:

- Load any kept round and play it again to see a moment; nothing is saved over without `--save`.
- `--json` writes only data on stdout, one brief a line with its `slot`; everything else goes to stderr, so it pipes
  into a parser.
- `--show 0,120,end` is an **ASCII screenshot** of the Battle Round at those ticks: the Grid as the screen draws it,
  then its legend, the overlaps (what stands under a unit on a roof) and a standing line (each Nexus's health and
  units). Ticks past the round's end are named, not drawn. It takes one battle or a sandbox, never `--seeds`.

**Reach for an ASCII screenshot** when where units stand is the question (a formation came out tight or loose, a
regroup's line, an army reaching a building, troops held at a gap, a moment from a playtest note): two or three ticks,
since the readings already say how much and the picture says where. For how it looks to a person (colour, effects,
panels) use the `playtest` skill.

Formations (`rush-block` against `rush-apart`) and the power curve over many battles belong to the measurement
(`node bin/measure.ts run --spec quick --parts duels --players rush --formations block,apart`; the `remeasure` skill).

## 3. Model against model (some 75 thousand small-model tokens a slot for six rounds)

1. `npm run skirmish -- --map crossing --p1-commander <id> --p2-commander <id> --p1 build: --p2 build: --seed <n> --save .playtest/<name>.save.json`
2. Each round: `npm run skirmish -- -f .playtest/<name>.save.json` prints both briefs. Hand each brief to its agent (one
   small, cheap model a slot, continued with SendMessage round to round) and ask for one JSON object of build actions
   and nothing else, with no tools, since small agents wander.
3. Write the two answers to files and play: `-f .playtest/<name>.save.json --p1 build:<p1> --p2 build:<p2> --play-to next`.
   Both read the same brief, so the order they answer in never matters.
4. When it is over, `--load` the save to read every round's report. Play the pairing swapped (p1 and p2) and on a
   second seed before saying anything about it.

## 4. Report it as direction

Give the numbers (who won and how: a Nexus falling, health share or damage; credits spent and earned; powers kept) and
one sentence on why, from the reports. State each time that a scripted or small-model player is not a good player.
Anything an army needs changed becomes a question for Mario with a recommendation.

**What a battle teaches about playing goes in the play strategies**
([`play-strategies.md`](../../../docs/game-design/play-strategies.md)): one entry of advice a player can act on, with the
measurement in brackets, or a change to an entry a new measurement contradicts. A model player reads that page in its
brief, so what one battle learns the next one plays with. Every entry is backed by a measurement or a playtest.
