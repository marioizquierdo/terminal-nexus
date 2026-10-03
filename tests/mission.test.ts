// A mission as data and the trigger runner that plays it: load-time validation, the simulation
// band on the unmodified kernel, the state carried from one Pulse to the next, and how a mission ends.
// The screen's half — the loop into the next Build Phase — is tests/mission-loop.test.ts.

import { test } from "node:test"
import assert from "node:assert/strict"
import { STARTER_STANDING, starterGrid } from "../src/build/catalog.ts"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import type { DomainEvent } from "../src/events/types.ts"
import { tilesOf } from "../src/grid/coords.ts"
import { missionOpening, recall, resolveMissionPulse } from "../src/match/index.ts"
import type { MissionPulse } from "../src/match/index.ts"
import { MissionError, PERIMETER, validateMission } from "../src/mission/index.ts"
import type { MissionDefinition, TriggerDefinition } from "../src/mission/index.ts"
import { resolvePulse } from "../src/pulse/index.ts"
import { hashState } from "../src/state/serialize.ts"
import type { MatchState } from "../src/state/types.ts"

const grid = starterGrid()
const registry = FIXTURE_REGISTRY
const TURRET = "structure.bench.beamturret"
const HATCHERY = "structure.bench.hatchery"

type Placement = Readonly<{ contentId: string; anchor: Readonly<{ x: number; y: number }> }>

/** The plan a player who defends PERIMETER properly might make: Turrets in front of the base and a
 *  Hatchery behind them, then a Turret more each round. */
const STRONG: readonly (readonly Placement[])[] = [
  [
    { contentId: TURRET, anchor: { x: 24, y: 8 } },
    { contentId: TURRET, anchor: { x: 22, y: 7 } },
    { contentId: HATCHERY, anchor: { x: 21, y: 13 } },
  ],
  [{ contentId: TURRET, anchor: { x: 27, y: 8 } }],
  [{ contentId: TURRET, anchor: { x: 20, y: 8 } }],
]
const NOTHING: readonly (readonly Placement[])[] = [[], [], []]

/** A whole mission, round by round, with Recall between rounds — exactly what the screen does. */
function playMission(mission: MissionDefinition, plans: readonly (readonly Placement[])[]): MissionPulse[] {
  const pulses: MissionPulse[] = []
  let carried: MatchState | null = null
  for (let pulse = 1; pulse <= mission.pulses; pulse += 1) {
    const structures = [...(pulse === 1 ? STARTER_STANDING : []), ...(plans[pulse - 1] ?? [])]
    const run = resolveMissionPulse({ mission, grid, registry, pulse, carried, structures })
    pulses.push(run)
    if (run.verdict.kind !== "continue") break
    carried = recall(run.final, registry).state
  }
  return pulses
}

const problemsOf = (mission: MissionDefinition): readonly string[] => {
  try {
    validateMission(mission, grid, registry)
    return []
  } catch (error) {
    assert.ok(error instanceof MissionError, `not a MissionError: ${String(error)}`)
    return error.problems
  }
}

const withTriggers = (triggers: readonly TriggerDefinition[], extra: Partial<MissionDefinition> = {}): MissionDefinition => ({
  ...PERIMETER,
  ...extra,
  triggers: [...triggers, { id: "end", when: { event: "pulse.end", pulse: extra.pulses ?? PERIMETER.pulses }, do: [{ win: true }] }],
})

// --- Load-time validation ---------------------------------------------------------------------------

test("PERIMETER validates against the map it is played on", () => {
  assert.equal(validateMission(PERIMETER, grid, registry), PERIMETER)
  assert.equal(PERIMETER.pulses, 3, "three Pulses, the raid in three waves")
})

test("validation refuses every broken shape by name, and reports them all at once", () => {
  const spawn = (overrides: Record<string, unknown> = {}) => ({
    spawn: { side: "B" as const, units: [{ unit: "unit.ravel.runner", count: 2 }], at: "ridge", ...overrides },
  })
  const cases: readonly (readonly [string, MissionDefinition, RegExp])[] = [
    ["an unknown region", withTriggers([{ id: "t", when: { pulse: 1, tick: 0 }, do: [spawn({ at: "moon" })] }]), /unknown region "moon"/],
    ["an unknown unit", withTriggers([{ id: "t", when: { pulse: 1, tick: 0 }, do: [spawn({ units: [{ unit: "unit.nope", count: 1 }] })] }]), /unknown content id "unit\.nope"/],
    ["a structure spawned", withTriggers([{ id: "t", when: { pulse: 1, tick: 0 }, do: [spawn({ units: [{ unit: "structure.ravel.den", count: 1 }] })] }]), /a structure — structures arrive by commitPlan/],
    ["a count of zero", withTriggers([{ id: "t", when: { pulse: 1, tick: 0 }, do: [spawn({ units: [{ unit: "unit.ravel.runner", count: 0 }] })] }]), /a count is a positive integer/],
    ["a spawn at an event", withTriggers([{ id: "t", when: { event: "pulse.end", pulse: 1 }, do: [spawn()] }]), /must happen at a moment in a Pulse/],
    ["a tick past the Pulse", withTriggers([{ id: "t", when: { pulse: 1, tick: 360 }, do: [spawn()] }]), /tick 360, but a Pulse runs ticks 0 to 359/],
    ["a Pulse past the mission", withTriggers([{ id: "t", when: { pulse: 4, tick: 0 }, do: [spawn()] }]), /Pulse 4, but the mission has Pulses 1 to 3/],
    ["two triggers with one id", withTriggers([{ id: "t", when: { pulse: 1, tick: 0 }, do: [spawn()] }, { id: "t", when: { pulse: 2, tick: 0 }, do: [spawn()] }]), /trigger "t" is declared twice/],
    ["an order for nobody", withTriggers([{ id: "t", when: { pulse: 1, tick: 5 }, do: [{ order: { group: "ghosts", advance: "nexus" } }] }]), /the group "ghosts", which no earlier trigger spawns/],
    ["an order before the arrival", withTriggers([{ id: "a", when: { pulse: 2, tick: 10 }, do: [spawn({ group: "late" })] }, { id: "b", when: { pulse: 2, tick: 5 }, do: [{ order: { group: "late", advance: "nexus" } }] }]), /orders the group "late" before it arrives/],
    ["an order the kernel cannot carry out", withTriggers([{ id: "t", when: { pulse: 1, tick: 0 }, do: [spawn({ order: { hold: "ridge" } })] }]), /the order "hold", which the kernel cannot carry out yet/],
    ["a plan off tick 0", withTriggers([{ id: "t", when: { pulse: 1, tick: 3 }, do: [{ commitPlan: { side: "B", structures: [{ contentId: "structure.ravel.den", anchor: { x: 46, y: 0 } }] } }] }]), /must be at tick 0 of a Pulse/],
    ["a plan off the map", withTriggers([{ id: "t", when: { pulse: 1, tick: 0 }, do: [{ commitPlan: { side: "B", structures: [{ contentId: "structure.ravel.den", anchor: { x: 95, y: 39 } }] } }] }]), /reaching off the map/],
    ["a win at a moment", withTriggers([{ id: "t", when: { pulse: 1, tick: 10 }, do: [{ win: true }] }]), /must wait for an event/],
    ["a region off the map", { ...PERIMETER, regions: [...PERIMETER.regions, { id: "far", x: 90, y: 38, width: 10, height: 5 }] }, /region "far" reaches off the 96x40 map/],
    ["a last Pulse that decides nothing", { ...PERIMETER, triggers: PERIMETER.triggers.filter((trigger) => trigger.id !== "hold") }, /nothing decides the mission when Pulse 3 ends/],
    ["round text for a round that is not there", { ...PERIMETER, roundText: { 5: "?" } }, /roundText names round 5/],
  ]
  for (const [name, mission, expected] of cases) {
    const problems = problemsOf(mission)
    assert.ok(problems.some((problem) => expected.test(problem)), `${name}: ${JSON.stringify(problems)}`)
  }
  // Every problem at once, not just the first.
  const many = withTriggers([{ id: "t", when: { pulse: 9, tick: 999 }, do: [spawn({ at: "moon", units: [{ unit: "unit.nope", count: 1 }] })] }])
  assert.ok(problemsOf(many).length >= 4, JSON.stringify(problemsOf(many)))
})

// --- The runner on the unmodified kernel -----------------------------------------------------------

test("a whole mission is the same mission every run: the same plans give the same hashes, Pulse by Pulse", () => {
  const hashes = (pulses: readonly MissionPulse[]) => pulses.map((pulse) => [hashState(pulse.final), pulse.events.length, pulse.verdict.kind])
  const first = hashes(playMission(PERIMETER, STRONG))
  for (let run = 0; run < 5; run += 1) assert.deepEqual(hashes(playMission(PERIMETER, STRONG)), first)
  assert.equal(first.length, 3)
})

test("a Pulse with nothing arriving after tick 0 is exactly the kernel's own resolve of its opening state", () => {
  const [round] = playMission(PERIMETER, NOTHING)
  assert.ok(round !== undefined)
  const opening = round.states[0] as MatchState
  const direct = resolvePulse({ initialState: opening, registry, pulseTicks: PERIMETER.pulseTicks, seed: PERIMETER.seed })
  assert.equal(hashState(direct.finalState), hashState(round.final))
  assert.deepEqual(direct.events, round.events)
})

test("a later arrival comes at its tick, with the kernel's own spawn event, and acts from the next tick", () => {
  const pulses = playMission(PERIMETER, STRONG)
  const round3 = pulses[2]
  assert.ok(round3 !== undefined)
  const late = round3.arrivals.filter((arrival) => arrival.tick === 96)
  assert.equal(late.length, 6, "the reserve did not all arrive")
  assert.ok(late.every((arrival) => arrival.trigger === "wave-3-reserve" && arrival.intent === "The reserve, from the east."))
  const spawned = round3.events.filter((event): event is Extract<DomainEvent, { kind: "entity.spawned" }> => event.kind === "entity.spawned" && event.tick === 96)
  assert.deepEqual(spawned.map((event) => event.ordinal), late.map((arrival) => arrival.ordinal))
  // Not there before its tick; there at it, with fresh ordinals past everything that came before.
  const before = round3.states[95] as MatchState
  const at = round3.states[96] as MatchState
  assert.ok(late.every((arrival) => !before.entities.some((entity) => entity.ordinal === arrival.ordinal)))
  assert.ok(late.every((arrival) => at.entities.some((entity) => entity.ordinal === arrival.ordinal)))
  assert.ok(Math.min(...late.map((arrival) => arrival.ordinal)) >= before.nextOrdinal)
  assert.ok(round3.fired.some((fired) => fired.trigger === "wave-3-reserve" && fired.tick === 96))
})

test("an arrival counts for victory: a side that only arrives later can still be wiped out", () => {
  // Nobody of the raid's at tick 0; a single runner arrives at tick 12 beside the player's squads, who
  // kill it — and the kernel ends the Pulse on the raid's annihilation, as if it had stood from the start.
  const mission: MissionDefinition = {
    ...PERIMETER,
    pulses: 1,
    roundText: {},
    regions: [...PERIMETER.regions, { id: "close", x: 27, y: 12, width: 1, height: 1 }],
    triggers: [
      { id: "squads", when: { pulse: 1, tick: 0 }, do: [{ spawn: { side: "A", units: [{ unit: "unit.citizen.trooper", count: 3 }], at: "muster" } }] },
      { id: "lone", when: { pulse: 1, tick: 12 }, do: [{ spawn: { side: "B", units: [{ unit: "unit.ravel.runner", count: 1 }], at: "close" } }] },
      { id: "end", when: { event: "pulse.end" }, do: [{ win: true }] },
    ],
  }
  validateMission(mission, grid, registry)
  const [round] = playMission(mission, NOTHING)
  assert.ok(round !== undefined)
  assert.equal(round.final.outcome?.reason, "annihilation")
  assert.equal(round.final.outcome?.winner, "A")
  assert.ok((round.final.outcome?.tick ?? 999) < PERIMETER.pulseTicks)
})

test("the raid's own plan reveals at its Pulse's start: the den stands in round 3", () => {
  const round3 = playMission(PERIMETER, STRONG)[2]
  assert.ok(round3 !== undefined)
  const den = (round3.states[0] as MatchState).entities.find((entity) => entity.contentId === "structure.ravel.den")
  assert.ok(den !== undefined && den.player === "B")
  assert.deepEqual(den.anchor, { x: 46, y: 0 })
})

// --- What carries from one Pulse to the next ------------------------------------------------------

test("a survivor is the same unit next round: its id, its ordinal and its health carry over", () => {
  const [round1, round2] = playMission(PERIMETER, STRONG)
  assert.ok(round1 !== undefined && round2 !== undefined)
  const recalled = recall(round1.final, registry).state
  const opening2 = round2.states[0] as MatchState
  for (const survivor of recalled.entities) {
    const again = opening2.entities.find((entity) => entity.ordinal === survivor.ordinal)
    assert.ok(again !== undefined, `${survivor.id} did not carry over`)
    assert.equal(again.id, survivor.id)
    assert.equal(again.hp, survivor.hp, `${survivor.id} came back with different health`)
  }
  // The wave that arrives is new: ordinals past everything round 1 used.
  assert.ok(round2.arrivals.every((arrival) => arrival.ordinal >= round1.final.nextOrdinal))
})

test("what the raid destroyed stays destroyed", () => {
  const pulses = playMission(PERIMETER, NOTHING)
  const lost = pulses.find((pulse) => pulse.events.some((event) => event.kind === "structure.destroyed"))
  assert.ok(lost !== undefined, "nothing was destroyed with nothing built")
  const next = pulses[pulses.indexOf(lost) + 1]
  const destroyed = lost.events.filter((event): event is Extract<DomainEvent, { kind: "structure.destroyed" }> => event.kind === "structure.destroyed")
  if (next !== undefined) {
    for (const event of destroyed) assert.ok(!(next.states[0] as MatchState).entities.some((entity) => entity.id === event.entity))
  }
})

test("a building planned where a survivor stands moves the survivor aside, and nobody shares a tile", () => {
  const [round1] = playMission(PERIMETER, STRONG)
  assert.ok(round1 !== undefined)
  const carried = recall(round1.final, registry).state
  const survivor = carried.entities.find((entity) => entity.player === "A" && registry.get(entity.contentId).layer === "units")
  assert.ok(survivor !== undefined, "no survivor to build on")
  const opening = missionOpening({ mission: PERIMETER, grid, registry, pulse: 2, carried, structures: [{ contentId: TURRET, anchor: survivor.anchor }] }).state
  const moved = opening.entities.find((entity) => entity.ordinal === survivor.ordinal)
  assert.ok(moved !== undefined)
  assert.notDeepEqual(moved.anchor, survivor.anchor, "the survivor stayed under the Turret")
  const seen = new Set<string>()
  for (const entity of opening.entities) {
    for (const tile of tilesOf(entity.anchor, registry.get(entity.contentId).footprint)) {
      const key = `${tile.x},${tile.y}`
      assert.ok(!seen.has(key), `${key} is held twice`)
      seen.add(key)
    }
  }
})

// --- How a mission ends ---------------------------------------------------------------------------

test("PERIMETER is won by holding and lost when the Nexus falls; a round the player's force fell in plays on, and is not a lost mission", () => {
  const strong = playMission(PERIMETER, STRONG)
  assert.equal(strong.length, 3)
  assert.deepEqual(strong.map((pulse) => pulse.verdict), [{ kind: "continue" }, { kind: "continue" }, { kind: "won", trigger: "hold" }])

  const nothing = playMission(PERIMETER, NOTHING)
  assert.deepEqual(nothing.at(-1)?.verdict, { kind: "lost", trigger: "fallen" })
  assert.equal(nothing.at(-1)?.final.outcome?.reason, "nexus-destroyed")

  // A single trooper for squads: it falls in round 1, the Nexus stands, and the round runs to its time
  // rather than stopping there (Mario, 2026-10-01: only the Nexus falling loses) — and the mission goes on.
  // Without the intro, too: its lines are Vasse's, and she is not in this squad.
  const thin: MissionDefinition = {
    ...PERIMETER,
    triggers: PERIMETER.triggers
      .filter((trigger) => trigger.id !== "intro")
      .map((trigger) =>
        trigger.id !== "squads" ? trigger : { ...trigger, do: [{ spawn: { side: "A", units: [{ unit: "unit.citizen.trooper", count: 1 }], at: "muster" } }] },
      ),
  }
  validateMission(thin, grid, registry)
  const [round1] = playMission(thin, NOTHING)
  assert.ok(round1 !== undefined)
  assert.ok(round1.events.some((event) => event.kind === "entity.died" && event.player === "A"), "the trooper never fell")
  assert.equal(round1.final.entities.filter((entity) => entity.player === "A" && registry.get(entity.contentId).layer === "units").length, 0)
  assert.equal(round1.final.outcome?.reason, "tick-limit")
  assert.equal(round1.verdict.kind, "continue")
})

test("at a Pulse's end the triggers are read in list order: the first win or lose decides", () => {
  const both = (order: "lose-first" | "win-first"): MissionDefinition => {
    const lose: TriggerDefinition = { id: "lose", when: { event: "pulse.end", pulse: 1 }, do: [{ lose: true }] }
    const win: TriggerDefinition = { id: "win", when: { event: "pulse.end", pulse: 1 }, do: [{ win: true }] }
    return { ...PERIMETER, pulses: 1, roundText: {}, triggers: [PERIMETER.triggers[0] as TriggerDefinition, ...(order === "lose-first" ? [lose, win] : [win, lose])] }
  }
  assert.deepEqual(playMission(both("lose-first"), NOTHING)[0]?.verdict, { kind: "lost", trigger: "lose" })
  assert.deepEqual(playMission(both("win-first"), NOTHING)[0]?.verdict, { kind: "won", trigger: "win" })
})
