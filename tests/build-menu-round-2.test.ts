// The Build Phase menu after the owner's second round on the menu spike (2026-09-30, feedback F61,
// F63, F64, F67, F68, F70-F72) — the view side only: the menu's order and its credits line with the
// map's resource symbol, an active row that keeps its own hotkey and one `>`, a refused flicker that
// only greys the row's words, the focus arrow leaving from the row's place on the menu, Explore Map's
// see-through cursor, and the menu turning into a card. No row or height is hardcoded: every place is
// read from the layout.

import { test } from "node:test"
import assert from "node:assert/strict"
import { SPIKE_CATALOG } from "../src/build/catalog.ts"
import { DEBUG_FIELDS, initialDebugFlags } from "../src/build/debug.ts"
import type { DebugFlags } from "../src/build/debug.ts"
import type { BuildLayout } from "../src/build/layout.ts"
import {
  CARD_FIRST_ROW,
  CARD_HEADER_ROW,
  CARD_SEPARATOR_ROW,
  EXPLORE_ROW,
  NEXUS_ROW,
  RESOURCE_ROW,
  buildLayout,
  cellForTile,
  constructLines,
  menuEntryRow,
  startRow,
} from "../src/build/layout.ts"
import { BuildSession } from "../src/build/session.ts"
import type { BuildContext, BuildState } from "../src/build/state.ts"
import { EXPLORE_ENTRY, NEXUS_ENTRY, entryOfConstruct, menuEntries, remaining, startEntry } from "../src/build/state.ts"
import { defaultExperiments, formatSettingsExport, parseSettingsExport } from "../src/build/settings-export.ts"
import { spikeContext } from "../src/cli/spike.ts"
import { DEFAULT_SETTINGS } from "../src/settings/index.ts"
import { ACTIVE_VALUE, CARD_BEATS, GHOST_TRAIL, composeBuildFrame } from "../src/view/build.ts"
import type { BuildCompositionInput, BuildFlash } from "../src/view/build.ts"
import { BuildAnimation, cardKey, livePresentation } from "../src/view/build-live.ts"
import { cellAt, frameToText } from "../src/view/frame.ts"
import type { Cell, ReadonlyCellFrame } from "../src/view/frame.ts"
import { placementLook, placementSchedule } from "../src/view/placement.ts"
import type { CapabilityMode } from "../src/view/roles.ts"
import { CAPABILITY_MODES } from "../src/view/roles.ts"
import { chromeGlyph, terrainGlyph } from "../src/view/theme.ts"
import type { GlyphPack } from "../src/view/theme.ts"

const ESC = String.fromCharCode(27)
const DOWN = `${ESC}[B`
const TAB = "\t"
const ENTER = "\r"
const MINIMUM = { columns: 80, rows: 24 }
const ROOMY = { columns: 120, rows: 40 }
const FLAGS: DebugFlags = initialDebugFlags({})

type Side = { build: BuildSession; layout: BuildLayout; context: BuildContext }

function session(terminal = MINIMUM, cursor = { x: 18, y: 13 }): Side {
  const context = spikeContext()
  const layout = buildLayout(terminal, context.grid)
  const build = new BuildSession({ context, cursor, viewport: layout.viewport })
  return { build, layout, context }
}

function keys(side: Side, ...sequence: string[]): void {
  for (const key of sequence) side.build.handleData(key, side.layout)
}

function compose(
  side: Side,
  extra: Partial<BuildCompositionInput> = {},
  capability: CapabilityMode = "monochrome",
  glyphPack: GlyphPack = "ascii",
  state: BuildState = side.build.state,
): ReadonlyCellFrame {
  return composeBuildFrame({ context: side.context, state, layout: side.layout, glyphPack, ...extra }, capability)
}

/** One panel row's text, from the panel's first column to the divider. */
function panelLine(side: Side, frame: ReadonlyCellFrame, row: number): string {
  const line = frameToText(frame).split("\n")[row] ?? ""
  return line.padEnd(side.layout.frame.width).slice(side.layout.panelColumn, side.layout.dividerColumn)
}

/** Every panel row, top to bottom. */
function panelLines(side: Side, frame: ReadonlyCellFrame): string[] {
  const rows: string[] = []
  for (let row = side.layout.panelRow; row <= side.layout.panelBindingsRow; row += 1) rows.push(panelLine(side, frame, row))
  return rows
}

/** The panel's cells on one row, left to right. */
function rowCells(side: Side, frame: ReadonlyCellFrame, row: number): Cell[] {
  const cells: Cell[] = []
  for (let x = side.layout.panelColumn; x < side.layout.dividerColumn; x += 1) cells.push(cellAt(frame, x, row))
  return cells
}

const at = (side: Side, row: number): number => side.layout.panelRow + row

/** The frame cells that differ between two frames. */
function changed(a: ReadonlyCellFrame, b: ReadonlyCellFrame): { x: number; y: number; cell: Cell; was: Cell }[] {
  const cells: { x: number; y: number; cell: Cell; was: Cell }[] = []
  for (let y = 0; y < a.height; y += 1) {
    for (let x = 0; x < a.width; x += 1) {
      const cell = cellAt(a, x, y)
      const was = cellAt(b, x, y)
      if (cell.glyph !== was.glyph || JSON.stringify(cell.style) !== JSON.stringify(was.style)) cells.push({ x, y, cell, was })
    }
  }
  return cells
}

// --- The menu's order and the credits line (F71, F72) ----------------------------------------------

test("the menu reads Explore Map, Nexus, the credits line with the map's resource symbol, the buildings, Start Pulse last", () => {
  for (const terminal of [MINIMUM, ROOMY]) {
    for (const pack of ["ascii", "unicode"] as const) {
      const side = session(terminal)
      const { layout } = side
      const frame = compose(side, {}, "truecolor", pack)
      assert.deepEqual([EXPLORE_ROW, NEXUS_ROW, RESOURCE_ROW], [0, 1, 2])
      assert.match(panelLine(side, frame, at(side, EXPLORE_ROW)), /^\[e\] Explore Map +$/)
      assert.match(panelLine(side, frame, at(side, NEXUS_ROW)), /^\[n\] Nexus \(1\) +$/, "a blank line is left between Explore Map and Nexus")
      // The credits: the map's own deposit glyph and the amount, right-aligned where the costs are.
      const deposit = terrainGlyph("terrain.deposit", pack)
      assert.equal(deposit.glyph, pack === "ascii" ? "*" : "◆")
      const credits = panelLine(side, frame, at(side, RESOURCE_ROW))
      assert.equal(credits, `${deposit.glyph} ${remaining(side.context, side.build.state)}`.padStart(layout.panelLimit))
      const symbol = cellAt(frame, layout.dividerColumn - 5, at(side, RESOURCE_ROW))
      assert.equal(symbol.glyph, deposit.glyph)
      assert.equal(symbol.style.fgRole, deposit.role, "the symbol is not in the deposit's colour")
      const amount = cellAt(frame, layout.dividerColumn - 1, at(side, RESOURCE_ROW))
      assert.equal(amount.style.fgRole, "chrome.title")
      assert.equal(amount.style.bold, true)
      // The buildings start on the line after the credits, one row apart, costs in the credits' column.
      const lines = constructLines(layout, SPIKE_CATALOG)
      assert.equal(lines[0]?.row, at(side, RESOURCE_ROW) + 1)
      SPIKE_CATALOG.forEach((item, index) => {
        assert.equal(panelLine(side, frame, lines[index]?.row as number), `[${item.hotkey}] ${item.label}`.padEnd(layout.panelLimit - String(item.cost).length) + String(item.cost))
      })
      assert.match(panelLine(side, frame, startRow(layout)), /^\[s\] Start Pulse +$/)
      // No `$` anywhere, and nothing on the panel's top line but Explore Map.
      assert.doesNotMatch(panelLines(side, frame).join("\n"), /\$/)
    }
  }
})

test("the map draws its deposits with the very glyph the credits line uses", () => {
  for (const pack of ["ascii", "unicode"] as const) {
    const side = session()
    const frame = compose(side, {}, "truecolor", pack)
    const deposit = terrainGlyph("terrain.deposit", pack)
    let onMap = 0
    for (let y = side.layout.origin.row; y < side.layout.origin.row + side.layout.viewport.height; y += 1) {
      for (let x = side.layout.origin.column; x < side.layout.gridBox.right; x += 1) {
        const cell = cellAt(frame, x, y)
        if (cell.glyph === deposit.glyph && cell.style.fgRole === deposit.role) onMap += 1
      }
    }
    assert.ok(onMap > 0, `${pack}: no deposit on the map drawn as ${deposit.glyph}`)
  }
})

test("no credits on a card: a building's, and Explore Map's", () => {
  for (const pack of ["ascii", "unicode"] as const) {
    const symbol = terrainGlyph("terrain.deposit", pack).glyph
    for (const open of [["1"], ["e"], [DOWN, DOWN, DOWN, ENTER]]) {
      const side = session()
      keys(side, ...open)
      const frame = compose(side, {}, "truecolor", pack)
      const lines = panelLines(side, frame)
      assert.equal(lines.some((line) => line.trimEnd().endsWith(`${symbol} ${remaining(side.context, side.build.state)}`)), false, `${JSON.stringify(open)}: the credits are on the card`)
      // The card's header is its first line; the separator under it; the card from the line after.
      assert.match(lines[CARD_HEADER_ROW] as string, /^\[[0-9e]\] \S/)
      assert.equal(lines[CARD_SEPARATOR_ROW], chromeGlyph(pack, "horizontal").repeat(side.layout.panelLimit))
      assert.notEqual((lines[CARD_FIRST_ROW] as string).trim(), "")
    }
  }
})

// --- The active row (F67, F70) ---------------------------------------------------------------------

test("an active row keeps its own hotkey, ends in one >, is the hotkey's colour and bold, and is never underlined", () => {
  const cases: readonly [string, string[], (side: Side) => number, RegExp][] = [
    ["a building", ["1"], (side) => at(side, CARD_HEADER_ROW), /^\[1\] Barracks +>$/],
    ["a building from the menu", [DOWN, DOWN, DOWN, ENTER], (side) => at(side, CARD_HEADER_ROW), /^\[2\] Hatchery +>$/],
    ["Explore Map", ["e"], (side) => at(side, CARD_HEADER_ROW), /^\[e\] Explore Map +>$/],
    ["Nexus", ["n"], (side) => at(side, NEXUS_ROW), /^\[n\] Nexus \(1\) +>$/],
    ["Start Pulse", ["n", "1", "s"], (side) => startRow(side.layout), /^\[s\] Start Pulse +>$/],
  ]
  for (const [name, open, rowOf, reads] of cases) {
    for (const capability of CAPABILITY_MODES) {
      const side = session()
      keys(side, ...open)
      const frame = compose(side, {}, capability)
      const row = rowOf(side)
      const line = panelLine(side, frame, row)
      assert.match(line, reads, `${name}: reads "${line}"`)
      assert.equal(ACTIVE_VALUE, ">")
      assert.doesNotMatch(line, /\[x\]|>>/, `${name}: still the old [x] ... >> look`)
      for (const cell of rowCells(side, frame, row)) {
        if (cell.glyph === " ") continue
        assert.notEqual(cell.style.underline, true, `${name}: "${cell.glyph}" is underlined at ${capability}`)
        assert.notEqual(cell.style.inverse, true, `${name}: drawn with the keyboard's bar`)
        assert.equal(cell.style.fgRole, "chrome.hotkey", `${name}: "${cell.glyph}" is not in the hotkey's colour`)
        assert.equal(cell.style.bold, true, `${name}: "${cell.glyph}" is not bold`)
      }
    }
  }
})

// --- The refused flicker (F61) ---------------------------------------------------------------------

test("a refused flicker on the highlighted row keeps the bar and greys only the words, at every tier", () => {
  const side = session()
  const row = at(side, EXPLORE_ROW)
  const refused: BuildFlash = { kind: "refused", entry: EXPLORE_ENTRY }
  const expected: Readonly<Record<CapabilityMode, Readonly<{ bgRole?: string; dim?: boolean }>>> = {
    monochrome: { dim: true },
    color16: { bgRole: "chrome.edge" },
    color256: { bgRole: "chrome.muted" },
    truecolor: { bgRole: "chrome.muted" },
  }
  for (const capability of CAPABILITY_MODES) {
    const selected = rowCells(side, compose(side, {}, capability), row)
    const flicker = rowCells(side, compose(side, { flash: refused }, capability), row)
    assert.deepEqual(flicker.map((cell) => cell.glyph), selected.map((cell) => cell.glyph), "the flicker changed the row's words")
    flicker.forEach((cell, index) => {
      const was = selected[index] as Cell
      // The bar is the bar: inverse in the bar's role on every cell, words and blanks alike.
      assert.equal(cell.style.inverse, true, `${capability}: cell ${index} left the bar`)
      assert.equal(cell.style.fgRole, "chrome.title", `${capability}: cell ${index} changed the bar's colour`)
      assert.notEqual(cell.style.bold, true)
      assert.notEqual(cell.style.underline, true)
      const blankTail = index >= "[e] Explore Map".length
      if (blankTail) assert.deepEqual(cell.style, was.style, `${capability}: the bar beyond the words changed`)
    })
    // The words: grey, the way this tier can show grey.
    const word = flicker[1] as Cell // the "e" of "[e]"
    const want = expected[capability]
    if (want.bgRole !== undefined) assert.equal(word.style.bgRole, want.bgRole, `${capability}: the words are not grey`)
    if (want.dim === true) assert.equal(word.style.dim, true, `${capability}: the words are not dim`)
  }
})

test("a refused flicker on a plain row leaves it plain and greys its words; on an active header too", () => {
  for (const capability of CAPABILITY_MODES) {
    const side = session() // the highlight on Explore Map; Nexus is plain
    const row = at(side, NEXUS_ROW)
    const flicker = rowCells(side, compose(side, { flash: { kind: "refused", entry: NEXUS_ENTRY } }, capability), row)
    for (const cell of flicker) {
      assert.notEqual(cell.style.inverse, true, `${capability}: a bar appeared`)
      if (cell.glyph === " ") continue
      assert.equal(cell.style.fgRole, "chrome.muted")
      assert.equal(cell.style.dim, true)
      assert.notEqual(cell.style.bold, true)
    }
    // The header of a building's card, flickering: still no bar, the words grey.
    const armed = session()
    keys(armed, "1")
    const header = rowCells(armed, compose(armed, { flash: { kind: "refused", entry: entryOfConstruct(0) } }, capability), at(armed, CARD_HEADER_ROW))
    assert.match(header.map((cell) => cell.glyph).join(""), /^\[1\] Barracks +>$/)
    for (const cell of header) {
      assert.notEqual(cell.style.inverse, true)
      if (cell.glyph !== " ") assert.equal(cell.style.fgRole, "chrome.muted")
    }
  }
})

test("the refused flicker is always weaker than the pressed flash", () => {
  const side = session()
  const row = at(side, EXPLORE_ROW)
  for (const capability of CAPABILITY_MODES) {
    const pressed = rowCells(side, compose(side, { flash: { kind: "pressed", entry: EXPLORE_ENTRY } }, capability), row)
    const refused = rowCells(side, compose(side, { flash: { kind: "refused", entry: EXPLORE_ENTRY } }, capability), row)
    const selected = rowCells(side, compose(side, {}, capability), row)
    // Pressed changes the whole bar: the hotkey's colour, bold, underlined.
    assert.ok(pressed.every((cell) => cell.style.fgRole === "chrome.hotkey" && cell.style.bold === true && cell.style.underline === true))
    // Refused keeps the bar exactly as selected draws it, and adds nothing loud to the words.
    refused.forEach((cell, index) => {
      assert.equal(cell.style.inverse, (selected[index] as Cell).style.inverse)
      assert.notEqual(cell.style.underline, true)
      assert.notEqual(cell.style.bold, true)
      assert.notEqual(cell.style.fgRole, "chrome.hotkey")
    })
  }
})

// --- The arrow leaves from the row's place on the menu (F63) ---------------------------------------

/** The arrow's cells: what a frame with a flight has that the same frame without one does not. */
function flightCells(side: Side, progress: number, capability: CapabilityMode = "monochrome") {
  return changed(compose(side, { focusArrow: { progress } }, capability), compose(side, {}, capability))
}

test("a building's arrow leaves from the cell right of its row on the menu, not from the card's header", () => {
  for (const [key, index] of [["1", 0], ["2", 1], ["3", 2]] as const) {
    const side = session()
    keys(side, key)
    const home = menuEntryRow(side.layout, SPIKE_CATALOG, { kind: "construct", index }) as number
    assert.notEqual(home, at(side, CARD_HEADER_ROW))
    const launch = flightCells(side, 0)
    assert.deepEqual(launch.map((cell) => [cell.x, cell.y]), [[side.layout.dividerColumn, home]], `${key}: the arrow does not leave from its row`)
    assert.ok([">", "v", "^"].includes(launch[0]?.cell.glyph as string), `${key}: no arrow head at the start`)
    // Still an arrow: glyphs, no see-through cursor.
    const mid = flightCells(side, 0.5)
    assert.ok(mid.some((cell) => cell.cell.glyph !== cell.was.glyph), `${key}: no arrow glyphs`)
    assert.ok(!mid.some((cell) => cell.cell.style.overlay !== undefined), `${key}: a building's hand-off drew the see-through cursor`)
  }
})

// --- Explore Map's see-through cursor (F64) --------------------------------------------------------

test("Explore Map's hand-off is a see-through copy of the cursor: glyphless overlay writes, no arrow glyphs", () => {
  for (const terminal of [MINIMUM, ROOMY]) {
    const side = session(terminal)
    keys(side, "e")
    const { layout } = side
    const cursor = cellForTile(layout, side.build.state.camera, side.build.state.cursor)
    const alphas = new Set(GHOST_TRAIL.map((copy) => copy.alpha))
    assert.deepEqual([...alphas], [0.8, 0.45, 0.2])
    for (const progress of [0, 0.1, 0.3, 0.6, 0.9]) {
      const cells = flightCells(side, progress, "truecolor")
      assert.ok(cells.length > 0, `nothing drawn at ${progress}`)
      for (const { x, y, cell, was } of cells) {
        assert.equal(cell.glyph, was.glyph, `a glyph changed at ${x},${y}: the see-through cursor must keep what is beneath`)
        const { overlay, ...rest } = cell.style
        assert.deepEqual(rest, was.style, `the style beneath changed at ${x},${y}`)
        assert.equal(overlay?.role, "chrome.title")
        assert.ok(alphas.has(overlay?.alpha as number), `alpha ${overlay?.alpha}`)
        // Never on the real cursor's own cells, into which it settles.
        assert.ok(!(y === cursor.y && x >= cursor.x && x < cursor.x + layout.tileWidth), `drawn on the cursor at ${x},${y}`)
      }
    }
    // At the start, the head: one tile wide, full strength, leaving from Explore Map's row at the divider.
    const start = flightCells(side, 0, "truecolor")
    const head = start.filter((cell) => cell.cell.style.overlay?.alpha === 0.8)
    assert.deepEqual(
      head.map((cell) => [cell.x, cell.y]),
      Array.from({ length: layout.tileWidth }, (_, extra) => [layout.dividerColumn + extra, at(side, EXPLORE_ROW)]),
    )
    // Later, the head and a fainter trail behind it.
    const mid = flightCells(side, 0.3, "truecolor").map((cell) => cell.cell.style.overlay?.alpha)
    assert.ok(mid.includes(0.8) && mid.includes(0.45), `no trail at 0.3: ${mid.join(" ")}`)
  }
})

test("no see-through cursor with a popup open, on the menu, or in a still frame", () => {
  const side = session()
  keys(side, "e")
  assert.ok(flightCells(side, 0.5).length > 0)
  const menu = session()
  assert.equal(flightCells(menu, 0.5).length, 0)
  keys(side, "n") // a popup over the map
  assert.equal(flightCells(side, 0.5).length, 0)
  const still = session()
  keys(still, "e")
  const frame = compose(still)
  assert.ok(!frame.cells.some((cell) => cell.style.overlay !== undefined), "a still frame carries an overlay")
})

// --- The card reveal (F68): the drawing -------------------------------------------------------------

/** The Turret armed from the menu — its row the furthest from the header. */
function turret(): Side {
  const side = session()
  keys(side, "3")
  return side
}

test("beat 1: the chosen row, active, stays where it is on the menu while every other row fades", () => {
  const side = turret()
  const home = menuEntryRow(side.layout, SPIKE_CATALOG, { kind: "construct", index: 2 }) as number
  const progress = CARD_BEATS.fade * 0.4
  for (const capability of CAPABILITY_MODES) {
    const frame = compose(side, { cardReveal: { progress, menu: true } }, capability)
    assert.match(panelLine(side, frame, home), /^\[3\] Turret +>$/)
    assert.match(panelLine(side, frame, at(side, EXPLORE_ROW)), /^\[e\] Explore Map/, "the other rows are already gone")
    assert.match(panelLine(side, frame, startRow(side.layout)), /^\[s\] Start Pulse/)
    assert.doesNotMatch(panelLines(side, frame).join("\n"), /-{10}/, "the card's separator is already drawn")
    const other = cellAt(frame, side.layout.panelColumn + 1, at(side, EXPLORE_ROW)).style
    const chosen = cellAt(frame, side.layout.panelColumn + 1, home).style
    assert.equal(chosen.fade, undefined, "the chosen row fades")
    if (capability === "truecolor" || capability === "color256") assert.ok((other.fade ?? 0) > 0, `${capability}: the other rows do not fade`)
  }
  // Where colour cannot blend, the fading rows are dim for the half nearer gone.
  const late = compose(side, { cardReveal: { progress: CARD_BEATS.fade * 0.8, menu: true } }, "color16")
  assert.equal(cellAt(late, side.layout.panelColumn + 1, at(side, EXPLORE_ROW)).style.dim, true)
})

test("beat 2: the chosen row alone slides up a whole row at a time to the header line", () => {
  const side = turret()
  const home = menuEntryRow(side.layout, SPIKE_CATALOG, { kind: "construct", index: 2 }) as number
  const header = at(side, CARD_HEADER_ROW)
  const rows: number[] = []
  for (let step = 0; step < 10; step += 1) {
    const progress = CARD_BEATS.fade + (CARD_BEATS.slide * step) / 10
    const lines = panelLines(side, compose(side, { cardReveal: { progress, menu: true } }))
    const drawn = lines.map((line, index) => [line, index] as const).filter(([line]) => line.trim() !== "")
    assert.equal(drawn.length, 1, `at ${progress} the panel shows ${drawn.length} lines`)
    assert.match(drawn[0]?.[0] as string, /^\[3\] Turret +>$/)
    rows.push(side.layout.panelRow + (drawn[0]?.[1] as number))
  }
  assert.equal(rows[0], home, "the slide does not start from the row's place")
  for (let index = 1; index < rows.length; index += 1) assert.ok((rows[index] as number) <= (rows[index - 1] as number), "the row went back down")
  assert.ok(rows.some((row) => row < home && row > header), "no row between its place and the header")
})

test("beat 3: the header in place, the card fading in, its words typed, the icon going up", () => {
  const side = session()
  keys(side, "1") // the Barracks, whose placement frames are authored
  const still = compose(side, {}, "truecolor")
  const start = CARD_BEATS.fade + CARD_BEATS.slide
  const early = compose(side, { cardReveal: { progress: start + 0.02, menu: true } }, "truecolor")
  const lines = panelLines(side, early)
  assert.match(lines[CARD_HEADER_ROW] as string, /^\[1\] Barracks +>$/)
  // The separator is there, fading in.
  assert.equal(lines[CARD_SEPARATOR_ROW], "-".repeat(side.layout.panelLimit))
  assert.ok((cellAt(early, side.layout.panelColumn, at(side, CARD_SEPARATOR_ROW)).style.fade ?? 0) > 0.5)
  // The name is typed from its first letter: none or a few of its letters so far.
  const name = (lines[CARD_FIRST_ROW] as string).slice(5).trim()
  assert.ok("Barracks".startsWith(name) && name.length < "Barracks".length, `the name reads "${name}"`)
  // The icon plays the Barracks' own placement frames — the very ones a building going up plays.
  const framesMs = FLAGS.cardRevealMs * CARD_BEATS.card
  const schedule = placementSchedule(
    { ordinal: 0, contentId: "structure.citizen.barracks", anchor: { x: 0, y: 0 } },
    side.context.registry.get("structure.citizen.barracks").footprint,
    { ...FLAGS, placeFramesMs: framesMs, placeGlowMs: 0 },
    false,
  )
  const elapsed = (0.02 / CARD_BEATS.card) * framesMs
  for (let y = 0; y < 2; y += 1) {
    for (let x = 0; x < 3; x += 1) {
      const look = placementLook(schedule, "structure.citizen.barracks", { x, y }, elapsed)
      assert.equal(cellAt(early, side.layout.panelColumn + x, at(side, CARD_FIRST_ROW) + y).glyph, look.glyph ?? " ", `icon ${x},${y}`)
    }
  }
  assert.notEqual(panelLines(side, early).slice(CARD_FIRST_ROW, CARD_FIRST_ROW + 2).join("|"), panelLines(side, still).slice(CARD_FIRST_ROW, CARD_FIRST_ROW + 2).join("|"), "the icon is already finished")
  // Halfway through the beat: more typed, the numbers fading in.
  const half = panelLines(side, compose(side, { cardReveal: { progress: start + CARD_BEATS.card / 2, menu: true } }, "truecolor"))
  const typed = half.join("\n").replace(/\s+/gu, "").length
  const early_ = lines.join("\n").replace(/\s+/gu, "").length
  assert.ok(typed > early_, "nothing more was typed halfway")
  // At its end and after it, the finished card exactly as a still frame draws it.
  assert.deepEqual(compose(side, { cardReveal: { progress: 1, menu: true } }, "truecolor"), still)
})

test("a still frame is the finished card; from another card only the card's own beat plays", () => {
  const side = session()
  keys(side, "2")
  // No reveal: exactly today's card.
  assert.deepEqual(compose(side, {}, "truecolor"), compose(side, {}, "truecolor"))
  // From another card: the header already in place and the separator drawn, from the first instant.
  const from = compose(side, { cardReveal: { progress: 0.05, menu: false } }, "monochrome")
  const lines = panelLines(side, from)
  assert.match(lines[CARD_HEADER_ROW] as string, /^\[2\] Hatchery +>$/)
  assert.equal(lines[CARD_SEPARATOR_ROW], "-".repeat(side.layout.panelLimit))
  assert.doesNotMatch(lines.join("\n"), /\[e\] Explore Map|\[3\] Turret/, "the menu came back between two cards")
})

test("Explore Map's card reveals the same way, its row already on the header line", () => {
  const side = session()
  keys(side, "e")
  const slide = CARD_BEATS.fade + CARD_BEATS.slide / 2
  const lines = panelLines(side, compose(side, { cardReveal: { progress: slide, menu: true } }))
  assert.match(lines[CARD_HEADER_ROW] as string, /^\[e\] Explore Map +>$/)
  assert.equal(lines.filter((line) => line.trim() !== "").length, 1)
})

// --- The card reveal (F68): the live loop -----------------------------------------------------------

test("the live loop plays the reveal from the frame the panel becomes a card, keeps the timer running, and stops at its end", () => {
  const side = session()
  const animation = new BuildAnimation()
  assert.equal(animation.frame(side.build.state, 0).cardReveal, undefined, "a reveal on the first frame")
  keys(side, "1")
  const first = animation.frame(side.build.state, 1000)
  assert.deepEqual(first.cardReveal, { progress: 0, menu: true })
  assert.ok((first.busyUntil ?? 0) >= 1000 + FLAGS.cardRevealMs)
  assert.deepEqual(animation.frame(side.build.state, 1075).cardReveal, { progress: 0.5, menu: true })
  assert.deepEqual(livePresentation(animation.frame(side.build.state, 1075)).cardReveal, { progress: 0.5, menu: true })
  assert.equal(animation.frame(side.build.state, 1000 + FLAGS.cardRevealMs).cardReveal, undefined)
  // Closing is instant; opening again plays it again.
  keys(side, ESC)
  assert.equal(animation.frame(side.build.state, 2000).cardReveal, undefined)
  keys(side, "e")
  assert.deepEqual(animation.frame(side.build.state, 3000).cardReveal, { progress: 0, menu: true })
})

test("a change from one card to another armed building reveals only the card; the same card never replays", () => {
  const side = session()
  const animation = new BuildAnimation()
  const base = side.build.state
  animation.frame(base, 0)
  const exploring: BuildState = { ...base, focus: "grid", exploreMap: true, armed: null }
  const barracks: BuildState = { ...exploring, exploreMap: false, armed: 0 }
  const turretState: BuildState = { ...barracks, armed: 2 }
  assert.equal(cardKey(exploring), "explore")
  assert.equal(cardKey(barracks), "armed:0")
  assert.equal(cardKey(base), null)
  assert.deepEqual(animation.frame(exploring, 1000).cardReveal, { progress: 0, menu: true })
  assert.deepEqual(animation.frame(barracks, 2000).cardReveal, { progress: 0, menu: false })
  assert.equal(animation.frame(barracks, 2000 + FLAGS.cardRevealMs + 1).cardReveal, undefined)
  // The same card, frame after frame (the cursor moving under Explore Map's, a popup over it): nothing.
  assert.equal(animation.frame({ ...barracks, cursor: { x: 3, y: 3 } }, 3000).cardReveal, undefined)
  assert.deepEqual(animation.frame(turretState, 4000).cardReveal, { progress: 0, menu: false })
})

test("no reveal under reduced motion or with the Experiment off", () => {
  const reduced = session()
  const animation = new BuildAnimation()
  animation.frame(reduced.build.state, 0, { reducedMotion: true })
  keys(reduced, "1")
  const frame = animation.frame(reduced.build.state, 1000, { reducedMotion: true })
  assert.equal(frame.cardReveal, undefined)

  const off = session()
  const quiet = new BuildAnimation()
  quiet.frame(off.build.state, 0)
  const state: BuildState = { ...off.build.state, debug: { ...off.build.state.debug, cardRevealMs: 0 }, focus: "grid", armed: 0 }
  assert.equal(quiet.frame(state, 1000).cardReveal, undefined)
})

test("the reveal and the hand-off start together: neither waits for the other", () => {
  const side = session()
  const animation = new BuildAnimation()
  animation.frame(side.build.state, 0)
  keys(side, DOWN, DOWN, ENTER) // the Barracks, from the menu
  const frame = animation.frame(side.build.state, 1000)
  assert.deepEqual(frame.cardReveal, { progress: 0, menu: true })
  assert.deepEqual(frame.focusArrow, { progress: 0 })
  // A digit on the map arms without a hand-off, and the card still reveals.
  const map = session()
  const loop = new BuildAnimation()
  loop.frame(map.build.state, 0)
  keys(map, TAB, "2")
  const armed = loop.frame(map.build.state, 1000)
  assert.equal(armed.focusArrow, undefined)
  assert.deepEqual(armed.cardReveal, { progress: 0, menu: true })
})

// --- The Experiment ---------------------------------------------------------------------------------

test("Card reveal is an Experiment beside the focus arrow, 150 ms by default, and round-trips through the export", () => {
  const fields = DEBUG_FIELDS.map((spec) => spec.field)
  assert.deepEqual(fields.slice(0, 3), ["focusArrowMs", "cursorBlinks", "cardRevealMs"])
  const spec = DEBUG_FIELDS[2]
  assert.equal(spec?.label, "Card reveal")
  assert.deepEqual(spec?.values, [0, 100, 150, 250, 400, 800])
  assert.match(spec?.question ?? "", /\(F68\)$/)
  assert.equal(FLAGS.cardRevealMs, 150)
  const experiments: DebugFlags = { ...defaultExperiments(), cardRevealMs: 400 }
  const text = formatSettingsExport({ settings: DEFAULT_SETTINGS, experiments })
  assert.match(text, /cardRevealMs = 400 {2}# Card reveal, default 150 ms/)
  const back = parseSettingsExport(text, { settings: DEFAULT_SETTINGS, experiments: defaultExperiments() })
  assert.equal(back.snapshot.experiments.cardRevealMs, 400)
  assert.deepEqual(back.ignored, [])
  const off = parseSettingsExport("cardRevealMs=off", { settings: DEFAULT_SETTINGS, experiments: defaultExperiments() })
  assert.equal(off.snapshot.experiments.cardRevealMs, 0)
  // At its defaults it is listed with the rest.
  assert.match(formatSettingsExport({ settings: DEFAULT_SETTINGS, experiments: defaultExperiments() }), /^cardRevealMs = 150 {2}# Card reveal$/m)
})

// --- Still one geometry -----------------------------------------------------------------------------

test("every menu row is drawn where the mouse finds it, and the credits line is no click target", async () => {
  const { menuEntryAt } = await import("../src/build/layout.ts")
  const side = session()
  menuEntries(side.context).forEach((target, entry) => {
    const row = menuEntryRow(side.layout, SPIKE_CATALOG, target) as number
    assert.equal(menuEntryAt(side.layout, SPIKE_CATALOG, side.layout.panelColumn + 2, row), entry)
  })
  assert.equal(menuEntryAt(side.layout, SPIKE_CATALOG, side.layout.panelColumn + 2, at(side, RESOURCE_ROW)), null)
  assert.equal(menuEntryAt(side.layout, SPIKE_CATALOG, side.layout.panelColumn + 2, startRow(side.layout)), startEntry(SPIKE_CATALOG.length))
})
