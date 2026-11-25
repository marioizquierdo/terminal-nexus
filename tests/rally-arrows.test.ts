// The rally arrows (the owner's playtest, 2026-11-25, docs/history/feedback/2026-11-25-rally-point.md): during a Battle
// Round a few arrows run from the player's Nexus to its rally point every `rallyArrowsEveryMs`, until the rally point is
// released; the enemy's runs once as the battle begins, with its flag. `src/view/rally-arrows.ts`, drawn by
// `drawRallyMarks` (`src/view/pulse-scene.ts`).

import { test } from "node:test"
import assert from "node:assert/strict"
import type { BattleState, BuildActions } from "../src/battle/index.ts"
import { beginBattle, playRound } from "../src/battle/index.ts"
import { TUNING } from "../src/build/tuning.ts"
import { timelineOf } from "../src/cli/timeline.ts"
import type { ContentRegistry } from "../src/content/index.ts"
import type { DomainEvent } from "../src/engine/events/types.ts"
import { tileDistance, tileIndex } from "../src/engine/geometry/coords.ts"
import { hashState } from "../src/engine/state/serialize.ts"
import type { MatchState } from "../src/engine/state/types.ts"
import { PulsePresenter } from "../src/view/pulse-live.ts"
import type { PulseFrame } from "../src/view/pulse-scene.ts"
import { drawRallyMarks } from "../src/view/pulse-scene.ts"
import type { RallyMark } from "../src/view/rally-arrows.ts"
import { ENEMY_FLAG_MS, rallyMarksAt, rallyPlan, rallyRoute } from "../src/view/rally-arrows.ts"
import type { PulseTimeline } from "../src/view/snapshot.ts"
import type { BandCell } from "../src/view/frame.ts"
import { BANDS } from "../src/view/frame.ts"
import { battleRoundScreen } from "./battle-round-frame.ts"

/** The Crossing's top flank, far off the march line. */
const FLANK = { x: 25, y: 3 }

type Round = Readonly<{ timeline: PulseTimeline; released: number | null }>

const ROUNDS = new Map<string, Round>()

/** Round 1 on the Crossing, Vasse against Vasse: side A builds two Barracks forward under `banner`, side B holds. */
function roundWith(banner: BuildActions["banner"]): Round {
  const key = JSON.stringify(banner ?? null)
  const known = ROUNDS.get(key)
  if (known !== undefined) return known
  const state: BattleState = beginBattle({ map: "crossing", seed: 1, rounds: 3, pulseTicks: 360, commanders: { A: "vasse", B: "vasse" } })
  const A: BuildActions = { power: 0, build: [{ building: "barracks", at: "forward" }, { building: "barracks", at: "forward" }], stance: "attack", ...(banner === undefined ? {} : { banner }) }
  const B: BuildActions = { power: 0, build: [], stance: "hold" }
  const states: MatchState[] = []
  const events: DomainEvent[] = []
  let registry: ContentRegistry | null = null
  let released: number | null = null
  playRound(state, { A, B }, (battle, happened, sideA) => {
    registry ??= sideA
    states.push(battle)
    events.push(...happened)
    if (banner !== undefined && released === null && battle.targets?.A === undefined) released = battle.tick
  })
  const timeline = timelineOf({ id: "rally", name: "rally" }, states, events, 360, 1, registry as unknown as ContentRegistry)
  const round = { timeline, released }
  ROUNDS.set(key, round)
  return round
}

function presenterOf(timeline: PulseTimeline): PulsePresenter {
  const last = timeline.states[timeline.states.length - 1] as MatchState
  return new PulsePresenter({ timeline, regroup: { state: last, paths: [], ticks: 0 }, nexus: null })
}

/** The presenter's frame at `timeMs`, seeked from the top. */
function frameAt(presenter: PulsePresenter, timeMs: number, reducedMotion = false): PulseFrame {
  presenter.apply("restart")
  presenter.advance(0)
  presenter.advance(timeMs)
  return presenter.frame({ colors: "color256", reducedMotion })
}

const arrows = (marks: readonly RallyMark[] | undefined, player: "A" | "B"): RallyMark[] => (marks ?? []).filter((mark) => mark.kind === "arrow" && mark.player === player)
const flags = (marks: readonly RallyMark[] | undefined, player: "A" | "B"): RallyMark[] => (marks ?? []).filter((mark) => mark.kind === "flag" && mark.player === player)

test("the player's route runs from beside its Nexus to the rally point", { timeout: 60_000 }, () => {
  const { timeline } = roundWith({ ...FLANK, stance: "defensive" })
  const opening = timeline.states[0] as MatchState
  const route = rallyRoute(opening, timeline.registry, "A")
  assert.ok(route !== null, "no route for side A")
  const last = route.path[route.path.length - 1]
  assert.ok(last !== undefined && Math.abs(last.x - FLANK.x) <= 1 && Math.abs(last.y - FLANK.y) <= 1, `the route ends at ${JSON.stringify(last)}, not in the rally point's area`)
  assert.deepEqual(route.flag, FLANK, "the flag is not on the rally point's tile")
  const nexus = opening.entities.find((entity) => entity.player === "A" && timeline.registry.get(entity.contentId).nexus === true)
  assert.ok(nexus !== undefined)
  assert.ok(tileDistance(route.path[0] as never, nexus.anchor) <= 6, "the route does not start beside the player's Nexus")
  // The second count: each step of the route is one tile.
  for (let index = 1; index < route.path.length; index += 1) assert.ok(tileDistance(route.path[index - 1] as never, route.path[index] as never) <= 2)
})

test("the player's arrows run at 0 s, 5 s, 10 s ... and are gone between pulses", { timeout: 60_000 }, () => {
  const { timeline } = roundWith({ ...FLANK, stance: "defensive" })
  const presenter = presenterOf(timeline)
  const every = TUNING.rallyArrowsEveryMs
  for (const start of [0, every, 2 * every]) {
    const early = frameAt(presenter, start + 400)
    assert.ok(arrows(early.rally, "A").length > 0, `no arrow at ${start + 400} ms`)
    assert.equal(flags(early.rally, "A").length, 1, `no flag while the arrows run at ${start + 400} ms`)
    const quiet = frameAt(presenter, start + every - 100)
    assert.equal(arrows(quiet.rally, "A").length, 0, `arrows still running at ${start + every - 100} ms, between pulses`)
  }
  // At most `rallyArrowsCount` at once, and they travel toward the rally point.
  for (let timeMs = 0; timeMs < every; timeMs += 100) assert.ok(arrows(frameAt(presenter, timeMs).rally, "A").length <= TUNING.rallyArrowsCount)
  const lead = (timeMs: number): number => tileDistance((arrows(frameAt(presenter, timeMs).rally, "A")[0] as RallyMark).tile, FLANK)
  assert.ok(lead(500) < lead(100), `the leading arrow did not move toward the rally point (${lead(100)}, then ${lead(500)} away)`)
})

test("no arrow is drawn on a tile something stands on, nor off open ground", { timeout: 60_000 }, () => {
  const { timeline } = roundWith({ ...FLANK, stance: "defensive" })
  const screen = battleRoundScreen(timeline, { terminal: { columns: 110, rows: 36 } })
  const presenter = screen.presenter
  let drawnArrows = 0
  for (let timeMs = 0; timeMs < 20_000; timeMs += 250) {
    const pulse = frameAt(presenter, timeMs)
    const occupied = new Set<number>()
    for (const entity of pulse.sample.state.entities) {
      const at = pulse.positions.get(entity.ordinal) ?? entity.anchor
      for (const offset of timeline.registry.get(entity.contentId).footprint) occupied.add(tileIndex(timeline.terrain, { x: at.x + offset.x, y: at.y + offset.y }))
    }
    const cells: BandCell[] = []
    const view = { camera: screen.camera, viewport: screen.layout.viewport, layout: screen.layout, terrain: timeline.terrain }
    drawRallyMarks(cells, view, pulse, occupied)
    for (const drawn of cells) {
      if (!("cell" in drawn)) continue
      assert.equal(drawn.band, BANDS.groundItems)
      const tile = (pulse.rally ?? []).find((mark) => {
        const at = screen.cellOf(mark.tile)
        return at.x === drawn.x && at.y === drawn.y
      })?.tile
      assert.ok(tile !== undefined)
      assert.ok(!occupied.has(tileIndex(timeline.terrain, tile)), `a rally glyph on ${tile.x},${tile.y}, where something stands, at ${timeMs} ms`)
      if (drawn.cell.glyph === "!") continue
      drawnArrows += 1
      assert.equal(timeline.terrain.tiles[tileIndex(timeline.terrain, tile)], "terrain.plain", `an arrow off open ground at ${tile.x},${tile.y}`)
    }
  }
  assert.ok(drawnArrows > 20, `only ${drawnArrows} arrows drawn in 20 s`)
})

test("an aggressive rally point's arrows stop once it is released", { timeout: 60_000 }, () => {
  const { timeline, released } = roundWith({ ...FLANK, stance: "aggressive" })
  assert.ok(released !== null, "the rally point was never released")
  const presenter = presenterOf(timeline)
  const releasedMs = (released * 1000) / timeline.ticksPerSecond
  assert.ok(arrows(frameAt(presenter, 400).rally, "A").length > 0, "no arrow before the release")
  for (let timeMs = releasedMs; timeMs < releasedMs + 3 * TUNING.rallyArrowsEveryMs; timeMs += 100) {
    assert.equal(arrows(frameAt(presenter, timeMs).rally, "A").length, 0, `an arrow at ${timeMs} ms, after the release`)
  }
})

test("the enemy's rally point shows once as the battle begins, then never again", { timeout: 60_000 }, () => {
  const { timeline } = roundWith({ ...FLANK, stance: "defensive" })
  const presenter = presenterOf(timeline)
  assert.ok(arrows(frameAt(presenter, 400).rally, "B").length > 0, "no enemy arrow at the start")
  assert.equal(flags(frameAt(presenter, 1000).rally, "B").length, 1, "no enemy flag at the start")
  for (let timeMs = ENEMY_FLAG_MS; timeMs < 30_000; timeMs += 250) {
    const marks = frameAt(presenter, timeMs).rally
    assert.equal(arrows(marks, "B").length + flags(marks, "B").length, 0, `the enemy's rally point shows at ${timeMs} ms`)
  }
})

test("reduced motion: the arrows stand still for the pulse", { timeout: 60_000 }, () => {
  const { timeline } = roundWith({ ...FLANK, stance: "defensive" })
  const presenter = presenterOf(timeline)
  const first = arrows(frameAt(presenter, 100, true).rally, "A")
  assert.equal(first.length, TUNING.rallyArrowsCount)
  assert.deepEqual(arrows(frameAt(presenter, 900, true).rally, "A"), first, "the arrows moved under reduced motion")
  assert.notDeepEqual(arrows(frameAt(presenter, 900, false).rally, "A"), arrows(frameAt(presenter, 100, false).rally, "A"), "the arrows do not move in full motion")
})

test("the marks are a pure function of time, and drawing them changes no state", { timeout: 60_000 }, () => {
  const { timeline } = roundWith({ ...FLANK, stance: "defensive" })
  const hashes = timeline.states.map((state) => hashState(state))
  const plan = rallyPlan(timeline.states[0] as MatchState, timeline.registry, { everyMs: 5000, count: 3, stopMs: 60_000 })
  const targets = (timeline.states[0] as MatchState).targets
  const forward = [700, 5700, 300, 700].map((timeMs) => rallyMarksAt(plan, timeMs, targets, false))
  assert.deepEqual(forward[0], forward[3])
  const presenter = presenterOf(timeline)
  for (let timeMs = 0; timeMs < 12_000; timeMs += 500) frameAt(presenter, timeMs)
  assert.deepEqual(timeline.states.map((state) => hashState(state)), hashes)
  // Without a target, nothing.
  assert.deepEqual(rallyMarksAt(plan, 700, undefined, false), [])
})
