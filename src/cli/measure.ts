// `measure`: battles measured the same way before and after a rule changes (docs/system-design/measurement.md). The
// shell around `src/measure/`: it reads the maps, keeps time, asks git for the build and writes the result down.
// Commands:
//
//   measure run [--spec quick|full] [--seeds 1-6] [--parts scenarios,duels,levels] [--routing "<words>"] [--out <file>]
//       plays the spec and prints what it says; with --out, writes every battle's record as JSON too
//   measure show <file>
//       prints what a measurement written down says
//   measure compare <before> <after>
//       prints two measurements one after the other, the older first
//   measure formations [--seeds 1-6] [--exit route|ground]
//       plays four Barracks built three ways against each other and against a blast, and says what it shows

import { execSync } from "node:child_process"
import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { LEVELS } from "./levels.ts"
import type { Measurement, MeasureSpec } from "../measure/index.ts"
import { formationLines, measureFormations, runSpec, SPECS, summaryLines } from "../measure/index.ts"
import { loadMapFile } from "../scenario/load-map-file.ts"

const HELP = `measure: battles measured the same way before and after a rule changes (docs/system-design/measurement.md).

  measure run [--spec quick|full] [--seeds 1-6] [--parts scenarios,duels,levels] [--routing "<words>"] [--out <file>]
      plays the spec and prints what it says; with --out, writes every battle's record as JSON too
  measure show <file>
      prints what a measurement written down says
  measure compare <before> <after>
      prints two measurements one after the other, the older first
  measure formations [--seeds 1-6] [--exit route|ground]
      plays four Barracks built three ways (a block, set apart, a line) against each other and against a blast, and
      says how tight each army meets the enemy and who wins; --exit is the "Way off the roof" Experiment's value

The quick spec plays the route scenarios and one scripted player's duels on two seeds; the full spec every map, three
players' duels and every campaign level by its plans on six seeds. --routing names the rule units walk by, in a few
words, for the record.`

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

function build(): string {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim()
  } catch {
    return "unknown"
  }
}

const read = (path: string): Measurement => JSON.parse(readFileSync(path, "utf8")) as Measurement

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
  if (command === "formations") {
    const exit = options["exit"] ?? "route"
    if (exit !== "route" && exit !== "ground") throw new Error(`--exit takes route or ground, not "${exit}"`)
    const battles = measureFormations(seedsOf(options["seeds"] ?? "1-6"), exit)
    process.stdout.write(`${formationLines(battles).join("\n")}\n`)
    return 0
  }
  if (command !== "run") throw new Error(`no command "${command}" (run, show, compare, formations, help)`)

  const base = SPECS[options["spec"] ?? "quick"]
  if (base === undefined) throw new Error(`no spec "${options["spec"]}" (${Object.keys(SPECS).join(", ")})`)
  const spec: MeasureSpec = options["seeds"] === undefined ? base : { ...base, seeds: seedsOf(options["seeds"]) }
  const parts = new Set((options["parts"] ?? "scenarios,duels,levels").split(","))
  const scenarios = await Promise.all(
    readdirSync("scenarios")
      .filter((name) => name.endsWith(".map.json"))
      .sort()
      .map((name) => loadMapFile(join("scenarios", name))),
  )
  const started = performance.now()
  const result = runSpec(spec, { scenarios, levels: LEVELS, parts, progress: (line) => process.stderr.write(`${line}\n`) })
  const elapsed = performance.now() - started
  const measurement: Measurement = {
    spec: spec.name,
    build: build(),
    date: new Date().toISOString().slice(0, 10),
    routing: options["routing"] ?? "not named",
    msPerTick: result.ticks === 0 ? null : Math.round((elapsed / result.ticks) * 1000) / 1000,
    scenarios: result.scenarios,
    duels: result.duels,
    levels: result.levels,
  }
  if (options["out"] !== undefined) writeFileSync(options["out"], `${JSON.stringify(measurement)}\n`)
  process.stdout.write(`${summaryLines(measurement).join("\n")}\n`)
  return 0
}
