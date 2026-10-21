# Pathfinding, after the merge (2026-10-21)

After the pathfinding milestone merged (pull request 80), Mario answered its two questions, asked for a pathfinding
chapter in the grid architecture, and said what he will play. These notes continue
[`2026-10-13-commander-armies.md`](2026-10-13-commander-armies.md)'s numbering. His words are voice transcription,
kept as they arrived. Status values: **Built**, **Scheduled**, **Open**, **Contested**.

### F188 — What to play, and a round of feedback after

> Thank you. I will try playing the game. Please tell me which commands I should use, although I think they are
> already on the pull request, so I will look over there. Let me know if there is any other scenario that I should try
> to get the feeling, and I will send a round of feedback after that to correct immediately on a subagent.

**Built.** The commands and the scenarios worth trying were answered in the session, and are in the pull request
that follows this round: PERIMETER with two Barracks side by side, the "Way off the roof" Experiment both ways, the
route scenarios through `bin/grid.ts`, and a duel bench.

### F189 — An answer to a tight army: area damage, like banelings

> So what will make an army build a spread worth choosing? One answer, Bane links. In StarCraft, there is the typical
> put Marines together with the steam pack or spread Marines to absorb the upcoming Bane links. So basically, the
> rebels will have a unit that comes and bombs all your units. And so we need something similar for the citizens.
> They should probably have some sort of radiation gas or bombs. I think like missiles, basically. It should be a unit
> that is able to throw missiles that have large area, and they should probably set the ground on fire. So we could
> have a way to represent a large area that is set on fire, so when the units walk through it, they all take damage.
> Although that area should be really large. Anyway, let me know what you think. Things that could deal more area
> damage, affecting a lot of units if they are put together, and not that many units if they are separate. It should
> probably have something that spreads over 5 or 6 tiles.

**Open**, with a design proposal for his word ([the open questions](../../milestones/open-questions.md), what makes
a loose army worth building): for the Ravels, a bomber that runs in and bursts; for the Citizens, a missile unit whose
shots land on an area five or six tiles across and leave the ground there burning for a few seconds, hurting whatever
stands or walks on it. Burning ground is a new thing on the Grid (a patch with a lifetime, damage a tick, drawn), so
it waits for his yes before it is built.

### F190 — A duel's first rounds: the Nexus fights back, and mends a little each round

> How do we stop the first 2 rounds deciding a duel? I think making the Nexus dealing attack is one way. Another way
> will be giving Nexus self-recovery per round, healing per round. So think about those. All of those things also are
> properties that can be upgraded with Nexus powers in some factions. All of that sounds pretty good. I'm tempted to do
> some asymmetry here with the different Nexus, but let's start with just saying the Nexus have a single attack that
> deals enough damage to kill a trooper, a small trooper, which is more important at first and can be a stop later.
> And perhaps we add like a little bit of self-healing, which is probably different for the other factions, but let's
> just focus on the citizens and the rabble being mostly the same type of nexus. Yeah, that sounds good. Go ahead and
> implement that.

**Built.** The Citizen and the Ravel Grid Nexus each shoot a unit within a marksman's reach every three seconds
for 40, enough to drop a trooper or a runner, never at a building; and each mends 40 of its 400 between rounds. Their
cards say so. Measured over 162 duels, the duels over by the end of round 2 fell from 35 to 4, though the side ahead
after round 2 still wins nearly all the rest ([the report](../reports/2026-10-21-nexus-fights-back.md)). Upgrading
either with a Nexus power, and the factions' Nexuses differing, are later.

### F191 — A pathfinding chapter in the grid architecture

> For everything else, what I'm looking for the most right now is to look for the pathfinding design. I'm still
> looking forward for the last analysis where we can explain pathfinding very well, and with that end up in a proper
> pathfinding chapter in the grid architecture that explains how things move. I hope that we can explain it in simple
> terms that are actually efficient, because later we're going to have modifiers to that. There's going to be units
> that step back, for example, to avoid damage. Other units will kind of teleport forward. So just defining the basic
> building blocks for pathfinding will work.

**Built**: [how things move](../../system-design/movement.md), a chapter of the grid's design — the five building
blocks, a tick in order, what happens when a goal cannot be reached, and where each modifier plugs in (stepping back
is a purpose, leaping forward a move that is not a step, burning ground a weight, a beacon a goal).

### F192 — Rocks and buildings are not the same wall

> Maybe what happens if the enemy blocks the entrance with buildings, then the pathfinding should know the difference
> between rocks and buildings and should decide to target one of the buildings.

**Built.** When nothing a unit wants can be walked to, it works out the way with the enemy's buildings open, the
fewest buildings first, and turns on the first one on that way, if it can strike a building; rock is never broken. A
scenario closes a ridge's only gap with a Barracks far from the straight line: the troopers break it and take the
Nexus, where before they stood at the rock until the time ran out.

### F193 — A general path, once, and the way round obstacles along it

> So yeah, I do like the idea of having a general path that is resolved once from Nexus to Nexus, and then the units
> do something similar to A+, but only to find their way through the general path, so they move in the general
> direction and they can walk around obstacles when they find them.

**Built**, in the chapter: the field toward a goal is his general path, shared by every unit heading there; what
stands still is a wall in it, and a unit held up behind stuck allies works out its own way round them, his "A\*
through the general path". The one difference is that the field is worked out again every tick, not once a match,
because the Grid changes and a field is cheap.

### F194 — The roofs: so far so good

> The building, walking through the roofs on the building at spawn time is something I will test and know, but so far
> I like it. It seems to help create formations with proper building placement, and that's really what matters.

**Built** (pull request 80); his playtest waits.

### F195 — A beacon to gather and shape an army, later

> Let me know also if there is any other ideas. Perhaps there is some bacon buildings that can be placed that tell
> units to group together before moving, and maybe that building can be configured during build time to define
> different formations. I don't know if that's too advanced, so we'll go without that first and then we'll test it at
> some point.

**Scheduled** for later, in [the backlog](../../milestones/backlog.md) beside the banner: a beacon a player builds
where an army gathers before it moves, set during the Build Phase to a formation.

## After the merge of pull request 81

### F196 — Yes to the bomber and the mortar: test area damage against a tight army

> Yes, I like the ideas for the rebel bomber and the citizen mortar. Go ahead, implement those to test differences in
> formations with units. You will see some insignificant changes in strategies, some asymmetry, and that is exactly
> the type of unit composition that we're looking for.

**Scheduled**: the Ravel bomber, the Citizen mortar and burning ground, the buildings that train them, and the
formation game played against them.

### F197 — Every unit has its own personality: the units to come

> Every unit in the games will have its own personality. There may be similar units in between different armies, and
> some units may be necessary, like a tank and a ranger, but special units are what make this game fun, especially
> looking for things that will create complex entropy into the battlefield, like, for example, units that will create
> push or units that will slow down other units, disrupting the formations. All of that that can maybe mind control
> and change a unit to the other side, resurrect from debris, and things that will create chain effects from little
> differences, I think, are what makes this type of auto battler the most fun. Pull a unit, hook a unit from the back,
> have units that have long range, other units that can teleport themselves or throw themselves forward to attack the
> other units from the back, units that can target buildings specifically, units that have a lot of health, units that
> can fly and go forward, skipping others, units that step back and can dodge attacks, units that have a shield that
> recovers, units that help other units become stronger, units that heal other units or protect them with extra
> shield, units that can burrow and approach underground the ranged units, units that are weak and strong and
> explosive, units that have a lot of area damage, units that are easy to kill, but if not killed, they can have high
> numbers. Sometimes there are units that can deal a lot of damage in one shot, but they take a long time to recover.
> Units that take a while to position themselves, like tanks, and then can deal a lot of damage. Units that can
> combine with other units, maybe at some point in battle merge with other units to turn into something new. All of
> that are ideas for possible future units we can have that we will fit in the most thematic possible way in the right
> army. But that is what I'm looking forward to, create complex battles.

**Scheduled** for the armies' next pass: the list kept in [the backlog](../../milestones/backlog.md) as the units to
come, each to find its army; this round builds only the two area units.

### F198 — Strategies a scripted or a model player can choose

> For now, let's start testing area of damage versus clamping. And the testing script, or when we have the agent
> playing versus agent, so we'll be able to decide to do one strategy or another and see significant changes. That
> will be our next iteration here. I'm looking forward to see the pull requests.

**Scheduled**: the scripted duel players and a model player may choose how tight they build, so a duel can set a block
against an army built apart, with and without area damage, and measure the difference.
