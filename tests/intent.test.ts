// The raid's intent (`src/match/intent.ts`): what each group a round brings goes for first is the kernel's
// own choice on the round's first tick, worked out on the plan as it stands — held here against the real
// Pulse in every round of PERIMETER, with and without a plan, at the match layer and through the shell's
// `foresee` — and the way it would go walks the kernel's own steps, round the ridge rather than through it.
// What a player sees of it is tests/raid-view.test.ts.

import { test } from "node:test"
import assert from "node:assert/strict"
import { STARTER_STANDING, STARTER_START_CURSOR, starterGrid } from "../src/build/catalog.ts"
import type { RaidForecast } from "../src/build/types.ts"
import { foresee, nextRound, startPulse } from "../src/cli/pulse-run.ts"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import { footprintDistance } from "../src/grid/coords.ts"
import type { Coord } from "../src/grid/types.ts"
import { foreseeIntents, foreseeRound, recall, resolveMissionPulse, restoreCommanders, spawningRegistry } from "../src/match/index.ts"
import type { Absence, Arrival, MissionPulseInput, StructurePlacement } from "../src/match/index.ts"
import { fallen } from "../src/match/index.ts"
import { PERIMETER } from "../src/armies/index.ts"
import type { EntityState, MatchState } from "../src/state/types.ts"
import { ENTER, buildSide, keys } from "./build-helpers.ts"
import { isTroops } from "../src/view/troops-post.ts"
import type { BuildSide } from "./build-helpers.ts"

const grid = starterGrid()
const registry = FIXTURE_REGISTRY
const TURRET = "structure.bench.beamturret"
const BARRACKS = "structure.citizen.barracks"

const turrets = (...anchors: readonly Coord[]): StructurePlacement[] => anchors.map((anchor) => ({ contentId: TURRET, anchor }))

/** Two plans, a round each: none, and a few Turrets toward the ridge and the flats each round — the second
 *  makes the raid's choice move, and its first round stands a Turret just beyond the ridge, straight below its
 *  north face, where the probe's way presses on the rock. */
const PLANS: readonly (readonly (readonly StructurePlacement[])[])[] = [
  [[], [], []],
  [
    turrets({ x: 29, y: 6 }, { x: 32, y: 5 }, { x: 36, y: 12 }),
    turrets({ x: 31, y: 8 }, { x: 35, y: 9 }, { x: 38, y: 13 }),
    turrets({ x: 27, y: 7 }, { x: 40, y: 8 }, { x: 44, y: 12 }),
  ],
]

/** The target most of `units` chose in `state` — on a tie, the first unit's among the tied, units in
 *  ordinal order — read straight off the kernel's state. */
function majority(state: MatchState, units: readonly number[]): number | null {
  const votes = new Map<number, number>()
  const order: number[] = []
  for (const ordinal of [...units].sort((a, b) => a - b)) {
    const target = state.entities.find((entity) => entity.ordinal === ordinal)?.targetOrdinal ?? null
    if (target === null) continue
    votes.set(target, (votes.get(target) ?? 0) + 1)
    order.push(target)
  }
  const most = Math.max(0, ...votes.values())
  return order.find((target) => votes.get(target) === most) ?? null
}

/** PERIMETER's three rounds, each started from what the last left (Recall, and a fallen Commander's
 *  return), each with its own of `plan` built that round. */
function rounds(plan: readonly (readonly StructurePlacement[])[]): MissionPulseInput[] {
  const inputs: MissionPulseInput[] = []
  let carried: MatchState | null = null
  let absent: Absence[] = []
  for (let pulse = 1; pulse <= PERIMETER.pulses; pulse += 1) {
    if (carried !== null) {
      const back = restoreCommanders(carried, absent, pulse, registry)
      carried = back.state
      absent = back.absent
    }
    // What earlier rounds built stands in the carried state; the round's own plan is new.
    const own = plan[pulse - 1] ?? []
    const structures = pulse === 1 ? [...STARTER_STANDING, ...own] : own
    const input: MissionPulseInput = { mission: PERIMETER, grid, registry, pulse, carried, structures }
    inputs.push(input)
    const run = resolveMissionPulse(input)
    if (run.verdict.kind !== "continue") break
    absent = [...absent, ...fallen(run.events, registry, pulse)]
    carried = recall(run.final, registry).state
  }
  return inputs
}

test("what each group goes for first is the kernel's own choice on the real Pulse's first tick, in every round, with and without a plan", () => {
  let compared = 0
  for (const plan of PLANS) {
    for (const input of rounds(plan)) {
      const groups = foreseeIntents(input)
      const run = resolveMissionPulse(input)
      const first = run.states[1]
      assert.ok(first !== undefined)
      // The groups that arrive as the round starts: their units are in the real Pulse from tick 0.
      const arrived = run.arrivals.filter((arrival) => arrival.player === "B" && arrival.tick === 0)
      const byGroup = new Map<string, Arrival[]>()
      for (const arrival of arrived) byGroup.set(arrival.group ?? arrival.trigger, [...(byGroup.get(arrival.group ?? arrival.trigger) ?? []), arrival])
      assert.ok(byGroup.size > 0, `round ${input.pulse} brings no group as it starts`)
      for (const [name, units] of byGroup) {
        const foreseen = groups.find((group) => group.group === name)
        assert.ok(foreseen !== undefined, `round ${input.pulse}: ${name} was not foreseen`)
        assert.equal(foreseen.tick, 0)
        const chosen = majority(first, units.map((unit) => unit.ordinal))
        assert.ok(chosen !== null, `round ${input.pulse}: ${name} chose nothing on the first tick`)
        assert.equal(foreseen.target?.ordinal, chosen, `round ${input.pulse}, ${input.structures.length} built: ${name}`)
        const counted = new Map<string, number>()
        for (const unit of units) counted.set(unit.contentId, (counted.get(unit.contentId) ?? 0) + 1)
        assert.deepEqual(new Map(foreseen.units.map((entry) => [entry.contentId, entry.count])), counted, `${name}'s numbers`)
        compared += 1
      }
      // A group that arrives later is foreseen too, against the opening positions, with a target.
      for (const group of groups.filter((candidate) => candidate.tick > 0)) assert.ok(group.target !== null, `${group.group} goes for nothing`)
    }
  }
  assert.ok(compared >= 6, `only ${compared} groups were compared`)
})

test("the shell's foresee is what the round's real Pulse does on its first tick, read off the screen's own round", () => {
  // The Build Phase's own way in: the session's round, the plan placed by the player, the shell's
  // `foresee` and `startPulse` (which runs on the mission's content, its Barracks training).
  const side = buildSide({ cursor: STARTER_START_CURSOR, startPulse, nextRound, foresee })
  for (let number = 1; number <= 3; number += 1) {
    for (const placed of [false, true]) {
      // A Turret east of the Barracks, inside its build range and a tile clear of the room it keeps, a row
      // further south each round.
      if (placed) {
        const planned = side.build.state.planned.length
        side.build.run([{ kind: "arm", index: 2 }, { kind: "click-tile", x: 29, y: 8 + number }, { kind: "click-tile", x: 29, y: 8 + number }])
        assert.equal(side.build.state.planned.length, planned + 1, `round ${number}: the Turret was not placed`)
      }
      const raid = side.build.raid() ?? []
      const resolved = startPulse(side.build.round, side.build.state)
      assert.ok(resolved !== null)
      const [opening, first] = resolved.timeline.states
      assert.ok(opening !== undefined && first !== undefined)
      // The raid's groups: the forecast's last group is the player's own troops, which go for no one first.
      for (const group of raid.filter((candidate) => candidate.player === "B" && candidate.tick === 0)) {
        // Its units, found where the group stands as the round opens.
        const tiles = new Set(group.tiles.map((tile) => `${tile.x},${tile.y}`))
        const units = opening.entities.filter((entity) => entity.player === "B" && tiles.has(`${entity.anchor.x},${entity.anchor.y}`))
        assert.ok(units.length > 0)
        const ordinal = majority(first, units.map((unit) => unit.ordinal))
        const chosen: EntityState | undefined = opening.entities.find((entity) => entity.ordinal === ordinal)
        assert.ok(chosen !== undefined && group.target !== null)
        assert.deepEqual(
          { contentId: group.target.contentId, anchor: group.target.anchor },
          { contentId: chosen.contentId, anchor: chosen.anchor },
          `round ${number}${placed ? " with a Turret" : ""}: ${group.group}`,
        )
      }
    }
    if (number === 3) break
    side.build.dispatch({ kind: "pick-nexus", index: 0 })
    side.build.run([{ kind: "open-battle-round" }, { kind: "start-pulse" }])
    const pulse = side.build.pulse
    assert.ok(pulse !== null)
    side.build.advance(0)
    side.build.advance(pulse.times.homeMs + 100)
    keys(side, "\r")
    assert.equal(side.build.state.pulseNumber, number + 1)
  }
})

/** The first group's target as `contentId@x,y`. */
const firstTarget = (raid: RaidForecast | undefined): string => {
  const target = raid?.[0]?.target
  return target == null ? "nothing" : `${target.contentId}@${target.anchor.x},${target.anchor.y}`
}

test("placing a building nearer the raid moves what it goes for to it; undoing, or removing it, moves it back", () => {
  const side: BuildSide = buildSide({ cursor: STARTER_START_CURSOR, startPulse, nextRound, foresee })
  const before = side.build.raid()
  assert.equal(firstTarget(before), `${BARRACKS}@25,10`, "PERIMETER's probe goes for the Barracks with nothing built")
  // Asked again with nothing changed, it is the same answer, not worked out again.
  assert.equal(side.build.raid(), before)

  side.build.run([{ kind: "arm", index: 2 }, { kind: "click-tile", x: 28, y: 8 }, { kind: "click-tile", x: 28, y: 8 }])
  assert.equal(side.build.state.planned.length, 1)
  const turret = side.build.raid()
  assert.equal(firstTarget(turret), `${TURRET}@28,8`, "a Turret on the probe's way did not draw it")
  // The way now ends beside the Turret.
  const way = turret?.[0]?.path ?? []
  const last = way.at(-1)
  assert.ok(last !== undefined && footprintDistance(last, [{ x: 0, y: 0 }], { x: 28, y: 8 }, [{ x: 0, y: 0 }]) <= 1)

  side.build.dispatch({ kind: "undo" })
  assert.equal(side.build.state.planned.length, 0)
  assert.equal(firstTarget(side.build.raid()), `${BARRACKS}@25,10`, "undoing did not move it back")

  side.build.run([{ kind: "arm", index: 2 }, { kind: "click-tile", x: 28, y: 8 }, { kind: "click-tile", x: 28, y: 8 }])
  assert.equal(firstTarget(side.build.raid()), `${TURRET}@28,8`)
  side.build.run([{ kind: "focus", target: "grid" }, { kind: "remove" }])
  assert.equal(side.build.state.planned.length, 0)
  assert.equal(firstTarget(side.build.raid()), `${BARRACKS}@25,10`, "removing did not move it back")
})

/** Whether a tile is rock on the starter map. */
const rock = (tile: Coord): boolean => grid.tiles[tile.y * grid.width + tile.x] === "terrain.rock"

test("the way each group would go is the kernel's own steps: one tile at a time, never through rock, ending next to what it goes for or pressed against rock", () => {
  let pressed = 0
  for (const plan of PLANS) {
    for (const input of rounds(plan)) {
      for (const group of foreseeIntents(input)) {
        assert.ok(group.target !== null)
        assert.ok(group.path.length > 0, `${group.group} has no way`)
        let previous: Coord | undefined
        for (const step of group.path) {
          assert.ok(!rock(step), `${group.group} walks through rock at ${step.x},${step.y}`)
          if (previous !== undefined) assert.equal(Math.abs(step.x - previous.x) + Math.abs(step.y - previous.y), 1, `${group.group} jumps`)
          previous = step
        }
        // Next to it — or where the step rule leaves it no closer step: the kernel's greedy steps stop on
        // a ridge's face when what they go for is straight beyond it, and the way says so.
        const end = group.path.at(-1) as Coord
        const nearest = [...group.target.tiles].sort((a, b) => Math.abs(a.x - end.x) + Math.abs(a.y - end.y) - (Math.abs(b.x - end.x) + Math.abs(b.y - end.y)))[0] as Coord
        const near = Math.abs(nearest.x - end.x) + Math.abs(nearest.y - end.y)
        if (near === 1) continue
        const toward = Math.abs(nearest.x - end.x) >= Math.abs(nearest.y - end.y) ? { x: end.x + Math.sign(nearest.x - end.x), y: end.y } : { x: end.x, y: end.y + Math.sign(nearest.y - end.y) }
        assert.ok(rock(toward), `${group.group}'s way ends ${near} tiles from what it goes for, with nothing in its way`)
        pressed += 1
      }
    }
  }
  // The Turret just beyond the ridge is such a dead end: the probe presses on the ridge's north face.
  assert.ok(pressed > 0)
})

test("the forecast says where the player's troops head as each round starts — the line, by its name — and who goes, off the round's own opening", () => {
  const line = Array.from({ length: 10 }, (_, index) => ({ x: 22 + (index % 5), y: 7 + Math.floor(index / 5) }))
  let rounds_ = 0
  for (const plan of PLANS) {
    for (const input of rounds(plan)) {
      const { groups, troops } = foreseeRound(input)
      assert.deepEqual(groups, foreseeIntents(input), "the raid's groups are foreseen once, the same either way")
      assert.ok(troops !== null, `round ${input.pulse}: no troops foreseen`)
      assert.deepEqual([troops.player, troops.region, troops.name], ["A", "line", "the line"])
      assert.deepEqual(troops.tiles, line)
      // Who goes: every unit of the player's that moves and fights, standing on the Grid as the round opens.
      const opening = resolveMissionPulse(input).states[0] as MatchState
      const own = opening.entities.filter((entity) => entity.player === "A" && registry.get(entity.contentId).behavior === "advance" && registry.get(entity.contentId).layer !== "obstacles")
      assert.equal(troops.units.reduce((sum, entry) => sum + entry.count, 0), own.length, `round ${input.pulse}: the count`)
      assert.equal(troops.unitTiles.length, own.length)
      rounds_ += 1
    }
  }
  assert.ok(rounds_ >= 5)
  // A level that names no target for them foresees none.
  const [input] = rounds(PLANS[0] ?? [])
  assert.ok(input !== undefined)
  const none = { ...PERIMETER, triggers: PERIMETER.triggers.filter((trigger) => trigger.id !== "post") }
  assert.equal(foreseeRound({ ...input, mission: none }).troops, null)
})

test("the shell's forecast carries the player's troops after the raid's groups: going for no one, with the line they head for", () => {
  const side = buildSide({ cursor: STARTER_START_CURSOR, startPulse, nextRound, foresee })
  const raid = side.build.raid() ?? []
  const troops = raid.at(-1)
  assert.ok(troops !== undefined && isTroops(troops), "the forecast's last group is not the player's troops")
  assert.deepEqual([troops.player, troops.group, troops.target, troops.path.length, troops.post.name, troops.post.tiles.length], ["A", "your troops", null, 0, "the line", 10])
  // Round 1's squads — Vasse and the two squads that walk out of the annex — and the four troopers the Barracks
  // on the map sends five seconds in, who head for the line as soon as they are out: seven troopers in all.
  assert.deepEqual(
    new Map(troops.units.map((entry) => [entry.contentId, entry.count])),
    new Map([["unit.citizen.vasse", 1], ["unit.citizen.trooper", 7], ["unit.citizen.marksman", 2]]),
  )
  // Where they stand as the round starts is the squads' alone: a wave stands nowhere until it comes.
  assert.equal(troops.tiles.length, 6)
  // A Barracks planned this round sends its wave too, and the count says so.
  keys(side, "1", ENTER)
  assert.equal(side.build.state.planned.length, 1, "the Barracks was not planned")
  const more = (side.build.raid() ?? []).find(isTroops)
  assert.equal(more?.units.find((entry) => entry.contentId === "unit.citizen.trooper")?.count, 11)
  assert.ok(raid.slice(0, -1).every((group) => group.player === "B" && !isTroops(group)))
})

test("the troops foreseen count every wave a building has time to send in the round, and no more", () => {
  const [input] = rounds(PLANS[0] ?? [])
  assert.ok(input !== undefined)
  const troopers = (registry: MissionPulseInput["registry"]): number | undefined =>
    foreseeRound({ ...input, registry }).troops?.units.find((entry) => entry.contentId === "unit.citizen.trooper")?.count
  // On content that spawns nothing, the squads' three alone.
  assert.equal(troopers(registry), 3)
  // Four waves of four, ten seconds apart from five seconds in: three come inside a thirty-second round, and the
  // fourth would come at thirty-five.
  const fourWaves = spawningRegistry(registry, { [BARRACKS]: { unit: "unit.citizen.trooper", perWave: 4, waves: 4, secondsBetween: 10 } }, 60)
  assert.equal(PERIMETER.pulseTicks, 360)
  assert.equal(troopers(fourWaves), 3 + 3 * 4)
})

test("foreseeing is pure: the same round and plan give the same answer, and nothing handed in changes", () => {
  const [input] = rounds(PLANS[1] ?? [])
  assert.ok(input !== undefined)
  const frozen = JSON.stringify(input)
  const once = foreseeIntents(input)
  assert.deepEqual(foreseeIntents(input), once)
  assert.equal(JSON.stringify(input), frozen)
  // Only the raid's groups: the player's own squads arrive as the round starts too, and are not foreseen.
  assert.ok(once.every((group) => group.player === "B"))
  const squads: readonly EntityState[] = resolveMissionPulse(input).states[0]?.entities.filter((entity) => entity.player === "A") ?? []
  assert.ok(squads.length > 0)
})
