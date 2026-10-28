// The march (pulse.md, routes; movement.md, the three states and troop formation): how an army walks for its side's
// goal, sorting itself into its formation on the way. The owner, 2026-10-27: "we should explain and implement this as
// states: march (exploring and walking), in battle or retreating", and "Let's define Formation priority starting from 3
// formation types: flankers, melee, and ranged. When same type, pick priority by range, and then by class ... The
// formation happens passively during march state ... half speed if another unit with higher priority is in vision range."
//
// **What a unit is doing, in a word** (`MoveState`): it *marches* when it has no enemy to turn to — it walks for its
// side's goal (its target, or the enemy's Grid Nexus while that is beyond its vision), steps off its roof, makes way for
// a wave, holds at its side's target or has nothing to do; it is in *battle* when it walks to an enemy or fights one; it
// *retreats* when it runs (a worker from a threat).
//
// **The formation's one rule.** A unit that is marching, and walking, takes half speed while a marching and walking
// ally of strictly higher priority (`formationRank`, content/types.ts: flanker, melee, ranged; shorter range first;
// tank, fighter, support, siege) is within its vision (`engageRange`, for now): it accrues movement credit on every second
// tick only (`accrueSlowedCredit`, movement.ts). Nothing else: it never stops, equal priority never slows, and a unit
// in battle neither slows nor is slowed, so the ranged walk up into range at full speed behind a front that has stopped
// to fight. Because it only slows, an army sorts itself on the move and no unit can wait on itself. The Commander is a
// regular troop: she slows and is slowed by her own priority, and leads nothing.
//
// **The band.** A side's guide line runs from its own Grid Nexus to the middle of its march goal, and a marcher more than
// `BAND` columns off it takes, among its steps that are equally good, the one that brings it nearest the line
// (`bandOrder`).
//
// Worked out once a tick, after perception has set every target and before intents read them, from the state the tick
// began with: positions, targets, distances and whole numbers only, so a mirrored map marches mirrored and the answer
// is the same in whatever order units are read. Half speed is credit, never a choice of step, so routes, swaps and
// arbitration are as they were.

import { formationRank } from "../content/types.ts"
import { footprintBox, tilesOf } from "../grid/coords.ts"
import type { Coord, Footprint } from "../grid/types.ts"
import type { Ground, RankedStep } from "../routing/index.ts"
import { DistanceField, UNREACHABLE } from "../routing/index.ts"
import type { PlayerId, TargetArea } from "../state/types.ts"
import type { Purpose } from "./routes.ts"
import { purposeOf } from "./routes.ts"
import type { Actor, TickContext } from "./shared.ts"
import { onRoof, resolveTarget, within } from "./shared.ts"
import { engageRange } from "./target.ts"

/** What a unit is doing this tick, as its movement goes (movement.md, the three states): it marches when it has no enemy
 *  to turn to, is in battle when it walks to an enemy or fights one, and retreats when it runs. */
export type MoveState = "march" | "battle" | "retreat"

/** The guide line's band, each side of it: a marcher further than 6 columns off it is drawn back toward it. */
export const BAND = 6

/** Where a side marches: its target, or the enemy's Grid Nexus. */
type MarchGoal = Readonly<{ kind: "area"; area: TargetArea }> | Readonly<{ kind: "nexus"; nexus: Actor }>

/** One side's march this tick. */
type SideMarch = {
  readonly player: PlayerId
  readonly goal: MarchGoal
  /** The guide line's two ends, in half tiles (a tile's middle is twice its coordinates), or `null` with no line. */
  readonly ends: Readonly<{ from: Coord; to: Coord }> | null
  /** How far each tile is from the guide line, a row counting two columns: worked out the first time it is asked. */
  lane?: DistanceField
}

/** The march this tick, for every side: who marches and who is slowed, and each side's line. */
export class March {
  private readonly context: TickContext
  private readonly sides: ReadonlyMap<PlayerId, SideMarch>
  /** The ordinals of the units that walk for their side's goal this tick. */
  readonly marching: ReadonlySet<number>
  /** The ordinals of the marchers that walk at half speed this tick: an ally of higher priority marches in their vision. */
  readonly slowed: ReadonlySet<number>
  /** The priority (`formationRank`) of each marcher with a place in the formation, by ordinal. */
  private readonly ranks: ReadonlyMap<number, number>

  constructor(context: TickContext, sides: ReadonlyMap<PlayerId, SideMarch>, marching: ReadonlySet<number>, slowed: ReadonlySet<number>, ranks: ReadonlyMap<number, number>) {
    this.context = context
    this.sides = sides
    this.marching = marching
    this.slowed = slowed
    this.ranks = ranks
  }

  /**
   * Whether `passer` has the right of way over `blocker`, an ally of its own side that stands in its way: both march
   * with a place in the formation, and `passer` has the strictly higher priority. A slower, lower unit gives way by
   * swapping tiles, so an army sorts itself on the move (`intents.ts`) instead of queueing behind its slowest.
   */
  passes(passer: Actor, blocker: Actor): boolean {
    const first = this.ranks.get(passer.ordinal)
    const second = this.ranks.get(blocker.ordinal)
    return first !== undefined && second !== undefined && first < second && passer.player === blocker.player
  }

  /**
   * **The band**: `groups` (a marcher's steps, as `rankSteps` ranks them) with the steps that tie for the best walk
   * put in order of how near each lands to its side's guide line, nearest first, when `actor` stands more than `BAND`
   * columns off it; then by the turn, as before. Unchanged inside the band, for a unit that does not march, and on a
   * side with no line.
   */
  bandOrder(actor: Actor, groups: RankedStep[][]): RankedStep[][] {
    if (!this.marching.has(actor.ordinal)) return groups
    const side = this.sides.get(actor.player)
    if (side === undefined || side.ends === null) return groups
    const total = (candidate: RankedStep): number => candidate.cost + candidate.after
    const best = groups[0]?.[0]
    if (best === undefined) return groups
    let tiedGroups = 0
    while (tiedGroups < groups.length && total(groups[tiedGroups]?.[0] as RankedStep) === total(best)) tiedGroups += 1
    const tied = groups.slice(0, tiedGroups).flat()
    if (tied.length < 2) return groups
    const lane = this.laneOf(side)
    const offLine = (anchor: Coord): number => nearestOn(lane, anchor, actor.definition.footprint)
    if (offLine(actor.anchor) <= BAND) return groups
    const keyed = tied.map((candidate) => ({ candidate, off: offLine(candidate.to) })).sort((a, b) => a.off - b.off || a.candidate.turn - b.candidate.turn)
    const regrouped: RankedStep[][] = []
    let last: (typeof keyed)[number] | undefined
    for (const entry of keyed) {
      const group = regrouped[regrouped.length - 1]
      if (group !== undefined && last !== undefined && last.off === entry.off && last.candidate.turn === entry.candidate.turn) group.push(entry.candidate)
      else regrouped.push([entry.candidate])
      last = entry
    }
    return [...regrouped, ...groups.slice(tiedGroups)]
  }

  /** How far each tile is from `side`'s guide line, a row counting two columns: a field from the line's tiles over
   *  open ground, worked out once a tick and only when a marcher asks. */
  private laneOf(side: SideMarch): DistanceField {
    if (side.lane === undefined) {
      const { width, height } = this.context.index.grid
      const open: Ground = { width, height, open: new Uint8Array(width * height).fill(1) }
      side.lane = new DistanceField(open, side.ends === null ? [] : lineTiles(side.ends.from, side.ends.to))
    }
    return side.lane
  }
}

/** The state `actor` is in this tick, given its purpose (`purposeOf`) and its target (`resolveTarget`). */
export function moveStateOf(actor: Actor, purpose: Purpose, target: Actor | null): MoveState {
  if (purpose.kind === "flee") return "retreat"
  if (purpose.kind === "stand") return target !== null && actor.definition.behavior !== "flee" ? "battle" : "march"
  const goal = purpose.goal
  return goal.kind === "unit" && !marchesOn(actor, goal.target) ? "battle" : "march"
}

/** Whether a unit walking to `target` walks for its side's goal: the enemy's Grid Nexus, while it is beyond the
 *  unit's vision. */
function marchesOn(actor: Actor, target: Actor): boolean {
  return target.definition.nexus === true && target.player !== actor.player && !within(actor, target, engageRange(actor.definition))
}

/** Whether a purpose is a march on foot: a walk to its side's target, or to the enemy's Nexus while it is beyond sight. */
function isMarch(actor: Actor, purpose: Purpose): boolean {
  if (purpose.kind !== "walk") return false
  const goal = purpose.goal
  return goal.kind === "area" || (goal.kind === "unit" && marchesOn(actor, goal.target))
}

/**
 * The tick's march: who walks for their side's goal, and who of them is slowed. Read after perception has set every
 * target (`perception.ts`), from the state the tick began with; a side with nothing marching costs nothing.
 */
export function marchOf(context: TickContext): March {
  const marching = new Set<number>()
  const bySide = new Map<PlayerId, Actor[]>()
  for (const actor of context.actors) {
    if (actor.pendingDead || actor.definition.layer === "obstacles") continue
    if (!isMarch(actor, purposeOf(context, actor, resolveTarget(context, actor)))) continue
    marching.add(actor.ordinal)
    const side = bySide.get(actor.player)
    if (side === undefined) bySide.set(actor.player, [actor])
    else side.push(actor)
  }
  const sides = new Map<PlayerId, SideMarch>()
  const slowed = new Set<number>()
  const ranks = new Map<number, number>()
  for (const [player, marchers] of bySide) {
    const side = sideMarchOf(context, player)
    if (side === null) continue
    sides.set(player, side)
    for (const ordinal of slowedAmong(context, marchers, ranks)) slowed.add(ordinal)
  }
  return new March(context, sides, marching, slowed, ranks)
}

/** One side's march goal and guide line, or `null` when it has nowhere to march to. */
function sideMarchOf(context: TickContext, player: PlayerId): SideMarch | null {
  const area = context.targets[player]
  const nexus = area === undefined ? context.actors.find((other) => other.player !== player && !other.pendingDead && other.definition.nexus === true) : undefined
  const goal: MarchGoal | null = area !== undefined ? { kind: "area", area } : nexus !== undefined ? { kind: "nexus", nexus } : null
  if (goal === null) return null
  const to = goal.kind === "area" ? { x: 2 * goal.area.x + goal.area.width - 1, y: 2 * goal.area.y + goal.area.height - 1 } : middleOf(goal.nexus)
  // The line starts at the side's own Grid Nexus: the Commander is a regular troop and leads nothing.
  const home = context.actors.find((other) => other.player === player && !other.pendingDead && other.definition.nexus === true)
  return { player, goal, ends: home === undefined ? null : { from: middleOf(home), to } }
}

/** The middle of an actor's body, in half tiles: twice its coordinates for a tile, between two tiles for an even
 *  width. */
function middleOf(actor: Actor): Coord {
  const box = footprintBox(actor.anchor, actor.definition.footprint)
  return { x: box.left + box.right, y: box.top + box.bottom }
}

/** The least of `field` over the tiles of a body anchored at `anchor`: the same for a body and its mirror. */
function nearestOn(field: DistanceField, anchor: Coord, body: Footprint): number {
  let best = UNREACHABLE
  for (const tile of tilesOf(anchor, body)) best = Math.min(best, field.distanceAt(tile))
  return best
}

/**
 * Which of a side's marchers walk at half speed this tick: one with a place in the formation (`formationRank`: not a
 * flyer, not a unit with no attack, not one still on its own roof, which steps off first) while a marching ally of strictly
 * higher priority stands within its vision (`engageRange`, measured as range is: a row counting two columns). Each
 * against the positions the tick began with. `ranks` is given each placed marcher's priority.
 */
function slowedAmong(context: TickContext, marchers: readonly Actor[], ranks: Map<number, number>): number[] {
  type Member = Readonly<{ actor: Actor; rank: number; vision: number }>
  const members: Member[] = []
  for (const actor of marchers) {
    const rank = formationRank(actor.definition)
    // A unit still on its own roof keeps no place yet: it steps off first, so the building has room for the next.
    if (rank === null || onRoof(context, actor)) continue
    members.push({ actor, rank, vision: engageRange(actor.definition) })
    ranks.set(actor.ordinal, rank)
  }
  if (members.length < 2) return []
  const first = Math.min(...members.map((member) => member.rank))
  const slowed: number[] = []
  for (const member of members) {
    if (member.rank === first) continue
    const sees = members.some(
      (ally) =>
        ally.rank < member.rank &&
        // Cheap first: two bodies far apart on the Grid are never within sight.
        Math.abs(ally.actor.anchor.x - member.actor.anchor.x) <= member.vision + 8 &&
        Math.abs(ally.actor.anchor.y - member.actor.anchor.y) <= member.vision / 2 + 8 &&
        within(member.actor, ally.actor, member.vision),
    )
    if (sees) slowed.push(member.actor.ordinal)
  }
  return slowed
}

/**
 * The tiles of the line between two points given in half tiles (`middleOf`), as the Grid draws a straight line with
 * whole numbers: a point every half tile of the longer way, each on its nearest tile — and on both, where it falls
 * exactly between two — so a line and its mirror cover mirrored tiles, whichever end of the map it starts from.
 */
export function lineTiles(from: Coord, to: Coord): Coord[] {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1)
  const seen = new Set<string>()
  const tiles: Coord[] = []
  for (let t = 0; t <= steps; t += 1) {
    // The point, in tiles, is (from * steps + t * d) / (2 * steps) on each axis.
    for (const x of nearestWhole(from.x * steps + t * dx, 2 * steps)) {
      for (const y of nearestWhole(from.y * steps + t * dy, 2 * steps)) {
        const key = `${x},${y}`
        if (seen.has(key)) continue
        seen.add(key)
        tiles.push({ x, y })
      }
    }
  }
  return tiles
}

/** The whole numbers nearest `numerator / denominator` (`denominator` above 0): one, or both where it is exactly
 *  between two. */
function nearestWhole(numerator: number, denominator: number): number[] {
  const whole = Math.floor(numerator / denominator)
  const rest = numerator - whole * denominator
  if (2 * rest < denominator) return [whole]
  if (2 * rest > denominator) return [whole + 1]
  return [whole, whole + 1]
}
