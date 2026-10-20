// The two areas the Build Phase draws while a building is placed (the owner, round 4: "a cool and unobstrussive
// way to show where the turrets will reach ... They also can only be built within the build-range of the other
// buildings, so we should also reflect that"): a building's reach, an outline round the ghost, and the build
// range, a dotted, faintly lit floor. Two different marks for two different things, carried by glyphs so
// monochrome shows both, and neither drawn over the raid's trail. The rule they show is
// tests/build-territory.test.ts's.

import { test } from "node:test"
import assert from "node:assert/strict"
import { setting } from "../src/build/all-settings.ts"
import { cellForTile } from "../src/build/layout.ts"
import { armedPreview, buildRange, buildingsOn } from "../src/build/state.ts"
import { DEFAULT_LEVEL, openRound } from "../src/cli/levels.ts"
import { foresee, nextRound, startPulse } from "../src/cli/pulse-run.ts"
import { starterContext } from "../src/cli/starter.ts"
import { footprintDistance, footprintSteps, footprintWithin } from "../src/grid/coords.ts"
import type { Coord } from "../src/grid/types.ts"
import { reachOf, reachOutline, unitReachOf } from "../src/view/build-areas.ts"
import { trailMarks, trailTiles } from "../src/view/build-grid.ts"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import { cellAt, frameToAnsi, frameToText, offendingGlyph } from "../src/view/frame.ts"
import type { Cell, ReadonlyCellFrame } from "../src/view/frame.ts"
import { STARTER_START_CURSOR } from "../src/build/catalog.ts"
import { ENTER, ESC, MINIMUM, TAB, WIDE, buildSide, compose, keys } from "./build-helpers.ts"
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

/** Whether `tile` is within a reach of `radius` of a footprint at `anchor` (the kernel's own test) and has a four-way
 *  neighbour that is not: one of the last tiles the reach covers. */
function onEdge(anchor: Coord, footprint: readonly Coord[], radius: number, tile: Coord): boolean {
  const within = (x: number, y: number): boolean => footprintWithin(anchor, footprint, { x, y }, ONE, radius)
  return within(tile.x, tile.y) && !(within(tile.x - 1, tile.y) && within(tile.x + 1, tile.y) && within(tile.x, tile.y - 1) && within(tile.x, tile.y + 1))
}

test("a reach's outline is the last tiles it reaches, measured as range is, with a stroke for its side", () => {
  const centre = { x: 10, y: 10 }
  const ring = reachOutline(centre, ONE, 6)
  for (const { tile } of ring) assert.ok(onEdge(centre, ONE, 6, tile), `${tile.x},${tile.y} is not an edge of the reach`)
  // A row counts two columns: 6 columns either side, 3 rows up and down, two tiles a row along each slant.
  const rows = new Map<number, number[]>()
  for (const { tile } of ring) rows.set(tile.y - centre.y, [...(rows.get(tile.y - centre.y) ?? []), tile.x - centre.x])
  assert.deepEqual(
    [...rows.entries()],
    [
      [-3, [0]],
      [-2, [-2, -1, 1, 2]],
      [-1, [-4, -3, 3, 4]],
      [0, [-6, -5, 5, 6]],
      [1, [-4, -3, 3, 4]],
      [2, [-2, -1, 1, 2]],
      [3, [0]],
    ],
  )
  const stroke = (x: number, y: number): string | undefined => ring.find((entry) => entry.tile.x === x && entry.tile.y === y)?.stroke
  // Straight above and below a one-tile building, level; beside it, upright; across the corners, `/` to the
  // north-west and south-east and `\\` to the north-east and south-west.
  assert.equal(stroke(10, 7), "level")
  assert.equal(stroke(10, 13), "level")
  assert.equal(stroke(4, 10), "upright")
  assert.equal(stroke(16, 10), "upright")
  assert.equal(stroke(8, 8), "rise")
  assert.equal(stroke(12, 12), "rise")
  assert.equal(stroke(12, 8), "fall")
  assert.equal(stroke(8, 12), "fall")
  // A wider footprint: measured to its nearest tile, so the outline runs straight along each side — a reach of 2
  // is a row above and below it, and two columns either side.
  const footprint = FIXTURE_REGISTRY.get("structure.citizen.barracks").footprint
  const wide = reachOutline(centre, footprint, 2)
  for (const { tile } of wide) assert.ok(onEdge(centre, footprint, 2, tile), `${tile.x},${tile.y} is not an edge of the Barracks's reach`)
  assert.deepEqual(wide.filter((entry) => entry.tile.y === 9).map((entry) => [entry.tile.x, entry.stroke]), [[10, "level"], [11, "level"], [12, "level"]])
  assert.equal(wide.filter((entry) => entry.tile.y === 8).length, 0)
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
  // Where Enter would refuse, the outline is the refused ghost's grey: seven columns past the Barracks, outside the
  // build range.
  moveTo(side, { x: 34, y: 10 })
  assert.equal(armedPreview(side.context, side.build.state)?.refusal?.reason, "outside your build range")
  const refused = compose(side)
  const east = at(side, refused, { x: 40, y: 10 })
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
  // A Turret planned, then Explore Map over it: its outline; on open ground beside it, none.
  keys(side, "3", "\r")
  const turret = side.build.state.planned[0]
  assert.ok(turret !== undefined)
  keys(side, "e")
  moveTo(side, turret.anchor)
  assert.ok(strokes(compose(side)) >= 16, "the placed Turret's reach is not drawn under the cursor")
  moveTo(side, openNear(side, turret.anchor))
  assert.equal(strokes(compose(side)), 0)
})

/** The open tile nearest `tile` (not `tile` itself), searched ring by ring in reading order. */
function openNear(side: Side, tile: Coord): Coord {
  for (let ring = 1; ring < 10; ring += 1) {
    for (let y = tile.y - ring; y <= tile.y + ring; y += 1) {
      for (let x = tile.x - ring; x <= tile.x + ring; x += 1) {
        if (Math.max(Math.abs(x - tile.x), Math.abs(y - tile.y)) === ring && open(side, { x, y })) return { x, y }
      }
    }
  }
  throw new Error(`no open ground near ${tile.x},${tile.y}`)
}

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
      const marks = territory.has(tile) ? ["."] : [was]
      assert.ok(marks.includes(now) || ["-", "|", "/", "\\"].includes(now), `${x},${y} drew ${now}`)
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

test("at 80x24 and on a wide terminal, the frame keeps its size and its glyphs, armed and refused", () => {
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

const STROKES = ["-", "|", "/", "\\"]

test("the build range's dots give way along the raid's trail's whole way, as a reach does: a tile of the way draws the same armed or not", () => {
  const side = buildSide({ cursor: STARTER_START_CURSOR, startPulse, nextRound, foresee })
  const glyphsOnTheWay = (): string[] => {
    const frame = compose(side)
    const way = [...trailTiles({ raid: side.build.raid(), state: side.build.state } as Parameters<typeof trailTiles>[0])]
    return way.map((key) => {
      const [x, y] = key.split(",").map(Number) as [number, number]
      return `${key} ${at(side, frame, { x, y }).glyph}`
    })
  }
  const unarmed = glyphsOnTheWay()
  assert.ok(unarmed.length > 0, "no trail to give way to")
  keys(side, "3")
  assert.ok(buildRange(side.context, side.build.state).has({ x: 27, y: 9 }), "the build range does not reach the trail")
  assert.deepEqual(glyphsOnTheWay(), unarmed)
})

// --- A unit's reach, explored ---------------------------------------------------------------------------------

/** The cells of a frame that are a reach's strokes in `role`, dim. */
const strokesIn = (frame: ReadonlyCellFrame, role: string): number =>
  frame.cells.filter((cell) => STROKES.includes(cell.glyph) && cell.style.fgRole === role && cell.style.dim === true).length

test("exploring a unit that shoots past the tiles touching it shows its reach; one that fights hand to hand shows none", () => {
  assert.equal(unitReachOf(FIXTURE_REGISTRY.get("unit.citizen.marksman")), 6)
  assert.equal(unitReachOf(FIXTURE_REGISTRY.get("unit.ravel.slinger")), 4)
  assert.equal(unitReachOf(FIXTURE_REGISTRY.get("unit.citizen.trooper")), null)
  assert.equal(unitReachOf(FIXTURE_REGISTRY.get("unit.ravel.runner")), null)

  // Round 1: the player's squad arrives beside the Nexus — marksmen, troopers and Vasse.
  const side = buildSide({ cursor: STARTER_START_CURSOR })
  const squad = side.context.incoming ?? []
  const marksman = squad.find((entity) => entity.contentId === "unit.citizen.marksman")
  const trooper = squad.find((entity) => entity.contentId === "unit.citizen.trooper")
  assert.ok(marksman !== undefined && trooper !== undefined)
  keys(side, "e")
  moveTo(side, marksman.anchor)
  const ranged = compose(side)
  let drawn = 0
  for (const { tile, stroke } of reachOutline(marksman.anchor, ONE, 6)) {
    if (!open(side, tile)) continue
    const cell = at(side, ranged, tile)
    assert.equal(cell.glyph, { level: "-", upright: "|", rise: "/", fall: "\\" }[stroke], `${tile.x},${tile.y}`)
    assert.equal(cell.style.fgRole, "chrome.hotkey", "the player's own unit's reach is drawn as a building's is")
    assert.equal(cell.style.dim, true)
    drawn += 1
  }
  assert.ok(drawn >= 12, `only ${drawn} strokes round the marksman`)
  assert.equal(strokesIn(ranged, "chrome.hotkey"), drawn, "a stroke was drawn off the outline")
  moveTo(side, trooper.anchor)
  assert.equal(strokesIn(compose(side), "chrome.hotkey"), 0, "a trooper, who fights hand to hand, showed a reach")
  // In plain navigation too, where a building's reach shows under the cursor.
  keys(side, ESC, TAB)
  moveTo(side, marksman.anchor)
  assert.equal(strokesIn(compose(side), "chrome.hotkey"), drawn)

  // Round 3: the raid brings slingers. Their reach is drawn in the same colour — the raid's own would read as more
  // of its trail, whose diagonal steps are the same strokes, dim in the raid's colour.
  const third = buildSide({ cursor: STARTER_START_CURSOR, context: openRound(DEFAULT_LEVEL, 3), startPulse, nextRound, foresee })
  const coming = third.context.incoming ?? []
  // A reach gives way along the trail's whole way, wherever its moving arrows are, so it never flickers as they pass.
  const trail = new Set((third.build.raid() ?? []).flatMap((group) => (group.target === null ? [] : group.path)).map((tile) => `${tile.x},${tile.y}`))
  // The open ground off the trail round a slinger's reach, where its strokes go: the slinger with the most.
  const ringOf = (anchor: Coord) => reachOutline(anchor, ONE, 4).filter(({ tile }) => open(third, tile) && !trail.has(`${tile.x},${tile.y}`))
  const slinger = coming.filter((entity) => entity.contentId === "unit.ravel.slinger").sort((a, b) => ringOf(b.anchor).length - ringOf(a.anchor).length)[0]
  const raider = coming.find((entity) => entity.contentId === "unit.ravel.raider")
  assert.ok(slinger !== undefined && raider !== undefined, "round 3 brings no slinger and no raider")
  keys(third, "e")
  moveTo(third, slinger.anchor)
  const theirs = compose(third)
  const ring = ringOf(slinger.anchor)
  assert.ok(ring.length >= 3, `only ${ring.length} tiles of the slinger's reach are open ground`)
  for (const { tile } of ring) assert.equal(at(third, theirs, tile).style.fgRole, "chrome.hotkey", `${tile.x},${tile.y}`)
  assert.equal(strokesIn(theirs, "chrome.hotkey"), ring.length, "a stroke was drawn off the outline, or over the trail")
  moveTo(third, raider.anchor)
  assert.equal(strokesIn(compose(third), "chrome.hotkey"), 0, "a raider showed a reach")
})
