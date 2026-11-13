# Reading the battle, 2026-11-13

_After pull request 98 merged (one name for each thing, the Skirmish milestone closed). Logged before building; each
point's status says what was done._

The owner agreed with the player's-eye notes ("that is exactly the reason why we made a playtesting session") and asked
for three things at once: the glossary reviewed by a sub-agent, one place in code that reads the battle's state,
exposed to testing, and a script that plays from it.

### F283 — the glossary, reviewed for all of Terminal Nexus

> The next thing you should do is review the glossary and make sure that the terminology is working for all of terminal nexus. The glossary should be a quick place to check for naming and consistency, which should also be referenced from Agents MD or Cloud MD, of course. Please spin a sub-agent to make sure it's doing this work.

**Built** (by a sub-agent). The glossary says at its top how to use it (look before naming; add a missing word in the
same pull request), covers the movement, ground, lore, armies, Story, testing, settings, screen, effects, planning and
engine words, names the code's older word beside the player's, and gained two tables: words that do two jobs, and the
words we stopped using. `AGENTS.md` sends every session there before naming anything and checks it when finishing;
`DEVELOPMENT.md`'s writing guidance points there.

### F284 — one place that reads the battle

> All of this information that comes from the map, for example, the map's tempo, should be in a centralized library. We talked about this before, and I think now it's time to make it a little more formal. If there is a single place in code that can check for map status, then we can expose that to the testing. Particularly, we can request it on the output. Some of that can be automatically returned because it's very useful for any type of testing running the skirmish and checking the brief. But also can be exposed to the scripting to define new scripted AIs.

**Built.** `src/battle/reading.ts` reads what a battle says: the score (who leads, on Nexus health or on damage), and
for each Battle Round the front (where the fighting was between the Nexuses: the map's tempo), first contact, the
nearest the enemy came to each Nexus, what hit each Nexus by source, each building lost and by what, and what a side's
own blasts cost it. Every round's report keeps it; every brief prints the score and the side's own reading, as words
and as data, so a script, a model and a person read the same.

### F285 — exposed to the testing agent, with a picture of the battle

> So also please check if once you define a few more advanced ways to check the status of the game, if that could be exposed properly to the testing agent, which will be a cloud session, of course, through the skirmish tool. Maybe different ways to show the brief or just be more verbose, which is probably fine. … Perhaps it's also interesting to print the state of the battle or be able to request printed renders … more like actual ASCII snapshot of the battle at that moment. … Whatever is not returned automatically, if requesting information from the battle is complex, perhaps it will make sense to make a second tool that basically wraps around the interface in code that runs those checks at a specific time. So that will kind of take the state of the battle from the save file, advance the battle to that point that is being requested, and then do whatever is needed. Return the ASCII screenshot …

**Built, in the `skirmish` command rather than a second tool.** The reading comes back automatically: in each brief,
and in each round's report a line a side. `--show 0,120,end` draws each Battle Round played as text at those ticks and
as it ends (`src/battle/picture.ts`, the brief's own map, a unit on a roof counted rather than drawn over its building).
Taking a battle from a save to a moment is what the command already does: `--load` any kept round (`--out` keeps each),
give its build actions, `--play-to next --show <ticks>`, and nothing is saved over. A second tool would repeat it; one
would earn its place when an inspection needs more than a round replayed (a unit followed tick by tick, a region
watched), and it would wrap the same reader.

### F286 — a script that reads

> And then again, try to expose that to see if we can define a more intelligent script that is not just all aggro or not. Having the simple script is great, it's just a quick way to go. But I think once we define better readers of checking the map state, we can start exposing that to our script. So yes, a third task will be to try to create and improve the script for that you can play against during testing.

**Built: `script:reader`.** It builds as `balanced`, then reads the battle: it plays the stance that has traded better
over the battle (trying each once), attacks when both sides held, attacks a Nexus under half, holds a lead on Nexus
health in the last round and attacks when behind; it puts a Turret by its Nexus when the enemy reached it, and sets its
producers apart once the enemy has area damage standing. Its note says why each round.

Measured as p1 against each script profile, every pairing of Commanders, seeds 1 to 3, 8 rounds (18 battles a row),
beside `steady` (the balanced script) in its place:

| p2 | the Pocket: reader | the Pocket: steady | the Crossing: reader | the Crossing: steady |
| --- | --- | --- | --- | --- |
| `agro` | 18–0 | 18–0 | 18–0, in 3.0 rounds | 18–0, in 4.1 |
| `defensive` | 15–3 | 12–6 | 14–4 | 18–0 |
| `steady` | 10–8 | 8–10 | 6–12 | 8–10 |

Better on the Pocket, and faster against a rush; worse than a plain attack from round 3 on the Crossing. Two
versions before it taught what to keep: a block for every build left credits unspent on the Pocket's small build range
(2–16 against `steady`), and reading only the last round made it flip between attack and hold on the Crossing, giving
back each round the ground the last one took. On the Crossing pressure that never lets up still wins more than reading
does: the kept front makes a hold cost ground, which no reading of one trade sees. A direction, not a verdict: a script
is no good player.

### F287 — later, models injected with the same information

> The idea for the future is, since I'm also planning on allowing to play versus LLM models, that information will also be exposed to the models to a way to inject that into the session automatically. But for now, LLM models are harness agents, cloud sessions like yourself that will be using the skirmish tool to request that information.

**Ready for it.** The reading is in the brief a model reads, as words and as data (`--json`), so the agent players'
milestone injects the brief as it stands.

## The second round, the same day: notes on pull request 99

### F288 — "resources" was never his, and which decisions bind

> The footer barracks place resources 60 is wording, I did not choose myself in an earlier playtest. That might have been a note from the agent. I would like you to also review how are we tracking those decisions, because remember, we still don't have a playable game … On this milestone right now for the skirmish, we are focusing a lot on the skirmish command, which allows for automated testing, which is very, very important. And that should be the priority right now, on top of any past decisions that we made. Decisions are important for general design, architecture, but no small details like what we use resources. … So just credits.

**Built.** The placement line says credits, as the glossary does; the test that called "resources" his words no longer
does. `DEVELOPMENT.md` now says which past decisions bind (the rules, the architecture, the modes, every RULE) and which
do not (a line's wording, a number, a label: made to agree with the glossary, and changed together when a later
milestone settles them), that the priority now is the `skirmish` command and automated testing, and that he is quoted
only with a link to his words. `AGENTS.md` says it in a line.

### F289 — what earns a glossary entry, and how it is organised

> Let's simply add one note on top that have some basic rules about what makes a new glossary term … a general abstraction that makes sense across the game, not a small focus detail under a specific module. … Perhaps we can also create some 3 or 4 subcategories if it makes sense to point at different layers of abstraction.

**Built** (by a sub-agent). "What belongs here" opens the glossary: a general abstraction met in more than one place,
never one module's detail, checked against the words already there and the retired ones. Four layers, alphabetical
within each: the game, the world, making and testing, the engine and the code; 191 entries pruned to 138.

### F290 — duel is the battle

> I see that the general folder is called duel, and now I'm not so sure the term duel makes sense. … Perhaps there is no need to have a dual folder. … The file itself could be called bottle reading.

**Built.** `src/duel/` is `src/battle/` (`BattleState`, `BattleSetup`, `BattleResult`, `BattleMap`, `beginBattle`,
`playToEnd`), `duels.md` is `battles.md`, and the word is retired. The measurement keeps "duels" as the name of its part
that plays scripted battles over seeds (`measure run --parts duels`), because its stored records use it. The battle
reading is a folder, `src/battle/reading/`.

### F291 — simpler readings, public and private, a place to add more

> Make sure that the different readings we're making are not too elaborate … I know very well from watching StarCraft replays that they usually track the resources, the army value … the supply … So just make sure that the readings are properly labeled as public information … Perhaps losses on each round. … both the total value for both value of army and a list of the units … Buildings seems very useful as well … a list of the damaged buildings … with a special mention to the nexus, but the nexus could just be part of this list … What really matters here is to have a place where we can keep adding more metrics.

**Built.** One small file a reading, each a tracker shown every tick: the score; each army as the round opened and
ended and what it lost, each with its value in credits (a unit at what its building pays for one); the buildings
standing, damaged (the Nexus among them, nothing special) and destroyed, with what destroyed each; the advance; the
damage taken by source; the engagements. The "front" (an average of where hits landed) is gone: the advance and the
engagements say it plainer. Every reading is public, and the brief says the Build Phase's credits, hand and build
actions are private. A new reading is a new file and one line.

### F292 — the ASCII screenshot is the screen's render, with the overlaps beside it

> I will encourage to show exactly the same as the final render, so there is no ambiguity, but have an additional property that will list overlaps. … the screenshot stays as close as possible to the actual view … clearly differentiated through the documentation … We should probably keep the particles out, but maybe there should be an option to include particles if they want to see them … only if it's simple.

**Built.** The Grid's layers are drawn by one function the screen's frame and the ASCII screenshot share
(`drawGridLayers`), from the same view the screen plays, so a screenshot at a tick is what the screen draws there,
lattice ground and a unit on a roof included. Beside it, never in it: a ruler, a legend (each building with its art and
where it stands, since two sides' buildings can look alike in text), and the overlaps (each cell where one thing
stands over another). `--show-effects` adds the effects, a flag, since the view already has them. The documents call
it an ASCII screenshot, never a screenshot (an image).

Read back as a model reads it, a screenshot of the Pocket at tick 120 was enough to say where each army stood, which
buildings were whose and that a trooper stood on the Citizen Nexus's roof; the sparse ground lattice makes empty
ground harder to count than a dot a tile would, which is the price of matching the screen.

### F293 — reactive, and maps classified for testing

> The script that reads should be renamed, because reader sounds like a functionality, not like a script. I will probably call it reactive … perhaps the script's documentation can include some of the stats that were measured … I like this idea of trying different scripts in different key maps … classify these maps with a specific documentation that explains what they're good at for testing and what they're bad at for testing.

**Built.** `script:reactive`; its measurement against the other scripts is in `battles.md`, dated, as a record to
measure again. Each map has a line on what it is good and bad for testing (the Pocket: round 1 and 2, a rush, a Nexus
under fire; not formations or the long game. The Crossing: the long game and the kept front; not a quick answer or a
Nexus falling).

### F294 — what to read next: the front's movement and engagements

> How far the front moved it around. Yes, that sounds really good. And perhaps I would love to identify places of first conflict … maybe 5 seconds difference until of no fire … perhaps 5 tiles, a radius … formation engagement … That way we can probably track conflicts in a much more precise way.

**Built.** The advance (each army's place between the Nexuses as the round opened and ended) and the engagements: an
engagement starts at a hit, takes in every hit within 5 tiles of one in it, and ends after 5 seconds with none; each
says when, where and how wide, and per side the damage dealt, the units engaged and what was lost, with their values.
Both numbers are named constants to tune (`ENGAGEMENT_REACH`, `ENGAGEMENT_QUIET`).
