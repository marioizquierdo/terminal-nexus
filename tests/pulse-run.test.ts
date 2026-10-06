// Starting a Nexus Pulse from a committed Build Phase, the shell's half: the plan becomes the
// kernel's opening state, the *unmodified* kernel resolves it, and Recall is worked out from where it
// ended. What these check is the connection — that every ending the kernel has is reachable from the
// starter map's own data, that the same plan is the same Pulse on every run, and that nothing about how it is
// watched can change it — because the kernel's own rules have their own suite (rules.test.ts and
// determinism.test.ts), not this one.

import { test } from "node:test"
import assert from "node:assert/strict"
import { buildLayout } from "../src/build/layout.ts"
import { BuildSession } from "../src/view/build-session.ts"
import { STARTER_START_CURSOR } from "../src/build/catalog.ts"
import { createBuildState } from "../src/build/state.ts"
import type { PlannedPlacement } from "../src/build/types.ts"
import { missionPlay } from "../src/cli/pulse-run.ts"
import { starterContext } from "../src/cli/starter.ts"
import { inBounds, tilesOf } from "../src/grid/coords.ts"
import { resolvePulse } from "../src/pulse/index.ts"
import { hashState } from "../src/state/serialize.ts"
import type { EntityState } from "../src/state/types.ts"
import { resultOf } from "../src/view/ending.ts"
import { outcomeOf } from "../src/view/pulse-live.ts"
import type { ResolvedPulse } from "../src/view/pulse-live.ts"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import { createView } from "../src/view/snapshot.ts"
import { BARRACKS, DEFENCE, MINIMUM, placeholderContext, play, testMission } from "./pulse-helpers.ts"
import type { Scenario, Spot } from "./pulse-helpers.ts"

const headlineOf = (pulse: ResolvedPulse): string => resultOf(outcomeOf(pulse.timeline)).headline

test("every ending the player can meet is reachable from the starter map's own data", () => {
  // The question is whether the ending reads "regardless of whether they won, lost, or
  // reached the mission's own tick limit". Nothing can be judged that cannot be reached. A defeat is
  // only ever the Nexus falling (Mario, 2026-10-01): a force wiped out with its Nexus standing plays on,
  // so a side wiped out and a draw belong to battles with no Nexus (`grid`'s scenarios), and their words
  // are ending.test.ts's.
  const table: readonly (readonly [string, Scenario, string, string | null, string])[] = [
    // name, scenario, headline, winner, reason
    ["nothing built", {}, "TIME'S UP", null, "tick-limit"],
    ["one Turret", { plan: [DEFENCE[0] as Spot] }, "VICTORY", "A", "annihilation"],
    ["two Turrets and a Hatchery", { plan: DEFENCE }, "VICTORY", "A", "annihilation"],
    ["nobody comes", { raid: "none" }, "TIME'S UP", null, "tick-limit"],
    ["no units of your own, a heavy raid", { crew: "none", raid: "heavy" }, "DEFEAT", "B", "nexus-destroyed"],
    ["a heavy raid, nothing built", { raid: "heavy" }, "DEFEAT", "B", "nexus-destroyed"],
  ]
  for (const [name, scenario, headline, winner, reason] of table) {
    const { pulse } = play(scenario)
    const outcome = outcomeOf(pulse.timeline)
    assert.equal(headlineOf(pulse), headline, `${name}: the headline`)
    assert.equal(outcome.winner, winner, `${name}: the winner`)
    assert.equal(outcome.reason, reason, `${name}: why`)
  }
  // With nothing built the squads still fall, and the Pulse plays on past them to its end.
  const nothing = play().pulse
  const final = nothing.timeline.states.at(-1)
  assert.ok(final !== undefined)
  assert.equal(final.entities.filter((entity) => entity.player === "A" && FIXTURE_REGISTRY.get(entity.contentId).layer === "units").length, 0)
  const lastDeath = nothing.timeline.events.filter((event) => event.kind === "entity.died" && event.player === "A").at(-1)
  assert.ok(lastDeath !== undefined && lastDeath.tick < final.tick, "the Pulse stopped when the squads fell")
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
    pulseTicks: testMission().pulseTicks,
    seed: testMission().seed,
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
  // In the opening state's own order, which is not the order they were planned in.
  assert.deepEqual(
    turrets.map((turret) => turret.anchor),
    [{ x: 23, y: 12 }, { x: 28, y: 12 }],
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
  for (const scenario of [{}, { plan: DEFENCE }, { raid: "none" }] as const) {
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

test("a session with no Pulse to start starts none: committing only freezes the plan, as it did before a Pulse could start", () => {
  const context = starterContext()
  const layout = buildLayout(MINIMUM, context.grid)
  const build = new BuildSession({ context, cursor: STARTER_START_CURSOR, viewport: layout.viewport })
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
    const a = plain.sampleAt(ms, "monochrome")
    const b = dressed.sampleAt(ms, "truecolor", false)
    assert.equal(hashState(a.state), hashState(b.state), `the state at ${ms} ms depends on how it is drawn`)
    assert.deepEqual([...a.positions], [...b.positions], `entity positions at ${ms} ms depend on how it is drawn`)
  }
  // And the kernel's two hashes are the timeline's, not the view's: the same either way.
  assert.equal(timeline.stateHash, hashState(timeline.states[timeline.states.length - 1] as never))
})

test("the first placeholder Pulse, written as a mission, resolves its winning plan the same on every run and runtime", () => {
  // The test mission is the first placeholder Pulse's forces, muster points, seed and length as data
  // (tests/pulse-helpers.ts), resolved by the trigger runner rather than handed to the kernel directly; its winning
  // plan's hashes are pinned under Node and Bun, as the rules play it. That plan predates the build range, which
  // it reaches past, so it is handed to the Pulse as a plan rather than placed through the Build Phase, which
  // would refuse it now: this is about the Pulse, not about where a building may go.
  const mission = missionPlay(testMission())
  const context = mission.firstRound(placeholderContext())
  const opened = createBuildState(context, STARTER_START_CURSOR, buildLayout(MINIMUM, context.grid).viewport)
  const placeholderPlan: readonly PlannedPlacement[] = [
    { ordinal: 1, contentId: "structure.bench.beamturret", anchor: { x: 22, y: 9 } },
    { ordinal: 2, contentId: "structure.bench.beamturret", anchor: { x: 22, y: 12 } },
    { ordinal: 3, contentId: "structure.bench.hatchery", anchor: { x: 20, y: 14 } },
  ]
  const resolved = mission.startPulse(context, { ...opened, nexusPick: 1, planned: placeholderPlan, committed: true })
  assert.ok(resolved !== null)
  const { timeline } = resolved
  assert.ok(timeline.stateHash.startsWith("0e789311"), `state hash ${timeline.stateHash}`)
  assert.ok(timeline.eventsHash.startsWith("54f14400"), `events hash ${timeline.eventsHash}`)
  assert.equal(timeline.states.length - 1, 217)
})
