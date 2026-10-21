# Area damage against a tight army, measured

_2026-10-21, the pathfinding milestone's area-damage step. The question, written before playing: **with area damage,
does an army built apart beat one built as a block?** The duels are
[`2026-10-21-area-damage-formations.json`](../measurements/2026-10-21-area-damage-formations.json) (`node bin/measure.ts
show` it); the formation game is `node bin/measure.ts formations --seeds 1-6`._

The owner, 2026-10-21: "let's start testing area of damage versus clamping. And the testing script, or when we have
the agent playing versus agent, so we'll be able to decide to do one strategy or another and see significant changes."

## What was played

- **The formation game**: four Barracks a side, built as a block, apart or in a line, twelve troopers a wave. Each
  shape marched on a defence of area damage alone before the enemy's Nexus: two siege crawlers, two Citizen mortars
  (shells that burst and leave the ground burning) or four Ravel bombers (that run into the thickest knot and burst).
  With nothing else on that side, the damage it deals is the area attack's alone. Seeds 1 to 6.
- **Duels**: every Commander against every other, from both ends, seeds 1 and 2, each scripted player (rush,
  balanced) building as a block on one side and apart on the other, with and without area damage (the `-area` players
  buy a Battery or a Fuse Shed first each round, or what opens it). 144 duels. A sample of them trained between 5 and
  85 bombers or mortars over a duel, Averno's rush the fewest.

## The formation game: a block takes more of the area attack

| Area attack, alone before the Nexus | Damage a block took | Apart | A line |
| --- | --- | --- | --- |
| Two siege crawlers | 56 | 40 | 51 |
| Two mortars | 120 | 77 | 87 |
| Four bombers | 372 | 240 | 433 |

A block takes about one and a half times what an army built apart does, from every area attack. But against twelve
troopers the area attack alone rarely kills: the mortars killed none, the bombers six whatever the shape, and the
Nexus behind them fell in every game. **The tightness pays, but the numbers are too small to decide a fight on their
own.**

## Duels: the apart's lead grows for the balanced player, and narrows for the rush

| Pairing (36 duels each, from both ends) | Block | Apart | Units lost a battle (block / apart) |
| --- | --- | --- | --- |
| rush, no area damage | 1 | 35 | 31.9 / 36.5 |
| rush, with area damage | 9 | 27 | 31.9 / 37.0 |
| balanced, no area damage | 15 | 21 | 38.7 / 38.5 |
| balanced, with area damage | 9 | 27 | 48.3 / 43.9 |

- **Without area damage an army built apart already wins**, and not for being loose. In whole duels the two meet the
  enemy at about the same spread (8 to 10 columns from their middle, not the formation game's 3 against 14): survivors
  coming home, the Commander and units a Nexus power calls up all gather in one place. What decides it is **buildings**:
  a block stands in the enemy's road before its Nexus and is razed (rush's block lost about 4 buildings a battle,
  apart 1.3), so its waves stop coming.
- **For the balanced player, area damage makes the block pay**: it loses 48 units a battle to the apart's 44, and its
  wins fall from 15 to 9.
- **For the rush, area damage helps the block** (1 win to 9). Both sides field bombers or mortars there, and a rush's
  duels are decided by which buildings stand; a mortar or a bomber in the road changes who razes whose first more
  than how tight anyone stands.

## So

Area damage does what it was built for — a tight army takes half again as much of it — but **where buildings stand
decides more than how tight an army fights**, in every duel. Two things would let formation tell: a duel round that
reports how tight each side met the enemy (so a model player can see it), and survivors that come home to the
buildings that made them rather than to one gathering point. Both are questions of the armies' next pass, not this
step. The numbers here are first numbers: the mortar's burn (4 a second) is a few points as asked, and kills nothing
alone.

What a scripted player cannot say: whether the burning ground reads, and whether a player would build apart because of
it. That is for playing.
