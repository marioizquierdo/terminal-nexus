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

/** The rock of each Grid, for a body that walks the ground, worked out once: a Grid's terrain never changes after it is
 *  made, so it is kept by its tiles. */
const ROCK = new WeakMap<readonly unknown[], Uint8Array>()

function rockOf(grid: GridTerrain): Uint8Array {
  let rock = ROCK.get(grid.tiles)
  if (rock === undefined) {
    rock = new Uint8Array(grid.width * grid.height)
    for (let index = 0; index < grid.tiles.length; index += 1) if (TERRAIN[grid.tiles[index] as keyof typeof TERRAIN].impassable) rock[index] = 1
    ROCK.set(grid.tiles, rock)
  }
  return rock
}

/**
 * The walls of a Grid: its rock, unless `terrain` is "ignore" (a body in the air), and `blocked`, the tiles of
 * whatever stands still. A tile of `blocked` off the Grid is ignored: the edge is a wall already.
 */
export function wallsOf(grid: GridTerrain, terrain: "impassable" | "ignore", blocked: Iterable<Coord> = []): Walls {
  const wall = terrain === "impassable" ? rockOf(grid).slice() : new Uint8Array(grid.width * grid.height)
  for (const tile of blocked) {
    if (tile.x < 0 || tile.y < 0 || tile.x >= grid.width || tile.y >= grid.height) continue
    wall[tile.y * grid.width + tile.x] = 1
  }
  return { width: grid.width, height: grid.height, wall }
}

/** Marks as walls, in `walls`, the tiles a body anchored at `anchor` covers: what stands still, written straight in
 *  rather than listed first, as a tick does it for every unit. Tiles off the Grid are left: the edge is a wall. */
export function addWall(walls: Walls, anchor: Coord, body: Footprint): void {
  const { width, height, wall } = walls
  for (const offset of body) {
    const x = anchor.x + offset.x
    const y = anchor.y + offset.y
    if (x < 0 || y < 0 || x >= width || y >= height) continue
    wall[y * width + x] = 1
  }
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
  const { width, height, wall } = walls
  const open = new Uint8Array(width * height).fill(1)
  // A tile of the body at a time, over the whole Grid: an anchor stays open while that tile, from it, is on the Grid
  // and no wall. The same answer as asking every anchor for every tile, in plain runs along each row.
  for (const offset of body) {
    for (let y = 0; y < height; y += 1) {
      const row = y * width
      const ty = y + offset.y
      if (ty < 0 || ty >= height) {
        open.fill(0, row, row + width)
        continue
      }
      const from = Math.max(0, -offset.x)
      const to = Math.min(width, width - offset.x)
      if (from > 0) open.fill(0, row, row + from)
      if (to < width) open.fill(0, row + Math.max(to, 0), row + width)
      const shift = ty * width + offset.x - row
      for (let x = from; x < to; x += 1) if (wall[row + x + shift] === 1) open[row + x] = 0
    }
  }
  return { width, height, open }
}

/**
 * What stepping onto each anchor costs a body, per column of the step: the heaviest ground its body would cover there
 * (`stepWeight`), row-major like the ground; 1 everywhere for a body in the air. `null` when every tile weighs 1, so
 * a Grid with no slow ground costs nothing to ask.
 */
export function weightsFor(grid: GridTerrain, body: Footprint, terrain: "impassable" | "ignore"): Uint8Array | null {
  if (terrain === "ignore") return null
  let byBody = WEIGHTS.get(grid.tiles)
  if (byBody === undefined) {
    byBody = new Map()
    WEIGHTS.set(grid.tiles, byBody)
  }
  const key = bodyKey(body)
  if (!byBody.has(key)) byBody.set(key, weighed(grid, body))
  return byBody.get(key) ?? null
}

/** Each Grid's weights by body, worked out once: its terrain never changes after it is made. */
const WEIGHTS = new WeakMap<readonly unknown[], Map<string, Uint8Array | null>>()

function weighed(grid: GridTerrain, body: Footprint): Uint8Array | null {
  if (grid.tiles.every((id) => TERRAIN[id].stepWeight === 1)) return null
  const { width, height } = grid
  const weights = new Uint8Array(width * height).fill(1)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let heaviest = 1
      for (const offset of body) {
        const tx = x + offset.x
        const ty = y + offset.y
        if (tx < 0 || ty < 0 || tx >= width || ty >= height) continue
        heaviest = Math.max(heaviest, TERRAIN[grid.tiles[ty * width + tx] as keyof typeof TERRAIN].stepWeight)
      }
      weights[y * width + x] = heaviest
    }
  }
  return weights
}

/** What stepping onto `anchor` costs a body per column of the step: the heaviest ground under it there. */
export function weightAt(grid: GridTerrain, body: Footprint, anchor: Coord, terrain: "impassable" | "ignore" = "impassable"): number {
  if (terrain === "ignore") return 1
  let heaviest = 1
  for (const offset of body) {
    const tx = anchor.x + offset.x
    const ty = anchor.y + offset.y
    if (tx < 0 || ty < 0 || tx >= grid.width || ty >= grid.height) continue
    heaviest = Math.max(heaviest, TERRAIN[grid.tiles[ty * grid.width + tx] as keyof typeof TERRAIN].stepWeight)
  }
  return heaviest
}

/** Whether a body may stand with its anchor at `anchor`. Off the Grid it may not. */
export function canStand(ground: Ground, anchor: Coord): boolean {
  if (anchor.x < 0 || anchor.y < 0 || anchor.x >= ground.width || anchor.y >= ground.height) return false
  return ground.open[anchor.y * ground.width + anchor.x] === 1
}

/**
 * Which patch of `ground` each anchor is on, numbered from 1 in reading order of their first anchor, 0 where the body
 * cannot stand: two anchors share a patch exactly when each can be walked to from the other, a step at a time along
 * the Grid's sides. One flood of the ground; what a field asks first, so a goal on another patch is known unreachable
 * without searching (`DistanceField`).
 */
export function patchesOf(ground: Ground): Int32Array {
  const { width, height, open } = ground
  const patches = new Int32Array(width * height)
  const queue = new Int32Array(width * height)
  let count = 0
  for (let start = 0; start < open.length; start += 1) {
    if (open[start] !== 1 || patches[start] !== 0) continue
    count += 1
    patches[start] = count
    let head = 0
    let tail = 0
    queue[tail++] = start
    // Written out for the four neighbours, with no function made per anchor: it floods the whole ground of every
    // body a tick routes.
    while (head < tail) {
      const index = queue[head++] as number
      const x = index % width
      const y = (index - x) / width
      let next = index - width
      if (y > 0 && open[next] === 1 && patches[next] === 0) {
        patches[next] = count
        queue[tail++] = next
      }
      next = index + 1
      if (x < width - 1 && open[next] === 1 && patches[next] === 0) {
        patches[next] = count
        queue[tail++] = next
      }
      next = index + width
      if (y < height - 1 && open[next] === 1 && patches[next] === 0) {
        patches[next] = count
        queue[tail++] = next
      }
      next = index - 1
      if (x > 0 && open[next] === 1 && patches[next] === 0) {
        patches[next] = count
        queue[tail++] = next
      }
    }
  }
  return patches
}
