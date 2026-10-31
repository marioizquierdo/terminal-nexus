// `grid`'s trials (docs/system-design/testing-ground.md): a trial file (`scenarios/trials/*.trial.json`) or one map
// played over many seeds (`grid <map> --seeds 1-12`), as it is and as the command line's variant changes it. The
// summary printed; the battles written down with `--out`, set against a file written before with `--baseline`, or
// against another build played there and then with `--against <ref>`; split across processes with `--jobs`; what a
// tick cost with `--profile`. What a trial plays and says is `src/measure/trial*.ts`'s; this reads the files and the
// command line, runs the processes and prints.

import { spawn, spawnSync } from "node:child_process"
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, join, resolve } from "node:path"
import type { TrialBattle, TrialSpec } from "../measure/trial.ts"
import { onTopOf, parseSeeds, playTrial, trialRuns } from "../measure/trial.ts"
import type { TrialCell } from "../measure/trial-cells.ts"
import { notableBattles, trialCells, unmet } from "../measure/trial-cells.ts"
import { standingLines, trialLines } from "../measure/trial-summary.ts"
import { OWN_ROOT } from "./engine.ts"
import { questionLines, routeCounter } from "./profile.ts"
import type { RouteQuestions } from "./profile.ts"
import { TickRoutes } from "../pulse/routes.ts"
import { DistanceField } from "../routing/index.ts"
import type { TrialJob, TrialJobResult } from "./trial-worker.ts"
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

/** Battles played, and where their route time went when profiled. */
type Played = Readonly<{ battles: TrialBattle[]; questions: RouteQuestions }>

const WORKER = resolve(import.meta.dirname, "trial-worker.ts")

/**
 * Plays `spec` by the build at `root`: in this process when it is this build and one job is asked, else split across
 * `jobs` worker processes, each its share of the battles, merged back in the trial's order.
 */
async function playBy(root: string, spec: TrialSpec, maps: ReadonlyMap<string, ScenarioDefinition>, jobs: number, profile: boolean, progress: (done: number, total: number) => void): Promise<Played> {
  const total = trialRuns(spec).length
  if (root === OWN_ROOT && jobs <= 1) {
    const counter = profile ? routeCounter(() => performance.now(), TickRoutes, DistanceField) : null
    const battles = playTrial(spec, maps, {
      each: (_, index) => progress(index + 1, total),
      ...(counter === null ? {} : { meter: counter.meter }),
    })
    return { battles, questions: counter?.questions() ?? new Map() }
  }
  const dir = mkdtempSync(join(tmpdir(), "trial-"))
  try {
    const shares = Array.from({ length: Math.max(1, Math.min(jobs, total)) }, (_, at) => [...Array(total).keys()].filter((index) => index % Math.max(1, Math.min(jobs, total)) === at))
    let done = 0
    const results = await Promise.all(
      shares.map(async (only, at) => {
        const job: TrialJob = { root, spec, maps: [...maps.values()], only, profile, out: join(dir, `part-${at}.json`) }
        const file = join(dir, `job-${at}.json`)
        writeFileSync(file, JSON.stringify(job))
        await new Promise<void>((resolveRun, reject) => {
          const child = spawn(process.execPath, [WORKER, file], { stdio: ["ignore", "inherit", "inherit"] })
          child.on("error", reject)
          child.on("exit", (code) => (code === 0 ? resolveRun() : reject(new Error(`trial worker ${at} exited with ${code}`))))
        })
        done += only.length
        progress(done, total)
        return JSON.parse(readFileSync(job.out, "utf8")) as TrialJobResult
      }),
    )
    const battles = results.flatMap((result) => result.battles).sort((a, b) => a.index - b.index).map((each) => each.battle)
    const questions = new Map<string, { calls: number; ms: number }>()
    for (const result of results) {
      for (const [name, entry] of Object.entries(result.questions)) {
        const sum = questions.get(name) ?? { calls: 0, ms: 0 }
        questions.set(name, { calls: sum.calls + entry.calls, ms: sum.ms + entry.ms })
      }
    }
    return { battles, questions }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** `ref` checked out beside this repository, handed to `use`, removed after. */
async function withCheckout<T>(ref: string, use: (root: string) => Promise<T>): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), "against-"))
  const git = (args: string[]): void => {
    const run = spawnSync("git", args, { cwd: OWN_ROOT, encoding: "utf8" })
    if (run.status !== 0) throw new Error(`git ${args.join(" ")}: ${run.stderr.trim()}`)
  }
  git(["worktree", "add", "--detach", "--quiet", dir, ref])
  try {
    return await use(dir)
  } finally {
    git(["worktree", "remove", "--force", dir])
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
  const profile = args.flags.has("profile")
  const jobs = Number(args.options.get("jobs") ?? "1")
  if (!Number.isInteger(jobs) || jobs < 1) throw new Error(`--jobs is a whole number from 1, not "${args.options.get("jobs")}"`)
  const tty = !quiet && process.stderr.isTTY === true
  const progress = (label: string) => (done: number, total: number) => {
    if (tty) process.stderr.write(`\r${label} ${done}/${total}`.padEnd(40))
  }

  // Against another build: the same trial, its kernel and content from that commit, played first.
  const against = args.options.get("against")
  let reference: Played | null = null
  if (against !== undefined) reference = await withCheckout(against, (root) => playBy(root, played, maps, jobs, profile, progress(against)))
  const now = await playBy(OWN_ROOT, played, maps, jobs, profile, progress(against === undefined ? played.id : "this build"))
  if (tty) process.stderr.write(`\r${"".padEnd(40)}\r`)

  const { battles } = now
  const cells = trialCells(battles)
  const failures = unmet(played, cells)
  const baselinePath = args.options.get("baseline")
  let baseline: TrialCell[] | undefined
  if (reference !== null) baseline = trialCells(reference.battles)
  else if (baselinePath !== undefined) baseline = trialCells((JSON.parse(await readFile(baselinePath, "utf8")) as { battles: TrialBattle[] }).battles)
  const notable = notableBattles(battles)
  const out = args.options.get("out")
  if (out !== undefined) await writeFile(out, `${JSON.stringify({ trial: played, cells, battles }, null, 1)}\n`, "utf8")
  if (quiet) {
    const plain = (each: TrialCell) => {
      const { lengths: _lengths, cost, ...cell } = each
      if (cost === undefined) return cell
      const { perBattle: _perBattle, ...summary } = cost
      return { ...cell, cost: summary }
    }
    process.stdout.write(`${JSON.stringify({ trial: played.id, cells: cells.map(plain), ...(baseline === undefined ? {} : { baseline: baseline.map(plain) }), notable, unmet: failures }, null, 1)}\n`)
    return failures.length === 0 ? 0 : 1
  }
  const lines =
    played.armies !== undefined && baseline === undefined && !args.flags.has("cells")
      ? standingLines(played, cells)
      : trialLines(played, cells, { ...(baseline === undefined ? {} : { baseline }), notable, ...(against === undefined ? {} : { before: against }) })
  if (profile) lines.push("", ...questionLines(now.questions))
  if ((played.expect ?? []).length > 0) {
    lines.push("")
    lines.push(failures.length === 0 ? `every expectation held (${played.expect?.length})` : "expectations not met:")
    for (const failure of failures) lines.push(`  ${failure}`)
  }
  process.stdout.write(`${lines.join("\n")}\n`)
  return failures.length === 0 ? 0 : 1
}
