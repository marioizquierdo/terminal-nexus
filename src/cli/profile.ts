// What a battle costs to play (docs/system-design/testing-ground.md, cost): the wall clock around the kernel's ticks,
// and the route work a tick did, counted by wrapping each of the tick's route questions (`TickRoutes`) in a counter
// and a timer, and counting the distance fields they built and the anchors those settled. The counts are the same on
// every machine, so they compare two movement algorithms where the clock only compares two runs on one machine.
//
// A command's, never the kernel's: the clock is read here, and the wrapping is put on the class from outside. It is
// given the classes to wrap, so a trial played by another build's kernel (`--against`) counts that build's routes.

import type { BattleCost, Meter } from "../measure/trial.ts"

/** The route questions a tick asks, wrapped when they exist on the class (an older build may lack some). */
const QUESTIONS = ["fieldOf", "groundOf", "weightsOf", "dangerOf", "safetyOf", "detourOf", "nearestReachable", "breachOf", "patchesOf"] as const

type Constructor = abstract new (...args: never[]) => unknown

/** Where route time went, over every battle measured: each question's calls and inclusive milliseconds. */
export type RouteQuestions = ReadonlyMap<string, Readonly<{ calls: number; ms: number }>>

export type RouteCounter = Readonly<{
  /** A meter for one battle at a time: the clock, and the route work since `begin`. */
  meter: Meter
  questions(): RouteQuestions
}>

/**
 * Wraps `routes`' questions (a `TickRoutes` class) to count calls and time, and the `fields` (a `DistanceField` class)
 * they return; `clock` reads milliseconds. With no `routes`, the meter times battles alone.
 */
export function routeCounter(clock: () => number, routes?: Constructor, fields?: Constructor): RouteCounter {
  const asked = new Map<string, { calls: number; ms: number }>()
  const seen = new Set<{ settledCount?: number }>()
  if (routes !== undefined) {
    const proto = routes.prototype as Record<string, unknown>
    for (const name of QUESTIONS) {
      const original = proto[name]
      if (typeof original !== "function" || (original as { counted?: true }).counted === true) continue
      let depth = 0
      const wrapped = function (this: unknown, ...rest: unknown[]): unknown {
        depth += 1
        const began = clock()
        try {
          const result = (original as (...args: unknown[]) => unknown).apply(this, rest)
          const field = fields !== undefined && result instanceof fields ? result : (result as { field?: unknown } | null)?.field
          if (fields !== undefined && field instanceof fields) seen.add(field as { settledCount?: number })
          return result
        } finally {
          depth -= 1
          if (depth === 0) {
            const entry = asked.get(name) ?? { calls: 0, ms: 0 }
            entry.calls += 1
            entry.ms += clock() - began
            asked.set(name, entry)
          }
        }
      }
      ;(wrapped as { counted?: true }).counted = true
      proto[name] = wrapped
    }
  }
  let began = 0
  let fieldsBuilt = 0
  let settled = 0
  const meter: Meter = {
    begin() {
      seen.clear()
      fieldsBuilt = 0
      settled = 0
      began = clock()
    },
    end(ticks: number): BattleCost {
      const ms = clock() - began
      // A field is built once and asked for many times in a tick; counted once for each battle it served.
      fieldsBuilt = seen.size
      for (const field of seen) settled += field.settledCount ?? 0
      return routes === undefined ? { ms, ticks } : { ms, ticks, fields: fieldsBuilt, settled }
    },
  }
  return { meter, questions: () => asked }
}

/** Where the route time went, the costliest question first. */
export function questionLines(questions: RouteQuestions): string[] {
  if (questions.size === 0) return []
  const total = [...questions.values()].reduce((sum, entry) => sum + entry.ms, 0)
  return [
    "route questions, every battle together (inclusive: a field built inside one question counts in what asked it)",
    ...[...questions]
      .sort((a, b) => b[1].ms - a[1].ms)
      .map(([name, entry]) => `  ${name.padEnd(18)} ${String(entry.calls).padStart(9)} calls ${entry.ms.toFixed(0).padStart(7)} ms ${`${Math.round((entry.ms / Math.max(total, 1)) * 100)}%`.padStart(5)}`),
  ]
}
