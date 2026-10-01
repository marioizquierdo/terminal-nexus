// Shading — the presentation toolkit's glyphless family: colour and attribute changes over characters
// already on the screen, never a character of its own (Mario asked for "shader-inspired coloring").
// Because every cell here is glyphless, the compositor lets it onto an occupied tile: it is the one
// kind of effect cell that may touch a building's or a unit's own characters, and it can only recolour
// them, never replace them (the corruption law).
//
// Generic recipes, usable by anything with a footprint: a building that just went up today, a
// Nexus power landing on a unit or a projectile's impact later. `fx.damage.flash` (`recipes.ts`) is
// shading too, older than this file and kept where the Pulse vocabulary lives.

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

export const SHADING_RECIPES: Readonly<Record<string, EffectRecipe>> = {
  "fx.light.flash": lightFlash,
}
