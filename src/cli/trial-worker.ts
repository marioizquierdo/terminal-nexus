#!/usr/bin/env node
// One process's share of a trial (docs/system-design/testing-ground.md): `grid --jobs` and `--against` hand each worker
// a job file — the build to play by, the trial, its maps, which of its battles, whether to measure their cost — and
// read back the battles it wrote, merging them in the trial's own order. A worker plays exactly what one process
// would; splitting a trial changes when its battles are played, never what they are.

import { readFileSync, writeFileSync } from "node:fs"
import { playTrial } from "../measure/trial.ts"
import type { TrialBattle, TrialSpec } from "../measure/trial.ts"
import type { ScenarioDefinition } from "../scenario/types.ts"
import { loadEngine } from "./engine.ts"
import { routeCounter } from "./profile.ts"

/** What a worker is handed. */
export type TrialJob = Readonly<{
  root: string
  spec: TrialSpec
  maps: readonly ScenarioDefinition[]
  only: readonly number[]
  profile: boolean
  out: string
}>

/** What a worker writes back: its battles, each at its index in the trial, and where its route time went. */
export type TrialJobResult = Readonly<{ battles: readonly Readonly<{ index: number; battle: TrialBattle }>[]; questions: Record<string, { calls: number; ms: number }> }>

const job = JSON.parse(readFileSync(process.argv[2] as string, "utf8")) as TrialJob
const { engine, routes, fields } = await loadEngine(job.root)
const counter = job.profile ? routeCounter(() => performance.now(), routes, fields) : null
const battles = playTrial(job.spec, new Map(job.maps.map((map) => [map.id, map])), {
  engine,
  only: job.only,
  ...(counter === null ? {} : { meter: counter.meter }),
})
const result: TrialJobResult = {
  battles: battles.map((battle, at) => ({ index: job.only[at] as number, battle })),
  questions: Object.fromEntries(counter?.questions() ?? []),
}
writeFileSync(job.out, JSON.stringify(result))
