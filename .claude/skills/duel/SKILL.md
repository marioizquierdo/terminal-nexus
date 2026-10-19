---
name: duel
description: Fight two Commander Armies against each other headless (bin/duel.ts) — scripted benches, or a model agent planning each side through files — to see how an army spends its power curve after an army change. Use after adding or changing a Commander, a power or an ability, and when Mario asks how armies compare. Not a balance verdict.
---

# Duels: armies against each other

The rules, the brief, the plan format and the biases are in
[`docs/system-design/duels.md`](../../../docs/system-design/duels.md); this is the procedure.

## 1. A scripted bench first (seconds, free)

```bash
npm run duel -- bench --seeds 1-6 --rounds 8 --out .playtest/bench.json
```

Every pairing of every Commander, from both sides, for each script (`balanced`, `rush`, `turtle`). Read a pairing
across both sides: neither end of the map is favoured (`tests/fairness.test.ts`), but a seed's hand is its own. A
sweep like 12–0 under one script is a lead to explain from a report (`play --out <dir>` writes every round's), not a
result.

## 2. Model against model (about a minute and 75 thousand small-model tokens a side)

1. `npm run duel -- new --dir .playtest/<name> --a <commander> --b <commander> --seed <n> --rounds 6`
2. Start **two background agents on a small, cheap model**, one a side, with the task in duels.md's "Model against
   model" (fill in the side and the directory). Name the only commands they may run and tell them to call no
   other tool: small agents wander.
3. When both report, `npm run duel -- status --dir .playtest/<name>`; every round's report sits beside `result.md`.
4. Play the pairing swapped (A and B) and on a second seed before saying anything about it.

## 3. Report it as direction

Give the numbers (who won, how: a Nexus falling, health share or damage; credits spent and earned; powers kept)
and one sentence on why from the reports. Say every time that a scripted or small-model player is not a good
player. Anything an army needs changed becomes a question for Mario with a recommendation, not a quiet retune.
