# Formations, once units walk out over the roofs

_2026-10-20, the pathfinding milestone's step 16H. The simulated game Mario set as the real test of units appearing on
the roofs of the buildings that made them: does where a player builds decide how tight the army stands when it meets
the enemy, and does each shape win something and lose something? Run it again with
`node bin/measure.ts formations --seeds 1-6 [--exit route|ground]`._

The owner, 2026-10-20: "this is just what I think it would work, but the real test is playing a simulated game and
checking if it is possible to make good unit formations that can foster interesting strategies."

## What was played

An open field 72 by 28, a Citizen Grid Nexus at each end of the middle row, and four Barracks a side in front of it,
built one of three ways:

| Shape | How the four Barracks stand |
| --- | --- |
| block | two by two, touching: one block six tiles wide and four tall |
| apart | a square with room between them, eight columns and three to seven rows apart |
| line | four touching, one above the other, across the way to the enemy |

Each Barracks makes three troopers a wave, two waves ten seconds apart, the first five seconds in: twelve troopers a
side on the field at once, what a Grid Nexus gives. They come out on their Barracks's roof, walk off it and march on
the enemy Nexus, fighting what comes within reach. Every shape against every shape from both ends, on seeds 1 to 6;
and every shape against **a blast**: the same shape across, with two siege crawlers among its troopers, whose shots hit
everything within two of where they land (the bench's only attack that hits an area).

## What it showed, along the route (Mario's idea, the default)

| Shape | How tight it meets the enemy (columns from its middle, a row counting two) |
| --- | --- |
| block | 3.1 |
| line | 4.2 |
| apart | 14.0 |

**Where the Barracks stand decides how tight the army is**: a block's wave comes off the roofs together and meets
the enemy more than four times as tight as an army built apart. A line is nearly as tight as a block.

| Pairing, over 12 games from both ends | Wins |
| --- | --- |
| block against apart | 10 to 2 |
| line against apart | 12 to 0 |
| block against line | 5 to 7 |
| mirrors (west to east) | block 1 to 5, apart 3 to 3, line 3 to 3 |

**A tight army beats a loose one**: set apart, the four waves reach the fight one after another and are beaten one at
a time. Block and line are close.

**Against the blast every shape lost all six games**, losing 22 to 24 of its 24 troopers: two siege crawlers more is
simply more army. Played instead against a defence of crawlers alone, every shape won every game; a block took about
twice the blast's damage an army set apart did (259 against 111 with four crawlers at the Nexus), but never enough to
lose. With the content there is, **an area attack does not yet punish a tight army enough to change who wins**.

## The other way off the roof

With the "Way off the roof" Experiment at **nearest** — units step down at once to the nearest open ground, then go
on their way — a block spills off every side: it meets the enemy at 8.8 rather than 3.1, and loses every game to a
line (0 to 12), while still beating an army set apart (12 to 0). Walking the roofs along the route is what keeps a
block's wave together, as Mario expected.

## So

- **Shapes matter**: how a player builds sets how tight the army fights, from 3 to 14 columns.
- **Each of block and line beats something** (an army set apart), and they are close to each other.
- **Set apart beats nothing yet.** Its answer would be area damage that punishes a tight army, and the only area attack
  on the bench is too slow and weak to do it. That is a question of what armies carry, put to Mario in the open
  questions ("What makes a loose army worth building?"), with an Experiment on the playable page to feel both ways off
  the roof meanwhile.
