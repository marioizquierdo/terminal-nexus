// Burning ground, as the Battle Round draws it (the owner, 2026-10-21: "a large area that is set on fire ...
// drawn in its own style"). The rule is the kernel's (`MatchState.burning`, `BurningGround`); this is only its
// picture, worked out in two steps:
//
//   - `fireAt` — which tiles burn at one presentation instant, and how each is lit: a pure function of the state of
//     the tick shown, the presentation time and a hash of the patch's identity and the tile. No clock, no stream.
//   - `drawFire` — those tiles as cells: on open ground a flickering flame (`fx.fire`) on a scorched fill
//     (`fx.fire.ground`); under a unit, a building or a corpse the fill alone, so it keeps its glyph and every
//     colour of its own and only the ground round it changes (the corruption law).
//
// Both Pulse views draw it from the same `PulseSample.fire`: the engine tool's (`compose.ts`) and the Build Phase
// screen's, the live Battle Round and the replay of the last round (`pulse-scene.ts`), and with them the browser page.

import type { Coord, GridTerrain, TerrainId } from "../grid/types.ts"
import type { Footprint } from "../grid/types.ts"
import { inBounds } from "../grid/coords.ts"
import { tilesWithin } from "../grid/reach.ts"
import type { BurningGround } from "../state/types.ts"
import { cosmeticHash, cosmeticUnit } from "./effects/random.ts"
import type { BandCell, CellStyle } from "./frame.ts"
import { BANDS } from "./frame.ts"
import type { GlyphPack } from "./theme.ts"

/** How a burning tile is lit at one instant: a tall flame, a low one, or none (the scorched ground shows). */
export type Flame = "tall" | "low" | null

/** One tile of burning ground at one presentation instant. `dying`: in its patch's last moments, burning low. */
export type FireTile = Readonly<{ tile: Coord; flame: Flame; dying: boolean }>

/** The look's tuned numbers. */
export const FIRE = {
  /** How long a tile holds one look before it may change: a little under a fifth of a second, so the patch licks
   *  rather than strobes. Each tile keeps its own beat, offset by its hash, so they never change all at once. */
  flickerMs: 170,
  /** The last stretch of a patch's life, drawn burning low (only low flames, dim, fewer of them), so the end reads
   *  before it comes. */
  dyingMs: 1000,
  /** While it burns: the share of tiles in a tall flame, then in a tall or a low one; the rest are scorched ground. */
  tall: 0.45,
  lit: 0.8,
  /** While it dies down: the share of tiles still in a (low) flame. */
  dyingLit: 0.4,
} as const

/** The glyphs, by pack: a tall flame, a low one. ASCII first: `^` is a tongue of flame and `~` the low flicker
 *  and heat of it, neither used on the Battle Round's Grid by anything else (the effects' marks are `+ x = - | / \
 *  * , : ' . !`, units are letters). The Unicode pack's tall flame is a small solid triangle, `▴`, a filled tongue
 *  of one cell's width (East Asian width neutral, so never two columns), with the same low `~`. */
export const FIRE_GLYPHS: Readonly<Record<GlyphPack, Readonly<{ tall: string; low: string }>>> = {
  ascii: { tall: "^", low: "~" },
  unicode: { tall: "▴", low: "~" },
}

/** The recipe-like name a patch's cosmetic hash is salted with, so its flicker shares nothing with an effect's. */
const HASH_NAME = "ground.burning"

/** A patch is measured from its one centre tile, as the rule measures it. */
const ONE_TILE: Footprint = [{ x: 0, y: 0 }]

/** Ground that shows a flame: open ground. Rock and a deposit are features of the map, always drawn, so they keep
 *  their glyphs and take the scorched fill alone. */
const FLAMMABLE: ReadonlySet<TerrainId> = new Set<TerrainId>(["terrain.plain", "terrain.scrub"])

/**
 * Every tile a patch burns, in reading order: the tiles within its `radius` of its `centre`, by the Grid's own test
 * (`tilesWithin`, `footprintWithin`, which the kernel's `withinArea` is) — a row counts two columns, so a diamond twice
 * as wide as it is tall in tiles and as wide as it is tall on screen. What is drawn burning is what burns.
 */
export function patchTiles(patch: Pick<BurningGround, "centre" | "radius">): Coord[] {
  return tilesWithin(patch.centre, ONE_TILE, patch.radius)
}

export type FireInput = Readonly<{
  /** The state's burning ground, at the tick shown (`MatchState.burning`). */
  burning: readonly BurningGround[] | undefined
  /** The tick shown. */
  tick: number
  /** Absolute presentation time. */
  timeMs: number
  tickDurationMs: number
  /** When everything in the fight has landed and Recall may begin (`PulseView.effectsEndMs`, at least the last
   *  tick's end): the fire is put out by then whatever its own end, as Recall puts it out in the rules. */
  outMs: number
  reducedMotion: boolean
  cosmeticSeed: number
}>

/**
 * The burning ground at one presentation instant (`FireTile`): every tile of every patch the state at the tick shown
 * holds, while that tick is within the patch's life (`startedTick` to `untilTick`, both included) and the fight has
 * not ended. A pure function of its input: the same instant gives the same tiles, sampled alone or after every frame
 * before it.
 *
 * **The flicker** is cosmetic randomness only (`effects.md`): a hash of the cosmetic seed, the patch's identity (when
 * it was lit, by whom, where) and the tile, with the beat the time is in. Each tile changes its look once a beat,
 * its beats offset from its neighbours'. **Reduced motion** holds the first beat's look still.
 *
 * **Dying down**: in its last `FIRE.dyingMs` (to its own end, or to the end of the fight if that comes first) a patch
 * burns low — low flames only, fewer of them, drawn dim — so the end is seen coming. Reduced motion keeps that too:
 * it is the state of the patch, not decoration.
 *
 * Two patches over one tile draw it once, the one burning hotter (not dying) first.
 */
export function fireAt(input: FireInput): FireTile[] {
  const { burning } = input
  if (burning === undefined || burning.length === 0) return []
  const byTile = new Map<string, FireTile>()
  for (const patch of burning) {
    if (input.tick < patch.startedTick || input.tick > patch.untilTick) continue
    const endMs = Math.min((patch.untilTick + 1) * input.tickDurationMs, input.outMs)
    if (input.timeMs >= endMs) continue
    const dying = endMs - input.timeMs <= FIRE.dyingMs
    // The patch's identity, folded into one number: who lit it, where. The tick it was lit goes in as the start.
    const identity = ((patch.sourceOrdinal * 131 + patch.centre.x) * 131 + patch.centre.y) | 0
    for (const tile of patchTiles(patch)) {
      const key = `${tile.x},${tile.y}`
      const already = byTile.get(key)
      if (already !== undefined && (!already.dying || dying)) continue
      byTile.set(key, { tile, flame: flameAt(input, patch.startedTick, identity, tile, dying), dying })
    }
  }
  return [...byTile.values()]
}

function flameAt(input: FireInput, startedTick: number, identity: number, tile: Coord, dying: boolean): Flame {
  const own = cosmeticHash(input.cosmeticSeed, HASH_NAME, startedTick, tile.x, tile.y, identity)
  const offset = own % FIRE.flickerMs
  const beat = input.reducedMotion ? 0 : Math.floor((Math.max(0, input.timeMs) + offset) / FIRE.flickerMs)
  const roll = cosmeticUnit(cosmeticHash(input.cosmeticSeed, HASH_NAME, startedTick, tile.x, tile.y, (identity ^ Math.imul(beat + 1, 0x9e3779b1)) | 0))
  if (dying) return roll < FIRE.dyingLit ? "low" : null
  if (roll < FIRE.tall) return "tall"
  return roll < FIRE.lit ? "low" : null
}

/** The scorched fill every burning tile takes where colours are drawn, under whatever stands there. */
const SCORCHED: CellStyle = { bgRole: "fx.fire.ground" }

export type FireView = Readonly<{
  grid: GridTerrain
  /** The frame cell a tile is drawn on. */
  cellOf: (tile: Coord) => Coord
  /** Whether a tile is drawn on this frame at all (the camera's view; the whole Grid for a view without one). */
  visible: (tile: Coord) => boolean
  /** Whether something stands on a tile and keeps its glyph there: a unit, a building, a corpse still drawn. */
  standing: (tile: Coord) => boolean
}>

/**
 * ***Burning ground*** drawn under what stands on it. Call it after the entities are drawn and before the effects.
 *
 * - **Open ground**: the flame of the instant (`FIRE_GLYPHS`) in `fx.fire`, dim while it dies down, on the
 *   scorched fill — on the ground's own band, under every unit, building, corpse and effect; a tile with no flame at
 *   that instant shows its own terrain glyph on the fill. Rock and deposits keep their glyphs and take the fill.
 * - **Under a unit, a building or a corpse**: the fill alone, a glyphless write that keeps its glyph and its own
 *   colour, so a unit standing in the fire is seen standing in it (a fill, not a wash: a see-through mix would pull
 *   its glyph's colour toward another and change its hue at 256 colours).
 *
 * In **monochrome** the fill is not drawn, and the flames carry the patch alone, by their glyphs.
 */
export function drawFire(cells: BandCell[], fire: readonly FireTile[], pack: GlyphPack, view: FireView): void {
  const glyphs = FIRE_GLYPHS[pack]
  for (const { tile, flame, dying } of fire) {
    if (!inBounds(view.grid, tile) || !view.visible(tile)) continue
    const { x, y } = view.cellOf(tile)
    if (view.standing(tile)) {
      // Over the units' and the structures' bands, so it lands on their own cells; an effect over it still restyles it.
      cells.push({ band: BANDS.air, x, y, style: SCORCHED })
      continue
    }
    const terrain = view.grid.tiles[tile.y * view.grid.width + tile.x]
    if (flame === null || terrain === undefined || !FLAMMABLE.has(terrain)) {
      cells.push({ band: BANDS.territory, x, y, style: SCORCHED })
      continue
    }
    const style: CellStyle = { fgRole: "fx.fire", bgRole: "fx.fire.ground", ...(dying ? { dim: true } : { bold: flame === "tall" }) }
    cells.push({ band: BANDS.territory, x, y, cell: { glyph: flame === "tall" ? glyphs.tall : glyphs.low, style } })
  }
}
