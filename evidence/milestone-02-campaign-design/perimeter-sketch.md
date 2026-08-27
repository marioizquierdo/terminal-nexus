# Milestone 2 — PERIMETER: content check, map layout, and the scripted-raid shape

**Document role:** The concrete half of Milestone 2's Definition of Done — the fixture-content confirmation, a real map layout with coordinates, and the trigger-list shape Milestone 6 implements
**Status:** Proposal for owner review; assumes Concept 0 while Q39 is open
**Updated:** 2026-08-27
**License:** Apache-2.0

**This document assumes Q39 resolves to Concept 0** ([`campaign-concepts.md`](campaign-concepts.md)).
It is the only document in this pass that does. If Q39 lands elsewhere, this is what gets rewritten
and nothing else in the pass does.

---

## 1. Unit list — confirmed against the actual fixtures

Milestone 2's Definition of Done asks for this specifically, because "ids may drift." Checked against
`src/content/citizen.ts` and `src/content/ravel.ts` as of this session.

### 1.1 Everything the milestone's Section 4.1 names — all present

| Id | Confirmed | Shape as built |
| --- | --- | --- |
| `unit.citizen.worker` | yes | 1×1, 20 hp, `behavior: "flee"`, no attack |
| `unit.citizen.trooper` | yes | 1×1, 40 hp, melee 7 dmg / 12-tick cooldown |
| `unit.citizen.marksman` | yes | 1×1, 24 hp, ranged 5 tiles, 6 dmg / 24-tick cooldown |
| `structure.citizen.nexus` | yes | 3×2, 400 hp, `nexus: true` |
| `structure.citizen.barracks` | yes | 3×2, 120 hp — the "fabricator" the briefing and debrief refer to |
| `unit.ravel.raider` | yes | 3×1, 44 hp, melee 11 dmg, `detonation: { radius: 1, damage: 10 }` |
| `unit.ravel.runner` | yes | 1×1, 16 hp, melee 5 dmg, fastest thing on the bench |
| `structure.ravel.den` | yes | 3×2 |

### 1.2 Bench content that exists and PERIMETER deliberately does not use

`unit.citizen.hauler` (3×1), `unit.citizen.sentinel` (2×2), `unit.citizen.colossus` (3×3),
`unit.ravel.slinger`, `unit.ravel.fuelwagon`, `unit.ravel.scav`, `unit.ravel.corsair` (2×1),
`unit.ravel.leviathan` (5×2), `unit.ravel.buzzard` (air), `structure.ravel.nexus`.

Named here so a later session does not "discover" them and assume they were forgotten. They are
excluded because PERIMETER teaches one lesson and every extra silhouette costs against that
([`progression-system.md`](progression-system.md) Section 4). The multi-tile and air units in
particular are the bench's best content and the worst possible thing to put in mission 1.

### 1.3 Two findings worth carrying forward

**Finding 1 — there is no distinct worker producer.** Milestone 7 makes worker production a
construct-menu item, and `engine.md` Section 6 says workers "are produced by a dedicated automatic
building." The bench has exactly one Citizen producer-shaped structure (`structure.citizen.barracks`)
and no production recipes attached to anything. So PERIMETER must either (a) let the barracks produce
both workers and troops, or (b) add a second producer role. **Recommendation: (a)** — one producer in
mission 1 is correct for teaching, and "the fabricator prints what is needed" is exactly the fiction
the debrief already wrote. Milestone 7's own gate is where this becomes real; it is flagged here so
that milestone does not have to rediscover it.

**Finding 2 — the raid deliberately has no Grid Nexus.** `structure.ravel.nexus` exists on the bench,
and giving the raid one would make PERIMETER winnable through the kernel's existing "destroy the enemy
Grid Nexus" condition — which is Q36's Option C. That option bends the mission's own fiction
(Corvane "withdrew in good order and worse temper," not "was annihilated"), so the raid should stay
Nexus-less and Q36's recommendation (play it and see whether the tick-limit ending reads correctly)
stands. Recorded because "there is a Ravel Nexus on the bench" is the obvious shortcut, and it is the
wrong one.

---

## 2. The map

### 2.1 Size, and Q38

**`large-extra-wide` — 60 × 20 tiles.**

The arithmetic behind that choice, since Q38 is what it answers:

- The viewport clamp is 48×16 to 72×24 tiles (`engine.md` Section 3, RULE).
- At the 80×24 terminal floor the viewport is 48×16, so a 60×20 Grid **scrolls in both axes** — 12
  columns and 4 rows of overhang. Milestone 5's scrolling and its 3-tile cursor margin get real
  evidence from the actual campaign mission rather than a purpose-built fixture.
- At a large terminal the viewport reaches 72×24 and the whole Grid fits, so the mission still reads
  as "small and contained," which is what the belief ramp's wording was protecting.
- 1,200 tiles, comfortably under the loader's 10,000-tile declared-mode bound
  (`src/scenario/load.ts`).

That is Q38's Option A with the numbers filled in: the belief ramp's *feel* is the invariant, and
"never scrolls" was a size claim written before scrolling existed to be built.

### 2.2 Terrain

`(0,0)` is the north-west tile; rows read north to south. Legend: `.` `terrain.plain`,
`#` `terrain.rock`, `*` `terrain.deposit`.

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

Three things that layout is doing on purpose:

1. **The ridge is one continuous rock band** running from the north edge at x≈19 down to the
   south-west corner, sealing the entire west of the Grid — *except* rows 6, 7 and 8, which are open
   all the way across. That breach is the approach lane, and it is why the briefing can say "inbound
   from the northwest ridge" and mean something mechanical. The raid does not choose its route; the
   terrain chose it, and the player can see that during Build Phase.
2. **Nothing sits on-axis with the Nexus footprint.** Q33's whole concern is Q15's routing dead end: a
   mover exactly on-axis with its goal that meets an obstacle has no fallback under Manhattan
   distance. The Nexus occupies columns 46–48 and rows 12–13; every rock east of the ridge is placed
   off both — rows 9, 10, 15, 16, 17 and columns 30–39. A raider running east along row 7 and turning
   south down column 47 meets clear ground the whole way. **This is a layout constraint, not a
   coincidence: any future edit to this map must preserve it, or re-open Q33.**
3. **The mid-map rocks at (30–33, 9–10) and (31–33, 15–16) are cover, not maze.** They give the
   player's placement decisions something to lean on without turning the approach into a puzzle.

### 2.3 Starting placements

Expressed as **occupied tile ranges**, not as the `.map.json` centre-tile symbols — the loader derives
an anchor from a symbol on the footprint's middle tile (`footprintCentre`, `src/grid/coords.ts`), and
writing ranges here keeps the sketch unambiguous for even-sided footprints.

**Player (`placements.A`), Citizens:**

| What | Occupies | Note |
| --- | --- | --- |
| `structure.citizen.nexus` | x 46–48, y 12–13 | The Grid Nexus. Near the east edge, the far side of the map from the ridge |
| `structure.citizen.barracks` | x 46–48, y 14–15 | Directly south of the Nexus, sharing an edge — an unbroken orthogonal run, which is the Citizens' alignment bonus drawn into the starting layout rather than explained |
| `unit.citizen.trooper` ×2 | (41,11), (43,13) | Forward, between the lane's exit and the base |
| `unit.citizen.marksman` ×2 | (44,11), (44,13) | Behind the troopers |
| `unit.citizen.worker` ×3 | (43,16), (44,17), (45,18) | South of the base, near the deposit |
| Deposit tiles | (41,17), (42,17) | Two tiles; a worker harvests from the tile or an orthogonal neighbour, so up to five could share one |

That is the briefing's "two squads, one fabricator" literally: four combat units in two kinds, one
producer, a small crew.

**Opponent (`placements.B`), Ravels — the vanguard, visible at Pulse start:**

| What | Occupies | Note |
| --- | --- | --- |
| `unit.ravel.raider` ×1 | x 5–7, y 3 | 3×1 footprint; in the pocket north-west of the ridge |
| `unit.ravel.runner` ×2 | (9,4), (11,2) | Faster; arrives first |

**The player's build zone** is the open ground roughly x 36–50, y 8–18 — between the lane's exit and
the base, large enough that placement is a real decision and small enough that it is legible.

### 2.4 Pulse length

**`pulseTicks`: 720**, proposed and explicitly unvalidated. The reasoning: a raider's cadence is about
7–8 ticks per step at `movementRate` 8/3, so crossing roughly 45 tiles from the pocket to the base is
on the order of 300–350 ticks, and two waves need roughly double that. This is arithmetic, not
evidence — the first thing Milestone 6 should do with this map is run it headless and adjust. Existing
fixtures use 180–200 for two-unit skirmishes, so 720 is the right order of magnitude and almost
certainly the wrong number.

---

## 3. The scripted opponent — Q32's trigger list, made precise

Q32's recommendation is Option A: a tick-gated trigger list authored as data, validated at load like
any other scenario field, with no runtime policy interface. Here is that shape at the level of detail
Milestone 6 can implement without a second design pass.

### 3.1 One verb, not two

The obvious design has two verbs — `spawn` (reinforcements arrive) and `activate` (a group that was
already visible starts advancing). **Recommend building only `spawn`.**

`activate` requires the kernel to hold a unit in a non-advancing state and then release it, which is
new kernel surface (a held behaviour, and an event for the release). Its only real use is the
telegraph — showing the player an enemy that has not yet moved. But the telegraph is better served by
drawing the *arrival marker and tick* during Build Phase
([`progression-system.md`](progression-system.md) Section 5), which is presentation reading authored
data and needs nothing from the kernel at all.

So: pre-placed units advance from tick 0, reinforcements spawn on schedule, and one verb covers
PERIMETER completely. `activate` earns its place the first time a mission needs an enemy group to
*change behaviour mid-Pulse for a reason the player can see* — and not before.

### 3.2 The shape

A `script` array alongside `placements`, in the same `.map.json` file:

```json
"script": [
  {
    "atTick": 240,
    "spawn": {
      "owner": "B",
      "at": { "x": 3, "y": 7 },
      "rows": ["r . n"],
      "legend": {
        "r": { "content": "unit.ravel.raider" },
        "n": { "content": "unit.ravel.runner" }
      }
    }
  },
  {
    "atTick": 480,
    "spawn": {
      "owner": "B",
      "at": { "x": 3, "y": 6 },
      "rows": ["r . r"],
      "legend": { "r": { "content": "unit.ravel.raider" } }
    }
  }
]
```

The `spawn` payload is deliberately the **same object shape as a `placements` block** — `at`, `rows`,
`legend`, with `owner` naming which player's block it belongs to. That is the whole point of choosing
Option A: no new authoring vocabulary, no new validator, and a scenario author who can already write a
map can already write a schedule.

### 3.3 The rules that make it deterministic

Six, and they are the part Milestone 6 actually needs written down:

1. **Ordered by `atTick`, ties broken by array order.** Authored order is the tie-break, so two
   entries at the same tick are unambiguous without a sort key.
2. **Spawns resolve at one fixed point in the tick.** Recommendation: at the *start* of the tick,
   before perception and movement, so a spawned unit is visible to targeting on the tick it appears
   rather than a tick later. Whichever point is chosen must be named in `engine.md` Section 4's tick
   order, because it is a rule and not an implementation detail.
3. **A spawn into an occupied or impassable tile is skipped, and logged at `WARN`.** Not an error —
   the loader cannot validate occupancy at tick 240 statically, and failing a Pulse mid-run over a
   scripting collision is the worst available outcome. Skipping is deterministic, visible in the log,
   and self-announcing during authoring. This is the single most important rule here, because it is
   the one a naive implementation gets wrong.
4. **Load-time validation:** every `atTick` is an integer in `0..pulseTicks`; every `owner` names a
   declared placement block; every `content` id resolves; every footprint fits the Grid; terrain under
   each spawn is passable for that content's mask. Everything checkable statically is checked
   statically, exactly as the map loader already does for `placements`.
5. **Spawned entities are indistinguishable from placed ones** once they exist — same layers, same
   arbitration, same salvage. A spawn is a placement with a tick on it, and nothing downstream should
   be able to tell.
6. **The script is part of the content hash.** `--verify` already re-resolves and compares state and
   event hashes; a schedule that changed must change the hash, or the determinism check silently stops
   covering the thing most likely to be edited.

### 3.4 PERIMETER's actual schedule

| Tick | What arrives | Why |
| --- | --- | --- |
| 0 | Vanguard: 1 raider, 2 runners (pre-placed, Section 2.3) | Something is already on screen when the Pulse starts, so the first Pulse is not thirty seconds of walking |
| 240 | 1 raider, 1 runner, from (3,7) | The lane is used a second time, which teaches that the approach is a *place*, not an event |
| 480 | 2 raiders, from (3,6) | The last wave is the heaviest, and it is the one the player's Build Phase decisions are graded against |

No reaction to the player, at all — Q32's own recommendation, and the belief ramp does not need a
reactive opponent until a mission exists whose lesson *is* reacting.

---

## 4. Definition-of-Done status

| Item | Status |
| --- | --- |
| Unit list confirmed against fixture content | Done — Section 1, plus two findings |
| A real map layout with actual coordinates | Done — Section 2 |
| Trigger-list shape precise enough for Milestone 6 | Done — Section 3 |
| Q29 moved to Answered | Already done before this session (`open-questions.md` Section 5) |
| Q32, Q33 moved to Answered | **Held.** Both are PERIMETER-specific, and Q39 could change whether PERIMETER is the first mission at all. Closing them now would mean closing them twice. Recommended for closure in the same pass that answers Q39 |
| Q38 answered or proceeded-under-recommendation | Proceeded under its recommendation, with the map sized specifically for it — Section 2.1 |
| Mario has looked at the decisions | Outstanding — this pass is what he looks at |
