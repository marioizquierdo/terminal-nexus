---
name: skirmish
description: Play Skirmish battles headless to test a change — the skirmish command (bin/skirmish.ts) from a save or a new setup, a round at a time or to the end, scripts or your own plans on either side, many seeds with a tally, every pairing of Commanders, two model agents taking turns through one save, the battle's log — to see how an army spends its power curve. Use after a rule, army, power or ability change, to play a person's save on, and when Mario asks how armies compare. Not a balance verdict.
---

# Skirmishes: armies against each other, headless

Where each piece is, so this page stays the procedure:

- **The command's manual** is the comment [`src/cli/skirmish.ts`](../../../src/cli/skirmish.ts) opens with
  (`npm run skirmish -- --help`): every option, what it refuses, the exit codes.
- **How each kind of test uses it**, with the commands and the task to give a model agent:
  [`testing-ground.md`](../../../docs/system-design/testing-ground.md), testing through Skirmishes.
- **The rules, the brief, the plan format, formations and the biases**: [`duels.md`](../../../docs/system-design/duels.md).
- **The save file**: [`skirmish-saves.md`](../../../docs/system-design/skirmish-saves.md).

## 1. Every pairing first (seconds, free)

```bash
npm run skirmish -- --map crossing --p1 script:steady --p2 script:steady --commanders all --seeds 1-6 --rounds 8 --play-until-win
```

Every pair of Commanders, each from both ends of the map, once a seed; run it again with other scripts (`agro`,
`defensive`, or a script by name: `rush`, `turtle-area`). Read a pairing across both sides: neither end of the map is
favoured (`tests/fairness.test.ts`), but a seed's hand is its own. A sweep like 12–0 under one script is a lead to
explain from a battle's report (`--out <dir>` keeps every round's, `--log` the Battle Round's own lines), not a result.

## 2. One battle, read closely

```bash
npm run skirmish -- --map pocket --p1 script:agro --p2 script:defensive --play-until-win --out .playtest/rounds --log .playtest/battle.log
npm run skirmish -- --load .playtest/rounds/round-3.save.json --p1 script:steady --battle     # play on from any round
```

Formations (`rush-block` against `rush-apart`) and the power curve over many battles are the measurement's
(`node bin/measure.ts run --spec quick --parts duels --players rush --formations block,apart`, the `remeasure` skill).

## 3. Model against model (about a minute and 75 thousand small-model tokens a side)

1. `npm run skirmish -- --map crossing --p1-commander <id> --p2-commander <id> --p1 build: --p2 build: --seed <n> --save .playtest/<name>.save.json`
2. Start **two background agents on a small, cheap model**, one a slot, with the task in testing-ground.md (fill in
   the slot and the file). Name the only commands they may run (`--wait`, then `--ready`) and tell them to call no
   other tool: small agents wander.
3. When both report, `npm run skirmish -- --load .playtest/<name>.save.json` prints every round's report.
4. Play the pairing swapped (p1 and p2) and on a second seed before saying anything about it.

## 4. Report it as direction

Give the numbers (who won, how: a Nexus falling, health share or damage; credits spent and earned; powers kept)
and one sentence on why from the reports. Say every time that a scripted or small-model player is not a good
player. Anything an army needs changed becomes a question for Mario with a recommendation, not a quiet retune.

**What a battle teaches about playing goes in the play strategies** ([`play-strategies.md`](../../../docs/game-design/play-strategies.md)):
one entry of advice a player can act on, with the measurement in brackets, or a change to an entry a new measurement
contradicts. A model player reads that page in its brief, so what one battle learns the next one plays with. Never an
entry no measurement or playtest backs.
