// Shared test scaffolding. Not a test file itself: the runners only pick up `*.test.ts`.

import { dirname, join, resolve as resolvePath } from "node:path"
import { fileURLToPath } from "node:url"
import { FIXTURE_REGISTRY } from "../src/content/index.ts"
import type { ContentRegistry } from "../src/content/index.ts"
import { resolvePulse } from "../src/pulse/index.ts"
import type { PulseRun } from "../src/pulse/index.ts"
import { loadMapFile, loadScenario, mapCatalog } from "../src/scenario/index.ts"
import type { ScenarioDefinition } from "../src/scenario/index.ts"
import type { ReportInput } from "../src/report/index.ts"

export const REPO_ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..")

/**
 * Bun's `node:test` shim does not implement `t.skip()`, so a test that only applies to one runtime
 * is registered conditionally rather than skipped. Both branches assert something true.
 */
export const RUNTIME_IS_BUN = (globalThis as { Bun?: unknown }).Bun !== undefined
export const SCENARIO_DIR = join(REPO_ROOT, "scenarios")

/** Every checked-in map's file name (`melee-kill.map.json`), from every folder under `scenarios/`, sorted. */
export function scenarioFiles(): string[] {
  return mapCatalog(SCENARIO_DIR).map((entry) => `${entry.id}.map.json`)
}

/** A checked-in map by its file name, whichever folder it is in. */
export async function loadScenarioFile(name: string): Promise<ScenarioDefinition> {
  return loadMapFile(name)
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

/** The numeric SGR parameters of every `ESC [ ... m` in an ANSI string, in order — what a terminal is told
 *  about colour and weight. */
export function sgrCodes(ansi: string): number[] {
  return [...ansi.matchAll(/\u001b\[([0-9;]*)m/g)].flatMap((match) => (match[1] ?? "").split(";").filter(Boolean).map(Number))
}

/** The SGR parameters that are not part of a colour: bold, faint, underline, reverse video, the default-colour
 *  resets. A 256-colour or truecolor setter's own numbers (`38;5;n`, `48;2;r;g;b`) are skipped over whole, since
 *  a `2` in `38;2;...` is the colour's kind and not the attribute faint. */
export function sgrAttributes(ansi: string): number[] {
  const attributes: number[] = []
  for (const match of ansi.matchAll(/\u001b\[([0-9;]*)m/g)) {
    const params = (match[1] ?? "").split(";").filter(Boolean).map(Number)
    for (let at = 0; at < params.length; at += 1) {
      const code = params[at] ?? 0
      if (code === 38 || code === 48) at += params[at + 1] === 2 ? 4 : 2
      else attributes.push(code)
    }
  }
  return attributes
}

/** Whether an SGR parameter sets a colour (foreground or background, standard or bright) — as opposed to
 *  bold, dim or reversed video, which monochrome keeps. */
export const isColourCode = (code: number): boolean => (code >= 30 && code <= 49) || (code >= 90 && code <= 107)
