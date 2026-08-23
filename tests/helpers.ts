// Shared test scaffolding. Not a test file itself: the runners only pick up `*.test.ts`.

import { readdirSync } from "node:fs"
import { dirname, join, resolve as resolvePath } from "node:path"
import { fileURLToPath } from "node:url"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import type { ContentRegistry } from "../src/content/index.ts"
import { resolvePulse } from "../src/pulse/index.ts"
import type { PulseRun } from "../src/pulse/index.ts"
import { loadMapFile, loadScenario } from "../src/scenario/index.ts"
import type { ScenarioDefinition } from "../src/scenario/index.ts"
import type { ReportInput } from "../src/report/index.ts"

export const REPO_ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..")

/**
 * Bun's `node:test` shim does not implement `t.skip()`, so a test that only applies to one runtime
 * is registered conditionally rather than skipped. Both branches assert something true.
 */
export const RUNTIME_IS_BUN = (globalThis as { Bun?: unknown }).Bun !== undefined
export const SCENARIO_DIR = join(REPO_ROOT, "scenarios")

export function scenarioFiles(): string[] {
  return readdirSync(SCENARIO_DIR)
    .filter((name) => name.endsWith(".map.json"))
    .sort()
}

export async function loadScenarioFile(name: string): Promise<ScenarioDefinition> {
  return loadMapFile(join(SCENARIO_DIR, name))
}

export type Resolved = Readonly<{
  scenario: ScenarioDefinition
  registry: ContentRegistry
  run: PulseRun
}>

export async function resolveScenario(
  name: string,
  overrides: Readonly<{ seed?: number; ticks?: number }> = {},
): Promise<Resolved> {
  const scenario = await loadScenarioFile(name)
  const seed = overrides.seed ?? scenario.seed
  const pulseTicks = overrides.ticks ?? scenario.pulseTicks
  const loaded = loadScenario(scenario, { registry: FIXTURE_REGISTRY, seed })
  const run = resolvePulse({
    initialState: loaded.state,
    registry: loaded.registry,
    pulseTicks,
    seed,
  })
  return { scenario, registry: loaded.registry, run }
}

export function reportInputOf(resolved: Resolved): ReportInput {
  return {
    scenarioId: resolved.scenario.id,
    seed: resolved.run.seed,
    pulseTicks: resolved.run.pulseTicks,
    registry: resolved.registry,
    events: resolved.run.events,
    finalState: resolved.run.finalState,
    stateHash: resolved.run.stateHash,
    eventsHash: resolved.run.eventsHash,
  }
}

/** Every scenario in the repository, resolved once — the regression suite's raw material. */
export async function resolveAllScenarios(): Promise<Resolved[]> {
  const resolved: Resolved[] = []
  for (const name of scenarioFiles()) resolved.push(await resolveScenario(name))
  return resolved
}
