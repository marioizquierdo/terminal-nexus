// Loading a `.map.json` file from disk — the JSON-serialized form of a `ScenarioDefinition`
// (./types.ts). Same shape, different container: a checked-in test scenario, a campaign level, and
// a map-editor-authored map are all going to be one of these files eventually
// (specs/replay-format.md's `ReplaySetup.map` is the same idea one layer up, for a whole replay).
//
// JSON gives up the `.ts` scenario's ability to carry an inline `//` comment next to a tricky row,
// but nothing in `ScenarioDefinition` is a function or otherwise unrepresentable in JSON, so the
// loader below is a parse and a shape check, not a reimplementation of `loadScenario`'s validation
// (dimension mismatch, unknown legend key, overlapping footprint — src/scenario/load.ts already
// does all of that once the file is a plain object).

import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import type { ScenarioDefinition } from "./types.ts"

export class MapFileError extends Error {}

const REQUIRED_KEYS: readonly (keyof ScenarioDefinition)[] = [
  "id",
  "name",
  "grid",
  "seed",
  "pulseTicks",
  "terrain",
  "terrainLegend",
  "placements",
  "placementLegend",
]

export const MAP_FILE_SUFFIX = ".map.json"

/**
 * `path` may name the file exactly or omit the `.map.json` suffix — `grid scenarios/ravel-cascade`
 * and `grid scenarios/ravel-cascade.map.json` both resolve to the same file.
 */
export function resolveMapPath(path: string): string {
  const direct = resolve(path)
  if (existsSync(direct)) return direct
  if (!path.endsWith(MAP_FILE_SUFFIX)) {
    const withSuffix = resolve(`${path}${MAP_FILE_SUFFIX}`)
    if (existsSync(withSuffix)) return withSuffix
    throw new MapFileError(`no map file at "${direct}" or "${withSuffix}"`)
  }
  throw new MapFileError(`no map file at "${direct}"`)
}

function fail(resolved: string, message: string): never {
  throw new MapFileError(`${resolved}: ${message}`)
}

export async function loadMapFile(path: string): Promise<ScenarioDefinition> {
  const resolved = resolveMapPath(path)
  const text = await readFile(resolved, "utf8")

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    fail(resolved, `invalid JSON (${String(error)})`)
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    fail(resolved, "expected a JSON object")
  }

  for (const key of REQUIRED_KEYS) {
    if (!(key in (parsed as Record<string, unknown>))) {
      fail(resolved, `missing required field "${key}"`)
    }
  }

  return parsed as ScenarioDefinition
}
