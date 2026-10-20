// Routing's parts, each alone (src/routing/; milestone 16, "the parts"): where a body may stand, the anchors that
// reach a goal, distance fields against a plain search on small Grids and mazes, and the choice of a step — before
// anything in a battle leans on them.

import { test } from "node:test"
import assert from "node:assert/strict"
import { footprintSteps, footprintWithin } from "../src/grid/coords.ts"
import type { Coord, Footprint, GridTerrain, TerrainId } from "../src/grid/types.ts"
import { canStand, DistanceField, goalsInside, goalsNear, groundFor, isWall, rankSteps, UNREACHABLE, wallsOf } from "../src/routing/index.ts"
import type { Ground } from "../src/routing/index.ts"
import { starterGrid } from "../src/build/maps.ts"

const ONE: Footprint = [{ x: 0, y: 0 }]
const WIDE: Footprint = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }]
const BLOCK: Footprint = [
  { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 },
  { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 },
]

/** A Grid from rows of `.` (plain) and `#` (rock). */
function gridOf(rows: readonly string[]): GridTerrain {
  const tiles: TerrainId[] = []
  for (const row of rows) for (const char of row) tiles.push(char === "#" ? "terrain.rock" : "terrain.plain")
  return { width: rows[0]?.length ?? 0, height: rows.length, tiles }
}

/** A plain search to check fields against: relax every anchor until nothing changes. Slow, and obviously right. */
function plainDistances(ground: Ground, goals: readonly Coord[], weights?: Uint8Array): number[] {
  const { width, height, open } = ground
  const distance = new Array<number>(width * height).fill(UNREACHABLE)
  for (const goal of goals) if (open[goal.y * width + goal.x] === 1) distance[goal.y * width + goal.x] = 0
  for (let changed = true; changed; ) {
    changed = false
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x
        if (open[index] !== 1) continue
        for (const [dx, dy, length] of [[0, -1, 2], [1, 0, 1], [0, 1, 2], [-1, 0, 1]] as const) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          const next = ny * width + nx
          if (open[next] !== 1) continue
          const through = (distance[next] as number) + length * (weights?.[next] ?? 1)
          if (through < (distance[index] as number)) {
            distance[index] = through
            changed = true
          }
        }
      }
    }
  }
  return distance
}

/** A small seeded stream for mazes: the same maze every run. */
function stream(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 2 ** 32
  }
}

function maze(width: number, height: number, seed: number, rockShare: number): GridTerrain {
  const next = stream(seed)
  const rows: string[] = []
  for (let y = 0; y < height; y += 1) {
    let row = ""
    for (let x = 0; x < width; x += 1) row += next() < rockShare ? "#" : "."
    rows.push(row)
  }
  return gridOf(rows)
}

// --- Ground --------------------------------------------------------------------------------------------------------

test("ground: rock and what stands still are walls, the edge is a wall, and air ignores rock", () => {
  const grid = gridOf(["....", ".#..", "...."])
  const walls = wallsOf(grid, "impassable", [{ x: 3, y: 2 }, { x: 9, y: 9 }])
  assert.equal(isWall(walls, { x: 1, y: 1 }), true)
  assert.equal(isWall(walls, { x: 3, y: 2 }), true)
  assert.equal(isWall(walls, { x: 0, y: 0 }), false)
  assert.equal(isWall(walls, { x: -1, y: 0 }), true)
  assert.equal(isWall(walls, { x: 4, y: 0 }), true)
  assert.equal(isWall(wallsOf(grid, "ignore"), { x: 1, y: 1 }), false)
})

test("ground: a body stands where every tile it covers is open, so a wide body fits a gap of its width and no narrower", () => {
  const grid = gridOf([
    ".......",
    "##...##",
    ".......",
    "###..##",
  ])
  const walls = wallsOf(grid, "impassable")
  const wide = groundFor(walls, WIDE)
  assert.equal(canStand(wide, { x: 2, y: 1 }), true, "a three-wide gap takes a three-wide body")
  assert.equal(canStand(wide, { x: 3, y: 1 }), false)
  assert.equal(canStand(wide, { x: 3, y: 3 }), false, "a two-wide gap does not")
  assert.equal(canStand(wide, { x: 5, y: 0 }), false, "a body may not hang off the Grid's edge")
  assert.equal(canStand(wide, { x: 4, y: 0 }), true)
  const block = groundFor(walls, BLOCK)
  assert.equal(canStand(block, { x: 2, y: 0 }), true, "a tall body stands on two open rows")
  assert.equal(canStand(block, { x: 2, y: 2 }), false, "and not over rock")
  const one = groundFor(walls, ONE)
  assert.equal(canStand(one, { x: 3, y: 3 }), true)
  assert.equal(canStand(one, { x: 0, y: 1 }), false)
})

// --- Goals ---------------------------------------------------------------------------------------------------------

test("goals: touching a one-tile target is the four tiles beside it; touching a 3x2 block is the ten round it", () => {
  const ground = groundFor(wallsOf(gridOf(Array(9).fill("..........")), "impassable"), ONE)
  const near = goalsNear(ground, ONE, { x: 4, y: 4 }, ONE, { kind: "touch", steps: 1 })
  assert.deepEqual(near, [{ x: 4, y: 3 }, { x: 3, y: 4 }, { x: 5, y: 4 }, { x: 4, y: 5 }])
  const block = goalsNear(ground, ONE, { x: 3, y: 3 }, BLOCK, { kind: "touch", steps: 1 })
  assert.equal(block.length, 10)
  for (const goal of block) assert.equal(footprintSteps(goal, ONE, { x: 3, y: 3 }, BLOCK), 1)
})

test("goals: within a range are the anchors range is measured to, never on the target, never under a wall", () => {
  const grid = gridOf(Array(15).fill(".".repeat(21)).map((row: string, y: number) => (y === 5 ? `${row.slice(0, 10)}#${row.slice(11)}` : row)))
  const ground = groundFor(wallsOf(grid, "impassable"), ONE)
  const target = { x: 10, y: 7 }
  const goals = goalsNear(ground, ONE, target, ONE, { kind: "within", radius: 6 })
  const expected: Coord[] = []
  for (let y = 0; y < 15; y += 1) {
    for (let x = 0; x < 21; x += 1) {
      if ((x === target.x && y === target.y) || (x === 10 && y === 5)) continue
      if (footprintWithin({ x, y }, ONE, target, ONE, 6)) expected.push({ x, y })
    }
  }
  assert.deepEqual(goals, expected)
  assert.equal(goals.some((goal) => goal.x === 10 && goal.y === 5), false)
})

test("goals: a wide body touching a target counts from any tile of its body", () => {
  const ground = groundFor(wallsOf(gridOf(Array(7).fill("...........")), "impassable"), WIDE)
  const goals = goalsNear(ground, WIDE, { x: 5, y: 3 }, ONE, { kind: "touch", steps: 1 })
  // West of it, east of it, and the three anchors above and below whose body covers its column.
  assert.deepEqual(goals, [
    { x: 3, y: 2 }, { x: 4, y: 2 }, { x: 5, y: 2 },
    { x: 2, y: 3 }, { x: 6, y: 3 },
    { x: 3, y: 4 }, { x: 4, y: 4 }, { x: 5, y: 4 },
  ])
})

test("goals: inside an area is any anchor whose body has a tile in it; a walled-off target has no goal", () => {
  const ground = groundFor(wallsOf(gridOf(Array(6).fill("........")), "impassable"), WIDE)
  const inside = goalsInside(ground, WIDE, { x: 4, y: 2, width: 2, height: 1 })
  assert.deepEqual(inside, [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 }, { x: 5, y: 2 }])
  const boxed = groundFor(wallsOf(gridOf([".....", ".###.", ".#.#.", ".###.", "....."]), "impassable"), ONE)
  assert.deepEqual(goalsNear(boxed, ONE, { x: 2, y: 2 }, ONE, { kind: "touch", steps: 1 }), [])
})

// --- Distance fields -----------------------------------------------------------------------------------------------

test("a field on open ground is the Grid's own distance: one a column, two a row", () => {
  const ground = groundFor(wallsOf(gridOf(Array(7).fill("...........")), "impassable"), ONE)
  const field = new DistanceField(ground, [{ x: 5, y: 3 }])
  assert.equal(field.distanceAt({ x: 5, y: 3 }), 0)
  assert.equal(field.distanceAt({ x: 0, y: 3 }), 5)
  assert.equal(field.distanceAt({ x: 5, y: 0 }), 6)
  assert.equal(field.distanceAt({ x: 0, y: 0 }), 11)
})

test("a field walks round a wall, and is exact on mazes whatever order it is asked in", () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const grid = maze(23, 11, seed, 0.3)
    for (const body of [ONE, WIDE]) {
      const ground = groundFor(wallsOf(grid, "impassable"), body)
      const goals = [{ x: 11, y: 5 }, { x: 2, y: 9 }].filter((goal) => canStand(ground, goal))
      const expected = plainDistances(ground, goals)
      // Asked from the far corner first, then in reading order, then backwards: always the same answers.
      for (const order of ["corner", "reading", "backwards"]) {
        const field = new DistanceField(ground, goals)
        if (order === "corner") field.distanceAt({ x: 0, y: 0 })
        const anchors: Coord[] = []
        for (let y = 0; y < 11; y += 1) for (let x = 0; x < 23; x += 1) anchors.push({ x, y })
        if (order === "backwards") anchors.reverse()
        for (const anchor of anchors) assert.equal(field.distanceAt(anchor), expected[anchor.y * 23 + anchor.x], `seed ${seed}, ${order}, at ${anchor.x},${anchor.y}`)
      }
    }
  }
})

test("a field says what cannot be reached, and a field with no goal reaches nothing", () => {
  const ground = groundFor(wallsOf(gridOf(["..#..", "..#..", "..#.."]), "impassable"), ONE)
  const field = new DistanceField(ground, [{ x: 0, y: 1 }])
  assert.equal(field.distanceAt({ x: 1, y: 2 }), 3)
  assert.equal(field.distanceAt({ x: 4, y: 1 }), UNREACHABLE)
  assert.equal(field.distanceAt({ x: 2, y: 1 }), UNREACHABLE, "a wall is never reached")
  assert.equal(field.hasGoal, true)
  const none = new DistanceField(ground, [{ x: 2, y: 0 }])
  assert.equal(none.hasGoal, false)
  assert.equal(none.distanceAt({ x: 0, y: 0 }), UNREACHABLE)
})

test("a field stops as soon as it has the answer: asking beside the goal settles a few anchors, not the Grid", () => {
  const ground = groundFor(wallsOf(gridOf(Array(40).fill(".".repeat(96))), "impassable"), ONE)
  const field = new DistanceField(ground, [{ x: 48, y: 20 }])
  assert.equal(field.distanceAt({ x: 50, y: 20 }), 2)
  assert.ok(field.settledCount < 30, `settled ${field.settledCount}`)
  assert.equal(field.distanceAt({ x: 0, y: 0 }), 48 + 40)
  assert.equal(field.distanceAt({ x: 50, y: 20 }), 2, "an answer given before is the same after")
})

test("a field charges what the ground stepped onto weighs", () => {
  const ground = groundFor(wallsOf(gridOf(["......"]), "impassable"), ONE)
  const weights = new Uint8Array([1, 1, 3, 1, 1, 1])
  const field = new DistanceField(ground, [{ x: 0, y: 0 }], weights)
  // From x=3 toward x=0: onto 2 (weight 3), onto 1, onto 0.
  assert.equal(field.distanceAt({ x: 3, y: 0 }), 5)
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5].map((x) => field.distanceAt({ x, y: 0 })),
    plainDistances(ground, [{ x: 0, y: 0 }], weights),
  )
})

// --- The choice of a step ------------------------------------------------------------------------------------------

test("a step along the shortest route ranks first, round a wall as on open ground", () => {
  const grid = gridOf([
    "...........",
    "...........",
    "..#######..",
    "...........",
  ])
  const ground = groundFor(wallsOf(grid, "impassable"), ONE)
  const field = new DistanceField(ground, [{ x: 5, y: 3 }])
  // Straight above the goal, the wall between: the way round is east or west, equally; never into the rock.
  const groups = rankSteps(field, { x: 5, y: 1 }, "s")
  const best = groups[0]
  assert.ok(best !== undefined)
  assert.deepEqual(best.map((choice) => choice.direction).sort(), ["e", "w"], "east and west are equally good, a tie for a draw")
  assert.ok(best.every((choice) => choice.downhill))
  assert.equal(groups.flat().some((choice) => choice.direction === "s"), false, "the rock is no step")
})

test("equally good steps go by the turn from the way the unit faces, and mirrored Grids rank mirrored steps", () => {
  const ground = groundFor(wallsOf(gridOf(Array(9).fill("...............")), "impassable"), ONE)
  const field = new DistanceField(ground, [{ x: 12, y: 6 }])
  // Two across and a row down are as good as each other on the screen's diagonal; facing east, east ranks first.
  const east = rankSteps(field, { x: 4, y: 2 }, "e")
  assert.equal(east[0]?.[0]?.direction, "e")
  assert.equal(east[1]?.[0]?.direction, "s")
  const mirrored = new DistanceField(ground, [{ x: 2, y: 6 }])
  const west = rankSteps(mirrored, { x: 10, y: 2 }, "w")
  assert.equal(west[0]?.[0]?.direction, "w")
  assert.equal(west[1]?.[0]?.direction, "s")
})

test("from where the field does not reach, every step onto it is downhill", () => {
  const grid = gridOf(["....", "....", "...."])
  const ground = groundFor(wallsOf(grid, "impassable", [{ x: 1, y: 1 }]), ONE)
  const field = new DistanceField(ground, [{ x: 3, y: 1 }])
  const groups = rankSteps(field, { x: 1, y: 1 }, "e")
  assert.equal(groups[0]?.[0]?.direction, "e")
  assert.ok(groups.flat().every((choice) => choice.downhill))
})

// --- What they cost ------------------------------------------------------------------------------------------------

test("a tick's worth of fields over the starter map fits well inside a frame", () => {
  const grid = starterGrid()
  const bodies = [ONE, WIDE, BLOCK]
  const run = (): number => {
    const started = performance.now()
    // As a tick does: the ground once for each body, then twelve fields over it, each worked out over the whole map —
    // more than a battle's tick asks for, and further than any asks.
    const grounds = bodies.map((body) => groundFor(wallsOf(grid, "impassable"), body))
    for (let index = 0; index < 12; index += 1) {
      const body = bodies[index % bodies.length] as Footprint
      const ground = grounds[index % bodies.length] as Ground
      const field = new DistanceField(ground, goalsNear(ground, body, { x: 70 + index, y: 20 }, BLOCK, { kind: "touch", steps: 1 }))
      for (let y = 0; y < grid.height; y += 1) for (let x = 0; x < grid.width; x += 1) field.distanceAt({ x, y })
    }
    return performance.now() - started
  }
  run()
  const samples = [run(), run(), run(), run(), run()].sort((a, b) => a - b)
  const median = samples[2] as number
  // The browser page's frame is 33 ms; a tick's routes should take a third of it at most, on a machine also running
  // the rest of the suite.
  assert.ok(median < 33 / 3, `twelve whole fields took ${median.toFixed(2)} ms`)
})
