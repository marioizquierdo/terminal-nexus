// The battlefield's layers. `drawTerrain` is the ground, drawn through the camera and clipped to the viewport —
// shared by the Build Phase and the Battle Round, so the map looks like the same map on both sides of a
// commit. `drawMapLayers` is the whole battlefield at one Pulse instant — ground, what stands on it, fire and
// effects — with no camera and no chrome, as the ASCII screenshot draws it.

import type { Camera, Viewport } from "../build/camera.ts"
import { visibleRange } from "../build/camera.ts"
import type { BuildLayout } from "../build/layout.ts"
import { cellForTile } from "../build/layout.ts"
import type { ContentDef, ContentRegistry } from "../content/index.ts"
import type { Coord, MapTerrain } from "../engine/geometry/types.ts"
import type { PlayerId } from "../engine/state/types.ts"
import type { ActiveEffect, EffectCellSource } from "./effects/index.ts"
import { paintEffectCells } from "./effects/index.ts"
import type { BandCell } from "./frame.ts"
import { BANDS } from "./frame.ts"
import { put } from "./draw.ts"
import type { FireTile } from "./burning.ts"
import { drawFire } from "./burning.ts"
import { entityGlyph, playerRole, salvageGlyph, terrainGlyph } from "./theme.ts"
import type { GlyphPack } from "./theme.ts"

export function drawTerrain(
  cells: BandCell[],
  view: Readonly<{ terrain: MapTerrain; camera: Camera; viewport: Viewport; layout: BuildLayout }>,
  pack: GlyphPack,
): void {
  const { terrain, camera, viewport, layout } = view
  const range = visibleRange(camera, viewport)
  for (let y = range.firstY; y <= range.lastY; y += 1) {
    for (let x = range.firstX; x <= range.lastX; x += 1) {
      const terrainId = terrain.tiles[y * terrain.width + x]
      if (terrainId === undefined) continue
      const { glyph, role } = terrainGlyph(terrainId, pack)
      const cell = cellForTile(layout, camera, { x, y })
      // The same lattice the Pulse view draws featureless ground with — a full field of dots
      // competes with everything on top of it. Rock and deposits are features and always drawn. The
      // lattice is keyed to absolute tile coordinates, so it scrolls with the battlefield rather than
      // crawling across it.
      const featureless = terrainId === "terrain.plain"
      const onLattice = x % 4 === 0 && y % 2 === 0
      put(cells, BANDS.terrain, cell.x, cell.y, featureless && !onLattice ? " " : glyph, role, {
        dim: true,
      })
    }
  }
}

/**
 * Whether an entity is drawn bold while a Pulse plays: a structure, as everything that stands is, and a
 * Commander — the one `@`, bold at full strength in her side's colour, so she is found at a glance among
 * the squads she walks with (the owner: "make sure vasse is visible, prominent"). One rule for every picture
 * of a Pulse: the Battle Round's (`pulse-scene.ts`) and the battlefield's own (`drawMapLayers`).
 */
export function drawnBold(definition: Pick<ContentDef, "layer" | "commander">): boolean {
  return definition.layer === "obstacles" || definition.commander === true
}

/**
 * A dead entity, still drawn — never in `state`, which stays strictly true. `snapshot.ts` builds
 * these for a ranged kill: the target is gone from `state.entities` the instant it dies, but its
 * own tracer is still visibly travelling for the rest of its flight window, so without this a unit
 * would vanish before the shot that killed it arrives. Held for exactly as long as
 * `fx.death.collapse`/`fx.structure.collapse` are already held (`buildFlightHoldTicks`), so the
 * glyph disappears at the same instant the death effect takes over the tile, not before and not
 * after.
 */
export type HeldCorpse = Readonly<{
  ordinal: number
  contentId: string
  player: PlayerId
  anchor: Coord
}>

/** What the battlefield's own layers are drawn from: the ground, what stands and walks on it, the fire, and the effects. */
export type MapLayersInput = Readonly<{
  terrain: MapTerrain
  registry: ContentRegistry
  /** What stands on the battlefield: a tick's state, or anything shaped like its entities and ground items. */
  state: Readonly<{
    entities: readonly Readonly<{ ordinal: number; contentId: string; player: PlayerId; anchor: Coord }>[]
    groundItems: readonly Readonly<{ at: Coord }>[]
  }>
  /** Where each entity is drawn — interpolated, and never known to the simulation. */
  positions: ReadonlyMap<number, { x: number; y: number }>
  /** What the effect system is painting at this instant. Absent or empty: nothing. */
  effects?: readonly ActiveEffect[]
  /** ASCII is the baseline and the acceptance target. */
  glyphPack?: GlyphPack
  /** Ranged kills still waiting for their own tracer to land — drawn, but never counted anywhere. */
  heldCorpses?: readonly HeldCorpse[]
  /** The ground burning at this instant (`PulseSample.fire`). Absent: none. */
  fire?: readonly FireTile[]
}>

/**
 * **The battlefield's own layers**, every tile: terrain, salvage, buildings, units and air, burning ground and the effects, each
 * in its band, a tile drawn on the cell `cellOf` gives: the battlefield alone, with no camera and no chrome, as the ASCII
 * screenshot (`./ascii-screenshot.ts`) draws it. Returns the tiles an entity stands on.
 */
export function drawMapLayers(cells: BandCell[], input: MapLayersInput, cellOf: (tile: Coord) => Coord): ReadonlySet<string> {
  const pack: GlyphPack = input.glyphPack ?? "ascii"

  // Band 1 — terrain.
  for (let y = 0; y < input.terrain.height; y += 1) {
    for (let x = 0; x < input.terrain.width; x += 1) {
      const terrainId = input.terrain.tiles[y * input.terrain.width + x]
      if (terrainId === undefined) continue
      const { glyph, role } = terrainGlyph(terrainId, pack)
      const cell = cellOf({ x, y })
      // Featureless ground is drawn as a coarse lattice rather than a dot per tile: negative space
      // is material, and 288 identical marks compete with every unit and every effect on top of
      // them. Rock and deposits are features and are always drawn.
      const featureless = terrainId === "terrain.plain"
      const onLattice = x % 4 === 0 && y % 2 === 0
      put(cells, BANDS.terrain, cell.x, cell.y, featureless && !onLattice ? " " : glyph, role, { dim: true })
    }
  }

  // Band 3 — ground items: salvage dropped where something died.
  for (const item of input.state.groundItems) {
    const cell = cellOf(item.at)
    put(cells, BANDS.groundItems, cell.x, cell.y, salvageGlyph(pack), "item.salvage")
  }

  // Bands 4, 5 and 6 — structures, workers and units, air. The battlefield layers map onto them directly.
  // Tiles an entity occupies are remembered, because the corruption law says an effect may never
  // replace the only cell carrying a required semantic cue, and a unit's glyph is exactly that.
  const occupied = new Set<string>()
  // A held corpse is drawn exactly like a live entity — same band, same role, same bold rule — for
  // as long as its own ranged tracer is still travelling. It is never in `input.state.entities`, so
  // it never reaches `forceTotals` or anything else that counts the living.
  const drawnEntities: readonly {
    ordinal: number
    contentId: string
    player: PlayerId
    anchor: Coord
  }[] = [...input.state.entities, ...(input.heldCorpses ?? [])]
  for (const entity of drawnEntities) {
    const definition = input.registry.get(entity.contentId)
    const drawn = input.positions.get(entity.ordinal) ?? entity.anchor
    const band =
      definition.layer === "obstacles"
        ? BANDS.structures
        : definition.layer === "air"
          ? BANDS.air
          : BANDS.units
    for (const offset of definition.footprint) {
      const tile = { x: drawn.x + offset.x, y: drawn.y + offset.y }
      if (tile.x < 0 || tile.y < 0 || tile.x >= input.terrain.width || tile.y >= input.terrain.height) {
        continue
      }
      const glyph = entityGlyph(entity.contentId, entity.player, offset)
      occupied.add(`${tile.x},${tile.y}`)
      const cell = cellOf(tile)
      put(cells, band, cell.x, cell.y, glyph, playerRole(entity.player), { bold: drawnBold(definition) })
    }
  }

  // Burning ground, under everything that stands on it (`src/view/burning.ts`) — salvage on the ground included, which
  // keeps its glyph as a unit does.
  const salvage = new Set(input.state.groundItems.map((item) => `${item.at.x},${item.at.y}`))
  drawFire(cells, input.fire ?? [], pack, {
    terrain: input.terrain,
    cellOf,
    visible: () => true,
    standing: (tile) => occupied.has(`${tile.x},${tile.y}`) || salvage.has(`${tile.x},${tile.y}`),
  })

  // Bands 3, 7, 8 and 9 — effects. They may paint here and nowhere else (`effects.md`),
  // they are clipped to the battlefield, and they can never move a glyph the simulation put down.
  //
  // Collected first, rather than pushed straight into `cells`, so that two effect cells landing on
  // the same tile and band this frame go through mergeEffectCells (src/view/effects/composite.ts)
  // before either one reaches the general "topmost wins" rule composeBands applies to everything
  // else. That merge is effects-only, on purpose: a live entity's own glyph must never be a blend of
  // two things, only two *effects* competing for the same tile are allowed to combine.
  const effectSources: EffectCellSource[] = []
  for (const painted of input.effects ?? []) {
    const band = painted.instance.band
    for (const cell of painted.cells) {
      if (
        cell.tile.x < 0 ||
        cell.tile.y < 0 ||
        cell.tile.x >= input.terrain.width ||
        cell.tile.y >= input.terrain.height
      ) {
        continue
      }
      effectSources.push({ band, cell })
    }
  }
  // The corruption law, enforced by the compositor rather than by recipe discipline: an effect that would
  // replace a unit, a structure or a wreck's glyph is dropped on that tile — the screen may look wrong;
  // the player must still be able to see what is attacking them.
  paintEffectCells(cells, effectSources, cellOf, (tile) => occupied.has(`${tile.x},${tile.y}`))
  return occupied
}
