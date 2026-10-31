# Troop movement (2026-10-26)

Mario's request to explain, justify and evaluate how troops move, and to turn the pathfinding chapter into one on
troop movement. These notes continue [`2026-10-26-core-loop.md`](2026-10-26-core-loop.md)'s numbering. His
words are as he wrote them. Status values: **Built**, **Scheduled**, **Open**, **Contested**. The reasoning and the
evaluation are in [the review](../reports/2026-10-26-troop-movement-review.md).

### F213 — Explain how troops move, why, and whether the explanation holds up

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

### F214 — Pathfinding is troop movement: re-purpose the chapter

> Since we are making an RTS game where players only need to focus on the building phase, then building placement is
> both defensive and offensive. Defensive because it disrupts the enemy path-finding towards the nexus or valuable
> resources. Offensive because it initiates the troop formation which makes the troops more efficient.
>
> So, in this game "pathfinding" is more than just moving, it is "troops movement". And I think we should re-purpose
> the spec and docs on pathfinding to be more generally troops movement.

**Built.** [`movement.md`](../../system-design/movement.md) is now the troop movement chapter: what a player should be
able to predict first, then one section for each part he listed, then the machinery that was the whole chapter before.

### F215 — Build Phase and Battle Round

> Build Phase vs Battle Round: it's worth covering the basics; units are idle during the build phase and only attack
> during battle rounds. This is the will of the nexus.

**Built** as the chapter's first section. Recall is gone since the kept front: survivors stay and regroup between rounds.

### F216 — The enemy Nexus and the central path

> Enemy Nexus: The general idea that the army goal is to reach and destroy the enemy nexus. The army follows a central
> A* path that goes from your Nexus to the enemy Nexus.

**Built** as a section; **Open** on drawing it. There is no A\* line: the army walks a distance field, and the line it
keeps to is the central path, straight from its own Nexus to the goal. Drawing the march route waits (F230) ([the question](../../milestones/open-questions.md#q87--should-the-march-route-be-drawn-on-the-build-phase-and-be-the-line-the-army-keeps-to)).

### F217 — Target banners

> Target Banners: this is still a concept, but the idea is that maybe we implement targeting with banners: placing a
> checkpoint in the map in offensive or defensive mode that units prioritize. The default location is the enemy nexus
> in offensive mode, but it could be changed to defend a base, or place the army in the center of the map, etc. I also
> want to experiment with a secondary "skirmish" banner that could be used from some buildings to send spawned troops
> to a different location. The commander always follows the primary banner. This could make very dynamic and strategic
> battles, but also complicate the UI. So it will be experimental for now. Placing aggressive banners on the map is a
> way to create a route, the units go to the banner location first, and from there they keep moving towards the enemy
> nexus. Placing defensive banners hold strategic locations.

**Scheduled.** Designed in the chapter as an IDEA on the existing machinery (hold is a side's target, built; attack is a
waypoint that needs no memory); three stages agreed (F230), the stance and the banner steps of the runs milestone.

### F218 — Troop spawning

> Troop Spawning: explains how troops come out of buildings and start moving or attacking

**Built** as a section. Measured on the way: a wave comes out 5 seconds in, about when the fronts first meet, so waves
are reinforcements and where a building stands decides how soon its wave fights.

### F219 — Troop formation, and a name for going behind the enemy's line

> Troop Formation: explains how troops try to self arrange while moving, frontliners, ranged, long ranged, and
> backliners (or find the best name for the idea of trying to move behind the enemy line).

**Built** as a section; the formation itself is redesigned by F227, and the name is flanker (F230).

### F220 — Targeting and attacking

> Targeting and Attacking: explains how troops change from exploring mode into attack mode, the vision radius, how
> they choose a target and attack until the target is eliminated, and how they move differently while in battle.

**Built** as a section; commitment is the default (F228, F230).

### F221 — Workers

> Workers: explain the different rules for workers as they try to gather resources.

**Built** as a section: what is built (they flee) and, as guidance for the worker economy, how they will walk to a job,
flee with a margin and come back.

### F222 — Smart, smooth, predictable

> Units should be smart enough, smooth, but even more important, predictable. Please analyze the current design, and
> think of ways to make it better. Use the text explanation complexity as a way to see if the system is intuitive
> enough.

**Built** as the review's evaluation and its six changes in order; his answers are the next round (F223 to F230).

## His answers, 2026-10-27

His reply on the pull request, before the kept front merged. As he wrote it.

### F223 — Refocus: a recommendation first, then the docs, then build

> Refocus the PR as a recommendation ... Rewrite Troops Movement -- yes that doc is better read like this, and our job
> here is to significantly improve that doc, then cascade the changes to milestones and other resources, and we will
> follow with implementation after that. ... Complete the docs, and then use sub-agents with Sonnet to implement as much
> as possible. Any elaborate or significant changes can be addressed on the next PR.

**Built.** [`movement.md`](../../system-design/movement.md) rewritten on his answers; the runs milestone gains a step,
troop movement, before the stance.

### F224 — The Commander is a regular troop

> Commander -- it does not need to head the army. Sorry if I miss-explained. The commander is just another unit and it
> should respect the formation rules. Maybe later when we implement banners we can experiment with defensive stands,
> but for now is easier to just make it a refular troop. Since the commander spawns at the nexus, they will follow the
> central path more closely, that's it.

**Scheduled** (troop movement): she takes her attack's place in the formation; the central path runs from the Nexus.

### F225 — Troops are not recalled

> Troops only move in a Battle Round -- they are not recalled. That is only the current implementation and I am working
> to remove that in favor of staying on the battlefield.

**Built** by the kept front (pull request 87); the chapter says so.

### F226 — States, vision, breaching

> Army march -- no A*, i agree, using each tile's distance is much better. That is re-computed when obstacles are
> destroyed, sounds good.
> Troop vision 6: this should be configurable for some troops, but a default of 6 sounds good.
> walk and attack -- we should explain and implement this as states: march (exploring and walking), in battle or
> retreating.
> breaking buildings on path -- yes, and that should be the default because troops attack buildings already.
> Workers flee. Yes that sounds good.
> Breaching -- yes and this is a good name. While this may happen automatically, the docs should mention this briefly
> and specifically.

**Scheduled** (troop movement): three states; vision, 6 by default, set per unit; breaching has its own short section.

### F227 — Formation by priority, half speed on the march

> Formation: Age of Empires is a great reference, but not exactly because this is an auto-battler. I wonder if we should
> take into account the range of the unit for preference. Let's define Formation priority starting from 3 formation
> types: flankers, melee, and ranged. When same type, pick priority by range, and then by class (e.g. tank, healer,
> bomber, etc), that way we can make a clear priority list for the formation arrangements. The formation happens
> passively during march state, here is an idea: half speed if another unit with higher priority is in vision range.
> During combat engagements, there may be some special conditions by class too that affect the combat movement.

**Scheduled** (troop movement): the priority list and the half-speed rule replace the places behind the Commander and
the yielding. Special conditions by class in combat wait for units that need them.

### F228 — Commit to a target

> Targeting: Clash Royale is a great reference. But adding vision range in the mix (along with movement state). And
> yes, our units should have simple targeting. We should find out what's wrong with so much re-targeting. It's ok to
> re-target if a unit is unable to attack the target for 2-3 seconds but otherwise they should try to commit to their
> own.

**Scheduled** (troop movement): commitment, letting go after 2½ seconds unable to strike; the cause of the re-targeting
found and written down.

### F229 — Smoothing, waves, strategies

> Simple -- Fantastic, this is gearing to be a great design. We will follow with implementation but not on this PR yet.
> Smooth -- take notes, we will work on smoothing the movement as well later
> Predictabe -- units should improve targeting. Waves are reinforcements, and that is fine. I think to improve this, we
> will make shorter 30 seconds rounds where building production restarts and syncs at the beginning of the round.
> Exploitable -- yes, fantastic. Perhaps we can add a section at the end of the movement doc to explore "strategies".
> This will be useful both to coding agents and players.

**Built** in the chapter: "To smooth later" and "Strategies" sections; waves as reinforcements, with 30-second rounds
(the kept front) and production restarting each round.

### F230 — The four questions

> draw march routes: not yet. I'm thinking in drawing from the commander, and perhaps using the commander as a
> re-grouping mechanism, but there are many ither thibgs to change and polish before this.
> Lock-on: yes of course. Some units may be exceptions in the future, but this should be the default behavior.
> banners in three stages -- agreed
> rename flanker -- agreed

**Answered**: lock-on (commitment), the banners' three stages and "flanker" are in the
[answered questions](../answered-questions.md); the march route stays an
[open question](../../milestones/open-questions.md#q87--should-the-march-route-be-drawn-on-the-build-phase-and-be-the-line-the-army-keeps-to),
parked.

## Stalls and targets, 2026-10-29

### F231 — Balancing the formation against stalls; other ideas to test

> any ideas about how to balance stalls with formations? Reducing half speed is just something I came out with, there
> may be better options. Perhaps we could "approximate" the formation while marching, without having to let the melee
> unit pass in front. What about letting pass being a temporal thing? perhaps speed can slow by half, then by quarter
> 2-3 seconds later, and recover 3-4 seconds later, to original speed. Additionally, there may be something they can do
> to let the back units pass, otherwise they may be slowing down and blocking. What about the back units gets a 20% speed
> boost if it is marching and there are lower priority units in front? Any other ideas or experiments you can test?

**Built** as measurements ([the report](../reports/2026-10-29-stalls-and-targets.md)): the timed ramp, the 20% boost and
a gap rule, on 54 duels. The slowing is what sorts the army and is not what stalls it; the ramp sorts as well and caps
the slowdown, the boost does nothing, and none is built.

### F232 — Targeting is behind the stalls: tune flanking and finding new targets

> I also think the stalling happens because of targeting changes. Tuning the ways units flank and find new targets will
> keep the fight going. Please experiment, implement the best solution, and document new behavior while keeping the
> whole troop movement explained in simple terms

**Built.** Following who held up whom found the head of most queues: a unit with no route to the enemy it held. A held
target that cannot be reached is now let go at once, and a unit that can reach none walks on round the fight; the
chapter explains it in plain words, with a walkthrough of a round. A shorter patience and spreading attackers over
targets were tried and are not built.

### F233 — A creative round: arenas, other games, the original targeting, new ways to engage

> experiment with more ideas before closing, and try out more scenarios designed to test battle speed and troops ability
> to engage.
>
> Check how other games solve this, see if the original targeting (before we modified it) had any advantages, think of
> new ways to engage in battle (not just targeting, and the patience re-targeting may have alternatives), and better ways
> to roam and flank when trying to find a target.
>
> Think that players will usually pick less melee units when there's a short pass or a queue, but still test what happens
> if they don't pick the right units for the terrain type. Mix land and air units when there's not enough space, etc.
>
> This is a creative and exploratory round. Also re-read the troops movement spec to evaluate simplicity and clarity,
> maybe some new idea that can be tested comes from there.

**Built** ([the report](../reports/2026-10-29-stalls-and-targets.md)): six engage scenarios (open ground, gaps of six and
two rows, a corridor, two lanes) as the bench for speed and for how many units strike; an arena of eight army mixes on
eight grounds; twenty variants measured; a research pass on how other games do it. What held: the original targeting was
no faster once the measurement was fair, and jams on open ground; nothing tried beats the rule built by more than 5%; the
wrong army for a short pass loses by a wide margin whatever the rule; flyers do not queue (a question in the register);
removing the band along the central path hurts. What did not hold, and was corrected in the same round: a first
"march on" rule whose gains were idle units.

### F234 — Re-read the spec for simplicity

(Part of F233.) **Done**: rule five of the seven had grown to three behaviours and is now two short sentences; the
chapter says the unreachable-enemy rule in one paragraph; and the simplest of the equivalent rules was kept, so a rule
that did not earn its place (marching on past the fight) was removed instead of explained.

### F235 — A testing ground for troops, buildings, formations and terrain

> Let's improve the way to test new troops and build strategies. This last round of polishing troop movement gave us
> many ideas about how to test if a given change in the troops movement algorithm results in more engagements, faster
> games and more strategical breath. We could experiment a little more with the focus of building a benchmark and
> testing ground to try out new units, buildings, formations and terrain types. This could be aspec with info about how
> to test win rate, what scenarios are available, how to modify a scenario, examples of successful tests that we did
> before, etc. look for opportunities to improve the way we measure, try to replicate some of the previous tests and
> improve the grid command to allow for better configurations and reading of results. Reorganize the folders and files
> related to testing scenarios, and remove legacy scenarios that don't add much value (e.g having no target, all game
> modes should have a target). I'm curious to see how you come out with better ways to validate changes in the gameplay

**Built** ([the report](../reports/2026-10-30-testing-ground.md), [the spec](../../system-design/testing-ground.md)):
the maps in folders by purpose, five retired, every side given a goal and a test that holds it; trials in `grid` over
seeds from both ends, with variants for another unit, army, number, ground or target, trial files with expectations and
a round robin of armies, and a before-and-after comparison. Replicated: the wrong army for the narrow pass, flyers
through it, the corridor's cost, a targeting rule before and after. Found on the way: the engage maps were not
symmetric, now rebuilt. Not built: setting a kernel rule from a trial (a rule is code; it is compared by `--baseline`).

### F236 — The testing ground is for testing changes, not for the best army

> The testing ground is not to test the best army on each ground. The goal of this pull request is to improve the tools
> of which you use to test different changes. So it will stay generic for now. Figuring out what army works best,
> whenever we add a new unit or a commander, whenever we change targeting algorithm or the ways a certain troop moves
> or the ways the army self-arranges information, maybe change priorities, add a new class. All of those things are
> going to happen, and every time we do that, we have to test it. [...] The thing I'm mostly interested here is you can
> analyze how the session is been working on the previous PRs, and see if there is any improvements that would have
> made that faster or better. [...] Then take a chance to refactor, reorganize the code, and also don't forget about
> ways to measure efficiency. For example, different troop moving algorithms can have different implications in
> performance, or maybe how often units are targeting. So all of those are useful things to have in the markdown
> document and available in the tools. [...] This type of game requires a lot of balancing, and that requires a lot of
> testing.

**Built** ([the report](../reports/2026-10-30-testing-ground.md), its second round): idle units, target switches and
stall queues in every battle's record; `--profile` for a tick's cost by the clock and by route work; `--against <ref>`
and `--jobs`; the battles worth watching with the command for each; the trial code in three parts; the spec rewritten
as a playbook by kind of change. Found with it: a target flip-flop at narrow passes, measured with a candidate fix and
left for the owner.

### F237 — Fix what the metrics found, then keep the testing ground generic

> First, yes, go ahead and fix this bug. If you find other bugs, go ahead and fix them too. [...] But after you do that,
> let's take a step back. It's possible we are starting to overfocus on our problem at hand because we just worked on
> troop movement and retargeting. [...] Please make sure this is not adding too much noise into the generic nature of the
> testing round. [...] Perhaps we decide some of the data we're logging is not that important. Remember that future
> sessions can always add it if they need it. So it's more important that the guide that we're writing for future
> agents explains the important concepts that help those agents use the tool and modify it as they need. [...] It's more
> about the shape rather than the specific functionality right now.

**Built** ([the report](../reports/2026-10-31-testing-ground-generic.md)): the flip-flop fixed and held by a test; the
duels' idle units checked and found to be held lines; a mislabelled measure removed; the stall queues, round robin, army
trials and extra columns dropped; the guide rewritten around the shape of a trial and how to extend each part.
