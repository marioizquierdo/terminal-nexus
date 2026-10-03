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
import { foreseeIntents, recall, resolveMissionPulse, restoreCommanders } from "../src/match/index.ts"
import type { Absence, Arrival, MissionPulseInput, StructurePlacement } from "../src/match/index.ts"
import { fallen } from "../src/match/index.ts"
import { PERIMETER } from "../src/mission/index.ts"
import type { EntityState, MatchState } from "../src/state/types.ts"
import { buildSide, keys } from "./build-helpers.ts"
import type { BuildSide } from "./build-helpers.ts"

const grid = starterGrid()
const registry = FIXTURE_REGISTRY
const TURRET = "structure.bench.beamturret"
const BARRACKS = "structure.citizen.barracks"

const turrets = (...anchors: readonly Coord[]): StructurePlacement[] => anchors.map((anchor) => ({ contentId: TURRET, anchor }))

/** Two plans, a round each: none, and a few Turrets toward the ridge and the flats each round — the second
 *  makes the raid's choice move. */
const PLANS: readonly (readonly (readonly StructurePlacement[])[])[] = [
  [[], [], []],
  [
    turrets({ x: 29, y: 6 }, { x: 33, y: 7 }, { x: 36, y: 12 }),
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
      if (placed) side.build.run([{ kind: "arm", index: 2 }, { kind: "click-tile", x: 29, y: 6 + number }, { kind: "click-tile", x: 29, y: 6 + number }])
      const raid = side.build.raid() ?? []
      const resolved = startPulse(side.build.round, side.build.state)
      assert.ok(resolved !== null)
      const [opening, first] = resolved.timeline.states
      assert.ok(opening !== undefined && first !== undefined)
      for (const group of raid.filter((candidate) => candidate.tick === 0)) {
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

  side.build.run([{ kind: "arm", index: 2 }, { kind: "click-tile", x: 29, y: 6 }, { kind: "click-tile", x: 29, y: 6 }])
  assert.equal(side.build.state.planned.length, 1)
  const turret = side.build.raid()
  assert.equal(firstTarget(turret), `${TURRET}@29,6`, "a Turret on the probe's way did not draw it")
  // The way now ends beside the Turret, round the ridge's west end.
  const way = turret?.[0]?.path ?? []
  const last = way.at(-1)
  assert.ok(last !== undefined && footprintDistance(last, [{ x: 0, y: 0 }], { x: 29, y: 6 }, [{ x: 0, y: 0 }]) <= 1)

  side.build.dispatch({ kind: "undo" })
  assert.equal(side.build.state.planned.length, 0)
  assert.equal(firstTarget(side.build.raid()), `${BARRACKS}@25,10`, "undoing did not move it back")

  side.build.run([{ kind: "arm", index: 2 }, { kind: "click-tile", x: 29, y: 6 }, { kind: "click-tile", x: 29, y: 6 }])
  assert.equal(firstTarget(side.build.raid()), `${TURRET}@29,6`)
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
