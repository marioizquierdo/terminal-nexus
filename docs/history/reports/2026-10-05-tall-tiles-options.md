# Tall tiles: the options, drawn — comparison

Mario, choosing how to fix tall tiles ([his words](../feedback/2026-10-05-tall-tiles.md)): "What matters is how
intuitive it feels for a human player, this is the time to get it right, we can still change all numbers and
formulas to fit", and "Please try to represent each option with ascii art in code blocks so I can visualize the
tradeoffs." A terminal cell is about twice as tall as it is wide; the rules have always counted a row as a
column. Each option below is drawn the same way; the first four are built as the Ground Experiment, the last two
are drawn only. [The spike](2026-10-05-tall-tiles-spike.md) has the earlier measurements.

**How to read the drawings.** `T` is a Turret with a reach of 4, and the dots are what it reaches. `t` is a
trooper, which walks about three tiles a second today: `a` is where it is two seconds after setting off across,
`b` two seconds after setting off down. Under melee, `r` marks every tile a trooper can hit from where it stands.
The Barracks is drawn as each option draws it. Read them on the phone or the terminal: both have the same tall
cells, so the shapes look there as they do in the game.

## As now

```
a reach of 4    2 s walking
    .           t>>>>>a
   ...          v
  .....         v
 .......        v
....T....       v
 .......        v
  .....         b
   ...
    .

melee    a Barracks
 r       [b]
rtr      |_|
 r
```

- A reach of 4 is four tiles any way, and is drawn twice as tall as it is wide.
- In the same two seconds a trooper walks 6 columns across or 6 rows down, and 6 rows on screen are as long as
  12 columns: walking down looks like falling.
- Melee is the four tiles touching. Counting is simple: every step is one.
- At 80 × 24 the map shows 49 × 18 tiles.

## Rows x2 — a row counts two columns (built)

```
a reach of 4    2 s walking
    .           t>>>>>a
  .....         v
....T....       v
  .....         b
    .

melee    a Barracks
 r       [b]
rtr      |_|
 r
```

- A reach of 4 is 4 columns across and 2 rows up: it looks round.
- Across and down take the same time over the same distance on screen.
- Melee needs a rule of its own: the enemy above is 2 away, out of a range of 1, so melee counts touching, the
  same four tiles as now.
- Every reach loses half its rows; an odd range rounds down (5 reaches 2 rows, like 4). The build range is counted
  in rows here, so a base can still grow up and down: Build range 3 reaches 6 columns and 3 rows.
- A range number counts columns; up and down is half. The game draws every reach a player needs, so nobody has to
  count.
- One column a tile at every terminal size (two would draw every reach twice as wide as tall): 49 × 18 tiles at
  80 × 24, and more on a wide terminal.

## Sideways x2 — the same rule, every number doubled across (built)

```
a reach of 4         2 s walking
        .            t>>>>>>>>>>>a
      .....          v
    .........        v
  .............      v
........T........    v
  .............      v
    .........        b
      .....
        .

melee    a Barracks
 r       [b]
rtr      |_|
 r
```

- The rule is rows x2's; what stays is the other half of the numbers. A reach of 4 is 4 rows up and 8 columns
  across.
- Walking down is as fast as now, across twice as fast: the battle speeds up.
- Every reach covers about twice the ground (a Turret's range of 6: 157 tiles instead of 85), so every building and
  ranged unit gets stronger.
- Melee counts touching, as now; by the numbers alone it would hit across an empty column.
- A range number counts rows; across is double.
- One column a tile at every size: 49 × 18 tiles at 80 × 24.

## Square tiles — every tile two characters wide (built)

```
a reach of 4         2 s walking
        .            t > > > > > a
      . . .          v
    . . . . .        v
  . . . . . . .      v
. . . . T . . . .    v
  . . . . . . .      v
    . . . . .        b
      . . .
        .

melee    a Barracks
  r      [ b ]
r t r    | _ |
  r
```

- The rules are as now; each tile is drawn two columns wide, so it is about square on screen.
- A reach of 4 is four tiles any way and looks round, over twice as many columns.
- Walking is the same speed on screen both ways; across hops two columns a step.
- Melee and counting are as now: every step is one tile, whichever way.
- At 80 × 24 the map shows 24 × 18 tiles, half as many across; at 128 columns or wider the game already draws this.
- A building or unit is its glyph and a blank on each tile until it has two-character art: a Barracks reads
  `[ b ]`.

## Hex grid (drawn, not built)

```
a reach of 4         2 s walking
    . . . . .        t > > > > > a
   . . . . . .        \
  . . . . . . .      /
 . . . . . . . .      \
. . . . T . . . .    /
 . . . . . . . .      \
  . . . . . . .      b
   . . . . . .
    . . . . .

melee    a Barracks
 r r     [ b ]
r t r    | _ |
 r r
```

- Tiles in offset rows, two columns apart: six neighbours each, all about the same distance on screen (within about
  12%).
- A reach of 4 is a hexagon, the nearest to round of any option.
- Across is a straight line; straight down is a zigzag.
- Melee touches six tiles.
- At 80 × 24 the map shows 24 × 18 hexes, as square tiles do.
- Every map, building footprint and path would be redone, and rectangular buildings sit badly on hexes: the biggest
  change by far.

## Tilted camera — rows count three (drawn, not built)

```
a reach of 4    2 s walking
   ...          t>>>>>a
....T....       v
   ...          b

melee    a Barracks
 r       [b]
rtr      |_|
 r
```

- As if the camera looked at the ground from an angle: a reach of 4 is 4 columns across and 1 row up, wider than
  tall.
- Walking down is slower on screen than walking across, like depth.
- With 18 rows on screen up and down get coarse: a reach needs 3 more to gain a row.
- It is rows x2's rule with three in place of two.

## Built to feel

The first four are the Ground Experiment, last under THE MISSION in Settings (`d`, `End`, `Up`, then Left or
Right), applied at once to what the Build Phase draws and allows and to the next battle. A battle carries its
measure in its state, so it plays from its first tick to its last by one rule; as now, every battle and every
pinned hash is what it was.

The Ground test (`campaign?level=ground-test`) is the place to feel them: open ground, the Nexus in the middle rows
with room for a Turret's whole reach, and two pairs of raiders the same distance away on screen, one 9 rows north
and one 18 columns east. Measured there with nothing built, in ticks (twelve a second):

| | As now | Rows x2 | Sideways x2 |
| --- | --- | --- | --- |
| A third of the way in, north and east | 15 and 30 | 27 and 30 | 15 and 18 |
| First blow, north and east | 24 and 86 | 72 and 66 | 22 and 52 |

Square tiles play as now; on its screen the eastern raid really is twice as far, and starts off it to the right.
The same trooper racing 11 rows down against 22 columns across in the kernel arrives in 44 and 88 ticks as now, 88
and 88 with rows x2, and 44 and 44 sideways x2. A Turret's reach of 6 covers 13 × 13 tiles as now and with square
tiles (drawn 26 columns wide there), 13 × 7 with rows x2, and 25 × 13 sideways x2.

Not tried by a person yet.
