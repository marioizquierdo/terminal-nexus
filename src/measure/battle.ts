// What one Battle Round says, in numbers (docs/system-design/measurement.md): who won and when, what each side lost,
// when a Commander fell, how long units stood wanting a step they could not take, and how tight each army stood when
// it first met the enemy. Read from the states and events a battle produced, tick by tick, so the same record comes
// from a scenario, a campaign level's round or a duel's, and from any rule the kernel walks by.
//
// Pure: nothing here reads a clock. The time a tick takes is the command's to measure (`bin/measure.ts`).

import type { ContentRegistry } from "../content/index.ts"
import type { DomainEvent } from "../events/types.ts"
import { ROW_DISTANCE } from "../grid/coords.ts"
import type { MatchState, PlayerId } from "../state/types.ts"
import { PLAYERS } from "../state/types.ts"

/** A run of blocked ticks this long or longer is a unit that stood still for good, in all but name: five seconds. */
export const STALL_TICKS = 60

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
    })
    this.tallies = { A: tally(), B: tally() }
  }

  observe(state: MatchState, events: readonly DomainEvent[]): void {
    this.last = state
    for (const entity of state.entities) {
      if (this.registry(entity.player).get(entity.contentId).layer !== "obstacles") this.tallies[entity.player].fielded.add(entity.id)
    }
    const contact: PlayerId[] = []
    for (const event of events) {
      if (event.kind === "move.blocked") {
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
      } else if (event.kind === "attack.launched") {
        const player = playerOf(event.attacker)
        if (player !== null && event.attackKind !== "heal" && this.tallies[player].firstContact === null && !contact.includes(player)) contact.push(player)
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
