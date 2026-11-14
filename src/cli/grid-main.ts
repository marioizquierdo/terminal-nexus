// The Grid tool's CLI. `grid` is the engine, editor, and replay
// tool; it is not the game itself, which a future `terminal-nexus` executable launches.
//
//   grid <map>                                    # watch — the ASCII view (the default)
//   grid <map> --headless [--log-level info]      # resolve headlessly, print the levelled log
//   grid <map> --verify [--runs 10]               # same hashes every run? (headless)
//   grid <map> --from-tick 90                          # jump straight to a tick, in any of the above
//
// `<map>` is a path to a `.save.json` file; the suffix is optional (`grid sandboxes/rules/melee-kill` and
// `grid sandboxes/rules/melee-kill.save.json` are the same file). There is no subcommand: the first
// positional argument is always the map, and the default action is `watch`. A bare `grid` with no
// map is reserved for the map editor — not built yet, so it is a usage error today.
//
// One output stream, not two: a headless run's levelled log and its closing report (outcome,
// losses, hashes) both print together, and `--log-level` (default WARN) picks how much of the story
// comes with it. `--save-log <file>` writes the same lines to a file in any mode, including `watch`.

import { writeFile } from "node:fs/promises"
import { FIXTURE_REGISTRY } from "../content/index.ts"
import { serializeEvents } from "../events/serialize.ts"
import { buildLog, endStateLines, parseLevel, summarize, summaryJson } from "../report/index.ts"
import type { ReportInput } from "../report/index.ts"
import { REGROUP_TICKS } from "../match/index.ts"
import { hashState } from "../state/serialize.ts"
import { applyVariant, openBattle, mirrored, phaseOf, shuffled, sidesWithoutGoal } from "../skirmish/opening/index.ts"
import { loadSandbox } from "../skirmish/sandboxes.ts"
import { playSandboxRound } from "../skirmish/sandbox-round.ts"
import type { MatchState } from "../state/types.ts"
import type { BattleOpening } from "../skirmish/opening/index.ts"
import type { ContentRegistry } from "../content/index.ts"
import { DEFAULT_PRESENTATION, parseColorDepth, parseGlyphPack, parseTheme } from "../view/index.ts"
import type { ColorDepth, PresentationOptions } from "../view/index.ts"
import { parseArgs, parseInteger, retiredOption } from "./args.ts"
import type { ParsedArgs } from "./args.ts"
import { buildTimeline } from "./timeline.ts"
import { VARIANT_OPTIONS, adHocTrial, loadTrialFile, runTrial, trialPath, variantFromArgs } from "./trial.ts"
import { watchPulse } from "./watch.ts"

const USAGE = `grid — the Terminal Nexus Grid tool (engine, editor, and replay)

  grid <save.save.json>         [--seed 0xABCD] [--ticks 120] [--from-tick 90] [--speed 1]
                                [--colors monochrome|color256|truecolor]
                                [--theme dark|light] [--glyphs ascii|unicode]
                                [--no-effects] [--reduced-motion] [--cosmetic-seed 0x1234]
                                [--backend auto|ansi|opentui] [--save-log <file>] [--log-level info]
      the ASCII view (the default action) — watches the sandbox's round live: its Battle Round resolving, or, when
      its start.phase is "build-phase", the Build Phase's regroup walking (see the end of this help)

  grid <save.save.json> --headless [--seed] [--ticks] [--from-tick 90] [--log-level info]
                                   [--events events.jsonl] [--json] [--save-log <file>] [--end-states]
      resolves without a terminal and prints the levelled log; --end-states closes it with one line per entity: its hp
      and tile at the start and at the end (a Build Phase run always does)

  grid <save.save.json> --verify [--runs 10] [--seed] [--ticks] [--from-tick 90]
      re-resolves 10 times (default) and fails if any run's hashes disagree — also headless

  grid <save.save.json> --seeds 1-12 [--swap] [--shuffle] [variant options] [trial options]
      a trial: plays the sandbox on every seed (with --swap mirrored too, its sides swapped; with --shuffle each
      side's units shuffled within their formation line by the seed) as built and as the variant options make it, and
      prints the outcome, how the armies engaged, and with --profile what a tick cost, then the battles worth watching

  grid <trial.trial.json> [--seeds 1-12] [variant options] [trial options]
      a trial file (sandboxes/trials/): sandboxes, seeds, variants and what it expects; fails
      when an expectation does not hold. Variant options given here apply to every variant

Trial options:
  --profile               what a tick cost: milliseconds, and the route work (fields built, anchors settled)
  --jobs 4                play across four processes; the same battles, merged in order
  --against <git ref>     play the same trial by that commit's kernel and content too, each row beside it
  --out battles.json      write every battle down; --baseline battles.json sets each row beside such a file
  --json                  the cells, the battles worth watching and any unmet expectation, as data

Variant options, for every action (watch, --headless, --verify and a trial):
  --set A.t=raider,B.m=sniper     a side's legend symbol (or every one of a content: A.trooper=raider) made another unit
  --army-a trooper:6,skyraider:6  a side's one-tile units replaced, front to back (--army-b for side B)
  --tune trooper.maxHp=60         a content's number changed (any field it has, or vision)
  --terrain "#=scrub"             a terrain symbol made another terrain
  --target-a x,y,w,h              a side's target moved (--target-b)
  --swap, --shuffle               one battle mirrored with its sides swapped; its units shuffled by --seed

<save> is a sandbox (sandboxes/, a save whose start writes its Battle Round or its Build Phase), with or without the
.save.json suffix, or its id (grid melee-kill). There is no subcommand. skirmish --load <save> --play-to next plays the same.

start.phase: absent or one of "battle-round" (the default) and "build-phase". A "build-phase" sandbox runs no kernel: units
and buildings stand placed and idle, a Nexus mends and a unit in a fight steps back and forms up, over the regroup's own
120 ticks, so --ticks is refused; a headless run ends with each entity's hp and tile, start to end. A trial refuses one.

Log levels: ERROR, WARN (default), INFO, DEBUG, TRACE — one stream, closed by a WARN "report" line
carrying the outcome, losses, and hashes. --save-log writes the same lines to a file in any mode.

--colors defaults to the best tier COLORTERM/TERM advertise, monochrome if neither says more.
--theme defaults to dark. The game paints its own background (dark or light) whatever your terminal's colours
are, except with --colors monochrome, which leaves your terminal's own.`

/**
 * A default `--colors`, when none is given, that is not simply the least common denominator.
 * `COLORTERM` and `TERM` are the two environment variables most terminal-aware CLI tools check for
 * this. It errs toward monochrome, the floor that draws right on any terminal and leaves the
 * terminal's own colours alone: a terminal that supports more and advertises neither gets black and
 * white until its player picks a colour depth in Settings (or passes `--colors`), where the other
 * error, colour codes sent to a terminal that cannot read them, would print garbage. There is no
 * sixteen-colour depth to land on in between: those colours are the terminal theme's, not the game's.
 */
export function detectColorDepth(env: NodeJS.ProcessEnv = process.env): ColorDepth {
  const colorterm = env["COLORTERM"]
  if (colorterm === "truecolor" || colorterm === "24bit") return "truecolor"
  const term = env["TERM"] ?? ""
  if (term.includes("256color")) return "color256"
  return "monochrome"
}

type RunOptions = Readonly<{ seed?: number; ticks?: number }>

/**
 * The map at `path` as the command line's variant makes it (`--set`, `--army-a`, `--tune`, `--terrain`, `--target-a`),
 * its units shuffled by the seed with `--shuffle`, mirrored with its sides swapped with `--swap`; and the content it is
 * played with. Warns, once, of a side that fights with nowhere to go.
 */
async function openMap(path: string, args: ParsedArgs, seed?: number): Promise<{ opening: BattleOpening; registry: ContentRegistry }> {
  const loaded = await loadSandbox(path)
  const variant = variantFromArgs(args)
  const made = variant === null ? { opening: loaded, registry: FIXTURE_REGISTRY } : applyVariant(loaded, FIXTURE_REGISTRY, variant)
  let opening = made.opening
  if (args.flags.has("shuffle")) opening = shuffled(opening, made.registry, seed ?? opening.seed)
  if (args.flags.has("swap")) opening = mirrored(opening, made.registry)
  const state = openBattle(opening, { registry: made.registry }).state
  // Only a Battle Round has sides that fight: in the Build Phase nobody goes anywhere, so nobody needs a goal.
  for (const side of phaseOf(opening) === "battle-round" ? sidesWithoutGoal(state, made.registry) : []) {
    process.stderr.write(`grid: side ${side} of ${opening.id} fights with no target and no enemy Nexus, a battle the game never plays\n`)
  }
  return { opening, registry: made.registry }
}

function optionsFrom(args: ParsedArgs): RunOptions {
  const seed = args.options.get("seed")
  const ticks = args.options.get("ticks")
  return {
    ...(seed === undefined ? {} : { seed: parseInteger(seed, "--seed") }),
    ...(ticks === undefined ? {} : { ticks: parseInteger(ticks, "--ticks") }),
  }
}

function tickFrom(args: ParsedArgs): number | undefined {
  const value = args.options.get("from-tick")
  return value === undefined ? undefined : parseInteger(value, "--from-tick")
}

/**
 * `--from-tick N`: drop every line before tick N so a headless report can be read starting from the
 * moment in question, without scrolling past everything that came before it. Never drops an ERROR
 * (an invariant violation is never hidden) or the trailing `report` line (always worth seeing).
 */
function fromTick(lines: readonly string[], startTick: number): string[] {
  return lines.filter((line) => {
    if (line.includes(" ERROR ") || line.includes(" WARN  report ")) return true
    const match = /^\[(\d+)\]/.exec(line)
    return match !== null && Number(match[1]) >= startTick
  })
}

async function commandHeadless(path: string, args: ParsedArgs): Promise<number> {
  const overrides = optionsFrom(args)
  const { opening, registry } = await openMap(path, args, overrides.seed)
  const seed = overrides.seed ?? opening.seed
  const pulseTicks = overrides.ticks ?? opening.pulseTicks
  const { run, report: input } = playSandboxRound(opening, { registry, seed, ticks: pulseTicks })

  const level = parseLevel(args.options.get("log-level") ?? "warn")
  const startTick = tickFrom(args)
  const built = startTick === undefined ? buildLog(input, level) : fromTick(buildLog(input, level), startTick)
  // What each entity became, before the report line that closes the log: always in the Build Phase, whose run has no events
  // to show a mending Nexus or a step back; on request (--end-states) in a Battle Round.
  const showEnds = args.flags.has("end-states") || phaseOf(opening) === "build-phase"
  const ends = showEnds ? endStateLines(run.initialState, run.finalState, registry) : []
  const lines = [...built.slice(0, -1), ...ends, ...built.slice(-1)]

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

  // Any ERROR fails the run. Checked against the full log, not
  // the --from-tick-filtered view, but ERROR lines survive that filter unconditionally anyway.
  return lines.some((line) => line.includes(" ERROR ")) ? 1 : 0
}

const DEFAULT_VERIFY_RUNS = 10

async function commandVerify(path: string, args: ParsedArgs): Promise<number> {
  const overrides = optionsFrom(args)
  const { opening, registry } = await openMap(path, args, overrides.seed)
  const seed = overrides.seed ?? opening.seed
  const pulseTicks = overrides.ticks ?? opening.pulseTicks
  const runs = parseInteger(args.options.get("runs") ?? String(DEFAULT_VERIFY_RUNS), "--runs")
  const startTick = tickFrom(args)

  let stateHash: string | null = null
  let eventsHash: string | null = null
  let logDigest: string | null = null
  let snapshotHash: string | null = null

  for (let index = 0; index < runs; index += 1) {
    // The state at `--from-tick`, caught as the run passes it: none when the battle ends first.
    let snapshot: MatchState | null = null
    const { run, report } = playSandboxRound(opening, { registry, seed, ticks: pulseTicks, watch: (state) => (snapshot ??= state.tick === startTick ? state : null) })
    const caught = snapshot as MatchState | null
    const snapshotAt = caught === null ? null : hashState(caught)

    const log = buildLog(report, "info").join("\n")

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
    if (startTick !== undefined && snapshotAt !== snapshotHash) {
      process.stderr.write(`run ${index + 1}: state at tick ${startTick} differs from run 1\n`)
      return 1
    }
  }

  const lines = [
    `battle     ${opening.id}`,
    `runs       ${runs} identical`,
    `state      sha256:${(stateHash ?? "").slice(0, 16)}`,
    `events     sha256:${(eventsHash ?? "").slice(0, 16)}`,
  ]
  if (startTick !== undefined) {
    lines.push(
      snapshotHash === null
        ? `tick ${startTick}   every run ended before reaching this tick`
        : `tick ${startTick}   sha256:${snapshotHash.slice(0, 16)}`,
    )
  }
  lines.push("")
  process.stdout.write(lines.join("\n"))
  return 0
}

async function commandWatch(path: string, args: ParsedArgs): Promise<number> {
  const overrides = optionsFrom(args)
  const { opening, registry } = await openMap(path, args, overrides.seed)
  const seed = overrides.seed ?? opening.seed
  const pulseTicks = overrides.ticks ?? opening.pulseTicks
  const loaded = openBattle(opening, { registry, seed })
  const timeline = buildTimeline(opening, loaded.state, loaded.registry, pulseTicks, seed)

  const savePath = args.options.get("save-log")
  if (savePath !== undefined) {
    const level = parseLevel(args.options.get("log-level") ?? "warn")
    const input: ReportInput = {
      battleId: timeline.battleId,
      seed,
      pulseTicks: timeline.pulseTicks,
      registry: timeline.registry,
      events: timeline.events,
      finalState: timeline.states[timeline.states.length - 1] ?? loaded.state,
      stateHash: timeline.stateHash,
      eventsHash: timeline.eventsHash,
    }
    await writeFile(savePath, `${buildLog(input, level).join("\n")}\n`, "utf8")
  }

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
  const startTick = tickFrom(args)
  return watchPulse({
    timeline,
    colors: parseColorDepth(args.options.get("colors") ?? detectColorDepth()),
    theme: parseTheme(args.options.get("theme") ?? "dark"),
    speed: Number(args.options.get("speed") ?? "1"),
    backend: args.options.get("backend") ?? "auto",
    presentation,
    ...(startTick === undefined ? {} : { startTick }),
    stdout: process.stdout,
    stdin: process.stdin,
  })
}

/** Everything `grid` reads from its command line, besides the map; anything else is refused rather than ignored, as
 *  the game's own command line refuses it (`terminal-nexus.ts`). */
const GRID_FLAGS: ReadonlySet<string> = new Set(["help", "headless", "verify", "json", "no-effects", "reduced-motion", "swap", "shuffle", "profile", "end-states"])
const GRID_OPTIONS: ReadonlySet<string> = new Set([
  "seed",
  "ticks",
  "from-tick",
  "log-level",
  "save-log",
  "events",
  "runs",
  "colors",
  "theme",
  "glyphs",
  "speed",
  "backend",
  "cosmetic-seed",
  "seeds",
  "out",
  "baseline",
  "against",
  "jobs",
  ...VARIANT_OPTIONS,
])

/** What `grid` says for what it does not read: a retired option what changed (`RETIRED_OPTIONS`); anything else,
 *  --help. */
function unknownArgument(argument: string): string {
  const retired = retiredOption(argument)
  if (retired !== undefined) return `grid: ${retired}\n`
  return `grid: ${argument.startsWith("--") ? `unknown option ${argument}` : `unexpected "${argument}"`}.\n`
}

/** What a Build Phase sandbox's run does not read, refused rather than ignored: its walk is the regroup's own length. */
async function refusedInBuildPhase(path: string, args: ParsedArgs): Promise<string | null> {
  if (!args.options.has("ticks")) return null
  const opening = await loadSandbox(path)
  if (phaseOf(opening) !== "build-phase") return null
  return `grid: --ticks does not apply to ${opening.id}: it starts in the Build Phase, whose run is the regroup's own ${REGROUP_TICKS} ticks, whatever --ticks says. Drop --ticks.`
}

export async function main(argv: readonly string[]): Promise<number> {
  const args = parseArgs(argv)
  if (args.flags.has("help") || args.positional[0] === "help") {
    process.stdout.write(`${USAGE}\n`)
    return 0
  }
  // The map is the one positional argument; any other, and any option `grid` does not read, is refused whole,
  // before anything runs.
  const unknown = [
    ...[...args.flags].filter((name) => !GRID_FLAGS.has(name)).map((name) => `--${name}`),
    ...[...args.options.keys()].filter((name) => !GRID_OPTIONS.has(name)).map((name) => `--${name}`),
    ...args.positional.slice(1),
  ]
  if (unknown.length > 0) {
    process.stderr.write(`${unknown.map(unknownArgument).join("")}grid --help lists every option.\n`)
    return 2
  }

  const path = args.positional[0]
  if (path === undefined) {
    process.stderr.write(
      `grid needs a map file to load — the map editor isn't built yet, so this is required.\n\n${USAGE}\n`,
    )
    return 2
  }

  const trial = trialPath(path)
  if (trial !== null) return runTrial(await loadTrialFile(trial), args)
  if (args.options.has("seeds")) {
    const opening = await loadSandbox(path)
    return runTrial(adHocTrial(opening, args), args, opening)
  }
  const refused = await refusedInBuildPhase(path, args)
  if (refused !== null) {
    process.stderr.write(`${refused}\n`)
    return 2
  }
  if (args.flags.has("verify")) return commandVerify(path, args)
  if (args.flags.has("headless")) return commandHeadless(path, args)
  return commandWatch(path, args)
}
