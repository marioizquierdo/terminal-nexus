# Tall tiles — the options, felt (2026-10-05)

Mario merged the Commander's fifth round (61), read the tall-tiles spike's report, and gave the next update to the
vertical space alone: first a brainstorm in the conversation (the problem said back to him, then the options), then
the options built as an Experiment he can play, the complicated ones drawn rather than built. They continue
[`2026-10-05-commander-round-5.md`](2026-10-05-commander-round-5.md)'s numbering. Built on a new pull request as a
sixth round of the Commander step. Status values: **Built**, **Scheduled**, **Open**, **Contested**.

### F131 — The next update is the vertical space: say the problem back, then the options

> meeged. Let's dedicate the next update exclusively to improve the vertical space. I described the issue. But I
> don't have a clear solution and I need your help to brainstorm that. Please start describing the problem back to
> me so I can verify that you understand it. Then propose a fee alternative solutions. The default solution will be
> to do nothing, just let vertical space and speed feel distorted and faster. Pros: easier to calculate distances,
> Cons: not intuitive for players and vertical move feels off, like falling or going up too fast. Calculating
> vertical space in half: Pros: looks "natural" much better for visually intuitive distances, Cons: melee units, and
> "counting tiles" needs to be adjusted. Please see of you can prolose other 2-3 more options, maybe we can doible
> horizontal speed and range (instead of half vertical), or maybe there are other options I didn't think off

**Built** (in the conversation). The problem said back: a cell is about twice as tall as it is wide, the rules
treat a tile as a square, so every reach is drawn twice as tall as it is wide and a unit walking down crosses the
screen twice as fast as one walking across (in the spike's race, 3.8 seconds against 7.4 over the same distance on
screen); no camera stretches ground upward. Five options: as now; a row counts as two (his halving); double
horizontally, which is the same rule with every number doubled, so it decides only which numbers stay; square tiles
(two columns a tile, the rules untouched); and a hex grid. Dropped after a look: drawing downward steps slower,
flattening only the outlines, half-block pixels, and rows counting three (a tilted camera), which comes back below
as a picture.

### F132 — Feel matters, not the map

> the map is not important, we will make nee maps later. What matters is how intuitive it feels for a human player,
> this is the time to get it right, we can still change all numbers and formulas to fit.

**Built.** The choice is judged by how it feels to play, not by whether today's maps fit: square tiles' main cost
(half as many tiles across at 80 × 24) counts for less, and any number or formula may change with the choice.

### F133 — Each option as ASCII art

> Please try to represent each option with ascii art in code blocks so I can visualize the tradeoffs.

**Built.** Each option drawn in code blocks, a reach, a second of walking down and across, a melee touch and a
building, in the pull request and in [the comparison](../reports/2026-10-05-tall-tiles-options.md).

### F134 — Build the simple options as an Experiment; only draw the complicated ones

> And yes, build playable scenarios with experiental flags so I can try them out. Don't implement the complicated
> versions (only visualize)

**Built.** One Experiment, Ground, last under THE MISSION in Settings, with four choices that apply at once: as now;
rows x2, a row counting two columns in every distance and every step, with melee as touching and the build range
counted in rows so a base still grows up and down; sideways x2, the same count with every number doubled across;
and square tiles, the rules as now with every tile drawn two columns wide. A battle carries its measure in its
state, so it plays from its first tick to its last by one rule; with as now every battle and every pinned hash is
exactly what it was. Every reach the Build Phase draws, Vasse's aura and the raid's trail follow the choice. A test
level, the Ground test (`campaign?level=ground-test`), puts two raids the same distance from the Nexus on screen,
9 rows north and 18 columns east, with room on its map for a Turret's whole reach; under rows x2 the two come at one
pace, as now the northern one twice as fast. The playable page opens it under each choice, and PERIMETER under rows
x2. The hex grid and a tilted camera are drawn, not built.
