// The Build Phase's popups — one shape for all four: the Nexus powers, the start-the-Pulse question,
// the exit question, and Debug Mode. Extracted when there were three real uses (AGENTS.md: "extract a
// framework only after two real uses reveal the boundary"); Debug Mode, the fourth, added the one row
// the first three had no use for — a setting whose value Left and Right change.
//
// A popup is **data**: a title and a list of rows, some of them options that name the command a click
// on them sends. `overlaySpec` derives it from the state; `placeOverlay` puts it on the frame;
// `overlayHitAt` answers what a click at a frame cell means. The composer draws from the same placed
// spec the mouse adapter hit-tests against, so a click can never land on a row the frame did not draw
// there — the same guarantee `layout.ts` gives the side panel.

import type { DebugApplies } from "./debug.ts"
import { DEBUG_FIELDS, DEBUG_RESTART_QUESTION, DEBUG_RESTART_ROW, fieldAtRow, fieldSpec, formatDebugValue } from "./debug.ts"
import type { BuildLayout } from "./layout.ts"
import type { BuildContext, BuildState } from "./state.ts"
import { nexusPowers } from "./state.ts"
import type { BuildCommand } from "./types.ts"

export type OverlayRow =
  | Readonly<{ kind: "blank" }>
  | Readonly<{ kind: "heading"; text: string }>
  | Readonly<{ kind: "text"; text: string; muted?: boolean; strong?: boolean }>
  /** A choice: its hotkey and label, what clicking it sends, and whether the keyboard is on it. An
   *  option with a description takes a second row for it, and either row is its click target. */
  | Readonly<{
      kind: "option"
      hotkey: string
      label: string
      command: BuildCommand
      highlighted?: boolean
      description?: string
    }>
  /**
   * A setting (Debug Mode): its name, its value between `<` and `>`, and when a change is seen. Left
   * and Right change the value; a click on the left half of the value is Left, on the right half is
   * Right, and anywhere else on the row highlights it.
   */
  | Readonly<{
      kind: "setting"
      label: string
      value: string
      applies: DebugApplies
      highlighted: boolean
      decrease: BuildCommand
      increase: BuildCommand
      select: BuildCommand
    }>
  /** Text wrapped at words to the popup's width, in a fixed number of lines so the popup keeps its
   *  height whichever text it holds. A line that does not fit is dropped, never cut. */
  | Readonly<{ kind: "note"; text: string; lines: number }>

export type OverlaySpec = Readonly<{ title: string; rows: readonly OverlayRow[] }>

/** How many lines the Debug Mode popup keeps for the highlighted flag's question. Every question
 *  fits in this many at the narrowest popup (a test holds them to it). */
export const DEBUG_NOTE_LINES = 3

/** The Debug Mode popup: every flag with its value and when a change is seen, the restart, and the
 *  question the highlighted row serves. */
function debugSpec(state: BuildState): OverlaySpec {
  const rows: OverlayRow[] = [{ kind: "blank" }]
  DEBUG_FIELDS.forEach((spec, index) => {
    rows.push({
      kind: "setting",
      label: spec.label,
      value: formatDebugValue(state.debug, spec.field),
      applies: spec.applies,
      highlighted: index === state.overlayHighlight,
      decrease: { kind: "debug-adjust", field: spec.field, step: -1 },
      increase: { kind: "debug-adjust", field: spec.field, step: 1 },
      select: { kind: "debug-select", row: index },
    })
  })
  rows.push(
    { kind: "blank" },
    {
      kind: "option",
      hotkey: "r",
      label: "Restart with these settings",
      command: { kind: "debug-restart" },
      highlighted: state.overlayHighlight === DEBUG_RESTART_ROW,
    },
    { kind: "blank" },
  )
  const field = fieldAtRow(state.overlayHighlight)
  rows.push({ kind: "note", text: field === null ? DEBUG_RESTART_QUESTION : fieldSpec(field).question, lines: DEBUG_NOTE_LINES })
  return { title: "DEBUG MODE - not saved", rows }
}

/** The popup the state has open, as data, or `null`. */
export function overlaySpec(context: BuildContext, state: BuildState): OverlaySpec | null {
  switch (state.overlay) {
    case "nexus-powers": {
      const powers = nexusPowers(context, state)
      const rows: OverlayRow[] = [{ kind: "blank" }]
      if (powers.pending.length > 0) {
        rows.push({ kind: "heading", text: "PICK ONE - needed before the Pulse" })
        powers.pending.forEach(({ index, option }, position) => {
          rows.push({
            kind: "option",
            hotkey: option.hotkey,
            label: option.name,
            command: { kind: "pick-nexus", index },
            highlighted: position === state.overlayHighlight,
            description: option.description,
          })
        })
      } else {
        rows.push({ kind: "heading", text: "PICK" }, { kind: "text", text: "Nothing waiting.", muted: true })
      }
      rows.push({ kind: "blank" }, { kind: "heading", text: "ACTIVE" })
      if (powers.active.length === 0) rows.push({ kind: "text", text: "None yet.", muted: true })
      for (const option of powers.active) {
        rows.push({ kind: "text", text: option.name, strong: true })
        rows.push({ kind: "text", text: `    ${option.description}`, muted: true })
      }
      return { title: "NEXUS POWERS", rows }
    }
    case "confirm-commit":
      return {
        title: "START THE NEXUS PULSE?",
        rows: [
          { kind: "blank" },
          { kind: "text", text: "Ends the Build Phase. The plan is locked in." },
          { kind: "blank" },
          { kind: "option", hotkey: "y", label: "Yes, start the Pulse", command: { kind: "confirm-commit", accept: true } },
          { kind: "option", hotkey: "n", label: "No, keep building", command: { kind: "confirm-commit", accept: false } },
        ],
      }
    case "exit":
      return {
        title: "EXIT THE GAME?",
        rows: [
          { kind: "blank" },
          { kind: "text", text: "The plan is not saved." },
          { kind: "blank" },
          { kind: "option", hotkey: "q", label: "Quit", command: { kind: "quit" } },
          { kind: "option", hotkey: "esc", label: "Keep playing", command: { kind: "cancel" } },
        ],
      }
    case "debug":
      return debugSpec(state)
    default:
      return null
  }
}

/** One row of a placed popup: its frame row, and the spec row it draws. A note's rows each carry
 *  their own wrapped line of it in `text`. */
export type PlacedRow = Readonly<{ row: number; spec: OverlayRow; secondLine: boolean; text?: string }>

export type PlacedOverlay = Readonly<{
  spec: OverlaySpec
  /** The border's own rectangle, inclusive. The shadow falls one cell right of it and one below. */
  box: Readonly<{ left: number; top: number; right: number; bottom: number }>
  textColumn: number
  textLimit: number
  rows: readonly PlacedRow[]
  /** `[esc]` in the top border's right end: the close hotkey, drawn, and its click target. */
  close: Readonly<{ row: number; from: number; to: number }>
}>

/** Wider than the gate 5F popup (owner, 2026-09-27: "the popup probably larger too"), never wider than
 *  the Grid pane it sits over, less a column for its shadow. */
const POPUP_WIDTH = 52
export const CLOSE_LABEL = "[esc]"

/** Splits text into lines of at most `limit` glyphs, breaking between words — never inside one, unless
 *  a single word is longer than the whole line. */
export function wrapWords(value: string, limit: number): readonly string[] {
  const lines: string[] = []
  let current = ""
  for (const word of value.split(" ").filter((part) => part !== "")) {
    const grown = current === "" ? word : `${current} ${word}`
    if (grown.length <= limit || current === "") current = grown
    else {
      lines.push(current)
      current = word
    }
  }
  if (current !== "") lines.push(current)
  return lines
}

/** The rows one spec row takes, as the text each of them draws (a note's wrapped lines). */
function linesOf(entry: OverlayRow, textLimit: number): readonly (string | undefined)[] {
  if (entry.kind === "option" && entry.description !== undefined) return [undefined, undefined]
  if (entry.kind === "note") {
    const wrapped = wrapWords(entry.text, textLimit)
    return Array.from({ length: entry.lines }, (_, index) => wrapped[index] ?? "")
  }
  return [undefined]
}

export function placeOverlay(layout: BuildLayout, spec: OverlaySpec): PlacedOverlay {
  const paneWidth = layout.gridBox.right - layout.gridBox.left - 1
  const paneHeight = layout.paneBottom - layout.gridBox.top - 1
  const width = Math.min(POPUP_WIDTH, Math.max(24, paneWidth - 3))
  const textLimit = width - 4
  const lines = spec.rows.reduce((count, row) => count + linesOf(row, textLimit).length, 0)
  // Border, the rows, a blank row of padding, border.
  const height = lines + 3
  const left = layout.gridBox.left + 1 + Math.floor((paneWidth - width - 1) / 2)
  const top = Math.max(layout.offset.row + 1, layout.gridBox.top + 1 + Math.floor((paneHeight - height - 1) / 2))
  const placed: PlacedRow[] = []
  let row = top + 1
  for (const entry of spec.rows) {
    linesOf(entry, textLimit).forEach((text, index) => {
      placed.push({ row, spec: entry, secondLine: index > 0, ...(text === undefined ? {} : { text }) })
      row += 1
    })
  }
  const right = left + width - 1
  return {
    spec,
    box: { left, top, right, bottom: top + height - 1 },
    textColumn: left + 2,
    textLimit,
    rows: placed,
    close: { row: top, from: right - 1 - CLOSE_LABEL.length, to: right - 2 },
  }
}

/** What a click at a frame cell means with this popup open. `outside` is the caller's to act on: a
 *  click outside a popup closes it and moves focus to where it landed (owner, 2026-09-27). */
export type OverlayHit =
  | Readonly<{ kind: "outside" }>
  | Readonly<{ kind: "command"; command: BuildCommand }>
  | Readonly<{ kind: "none" }>

export function overlayHitAt(placed: PlacedOverlay, column: number, row: number): OverlayHit {
  const { box } = placed
  if (column < box.left || column > box.right || row < box.top || row > box.bottom) return { kind: "outside" }
  if (row === placed.close.row && column >= placed.close.from && column <= placed.close.to) {
    return { kind: "command", command: { kind: "cancel" } }
  }
  if (column < placed.textColumn || column >= placed.textColumn + placed.textLimit) return { kind: "none" }
  const hit = placed.rows.find((candidate) => candidate.row === row)
  if (hit !== undefined && hit.spec.kind === "option") return { kind: "command", command: hit.spec.command }
  if (hit !== undefined && hit.spec.kind === "setting") {
    const columns = settingColumns(placed)
    if (column >= columns.valueFrom && column < columns.valueMiddle) return { kind: "command", command: hit.spec.decrease }
    if (column >= columns.valueMiddle && column <= columns.valueTo) return { kind: "command", command: hit.spec.increase }
    return { kind: "command", command: hit.spec.select }
  }
  return { kind: "none" }
}

/** "restart", the longer of the two words a setting's "when is it seen" column holds. */
const APPLIES_WIDTH = 7
/** `<`, a space, eight glyphs of value, a space, `>` — room for "140 ms" or "8 tiles". */
const VALUE_WIDTH = 12

/**
 * Where a setting row's parts sit — its name, its `< value >` box and its "now" / "restart" — as frame
 * columns, the same for every setting row in a popup. Read by the composer to draw them and by
 * `overlayHitAt` to hit-test them. The value box is split down the middle: the left half is the
 * decrease target and the right half the increase one, each six columns wide, so a finger on a phone
 * can hit it (the browser playtest page).
 */
export function settingColumns(placed: PlacedOverlay): Readonly<{
  labelLimit: number
  valueFrom: number
  valueMiddle: number
  valueTo: number
  appliesRight: number
}> {
  const appliesRight = placed.textColumn + placed.textLimit - 1
  const valueTo = appliesRight - APPLIES_WIDTH - 1
  const valueFrom = valueTo - VALUE_WIDTH + 1
  return {
    labelLimit: valueFrom - 1 - placed.textColumn,
    valueFrom,
    valueMiddle: valueFrom + VALUE_WIDTH / 2,
    valueTo,
    appliesRight,
  }
}
