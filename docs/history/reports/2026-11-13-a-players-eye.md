# A player's eye on the Skirmish, 2026-11-13

_An agent played Skirmishes through the `skirmish` command as a player and tester would, asked whether the game could
be fun with what it has and where it is more or less fun, at the owner's request when he closed the Skirmish milestone
([his words](../feedback/2026-11-13-one-path.md)). It was told the game is unfinished. A scripted opponent is a poor
player, so nothing here is a balance verdict: it is where to look._

## The verdict

There is a game here, and for about two rounds it shows. The loop is to keep a power, place the buildings that make
units, choose attack or hold, then read the report. Two things already felt like strategy:

- **Building blind on contested ground**: when both sides plan a building on the same tile, neither is built, so where
  the other side will build is a guess worth making.
- **Attack or hold, read from the last round's trade**: holding under its own Nexus and Turrets turned an even trade
  into about two to one, and won a long battle.

What lets it down:

- **The Crossing** becomes an even grind in the middle of the map. In eight rounds neither Nexus took a point of damage,
  so the damage dealt decides the winner, and the brief never shows that total.
- **The Pocket** is decided in round 1 or 2 by whoever rushes.
- **The hand** stops being a decision by round 4 or 5.
- **The battle it lost** couldn't be explained without reading the engine's log.

## What it played

| Battle | Result | Why, as it read it |
| --- | --- | --- |
| Vasse (the agent) against Averno `script:steady`, the Crossing, seed 3, 8 rounds | Won on damage in round 8, about 14.8 thousand to 12.1 thousand; both Nexuses whole | Even while both attacked; then it held from round 4 while the script kept attacking, and traded about 2 to 1 |
| A Vasse rush against Dob `script:agro`, the Pocket, seed 5 | Won by the Nexus in round 2 | Both sides' forward buildings were cancelled on the same tiles in round 1. The same build file won 8 of 8 against both agro scripts, but 0 of 6 against `steady` and 2 of 6 against `defensive`: a rough triangle |
| A Dob rush against Vasse `script:steady`, the Pocket, seed 4 | Won in round 1, at tick 271 | Dob's bounty paid for the rush (57, 42 and 33 credits). The same file went 6 of 6 against every steady and agro script, and lost to the Citizens' defensive one |
| Dob against Vasse `script:defensive`, the Pocket, seed 2 | Lost by the Nexus in round 4 | Its Nexus fell from 361 to 0 in one round. Only the log said why (see the list below) |
| Scripts against scripts | On the Crossing, Averno steady beats Vasse steady 10 of 10, all on damage. On the Pocket, with agro, Dob beats Vasse and Averno 6 to 2 each, and Vasse beats Averno 7 to 1 | |

The round-4 loss had four causes, all found only in the log:
- The enemy's survivors regroup across their march line, which on the Pocket is next to the agent's Nexus.
- The defensive script built Turrets inside the agent's base, reaching it through a forward Garrison's build range.
- The agent's own Ravel bombers burst inside its own base, and the blasts caught its Nexus and its buildings.

## More fun

1. Two buildings planned on the same tile, and neither built: blind building is a real guessing game.
2. Holding from round 4 and watching the trade turn about two to one: the one choice that came straight from reading
   a report.
3. Dob's bounty: 320 credits in round 4 against Vasse's 125 to 145. Kills feed the next build, and Dob feels like
   his own Commander.
4. The script's forward Garrison razed in round 2 by an ordinary attack: where a building goes matters.
5. Drill Schedule I and II with Production line: stacking waves was the best build-up.

## Less fun

1. Eight rounds with no damage to either Nexus: the battle is won by a total nobody sees.
2. Its own bombers wiping out its base, with nothing in the brief or the report to warn it.
3. The Hatchery shows 3 strength a credit against the Barracks's 28: a trap, so not a real choice.
4. By round 5 or 6 the hand is down to Reserve Callup and Aid Station Permit, and Callup can be kept over and over.
5. About a hundred troopers a side by round 8: a round's report says "lost 83" and the map turns to glyph soup.

## What would make it more fun soonest, as it asked

1. **A scoreboard in the brief**: the damage totals so far and who leads, every round, if damage decides.
2. **The maps' tempo**: a way to reach a Nexus on the Crossing, or a cap on stacking producers. On the Pocket,
   something that survives a round-1 rush, and survivors that don't regroup inside the other side's base.
3. **Blasts that hurt their own side, shown**: say it on the bomber's and the Stash's lines, or change it. It's a rule
   (a death's blast hurts friend and foe unless the content says enemies alone), but the player never reads it.
4. **A report that explains a loss**: two or three lines on what hit the Nexus and what destroyed the buildings,
   grouped by source. The log has all of it.
5. **A wider, thinner hand**: no keeping a common card again and again, and more mid-game powers, so the Nexus Pulse
   still matters after round 4.

## The command and its words

- **What the brief leaves out**: a building action is named with its cost and not its effect (Production line adds a
  trooper a wave: found in the army file), and Reserve Callup doesn't say whether it is once or every round.
- **Refusals**: "Refused fuse-shed: the Den is here" means the tile is taken by its own building. "Outside your build
  range" doesn't say the range shrank because a Den fell. In the last round a refusal is never explained, since no
  brief follows.
- **A sweep stops on one battle**: with `--seeds`, a one-round build file stops the whole tally ("p1 has no build
  actions for round 2") instead of scoring the battles that ended.
- **Strength a credit misleads**: it ignores area damage, so the Battery reads 3 and the bombers aren't counted.
- **"apart"** says at least 10 apart, but its Barracks went about 6 rows apart.
- **Words that read two ways**: "fielded" (the units on hand as the round opened), and "hold" (a stance, and also the
  order "hold production" on a building).
- **Sweeps are slow**: every pairing of Commanders on the Crossing over four seeds took more than two minutes.

## Worth a look

- The defensive script builds Turrets inside the other side's base, its build range carried forward by a Garrison.
- Units drawn over a building's glyphs on the brief's map (`[=t` where a Barracks stands).
- The play strategies say a round-1 rush ended one duel of 162; on the Pocket it won 6 of 6 against two of the
  scripts.
- On the Pocket with agro scripts, p1 (west) won 15 of 24: perhaps chance, worth a seeded check from both ends.
