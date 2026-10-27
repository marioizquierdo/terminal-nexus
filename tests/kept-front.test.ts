// The kept front around the regroup (`src/match/regroup.ts`, its own tests in `tests/regroup.test.ts`): a building may
// go where units stand, the player's or the enemy's, and they walk out from under it (`src/match/make-room.ts`), the
// way the Build Phase draws it; the duel's scripts place by the same rule; a Battle Round ends without a walk home and
// the next Build Phase plays the regroup over its first ten seconds, presentation only.

import { test } from "node:test"
import assert from "node:assert/strict"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import { tilesOf } from "../src/grid/coords.ts"
import type { Coord, GridTerrain, TerrainId } from "../src/grid/types.ts"
import { buildLayout, cellForTile } from "../src/build/layout.ts"
import type { BuildContext } from "../src/build/state.ts"
import { createBuildState, legalityAt, nexusTile, withoutScene } from "../src/build/state.ts"
import type { FieldEntity } from "../src/build/types.ts"
import { starterContext } from "../src/cli/starter.ts"
import { RUN_PLAY, playedOf, runLevel, scriptedRound } from "../src/cli/run-play.ts"
import type { DuelState, Player } from "../src/duel/index.ts"
import { DUEL_PULSE_TICKS, newDuel, placementsOf, playRound, scriptedPlayer } from "../src/duel/index.ts"
import { ROOM_STEP_TICKS, makeRoom, openingState } from "../src/match/index.ts"
import type { Force } from "../src/match/index.ts"
import { RUN_PULSE_TICKS } from "../src/run/index.ts"
import type { EntityState, MatchState } from "../src/state/types.ts"
import { composeBuildFrame } from "../src/view/build.ts"
import { REGROUP_MS, RegroupClock, RoomClock } from "../src/view/build-live.ts"
import { cellAt } from "../src/view/frame.ts"
import { PulsePresenter } from "../src/view/pulse-live.ts"
import { DEFENCE, play } from "./pulse-helpers.ts"

const TROOPER = "unit.citizen.trooper"
const SKYRAIDER = "unit.bench.skyraider"
const NEXUS = "structure.citizen.nexus"
const BARRACKS = "structure.citizen.barracks"

/** A spot near the player's Nexus where a Barracks may go, in the starter level. */
function openSpot(context: BuildContext): Coord {
  const nexus = nexusTile(context) as Coord
  for (let distance = 2; distance < 12; distance += 1) {
    for (const anchor of [
      { x: nexus.x + distance, y: nexus.y },
      { x: nexus.x - distance, y: nexus.y },
      { x: nexus.x, y: nexus.y + distance },
      { x: nexus.x, y: nexus.y - distance },
    ]) {
      if (legalityAt(context, [], BARRACKS, anchor).ok) return anchor
    }
  }
  throw new Error("no open spot near the Nexus")
}

test("a building may go where units stand, the player's or the enemy's: they walk out from under it", () => {
  const plain = starterContext()
  const spot = openSpot(plain)
  const tile = tilesOf(spot, plain.registry.get(BARRACKS).footprint)[0] as Coord
  const withUnit = (player: "A" | "B", contentId = TROOPER): BuildContext => ({ ...plain, field: [...(plain.field ?? []), { contentId, anchor: tile, player, hp: 10 }] })
  assert.ok(legalityAt(withUnit("A"), [], BARRACKS, spot).ok, "on the player's own trooper")
  assert.ok(legalityAt(withUnit("B"), [], BARRACKS, spot).ok, "on the enemy's trooper")
  assert.ok(legalityAt(withUnit("B", SKYRAIDER), [], BARRACKS, spot).ok, "under a flyer")
})

function gridOf(rows: readonly string[]): GridTerrain {
  const ids: Record<string, TerrainId> = { ".": "terrain.plain", "#": "terrain.rock" }
  return { width: rows[0]?.length ?? 0, height: rows.length, tiles: rows.flatMap((row) => [...row].map((character) => ids[character] as TerrainId)) }
}

const OPEN = gridOf(Array.from({ length: 16 }, () => ".".repeat(40)))

test("troops under a new building walk out to the nearest free ground as the round begins, the same way every time", () => {
  const carried = openingState({
    grid: OPEN,
    registry: FIXTURE_REGISTRY,
    structures: [
      { contentId: NEXUS, player: "A", anchor: { x: 2, y: 7 } },
      { contentId: NEXUS, player: "B", anchor: { x: 35, y: 7 } },
    ],
    setup: { seed: 3, pulseTicks: 360, forces: [{ player: "A", muster: { x: 14, y: 8 }, units: [TROOPER, TROOPER, TROOPER, TROOPER, TROOPER, TROOPER] }] },
  })
  const troopers = carried.entities.filter((entity) => entity.contentId === TROOPER)
  const footprint = FIXTURE_REGISTRY.get(BARRACKS).footprint
  const first = troopers[0] as EntityState
  const barracks = { contentId: BARRACKS, player: "A" as const, anchor: first.anchor }
  const next = (): MatchState => openingState({ grid: OPEN, registry: FIXTURE_REGISTRY, structures: [barracks], carried, setup: { seed: 3, pulseTicks: 360, forces: [] } })
  const opened = next()
  assert.deepEqual(next().entities, opened.entities, "the same every time")
  const building = new Set(tilesOf(first.anchor, footprint).map((tile) => `${tile.x},${tile.y}`))
  const seen = new Set<string>()
  for (const trooper of troopers) {
    const now = opened.entities.find((entity) => entity.ordinal === trooper.ordinal) as EntityState
    const key = `${now.anchor.x},${now.anchor.y}`
    assert.ok(!building.has(key), `${trooper.id} walked out from under the Barracks`)
    assert.ok(!seen.has(key), "no two on one tile")
    seen.add(key)
  }
  // The opening sets them down where their walks out end (`makeRoom`), which the Build Phase draws.
  const made = makeRoom(carried, [barracks], FIXTURE_REGISTRY)
  assert.ok(made.paths.length > 0)
  for (const path of made.paths) assert.deepEqual(opened.entities.find((entity) => entity.ordinal === path.ordinal)?.anchor, path.to)
})

test("a building on a crowd walks everyone out by the way, friend and foe alike, and those in the way are pushed in turn", () => {
  // A packed block of troopers of both sides, a Barracks put down on its middle.
  const block: Force[] = [
    { player: "A", muster: { x: 18, y: 8 }, units: Array.from({ length: 12 }, () => TROOPER) },
    { player: "B", muster: { x: 22, y: 8 }, units: Array.from({ length: 12 }, () => TROOPER) },
  ]
  const state = openingState({ grid: OPEN, registry: FIXTURE_REGISTRY, structures: [{ contentId: NEXUS, player: "A", anchor: { x: 2, y: 7 } }], setup: { seed: 3, pulseTicks: 360, forces: block } })
  const barracks = { contentId: BARRACKS, player: "A" as const, anchor: { x: 19, y: 7 } }
  const made = makeRoom(state, [barracks], FIXTURE_REGISTRY)
  assert.deepEqual(makeRoom(state, [barracks], FIXTURE_REGISTRY), made, "the same every time")
  const building = new Set(tilesOf(barracks.anchor, FIXTURE_REGISTRY.get(BARRACKS).footprint).map((tile) => `${tile.x},${tile.y}`))
  const under = state.entities.filter((entity) => entity.contentId === TROOPER && building.has(`${entity.anchor.x},${entity.anchor.y}`))
  assert.ok(under.some((entity) => entity.player === "A") && under.some((entity) => entity.player === "B"), "the building stands on both sides' troopers")
  // Nobody under it, nobody sharing a tile.
  const tiles = made.state.entities.filter((entity) => entity.contentId === TROOPER).map((entity) => `${entity.anchor.x},${entity.anchor.y}`)
  assert.equal(new Set(tiles).size, tiles.length)
  for (const tile of tiles) assert.ok(!building.has(tile))
  // The ripple: some who stood clear of the building were pushed by those walking out.
  const pushed = made.paths.filter((path) => !under.some((entity) => entity.ordinal === path.ordinal))
  assert.ok(pushed.length > 0, "nobody in the way was pushed")
  for (const path of made.paths) {
    // Each walk goes a tile at a time, one step every few ticks.
    let at = path.from
    for (const step of path.steps) {
      assert.equal(Math.abs(step.to.x - at.x) + Math.abs(step.to.y - at.y), 1, `${path.ordinal} jumped`)
      assert.equal(step.tick % ROOM_STEP_TICKS, 0)
      at = step.to
    }
    assert.deepEqual(at, path.to)
  }
  // A pushed unit steps off as the one that pushed it steps on: never before the first step of all.
  assert.ok(Math.min(...pushed.map((path) => path.steps[0]?.tick ?? 0)) >= ROOM_STEP_TICKS, "a pushed unit started before it was pushed")
})

/** A plan that builds nothing, keeps no power and holds its ground: both armies live through the round. */
const NOTHING = { build: [], stance: "hold" } as const

test("a duel's plan builds where units stand, its own or the enemy's, and they walk out as the round begins", { timeout: 120_000 }, () => {
  let duel: DuelState = newDuel({ map: "crossing", seed: 4, rounds: 6, pulseTicks: DUEL_PULSE_TICKS, commanders: { A: "vasse", B: "dob" } })
  duel = playRound(duel, { A: NOTHING, B: NOTHING }).state
  const carried = duel.carried as MatchState
  const unit = (entity: EntityState): boolean => FIXTURE_REGISTRY.has(entity.contentId) && FIXTURE_REGISTRY.get(entity.contentId).layer === "units"
  const intruder = carried.entities.find((entity) => entity.player === "B" && unit(entity)) as EntityState
  const owned = carried.entities.find((entity) => entity.player === "A" && unit(entity)) as EntityState
  const plan = (spot: Coord) => ({ build: [{ building: "turret", x: spot.x, y: spot.y }], stance: "attack" as const })
  // A tile in A's build range where a turret goes up on open ground.
  const taken = new Set(
    carried.entities.flatMap((entity) => tilesOf(entity.anchor, FIXTURE_REGISTRY.has(entity.contentId) ? FIXTURE_REGISTRY.get(entity.contentId).footprint : [{ x: 0, y: 0 }]).map((tile) => `${tile.x},${tile.y}`)),
  )
  let spot: Coord | null = null
  for (let x = 10; x < 16 && spot === null; x += 1) for (let y = 9; y < 18 && spot === null; y += 1) if (!taken.has(`${x},${y}`) && placementsOf(duel, "A", plan({ x, y })).length === 1) spot = { x, y }
  assert.ok(spot !== null, "a spot for the turret")
  const moved = (entity: EntityState): DuelState => ({ ...duel, carried: { ...carried, entities: carried.entities.map((each) => (each.ordinal === entity.ordinal ? { ...each, anchor: spot as Coord } : each)) } })
  for (const standing of [intruder, owned]) {
    assert.equal(placementsOf(moved(standing), "A", plan(spot)).length, 1, `on ${standing.id} the turret goes up`)
    const opened: MatchState[] = []
    const played = playRound(moved(standing), { A: plan(spot), B: NOTHING }, (battle) => {
      if (opened.length === 0) opened.push(battle)
    })
    assert.deepEqual(played.report.sides.A.refused, [])
    const after = opened[0]?.entities.find((entity) => entity.ordinal === standing.ordinal) as EntityState
    assert.notDeepEqual(after.anchor, spot, `${standing.id} walked out from under the turret`)
  }
})

test("Battle Rounds of duels and runs last 30 seconds", () => {
  assert.equal(DUEL_PULSE_TICKS, 30 * 12)
  assert.equal(RUN_PULSE_TICKS, DUEL_PULSE_TICKS)
})

test("the regroup's clock plays once from the round's first frame, and not at all under reduced motion", () => {
  assert.equal(REGROUP_MS, 10_000)
  const walking: FieldEntity[] = [{ contentId: TROOPER, anchor: { x: 5, y: 5 }, player: "A", hp: 10, walk: { from: { x: 2, y: 5 }, steps: [{ tick: 12, to: { x: 3, y: 5 } }] } }]
  const clock = new RegroupClock()
  assert.deepEqual(clock.at(walking, 1000, false), { elapsedMs: 0 })
  assert.deepEqual(clock.at(walking, 4000, false), { elapsedMs: 3000 })
  assert.equal(clock.at(walking, 11_000, false), null, "over once it has played")
  // A new round's field starts it again; one where nobody walks has none; reduced motion shows where they end.
  const next = [...walking]
  assert.deepEqual(clock.at(next, 12_000, false), { elapsedMs: 0 })
  assert.equal(new RegroupClock().at([{ contentId: TROOPER, anchor: { x: 5, y: 5 }, player: "A", hp: 10 }], 0, false), null)
  assert.equal(new RegroupClock().at(walking, 0, true), null)
})

test("the Build Phase draws a regrouping survivor where its walk has it, and where it ends once the regroup has played", () => {
  const plain = starterContext()
  const nexus = nexusTile(plain) as Coord
  const from = { x: nexus.x + 4, y: nexus.y + 3 }
  const to = { x: nexus.x + 8, y: nexus.y + 3 }
  const context: BuildContext = withoutScene({ ...plain, field: [{ contentId: TROOPER, anchor: to, player: "A", hp: 10, walk: { from, steps: [{ tick: 60, to }] } }] })
  const layout = buildLayout({ columns: 80, rows: 24 }, context.grid)
  const state = createBuildState(context, nexus, layout.viewport)
  const glyphAt = (frame: ReturnType<typeof composeBuildFrame>, tile: Coord): string => {
    const cell = cellForTile(layout, state.camera, tile)
    return cellAt(frame, cell.x, cell.y).glyph
  }
  const still = composeBuildFrame({ context, state, layout }, "monochrome")
  const early = composeBuildFrame({ context, state, layout, regroup: { elapsedMs: 0 } }, "monochrome")
  const late = composeBuildFrame({ context, state, layout, regroup: { elapsedMs: 5_100 } }, "monochrome")
  const empty = composeBuildFrame({ context: { ...context, field: [] }, state, layout }, "monochrome")
  assert.notEqual(glyphAt(still, to), glyphAt(empty, to), "still, it stands where the walk ends")
  assert.equal(glyphAt(still, from), glyphAt(empty, from))
  assert.equal(glyphAt(early, from), glyphAt(still, to), "as the round opens it stands where the last round left it")
  assert.equal(glyphAt(early, to), glyphAt(empty, to))
  assert.equal(glyphAt(late, to), glyphAt(still, to), "after its step it stands where it ends")
})

test("the room clock times each planned building's walks out from the frame it was first drawn", () => {
  const clock = new RoomClock()
  const one = [{ ordinal: 0, contentId: BARRACKS, anchor: { x: 3, y: 3 } }]
  assert.deepEqual(clock.at(one, 1000, false), [{ ordinal: 0, elapsedMs: 0 }])
  assert.deepEqual(clock.at(one, 1500, false), [{ ordinal: 0, elapsedMs: 500 }])
  // Moved (undone and placed again elsewhere) it starts again; under reduced motion there is no walk to time.
  assert.deepEqual(clock.at([{ ...one[0]!, anchor: { x: 4, y: 3 } }], 2000, false), [{ ordinal: 0, elapsedMs: 0 }])
  assert.deepEqual(new RoomClock().at(one, 0, true), [])
})

test("the Build Phase draws the units a planned building stands on walking out, then where their walk ends", { timeout: 120_000 }, () => {
  // A run's second round: its field carries ordinals, its round the state, so the view works the walks out.
  const balanced = scriptedPlayer("balanced") as Player
  const planned = scriptedRound(withoutScene(runLevel({ seed: 1, commander: "vasse" }).firstRound()), balanced)
  const resolved = RUN_PLAY.startPulse(planned.context, planned.state)
  assert.ok(resolved !== null)
  const opened = withoutScene(RUN_PLAY.nextRound(planned.context, planned.state, resolved) as BuildContext)
  // One of the player's units set down by the Nexus, where a Turret may go, and a Turret planned on it.
  const turret = opened.catalog.find((item) => item.label === "Turret")?.contentId as string
  const unit = (opened.field ?? []).find((entity) => entity.player === "A" && entity.ordinal !== undefined && opened.registry.get(entity.contentId).layer === "units") as FieldEntity
  assert.ok(unit !== undefined)
  const nexus = nexusTile(opened) as Coord
  const busy = new Set((opened.carried as MatchState).entities.flatMap((entity) => tilesOf(entity.anchor, opened.registry.get(entity.contentId).footprint).map((tile) => `${tile.x},${tile.y}`)))
  let spot: Coord | null = null
  for (let dx = 3; dx < 8 && spot === null; dx += 1) for (const dy of [0, 1, -1, 2, -2]) if (spot === null && !busy.has(`${nexus.x + dx},${nexus.y + dy}`) && legalityAt(opened, [], turret, { x: nexus.x + dx, y: nexus.y + dy }).ok) spot = { x: nexus.x + dx, y: nexus.y + dy }
  assert.ok(spot !== null, "no spot for a Turret beside the Nexus")
  const at = spot as Coord
  const carried: MatchState = { ...(opened.carried as MatchState), entities: (opened.carried as MatchState).entities.map((entity) => (entity.ordinal === unit.ordinal ? { ...entity, anchor: at } : entity)) }
  const next: BuildContext = { ...opened, carried, field: (opened.field ?? []).map((entity) => (entity === unit ? { contentId: unit.contentId, anchor: at, player: unit.player, hp: unit.hp, ordinal: unit.ordinal as number } : entity)) }
  const target = { anchor: at, ordinal: unit.ordinal as number }
  const layout = buildLayout({ columns: 104, rows: 32 }, next.grid)
  const state = { ...createBuildState(next, target.anchor, layout.viewport), planned: [{ ordinal: 0, contentId: turret, anchor: target.anchor }], nextOrdinal: 1 }
  const made = makeRoom(carried, [{ contentId: turret, player: "A", anchor: target.anchor }], next.registry)
  const path = made.paths.find((each) => each.ordinal === target.ordinal)
  assert.ok(path !== undefined && path.steps.length > 0)
  const glyphAt = (frame: ReturnType<typeof composeBuildFrame>, tile: Coord): string => {
    const cell = cellForTile(layout, state.camera, tile)
    return cellAt(frame, cell.x, cell.y).glyph
  }
  const still = composeBuildFrame({ context: next, state, layout }, "monochrome")
  const unitGlyph = glyphAt(composeBuildFrame({ context: next, state: { ...state, planned: [], nextOrdinal: 0 }, layout }, "monochrome"), target.anchor)
  assert.equal(glyphAt(still, path.to), unitGlyph, "still, it stands where its walk out ends")
  const first = path.steps[0] as NonNullable<(typeof path.steps)[number]>
  const walking = composeBuildFrame({ context: next, state, layout, room: [{ ordinal: 0, elapsedMs: (first.tick * 1000) / 12 + 1 }] }, "monochrome")
  if (path.steps.length > 1) assert.equal(glyphAt(walking, first.to), unitGlyph, "mid-walk it is drawn along its way out")
})

test("a run's round ends without a walk home, and the next Build Phase holds the regroup's walks", { timeout: 120_000 }, () => {
  const balanced = scriptedPlayer("balanced") as Player
  const planned = scriptedRound(withoutScene(runLevel({ seed: 1, commander: "vasse" }).firstRound()), balanced)
  const resolved = RUN_PLAY.startPulse(planned.context, planned.state)
  assert.ok(resolved !== null)
  const live = new PulsePresenter(resolved)
  const ending = live.frame({ colors: "monochrome", reducedMotion: false, view: { camera: { x: 0, y: 0 }, viewport: { width: 48, height: 16 } } })
  assert.ok(ending.times.homeMs >= ending.times.stopMs, "the result follows the cease fire: no walk")
  const played = playedOf(resolved)
  assert.ok(played !== undefined && played.duel.result === null, "the battle goes on after its first round")
  const next = RUN_PLAY.nextRound(planned.context, planned.state, resolved) as BuildContext
  const walkers = (next.field ?? []).filter((entity) => entity.walk !== undefined)
  assert.ok(walkers.length > 0, "the survivors regroup as the round opens")
  // Each walk ends where the field stands it, which is where the next round finds it.
  for (const entity of walkers) {
    const walk = entity.walk as NonNullable<FieldEntity["walk"]>
    assert.deepEqual(walk.steps[walk.steps.length - 1]?.to, entity.anchor)
  }
})

test("a campaign's mission keeps the front too: its survivors regroup where they fought, nobody walks home", { timeout: 120_000 }, () => {
  const played = play({ plan: [DEFENCE[0]!] })
  const { regroup } = played.pulse
  assert.equal(played.pulse.mission?.verdict.kind, "continue")
  assert.ok(regroup.ticks > 0, "the mission goes on, so its survivors regroup")
  const states = played.pulse.timeline.states
  const last = states[states.length - 1] as MatchState
  // Each walk starts where the fight left the unit.
  for (const path of regroup.paths) assert.deepEqual(path.from, last.entities.find((entity) => entity.ordinal === path.ordinal)?.anchor)
  // And the next Build Phase's field holds the walks, ending where the round finds each survivor.
  const next = played.build.round
  played.build.advance(0)
  played.build.advance(60_000)
  played.build.dispatch({ kind: "next-round" })
  const opened = played.build.round
  assert.notEqual(opened, next, "the next round did not open")
  assert.ok((opened.field ?? []).some((entity) => entity.walk !== undefined), "nobody regrouped as the round opened")
  for (const entity of (opened.field ?? []).filter((each) => each.walk !== undefined)) {
    const walk = entity.walk as NonNullable<FieldEntity["walk"]>
    assert.deepEqual(walk.steps[walk.steps.length - 1]?.to, entity.anchor)
  }
})
