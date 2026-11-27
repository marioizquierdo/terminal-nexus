// Army groups (movement.md, its words; the glossary's "army group"). The owner, 2026-11-25: "Army is the whole set of
// units, Army group is a cluster of units that can fight together. We already defined something similar during the
// skirmish milestone, in order to report the results of a battle round [...] I don't want to make a new definition, we
// should use the same one."
//
// **Who is in one**: every unit of a side that fights (an attack, or a place in the formation: the bomber), on the
// ground or in the air, its Commander included, and every building of its that shoots. A worker and a building that
// only trains are in none, so a Barracks never joins two groups. **How they chain**: two members within
// `ARMY_GROUP_REACH` of each other (the battlefield's distance, body to body, a row counting two columns) are in one
// army group, and so is everyone within reach of either, on and on. The reach is the engagement's
// (`src/battle/reading/engagements.ts`), so the round's report and the troops' aiming share one rule. **A side's Nexus
// is always an army group of its own** and chains nobody. **Its centre** is its Commander when she is in it, else the
// member nearest its middle.
//
// **Front and back** are toward and away from an army group's **nearest enemy army group**: the one with a member
// nearest one of its own (the smallest gap, body to body); a lone building that shoots is one.
//
// Worked out every tick from the positions the tick began with (the owner chose every tick: it adds nothing to the
// battle state, and a save resumed mid-second plays the same), once and only when something asks. Whole numbers and
// ordinal order within a side; a tie between two sides' choices never arises, since each side reads its own groups.
//
// **Arriving and forming up** (the owner, 2026-11-26, F338: "Units should know when their group already arrived at the
// banner, and change into formation"): an army group has **arrived** when its centre is within `ARMY_GROUP_REACH` of its
// side's rally point and it is not **engaged**: none of its members has an enemy in its vision or stands where an
// enemy's attack reaches it (a mortar shells from beyond sight). An engaged group holds where it stands, as before. Then each of its units walks to its slot in the
// army group formation (`formation.ts`): the front rank on the rally point's middle, the ranks across the line toward
// the enemy army group nearest the rally point (`nearestEnemyToArea`: measured from the rally point, which stands still,
// so the troops' own steps never swing the ranks between two enemies about as far off), rounded to a quarter
// (`quarterLine`), so the ranks hold still while that enemy moves and are laid out again only when a member joins or
// leaves or the enemy is in another quarter.

import type { ContentDef } from "../../content/types.ts"
import { formationRank } from "../../content/types.ts"
import { footprintBox, footprintCentre, footprintDistance, tilesOf } from "../geometry/coords.ts"
import { ringOffsets } from "../geometry/reach.ts"
import type { Coord, Footprint } from "../geometry/types.ts"
import { TERRAIN } from "../geometry/types.ts"
import type { PlayerId, TargetArea } from "../state/types.ts"
import type { Line, Ranked } from "./formation.ts"
import { formationPlaces, forwardOf as forwardOfLine, forwardOfHalf, lineAcross, middleOf, quarterLine } from "./formation.ts"
import type { Actor, TickContext } from "./shared.ts"
import { inAttackRange, within } from "./shared.ts"
import { visionOf } from "./target.ts"

/** How near two members of a side must stand to be of one army group, in tiles (a row counting two): an engagement's
 *  reach, the one rule the round's report and the troops' aiming share. */
export const ARMY_GROUP_REACH = 5

/** How far round its place in the ranks a slot is looked for, when the place itself is rock or a building. */
const SLOT_RADIUS = 12

/** Anything with a body on the battlefield, as army groups read it. */
export type Body = Readonly<{ ordinal: number; player: PlayerId; anchor: Coord; definition: ContentDef }>

export type ArmyGroup<T extends Body = Body> = Readonly<{
  player: PlayerId
  /** Its members, in ordinal order. */
  members: readonly T[]
  /** Its Commander when she is in it, else the member nearest its middle. */
  centre: T
  /** Whether it is its side's Nexus, an army group of its own. */
  nexus: boolean
}>

/** Whether a body of this content is in an army group: `"nexus"` for a side's Nexus (a group of its own), `"member"`
 *  for a unit that fights (an attack, or a place in the formation) or a building that shoots, else `null`. */
export function armyGroupRole(definition: ContentDef): "nexus" | "member" | null {
  if (definition.nexus === true) return "nexus"
  if (definition.layer === "obstacles") return definition.attack !== undefined ? "member" : null
  if (definition.movementRate === undefined || definition.behavior === "flee") return null
  return definition.attack !== undefined || formationRank(definition) !== null ? "member" : null
}

/** The battlefield's distance between two points in half tiles, doubled: a row counts two columns. */
const halfDistance = (a: Coord, b: Coord): number => Math.abs(a.x - b.x) + 2 * Math.abs(a.y - b.y)

/**
 * **Every army group on the battlefield**: the members of each side chained within `ARMY_GROUP_REACH`, each Nexus a
 * group of its own. Sides in the order given, each side's groups by their lowest ordinal.
 */
export function armyGroupsOf<T extends Body>(bodies: readonly T[]): ArmyGroup<T>[] {
  const groups: ArmyGroup<T>[] = []
  const members = bodies.filter((body) => armyGroupRole(body.definition) === "member").sort((a, b) => a.ordinal - b.ordinal)
  for (const body of bodies) if (armyGroupRole(body.definition) === "nexus") groups.push({ player: body.player, members: [body], centre: body, nexus: true })
  // Chained by a union of near pairs: bodies sorted by their left edge, so a pair further apart across than the reach
  // ends the look.
  const parent = members.map((_, index) => index)
  const root = (index: number): number => {
    let at = index
    while (parent[at] !== at) at = parent[at] as number
    let walk = index
    while (parent[walk] !== at) {
      const next = parent[walk] as number
      parent[walk] = at
      walk = next
    }
    return at
  }
  const boxes = members.map((body) => footprintBox(body.anchor, body.definition.footprint))
  const byLeft = members.map((_, index) => index).sort((a, b) => (boxes[a]?.left ?? 0) - (boxes[b]?.left ?? 0) || a - b)
  for (let i = 0; i < byLeft.length; i += 1) {
    const first = byLeft[i] as number
    const a = members[first] as T
    for (let j = i + 1; j < byLeft.length; j += 1) {
      const second = byLeft[j] as number
      if ((boxes[second]?.left ?? 0) - (boxes[first]?.right ?? 0) > ARMY_GROUP_REACH) break
      const b = members[second] as T
      if (a.player !== b.player) continue
      if (footprintDistance(a.anchor, a.definition.footprint, b.anchor, b.definition.footprint) > ARMY_GROUP_REACH) continue
      const ra = root(first)
      const rb = root(second)
      if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb)
    }
  }
  const chained = new Map<number, T[]>()
  members.forEach((body, index) => {
    const at = root(index)
    const list = chained.get(at)
    if (list === undefined) chained.set(at, [body])
    else list.push(body)
  })
  for (const list of [...chained.values()].sort((a, b) => (a[0] as T).ordinal - (b[0] as T).ordinal)) {
    groups.push({ player: (list[0] as T).player, members: list, centre: centreOf(list), nexus: false })
  }
  return groups
}

/** An army group's centre: its Commander when she is in it, else the member nearest the middle of all of them (the
 *  lowest ordinal of two as near). */
function centreOf<T extends Body>(members: readonly T[]): T {
  const commander = members.find((body) => body.definition.commander === true)
  if (commander !== undefined) return commander
  const middles = members.map((body) => middleOf(body.anchor, body.definition.footprint))
  // The mean of the middles, scaled by the count so it stays whole.
  const sum = middles.reduce((total, middle) => ({ x: total.x + middle.x, y: total.y + middle.y }), { x: 0, y: 0 })
  let best = members[0] as T
  let bestDistance = Number.POSITIVE_INFINITY
  members.forEach((body, index) => {
    const middle = middles[index] as Coord
    const distance = halfDistance({ x: middle.x * members.length, y: middle.y * members.length }, sum)
    if (distance < bestDistance) {
      best = body
      bestDistance = distance
    }
  })
  return best
}

/** The middle of an army group's centre, in half tiles. */
export function centreMiddle(group: ArmyGroup): Coord {
  return middleOf(group.centre.anchor, group.centre.definition.footprint)
}

/** The gap between two army groups: the battlefield's distance between their nearest two members, body to body. */
export function gapBetween(a: ArmyGroup, b: ArmyGroup): number {
  let best = Number.POSITIVE_INFINITY
  for (const one of a.members) {
    for (const other of b.members) {
      // Cheap first: across alone already further than the best found.
      if (Math.abs(one.anchor.x - other.anchor.x) - 4 > best) continue
      best = Math.min(best, footprintDistance(one.anchor, one.definition.footprint, other.anchor, other.definition.footprint))
    }
  }
  return best
}

/** **The nearest enemy army group** of `group` among `groups`: the smallest gap, body to body (`gapBetween`); of two as
 *  near, the one whose centre is nearer; then the one listed first. `null` with no enemy army group. */
export function nearestEnemyGroup<T extends Body>(group: ArmyGroup<T>, groups: readonly ArmyGroup<T>[]): ArmyGroup<T> | null {
  let best: ArmyGroup<T> | null = null
  let bestGap = Number.POSITIVE_INFINITY
  let bestCentre = Number.POSITIVE_INFINITY
  const from = centreMiddle(group)
  const box = boxOf(group)
  for (const other of groups) {
    if (other.player === group.player) continue
    // Cheap first: the gap between their boxes is never more than the gap between their bodies.
    if (boxGap(box, boxOf(other)) > bestGap) continue
    const gap = gapBetween(group, other)
    const centre = halfDistance(from, centreMiddle(other))
    if (gap < bestGap || (gap === bestGap && centre < bestCentre)) {
      best = other
      bestGap = gap
      bestCentre = centre
    }
  }
  return best
}

type Box = Readonly<{ left: number; right: number; top: number; bottom: number }>
const boxes = new WeakMap<ArmyGroup, Box>()

/** The box round every member of a group, worked out once. */
function boxOf(group: ArmyGroup): Box {
  let box = boxes.get(group)
  if (box === undefined) {
    let left = Number.POSITIVE_INFINITY
    let right = Number.NEGATIVE_INFINITY
    let top = Number.POSITIVE_INFINITY
    let bottom = Number.NEGATIVE_INFINITY
    for (const member of group.members) {
      const each = footprintBox(member.anchor, member.definition.footprint)
      left = Math.min(left, each.left)
      right = Math.max(right, each.right)
      top = Math.min(top, each.top)
      bottom = Math.max(bottom, each.bottom)
    }
    box = { left, right, top, bottom }
    boxes.set(group, box)
  }
  return box
}

/** The battlefield's distance between two boxes, a row counting two columns: 0 when they overlap. */
function boxGap(a: Box, b: Box): number {
  return Math.max(0, b.left - a.right, a.left - b.right) + 2 * Math.max(0, b.top - a.bottom, a.top - b.bottom)
}

/** The enemy army group nearest a side's rally point: the smallest distance from the area to one of its members' bodies
 *  (`distanceToArea`); of two as near, the one whose centre is nearer the area's middle; then the one listed first.
 *  What an army group that has arrived faces. `null` with no enemy army group. */
export function nearestEnemyToArea<T extends Body>(player: PlayerId, area: TargetArea, groups: readonly ArmyGroup<T>[]): ArmyGroup<T> | null {
  const middle = areaMiddle(area)
  let best: ArmyGroup<T> | null = null
  let bestGap = Number.POSITIVE_INFINITY
  let bestCentre = Number.POSITIVE_INFINITY
  for (const other of groups) {
    if (other.player === player) continue
    let gap = Number.POSITIVE_INFINITY
    for (const member of other.members) gap = Math.min(gap, distanceToArea(member.anchor, member.definition.footprint, area))
    const centre = halfDistance(middle, centreMiddle(other))
    if (gap < bestGap || (gap === bestGap && centre < bestCentre)) {
      best = other
      bestGap = gap
      bestCentre = centre
    }
  }
  return best
}

/** The middle of a rally point's area, in half tiles. */
export function areaMiddle(area: TargetArea): Coord {
  return { x: 2 * area.x + area.width - 1, y: 2 * area.y + area.height - 1 }
}

/** How far a body is from an area, by the battlefield's distance: 0 standing in it. */
export function distanceToArea(anchor: Coord, footprint: Footprint, area: TargetArea): number {
  let best = Number.POSITIVE_INFINITY
  for (const tile of tilesOf(anchor, footprint)) {
    const dx = Math.max(area.x - tile.x, 0, tile.x - (area.x + area.width - 1))
    const dy = Math.max(area.y - tile.y, 0, tile.y - (area.y + area.height - 1))
    best = Math.min(best, dx + 2 * dy)
  }
  return best
}

/**
 * The tick's army groups (see the head of this file): built once, the first time a phase asks
 * (`armyGroupsFor`), from the actors standing as the tick began. Who is in which group, each group's nearest enemy
 * army group and how far forward a unit stands toward it, and — for an army group that has arrived at its rally point —
 * each of its units' slots.
 */
export class TickArmyGroups {
  readonly groups: readonly ArmyGroup<Actor>[]
  private readonly context: TickContext
  private readonly byOrdinal = new Map<number, ArmyGroup<Actor>>()
  private readonly nearest = new Map<ArmyGroup<Actor>, ArmyGroup<Actor> | null>()
  private readonly slots = new Map<ArmyGroup<Actor>, ReadonlyMap<number, Coord>>()
  private readonly arrivals = new Map<ArmyGroup<Actor>, boolean>()
  private readonly lines = new Map<ArmyGroup<Actor>, Line | null>()

  constructor(context: TickContext) {
    this.context = context
    this.groups = armyGroupsOf(context.actors.filter((actor) => !actor.pendingDead))
    for (const group of this.groups) for (const member of group.members) this.byOrdinal.set(member.ordinal, group)
  }

  /** The army group `actor` is in, or `undefined` for one in none (a worker, a building that only trains). */
  groupOf(actor: Actor): ArmyGroup<Actor> | undefined {
    return this.byOrdinal.get(actor.ordinal)
  }

  /** `group`'s nearest enemy army group (`nearestEnemyGroup`), worked out once. */
  enemyOf(group: ArmyGroup<Actor>): ArmyGroup<Actor> | null {
    if (!this.nearest.has(group)) this.nearest.set(group, nearestEnemyGroup(group, this.groups))
    return this.nearest.get(group) ?? null
  }

  /**
   * How far forward `actor` stands in its army group, toward that group's nearest enemy army group: larger is nearer
   * it, in half tiles. Along the line from the group's centre to the enemy group's centre rounded to a quarter
   * (`quarterLine`), as its formation's ranks stand: on a line running east, one column further east is ahead and a row
   * up or down is level. `null` for a unit in no group, or a group with no enemy.
   */
  forwardOf(actor: Actor): number | null {
    const group = this.groupOf(actor)
    if (group === undefined) return null
    let line = this.lines.get(group)
    if (line === undefined) {
      const enemy = this.enemyOf(group)
      line = enemy === null ? null : quarterLine(centreMiddle(group), centreMiddle(enemy))
      this.lines.set(group, line)
    }
    if (line === null) return null
    return forwardOfLine(line, middleOf(actor.anchor, actor.definition.footprint))
  }

  /** Whether `group` is engaged: a member has an enemy (a unit or a building) within its vision, or stands where an
   *  enemy's attack reaches it (a mortar's shells come from beyond sight). Read from where everyone stands. */
  engaged(group: ArmyGroup<Actor>): boolean {
    for (const member of group.members) {
      if (member.definition.layer === "obstacles") continue
      const vision = visionOf(member.definition)
      for (const other of this.context.actors) {
        if (other.player === member.player || other.pendingDead) continue
        const attack = other.definition.attack
        const reach = Math.max(vision, attack?.range ?? 0)
        // Cheap first: two bodies further apart across than either reach are neither.
        if (Math.abs(other.anchor.x - member.anchor.x) > reach + 8) continue
        if (within(member, other, vision)) return true
        if (attack !== undefined && inAttackRange(other, member, attack)) return true
      }
    }
    return false
  }

  /** Whether `group` has arrived at its side's rally point: its centre within `ARMY_GROUP_REACH` of it and no member
   *  with an enemy in its vision. A Nexus never arrives; a side with no rally point has none to arrive at. */
  arrived(group: ArmyGroup<Actor>): boolean {
    let known = this.arrivals.get(group)
    if (known === undefined) {
      known = this.arrivedNow(group)
      this.arrivals.set(group, known)
    }
    return known
  }

  private arrivedNow(group: ArmyGroup<Actor>): boolean {
    if (group.nexus) return false
    const area = this.context.targets[group.player]
    if (area === undefined) return false
    if (distanceToArea(group.centre.anchor, group.centre.definition.footprint, area) > ARMY_GROUP_REACH) return false
    return !this.engaged(group)
  }

  /**
   * The anchor `actor` should stand on in its army group's formation, or `null` when its group has not arrived (or
   * it has no slot: a building, a group with no enemy to face). Every unit of an arrived group gets one: the ranks of
   * `formationPlaces`, front rank on the rally point's middle, facing the nearest enemy army group by a quarter; each
   * place moved to the nearest tile its body may stand on (no rock for a ground body, no building, no other slot).
   */
  slotOf(actor: Actor): Coord | null {
    const group = this.groupOf(actor)
    if (group === undefined || !this.arrived(group)) return null
    let slots = this.slots.get(group)
    if (slots === undefined) {
      slots = this.layOut(group)
      this.slots.set(group, slots)
    }
    return slots.get(actor.ordinal) ?? null
  }

  private layOut(group: ArmyGroup<Actor>): ReadonlyMap<number, Coord> {
    const slots = new Map<number, Coord>()
    const area = this.context.targets[group.player]
    if (area === undefined) return slots
    // Faced from the rally point, which stands still, not from the members, who are walking to their slots: measured from
    // them, two enemy groups about as far off swap places as the ranks form, and the ranks would swing between them.
    const enemy = nearestEnemyToArea(group.player, area, this.groups)
    if (enemy === null) return slots
    const rally = areaMiddle(area)
    const line = quarterLine(rally, centreMiddle(enemy))
    if (line === null) return slots
    const front = rallyFront(line, area, (tile) => this.context.index.occupantAt("obstacles", tile) !== null)
    const across = lineAcross(line, forwardOfHalf(line, rally))
    const units = group.members.filter((member) => member.definition.layer !== "obstacles" && member.definition.movementRate !== undefined)
    const ranked: Ranked<Actor>[] = units.map((member) => ({ member, ordinal: member.ordinal, definition: member.definition, here: centreTileOf(member.anchor, member.definition.footprint) }))
    const { width, height, tiles } = this.context.index.terrain
    const taken = new Set<number>()
    for (const place of formationPlaces(ranked, line, front, across)) {
      const body = place.member.definition.footprint
      const air = place.member.definition.layer === "air"
      const centre = footprintCentre(body)
      const fits = (anchor: Coord): boolean =>
        tilesOf(anchor, body).every((tile) => {
          if (tile.x < 0 || tile.y < 0 || tile.x >= width || tile.y >= height) return false
          const key = tile.y * width + tile.x
          if (taken.has(key)) return false
          if (!air && TERRAIN[tiles[key] as keyof typeof TERRAIN].impassable) return false
          return air || this.context.index.occupantAt("obstacles", tile) === null
        })
      let slot: Coord | null = null
      for (let distance = 0; distance <= SLOT_RADIUS && slot === null; distance += 1) {
        for (const offset of ringOffsets(distance)) {
          const anchor = { x: place.tile.x + offset.x - centre.x, y: place.tile.y + offset.y - centre.y }
          if (fits(anchor)) {
            slot = anchor
            break
          }
        }
      }
      if (slot === null) continue
      for (const tile of tilesOf(slot, body)) taken.add(tile.y * width + tile.x)
      slots.set(place.member.ordinal, slot)
    }
    return slots
  }
}

/**
 * Where an army group formation's front rank stands on its rally point, along `line`: the rally point's middle (of two
 * middle tiles, the one further back); or, when a building stands there (a rally point on a Nexus or another
 * building, whose area is the building and a ring of one), the area's front edge, the ring just in front of the
 * building, so the troops hold it from the side the enemy comes.
 */
export function rallyFront(line: Line, area: TargetArea, built: (tile: Coord) => boolean): number {
  const middle = forwardOfHalf(line, areaMiddle(area))
  const middleTile = { x: Math.floor((2 * area.x + area.width - 1) / 2), y: Math.floor((2 * area.y + area.height - 1) / 2) }
  if (!built(middleTile)) return middle
  return Math.max(forwardOfLine(line, { x: area.x, y: area.y }), forwardOfLine(line, { x: area.x + area.width - 1, y: area.y + area.height - 1 }))
}

/** The tile at the centre of a body anchored at `anchor`. */
function centreTileOf(anchor: Coord, footprint: Footprint): Coord {
  const centre = footprintCentre(footprint)
  return { x: anchor.x + centre.x, y: anchor.y + centre.y }
}

/** The tick's army groups, built the first time a phase asks and kept on the tick's context. */
export function armyGroupsFor(context: TickContext): TickArmyGroups {
  if (context.armyGroups === undefined) context.armyGroups = new TickArmyGroups(context)
  return context.armyGroups
}
