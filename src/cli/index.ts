// The Grid tool's CLI — milestone-1-spike-battle.md 3.4. `grid` is the engine, editor, and replay
// tool; it is not the game itself, which a future `terminal-nexus` executable launches.
//
//   grid <map>                                    # watch — the ASCII view (the default)
//   grid <map> --headless [--log-level info]      # resolve headlessly, print the levelled log
//   grid <map> --verify [--runs 10]               # same hashes every run? (headless)
//   grid <map> --turn 90                          # jump straight to a tick, in any of the above
//
// `<map>` is a path to a `.map.json` file; the suffix is optional (`grid scenarios/melee-kill` and
// `grid scenarios/melee-kill.map.json` are the same file). There is no subcommand: the first
// positional argument is always the map, and the default action is `watch`. A bare `grid` with no
// map is reserved for the map editor — not built yet, so it is a usage error today.
//
// One output stream, not two: a headless run's levelled log and its closing report (outcome,
// losses, hashes) both print together, and `--log-level` (default WARN) picks how much of the story
// comes with it. `--save-log <file>` writes the same lines to a file in any mode, including `watch`.

import { writeFile } from "node:fs/promises"
import { FIXTURE_REGISTRY } from "../content/index.ts"
import { serializeEvents } from "../events/serialize.ts"
import { resolvePulse, resolvePulseAt } from "../pulse/index.ts"
import { buildLog, formatSummary, parseLevel, summarize, summaryJson } from "../report/index.ts"
import type { ReportInput } from "../report/index.ts"
import { hashState } from "../state/serialize.ts"
import { loadMapFile, loadScenario } from "../scenario/index.ts"
import { DEFAULT_PRESENTATION, parseCapability, parseGlyphPack, parseTheme } from "../view/index.ts"
import type { CapabilityMode, PresentationOptions, TileWidth } from "../view/index.ts"
import { parseArgs, parseInteger } from "./args.ts"
import type { ParsedArgs } from "./args.ts"
import { buildTimeline } from "./timeline.ts"
import { watchPulse } from "./watch.ts"

const USAGE = `grid — the Terminal Nexus Grid tool (engine, editor, and replay)

  grid <map.map.json>          [--seed 0xABCD] [--ticks 120] [--turn 90]
                                [--speed 1] [--tile-width 1|2]
                                [--capability monochrome|color16|color256|truecolor]
                                [--theme dark|light] [--glyphs ascii|unicode]
                                [--no-effects] [--reduced-motion] [--cosmetic-seed 0x1234]
                                [--backend auto|ansi|opentui] [--save-log <file>] [--log-level info]
      the ASCII view (the default action) — watches the map resolve live

  grid <map.map.json> --headless [--seed] [--ticks] [--turn 90] [--log-level info]
                                  [--events events.jsonl] [--json] [--save-log <file>]
      resolves without a terminal and prints the levelled log

  grid <map.map.json> --verify [--runs 10] [--seed] [--ticks] [--turn 90]
      re-resolves 10 times (default) and fails if any run's hashes disagree — also headless

<map> is a path to a .map.json file; the .map.json suffix is optional. There is no subcommand.

Log levels: ERROR, WARN (default), INFO, DEBUG, TRACE — one stream, closed by a WARN "report" line
carrying the outcome, losses, and hashes. --save-log writes the same lines to a file in any mode.

--capability defaults to the best tier COLORTERM/TERM advertise, color16 if neither says more.
--theme defaults to dark; pass --theme light on a light terminal background.`

/**
 * A default `--capability`, when none is given, that is not simply the least common denominator.
 * The owner's low-contrast finding traced back partly to `color16` — the ANSI-16 tier where each
 * terminal theme defines its own version of every code, "bright black" least consistently of all —
 * being the hardcoded default regardless of what the terminal could actually do. `COLORTERM` and
 * `TERM` are the same two environment variables most terminal-aware CLI tools check for this; it is
 * not perfect (a terminal that supports more and advertises neither still gets `color16`), but it
 * is the simple, standard method, and `--capability` is still one flag away for anyone it guesses
 * wrong for.
 */
export function detectCapability(env: NodeJS.ProcessEnv = process.env): CapabilityMode {
  const colorterm = env["COLORTERM"]
  if (colorterm === "truecolor" || colorterm === "24bit") return "truecolor"
  const term = env["TERM"] ?? ""
  if (term.includes("256color")) return "color256"
  return "color16"
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

function turnFrom(args: ParsedArgs): number | undefined {
  const value = args.options.get("turn")
  return value === undefined ? undefined : parseInteger(value, "--turn")
}

/**
 * `--turn N`: drop every line before tick N so a headless report can be read starting from the
 * moment in question, without scrolling past everything that came before it. Never drops an ERROR
 * (an invariant violation is never hidden) or the trailing `report` line (always worth seeing).
 */
function fromTurn(lines: readonly string[], turn: number): string[] {
  return lines.filter((line) => {
    if (line.includes(" ERROR ") || line.includes(" WARN  report ")) return true
    const match = /^\[(\d+)\]/.exec(line)
    return match !== null && Number(match[1]) >= turn
  })
}

async function commandHeadless(path: string, args: ParsedArgs): Promise<number> {
  const scenario = await loadMapFile(path)
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

  const level = parseLevel(args.options.get("log-level") ?? "warn")
  const turn = turnFrom(args)
  const lines = turn === undefined ? buildLog(input, level) : fromTurn(buildLog(input, level), turn)

  const savePath = args.options.get("save-log")
  if (savePath !== undefined) await writeFile(savePath, `${lines.join("\n")}\n`, "utf8")

  const eventsPath = args.options.get("events")
  if (eventsPath !== undefined) {
    await writeFile(eventsPath, `${serializeEvents(run.events)}\n`, "utf8")
  }

  if (args.flags.has("json")) {
    const summary = summarize(input)
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
    for (const line of lines) process.stdout.write(`${line}\n`)
  }

  // Any ERROR fails the run (milestone-1-spike-battle.md 3.3). Checked against the full log, not
  // the --turn-filtered view, but ERROR lines survive that filter unconditionally anyway.
  return lines.some((line) => line.includes(" ERROR ")) ? 1 : 0
}

const DEFAULT_VERIFY_RUNS = 10

async function commandVerify(path: string, args: ParsedArgs): Promise<number> {
  const scenario = await loadMapFile(path)
  const overrides = optionsFrom(args)
  const seed = overrides.seed ?? scenario.seed
  const pulseTicks = overrides.ticks ?? scenario.pulseTicks
  const runs = parseInteger(args.options.get("runs") ?? String(DEFAULT_VERIFY_RUNS), "--runs")
  const turn = turnFrom(args)

  let stateHash: string | null = null
  let eventsHash: string | null = null
  let logDigest: string | null = null
  let snapshotHash: string | null = null

  // Always call resolvePulseAt, even without --turn: a snapshot tick that can never occur (-1) is
  // simpler than carrying two different return shapes through the loop below.
  const snapshotTick = turn ?? -1

  for (let index = 0; index < runs; index += 1) {
    const loaded = loadScenario(scenario, { registry: FIXTURE_REGISTRY, seed })
    const run = resolvePulseAt(
      { initialState: loaded.state, registry: loaded.registry, pulseTicks, seed },
      snapshotTick,
    )
    const snapshotAt = run.snapshot === null ? null : hashState(run.snapshot)

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
      snapshotHash = snapshotAt
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
    if (turn !== undefined && snapshotAt !== snapshotHash) {
      process.stderr.write(`run ${index + 1}: state at tick ${turn} differs from run 1\n`)
      return 1
    }
  }

  const lines = [
    `scenario   ${scenario.id}`,
    `runs       ${runs} identical`,
    `state      sha256:${(stateHash ?? "").slice(0, 16)}`,
    `events     sha256:${(eventsHash ?? "").slice(0, 16)}`,
  ]
  if (turn !== undefined) {
    lines.push(
      snapshotHash === null
        ? `tick ${turn}   every run ended before reaching this tick`
        : `tick ${turn}   sha256:${snapshotHash.slice(0, 16)}`,
    )
  }
  lines.push("")
  process.stdout.write(lines.join("\n"))
  return 0
}

async function commandWatch(path: string, args: ParsedArgs): Promise<number> {
  const scenario = await loadMapFile(path)
  const overrides = optionsFrom(args)
  const seed = overrides.seed ?? scenario.seed
  const pulseTicks = overrides.ticks ?? scenario.pulseTicks
  const loaded = loadScenario(scenario, { registry: FIXTURE_REGISTRY, seed })
  const timeline = buildTimeline(scenario, loaded.state, loaded.registry, pulseTicks, seed)

  const savePath = args.options.get("save-log")
  if (savePath !== undefined) {
    const level = parseLevel(args.options.get("log-level") ?? "warn")
    const input: ReportInput = {
      scenarioId: timeline.scenarioId,
      seed,
      pulseTicks,
      registry: timeline.registry,
      events: timeline.events,
      finalState: timeline.states[timeline.states.length - 1] ?? loaded.state,
      stateHash: timeline.stateHash,
      eventsHash: timeline.eventsHash,
    }
    await writeFile(savePath, `${buildLog(input, level).join("\n")}\n`, "utf8")
  }

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
  const turn = turnFrom(args)
  return watchPulse({
    timeline,
    capability: parseCapability(args.options.get("capability") ?? detectCapability()),
    theme: parseTheme(args.options.get("theme") ?? "dark"),
    tileWidth,
    speed: Number(args.options.get("speed") ?? "1"),
    backend: args.options.get("backend") ?? "auto",
    presentation,
    ...(turn === undefined ? {} : { startTick: turn }),
    stdout: process.stdout,
    stdin: process.stdin,
  })
}

export async function main(argv: readonly string[]): Promise<number> {
  const args = parseArgs(argv)
  if (args.flags.has("help") || args.positional[0] === "help") {
    process.stdout.write(`${USAGE}\n`)
    return 0
  }

  const path = args.positional[0]
  if (path === undefined) {
    process.stderr.write(
      `grid needs a map file to load — the map editor isn't built yet, so this is required.\n\n${USAGE}\n`,
    )
    return 2
  }

  if (args.flags.has("verify")) return commandVerify(path, args)
  if (args.flags.has("headless")) return commandHeadless(path, args)
  return commandWatch(path, args)
}
