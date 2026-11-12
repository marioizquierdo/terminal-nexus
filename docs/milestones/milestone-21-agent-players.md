# Milestone 21 — Agent players

**Status:** PLANNED
**Depends on:** Milestone 17 (the save file, `skirmish round` and the reserved `agent:<profile>` controller), Milestone 20
(a Skirmish worth playing against); after friends have played, while their notes come in

The owner, 2026-11-11 ([his words](../history/feedback/2026-11-11-game-modes.md)): "keep improving the scripted UI AI at
a mode where we can play against Claude. So the LLM itself can be playing simultaneously against the player." And
2026-11-12 ([his words](../history/feedback/2026-11-12-skirmish-saves.md)): "Working on the Agent/LLM player should
probably be it's own milestone, that defines how exactly the model is selected, how to build the context that explains
how to play the game, what interface and tools are available to the model to play, and how to define different
profiles." The duel already lets a model play a side through files or a command ([`duels.md`](../system-design/duels.md),
model against model); this milestone makes it a controller a player chooses on the setup screen.

## Question

Can a player choose `Agent: <profile>` for a slot and play a Skirmish against a language model that plans the other side
each round while they plan theirs, blind, under the same rules, in a style its profile describes, without the game ever
needing a model to be played?

## Steps

Not started; each waits for Mario's word, and the order is a first guess.

### Step 21A — What the model reads and how it answers

- [ ] The context that teaches the game: the rules a player needs, written once for a model and kept beside the
      brief a duel already writes, small enough to send every round.
- [ ] The interface it plays through: the plan as JSON with a schema, or a few tools (look at the Grid, read a
      building's card, submit the plan), whichever measures better; a plan refused is refused by name and the model
      may try once more.

### Step 21B — Profiles and models

- [ ] An agent profile (`players/agents/<name>.md`): a style in plain words (cautious, curious, greedy), and which model
      plays it. How a model is chosen and paid for: the player's own key, never one in the repository; a profile names a
      model, and a setting may override it.
- [ ] Two or three profiles, each measured against the scripts over seeds so they differ by more than their words.

### Step 21C — On the screen

- [ ] `Agent: <profile>` on the setup screen. While the model thinks, the player is never blocked: the Build Phase stays
      playable, and the round starts when both plans are in. If the model fails or times out, a script plays its round,
      and the player is told.
- [ ] What it planned is kept in the save, so a battle against an agent replays exactly, model or not.

### Step 21D — Playing it

- [ ] Mario plays against each profile and says which he would show a friend.

## Out of scope

- A model that writes dialogue or changes a rule: it only plans, like any player.
- Versus between two people, and anything over a network beyond the model's own call.

## Done when

- [ ] Steps 21A to 21D are built and tested; the game plays with no key and no network exactly as before.
- [ ] `./scripts/check-repository.sh` passes.
