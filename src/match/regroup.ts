// The regroup — what every survivor does between two Battle Rounds, in a campaign's mission, a duel and a run alike
// (the owner, 2026-10-26: "Keep units on the map after a fight. If they are in battle, they stop targeting, move back
// for 2 seconds, and self-arrange in formation for 6 seconds (10 seconds total)"; and, the same day, "no more sending
// troops back to their origin base anywhere": it replaced Recall, which walked every survivor home onto its roof).
// When the Nexus announces the pause, troops respect it: they disengage, step back, and form up to start again.
//
// Like Recall was, it is a pure function of the state a Battle Round ended in and the content, worked out **beside the
// kernel's tick and never inside it** — `stepTick` does not call it, no Pulse's hash moves, and nothing the player
// does in the Build Phase reaches it — so a scripted battle and a duel play the same on every machine. It returns the
// state the next round opens from and every survivor's walk, tick by tick, which the Build Phase plays over its first
// ten seconds (presentation only: the state is already where the walk ends).
//
// The rule, in the terms the state can express:
//
// - **Everything stays on the Grid.** Structures stand where they stand; a survivor walks, a step at a time at its own
//   pace (movement credit, `src/pulse/movement.ts`), downhill on a distance field (`src/routing/`), never onto rock, an
//   enemy's building or another body. Nothing attacks, trains or shoots: the kernel does not run.
// - **The step back, 2 seconds** (`STEP_BACK_TICKS`): a survivor in a fight — an enemy unit or building within
//   `FIGHT_REACH` of it — walks toward its own Grid Nexus. One not in a fight stands.
// - **The formation, 6 seconds** (`FORM_TICKS`), then **2 seconds standing formed** (`STAND_TICKS`), in which the
//   slowest still walk in. Each side forms up across its march line — from its Commander while she stands on the Grid,
//   else from its own Nexus, toward the enemy's Nexus (the guide line, movement.md) — in ranks across the line's main
//   axis, the front rank where the side's front stands after stepping back (where its first rank's worth of units
//   stands, so a straggler left forward does not pull the rest up to it): melee in front, the Commander next, the
//   short range, the long range, backliners and units with no attack behind. A side whose level names a target for it
//   (a campaign's automatic target) forms up on the line to that target instead, and one with no enemy Nexus to face
//   on the line to the Grid's middle; a side with neither a Commander nor a Nexus of its own (a mission's raid) has no
//   line, and its survivors stand where the round left them. Survivors more than `BEHIND` columns behind
//   that front (units that never left the base) form a group of their own where their own front stands. Each slot is
//   claimed on free ground (`nearestFit`), never within `KEEP_APART` of a slot the enemy claimed, and two facing fronts
//   are held `FRONT_GAP` columns apart; a slot is given to the unit whose place across the line is nearest it, so the
//   ranks form without crossing.
// - **Mirror-fair**: every tie goes by what a side faces (forward, back, north, south), never by a compass order or an
//   ordinal read in reading order; the sides claim slots and step in turns that alternate.
// - What a round's end resets, the regroup resets: every entity's transient fields (`freshEntityFields`), a structure that
//   `mends` mends, the clock, the outcome, the cooling tiles and the fire.

import type { ContentDef, ContentRegistry } from "../content/index.ts"
import { freshEntityFields, lineOf } from "../content/index.ts"
import { DIRECTIONS, footprintBox, footprintDistance, step, tilesOf } from "../grid/coords.ts"
import { tilesWithin } from "../grid/reach.ts"
import type { Coord, Direction, Footprint } from "../grid/types.ts"
import { TERRAIN } from "../grid/types.ts"
import { accrueCredit, stepCost } from "../pulse/movement.ts"
import type { DistanceField } from "../routing/index.ts"
import { DistanceField as Field, UNREACHABLE, addWall, bodyKey, goalsNear, groundFor, wallsOf } from "../routing/index.ts"
import type { EntityState, MatchState, PlayerId } from "../state/types.ts"
import { centreTile, nearestFit } from "./placement.ts"
import type { RegroupPath, RegroupResult, RegroupStep } from "./types.ts"
import { REGROUP_TICKS, STEP_BACK_TICKS } from "./types.ts"

/** A survivor with an enemy unit or building this near (the Grid's distance, a row counting two columns) is in a fight
 *  and steps back: the march's own "near" (movement.md, closing). */
export const FIGHT_REACH = 12
/** How far behind its side's front a survivor may stand and still join the formation, in columns along the line:
 *  about what a trooper walks in the 8 seconds the regroup gives it after the step back. */
export const BEHIND = 24
/** The fewest columns left clear between two fronts that face each other across the march line. */
export const FRONT_GAP = 6
/** No slot is claimed this near (the Grid's distance) a slot the enemy claimed. */
export const KEEP_APART = 4
/** The widest a rank is, in units. */
export const RANK_WIDTH = 9
/** How far apart two ranks stand along the line: one clear column (or row) between them. */
const RANK_STEP = 2
/** How far around its place a slot is looked for before the unit is left where it stands. */
const SLOT_RADIUS = 24

type Definitions = (entity: EntityState) => ContentDef

function definitionsOf(state: MatchState, registry: ContentRegistry, sides?: Readonly<Partial<Record<PlayerId, ContentRegistry>>>): Definitions {
  const definitions = new Map<number, ContentDef>()
  for (const entity of state.entities) definitions.set(entity.ordinal, (sides?.[entity.player] ?? registry).get(entity.contentId))
  return (entity) => definitions.get(entity.ordinal) as ContentDef
}

/** The state between rounds with every survivor at `anchors` (or where it stands), facing as `facing` says: every
 *  entity's transient fields fresh (a producer's waves start afresh, nobody holds a target), a structure that `mends`
 *  mended, the clock, the outcome, the cooling tiles and the fire cleared. The gameplay stream carries on. */
function settled(state: MatchState, definitionOf: Definitions, anchors: ReadonlyMap<number, Coord>, facing: ReadonlyMap<number, Direction> = new Map()): MatchState {
  const entities: EntityState[] = state.entities.map((entity) => {
    const definition = definitionOf(entity)
    return {
      ...entity,
      anchor: anchors.get(entity.ordinal) ?? entity.anchor,
      facing: facing.get(entity.ordinal) ?? entity.facing,
      ...freshEntityFields(definition),
      hp: definition.mends === undefined ? entity.hp : Math.min(definition.maxHp, entity.hp + definition.mends),
    }
  })
  const { burning: _burning, ...rest } = state
  return { ...rest, tick: 0, outcome: null, vacatedTiles: [], entities }
}

/**
 * **The round's end, settled where everyone stands**: the regroup's first frame — every survivor where the fight left
 * it, what the regroup resets reset — as a regroup in which nobody walks (`ticks` 0). What a match that is over keeps:
 * nothing regroups after its last round.
 */
export function standDown(state: MatchState, registry: ContentRegistry, sides?: Readonly<Partial<Record<PlayerId, ContentRegistry>>>): RegroupResult {
  const definitionOf = definitionsOf(state, registry, sides)
  const paths: RegroupPath[] = state.entities
    .filter((entity) => definitionOf(entity).layer !== "obstacles")
    .map((entity) => ({ ordinal: entity.ordinal, player: entity.player, contentId: entity.contentId, from: entity.anchor, to: entity.anchor, steps: [], slot: null }))
  return { state: settled(state, definitionOf, new Map()), paths, ticks: 0 }
}

/** A side's march line, as the formation reads it: its main axis, which way along it the side faces, and the line's
 *  two ends in half tiles (a tile's middle is twice its coordinates). */
type Line = Readonly<{ axis: "x" | "y"; way: 1 | -1; from: Coord; to: Coord }>

/** The middle of a body, in half tiles. */
function middleOf(anchor: Coord, footprint: Footprint): Coord {
  const box = footprintBox(anchor, footprint)
  return { x: box.left + box.right, y: box.top + box.bottom }
}

/** How far forward along `line` a tile stands: larger is nearer the enemy. */
const forwardOf = (line: Line, tile: Coord): number => (line.axis === "x" ? tile.x : tile.y) * line.way
/** Where across `line` a tile stands. */
const acrossOf = (line: Line, tile: Coord): number => (line.axis === "x" ? tile.y : tile.x)
/** The tile `forward` along and `across` the line. */
const tileOn = (line: Line, forward: number, across: number): Coord =>
  line.axis === "x" ? { x: forward * line.way, y: across } : { x: across, y: forward * line.way }

/** Where the line itself crosses the rank `forward` along it, across it, to the nearest tile. Read alike from either
 *  end of a mirrored map: the same fraction of the same rise. */
function lineAcross(line: Line, forward: number): number {
  const along = line.axis === "x" ? { from: line.from.x, to: line.to.x, at: 2 * forward * line.way } : { from: line.from.y, to: line.to.y, at: 2 * forward * line.way }
  const rise = line.axis === "x" ? { from: line.from.y, to: line.to.y } : { from: line.from.x, to: line.to.x }
  const span = along.to - along.from
  const half = span === 0 ? rise.from : rise.from + ((along.at - along.from) * (rise.to - rise.from)) / span
  return Math.floor(half / 2 + 0.5)
}

/** A side's line: from its Commander while she stands on the Grid (on the ground), else from its own Nexus, to the
 *  middle of its target when its level names one (`MatchState.targets`), else of the enemy's Nexus, else (a mission's
 *  raid has none) of the Grid, so an army with no enemy base to face forms up facing out from its own; along the axis it
 *  runs further on, a row counting two columns. `null` for a side with neither a Commander nor a Nexus on the Grid. */
function lineOfSide(state: MatchState, definitionOf: Definitions, player: PlayerId): Line | null {
  const commander = state.entities.find((entity) => entity.player === player && definitionOf(entity).commander === true && definitionOf(entity).layer !== "air")
  const own = state.entities.find((entity) => entity.player === player && definitionOf(entity).nexus === true)
  const enemy = state.entities.find((entity) => entity.player !== player && definitionOf(entity).nexus === true)
  const area = state.targets?.[player]
  const start = commander ?? own
  if (start === undefined) return null
  const from = middleOf(start.anchor, definitionOf(start).footprint)
  const to =
    area !== undefined
      ? { x: 2 * area.x + area.width - 1, y: 2 * area.y + area.height - 1 }
      : enemy !== undefined
        ? middleOf(enemy.anchor, definitionOf(enemy).footprint)
        : { x: state.grid.width - 1, y: state.grid.height - 1 }
  if (to.x === from.x && to.y === from.y) return null
  const dx = to.x - from.x
  const dy = to.y - from.y
  // A row is two columns: the line runs along x while it covers as much ground across as down.
  if (Math.abs(dx) >= 2 * Math.abs(dy)) return { axis: "x", way: dx >= 0 ? 1 : -1, from, to }
  return { axis: "y", way: dy >= 0 ? 1 : -1, from, to }
}

/** A unit's place in the formation's order: melee in front, the Commander, the short range, the long range, then
 *  backliners and units with no attack. */
function rankOrder(definition: ContentDef): number {
  if (definition.commander === true) return 1
  switch (lineOf(definition)) {
    case "melee":
      return 0
    case "short":
      return 2
    case "long":
      return 3
    case "backliner":
      return 4
    default:
      return 5
  }
}

/** How many units a rank of a group of `count` holds: about twice as many ranks across as deep, at most `RANK_WIDTH`. */
const rankWidth = (count: number): number => Math.max(1, Math.min(RANK_WIDTH, Math.ceil(Math.sqrt(2 * count))))

/** Where a group's front rank stands along its line: where its first rank's worth of units already stands — the
 *  furthest forward of them all but a few stragglers ahead, so one unit left forward does not pull the whole group
 *  back up to it. */
function frontOf(forwards: readonly number[]): number {
  const sorted = [...forwards].sort((a, b) => b - a)
  return sorted[Math.min(sorted.length, rankWidth(sorted.length)) - 1] as number
}

/** The tiles a side's direction words name: forward and back along its line, then north and south — a step order the
 *  same for either side of a mirrored map. */
function stepOrder(line: Line | null): readonly Direction[] {
  if (line === null) return DIRECTIONS
  const forward: Direction = line.axis === "x" ? (line.way === 1 ? "e" : "w") : line.way === 1 ? "s" : "n"
  const back: Direction = forward === "e" ? "w" : forward === "w" ? "e" : forward === "s" ? "n" : "s"
  const rest = DIRECTIONS.filter((direction) => direction !== forward && direction !== back)
  return [forward, back, ...rest]
}

/**
 * **The regroup.** Every survivor's walk between two Battle Rounds and the state it leaves; see the head of this file.
 * Deterministic: the same state and content give the same walks and the same state, on every machine.
 */
export function regroup(state: MatchState, registry: ContentRegistry, sides?: Readonly<Partial<Record<PlayerId, ContentRegistry>>>): RegroupResult {
  const definitionOf = definitionsOf(state, registry, sides)
  const grid = state.grid
  const key = (tile: Coord): number => tile.y * grid.width + tile.x
  const inside = (tile: Coord): boolean => tile.x >= 0 && tile.y >= 0 && tile.x < grid.width && tile.y < grid.height
  const rock = (tile: Coord): boolean => TERRAIN[grid.tiles[key(tile)] as keyof typeof TERRAIN].impassable

  const structures = state.entities.filter((entity) => definitionOf(entity).layer === "obstacles")
  const survivors = state.entities.filter((entity) => definitionOf(entity).layer !== "obstacles")
  const walkers = survivors.filter((entity) => definitionOf(entity).movementRate !== undefined)
  const players: readonly PlayerId[] = ["A", "B"]

  // Who owns each tile a building stands on.
  const builtOn = new Map<number, PlayerId>()
  for (const structure of structures) for (const tile of tilesOf(structure.anchor, definitionOf(structure).footprint)) builtOn.set(key(tile), structure.player)
  // Where every survivor stands, tile by tile: a tile may hold two at the round's end (a flyer over a trooper), never
  // after anyone steps onto it.
  const at = new Map<number, Coord>()
  const bodies = new Map<number, number[]>()
  const occupy = (ordinal: number, anchor: Coord, footprint: Footprint): void => {
    for (const tile of tilesOf(anchor, footprint)) {
      const here = bodies.get(key(tile))
      if (here === undefined) bodies.set(key(tile), [ordinal])
      else here.push(ordinal)
    }
  }
  const vacate = (ordinal: number, anchor: Coord, footprint: Footprint): void => {
    for (const tile of tilesOf(anchor, footprint)) {
      const here = bodies.get(key(tile))
      if (here === undefined) continue
      const left = here.filter((each) => each !== ordinal)
      if (left.length === 0) bodies.delete(key(tile))
      else bodies.set(key(tile), left)
    }
  }
  for (const survivor of survivors) {
    at.set(survivor.ordinal, survivor.anchor)
    occupy(survivor.ordinal, survivor.anchor, definitionOf(survivor).footprint)
  }

  /** Whether `entity` may stand at `anchor` now: on the Grid, off rock (on the ground), off an enemy's building (its
   *  own side's roof it may cross, as a unit leaves a roof in a Battle Round), and on no other body. */
  const free = (entity: EntityState, anchor: Coord): boolean => {
    const definition = definitionOf(entity)
    for (const tile of tilesOf(anchor, definition.footprint)) {
      if (!inside(tile)) return false
      if (definition.layer !== "air" && rock(tile)) return false
      const owner = builtOn.get(key(tile))
      if (owner !== undefined && definition.layer !== "air" && owner !== entity.player) return false
      const here = bodies.get(key(tile))
      if (here !== undefined && here.some((other) => other !== entity.ordinal)) return false
    }
    return true
  }

  // The ground each body walks on: rock (on the ground) and the enemy's buildings are walls; its own side's are open.
  // Worked out once per side, body and layer.
  const groundCache = new Map<string, ReturnType<typeof groundFor>>()
  const groundOf = (entity: EntityState, extraWalls: readonly Readonly<{ anchor: Coord; footprint: Footprint }>[] = []) => {
    const definition = definitionOf(entity)
    const air = definition.layer === "air"
    const name = `${entity.player}|${air ? "air" : "ground"}|${bodyKey(definition.footprint)}`
    if (extraWalls.length === 0) {
      const cached = groundCache.get(name)
      if (cached !== undefined) return cached
    }
    const walls = wallsOf(grid, air ? "ignore" : "impassable")
    if (!air) for (const structure of structures) if (structure.player !== entity.player) addWall(walls, structure.anchor, definitionOf(structure).footprint)
    for (const wall of extraWalls) addWall(walls, wall.anchor, wall.footprint)
    const ground = groundFor(walls, definition.footprint)
    if (extraWalls.length === 0) groundCache.set(name, ground)
    return ground
  }

  const lines = new Map<PlayerId, Line | null>(players.map((player) => [player, lineOfSide(state, definitionOf, player)]))
  const orderOf = new Map<PlayerId, readonly Direction[]>(players.map((player) => [player, stepOrder(lines.get(player) ?? null)]))

  const credit = new Map<number, number>(walkers.map((walker) => [walker.ordinal, 0]))
  const steps = new Map<number, RegroupStep[]>(survivors.map((survivor) => [survivor.ordinal, []]))
  const facing = new Map<number, Direction>()

  /**
   * Walks every walker `fieldOf` gives a field, from tick `first` to tick `last`: each tick each gains its credit and,
   * nearest its goal first (the sides in turn on a tie, alternating each tick), takes the best step downhill whose
   * ground is free, once it can pay for it. One held up three ticks running looks for a way round the bodies that stand
   * (the kernel's detour), on a field of its own until it next steps.
   */
  const walk = (first: number, last: number, fieldOf: (walker: EntityState) => DistanceField | null, detourOf: (walker: EntityState, standing: readonly Readonly<{ anchor: Coord; footprint: Footprint }>[]) => DistanceField | null): void => {
    const held = new Map<number, number>()
    const detours = new Map<number, DistanceField>()
    for (let tick = first; tick <= last; tick += 1) {
      const moving: Array<Readonly<{ walker: EntityState; field: DistanceField; distance: number }>> = []
      for (const walker of walkers) {
        const field = detours.get(walker.ordinal) ?? fieldOf(walker)
        if (field === null) continue
        const rate = definitionOf(walker).movementRate
        if (rate === undefined) continue
        credit.set(walker.ordinal, accrueCredit(credit.get(walker.ordinal) ?? 0, rate))
        const distance = field.distanceAt(at.get(walker.ordinal) as Coord)
        if (distance === 0 || distance === UNREACHABLE) continue
        moving.push({ walker, field, distance })
      }
      const sideTurn = (player: PlayerId): number => (player === (tick % 2 === 0 ? "A" : "B") ? 0 : 1)
      moving.sort((a, b) => {
        const lineA = lines.get(a.walker.player) ?? null
        const lineB = lines.get(b.walker.player) ?? null
        const hereA = at.get(a.walker.ordinal) as Coord
        const hereB = at.get(b.walker.ordinal) as Coord
        return (
          a.distance - b.distance ||
          sideTurn(a.walker.player) - sideTurn(b.walker.player) ||
          (lineB === null ? 0 : forwardOf(lineB, hereB)) - (lineA === null ? 0 : forwardOf(lineA, hereA)) ||
          (lineA === null ? hereA.y : acrossOf(lineA, hereA)) - (lineB === null ? hereB.y : acrossOf(lineB, hereB)) ||
          a.walker.ordinal - b.walker.ordinal
        )
      })
      for (const { walker, field, distance } of moving) {
        const definition = definitionOf(walker)
        const rate = definition.movementRate as NonNullable<ContentDef["movementRate"]>
        const here = at.get(walker.ordinal) as Coord
        const order = orderOf.get(walker.player) ?? DIRECTIONS
        const options = order
          .map((direction, rank) => {
            const to = step(here, direction)
            const weight = inside(to) && definition.layer !== "air" ? TERRAIN[grid.tiles[key(to)] as keyof typeof TERRAIN].stepWeight : 1
            return { direction, to, rank, after: field.distanceAt(to), cost: stepCost(rate, direction, weight) }
          })
          .filter((option) => option.after < distance)
          .sort((a, b) => a.after + a.cost - (b.after + b.cost) || a.rank - b.rank)
        const open = options.find((option) => free(walker, option.to))
        if (open === undefined) {
          const waited = (held.get(walker.ordinal) ?? 0) + 1
          held.set(walker.ordinal, waited)
          if (waited >= 3) {
            const standing = survivors
              .filter((other) => other.ordinal !== walker.ordinal)
              .map((other) => ({ anchor: at.get(other.ordinal) as Coord, footprint: definitionOf(other).footprint }))
            const detour = detourOf(walker, standing)
            if (detour !== null && detour.distanceAt(here) !== UNREACHABLE) detours.set(walker.ordinal, detour)
            held.set(walker.ordinal, 0)
          }
          continue
        }
        // Not yet able to pay for the best free step: it saves up for it.
        if ((credit.get(walker.ordinal) ?? 0) < open.cost) continue
        credit.set(walker.ordinal, (credit.get(walker.ordinal) ?? 0) - open.cost)
        vacate(walker.ordinal, here, definition.footprint)
        occupy(walker.ordinal, open.to, definition.footprint)
        at.set(walker.ordinal, open.to)
        facing.set(walker.ordinal, open.direction)
        held.delete(walker.ordinal)
        ;(steps.get(walker.ordinal) as RegroupStep[]).push({ tick, to: open.to })
      }
    }
  }

  // 1. The step back: a survivor in a fight walks toward its own Nexus.
  const nexusOf = (player: PlayerId): EntityState | undefined => structures.find((entity) => entity.player === player && definitionOf(entity).nexus === true)
  const enemies = (player: PlayerId): EntityState[] => state.entities.filter((entity) => entity.player !== player)
  const inFight = new Set<number>()
  for (const walker of walkers) {
    const definition = definitionOf(walker)
    const near = enemies(walker.player).some((enemy) => footprintDistance(walker.anchor, definition.footprint, enemy.anchor, definitionOf(enemy).footprint) <= FIGHT_REACH)
    if (near) inFight.add(walker.ordinal)
  }
  const homeFields = new Map<string, DistanceField | null>()
  const homeField = (walker: EntityState, extraWalls: readonly Readonly<{ anchor: Coord; footprint: Footprint }>[] = []): DistanceField | null => {
    const nexus = nexusOf(walker.player)
    if (nexus === undefined) return null
    const definition = definitionOf(walker)
    const name = `${walker.player}|${definition.layer === "air" ? "air" : "ground"}|${bodyKey(definition.footprint)}`
    if (extraWalls.length === 0 && homeFields.has(name)) return homeFields.get(name) ?? null
    const ground = groundOf(walker, extraWalls)
    const field = new Field(ground, goalsNear(ground, definition.footprint, nexus.anchor, definitionOf(nexus).footprint, { kind: "touch", steps: 1 }))
    if (extraWalls.length === 0) homeFields.set(name, field)
    return field
  }
  walk(
    1,
    STEP_BACK_TICKS,
    (walker) => (inFight.has(walker.ordinal) ? homeField(walker) : null),
    (walker, standing) => homeField(walker, standing),
  )

  // 2. The formation: each side's groups and their slots, from where everyone stands after the step back.
  type Group = Readonly<{ player: PlayerId; line: Line; front: number; members: readonly EntityState[] }>
  const groups: Group[] = []
  for (const player of players) {
    const line = lines.get(player) ?? null
    if (line === null) continue
    const members = walkers.filter((walker) => walker.player === player)
    if (members.length === 0) continue
    const forward = (walker: EntityState): number => forwardOf(line, centreTile(at.get(walker.ordinal) as Coord, definitionOf(walker).footprint))
    const furthest = Math.max(...members.map(forward))
    const main = members.filter((walker) => forward(walker) >= furthest - BEHIND)
    const behind = members.filter((walker) => forward(walker) < furthest - BEHIND)
    groups.push({ player, line, front: frontOf(main.map(forward)), members: main })
    if (behind.length > 0) groups.push({ player, line, front: frontOf(behind.map(forward)), members: behind })
  }
  // Two main fronts that face each other along one axis are held `FRONT_GAP` clear columns apart, each giving back half.
  const mainA = groups.find((group) => group.player === "A")
  const mainB = groups.find((group) => group.player === "B")
  if (mainA !== undefined && mainB !== undefined && mainA.line.axis === mainB.line.axis && mainA.line.way === -mainB.line.way) {
    // The fronts' own coordinates on the axis, and the clear columns between them (negative when they overlap).
    const between = -(mainA.front + mainB.front) - 1
    if (between < FRONT_GAP) {
      const back = Math.ceil((FRONT_GAP - between) / 2)
      groups[groups.indexOf(mainA)] = { ...mainA, front: mainA.front - back }
      groups[groups.indexOf(mainB)] = { ...mainB, front: mainB.front - back }
    }
  }

  /** A group's places: each member and the tile it should stand on, in the order they are claimed — rank by rank,
   *  the middle of each rank first. */
  const placesOf = (group: Group): Array<Readonly<{ member: EntityState; tile: Coord; order: number }>> => {
    const { line } = group
    const here = (walker: EntityState): Coord => centreTile(at.get(walker.ordinal) as Coord, definitionOf(walker).footprint)
    const sorted = [...group.members].sort(
      (a, b) =>
        rankOrder(definitionOf(a)) - rankOrder(definitionOf(b)) ||
        forwardOf(line, here(b)) - forwardOf(line, here(a)) ||
        acrossOf(line, here(a)) - acrossOf(line, here(b)) ||
        a.ordinal - b.ordinal,
    )
    const width = rankWidth(sorted.length)
    const across = lineAcross(line, group.front)
    const spacing = line.axis === "x" ? 1 : 2
    const places: Array<Readonly<{ member: EntityState; tile: Coord; order: number }>> = []
    for (let rank = 0; rank * width < sorted.length; rank += 1) {
      const members = sorted.slice(rank * width, (rank + 1) * width)
      const offsets = members.map((_, index) => index - Math.floor(members.length / 2))
      // The Commander takes the middle of her rank; the rest their places across in the order they stand across.
      const commander = members.find((member) => definitionOf(member).commander === true)
      const rest = members.filter((member) => member !== commander).sort((a, b) => acrossOf(line, here(a)) - acrossOf(line, here(b)) || a.ordinal - b.ordinal)
      const open = commander === undefined ? offsets : offsets.filter((offset) => offset !== 0)
      const forward = group.front - rank * RANK_STEP
      const assigned = [...(commander === undefined ? [] : [{ member: commander, offset: 0 }]), ...rest.map((member, index) => ({ member, offset: open[index] as number }))]
      for (const { member, offset } of assigned) {
        places.push({ member, tile: tileOn(line, forward, across + offset * spacing), order: rank * 1000 + Math.abs(offset) * 2 + (offset < 0 ? 0 : 1) })
      }
    }
    return places.sort((a, b) => a.order - b.order)
  }

  // Slots are claimed in turns, a side at a time, the side going first alternating each turn; main groups first.
  const queues = groups.map((group) => ({ group, places: placesOf(group) }))
  const claimed = new Map<number, PlayerId>()
  const fixed = new Set<number>()
  for (const survivor of survivors) {
    if (definitionOf(survivor).movementRate !== undefined) continue
    for (const tile of tilesOf(at.get(survivor.ordinal) as Coord, definitionOf(survivor).footprint)) fixed.add(key(tile))
  }
  const slots = new Map<number, Coord>()
  // The field each unit walks to its slot by, found while its slot is claimed: only a slot it can reach is given.
  const slotFields = new Map<number, DistanceField>()
  /** The tiles too near a slot the other side claimed, for each side. */
  const keepOut = new Map<PlayerId, Set<number>>(players.map((player) => [player, new Set<number>()]))
  const claim = (member: EntityState, tile: Coord): void => {
    const definition = definitionOf(member)
    const nexus = nexusOf(member.player)
    const home = nexus === undefined ? undefined : centreTile(nexus.anchor, definitionOf(nexus).footprint)
    const away = keepOut.get(member.player) as Set<number>
    const mask = {
      footprintFits: (anchor: Coord, footprint: Footprint): boolean =>
        tilesOf(anchor, footprint).every(
          (each) =>
            inside(each) &&
            (definition.layer === "air" || !rock(each)) &&
            !builtOn.has(key(each)) &&
            !claimed.has(key(each)) &&
            !fixed.has(key(each)) &&
            !away.has(key(each)),
        ),
    }
    const anchor = nearestFit(mask, definition.footprint, tile, SLOT_RADIUS, tile, home)
    if (anchor === null) return
    const field = new Field(groundOf(member), [anchor])
    if (field.distanceAt(at.get(member.ordinal) as Coord) === UNREACHABLE) return
    for (const each of tilesOf(anchor, definition.footprint)) claimed.set(key(each), member.player)
    for (const player of players) {
      if (player === member.player) continue
      const theirs = keepOut.get(player) as Set<number>
      for (const each of tilesWithin(anchor, definition.footprint, KEEP_APART)) if (inside(each)) theirs.add(key(each))
    }
    slots.set(member.ordinal, anchor)
    slotFields.set(member.ordinal, field)
  }
  for (const groupIndex of [0, 1]) {
    // Each side's main group, then each side's group behind it.
    const pair = players.map((player) => queues.filter((queue) => queue.group.player === player)[groupIndex]).filter((queue) => queue !== undefined)
    const longest = Math.max(0, ...pair.map((queue) => queue.places.length))
    for (let turn = 0; turn < longest; turn += 1) {
      const order = turn % 2 === 0 ? pair : [...pair].reverse()
      for (const queue of order) {
        const place = queue.places[turn]
        if (place !== undefined) claim(place.member, place.tile)
      }
    }
  }

  // 3. Forming up, and standing formed: each walks to its slot, the slowest still on their way in the last 2 seconds.
  const slotField = (walker: EntityState, extraWalls: readonly Readonly<{ anchor: Coord; footprint: Footprint }>[] = []): DistanceField | null => {
    const slot = slots.get(walker.ordinal)
    if (slot === undefined) return null
    if (extraWalls.length === 0) {
      const cached = slotFields.get(walker.ordinal)
      if (cached !== undefined) return cached
    }
    const field = new Field(groundOf(walker, extraWalls), [slot])
    if (extraWalls.length === 0) slotFields.set(walker.ordinal, field)
    return field
  }
  walk(STEP_BACK_TICKS + 1, REGROUP_TICKS, (walker) => slotField(walker), (walker, standing) => slotField(walker, standing))

  // Formed up, each faces the enemy.
  const facingOf = new Map<number, Direction>()
  for (const survivor of survivors) {
    const line = lines.get(survivor.player) ?? null
    const toward = line === null ? undefined : stepOrder(line)[0]
    const last = facing.get(survivor.ordinal)
    if (slots.has(survivor.ordinal) && toward !== undefined) facingOf.set(survivor.ordinal, toward)
    else if (last !== undefined) facingOf.set(survivor.ordinal, last)
  }
  const paths: RegroupPath[] = survivors.map((survivor) => ({
    ordinal: survivor.ordinal,
    player: survivor.player,
    contentId: survivor.contentId,
    from: survivor.anchor,
    to: at.get(survivor.ordinal) as Coord,
    steps: steps.get(survivor.ordinal) ?? [],
    slot: slots.get(survivor.ordinal) ?? null,
  }))
  return { state: settled(state, definitionOf, at, facingOf), paths, ticks: REGROUP_TICKS }
}
