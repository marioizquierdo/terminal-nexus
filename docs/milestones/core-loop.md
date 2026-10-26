# Terminal Nexus — the core loop

_Planning notes. What happens to an army between Battle Rounds, what a player orders in the Build Phase, and how the
march is shown. **Decided on 2026-10-26** ([his note](../history/feedback/2026-10-26-core-loop.md)): the front stays.
The decision is first; the question, the measured experiment and the thinking that led to it follow, as they were
written before he chose. Each rule moves into the design documents as the step that builds it lands._

## The decision

The owner, after the experiment: "This is fantastic data. I am also leaning into double down the RTS style, leaving
troops on the map, so they can keep moving forward." With it, the movement it needs: troops that "self-arrange in useful
formations", "a better way to define aggressive vs defensive stance, clear movement and pathfinding algorithms, and
predictable spawning schedules. With all that, we can safely leave the units on the map."

- **Battle Rounds of 30 seconds.**
- **The front stays, with a regroup.** After a round, survivors in a fight stop targeting, step back for 2 seconds and
  form up for 6, 10 seconds in all (his numbers; the last 2 seconds the army stands formed, room for the slowest to
  arrive). It plays during the Build Phase.
- **Troops move during the Build Phase**, forming up and stepping out from under a building placed on them, and all of
  it deterministic: the regroup is worked out from the round's end alone, so a scripted battle plays the same.
- **Orders, from simple to rich** — each a step, built in order:

| Level | What the player sets | What it allows |
| --- | --- | --- |
| None (today) | Nothing: troops always march on the enemy Nexus; a campaign level sets an automatic target | The simplest; little room for tactics |
| **Stance** | One setting for the army: aggressive, hold the line, or defensive | Much more dynamism for one row |
| **Banner** | A banner on the map, aggressive or defensive; by default on the enemy Nexus, aggressive | Aggressive elsewhere: the army goes there first, then on to the enemy Nexus, so it sets a route. Defensive: the army holds the line there, for map control or the base |
| **Two banners** | The Commander follows the main banner; a building can be set to send its units after the secondary one | Split armies, which matter once the map holds resources and bonuses; needs more UX. To test eventually, built towards step by step |

Where it sits: the runs milestone gains three steps before the route — the kept front, the stance, the banner. Two
banners wait until the map has something worth splitting an army for. The campaign's missions keep sending survivors
home until they are revisited.

## 1. The question (as it was asked)

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
- **The genre.** "Lean into the RTS genre": an army that lives on the Grid between rounds, built in timed phases
  instead of in real time, and told in ASCII.

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

The three rules were built as an experiment-only option on the duel (nothing in the game changed) and measured: 3888
scripted duels on the Crossing, the three Commanders against each other, with Battle Rounds of 30, 50 and 75 seconds
([the report, with every table](../history/reports/2026-10-26-between-rounds.md)).

| Battle Round | A Nexus falls: home / fall back / stay | The front as the Build Phase opens (distance to the enemy Nexus): home / fall back / stay |
| --- | --- | --- |
| 30 s | 23% / 36% / 43% of duels | 51 / 40 / 32 |
| 50 s (today) | 49% / 48% / 50% | 53 / 41 / 33 |
| 75 s | 65% / 66% / 66% | 58 / 46 / 39 |

- **At today's 50 seconds the rule hardly changes who wins or when.** An army crosses the Crossing within a round
  anyway, and under every rule the attack stalls at the same line, about 31 from the enemy Nexus, where the defender's
  fresh waves and Turrets hold.
- **The rule is what lets rounds be short.** At 30 seconds home rounds mostly end before anyone reaches a Nexus; with
  the front kept, a 30-second round is as decisive as a 50-second one is today.
- **The snowball may soften when the front is kept** (the side ahead after round 2 won 82% under home, 69% under fall
  back, 74% under stay), but on about 50 duels: a hint, not a finding.
- **Under stay a Build Phase can open with the enemy at your Nexus.** Fall back keeps the front's place but always
  leaves a gap.
- **The scripts never retreat, hold when beaten, or answer a camped army**, so the numbers measure script against
  script. Whether an army at your door feels like pressure or like a lost game only a player can say.

## 4. Thoughts

**Lean into the genre, and keep the front.** An army that stays where it fought is the concept's own promise —
"persistent armies", "survivors matter" — made visible: the Build Phase stops being a fresh start and becomes a reading
of a live situation, where the line is, what is thin, what reached the Turrets. It frees the map's size from the
round's length, which home never can, and it is what gives a run's battles the texture of a dynamic environment rather
than a series of raids. The measurement agrees on the one thing it can show: keeping the front is what makes short,
decisive rounds possible.

**Fall back as the default, stay as the bold setting.** Fall back keeps the RTS feel — the front's place, the army's
shape, the march resumed each round — but never opens a Build Phase with enemy troops on your roofs, which is the moment
most likely to feel decided rather than tense. Stay is the purer autobattler and the one to try against it.

**Orders are the other half, and they are cheap.** With the front kept, the decision a player most wants is the army's:
press on, hold the line, or pull back to the base — the round's order, given in the Build Phase and carried out in the
Battle Round, exactly as a building's order is. Fall back to base is today's Recall turned into a choice. Banners and
outposts come later as places to hold or gather, and the guide line runs to them. The duel's stance already holds
`attack` and `hold`; the Build Phase only needs the row.

**Show the line.** The guide line exists in the march; drawing it on the Build Phase map — from the Commander to the
enemy Nexus, or Nexus to Nexus while she is out — tells the player where the army will go before they commit, which is
the "see it before you commit" rule applied to movement.

**Shorter rounds with it.** About 30 to 40 seconds a Battle Round instead of 50: the agent's numbers say fall back or stay
keeps them decisive, and a run of eight short rounds a battle is closer to the 5–12 minutes a match is meant to be.

**What to watch.** Reinforcements walking out behind a forward line (an army that arrives in two pieces); a stalemate at a
choke where both fronts sit at each other's Turrets; the snowball once players adapt; the Build Phase drawing many units
mid-Grid at 80 × 24; enemy units inside your build range (placement refuses occupied ground, but nothing else changes).

## 5. Against the milestone plan

| Where | What the choice changes |
| --- | --- |
| **Runs (current)** — the route, the opponents, the shell | Little in the route itself. The run's numbers do move: rounds per battle and their length, how much a battle costs the Nexus. The scripted opponents need to hold and fall back when beaten, or a kept front is unanswerable — the experiment's biggest caveat, and already the opponents' step's work |
| **Runs — playing it** | This is where the deep dive belongs: a run is the loop, played end to end. Each rule an Experiment in Settings, felt over a run |
| **Worker economy** | Workers out on a kept front are natural RTS; under home they shuttle. The economy's timing waits on the round's length either way |
| **First and second missions** | PERIMETER's raids were written for home: under fall back or stay a raid's survivors linger near the base into the next Build Phase, which changes what the mission teaches. A mission may fix its own rule |
| **Content and balance** | Units' roles shift: speed and reinforcement matter more with a kept front, a Garrison that holds the line is worth more |
| **The register** | Answers part of how an army reaches its first fight faster; makes the hold and withdraw orders (asked once for missions) a player's choice too; feeds how long a match is |

**Recommendation for the order: a short step before the route.** Put the core loop on trial inside the run, as
Experiments he plays rather than rules decided on paper:

1. **Between rounds** — home, fall back, stay (the rule measured here, behind a setting; home by default until he says).
2. **Battle Round length** — 30, 40 or 50 seconds.
3. **The round's order** — a Build Phase row: advance, hold the line, fall back to base.
4. **The march line** drawn on the Build Phase map.
5. **The scripted opponent holds or falls back** when its front is broken, so a kept front has an answer.

Then the route, the opponents and the shell go on as planned, on numbers the deep dive settled. The register holds the
question with this recommendation; nothing in the milestone is re-cut until he says.
