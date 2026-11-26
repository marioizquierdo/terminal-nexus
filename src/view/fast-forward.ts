// **Fast forward** (the owner, F339: "if I am playing defensive, the unit groups arrive at the rally point, and nothing
// happens until the round ends. The game should fast forward to the end of the round"): a Battle Round is resolved in
// full before its first frame, so the screen can know when nothing more will happen in it, and play that part faster.
//
// - **Settled**: the first tick T, checked once per in-game second (every `ticksPerSecond` ticks), from which no side
//   hits anything to the round's end and the units already stand close to where they end — his rule: at least half of
//   them exactly where they end, the others within a tile, no more than two of those within two tiles (`SETTLED`).
//   Workers, when the game has them, are left out of the count; there are none yet.
// - **Played faster**: from T — never before the fight's first seconds have played, nor once its last seconds begin,
//   so the ending's beats (last seconds, cease fire, result) keep their own pace — the round plays at the
//   `fastForwardSpeed` tuned value times the player's speed, labelled "Fast forward"; any key or click returns it to
//   normal speed for the rest of the round (`PulsePresenter`).
//
// Presentation only, like every other thing the screen does with the clock: it changes which instant of the resolved
// round is drawn when, never what the round did (`docs/system-design/architecture.md`, the three worlds).

import type { MatchState } from "../engine/state/types.ts"
import type { ContentRegistry } from "../content/index.ts"
import type { DomainEvent } from "../engine/events/types.ts"
import type { EndingTimes } from "./ending.ts"
import { openingEndMs } from "./ending.ts"
import type { PulseTimeline } from "./snapshot.ts"

/** The owner's rule for "close to the final state", as named numbers: the share of units that must stand exactly
 *  where they end, how near the rest must be, and how many may be a step further. Distances are in tiles, a diagonal
 *  step counting one. */
export const SETTLED = {
  /** At least this share of the units exactly where they end: "half units at the exact destination". */
  exactShare: 0.5,
  /** Every other unit within this many tiles of where it ends: "other units within 1 tile". */
  nearTiles: 1,
  /** ... save at most `farMost` of them, within this many: "no more than 2 units within 2 tiles". */
  farTiles: 2,
  farMost: 2,
} as const

/** What counts as a hit, of either side: a shot or blow started, damage done, a death, a blast, a building down. A heal
 *  is not one. */
const HITS: ReadonlySet<DomainEvent["kind"]> = new Set(["attack.launched", "damage.applied", "entity.died", "entity.detonated", "structure.destroyed"])

/** The units the rule counts: every unit (a structure stands still, and a 400-point Nexus is not a unit) of either
 *  side. Workers, when they exist, are left out here: they keep moving and collecting. */
function counted(state: MatchState, registry: ContentRegistry): MatchState["entities"] {
  return state.entities.filter((entity) => registry.has(entity.contentId) && registry.get(entity.contentId).layer !== "obstacles")
}

/** How far apart two tiles are, a diagonal step counting one. */
const tilesApart = (a: Readonly<{ x: number; y: number }>, b: Readonly<{ x: number; y: number }>): number => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))

/**
 * Whether the units at `now` stand close enough to where they stand in `final`, by the owner's rule (`SETTLED`). A unit
 * of `final` not on the battlefield at `now` (one trained since) is as far as can be.
 */
export function closeToFinal(now: MatchState, final: MatchState, registry: ContentRegistry): boolean {
  const ending = counted(final, registry)
  if (ending.length === 0) return true
  const at = new Map(counted(now, registry).map((entity) => [entity.ordinal, entity.anchor]))
  let exact = 0
  let far = 0
  for (const entity of ending) {
    const was = at.get(entity.ordinal)
    const apart = was === undefined ? Number.POSITIVE_INFINITY : tilesApart(was, entity.anchor)
    if (apart === 0) exact += 1
    else if (apart <= SETTLED.nearTiles) continue
    else if (apart <= SETTLED.farTiles) far += 1
    else return false
  }
  return exact >= ending.length * SETTLED.exactShare && far <= SETTLED.farMost
}

/**
 * **The tick from which the round has settled**, or `null` for a round that never does: the first tick that is a whole
 * in-game second into the round, from which no hit of either side comes to the round's end, with the units then close
 * to where they end (`closeToFinal`). `states[t]` is the state at the end of tick `t`.
 */
export function settledTick(timeline: PulseTimeline): number | null {
  const { states, events, registry } = timeline
  const final = states[states.length - 1]
  if (final === undefined) return null
  const lastTick = states.length - 1
  const lastHit = events.reduce((latest, event) => (HITS.has(event.kind) ? Math.max(latest, event.tick) : latest), -1)
  const every = Math.max(1, timeline.ticksPerSecond)
  // The first whole second at or after the last hit: no hit comes after it.
  for (let tick = Math.max(0, Math.ceil(lastHit / every) * every); tick <= lastTick; tick += every) {
    const now = states[tick]
    if (now !== undefined && closeToFinal(now, final, registry)) return tick
  }
  return null
}

/** When the round plays fast, on the fight's own clock (`PulsePresenter.timeMs`): from `fromMs` until `untilMs`. */
export type FastForwardWindow = Readonly<{ fromMs: number; untilMs: number }>

/** How much of the fight there must be left to skip for fast forward to be worth a label: one in-game second. */
export const FAST_FORWARD_LEAST_MS = 1000

/**
 * The part of the fight that plays fast, or `null` for none: from the tick it settled — but not before the fight's
 * first seconds have played — until its last seconds begin (or the shooting stops, with no last seconds).
 */
export function fastForwardWindow(settled: number | null, tickDurationMs: number, times: EndingTimes): FastForwardWindow | null {
  if (settled === null) return null
  const fromMs = Math.max(settled * tickDurationMs, openingEndMs(times) ?? 0)
  const untilMs = times.warnMs ?? times.stopMs
  return untilMs - fromMs >= FAST_FORWARD_LEAST_MS ? { fromMs, untilMs } : null
}

/**
 * How far the fight's clock moves in `elapsedMs` of real time at `speed` (the player's), from `timeMs`: `factor` times
 * as far inside the window, as far as ever outside it, a step that crosses an edge split there.
 */
export function fastForwardStep(timeMs: number, elapsedMs: number, speed: number, window: FastForwardWindow | null, factor: number): number {
  if (window === null || elapsedMs <= 0) return Math.max(0, elapsedMs) * speed
  let time = timeMs
  let left = elapsedMs
  // Before the window: at the plain pace up to its start.
  if (time < window.fromMs) {
    const reach = Math.min(left, (window.fromMs - time) / speed)
    time += reach * speed
    left -= reach
  }
  // Inside it: fast up to its end.
  if (left > 0 && time >= window.fromMs && time < window.untilMs) {
    const reach = Math.min(left, (window.untilMs - time) / (speed * factor))
    time += reach * speed * factor
    left -= reach
  }
  // After it: the plain pace again.
  time += Math.max(0, left) * speed
  return time - timeMs
}
