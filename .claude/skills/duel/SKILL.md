---
name: duel
description: Fight two Commander Armies against each other headless (bin/duel.ts) — scripted benches, or a model agent planning each side through files — to see how an army spends its power curve after an army change. Use after adding or changing a Commander, a power or an ability, and when Mario asks how armies compare. Not a balance verdict.
---

# Duels: armies against each other

The rules, the brief, the plan format and the biases are in
[`docs/system-design/duels.md`](../../../docs/system-design/duels.md); this is the procedure. One battle played from a
save file, a round at a time, is the `skirmish` command (`npm run skirmish -- --help`,
[`skirmish-saves.md`](../../../docs/system-design/skirmish-saves.md)): use it to play a person's save on, or to try a plan
of your own against a script round by round. Benches and the two-session file flow stay here.

**Round by round, as an agent plays a Skirmish** ([`skirmish-saves.md`](../../../docs/system-design/skirmish-saves.md),
how an agent plays a Skirmish): copy a save (`cp saves/crossing-round-4.save.json tmp/s.json`), read the brief
(`npm run skirmish -- -f tmp/s.json`), write a plan, check it (`--p1 build:plan.json`), play it (`--battle`, which saves
the next Build Phase over the file), and repeat; `--out tmp/runs/` keeps every round's save and report. To see a round
on screen, the same file opens in the scripted playtest (`node scripts/playtest.mjs --load tmp/s.json`), with
`--p1 script:<profile>` to watch both sides. The saves in `saves/` say which shows what (DEVELOPMENT.md, how to see a
change).

## 1. A scripted bench first (seconds, free)

```bash
npm run duel -- bench --seeds 1-6 --rounds 8 --out .playtest/bench.json
```

Every pairing of every Commander, from both sides, for each script (`balanced`, `rush`, `turtle`). Read a pairing
across both sides: neither end of the map is favoured (`tests/fairness.test.ts`), but a seed's hand is its own. A
sweep like 12–0 under one script is a lead to explain from a report (`play --out <dir>` writes every round's), not a
result.

## 2. Formations: a tight army against a loose one

Where a side builds decides how tight its army fights (duels.md, formations). Set one against the other:

```bash
npm run duel -- play --a vasse --b dob --player-a script:rush-block --player-b script:rush-apart --seed 1
node bin/measure.ts run --spec quick --parts duels --players rush --formations block,apart --jobs 4 \
  --routing "<the rules, in a few words>" --question "<what it must answer>"
```

The second plays `rush-block` against `rush-apart` from both ends for every pair of Commanders and seed, and says
who won by formation and how tight each met the enemy. Any script takes `-block`, `-apart` or `-zones` (its own
places, as the bare name); any script also comes with area damage (`rush-area`, `rush-area-block`), buying a Battery
or a Fuse Shed first each round. A model player states `"formation"` in its plan; the brief tells it what each wins and
loses.

## 3. Model against model (about a minute and 75 thousand small-model tokens a side)

1. `npm run duel -- new --dir .playtest/<name> --a <commander> --b <commander> --seed <n> --rounds 8`
2. Start **two background agents on a small, cheap model**, one a side, with the task in duels.md's "Model against
   model" (fill in the side and the directory). Name the only commands they may run and tell them to call no
   other tool: small agents wander.
3. When both report, `npm run duel -- status --dir .playtest/<name>`; every round's report sits beside `result.md`.
4. Play the pairing swapped (A and B) and on a second seed before saying anything about it.

## 4. Report it as direction

Give the numbers (who won, how: a Nexus falling, health share or damage; credits spent and earned; powers kept)
and one sentence on why from the reports. Say every time that a scripted or small-model player is not a good
player. Anything an army needs changed becomes a question for Mario with a recommendation, not a quiet retune.

**What a duel teaches about playing goes in the play strategies** ([`play-strategies.md`](../../../docs/game-design/play-strategies.md)):
one entry of advice a player can act on, with the measurement in brackets, or a change to an entry a new measurement
contradicts. A model player reads that page in its brief, so what one duel learns the next one plays with. Never an
entry no measurement or playtest backs.
