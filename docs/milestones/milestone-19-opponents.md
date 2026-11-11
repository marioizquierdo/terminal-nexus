# Milestone 19 — Opponents

**Status:** PLANNED
**Depends on:** Milestone 17 (Skirmish, the battle the opponent plays), the duel's model player
([`duels.md`](../system-design/duels.md), model against model)

The owner, 2026-11-11 ([his words](../history/feedback/2026-11-11-game-modes.md)): "keep improving the scripted UI AI at
a mode where we can play against Claude. So the LLM itself can be playing simultaneously against the player. That will
be an interesting mode to play against AI." The design is [`scripted-opponent.md`](../game-design/scripted-opponent.md),
where an opponent planner comes from.

## Question

Is there an opponent worth playing a Skirmish against again and again: a scripted planner that answers what the player
does, and Claude, planning the other side each round at the same time as the player, blind, under the same rules?

## Steps

Not started; each waits for Mario's word, and the order is a first guess.

### Step 19A — A planner that answers

- [ ] A script that reads the public state each round (the brief a duel already writes) and plans against it: answers a
      kept front, a rush, a turtle, an army that is losing.
- [ ] Measured against the existing scripts over seeds, so "better" is a number before a person plays it.

### Step 19B — Claude as the opponent

- [ ] A Skirmish whose opponent is Claude: each round it reads the brief and writes the plan while the player plans
      theirs, and the two are revealed together, as any duel's are. The duel's `cmd:` player is where it plugs in.
- [ ] While the model thinks, the player is never blocked: the Build Phase stays playable, and the round starts when both
      plans are in. If the model fails or times out, a script plays its round, and the player is told.
- [ ] A model is never needed to play the game: Claude is an opponent to choose, and its key is the player's own.
- [ ] What it plans is kept with the battle, so a battle against Claude replays exactly, model or not.

### Step 19C — Playing it

- [ ] Mario plays against both and says which he would show a friend.

## Out of scope

- Versus between two people, and anything over a network beyond the model's own call.
- A model that writes dialogue or changes a rule: it only plans, like any player.

## Done when

- [ ] Steps 19A to 19C are built and tested.
- [ ] `./scripts/check-repository.sh` passes.
