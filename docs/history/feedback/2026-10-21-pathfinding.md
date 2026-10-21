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

**Scheduled**, as the round's first part: the Citizen and the Ravel Grid Nexus each get one shot that kills a
trooper, and mend a little between rounds, the two alike. Upgrading either with a Nexus power, and the factions'
Nexuses differing, are later.

### F191 — A pathfinding chapter in the grid architecture

> For everything else, what I'm looking for the most right now is to look for the pathfinding design. I'm still
> looking forward for the last analysis where we can explain pathfinding very well, and with that end up in a proper
> pathfinding chapter in the grid architecture that explains how things move. I hope that we can explain it in simple
> terms that are actually efficient, because later we're going to have modifiers to that. There's going to be units
> that step back, for example, to avoid damage. Other units will kind of teleport forward. So just defining the basic
> building blocks for pathfinding will work.

**Scheduled**: a chapter of its own in the grid's design, how a unit moves, from its building blocks up, and where a
modifier (stepping back, leaping forward) plugs in.

### F192 — Rocks and buildings are not the same wall

> Maybe what happens if the enemy blocks the entrance with buildings, then the pathfinding should know the difference
> between rocks and buildings and should decide to target one of the buildings.

**Scheduled**: when the only ways to a unit's goal are closed by the enemy's buildings, it turns on the building in its
way rather than standing.

### F193 — A general path, once, and the way round obstacles along it

> So yeah, I do like the idea of having a general path that is resolved once from Nexus to Nexus, and then the units
> do something similar to A+, but only to find their way through the general path, so they move in the general
> direction and they can walk around obstacles when they find them.

**Scheduled**, as part of the chapter: it says how the built design already is this idea (a field toward the enemy
Nexus worked out once and shared, each unit stepping round what is in its way), and where it differs.

### F194 — The roofs: so far so good

> The building, walking through the roofs on the building at spawn time is something I will test and know, but so far
> I like it. It seems to help create formations with proper building placement, and that's really what matters.

**Built** (pull request 80); his playtest waits.

### F195 — A beacon to gather and shape an army, later

> Let me know also if there is any other ideas. Perhaps there is some bacon buildings that can be placed that tell
> units to group together before moving, and maybe that building can be configured during build time to define
> different formations. I don't know if that's too advanced, so we'll go without that first and then we'll test it at
> some point.

**Scheduled** for later, in the backlog beside the banner: a beacon a player builds where an army gathers before it
moves, set during the Build Phase to a formation.
