// The Build Phase's popups — one shape for all three: the Nexus powers, the start-the-Pulse question,
// and the exit question. Extracted now that there are three real uses (AGENTS.md: "extract a
// framework only after two real uses reveal the boundary").
//
// A popup is **data**: a title and a list of rows, some of them options that name the command a click
// on them sends. `overlaySpec` derives it from the state; `placeOverlay` puts it on the frame;
// `overlayHitAt` answers what a click at a frame cell means. The composer draws from the same placed
// spec the mouse adapter hit-tests against, so a click can never land on a row the frame did not draw
// there — the same guarantee `layout.ts` gives the side panel.

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

export type OverlaySpec = Readonly<{ title: string; rows: readonly OverlayRow[] }>

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
    default:
      return null
  }
}

/** One row of a placed popup: its frame row, and the spec row it draws. */
export type PlacedRow = Readonly<{ row: number; spec: OverlayRow; secondLine: boolean }>

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

export function placeOverlay(layout: BuildLayout, spec: OverlaySpec): PlacedOverlay {
  const paneWidth = layout.gridBox.right - layout.gridBox.left - 1
  const paneHeight = layout.paneBottom - layout.gridBox.top - 1
  const width = Math.min(POPUP_WIDTH, Math.max(24, paneWidth - 3))
  const lines = spec.rows.reduce((count, row) => count + (row.kind === "option" && row.description !== undefined ? 2 : 1), 0)
  // Border, the rows, a blank row of padding, border.
  const height = lines + 3
  const left = layout.gridBox.left + 1 + Math.floor((paneWidth - width - 1) / 2)
  const top = Math.max(layout.offset.row + 1, layout.gridBox.top + 1 + Math.floor((paneHeight - height - 1) / 2))
  const placed: PlacedRow[] = []
  let row = top + 1
  for (const entry of spec.rows) {
    placed.push({ row, spec: entry, secondLine: false })
    row += 1
    if (entry.kind === "option" && entry.description !== undefined) {
      placed.push({ row, spec: entry, secondLine: true })
      row += 1
    }
  }
  const right = left + width - 1
  return {
    spec,
    box: { left, top, right, bottom: top + height - 1 },
    textColumn: left + 2,
    textLimit: width - 4,
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
  return { kind: "none" }
}
