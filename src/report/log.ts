// The levelled log — milestone-1-spike-battle.md 3.3.
//
// Everything below is derived from the ordered event stream and the final state. Nothing here
// imports the kernel, and a test asserts that: a report that can reach into kernel internals can
// narrate a story the events do not contain, and because the log is only ever compared with itself,
// every other determinism check would still pass.

import type { ContentRegistry } from "../content/index.ts"
import type { DomainEvent } from "../events/types.ts"
import type { Coord } from "../grid/types.ts"
import type { MatchState } from "../state/types.ts"
import { formatCoordinate, formatLine, formatScore } from "./format.ts"
import type { LogLine } from "./format.ts"
import { includesLevel } from "./levels.ts"
import type { LogLevel } from "./levels.ts"
import { replayEvents } from "./replay.ts"
import { reportLineDetail, summarize } from "./summary.ts"

/** An actor with no legal step for this many consecutive ticks is worth a WARN. */
export const STUCK_TICKS = 24

export type ReportInput = Readonly<{
  scenarioId: string
  seed: number
  pulseTicks: number
  registry: ContentRegistry
  events: readonly DomainEvent[]
  finalState: MatchState
  stateHash: string
  eventsHash: string
}>

type Streak = { start: number; last: number; warned: boolean }

/**
 * A mover with no route does not always stop. Greedy routing with a deterministic sidestep can
 * leave an actor stepping between two tiles forever — effectively stuck, but never blocked, so the
 * blocked-streak warning above would miss it entirely. The log watches net progress instead, which
 * it can do from `entity.moved` alone.
 */
type Track = { since: number; tiles: string[] }

export function buildLog(input: ReportInput, level: LogLevel): string[] {
  const lines: string[] = []
  const emit = (line: LogLine): void => {
    if (includesLevel(level, line.level)) lines.push(formatLine(line))
  }

  const engaged = new Set<number>()
  const blocked = new Map<number, Streak>()
  const tracks = new Map<number, Track>()
  // Where each actor is standing right now. `move.blocked` carries only the tile the actor *wanted*,
  // so without this the stuck warning had nothing but the tile it could not enter to report — and a
  // tile an actor cannot enter is, very often, a rock.
  const where = new Map<number, Coord>()

  const byTick = groupByTick(input.events)
  for (const [tick, events] of byTick) {
    const deathsThisTick = new Set<number>()
    for (const event of events) {
      if (event.kind === "entity.died" || event.kind === "structure.destroyed") {
        deathsThisTick.add(event.ordinal)
      }
    }

    events.forEach((event, index) => {
      switch (event.kind) {
        case "entity.spawned":
          where.set(event.ordinal, event.at)
          emit({
            tick,
            level: "INFO",
            kind: "spawn",
            subject: event.entity,
            detail: `at ${formatCoordinate(event.at)}`,
          })
          break

        case "target.selected": {
          const first = !engaged.has(event.ordinal)
          engaged.add(event.ordinal)
          emit({
            tick,
            level: first ? "INFO" : "DEBUG",
            kind: first ? "engage" : "target",
            subject: event.entity,
            object: event.target,
            detail: `dist ${event.distance}  score ${formatScore(event.score)}`,
          })
          break
        }

        case "target.lost":
          // A target that vanished with no death behind it is the suspicious case; a target that
          // died this tick is just the fight working, and does not deserve a WARN every time.
          emit({
            tick,
            level: deathsThisTick.has(event.targetOrdinal) ? "DEBUG" : "WARN",
            kind: "lost",
            subject: event.entity,
            object: event.target,
            detail: deathsThisTick.has(event.targetOrdinal)
              ? "target died"
              : "target vanished without a death event",
          })
          break

        case "behavior.flee":
          emit({
            tick,
            level: "DEBUG",
            kind: "flee",
            subject: event.entity,
            object: event.threat,
            detail: `dist ${event.distance}  away from threat`,
          })
          break

        case "move.intended":
          emit({
            tick,
            level: "DEBUG",
            kind: "intent",
            subject: event.entity,
            detail:
              `to ${formatCoordinate(event.to)}  dir ${event.direction}  ` +
              `credit ${event.credit}/${event.cost}`,
          })
          break

        case "move.contested":
          emit({
            tick,
            level: "DEBUG",
            kind: "claim",
            subject: event.winner,
            detail:
              `tile ${formatCoordinate(event.tile)}  by ${event.resolvedBy}  ` +
              `over ${event.losers.join(" ")}`,
          })
          break

        case "move.blocked": {
          const streak = blocked.get(event.ordinal)
          if (streak === undefined || streak.last !== tick - 1) {
            blocked.set(event.ordinal, { start: tick, last: tick, warned: false })
          } else {
            streak.last = tick
            if (!streak.warned && tick - streak.start + 1 >= STUCK_TICKS) {
              streak.warned = true
              const standing = where.get(event.ordinal)
              emit({
                tick,
                level: "WARN",
                kind: "stuck",
                subject: event.entity,
                detail:
                  `${standing === undefined ? "" : `at ${formatCoordinate(standing)}  `}` +
                  `no legal step for ${tick - streak.start + 1} ticks  ` +
                  `wants ${formatCoordinate(event.desired)}`,
              })
            }
          }
          emit({
            tick,
            level: "DEBUG",
            kind: "blocked",
            subject: event.entity,
            detail:
              `wanted ${formatCoordinate(event.desired)}  by ${event.reason}` +
              `${event.blocker === null ? "" : ` ${event.blocker}`}  ` +
              `credit ${event.credit}/${event.cost}`,
          })
          break
        }

        case "entity.moved": {
          where.set(event.ordinal, event.to)
          blocked.delete(event.ordinal)
          const track = tracks.get(event.ordinal)
          const tile = formatCoordinate(event.to)
          if (track === undefined) {
            tracks.set(event.ordinal, { since: tick, tiles: [tile] })
          } else {
            track.tiles.push(tile)
            const distinct = new Set(track.tiles)
            if (distinct.size > 2) {
              tracks.set(event.ordinal, { since: tick, tiles: [tile] })
            } else if (tick - track.since >= STUCK_TICKS && track.tiles.length >= 3) {
              emit({
                tick,
                level: "WARN",
                kind: "stuck",
                subject: event.entity,
                detail:
                  `at ${tile}  no progress for ${tick - track.since} ticks  ` +
                  `circling ${[...distinct].join(" ")}`,
              })
              tracks.set(event.ordinal, { since: tick, tiles: [tile] })
            }
          }
          emit({
            tick,
            level: "DEBUG",
            kind: "move",
            subject: event.entity,
            detail:
              `${formatCoordinate(event.from)}->${formatCoordinate(event.to)}  ` +
              `facing ${event.facing}`,
          })
          break
        }

        case "attack.launched": {
          // Pair the attack with the hp change it caused: the next damage-or-heal event for that
          // target in this tick, which is the one its speed tier applied. A heal-kind attack
          // resolves to `heal.applied`, never `damage.applied` (events carry meaning, not just a
          // number's sign) — both are "the hp change this attack caused" for the log's purposes.
          const result = events
            .slice(index + 1)
            .find(
              (later) =>
                (later.kind === "damage.applied" || later.kind === "heal.applied") &&
                later.ordinal === event.targetOrdinal,
            )
          const health =
            result !== undefined && (result.kind === "damage.applied" || result.kind === "heal.applied")
              ? `hp ${result.hpBefore}->${result.hpAfter}`
              : "hp unchanged"
          const flight = event.attackKind === "ranged" ? `  flight ${event.flightWindowTicks}` : ""
          const amountLabel = event.attackKind === "heal" ? "heal" : "dmg"
          emit({
            tick,
            level: "INFO",
            kind: "attack",
            subject: event.attacker,
            object: event.target,
            detail:
              `${event.attackKind.padEnd(6, " ")} ${amountLabel} ${event.damage}  ${health}` +
              `${flight}`,
          })
          break
        }

        case "damage.applied":
          emit({
            tick,
            level: "DEBUG",
            kind: "damage",
            subject: event.entity,
            object: event.source,
            detail: `amount ${event.amount}  hp ${event.hpBefore}->${event.hpAfter}`,
          })
          break

        case "heal.applied":
          emit({
            tick,
            level: "DEBUG",
            kind: "heal",
            subject: event.entity,
            object: event.source,
            detail: `amount ${event.amount}  hp ${event.hpBefore}->${event.hpAfter}`,
          })
          break

        case "entity.died":
          emit({
            tick,
            level: "INFO",
            kind: "death",
            subject: event.entity,
            detail:
              `at ${formatCoordinate(event.at)}  by ${event.killer ?? "unknown"}`,
          })
          break

        case "structure.destroyed":
          emit({
            tick,
            level: "INFO",
            kind: "destroy",
            subject: event.entity,
            detail:
              `at ${formatCoordinate(event.at)}  by ${event.killer ?? "unknown"}`,
          })
          break

        case "entity.detonated":
          emit({
            tick,
            level: "INFO",
            kind: "blast",
            subject: event.entity,
            detail:
              `at ${formatCoordinate(event.at)}  radius ${event.radius}  dmg ${event.damage}  ` +
              `caught ${event.caught.length === 0 ? "nothing" : event.caught.join(" ")}`,
          })
          break

        case "salvage.dropped":
          emit({
            tick,
            level: "DEBUG",
            kind: "salvage",
            subject: event.source,
            detail: `at ${formatCoordinate(event.at)}  amount ${event.amount}`,
          })
          break

        case "arbitration.bounded":
          emit({
            tick,
            level: "WARN",
            kind: "arbiter",
            subject: event.unresolved[0] ?? "-",
            detail:
              `arbitration stopped after ${event.passes} passes  ` +
              `unresolved ${event.unresolved.join(" ")}`,
          })
          break

        case "pulse.ended":
          emit({
            tick,
            level: "INFO",
            kind: "victory",
            subject: event.winner ?? "draw",
            detail: `reason: ${event.reason}`,
          })
          break

        default:
          break
      }
    })

    if (includesLevel(level, "TRACE")) {
      for (const line of traceLines(input, tick)) lines.push(line)
    }
  }

  // One WARN line, always last: the same outcome/losses/hashes `formatSummary` prints, folded into
  // the levelled log so a single stream carries the whole story (milestone-1-spike-battle.md 3.3).
  emit({
    tick: input.finalState.tick,
    level: "WARN",
    kind: "report",
    subject: input.scenarioId,
    detail: reportLineDetail(summarize(input)),
  })

  return lines
}

/**
 * TRACE is per-entity, per-tick state, rebuilt from the events up to that tick. Expect it to be
 * enormous. `facing` and movement credit are absent on purpose — see `replay.ts`.
 */
function traceLines(input: ReportInput, tick: number): string[] {
  const upToTick = input.events.filter((event) => event.tick <= tick)
  const replay = replayEvents(upToTick)
  const lines: string[] = []
  const entities = [...replay.entities.values()].sort((a, b) => a.ordinal - b.ordinal)
  for (const entity of entities) {
    if (!entity.alive) continue
    const definition = input.registry.get(entity.contentId)
    lines.push(
      formatLine({
        tick,
        level: "TRACE",
        kind: "state",
        subject: entity.id,
        detail:
          `hp ${entity.hp}/${definition.maxHp}  at ${formatCoordinate(entity.anchor)}  ` +
          `target ${entity.targetOrdinal === null ? "-" : `#${entity.targetOrdinal}`}`,
      }),
    )
  }
  return lines
}

function groupByTick(events: readonly DomainEvent[]): Array<[number, DomainEvent[]]> {
  const byTick = new Map<number, DomainEvent[]>()
  for (const event of events) {
    const bucket = byTick.get(event.tick)
    if (bucket === undefined) byTick.set(event.tick, [event])
    else bucket.push(event)
  }
  return [...byTick.entries()].sort((a, b) => a[0] - b[0])
}
