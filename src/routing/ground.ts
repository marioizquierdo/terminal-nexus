// Ground: where a body may stand (milestone 16, "the parts"). The first of routing's parts, and the only one that
// looks at the Grid's terrain: everything after it asks only "may this body stand with its anchor here?".
//
// A **wall** is a tile no body may cover: rock (for a body that walks the ground), or something that stands still this
// tick. The edge of the Grid is a wall too, without being stored. A **body** is a footprint, its tiles as offsets from
// its anchor (`src/grid/types.ts`); bodies of the same shape stand on the same ground, so ground is worked out per
// body, never per unit. Pure, integers only, and the same on every machine.

import { TERRAIN } from "../grid/types.ts"
import type { Coord, Footprint, GridTerrain } from "../grid/types.ts"

/** The tiles no body may cover, row-major from the north-west, 1 for a wall. */
export type Walls = Readonly<{ width: number; height: number; wall: Uint8Array }>

/**
 * The walls of a Grid: its rock, unless `terrain` is "ignore" (a body in the air), and `blocked`, the tiles of
 * whatever stands still. A tile of `blocked` off the Grid is ignored: the edge is a wall already.
 */
export function wallsOf(grid: GridTerrain, terrain: "impassable" | "ignore", blocked: Iterable<Coord> = []): Walls {
  const wall = new Uint8Array(grid.width * grid.height)
  if (terrain === "impassable") {
    grid.tiles.forEach((id, index) => {
      if (TERRAIN[id].impassable) wall[index] = 1
    })
  }
  for (const tile of blocked) {
    if (tile.x < 0 || tile.y < 0 || tile.x >= grid.width || tile.y >= grid.height) continue
    wall[tile.y * grid.width + tile.x] = 1
  }
  return { width: grid.width, height: grid.height, wall }
}

/** Whether `tile` is a wall, the Grid's edge included. */
export function isWall(walls: Walls, tile: Coord): boolean {
  if (tile.x < 0 || tile.y < 0 || tile.x >= walls.width || tile.y >= walls.height) return true
  return walls.wall[tile.y * walls.width + tile.x] === 1
}

/** A name for a body's shape, the same for every unit of that shape: what ground and fields are kept by. */
export function bodyKey(body: Footprint): string {
  return body.map((offset) => `${offset.x},${offset.y}`).join(";")
}

/**
 * Where a body may stand: for every anchor of the Grid, 1 when every tile its body covers from there is on the Grid
 * and no wall. Row-major from the north-west, like the walls.
 */
export type Ground = Readonly<{ width: number; height: number; open: Uint8Array }>

export function groundFor(walls: Walls, body: Footprint): Ground {
  const { width, height } = walls
  const open = new Uint8Array(width * height)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let fits = 1
      for (const offset of body) {
        const tx = x + offset.x
        const ty = y + offset.y
        if (tx < 0 || ty < 0 || tx >= width || ty >= height || walls.wall[ty * width + tx] === 1) {
          fits = 0
          break
        }
      }
      open[y * width + x] = fits
    }
  }
  return { width, height, open }
}

/** Whether a body may stand with its anchor at `anchor`. Off the Grid it may not. */
export function canStand(ground: Ground, anchor: Coord): boolean {
  if (anchor.x < 0 || anchor.y < 0 || anchor.x >= ground.width || anchor.y >= ground.height) return false
  return ground.open[anchor.y * ground.width + anchor.x] === 1
}
