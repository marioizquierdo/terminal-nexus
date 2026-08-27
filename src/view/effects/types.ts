// The effect contract — ascii-effects.md Section 1, transcribed rather than reinterpreted.
//
// An effect is a **pure function from absolute presentation time to sparse cells**. Five rules, all
// load-bearing: absolute time in and cells out with no accumulated state; effects cannot touch
// state; cosmetic randomness only; tile coordinates, never columns; and an effect never carries a
// required cue alone.

import type { Coord } from "../../grid/types.ts"
import type { CapabilityMode, StyleRole } from "../roles.ts"

/** Effects may paint here and nowhere else — ascii-effects.md 1.1. */
export type EffectBand = "ground-items" | "projectiles" | "effects" | "highlights"

export const EFFECT_BANDS: readonly EffectBand[] = [
  "ground-items",
  "projectiles",
  "effects",
  "highlights",
]

export type PositionedCell = Readonly<{
  /** Tile coordinates. The compositor maps them to columns at the current tile width. */
  tile: Coord
  glyph: string
  role?: StyleRole
  bold?: boolean
  dim?: boolean
  inverse?: boolean
  /**
   * Q25's transparency scalar, threaded from here through to `CellStyle.fade` (`frame.ts`, which
   * carries the full doc comment): `0` is the role's own colour, `1` is the theme's background.
   * Never set outside `fx.damage.flash` — ascii-effects.md craft rule 7's departure is narrow, not
   * a general licence for glyph-bearing recipes to fade out.
   */
  fade?: number
}>

export type EffectContext = Readonly<{
  /** Absolute presentation time, not time since the effect started. */
  timeMs: number
  cosmeticSeed: number
  tileWidth: 1 | 2
  reducedMotion: boolean
  capability: CapabilityMode
}>

/**
 * The visual family an effect speaks in. Faction identity lives here rather than in a duplicated
 * set of recipes: `terminal-nexus-lore.md` Section 8.6 asks each faction for one recognizable
 * motion and effect language, and ascii-effects.md craft rule 2 says different weapons need
 * different physical languages — so a Citizen round and a Ravel charge share a recipe and disagree
 * about glyphs, bias, and how much of the screen they are entitled to.
 */
export type EffectFamily = "citizen" | "ravel" | "neutral"

export type EffectParams = Readonly<Record<string, number | string>>

export type EffectInstance = Readonly<{
  recipe: string
  band: EffectBand
  startMs: number
  durationMs: number
  /** Tile coordinates, never columns. */
  origin: Coord
  target?: Coord
  family: EffectFamily
  params: EffectParams
}>

export type EffectRecipe = (
  instance: EffectInstance,
  context: EffectContext,
) => readonly PositionedCell[]

export function paramNumber(instance: EffectInstance, key: string, fallback = 0): number {
  const value = instance.params[key]
  return typeof value === "number" ? value : fallback
}

export function paramString(instance: EffectInstance, key: string, fallback = ""): string {
  const value = instance.params[key]
  return typeof value === "string" ? value : fallback
}

/** Progress through an instance's window, clamped to `[0,1]`. The only time an effect ever needs. */
export function progressOf(instance: EffectInstance, context: EffectContext): number {
  if (instance.durationMs <= 0) return 1
  return Math.max(0, Math.min(1, (context.timeMs - instance.startMs) / instance.durationMs))
}

export function isActive(instance: EffectInstance, timeMs: number): boolean {
  return timeMs >= instance.startMs && timeMs < instance.startMs + instance.durationMs
}
