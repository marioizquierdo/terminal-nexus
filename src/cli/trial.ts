// `grid`'s trials (docs/system-design/testing-ground.md): a trial file (`scenarios/trials/*.trial.json`) or one map
// played over many seeds (`grid <map> --seeds 1-12`), as it is and as the command line's variant changes it; the
// summary printed, the battles written down with `--out`. What a trial plays and says is `src/measure/trial.ts`'s;
// this reads the files and the command line, and prints.

import { existsSync, readdirSync } from "node:fs"
import { readFile, writeFile } from "node:fs/promises"
import { basename, join, resolve } from "node:path"
import type { TrialBattle, TrialSpec } from "../measure/trial.ts"
import { onTopOf, parseSeeds, playTrial, standingLines, trialCells, trialLines, unmet } from "../measure/trial.ts"
import { loadMapFile, SCENARIOS_ROOT } from "../scenario/load-map-file.ts"
import type { ScenarioDefinition } from "../scenario/types.ts"
import type { Variant } from "../scenario/variant.ts"
import { VariantError } from "../scenario/variant.ts"
import type { PlayerId, TargetArea } from "../state/types.ts"
import type { ParsedArgs } from "./args.ts"

export const TRIAL_FILE_SUFFIX = ".trial.json"
export const TRIALS_ROOT = join(SCENARIOS_ROOT, "trials")

/** The checked-in trials, as `{ id, path }`, sorted. */
export function trialCatalog(root: string = TRIALS_ROOT): { id: string; path: string }[] {
  if (!existsSync(root)) return []
  return readdirSync(root)
    .filter((name) => name.endsWith(TRIAL_FILE_SUFFIX))
    .sort()
    .map((name) => ({ id: name.slice(0, -TRIAL_FILE_SUFFIX.length), path: join(root, name) }))
}

/** A trial file's path from a path or a checked-in trial's id, or `null` when it names none. */
export function trialPath(path: string): string | null {
  if (path.endsWith(TRIAL_FILE_SUFFIX) && existsSync(resolve(path))) return resolve(path)
  const id = basename(path).replace(/\.trial\.json$/, "")
  return trialCatalog().find((entry) => entry.id === id)?.path ?? null
}

const TRIAL_KEYS = new Set(["id", "question", "notes", "maps", "seeds", "shuffle", "swap", "variants", "armies", "base", "expect"])

/** A trial file read and checked: its seeds may be written `"1-12"`. */
export async function loadTrialFile(path: string): Promise<TrialSpec> {
  const parsed = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>
  for (const key of Object.keys(parsed)) if (!TRIAL_KEYS.has(key)) throw new Error(`${path}: no trial field "${key}" (${[...TRIAL_KEYS].join(", ")})`)
  const { id, maps, seeds } = parsed
  if (typeof id !== "string") throw new Error(`${path}: a trial needs an "id"`)
  if (!Array.isArray(maps) || maps.length === 0 || !maps.every((map) => typeof map === "string")) throw new Error(`${path}: "maps" lists map ids`)
  const seedList = typeof seeds === "string" ? parseSeeds(seeds) : Array.isArray(seeds) ? (seeds as number[]) : parseSeeds("1-12")
  return { ...(parsed as unknown as TrialSpec), seeds: seedList }
}

/** `"x,y,w,h"` as a target. */
function areaOf(text: string, option: string): TargetArea {
  const parts = text.split(",").map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) throw new VariantError(`${option} is x,y,width,height, not "${text}"`)
  const [x, y, width, height] = parts as [number, number, number, number]
  return { x, y, width, height }
}

/** `"a=b,c=d"` as pairs, each split at its first `=`. */
function pairsOf(text: string, option: string): Record<string, string> {
  const pairs: Record<string, string> = {}
  for (const part of text.split(",").map((each) => each.trim()).filter((each) => each.length > 0)) {
    const at = part.indexOf("=")
    if (at <= 0) throw new VariantError(`${option} takes name=value pairs, not "${part}"`)
    pairs[part.slice(0, at)] = part.slice(at + 1)
  }
  return pairs
}

/** The options that make a variant of the map, every `grid` action reading them alike. */
export const VARIANT_OPTIONS = ["set", "army-a", "army-b", "tune", "terrain", "target-a", "target-b"] as const

/** The variant the command line asks for, or `null` when it asks for none. */
export function variantFromArgs(args: ParsedArgs): Variant | null {
  const get = (name: string): string | undefined => args.options.get(name)
  const army: Partial<Record<PlayerId, string>> = {}
  const targets: Partial<Record<PlayerId, TargetArea>> = {}
  if (get("army-a") !== undefined) army.A = get("army-a") as string
  if (get("army-b") !== undefined) army.B = get("army-b") as string
  if (get("target-a") !== undefined) targets.A = areaOf(get("target-a") as string, "--target-a")
  if (get("target-b") !== undefined) targets.B = areaOf(get("target-b") as string, "--target-b")
  const variant: Variant = {
    ...(get("set") === undefined ? {} : { set: pairsOf(get("set") as string, "--set") }),
    ...(Object.keys(army).length === 0 ? {} : { army }),
    ...(get("tune") === undefined ? {} : { tune: pairsOf(get("tune") as string, "--tune") }),
    ...(get("terrain") === undefined ? {} : { terrain: pairsOf(get("terrain") as string, "--terrain") }),
    ...(Object.keys(targets).length === 0 ? {} : { targets }),
  }
  return Object.keys(variant).length === 0 ? null : variant
}

/** A trial of one map from the command line: the map as built, and beside it the variant its options ask for. */
export function adHocTrial(scenario: ScenarioDefinition, args: ParsedArgs): TrialSpec {
  const variant = variantFromArgs(args)
  const ticks = args.options.get("ticks")
  const asBuilt: Variant = ticks === undefined ? {} : { ticks: Number(ticks) }
  return {
    id: scenario.id,
    maps: [scenario.id],
    seeds: parseSeeds(args.options.get("seeds") ?? "1-12"),
    shuffle: args.flags.has("shuffle"),
    swap: args.flags.has("swap"),
    variants: variant === null ? { "as built": asBuilt } : { "as built": asBuilt, "as given": { ...variant, ...asBuilt } },
  }
}

/** Plays `spec`, prints its summary (or its cells as JSON), writes its battles to `--out`; 1 when an expectation fails. */
export async function runTrial(spec: TrialSpec, args: ParsedArgs, preloaded?: ScenarioDefinition): Promise<number> {
  // A trial file run with variant options plays every variant with them on top (`--tune runner.maxHp=24`); its
  // `--swap` and `--shuffle` turn those on; `--seeds` plays other seeds.
  const seedsOption = args.options.get("seeds")
  const extra = preloaded === undefined ? variantFromArgs(args) : null
  const played: TrialSpec = {
    ...spec,
    ...(seedsOption === undefined ? {} : { seeds: parseSeeds(seedsOption) }),
    ...(extra === null ? {} : { base: onTopOf(spec.base, extra) }),
    ...(preloaded === undefined && args.flags.has("swap") ? { swap: true } : {}),
    ...(preloaded === undefined && args.flags.has("shuffle") ? { shuffle: true } : {}),
  }
  const maps = new Map<string, ScenarioDefinition>()
  for (const id of played.maps) maps.set(id, preloaded !== undefined && preloaded.id === id ? preloaded : await loadMapFile(id))
  const quiet = args.flags.has("json")
  const battles = playTrial(played, maps, (battle, index, total) => {
    if (!quiet && process.stderr.isTTY === true) process.stderr.write(`\r${index + 1}/${total} ${battle.map} ${battle.variant}`.padEnd(70))
  })
  if (!quiet && process.stderr.isTTY === true) process.stderr.write(`\r${"".padEnd(70)}\r`)
  const cells = trialCells(battles)
  const failures = unmet(played, cells)
  const baselinePath = args.options.get("baseline")
  const baseline = baselinePath === undefined ? undefined : trialCells((JSON.parse(await readFile(baselinePath, "utf8")) as { battles: TrialBattle[] }).battles)
  const out = args.options.get("out")
  if (out !== undefined) await writeFile(out, `${JSON.stringify({ trial: played, cells, battles }, null, 1)}\n`, "utf8")
  if (quiet) process.stdout.write(`${JSON.stringify({ trial: played.id, cells: cells.map(({ lengths: _lengths, ...cell }) => cell), unmet: failures }, null, 1)}\n`)
  else {
    const lines = played.armies !== undefined && baseline === undefined && !args.flags.has("cells") ? standingLines(played, cells) : trialLines(played, cells, baseline)
    if ((played.expect ?? []).length > 0) {
      lines.push("")
      lines.push(failures.length === 0 ? `every expectation held (${played.expect?.length})` : "expectations not met:")
      for (const failure of failures) lines.push(`  ${failure}`)
    }
    process.stdout.write(`${lines.join("\n")}\n`)
  }
  return failures.length === 0 ? 0 : 1
}
