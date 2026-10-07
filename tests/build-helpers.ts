// Shared scaffolding for the Build Phase tests — not a test file itself: the runners only pick up
// `*.test.ts`. A Build Phase on the starter map, driven the way a player drives it: raw key bytes and
// mouse reports into the real adapters (`BuildSession.handleData`), and the frame the screen would draw
// read back as cells or text. `tests/pulse-helpers.ts` builds a Nexus Pulse on top of it.

import { strict as assert } from "node:assert"
import type { ExperimentField } from "../src/build/experiments.ts"
import type { BuildLayout } from "../src/build/layout.ts"
import { buildLayout, cellForTile, escLabel, escLabelSpan } from "../src/build/layout.ts"
import { MOUSE_LEFT, MOUSE_RIGHT, formatMouseEvent } from "../src/build/mouse.ts"
import type { PlacedPopup } from "../src/build/popup.ts"
import { placePopup, popupSpec } from "../src/build/popup.ts"
import type { BuildSessionOptions } from "../src/view/build-session.ts"
import { BuildSession } from "../src/view/build-session.ts"
import type { GameMenuRow } from "../src/build/settings.ts"
import { GAME_MENU_ROWS, settingRow } from "../src/build/settings.ts"
import type { BuildContext } from "../src/build/state.ts"
import { starterContext } from "../src/cli/starter.ts"
import type { Coord } from "../src/grid/types.ts"
import type { BuildCompositionInput } from "../src/view/build.ts"
import { composeBuildFrame } from "../src/view/build.ts"
import type { Cell, ReadonlyCellFrame } from "../src/view/frame.ts"
import { cellAt, frameToText } from "../src/view/frame.ts"
import type { CapabilityMode } from "../src/view/roles.ts"
import type { ActivityLog } from "../src/log/activity.ts"
import { createActivityLog } from "../src/log/activity.ts"

// --- Keys, as a terminal sends them ----------------------------------------------------------------

export const ESC = String.fromCharCode(27)
export const UP = `${ESC}[A`
export const DOWN = `${ESC}[B`
export const RIGHT = `${ESC}[C`
export const LEFT = `${ESC}[D`
export const SHIFT_UP = `${ESC}[1;2A`
export const SHIFT_DOWN = `${ESC}[1;2B`
export const SHIFT_RIGHT = `${ESC}[1;2C`
export const SHIFT_LEFT = `${ESC}[1;2D`
export const PAGE_UP = `${ESC}[5~`
export const PAGE_DOWN = `${ESC}[6~`
export const HOME = `${ESC}[H`
export const END = `${ESC}[F`
export const TAB = "\t"
export const ENTER = "\r"
export const SPACE = " "
export const BACKSPACE = String.fromCharCode(127)
export const CTRL_C = String.fromCharCode(3)

// --- Terminal sizes --------------------------------------------------------------------------------

/** The floor and the acceptance target: 49 x 18 tiles of Grid. */
export const MINIMUM = { columns: 80, rows: 24 }
/** Where the viewport reaches its largest, 72 x 24 tiles. */
export const MAXIMUM = { columns: 104, rows: 32 }
/** A wide terminal: a tile to a column, the widest view (72 tiles) and the rest spent on centring. */
export const WIDE = { columns: 128, rows: 24 }
/** A tall panel with room to spare, for what must not depend on the floor's height. */
export const ROOMY = { columns: 120, rows: 40 }

// --- A Build Phase ---------------------------------------------------------------------------------

/**
 * Open ground three tiles south of the Grid Nexus, where each building fits as it is armed. The real
 * screen opens on the Grid Nexus (`STARTER_START_CURSOR`), where arming moves the cursor to the nearest
 * good spot; a test that is not about that rule starts here, so a building armed stays where the cursor
 * is and the test can say where it goes. A test about the opening passes `cursor: STARTER_START_CURSOR`.
 */
export const OPEN_GROUND: Coord = { x: 18, y: 13 }

export type Side = Readonly<{ build: BuildSession; layout: BuildLayout; context: BuildContext }>

export type BuildSide = Side & Readonly<{ quits: () => number; activity: ActivityLog }>

export type SideOptions = Readonly<{
  context?: BuildContext
  cursor?: Coord
  terminal?: Readonly<{ columns: number; rows: number }>
}> &
  Pick<BuildSessionOptions, "onQuit" | "onExport" | "onSettingsChange" | "startPulse" | "nextRound" | "foresee" | "activity" | "barksOf">

/** An Activity Logs of a test's own, on `now` — a clock standing still at 0 unless
 *  the test passes one — so nothing a test logs reaches the game's global log, or another test's. */
export function activityLog(now: () => number = () => 0): ActivityLog {
  return createActivityLog(now)
}

/** A Build Phase session laid out for `terminal` (the 80 x 24 floor), on the starter map unless told
 *  otherwise, with the keyboard on the menu as the real screen opens. `quits()` counts the times it
 *  asked to leave. It records into an Activity Logs of its own (`activity`), which its Activity logs
 *  window shows, as the live screen's shows the log it records into. Laid out as the live screen is. */
export function buildSide(options: SideOptions = {}): BuildSide {
  const { context: given = starterContext(), cursor = OPEN_GROUND, terminal = MINIMUM, onQuit, activity = activityLog(), ...rest } = options
  const context: BuildContext = given.activity === undefined ? { ...given, activity } : given
  const layout = buildLayout(terminal, context.grid)
  let quits = 0
  const build = new BuildSession({
    ...rest,
    context,
    cursor,
    viewport: layout.viewport,
    activity,
    onQuit: () => {
      quits += 1
      onQuit?.()
    },
  })
  return { build, layout, context, quits: () => quits, activity }
}

// --- Driving it ------------------------------------------------------------------------------------

/** Keys pressed one after another, with no clock: every arrow a tap. */
export function keys(side: Pick<Side, "build" | "layout">, ...sequence: string[]): void {
  for (const key of sequence) side.build.handleData(key, side.layout)
}

/** Keys arriving at given times, as a live terminal delivers a held one: `[key, ms]` pairs. */
export function timed(side: Pick<Side, "build" | "layout">, sequence: readonly (readonly [string, number])[]): void {
  for (const [key, now] of sequence) side.build.handleData(key, side.layout, { now })
}

/** A mouse press at a frame cell (0-based column and row), through the real mouse adapter; `now` is the
 *  screen's clock when it arrived, for anything that times it. */
export function clickCell(side: Pick<Side, "build" | "layout">, column: number, row: number, button: number = MOUSE_LEFT, now?: number): void {
  side.build.handleData(formatMouseEvent(button, column + 1, row + 1), side.layout, now === undefined ? {} : { now })
}

/** A click on the cell a Grid tile is drawn on, through the state's camera. */
export function clickTile(side: Side, tile: Coord, button: number = MOUSE_LEFT): void {
  const cell = cellForTile(side.layout, side.build.state.camera, tile)
  clickCell(side, cell.x, cell.y, button)
}

/** A click on a frame row of the side panel, a few columns in — a menu row, or a card's line. */
export function clickPanelRow(side: Side, row: number): void {
  clickCell(side, side.layout.panelColumn + 3, row)
}

/** A right click on the map, somewhere in the middle of the view. */
export function rightClickMap(side: Side): void {
  const { camera } = side.build.state
  clickTile(side, { x: camera.x + 20, y: camera.y + 8 }, MOUSE_RIGHT)
}

/** A click on the top bar's right end, which names what Esc does — and is Esc. */
export function clickEscLabel(side: Side): void {
  const label = escLabelSpan(side.layout, escLabel(side.build.state))
  clickCell(side, label.from + 1, label.row)
}

/** The open popup, placed exactly as the frame draws it and the mouse adapter hit-tests it. */
export function placed(side: Side): PlacedPopup {
  const spec = popupSpec(side.context, side.build.state)
  assert.ok(spec !== null, "no popup is open")
  return placePopup(side.layout, spec)
}

/** A click on the open popup's option with this hotkey, on its name's line. */
export function clickPopupOption(side: Side, hotkey: string): void {
  const popup = placed(side)
  const row = popup.rows.find((entry) => entry.spec.kind === "option" && entry.spec.hotkey === hotkey && !entry.secondLine)
  assert.ok(row !== undefined, `no [${hotkey}] option in the popup`)
  clickCell(side, popup.textColumn + 2, row.row)
}

/** The keyboard's way to a row of the open popup's list: Up or Down from wherever the highlight is, as
 *  many as the row's position says — never a count that breaks when a row is added. */
export function goToPopupRow(side: Side, row: number): void {
  const from = side.build.state.popupHighlight
  keys(side, ...Array.from({ length: Math.abs(row - from) }, () => (row > from ? DOWN : UP)))
  assert.equal(side.build.state.popupHighlight, row, `the highlight did not reach row ${row}`)
}

/** In Settings, the keyboard's way to an Experiment's row. */
export function goToExperiment(side: Side, field: ExperimentField): void {
  goToPopupRow(side, settingRow(field))
}

/** In the game menu, the keyboard's way to one of its rows. */
export function goToGameMenuRow(side: Side, row: GameMenuRow): void {
  goToPopupRow(side, GAME_MENU_ROWS.indexOf(row))
}

// --- Reading the screen ----------------------------------------------------------------------------

/** The frame the screen draws for the session as it is — in its own glyph pack and reduced motion, the
 *  Nexus Pulse included while one plays — with `extra` for what the live loop adds at an instant (a
 *  flash, a flight, a reveal) or overrides. */
export function compose(side: Side, extra: Partial<BuildCompositionInput> = {}, capability: CapabilityMode = "monochrome"): ReadonlyCellFrame {
  const { build, layout } = side
  const pulse = build.pulseFrame()
  const raid = build.raid()
  return composeBuildFrame(
    {
      // The session's own round: after a Pulse the mission moves on to a new context.
      context: build.round,
      state: build.state,
      layout,
      glyphPack: build.state.settings.glyphPack,
      reducedMotion: build.state.settings.reducedMotion,
      ...(pulse === undefined ? {} : { pulse }),
      ...(raid === undefined ? {} : { raid }),
      ...extra,
    },
    capability,
  )
}

/** The screen as text, a line a frame row. */
export function screenText(side: Side, capability: CapabilityMode = "monochrome"): string {
  return frameToText(compose(side, {}, capability))
}

/** The frame row a panel row is drawn on: `CREDITS_ROW`, `CARD_HEADER_ROW` and their kind count from
 *  the panel's first line. */
export function panelRow(side: Pick<Side, "layout">, row: number): number {
  return side.layout.panelRow + row
}

/** One frame row's text across the side panel, from its first column to the divider. */
export function panelLine(side: Pick<Side, "layout">, frame: ReadonlyCellFrame, row: number): string {
  const line = frameToText(frame).split("\n")[row] ?? ""
  return line.padEnd(side.layout.frame.width).slice(side.layout.panelColumn, side.layout.dividerColumn)
}

/** Every line of the side panel, top to bottom. */
export function panelLines(side: Pick<Side, "layout">, frame: ReadonlyCellFrame): string[] {
  const rows: string[] = []
  for (let row = side.layout.panelRow; row <= side.layout.panelLastRow; row += 1) rows.push(panelLine(side, frame, row))
  return rows
}

/** The side panel's cells on one frame row, left to right. */
export function panelCells(side: Pick<Side, "layout">, frame: ReadonlyCellFrame, row: number): Cell[] {
  const cells: Cell[] = []
  for (let x = side.layout.panelColumn; x < side.layout.dividerColumn; x += 1) cells.push(cellAt(frame, x, row))
  return cells
}

/** The bottom line as drawn, without the frame's borders. */
export function bottomLineText(side: Side): string {
  return (screenText(side).split("\n")[side.layout.footerRow] ?? "").replace(/^\s*\|\s|\s*\|\s*$/g, "")
}

export type ChangedCell = Readonly<{ x: number; y: number; cell: Cell; was: Cell }>

/** The cells of `frame` that differ from the same place in `before`, glyph or style. */
export function changedCells(frame: ReadonlyCellFrame, before: ReadonlyCellFrame): ChangedCell[] {
  const cells: ChangedCell[] = []
  for (let y = 0; y < frame.height; y += 1) {
    for (let x = 0; x < frame.width; x += 1) {
      const cell = cellAt(frame, x, y)
      const was = cellAt(before, x, y)
      if (cell.glyph !== was.glyph || JSON.stringify(cell.style) !== JSON.stringify(was.style)) cells.push({ x, y, cell, was })
    }
  }
  return cells
}
