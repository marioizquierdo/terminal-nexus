// Burning ground, as the Battle Round draws it (src/view/burning.ts): the patch a mortar's shell leaves is drawn on the
// rule's own tiles, under what stands there, flickering by cosmetic randomness only, held by reduced motion, dying down
// before it ends and gone once it has. Every state here is built by hand — a `MatchState` with `burning` set — so the
// picture is tested apart from the rule that lights it.

import { test } from "node:test"
import assert from "node:assert/strict"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import { footprintWithin } from "../src/grid/coords.ts"
import type { Coord } from "../src/grid/types.ts"
import { withinArea } from "../src/pulse/shared.ts"
import type { Actor } from "../src/pulse/shared.ts"
import { TICKS_PER_SECOND, loadScenario } from "../src/scenario/index.ts"
import type { BurningGround, MatchState } from "../src/state/types.ts"
import { FIRE, FIRE_FILLS, FIRE_GLYPHS, fireAt, patchTiles } from "../src/view/burning.ts"
import { DEFAULT_PRESENTATION, cellAt, createView, frameToText, gridOrigin, offendingGlyph, resolveCell } from "../src/view/index.ts"
import type { PulseTimeline, ReadonlyCellFrame } from "../src/view/index.ts"
import { runBuildPlaytest } from "../src/playtest/build.ts"
import { parseKeyScript } from "../src/playtest/keys.ts"
import { DEFAULT_LEVEL } from "../src/cli/levels.ts"
import { cellForTile } from "../src/build/layout.ts"
import { loadScenarioFile } from "./helpers.ts"

const TICK_MS = 1000 / TICKS_PER_SECOND
const ONE_TILE = [{ x: 0, y: 0 }]
const FLAMES = new Set([...Object.values(FIRE_GLYPHS).flatMap((glyphs) => [glyphs.tall, glyphs.low])])

/** A patch lit at tick 0 by a mortar of side A, burning until `untilTick`. */
function patch(centre: Coord, radius: number, untilTick = 60, startedTick = 0): BurningGround {
  return { centre, radius, damage: 2, everyTicks: 12, startedTick, untilTick, player: "A", source: "A:mortar#9", sourceOrdinal: 9 }
}

/**
 * A Pulse that does nothing for `ticks` ticks on the two-trooper melee map, the state of tick `t` holding whatever
 * `burningAt(t)` says burns — built by hand, with no kernel rule behind it. Effects off: nothing but the ground.
 */
async function timelineWith(burningAt: (tick: number) => readonly BurningGround[], ticks = 120): Promise<PulseTimeline> {
  const scenario = await loadScenarioFile("melee-kill.map.json")
  const loaded = loadScenario(scenario, { registry: FIXTURE_REGISTRY, seed: scenario.seed })
  const states: MatchState[] = Array.from({ length: ticks + 1 }, (_, tick) => {
    const burning = burningAt(tick)
    return burning.length === 0 ? { ...loaded.state, tick } : { ...loaded.state, tick, burning }
  })
  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    seed: scenario.seed,
    pulseTicks: ticks,
    ticksPerSecond: TICKS_PER_SECOND,
    grid: loaded.state.grid,
    registry: loaded.registry,
    states,
    events: [],
    stateHash: "by-hand",
    eventsHash: "by-hand",
  }
}

const quiet = (reducedMotion = false) => ({ ...DEFAULT_PRESENTATION, effects: false, reducedMotion })

/** The frame cells a patch's tiles are drawn on in the engine tool's view, and whether each is burning there: on the
 *  scorch, or on the glow under a tall flame. */
function burningCells(frame: ReadonlyCellFrame, timeline: PulseTimeline): Set<string> {
  const origin = gridOrigin(timeline.grid)
  const burning = new Set<string>()
  for (let y = 0; y < timeline.grid.height; y += 1) {
    for (let x = 0; x < timeline.grid.width; x += 1) {
      const cell = cellAt(frame, origin.column + x, origin.row + y)
      if (cell.style.bgRole !== undefined && FIRE_FILLS.has(cell.style.bgRole)) burning.add(`${x},${y}`)
    }
  }
  return burning
}

const keyOf = (tile: Coord): string => `${tile.x},${tile.y}`

/** The map alone, as text: the panel beside it counts ticks, and would differ between any two instants. */
function mapText(frame: ReadonlyCellFrame, timeline: PulseTimeline): string {
  const origin = gridOrigin(timeline.grid)
  const rows: string[] = []
  for (let y = 0; y < timeline.grid.height; y += 1) {
    let row = ""
    for (let x = 0; x < timeline.grid.width; x += 1) row += cellAt(frame, origin.column + x, origin.row + y).glyph
    rows.push(row)
  }
  return rows.join("\n")
}

test("the drawn patch is the rule's own tiles: within its radius of its centre, as range is measured", async () => {
  const centre = { x: 6, y: 5 }
  for (const radius of [1, 2, 3, 4, 6]) {
    // The rule's test, asked of every tile of a box well past the patch: a one-tile actor standing there.
    const ruled = new Set<string>()
    for (let y = centre.y - 6; y <= centre.y + 6; y += 1) {
      for (let x = centre.x - 10; x <= centre.x + 10; x += 1) {
        const actor = { anchor: { x, y }, definition: { footprint: ONE_TILE } } as unknown as Actor
        if (withinArea(centre, ONE_TILE, actor, radius)) ruled.add(`${x},${y}`)
        assert.equal(withinArea(centre, ONE_TILE, actor, radius), footprintWithin(centre, ONE_TILE, { x, y }, ONE_TILE, radius))
      }
    }
    assert.deepEqual(new Set(patchTiles({ centre, radius }).map(keyOf)), ruled, `radius ${radius}`)

    // And on screen: every tile of the patch on the map, and nothing else, takes a fire's fill.
    const timeline = await timelineWith(() => [patch(centre, radius)])
    const frame = createView(timeline, quiet()).snapshotAt(10 * TICK_MS, "truecolor")
    const onMap = [...ruled].filter((key) => {
      const [x = -1, y = -1] = key.split(",").map(Number)
      return x >= 0 && y >= 0 && x < timeline.grid.width && y < timeline.grid.height
    })
    assert.deepEqual(burningCells(frame, timeline), new Set(onMap), `radius ${radius} on screen`)
  }
})

test("a patch about five tiles across is a radius of two: five across its own row, one above and below", () => {
  const tiles = patchTiles({ centre: { x: 0, y: 0 }, radius: 2 })
  assert.deepEqual(tiles.filter((tile) => tile.y === 0).map((tile) => tile.x), [-2, -1, 0, 1, 2])
  assert.deepEqual(tiles.filter((tile) => tile.y !== 0), [{ x: 0, y: -1 }, { x: 0, y: 1 }])
})

test("a unit standing in the fire keeps its glyph and its colour; only the ground under it burns", async () => {
  // The A trooper at 10,5 stands in the middle of the patch.
  const timeline = await timelineWith(() => [patch({ x: 10, y: 5 }, 4)])
  const view = createView(timeline, quiet())
  const origin = gridOrigin(timeline.grid)
  for (const timeMs of [0, 250, 900, 2400, 4000]) {
    for (const colors of ["monochrome", "color256", "truecolor"] as const) {
      const frame = view.snapshotAt(timeMs, colors)
      for (const at of [{ x: 10, y: 5 }, { x: 10, y: 6 }, { x: 13, y: 5 }]) {
        const cell = cellAt(frame, origin.column + at.x, origin.row + at.y)
        assert.equal(cell.glyph, at.x === 13 ? "T" : "t", `the trooper at ${keyOf(at)} keeps its glyph at ${timeMs} ms`)
        assert.equal(cell.style.fgRole, at.x === 13 ? "player.b" : "player.a", "and its own colour")
        // 13,5 is three columns from the centre, within a reach of 4: it burns too.
        assert.equal(cell.style.bgRole, "fx.fire.ground", "on the scorched ground")
      }
      assert.equal(offendingGlyph(frame), null)
    }
  }
})

test("in monochrome the flames alone carry the patch: its open ground shows flame glyphs and no colour", async () => {
  const centre = { x: 4, y: 3 }
  const timeline = await timelineWith(() => [patch(centre, 4)])
  const view = createView(timeline, quiet())
  const origin = gridOrigin(timeline.grid)
  const tiles = patchTiles({ centre, radius: 4 }).filter((tile) => tile.x >= 0 && tile.y >= 0)
  const flared = new Set<string>()
  for (const timeMs of [0, 170, 340, 510, 680, 850, 1020]) {
    const frame = view.snapshotAt(timeMs, "monochrome")
    const lit = tiles.filter((tile) => FLAMES.has(cellAt(frame, origin.column + tile.x, origin.row + tile.y).glyph))
    // Some of the patch is alight at every instant (`FIRE.lit` of it on average, under half: Mario's lighter fire), so
    // the patch is there by glyph alone; over a second the flames have flared on nearly all of it, so its shape is too.
    assert.ok(lit.length >= tiles.length * 0.2, `${lit.length} of ${tiles.length} tiles alight at ${timeMs} ms`)
    for (const tile of lit) flared.add(keyOf(tile))
    for (const tile of lit) {
      const resolved = resolveCell(cellAt(frame, origin.column + tile.x, origin.row + tile.y), "monochrome")
      assert.equal(resolved.background, null, "monochrome paints no fill")
    }
    // The text a monochrome terminal shows has the flames in it.
    assert.match(frameToText(frame), /[\^~]/u)
  }
  assert.ok(flared.size >= tiles.length * 0.85, `only ${flared.size} of ${tiles.length} tiles flared in a second`)
})

test("the fire flashes rather than glowing: most of a patch shows the ground at any instant, and which tiles flare changes", async () => {
  const centre = { x: 6, y: 4 }
  const timeline = await timelineWith(() => [patch(centre, 4, 100)])
  const view = createView(timeline, quiet())
  const origin = gridOrigin(timeline.grid)
  const tiles = patchTiles({ centre, radius: 4 }).filter((tile) => tile.x >= 0 && tile.y >= 0)
  const ground = mapText(createView(await timelineWith(() => []), quiet()).snapshotAt(0, "truecolor"), timeline)
  const looks = new Set<string>()
  for (const timeMs of [0, 170, 340, 510, 680, 850, 1020, 2000, 3000]) {
    const frame = view.snapshotAt(timeMs, "truecolor")
    const cells = tiles.map((tile) => cellAt(frame, origin.column + tile.x, origin.row + tile.y))
    // Most tiles show what the ground shows without the fire, its own glyph on the faint scorch.
    const groundRows = ground.split("\n")
    const bare = tiles.filter((tile, index) => cells[index]?.glyph === groundRows[tile.y]?.[tile.x] && cells[index]?.style.bgRole === "fx.fire.ground")
    assert.ok(bare.length > tiles.length / 2, `${bare.length} of ${tiles.length} tiles show the ground at ${timeMs} ms`)
    // A flare is red or yellow: a low flame red on the scorch, a tall one yellow on the red glow.
    for (const cell of cells) {
      if (cell.glyph === FIRE_GLYPHS.ascii.tall) assert.deepEqual([cell.style.fgRole, cell.style.bgRole], ["fx.fire.tall", "fx.fire.glow"])
      if (cell.glyph === FIRE_GLYPHS.ascii.low) assert.deepEqual([cell.style.fgRole, cell.style.bgRole], ["fx.fire", "fx.fire.ground"])
    }
    looks.add(cells.map((cell) => `${cell.glyph}${cell.style.bgRole}`).join(""))
  }
  // It flickers: nine instants, a beat or more apart, and the patch is lit otherwise at nearly every one.
  assert.ok(looks.size >= 8, `only ${looks.size} looks in nine instants`)
})

test("the flicker is a pure function of presentation time: the same instant, the same frame, however it is reached", async () => {
  const timeline = await timelineWith(() => [patch({ x: 6, y: 4 }, 4), patch({ x: 16, y: 6 }, 2)])
  const once = createView(timeline, quiet())
  const again = createView(timeline, quiet())
  // One view samples every frame up to it, the other jumps straight there.
  for (let timeMs = 0; timeMs < 2000; timeMs += 33) once.snapshotAt(timeMs, "truecolor")
  for (const timeMs of [2000, 2777, 3100]) {
    assert.deepEqual(once.snapshotAt(timeMs, "truecolor"), again.snapshotAt(timeMs, "truecolor"))
  }
  // It does flicker: a few beats apart, the patch is lit differently.
  const looks = new Set([0, 170, 340, 510, 680].map((timeMs) => mapText(once.snapshotAt(timeMs, "monochrome"), timeline)))
  assert.ok(looks.size > 1, "the patch never changed")
  // And only the cosmetic seed moves it: another seed lights it otherwise, the state untouched.
  const reseeded = createView(timeline, { ...quiet(), cosmeticSeed: 12345 })
  assert.notDeepEqual(reseeded.sampleAt(500, "truecolor").fire, once.sampleAt(500, "truecolor").fire)
  assert.deepEqual(reseeded.sampleAt(500, "truecolor").state, once.sampleAt(500, "truecolor").state)
})

test("reduced motion holds the fire still until it dies down", async () => {
  const timeline = await timelineWith(() => [patch({ x: 6, y: 4 }, 4, 100)])
  const view = createView(timeline, quiet(true))
  const held = mapText(view.snapshotAt(0, "monochrome"), timeline)
  assert.match(held, /[\^~]/u)
  // Up to the last second of its life (it burns until the end of tick 100), never a different glyph.
  for (let timeMs = 0; timeMs < 101 * TICK_MS - FIRE.dyingMs; timeMs += 50) {
    assert.equal(mapText(view.snapshotAt(timeMs, "monochrome"), timeline), held, `moved at ${timeMs} ms`)
  }
})

test("it dies down in its last second, low and dim, and is gone the tick after it ends", async () => {
  const untilTick = 60
  const timeline = await timelineWith((tick) => (tick <= untilTick ? [patch({ x: 6, y: 4 }, 4, untilTick)] : []))
  for (const reducedMotion of [false, true]) {
    const view = createView(timeline, quiet(reducedMotion))
    const endMs = (untilTick + 1) * TICK_MS
    // The four beats before its last second. Tall flames flash on a few tiles at a time, so one instant may hold none:
    // the beats together do.
    const beats = [0, 1, 2, 3].map((beat) => view.sampleAt(endMs - FIRE.dyingMs - 20 - beat * FIRE.flickerMs, "truecolor").fire)
    const before = beats.flat()
    assert.ok(before.length > 0 && before.every((tile) => !tile.dying))
    assert.ok(before.some((tile) => tile.flame === "tall"), "burning high before its last second")
    const litBefore = before.filter((tile) => tile.flame !== null).length / beats.length
    for (const timeMs of [endMs - FIRE.dyingMs + 10, endMs - 500, endMs - 10]) {
      const dying = view.sampleAt(timeMs, "truecolor").fire
      assert.ok(dying.length > 0 && dying.every((tile) => tile.dying && tile.flame !== "tall"), `at ${timeMs} ms`)
      // Fewer flames than while it burned, a beat for a beat.
      assert.ok(dying.filter((tile) => tile.flame !== null).length < litBefore)
      const frame = view.snapshotAt(timeMs, "truecolor")
      const origin = gridOrigin(timeline.grid)
      for (const tile of dying) {
        const cell = cellAt(frame, origin.column + tile.tile.x, origin.row + tile.tile.y)
        if (tile.flame === "low" && cell.glyph === FIRE_GLYPHS.ascii.low) assert.equal(cell.style.dim, true, "a dying flame is dim")
      }
    }
    // The tick after its last: nothing burns, nothing is drawn.
    const after = view.snapshotAt(endMs + 1, "truecolor")
    assert.equal(view.sampleAt(endMs + 1, "truecolor").fire.length, 0)
    assert.equal(burningCells(after, timeline).size, 0)
  }
})

test("a patch the state still holds past its end is not drawn, nor one not yet lit", () => {
  const lit = patch({ x: 6, y: 4 }, 3, 40, 20)
  const at = (tick: number) =>
    fireAt({ burning: [lit], tick, timeMs: tick * TICK_MS, tickDurationMs: TICK_MS, outMs: 1e9, reducedMotion: false, cosmeticSeed: 1 })
  assert.equal(at(19).length, 0)
  assert.ok(at(20).length > 0)
  assert.ok(at(40).length > 0)
  assert.equal(at(41).length, 0)
})

test("ground still burning when the fight ends is put out once everything in flight has landed", async () => {
  const timeline = await timelineWith(() => [patch({ x: 6, y: 4 }, 3, 10_000)], 60)
  const view = createView(timeline, quiet())
  const outMs = Math.max(view.effectsEndMs, (view.lastTick + 1) * view.tickDurationMs)
  assert.ok(view.sampleAt(outMs - FIRE.dyingMs - 10, "truecolor").fire.every((tile) => !tile.dying))
  assert.ok(view.sampleAt(outMs - 10, "truecolor").fire.every((tile) => tile.dying))
  assert.equal(view.sampleAt(outMs, "truecolor").fire.length, 0)
  assert.equal(view.sampleAt(outMs + 5000, "truecolor").fire.length, 0)
})

test("the Build Phase screen's Battle Round draws it the same way, under the units", () => {
  let centre: Coord = { x: 0, y: 0 }
  const play = {
    ...DEFAULT_LEVEL.play,
    startPulse: (...args: Parameters<typeof DEFAULT_LEVEL.play.startPulse>) => {
      const resolved = DEFAULT_LEVEL.play.startPulse(...args)
      if (resolved === null) return null
      const opening = resolved.timeline.states[0]
      const trooper = opening?.entities.find((entity) => entity.player === "A" && entity.contentId.includes("trooper"))
      assert.ok(trooper !== undefined)
      centre = trooper.anchor
      // Burning from the first tick to well past the fight, round where a trooper of the player's starts.
      const states = resolved.timeline.states.map((state) => ({ ...state, burning: [patch(centre, 4, 10_000)] }))
      return { ...resolved, timeline: { ...resolved.timeline, states } }
    },
  }
  const run = runBuildPlaytest({ steps: parseKeyScript("Esc s s wait~100"), colors: "truecolor", play })
  const last = run.frames[run.frames.length - 1]
  assert.ok(last !== undefined)
  const { frame, state } = last
  let scorched = 0
  let flames = 0
  for (const tile of patchTiles({ centre, radius: 4 })) {
    const at = cellForTile(run.layout, state.camera, tile)
    const cell = cellAt(frame, at.x, at.y)
    if (cell.style.bgRole !== undefined && FIRE_FILLS.has(cell.style.bgRole)) scorched += 1
    if (FLAMES.has(cell.glyph)) flames += 1
  }
  assert.ok(scorched >= patchTiles({ centre, radius: 4 }).length - 2, `${scorched} tiles scorched`)
  assert.ok(flames > 0)
  // Whatever stands in it is drawn with its own glyph, on the scorched ground.
  const standing = cellAt(frame, cellForTile(run.layout, state.camera, centre).x, cellForTile(run.layout, state.camera, centre).y)
  assert.ok(!FLAMES.has(standing.glyph))
})
