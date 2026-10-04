// The two areas the Build Phase draws while a building is placed (the owner, round 4: "a cool and unobstrussive
// way to show where the turrets will reach ... They also can only be built within the build-range of the other
// buildings, so we should also reflect that"): a building's reach, an outline round the ghost, and the build
// range, a dotted, faintly lit floor. Two different marks for two different things, carried by glyphs so
// monochrome shows both, and neither drawn over the raid's trail. The rule they show is
// tests/build-territory.test.ts's.

import { test } from "node:test"
import assert from "node:assert/strict"
import { cellForTile } from "../src/build/layout.ts"
import { buildRange } from "../src/build/state.ts"
import { foresee, nextRound, startPulse } from "../src/cli/pulse-run.ts"
import { footprintDistance } from "../src/grid/coords.ts"
import type { Coord } from "../src/grid/types.ts"
import { reachOf, reachOutline } from "../src/view/build-areas.ts"
import { trailMarks } from "../src/view/build-grid.ts"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import { cellAt, frameToAnsi, frameToText, offendingGlyph } from "../src/view/frame.ts"
import type { Cell, ReadonlyCellFrame } from "../src/view/frame.ts"
import { STARTER_START_CURSOR } from "../src/build/catalog.ts"
import { ESC, MINIMUM, WIDE, buildSide, compose, keys } from "./build-helpers.ts"
import type { Side } from "./build-helpers.ts"
import { isColourCode, sgrCodes } from "./helpers.ts"

const TURRET = "structure.bench.beamturret"
const ONE: readonly Coord[] = [{ x: 0, y: 0 }]

/** The cell a Grid tile is drawn on, in `frame`. */
const at = (side: Side, frame: ReadonlyCellFrame, tile: Coord): Cell => {
  const cell = cellForTile(side.layout, side.build.state.camera, tile)
  return cellAt(frame, cell.x, cell.y)
}

/** Moves the map cursor onto `tile`. */
function moveTo(side: Side, tile: Coord): void {
  const { cursor } = side.build.state
  side.build.run([{ kind: "move-cursor", dx: tile.x - cursor.x, dy: tile.y - cursor.y }])
}

/** The open ground of the starter map (plain, nothing on it) — where an outline or a dot may be drawn. */
function open(side: Side, tile: Coord): boolean {
  const { grid } = side.context
  if (grid.tiles[tile.y * grid.width + tile.x] !== "terrain.plain") return false
  const taken = [...side.context.standing, ...side.build.state.planned, ...(side.context.field ?? []), ...(side.context.incoming ?? [])]
  return !taken.some((thing) =>
    FIXTURE_REGISTRY.get(thing.contentId).footprint.some((offset) => thing.anchor.x + offset.x === tile.x && thing.anchor.y + offset.y === tile.y),
  )
}

// --- A building's reach ------------------------------------------------------------------------------

test("a reach's outline is every tile exactly its range away, measured as range is, with a stroke for its side", () => {
  const ring = reachOutline({ x: 10, y: 10 }, ONE, 6)
  assert.equal(ring.length, 24)
  for (const { tile } of ring) assert.equal(footprintDistance({ x: 10, y: 10 }, ONE, tile, ONE), 6)
  const stroke = (x: number, y: number): string | undefined => ring.find((entry) => entry.tile.x === x && entry.tile.y === y)?.stroke
  // Straight above and below a one-tile building, level; beside it, upright; across the corners, `/` to the
  // north-west and south-east and `\\` to the north-east and south-west.
  assert.equal(stroke(10, 4), "level")
  assert.equal(stroke(10, 16), "level")
  assert.equal(stroke(4, 10), "upright")
  assert.equal(stroke(16, 10), "upright")
  assert.equal(stroke(7, 7), "rise")
  assert.equal(stroke(13, 13), "rise")
  assert.equal(stroke(13, 7), "fall")
  assert.equal(stroke(7, 13), "fall")
  // A wider footprint: measured to its nearest tile, so the outline runs straight along each side.
  const wide = reachOutline({ x: 10, y: 10 }, FIXTURE_REGISTRY.get("structure.citizen.barracks").footprint, 2)
  for (const { tile } of wide) assert.equal(footprintDistance({ x: 10, y: 10 }, FIXTURE_REGISTRY.get("structure.citizen.barracks").footprint, tile, ONE), 2)
  assert.deepEqual(wide.filter((entry) => entry.tile.y === 8).map((entry) => [entry.tile.x, entry.stroke]), [[10, "level"], [11, "level"], [12, "level"]])
  assert.deepEqual(wide.filter((entry) => entry.tile.x === 8).map((entry) => [entry.tile.y, entry.stroke]), [[10, "upright"], [11, "upright"]])
  // What has a reach today: a building with an attack.
  assert.equal(reachOf(FIXTURE_REGISTRY.get(TURRET)), 6)
  assert.equal(reachOf(FIXTURE_REGISTRY.get("structure.citizen.barracks")), null)
})

test("the armed Turret's ghost shows where it will reach: a dim outline on open ground, in the ghost's own look", () => {
  const side = buildSide({ cursor: STARTER_START_CURSOR })
  keys(side, "3")
  const ghost = side.build.state.cursor
  assert.equal(side.build.state.armed, 2)
  const frame = compose(side)
  let drawn = 0
  for (const { tile, stroke } of reachOutline(ghost, ONE, 6)) {
    const cell = at(side, frame, tile)
    if (!open(side, tile)) {
      // Rock, a building, a unit arriving: each keeps its own glyph.
      assert.ok(!["-", "|", "/", "\\"].includes(cell.glyph) || !open(side, tile), `${tile.x},${tile.y}`)
      continue
    }
    assert.equal(cell.glyph, { level: "-", upright: "|", rise: "/", fall: "\\" }[stroke], `${tile.x},${tile.y}`)
    assert.equal(cell.style.fgRole, "chrome.hotkey", "the ghost's colour, where Enter would place it")
    assert.equal(cell.style.dim, true, "quiet")
    drawn += 1
  }
  assert.ok(drawn >= 16, `only ${drawn} strokes were drawn`)
  // Where Enter would refuse, the outline is the refused ghost's grey.
  moveTo(side, { x: 31, y: 10 })
  const refused = compose(side)
  const east = at(side, refused, { x: 37, y: 10 })
  assert.equal(east.glyph, "|")
  assert.equal(east.style.fgRole, "chrome.muted")
})

test("a building with no reach draws none, and a placed Turret shows its reach while the cursor rests on it", () => {
  const side = buildSide({ cursor: STARTER_START_CURSOR })
  keys(side, "1") // a Barracks: no range
  const barracks = compose(side)
  const strokes = (frame: ReadonlyCellFrame): number =>
    frame.cells.filter((cell) => ["-", "|", "/", "\\"].includes(cell.glyph) && cell.style.fgRole === "chrome.hotkey" && cell.style.dim === true).length
  assert.equal(strokes(barracks), 0)
  keys(side, ESC)
  // A Turret planned, then Explore Map over it: its outline; one tile off it, none.
  keys(side, "3", "\r")
  const turret = side.build.state.planned[0]
  assert.ok(turret !== undefined)
  keys(side, "e")
  moveTo(side, turret.anchor)
  assert.ok(strokes(compose(side)) >= 16, "the placed Turret's reach is not drawn under the cursor")
  moveTo(side, { x: turret.anchor.x, y: turret.anchor.y + 1 })
  assert.equal(strokes(compose(side)), 0)
})

// --- The build range ----------------------------------------------------------------------------------

test("while a building is armed, the build range is the dotted ground, lit where colours blend, and only then", () => {
  const side = buildSide({ cursor: STARTER_START_CURSOR })
  // Off the ground's own lattice (every fourth column of every second row), inside the range and outside it.
  const inside = { x: 15, y: 11 }
  const outside = { x: 23, y: 15 }
  const territory = buildRange(side.context, side.build.state)
  assert.ok(territory.has(inside) && !territory.has(outside))
  const before = compose(side)
  assert.equal(at(side, before, inside).glyph, " ", "the ground was dotted before anything was armed")
  keys(side, "3")
  const armed = compose(side)
  const dot = at(side, armed, inside)
  assert.equal(dot.glyph, ".")
  assert.equal(dot.style.fgRole, "terrain.plain")
  assert.equal(dot.style.dim, true)
  assert.deepEqual(dot.style.seeThrough, { role: "chrome.edge", alpha: 0.12 })
  const beyond = at(side, armed, outside)
  assert.equal(beyond.glyph, " ")
  assert.equal(beyond.style.seeThrough, undefined)
  // Every open tile of the range in view takes a dot; nothing outside it gains one.
  const range = side.build.state
  for (let y = range.camera.y; y < range.camera.y + range.viewport.height; y += 1) {
    for (let x = range.camera.x; x < range.camera.x + range.viewport.width; x += 1) {
      const tile = { x, y }
      if (!open(side, tile) || (tile.x === range.cursor.x && tile.y === range.cursor.y)) continue
      const was = at(side, before, tile).glyph
      const now = at(side, armed, tile).glyph
      if (territory.has(tile)) assert.ok(now === "." || ["-", "|", "/", "\\"].includes(now), `${x},${y} inside drew ${now}`)
      else assert.ok(now === was || ["-", "|", "/", "\\"].includes(now), `${x},${y} outside changed from ${was} to ${now}`)
    }
  }
  // Explore Map and the menu draw none of it.
  keys(side, ESC, "e")
  assert.equal(at(side, compose(side), inside).glyph, " ")
})

test("in monochrome both still show, by their glyphs alone: the range's dots and the reach's strokes", () => {
  const side = buildSide({ cursor: STARTER_START_CURSOR })
  keys(side, "3")
  const frame = compose(side, {}, "monochrome")
  const ansi = frameToAnsi(frame, "monochrome")
  assert.equal(sgrCodes(ansi).filter(isColourCode).length, 0, "a colour code in monochrome")
  const ghost = side.build.state.cursor
  // The reach's west end, and a dot of the range beside the Nexus.
  assert.equal(at(side, frame, { x: ghost.x - 6, y: ghost.y }).glyph, "|")
  assert.equal(at(side, frame, { x: 15, y: 11 }).glyph, ".")
  // Two different marks: the range is dots, the reach is strokes, and neither is the other's glyph.
  const text = frameToText(frame)
  assert.match(text, /[|/\\-]/)
  assert.match(text, /\.\.\./, "the range's ground is dotted densely")
})

test("the raid's trail stays as built: a building armed draws neither dots nor strokes over its marks", () => {
  const side = buildSide({ cursor: STARTER_START_CURSOR, startPulse, nextRound, foresee })
  const raid = side.build.raid() ?? []
  assert.ok(raid.length > 0, "PERIMETER's first round brings a raid")
  const marks = raid.flatMap((group) => (group.target === null ? [] : trailMarks(group.path, group.target.tiles))).map((mark) => mark.tile)
  const before = compose(side)
  keys(side, "3")
  // A Turret whose reach crosses the trail, close to the Barracks it goes for.
  moveTo(side, { x: 27, y: 7 })
  const armed = compose(side)
  const inView = (tile: Coord): boolean => {
    const { camera, viewport } = side.build.state
    return tile.x >= camera.x && tile.x < camera.x + viewport.width && tile.y >= camera.y && tile.y < camera.y + viewport.height
  }
  let compared = 0
  for (const tile of marks.filter(inView)) {
    if (tile.x === side.build.state.cursor.x && tile.y === side.build.state.cursor.y) continue
    assert.equal(at(side, armed, tile).glyph, at(side, before, tile).glyph, `the trail mark at ${tile.x},${tile.y} was drawn over`)
    compared += 1
  }
  assert.ok(compared >= 4, `only ${compared} trail marks were in view`)
})

test("at 80x24 and at two columns a tile, the frame keeps its size and its glyphs, armed and refused", () => {
  for (const terminal of [MINIMUM, WIDE]) {
    for (const glyphPack of ["ascii", "unicode"] as const) {
      const side = buildSide({ cursor: STARTER_START_CURSOR, terminal })
      keys(side, "3")
      for (const tile of [side.build.state.cursor, { x: 31, y: 10 }]) {
        moveTo(side, tile)
        const frame = compose(side, { glyphPack })
        assert.equal(frame.width, terminal.columns)
        assert.equal(frame.height, terminal.rows)
        assert.equal(offendingGlyph(frame), null, `${terminal.columns}x${terminal.rows} ${glyphPack}`)
        const footer = frameToText(frame).split("\n")[side.layout.footerRow] ?? ""
        assert.ok(footer.length <= terminal.columns)
      }
    }
  }
})
