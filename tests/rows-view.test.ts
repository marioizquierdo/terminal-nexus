// What the screen draws by the one rule of distance (tests/rows.test.ts): a tile is one column wide and a row about
// two columns tall, so a reach the rules count as wide as it is tall is as wide as it is tall on screen. The build
// range, a building's reach and the room a Barracks keeps are the rules' own answers drawn; her voice's "near" is
// her aura's reach; and the raid's trail and the raid panel's bearing read a slope the way the screen shows it.

import { test } from "node:test"
import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import { ARMIES } from "../src/armies/index.ts"
import { STARTER_START_CURSOR } from "../src/build/catalog.ts"
import { buildLayout, cellForTile, tileAtCell } from "../src/build/layout.ts"
import type { BuildContext } from "../src/build/state.ts"
import { buildRange } from "../src/build/state.ts"
import { crowding } from "../src/build/territory.ts"
import { runBuildPhase } from "../src/cli/build-phase.ts"
import { starterContext } from "../src/cli/starter.ts"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import type { DomainEvent } from "../src/events/types.ts"
import { ROW_DISTANCE, footprintWithin, gridDistance, gridSteps } from "../src/grid/coords.ts"
import type { Coord, TerrainId } from "../src/grid/types.ts"
import { runBuildPlaytest } from "../src/playtest/build.ts"
import { DEFAULT_SETTINGS } from "../src/settings/types.ts"
import type { EntityState, MatchState, PlayerId } from "../src/state/types.ts"
import { reachOutline, roomApron } from "../src/view/build-areas.ts"
import { outlineWithin } from "../src/view/reach-outline.ts"
import { LOOK_AHEAD, trailGlyph, trailMarks } from "../src/view/build-grid.ts"
import { cellAt, frameToText } from "../src/view/frame.ts"
import type { Cell, ReadonlyCellFrame } from "../src/view/frame.ts"
import { speakerOf, voiceMoments } from "../src/view/pulse-voice.ts"
import { bearing } from "../src/view/raid-panel.ts"
import { CHROME_GLYPHS } from "../src/view/theme.ts"
import { ENTER, MAXIMUM, MINIMUM, WIDE, buildSide, compose, keys } from "./build-helpers.ts"
import type { Side } from "./build-helpers.ts"

const NEXUS = "structure.citizen.nexus"
const BARRACKS = "structure.citizen.barracks"
const TURRET = "structure.bench.beamturret"
const TROOPER = "unit.citizen.trooper"
const VASSE = "unit.citizen.vasse"
const ONE: readonly Coord[] = [{ x: 0, y: 0 }]
const STROKES = ["-", "|", "/", "\\"]

/** An open field, 40 x 20, with the Grid Nexus standing at 10,8 to 12,9 and plenty to spend. */
function field(): BuildContext {
  const width = 40
  const height = 20
  const tiles = new Array<TerrainId>(width * height).fill("terrain.plain")
  return { ...starterContext(), grid: { width, height, tiles }, standing: [{ contentId: NEXUS, anchor: { x: 10, y: 8 } }], field: [], incoming: [], allotment: 1000 }
}

/** Moves the map cursor onto `tile` and asserts it got there. */
function moveTo(side: Side, tile: Coord): void {
  const { cursor } = side.build.state
  side.build.run([{ kind: "move-cursor", dx: tile.x - cursor.x, dy: tile.y - cursor.y }])
  assert.deepEqual(side.build.state.cursor, tile)
}

/** The cell a Grid tile is drawn on, in `frame`. */
const at = (side: Side, frame: ReadonlyCellFrame, tile: Coord): Cell => {
  const cell = cellForTile(side.layout, side.build.state.camera, tile)
  return cellAt(frame, cell.x, cell.y)
}

/** The width and height, in tiles, of the box round some tiles. */
function extent(tiles: readonly Coord[]): Readonly<{ width: number; height: number }> {
  const xs = tiles.map((tile) => tile.x)
  const ys = tiles.map((tile) => tile.y)
  return { width: Math.max(...xs) - Math.min(...xs) + 1, height: Math.max(...ys) - Math.min(...ys) + 1 }
}

// --- A tile is one column wide ------------------------------------------------------------------------------

test("a tile is drawn one column wide at every size the game is played at", () => {
  const { grid } = starterContext()
  for (const terminal of [MINIMUM, MAXIMUM, WIDE, { columns: 200, rows: 60 }]) {
    const layout = buildLayout(terminal, grid)
    const camera = { x: 0, y: 0 }
    // The tile beside a tile is the cell beside its cell, and a cell of the Grid pane is the tile drawn on it.
    for (let x = 0; x < layout.viewport.width; x += 1) {
      const cell = cellForTile(layout, camera, { x, y: 3 })
      assert.equal(cell.x, layout.origin.column + x, `${terminal.columns} columns: tile ${x}`)
      assert.deepEqual(tileAtCell(layout, camera, cell.x, cell.y), { x, y: 3 })
    }
    // The pane is as many columns as the view is tiles, and not one more.
    assert.equal(tileAtCell(layout, camera, layout.origin.column + layout.viewport.width, layout.origin.row), null)
    assert.equal(layout.composition.width, 2 + 29 + layout.viewport.width, `${terminal.columns} columns`)
  }
  // At 80 x 24, 49 tiles across and 18 rows; at 128 columns, 72 across.
  assert.deepEqual(buildLayout(MINIMUM, grid).viewport, { width: 49, height: 18 })
  assert.equal(buildLayout(WIDE, grid).viewport.width, 72)
  // The scripted playtest at 128 columns: the Nexus is three columns, `[=]`, not spread over six.
  const wide = runBuildPlaytest({ scenes: false, steps: [], columns: WIDE.columns, rows: WIDE.rows })
  assert.equal(wide.layout.viewport.width, 72)
  const last = wide.frames.at(-1)
  assert.ok(last !== undefined)
  assert.match(frameToText(last.frame), /\[=\]/)
  assert.doesNotMatch(frameToText(last.frame), /\[ = \]/, "a tile was drawn two columns wide")
})

class FakeStdout extends EventEmitter {
  isTTY = true
  columns = WIDE.columns
  rows = WIDE.rows
  lastWrite = ""
  write(text: string): boolean {
    this.lastWrite = text
    return true
  }
}

class FakeStdin extends EventEmitter {
  isTTY = true
  setRawMode(): this {
    return this
  }
  resume(): this {
    return this
  }
  pause(): this {
    return this
  }
}

const settle = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

test("the live screen at 128 columns draws a tile one column wide too", async () => {
  const stdout = new FakeStdout()
  const stdin = new FakeStdin()
  const exits: number[] = []
  void runBuildPhase({
    settings: { ...DEFAULT_SETTINGS, capability: "monochrome" },
    scenes: false,
    backend: "ansi",
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    exit: (code) => {
      exits.push(code)
    },
  })
  await settle(30)
  assert.match(stdout.lastWrite, /\[=\]/, "the Nexus is not three columns")
  assert.doesNotMatch(stdout.lastWrite, /\[ = \]/, "a tile was drawn two columns wide")
  stdin.emit("data", Buffer.from([3]))
  await settle(30)
  assert.deepEqual(exits, [0])
})

// --- A reach, the build range and the room a Barracks keeps -------------------------------------------------

test("a reach's outline is its last tiles: from one tile a reach of 6 is a ring two tiles thick on its slants, a reach of 1 what touches", () => {
  // The picture `src/view/reach-outline.ts` draws, `@` the tile reached from: every tile within the reach with a
  // four-way neighbour outside it, the rule's own (`tilesWithin`).
  const picture = [
    "      .      ",
    "    .. ..    ",
    "  ..     ..  ",
    "..    @    ..",
    "  ..     ..  ",
    "    .. ..    ",
    "      .      ",
  ]
  const origin = { x: 20, y: 10 }
  const key = (tile: Coord): string => `${tile.x},${tile.y}`
  const outline = new Set(outlineWithin(origin, ONE, 6).map(key))
  const drawn = picture.map((line, row) =>
    [...line].map((_mark, column) => (outline.has(key({ x: origin.x - 6 + column, y: origin.y - 3 + row })) ? "." : " ")).join(""),
  )
  assert.deepEqual(drawn, picture.map((line) => line.replace("@", " ")))
  assert.equal(outline.size, picture.join("").split(".").length - 1, "the outline reaches past the picture")
  // A reach of 1 is touching along a side, the tile straight above as much as the one beside; a reach of 0 has none.
  assert.deepEqual(outlineWithin(origin, ONE, 1), [{ x: 20, y: 9 }, { x: 19, y: 10 }, { x: 21, y: 10 }, { x: 20, y: 11 }])
  assert.deepEqual(outlineWithin(origin, ONE, 0), [])
  // Round a body, never on it: a Barracks's reach of 1 is the ten tiles touching its sides.
  const barracks = FIXTURE_REGISTRY.get(BARRACKS).footprint
  assert.equal(outlineWithin(origin, barracks, 1).length, 10)
  assert.ok(outlineWithin(origin, barracks, 4).every((tile) => !barracks.some((offset) => origin.x + offset.x === tile.x && origin.y + offset.y === tile.y)))
})

test("a Turret's reach round its ghost is 13 tiles wide and 7 tall: its range of 6 is six columns either side and three rows up and down", () => {
  assert.equal(FIXTURE_REGISTRY.get(TURRET).attack?.range, 6)
  const centre = { x: 25, y: 10 }
  assert.deepEqual(extent(reachOutline(centre, ONE, 6).map(({ tile }) => tile)), { width: 13, height: 7 })
  // And as the screen draws it round the armed Turret's ghost, on open ground, one stroke a tile.
  const side = buildSide({ context: field(), cursor: centre })
  keys(side, "3")
  moveTo(side, centre)
  const frame = compose(side)
  const drawn: Coord[] = []
  for (let row = 0; row < frame.height; row += 1) {
    for (let column = 0; column < frame.width; column += 1) {
      const cell = cellAt(frame, column, row)
      if (!STROKES.includes(cell.glyph) || cell.style.dim !== true) continue
      if (cell.style.fgRole !== "chrome.hotkey" && cell.style.fgRole !== "chrome.muted") continue
      const tile = tileAtCell(side.layout, side.build.state.camera, column, row)
      if (tile !== null) drawn.push(tile)
    }
  }
  assert.deepEqual(extent(drawn), { width: 13, height: 7 })
  assert.equal(drawn.length, reachOutline(centre, ONE, 6).length)
})

test("the build range reaches six columns and three rows from a standing building; the dotted ground is that range; what it allows is placed, what it does not is refused", () => {
  const side = buildSide({ context: field(), cursor: { x: 11, y: 12 } })
  const range = buildRange(side.context, side.build.state)
  // The Nexus stands on 10,8 to 12,9: six columns either side of it, three rows above and below.
  assert.ok(range.has({ x: 18, y: 8 }) && !range.has({ x: 19, y: 8 }), "six columns east")
  assert.ok(range.has({ x: 4, y: 9 }) && !range.has({ x: 3, y: 9 }), "six columns west")
  assert.ok(range.has({ x: 11, y: 5 }) && !range.has({ x: 11, y: 4 }), "three rows north")
  assert.ok(range.has({ x: 11, y: 12 }) && !range.has({ x: 11, y: 13 }), "three rows south")
  // A row up costs two columns of it: four columns east on the row above, two on the row above that.
  assert.ok(range.has({ x: 16, y: 7 }) && !range.has({ x: 17, y: 7 }))
  assert.ok(range.has({ x: 14, y: 6 }) && !range.has({ x: 15, y: 6 }))

  // Armed, the lit ground is exactly that range, every tile in view.
  keys(side, "3")
  moveTo(side, { x: 30, y: 15 })
  const frame = compose(side)
  const { camera, viewport } = side.build.state
  for (let y = camera.y; y < camera.y + viewport.height; y += 1) {
    for (let x = camera.x; x < camera.x + viewport.width; x += 1) {
      // The ghost under the cursor, and the Nexus standing on its own tiles, are drawn over the ground.
      if ((x === 30 && y === 15) || (x >= 10 && x <= 12 && y >= 8 && y <= 9)) continue
      const lit = at(side, frame, { x, y }).style.seeThrough?.role === "chrome.edge"
      assert.equal(lit, range.has({ x, y }), `${x},${y}`)
    }
  }
  // Six columns east of the Nexus is placed; the seventh is refused, and says why.
  moveTo(side, { x: 18, y: 8 })
  keys(side, ENTER)
  assert.deepEqual(side.build.state.planned.map((placement) => placement.anchor), [{ x: 18, y: 8 }], side.build.state.status.text)
  keys(side, "3")
  moveTo(side, { x: 19, y: 8 })
  keys(side, ENTER)
  assert.equal(side.build.state.planned.length, 1)
  assert.match(side.build.state.status.text, /outside your build range/)
  // Three rows north is placed; the fourth is refused.
  moveTo(side, { x: 11, y: 5 })
  keys(side, ENTER)
  assert.equal(side.build.state.planned.length, 2, side.build.state.status.text)
  keys(side, "3")
  moveTo(side, { x: 11, y: 4 })
  keys(side, ENTER)
  assert.equal(side.build.state.planned.length, 2)
  assert.match(side.build.state.status.text, /outside your build range/)
})

test("the room a Barracks keeps: what touches a side is too close, a corner or two columns off is not, and its ticks are exactly where the rule refuses", () => {
  const barracks = [{ contentId: BARRACKS, anchor: { x: 20, y: 8 } }]
  const footprint = FIXTURE_REGISTRY.get(BARRACKS).footprint
  const crowded = (tile: Coord): boolean => crowding(FIXTURE_REGISTRY, barracks, TURRET, tile) !== null
  // The Barracks covers 20,8 to 22,9.
  assert.ok(crowded({ x: 21, y: 7 }), "above")
  assert.ok(crowded({ x: 19, y: 8 }), "beside")
  assert.ok(!crowded({ x: 19, y: 7 }), "the corner")
  assert.ok(!crowded({ x: 18, y: 8 }), "two columns off")
  const apron = new Set(roomApron({ x: 20, y: 8 }, footprint, 1).map((tile) => `${tile.x},${tile.y}`))
  for (let y = 4; y <= 13; y += 1) {
    for (let x = 14; x <= 28; x += 1) {
      const onIt = x >= 20 && x <= 22 && y >= 8 && y <= 9
      assert.equal(apron.has(`${x},${y}`), !onIt && crowded({ x, y }), `${x},${y}`)
    }
  }
})

// --- Slopes, as the screen shows them -----------------------------------------------------------------------

test("the raid panel's bearing reads a row as two columns: ten across and fifteen up is north, PERIMETER's ridge is north-east", () => {
  const nexus = { x: 18, y: 10 }
  // Twenty-three across and nine up, eighteen columns' worth.
  assert.equal(bearing(nexus, { x: 41, y: 1 }), "north-east")
  // Ten across and fifteen up, thirty columns' worth: steeply up the screen.
  assert.equal(bearing(nexus, { x: 28, y: -5 }), "north")
  // Twenty across and five down, ten columns' worth: south-east, past the line between it and east.
  assert.equal(bearing(nexus, { x: 38, y: 15 }), "south-east")
  // Twenty across and two down, four columns' worth: east.
  assert.equal(bearing(nexus, { x: 38, y: 12 }), "east")
})

/** A glyph's own way on screen, in column widths with y down: an arrowhead along a row or a column, and a stroke
 *  corner to corner of a cell one column wide and a row tall (both its ways). */
const GLYPH_WAYS: Readonly<Record<string, readonly (readonly [number, number])[]>> = {
  ">": [[1, 0]],
  "<": [[-1, 0]],
  v: [[0, 1]],
  "^": [[0, -1]],
  "/": [
    [1, -ROW_DISTANCE],
    [-1, ROW_DISTANCE],
  ],
  "\\": [
    [1, ROW_DISTANCE],
    [-1, -ROW_DISTANCE],
  ],
}

const angleBetween = (a: readonly [number, number], b: readonly [number, number]): number => {
  const cos = (a[0] * b[0] + a[1] * b[1]) / (Math.hypot(a[0], a[1]) * Math.hypot(b[0], b[1]))
  return Math.acos(Math.max(-1, Math.min(1, cos)))
}

test("each mark of the raid's trail is the glyph nearest its way on screen, a row two columns tall", () => {
  const ways: (readonly [number, number])[] = []
  for (let dy = -4; dy <= 4; dy += 1) for (let dx = -6; dx <= 6; dx += 1) if (dx !== 0 || dy !== 0) ways.push([dx, dy])
  for (const [dx, dy] of ways) {
    const onScreen = [dx, dy * ROW_DISTANCE] as const
    const nearest = Object.entries(GLYPH_WAYS)
      .map(([glyph, directions]) => ({ glyph, off: Math.min(...directions.map((direction) => angleBetween(onScreen, direction))) }))
      .sort((a, b) => a.off - b.off)[0]?.glyph
    assert.equal(trailGlyph("ascii", dx, dy), nearest, `${dx},${dy}`)
  }
  // The screen's diagonal, two across and one down, is a stroke, as one across and one down is; four across and one
  // down is an arrowhead.
  assert.deepEqual([trailGlyph("ascii", -2, 1), trailGlyph("ascii", 1, 1), trailGlyph("ascii", -4, 1)], ["/", "\\", "<"])
  assert.equal(trailGlyph("unicode", 0, -2), CHROME_GLYPHS.unicode.arrowUp)
})

test("a trail down the screen's diagonal is one stroke, not an arrow turning as it moves: each arrow looks a whole stair on", () => {
  // Two steps across and one down, again and again: the way a unit walks the screen's diagonal.
  const path: Coord[] = [{ x: 40, y: 2 }]
  for (let stair = 0; stair < 8; stair += 1) {
    for (const [dx, dy] of [[-1, 0], [-1, 0], [0, 1]] as const) {
      const last = path.at(-1) as Coord
      path.push({ x: last.x + dx, y: last.y + dy })
    }
  }
  const end = path.at(-1) as Coord
  const target = [{ x: end.x - 1, y: end.y }]
  const index = new Map(path.map((tile, at) => [`${tile.x},${tile.y}`, at]))
  assert.equal(LOOK_AHEAD, ROW_DISTANCE + 1)
  // The arrows that look along the way itself, not at the target: every one the same stroke, still and at every
  // step of its motion.
  for (const elapsedMs of [0, 400, 800, 1200]) {
    const glyphs = new Set(
      trailMarks(path, target, elapsedMs)
        .filter((mark) => (index.get(`${mark.tile.x},${mark.tile.y}`) ?? path.length) + LOOK_AHEAD < path.length)
        .map((mark) => trailGlyph("ascii", mark.dx, mark.dy)),
    )
    assert.deepEqual([...glyphs], ["/"], `at ${elapsedMs} ms`)
  }
  // Looking only two steps on, the same way would read two across at one tile and one across and one down at the
  // next: an arrowhead, then a stroke.
  const twoOn = new Set(path.slice(0, -2).map((tile, at) => trailGlyph("ascii", (path[at + 2] as Coord).x - tile.x, (path[at + 2] as Coord).y - tile.y)))
  assert.deepEqual([...twoOn].sort(), ["/", "<"])
})

test("arming a Turret at the Nexus finds room three columns east before two rows north: the cursor's search counts a row as two tiles", () => {
  const side = buildSide({ cursor: STARTER_START_CURSOR })
  keys(side, "3")
  assert.deepEqual(side.build.state.cursor, { x: 21, y: 10 })
})

// --- Near her, for her voice ----------------------------------------------------------------------------------

/** An entity as far as the voice reads one. */
const entity = (ordinal: number, player: PlayerId, contentId: string, anchor: Coord, hp = 10): EntityState =>
  ({ ordinal, id: `${player}:${contentId.split(".").at(-1)}#${ordinal + 1}`, player, contentId, hp, anchor }) as EntityState

test("near her, for her voice, is her aura's reach by the rule: a trooper falling that many steps off on a slant is not near, straight below her is", () => {
  const her = entity(1, "A", VASSE, { x: 10, y: 10 }, 80)
  const near = FIXTURE_REGISTRY.get(VASSE).aura?.radius
  assert.ok(near !== undefined && near >= 2)
  // One row down and `near - 1` columns across: as many four-way steps as her reach, and one more than it by the rule.
  const aside = entity(2, "A", TROOPER, { x: 10 + near - 1, y: 11 })
  assert.equal(gridSteps(her.anchor, aside.anchor), near)
  assert.equal(gridDistance(her.anchor, aside.anchor), near + 1)
  const below = entity(3, "A", TROOPER, { x: 10, y: 11 })
  const died = (tick: number, who: EntityState): DomainEvent => ({
    kind: "entity.died",
    tick,
    entity: who.id,
    ordinal: who.ordinal,
    player: who.player,
    contentId: who.contentId,
    at: who.anchor,
    killer: "B:raider#9",
  })
  const nearLost = (falls: EntityState): boolean => {
    const cast = [her, aside, below]
    const states = Array.from({ length: 13 }, (_, tick) => ({ tick, entities: cast.filter((each) => each !== falls || tick < 6) }) as unknown as MatchState)
    const timeline = { states, events: [died(6, falls)], registry: FIXTURE_REGISTRY, ticksPerSecond: 12 }
    const speaker = speakerOf(timeline, () => ARMIES.commanders[0]?.barks ?? {})
    assert.ok(speaker !== null)
    assert.equal(speaker.near, near)
    return voiceMoments(timeline, speaker, { resultMs: 1000, won: false }).some((moment) => moment.moment === "unit-lost")
  }
  assert.equal(nearLost(aside), false)
  assert.equal(nearLost(below), true)
  assert.ok(!footprintWithin(her.anchor, ONE, aside.anchor, ONE, near) && footprintWithin(her.anchor, ONE, below.anchor, ONE, near))
})
