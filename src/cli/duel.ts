// `duel`: two Commander Armies fought out on one map, headless (docs/system-design/duels.md). The shell around the
// duel's pure rules (`src/duel/`): it reads and writes files, runs a player's command, and waits for a player that is
// another process — a language model in another session, say. Commands:
//
//   duel play  --a vasse --b dob [--player-a script:balanced] [--player-b cmd:"<command>"] [--seed 1] [--rounds 8]
//              [--out <dir>]                 a whole duel in one process: scripts, or a command per round
//   duel bench [--commanders vasse,dob] [--players balanced] [--seeds 1-6] [--rounds 8] [--out <file>]
//              every pairing of every Commander (or those named), from both sides, over the seeds: who won
//   duel new    --dir <dir> --a vasse --b dob [--seed 1] [--rounds 8]       a duel played through files
//   duel wait   --dir <dir> --side A [--timeout 900]   blocks until side A has a brief to answer, and prints it
//   duel submit --dir <dir> --side A --plan <file|->   hands in A's plan; the second side's plan plays the round
//   duel status --dir <dir>                            how the duel stands
//   duel run    [--seed 1] [--commander vasse] [--player script:balanced]
//              a whole Challenge run headless: side A played by the script through the Build Phase's own functions
//              (its troops always attack: the Build Phase has no stance), battle after battle, to the run's summary
//
// A player is `script:<name>` (`balanced`, `rush`, `turtle`, each also with area damage or its buildings' upgrades:
// `rush-area`, `balanced-upgrade`, and by a formation: `rush-block`, `rush-apart`, `rush-zones`), or `cmd:<command>`: the command is run once a round with the brief's text on its standard input, and
// its standard output is the plan (`readPlan`), so a model on the command line can play. Through files, a player is anything that reads `brief-<side>-<round>.md` and runs `duel submit`.

import { execSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, rmdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { ARMIES } from "../armies/index.ts"
import type { DuelSetup, DuelState, Player, RoundReport, Side, SidePlan } from "../duel/index.ts"
import { briefOf, newDuel, playRound, readPlan, scriptedNames, scriptedPlayer, SIDES } from "../duel/index.ts"
import { DEFAULT_RUN_COMMANDER, summaryLines } from "../run/index.ts"
import { driveRun } from "./run-play.ts"

type Options = Readonly<Record<string, string>>

/** Where the play strategies are kept, and the line after which the page is written to a player. */
const STRATEGIES = new URL("../../docs/game-design/play-strategies.md", import.meta.url)
const STRATEGIES_START = "<!-- The brief reads from here to the end of the page"

/**
 * What duels have taught so far (`docs/game-design/play-strategies.md`), from the page's marker to its end: what a
 * player that reads words finds in its brief. Empty when the page is not there, as in a copy of the game without its
 * documents: the brief is whole without it.
 */
export function playStrategies(): string {
  if (!existsSync(STRATEGIES)) return ""
  const page = readFileSync(STRATEGIES, "utf8")
  const start = page.indexOf(STRATEGIES_START)
  if (start === -1) return ""
  return page.slice(page.indexOf("\n", start) + 1).trim()
}

/** `--name value` pairs and the command, from the arguments. */
function parse(args: readonly string[]): Readonly<{ command: string; options: Options }> {
  const [command = "help", ...rest] = args
  const options: Record<string, string> = {}
  for (let index = 0; index < rest.length; index += 1) {
    const name = rest[index] as string
    if (!name.startsWith("--")) throw new Error(`unexpected "${name}": options are --name value`)
    const value = rest[index + 1]
    if (value === undefined || value.startsWith("--")) throw new Error(`--${name.slice(2)} needs a value`)
    options[name.slice(2)] = value
    index += 1
  }
  return { command, options }
}

/** A whole number option, or its default. */
function number(options: Options, name: string, fallback: number): number {
  const value = options[name]
  if (value === undefined) return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) throw new Error(`--${name} must be a whole number, not "${value}"`)
  return parsed
}

/** The setup the options describe. */
function setupOf(options: Options, a: string, b: string, seed: number): DuelSetup {
  return { map: options["map"] ?? "crossing", seed, rounds: number(options, "rounds", 8), pulseTicks: number(options, "ticks", 600), commanders: { A: a, B: b } }
}

/** A player by its name: a script, or a command run each round. */
function playerOf(name: string): Player {
  if (name.startsWith("script:")) {
    const script = scriptedPlayer(name.slice("script:".length))
    if (script === undefined) throw new Error(`no script "${name}" (script: and one of ${scriptedNames()})`)
    return script
  }
  if (name.startsWith("cmd:")) throw new Error("a cmd: player is run with the brief's text: see playerWithText")
  throw new Error(`a player is script:<name> or cmd:<command>, not "${name}"`)
}

/** A side's plan for the round: a script's from the brief's data, a command's from the brief's text on its input. */
function planFrom(name: string, state: DuelState, side: Side): Readonly<{ plan: SidePlan; problems: readonly string[] }> {
  const brief = briefOf(state, side, playStrategies())
  if (!name.startsWith("cmd:")) return { plan: playerOf(name)(brief.data), problems: [] }
  const output = execSync(name.slice("cmd:".length), { input: brief.text, encoding: "utf8", maxBuffer: 1 << 20, timeout: 600_000 })
  return readPlan(output)
}

/** One round's report as a few lines for a person. */
export function roundLines(report: RoundReport): string[] {
  const lines = [`round ${report.round}: ended ${report.ended === "nexus" ? "when a Nexus fell" : "on time"} at tick ${report.ticks}`]
  for (const side of SIDES) {
    const own = report.sides[side]
    const counts = (record: Readonly<Record<string, number>>): string => Object.entries(record).map(([name, count]) => `${count} ${name}`).join(", ") || "none"
    lines.push(
      `  ${side} ${own.commander}: ${own.credits} credits, spent ${own.spent}${own.earned > 0 ? `, earned ${own.earned}` : ""}; kept ${own.kept ?? "nothing"}; built ${own.built.length}${own.formation === undefined ? "" : ` (${own.formation})`}${own.actions === undefined ? "" : `; ${own.actions.join(", ")}`}${own.refused.length > 0 ? `, refused ${own.refused.length}` : ""}; ${own.stance}`,
      `     fielded ${counts(own.fielded)}; trained ${counts(own.trained)}; lost ${counts(own.lost)}`,
      `     dealt ${own.dealt.units}/${own.dealt.buildings}/${own.dealt.nexus} (units/buildings/Nexus); Nexus ${own.nexus.after}/${own.nexus.most}${own.commanderFell ? "; Commander fell" : ""}${Object.keys(own.abilities).length > 0 ? `; ${counts(own.abilities)}` : ""}`,
    )
  }
  return lines
}

/** How a duel ended, in a line. */
const resultLine = (state: DuelState): string =>
  state.result === null
    ? `round ${state.round} to play`
    : state.result.winner === null
      ? `a draw after round ${state.result.round}`
      : `${state.result.winner} (${state.setup.commanders[state.result.winner]}) won by ${state.result.by} in round ${state.result.round}`

// --- A duel through files ------------------------------------------------------------------------------------------

const statePath = (dir: string): string => join(dir, "state.json")
const briefPath = (dir: string, side: Side, round: number, kind: "md" | "json"): string => join(dir, `brief-${side}-${round}.${kind}`)
const planPath = (dir: string, side: Side, round: number): string => join(dir, `plan-${side}-${round}.json`)

function load(dir: string): DuelState {
  return JSON.parse(readFileSync(statePath(dir), "utf8")) as DuelState
}

/** The duel saved, and each side's brief for the round to play written beside it (or the result, once it ended). */
function save(dir: string, state: DuelState): void {
  writeFileSync(statePath(dir), `${JSON.stringify(state)}\n`)
  if (state.result !== null) {
    writeFileSync(join(dir, "result.md"), `${resultLine(state)}\n\n${state.history.flatMap(roundLines).join("\n")}\n`)
    return
  }
  for (const side of SIDES) {
    const brief = briefOf(state, side, playStrategies())
    writeFileSync(briefPath(dir, side, state.round, "md"), `${brief.text}\n`)
    writeFileSync(briefPath(dir, side, state.round, "json"), `${JSON.stringify(brief.data, null, 1)}\n`)
  }
}

/** Waits `ms` without spinning the processor. */
const pause = (ms: number): void => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/** Holds the duel's lock while `work` runs: two sides submitting at once never play one round twice. */
function locked<T>(dir: string, work: () => T): T {
  const lock = join(dir, "lock")
  for (let tries = 0; ; tries += 1) {
    try {
      mkdirSync(lock)
      break
    } catch {
      if (tries > 600) throw new Error(`the duel in ${dir} stayed locked for a minute: remove ${lock} if nothing is running`)
      pause(100)
    }
  }
  try {
    return work()
  } finally {
    rmdirSync(lock)
  }
}

// --- Commands --------------------------------------------------------------------------------------------------------

function play(options: Options, write: (line: string) => void): number {
  const a = options["a"]
  const b = options["b"]
  if (a === undefined || b === undefined) throw new Error("duel play needs --a and --b, each a Commander's id")
  const players = { A: options["player-a"] ?? "script:balanced", B: options["player-b"] ?? "script:balanced" }
  let state = newDuel(setupOf(options, a, b, number(options, "seed", 1)))
  const out = options["out"]
  if (out !== undefined) mkdirSync(out, { recursive: true })
  while (state.result === null) {
    const planned = { A: planFrom(players.A, state, "A"), B: planFrom(players.B, state, "B") }
    for (const side of SIDES) for (const problem of planned[side].problems) write(`  ${side}'s plan: ${problem}`)
    if (out !== undefined) for (const side of SIDES) writeFileSync(briefPath(out, side, state.round, "md"), `${briefOf(state, side, playStrategies()).text}\n`)
    const { state: next, report } = playRound(state, { A: planned.A.plan, B: planned.B.plan })
    state = next
    for (const line of roundLines(report)) write(line)
  }
  write(resultLine(state))
  if (out !== undefined) writeFileSync(join(out, "duel.json"), `${JSON.stringify(state.history, null, 1)}\n`)
  return 0
}

/** "1-6" or "1,4,9": the seeds. */
function seedsOf(text: string): number[] {
  const range = /^(\d+)-(\d+)$/.exec(text)
  if (range !== null) {
    const from = Number(range[1])
    const to = Number(range[2])
    return Array.from({ length: to - from + 1 }, (_, index) => from + index)
  }
  return text.split(",").map((seed) => Number(seed))
}

function bench(options: Options, write: (line: string) => void): number {
  const commanders = options["commanders"]?.split(",") ?? ARMIES.commanders.map((commander) => commander.id)
  const players = (options["players"] ?? "balanced").split(",")
  const seeds = seedsOf(options["seeds"] ?? "1-4")
  type Row = { pairing: string; player: string; games: number; wins: Record<string, number>; byNexus: number; rounds: number }
  const rows: Row[] = []
  for (const player of players) {
    const script = playerOf(`script:${player}`)
    for (let i = 0; i < commanders.length; i += 1) {
      for (let j = i + 1; j < commanders.length; j += 1) {
        const first = commanders[i] as string
        const second = commanders[j] as string
        const row: Row = { pairing: `${first} v ${second}`, player, games: 0, wins: { [first]: 0, [second]: 0, draw: 0 }, byNexus: 0, rounds: 0 }
        // Every seed from both sides, so a side's advantage on the map cancels out.
        for (const seed of seeds) {
          for (const [a, b] of [
            [first, second],
            [second, first],
          ] as const) {
            let state = newDuel(setupOf(options, a, b, seed))
            while (state.result === null) state = playRound(state, { A: script(briefOf(state, "A").data), B: script(briefOf(state, "B").data) }).state
            const result = state.result as NonNullable<DuelState["result"]>
            row.games += 1
            row.rounds += result.round
            if (result.by === "nexus") row.byNexus += 1
            const winner = result.winner === null ? "draw" : state.setup.commanders[result.winner]
            row.wins[winner] = (row.wins[winner] ?? 0) + 1
          }
        }
        rows.push(row)
        write(`${row.player.padEnd(9)} ${row.pairing.padEnd(16)} ${Object.entries(row.wins).map(([name, count]) => `${name} ${count}`).join(", ")}  (${row.games} games, ${row.byNexus} by a Nexus falling, ${(row.rounds / row.games).toFixed(1)} rounds on average)`)
      }
    }
  }
  if (options["out"] !== undefined) writeFileSync(options["out"], `${JSON.stringify(rows, null, 1)}\n`)
  return 0
}

function create(options: Options, write: (line: string) => void): number {
  const dir = options["dir"]
  const a = options["a"]
  const b = options["b"]
  if (dir === undefined || a === undefined || b === undefined) throw new Error("duel new needs --dir, --a and --b")
  mkdirSync(dir, { recursive: true })
  const state = newDuel(setupOf(options, a, b, number(options, "seed", 1)))
  save(dir, state)
  write(`a duel of ${state.setup.rounds} rounds, ${a} (A, west) against ${b} (B, east), in ${dir}`)
  write(`each side reads ${briefPath(dir, "A", 1, "md").replace("-A-", "-<side>-")} and answers with: duel submit --dir ${dir} --side <side> --plan <file>`)
  return 0
}

function wait(options: Options, write: (line: string) => void): number {
  const dir = options["dir"]
  const side = options["side"] as Side | undefined
  if (dir === undefined || (side !== "A" && side !== "B")) throw new Error("duel wait needs --dir and --side A or B")
  const until = Date.now() + number(options, "timeout", 900) * 1000
  for (;;) {
    const state = load(dir)
    if (state.result !== null) {
      write(`THE DUEL IS OVER: ${resultLine(state)}`)
      write(readFileSync(join(dir, "result.md"), "utf8"))
      return 0
    }
    if (!existsSync(planPath(dir, side, state.round)) && existsSync(briefPath(dir, side, state.round, "md"))) {
      write(`brief: ${briefPath(dir, side, state.round, "md")}`)
      write(readFileSync(briefPath(dir, side, state.round, "md"), "utf8"))
      return 0
    }
    if (Date.now() > until) {
      write(`still waiting for the other side's plan for round ${state.round}: run duel wait again`)
      return 2
    }
    pause(1000)
  }
}

function submit(options: Options, write: (line: string) => void): number {
  const dir = options["dir"]
  const side = options["side"] as Side | undefined
  const from = options["plan"]
  if (dir === undefined || (side !== "A" && side !== "B") || from === undefined) throw new Error("duel submit needs --dir, --side A or B, and --plan <file or ->")
  const text = from === "-" ? readFileSync(0, "utf8") : readFileSync(from, "utf8")
  const { plan, problems } = readPlan(text)
  for (const problem of problems) write(`your plan: ${problem}`)
  return locked(dir, () => {
    const state = load(dir)
    if (state.result !== null) {
      write(`the duel is over: ${resultLine(state)}`)
      return 0
    }
    writeFileSync(planPath(dir, side, state.round), `${JSON.stringify(plan)}\n`)
    const other: Side = side === "A" ? "B" : "A"
    if (!existsSync(planPath(dir, other, state.round))) {
      write(`plan for round ${state.round} kept; waiting for side ${other}. Run: duel wait --dir ${dir} --side ${side}`)
      return 0
    }
    const plans = { A: JSON.parse(readFileSync(planPath(dir, "A", state.round), "utf8")) as SidePlan, B: JSON.parse(readFileSync(planPath(dir, "B", state.round), "utf8")) as SidePlan }
    const { state: next, report } = playRound(state, plans)
    writeFileSync(join(dir, `report-${report.round}.md`), `${roundLines(report).join("\n")}\n`)
    save(dir, next)
    for (const line of roundLines(report)) write(line)
    write(next.result === null ? `round ${next.round} is open. Run: duel wait --dir ${dir} --side ${side}` : `THE DUEL IS OVER: ${resultLine(next)}`)
    return 0
  })
}

function status(options: Options, write: (line: string) => void): number {
  const dir = options["dir"]
  if (dir === undefined) throw new Error("duel status needs --dir")
  const state = load(dir)
  write(`${state.setup.commanders.A} (A) against ${state.setup.commanders.B} (B): ${resultLine(state)}`)
  for (const report of state.history) for (const line of roundLines(report)) write(line)
  return 0
}

/** A whole Challenge run, side A by a script through the Build Phase's functions (`driveRun`): every round, then the
 *  summary. */
function run(options: Options, write: (line: string) => void): number {
  const name = options["player"] ?? "script:balanced"
  if (name.startsWith("cmd:")) throw new Error("duel run plays side A by a script: --player script:<name>")
  const driven = driveRun({ seed: number(options, "seed", 1), commander: options["commander"] ?? DEFAULT_RUN_COMMANDER }, playerOf(name))
  let battle = 0
  for (const round of driven.rounds) {
    if (round.battle !== battle) {
      battle = round.battle
      const opponent = driven.run.definition.battles[battle - 1]
      write(`battle ${battle}: against ${opponent?.opponent ?? "?"} (${opponent?.policy ?? "?"}), seed ${opponent?.duel.seed ?? "?"}`)
    }
    for (const line of roundLines(round.report)) write(`  ${line}`)
  }
  for (const line of summaryLines(driven.run)) write(line)
  return 0
}

/** The comment this file opens with: what `duel help` prints. */
function usage(): string {
  const lines = readFileSync(new URL(import.meta.url), "utf8").split("\n")
  const end = lines.findIndex((line) => !line.startsWith("//"))
  return lines.slice(0, end).map((line) => line.slice(3)).join("\n")
}

/** Runs the command the arguments name; returns the exit code. */
export function main(args: readonly string[], write: (line: string) => void = (line) => process.stdout.write(`${line}\n`)): number {
  const { command, options } = parse(args)
  switch (command) {
    case "play":
      return play(options, write)
    case "bench":
      return bench(options, write)
    case "new":
      return create(options, write)
    case "wait":
      return wait(options, write)
    case "submit":
      return submit(options, write)
    case "status":
      return status(options, write)
    case "run":
      return run(options, write)
    default:
      write(usage())
      return command === "help" ? 0 : 1
  }
}
