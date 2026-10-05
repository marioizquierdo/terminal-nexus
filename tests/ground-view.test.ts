// Tall tiles on screen (the Commander round 6; Mario: "What matters is how intuitive it feels for a human player,
// this is the time to get it right"). The Ground Experiment changes how the Build Phase and its screen measure and
// draw the Grid (`src/build/ground.ts`): square tiles draw two columns a tile at every size; rows x2 and sideways
// x2 draw one, and measure as the battle will — the build range counted in rows so it keeps its height, the room a
// Barracks keeps and every reach the map draws under the battle's measure; and the places that read a slope the
// way the screen shows it know how wide a tile is drawn. As now, every one of them is exactly what it was: the
// rest of the suite holds that.

import { test } from "node:test"
import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import type { Barks } from "../src/armies/barks.ts"
import { ARMIES } from "../src/armies/index.ts"
import { setting } from "../src/build/all-settings.ts"
import { STARTER_START_CURSOR } from "../src/build/catalog.ts"
import type { Ground } from "../src/build/ground.ts"
import { GROUNDS, measureOf } from "../src/build/ground.ts"
import { buildLayout, cellForTile, tileAtCell } from "../src/build/layout.ts"
import type { BuildContext } from "../src/build/state.ts"
import { armRowCost, buildRange, groundTileWidth, openingSettings } from "../src/build/state.ts"
import { crowding } from "../src/build/territory.ts"
import { TUNING } from "../src/build/tuning.ts"
import { runBuildPhase } from "../src/cli/build-phase.ts"
import { foresee, nextRound, startPulse } from "../src/cli/pulse-run.ts"
import { starterContext } from "../src/cli/starter.ts"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import type { DomainEvent } from "../src/events/types.ts"
import { SQUARE, footprintDistance, footprintWithin } from "../src/grid/coords.ts"
import type { Coord, GridMeasure, TerrainId } from "../src/grid/types.ts"
import { runBuildPlaytest } from "../src/playtest/build.ts"
import { parseKeyScript } from "../src/playtest/keys.ts"
import { DEFAULT_SETTINGS } from "../src/settings/types.ts"
import type { EntityState, MatchState, PlayerId } from "../src/state/types.ts"
import { reachOutline, roomApron } from "../src/view/build-areas.ts"
import { trailGlyph, trailMarks } from "../src/view/build-grid.ts"
import { cellAt, frameToText } from "../src/view/frame.ts"
import type { Cell, ReadonlyCellFrame } from "../src/view/frame.ts"
import { AURA_WASH } from "../src/view/pulse-scene.ts"
import type { PulseFrame } from "../src/view/pulse-scene.ts"
import { speakerOf, voiceMoments } from "../src/view/pulse-voice.ts"
import { bearing } from "../src/view/raid-panel.ts"
import { CHROME_GLYPHS } from "../src/view/theme.ts"
import { ENTER, MAXIMUM, MINIMUM, WIDE, buildSide, compose, keys, panelLines } from "./build-helpers.ts"
import type { BuildSide, Side } from "./build-helpers.ts"

const NEXUS = "structure.citizen.nexus"
const BARRACKS = "structure.citizen.barracks"
const TURRET = "structure.bench.beamturret"
const TROOPER = "unit.citizen.trooper"
const VASSE = "unit.citizen.vasse"
const ONE: readonly Coord[] = [{ x: 0, y: 0 }]
const STROKES = ["-", "|", "/", "\\"]

/** What a Build Phase reads its settings from, opened on `ground`. */
const onGround = (ground: Ground) => openingSettings({ experiments: { ground } })

/** PERIMETER's first round, on `ground`. */
const perimeterOn = (ground: Ground): BuildContext => starterContext(undefined, { experiments: { ground } })

/** An open field, 40 x 20, with the Grid Nexus standing at 10,8 to 12,9 and plenty to spend, on `ground`. */
function field(ground: Ground): BuildContext {
  const width = 40
  const height = 20
  const tiles = new Array<TerrainId>(width * height).fill("terrain.plain")
  return {
    ...starterContext(),
    grid: { width, height, tiles },
    standing: [{ contentId: NEXUS, anchor: { x: 10, y: 8 } }],
    field: [],
    incoming: [],
    allotment: 1000,
    experiments: { ground },
  }
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

// --- How wide a tile is drawn --------------------------------------------------------------------------------

test("the tile width follows Ground: square tiles two columns at every size, rows x2 and sideways x2 one, as now as the terminal decides", () => {
  const { grid } = starterContext()
  const widths = (ground: Ground): number[] => [MINIMUM, MAXIMUM, WIDE].map((terminal) => buildLayout(terminal, grid, groundTileWidth(onGround(ground))).tileWidth)
  assert.deepEqual(widths("as-now"), [1, 1, 2])
  assert.deepEqual(widths("rows-x2"), [1, 1, 1])
  assert.deepEqual(widths("sideways-x2"), [1, 1, 1])
  assert.deepEqual(widths("square-tiles"), [2, 2, 2])
  // As now is the adaptive layout itself, at every size.
  for (const terminal of [MINIMUM, MAXIMUM, WIDE]) assert.deepEqual(buildLayout(terminal, grid, groundTileWidth(onGround("as-now"))), buildLayout(terminal, grid))
  // At 80 x 24: 24 tiles across with square tiles, 49 with one column a tile; 18 rows either way.
  assert.deepEqual(buildLayout(MINIMUM, grid, 2).viewport, { width: 24, height: 18 })
  assert.deepEqual(buildLayout(MINIMUM, grid, 1).viewport, { width: 49, height: 18 })
  // At 128 columns, where as now goes two columns a tile, a row counting two keeps one: 72 tiles across.
  assert.deepEqual(buildLayout(WIDE, grid, 1).viewport.width, 72)
})

test("at 80 x 24 square tiles draw two columns a tile and the screen still works; rows x2 draws one", () => {
  const square = buildSide({ context: perimeterOn("square-tiles"), cursor: STARTER_START_CURSOR })
  const rows = buildSide({ context: perimeterOn("rows-x2"), cursor: STARTER_START_CURSOR })
  const asNow = buildSide({ cursor: STARTER_START_CURSOR })
  assert.equal(square.layout.tileWidth, 2)
  assert.equal(rows.layout.tileWidth, 1)
  const frame = compose(square)
  // The whole terminal, every glyph on one cell; the Nexus a glyph and a blank a tile.
  assert.equal(frame.width, MINIMUM.columns)
  assert.equal(frame.height, MINIMUM.rows)
  assert.match(frameToText(frame), /\[ = \]/)
  assert.match(frameToText(compose(rows)), /\[=\]/)
  // The menu and the bottom line say what they always say, whatever a tile's width (24 tiles of two columns are a
  // column narrower than 49 of one, so the frame's right side is a column further in).
  assert.deepEqual(panelLines(square, frame), panelLines(asNow, compose(asNow)))
  const words = (side: Side, shown: ReadonlyCellFrame): string => (frameToText(shown).split("\n")[side.layout.footerRow] ?? "").replace(/^\s*\|\s|\s*\|\s*$/g, "")
  assert.equal(words(square, frame), words(asNow, compose(asNow)))
  // A placement still goes where it is put: a Turret armed and placed, two columns a tile.
  keys(square, "3", ENTER)
  assert.equal(square.build.state.planned.length, 1, square.build.state.status.text)
})

test("flipping Ground in Settings lays the scripted playtest out again at once, and back", () => {
  // `d` opens Settings at its first Experiment; Ground is the list's last setting, over Export settings.
  const run = runBuildPlaytest({ scenes: false, steps: parseKeyScript("d End Up Left Esc d End Up Right Esc") })
  const flipped = run.frames[4]
  assert.ok(flipped !== undefined)
  assert.equal(setting(flipped.state, "ground"), "square-tiles")
  assert.deepEqual(flipped.state.viewport, { width: 24, height: 18 }, "the Settings change did not lay the map out again")
  // With Settings closed the map is drawn two columns a tile.
  const closed = run.frames[5]
  assert.ok(closed !== undefined)
  assert.match(frameToText(closed.frame), /\[ = \]/)
  // And back to as now: one column a tile at 80 x 24.
  const back = run.frames.at(-1)
  assert.ok(back !== undefined)
  assert.equal(setting(back.state, "ground"), "as-now")
  assert.deepEqual(back.state.viewport, { width: 49, height: 18 })
  assert.equal(run.layout.tileWidth, 1)
  assert.match(frameToText(back.frame), /\[=\]/)
})

// --- The live screen, on a fake terminal -------------------------------------------------------------------------

class FakeStdout extends EventEmitter {
  isTTY = true
  columns = 80
  rows = 24
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

test("flipping Ground in Settings on the live screen lays it out again at once, as a resize does", async () => {
  const stdout = new FakeStdout()
  const stdin = new FakeStdin()
  const exits: number[] = []
  const session = runBuildPhase({
    settings: { ...DEFAULT_SETTINGS, capability: "monochrome" },
    scenes: false,
    backend: "ansi",
    stdout: stdout as unknown as NodeJS.WriteStream,
    stdin: stdin as unknown as NodeJS.ReadStream,
    exit: (code) => {
      exits.push(code)
    },
  })
  // The frame's top line: the whole 80 columns one column a tile, 79 at two (24 tiles of two, the panel, borders).
  const one = `+${"-".repeat(78)}+`
  const two = `+${"-".repeat(77)}+`
  await settle(30)
  assert.ok(stdout.lastWrite.includes(one), "did not open one column a tile")
  for (const key of ["d", "\u001b[F", "\u001b[A", "\u001b[D"]) {
    stdin.emit("data", key)
    await settle(10)
  }
  assert.ok(stdout.lastWrite.includes(two) && !stdout.lastWrite.includes(one), "square tiles were not drawn at once")
  stdin.emit("data", "\u001b[C")
  await settle(10)
  assert.ok(stdout.lastWrite.includes(one), "as now did not come back at once")
  stdin.emit("data", Buffer.from([3]))
  await settle(30)
  void session
  assert.deepEqual(exits, [0])
})

// --- A reach, as the kernel measures it ----------------------------------------------------------------------

test("a reach's outline is the kernel's own: the last tiles it reaches, the old ring as now and with square tiles", () => {
  const centre = { x: 20, y: 10 }
  for (const ground of GROUNDS) {
    const measure = measureOf(ground)
    const ring = reachOutline(centre, ONE, 6, measure)
    const within = (tile: Coord): boolean => footprintWithin(centre, ONE, tile, ONE, 6, measure)
    const onRing = new Set(ring.map(({ tile }) => `${tile.x},${tile.y}`))
    // Every tile reached with a four-way neighbour that is not, the footprint aside, and nothing else.
    for (let y = centre.y - 8; y <= centre.y + 8; y += 1) {
      for (let x = centre.x - 14; x <= centre.x + 14; x += 1) {
        const tile = { x, y }
        const edge = within(tile) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !within({ x: x + (dx as number), y: y + (dy as number) }))
        assert.equal(onRing.has(`${x},${y}`), edge && footprintDistance(centre, ONE, tile, ONE) > 0, `${ground}: ${x},${y}`)
      }
    }
  }
  // As now and with square tiles it is exactly the old ring: every tile exactly its range away.
  const old = reachOutline(centre, ONE, 6)
  assert.equal(old.length, 24)
  for (const { tile } of old) assert.equal(footprintDistance(centre, ONE, tile, ONE), 6)
  assert.deepEqual(reachOutline(centre, ONE, 6, measureOf("square-tiles")), old)
  // A wider footprint as well: a Barracks's reach of 2, measured to its nearest tile.
  const footprint = FIXTURE_REGISTRY.get(BARRACKS).footprint
  for (const { tile } of reachOutline(centre, footprint, 2, SQUARE)) assert.equal(footprintDistance(centre, footprint, tile, ONE), 2)
})

test("a Turret's reach on the ghost: 13 wide by 7 tall with rows x2 (its range is 6), 25 by 13 sideways x2, 13 by 13 as now", () => {
  assert.equal(FIXTURE_REGISTRY.get(TURRET).attack?.range, 6)
  const expected: Readonly<Record<Ground, Readonly<{ width: number; height: number }>>> = {
    "as-now": { width: 13, height: 13 },
    "rows-x2": { width: 13, height: 7 },
    "sideways-x2": { width: 25, height: 13 },
    "square-tiles": { width: 13, height: 13 },
  }
  for (const ground of GROUNDS) {
    // The pure outline.
    assert.deepEqual(extent(reachOutline({ x: 25, y: 10 }, ONE, 6, measureOf(ground)).map(({ tile }) => tile)), expected[ground], ground)
    // And as the screen draws it round the armed Turret's ghost, on open ground, at a size with room for all of it.
    const side = buildSide({ context: field(ground), cursor: { x: 25, y: 10 }, terminal: ground === "square-tiles" ? MAXIMUM : MINIMUM })
    keys(side, "3")
    moveTo(side, { x: 25, y: 10 })
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
    assert.deepEqual(extent(drawn), expected[ground], `${ground}: the drawn outline`)
    // Two columns a tile, a stroke is drawn on a tile's first column only.
    assert.equal(drawn.length, reachOutline({ x: 25, y: 10 }, ONE, 6, measureOf(ground)).length, ground)
  }
})

// --- The build range, counted in rows ------------------------------------------------------------------------

test("with rows x2 the build range reaches 6 columns and 3 rows from a standing building; what the lit ground allows is placed, what it does not is refused", () => {
  const side = buildSide({ context: field("rows-x2"), cursor: { x: 11, y: 12 } })
  const range = buildRange(side.context, side.build.state)
  // The Nexus stands on 10,8 to 12,9: six columns either side of it, three rows above and below.
  assert.ok(range.has({ x: 18, y: 8 }) && !range.has({ x: 19, y: 8 }), "six columns east")
  assert.ok(range.has({ x: 4, y: 9 }) && !range.has({ x: 3, y: 9 }), "six columns west")
  assert.ok(range.has({ x: 11, y: 5 }) && !range.has({ x: 11, y: 4 }), "three rows north")
  assert.ok(range.has({ x: 11, y: 12 }) && !range.has({ x: 11, y: 13 }), "three rows south")
  // A row up costs two columns of it: four columns east on the row above, two on the row above that.
  assert.ok(range.has({ x: 16, y: 7 }) && !range.has({ x: 17, y: 7 }))
  assert.ok(range.has({ x: 14, y: 6 }) && !range.has({ x: 15, y: 6 }))
  // As now, three and three.
  const asNow = buildRange(field("as-now"), onGround("as-now"))
  assert.ok(asNow.has({ x: 15, y: 8 }) && !asNow.has({ x: 16, y: 8 }))
  assert.ok(asNow.has({ x: 11, y: 5 }) && !asNow.has({ x: 11, y: 4 }))

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

test("the room a Barracks keeps is measured as the battle will be, and its ticks are where the rule refuses", () => {
  const barracks = [{ contentId: BARRACKS, anchor: { x: 20, y: 8 } }]
  const footprint = FIXTURE_REGISTRY.get(BARRACKS).footprint
  const crowded = (ground: Ground, tile: Coord): boolean => crowding(FIXTURE_REGISTRY, barracks, TURRET, tile, undefined, measureOf(ground)) !== null
  for (const ground of GROUNDS) {
    // Touching a side is too close whatever a row counts; a corner is not.
    assert.ok(crowded(ground, { x: 21, y: 7 }), `${ground}: above`)
    assert.ok(crowded(ground, { x: 19, y: 8 }), `${ground}: beside`)
    assert.ok(!crowded(ground, { x: 19, y: 7 }), `${ground}: the corner`)
    // Two columns off, only where sideways is doubled.
    assert.equal(crowded(ground, { x: 18, y: 8 }), ground === "sideways-x2", `${ground}: two columns off`)
    // The ticks drawn round it are exactly the tiles the rule refuses a Turret on.
    const apron = new Set(roomApron({ x: 20, y: 8 }, footprint, 1, measureOf(ground)).map((tile) => `${tile.x},${tile.y}`))
    for (let y = 4; y <= 13; y += 1) {
      for (let x = 14; x <= 28; x += 1) {
        const onIt = x >= 20 && x <= 22 && y >= 8 && y <= 9
        assert.equal(apron.has(`${x},${y}`), !onIt && crowded(ground, { x, y }), `${ground}: ${x},${y}`)
      }
    }
  }
})

// --- Slopes read as the screen shows them ---------------------------------------------------------------------

test("with square tiles the raid panel's bearing reads a row as one tile; one column a tile, as two", () => {
  const nexus = { x: 18, y: 10 }
  // PERIMETER's ridge, 23 across and 9 up: north-east where a row looks two tiles tall, east where it looks one.
  assert.equal(bearing(nexus, { x: 41, y: 1 }), "north-east")
  assert.equal(bearing(nexus, { x: 41, y: 1 }, 1), "north-east")
  assert.equal(bearing(nexus, { x: 41, y: 1 }, 2), "east")
  // Ten across and fifteen up: north one column a tile, north-east two.
  assert.equal(bearing(nexus, { x: 28, y: -5 }, 1), "north")
  assert.equal(bearing(nexus, { x: 28, y: -5 }, 2), "north-east")
  // On screen, PERIMETER's first round: the probe comes from the north-east at one column a tile, and from the
  // east with square tiles, as the map then shows it.
  const words = (ground: Ground): string => frameToText(runBuildPlaytest({ steps: parseKeyScript("Esc"), experiments: { ground } }).frames.at(-1)?.frame as ReadonlyCellFrame)
  assert.match(words("as-now"), /5 from the north-east/)
  assert.match(words("rows-x2"), /5 from the north-east/)
  assert.match(words("square-tiles"), /5 from the east/)
})

/** A glyph's own way on screen, in column widths with y down: an arrowhead along a row or a column, and a stroke
 *  corner to corner of a cell about twice as tall as it is wide (both its ways). */
const GLYPH_WAYS: Readonly<Record<string, readonly (readonly [number, number])[]>> = {
  ">": [[1, 0]],
  "<": [[-1, 0]],
  v: [[0, 1]],
  "^": [[0, -1]],
  "/": [
    [1, -2],
    [-1, 2],
  ],
  "\\": [
    [1, 2],
    [-1, -2],
  ],
}

const angleBetween = (a: readonly [number, number], b: readonly [number, number]): number => {
  const cos = (a[0] * b[0] + a[1] * b[1]) / (Math.hypot(a[0], a[1]) * Math.hypot(b[0], b[1]))
  return Math.acos(Math.max(-1, Math.min(1, cos)))
}

test("with square tiles the trail's arrowheads read a row as one tile: at either width each mark is the glyph nearest its way on screen", () => {
  // A trail's mark points two steps on along a way of four-way steps, or at the target beside it.
  const ways: (readonly [number, number])[] = [[2, 0], [-2, 0], [0, 2], [0, -2], [1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]]
  for (const tileWidth of [1, 2]) {
    for (const [dx, dy] of ways) {
      // On screen a tile is `tileWidth` columns wide and a row two column widths tall.
      const onScreen = [dx * tileWidth, dy * 2] as const
      const nearest = Object.entries(GLYPH_WAYS)
        .map(([glyph, directions]) => ({ glyph, off: Math.min(...directions.map((direction) => angleBetween(onScreen, direction))) }))
        .sort((a, b) => a.off - b.off)[0]?.glyph
      assert.equal(trailGlyph("ascii", dx, dy), nearest, `${dx},${dy} at ${tileWidth} column(s) a tile`)
    }
  }
  // A row as one tile with square tiles: a run as far down as across is the same stroke either way round.
  assert.equal(trailGlyph("ascii", 1, 1), "\\")
  assert.equal(trailGlyph("ascii", -1, 1), "/")
  assert.equal(trailGlyph("unicode", 0, -2), CHROME_GLYPHS.unicode.arrowUp)
  // On screen, PERIMETER's first round with square tiles: every mark in view is its way's glyph, on its tile's first
  // column, the second left blank.
  const side = buildSide({ context: perimeterOn("square-tiles"), cursor: STARTER_START_CURSOR, terminal: MAXIMUM, startPulse, nextRound, foresee })
  assert.equal(side.layout.tileWidth, 2)
  const frame = compose(side)
  const { camera, viewport } = side.build.state
  let seen = 0
  for (const group of side.build.raid() ?? []) {
    if (group.target === null) continue
    for (const mark of trailMarks(group.path, group.target.tiles)) {
      const { tile } = mark
      if (tile.x < camera.x || tile.x >= camera.x + viewport.width || tile.y < camera.y || tile.y >= camera.y + viewport.height) continue
      const cell = cellForTile(side.layout, camera, tile)
      if (cellAt(frame, cell.x, cell.y).glyph !== trailGlyph("ascii", mark.dx, mark.dy)) continue
      assert.equal(cellAt(frame, cell.x + 1, cell.y).glyph, " ", `${tile.x},${tile.y}: the second column`)
      seen += 1
    }
  }
  assert.ok(seen >= 3, `only ${seen} trail marks drawn in view`)
})

test("arming counts a row as one tile with square tiles, as two otherwise: on PERIMETER's opening a Turret goes up, not across", () => {
  assert.equal(armRowCost(onGround("square-tiles")), 1)
  for (const ground of ["as-now", "rows-x2", "sideways-x2"] as const) assert.equal(armRowCost(onGround(ground)), TUNING.armVerticalCost)
  const armedAt = (ground: Ground): Coord => {
    const side = buildSide({ context: perimeterOn(ground), cursor: STARTER_START_CURSOR })
    keys(side, "3")
    return side.build.state.cursor
  }
  // From the Nexus, three tiles east is nearer than two rows north where a row looks twice as tall; with square
  // tiles two rows north is nearer.
  assert.deepEqual(armedAt("as-now"), { x: 21, y: 10 })
  assert.deepEqual(armedAt("rows-x2"), { x: 21, y: 10 })
  assert.deepEqual(armedAt("square-tiles"), { x: 18, y: 8 })
})

// --- In battle: her aura and "near her", as the battle measured ------------------------------------------------

const ROWS_X2: GridMeasure = measureOf("rows-x2")
const SIDEWAYS_X2: GridMeasure = measureOf("sideways-x2")

/** PERIMETER's first battle on `ground`, Vasse silent so nothing of hers covers the ground. */
function battle(ground: Ground): BuildSide {
  const side = buildSide({ context: perimeterOn(ground), cursor: STARTER_START_CURSOR, startPulse, nextRound, barksOf: (): Barks => ({}) })
  side.build.dispatch({ kind: "pick-nexus", index: 0 })
  side.build.run([{ kind: "open-battle-round" }, { kind: "start-pulse" }])
  assert.ok(side.build.pulse !== null, "the round's Pulse did not start")
  side.build.advance(0)
  return side
}

/** `pulse` with its battle's state carrying `measure`, as a battle under the Ground Experiment does. */
const measured = (pulse: PulseFrame, measure: GridMeasure): PulseFrame => ({
  ...pulse,
  sample: { ...pulse.sample, state: { ...pulse.sample.state, measure } as MatchState },
})

test("her aura is drawn as the battle measured it: the old diamond without a measure, twice as wide as tall where a row counts two", () => {
  const side = battle("as-now")
  side.build.advance(2000)
  const pulse = side.build.pulseFrame(side.layout)
  assert.ok(pulse?.aura !== undefined, "no aura while the fight is on")
  const { at: centre, radius } = pulse.aura
  const key = (tile: Coord): string => `${tile.x},${tile.y}`
  // What stands, what an effect draws a glyph on, and the cursor: drawn over the ground, glow and all.
  const covered = new Set([
    ...pulse.sample.state.entities.flatMap((each) => {
      const anchor = pulse.positions.get(each.ordinal) ?? each.anchor
      return FIXTURE_REGISTRY.get(each.contentId).footprint.map((offset) => key({ x: anchor.x + offset.x, y: anchor.y + offset.y }))
    }),
    ...pulse.sample.effects.flatMap((effect) => effect.cells.filter((cell) => cell.glyph !== "").map((cell) => key(cell.tile))),
    key(side.build.state.cursor),
  ])
  const glowing = (frame: ReadonlyCellFrame): Set<string> => {
    const lit = new Set<string>()
    for (let dy = -radius - 1; dy <= radius + 1; dy += 1) {
      for (let dx = -2 * radius - 1; dx <= 2 * radius + 1; dx += 1) {
        const tile = { x: centre.x + dx, y: centre.y + dy }
        if (covered.has(key(tile))) continue
        const style = at(side, frame, tile).style
        if (style.seeThrough?.role === "player.a" && style.seeThrough.alpha === AURA_WASH) lit.add(key(tile))
      }
    }
    return lit
  }
  for (const measure of [SQUARE, ROWS_X2, SIDEWAYS_X2]) {
    const lit = glowing(compose(side, { pulse: measured(pulse, measure) }, "truecolor"))
    for (let dy = -radius - 1; dy <= radius + 1; dy += 1) {
      for (let dx = -2 * radius - 1; dx <= 2 * radius + 1; dx += 1) {
        const tile = { x: centre.x + dx, y: centre.y + dy }
        if (covered.has(key(tile))) continue
        assert.equal(lit.has(key(tile)), footprintWithin(centre, ONE, tile, ONE, radius, measure), `${JSON.stringify(measure)}: ${key(tile)}`)
      }
    }
  }
  // A battle that carries no measure is one under the rules as they always were: the same glow as SQUARE's.
  assert.deepEqual(glowing(compose(side, {}, "truecolor")), glowing(compose(side, { pulse: measured(pulse, SQUARE) }, "truecolor")))
})

test("a battle with square tiles plays on the Build Phase's own layout, two columns a tile at 80 x 24", () => {
  const side = battle("square-tiles")
  side.build.advance(2000)
  assert.equal(side.layout.tileWidth, 2)
  const frame = compose(side)
  assert.equal(frame.width, MINIMUM.columns)
  assert.match(frameToText(frame), /\[ = \]/)
})

/** An entity as far as the voice reads one. */
const entity = (ordinal: number, player: PlayerId, contentId: string, anchor: Coord, hp = 10): EntityState =>
  ({ ordinal, id: `${player}:${contentId.split(".").at(-1)}#${ordinal + 1}`, player, contentId, hp, anchor }) as EntityState

test("near her, for her voice, is measured as the battle measured it", () => {
  const her = entity(1, "A", VASSE, { x: 10, y: 10 }, 80)
  const aside = entity(2, "A", TROOPER, { x: 12, y: 11 })
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
  const nearLost = (falls: EntityState, measure?: GridMeasure): boolean => {
    const cast = [her, aside, below]
    const states = Array.from(
      { length: 13 },
      (_, tick) =>
        ({
          tick,
          entities: cast.filter((each) => each !== falls || tick < 6),
          ...(measure === undefined ? {} : { measure }),
        }) as unknown as MatchState,
    )
    const timeline = { states, events: [died(6, falls)], registry: FIXTURE_REGISTRY, ticksPerSecond: 12 }
    const speaker = speakerOf(timeline, () => ARMIES.commanders[0]?.barks ?? {})
    assert.ok(speaker !== null)
    assert.equal(speaker.near, 3)
    return voiceMoments(timeline, speaker, { resultMs: 1000, won: false }).some((moment) => moment.moment === "unit-lost")
  }
  // Two across and one down: three tiles away as the rules always measured, four with a row counting two.
  assert.equal(nearLost(aside), true)
  assert.equal(nearLost(aside, SQUARE), true)
  assert.equal(nearLost(aside, ROWS_X2), false)
  assert.equal(nearLost(aside, SIDEWAYS_X2), true)
  // Straight below her is near her whatever a row counts.
  assert.equal(nearLost(below, ROWS_X2), true)
})
