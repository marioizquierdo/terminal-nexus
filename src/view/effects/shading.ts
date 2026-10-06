// Shading — the presentation toolkit's glyphless family: colour and attribute changes over characters
// already on the screen, never a character of its own (Mario asked for "shader-inspired coloring").
// Because every cell here is glyphless, the compositor lets it onto an occupied tile: it is the one
// kind of effect cell that may touch a building's or a unit's own characters, and it can only recolour
// them, never replace them (the corruption law).
//
// Generic recipes, usable by anything with a footprint: a building that just went up today, a
// Nexus power landing on a unit or a projectile's impact later. `fx.damage.flash` (`recipes.ts`) is
// shading too, older than this file and kept where the Pulse vocabulary lives.

import { ROW_DISTANCE } from "../../grid/coords.ts"
import type { PositionedCell, EffectRecipe } from "./types.ts"
import { paramNumber, paramString, progressOf } from "./types.ts"
import { RAINBOW_ROLES } from "../roles.ts"

/** How long each hue of the rainbow holds on one tile before the next — above the ~60 ms under which
 *  a beat did not happen (`effects.md`). */
export const RAINBOW_STEP_MS = 60

/** Blends to a hundredth: finer than any tier can show, and it keeps a frame's cells comparable. */
function roundAmount(amount: number): number {
  return Math.round(Math.max(0, Math.min(1, amount)) * 100) / 100
}

/** The amount the reduced-motion light holds at, all window long: there, then gone, never moving. */
const REDUCED_LIGHT = 0.5

/**
 * **`fx.light.flash`** — a light over a footprint: its characters pulled toward the theme's strongest
 * ink (`fx.flash`) and back, falling off fast and settling slowly (the square of what is left of the
 * window). With `palette: "rainbow"`, a diagonal wave of the theme's hues sweeps across the footprint
 * instead, fading back to each character's own colour.
 *
 * Params: `width`, `height` — the footprint's extent from `origin` (default 1 × 1); `palette` —
 * `"flash"` (default) or `"rainbow"`; `strength` — the peak amount, 0 to 1 (default 1).
 *
 * The three forms: **reduced motion** holds a steady half-strength light for the window — no decay and
 * no hue walking, "here, just now" without anything moving; **monochrome** shows no tint at all (a
 * tint resolves to nothing there, `roles.ts`), so whoever asks for a light keeps a monochrome cue of
 * its own — a placement's scaffold is drawn plain and its finished building bold.
 */
const lightFlash: EffectRecipe = (instance, context) => {
  const cells: PositionedCell[] = []
  const since = context.timeMs - instance.startMs
  if (since < 0 || since >= instance.durationMs) return cells
  const width = Math.max(1, paramNumber(instance, "width", 1))
  const height = Math.max(1, paramNumber(instance, "height", 1))
  const strength = Math.max(0, Math.min(1, paramNumber(instance, "strength", 1)))
  const rainbow = paramString(instance, "palette", "flash") === "rainbow"
  const progress = progressOf(instance, context)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const tile = { x: instance.origin.x + x, y: instance.origin.y + y }
      if (context.reducedMotion) {
        cells.push({ tile, glyph: "", tint: { role: "fx.flash", amount: roundAmount(REDUCED_LIGHT * strength) } })
        continue
      }
      if (rainbow) {
        const step = Math.floor(since / RAINBOW_STEP_MS) + x + y
        const role = RAINBOW_ROLES[step % RAINBOW_ROLES.length] ?? "fx.hue.red"
        const amount = roundAmount((1 - progress) * strength)
        if (amount > 0) cells.push({ tile, glyph: "", tint: { role, amount } })
        continue
      }
      const amount = roundAmount((1 - progress) ** 2 * strength)
      if (amount > 0) cells.push({ tile, glyph: "", tint: { role: "fx.flash", amount } })
    }
  }
  return cells
}

/**
 * How much of the light the intro highlight lays over the ground around its focus (a see-through alpha):
 * at the top of a breath, where it starts as the line appears, and at the bottom. Both under the half at
 * which a see-through style would show at 16 colours and in monochrome, which have a form of their own.
 */
export const FOCUS_LIGHT = { peak: 0.34, rest: 0.12 } as const

/** How long one breath of the intro highlight lasts when nothing says (the "Popup pulse" Experiment does,
 *  on the Build Phase screen). */
export const FOCUS_BREATH_MS = 2000

/**
 * **`fx.focus.light`** — the intro highlight: a ring of light around what a line of dialog is about, for as
 * long as the line is shown. The focus itself — `width` × `height` tiles from `origin`: a unit's tile, a
 * region — keeps its own look, glyphs at full strength; the ring of tiles around it is lit, a see-through
 * style of the theme's strongest ink laid over the ground (`CellStyle.seeThrough`), so whatever stands on
 * the ring stays readable. The ring is a row deep above and below and as many columns deep at the sides as a
 * row counts (`ROW_DISTANCE`, src/grid/coords.ts): a tile is half as wide as it is tall, so the ring is as deep
 * on screen every way round and reads as a ring rather than a slot. It is a picture of attention, not a reach:
 * it claims no ground. It breathes, one breath every `periodMs`: lit to `FOCUS_LIGHT.peak` the moment the
 * line appears, easing down to `rest` at half a breath and back up — a cosine, so it never jolts.
 *
 * Params: `width`, `height` — the focus's extent (default 1 × 1); `periodMs` — one breath (default
 * `FOCUS_BREATH_MS`; 0 holds it steady).
 *
 * The three forms: **full** breathes; **reduced motion** holds the ring steady, half way between rest and
 * peak, here and never moving; **monochrome** — and 16 colours, which cannot blend a light — draws the
 * focus's own cells in inverse video instead: an attribute, never a glyph, steady.
 */
const focusLight: EffectRecipe = (instance, context) => {
  const cells: PositionedCell[] = []
  const since = context.timeMs - instance.startMs
  if (since < 0 || since >= instance.durationMs) return cells
  const width = Math.max(1, paramNumber(instance, "width", 1))
  const height = Math.max(1, paramNumber(instance, "height", 1))
  const { x: left, y: top } = instance.origin
  if (context.capability === "monochrome" || context.capability === "color16") {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) cells.push({ tile: { x: left + x, y: top + y }, glyph: "", inverse: true })
    }
    return cells
  }
  const periodMs = Math.max(0, paramNumber(instance, "periodMs", FOCUS_BREATH_MS))
  const level = context.reducedMotion || periodMs === 0 ? 0.5 : (1 + Math.cos((2 * Math.PI * (since % periodMs)) / periodMs)) / 2
  const alpha = roundAmount(FOCUS_LIGHT.rest + (FOCUS_LIGHT.peak - FOCUS_LIGHT.rest) * level)
  const side = ROW_DISTANCE
  // The columns beyond the first at either side carry half the light: a glow that fades out, not a box.
  const faint = roundAmount(alpha / 2)
  for (let y = -1; y <= height; y += 1) {
    for (let x = -side; x < width + side; x += 1) {
      if (x >= 0 && x < width && y >= 0 && y < height) continue
      const far = x < -1 || x > width
      cells.push({ tile: { x: left + x, y: top + y }, glyph: "", seeThrough: { role: "fx.flash", alpha: far ? faint : alpha } })
    }
  }
  return cells
}

export const SHADING_RECIPES: Readonly<Record<string, EffectRecipe>> = {
  "fx.light.flash": lightFlash,
  "fx.focus.light": focusLight,
}
