# Between rounds: home, fall back, or stay (2026-10-26)

_A measured experiment for the core loop's open question ([`core-loop.md`](../../milestones/core-loop.md)): what happens to an
army between Battle Rounds. Evidence for a decision, not the decision; nothing in the game changed._

**How.** The duel gained an experiment-only option, `DuelSetup.recall` (`src/match/recall-variants.ts`; absent, today's
Recall, so every pinned battle holds): **home** (today: every survivor to its roof or beside its Nexus), **fallback**
(each survivor steps back up to 12 toward the home Recall would give it, landing exactly there if it is that close) and
**stay** (survivors stand where the round left them; the Nexus still mends, the clock resets). 3888 duels on the Crossing,
8 rounds each: the six pairings of different Commanders, all nine pairings of the balanced, rush and turtle scripts,
seeds 1–12 at 600 ticks (50 s) and 1–6 at 360 (30 s) and 900 (75 s). Scripts: `scripts/recall-experiment/`
(`run.ts`, `summarize.ts`, `watch.ts`).

**What it found.**

- **The round's length decides more than the rule.** At 50 and 75 seconds the three rules end the same share of duels on a
  Nexus falling (48–50%, 65–66%) in the same round: an army walks the whole Grid within a round anyway, and every
  rule's attack stops at the same line, about 31 from the enemy Nexus, where the defender's fresh waves and Turrets hold.
- **At 30 seconds the rule matters a great deal.** Under home two thirds of duels never touch a Nexus; a Nexus falls in
  23% of them. Fallback makes it 36%, stay 43% — about as decisive as today's 50-second rounds under home. Keeping the
  front lets shorter rounds count.
- **The snowball may soften.** At 50 seconds the side ahead after round 2 wins 82% under home, 69% under fallback, 74%
  under stay — on about 50 duels, so about ±12 points: suggestive, not settled. The likely reason, not yet checked
  against the events: under home a trailing side loses the ground it fought for with its units; keeping the front, its
  fresh waves join a line already forward.
- **Where the next Build Phase opens.** The attacking side's mean distance from the enemy Nexus as the Build Phase
  opens: home 53, fallback 41, stay 33 (50 seconds). Under stay a player can open a Build Phase with the enemy's
  troopers beside their Nexus (watched: Dob's rushers stood at Vasse's base from round 4 and took it at tick 544, a duel
  that under home went eight rounds and was decided on damage). Fallback keeps the front's place but always leaves a
  gap.
- **What did not change.** No duel jammed or failed to place; none was won by a side that never attacked; the scripts'
  order is the same under every rule (balanced beats rush every time and turtle almost always; rush never wins).
  Turtle against rush or turtle never takes a Nexus at 30 or 50 seconds under any rule: a stalemate of the scripts.

**Caveats.** The scripted players do not adapt — none retreats, holds when beaten, or builds Turrets against an army
at its door — so the results measure script against script, and a rule shows only where the scripts are close. Under
stay that likely overstates how decisive a camped army is, and hides its cost (veterans forward, recruits walking out
behind them). Fallback's 12 is the only distance tried. Commander win rates move within noise.

## Tables

```
## Outcomes
rule      ticks   n  nexus  hp/dmg draw  meanEnd  meanEnd(nexus)  noNexusDmgAtAll
home       360  324   23%    77%    0%     7.6      6.3          66%
fallback   360  324   36%    64%    0%     6.8      4.8          57%
stay       360  324   43%    57%    0%     6.7      4.9          55%
home       600  648   49%    51%    0%     5.9      3.6          42%
fallback   600  648   48%    52%    0%     6.0      3.8          41%
stay       600  648   50%    50%    0%     5.8      3.7          42%
home       900  324   65%    35%    0%     5.3      3.9          31%
fallback   900  324   66%    34%    0%     5.3      3.9          31%
stay       900  324   66%    34%    0%     5.3      3.9          29%

## Snowball: the side ahead on Nexus damage dealt (cumulative) after round k, in duels still going after round k
rule      ticks  | after r1: lead/eligible  leader wins | after r2: lead/eligible leader wins | after r3
home       360  |    0/324    - (0) |    0/324    - (0) |    1/324  100% (1)
fallback   360  |    0/324    - (0) |    0/324    - (0) |    5/324  100% (5)
stay       360  |    0/324    - (0) |    0/324    - (0) |   11/324  100% (11)
home       600  |   42/647   79% (33) |   56/644   82% (46) |  114/428   89% (101)
fallback   600  |   42/647   62% (26) |   52/645   69% (36) |  111/425   77% (86)
stay       600  |   42/647   67% (28) |   53/644   74% (39) |  112/414   85% (95)
home       900  |   28/322   64% (18) |   24/314   67% (16) |   29/175   90% (26)
fallback   900  |   28/322   64% (18) |   23/312   70% (16) |   26/171   73% (19)
stay       900  |   28/322   68% (19) |   26/314   77% (20) |   22/168   77% (17)

## Battle Rounds: how each ended, and the fronts (attacking sides only; Grid distance to the enemy Nexus's middle; the Crossing's Nexuses are ~57 columns apart)
rule      ticks rounds  byNexus meanTicks | at round end: mean dist  nearest unit  units | as next Build Phase opens: mean dist  nearest
home       360  2465     3%    359.2  |         32.3         21.6     19.1 |                          51.4     41.1
fallback   360  2218     5%    356.0  |         32.1         21.6     16.7 |                          40.3     30.5
stay       360  2157     6%    349.0  |         32.0         21.5     15.5 |                          32.3     22.2
home       600  3797     8%    593.6  |         31.0         19.8     10.4 |                          53.4     45.7
fallback   600  3858     8%    592.0  |         30.7         19.6     10.0 |                          40.7     30.8
stay       600  3777     9%    589.2  |         31.2         19.9      9.6 |                          33.2     21.8
home       900  1732    12%    863.4  |         32.0         19.2      6.9 |                          58.1     50.3
fallback   900  1719    12%    861.6  |         32.0         19.3      6.7 |                          46.2     34.3
stay       900  1720    12%    858.7  |         32.0         18.7      6.7 |                          38.5     24.2

## Win rate by Commander (all duels; off-mirror only) and by script (duels between different scripts)
rule      ticks | averno  dob     vasse  | balanced  rush      turtle   | rush v turtle  balanced v rush  balanced v turtle (row's win %)
home       360 |  61%     55%     35%   |  94%        0%       56%     |       0%          100%             88%
fallback   360 |  56%     52%     43%   |  98%        0%       52%     |       0%          100%             96%
stay       360 |  55%     54%     42%   |  99%        0%       51%     |       0%          100%             99%
home       600 |  54%     49%     46%   |  99%        0%       51%     |       0%          100%             98%
fallback   600 |  53%     53%     44%   |  99%        0%       51%     |       0%          100%             98%
stay       600 |  53%     53%     44%   |  99%        0%       51%     |       0%          100%             99%
home       900 |  51%     53%     46%   |  99%        0%       51%     |       0%          100%             99%
fallback   900 |  51%     52%     47%   | 100%        0%       50%     |       0%          100%            100%
stay       900 |  53%     52%     45%   |  99%        0%       51%     |       0%          100%             97%

## Degenerate checks
home|360       winners that never attacked   0%  winners that dealt no Nexus damage  66%  attacking lines ending on time >20 from the Nexus  43%  survivors carried: mean 17.1 max 69
fallback|360   winners that never attacked   0%  winners that dealt no Nexus damage  57%  attacking lines ending on time >20 from the Nexus  46%  survivors carried: mean 15.4 max 69
stay|360       winners that never attacked   0%  winners that dealt no Nexus damage  55%  attacking lines ending on time >20 from the Nexus  48%  survivors carried: mean 14.6 max 69
home|600       winners that never attacked   0%  winners that dealt no Nexus damage  43%  attacking lines ending on time >20 from the Nexus  38%  survivors carried: mean 11.6 max 61
fallback|600   winners that never attacked   0%  winners that dealt no Nexus damage  44%  attacking lines ending on time >20 from the Nexus  36%  survivors carried: mean 11.3 max 61
stay|600       winners that never attacked   0%  winners that dealt no Nexus damage  43%  attacking lines ending on time >20 from the Nexus  37%  survivors carried: mean 11.2 max 60
home|900       winners that never attacked   0%  winners that dealt no Nexus damage  32%  attacking lines ending on time >20 from the Nexus  27%  survivors carried: mean 9.9 max 52
fallback|900   winners that never attacked   0%  winners that dealt no Nexus damage  31%  attacking lines ending on time >20 from the Nexus  28%  survivors carried: mean 9.8 max 45
stay|900       winners that never attacked   0%  winners that dealt no Nexus damage  29%  attacking lines ending on time >20 from the Nexus  28%  survivors carried: mean 9.8 max 53

## By script pairing (unordered): nexus-decided %, mean end round, Battle Rounds ended by a Nexus, attackers' mean distance to the enemy Nexus as the next Build Phase opens
config         | balanced v balanced       | balanced v rush           | balanced v turtle         | rush v rush               | rush v turtle             | turtle v turtle           
home|360       |   0% r8.0 br  0% d58.7    |  89% r6.3 br 14% d54.7    |  14% r7.9 br  2% d55.5    |   0% r8.0 br  0% d47.7    |   0% r8.0 br  0% d44.8    |   0% r8.0 br  0% d52.9    
fallback|360   |  61% r6.8 br  9% d42.3    | 100% r4.0 br 25% d30.5    |  33% r7.4 br  4% d43.1    |   0% r8.0 br  0% d40.3    |   0% r8.0 br  0% d38.7    |   0% r8.0 br  0% d49.9    
stay|360       |  69% r6.0 br 12% d31.5    | 100% r4.0 br 25% d19.5    |  58% r7.0 br  8% d34.6    |   0% r8.0 br  0% d33.4    |   0% r8.0 br  0% d31.8    |   0% r8.0 br  0% d43.1    
home|600       |  90% r3.9 br 23% d60.3    | 100% r3.0 br 33% d55.0    |  51% r6.3 br  8% d61.8    |  46% r6.2 br  7% d48.2    |   0% r8.0 br  0% d49.6    |   0% r8.0 br  0% d56.1    
fallback|600   |  88% r3.9 br 23% d39.8    | 100% r3.0 br 33% d27.8    |  61% r6.2 br 10% d44.3    |  24% r7.2 br  3% d29.1    |   0% r8.0 br  0% d43.5    |   0% r8.0 br  0% d51.8    
stay|600       |  92% r3.8 br 24% d29.0    | 100% r3.0 br 33% d15.6    |  62% r6.0 br 10% d38.1    |  38% r6.7 br  6% d20.5    |   0% r8.0 br  0% d35.9    |   0% r8.0 br  0% d44.7    
home|900       |  97% r3.3 br 30% d63.1    | 100% r3.0 br 33% d-       |  63% r5.7 br 11% d64.8    |  92% r3.5 br 26% d53.7    |  33% r8.0 br  4% d52.8    |   0% r8.0 br  0% d60.0    
fallback|900   | 100% r3.1 br 32% d22.5    | 100% r3.0 br 33% d-       |  64% r5.6 br 12% d55.1    |  94% r3.6 br 27% d24.7    |  35% r8.0 br  4% d40.6    |   0% r8.0 br  0% d53.5    
stay|900       |  94% r3.4 br 27% d34.9    | 100% r3.0 br 33% d21.0    |  64% r5.5 br 12% d47.2    |  97% r3.3 br 29% d11.8    |  36% r8.0 br  5% d32.2    |   0% r8.0 br  0% d45.7    

## Snowball within mirror-script duels only (same script both sides), leader after r1 / r2 / r3 wins
home|360       0/0   0/0   1/1   (n=108, nexus-decided   0%, mean end 8.0)
fallback|360   0/0   0/0   5/5   (n=108, nexus-decided  20%, mean end 7.6)
stay|360       0/0   0/0   9/9   (n=108, nexus-decided  23%, mean end 7.3)
home|600       33/42   46/56   63/76   (n=216, nexus-decided  45%, mean end 6.0)
fallback|600   26/42   36/52   47/71   (n=216, nexus-decided  37%, mean end 6.4)
stay|600       28/42   39/53   59/75   (n=216, nexus-decided  43%, mean end 6.2)
home|900       18/28   16/24   16/19   (n=108, nexus-decided  63%, mean end 4.9)
fallback|900   18/28   16/23   8/15   (n=108, nexus-decided  65%, mean end 4.9)
stay|900       19/28   20/26   10/15   (n=108, nexus-decided  64%, mean end 4.9)
```
