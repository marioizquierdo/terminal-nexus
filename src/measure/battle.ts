// What one Battle Round says, in numbers (docs/system-design/measurement.md): who won and when, what each side lost,
// when a Commander fell, how long units stood wanting a step they could not take, and how tight each army stood when
// it first met the enemy. Read from the states and events a battle produced, tick by tick, so the same record comes
// from a scenario, a campaign level's round or a duel's, and from any rule the kernel walks by.
//
// Pure: nothing here reads a clock. The time a tick takes is the command's to measure (`bin/measure.ts`).

import type { ContentRegistry } from "../content/index.ts"
import type { DomainEvent } from "../events/types.ts"
import { footprintDistance, ROW_DISTANCE } from "../grid/coords.ts"
import type { MatchState, PlayerId } from "../state/types.ts"
import { PLAYERS } from "../state/types.ts"

/** A run of blocked ticks this long or longer is a unit that stood still for good, in all but name: five seconds. */
export const STALL_TICKS = 60

/** A fighting unit that went this long neither moving, striking nor blocked stood idle: five seconds. A blocked unit is
 *  trying to move; an idle one is not trying at all, which a count of blocked ticks never sees. */
export const IDLE_TICKS = 60

/**
 * What a stalled unit's queue ends at, followed from waiter to the one it waits on (`move.blocked`'s blocker) the tick
 * the stall reaches `STALL_TICKS`: the question every stall diagnosis asks first.
 */
export type StallHead =
  | "an ally striking"
  | "an ally walking to its target"
  | "an ally with no target"
  | "an enemy"
  | "a building"
  | "no route to its enemy"
  | "settling after a step"
  | "terrain or the edge"
  | "a ring of waiters"

export type SideRecord = Readonly<{
  /** Mobile units that stood on the Grid at any moment of the battle. */
  fielded: number
  /** Of them, how many fell. */
  lost: number
  /** Buildings of its that fell. */
  structuresLost: number
  /** The tick its Commander fell, or null. */
  commanderFellAt: number | null
  /** The first tick one of its units struck or shot, or null when none did. */
  firstContact: number | null
  /** How far, on average, its fighting units stood from their middle at that tick, in columns (a row counts two):
   *  small is a tight army, large a loose one. Null without contact. */
  spreadAtContact: number | null
  /** Its fighting units standing at that tick. */
  unitsAtContact: number
  /** Every tick one of its units wanted a step and could not take one, added up. */
  blockedTicks: number
  /** The longest run of ticks one unit spent blocked, one after another. */
  longestBlocked: number
  /** Units that spent `STALL_TICKS` or more blocked in one run. */
  stalled: number
  /** Damage it dealt, to units, buildings and Nexus alike. */
  dealt: number
  /** The tick each of its units that ever struck or shot first did, in order (a heal is not a strike): how many of
   *  its units the battle ever engaged, and how soon. Absent from a record written before it was kept. */
  firstStrikes?: readonly number[]
  /** Targets its units chose, and of them the switches: a new target chosen while the one held still stood. Absent from
   *  a record written before they were kept. */
  targetsChosen?: number
  switches?: number
  /** Its fighting units that stood idle `IDLE_TICKS` or more at a stretch while the battle went on. */
  idle?: number
  /** What its stalled units' queues ended at, by `StallHead`. */
  stallHeads?: Readonly<Partial<Record<StallHead, number>>>
}>

export type BattleRecord = Readonly<{
  ticks: number
  winner: PlayerId | null
  /** Why it ended: a Nexus fell, a side was wiped out, or time ran out. */
  reason: string
  sides: Readonly<Record<PlayerId, SideRecord>>
}>

type Tally = {
  fielded: Set<string>
  lost: number
  structuresLost: number
  commanderFellAt: number | null
  firstContact: number | null
  spreadAtContact: number | null
  unitsAtContact: number
  blockedTicks: number
  longestBlocked: number
  stalled: Set<string>
  dealt: number
  struck: Map<string, number>
  targetsChosen: number
  switches: number
  idle: Set<string>
  stallHeads: Partial<Record<StallHead, number>>
}

const playerOf = (id: string): PlayerId | null => (id.startsWith("A:") ? "A" : id.startsWith("B:") ? "B" : null)

/** How far, on average, `points` stand from their middle, a row counting `ROW_DISTANCE` columns. */
export function spreadOf(points: readonly Readonly<{ x: number; y: number }>[]): number {
  if (points.length === 0) return 0
  const middleX = points.reduce((sum, point) => sum + point.x, 0) / points.length
  const middleY = points.reduce((sum, point) => sum + point.y, 0) / points.length
  const total = points.reduce((sum, point) => sum + Math.abs(point.x - middleX) + ROW_DISTANCE * Math.abs(point.y - middleY), 0)
  return Math.round((total / points.length) * 10) / 10
}

/**
 * Builds a battle's record as it is played: hand it every state, from the opening on, with the events of the tick that
 * produced it (none for the opening), then ask for the record. Each side's content is the battle's, or its own.
 */
export class BattleRecorder {
  private readonly registry: (player: PlayerId) => ContentRegistry
  private readonly tallies: Record<PlayerId, Tally>
  private readonly runs = new Map<string, number>()
  private readonly lastBlocked = new Map<string, number>()
  /** The last tick each unit moved, struck, healed or was blocked: what idle is measured from. */
  private readonly lastActive = new Map<string, number>()
  private last: MatchState | null = null

  constructor(registry: ContentRegistry, sides?: Readonly<Partial<Record<PlayerId, ContentRegistry>>>) {
    this.registry = (player) => sides?.[player] ?? registry
    const tally = (): Tally => ({
      fielded: new Set(),
      lost: 0,
      structuresLost: 0,
      commanderFellAt: null,
      firstContact: null,
      spreadAtContact: null,
      unitsAtContact: 0,
      blockedTicks: 0,
      longestBlocked: 0,
      stalled: new Set(),
      dealt: 0,
      struck: new Map(),
      targetsChosen: 0,
      switches: 0,
      idle: new Set(),
      stallHeads: {},
    })
    this.tallies = { A: tally(), B: tally() }
  }

  observe(state: MatchState, events: readonly DomainEvent[]): void {
    const before = this.last
    this.last = state
    for (const entity of state.entities) {
      if (this.registry(entity.player).get(entity.contentId).layer !== "obstacles") this.tallies[entity.player].fielded.add(entity.id)
    }
    const contact: PlayerId[] = []
    const blockedNow = new Map<string, Extract<DomainEvent, { kind: "move.blocked" }>>()
    for (const event of events) if (event.kind === "move.blocked") blockedNow.set(event.entity, event)
    for (const event of events) {
      if (event.kind === "entity.moved") this.lastActive.set(event.entity, event.tick)
      else if (event.kind === "attack.launched") this.lastActive.set(event.attacker, event.tick)
      else if (event.kind === "target.selected") {
        const player = playerOf(event.entity)
        if (player === null) continue
        const tally = this.tallies[player]
        tally.targetsChosen += 1
        // A switch: it held another target, and that one still stood as the tick began.
        const held = before?.entities.find((entity) => entity.id === event.entity)?.targetOrdinal ?? null
        if (held !== null && held !== event.targetOrdinal && state.entities.some((entity) => entity.ordinal === held)) tally.switches += 1
      }
      if (event.kind === "move.blocked") {
        this.lastActive.set(event.entity, event.tick)
        const player = playerOf(event.entity)
        if (player === null) continue
        const tally = this.tallies[player]
        tally.blockedTicks += 1
        // A run goes on while the unit is blocked tick after tick.
        const run = this.lastBlocked.get(event.entity) === event.tick - 1 ? (this.runs.get(event.entity) ?? 0) + 1 : 1
        this.runs.set(event.entity, run)
        this.lastBlocked.set(event.entity, event.tick)
        tally.longestBlocked = Math.max(tally.longestBlocked, run)
        if (run >= STALL_TICKS) tally.stalled.add(event.entity)
        if (run === STALL_TICKS) {
          const head = this.stallHead(state, event, blockedNow)
          tally.stallHeads[head] = (tally.stallHeads[head] ?? 0) + 1
        }
      } else if (event.kind === "attack.launched") {
        const player = playerOf(event.attacker)
        if (player !== null && event.attackKind !== "heal") {
          const struck = this.tallies[player].struck
          if (!struck.has(event.attacker)) struck.set(event.attacker, event.tick)
          if (this.tallies[player].firstContact === null && !contact.includes(player)) contact.push(player)
        }
      } else if (event.kind === "damage.applied") {
        const player = playerOf(event.source)
        if (player !== null && playerOf(event.entity) !== player) this.tallies[player].dealt += event.amount
      } else if (event.kind === "structure.destroyed") {
        this.tallies[event.player].structuresLost += 1
      } else if (event.kind === "entity.died") {
        const tally = this.tallies[event.player]
        tally.lost += 1
        if (this.registry(event.player).get(event.contentId).commander === true && tally.commanderFellAt === null) tally.commanderFellAt = event.tick
      }
    }
    // Idle: a fighting unit, the battle still on, that has gone `IDLE_TICKS` with nothing to show for it.
    if (state.outcome === null) {
      for (const entity of state.entities) {
        const definition = this.registry(entity.player).get(entity.contentId)
        if (definition.layer === "obstacles" || definition.attack === undefined) continue
        const since = this.lastActive.get(entity.id)
        if (since === undefined) this.lastActive.set(entity.id, state.tick)
        else if (state.tick - since >= IDLE_TICKS) this.tallies[entity.player].idle.add(entity.id)
      }
    }
    for (const player of contact) {
      const tally = this.tallies[player]
      tally.firstContact = state.tick
      const fighters = state.entities.filter((entity) => {
        if (entity.player !== player) return false
        const definition = this.registry(player).get(entity.contentId)
        return definition.layer !== "obstacles" && definition.attack !== undefined && definition.attack.kind !== "heal"
      })
      tally.unitsAtContact = fighters.length
      tally.spreadAtContact = spreadOf(fighters.map((entity) => entity.anchor))
    }
  }

  /** What `blocked`'s queue ends at this tick: its blocker, and the blocker's blocker, until one is not waiting. */
  private stallHead(
    state: MatchState,
    blocked: Extract<DomainEvent, { kind: "move.blocked" }>,
    waiting: ReadonlyMap<string, Extract<DomainEvent, { kind: "move.blocked" }>>,
  ): StallHead {
    let at = blocked
    const seen = new Set<string>([at.entity])
    while (at.blocker !== null && waiting.has(at.blocker)) {
      if (seen.has(at.blocker)) return "a ring of waiters"
      seen.add(at.blocker)
      at = waiting.get(at.blocker) as typeof at
    }
    if (at.blocker === null) return at.reason === "no-route" ? "no route to its enemy" : at.reason === "settling" ? "settling after a step" : "terrain or the edge"
    const head = state.entities.find((entity) => entity.id === at.blocker)
    if (head === undefined) return "terrain or the edge"
    const definition = this.registry(head.player).get(head.contentId)
    if (definition.layer === "obstacles") return "a building"
    if (head.player !== playerOf(blocked.entity)) return "an enemy"
    const target = head.targetOrdinal === null ? undefined : state.entities.find((entity) => entity.ordinal === head.targetOrdinal)
    if (target === undefined) return "an ally with no target"
    const attack = definition.attack
    const reach = attack === undefined ? 0 : attack.range
    const apart = footprintDistance(head.anchor, definition.footprint, target.anchor, this.registry(target.player).get(target.contentId).footprint)
    return apart <= reach ? "an ally striking" : "an ally walking to its target"
  }

  record(): BattleRecord {
    const outcome = this.last?.outcome ?? null
    const side = (player: PlayerId): SideRecord => {
      const tally = this.tallies[player]
      return {
        fielded: tally.fielded.size,
        lost: tally.lost,
        structuresLost: tally.structuresLost,
        commanderFellAt: tally.commanderFellAt,
        firstContact: tally.firstContact,
        spreadAtContact: tally.spreadAtContact,
        unitsAtContact: tally.unitsAtContact,
        blockedTicks: tally.blockedTicks,
        longestBlocked: tally.longestBlocked,
        stalled: tally.stalled.size,
        dealt: tally.dealt,
        firstStrikes: [...tally.struck].flatMap(([id, tick]) => (tally.fielded.has(id) ? [tick] : [])).sort((a, b) => a - b),
        targetsChosen: tally.targetsChosen,
        switches: tally.switches,
        idle: tally.idle.size,
        stallHeads: { ...tally.stallHeads },
      }
    }
    return {
      ticks: this.last?.tick ?? 0,
      winner: outcome?.winner ?? null,
      reason: outcome?.reason ?? "unfinished",
      sides: { A: side(PLAYERS[0] as PlayerId), B: side(PLAYERS[1] as PlayerId) },
    }
  }
}

/** A whole battle's record from its states (the opening first) and its events, each event in the tick that made it. */
export function recordBattle(
  states: readonly MatchState[],
  events: readonly DomainEvent[],
  registry: ContentRegistry,
  sides?: Readonly<Partial<Record<PlayerId, ContentRegistry>>>,
): BattleRecord {
  const recorder = new BattleRecorder(registry, sides)
  const byTick = new Map<number, DomainEvent[]>()
  for (const event of events) {
    const list = byTick.get(event.tick)
    if (list === undefined) byTick.set(event.tick, [event])
    else list.push(event)
  }
  states.forEach((state, index) => recorder.observe(state, index === 0 ? [] : (byTick.get(state.tick) ?? [])))
  return recorder.record()
}
