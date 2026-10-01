// The Grid's ground, drawn through the camera and clipped to the viewport — shared by the Build Phase
// and the Nexus Pulse, so the map looks like the same map on both sides of a commit. Nothing
// stands on it here; structures, units and effects are each screen's own.

import type { Camera, Viewport } from "../build/camera.ts"
import { visibleRange } from "../build/camera.ts"
import type { BuildLayout } from "../build/layout.ts"
import { cellForTile } from "../build/layout.ts"
import type { GridTerrain } from "../grid/types.ts"
import type { BandCell } from "./frame.ts"
import { BANDS } from "./frame.ts"
import { put } from "./draw.ts"
import { terrainGlyph } from "./theme.ts"
import type { GlyphPack } from "./theme.ts"

export function drawTerrain(
  cells: BandCell[],
  view: Readonly<{ grid: GridTerrain; camera: Camera; viewport: Viewport; layout: BuildLayout }>,
  pack: GlyphPack,
): void {
  const { grid, camera, viewport, layout } = view
  const range = visibleRange(camera, viewport)
  for (let y = range.firstY; y <= range.lastY; y += 1) {
    for (let x = range.firstX; x <= range.lastX; x += 1) {
      const terrainId = grid.tiles[y * grid.width + x]
      if (terrainId === undefined) continue
      const { glyph, role } = terrainGlyph(terrainId, pack)
      const cell = cellForTile(layout, camera, { x, y })
      // The same lattice the Pulse view draws featureless ground with — a full field of dots
      // competes with everything on top of it. Rock and deposits are features and always drawn. The
      // lattice is keyed to absolute tile coordinates, so it scrolls with the Grid rather than
      // crawling across it.
      const featureless = terrainId === "terrain.plain"
      const onLattice = x % 4 === 0 && y % 2 === 0
      put(cells, BANDS.terrain, cell.x, cell.y, featureless && !onLattice ? " " : glyph, role, {
        dim: true,
      })
      for (let extra = 1; extra < layout.tileWidth; extra += 1) {
        put(cells, BANDS.terrain, cell.x + extra, cell.y, " ", role)
      }
    }
  }
}
