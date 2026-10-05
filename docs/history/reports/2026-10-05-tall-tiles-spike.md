# Tall tiles: square tiles against rows that count double — spike report

Mario, on the Commander's fifth round ([his words](../feedback/2026-10-05-commander-round-5.md)): "the range is
severely skewed vertically. That is because a termial tiles are made of tall rectangles ... Let's explore ways to
address this and see if they are worth implementing. For example, one idea would be counting distance and speed
by half vertically". A terminal cell is about twice as tall as it is wide, so at one column a tile every range,
aura and build range is drawn twice as tall as it is wide, and a unit walking down the screen looks twice as fast
as one walking across. The open question he parked in August about the cell's aspect ratio asks the same thing.

**Question.** Which fix is worth building?

**What was built to answer it.** A throwaway prototype on its own worktree branch (spike commit `728bfc9`, scripts
in `spike/aspect/` there; never merged), with two switches: **square tiles** (two columns a tile at every size)
and **rows count double** (a row counts as two columns in every distance, and a step up or down takes twice as
long), the latter at two scales: halve vertically (Mario's idea: a range 4 reaches 4 columns and 2 rows) and
double horizontally (a range 4 reaches 8 columns and 4 rows). The same moments were captured under each: a Turret
armed beside the Nexus, a battle at the moment Vasse's aura first guards a hit, and a race of two pairs over the
same distance on screen, one down the map and one across it. With both switches off every test and every pinned
hash was unchanged.

## Findings, surprises first

- **The interface already counts a row as two columns, in four places**: the raid panel's "from the north-east",
  where arming searches for a spot (`armVerticalCost`), the trail's arrowheads and the focus arrow. Rows counting
  double makes the rules agree with what the screen already assumes; square tiles would make those four wrong
  unless they learn the tile width.
- **Mario's scale breaks melee unless melee gets a rule of its own.** With rows doubled, two troopers one row apart
  are 2 apart, outside a range of 1: measured, they never swung. Melee becomes "touching", and every "beside" that
  was written as a distance of 1 must count steps instead (troops gathering at the line, the forecast's "next to
  it", two tests).
- **The biggest cost is the build range, not the kernel.** At the default of 3 the range reaches one row up and
  down: 54 tiles instead of 94, and 5 places a Barracks fits instead of 21; the line PERIMETER's troops hold
  cannot be built on in round 1. At 6 it gets its rows back: 124 tiles, 49 places.
- **Crossing a reach takes as long as today**: half as many rows at half the speed. What changes is an approach
  from far above or below: PERIMETER's raid from the ridge lands its first shot at 10 seconds instead of 5.
- **The two scales are one rule with every number doubled, and balance very differently.** Halving rows kept
  PERIMETER's shape (nothing built lost the last round, every plan that built held; a lone Barracks held at 46 of
  its 49 places at build range 6). Doubling columns doubles sideways speed while attack cooldowns stay: a lone
  Barracks held at only 10 of 49.
- **Rows that count double and the two-column screen do not mix**: at two columns a tile, every shape comes out
  twice as wide as tall and a unit going down looks half as fast. So rows counting double means one column a tile
  at every size; at 128 columns that shows 72 × 18 tiles instead of today's 48 × 18.
- **Square tiles show half the map at 80 × 24**: 24 × 18 tiles instead of 49 × 18, below the 48 × 16 the 80 × 24
  floor promises; PERIMETER's base and the ridge the raid starts from do not fit one view, at 80 × 24 or 104 × 32.
  Buildings and units have no two-column art: a tile is its glyph and a blank, so they read `[ b ]`, `> X <`.
  It is what the game already draws at 128 columns or wider.
- **Determinism holds** under every switch, on Node and Bun.

## Discarded

- **Drawing a step up or down over more time**, the earlier recommendation's narrow start: units are drawn on whole
  tiles, so the only thing presentation can delay is when a jump is drawn, and a slower crawl down the screen draws
  units rows behind where they fight (in the race, about five rows short). It fixes no shape either.
- **Flattened outlines over the rules as they are**: the pictures would lie about what is in range.
- **Shapes only, or speed only**: either breaks "in range" meaning "reachable in that time".
- **Ranking a step by distance gained**: under doubled rows every unit walks down first, then across; ranking by
  gain per unit of time keeps today's staircase, along the screen's diagonal.
- **Half-block cells for the battle**: no letter a unit, and not 7-bit ASCII.
- **Square cells on the browser page**: the page must stay the terminal's screen.

## Numbers

| Terminal | Tiles in view today | Square tiles | Rows count double |
| --- | --- | --- | --- |
| 80 × 24 | 49 × 18 | 24 × 18 | 49 × 18 |
| 104 × 32 | 72 × 24 | 36 × 24 | 72 × 24 |

| Reach, tiles covered (width × height) | Today | Rows double, halve vertically | Rows double, double horizontally |
| --- | --- | --- | --- |
| Turret, range 6 | 85 (13 × 13) | 43 (13 × 7) | 157 (25 × 13) |
| Vasse's aura, 3 | 25 | 13 | 43 |

The race, in ticks to arrival (11 rows down against 22 columns across, the same distance on screen): today 45
down and 89 across; halve vertically 89 and 89; double horizontally 45 and 45; square tiles 45 and 89 over twice
the screen, so the same speed on it. Under halve vertically, odd ranges round down vertically: range 3 reaches
one row, range 5 two.

Where rows counting double touches the code: about 16 files in the prototype (+216/−59), the grid's distance and
direction, movement's step cost and credit, intents, arbitration, attacks (melee as touching), perception,
targets, auras and blasts, the rules layer's placement search and "next to it", the Build Phase's territory, and
the view's outlines, aura glow and "near her". Of the 42 checked-in scenarios, 38 end in a changed state under
halve vertically (17 a changed outcome, 2 a changed winner or reason). With the switch on, 105 of 1013 tests
failed, about 70 of them because the narrower build range refused a plan they place; square tiles failed 41,
layout and text budgets written against 49 × 18.

The PERIMETER outcomes above were measured before this round's waves of troopers landed, so its absolute numbers
(today, nothing built lost the last round) are the previous round's; the comparison between the options holds.

## Recommendation

**Rows count double, at Mario's scale (halve vertically), felt first as an Experiment**, with the build range at 6
while it is on, and **square tiles** beside it as a second Experiment, which is a few lines, so both can be
compared in one evening of PERIMETER. It is the only option that makes ranges and movement look right at 80 × 24
with the whole map in view, and it kept PERIMETER's shape. Building it properly is a step of its own: the switch
becomes an input of the Battle Round so a replay knows it, melee becomes touching and "beside" counts steps, every
pinned hash and about a hundred tests move once, and the build range, Vasse's aura radius, blasts, the engage
reach and PERIMETER's round length are retuned. If it is kept, the distance and tile-width rules change in one
pull request with the retune: Manhattan becomes "a row counts two" (the grid design), and adaptive tile width
goes, one column a tile at every size (presentation).

Not tried by a person yet: nobody has played either switch.
