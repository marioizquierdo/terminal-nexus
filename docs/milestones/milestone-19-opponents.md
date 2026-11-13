# Milestone 19 — A deeper planner

**Status:** PLANNED
**Depends on:** Milestone 20 (its script that answers, and friends' notes on it); built only if those notes say the
scripted enemy is dull

The owner, 2026-11-11 ([his words](../history/feedback/2026-11-11-game-modes.md)): "keep improving the scripted UI AI".
Reshaped on 2026-11-12 ([the review](../history/feedback/2026-11-12-skirmish-saves.md)): the first script that answers
what the player does moved into [Milestone 20](milestone-20-skirmish-worth-showing.md), because reading the opponent
shows nothing if the enemy never reacts; Claude as the opponent became [Milestone 21](milestone-21-agent-players.md).
What is left is a planner that plays well, from [`scripted-opponent.md`](../game-design/scripted-opponent.md).

## Question

Is there a scripted opponent worth playing again and again, one that plans over more than one round from what is public,
measured stronger than the script that answers?

## Steps

Not started; each waits for Mario's word.

### Step 19A — A planner that looks ahead

- [ ] A planner that reads the public state and weighs its plans a round or two ahead (what the player is likely to
      build next, where the front will be), in the battle's own plan vocabulary.
- [ ] Measured against the script that answers over seeds, so "better" is a number before a person plays it.

### Step 19B — Playing it

- [ ] Mario and his friends play against it and say whether it is the default opponent.

## Out of scope

- Agent players (Milestone 21). A planner that sees the player's hidden plan: it plans from what is public.

## Done when

- [ ] Steps 19A and 19B are built and tested.
- [ ] `./scripts/check-repository.sh` passes.
