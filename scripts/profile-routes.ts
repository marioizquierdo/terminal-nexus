#!/usr/bin/env node
// What a tick costs, and proof that a change to how routes are worked out changed no outcome (F203).
//
//   node scripts/profile-routes.ts [--duels N] [--first-duel K] [--seeds 1,2] [--maps route|all|none] [--detail]
//                                  [--out <file>]
//
// Plays every map in `scenarios/` (or only the route scenarios) on the seeds given, and N duels on the Crossing
// (Commander pairs by the scripted players, eight rounds at most), timing each tick by the processor time it took and
// fingerprinting each battle: the SHA-256 of every event it emitted, in order, and of its last state. Prints the
// fingerprints, then how long a tick took by how many units stood in it. `--out` writes the fingerprints as JSON;
// run it before and after a change and compare the two files with `diff`: one differing line is one battle whose
// outcome moved. The clock is read here, around `stepTick`, never inside the kernel.

import { createHash } from "node:crypto"
import { readdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { briefOf, newDuel, playRound, scriptedPlayer } from "../src/duel/index.ts"
import type { DuelSetup, Side, SidePlan } from "../src/duel/index.ts"
import { contextFor, stepTick } from "../src/pulse/index.ts"
import { loadScenario } from "../src/scenario/load.ts"
import { loadMapFile } from "../src/scenario/load-map-file.ts"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import { hashState } from "../src/state/serialize.ts"
import type { MatchState } from "../src/state/types.ts"
import type { DomainEvent } from "../src/events/types.ts"
import { TickRoutes } from "../src/pulse/routes.ts"
import { DistanceField } from "../src/routing/index.ts"

const args = process.argv.slice(2)
const option = (name: string, fallback: string): string => {
  const at = args.indexOf(`--${name}`)
  return at === -1 ? fallback : (args[at + 1] ?? fallback)
}
const seeds = option("seeds", "1,2").split(",").map(Number)
const duelCount = Number(option("duels", "6"))
/** Which duel of the sequence to start from, so a long run can be split across processes. */
const firstDuel = Number(option("first-duel", "0"))
const maps = option("maps", "all")
const out = option("out", "")

/** The processor time this process has spent, in milliseconds: steadier than the wall clock on a machine busy with
 *  other work, which is when a profile is usually taken. */
const clock = (): number => {
  const used = process.cpuUsage()
  return (used.user + used.system) / 1000
}

/** Ticks timed, bucketed by how many entities stood as the tick began. */
const buckets = new Map<number, { ticks: number; ms: number; worst: number }>()
const BUCKET = 25
function timed(units: number, ms: number): void {
  const key = Math.floor(units / BUCKET) * BUCKET
  const bucket = buckets.get(key) ?? { ticks: 0, ms: 0, worst: 0 }
  bucket.ticks += 1
  bucket.ms += ms
  bucket.worst = Math.max(bucket.worst, ms)
  buckets.set(key, bucket)
}

/**
 * `--detail`: each of the tick's route questions (`TickRoutes`) wrapped in a timer and a counter, and the fields each
 * tick built counted with what they settled. Inclusive times: a field built inside `nearestReachable` counts there and
 * in whatever asked it. Off by default, as the wrapping costs time of its own.
 */
const detail = args.includes("--detail")
const asked = new Map<string, { calls: number; ms: number }>()
const fieldsSeen = new Set<DistanceField>()
let fieldsBuilt = 0
let anchorsSettled = 0
if (detail) {
  const proto = TickRoutes.prototype as unknown as Record<string, (...rest: unknown[]) => unknown>
  for (const name of ["fieldOf", "groundOf", "weightsOf", "dangerOf", "safetyOf", "detourOf", "nearestReachable", "breachOf", "patchesOf"]) {
    const original = proto[name] as (...rest: unknown[]) => unknown
    let depth = 0
    proto[name] = function (this: unknown, ...rest: unknown[]): unknown {
      depth += 1
      const began = performance.now()
      try {
        const result = original.apply(this, rest)
        const field = result instanceof DistanceField ? result : (result as { field?: unknown } | null)?.field
        if (field instanceof DistanceField) fieldsSeen.add(field)
        return result
      } finally {
        depth -= 1
        if (depth === 0) {
          const entry = asked.get(name) ?? { calls: 0, ms: 0 }
          entry.calls += 1
          entry.ms += performance.now() - began
          asked.set(name, entry)
        }
      }
    }
  }
}
/** Counts the fields the tick just played built, and what they settled. */
function tickDone(): void {
  if (!detail) return
  fieldsBuilt += fieldsSeen.size
  for (const field of fieldsSeen) anchorsSettled += field.settledCount
  fieldsSeen.clear()
}

const fingerprints: Record<string, string> = {}
let totalMs = 0
let totalTicks = 0

/** One battle's fingerprint: its events, in order, and its last state. */
class Fingerprint {
  private readonly hash = createHash("sha256")
  add(events: readonly DomainEvent[]): void {
    for (const event of events) this.hash.update(JSON.stringify(event))
  }
  done(last: MatchState): string {
    return `${this.hash.digest("hex").slice(0, 16)} ${hashState(last).slice(0, 16)}`
  }
}

if (maps !== "none") {
  const names = readdirSync("scenarios").filter((name) => name.endsWith(".map.json") && (maps === "all" || name.startsWith("route-"))).sort()
  for (const name of names) {
    const scenario = await loadMapFile(join("scenarios", name))
    for (const seed of seeds) {
      const loaded = loadScenario(scenario, { registry: FIXTURE_REGISTRY, seed })
      const context = contextFor(loaded.state, loaded.registry, scenario.pulseTicks)
      const print = new Fingerprint()
      let state = loaded.state
      while (state.outcome === null && state.tick < scenario.pulseTicks) {
        const units = state.entities.length
        const began = clock()
        const step = stepTick(state, context)
        const ms = clock() - began
        timed(units, ms)
        totalMs += ms
        totalTicks += 1
        tickDone()
        state = step.state
        print.add(step.events)
      }
      fingerprints[`map ${scenario.id} seed ${seed}`] = print.done(state)
    }
  }
}

const PAIRS: readonly (readonly [string, string])[] = [
  ["vasse", "averno"],
  ["averno", "dob"],
  ["dob", "vasse"],
]
const PLAYERS = ["balanced", "rush", "turtle"]
for (let n = firstDuel; n < firstDuel + duelCount; n += 1) {
  const [a, b] = PAIRS[n % PAIRS.length] as readonly [string, string]
  const playerName = PLAYERS[Math.floor(n / PAIRS.length) % PLAYERS.length] as string
  const player = scriptedPlayer(playerName)
  if (player === undefined) throw new Error(playerName)
  const seed = 1 + Math.floor(n / (PAIRS.length * PLAYERS.length))
  const setup: DuelSetup = { map: "crossing", seed, rounds: 8, pulseTicks: 600, commanders: { A: a, B: b } }
  let duel = newDuel(setup)
  while (duel.result === null) {
    const plans: Record<Side, SidePlan> = { A: player(briefOf(duel, "A").data), B: player(briefOf(duel, "B").data) }
    const print = new Fingerprint()
    let last: MatchState | null = null
    let began = 0
    let units = 0
    const round = duel.round
    duel = playRound(duel, plans, (battle, events) => {
      if (last !== null) {
        const ms = clock() - began
        timed(units, ms)
        totalMs += ms
        totalTicks += 1
        tickDone()
      }
      print.add(events)
      last = battle
      units = battle.entities.length
      began = clock()
    }).state
    fingerprints[`duel ${a}-${b} ${playerName} seed ${seed} round ${round}`] = print.done(last as unknown as MatchState)
  }
}

for (const [name, print] of Object.entries(fingerprints)) process.stdout.write(`${print}  ${name}\n`)
process.stdout.write(`\n${totalTicks} ticks, ${totalMs.toFixed(0)} ms, ${(totalMs / Math.max(1, totalTicks)).toFixed(3)} ms a tick\n`)
process.stdout.write("entities   ticks   ms a tick   worst\n")
for (const [key, bucket] of [...buckets].sort((x, y) => x[0] - y[0])) {
  process.stdout.write(`${String(key).padStart(4)}-${String(key + BUCKET - 1).padEnd(4)} ${String(bucket.ticks).padStart(7)} ${(bucket.ms / bucket.ticks).toFixed(3).padStart(11)} ${bucket.worst.toFixed(1).padStart(7)}\n`)
}
if (detail) {
  process.stdout.write(`\n${fieldsBuilt} fields asked for, ${(fieldsBuilt / Math.max(1, totalTicks)).toFixed(1)} a tick; ${anchorsSettled} anchors settled, ${(anchorsSettled / Math.max(1, totalTicks)).toFixed(0)} a tick\n`)
  process.stdout.write("question            calls     ms\n")
  for (const [name, entry] of [...asked].sort((x, y) => y[1].ms - x[1].ms)) process.stdout.write(`${name.padEnd(18)} ${String(entry.calls).padStart(7)} ${entry.ms.toFixed(0).padStart(6)}\n`)
}
if (out !== "") writeFileSync(out, `${JSON.stringify(fingerprints, null, 2)}\n`)
