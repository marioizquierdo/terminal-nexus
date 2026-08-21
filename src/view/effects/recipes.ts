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
import type {
  EffectContext,
  EffectFamily,
  EffectInstance,
  EffectRecipe,
  PositionedCell,
} from "./types.ts"
import { paramNumber, progressOf } from "./types.ts"
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

  if (progress >= 0.35) {
    // Thinning outward: one mark either side of the contact, perpendicular to the blow.
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
  const cells: PositionedCell[] = [{ tile: head, glyph, role, bold: true }]
  const behind = line[index - 1]
  if (behind !== undefined && index > 1) {
    cells.push({ tile: behind, glyph, role, dim: true })
  }
  return cells
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

  const shards = progress < 0.5 ? 2 : 1
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

/** Expanding then thinning debris over the footprint. Visibly heavier than an impact burst. */
const deathCollapse: EffectRecipe = (instance, context) => {
  const family = familyOf(instance)
  const width = paramNumber(instance, "width", 1)
  const height = paramNumber(instance, "height", 1)
  const progress = progressOf(instance, context)
  const hash = instanceHash(instance, context, 5)
  const cells: PositionedCell[] = []

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const tile = { x: instance.origin.x + x, y: instance.origin.y + y }
      if (progress < 0.45) {
        cells.push({ tile, glyph: family.impact[0] ?? "*", role: "fx.debris", bold: true })
      } else if (progress < 0.8) {
        cells.push({ tile, glyph: cosmeticPick(draw(hash, x * 7 + y), family.debris), role: "fx.debris" })
      } else {
        cells.push({ tile, glyph: ".", role: "fx.debris", dim: true })
      }
    }
  }
  if (context.reducedMotion || progress >= 0.45) return cells

  // The expansion: a ring one tile out, only while the collapse is loudest.
  const ring: Coord[] = [
    { x: -1, y: 0 },
    { x: width, y: 0 },
    { x: 0, y: -1 },
    { x: 0, y: height },
  ]
  ring.forEach((offset, index) => {
    cells.push({
      tile: { x: instance.origin.x + offset.x, y: instance.origin.y + offset.y },
      glyph: cosmeticPick(draw(hash, index + 20), family.debris),
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
