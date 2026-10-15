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
([`milestone-14-commander-armies.md`](../../milestones/milestone-14-commander-armies.md)): what a Commander Army is,
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
