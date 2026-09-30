// Starting a Nexus Pulse from a committed Build Phase — gate 6A, the shell's half: the plan becomes the
// kernel's opening state, the *unmodified* kernel resolves it, and Recall is worked out from where it
// ended. What these check is the connection — that every ending the kernel has is reachable from the
// spike's own data, that the same plan is the same Pulse on every run, and that nothing about how it is
// watched can change it — because the kernel's own rules are Milestone 1's suite, not this gate's.

import { test } from "node:test"
import assert from "node:assert/strict"
import { buildLayout } from "../src/build/layout.ts"
import { BuildSession } from "../src/build/session.ts"
import { SPIKE_PULSE_SEED, SPIKE_PULSE_TICKS, SPIKE_START_CURSOR, spikePulse } from "../src/build/catalog.ts"
import { startPulse } from "../src/cli/pulse-run.ts"
import { spikeContext } from "../src/cli/spike.ts"
import { inBounds, tilesOf } from "../src/grid/coords.ts"
import { openingState } from "../src/match/index.ts"
import { resolvePulse } from "../src/pulse/index.ts"
import { hashState } from "../src/state/serialize.ts"
import type { EntityState } from "../src/state/types.ts"
import { resultOf } from "../src/view/ending.ts"
import { outcomeOf } from "../src/view/pulse-live.ts"
import type { ResolvedPulse } from "../src/view/pulse-live.ts"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import { createView } from "../src/view/snapshot.ts"
import { BARRACKS, DEFENCE, HATCHERY, MINIMUM, TURRET, play } from "./pulse-helpers.ts"
import type { Scenario, Spot } from "./pulse-helpers.ts"

const headlineOf = (pulse: ResolvedPulse): string => resultOf(outcomeOf(pulse.timeline)).headline

test("every ending the kernel has is reachable from the spike's own data", () => {
  // The milestone's question is whether the ending reads "regardless of whether they won, lost, or
  // reached the mission's own tick limit". Nothing can be judged that cannot be reached.
  const table: readonly (readonly [string, Scenario, string, string | null, string])[] = [
    // name, scenario, headline, winner, reason
    ["nothing built", {}, "DEFEAT", "B", "annihilation"],
    ["one Turret", { plan: [DEFENCE[0] as Spot] }, "DRAW", null, "annihilation"],
    ["two Turrets and a Hatchery", { plan: DEFENCE }, "VICTORY", "A", "annihilation"],
    ["nobody comes", { raid: 1 }, "TIME'S UP", null, "tick-limit"],
    ["no units of your own", { crew: 1 }, "DEFEAT", "B", "nexus-destroyed"],
    ["a heavy raid, nothing built", { raid: 2 }, "DEFEAT", "B", "annihilation"],
  ]
  for (const [name, scenario, headline, winner, reason] of table) {
    const { pulse } = play(scenario)
    const outcome = outcomeOf(pulse.timeline)
    assert.equal(headlineOf(pulse), headline, `${name}: the headline`)
    assert.equal(outcome.winner, winner, `${name}: the winner`)
    assert.equal(outcome.reason, reason, `${name}: why`)
  }
})

test("the same plan is the same Pulse: hashes stable across runs, and identical to the kernel run directly", () => {
  const first = play({ plan: DEFENCE }).pulse
  for (let run = 0; run < 5; run += 1) {
    const again = play({ plan: DEFENCE }).pulse
    assert.equal(again.timeline.stateHash, first.timeline.stateHash, "state hash drifted")
    assert.equal(again.timeline.eventsHash, first.timeline.eventsHash, "event hash drifted")
    assert.equal(hashState(again.recall.state), hashState(first.recall.state), "Recall drifted")
  }
  // The shell adds nothing to the kernel's own answer: resolving the same opening state with
  // `resolvePulse` gives the same two hashes.
  const opening = first.timeline.states[0]
  assert.ok(opening !== undefined)
  const direct = resolvePulse({
    initialState: opening,
    registry: FIXTURE_REGISTRY,
    pulseTicks: SPIKE_PULSE_TICKS,
    seed: SPIKE_PULSE_SEED,
  })
  assert.equal(direct.stateHash, first.timeline.stateHash)
  assert.equal(direct.eventsHash, first.timeline.eventsHash)
})

test("what the player built is what the Pulse resolves: a different plan is a different Pulse", () => {
  const nothing = play().pulse
  const defended = play({ plan: DEFENCE }).pulse
  assert.notEqual(defended.timeline.stateHash, nothing.timeline.stateHash)
  const opening = defended.timeline.states[0]
  assert.ok(opening !== undefined)
  const turrets = opening.entities.filter((entity) => entity.contentId === "structure.bench.beamturret")
  assert.deepEqual(
    turrets.map((turret) => turret.anchor),
    [{ x: 22, y: 9 }, { x: 22, y: 12 }],
    "the planned Turrets are not where they were placed",
  )
  assert.ok(opening.entities.some((entity) => entity.contentId === "structure.bench.hatchery"))
  // What already stood is still there, and the raid is on the far side of the map from the Nexus.
  assert.ok(opening.entities.some((entity) => entity.contentId === "structure.citizen.nexus" && entity.player === "A"))
  const raiders = opening.entities.filter((entity) => entity.player === "B")
  assert.equal(raiders.length, 7)
  assert.ok(raiders.every((entity) => entity.anchor.x > 38), "the raid does not start at the far edge")
})

test("the timeline runs to the outcome and no further; Recall hands the next Build Phase a clean, legal state", () => {
  for (const scenario of [{}, { plan: DEFENCE }, { raid: 1 }] as const) {
    const { timeline, recall } = play(scenario).pulse
    const last = timeline.states[timeline.states.length - 1] as NonNullable<(typeof timeline.states)[number]>
    assert.ok(last.outcome !== null, "the timeline stopped without an outcome")
    assert.equal(timeline.states.length - 1, last.outcome.tick, "the timeline ran past its own ending")
    assert.equal(recall.state.tick, 0)
    assert.equal(recall.state.outcome, null)
    // Nobody is on top of anybody, and nothing left the Grid.
    const keys = new Set<string>()
    for (const entity of recall.state.entities) {
      for (const tile of tilesOf(entity.anchor, FIXTURE_REGISTRY.get(entity.contentId).footprint)) {
        assert.ok(inBounds(timeline.grid, tile))
        const key = `${tile.x},${tile.y}`
        assert.ok(!keys.has(key), `${key} is covered twice after Recall`)
        keys.add(key)
      }
    }
    // The survivors are exactly the mobile units alive when the Pulse ended.
    const mobile = (entity: EntityState): boolean => FIXTURE_REGISTRY.get(entity.contentId).layer !== "obstacles"
    assert.deepEqual(
      recall.moves.map((move) => move.ordinal),
      last.entities.filter(mobile).map((entity) => entity.ordinal),
    )
  }
})

test("a building committed on top of the muster points does not stop the Pulse: the units make room", () => {
  const { pulse } = play({ plan: [[BARRACKS, 22, 10]] })
  assert.ok(pulse.timeline.states.length > 1)
  const opening = pulse.timeline.states[0]
  assert.ok(opening !== undefined)
  assert.equal(opening.entities.filter((entity) => entity.player === "A" && entity.contentId.startsWith("unit.")).length, 5)
})

test("a context with no Pulse starts none: committing only freezes the plan, as before gate 6A", () => {
  const context = { ...spikeContext() }
  delete (context as { pulse?: unknown }).pulse
  const layout = buildLayout(MINIMUM, context.grid)
  const build = new BuildSession({ context, cursor: SPIKE_START_CURSOR, viewport: layout.viewport, startPulse })
  build.run([{ kind: "pick-nexus", index: 0 }, { kind: "open-battle-round" }, { kind: "start-pulse" }])
  assert.equal(build.state.committed, true)
  assert.equal(build.pulse, null)
})

test("how it is watched cannot change what happened: effects, the cosmetic seed and reduced motion move no state", () => {
  const { timeline } = play({ plan: DEFENCE }).pulse
  const plain = createView(timeline, { effects: false, reducedMotion: true, cosmeticSeed: 1, glyphPack: "ascii" })
  const dressed = createView(timeline, { effects: true, reducedMotion: false, cosmeticSeed: 0xfeed, glyphPack: "unicode" })
  assert.equal(dressed.effectCount > 0, true, "the dressed view drew nothing")
  for (let ms = 0; ms <= plain.durationMs; ms += 397) {
    const a = plain.sampleAt(ms, "monochrome", 1)
    const b = dressed.sampleAt(ms, "truecolor", 2, false)
    assert.equal(hashState(a.state), hashState(b.state), `the state at ${ms} ms depends on how it is drawn`)
    assert.deepEqual([...a.positions], [...b.positions], `entity positions at ${ms} ms depend on how it is drawn`)
  }
  // And the kernel's two hashes are the timeline's, not the view's: the same either way.
  assert.equal(timeline.stateHash, hashState(timeline.states[timeline.states.length - 1] as never))
})

test("the raid and the crew are the Experiments' to size, and the spike's Pulse is data", () => {
  const some = spikePulse({ raid: "probe", crew: "some" })
  assert.equal(some.seed, SPIKE_PULSE_SEED)
  assert.equal(some.pulseTicks, SPIKE_PULSE_TICKS)
  assert.deepEqual(some.forces.map((force) => force.player), ["A", "B"])
  assert.deepEqual(spikePulse({ raid: "none", crew: "some" }).forces.map((force) => force.player), ["A"])
  assert.deepEqual(spikePulse({ raid: "probe", crew: "none" }).forces.map((force) => force.player), ["B"])
  assert.ok(
    spikePulse({ raid: "heavy", crew: "some" }).forces[1]!.units.length > some.forces[1]!.units.length,
    "a heavy raid is not bigger than the probe",
  )
  // The opening state a setup builds is the one `startPulse` resolves from.
  const context = spikeContext()
  const opening = openingState({
    grid: context.grid,
    registry: context.registry,
    structures: context.standing,
    setup: some,
  })
  assert.equal(opening.entities.length, context.standing.length + 5 + 7)
})
