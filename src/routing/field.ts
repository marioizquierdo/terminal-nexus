// Distance fields (milestone 16, "the parts"): from a goal outward, every anchor's walking cost to it, so a unit
// anywhere steps downhill and is on its way. One field serves every unit heading for the same goal with the same body,
// and a unit pushed, pulled or newly made reads its route from wherever it stands.
//
// The cost of a step is what the Grid charges a walk for it (`stepLength`, `src/grid/coords.ts`): one across a column,
// `ROW_DISTANCE` up or down a row — the movement credit's own proportion, so a field's distance is a walk's time in
// beats — times the weight of the ground stepped onto (one everywhere, until terrain has a cost). Whole numbers only.
//
// **Worked out only as far as it is asked.** A field is a search from its goals outward (Dijkstra's, with a bucket for
// each distance, as the costs are small whole numbers), and it stops as soon as the anchor asked about is settled,
// keeping its frontier for the next question. An anchor's distance is exact whenever it is answered, and the same
// whichever anchor was asked first: the order of a search changes how far it got, never what it found.

import { ROW_DISTANCE } from "../grid/coords.ts"
import type { Coord } from "../grid/types.ts"
import type { Ground } from "./ground.ts"

/** The four neighbours of an anchor, as offsets, and what a step to each costs before weight. */
const NEIGHBOURS: readonly Readonly<{ dx: number; dy: number; length: number }>[] = [
  { dx: 0, dy: -1, length: ROW_DISTANCE },
  { dx: 1, dy: 0, length: 1 },
  { dx: 0, dy: 1, length: ROW_DISTANCE },
  { dx: -1, dy: 0, length: 1 },
]

export const UNREACHABLE = Number.POSITIVE_INFINITY

export class DistanceField {
  readonly ground: Ground
  private readonly weights: Uint8Array | null
  private readonly distance: Float64Array
  private readonly settled: Uint8Array
  private readonly buckets: number[][] = []
  private cursor = 0
  private remaining = 0
  /** How many anchors have been settled so far: what the field has cost. */
  settledCount = 0

  /**
   * A field toward `goals` (anchors the body may stand on; others are ignored) over `ground`. `weights`, when given,
   * is what stepping onto each anchor costs per column of the step, row-major like the ground; absent, one everywhere.
   */
  constructor(ground: Ground, goals: readonly Coord[], weights?: Uint8Array) {
    this.ground = ground
    this.weights = weights ?? null
    const size = ground.width * ground.height
    this.distance = new Float64Array(size).fill(UNREACHABLE)
    this.settled = new Uint8Array(size)
    for (const goal of goals) {
      if (goal.x < 0 || goal.y < 0 || goal.x >= ground.width || goal.y >= ground.height) continue
      const index = goal.y * ground.width + goal.x
      if (ground.open[index] !== 1 || this.distance[index] === 0) continue
      this.distance[index] = 0
      this.push(index, 0)
    }
  }

  /** Whether the field has a goal at all: an empty one cannot be reached from anywhere. */
  get hasGoal(): boolean {
    return this.settledCount > 0 || this.remaining > 0
  }

  private push(index: number, at: number): void {
    let bucket = this.buckets[at]
    if (bucket === undefined) {
      bucket = []
      this.buckets[at] = bucket
    }
    bucket.push(index)
    this.remaining += 1
  }

  /** Settles the next nearest anchor, and returns it, or -1 once nothing is left. */
  private settleNext(): number {
    while (this.remaining > 0) {
      const bucket = this.buckets[this.cursor]
      if (bucket === undefined || bucket.length === 0) {
        this.cursor += 1
        continue
      }
      const index = bucket.pop() as number
      this.remaining -= 1
      if (this.settled[index] === 1 || this.distance[index] !== this.cursor) continue
      this.settled[index] = 1
      this.settledCount += 1
      this.relaxAround(index)
      return index
    }
    return -1
  }

  /** From a settled anchor, offers each neighbour that may step onto it the way through it. */
  private relaxAround(index: number): void {
    const { width, height, open } = this.ground
    const x = index % width
    const y = (index - x) / width
    const here = this.distance[index] as number
    const weight = this.weights === null ? 1 : (this.weights[index] as number)
    for (const { dx, dy, length } of NEIGHBOURS) {
      // A unit at the neighbour steps onto this anchor: the step costs what stepping here costs.
      const nx = x - dx
      const ny = y - dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const next = ny * width + nx
      if (open[next] !== 1 || this.settled[next] === 1) continue
      const through = here + length * weight
      if (through < (this.distance[next] as number)) {
        this.distance[next] = through
        this.push(next, through)
      }
    }
  }

  /** The walking cost from `anchor` to the nearest goal, or `UNREACHABLE`. An anchor the body may not stand on is
   *  unreachable. */
  distanceAt(anchor: Coord): number {
    const { width, height } = this.ground
    if (anchor.x < 0 || anchor.y < 0 || anchor.x >= width || anchor.y >= height) return UNREACHABLE
    const index = anchor.y * width + anchor.x
    if (this.ground.open[index] !== 1) return UNREACHABLE
    while (this.settled[index] !== 1) {
      if (this.settleNext() === -1) return UNREACHABLE
    }
    return this.distance[index] as number
  }

  /** What stepping onto `anchor` costs per column of the step. */
  weightAt(anchor: Coord): number {
    return this.weights === null ? 1 : (this.weights[anchor.y * this.ground.width + anchor.x] ?? 1)
  }
}
