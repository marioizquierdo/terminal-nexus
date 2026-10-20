# Commander armies (2026-10-13)

After the Nexus Pulse merged (pull request 68), Mario asked for the Commander milestone to be re-evaluated and a new
plan made, then answered the plan. These notes continue
[`2026-10-08-keyboard-without-acceleration.md`](2026-10-08-keyboard-without-acceleration.md)'s numbering. His words
are voice transcription, kept as they arrived. Status values: **Built**, **Scheduled**, **Open**, **Contested**.

### F163 — Re-evaluate the milestone and make a new plan

> Let's move into more detailed commander design. I think we already covered a lot with previous updates so start by
> re-evaluating the milestone and making a new plan.
>
> We still don't have a fully playable version of the game. The perimeter level is a playground for experimentation
> and that is fine for now. The part I'm most i terested in covering now is the "structure" if a commander army,
> thinking about ways to differentiate commanders from each other, goving them character and presence in the UI,
> checkong if the resurrection mechanic through Nexus Pulses works well and is clear in the UI, and start thinking
> about catch-up mechanics (specially for multiplayer or player vs ai mode, if one player gets a lucky draw during
> first rounds, how to counter that without helplessly falling behind).

**Scheduled.** The plan, which he accepted (F166): the Commander milestone ends with one more step, the Commander's
presence on screen and her return, which is the one claim the milestone had not proved ("a player understands what
her death did"). The rest is a new milestone, Commander Armies
([`milestone-14-commander-armies.md`](../milestones/milestone-14-commander-armies.md)): what a Commander Army is,
the expected power curve, a second Commander, and the guidelines for catch-up.

### F164 — Survivors stack; later units are much stronger

> Some games like this one reture all units between rounds, so only buildings count, but I like being able to keep
> fighting with the previous units if they survive (stacking with the new army), but new unlocked units shohld be a
> lot stronger so that makes the initial moves more exoratory and opportinistic and the last few moves more decisive.

**Scheduled** for Commander Armies: survivors keep coming home and fighting again (as Recall already does), and the
expected power curve says how much stronger what each round brings should be, so early rounds explore and late ones
decide.

### F165 — The plan

> Let me know what is your best plan to address Commanders!

**Built** as the plan in the session, written into the milestones with F166's answers.

### F166 — His answers

> ok let's do this. Yes let's write the steps on your plan and finish this milestone. Averno looks good. For the
> catch up mechanic, no nees to implement the flag mechanic yet, only update deaign and documentation guidelines for
> deaigning a commander's army. We can focus on the expected power curve, with some rules on expected power per nexus
> pulse, so armies can build around this curve with different tradeoffs. Commanders can have different abilities, it
> depens on the commander; what mattes is the build's focus on commander or unit's or economy, etc. They will he
> asymetric by design. Active skills are still automatic, the user has no input durinf a battle round.

**Scheduled**, each into the plan:

- The Commander milestone finishes with its last step, the Commander on screen and her return: **Built**. A
  Commander panel in the Build Phase and the Battle Round (her portrait, health, skill and where she is in her life),
  her place kept at the Nexus while she is out, her return said as the Nexus Pulse's act, and an Activity Logs filter
  for her life.
- The second Commander is Marshal Averno.
- Catch-up is design and guidelines for authoring a Commander Army, not a mechanic built: no catch-up Experiment
  yet.
- The expected power curve, with rules for the power each Nexus Pulse is expected to bring, is the frame an army
  builds around with its own trade-offs.
- Commanders have whatever abilities suit them; what sets an army apart is what its build leans on (the Commander,
  the units, the economy, and so on). Asymmetric by design.
- An active skill is still automatic: the player gives no input during a Battle Round.

## The Commander on screen, round 2 (2026-10-14)

Mario's notes on pull request 70, the Commander milestone's last step. Built on the same pull request.

### F167 — A milestone for ASCII art

> Thing number one, I think we need a milestone specific to improve our ability to create ASCII art. Up to this
> point, we're relying on the LLM model capability to make some ASCII art, but consistently they come not very
> pretty. So I think we're going to need a better approach, and I'm pretty sure we can do some research online to
> find out what makes good ASCII art. Perhaps we install a tool that we can run to generate ASCII art. Perhaps we
> make a workflow collaboration between an image model that can probably generate the art with good sensitivity.
> And then the LLM can take that image and turn it into actual ASCII art uh, and try to take advantage of ANSI. So
> that's one. Uh, let's just prepare the milestone for later, because I think we are going to benefit from that to
> create art for basically all of the units. And having a good workflow here is going to be useful.

**Scheduled**: [Milestone 15 — ASCII Art](../../milestones/milestone-15-ascii-art.md), planned, not placed in the
order.

### F168 — Not a panel on the menu

> Second, I don't think having the commander on the menu at all times helps that much, basically because it uses a
> lot of important real estate. Later in the game, we're going to have more units, more options, more powers, more
> things to do on the left, and it's, it's better to keep that space for other things. I like the sentiment of
> giving it more visibility about how much life it has and when it's dying, but at the end of the day, the
> commander is just another unit. It's an important one because it's the main primary unit, but it is another
> unit.

**Built.** The Commander panel is gone from the side panel, in the Build Phase and the Battle Round; the raid's
words have their rows back.

### F169 — A dramatic appearance

> So I suggest highlighting the commander in different ways. One way would be to dramatize the appearance and the
> death animations. When a commander appears, it should basically say something. It has like a few lines, and
> commanders have their own lines, and there should be a more dramatic animation, uh, effect, highlight, something
> that kind of brings the, the user visual identity there. It may not appear right away, even if the user is on
> build phase. When the level begins, the commander should appear next to the Nexus. It could just wait half
> second or something and then do the commander apparition.

**Built.** As a level begins, and the round the Nexus Pulse restores her, she is not on the map for half a second;
then a ring of her side's colour closes on her tile, she flashes in, and she says a line of her own beside her
(new lines for the two moments, in her army's data). PERIMETER's first round already opens on her own words in the
dialog, so there she says nothing more. She already arrives beside the Nexus in PERIMETER.

### F170 — A vignette when she dies

> Um, when the commander dies, Something that would be really, really cool is to have an overlay next to where the
> commander died that basically has a death animation in ASCII art. So I don't know how possible it is to this,
> but imagine something like a comic that um, when it dies, it will kind of open a screen right there on top of
> the battle, and you'll see the commander changing the face to something like a... is dying, and then the whole
> thing will evaporate with some more dramatic animation. We don't need to make bigger explosion or anything, just
> kind of bring like a vignette on top of the, the commander. And that's something probably cool to do with other
> parts of the battle, because I like the commander text so much that I want to build on that a little more and
> see if we can bring some more visuals in there. That would probably be nice with other units as well, but we
> also don't want to overdo it. So the player can actually see what's going on in the battle. Let's just try those
> two.

**Built.** A window of 9 by 5 opens beside where she fell, where it covers least of the fight, her name in its
border: her portrait, then her face falling (`(>_<)`, `(x_x)`, frames in her army's data), then the window
evaporating glyph by glyph, about three seconds in all. Only for the Commander, as he asked.

### F171 — Her card and portrait when explored

> Then, three, the commander, the commander car and the commander art are good, but they should be reserved to when
> the exploring map selects the commander. When it's on top of the commander, it should have like a bigger
> highlight. Uh, that's basically it. I don't think we need to show the commander all the time.

**Built.** Explore Map on her shows her portrait as her card's icon, every number kept at 80 × 24, and lights a ring
of light round her, the dialog focus's own.

### F172 — Her symbol is her identity

> Four, specifically for base, the art, and don't worry about this too much because we're going to improve the way
> we do ASCII art, but the base commander should have ads, right? If his main icon is an ad, then the art should
> build on top of that kind of a spiral looking thing and be consistent. Maybe this could just be a rule on how to
> design commanders, uh, just maybe add something that the The symbology and the icon used to represent the
> commander is important in the identity, and it should be kind of related, not just arbitrary. Maybe even think
> about base may benefit from having a different, maybe a pound symbol, I think, is like more correct, or
> something that is like more strict will probably make more sense. Uh, lines or something like that. Uh, the at
> may work better for, I'm thinking, on the future, our elder, main elder commander may actually fit the ad a
> little better. It feels like something more like fluid than coming from the space.

"Base" is Vasse, "ad" is `@`, "elder" the Alder, as transcribed. **Built** as a rule for designing a Commander, and
her portrait built on her `@` (`_@_` over `(-_-)` over `/|@|\`); which symbol she keeps is a question with a
recommendation in the register: `#` is rock on every map, so a ruled glyph that is free (`&`) is the one to try,
with her art, in the ASCII art milestone.

### F173 — Fewer rounds, and Vasse back the next round

> Okay, and last, the rhythm probably doesn't need to emphasize so much about the commander dying and spending a
> whole round to come back or two rounds because we honestly want to make the game less rounds we want to make
> like six to nine 12 maybe for a long game where the players have an ability to defend and make the game longer
> leaning into their power curve later or they want to try to be aggro and finish it faster that's some different
> strategies we'll use that but we really want to keep the game between six and nine pulses and again we'll test
> this later and have more clarity on it but That means we don't really want to have the most commanders who die
> and come back in the very next round. Uh, now, when they come back, they could come back with some restoration
> effect. Uh, they could come back and have some bonus. Different commanders will take different advantages of
> that. Most commanders, though, especially Base, will probably not die often. They're designed to just stay
> alive, and that's it. If they die, kind of they lose a little bit of the... Of the battle, but staying alive
> forever is basically their advantage versus all other units. So yeah, no need to do that. Maybe some commander
> will have this disadvantage that they stay out for a full round or maybe two rounds, but no, not Base. Base will
> just come back immediately after. Having the dim down symbol next to the Nexus seems a good idea, but just keep
> the exactly same symbol. No need to no need to have the number one. and counting all of that. Good. Please go
> ahead and implement this.

"Don't really want to have most commanders who die and come back in the very next round" reads, with the rest, as
wanting most to come back the very next round. **Built.** How many rounds a Commander sits out after the Battle
Round she falls in is hers to have, as data; Vasse sits none, so the Nexus Pulse that opens the next round restores
her and the result says "Vasse fell: back next round." Sitting rounds out is kept, proven on a test-only Commander. Her
dim `@` beside the Nexus has no count now, and shows in the battle from the moment she falls. A restoration bonus is
designed, not built: *Restoration Order* replaces *Expedited Restoration* in her pool. The six to nine rounds go to the
register's question on how long a match is; mission 3, RESTORATION, planned around her round of absence, is a new
question.

## The next milestone (2026-10-15)

After pull request 70 merged. Built on the pull request that opens Commander Armies.

### F174 — The next milestone

> let's move to next milestone. What should we so next?

**Built.** The Commander milestone is complete and in the history; Commander Armies is current, at its first step:
what a Commander Army is, the expected power curve, and the guidelines for catch-up.

### F175 — Her symbol, RESTORATION, and go

> ok vase keeps @, and the mission delays her return once. Go ahead please

"vase" is Vasse. **Built**, all three: Vasse keeps `@` (the register's question on her symbol is answered; her
portrait already wears it); RESTORATION keeps its round without her, the mission delaying her return that once as
its own data (the question on what the mission plays is answered, and the campaign says so); and the first step of
Commander Armies is written, in [`commander-armies.md`](../../game-design/commander-armies.md), with what the army
loader can check of it.

## The curve on the Grid (2026-10-15)

After pull request 72 merged, with the plan for the next step in front of him (credits every round, carried over;
locked buildings shown in the build menu with what they need).

### F176 — A tech tree for every mode

> ok thanks. Let's pick and plan the next milestone

> go ahead, yes to both. Let's define a tech tree and keep working to simplify and streamline thinking this will
> work for both the campaign, runs and pvp

**Built** (see the step). Unspent credits carry over and each round adds the curve's; a building the tree has not
reached yet shows in the build menu, dim, with what it needs. The tech tree is the army's, one rule in every mode:
a mode decides only which cards are offered, never how they unlock.

## Supply and building actions (2026-10-16)

On pull request 73, the curve on the Grid, asked what keeps an early lead from compounding. Built on the same pull
request.

### F177 — A supply cap, given by a building

> go with your recommendation, supply cap.

> Supply should be controlled by another building

**Built** (see the step): an army fields so many units at once; a building that would go past it keeps its wave owed
and waits for room. The supply is what the side's buildings give: the Grid Nexus some, a Supply Depot more.

### F178 — Actions on a building

> Additionally, buildings should have actions on them. Maybe this is the time to implement that, because it affects
> the power curve. When a building is selected during build-phase mal exploration, it should show the available
> actions, with hotkeys as usual. One of those actions for the barraks is "Pause production", that stops producing
> units for the next round. Another option would be to Upgrade to level 2, which produces stronger units. Another
> option would be to enable turrets, where the next produced unit will stay inside the barraks to defend with a
> turret. Another option would be to add a worker slot, that brings a nearby worker inside rhe barraks to boost
> production. Etc. This creates Many gameplay possibilities. We don't have to imement them now, perhaps just the
> stopping production option, but this will allow to unlock many upgrades that manifest through the same unified UI
> of selecting a building and activating something.

"mal exploration" is Explore Map. **Built**: Explore Map on a building of yours shows its actions, each under its own
key, and a Barracks, Hatchery or Garrison can pause production for the next round. The others he named (upgrade to
level 2, a defender inside, a worker slot) are designed as actions of the same kind, not built.

## Marshal Averno (2026-10-16)

After pull request 73 merged, given the choice between a harder curve level and the second Commander.

### F179 — Averno

> go for Averno! :)

**Built** (see the step): Marshal Averno, the second Commander, on Vasse's buildings, played on the curve level beside
her. He is `&` on the Grid, lighter than her and hand to hand. He charges from twice the reach other units wait for,
and his aura, Forward Order, makes his units near him hit a quarter harder. His powers act on the enemy or come from
it: Unfiled Ordnance makes troopers burst when they die, and Ravel raiders and runners fight for him. In rounds 2 and
4 one card of his hand comes from the Ravel Nexus, tagged `Ravel`. When he falls he is out for a round, a round
later than Vasse. His level is her first five rounds with him in her place. With the same build, his side clears
round 1 sooner and loses less, he falls in round 2 where she stands, and his side loses more while he is out: they
read apart within two rounds.

## The army structure, a third Commander, and duels (2026-10-17)

After Averno was built, asked what designing a second Commander taught and what the structure could do better, and
told the four improvements proposed (each Commander's army in one file with its campaign apart, abilities as data
the kernel calls, effects as one table, and a way to fight armies against each other).

### F180 — Solidify the army structure, a third Commander on it, and duels to test them

> i agree. Yes, make a refactor/cleanup branch to solidify the commander army files, separate mals from commander
> armies, solidify Vasse's values and prepare the code to allow making more commanders easier and with less
> branching logic / switch. We will tune armies later, for now we are worried about structure. Eventually we want to
> allow a modder to define new files on a different repo that would still affect the events in battle, for that we
> need a structure that allows adding new elements and code throughout hooks and event handlers to customize
> behavior. We only have 2 examples with Vasse and Averno. I recommend you do the logical changes in structure, check
> for improved modularity, then define a new Commander Army on the new structure, take notes of what could be
> improved, then make more changes, try to implement some cool ideas on the new commander, then make more code
> changes to allow defining special behaviors throughout configuration or hooks, finally review the 3 commanders, use
> a coding adversarial subagent to check for code intuitiveness (validate is if the code structure is self
> explanatory, this will be very useful for future coding sessions), then try to test a pvp fight between
> commanders. We don't have a good way to bench-mark them against each other and the campaign is not a great way to
> do it. Having a run as benchmark will be useful too, but for now we can simply put each commander nexus on one side
> of the map and play a pvp (or to be more precise, script vs script). Having a ai-friendly scriptable api to plan a
> build phase for each side with a model call (yourself or using a subagent) then run a battle round, and use the
> relevant logs plus current map state, plus game instructions for llms, as the context to plan the next build phase,
> with that we can build a ai to play against, and we can use that both as a quick match and as llm-vs-llm mode, then
> run some games to see how different commanders approach their power curve. Use cheap model on the ai subagents for
> tests. And note that a scripted llm play is not the same as a good player, so don't be too clinched to the match
> conclusions, but it is still an awesome way to test armies against each other.
>
> This is actually a long iteration that will create the ground for us to start making and polishing armies. When
> you make the PR, explain the army file structure and code conventions, this also needs to be on a specific document
> that will be the guide for future sessions where we make new armies, and later the llace for modders to have a
> reference. Add some screenshots, don't worry about playable build yet, just give me some numbers after the pvp mod
> tests. Make sure to document how to play llm-vs-llm for testing (as part of project files, for development, which
> is for our own coding and less for extrrnal documentation).

"mals" is read as campaigns and their levels. **Built** (see the step): armies stack (`all`, a faction, a
Commander) with every unit and structure written as data in its army, and campaigns in their own folder; Vasse's
tuned values are her army's data and their Experiments are gone; a Nexus power's effect and a unit's ability are each
one entry of a table, so no reader branches on a kind and a new kind is one file; Dob Hunter, the third Commander,
on the Ravel Nexus with a bounty and loaded dice; an adversarial review of the code's readability, its findings
applied; and duels, two armies on one map, script or model a side, with a bench and model games run. The guide is
`docs/system-design/army-authoring.md`; duels and model against model are `docs/system-design/duels.md`.

## Mirror fairness, and the pathfinding coming (2026-10-19)

After the army structure and duels merged, on the duels' finding that the east side won most mirror duels.

### F181 — No side wins by where it stands

> In mirror duels the east side wins about nine in ten. The cause is tie-breaks that read the Grid west to east;
> This should be fixed, when two troops equally strong attack each other at the same time, the solution should be
> deterministic independently of the side or top vs down or diagonal. They should either kill each other at the same
> time, or decide randomly (leaving the weak unit alive but with only one last hit point). There may be other effects
> that need to be resolved simultaneously instead of from left to right. This may result on a significant refactor for
> the grid code that handles attacks.

**Built** (see the step). The attacks were already simultaneous: two equal units that strike each other in the same
tick both fall. What favoured a side was everything round them, each tie settled by reading the Grid west to east or
by the ordinal the opening hands out in that order: where a building sets its new units down, which of two equally
near enemies a unit picks, where a group is mustered, which home a survivor goes back to and which tile it takes, the
order two neighbouring buildings claim free ground in, where a duel puts a building, and the tile a unit three tiles
wide measured its walk from. Each now goes by what the deciding unit faces — the enemy, or where it is headed — and
what is still tied after that is a draw from the battle's seeded stream. A mirror battle now stays a mirror tick for
tick, and mirror duels split about evenly.

### F182 — Pathfinding and banners, next

> Please take into account that pathfinding code will also need improvements soon, because in some playable demos on
> the PERIMETER Vasse campaign, I've seen enemy troops get stuck behind rocks. The general game will point troop
> lovements towards enemy nexus, but we will likely implement banners to point at priority rally points during a
> battle round.

**Scheduled**: registered beside the routing question and in the backlog, with what this round leaves ready for it
(movement measured from a unit's footprint, a step that must gain ground, and side-fair ties). Since 2026-10-19 it is a
milestone of its own (F183).

### F183 — A milestone for pathfinding

> Well okay, not sure how we forgot, but we need to write a milestone dedicated to pathfinding. Please write the
> milestone so we can move on with other issues. Some notes to take into account:
>
> Pathfinding Milestone:
>
> * This is a solved problem in many videogames, please do some initial research to identify the typical situations
> and algorithms. Then contrast with our specific situation, our units move like in a RST or tactical auto-battler,
> using ticks, but all units are automated.Units need to move towards a target, dodge obstacles, identify enemies on
> their vision radius, crowd control (e.g. walking through a small passage), react to dynamic obstacles during the
> battle (e.g. units pushed after an explosion, a magnet ability or new units spawned), different terrains, and worker
> units being able to walk over other friendly units.

**Scheduled.** Before it, the cause of the stuck raiders was found by playing PERIMETER headless: there is no
pathfinding, a unit only takes a step that brings it strictly closer, so a slinger directly above the Grid Nexus with
the north-west wall between them stands there for good and the raiders behind it queue. The milestone
([`milestone-16-pathfinding.md`](../../milestones/milestone-16-pathfinding.md)) has that, the research (A\*, distance
fields and flow fields, hierarchy, clearance for unit sizes, local avoidance, cooperative pathfinding, weighted
terrain, what auto-battlers do), each of his needs set against it, and six steps: a bench and a measure, routes round
the map, crowds, a Grid that changes mid-round, terrain and who passes whom, and goals with banners. When a banner is set,
in the plan or live during the round, is a question for him. Its place in the build order is his call.

### F184 — Banners in the Build Phase, later; pathfinding as soon as it can be; start the measurements over

> Oh, yes, placing the banner is during the build phase, of course. We don't know how to deal with that in the UI yet,
> but the idea will be to do that when we can prove there is a good plan for it. So for now, there is no banner. It's
> just going to be going to the enemy nexus. Or maybe we have to define the target position for campaign as well.
> Second thing, where does the milestone go? We can work on that anytime. It's kind of independent, but the sooner the
> better, because that will make the other tests better. We should also invalidate the older maps and the data we have
> on them that decide what something is better than another thing. Maybe this is time to write a summary in some
> design file, a spec, and just forget about that old data, and we're gonna have to start a new one. Maybe that can be
> part of the milestone as well.

**Scheduled.** The banner question is answered (a banner belongs to the Build Phase's plan, and waits for a plan for it
on screen; it is in the backlog). The pathfinding milestone builds no banner: a unit heads for the enemy's Grid Nexus,
or a campaign level's target where the level names one. It is placed next in the build order, after Commander
Armies. And it now opens with a clean slate: a spec of how a battle is measured, every measured result from before
it marked as old and set aside, the old route maps retired, and the measurements made again on the new routes as its
last step.

### F185 — Units come out on top of their building and walk out

> And something else that we can put together along with the pathfinding, because it is kind of related, but this is
> something I was thinking more generally for gameplay, is that since army position and formation is so important to
> win or lose a battle, the users will have a lot of control over where their units are positioned, and that is
> decided indirectly by placing the buildings right now. So if units spawn around the building, there is a lot of
> space that is being taken in between units, so they naturally not be able to cluster before attacking the enemy, and
> being able to cluster or disperse the units seems like a great way to add a strategy for area of damage or not. So I
> was thinking, what if units spawn on top of the building and they find a way out to the closest area where they can
> walk? So that will, for example, let people place a lot of the same buildings together next to each other without
> having to have a space in the middle, and the units will pop out and walk all the way until they can actually be
> outside. There is a bunch of questions in here, especially for pathfinding, and that is why I think we can put it
> together on the pathfinding milestone. Is when they pop, they will be out on their own layer, I think, where the
> multiple units are also spawning at the same time out of the building. They need to not collide with each other and
> slowly walk outside of the building area. If there is multiple buildings on top of each other, they should walk out
> of them. And this will work equally for bigger units or smaller units. So what happens if there is an enemy in
> range? Should they start shooting each other? And I think, yes, they should be able to start shooting right away
> from on top of the building. When the enemy destroys the unit,

**Scheduled**, as a step of the pathfinding milestone (units come out of their building): units appear on top of the
building that made them, cross their own side's buildings to open ground without sharing a tile (toward their goal, since his next note), fight
from the roof, and buildings that make units no longer need room round them, so the Spawn space Experiment goes.
His note stopped mid-sentence ("When the enemy destroys the unit,"); he finished it on 2026-10-20 (below).

### F186 — A unit on a roof is hit as usual; units walk the roofs toward their goal

> let's do an extra iteration on the Pathfindinf milestone. When a unit is hit on the roof of a building, it should be
> like a normal hit, the unit dies and then the attacket picks a new target, that maybe is the building. If the
> attacker can't reach the unit then it would attack the building or whatever can reach, so same as usual.
> Another thing is when units spawn, they should start moving towards their target path, instead of going to the
> closest free tile, they will just keep walking on the rooftops on the natural direction wjere their destination,
> this will help keep the troop waves together when they spawn. Units that spawn over multiple tiles will continue
> through the roofs even if there's an empty tile in the middle, so basically they "walk in the roofs" until they are
> fully in regular terrain.
>
> But you don't have to do it exactly like I describe, this is just what I think it would work, bit the real test is
> playing a simulated game an checking if it is possible to make good unit formations that can foster interesting
> strategies.
>
> Take the chance to make a quality pass on design writing

**Scheduled**, in the pathfinding milestone's step on units walking out over the roofs. A unit on a roof is hit,
dies and is replaced as a target as on the ground; an enemy that cannot reach it attacks what it can. A wave's way
out is its ordinary route to its goal with its own side's buildings counted as open ground, so it leaves by the side
facing the enemy and stays together; a unit is on the roofs until all of it stands on ground, then buildings are walls
to it again. Units on a building that falls stay where they stand (the step's reading of "same as usual", not his
word). The step is done when a simulated game shows that a block of buildings, buildings set apart and a long line of
them send out armies of different shapes, each beating something and losing to something, with an Experiment for the
way out if that leaves it open. The milestone's writing was tightened in the same change.

### F187 — Close Commander Armies; build pathfinding from primitives up, and end on full duels

> Yes! Let's close the commander milestone, the new commander army design is excellent, we will iterate on the armies
> later.
>
> Next for us is: Patfinding improvements! Use the pending commander checks as part of pathfinding validation at the
> end.
>
> Make sure to split the parhfinding architecture in smaller compartments that are eaxh testable, then build up from
> the primitives into more compmex behaviors, and close up with full commander deck duels. This will be a key
> component of the grid architecture and very relevant to gameplay. Pathfinding also has to work well with targeting,
> atracking, adding new units, etc.
>
> Go ahead, take your time, implement slow

**Built** in part, **Scheduled** for the rest. Commander Armies is closed and in history; its last step, the catch-up
measure, moved into the pathfinding milestone's last step with the other Commander checks (the curve level, Averno
beside Vasse, the duel findings), measured on the new routes. Pathfinding is current. Its plan was rewritten as
compartments that are each tested on their own (what a body can stand on, a goal, a distance field, the choice of a
step), then the kernel built on them in order (routes, crowds, targeting and attacks that know what can be reached,
units that appear mid-round, a Grid that changes), and it closes on full Commander duels.
