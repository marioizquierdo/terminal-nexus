# 2026-11-12 — The milestones reviewed, and Skirmish set up by slots and save files

After the new focus merged, the owner asked for the milestones to be reviewed for focus (he doubted the Nexus Pulse
needed a milestone of its own), suggested a review by a stronger model, and set out how a Skirmish should be set up,
saved and played by agents. The review ran as one read-only sub-agent on the owner's suggestion; its recommendations
were applied with this note: Skirmish split into "setup and save files" and "a Skirmish worth showing", the Nexus Pulse
milestone retired into content and the backlog, a first content pass of units that counter each other before friends,
the worker economy narrowed, and agent players a milestone of their own.

### F253

> Merged! Thank you. Now, I want you to review the milestones and see if they are focusing on the right things. For example, the milestone about Nexus Pulse, I'm not sure we need that as a separate milestone, since that was menat to polish the Build+Battle phases, but we are already doing that on the Skirmish mode.
>
> Reviewing our focus and planning for next steps may be a job for a dedicated sub-agent running with the new Fable 5.2, let me know if you can automate that, or otherwise give me an elaborate prompt that I can use to start a new session with Fable. Fable is expensive so we have to be mindful about what we use those limited credits for.
>
> After that, put out another PR with changes on the milestones or project/spec files to align the upcoming efforts.
>
> Then, let's start focusing on the Skirmish milestone. I am managing the banner design explicitly through a parallel session, please give me a prompt on a code-block to copy-paste into that session so it re-reads the milestone and design after the last changes (e.g. test using the new skirmish mode for testing). I want to be mindful about the actual Skirmish launch settings, and how they map to our current concept of scenarios, because they are very similar. I imagine a new skirmish starts with selecting the map (which dictates where are the nexus bases), then for each nexus slot, choose a commander as "Player1: marioiz" or "Scripted: agro" (etc), or "Agent: curious" (etc). This will be the same UI later if we build 2-player mode. There should be a folder for player-script-profiles with the different script algorithms (the same ones we use for testing), and another folder for player-agent-profiles with markdown files that are used to define each llm-player style. Working on the Agent/LLM player should probably be it's own milestone, that defines how exactly the model is selected, how to build the context that explains how to play the game, what interface and tools are available to the model to play, and how to define different profiles. But it is good to have the idea already setup for the skirmish design. The Script may expose settings that can be adjusted on the skirmish UI (or cli flags). Then the game goal ("Elimination" as default mode to destroy enemy nexus, but we can have others like "Economy" or "Creative" with different winning conditions), and then any game modifiers like "double income" or "fast rounds", etc, that are gameplay settings that we show on this screen, that is a great ground for experimentation, and later we can polish down and keep only the ones that are really good.
>
> Scenarios basically become saved skirmish saves. We should rename them to skirmish-save-files and formalize the concept that works both from the UI and from the CLI. The scenario format should change to match the skirmish settings exactly, and then add extra state for all the other parameters that represent a game in the middle, for example adding units, bases, and allow to jump straight into later rounds with powers unlocked, etc. Starting a skirmish on the UI should also allow to "load game" from a save file. And at anytime, allow to save game; saving and loading game is always for the build phase. Then any tester agent could launch a game in headless mode directly from a save file. The game log should stay as a separate file, I think. Logging is a separate concern to analyze games and it could get pretty verbose.
>
> Make sure that the testing docs point at using skirmish mode as a way to test, and align CLI testing flags that allow to load a specific map or scenario at a specific phase to use the same terminology that we use to define skirmish settings. We are basically allowing to run a skirmish in headless mode, so the options to run it should be intuitive and well aligned.
>
> At the end of this, I (the player tester) should be able to start the game, see the main menu, choose skirmish => pick map, pick commander, pick enemy script and commander, start new game => play a few rounds, save on a new file, and then come back later, skirmish => load game, and start right where I left it. But also, be able to tell you (claude) to check the saved file, and run it to see the battle results. Since the saved game format and schema are well defined, you should also be able to make a copy, modify at will, and run it with variations to test other things. Loading a skirmish save file should allow to modify a few key parameters before launching the game: so you could for example take my saved file, but launch it with a different script playing on my side, and a different script playing on the other side, so it plays automatically. On the game UI, choosing both sides computer scripts or AIs should have a special UI, where there's nothing to do on build mode, only explore the map, and start next round in expectator mode.
>
> And last but not least, how can you play skirmish for testing? there should be enough controls for you to run a build phase, against any script, and see how it turns into a new saved file after the battle ends. So you can play multiple rounds like that

**Built** as the plan and the design. The setup, save files, the command line and how an agent plays are
[`skirmish-saves.md`](../../system-design/skirmish-saves.md). The Skirmish milestone is now "setup and save files", whose
end is exactly the session he describes; "A Skirmish worth showing" (milestone 20) follows, and ends with friends
playing. The Nexus Pulse milestone is retired: its powers go to the content passes, its own moment on screen to the
backlog. Agent players are milestone 21, after friends; the save format reserves `agent:` now. The testing pages point
at Skirmish and the planned `skirmish` command.
