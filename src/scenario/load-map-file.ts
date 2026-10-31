// Loading a `.map.json` file from disk — the JSON-serialized form of a `ScenarioDefinition`
// (./types.ts). Same shape, different container: a checked-in test scenario, a campaign level, and
// a map-editor-authored map are all going to be one of these files eventually
// (docs/system-design/replay-format.md's `ReplaySetup.map` is the same idea one layer up, for a whole replay).
//
// JSON gives up the `.ts` scenario's ability to carry an inline `//` comment next to a tricky row,
// but nothing in `ScenarioDefinition` is a function or otherwise unrepresentable in JSON, so the
// loader below is a parse and a shape check, not a reimplementation of `loadScenario`'s validation
// (dimension mismatch, unknown legend key, overlapping footprint — src/scenario/load.ts already
// does all of that once the file is a plain object).

import { existsSync, readdirSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { basename, dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
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
]

export const MAP_FILE_SUFFIX = ".map.json"

/** The checked-in maps' folder: `scenarios/` at the repository's root, wherever the command is run from. */
export const SCENARIOS_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../scenarios")

/**
 * Every checked-in map, as `{ id, path }`, sorted by id: the `.map.json` files anywhere under `scenarios/`, one folder
 * per purpose (rules, units, movement, engage, showcase — docs/system-design/testing-ground.md). A map's id is its file
 * name, unique across the folders, so a map moves between folders without anything that names it changing.
 */
export function mapCatalog(root: string = SCENARIOS_ROOT): readonly Readonly<{ id: string; path: string; folder: string }>[] {
  const found: { id: string; path: string; folder: string }[] = []
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (entry.name.endsWith(MAP_FILE_SUFFIX)) {
        found.push({ id: entry.name.slice(0, -MAP_FILE_SUFFIX.length), path, folder: relative(root, directory) })
      }
    }
  }
  if (existsSync(root)) walk(root)
  return found.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/**
 * `path` may name the file exactly, omit the `.map.json` suffix, or be a checked-in map's bare id —
 * `grid scenarios/rules/ravel-cascade.map.json`, `grid scenarios/rules/ravel-cascade` and `grid ravel-cascade` all
 * resolve to the same file. A path whose file is not there falls back to its last part as an id, so a path written
 * before the maps moved into folders (`scenarios/ravel-cascade`) still finds it.
 */
export function resolveMapPath(path: string): string {
  const direct = resolve(path)
  if (existsSync(direct)) return direct
  const withSuffix = path.endsWith(MAP_FILE_SUFFIX) ? direct : resolve(`${path}${MAP_FILE_SUFFIX}`)
  if (existsSync(withSuffix)) return withSuffix
  const id = basename(path).replace(/\.map\.json$/, "")
  const listed = mapCatalog().find((entry) => entry.id === id)
  if (listed !== undefined) return listed.path
  throw new MapFileError(`no map file at "${direct}"${withSuffix === direct ? "" : ` or "${withSuffix}"`}, and no checked-in map with the id "${id}"`)
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
