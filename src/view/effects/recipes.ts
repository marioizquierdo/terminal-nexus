// The effect vocabulary — ascii-effects.md Section 5, plus one the Ravel rule earned.
//
// Every recipe here is a pure function of absolute time, and every one owes three forms (Section 4):
// full, reduced motion, and monochrome, authored together rather than in a later accessibility pass.
// The reduced form keeps anticipation, impact and settle and drops travel, drift and scatter —
// **causality must survive it**. The monochrome form usually needs a different glyph, not a
// different brightness.
//
// Faction language lives in `instance.family`, not in duplicated recipes: a Citizen round is
// kinetic, orthogonal and tight; a Ravel charge is explosive, diagonal and entitled to more of the
// screen. Craft rule 2 — different weapons need different physical languages — with one code path.

import type { Coord } from "../../grid/types.ts"
import { deathFramesFor } from "../../content/art.ts"
import type { UnitArt } from "../../content/art.ts"
import type {
  EffectContext,
  EffectFamily,
  EffectInstance,
  EffectRecipe,
  PositionedCell,
} from "./types.ts"
import { paramNumber, paramString, progressOf } from "./types.ts"
import { cosmeticHash, cosmeticPick, cosmeticUnit } from "./random.ts"

type Family = Readonly<{
  trail: readonly string[]
  spark: readonly string[]
  impact: readonly string[]
  debris: readonly string[]
  /** How far a scatter is allowed to stray, in tiles. Ravels get more room on purpose. */
  spread: number
}>

const FAMILIES: Readonly<Record<EffectFamily, Family>> = {
  citizen: {
    trail: [",", ":"],
    spark: ["+", "-"],
    impact: ["+", "x"],
    debris: ["=", "-", "|", "+"],
    spread: 1,
  },
  ravel: {
    trail: ["'", ","],
    spark: ["*", "'"],
    impact: ["X", "*"],
    debris: ["/", "\\", "*", ","],
    spread: 2,
  },
  neutral: {
    trail: ["."],
    spark: ["+"],
    impact: ["*"],
    debris: [":", ".", "'"],
    spread: 1,
  },
}

function familyOf(instance: EffectInstance): Family {
  return FAMILIES[instance.family]
}

/** Directional glyphs carry force — craft rule 6. A symmetric burst reads as weightless. */
function vectorGlyph(from: Coord, to: Coord): string {
  const dx = Math.sign(to.x - from.x)
  const dy = Math.sign(to.y - from.y)
  if (dx === 0 && dy === 0) return "+"
  if (dy === 0) return "-"
  if (dx === 0) return "|"
  return dx === dy ? "\\" : "/"
}

function step(from: Coord, to: Coord): Coord {
  return { x: Math.sign(to.x - from.x), y: Math.sign(to.y - from.y) }
}

function draw(hash: number, index: number): number {
  return cosmeticHash(hash, "salt", index, index, index, index)
}

function instanceHash(instance: EffectInstance, context: EffectContext, salt: number): number {
  return cosmeticHash(
    context.cosmeticSeed,
    instance.recipe,
    instance.startMs,
    instance.origin.x,
    instance.origin.y,
    salt,
  )
}

/** Tiles between two coordinates, endpoints included — the line a tracer walks. */
function tileLine(from: Coord, to: Coord): Coord[] {
  const distance = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y))
  if (distance === 0) return [from]
  const line: Coord[] = []
  for (let index = 0; index <= distance; index += 1) {
    line.push({
      x: from.x + Math.round(((to.x - from.x) * index) / distance),
      y: from.y + Math.round(((to.y - from.y) * index) / distance),
    })
  }
  return line
}

// ---------------------------------------------------------------------------
// Movement
// ---------------------------------------------------------------------------

/**
 * The cheapest effect in the game and the one that does the most: it is what makes a letter read as
 * *moving* rather than teleporting between tiles. Decay only — the actor has already arrived.
 */
const moveTrail: EffectRecipe = (instance, context) => {
  const from = instance.origin
  const to = instance.target ?? instance.origin
  const family = familyOf(instance)
  // Dust, not a line. `-` `|` `/` `\` is the language of shots and blows here, and a trail that
  // borrows it reads as a projectile flying the wrong way (craft rule 2).
  const glyph = family.trail[0] ?? ","
  const progress = progressOf(instance, context)

  if (context.reducedMotion) {
    // No drift and no thinning: one static mark saying which way it came from.
    return [{ tile: from, glyph, role: "fx.trail", dim: true }]
  }

  const cells: PositionedCell[] = [{ tile: from, glyph, role: "fx.trail", dim: progress > 0.4 }]
  if (progress < 0.55) {
    // A second, fainter cell one step further back, so the tail reads as length rather than as a
    // smear. Decay is fewer cells, not a fade — terminals have no alpha (craft rule 7).
    const back = step(to, from)
    cells.push({
      tile: { x: from.x + back.x, y: from.y + back.y },
      glyph: family.trail[1] ?? ",",
      role: "fx.trail",
      dim: true,
    })
  }
  return cells
}

// ---------------------------------------------------------------------------
// Melee
// ---------------------------------------------------------------------------

/** The tell that a blow is coming: one directional glyph on the attacker's facing edge. */
const meleeWind: EffectRecipe = (instance, context) => {
  const target = instance.target ?? instance.origin
  const toward = step(instance.origin, target)
  const edge = { x: instance.origin.x + toward.x, y: instance.origin.y + toward.y }
  const glyph = vectorGlyph(instance.origin, target)
  const progress = progressOf(instance, context)
  if (context.reducedMotion) {
    return [{ tile: edge, glyph, role: "fx.kinetic", dim: true }]
  }
  // Two beats of anticipation: a faint mark that hardens as the swing arrives.
  return [{ tile: edge, glyph, role: "fx.kinetic", dim: progress < 0.5, bold: progress >= 0.5 }]
}

/** Impact and a short decay: hard directional marks at the contested edge, thinning outward. */
const meleeClash: EffectRecipe = (instance, context) => {
  const target = instance.target ?? instance.origin
  const family = familyOf(instance)
  const toward = step(instance.origin, target)
  const edge = { x: instance.origin.x + toward.x, y: instance.origin.y + toward.y }
  const progress = progressOf(instance, context)
  const hash = instanceHash(instance, context, 1)

  const cells: PositionedCell[] = [
    {
      tile: edge,
      glyph: family.impact[0] ?? "+",
      role: "fx.kinetic",
      bold: progress < 0.5,
    },
  ]
  if (context.reducedMotion) return cells

  // Thinning outward: one mark either side of the contact, perpendicular to the blow — but only
  // for a brief middle band of the swing, not most of it (owner playtest: with several units in
  // contact at once, a mark that lingers for most of every clash's life is what turns a fight into
  // scattered noise. One shot's worth of leaning on timing rather than size is trimming *how long*
  // the decoration shows, not just how big it is).
  if (progress >= 0.35 && progress < 0.6) {
    const perpendicular = { x: -toward.y, y: toward.x }
    const sign = cosmeticUnit(hash) < 0.5 ? 1 : -1
    cells.push({
      tile: { x: edge.x + perpendicular.x * sign, y: edge.y + perpendicular.y * sign },
      glyph: cosmeticPick(draw(hash, 2), family.debris),
      role: "fx.kinetic",
      dim: true,
    })
  }
  return cells
}

// ---------------------------------------------------------------------------
// Ranged
// ---------------------------------------------------------------------------

/** Without this, ranged fire looks like it comes from nowhere. */
const rangedTelegraph: EffectRecipe = (instance, context) => {
  const target = instance.target ?? instance.origin
  const toward = step(instance.origin, target)
  const muzzle = { x: instance.origin.x + toward.x, y: instance.origin.y + toward.y }
  const family = familyOf(instance)
  return [
    {
      tile: muzzle,
      glyph: family.spark[0] ?? "+",
      role: instance.family === "ravel" ? "fx.blast" : "fx.kinetic",
      bold: true,
    },
  ]
}

/**
 * A travelling glyph along the tile line, oriented to the vector. Presentation only: the simulation
 * resolved this at a tick, and the window is the flight window the event already carries.
 *
 * One cell, not a head-and-tail streak: the flight window is already short (a tile or two, most
 * ranged fixtures), so a two-cell tail bought little legibility on its own and cost a second glyph
 * per shot everywhere the shot was drawn. With several units firing on the same tick — the owner's
 * "once units start shooting I can no longer tell what is happening" finding — that second glyph
 * multiplies. Favouring the muzzle-flash beat (`rangedTelegraph`) and the impact over a travelling
 * mark is closer to how a Starcraft marine's gunfire reads: a timing beat, not a drawn bullet.
 */
const rangedTracer: EffectRecipe = (instance, context) => {
  const target = instance.target ?? instance.origin
  const line = tileLine(instance.origin, target)
  const glyph = vectorGlyph(instance.origin, target)
  const role = instance.family === "ravel" ? "fx.blast" : "fx.kinetic"

  if (context.reducedMotion) {
    // Travel is exactly what reduced motion drops — so the shot becomes a held line. Causality
    // survives: you can still see who shot whom, which is the obligation.
    return line.slice(1, -1).map((tile) => ({ tile, glyph, role, dim: true }))
  }

  const progress = progressOf(instance, context)
  const index = Math.min(line.length - 1, Math.max(1, Math.round(progress * (line.length - 1))))
  const head = line[index]
  if (head === undefined) return []
  return [{ tile: head, glyph, role, bold: true }]
}

// ---------------------------------------------------------------------------
// Damage
// ---------------------------------------------------------------------------

/** A small asymmetric scatter biased *away* from the shooter. Asymmetry sells direction of force. */
const impactBurst: EffectRecipe = (instance, context) => {
  const family = familyOf(instance)
  const from = instance.target ?? instance.origin
  const away = step(from, instance.origin)
  const progress = progressOf(instance, context)
  const hash = instanceHash(instance, context, 3)

  const cells: PositionedCell[] = [
    {
      tile: instance.origin,
      glyph: family.impact[progress < 0.5 ? 0 : 1] ?? "*",
      role: instance.family === "ravel" ? "fx.blast" : "fx.kinetic",
      bold: progress < 0.5,
    },
  ]
  if (context.reducedMotion) return cells

  // One shard, and only while the impact is still fresh — not two tapering to one. The hit glyph
  // above plus the glyphless damage flash on the struck entity already carry the cue; a second and
  // third scattering mark added little on their own and multiplied badly wherever several impacts
  // landed on the same tick (owner playtest, a multi-unit engagement).
  const shards = progress < 0.5 ? 1 : 0
  for (let index = 0; index < shards; index += 1) {
    const spin = draw(hash, index + 1)
    const offset = {
      x: away.x + (cosmeticUnit(spin) < 0.5 ? 0 : away.y),
      y: away.y + (cosmeticUnit(draw(spin, 7)) < 0.5 ? 0 : away.x),
    }
    if (offset.x === 0 && offset.y === 0) continue
    cells.push({
      tile: { x: instance.origin.x + offset.x, y: instance.origin.y + offset.y },
      glyph: cosmeticPick(draw(spin, 11), family.debris),
      role: "fx.debris",
      dim: progress >= 0.5,
    })
  }
  return cells
}

/**
 * The one effect allowed to touch a unit's own cell, and only as an attribute — so it emits no
 * glyph at all and the compositor keeps whatever was underneath. In `highlights` rather than
 * `effects` so the corruption law cannot let a Glitch effect swallow it.
 */
const damageFlash: EffectRecipe = (instance, context) => {
  void context
  return [{ tile: instance.origin, glyph: "", role: "fx.flash", bold: true, inverse: true }]
}

// ---------------------------------------------------------------------------
// Endings
// ---------------------------------------------------------------------------

/**
 * How far out, in tiles, the death-collapse ring sits from the footprint's own box. `1` for
 * anything up to a 2-tile body - the original, unchanged 8-cell halo a 1x1 unit has always had -
 * growing with the footprint's longest side after that, so a body three or five tiles across earns
 * a ring that actually reads as scaled to it rather than the same halo every size gets. Owner
 * playtest, 2026-08-23: "when a large unit is destroyed, it should leave more derby in the ground."
 */
export function deathRingOutset(width: number, height: number): number {
  return Math.max(1, Math.ceil(Math.max(width, height) / 2))
}

/**
 * Extra ticks `fx.death.collapse` plays beyond its own ~4-tick baseline, for a body big enough to
 * earn the full shockwave/flying-debris choreography (`bigDeathScatter`, below) rather than the
 * original flat halo. Owner playtest, 2026-08-23: "for the giant colossus, it needs to take multiple
 * turns, perhaps even 6 or 12 turns to complete... it's an effect, so it should be fine to do it over
 * multiple turns." Zero for anything up to a 2-tile body, so a 1x1 death is unchanged; four ticks per
 * outset step beyond that lands a 3x3 body (the colossus) at roughly eight ticks total and the 5x2
 * leviathan at roughly twelve — the owner's own two numbers, not tuned to hit them after the fact.
 */
const BIG_DEATH_EXTRA_TICKS = 4

export function deathExtraTicks(width: number, height: number): number {
  return Math.max(0, deathRingOutset(width, height) - 1) * BIG_DEATH_EXTRA_TICKS
}

/**
 * Every tile at exactly `outset` tiles from a `width` x `height` box - a rectangle's perimeter
 * generalised the way `ringTiles` (below) generalises a point's. At `outset = 1` and a 1x1 box this
 * reproduces the eight fixed offsets `fx.death.collapse` always drew; for anything bigger, the
 * perimeter itself is bigger, which is the whole mechanism - no separate size tiers to keep in sync.
 */
function footprintRing(width: number, height: number, outset: number): Coord[] {
  const tiles: Coord[] = []
  for (let y = -outset; y <= height - 1 + outset; y += 1) {
    for (let x = -outset; x <= width - 1 + outset; x += 1) {
      const dx = x < 0 ? -x : x >= width ? x - width + 1 : 0
      const dy = y < 0 ? -y : y >= height ? y - height + 1 : 0
      if (Math.max(dx, dy) === outset) tiles.push({ x, y })
    }
  }
  return tiles
}

/**
 * A death frame's glyph at one offset, or `undefined` to fall through to the generic debris fill -
 * either because this content has no death frames, or because this tile is blank (a space) in the
 * frame selected. `progress` alone decides which frame plays: pure function of time, same as every
 * other recipe. Reduced motion holds the final frame - the wreck, not the collapse - matching
 * ascii-effects.md 4's "keeps... settle, drops... drift": the sequence is the drift here.
 */
function deathFrameGlyphAt(
  frames: readonly UnitArt[],
  progress: number,
  reducedMotion: boolean,
  x: number,
  y: number,
): string | undefined {
  const index = reducedMotion
    ? frames.length - 1
    : Math.min(frames.length - 1, Math.floor(progress * frames.length))
  const glyph = frames[index]?.[y]?.[x]
  return glyph === undefined || glyph === " " ? undefined : glyph
}

/** Beats a big-body death choreography moves through, as fractions of the instance's own window. */
const SHOCKWAVE_END = 0.15
const DEBRIS_LAUNCH_START = 0.15
const DEBRIS_LAUNCH_SPAN = 0.35
const DEBRIS_FLIGHT_MIN = 0.15
const DEBRIS_FLIGHT_SPAN = 0.2
const DEBRIS_POP_WINDOW = 0.06

/**
 * How many pieces a body earns, scaled by how far its own ring sits from the footprint - more for a
 * wider blast radius, capped so a hypothetical body bigger than anything on the bench today cannot
 * fill the screen with debris. `3 + outset * 2` puts the 3x3 colossus (`outset = 2`) at seven pieces
 * and the 5x2 leviathan (`outset = 3`) at nine.
 */
function bigDeathPieceCount(outset: number): number {
  return Math.min(10, 3 + outset * 2)
}

/**
 * The choreography a body big enough to need `deathExtraTicks` (above) earns instead of the flat
 * ring `deathCollapse` draws for everything smaller: a shockwave racing out to the ring's own
 * radius, then a handful of hand-placed pieces, each launched on its own delay and flown along a
 * straight, hand-computed line - the same closed-form interpolation `tileLine`/`rangedTracer`
 * already use, not a physics integrator (ascii-effects.md 7) - to a landing tile *beyond* `outset`,
 * a bright "pop" where it lands, then a dim settle. Owner playtest, 2026-08-23: "an explosion that
 * goes from the middle towards the radius, then smaller explosions, and pieces being broken around,
 * ending up in multiple debris." Every draw is seeded from `hash` (the instance's own identity plus
 * a salt), so which pieces go where and when is fixed the instant the unit dies, not re-rolled frame
 * to frame - the purity `mergeEffectCells` (composite.ts) leans on one level up applies here first.
 */
function bigDeathScatter(
  instance: EffectInstance,
  context: EffectContext,
  family: Family,
  width: number,
  height: number,
  outset: number,
  progress: number,
  hash: number,
): PositionedCell[] {
  const cells: PositionedCell[] = []
  const centreX = (width - 1) / 2
  const centreY = (height - 1) / 2

  // The shockwave: a single expanding ring, not an accumulating disk - drawn fresh from `progress`
  // alone every frame, same as everything else here. Travel, so reduced motion drops it; the impact
  // it is racing away from is already carried by the interior fill above.
  if (!context.reducedMotion && progress <= SHOCKWAVE_END) {
    const reach = Math.max(1, Math.round((progress / SHOCKWAVE_END) * outset))
    const glyph = family.impact[0] ?? "*"
    for (const offset of footprintRing(width, height, reach)) {
      cells.push({
        tile: { x: instance.origin.x + offset.x, y: instance.origin.y + offset.y },
        glyph,
        role: "fx.debris",
        bold: true,
      })
    }
  }

  const pieces = bigDeathPieceCount(outset)
  for (let index = 0; index < pieces; index += 1) {
    const salt = index * 10
    const start = DEBRIS_LAUNCH_START + cosmeticUnit(draw(hash, salt)) * DEBRIS_LAUNCH_SPAN
    const flight = DEBRIS_FLIGHT_MIN + cosmeticUnit(draw(hash, salt + 1)) * DEBRIS_FLIGHT_SPAN
    const angle = cosmeticUnit(draw(hash, salt + 2)) * Math.PI * 2
    // Beyond outset, not up to it: a piece landing exactly on the old fixed ring would just redraw
    // it. Owner playtest: "some debris may even spam on tiles next to the original unit." `reach` is
    // a Chebyshev distance - footprintRing's own units, not a Euclidean one - so a direction vector
    // is normalised by its own Chebyshev length before being scaled: a diagonal throw and an
    // axis-aligned one both land exactly `reach` tiles out, the same way footprintRing's ring is
    // measured, rather than a diagonal throw quietly landing closer for the same draw.
    const reach = outset + cosmeticUnit(draw(hash, salt + 3)) * 2
    const dirX = Math.cos(angle)
    const dirY = Math.sin(angle)
    const chebyshevLength = Math.max(Math.abs(dirX), Math.abs(dirY)) || 1
    const offsetX = (dirX / chebyshevLength) * reach
    const offsetY = (dirY / chebyshevLength) * reach
    const glyph = cosmeticPick(draw(hash, salt + 4), family.debris)
    const landing = {
      x: instance.origin.x + Math.round(centreX + offsetX),
      y: instance.origin.y + Math.round(centreY + offsetY),
    }

    if (context.reducedMotion) {
      // Travel and the launch delay are exactly what reduced motion drops (ascii-effects.md 4): the
      // piece shows already landed, dim, for the window's whole length. Causality survives - a body
      // this size is gone and its debris is on the ground - which is the only thing this beat owes.
      cells.push({ tile: landing, glyph, role: "fx.debris", dim: true })
      continue
    }
    if (progress < start) continue // not yet launched

    const local = Math.min(1, (progress - start) / flight)
    if (local < 1) {
      cells.push({
        tile: {
          x: instance.origin.x + Math.round(centreX + offsetX * local),
          y: instance.origin.y + Math.round(centreY + offsetY * local),
        },
        glyph,
        role: "fx.debris",
        bold: true,
      })
      continue
    }
    if (progress < start + flight + DEBRIS_POP_WINDOW) {
      // The "smaller explosions" beat: a brief bright pop where a piece lands, not a mark that just
      // silently appears.
      cells.push({ tile: landing, glyph: family.impact[0] ?? glyph, role: "fx.debris", bold: true })
      continue
    }
    cells.push({ tile: landing, glyph, role: "fx.debris", dim: true })
  }

  return cells
}

/**
 * Expanding then thinning debris over the footprint. Visibly heavier than an impact burst - and,
 * for content that defines `DEATH_ART` (`src/content/art.ts`), its own crumbling silhouette plays
 * across the footprint instead of the plain per-tile fill, the ring still scattering around it: a
 * combination of effects and a dead animation, owner playtest 2026-08-23, "could really make it snap".
 * A body whose ring sits more than one tile out (`deathRingOutset`, above) trades that flat ring for
 * `bigDeathScatter`'s full shockwave/flying-debris/settle choreography instead - same owner playtest:
 * "an explosion that goes from the middle towards the radius, then smaller explosions, and pieces
 * being broken around, ending up in multiple debris."
 */
const deathCollapse: EffectRecipe = (instance, context) => {
  const family = familyOf(instance)
  const width = paramNumber(instance, "width", 1)
  const height = paramNumber(instance, "height", 1)
  const progress = progressOf(instance, context)
  const hash = instanceHash(instance, context, 5)
  const frames = deathFramesFor(paramString(instance, "contentId"))
  const cells: PositionedCell[] = []

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const tile = { x: instance.origin.x + x, y: instance.origin.y + y }
      const framed =
        frames === undefined
          ? undefined
          : deathFrameGlyphAt(frames, progress, context.reducedMotion, x, y)
      if (framed !== undefined) {
        cells.push({ tile, glyph: framed, role: "fx.debris", bold: progress < 0.3 })
        continue
      }
      // A defined sequence controls its own silhouette tile by tile - a blank in every relevant
      // frame stays blank rather than falling back to filler that would fight the shape it drew.
      if (frames !== undefined) continue
      if (progress < 0.45) {
        cells.push({ tile, glyph: family.impact[0] ?? "*", role: "fx.debris", bold: true })
      } else if (progress < 0.8) {
        cells.push({ tile, glyph: cosmeticPick(draw(hash, x * 7 + y), family.debris), role: "fx.debris" })
      } else {
        cells.push({ tile, glyph: ".", role: "fx.debris", dim: true })
      }
    }
  }
  // A body big enough to earn deathExtraTicks (above) earns the full shockwave/flying-debris
  // choreography instead of the flat ring below - across the instance's whole, now much longer,
  // window (reduced motion included: bigDeathScatter drops travel itself, same as the interior fill
  // above already does), not just the loudest first 45% a small death's ring is confined to.
  const outset = deathRingOutset(width, height)
  if (outset > 1) {
    cells.push(...bigDeathScatter(instance, context, family, width, height, outset, progress, hash))
    return cells
  }

  if (context.reducedMotion || progress >= 0.45) return cells

  // The expansion: a ring around the footprint, only while the collapse is loudest.
  // ascii-effects.md 5's own words for this recipe are "must be visibly heavier than
  // fx.impact.burst, the two events players confuse most" (owner playtest, 2026-08-22: "show bigger
  // explosions when the units die vs when they take damage"); scaled further by footprint size
  // (owner playtest, 2026-08-23, above). A ring past its 1x1 minimum is thinned - craft rule 5,
  // negative space is material - or a five-tile body's ring reads as a solid, static block rather
  // than scattered debris.
  const density = outset <= 1 ? 1 : 0.7
  footprintRing(width, height, outset).forEach((offset, index) => {
    const spin = draw(hash, index + 20)
    if (density < 1 && cosmeticUnit(spin) > density) return
    cells.push({
      tile: { x: instance.origin.x + offset.x, y: instance.origin.y + offset.y },
      glyph: cosmeticPick(spin, family.debris),
      role: "fx.debris",
      dim: true,
    })
  })
  return cells
}

/** Footprint-sized, slower, settling downward. Scales with area, not with a constant. */
const structureCollapse: EffectRecipe = (instance, context) => {
  const family = familyOf(instance)
  const width = paramNumber(instance, "width", 3)
  const height = paramNumber(instance, "height", 2)
  const progress = progressOf(instance, context)
  const hash = instanceHash(instance, context, 7)
  const cells: PositionedCell[] = []

  // Rows fail from the top down, which is what makes it read as settling rather than dissolving.
  // The top row is already gone in the first frame: a structure that stands intact for a third of
  // its own collapse reads as a pause, not as weight.
  const collapsedRows = Math.min(height, Math.floor(progress * height) + 1)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const tile = { x: instance.origin.x + x, y: instance.origin.y + y }
      const failed = y < collapsedRows
      if (!failed && !context.reducedMotion && progress > 0.15) continue
      cells.push({
        tile,
        glyph: failed
          ? cosmeticPick(draw(hash, x * 13 + y), family.debris)
          : (family.impact[0] ?? "*"),
        role: "fx.debris",
        dim: failed && progress > 0.6,
        bold: !failed && progress < 0.2,
      })
    }
  }
  return cells
}

/**
 * The Ravel rule made visible: a ring that reaches its radius and thins. The one effect allowed
 * real visual weight besides a Nexus going critical, because it is the one event that can end an
 * army in a single tick.
 */
const blastDetonation: EffectRecipe = (instance, context) => {
  const radius = Math.max(1, paramNumber(instance, "radius", 1))
  const progress = progressOf(instance, context)
  const family = familyOf(instance)
  const hash = instanceHash(instance, context, 11)
  const cells: PositionedCell[] = []

  cells.push({
    tile: instance.origin,
    glyph: progress < 0.4 ? (family.impact[0] ?? "X") : "*",
    role: "fx.blast",
    bold: progress < 0.5,
  })

  if (context.reducedMotion) {
    // No expansion: the full radius, drawn once and held, so the reach is still legible.
    for (const tile of ringTiles(instance.origin, radius)) {
      cells.push({ tile, glyph: "*", role: "fx.blast", dim: true })
    }
    return cells
  }

  const reach = Math.max(1, Math.round(progress * radius * 1.35))
  for (const tile of ringTiles(instance.origin, Math.min(radius, reach))) {
    const spin = draw(hash, tile.x * 31 + tile.y)
    // Negative space is material (craft rule 5). A ring that paints every tile it reaches is what
    // makes ASCII explosions look like static, so a third of it is missing from the first frame and
    // most of it is missing by the last.
    const density = progress > 0.5 ? 0.35 : 0.65
    if (cosmeticUnit(spin) > density) continue
    cells.push({
      tile,
      glyph: cosmeticPick(spin, family.debris),
      role: "fx.blast",
      dim: progress > 0.55,
    })
  }
  return cells
}

function ringTiles(centre: Coord, radius: number): Coord[] {
  const tiles: Coord[] = []
  for (let y = -radius; y <= radius; y += 1) {
    for (let x = -radius; x <= radius; x += 1) {
      if (Math.max(Math.abs(x), Math.abs(y)) !== radius) continue
      tiles.push({ x: centre.x + x, y: centre.y + y })
    }
  }
  return tiles
}

/**
 * The one sustained effect. Phase-locked to absolute time rather than to its own start, so every
 * client — and every frame, however many were skipped — shows the same phase at the same instant.
 */
const nexusCritical: EffectRecipe = (instance, context) => {
  const width = paramNumber(instance, "width", 3)
  const height = paramNumber(instance, "height", 2)
  const periodMs = Math.max(200, paramNumber(instance, "periodMs", 1200))
  const phase = (context.timeMs % periodMs) / periodMs
  const cells: PositionedCell[] = []

  // A wave crossing the footprint. Reduced motion holds the corners lit instead of sweeping.
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const tile = { x: instance.origin.x + x, y: instance.origin.y + y }
      if (context.reducedMotion) {
        const corner = (x === 0 || x === width - 1) && (y === 0 || y === height - 1)
        if (corner) cells.push({ tile, glyph: "!", role: "fx.critical", bold: true })
        continue
      }
      const front = phase * (width + height)
      const distance = Math.abs(x + y - front)
      if (distance < 0.9) {
        cells.push({ tile, glyph: "!", role: "fx.critical", bold: true })
      }
    }
  }
  return cells
}

export const EFFECT_RECIPES: Readonly<Record<string, EffectRecipe>> = {
  "fx.move.trail": moveTrail,
  "fx.melee.wind": meleeWind,
  "fx.melee.clash": meleeClash,
  "fx.ranged.telegraph": rangedTelegraph,
  "fx.ranged.tracer": rangedTracer,
  "fx.impact.burst": impactBurst,
  "fx.damage.flash": damageFlash,
  "fx.death.collapse": deathCollapse,
  "fx.structure.collapse": structureCollapse,
  "fx.blast.detonation": blastDetonation,
  "fx.nexus.critical": nexusCritical,
}

export const EFFECT_IDS: readonly string[] = Object.keys(EFFECT_RECIPES)
