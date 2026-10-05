// Particles — the presentation toolkit's glyph-bearing family: short-lived characters thrown around
// something, never onto it (Mario asked for "particle-inspired effects"). A particle cell that lands
// on an occupied tile is dropped by the compositor (the corruption law), so a recipe here never has to
// remember where the buildings are — though a good one aims away from them anyway.
//
// Generic recipes, parameterised by an origin, a footprint and a size, usable by anything: a building
// that just went up today; a death, a Nexus power landing, a projectile's impact later. Most of the
// Pulse's own vocabulary (`recipes.ts`) is particles too, authored per cue before this file existed.

import { footprintRing } from "../../grid/coords.ts"
import type { EffectRecipe, PositionedCell } from "./types.ts"
import { paramNumber, paramString, progressOf } from "./types.ts"
import { cosmeticHash, cosmeticPick, cosmeticUnit } from "./random.ts"
import { RAINBOW_ROLES } from "../roles.ts"
import type { StyleRole } from "../roles.ts"
import { EASINGS } from "../tween.ts"

function draw(hash: number, index: number): number {
  return cosmeticHash(hash, "salt", index, index, index, index)
}

/**
 * **`fx.sparks.burst`** — sparks thrown off a footprint's edge, flying outward and thinning to dust:
 * the IMPACT and DECAY of something that just happened to a thing standing there. Its own physical
 * language, not a weapon's (craft rule 2): stars and dust, never the `-|/\` of shots and blows, and
 * only a handful of cells — negative space is material (rule 5). Every spark starts on the ring one
 * tile out from the footprint and moves away from it.
 *
 * Params: `width`, `height` — the footprint's extent from `origin` (default 1 × 1); `count` — how many
 * sparks (default 6); `reach` — the furthest a spark flies past the ring, in tiles (default 2);
 * `palette` — `"rainbow"` for the theme's hues, anything else for sparks and dust; `key` and `id` —
 * **the identity its randomness hashes**. With a `key`, the scatter is a hash of `key`, `id` and the
 * origin alone, never of when it started: an effect of something the *player* did (a placement) throws
 * the same sparks however fast the plan was typed. Without one it hashes its start time, as a Pulse
 * effect does.
 *
 * Reduced motion: no flight at all, a still mark at the four corners outside the footprint for the
 * window. Monochrome: the same glyphs; the colour only warms them.
 */
const sparksBurst: EffectRecipe = (instance, context) => {
  const width = Math.max(1, paramNumber(instance, "width", 1))
  const height = Math.max(1, paramNumber(instance, "height", 1))
  const count = Math.max(0, paramNumber(instance, "count", 6))
  const reach = Math.max(1, paramNumber(instance, "reach", 2))
  const rainbow = paramString(instance, "palette") === "rainbow"
  const key = paramString(instance, "key")
  const identity = `${instance.recipe}:${key}`
  const id = paramNumber(instance, "id", 0)
  const { origin } = instance
  const hashOf = (salt: number): number =>
    cosmeticHash(context.cosmeticSeed ^ id, identity, key === "" ? instance.startMs : 0, origin.x, origin.y, salt)
  const hueOf = (hash: number): StyleRole => cosmeticPick(hash, RAINBOW_ROLES)
  const cells: PositionedCell[] = []
  if (context.timeMs < instance.startMs) return cells
  const progress = progressOf(instance, context)
  if (progress >= 1) return cells

  if (context.reducedMotion) {
    const corners = [
      { x: -1, y: -1 },
      { x: width, y: -1 },
      { x: -1, y: height },
      { x: width, y: height },
    ]
    corners.forEach((corner, index) => {
      cells.push({
        tile: { x: origin.x + corner.x, y: origin.y + corner.y },
        glyph: "+",
        role: rainbow ? hueOf(hashOf(index)) : "fx.critical",
      })
    })
    return cells
  }

  const ring = footprintRing(width, height, 1)
  for (let index = 0; index < count; index += 1) {
    const hash = hashOf(index + 1)
    // Staggered launches, so a burst reads as a burst rather than one frame of noise.
    const launch = cosmeticUnit(draw(hash, 1)) * 0.25
    const life = 0.45 + cosmeticUnit(draw(hash, 2)) * 0.5
    const q = (progress - launch) / life
    if (q < 0 || q >= 1) continue
    const from = cosmeticPick(draw(hash, 3), ring)
    const dx = from.x < 0 ? -1 : from.x >= width ? 1 : 0
    const dy = from.y < 0 ? -1 : from.y >= height ? 1 : 0
    const travel = 1 + (draw(hash, 4) % reach)
    const distance = Math.min(travel, Math.floor(EASINGS.easeOutQuad(q) * (travel + 1)))
    // `| 0` makes a spark that has not moved yet (`-1 * 0`, which is `-0`) a plain 0: a `-0` in a coordinate slows
    // every frame (docs/history/lessons-learned.md, "A negative zero in a coordinate").
    const tile = { x: origin.x + from.x + ((dx * distance) | 0), y: origin.y + from.y + ((dy * distance) | 0) }
    const spark = q < 0.3
    const dust = q >= 0.65
    // A spark is a star; in flight it leans the way it is going (`'` up, `,` down), then settles to dust.
    const glyph = spark ? "*" : dust ? "." : dx === 0 && dy < 0 ? "'" : dx === 0 && dy > 0 ? "," : "+"
    const role: StyleRole = rainbow ? hueOf(draw(hash, 5)) : dust ? "fx.debris" : "fx.critical"
    cells.push({
      tile,
      glyph,
      role,
      ...(spark ? { bold: true } : {}),
      ...(dust ? { dim: true } : {}),
    })
  }
  return cells
}

export const PARTICLE_RECIPES: Readonly<Record<string, EffectRecipe>> = {
  "fx.sparks.burst": sparksBurst,
}
