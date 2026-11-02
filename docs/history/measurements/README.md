# Measurements

_Results of `bin/measure.ts`, written down as [`measurement.md`](../../system-design/measurement.md) says: each file is
one run of a spec, with the build and the day it ran on and the rules it measured. Read one with
`node bin/measure.ts show <file>`; compare two with `node bin/measure.ts compare <before> <after>`. How to make one,
and how to retire one, is the [`remeasure`](../../../.claude/skills/remeasure/SKILL.md) skill._

**Status** says whether a result still describes the game: **current** (the latest on the rules now built),
**current, short of** a later change (that change moved part of what it measured, not yet played again), or
**superseded by** a later file (the rules it measured have changed under it). A superseded file is kept as it was;
its numbers are history, never quoted as fact by a current document. Every file here has a row: the validator says so.

| Date | File | Spec | Build | Rules it measured | Report | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-10-20 | [2026-10-20-baseline-greedy.json](2026-10-20-baseline-greedy.json) | full | 8331d55 | the greedy step, before pathfinding: the baseline | [measured before routing](../reports/2026-10-20-measured-before-routing.md) | superseded by 2026-10-20-routes-and-roofs: units find routes |
| 2026-10-20 | [2026-10-20-routes-and-roofs.json](2026-10-20-routes-and-roofs.json) | full | 681aff2 | distance fields round what stands, crowds and swaps, reachable targets, slow ground, side layers, flight maps, the enemy Nexus by default, units out over the roofs: the pathfinding milestone, built | [pathfinding, measured](../reports/2026-10-20-pathfinding-measured.md) | superseded by 2026-10-21-nexus-fights-back: the Grid Nexus shoots and mends |
| 2026-10-21 | [2026-10-21-nexus-fights-back.json](2026-10-21-nexus-fights-back.json) | full | 6f8ba1b, with the Nexus change (f2050ea) not yet committed | the routes above; every Grid Nexus shoots units in reach and mends between rounds | [the Nexus fights back, measured](../reports/2026-10-21-nexus-fights-back.md) | superseded by 2026-10-21-the-march: the march, survivors home, the mortar's numbers |
| 2026-10-21 | [2026-10-21-area-damage-formations.json](2026-10-21-area-damage-formations.json) | quick, duels only, rush and balanced each with and without area damage, block against apart | f9d7283 | the routes, the Nexus that fights back, breaching, the bomber, the mortar and burning ground; scripted players choosing a formation | [area damage, measured](../reports/2026-10-21-area-damage.md) | current, short of the mortar's new numbers and the march: the question of block against apart, not a whole-game measurement |
| 2026-10-21 | [2026-10-21-the-march.json](2026-10-21-the-march.json) | full | 513f696 | the routes, breaching, area damage, the march (the Commander as guide, formation lines, the bomber a backliner), survivors home on their roofs keeping room for a wave, making way only for a wave the army has room for, the mortar's enemy-only burst and shorter fire, faster routes | [the march, measured](../reports/2026-10-21-the-march.md) | superseded by 2026-10-31-commitment-and-reach: the formation, commitment, reach, the flip-flop fix |
| 2026-10-31 | [2026-10-31-commitment-and-reach.json](2026-10-31-commitment-and-reach.json) | full | 431869c (the kernel of 63fbc99) | troop movement: three states, the formation's priority list, commitment, a target out of reach let go, a walled-in target kept when no other can be reached | [commitment and reach, measured](../reports/2026-10-31-commitment-and-reach.md) | current |

The formations measure (`measure formations`) is not kept as a file; its run is
[its own report](../reports/2026-10-20-formations.md). It plays against a Grid Nexus that does not shoot, so the Nexus
change did not move it: played again on 2026-10-21 at 315d350, with breaching built, it gave the report's numbers
exactly. On 2026-10-21 it gained battles against area damage alone (crawlers, mortars, bombers), reported in
[area damage, measured](../reports/2026-10-21-area-damage.md); its shapes' own numbers did not move. Status: current.
