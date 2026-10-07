// What a player sees of the raid's intent (the owner: "reading the enemy intent is very important"):
// the coming raid drawn so it reads at a glance, a trail from each group to what it goes for first — its
// arrows moving slowly toward it — and that target marked, in the Build Phase only, never over a glyph;
// and the panel's free rows saying how many, of what, from where, when and what they go for, in every
// round of PERIMETER at 80 x 24. And the Commander, never faint. The prediction itself is
// tests/intent.test.ts.

import { test } from "node:test"
import assert from "node:assert/strict"
import { STARTER_START_CURSOR } from "../src/build/catalog.ts"
import { cellForTile, menuEntryAt, startRow } from "../src/build/layout.ts"
import type { RaidForecast, RaidGroup } from "../src/build/types.ts"
import { foresee, nextRound, startPulse } from "../src/cli/pulse-run.ts"
import { gridDistance } from "../src/grid/coords.ts"
import type { Coord } from "../src/grid/types.ts"
import type { Cell, ReadonlyCellFrame } from "../src/view/frame.ts"
import { cellAt, frameToText } from "../src/view/frame.ts"
import { CAPABILITY_MODES, SEE_THROUGH_STEP, resolveCell, seeThroughColours } from "../src/view/roles.ts"
import type { CapabilityMode } from "../src/view/roles.ts"
import { CHROME_GLYPHS, terrainGlyph } from "../src/view/theme.ts"
import type { GlyphPack } from "../src/view/theme.ts"
import { bearing, raidLines, raidRows, targetName, troopsLines } from "../src/view/raid-panel.ts"
import { isTroops } from "../src/view/troops-post.ts"
import type { TroopsGroup } from "../src/view/troops-post.ts"
import { GHOST_FADES, TRAIL_MOTION, hasTrail, trailGlyph, trailMarks, trailTiles } from "../src/view/build-grid.ts"
import { visibleRange } from "../src/build/camera.ts"
import { BuildAnimation, FRAME_MS } from "../src/view/build-live.ts"
import { TUNING } from "../src/build/tuning.ts"
import { parseKeyScript } from "../src/playtest/keys.ts"
import { runBuildPlaytest } from "../src/playtest/build.ts"
import { DEFAULT_SETTINGS } from "../src/settings/types.ts"
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
    for (let x = layout.origin.column; x < layout.origin.column + layout.viewport.width; x += 1) cells.push({ x, y, cell: cellAt(frame, x, y) })
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

test("a trail never replaces a glyph: only bare open ground under it changes, and the target keeps its own glyphs — still or moving", () => {
  // Still, then moving: a copy in its first look and its second, and the arrows alone.
  const instants = [undefined, TRAIL_MOTION.stepMs, 2 * TRAIL_MOTION.stepMs + TRAIL_MOTION.stepMs / 4, 2 * TRAIL_MOTION.stepMs + TRAIL_MOTION.stepMs / 2]
  for (const [side, elapsedMs] of everyRound().flatMap((side) => instants.map((at) => [side, at] as const))) {
    const number = side.build.state.pulseNumber
    const shown = compose(side, elapsedMs === undefined ? {} : { raidTrail: { elapsedMs } }, "truecolor")
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
        // The same glyph, restyled: only ever the target's mark, a glyphless write over what it goes for.
        assert.ok(isTarget(cell), `round ${number}: ${x},${y} restyled as something other than the target's mark`)
        targets += 1
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
    [/^AS THE ROUND STARTS$/, /^5 from the north-east$/, /^ {2}3 runners, 2 raiders$/, /^ {2}targets your Barracks$/, ...troops],
    [/^AS THE ROUND STARTS$/, /^7 from the north-east$/, /^ {2}targets your /, /^7 SECONDS IN$/, /^2 from the east$/, /^ {2}targets your /, ...troops],
    // What a group goes for first is the kernel's choice (tests/intent.test.ts): one of the player's buildings, or
    // Vasse, who is named.
    [/^AS THE ROUND STARTS$/, /^13 from the north-east$/, /^ {2}targets your /, /^8 SECONDS IN$/, /^6 from the east$/, /^ {2}targets (your |Vasse$)/, ...troops],
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
  assert.equal(seven.filter((line) => line.startsWith("targets ")).length, 2)
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

// --- The trail moves -------------------------------------------------------------------------------------
// The owner: "instead of a static arror, it should be a slow-moving line of arrows with enough distance betwwen
// them to be less obstrussive. For example 1 arrow every 3 tiles, leaving a transparent arrow behind then moving
// that fades."

/** PERIMETER's probe, the first round's one group, with somewhere to go. */
function probeOf(side: BuildSide): RaidGroup & Readonly<{ target: NonNullable<RaidGroup["target"]> }> {
  const probe = (side.build.raid() ?? [])[0]
  assert.ok(probe !== undefined && probe.target !== null && probe.path.length > 2 * TRAIL_MOTION.spacing, "the probe has no way to show")
  return probe as RaidGroup & Readonly<{ target: NonNullable<RaidGroup["target"]> }>
}

/** Where along the probe's way a tile is. */
const wayIndex = (probe: RaidGroup, tile: Coord): number => probe.path.findIndex((step) => step.x === tile.x && step.y === tile.y)

/** How far along a way each of its tiles is, by the Grid's own distance: what the trail's arrows are spaced and
 *  timed by. */
function alongWay(path: readonly Coord[]): number[] {
  const along = [0]
  for (let index = 1; index < path.length; index += 1) along.push((along[index - 1] as number) + gridDistance(path[index - 1] as Coord, path[index] as Coord))
  return along
}

/** A straight way of `tiles` tiles from 0,0, across or down, and the tile past its end it goes for. */
function straightWay(tiles: number, down: boolean): Readonly<{ path: Coord[]; target: Coord[] }> {
  const at = (index: number): Coord => (down ? { x: 0, y: index } : { x: index, y: 0 })
  return { path: Array.from({ length: tiles }, (_, index) => at(index)), target: [at(tiles)] }
}

test("the trail moves by the Grid's own distance: an arrow every four columns or two rows, a column's distance on every step and a row on every second, the one beside the target going in as a new one comes out", () => {
  const { spacing, stepMs } = TRAIL_MOTION
  assert.equal(spacing, 4, "the owner's one arrow every three tiles, made whole rows: four columns or two rows")
  const arrowsOf = (way: Readonly<{ path: readonly Coord[]; target: readonly Coord[] }>, step: number | null): Coord[] =>
    trailMarks(way.path, way.target, step === null ? null : step * stepMs).filter((mark) => mark.ghost === undefined).map((mark) => mark.tile)
  // Across the screen: still, every fourth column, counted back from the last; each step every arrow a column on.
  const across = straightWay(13, false)
  assert.deepEqual(arrowsOf(across, null).map((tile) => tile.x), [0, 4, 8, 12])
  for (let step = 0; step <= 2 * spacing; step += 1) {
    const columns = arrowsOf(across, step).map((tile) => tile.x)
    assert.deepEqual(columns, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter((x) => x % spacing === step % spacing), `step ${step}`)
  }
  // Down the screen: still, every second row; a row on every second step, as a unit walks it.
  const down = straightWay(7, true)
  assert.deepEqual(arrowsOf(down, null).map((tile) => tile.y), [0, 2, 4, 6])
  assert.deepEqual(
    [0, 1, 2, 3, 4].map((step) => arrowsOf(down, step).map((tile) => tile.y)),
    [[0, 2, 4, 6], [0, 2, 4], [1, 3, 5], [1, 3, 5], [0, 2, 4, 6]],
  )
  // On the probe's own way, which runs down the screen's diagonal and straight: the still trail ends beside the
  // target and starts within a spacing of the group; moving, it holds still until a step is over, an arrow only ever
  // stays or reaches the next tile of the way, and every four steps the line is where it began.
  const probe = probeOf(perimeter())
  const last = probe.path.length - 1
  const along = alongWay(probe.path)
  const indices = (step: number | null): number[] => arrowsOf({ path: probe.path, target: probe.target.tiles }, step).map((tile) => wayIndex(probe, tile))
  const still = indices(null)
  assert.equal(still.at(-1), last)
  assert.ok((along[still[0] as number] as number) < spacing, "the trail does not start at the group")
  assert.deepEqual(indices(0), still)
  assert.deepEqual(trailMarks(probe.path, probe.target.tiles, stepMs - 1).filter((mark) => mark.ghost === undefined).map((mark) => wayIndex(probe, mark.tile)), still)
  for (let step = 1; step <= 2 * spacing; step += 1) {
    const before = indices(step - 1)
    const now = indices(step)
    for (const index of now) assert.ok(before.includes(index) || before.includes(index - 1) || index === 0, `step ${step}: an arrow at ${index} came from nowhere`)
    for (let at = 1; at < now.length; at += 1) {
      const gap = (along[now[at] as number] as number) - (along[now[at - 1] as number] as number)
      assert.ok(Math.abs(gap - spacing) <= 1, `step ${step}: arrows ${gap} apart along the way, not about ${spacing}`)
    }
  }
  assert.deepEqual(indices(spacing), still)
  // An arrow points the same way from a tile wherever the motion is: a whole stair on along the way, or at the target.
  const ways = new Map<number, string>()
  for (let at = 0; at < spacing * stepMs; at += stepMs / 4) {
    for (const mark of trailMarks(probe.path, probe.target.tiles, at)) {
      const index = wayIndex(probe, mark.tile)
      const way = `${mark.dx},${mark.dy}`
      assert.equal(ways.get(index) ?? way, way, `the mark at ${index} turned`)
      ways.set(index, way)
    }
  }
})

test("an arrow that moves on leaves a fading copy on the tile it left — fainter at once, fainter again a quarter step on, gone at the half — the one that went into the target too", () => {
  const probe = probeOf(perimeter())
  const { stepMs } = TRAIL_MOTION
  const last = probe.path.length - 1
  const marks = (elapsedMs: number) => trailMarks(probe.path, probe.target.tiles, elapsedMs)
  const arrowsAt = (elapsedMs: number): number[] => marks(elapsedMs).filter((mark) => mark.ghost === undefined).map((mark) => wayIndex(probe, mark.tile))
  const copiesAt = (elapsedMs: number) => marks(elapsedMs).filter((mark) => mark.ghost !== undefined)
  // The motion starts from the still trail: nothing is left behind before the first step.
  assert.deepEqual(copiesAt(0), [])
  assert.deepEqual(copiesAt(stepMs - 1), [])
  let wentIn = 0
  for (let step = 1; step <= 8; step += 1) {
    const start = step * stepMs
    const before = arrowsAt(start - 1)
    const now = arrowsAt(start)
    // A copy on every tile an arrow left this step, and on no other: in its own glyph, the way it pointed from there.
    const copies = copiesAt(start)
    assert.deepEqual(copies.map((mark) => wayIndex(probe, mark.tile)), before.filter((index) => !now.includes(index)), `step ${step}: the copies are not where arrows left`)
    const pointed = new Map(marks(start - 1).map((mark) => [wayIndex(probe, mark.tile), `${mark.dx},${mark.dy}`]))
    for (const copy of copies) assert.equal(`${copy.dx},${copy.dy}`, pointed.get(wayIndex(probe, copy.tile)))
    if (before.includes(last) && !now.includes(last)) wentIn += 1
    // Its first look, then its second a quarter step on, then gone at the half, until the next step.
    assert.ok(copies.every((mark) => mark.ghost === 0))
    assert.ok(copiesAt(start + stepMs / 4).every((mark) => mark.ghost === 1))
    assert.equal(copiesAt(start + stepMs / 4).length, copies.length)
    assert.deepEqual(copiesAt(start + stepMs / 2), [])
    assert.deepEqual(copiesAt(start + stepMs - 1), [])
  }
  assert.ok(wentIn >= 2, "the arrow beside the target left no copy as it went in")
  // Fainter than the arrow from the start, fainter again, as far toward the background as the depth can blend.
  assert.ok((GHOST_FADES[0] as number) > 0.3 && (GHOST_FADES[1] as number) > (GHOST_FADES[0] as number) && (GHOST_FADES[1] as number) < 1)
})

test("drawn, a copy is the arrow's glyph further faded where colours blend, and dim, then gone, at 16 colours and in monochrome: every depth draws the same glyphs", () => {
  const side = perimeter()
  const probe = probeOf(side)
  const { stepMs } = TRAIL_MOTION
  for (const elapsedMs of [stepMs, stepMs + stepMs / 4, stepMs + stepMs / 2]) {
    const texts = CAPABILITY_MODES.map((capability) => frameToText(compose(side, { raidTrail: { elapsedMs } }, capability)))
    for (const text of texts) assert.equal(text, texts[0], `${elapsedMs} ms: a depth draws other glyphs`)
  }
  const frame = compose(side, { raidTrail: { elapsedMs: stepMs } }, "truecolor")
  const drawn = (mark: ReturnType<typeof trailMarks>[number]): boolean => {
    const cell = tileCell(side, frame, mark.tile)
    return cell.glyph === trailGlyph("ascii", mark.dx, mark.dy) && isTrail(cell)
  }
  const marks = trailMarks(probe.path, probe.target.tiles, stepMs)
  const copies = marks.filter((mark) => mark.ghost !== undefined && drawn(mark))
  const arrows = marks.filter((mark) => mark.ghost === undefined && drawn(mark))
  assert.ok(copies.length >= 3 && arrows.length >= 3, `${copies.length} copies and ${arrows.length} arrows drawn`)
  const [copy, arrow] = [tileCell(side, frame, (copies[0] as (typeof marks)[number]).tile), tileCell(side, frame, (arrows[0] as (typeof marks)[number]).tile)]
  assert.deepEqual(copy.style, { fgRole: "player.b", dim: true, fade: GHOST_FADES[0] })
  assert.ok((arrow.style.fade ?? 0) < (copy.style.fade ?? 0))
  // Composed the same at every depth, the copy's look included: only resolving it differs.
  for (const capability of CAPABILITY_MODES) {
    const at = compose(side, { raidTrail: { elapsedMs: stepMs } }, capability)
    assert.deepEqual(tileCell(side, at, (copies[0] as (typeof marks)[number]).tile), copy, capability)
  }
  // Where colours blend the copy is a fainter colour than the arrow; at 16 colours and in monochrome, which
  // cannot blend, it is the arrow's own dim look — until it is gone.
  for (const capability of ["truecolor", "color256"] as const) {
    assert.notDeepEqual(resolveCell(copy, capability).sgr, resolveCell(arrow, capability).sgr, capability)
  }
  for (const capability of ["color16", "monochrome"] as const) {
    assert.deepEqual(resolveCell(copy, capability).sgr, resolveCell(arrow, capability).sgr, capability)
    assert.ok(resolveCell(copy, capability).dim, capability)
  }
})

test("still under reduced motion, under a popup and in every still frame: an arrow every three tiles, nothing left behind", () => {
  const side = perimeter()
  const probe = probeOf(side)
  const still = compose(side, {}, "truecolor")
  // A still frame is the trail at the start of its motion.
  assert.deepEqual(still, compose(side, { raidTrail: { elapsedMs: 0 } }, "truecolor"))
  assert.equal(trailMarks(probe.path, probe.target.tiles).filter((mark) => mark.ghost !== undefined).length, 0)
  // The live loop hands the view no motion while a popup is open, motion is reduced, or the plan is committed.
  const animation = new BuildAnimation()
  const moving = { raidTrail: true, capability: "monochrome" as const }
  assert.ok(animation.frame(side.build.state, 0, moving).raidTrail !== undefined)
  assert.equal(animation.frame(side.build.state, 100, { ...moving, reducedMotion: true }).raidTrail, undefined)
  const popup = { ...side.build.state, popup: "nexus-powers" as const }
  assert.equal(animation.frame(popup, 200, moving).raidTrail, undefined)
  assert.equal(animation.frame({ ...side.build.state, committed: true }, 300, moving).raidTrail, undefined)
  // With reduced motion every frame is the still one, whatever the time; without it, the same waits move it.
  const waits = parseKeyScript(`wait~${TRAIL_MOTION.stepMs / 4}*8`)
  const reduced = runBuildPlaytest({ scenes: false, steps: waits, settings: { ...DEFAULT_SETTINGS, capability: "truecolor", reducedMotion: true } })
  assert.equal(new Set(reduced.frames.map((each) => frameToText(each.frame))).size, 1, "the trail moved under reduced motion")
  const moved = runBuildPlaytest({ scenes: false, steps: waits, settings: { ...DEFAULT_SETTINGS, capability: "truecolor" } })
  assert.ok(new Set(moved.frames.map((each) => frameToText(each.frame))).size > 1, "the trail never moved")
})

test("the live loop moves it from the first frame that drew it moving, asks for a frame only when it next looks different, and starts again from the still trail after a popup", () => {
  const side = perimeter()
  const { stepMs } = TRAIL_MOTION
  const quarter = stepMs / 4
  // Where colours blend, three changes a step: an arrow steps on, its copy fades, its copy goes.
  const blended = new BuildAnimation()
  const options = { raidTrail: true, capability: "truecolor" as const }
  const first = blended.frame(side.build.state, 1000, options)
  assert.deepEqual(first.raidTrail, { elapsedMs: 0 })
  assert.deepEqual([first.busyUntil, first.frameMs], [1000 + 4 * quarter, 4 * quarter], "the still trail asked before its first step")
  assert.deepEqual(blended.frame(side.build.state, 1000 + 4 * quarter, options).busyUntil, 1000 + 5 * quarter)
  assert.deepEqual(blended.frame(side.build.state, 1000 + 5 * quarter, options).busyUntil, 1000 + 6 * quarter)
  assert.deepEqual(blended.frame(side.build.state, 1000 + 6 * quarter, options).busyUntil, 1000 + 8 * quarter)
  // A frame drawn between two changes (a key's) asks for the next change, not a frame's length on.
  const between = blended.frame(side.build.state, 1000 + 6 * quarter + 7, options)
  assert.equal(between.busyUntil, 1000 + 8 * quarter)
  assert.ok((between.frameMs ?? 0) > FRAME_MS, "the trail asks for every frame")
  // At 16 colours and in monochrome, two: an arrow steps on, its copy goes.
  for (const capability of ["color16", "monochrome"] as const) {
    const plain = new BuildAnimation()
    const opts = { raidTrail: true, capability }
    assert.equal(plain.frame(side.build.state, 0, opts).busyUntil, 4 * quarter)
    assert.equal(plain.frame(side.build.state, 4 * quarter, opts).busyUntil, 6 * quarter, capability)
    assert.equal(plain.frame(side.build.state, 6 * quarter, opts).busyUntil, 8 * quarter, capability)
  }
  // A popup holds it still and asks for nothing (no breath in monochrome); as it closes the motion starts over
  // from the still trail, so nothing jumps.
  const animation = new BuildAnimation()
  const mono = { raidTrail: true, capability: "monochrome" as const }
  animation.frame(side.build.state, 0, mono)
  assert.deepEqual(animation.frame(side.build.state, 5 * quarter, mono).raidTrail, { elapsedMs: 5 * quarter })
  const held = animation.frame({ ...side.build.state, popup: "game-menu" }, 6 * quarter, mono)
  assert.deepEqual([held.raidTrail, held.busyUntil], [undefined, null])
  assert.deepEqual(animation.frame(side.build.state, 9000, mono).raidTrail, { elapsedMs: 0 })
  // Something faster moving keeps every frame until it ends: a placement or a glide sets the pace, not the trail.
  const glide = new BuildAnimation()
  glide.frame(side.build.state, 0, options)
  const moved = { ...side.build.state, cursor: { x: side.build.state.cursor.x + 3, y: side.build.state.cursor.y } }
  const gliding = glide.frame(moved, 10, options)
  assert.equal(gliding.frameMs, undefined)
  assert.equal(gliding.busyUntil, 10 + TUNING.cursorGlideMs)
  // Without a trail on the map it asks for nothing.
  assert.equal(new BuildAnimation().frame(side.build.state, 0, { capability: "truecolor" }).busyUntil, null)
})

test("a building's reach yields to every tile of the trail's way, wherever its arrows are this instant: the same set, moving or still — and the trail moves only while some of that way is in view", () => {
  const side = perimeter()
  const raid = side.build.raid() ?? []
  const input = { context: side.build.round, state: side.build.state, layout: side.layout, raid }
  const way = new Set(raid.filter((group) => group.target !== null).flatMap((group) => group.path.map((tile) => `${tile.x},${tile.y}`)))
  assert.ok(way.size > 10)
  assert.deepEqual(trailTiles(input), way)
  for (const elapsedMs of [0, 100, 450, 900, 1300]) {
    assert.deepEqual(trailTiles({ ...input, raidTrail: { elapsedMs } }), way, `${elapsedMs} ms`)
    // Every mark, arrow or copy, is on it.
    for (const group of raid) {
      if (group.target === null) continue
      for (const mark of trailMarks(group.path, group.target.tiles, elapsedMs)) assert.ok(way.has(`${mark.tile.x},${mark.tile.y}`))
    }
  }
  // Nothing to yield to once the plan is committed.
  assert.equal(trailTiles({ ...input, state: { ...input.state, committed: true } }).size, 0)
  // The live loop times the motion only while some of the way is in view: scrolled away, nothing on screen moves.
  assert.equal(hasTrail(raid), true)
  assert.equal(hasTrail(raid, visibleRange(side.build.state.camera, side.build.state.viewport)), true)
  assert.equal(hasTrail(raid, { firstX: 60, lastX: 95, firstY: 25, lastY: 39 }), false)
  assert.equal(hasTrail([]), false)
  assert.equal(hasTrail(undefined), false)
})

test("the scripted playtest moves the trail on the script's own clock: the same keys draw the same frames, and waiting shows it move", () => {
  // Esc, then a quarter of a step at a time for four and a half steps.
  const steps = parseKeyScript(`Esc wait~${TRAIL_MOTION.stepMs / 4}*18`)
  const once = runBuildPlaytest({ steps }).frames.map((each) => frameToText(each.frame))
  const again = runBuildPlaytest({ steps }).frames.map((each) => frameToText(each.frame))
  assert.deepEqual(again, once)
  // Esc closes the intro and the trail starts from its still form; a step on, it has moved; and four steps on, a
  // spacing of the Grid's own distance, once the copies are gone, it is the still trail again.
  const closed = once[1]
  assert.notEqual(once[5], closed, "the trail did not move")
  assert.notEqual(once[9], closed)
  assert.equal(once[19], closed, "four steps on, the line is not where it began")
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
  assert.deepEqual(lines(7), ["AS THE ROUND STARTS", "5 from the north-east", "  3 runners, 2 raiders", "  targets your Barracks", "", "YOUR TROOPS", "10 head for the line"])
  assert.deepEqual(lines(6), ["AS THE ROUND STARTS", "5 from the north-east", "  targets your Barracks", "", "YOUR TROOPS", "10 head for the line"])
  assert.deepEqual(lines(5), ["AS THE ROUND STARTS", "5 from the north-east", "  targets your Barracks", "YOUR TROOPS", "10 head for the line"])
  assert.deepEqual(lines(4), ["AS THE ROUND STARTS", "5 from the north-east", "  3 runners, 2 raiders", "  targets your Barracks"])
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
