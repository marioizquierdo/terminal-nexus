// The effect contract — `docs/system-design/effects.md`, transcribed rather than reinterpreted.
//
// Two of the presentation toolkit's four families speak through it (the others are Animations,
// `../animation.ts`, and Tweens, `../tween.ts`): **Particles**, glyph-bearing cells thrown around
// something, and **Shading**, glyphless cells that change the colour or attributes of what is already
// drawn. A cell with `glyph: ""` is shading; anything else is a particle.
//
// An effect is a **pure function from absolute presentation time to sparse cells**. Five rules, all
// load-bearing: absolute time in and cells out with no accumulated state; effects cannot touch
// state; cosmetic randomness only; tile coordinates, never columns; and an effect never carries a
// required cue alone.

import type { Coord } from "../../grid/types.ts"
import type { CapabilityMode, RoleTint, SeeThrough, StyleRole } from "../roles.ts"

/** Effects may paint here and nowhere else (`effects.md`). */
export type EffectBand = "ground-items" | "projectiles" | "effects" | "highlights"

export const EFFECT_BANDS: readonly EffectBand[] = [
  "ground-items",
  "projectiles",
  "effects",
  "highlights",
]

export type PositionedCell = Readonly<{
  /** Tile coordinates. A tile is one cell on screen; the compositor places it through the camera. */
  tile: Coord
  glyph: string
  role?: StyleRole
  bold?: boolean
  dim?: boolean
  inverse?: boolean
  /**
   * The transparency scalar, threaded from here through to `CellStyle.fade` (`frame.ts`, which
   * carries the full doc comment): `0` is the role's own colour, `1` is the theme's background.
   * Never set outside `fx.damage.flash` — the craft rule in `effects.md` against fading glyphs has
   * one narrow exception, not a general licence for glyph-bearing recipes to fade out.
   */
  fade?: number
  /**
   * `role` of whatever is beneath pulled part of the way toward another role — Shading's light and
   * rainbow (`shading.ts`), threaded through to `CellStyle.tint`. Only on a glyphless cell: shading
   * recolours characters already drawn and never brings one of its own.
   */
  tint?: RoleTint
  /**
   * A light laid over the cell's ground without hiding what stands there — a see-through style
   * (`CellStyle.seeThrough`): the intro highlight's ring (`fx.focus.light`). Only on a glyphless cell.
   */
  seeThrough?: SeeThrough
}>

export type EffectContext = Readonly<{
  /** Absolute presentation time, not time since the effect started. */
  timeMs: number
  cosmeticSeed: number
  reducedMotion: boolean
  capability: CapabilityMode
}>

/**
 * The visual family an effect speaks in. Faction identity lives here rather than in a duplicated
 * set of recipes: the lore document asks each faction for one recognizable
 * motion and effect language, and `effects.md` says different weapons need
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
