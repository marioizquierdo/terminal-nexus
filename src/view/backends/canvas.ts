// The canvas backend: the browser playtest page's screen (engine.md 10.2 — a development tool, not a
// supported platform; iTerm2 at 80 x 24 stays the acceptance target).
//
// It is a third `TerminalBackend`, beside direct ANSI and OpenTUI, and like them it only presents a
// finished cell frame — the same glyphs, the same style roles resolved through the same colour table
// (`rgbFor`, which OpenTUI uses too). It never decides what the game shows. Painting is split in two
// so the part that matters can be tested without a browser: `paintOps` (pure: frame in, one paint
// instruction per cell out) and `CanvasBackend.present` (draws those instructions, nothing else).
//
// No DOM types are imported: the canvas is described by the few members this file touches, so the
// module type-checks and runs its pure half under Node like every other backend.

import type { ReadonlyCellFrame, TerminalBackend } from "../frame.ts"
import type { CapabilityMode, Theme } from "../roles.ts"
import { BACKGROUND_RGB, DEFAULT_THEME, rgbFor } from "../roles.ts"

/** How a dim cell is drawn: the terminal's SGR 2 "faint", approximated as partial opacity. */
export const DIM_ALPHA = 0.55

/** One cell, ready to paint: colours as CSS strings, `background` null where the theme's own shows. */
export type PaintOp = Readonly<{
  x: number
  y: number
  glyph: string
  foreground: string
  background: string | null
  bold: boolean
  underline: boolean
  alpha: number
}>

const css = (rgb: readonly number[]): string => `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`

/**
 * What to paint for a frame — pure, and the half of this backend the tests hold to the terminal's:
 * every glyph where `frameToText` has it, every colour from the role table. Inverse video swaps
 * foreground and background the way a terminal does, with the theme's background standing in for a
 * cell that has none of its own (the map's solid edge is exactly that).
 */
export function paintOps(
  frame: ReadonlyCellFrame,
  capability: CapabilityMode,
  theme: Theme = DEFAULT_THEME,
): PaintOp[] {
  const ops: PaintOp[] = []
  const base = css(BACKGROUND_RGB[theme])
  for (let y = 0; y < frame.height; y += 1) {
    for (let x = 0; x < frame.width; x += 1) {
      const cell = frame.cells[y * frame.width + x]
      if (cell === undefined) continue
      const style = cell.style
      let foreground = css(rgbFor(style.fgRole, capability, theme, style.fade ?? 0, style.tint))
      let background =
        style.bgRole === undefined || capability === "monochrome" ? null : css(rgbFor(style.bgRole, capability, theme))
      if (style.inverse === true) {
        const swapped = foreground
        foreground = background ?? base
        background = swapped
      }
      ops.push({
        x,
        y,
        glyph: cell.glyph,
        foreground,
        background,
        bold: style.bold === true,
        underline: style.underline === true,
        alpha: style.dim === true ? DIM_ALPHA : 1,
      })
    }
  }
  return ops
}

/** The members of a browser `CanvasRenderingContext2D` this backend uses. */
export type Canvas2D = {
  fillStyle: unknown
  font: string
  globalAlpha: number
  textAlign: string
  textBaseline: string
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void
  fillRect(x: number, y: number, width: number, height: number): void
  fillText(text: string, x: number, y: number): void
}

/** The members of a browser `HTMLCanvasElement` this backend uses. */
export type CanvasSurface = {
  width: number
  height: number
  readonly style: { width: string; height: string }
  getContext(kind: "2d"): Canvas2D | null
}

export type CanvasBackendOptions = Readonly<{
  canvas: CanvasSurface
  capability: CapabilityMode
  theme?: Theme
  /** The space the screen may fill, in CSS pixels; the cell size follows it. */
  fit: () => Readonly<{ width: number; height: number }>
  /** Device pixels per CSS pixel, so text stays sharp on a phone. */
  pixelRatio?: () => number
}>

/** A monospace cell is about twice as tall as it is wide, like a terminal's. */
const CELL_ASPECT = 2
const FONT = `ui-monospace, Menlo, "DejaVu Sans Mono", monospace`

export class CanvasBackend implements TerminalBackend {
  readonly name = "web-canvas"
  /** The size of one cell in CSS pixels at the last frame — what turns a tap into a cell. */
  cellWidth = 10
  cellHeight = 20
  private capability: CapabilityMode
  private theme: Theme
  private readonly options: CanvasBackendOptions

  constructor(options: CanvasBackendOptions) {
    this.options = options
    this.capability = options.capability
    this.theme = options.theme ?? DEFAULT_THEME
  }

  async start(): Promise<void> {}
  async stop(): Promise<void> {}

  setPresentation(capability: CapabilityMode, theme: Theme): void {
    this.capability = capability
    this.theme = theme
  }

  /** The cell under a point in CSS pixels from the canvas's top-left corner. */
  cellAt(x: number, y: number): Readonly<{ column: number; row: number }> {
    return { column: Math.floor(x / this.cellWidth), row: Math.floor(y / this.cellHeight) }
  }

  present(frame: ReadonlyCellFrame): void {
    const { canvas } = this.options
    const box = this.options.fit()
    const ratio = this.options.pixelRatio?.() ?? 1
    this.cellWidth = Math.max(3, Math.min(box.width / frame.width, box.height / frame.height / CELL_ASPECT))
    this.cellHeight = this.cellWidth * CELL_ASPECT
    const width = frame.width * this.cellWidth
    const height = frame.height * this.cellHeight
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
    }
    const g = canvas.getContext("2d")
    if (g === null) throw new Error("this browser gave the canvas no 2D context")
    g.setTransform(ratio, 0, 0, ratio, 0, 0)
    g.globalAlpha = 1
    g.fillStyle = css(BACKGROUND_RGB[this.theme])
    g.fillRect(0, 0, width, height)
    g.textBaseline = "middle"
    g.textAlign = "center"
    const size = Math.floor(this.cellWidth * 1.62)
    for (const op of paintOps(frame, this.capability, this.theme)) {
      const left = op.x * this.cellWidth
      const top = op.y * this.cellHeight
      if (op.background !== null) {
        g.globalAlpha = 1
        g.fillStyle = op.background
        // Half a pixel over, so neighbouring solid cells meet without a hairline between them.
        g.fillRect(left, top, this.cellWidth + 0.5, this.cellHeight + 0.5)
      }
      if (op.glyph === " ") continue
      g.globalAlpha = op.alpha
      g.fillStyle = op.foreground
      g.font = `${op.bold ? "bold " : ""}${size}px ${FONT}`
      g.fillText(op.glyph, left + this.cellWidth / 2, top + this.cellHeight / 2)
      if (op.underline) g.fillRect(left, top + this.cellHeight - 2, this.cellWidth, 1)
    }
    g.globalAlpha = 1
  }
}
