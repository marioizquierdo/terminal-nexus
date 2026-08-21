// The Pulse Playground CLI — milestone-1-spike-battle.md 3.4.
//
//   playground run    scenarios/citizen-mirror-skirmish.ts
//   playground run    <scenario> --seed 0xABCD --ticks 120 --log-level debug
//   playground run    <scenario> --events events.jsonl
//   playground watch  <scenario>
//   playground verify <scenario> --runs 20
//
// The log goes to stderr and the summary to stdout, so `playground run x.ts > report.txt 2> run.log`
// splits them and a bare run interleaves both, which is what a human wants.

import { writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { FIXTURE_REGISTRY } from "../content/index.ts"
import { serializeEvents } from "../events/serialize.ts"
import { resolvePulse } from "../pulse/index.ts"
import { buildLog, formatSummary, parseLevel, summarize, summaryJson } from "../report/index.ts"
import type { ReportInput } from "../report/index.ts"
import { loadScenario } from "../scenario/index.ts"
import type { ScenarioDefinition } from "../scenario/index.ts"
import { DEFAULT_PRESENTATION, parseCapability, parseGlyphPack } from "../view/index.ts"
import type { PresentationOptions, TileWidth } from "../view/index.ts"
import { parseArgs, parseInteger } from "./args.ts"
import type { ParsedArgs } from "./args.ts"
import { buildTimeline } from "./timeline.ts"
import { watchPulse } from "./watch.ts"

const USAGE = `playground — the Terminal Nexus Pulse Playground

  playground run    <scenario.ts> [--seed 0xABCD] [--ticks 120] [--log-level info]
                                  [--events events.jsonl] [--json]
  playground watch  <scenario.ts> [--seed] [--ticks] [--speed 1] [--tile-width 1|2]
                                  [--capability monochrome|color16|color256|truecolor]
                                  [--glyphs ascii|unicode] [--no-effects] [--reduced-motion]
                                  [--cosmetic-seed 0x1234]
                                  [--backend auto|ansi|opentui]
  playground verify <scenario.ts> [--runs 20] [--seed] [--ticks]

Log levels: ERROR, WARN, INFO (default), DEBUG, TRACE. The log goes to stderr, the summary to
stdout, and --events writes the ordered event stream as JSONL.`

export async function importScenario(path: string): Promise<ScenarioDefinition> {
  const url = pathToFileURL(resolve(path)).href
  const module: unknown = await import(url)
  const candidate = (module as { default?: unknown }).default
  if (candidate === undefined || typeof candidate !== "object") {
    throw new Error(`${path} has no default-exported scenario`)
  }
  return candidate as ScenarioDefinition
}

type RunOptions = Readonly<{ seed?: number; ticks?: number }>

function optionsFrom(args: ParsedArgs): RunOptions {
  const seed = args.options.get("seed")
  const ticks = args.options.get("ticks")
  return {
    ...(seed === undefined ? {} : { seed: parseInteger(seed, "--seed") }),
    ...(ticks === undefined ? {} : { ticks: parseInteger(ticks, "--ticks") }),
  }
}

async function commandRun(args: ParsedArgs): Promise<number> {
  const path = args.positional[0]
  if (path === undefined) throw new Error("run needs a scenario file")
  const scenario = await importScenario(path)
  const overrides = optionsFrom(args)
  const seed = overrides.seed ?? scenario.seed
  const pulseTicks = overrides.ticks ?? scenario.pulseTicks
  const loaded = loadScenario(scenario, { registry: FIXTURE_REGISTRY, seed })
  const run = resolvePulse({
    initialState: loaded.state,
    registry: loaded.registry,
    pulseTicks,
    seed,
  })

  const input: ReportInput = {
    scenarioId: scenario.id,
    seed,
    pulseTicks,
    registry: loaded.registry,
    events: run.events,
    finalState: run.finalState,
    stateHash: run.stateHash,
    eventsHash: run.eventsHash,
  }

  const level = parseLevel(args.options.get("log-level") ?? "info")
  const lines = buildLog(input, level)
  for (const line of lines) process.stderr.write(`${line}\n`)

  const eventsPath = args.options.get("events")
  if (eventsPath !== undefined) {
    await writeFile(eventsPath, `${serializeEvents(run.events)}\n`, "utf8")
  }

  const summary = summarize(input)
  if (args.flags.has("json")) {
    process.stdout.write(
      `${summaryJson(summary, {
        engineVersion: run.engineVersion,
        contentLock: run.contentLock,
        schemaVersion: run.schemaVersion,
        ticksPerSecond: run.ticksPerSecond,
        events: run.events.length,
      })}\n`,
    )
  } else {
    process.stdout.write(`${formatSummary(summary)}\n`)
  }

  // Any ERROR fails the run (milestone-1-spike-battle.md 3.3).
  return lines.some((line) => line.includes(" ERROR ")) ? 1 : 0
}

async function commandVerify(args: ParsedArgs): Promise<number> {
  const path = args.positional[0]
  if (path === undefined) throw new Error("verify needs a scenario file")
  const scenario = await importScenario(path)
  const overrides = optionsFrom(args)
  const seed = overrides.seed ?? scenario.seed
  const pulseTicks = overrides.ticks ?? scenario.pulseTicks
  const runs = parseInteger(args.options.get("runs") ?? "20", "--runs")

  let stateHash: string | null = null
  let eventsHash: string | null = null
  let logDigest: string | null = null

  for (let index = 0; index < runs; index += 1) {
    const loaded = loadScenario(scenario, { registry: FIXTURE_REGISTRY, seed })
    const run = resolvePulse({
      initialState: loaded.state,
      registry: loaded.registry,
      pulseTicks,
      seed,
    })
    const log = buildLog(
      {
        scenarioId: scenario.id,
        seed,
        pulseTicks,
        registry: loaded.registry,
        events: run.events,
        finalState: run.finalState,
        stateHash: run.stateHash,
        eventsHash: run.eventsHash,
      },
      "INFO",
    ).join("\n")

    if (stateHash === null) {
      stateHash = run.stateHash
      eventsHash = run.eventsHash
      logDigest = log
      continue
    }
    if (run.stateHash !== stateHash) {
      process.stderr.write(`run ${index + 1}: state hash differs from run 1\n`)
      return 1
    }
    if (run.eventsHash !== eventsHash) {
      process.stderr.write(`run ${index + 1}: event hash differs from run 1\n`)
      return 1
    }
    if (log !== logDigest) {
      process.stderr.write(`run ${index + 1}: INFO log differs from run 1\n`)
      return 1
    }
  }

  process.stdout.write(
    [
      `scenario   ${scenario.id}`,
      `runs       ${runs} identical`,
      `state      sha256:${(stateHash ?? "").slice(0, 16)}`,
      `events     sha256:${(eventsHash ?? "").slice(0, 16)}`,
      "",
    ].join("\n"),
  )
  return 0
}

async function commandWatch(args: ParsedArgs): Promise<number> {
  const path = args.positional[0]
  if (path === undefined) throw new Error("watch needs a scenario file")
  const scenario = await importScenario(path)
  const overrides = optionsFrom(args)
  const seed = overrides.seed ?? scenario.seed
  const pulseTicks = overrides.ticks ?? scenario.pulseTicks
  const loaded = loadScenario(scenario, { registry: FIXTURE_REGISTRY, seed })
  const timeline = buildTimeline(scenario, loaded.state, loaded.registry, pulseTicks, seed)

  const tileWidthOption = args.options.get("tile-width")
  const tileWidth: TileWidth = tileWidthOption === "2" ? 2 : 1
  const cosmeticSeed = args.options.get("cosmetic-seed")
  const presentation: PresentationOptions = {
    effects: !args.flags.has("no-effects"),
    reducedMotion: args.flags.has("reduced-motion"),
    cosmeticSeed:
      cosmeticSeed === undefined
        ? DEFAULT_PRESENTATION.cosmeticSeed
        : parseInteger(cosmeticSeed, "--cosmetic-seed"),
    glyphPack: parseGlyphPack(args.options.get("glyphs") ?? "ascii"),
  }
  return watchPulse({
    timeline,
    capability: parseCapability(args.options.get("capability") ?? "color16"),
    tileWidth,
    speed: Number(args.options.get("speed") ?? "1"),
    backend: args.options.get("backend") ?? "auto",
    presentation,
    stdout: process.stdout,
    stdin: process.stdin,
  })
}

export async function main(argv: readonly string[]): Promise<number> {
  const args = parseArgs(argv)
  switch (args.command) {
    case "run":
      return commandRun(args)
    case "watch":
      return commandWatch(args)
    case "verify":
      return commandVerify(args)
    case "help":
    case "--help":
      process.stdout.write(`${USAGE}\n`)
      return 0
    default:
      process.stderr.write(`unknown command "${args.command}"\n\n${USAGE}\n`)
      return 2
  }
}
