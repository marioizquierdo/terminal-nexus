// What a player sees of the raid's intent (the owner: "reading the enemy intent is very important"):
// the coming raid drawn so it reads at a glance, a trail from each group to what it goes for first and
// that target marked — in the Build Phase only, never over a glyph — and the panel's free rows saying
// how many, of what, from where, when and what they go for, in every round of PERIMETER at 80 x 24. And
// the Commander, never faint. The prediction itself is tests/intent.test.ts.

import { test } from "node:test"
import assert from "node:assert/strict"
import { STARTER_START_CURSOR } from "../src/build/catalog.ts"
import { cellForTile, menuEntryAt, startRow } from "../src/build/layout.ts"
import type { RaidForecast, RaidGroup } from "../src/build/types.ts"
import { foresee, nextRound, startPulse } from "../src/cli/pulse-run.ts"
import type { Coord } from "../src/grid/types.ts"
import type { Cell, ReadonlyCellFrame } from "../src/view/frame.ts"
import { cellAt } from "../src/view/frame.ts"
import { SEE_THROUGH_STEP, seeThroughColours } from "../src/view/roles.ts"
import type { CapabilityMode } from "../src/view/roles.ts"
import { CHROME_GLYPHS, terrainGlyph } from "../src/view/theme.ts"
import type { GlyphPack } from "../src/view/theme.ts"
import { bearing, raidLines, raidRows, targetName, troopsLines } from "../src/view/raid-panel.ts"
import { isTroops } from "../src/view/troops-post.ts"
import type { TroopsGroup } from "../src/view/troops-post.ts"
import { trailGlyph, trailMarks } from "../src/view/build-grid.ts"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import { MAXIMUM, MINIMUM, WIDE, buildSide, compose, keys, panelLine } from "./build-helpers.ts"
import type { BuildSide } from "./build-helpers.ts"

const VASSE = "unit.citizen.vasse"

/** PERIMETER's first Build Phase as the game opens it, with the raid foreseen, at `terminal`. */
function perimeter(terminal = MINIMUM): BuildSide {
  return buildSide({ cursor: STARTER_START_CURSOR, startPulse, nextRound, foresee, terminal })
}

/** The round's Pulse started with nothing built and played to its result, then on to the next round. */
function nextRoundOf(side: BuildSide): void {
  const number = side.build.state.pulseNumber
  side.build.dispatch({ kind: "pick-nexus", index: 0 })
  side.build.run([{ kind: "open-battle-round" }, { kind: "start-pulse" }])
  const pulse = side.build.pulse
  assert.ok(pulse !== null)
  side.build.advance(0)
  side.build.advance(pulse.times.homeMs + 100)
  keys(side, "\r")
  assert.equal(side.build.state.pulseNumber, number + 1, `round ${number} did not go on`)
}

/** PERIMETER's rounds 1 to 3, each as its Build Phase opens, nothing built before it. */
function everyRound(terminal = MINIMUM): BuildSide[] {
  const sides: BuildSide[] = []
  for (let number = 1; number <= 3; number += 1) {
    const side = perimeter(terminal)
    for (let played = 1; played < number; played += 1) nextRoundOf(side)
    sides.push(side)
  }
  return sides
}

/** The cell a tile is drawn at, in a frame of `side`'s. */
function tileCell(side: BuildSide, frame: ReadonlyCellFrame, tile: Coord): Cell {
  const at = cellForTile(side.layout, side.build.state.camera, tile)
  return cellAt(frame, at.x, at.y)
}

/** Whether a cell is drawn as a trail's mark: the raid's colour, dim and faded. */
const isTrail = (cell: Cell): boolean => cell.style.fgRole === "player.b" && cell.style.dim === true && (cell.style.fade ?? 0) > 0

/** Whether a cell is drawn as a corner of the place the player's troops head for: their colour, dim and faded. */
const isCorner = (cell: Cell): boolean => cell.style.fgRole === "player.a" && cell.style.dim === true && (cell.style.fade ?? 0) > 0

/** Whether a cell carries the mark of what the raid goes for: underlined, under the raid's colour. */
const isTarget = (cell: Cell): boolean => cell.style.underline === true && cell.style.seeThrough?.role === "player.b"

/** Every map cell of a frame, with its frame position. */
function mapCells(side: BuildSide, frame: ReadonlyCellFrame): { x: number; y: number; cell: Cell }[] {
  const { layout } = side
  const cells: { x: number; y: number; cell: Cell }[] = []
  for (let y = layout.origin.row; y < layout.origin.row + layout.viewport.height; y += 1) {
    for (let x = layout.origin.column; x < layout.origin.column + layout.viewport.width * layout.tileWidth; x += 1) cells.push({ x, y, cell: cellAt(frame, x, y) })
  }
  return cells
}

test("a trail runs from the raid to what it goes for first, and that is marked — in the Build Phase, never during a Pulse", () => {
  const side = perimeter()
  const raid = side.build.raid() ?? []
  const probe = raid[0] as RaidGroup
  // The probe, then the player's own troops, which the forecast carries last and which go for no one.
  assert.deepEqual(raid.map((group) => isTroops(group)), [false, true])
  assert.ok(probe.target !== null)
  const frame = compose(side, {}, "truecolor")
  for (const tile of probe.target.tiles) assert.ok(isTarget(tileCell(side, frame, tile)), `the target is not marked at ${tile.x},${tile.y}`)
  const marks = trailMarks(probe.path, probe.target.tiles)
  const drawn = marks.filter((mark) => isTrail(tileCell(side, frame, mark.tile)))
  assert.ok(drawn.length >= 4, `only ${drawn.length} of ${marks.length} trail marks are drawn`)
  // The mark beside the target points at it.
  const last = marks.at(-1)
  assert.ok(last !== undefined && isTrail(tileCell(side, frame, last.tile)))
  assert.equal(tileCell(side, frame, last.tile).glyph, trailGlyph("ascii", last.dx, last.dy))

  // During the Pulse the map shows what happens, not what was foreseen: handed the raid or not, the same.
  side.build.dispatch({ kind: "pick-nexus", index: 0 })
  side.build.run([{ kind: "open-battle-round" }, { kind: "start-pulse" }])
  side.build.advance(0)
  side.build.advance(1500)
  assert.ok(side.build.pulse !== null)
  const during = compose(side, {}, "truecolor")
  assert.deepEqual(during, compose(side, { raid: [] }, "truecolor"))
  assert.ok(!during.cells.some(isTarget), "a target is marked during the Pulse")
})

test("a trail never replaces a glyph: only bare open ground under it changes, and the target keeps its own glyphs", () => {
  for (const side of everyRound()) {
    const number = side.build.state.pulseNumber
    const shown = compose(side, {}, "truecolor")
    const bare = compose(side, { raid: [] }, "truecolor")
    const ground = new Set([terrainGlyph("terrain.plain", "ascii").glyph, " "])
    let marks = 0
    let targets = 0
    let corners = 0
    const before = new Map(mapCells(side, bare).map((entry) => [`${entry.x},${entry.y}`, entry.cell]))
    for (const { x, y, cell } of mapCells(side, shown)) {
      const was = before.get(`${x},${y}`) as Cell
      if (cell.glyph !== was.glyph) {
        // A glyph changed: only ever a trail's mark, or a corner of the line the player's troops head for, over
        // featureless ground.
        assert.ok(isTrail(cell) || isCorner(cell), `round ${number}: ${x},${y} became "${cell.glyph}" without being a trail mark or a corner`)
        assert.ok(ground.has(was.glyph) && was.style.fgRole === "terrain.plain", `round ${number}: a mark replaced "${was.glyph}" at ${x},${y}`)
        if (isTrail(cell)) marks += 1
        else corners += 1
      } else if (JSON.stringify(cell.style) !== JSON.stringify(was.style)) {
        // The same glyph, restyled: the target's mark, or a trail mark's blank second column on wide tiles.
        assert.ok(isTarget(cell) || isTrail(cell) || isCorner(cell), `round ${number}: ${x},${y} restyled as neither a target nor a trail nor a corner`)
        if (isTarget(cell)) targets += 1
      }
    }
    assert.ok(marks > 0, `round ${number} draws no trail`)
    assert.ok(targets > 0, `round ${number} marks no target`)
    assert.ok(corners > 0, `round ${number} marks no corner of the line`)
  }
})

test("the panel says the coming raid in every round, inside the panel's free rows at 80 x 24, no word cut", () => {
  // Under the raid, where the player's troops head: at 80 x 24 the second and third rounds' raid gives up its
  // kinds for them, as it would for a group more.
  const troops = [/^YOUR TROOPS$/, /^\d+ head for the line$/]
  const expected: readonly (readonly RegExp[])[] = [
    [/^AS THE ROUND STARTS$/, /^5 from the north-east$/, /^ {2}3 runners, 2 raiders$/, /^ {2}goes for your Barracks$/, ...troops],
    [/^AS THE ROUND STARTS$/, /^7 from the north-east$/, /^ {2}goes for your /, /^7 SECONDS IN$/, /^2 from the east$/, /^ {2}goes for your /, ...troops],
    [/^AS THE ROUND STARTS$/, /^13 from the north-east$/, /^ {2}goes for your /, /^8 SECONDS IN$/, /^6 from the east$/, /^ {2}goes for your /, ...troops],
  ]
  everyRound().forEach((side, index) => {
    const { layout } = side
    const context = side.build.round
    const frame = compose(side)
    const rows = raidRows(layout, context.catalog)
    assert.ok(rows !== null, `round ${index + 1}: no room for the raid`)
    const drawn: string[] = []
    for (let row = rows.first; row <= rows.last; row += 1) drawn.push(panelLine(side, frame, row).trimEnd())
    const lines = drawn.filter((line) => line !== "")
    assert.equal(lines.length, (expected[index] as readonly RegExp[]).length, `round ${index + 1}:\n${drawn.join("\n")}`)
    lines.forEach((line, at) => assert.match(line, (expected[index] as readonly RegExp[])[at] as RegExp, `round ${index + 1}, line ${at + 1}`))
    // Every line is whole: what the panel was asked to say is what it drew, one column in from the divider.
    const asked = raidLines(context, side.build.raid() ?? [], { x: 18, y: 10 }, layout.panelLimit - 1, rows.last - rows.first + 1)
    assert.deepEqual(lines, asked.filter((line) => line.parts.length > 0).map((line) => `${" ".repeat(line.indent)}${line.parts.map((part) => part.text).join("")}`))
    for (const line of lines) assert.ok(line.length <= layout.panelLimit - 1, `"${line}" runs to the divider`)
    // A blank row after the buildings, and before Start Battle Round, which keeps its row.
    assert.equal(panelLine(side, frame, rows.first - 1).trim(), "")
    assert.equal(panelLine(side, frame, startRow(layout) - 1).trim(), "")
    assert.match(panelLine(side, frame, startRow(layout)), /\[s\] Start Battle Round/)
  })
})

test("the raid's lines are information, not rows: no click lands on one, and the menu is walked past them", () => {
  const side = perimeter()
  const rows = raidRows(side.layout, side.context.catalog)
  assert.ok(rows !== null)
  for (let row = rows.first; row <= rows.last; row += 1) {
    assert.equal(menuEntryAt(side.layout, side.context.catalog, side.layout.panelColumn + 3, row), null, `row ${row} is clickable`)
  }
  // Down from the last building is Start Battle Round.
  keys(side, "\u001b[F") // End: the last row
  const last = side.build.state.menuHighlight
  keys(side, "\u001b[A") // Up: the last building
  keys(side, "\u001b[B") // Down: straight back to Start Battle Round
  assert.equal(side.build.state.menuHighlight, last)
})

test("with fewer free rows the panel drops the kinds first, then whole groups, and says how many more", () => {
  const side = everyRound()[2] as BuildSide
  // The raid alone: what the player's troops add under it is the next test's.
  const raid = (side.build.raid() as RaidForecast).filter((group) => !isTroops(group))
  const from = { x: 18, y: 10 }
  const text = (room: number): string[] => raidLines(side.build.round, raid, from, 27, room).map((line) => line.parts.map((part) => part.text).join(""))
  assert.equal(text(9).length, 9)
  assert.ok(text(9).includes("3 slingers"))
  // Seven rows: both groups, when and from where and what they go for, without their kinds.
  const seven = text(7)
  assert.equal(seven.length, 6)
  for (const line of ["AS THE ROUND STARTS", "13 from the north-east", "8 SECONDS IN", "6 from the east"]) assert.ok(seven.includes(line), line)
  assert.equal(seven.filter((line) => line.startsWith("goes for ")).length, 2)
  assert.ok(!seven.some((line) => /runners|raiders|slingers/.test(line)))
  // Four: the first group whole, and a line for the one left out.
  const four = text(4)
  assert.deepEqual(four.slice(0, 2), ["AS THE ROUND STARTS", "13 from the north-east"])
  assert.equal(four.at(-1), "+1 more group")
  assert.ok(four.length <= 4)
})

test("the coming raid is see-through in its own colour where colours blend, full strength at 16 colours and in monochrome; Vasse is bold and never faint", () => {
  const [first, second] = everyRound()
  for (const side of [first, second] as BuildSide[]) {
    const frame = compose(side, {}, "truecolor")
    const raider = (side.build.round.incoming ?? []).find((entity) => entity.player === "B")
    assert.ok(raider !== undefined)
    const cell = tileCell(side, frame, raider.anchor)
    const wash = cell.style.seeThrough
    assert.ok(wash !== undefined && wash.role === "player.b" && wash.alpha > 0 && wash.alpha < SEE_THROUGH_STEP, `round ${side.build.state.pulseNumber}: ${JSON.stringify(cell.style)}`)
    assert.notEqual(cell.style.dim, true, "the raid is drawn faint")
    assert.equal(cell.style.fade, undefined, "the raid is drawn faded")
    assert.ok(seeThroughColours(cell, "truecolor") !== null && seeThroughColours(cell, "color256") !== null)
    for (const capability of ["color16", "monochrome"] as const satisfies readonly CapabilityMode[]) {
      assert.equal(seeThroughColours(cell, capability), null, `at ${capability} the raid is not at full strength`)
    }
  }
  // Round 1: she arrives with the squads; round 2: she stands where Recall put her. Both bold, never dim,
  // faded or washed, in her side's colour.
  const arriving = (first as BuildSide).build.round.incoming?.find((entity) => entity.contentId === VASSE)
  const standing = (second as BuildSide).build.round.field?.find((entity) => entity.contentId === VASSE)
  assert.ok(arriving !== undefined && standing !== undefined)
  for (const [side, tile] of [[first, arriving.anchor], [second, standing.anchor]] as const) {
    const style = tileCell(side as BuildSide, compose(side as BuildSide, {}, "truecolor"), tile).style
    assert.deepEqual(style, { fgRole: "player.a", bold: true }, JSON.stringify(style))
  }
})

test("a trail's marks are the glyph pack's own arrowheads and strokes, at every size", () => {
  const own: Readonly<Record<GlyphPack, ReadonlySet<string>>> = {
    ascii: new Set(["<", ">", "^", "v", "/", "\\"]),
    unicode: new Set([CHROME_GLYPHS.unicode.arrowLeft, CHROME_GLYPHS.unicode.arrowRight, CHROME_GLYPHS.unicode.arrowUp, CHROME_GLYPHS.unicode.arrowDown, CHROME_GLYPHS.unicode.trailRise, CHROME_GLYPHS.unicode.trailFall]),
  }
  for (const terminal of [MINIMUM, MAXIMUM, WIDE]) {
    for (const glyphPack of ["ascii", "unicode"] as const) {
      const side = perimeter(terminal)
      const frame = compose(side, { glyphPack }, "truecolor")
      const marks = mapCells(side, frame).filter((entry) => isTrail(entry.cell) && entry.cell.glyph !== " ")
      assert.ok(marks.length > 0, `${terminal.columns}x${terminal.rows} ${glyphPack}: no trail`)
      for (const { cell } of marks) assert.ok(own[glyphPack].has(cell.glyph) && [...cell.glyph].length === 1, `${glyphPack}: "${cell.glyph}"`)
    }
  }
  // The way's direction picks the mark: straight runs an arrowhead, both ways at once a stroke.
  assert.equal(trailGlyph("ascii", -2, 0), "<")
  assert.equal(trailGlyph("ascii", 0, 2), "v")
  assert.equal(trailGlyph("ascii", -1, 1), "/")
  assert.equal(trailGlyph("ascii", 1, 1), "\\")
  assert.equal(trailGlyph("unicode", 0, -1), CHROME_GLYPHS.unicode.arrowUp)
})

test("the panel's words: where from is a point of the compass from the Nexus, as the map is seen; what is hit, by its plain name", () => {
  const nexus = { x: 18, y: 10 }
  assert.equal(bearing(nexus, { x: 41, y: 1 }), "north-east")
  assert.equal(bearing(nexus, { x: 52, y: 10 }), "east")
  assert.equal(bearing(nexus, { x: 18, y: 2 }), "north")
  assert.equal(bearing(nexus, { x: 2, y: 18 }), "south-west")
  // A Commander by her name, a building as the menu names it, a unit as the kinds are counted.
  const context = { registry: FIXTURE_REGISTRY }
  const at = { anchor: { x: 0, y: 0 }, tiles: [] }
  assert.equal(targetName(context, { contentId: VASSE, player: "A", ...at }), "Vasse")
  assert.equal(targetName(context, { contentId: "structure.citizen.barracks", player: "A", ...at }), "your Barracks")
  assert.equal(targetName(context, { contentId: "structure.citizen.nexus", player: "A", ...at }), "your Nexus")
  assert.equal(targetName(context, { contentId: "unit.citizen.trooper", player: "A", ...at }), "your trooper")
})

// --- Your troops' target ---------------------------------------------------------------------------------

/** A forecast's troops, as the shell hands them to the screen, with another name for the place. */
const troopsNamed = (side: BuildSide, name: string): TroopsGroup => {
  const troops = (side.build.raid() ?? []).find(isTroops)
  assert.ok(troops !== undefined, "the forecast carries no troops")
  return { ...troops, post: { ...troops.post, name } }
}

test("under the raid, the panel says where the player's troops head, in the raid's voice; a long name goes under it, never cut, and with too little room the raid keeps its rows", () => {
  const side = perimeter()
  const troops = troopsNamed(side, "the line")
  const text = (lines: ReturnType<typeof troopsLines>): string[] => lines.map((line) => `${" ".repeat(line.indent)}${line.parts.map((part) => part.text).join("")}`)
  // Ten: the six on the map as the round opens, and the four the Barracks sends five seconds in.
  assert.deepEqual(text(troopsLines(troops, 27)), ["YOUR TROOPS", "10 head for the line"])
  // In the player's colour, the count and the place bold, as the raid's count and target are.
  const [, line] = troopsLines(troops, 27)
  assert.deepEqual(line?.parts.map((part) => [part.role, part.bold === true]), [["player.a", true], ["player.a", false], ["player.a", true]])
  // A place too long for the line goes under it, wrapped at words.
  const long = troopsNamed(side, "the open ground before the old survey annex")
  const wrapped = text(troopsLines(long, 27))
  assert.deepEqual(wrapped.slice(0, 2), ["YOUR TROOPS", "10 head for"])
  assert.equal(wrapped.slice(2).map((part) => part.trim()).join(" "), "the open ground before the old survey annex")
  for (const part of wrapped) assert.ok(part.length <= 27, `"${part}" runs past the panel`)
  // Nobody to send, none standing and no wave coming: the line still names the place.
  assert.deepEqual(text(troopsLines({ ...troops, units: [] }, 27)), ["YOUR TROOPS", "head for the line"])
  // Short of room, the raid comes first: its kinds give way to the troops' lines, then the blank line before
  // them; never a whole group of the raid, so then the troops' lines are left out.
  const forecast = side.build.raid() ?? []
  const lines = (room: number): string[] => text(raidLines(side.build.round, forecast, { x: 18, y: 10 }, 27, room))
  assert.deepEqual(lines(7), ["AS THE ROUND STARTS", "5 from the north-east", "  3 runners, 2 raiders", "  goes for your Barracks", "", "YOUR TROOPS", "10 head for the line"])
  assert.deepEqual(lines(6), ["AS THE ROUND STARTS", "5 from the north-east", "  goes for your Barracks", "", "YOUR TROOPS", "10 head for the line"])
  assert.deepEqual(lines(5), ["AS THE ROUND STARTS", "5 from the north-east", "  goes for your Barracks", "YOUR TROOPS", "10 head for the line"])
  assert.deepEqual(lines(4), ["AS THE ROUND STARTS", "5 from the north-east", "  3 runners, 2 raiders", "  goes for your Barracks"])
})

test("the line the player's troops head for is marked by its corners: the glyph pack's own, in their colour, quiet, in the Build Phase only and never over a glyph", () => {
  for (const glyphPack of ["ascii", "unicode"] as const) {
    const side = perimeter()
    const troops = (side.build.raid() ?? []).find(isTroops)
    assert.ok(troops !== undefined)
    const frame = compose(side, { glyphPack }, "truecolor")
    const corners = mapCells(side, frame).filter((entry) => isCorner(entry.cell))
    const own = new Set<string>([CHROME_GLYPHS[glyphPack].topLeft, CHROME_GLYPHS[glyphPack].topRight, CHROME_GLYPHS[glyphPack].bottomLeft, CHROME_GLYPHS[glyphPack].bottomRight])
    assert.ok(corners.length >= 3, `${glyphPack}: ${corners.length} corners drawn`)
    for (const { cell } of corners) assert.ok(own.has(cell.glyph), `${glyphPack}: "${cell.glyph}" is not a corner`)
    // At the line's own corners: the top two, (22,7) and (26,7), are open ground in round 1.
    for (const tile of [{ x: 22, y: 7 }, { x: 26, y: 7 }]) assert.ok(isCorner(tileCell(side, frame, tile)), `${glyphPack}: no corner at ${tile.x},${tile.y}`)
    // A squad member standing on a corner keeps its glyph: the corner under it is not drawn.
    const covered = (side.build.round.incoming ?? []).find((entity) => troops.post.tiles.some((tile) => tile.x === entity.anchor.x && tile.y === entity.anchor.y))
    if (covered !== undefined) assert.ok(!isCorner(tileCell(side, frame, covered.anchor)))
  }
  // During the battle the map shows what happens, not where they were sent: no corner is drawn.
  const side = perimeter()
  side.build.dispatch({ kind: "pick-nexus", index: 0 })
  side.build.run([{ kind: "open-battle-round" }, { kind: "start-pulse" }])
  side.build.advance(0)
  side.build.advance(1500)
  assert.ok(side.build.pulse !== null)
  assert.ok(!compose(side, {}, "truecolor").cells.some(isCorner), "a corner is drawn during the battle")
})
