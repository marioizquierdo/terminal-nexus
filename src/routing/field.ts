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

/** The cost of a settled anchor, from what `DistanceField.distance` holds for it (`-1 - cost`). */
const settledCost = (stored: number): number => -1 - stored

/** A goal anchor that starts at a cost of its own rather than at nothing: what a flight map is built from
 *  (`TickRoutes.safetyOf`). A whole number, 0 or more. */
export type Seed = Readonly<{ anchor: Coord; cost: number }>

export class DistanceField {
  readonly ground: Ground
  private readonly weights: Uint8Array | null
  /**
   * Each anchor's walking cost: `FAR` until a way reaches it, the cost of the best way found so far while it waits,
   * and, once it is settled and that cost is exact, `-1 - cost`: negative, so one array says both what is known and
   * whether it is final (`settledCost`). One typed array rather than one for the costs and one for what is settled:
   * a tick builds dozens of fields, and making a typed array costs more than filling one.
   */
  private readonly distance: Int32Array
  /** The bucket queue: `head[d]` is the last entry pushed at distance `d` (-1 for none), a plain array grown as the
   *  search goes further; and the entries, two numbers each in one typed array, doubled when full: the anchor, then
   *  the entry pushed at that distance before it. Two arrays to make where there were four: on Node a typed array
   *  costs a few microseconds to make, and a tick makes dozens of fields that each settle only hundreds of anchors. */
  private readonly head: number[] = []
  private entry: Int32Array = new Int32Array(512)
  private entries = 0
  private cursor = 0
  private remaining = 0
  /** How many anchors have been settled so far: what the field has cost. */
  settledCount = 0
  /** Which patch of the ground each anchor is on, when given (`patches`), and the patches its goals are on: an anchor
   *  on no goal's patch is unreachable, said at once rather than found by working out the whole of its own. */
  private readonly patches: Int32Array | null
  private readonly goalPatches: Set<number> | null

  /**
   * A field toward `goals` (anchors the body may stand on; others are ignored) over `ground`, each starting at nothing
   * or at a cost of its own (`Seed`). `weights`, when given, is what stepping onto each anchor costs per column of the
   * step, row-major like the ground; absent, one everywhere. `patches`, when given, labels each anchor with the patch
   * of the ground it is on — two anchors share one only when each can be walked to from the other — so an anchor that
   * cannot reach any goal is answered at once.
   */
  constructor(ground: Ground, goals: readonly (Coord | Seed)[], weights?: Uint8Array, patches?: Int32Array) {
    this.ground = ground
    this.weights = weights ?? null
    this.patches = patches ?? null
    this.goalPatches = patches === undefined ? null : new Set()
    this.distance = new Int32Array(ground.width * ground.height).fill(FAR)
    for (const entry of goals) {
      const goal = "anchor" in entry ? entry.anchor : entry
      const cost = "anchor" in entry ? entry.cost : 0
      if (goal.x < 0 || goal.y < 0 || goal.x >= ground.width || goal.y >= ground.height) continue
      const index = goal.y * ground.width + goal.x
      if (ground.open[index] !== 1 || cost >= (this.distance[index] as number)) continue
      this.distance[index] = cost
      this.push(index, cost)
      this.goalPatches?.add(patches?.[index] as number)
    }
  }

  /** Whether the field has a goal at all: an empty one cannot be reached from anywhere. */
  get hasGoal(): boolean {
    return this.settledCount > 0 || this.remaining > 0
  }

  private push(index: number, at: number): void {
    while (this.head.length <= at) this.head.push(-1)
    if (2 * this.entries === this.entry.length) {
      const grown = new Int32Array(this.entry.length * 2)
      grown.set(this.entry)
      this.entry = grown
    }
    const entry = this.entries
    this.entries += 1
    this.entry[2 * entry] = index
    this.entry[2 * entry + 1] = this.head[at] as number
    this.head[at] = entry
    this.remaining += 1
  }

  /** Settles the next nearest anchor, and returns it, or -1 once nothing is left. */
  private settleNext(): number {
    while (this.remaining > 0) {
      const entry = this.head[this.cursor] ?? -1
      if (entry === -1) {
        this.cursor += 1
        continue
      }
      this.head[this.cursor] = this.entry[2 * entry + 1] as number
      const index = this.entry[2 * entry] as number
      this.remaining -= 1
      // An entry left behind when a shorter way was found later, or for an anchor already settled (its cost
      // negative), is passed over.
      if (this.distance[index] !== this.cursor) continue
      this.distance[index] = -1 - this.cursor
      this.settledCount += 1
      this.relaxAround(index, this.cursor)
      return index
    }
    return -1
  }

  /** From an anchor settled at `here`, offers each neighbour that may step onto it the way through it: a unit at the
   *  neighbour steps onto this anchor, and the step costs what stepping here costs. Written out for the four
   *  neighbours, as it runs for every anchor a field settles. */
  private relaxAround(index: number, here: number): void {
    const { width, height } = this.ground
    const x = index % width
    const y = (index - x) / width
    const weight = this.weights === null ? 1 : (this.weights[index] as number)
    const across = here + weight
    const down = here + ROW_DISTANCE * weight
    if (y > 0) this.offer(index - width, down)
    if (x < width - 1) this.offer(index + 1, across)
    if (y < height - 1) this.offer(index + width, down)
    if (x > 0) this.offer(index - 1, across)
  }

  /** Offers `next` a way costing `through`, taken when it is shorter than the best found. A settled anchor's cost is
   *  negative, so no way is ever shorter, and it is left as it is without asking. */
  private offer(next: number, through: number): void {
    if (this.ground.open[next] !== 1 || through >= (this.distance[next] as number)) return
    this.distance[next] = through
    this.push(next, through)
  }

  /** The walking cost from `anchor` to the nearest goal, or `UNREACHABLE`. An anchor the body may not stand on is
   *  unreachable. */
  distanceAt(anchor: Coord): number {
    return this.distanceWithin(anchor, UNREACHABLE)
  }

  /**
   * The walking cost from `anchor` to the nearest goal when it is `limit` or less; `UNREACHABLE` when it is more, or
   * when there is no way at all. For a caller that only wants to know whether a walk beats one it already has
   * (`chooseByRoute`, `src/pulse/perception.ts`): the search stops once everything still unsettled is further than
   * `limit`, rather than going on to `anchor`. Whatever it settled stays settled and exact for the next question.
   */
  distanceWithin(anchor: Coord, limit: number): number {
    const { width, height } = this.ground
    if (anchor.x < 0 || anchor.y < 0 || anchor.x >= width || anchor.y >= height) return UNREACHABLE
    const index = anchor.y * width + anchor.x
    if (this.ground.open[index] !== 1) return UNREACHABLE
    if (this.goalPatches !== null && !this.goalPatches.has(this.patches?.[index] as number)) return UNREACHABLE
    while ((this.distance[index] as number) >= 0) {
      // Every anchor still unsettled is at least `cursor` away: once that is past the limit, so is this one.
      if (this.cursor > limit) return UNREACHABLE
      if (this.settleNext() === -1) return UNREACHABLE
    }
    const distance = settledCost(this.distance[index] as number)
    return distance <= limit ? distance : UNREACHABLE
  }

  /**
   * Whether `anchor` can walk to a goal at all. With the ground's patches given, said at once, without searching: an
   * anchor reaches a goal exactly when one is on its own patch. Without them, worked out as `distanceAt` does.
   */
  reaches(anchor: Coord): boolean {
    const { width, height } = this.ground
    if (this.goalPatches === null || anchor.x < 0 || anchor.y < 0 || anchor.x >= width || anchor.y >= height) return this.distanceAt(anchor) !== UNREACHABLE
    const index = anchor.y * width + anchor.x
    return this.ground.open[index] === 1 && this.goalPatches.has(this.patches?.[index] as number)
  }

  /** What stepping onto `anchor` costs per column of the step. */
  weightAt(anchor: Coord): number {
    return this.weights === null ? 1 : (this.weights[anchor.y * this.ground.width + anchor.x] ?? 1)
  }
}
