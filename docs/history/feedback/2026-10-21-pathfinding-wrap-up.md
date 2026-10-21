# Pathfinding, the wrap-up (2026-10-21)

After area damage merged (pull request 82), Mario asked for one last polish round on the pathfinding milestone before
the next one: the mortar's numbers and look, survivors coming home to their buildings, the pathfinding section of the
architecture, the Commander as the army's guide, and formation lines. "This is a polish PR, but actually a pretty
difficult one. Please take your time to reason and test." These notes continue
[`2026-10-21-pathfinding.md`](2026-10-21-pathfinding.md)'s numbering. His words are voice transcription, kept as they
arrived. Status values: **Built**, **Scheduled**, **Open**, **Contested**.

### F199 — A file of play strategies for the model players

> interesting point about using buildings for formation vs blocking. Maybe we should have a file for play strategies
> on the ai playing instructions as we discover more ways to prepare the build phase.

**Scheduled**, in this round.

### F200 — The mortar: a harder explosion for enemies only, a shorter fire that bites harder

> the mortar has two functions: area of damage (explosion) and damage over time (fire). The initial explosion can do
> a bit more damage, and the fire also bite harder. No need to keep longer than 4s. The explosion only deals damahe to
> enemies while the fire becomes a terrain effect that affects everyone.

**Scheduled**, in this round.

### F201 — Burning ground drawn red and yellow, lighter, flickering

> Also adjist the effect, that red seems too intense and will be part of many battles so it will be common on the
> battlefield . Instead it could be se red and yellow, more transparent and use flashing effect instead of constant
> color.

**Scheduled**, in this round.

### F202 — Survivors come home to the roof of the building that made them; a unit waiting to come out

> survivors should return to their building piling on the roof as close to original position as possible (test woth
> larger armies, they will spread around). We should also solve how to "queue" a unit that spawned but has no space
> yet because there are other units on top.

**Scheduled**, in this round.

### F203 — Look for more to optimise in the pathfinding

> Check pathfinding algorithm for more opportunities to optimize.

**Scheduled**, in this round.

### F204 — A pathfinding section in the architecture that explains what units do

> Make sure we have a dedicated section on the grid architecture spec about pathfinding. How does it read? is it
> defined in a way that can explain the default units behavior?

**Scheduled**, in this round.

### F205 — The Commander as the army's guide; a line from Nexus to target without one

> Pathfinding uses a general line to guide the army. Is it possible we make that line the commander? or at least when
> the commander is in battle, the other units can use that as reference. When the commander is not in battle, then a
> line from nexus to nexus (or target banner or campaign target marker). This will allow some more interesting
> movement.

**Scheduled**, in this round.

### F206 — Formation lines: melee ahead, ranged behind, backliners beyond

> Unit formation can be improved if units themselves have a preferred formation position. This should happen
> naturally when they start shooting, but it would be even nicer if rangers would defer to melee units while moving
> through the map so when they arrive at the enemy they are more or less already prepared in formation. We could
> declare 4 preferred lines: backliner (tries to go beyond the enemy line), melee, short range and long range, so when
> marching next to other units they would yield and slowly self-arrange. Movement has many states and we should take
> advantage of that

**Scheduled**, in this round.
