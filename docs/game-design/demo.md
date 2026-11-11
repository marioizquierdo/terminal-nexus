# Terminal Nexus — the demo

_Two short battles made to be shown to someone who has never played: a level to play, and a battle to watch. What each is, how to start it, what to say while it runs, and what it is not. The numbers are a first tuning; the fiction is CC BY-SA 4.0._

A demo is a battle on the Crossing between Edda Vasse's Citizen Nexus and Dob Hunter's Ravel one, planned on the Build Phase screen like a Challenge run's battle and decided by the same rules ([duels](../system-design/duels.md)). It has no run around it, no draft, and a fixed seed, so **the same hand of Nexus powers is dealt every time it is shown**, and when it ends it starts again. It exists for the owner's request of 2026-11-11: show a friend who may invest "a mirror of our Nexus versus the enemy Nexus, against a scripted enemy that is fairly easy to play", with the Commander talking, and "how a large army fights another large army", in two to five minutes.

## Starting it

```text
./bin/terminal-nexus.ts --at demo                  # the mirror: the level to play
./bin/terminal-nexus.ts --at 'demo?build=battle'   # the battle: the spectacle
```

The same routes work in the browser page and the scripted playtest ([routing](../system-design/routing.md)). A 100 × 30 terminal or larger shows the most; 80 × 24 works. With the colours on, `--colors truecolor`, the two armies read at a glance: the Citizens' warm, the Ravels' green.

## The mirror — a level to play, two to five minutes

Four rounds, each a Nexus Pulse, a Build Phase and a Battle Round of thirty seconds. The two Nexuses stand at the ends of the Crossing, a ridge between them with one wide gap: the same pyramid, the same distance, the same twenty-second walk. **The enemy is the showman** (`showman`, `src/duel/players.ts`): easy on purpose, and easy to read. It never looks at what the player has, and it plays four beats a round apart, each one visible on the map before it lands:

| Round | What the enemy does | What a person sees and decides |
| --- | --- | --- |
| 1 — the probe | Its starting package marches out; two cheap producers go up forward. | A small raid, and Vasse speaking as it arrives. Build a Barracks and a Turret; pick a Nexus power. |
| 2 — the build-up | It holds at home and raises a Turret and more producers. | A lull. The enemy's buildings stand in plain sight: what will they send? Spend on the army. |
| 3 — the push | The whole swarm marches, with a building whose units hit an area. | A large army against a large army. Where the Barracks stand decides how tight the army fights and what area damage costs it. |
| 4 — the all-in | Every credit on producers; it marches again. | The finish: a plain plan fells the enemy Nexus a few seconds before the last round ends. |

**What it is tuned to** (`tests/demo.test.ts`, `src/run/demo.ts`): a plain plan wins in round 4 by felling the Nexus, with the Ravel opening on a war chest of 220 credits against the player's 100 (the first tuning that moved the finish from round 3 to round 4, so the finale is a finish and not a formality); a player who builds nothing sees their Nexus attacked and loses in round 3. Everything between is the player's. Nothing else about the enemy is tuned: it is the Ravel army as it is, and says nothing about balance.

**What to show while it runs**, in the order a round gives it:

- **The Nexus Pulse** (`n`): a hand of powers, keep one. Read what each does; the first hand has a Reserve Callup, a Standing Order and an Aid Station Permit.
- **Explore Map** (`e`): move over any building or unit for its card; over Vasse for her portrait and her Standing Order ring; over the enemy's buildings for what they will train.
- **Building**: `1`, `2`, `3`, arrows, Enter. A Barracks sends a wave of troopers into every round; units come out over the roofs, so where the Barracks stand is where the army forms. Explore a Barracks and `c` buys its production line.
- **Vasse speaking**: in the dialog before the first round and in the panel beside the fight: contact, a raid arriving, a unit lost, the Nexus touched, a round won. Dob Hunter speaks once, as the level opens.
- **The effects**: the Nexus Pulse, the regroup after each round (the survivors step back and form up while the player builds), ranged shots, area bursts, the Commander's fall and restoration, and the Nexus's own fire. They are what the Battle Round shows; none is staged.

**The result** is BATTLE WON or LOST with its reason, then a line saying the same hands will be dealt again; Enter plays it again from round 1.

## The battle — a spectacle, three rounds

The same map, but both sides open with their armies already in the field: Vasse with sixteen troopers, eight marksmen, four pikemen and two mortars besides her package, Dob Hunter with twenty runners, eight slingers, four raiders and three bombers besides his. About eighty units meet in the middle in the first round, and the enemy is the rush, which marches every round with everything. The player adds a building or two and the Nexus Pulse's card and watches. A plain plan fells the Ravel Nexus in round 3, an idle one loses on health in round 3.

An army that is already past its supply (the line reads `units 41/12`) trains no new unit until old ones fall: the field is the field, and what reinforces it is whatever the fight has made room for. That is the rule, shown as it is.

## What it is not

- **Not a balance statement and not a mission.** The mirror's enemy is a script written to be read, and the battle's is the existing rush. Neither is the campaign's opponent.
- **Not the battle banner.** The banner prototype (where to send the army) is not carried by duels yet, so the demo hides it: Start Battle Round is the plain popup. When duels carry it, the mirror is the level to show it on.
- **Not a title menu row.** The demo is reached by its route alone; a row on the title screen is the owner's call.

## Changing it

The builds are data in `src/run/demo.ts` (`DEMOS`): the duel's map, seed, rounds, musters and credits, and the enemy's script by name. A new enemy beat is an edit to `showman`; a new build is one more entry and its opening words. The tests pin what a build promises: change a number and run `node --test tests/demo.test.ts` to see whether the promise held.
