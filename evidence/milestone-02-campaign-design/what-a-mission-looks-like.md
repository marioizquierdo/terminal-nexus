# What a mission actually looks like

**Document role:** The anatomy of a mission, then a fully worked example of the first one
**Status:** Draft for Mario to react to
**Updated:** 2026-08-28
**License:** Apache-2.0 for the mechanism; story material is CC BY-SA 4.0

You said you have not decided how missions look. This is a proposal for the shape *every* mission
shares, and then one mission worked out concretely enough to argue with — a real map, real
coordinates, a real enemy schedule.

---

## 1. Every mission is the same five beats

1. **A briefing.** One screen of text, around 150 words, plus a short exchange between the two
   commanders. Says what is happening, what you have, and what you must not lose.
2. **The build phase.** You place things, spend a small budget, and pick one upgrade. Nothing is
   running. There is no timer. This is where the entire game is played.
3. **The Pulse.** You press a key and watch. No input, no pausing that changes anything, no rescuing a
   mistake. It runs for a fixed length or until somebody's base is gone.
4. **Everyone walks home.** Survivors return to their buildings. This is not a decision, it is the
   punctuation — the visual signal that the round is over and you are about to be allowed to think
   again.
5. **A debrief.** Around 100 words: what happened, who died, and the one thing you just unlocked.

Then either the mission is over, or you go back to step 2 for another round.

What changes between missions is **one new idea**, and nothing else. That rule and why it matters is
in [`unlocking-and-teaching.md`](unlocking-and-teaching.md).

---

## 2. The constraint that everything else depends on

**The build phase has to show the player what is coming.**

This is the thing I did not expect the research to hand me, and it is worth more than any individual
mission idea in this folder.

Into the Breach is built around showing every enemy attack before it happens. The developers' stated
goal was that "every death felt like your own fault," and the design consequence they describe is that
the player spends less time working out how the game works and more time working out how to win. That
game is not an autobattler, but its combat has the same property yours does: within a turn, what is
going to happen is already decided and you cannot interfere.

Your Pulse is that, stretched over a whole round. Which means:

> Everything a player needs in order to judge a build-phase decision has to be visible during the
> build phase.

Concretely, for the first mission:

- **Draw where the raid comes from and roughly when.** Mark the approach edge on the map, and say the
  wave count and arrival timing somewhere the player can read. This is not giving away a secret — the
  briefing already tells them a hostile force is inbound from the north-west ridge, and the story even
  supplies the reason for the precision: the machine has already assigned the incoming force a name, a
  heraldry, and an estimated time of arrival. The fiction promises the telegraph before the design
  asks for it.
- **Show what things do, not just what they cost.** A build menu with prices and no effects is a menu
  you cannot make a decision from.
- **Never offer an upgrade whose value is unknowable until afterwards.** In a fight you cannot correct,
  a coin flip is the worst possible object to hand someone.

**What this costs you:** it is new build-phase interface work — a marker on the map, a line of text,
effect descriptions in the menu — at a moment when you were planning to keep that screen minimal. If
it has to be trimmed, keep the *timing in text* and drop the *marker on the map*: most of the value,
a fraction of the work.

---

## 3. A worked example — the first mission

Everything below assumes the raid-defence opening. If you pick a different opening, this is the one
document that gets rewritten and nothing else does.

### 3.1 The map

Sixty tiles wide, twenty tall. `(0,0)` is the top-left corner; rows read top to bottom.
`.` is open ground, `#` is rock, `*` is a resource deposit.

```text
     0         1         2         3         4         5
     012345678901234567890123456789012345678901234567890123456789
  0  ...................###......................................
  1  ..................###.......................................
  2  .................###........................................
  3  ................###.........................................
  4  ...............###..........................................
  5  ..............###...........................................
  6  ............................................................
  7  ............................................................
  8  ............................................................
  9  ..........###.................##......##....................
 10  .........###....................##....#.....................
 11  ........###.................................................
 12  .......###..................................................
 13  ......###...................................................
 14  .....###....................................................
 15  ....###........................##...........................
 16  ...###...........................#..........................
 17  ..###................................##..**.................
 18  .###........................................................
 19  ###.........................................................
```

Three things this layout is doing deliberately:

**The ridge is one unbroken wall of rock** running from the top edge down to the bottom-left corner,
sealing off the entire west side — except rows 6, 7 and 8, which are open all the way across. That gap
is the approach. The raid does not choose its route; the terrain chose it, and the player can see that
while they are still deciding where to stand. It is also what lets the briefing say "inbound from the
north-west ridge" and have it mean something mechanical.

**Nothing sits directly in line with your base.** There is a known weakness in how units find their
way: a unit heading straight at its goal along a perfectly straight line, that runs into an obstacle,
currently has no fallback direction and gets stuck. Every rock east of the ridge is deliberately placed
off the rows and columns your base occupies, so that never comes up. **This is a constraint on the
layout, not a coincidence — if anyone edits this map later, it has to be preserved.**

**The scattered rocks in the middle are cover, not a maze.** They give the player's placement decisions
something to lean on without turning the approach into a puzzle.

### 3.2 Where everything starts

Your side:

| What | Where it sits | Why there |
| --- | --- | --- |
| Your base (the pyramid replica) | columns 46–48, rows 12–13 | Far side of the map from the ridge |
| The fabricator | columns 46–48, rows 14–15 | Directly below the base, touching it. Citizen structures in an unbroken line are meant to reinforce each other, so the starting layout teaches that shape by demonstrating it rather than explaining it |
| Two troopers | (41,11) and (43,13) | Forward, between the gap and the base |
| Two marksmen | (44,11) and (44,13) | Behind the troopers |
| Three workers | (43,16), (44,17), (45,18) | South of the base, near the deposit |
| Deposit | (41,17) and (42,17) | Close enough to be worth defending, far enough that leaving it uncovered is a real mistake |

That is the briefing's "two squads, one fabricator" taken literally.

The enemy starts with a small group already visible in the pocket behind the ridge — one raider around
(5–7, 3), two runners at (9,4) and (11,2) — so the round does not open with thirty seconds of empty
walking.

**Your build zone** is the open ground roughly between columns 36 and 50, rows 8 to 18. Big enough that
placement is a real decision, small enough to take in at once.

### 3.3 Why the map is this size

The game shows between 48×16 and 72×24 tiles depending on how big the terminal is. At the smallest
supported terminal, a 60×20 map scrolls a little in both directions. At a large one, it fits entirely.

That is deliberate: the mission still reads as small and contained, but the scrolling code gets tested
against the actual campaign mission instead of a fake test map built to exercise it. The cost is that
the very first mission scrolls slightly, which is a small readability tax on the player — mitigated by
the layout, where the base, the build zone and the gap in the ridge are all visible together even on
the smallest terminal. Scrolling is for looking at the edges, not for finding the fight.

### 3.4 The enemy's schedule

The enemy in this mission does not think. It is a list of arrivals on a timer, written in the same file
as the map:

```json
"script": [
  { "atTick": 240, "spawn": { "owner": "B", "at": { "x": 3, "y": 7 },
      "rows": ["r . n"],
      "legend": { "r": { "content": "raider" }, "n": { "content": "runner" } } } },
  { "atTick": 480, "spawn": { "owner": "B", "at": { "x": 3, "y": 6 },
      "rows": ["r . r"],
      "legend": { "r": { "content": "raider" } } } }
]
```

The payload is deliberately the *same shape* as the block that places units at the start, so anyone who
can write a map can already write a schedule, and the existing file checker validates it with almost no
new code.

**One verb, not two.** The obvious design has two: "spawn" for reinforcements and "activate" for a
group that is visible but has not started moving yet. I would build only the first. "Activate" requires
the simulation to hold a unit still and then release it — new machinery in the part of the code that
must stay simple and provable. The only thing it buys is telegraphing, and telegraphing is better done
by drawing the arrival marker during the build phase, which touches nothing in the simulation at all.
Add the second verb the first time a mission genuinely needs an enemy to change behaviour mid-fight for
a reason the player can see.

**The five rules that keep it predictable**, which is the part worth writing down before anyone builds
it:

1. Entries run in time order; two at the same moment run in the order they are written.
2. Arrivals happen at one fixed point inside each step of the simulation — I would pick the very start,
   so a newly arrived unit can be seen and targeted on the same step it appears rather than one step
   later. Whichever is chosen has to be written into the rules, because it is a rule, not a detail.
3. **An arrival into an occupied or impassable tile is skipped and logged as a warning, not an error.**
   The file checker cannot know what is standing on a tile four hundred steps into the future, and
   failing a whole fight because of a scripting collision is the worst available outcome. Skipping is
   predictable, visible in the log, and announces itself while you are authoring. This is the rule a
   naive implementation gets wrong.
4. Everything checkable up front is checked up front: valid times, valid units, footprints that fit,
   ground that is passable.
5. A unit that arrived on a schedule is indistinguishable from one that started on the map. An arrival
   is a placement with a time on it, and nothing downstream should be able to tell.

### 3.5 The mission, minute by minute

| When | What is happening | What the player is learning |
| --- | --- | --- |
| Briefing | The annex is gone, the structure is not, the enemy is inbound and the machine already knows its name | The tone, and that the machine knows things nobody told it |
| Build phase | Place one or two units, pick one of two upgrades. The approach is marked on the map | That the fight is decided here |
| First seconds of the Pulse | The visible group starts moving down the gap | That "the enemy comes from there" was a real fact, not flavour |
| Roughly a third in | Second wave arrives from the same gap | That the approach is a *place*, not a one-off event |
| Two thirds in | Last and heaviest wave | This is what the build phase was graded against |
| End | Survivors walk back to their buildings | The round is over |
| Debrief | Four casualties, the fabricator produced something nobody designed, and the commander accepts the connection | The unlock, and the character |

### 3.6 Two things I found while checking this against the existing code

**There is no separate worker-producing building.** The Citizens currently have exactly one
producer-shaped structure — the barracks — and nothing has production recipes attached yet. So either
the fabricator produces both workers and soldiers, or a second building has to be invented. I would
have the fabricator do both: one producer is the right number for a first mission, and "the fabricator
prints what is needed" is exactly what the debrief already says.

**Do not give the raiders a base.** There is a Ravel base structure sitting in the test content, and
using it would make this mission winnable by destroying it — which is convenient, because the game
currently has no way to say "you win by surviving." It is also the wrong story: the raid withdrawing in
good order and worse temper is not the same as wiping it out. Leave them baseless, play the mission,
and find out whether "the clock ran out and you are still standing" already reads as a win. If it does
not, that is a small, deliberate rule change with your sign-off — not something to build on
speculation.

### 3.7 How long is a round?

I would start at 720 steps, and I want to be clear that this is arithmetic, not evidence: a raider
moves about one tile every seven or eight steps, the walk from the pocket to your base is around
forty-five tiles, so a crossing is roughly 300 steps and two waves need about double that. Existing
test fights use 180 to 200 steps for two units hitting each other, so this is the right order of
magnitude and almost certainly the wrong number.

The good news is that finding the right number is a shell loop, not a playtest — the tooling already
resolves a fight without a display and prints the outcome and the length as data. Sweeping a dozen
values takes a minute. That should happen before anybody watches this mission with their eyes.
