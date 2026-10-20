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

export const UNREACHABLE = Number.POSITIVE_INFINITY

/** What `distance` holds for an anchor no way has reached yet: beyond any walk on a Grid. */
const FAR = 0x7fffffff

/** A goal anchor that starts at a cost of its own rather than at nothing: what a flight map is built from
 *  (`TickRoutes.safetyOf`). A whole number, 0 or more. */
export type Seed = Readonly<{ anchor: Coord; cost: number }>

export class DistanceField {
  readonly ground: Ground
  private readonly weights: Uint8Array | null
  /** Each anchor's walking cost found so far, `FAR` until one is: whole numbers, so a typed array of them. */
  private readonly distance: Int32Array
  private readonly settled: Uint8Array
  /** The bucket queue, flat: `head[d]` is the last entry pushed at distance `d` (-1 for none), and each entry holds
   *  its anchor and the entry pushed at that distance before it. Typed arrays, as a field settles thousands. */
  private head: Int32Array = new Int32Array(64).fill(-1)
  private entryAnchor: Int32Array
  private entryNext: Int32Array
  private entries = 0
  private cursor = 0
  private remaining = 0
  /** How many anchors have been settled so far: what the field has cost. */
  settledCount = 0

  /**
   * A field toward `goals` (anchors the body may stand on; others are ignored) over `ground`, each starting at nothing
   * or at a cost of its own (`Seed`). `weights`, when given, is what stepping onto each anchor costs per column of the
   * step, row-major like the ground; absent, one everywhere.
   */
  constructor(ground: Ground, goals: readonly (Coord | Seed)[], weights?: Uint8Array) {
    this.ground = ground
    this.weights = weights ?? null
    const size = ground.width * ground.height
    this.distance = new Int32Array(size).fill(FAR)
    this.settled = new Uint8Array(size)
    this.entryAnchor = new Int32Array(256)
    this.entryNext = new Int32Array(256)
    for (const entry of goals) {
      const goal = "anchor" in entry ? entry.anchor : entry
      const cost = "anchor" in entry ? entry.cost : 0
      if (goal.x < 0 || goal.y < 0 || goal.x >= ground.width || goal.y >= ground.height) continue
      const index = goal.y * ground.width + goal.x
      if (ground.open[index] !== 1 || cost >= (this.distance[index] as number)) continue
      this.distance[index] = cost
      this.push(index, cost)
    }
  }

  /** Whether the field has a goal at all: an empty one cannot be reached from anywhere. */
  get hasGoal(): boolean {
    return this.settledCount > 0 || this.remaining > 0
  }

  private push(index: number, at: number): void {
    if (at >= this.head.length) {
      const grown = new Int32Array(Math.max(at + 1, this.head.length * 2)).fill(-1)
      grown.set(this.head)
      this.head = grown
    }
    if (this.entries === this.entryAnchor.length) {
      const anchors = new Int32Array(this.entries * 2)
      anchors.set(this.entryAnchor)
      this.entryAnchor = anchors
      const nexts = new Int32Array(this.entries * 2)
      nexts.set(this.entryNext)
      this.entryNext = nexts
    }
    const entry = this.entries
    this.entries += 1
    this.entryAnchor[entry] = index
    this.entryNext[entry] = this.head[at] as number
    this.head[at] = entry
    this.remaining += 1
  }

  /** Settles the next nearest anchor, and returns it, or -1 once nothing is left. */
  private settleNext(): number {
    while (this.remaining > 0) {
      const entry = this.head[this.cursor] as number
      if (entry === -1) {
        this.cursor += 1
        continue
      }
      this.head[this.cursor] = this.entryNext[entry] as number
      const index = this.entryAnchor[entry] as number
      this.remaining -= 1
      if (this.settled[index] === 1 || this.distance[index] !== this.cursor) continue
      this.settled[index] = 1
      this.settledCount += 1
      this.relaxAround(index)
      return index
    }
    return -1
  }

  /** From a settled anchor, offers each neighbour that may step onto it the way through it: a unit at the
   *  neighbour steps onto this anchor, and the step costs what stepping here costs. Written out for the four
   *  neighbours, as it runs for every anchor a field settles. */
  private relaxAround(index: number): void {
    const { width, height } = this.ground
    const x = index % width
    const y = (index - x) / width
    const here = this.distance[index] as number
    const weight = this.weights === null ? 1 : (this.weights[index] as number)
    const across = here + weight
    const down = here + ROW_DISTANCE * weight
    if (y > 0) this.offer(index - width, down)
    if (x < width - 1) this.offer(index + 1, across)
    if (y < height - 1) this.offer(index + width, down)
    if (x > 0) this.offer(index - 1, across)
  }

  private offer(next: number, through: number): void {
    if (this.ground.open[next] !== 1 || this.settled[next] === 1 || through >= (this.distance[next] as number)) return
    this.distance[next] = through
    this.push(next, through)
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
