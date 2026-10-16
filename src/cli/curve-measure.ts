// The power curve, measured on the Grid (Commander Armies): a scripted player climbs a level's tech tree round by
// round, and the measure says how much of the army that fights the last round each round bought.
//
// The owner, 2026-10-13: survivors stack, and "new unlocked units should be a lot stronger so that makes the initial
// moves more exploratory and opportunistic and the last few moves more decisive". The design's expectation
// (docs/game-design/commander-armies.md, the expected power curve): what the first three rounds bought is at most
// about a fifth of the army that fights the last round. This plays a level the way a plain player might, and counts.
//
// A unit's strength is its health times its damage a tick — a first measure, the one the design's "about as strong as
// three troopers" uses. The Commander is left out: she is not bought. Pure and deterministic like the round loop it
// drives: the same level and plan measure the same every run, on Node and on Bun.

import { STARTER_START_CURSOR } from "../build/catalog.ts"
import { buildLayout } from "../build/layout.ts"
import type { BuildContext, BuildState } from "../build/state.ts"
import { createBuildState, legalityAt, missingFor, remaining, withoutScene } from "../build/state.ts"
import type { ConstructItem, PlannedPlacement } from "../build/types.ts"
import type { Coord } from "../grid/types.ts"
import type { PlayableLevel } from "./levels.ts"

/** What a scripted player buys, round by round (the last list for every round after it): in turn, the next on the
 *  round's list it can afford, place and build, round and round, until nothing on it fits. Content ids of the build
 *  menu's rows. */
export type CurvePlan = Readonly<{ name: string; buys: readonly (readonly string[])[]; near: Coord }>

/** The army one round fielded: each unit's strength by the round that bought it. */
export type RoundArmy = Readonly<{ round: number; byRound: readonly number[]; total: number }>

export type CurveMeasure = Readonly<{
  plan: string
  /** How the level ended: the round it ended in, and whether it was won. */
  ended: Readonly<{ round: number; verdict: string }>
  /** What each round bought, by content id. */
  bought: readonly (readonly string[])[]
  /** The army each round fielded, by the round that bought it. */
  armies: readonly RoundArmy[]
  /** Of the last round's army, the share the first three rounds bought, from 0 to 1. */
  openingShare: number
}>

/** The tiles a building may be placed on, nearest `near` first (a row counting two columns, as range does). */
function candidates(context: BuildContext, near: Coord): Coord[] {
  const tiles: Coord[] = []
  for (let y = 0; y < context.grid.height; y += 1) for (let x = 0; x < context.grid.width; x += 1) tiles.push({ x, y })
  const distance = (tile: Coord): number => Math.abs(tile.x - near.x) + 2 * Math.abs(tile.y - near.y)
  return tiles.sort((a, b) => distance(a) - distance(b) || a.y - b.y || a.x - b.x)
}

/** Round `context`'s plan: what `plan` buys, placed legally nearest its point. */
function planRound(context: BuildContext, state: BuildState, plan: CurvePlan): Readonly<{ state: BuildState; bought: string[] }> {
  let planned: PlannedPlacement[] = []
  let ordinal = state.nextOrdinal
  const bought: string[] = []
  const tiles = candidates(context, plan.near)
  const left = (): number => remaining(context, { ...state, planned })
  // In turn: each buy starts its search at the row after the last one bought, so a plan that names a Supply Depot
  // builds one between its producers rather than only once nothing else is affordable.
  const round = context.round?.number ?? 1
  const list = plan.buys[Math.min(round, plan.buys.length) - 1] ?? []
  const rows = list.flatMap((contentId) => context.catalog.find((row) => row.contentId === contentId) ?? [])
  let next = 0
  for (;;) {
    const turn = [...rows.slice(next), ...rows.slice(0, next)]
    const item = turn.find((row): row is ConstructItem => missingFor(context, row).length === 0 && row.cost <= left())
    if (item === undefined) break
    const anchor = tiles.find((tile) => legalityAt(context, planned, item.contentId, tile, left()).ok)
    if (anchor === undefined) break
    planned = [...planned, { ordinal, contentId: item.contentId, anchor }]
    ordinal += 1
    bought.push(item.contentId)
    next = (rows.indexOf(item) + 1) % rows.length
  }
  return { state: { ...state, planned, nextOrdinal: ordinal }, bought }
}

/** Plays `level` by `plan` to its end, and measures each round's army by the round that bought it. */
export function measureCurve(level: PlayableLevel, plan: CurvePlan): CurveMeasure {
  let context = level.firstRound()
  const firstSeen = new Map<string, number>()
  const trainers = new Map<string, string>()
  const bought: string[][] = []
  const armies: RoundArmy[] = []
  let ended = { round: 0, verdict: "unplayed" }
  for (let round = 1; round <= level.rounds; round += 1) {
    const viewport = buildLayout({ columns: 80, rows: 24 }, context.grid).viewport
    const opened = createBuildState(withoutScene(context), STARTER_START_CURSOR, viewport)
    const planned = planRound(context, opened, plan)
    bought.push(planned.bought)
    const resolved = level.play.startPulse(context, planned.state)
    if (resolved === null) throw new Error(`level "${level.id}": round ${round} could not start`)
    const { registry } = resolved.timeline
    for (const event of resolved.timeline.events) {
      if (event.kind === "entity.spawned" && event.trainedBy !== undefined) trainers.set(event.entity, event.trainedBy)
    }
    const strength = new Map<string, number>()
    for (const state of resolved.timeline.states) {
      for (const entity of state.entities) {
        if (entity.player !== "A") continue
        if (!firstSeen.has(entity.id)) firstSeen.set(entity.id, round)
        const definition = registry.get(entity.contentId)
        if (definition.layer !== "units" || definition.commander === true || definition.attack === undefined) continue
        strength.set(entity.id, (definition.maxHp * definition.attack.damage) / definition.attack.cooldownTicks)
      }
    }
    // A unit counts for the round its credits were spent: the round the building that trained it was bought, or —
    // for one no building trained (the mission's squads, a power's call-up) — the round it first stood.
    const boughtIn = (id: string): number => {
      const trainer = trainers.get(id)
      return (trainer === undefined ? firstSeen.get(id) : firstSeen.get(trainer)) ?? round
    }
    const byRound = Array.from({ length: level.rounds }, () => 0)
    for (const [id, value] of strength) {
      const index = boughtIn(id) - 1
      byRound[index] = (byRound[index] ?? 0) + value
    }
    armies.push({ round, byRound, total: byRound.reduce((sum, value) => sum + value, 0) })
    ended = { round, verdict: resolved.mission?.verdict.kind ?? "none" }
    const next = level.play.nextRound(context, planned.state, resolved)
    if (next === null) break
    context = next
  }
  const last = armies[armies.length - 1]
  const opening = last === undefined ? 0 : last.byRound.slice(0, 3).reduce((sum, value) => sum + value, 0)
  return { plan: plan.name, ended, bought, armies, openingShare: last === undefined || last.total === 0 ? 0 : opening / last.total }
}
