# Milestone 18 — The Endless Stand

**Status:** PLANNED
**Depends on:** Milestone 17 (Skirmish: the battle a mission is built on), Milestone 7 (the economy the stand asks the
player to balance), Milestone 4 (a story to end in it)

The owner, 2026-11-11 ([his words](../history/feedback/2026-11-11-game-modes.md)): "a final endless wave where the
player needs to balance collecting resources with proper upgrades, with holding on the enemy, with taking into
strategical points, and basically hit the highest score possible up to the point that their nexus is taken. And at that
moment, it unlocks the final scene that jumps into the final level." The design is [`story.md`](../game-design/story.md),
the endless stand.

## Question

Does an endless stand — groups that grow until the Nexus falls, scored by how far the player got — test what a player
collected across a Commander's story, play in fifteen to twenty-five minutes, and turn the story to its final battle?

## Steps

Not started; each waits for Mario's word, and the order is a first guess.

### Step 18A — Groups as a mission

- [ ] A group schedule as mission data: what spawns, where and when, growing round by round, the same every time from the
      seed; validated by name like every other mission shape.
- [ ] A mission with no enemy Nexus that ends when the player's falls; its rounds are not capped.
- [ ] Measured: the battle scripts hold against the schedule over seeds, so its pace (fifteen to twenty-five minutes for a
      typical stand) is set by numbers before a person plays it.

### Step 18B — The score

- [ ] The score shown through the stand and at its end (Q93 decides how it is counted), and a high score kept per
      Commander on the player's machine.

### Step 18C — The turn to the final battle

- [ ] The Nexus falling plays a scene, not a loss screen, and opens the story's final battle.

## Out of scope

- An endless stand outside a story, and cosmetic themes unlocked by one (IDEA in [`game-modes.md`](../game-design/game-modes.md)).
- Online leaderboards.
- Writing a Commander's final battle (Milestone 10's successors).

## Done when

- [ ] Steps 18A to 18C are built and tested; Mario has played a stand to its end.
- [ ] `./scripts/check-repository.sh` passes.
