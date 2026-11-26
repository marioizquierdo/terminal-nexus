// The rally arrows (the owner's playtests, 2026-11-25, docs/history/feedback/2026-11-25-rally-point.md): once only,
// `rallyArrowsAtMs` into a Battle Round, a few arrows run along each side's route to its rally point, both sides at
// once; each side's flag shows briefly as its arrows arrive, and never on a tile something stands on. Nothing before,
// nothing after. The route goes round impassable terrain only, through every building. `src/view/rally-arrows.ts`,
// drawn by `drawRallyMarks` (`src/view/pulse-scene.ts`).

import { test } from "node:test"
import assert from "node:assert/strict"
import type { BattleState, BuildActions } from "../src/battle/index.ts"
import { beginBattle, playRound } from "../src/battle/index.ts"
import { TUNING } from "../src/build/tuning.ts"
import { timelineOf } from "../src/cli/timeline.ts"
import type { ContentRegistry } from "../src/content/index.ts"
import type { DomainEvent } from "../src/engine/events/types.ts"
import { tileDistance, tileIndex, tilesOf } from "../src/engine/geometry/coords.ts"
import { wallsOf } from "../src/engine/routing/index.ts"
import { hashState } from "../src/engine/state/serialize.ts"
import type { MatchState } from "../src/engine/state/types.ts"
import { PulsePresenter } from "../src/view/pulse-live.ts"
import type { PulseFrame } from "../src/view/pulse-scene.ts"
import { drawRallyMarks } from "../src/view/pulse-scene.ts"
import type { RallyMark, RallyPlan } from "../src/view/rally-arrows.ts"
import { FLAG_MS, rallyMarksAt, rallyPlan, rallyRoute, runLengthMs } from "../src/view/rally-arrows.ts"
import type { PulseTimeline } from "../src/view/snapshot.ts"
import type { BandCell } from "../src/view/frame.ts"
import { battleRoundScreen } from "./battle-round-frame.ts"

/** The Crossing's top flank, far off the march line. */
const FLANK = { x: 25, y: 3 }
const AT = TUNING.rallyArrowsAtMs

type Round = Readonly<{ timeline: PulseTimeline }>

const ROUNDS = new Map<string, Round>()

/** Round 1 on the Crossing, Vasse against Vasse: side A builds two Barracks forward and rallies at `rally`, side B
 *  rallies at its default in front of its base (one at its own Nexus would have no route to draw). */
function roundWith(rally: BuildActions["rally"]): Round {
  const key = JSON.stringify(rally ?? null)
  const known = ROUNDS.get(key)
  if (known !== undefined) return known
  const state: BattleState = beginBattle({ map: "crossing", seed: 1, rounds: 3, pulseTicks: 360, commanders: { A: "vasse", B: "vasse" } })
  const A: BuildActions = { power: 0, build: [{ building: "barracks", at: "forward" }, { building: "barracks", at: "forward" }], ...(rally === undefined ? {} : { rally }) }
  const B: BuildActions = { power: 0, build: [] }
  const states: MatchState[] = []
  const events: DomainEvent[] = []
  let registry: ContentRegistry | null = null
  playRound(state, { A, B }, (battle, happened, sideA) => {
    registry ??= sideA
    states.push(battle)
    events.push(...happened)
  })
  const timeline = timelineOf({ id: "rally", name: "rally" }, states, events, 360, 1, registry as unknown as ContentRegistry)
  const round = { timeline }
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

/** The plan the presenter makes for `timeline`, made again here: when each side's arrows arrive. */
function planOf(timeline: PulseTimeline): RallyPlan {
  return rallyPlan(timeline.states[0] as MatchState, timeline.registry, { atMs: AT, count: TUNING.rallyArrowsCount, stopMs: Number.POSITIVE_INFINITY })
}

test("the player's route runs from beside its Nexus to the rally point", { timeout: 60_000 }, () => {
  const { timeline } = roundWith(FLANK)
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

test("the route goes straight through buildings, round impassable terrain only", { timeout: 60_000 }, () => {
  const { timeline } = roundWith(FLANK)
  const opening = timeline.states[0] as MatchState
  const { registry, terrain } = timeline
  const route = rallyRoute(opening, registry, "A")
  assert.ok(route !== null)
  const built = new Set(
    opening.entities
      .filter((entity) => entity.player === "A" && registry.get(entity.contentId).layer === "obstacles" && registry.get(entity.contentId).nexus !== true)
      .flatMap((entity) => tilesOf(entity.anchor, registry.get(entity.contentId).footprint).map((tile) => tileIndex(terrain, tile))),
  )
  // The forward Barracks on the Crossing stand across the way to the flank: the route goes through them.
  assert.ok(route.path.some((tile) => built.has(tileIndex(terrain, tile))), "the route went round the player's Barracks")
  const rock = wallsOf(terrain, "impassable", [])
  for (const tile of route.path) assert.equal(rock.wall[tileIndex(terrain, tile)], 0, `the route crosses impassable ground at ${tile.x},${tile.y}`)
  // The second count: the same route walked on a battlefield with no building but the two Nexuses.
  const bare = { ...opening, entities: opening.entities.filter((entity) => registry.get(entity.contentId).layer !== "obstacles" || registry.get(entity.contentId).nexus === true) }
  assert.deepEqual(rallyRoute(bare, registry, "A")?.path, route.path, "the Barracks bent the route")
})

test("nothing shows before the run, for either side", { timeout: 60_000 }, () => {
  const { timeline } = roundWith(FLANK)
  const presenter = presenterOf(timeline)
  for (let timeMs = 0; timeMs < AT; timeMs += 100) assert.equal(frameAt(presenter, timeMs).rally, undefined, `a rally mark at ${timeMs} ms, before the run`)
})

test("both sides' arrows run together from the moment, toward their rally points, with no flag while they run", { timeout: 60_000 }, () => {
  const { timeline } = roundWith(FLANK)
  const presenter = presenterOf(timeline)
  const plan = planOf(timeline)
  const early = frameAt(presenter, AT + 100).rally
  assert.ok(arrows(early, "A").length > 0, "no arrow of the player's just after the moment")
  assert.ok(arrows(early, "B").length > 0, "no arrow of the enemy's just after the moment")
  for (const player of ["A", "B"] as const) {
    const route = plan.routes[player]
    assert.ok(route !== undefined)
    const arrives = AT + runLengthMs(route, plan.count, false)
    for (let timeMs = AT; timeMs < arrives; timeMs += 50) {
      const marks = frameAt(presenter, timeMs).rally
      assert.equal(flags(marks, player).length, 0, `side ${player}'s flag at ${timeMs} ms, while its arrows run`)
      assert.ok(arrows(marks, player).length <= TUNING.rallyArrowsCount)
    }
  }
  const lead = (timeMs: number): number => tileDistance((arrows(frameAt(presenter, timeMs).rally, "A")[0] as RallyMark).tile, FLANK)
  assert.ok(lead(AT + 500) < lead(AT + 100), `the leading arrow did not move toward the rally point (${lead(AT + 100)}, then ${lead(AT + 500)} away)`)
})

test("each side's flag shows once, as its arrows arrive, briefly; then nothing more", { timeout: 60_000 }, () => {
  const { timeline } = roundWith(FLANK)
  const presenter = presenterOf(timeline)
  const plan = planOf(timeline)
  let last = 0
  for (const player of ["A", "B"] as const) {
    const route = plan.routes[player]
    assert.ok(route !== undefined)
    const arrives = AT + runLengthMs(route, plan.count, false)
    last = Math.max(last, arrives + FLAG_MS)
    for (const timeMs of [arrives, arrives + FLAG_MS / 2, arrives + FLAG_MS - 50]) {
      const marks = frameAt(presenter, timeMs).rally
      assert.deepEqual(flags(marks, player).map((mark) => mark.tile), [route.flag], `no flag of side ${player}'s at ${timeMs} ms, as its arrows arrive`)
      assert.equal(arrows(marks, player).length, 0, `side ${player}'s arrows still out at ${timeMs} ms, with its flag`)
    }
  }
  assert.ok(last < 10_000, `the run and its flags last until ${last} ms`)
  for (let timeMs = last; timeMs < 30_000; timeMs += 250) assert.equal(frameAt(presenter, timeMs).rally, undefined, `a rally mark at ${timeMs} ms, after the run`)
})

test("nothing is drawn on a tile something stands on: no arrow, no flag, no restyle; arrows on open plain ground only", { timeout: 60_000 }, () => {
  const { timeline } = roundWith(FLANK)
  const screen = battleRoundScreen(timeline, { terminal: { columns: 110, rows: 36 } })
  const presenter = screen.presenter
  const view = { camera: screen.camera, viewport: screen.layout.viewport, layout: screen.layout, terrain: timeline.terrain }
  let drawnArrows = 0
  for (let timeMs = AT; timeMs < AT + 6000; timeMs += 50) {
    const pulse = frameAt(presenter, timeMs)
    const occupied = new Set<number>()
    for (const entity of pulse.sample.state.entities) {
      const at = pulse.positions.get(entity.ordinal) ?? entity.anchor
      for (const offset of timeline.registry.get(entity.contentId).footprint) occupied.add(tileIndex(timeline.terrain, { x: at.x + offset.x, y: at.y + offset.y }))
    }
    const cells: BandCell[] = []
    drawRallyMarks(cells, view, pulse, occupied)
    for (const drawn of cells) {
      assert.ok("cell" in drawn, `a restyle at ${timeMs} ms`)
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
  assert.ok(drawnArrows > 20, `only ${drawnArrows} arrows drawn in the run`)
  // A flag on a building's tile: nothing at all, where the old flag restyled it.
  const plan = planOf(timeline)
  const route = plan.routes.A
  assert.ok(route !== undefined)
  const pulse = frameAt(presenter, AT + runLengthMs(route, plan.count, false) + 100)
  const cells: BandCell[] = []
  drawRallyMarks(cells, view, pulse, new Set([tileIndex(timeline.terrain, route.flag)]))
  assert.ok(cells.every((drawn) => screen.cellOf(route.flag).x !== drawn.x || screen.cellOf(route.flag).y !== drawn.y), "a flag drawn on an occupied tile")
})

test("a side released before the run shows nothing; the other side still runs", { timeout: 60_000 }, () => {
  const { timeline } = roundWith(FLANK)
  const plan = planOf(timeline)
  const targets = (timeline.states[0] as MatchState).targets
  assert.ok(targets?.B !== undefined)
  const withoutA = { B: targets.B }
  for (let timeMs = 0; timeMs < 15_000; timeMs += 100) assert.equal(rallyMarksAt(plan, timeMs, withoutA, false).filter((mark) => mark.player === "A").length, 0)
  assert.ok(arrows(rallyMarksAt(plan, AT + 100, withoutA, false), "B").length > 0, "the enemy's arrows stopped with the player's release")
})

test("reduced motion: the arrows stand still along the route, then the flag", { timeout: 60_000 }, () => {
  const { timeline } = roundWith(FLANK)
  const presenter = presenterOf(timeline)
  const plan = planOf(timeline)
  const route = plan.routes.A
  assert.ok(route !== undefined)
  assert.equal(frameAt(presenter, AT - 100, true).rally, undefined)
  const first = arrows(frameAt(presenter, AT + 100, true).rally, "A")
  assert.equal(first.length, TUNING.rallyArrowsCount)
  const arrives = AT + runLengthMs(route, plan.count, true)
  assert.deepEqual(arrows(frameAt(presenter, arrives - 100, true).rally, "A"), first, "the arrows moved under reduced motion")
  assert.equal(flags(frameAt(presenter, arrives - 100, true).rally, "A").length, 0)
  assert.equal(flags(frameAt(presenter, arrives + 100, true).rally, "A").length, 1, "no flag after the still arrows")
  assert.equal(frameAt(presenter, arrives + FLAG_MS + 100, true).rally?.filter((mark) => mark.player === "A").length ?? 0, 0)
  assert.notDeepEqual(arrows(frameAt(presenter, AT + 900, false).rally, "A"), arrows(frameAt(presenter, AT + 100, false).rally, "A"), "the arrows do not move in full motion")
})

test("the marks are a pure function of time, and drawing them changes no state", { timeout: 60_000 }, () => {
  const { timeline } = roundWith(FLANK)
  const hashes = timeline.states.map((state) => hashState(state))
  const plan = planOf(timeline)
  const targets = (timeline.states[0] as MatchState).targets
  const forward = [AT + 700, AT + 2700, AT + 300, AT + 700].map((timeMs) => rallyMarksAt(plan, timeMs, targets, false))
  assert.deepEqual(forward[0], forward[3])
  const presenter = presenterOf(timeline)
  for (let timeMs = 0; timeMs < 12_000; timeMs += 250) frameAt(presenter, timeMs)
  assert.deepEqual(timeline.states.map((state) => hashState(state)), hashes)
  // Without a target, nothing.
  assert.deepEqual(rallyMarksAt(plan, AT + 700, undefined, false), [])
})
