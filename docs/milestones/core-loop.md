# Terminal Nexus — the core loop, open

_Planning notes, not a decision. What happens to an army between Battle Rounds, what a player can order in the Build Phase, and how the march is shown: the ideas on the table, a measured experiment, and what each choice would change in the milestones ahead. The owner settles it by playing (his words: "a deep dive gameplay to settle the core game mechanics"); these notes are what that deep dive starts from. Logged from [his note of 2026-10-26](../history/feedback/2026-10-26-core-loop.md)._

## 1. The question

Today a round is: a Nexus Pulse, a Build Phase, then a Battle Round of up to 50 seconds; then **Recall** sends every
survivor home, onto the roof of the building that trained it or beside the Grid Nexus, and the next Build Phase opens on
an empty middle. So every Battle Round starts from the bases, and an attack has to cross the map again each round. The
owner is weighing three rules for that moment between rounds:

| Rule | Between rounds | The game it makes |
| --- | --- | --- |
| **Home** (today) | Every survivor walks home | A sequence of separate raids. Clean and readable; every round starts from the same shape. A round must be long enough, or the map small enough, for an army to reach the enemy Nexus |
| **Fall back** | Survivors retreat a short way toward their Nexus | A front that breathes: armies part between rounds and meet again in the middle. Keeps a little of the march each round |
| **Stay** | Survivors stand where the round left them | **An RTS autobattler with timed build phases**: the front line is persistent state, the Build Phase reacts to where the armies are, new waves walk out to reinforce it. The map can be as big as the game wants |

With it come three ideas that stand on their own:

- **Orders in the Build Phase.** The player tells the army what to do in the coming Battle Round: advance, hold the
  line, or fall back. "We should be able to make them retreat while doing build phase (so the game stays more
  dynamic)." It is the same rule as a building's order: given between rounds, carried out during the round, never
  touched while it plays.
- **The march line, shown.** The Commander's line to the enemy Nexus is the line every other unit marches by; it is
  drawn on the Build Phase map so the player sees the way the army will go. Without her on the Grid it is the line
  from Nexus to Nexus; later, the line to a banner or an outpost.
- **The genre.** "Lean into the RTS genre": an army that lives on the battlefield, built in timed phases instead of
  in real time, and told in ASCII.

## 2. What already exists

So a decision here is mostly about rules, not new machinery:

- **The guide line is built.** While a side's Commander stands on the Grid she is its guide: its line runs from her
  to the march's goal, from the side's own Nexus without her, and marchers keep within a band of it and form up
  behind her by line (the march, [`movement.md`](../system-design/movement.md)). Drawing it in the Build Phase is
  presentation only.
- **Orders exist in the duel.** A duel side's plan has a stance, `attack` or `hold`
  ([`duels.md`](../system-design/duels.md)); the Build Phase screen does not offer it yet, and its troops always attack.
  A building's order (Hold production) is the pattern for an order given between rounds.
- **Survivors are already drawn in the Build Phase** as the field, and their health carries; only where they stand
  changes between the rules.
- **The snowball is known.** In the scripted duels the side ahead after round 2 wins 50 of 54
  ([the march's report](../history/reports/2026-10-21-the-march.md)). Any rule that keeps the winner's army closer to
  the loser's Nexus could make that worse; a rule that makes reinforcing the front slow could make it better.

## 3. The experiment

The three rules were built as an experiment-only option on the duel (nothing in the game changed) and measured: the
three Commanders against each other, both sides, three scripted players, on the Crossing, under each rule, with Battle
Rounds of 30, 50 and 75 seconds.

_Results are added below when the measurement finishes._

## 4. Thoughts

_Written with the results._

## 5. Against the milestone plan

_Written with the results._
