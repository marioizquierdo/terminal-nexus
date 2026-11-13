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

**Built.** `src/duel/reading.ts` reads what a battle says: the score (who leads, on Nexus health or on damage), and
for each Battle Round the front (where the fighting was between the Nexuses: the map's tempo), first contact, the
nearest the enemy came to each Nexus, what hit each Nexus by source, each building lost and by what, and what a side's
own blasts cost it. Every round's report keeps it; every brief prints the score and the side's own reading, as words
and as data, so a script, a model and a person read the same.

### F285 — exposed to the testing agent, with a picture of the battle

> So also please check if once you define a few more advanced ways to check the status of the game, if that could be exposed properly to the testing agent, which will be a cloud session, of course, through the skirmish tool. Maybe different ways to show the brief or just be more verbose, which is probably fine. … Perhaps it's also interesting to print the state of the battle or be able to request printed renders … more like actual ASCII snapshot of the battle at that moment. … Whatever is not returned automatically, if requesting information from the battle is complex, perhaps it will make sense to make a second tool that basically wraps around the interface in code that runs those checks at a specific time. So that will kind of take the state of the battle from the save file, advance the battle to that point that is being requested, and then do whatever is needed. Return the ASCII screenshot …

**Built, in the `skirmish` command rather than a second tool.** The reading comes back automatically: in each brief,
and in each round's report a line a side. `--show 0,120,end` draws each Battle Round played as text at those ticks and
as it ends (`src/duel/picture.ts`, the brief's own map, a unit on a roof counted rather than drawn over its building).
Taking a battle from a save to a moment is what the command already does: `--load` any kept round (`--out` keeps each),
give its build actions, `--play-to next --show <ticks>`, and nothing is saved over. A second tool would repeat it; one
would earn its place when an inspection needs more than a round replayed (a unit followed tick by tick, a region
watched), and it would wrap the same reader.

### F286 — a script that reads

> And then again, try to expose that to see if we can define a more intelligent script that is not just all aggro or not. Having the simple script is great, it's just a quick way to go. But I think once we define better readers of checking the map state, we can start exposing that to our script. So yes, a third task will be to try to create and improve the script for that you can play against during testing.

**Built: `script:reader`.** It builds as `balanced`, then reads the last round: it presses an attack that won the trade
and holds after one that lost it, pushes out when a hold won by a third, attacks a Nexus under half, holds a lead on
Nexus health in the last round and attacks when behind; it puts a Turret by its Nexus when the enemy reached it, and
sets its producers apart once the enemy has area damage standing. Its note says why each round. RESULTS

### F287 — later, models injected with the same information

> The idea for the future is, since I'm also planning on allowing to play versus LLM models, that information will also be exposed to the models to a way to inject that into the session automatically. But for now, LLM models are harness agents, cloud sessions like yourself that will be using the skirmish tool to request that information.

**Ready for it.** The reading is in the brief a model reads, as words and as data (`--json`), so the agent players'
milestone injects the brief as it stands.
