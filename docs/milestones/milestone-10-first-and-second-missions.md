# Milestone 10 — First and Second Missions

**Status:** PLANNED
**Depends on:** Milestones 2 through 9 (every mechanism this milestone exercises for real)

This is where Milestones 4 and 9, both built against a first mission with nothing yet to show, fill in.
The Story menu's progress, army and enemy-intel panels and the cutscene mechanism are tested here
against a second mission. That is their intended second use: extract a framework only after two real
uses reveal where its boundary is.

## Question

Do PERIMETER, polished, and RIGHT OF SALVAGE, newly authored on the infrastructure Milestones 3 to 9
built, together read as the opening of a real Commander's story: technologies that carry and mean something, enemy intel with
something in it, and a story that continues rather than repeats?

## What it builds

**PERIMETER polish.** Whatever Milestones 3 through 9 each left rough is fixed here, once the whole
loop can be played start to finish and judged as one thing.

**RIGHT OF SALVAGE, authored for real.** Unlike PERIMETER, this mission's text does not exist yet.
[`docs/game-design/story.md`](../game-design/story.md) has only the belief ramp's one-row
summary: "The Nexus is a tool we are learning", then "First itch: the tool knows things nobody
entered", teaching "Salvage economy and contested wrecks", with the interface naming Speaker Corvane
before any contact and Vasse asking "Who filed that?". The full briefing, pre-battle exchange, barks,
debrief and artifact entry are real creative work this milestone owns. PERIMETER's own write-up in
the same document is the template for shape and weight.

**The salvage economy, pulled forward from the backlog.** The engine design already describes it:
destroying a structure returns half its value to its owner and drops the other half as salvage on the
Grid, workers from either side can drain it, and building over remaining salvage destroys it.
[`backlog.md`](backlog.md) held this as unowned. RIGHT OF SALVAGE needs it, so it lands here.

**Unlocks and intel, exercised for real.** Completing PERIMETER should fill the unlock record (Q31)
with something that RIGHT OF SALVAGE's Story menu screen (Milestone 4) actually shows. By the second
mission, enemy intel (Q35) has real Ravel content from the first. If either screen reads wrong once
there is something to show, that is this milestone's finding to act on, not a defect to carry forward.

## Steps

### Step 10A — PERIMETER, polished

- [ ] The whole loop is played start to finish and judged as one thing.
- [ ] Rough edges left by Milestones 3 to 9 are fixed.

### Step 10B — RIGHT OF SALVAGE, written

- [ ] Briefing, exchange, barks, debrief and artifact entry are written inside the lore budgets.
- [ ] The text is reviewed before anything is built against it.

### Step 10C — RIGHT OF SALVAGE, built

- [ ] The salvage economy from the backlog.
- [ ] The mission's map and trigger list.
- [ ] Technologies and intel exercised for real on the Story menu.

This is Story's first proof: PERIMETER as the tutorial and RIGHT OF SALVAGE as the first technology mission
([`docs/game-design/story.md`](../game-design/story.md), the shape of a Commander's story). The bar is "a new
player comes out able to play a Skirmish, and the world feels real", not length. The later technology missions,
the endless stand (Milestone 18) and the final battle follow, each its own milestone once this one is played.

## Out of scope

- Missions 3 through 6 of the belief ramp (RESTORATION, PRECOMMITTED, TWELVE OF TWELVE, ANNEX ZERO).
- Any faction beyond Citizens and Ravels.
- A real save and progression system beyond the flat unlock record.
- Multiplayer.

## How it is judged

Automated: RIGHT OF SALVAGE gets the same determinism bar as every other mission and kernel change.
Named sandboxes hash the same across runs and runtimes, and are diffed against the state before this
milestone.

Human, and this is the real test: a fresh player finishes PERIMETER, sees a correct unlock and a
mission report on the Story menu, plays RIGHT OF SALVAGE, understands why Speaker Corvane being
named before contact unsettles Vasse, and can summarize one answered question and one larger mystery
across the two missions together. That is the per-mission teaching contract in the Story design,
checked against two missions instead of asserted about one.

## Done when

- [ ] PERIMETER plays start to finish without a rough edge left by an earlier milestone's narrow scope.
- [ ] RIGHT OF SALVAGE's full text is written and reviewed.
- [ ] The salvage economy works on RIGHT OF SALVAGE's own map.
- [ ] The Story menu's progress, army and enemy-intel panels show real, correct content after
      PERIMETER's completion.
- [ ] Mario has played or watched both missions back to back.
- [ ] `./scripts/check-repository.sh` passes.

## Carry-over from the PERIMETER era

Moved here from the next-steps list on 2026-11-12, when PERIMETER stopped being the testing map: what the
rounds played on it left unfinished. Each is to recheck when PERIMETER is polished as the tutorial; some may already be
settled by the pathfinding milestone.

**From rows x2** ([his words](../history/feedback/2026-10-06-rows-x2.md); the rule is in
[`grid.md`](../system-design/grid.md), distance, reach and movement):

- Ranges and raids are not tuned for balance: every reach became a whole number of rows and nothing more, since
  ranges get adjusted as units are made (his words). As played, at the default settings, PERIMETER is won in all
  three rounds with nothing built, and with two Turrets and one more each round; with nothing built and Vasse at 60
  health with a 10% aura, the Nexus falls in round 3.
- The Commander's cadence level does not always show the cadence: at 100 health and a 40% aura she lives through
  round 1, and at 20 health and a 10% aura without the Barracks's wave the mission is lost in round 2, before her
  return. Both were so before this round.
- Two melee units of one speed set down diagonally from each other step round each other without ever touching.
  Real pathfinding, not the greedy step, is what closes it.
- A big unit's death shockwave and the debris round a small one are drawn square: decoration that claims no area,
  but a raider's shockwave reaches two rows up and down as its blast of 1 goes off. Its rows could be weighted by
  the rule if it reads as the blast.
- A deposit inside the build range carries no mark in monochrome (the range's wash does not
  render there and a deposit takes no dot), though a building may be placed on it. Older than the rule.

**From step 6B** ([the round-loop report](../history/reports/2026-09-30-round-loop-and-missions.md) has the reasons):

- PERIMETER is played on the Build Phase's starter map, with regions named for its landmarks; its own map is Q38's.
- Every unit engages the nearest enemy: `order` has one verb, `advance` (Q69).
- The incoming raid is a forecast placed against the map without the plan; a building on an arrival's
  tile moves it when the round starts.
- The walk home is a straight glide over whole tiles, with no routing. Replay plays back a Battle Round
  already resolved; it must never resolve a new one.

**From step 8A** ([the Commander report](../history/reports/2026-10-01-commander-vasse.md) has the outcomes):

- Vasse's return is never seen in PERIMETER: she cannot fall before round 2 there, and a fall in round 2 is
  back in a round 4 that does not exist. Vasse's second test level shows it:
  `--at 'story?mission=vasse-test-2&round=3'`.
- Her doctrine's "hold, then advance" waits on an order the kernel can keep (Q69); she engages the nearest
  enemy like every unit, from just behind the line.
- In round 1 she is incoming with the squads, so her card is the incoming one ("Yours, next round"), not her
  own ("Your Commander"); from round 2 on it is hers.

**From step 8A's second round** ([Mario's notes](../history/feedback/2026-10-03-commander-round-2.md)):

- The raid's intent is its first target only: after first contact the raid retargets, nearest enemy each
  tick, and where the fight then goes is not shown. A group arriving seconds in is foreseen against the
  round's opening.
- In monochrome an arriving unit is drawn at full strength (the wash shows only where
  colours blend), so arriving and present enemies look alike there; the panel's heading and the card's
  "Incoming" say which. At 256 colours the washes come out grey, and washed orange turns pinkish.
- Both of her story's levels offer the same cards (PERIMETER unlocks all of `armies/all`, the cadence level
  nothing new), so what a level offers changes nothing on screen yet; it shows when a level unlocks a card of
  its own (the Nexus Pulse step).
- PERIMETER opens on its intro, so a key script for the game, the playtest or the browser page starts with
  `Esc` (the documented examples do).

**From step 8A's fourth round** ([Mario's notes](../history/feedback/2026-10-04-commander-round-4.md)):

- A lone Turret or Hatchery east of the Barracks draws round 1's probe against the ridge, out of the line's
  reach, and the round runs to time (still survived): units step greedily and have no pathfinding.
- Round 2 with nothing built is still won, so "the second round needs something built" holds neither before
  this round nor after it; the level was not tuned for it.
- By the Book's reach is drawn only where colours blend: in monochrome her card says what it
  does.
- The forecast carries the player's troops as one more forecast group (`TroopsGroup`); a `post` field on the
  raid's group would be one shape fewer.
- Building inside a raid's public coverage waits for a raid that stands buildings at the start of a Build Phase.

**From step 8A's fifth round** ([Mario's notes](../history/feedback/2026-10-05-commander-round-5.md)):

- PERIMETER is easier: a Barracks's four troopers at five seconds hold its last round even with nothing built,
  and Vasse now lives through it in most plans, so her health Experiment matters only in round 3.
- Without chaining, round 1's build range is the Nexus's and the Barracks's alone, and reaching further takes a
  round a step. A room of 1 leaves a Barracks's corners open, corner to corner. The room shows only while a
  building is armed.
- Her round-opening line rarely fits now that first contact comes sooner: the moments that matter more come first.
- The tests' shared PERIMETER plan (`STRONG`, `tests/mission.test.ts`) puts a Turret (22,7) outside the build
  range at every value; the tests skip the placement check, so the plan could not be placed in the game as written.
- The raid's trail is the second animation that never settles, beside a popup's breath: the screen redraws five
  to seven times a second while it moves. Moving arrows may strengthen the worry, in the backlog, that lanes of arrows read as a tower defence.
