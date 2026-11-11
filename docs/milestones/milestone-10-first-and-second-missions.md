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
Named scenarios hash the same across runs and runtimes, and are diffed against the state before this
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
