// The kernel and content a trial is played by, loaded from a build's folder (docs/system-design/testing-ground.md,
// comparing two builds): this repository's own, or another commit's checked out beside it (`grid <trial> --against
// <ref>`). Only the kernel, the content and the scenario loader come from that folder; the trial, its variants and
// the battle's record are this build's, so both sides of a comparison are asked the same question the same way.
// The kernel imports nothing but itself, so a bare checkout needs no install to be played.

import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import type { Engine } from "../measure/trial.ts"

type Constructor = abstract new (...args: never[]) => unknown

export type LoadedEngine = Readonly<{ engine: Engine; routes?: Constructor; fields?: Constructor }>

/** This repository's root: what `--against` compares with. */
export const OWN_ROOT = resolve(import.meta.dirname, "../..")

/** The engine in the build at `root`, with the route classes a profile wraps when that build has them. */
export async function loadEngine(root: string): Promise<LoadedEngine> {
  const at = (path: string): string => pathToFileURL(resolve(root, path)).href
  const content = (await import(at("src/content/index.ts"))) as { FIXTURE_REGISTRY: Engine["registry"] }
  const scenario = (await import(at("src/scenario/load.ts"))) as { loadScenario: Engine["loadScenario"] }
  const pulse = (await import(at("src/pulse/index.ts"))) as { contextFor: Engine["contextFor"]; stepTick: Engine["stepTick"] }
  const optional = async (path: string, name: string): Promise<Constructor | undefined> => {
    try {
      return ((await import(at(path))) as Record<string, Constructor | undefined>)[name]
    } catch {
      return undefined
    }
  }
  const routes = await optional("src/pulse/routes.ts", "TickRoutes")
  const fields = await optional("src/routing/index.ts", "DistanceField")
  return {
    engine: { registry: content.FIXTURE_REGISTRY, loadScenario: scenario.loadScenario, contextFor: pulse.contextFor, stepTick: pulse.stepTick },
    ...(routes === undefined ? {} : { routes }),
    ...(fields === undefined ? {} : { fields }),
  }
}
