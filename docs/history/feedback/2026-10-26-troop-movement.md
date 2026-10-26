# Troop movement (2026-10-26)

Mario's request to explain, justify and evaluate how troops move, and to turn the pathfinding chapter into one on
troop movement. These notes continue [`2026-10-24-runs-gameplay.md`](2026-10-24-runs-gameplay.md)'s numbering. His
words are as he wrote them. Status values: **Built**, **Scheduled**, **Open**, **Contested**. The reasoning and the
evaluation are in [the review](../reports/2026-10-26-troop-movement-review.md).

### F210 — Explain how troops move, why, and whether the explanation holds up

> Describe the full pathfinding process. If someone would to ask "how do troops move in Terminal Nexus?" then how
> would you explain it, starting from the general idea, then moving into smaller details. After that, explain "why",
> with references to similar games, and why certain algorithms work better than others. Then, evaluate the
> explanation itself. Is is smooth? is it simple? can players use this knowledge to exploit different interesting
> strategies? Does it feel intuitive when in motion? (at the end of the day, the explanation in text is not as
> important as the actual game in movement).
>
> Focus on the goal: each build phase prepares the next round, or takes tradeoffs that pay off on later rounds. Being
> able to understand how your troops and enemy troops behave is essential to take the right tradeoffs.

**Built.** [The review](../reports/2026-10-26-troop-movement-review.md): the seven rules a player needs, the games and
algorithms behind them, and the evaluation, with what was watched and measured on scripted duels.

### F211 — Pathfinding is troop movement: re-purpose the chapter

> Since we are making an RTS game where players only need to focus on the building phase, then building placement is
> both defensive and offensive. Defensive because it disrupts the enemy path-finding towards the nexus or valuable
> resources. Offensive because it initiates the troop formation which makes the troops more efficient.
>
> So, in this game "pathfinding" is more than just moving, it is "troops movement". And I think we should re-purpose
> the spec and docs on pathfinding to be more generally troops movement.

**Built.** [`movement.md`](../../system-design/movement.md) is now the troop movement chapter: what a player should be
able to predict first, then one section for each part he listed, then the machinery that was the whole chapter before.

### F212 — Build Phase and Battle Round

> Build Phase vs Battle Round: it's worth covering the basics; units are idle during the build phase and only attack
> during battle rounds. This is the will of the nexus.

**Built** (the chapter's first section), with Recall: every round starts from the base.

### F213 — The enemy Nexus and the central path

> Enemy Nexus: The general idea that the army goal is to reach and destroy the enemy nexus. The army follows a central
> A* path that goes from your Nexus to the enemy Nexus.

**Built** as a section; **Open** on the path itself. There is no A\* line: the army walks a distance field, and the
line it keeps to is straight, from the Commander to the goal. The review recommends making that line the march route,
drawn on the Build Phase for both sides ([the question](../../milestones/open-questions.md#q86--should-the-march-route-be-drawn-on-the-build-phase-and-be-the-line-the-army-keeps-to)).

### F214 — Target banners

> Target Banners: this is still a concept, but the idea is that maybe we implement targeting with banners: placing a
> checkpoint in the map in offensive or defensive mode that units prioritize. The default location is the enemy nexus
> in offensive mode, but it could be changed to defend a base, or place the army in the center of the map, etc. I also
> want to experiment with a secondary "skirmish" banner that could be used from some buildings to send spawned troops
> to a different location. The commander always follows the primary banner. This could make very dynamic and strategic
> battles, but also complicate the UI. So it will be experimental for now. Placing aggressive banners on the map is a
> way to create a route, the units go to the banner location first, and from there they keep moving towards the enemy
> nexus. Placing defensive banners hold strategic locations.

**Open.** Designed in the chapter as an IDEA on the existing machinery (hold is a side's target, built; attack is a
waypoint that needs no memory), staged behind a "Banners" Experiment
([the question](../../milestones/open-questions.md#q88--how-should-banners-arrive)).

### F215 — Troop spawning

> Troop Spawning: explains how troops come out of buildings and start moving or attacking

**Built** as a section. Measured on the way: a wave comes out 5 seconds in, about when the fronts first meet, so waves
are reinforcements and where a building stands decides how soon its wave fights.

### F216 — Troop formation, and a name for going behind the enemy's line

> Troop Formation: explains how troops try to self arrange while moving, frontliners, ranged, long ranged, and
> backliners (or find the best name for the idea of trying to move behind the enemy line).

**Built** as a section; **Open** on the name: flanker is recommended
([the question](../../milestones/open-questions.md#q89--what-is-the-line-that-goes-behind-the-enemys-front-called)).

### F217 — Targeting and attacking

> Targeting and Attacking: explains how troops change from exploring mode into attack mode, the vision radius, how
> they choose a target and attack until the target is eliminated, and how they move differently while in battle.

**Built** as a section; **Open** on "attack until the target is eliminated": today a unit changes to anything nearer,
every tick. Lock-on once in reach is recommended, behind an Experiment
([the question](../../milestones/open-questions.md#q87--should-a-unit-keep-its-target-once-its-attack-reaches-it)).

### F218 — Workers

> Workers: explain the different rules for workers as they try to gather resources.

**Built** as a section: what is built (they flee) and, as guidance for the worker economy, how they will walk to a job,
flee with a margin and come back.

### F219 — Smart, smooth, predictable

> Units should be smart enough, smooth, but even more important, predictable. Please analyze the current design, and
> think of ways to make it better. Use the text explanation complexity as a way to see if the system is intuitive
> enough.

**Built** as the review's evaluation and its six changes in order; the four that are his to decide are questions.
