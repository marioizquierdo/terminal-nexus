# The testing ground made generic, and the bugs its first metrics found — 2026-10-31

_After the testing ground merged, Mario asked for one pull request doing two things: fix the bugs the better metrics
had found, and step back so the testing ground stays generic, its guide about concepts that let a later session extend
it rather than about the troop movement problem at hand. The guide is [the testing ground](../../system-design/testing-ground.md)._

## Bugs fixed

- **Units turning between two walled-in enemies every tick.** A unit holding a target it can neither strike nor reach
  let it go at once and chose afresh without it; among enemies all walled in, it took another, then the first again the
  next tick. It now lets go only when there is an enemy it can reach, and otherwise keeps the one it holds and stands as
  near as it can get. Played with `grid engage-bench --against origin/main --profile`: target switches a unit at the
  two-row gap 69 → 2.8, in the corridor 15 → 1.5, at the gap with flyers 6.7 → 0.3; no outcome moved beyond chance; every
  expectation held; route fields a tick in the corridor 3.6 → 3.2. In the quick spec's duels (126 battles, the same
  winners in every pairing): target switches 36,503 → 11,651, stalled units 414 → 234. Units pacing between two tiles at
  the bench's narrow grounds, the open "pacing at a door" item: 2.6 a battle → 1.7. One pinned battle moved (a Challenge
  run's battle 2 ends 30 ticks sooner) and a test now holds the rule with two workers in two rings of rock.
- **A wrong label in the tool**: stalls "queued behind a unit settling after a step" were queued behind the tile of a
  unit that had just died. The measure was removed with the simplification below.
- **Not a bug**: duels show about ten idle units a battle; the balanced player holds its line in rounds 1 and 2, and a
  held line is idle by design. The guide says so.

## Simplified

Removed as too close to the last problem, each easy to add back by the guide's "Extending it": the queue each stall
ended at, the round robin of armies with its standings and `--cells`, the two army trial files, the route-question
breakdown in trials (still in `scripts/profile-routes.ts --detail`), the route-calls and blocked-seconds columns, a trial
expecting a time in milliseconds, and "the most target switches" among the battles worth watching. What stays is the
shape: map, variant, engine, record, cells, summary; three tables (outcome, engagement, cost); expectations; another
build beside this one; processes; the battles worth watching.

## The guide

Rewritten around concepts: which tool answers which question, the loop, the shape of a trial and why it holds together
(nothing touches the kernel; everything but the command is pure), how to extend each part (a measure, a variant, a
cost, a trial file, a one-off question), how to read a trial, how to compare two builds, the maps, and the principles.
The findings that used to sit in it are in this report and the one before.
