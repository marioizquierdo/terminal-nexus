---
name: skirmish
description: Skirmish battles played headless (bin/skirmish.ts) to see how armies and their power curves behave: one battle from a save or a new setup, every Commander pairing, many seeds, build actions by script or model agent. Use after a rule, army, power or ability change, to play a person's save on, and when Mario asks how armies compare. Not a balance verdict.
---

# Skirmishes: armies against each other, headless

This page is the procedure; the owners of each meaning:

- **The command's manual** is the comment [`src/cli/skirmish.ts`](../../../src/cli/skirmish.ts) opens with
  (`npm run skirmish -- --help`): every option, what it refuses, the exit codes.
- **How each kind of test uses it**, with the commands and the task for a model agent:
  [`sandboxes.md`](../../../docs/system-design/sandboxes.md), "Testing through Skirmishes".
- **The rules, the brief, the build actions, formations, biases, the maps for testing and how a battle is read**:
  [`battles.md`](../../../docs/system-design/battles.md).
- **The save file**: [`skirmish-saves.md`](../../../docs/system-design/skirmish-saves.md).

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
included), and each engagement (where and when, who engaged, who lost what). Each round's report prints both sides in a
line each, then the engagements. All of it is public; credits, the hand and build actions are private. A reading a test
needs is one new file in `src/battle/reading/`, and the brief and every script get it at once; `script:reactive` plays
from the reading, a better sparring partner than the fixed scripts.

Mechanics worth knowing:

- Load any kept round and play it again to see a moment; nothing is saved over without `--save`.
- `--json` writes only data on stdout, one brief a line with its `slot`; everything else goes to stderr, so it pipes
  into a parser.
- `--show 0,120,end` is an **ASCII screenshot** of the Battle Round at those ticks: the Grid as the screen draws it,
  then its legend, the overlaps (what stands under a unit on a roof) and a standing line (each Nexus's health and
  units). Ticks past the round's end are named, not drawn. It takes one battle, never `--seeds` or a sandbox (a
  sandbox is drawn by `grid`).

**Reach for an ASCII screenshot** when where units stand is the question (a formation came out tight or loose, a
regroup's line, an army reaching a building, troops held at a gap, a moment from a playtest note): two or three ticks,
since the readings already say how much and the picture says where. For how it looks to a person (colour, effects,
panels) use the `playtest` or `grid-screenshots` skill.

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
