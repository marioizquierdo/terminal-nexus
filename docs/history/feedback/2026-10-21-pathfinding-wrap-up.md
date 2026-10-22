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

**Built.** [`play-strategies.md`](../../game-design/play-strategies.md) holds what duels have taught about playing a
Build Phase, each entry advice a player can act on with the measurement behind it. A model player reads it in its
brief, just before the plan it is asked for, and the duel skill says to add what a duel teaches there.

### F200 — The mortar: a harder explosion for enemies only, a shorter fire that bites harder

> the mortar has two functions: area of damage (explosion) and damage over time (fire). The initial explosion can do
> a bit more damage, and the fire also bite harder. No need to keep longer than 4s. The explosion only deals damahe to
> enemies while the fire becomes a terrain effect that affects everyone.

**Built.** The shell bursts for 12 within 2 and hurts only the enemy; the ground it leaves burns for four seconds at 8
a second, hurting anyone on it, either side: a unit that stands in it all that time takes 32, and 44 with the burst,
past a trooper's 40.

### F201 — Burning ground drawn red and yellow, lighter, flickering

> Also adjist the effect, that red seems too intense and will be part of many battles so it will be common on the
> battlefield . Instead it could be se red and yellow, more transparent and use flashing effect instead of constant
> color.

**Built.** A burning tile takes a faint scorch, most of a patch showing the ground itself at any instant, while flames
flash across it a beat at a time: a low one red, a tall one yellow on a red glow. It still dies down in its last
second; reduced motion holds it still, and monochrome draws the flames alone.

### F202 — Survivors come home to the roof of the building that made them; a unit waiting to come out

> survivors should return to their building piling on the roof as close to original position as possible (test woth
> larger armies, they will spread around). We should also solve how to "queue" a unit that spawned but has no space
> yet because there are other units on top.

**Built.** A unit a building trains remembers the building and the tile it came out on, and Recall sends it home onto
that roof, as near that tile as there is room, keeping room on the roof for one of its waves (a Barracks: two of its
six tiles); the rest stand round it, off the ground touching it. A wave with no room on its roof waits inside the
building, the Battle Round's panel says how many wait, and units on the roofs step down to make way when the army has
room for the wave. Played with 26 survivors of one Barracks and two Barracks side by side.

### F203 — Look for more to optimise in the pathfinding

> Check pathfinding algorithm for more opportunities to optimize.

**Built.** Profiled on the most crowded duel and made faster where the profile said: a tick with about 200 units and
buildings went from about 7 ms to about 5½ on Node, and every battle's events stayed byte for byte the same.

### F204 — A pathfinding section in the architecture that explains what units do

> Make sure we have a dedicated section on the grid architecture spec about pathfinding. How does it read? is it
> defined in a way that can explain the default units behavior?

**Built.** The architecture overview has a section of its own on pathfinding: what a unit does by default, as six
states (leaving the roof, marching, yielding, engaged, standing, fleeing), the five building blocks, and what makes it
the game's; the pathfinding chapter explains the march in full.

### F205 — The Commander as the army's guide; a line from Nexus to target without one

> Pathfinding uses a general line to guide the army. Is it possible we make that line the commander? or at least when
> the commander is in battle, the other units can use that as reference. When the commander is not in battle, then a
> line from nexus to nexus (or target banner or campaign target marker). This will allow some more interesting
> movement.

**Built.** While a side's Commander is on the Grid she is its guide: no marcher but a backliner goes ahead of its place
behind her, and a marcher more than 6 columns off the line from her to the goal takes, of its equally good steps, the
one toward that line. Without her, the line runs from the
side's Nexus to its goal.

### F206 — Formation lines: melee ahead, ranged behind, backliners beyond

> Unit formation can be improved if units themselves have a preferred formation position. This should happen
> naturally when they start shooting, but it would be even nicer if rangers would defer to melee units while moving
> through the map so when they arrive at the enemy they are more or less already prepared in formation. We could
> declare 4 preferred lines: backliner (tries to go beyond the enemy line), melee, short range and long range, so when
> marching next to other units they would yield and slowly self-arrange. Movement has many states and we should take
> advantage of that

**Built.** Backliner, melee, short range and long range: while an army marches, a ranged unit yields to the line ahead
of it, swapping places with one held up behind it, so it arrives in order; once an enemy is near, the lines close up
to fight. The bomber is a backliner. The runner was one at first and emptied Dob's front, so it stays melee, and which
unit is an army's first backliner is his to say.
