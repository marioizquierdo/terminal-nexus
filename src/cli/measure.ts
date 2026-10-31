// `measure`: battles measured the same way before and after a rule changes (docs/system-design/measurement.md). The
// shell around `src/measure/`: it reads the maps, keeps time, asks git for the build and writes the result down.
// Commands:
//
//   measure run [--spec quick|full] [--seeds 1-6] [--parts scenarios,duels,levels] [--players balanced,rush]
//               [--formations block,apart] [--routing "<words>"] [--question "<words>"] [--jobs N] [--out <file>]
//       plays the spec and prints what it says; with --out, writes every battle's record as JSON too; with --jobs,
//       as up to N processes side by side, merged into one result; with --formations, each player's duels set the
//       formations against each other (rush-block against rush-apart)
//   measure merge <file>... [--out <file>]
//       makes parts of one spec, played apart, one measurement
//   measure who <content id> [--plan nothing|defended|both] [--levels <id>,<id>]
//       what one kind of unit or building did in each round of each campaign level
//   measure show <file>
//       prints what a measurement written down says
//   measure compare <before> <after>
//       prints two measurements one after the other, the older first
//   measure formations [--seeds 1-6] [--exit route|ground]
//       plays four Barracks built three ways against each other and against a blast, and says what it shows

import { execSync, spawn } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { LEVELS } from "./levels.ts"
import type { LevelPlan, Measurement, MeasureJob, MeasureSpec } from "../measure/index.ts"
import {
  formationLines,
  FULL_SPEC,
  jobsOf,
  LEVEL_PLANS,
  measureFormations,
  measureUnit,
  mergeMeasurements,
  runSpec,
  SPECS,
  summaryLines,
  unitLines,
} from "../measure/index.ts"
import { TICKS_PER_SECOND } from "../scenario/load.ts"
import { loadMapFile, mapCatalog } from "../scenario/load-map-file.ts"

const HELP = `measure: battles measured the same way before and after a rule changes (docs/system-design/measurement.md).

  measure run [--spec quick|full] [--seeds 1-6] [--parts scenarios,duels,levels] [--players balanced,rush]
              [--formations block,apart] [--routing "<words>"] [--question "<words>"] [--jobs N] [--out <file>]
      plays the spec and prints what it says; with --out, writes every battle's record as JSON too. --jobs plays
      it as up to N processes side by side (the maps, the levels, and the duels a few at a time) and merges what
      they wrote into one result, in the order one process would have played it. --question records the one
      question the run is meant to answer. --parts, --players and --west (the Commanders on side A) play part of
      a spec. --formations block,apart has each player build as a block on one side and apart on the other, every
      ordered pair of the formations named, so each meets each from both ends (one formation: both sides play
      it); the summary then says who won by formation. A player named with one (--players rush-block) plays it on
      both sides
  measure merge <file>... [--out <file>]
      makes parts of one spec, played apart, one measurement, and prints what it says; refuses parts of different
      builds or specs
  measure who <content id> [--plan nothing|defended|both] [--levels <id>,<id>]
      plays every campaign level (or those named) by the plan and says what that unit or building did in each
      round: hits on the enemy, damage, kills and when it first hit. Run it before telling anyone to watch a
      unit do something in a round
  measure show <file>
      prints what a measurement written down says
  measure compare <before> <after>
      prints two measurements one after the other, the older first
  measure formations [--seeds 1-6] [--exit route|ground]
      plays four Barracks built three ways (a block, set apart, a line) against each other and against a blast, and
      says how tight each army meets the enemy and who wins; --exit is the "Way off the roof" Experiment's value

The quick spec plays the route scenarios and one scripted player's duels on two seeds; the full spec every map, three
players' duels and every campaign level by its plans on six seeds. --routing names the rules it measured (the routes,
the Nexus, a tier), in a few words, for the record. A build ending "+uncommitted" was measured with changes to the
code, armies, campaigns or maps not yet committed.`

type Options = Record<string, string>

function parse(args: readonly string[]): Readonly<{ command: string; rest: string[]; options: Options }> {
  const [command = "help", ...tail] = args
  const options: Options = {}
  const rest: string[] = []
  for (let index = 0; index < tail.length; index += 1) {
    const word = tail[index] as string
    if (!word.startsWith("--")) {
      rest.push(word)
      continue
    }
    const value = tail[index + 1]
    if (value === undefined || value.startsWith("--")) throw new Error(`${word} needs a value`)
    options[word.slice(2)] = value
    index += 1
  }
  return { command, rest, options }
}

/** `1-6` or `1,3,5`. */
function seedsOf(text: string): number[] {
  const range = /^(\d+)-(\d+)$/u.exec(text)
  if (range !== null) {
    const from = Number(range[1])
    const to = Number(range[2])
    return Array.from({ length: to - from + 1 }, (_, index) => from + index)
  }
  return text.split(",").map((part) => {
    const seed = Number(part)
    if (!Number.isInteger(seed)) throw new Error(`--seeds takes 1-6 or 1,3,5, not "${text}"`)
    return seed
  })
}

/** The commit measured, "+uncommitted" when what a battle is made of (the code, the armies, the campaigns, the maps)
 *  differs from it, new files included: a result is only as named as its build. A document being written is not. */
function build(): string {
  try {
    const head = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim()
    const changed = execSync("git status --porcelain -- src bin armies campaigns scenarios", { encoding: "utf8" }).trim() !== ""
    return changed ? `${head}+uncommitted` : head
  } catch {
    return "unknown"
  }
}

const read = (path: string): Measurement => JSON.parse(readFileSync(path, "utf8")) as Measurement

/** What a merge prints and writes down. */
function finish(measurement: Measurement, out: string | undefined): number {
  if (out !== undefined) writeFileSync(out, `${JSON.stringify(measurement)}\n`)
  process.stdout.write(`${summaryLines(measurement).join("\n")}\n`)
  return 0
}

/** Plays each job as a process of its own (this command again, with --out), at most `jobs` at once; their progress
 *  lines go to this one's error stream. Resolves to the parts in the jobs' order, whatever order they finished in. */
async function runJobs(list: readonly MeasureJob[], jobs: number, args: (job: MeasureJob, out: string) => string[]): Promise<Measurement[]> {
  const script = process.argv[1]
  if (script === undefined) throw new Error("cannot find the measure command to start its jobs")
  const dir = mkdtempSync(join(tmpdir(), "measure-"))
  try {
    const files = list.map((_, index) => join(dir, `part-${index}.json`))
    let next = 0
    const worker = async (): Promise<void> => {
      while (next < list.length) {
        const index = next
        next += 1
        const job = list[index] as MeasureJob
        const child = spawn(process.execPath, [...process.execArgv, script, "run", ...args(job, files[index] as string)], {
          stdio: ["ignore", "ignore", "inherit"],
        })
        const code = await new Promise<number | null>((resolve, reject) => {
          child.on("error", reject)
          child.on("close", resolve)
        })
        if (code !== 0) throw new Error(`the job "${job.label}" ended with code ${code}`)
      }
    }
    await Promise.all(Array.from({ length: Math.min(jobs, list.length) }, worker))
    return files.map(read)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const PLAN_FLAGS: Readonly<Record<string, readonly LevelPlan[]>> = {
  nothing: LEVEL_PLANS.slice(0, 1),
  defended: LEVEL_PLANS.slice(1, 2),
  both: LEVEL_PLANS,
}

export async function main(args: readonly string[]): Promise<number> {
  const { command, rest, options } = parse(args)
  if (command === "help" || command === "--help") {
    process.stdout.write(`${HELP}\n`)
    return 0
  }
  if (command === "show") {
    const [file] = rest
    if (file === undefined) throw new Error("measure show <file>")
    process.stdout.write(`${summaryLines(read(file)).join("\n")}\n`)
    return 0
  }
  if (command === "compare") {
    const [before, after] = rest
    if (before === undefined || after === undefined) throw new Error("measure compare <before> <after>")
    process.stdout.write(`${summaryLines(read(before)).join("\n")}\n\n${summaryLines(read(after)).join("\n")}\n`)
    return 0
  }
  if (command === "merge") {
    if (rest.length === 0) throw new Error("measure merge <file>... [--out <file>]")
    const parts = rest.map(read)
    return finish(mergeMeasurements(parts, SPECS[parts[0]?.spec ?? ""] ?? FULL_SPEC), options["out"])
  }
  if (command === "who") {
    const [contentId] = rest
    if (contentId === undefined) throw new Error("measure who <content id> [--plan nothing|defended|both] [--levels <id>,<id>]")
    const plans = PLAN_FLAGS[options["plan"] ?? "both"]
    if (plans === undefined) throw new Error(`--plan takes nothing, defended or both, not "${options["plan"]}"`)
    const named = options["levels"]?.split(",")
    const unknown = (named ?? []).filter((id) => !LEVELS.some((level) => level.id === id))
    if (unknown.length > 0) throw new Error(`no level ${unknown.join(", ")} (${LEVELS.map((level) => level.id).join(", ")})`)
    const levels = named === undefined ? LEVELS : LEVELS.filter((level) => named.includes(level.id))
    const measures = levels.flatMap((level) => plans.map((plan) => measureUnit(level, plan, contentId)))
    if (measures.every((measure) => measure.rounds.every((round) => round.sides.A === null && round.sides.B === null))) {
      process.stderr.write(`measure: ${contentId} stood in none of these rounds; is the content id right?\n`)
    }
    process.stdout.write(`${unitLines(contentId, measures, TICKS_PER_SECOND).join("\n")}\n`)
    return 0
  }
  if (command === "formations") {
    const exit = options["exit"] ?? "route"
    if (exit !== "route" && exit !== "ground") throw new Error(`--exit takes route or ground, not "${exit}"`)
    const battles = measureFormations(seedsOf(options["seeds"] ?? "1-6"), exit)
    process.stdout.write(`${formationLines(battles).join("\n")}\n`)
    return 0
  }
  if (command !== "run") throw new Error(`no command "${command}" (run, merge, who, show, compare, formations, help)`)

  const base = SPECS[options["spec"] ?? "quick"]
  if (base === undefined) throw new Error(`no spec "${options["spec"]}" (${Object.keys(SPECS).join(", ")})`)
  const seeded: MeasureSpec = options["seeds"] === undefined ? base : { ...base, seeds: seedsOf(options["seeds"]) }
  const spec: MeasureSpec = {
    ...seeded,
    duels: {
      ...seeded.duels,
      ...(options["players"] === undefined ? {} : { players: options["players"].split(",") }),
      ...(options["west"] === undefined ? {} : { west: options["west"].split(",") }),
      ...(options["formations"] === undefined ? {} : { formations: options["formations"].split(",") }),
    },
  }
  const parts = new Set((options["parts"] ?? "scenarios,duels,levels").split(","))
  const jobs = Number(options["jobs"] ?? "1")
  if (!Number.isInteger(jobs) || jobs < 1) throw new Error(`--jobs takes a whole number from 1, not "${options["jobs"]}"`)
  if (jobs > 1) {
    const shared = ["--spec", base.name, "--routing", options["routing"] ?? "not named"]
    if (options["question"] !== undefined) shared.push("--question", options["question"])
    if (options["formations"] !== undefined) shared.push("--formations", options["formations"])
    const played = await runJobs(jobsOf(spec, parts), jobs, (job, out) => [
      ...shared,
      ...["--seeds", job.seeds.join(","), "--parts", job.parts.join(","), "--players", job.players.join(",")],
      ...["--west", job.west.join(","), "--out", out],
    ])
    return finish(mergeMeasurements(played, spec, Math.min(jobs, played.length)), options["out"])
  }
  const scenarios = await Promise.all(
    mapCatalog().map((entry) => loadMapFile(entry.path)),
  )
  const started = performance.now()
  const result = runSpec(spec, { scenarios, levels: LEVELS, parts, progress: (line) => process.stderr.write(`${line}\n`) })
  const elapsed = performance.now() - started
  const measurement: Measurement = {
    spec: spec.name,
    build: build(),
    date: new Date().toISOString().slice(0, 10),
    routing: options["routing"] ?? "not named",
    ...(options["question"] === undefined ? {} : { question: options["question"] }),
    msPerTick: result.ticks === 0 ? null : Math.round((elapsed / result.ticks) * 1000) / 1000,
    scenarios: result.scenarios,
    duels: result.duels,
    levels: result.levels,
  }
  if (options["out"] !== undefined) writeFileSync(options["out"], `${JSON.stringify(measurement)}\n`)
  process.stdout.write(`${summaryLines(measurement).join("\n")}\n`)
  return 0
}
