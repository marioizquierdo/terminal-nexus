// `skirmish`: one battle between two Commanders, set up, played a round at a time and saved, headless
// (docs/system-design/skirmish-saves.md). One command, the same options whether the battle is new or loaded:
//
//   skirmish --map crossing --p1 build: --p2 script:agro            a new battle: print p1's brief
//   skirmish --map crossing --p1 build:plan.json --p2 script:agro   check p1's plan against the rules, build nothing
//   skirmish --map crossing --p1 build:. --p2 script:agro --battle --save s.json
//                                                                   build both plans, play the Battle Round, save
//   skirmish --load s.json                                          the briefs of the slots a player plans
//   skirmish --load s.json --p1 script:defensive --p2 build:        change who plans each slot
//   skirmish --load s.json --p1 build:plan.json --save s.json       keep p1's plan as the save's draft, no battle
//   skirmish -f s.json --battle                                     load, play the next round, save over it
//   skirmish --map pocket --p1 build:a.json --p2 build:b.json --battle        two plans of your own, against each other
//   skirmish --map crossing --p1 script:agro --p2 script:defensive --play-until-win
//   skirmish --map crossing --p1 script:agro --p2 script:defensive --play-until-win --seeds 1-20
//
// Options:
//   --map <id|file>        a new battle's map: crossing, pocket, or a map file (its rows, nexus and hold by slot)
//   --load <file>          a save file to carry on from, at its Build Phase
//   --save <file>          where to write the save (made or replaced); -f <file> (--file) loads and saves one file
//   --p1, --p2 <who>       who plans the slot: build:<plan file> (a player; "build:." reads ./build.json, "build:" alone
//                          the save's draft or nothing), or script:<profile or script> ("script:" alone plans nothing).
//                          Profiles are players/scripts/*.json (agro, defensive, steady, agro-rich); a duel script's own
//                          name works too (rush, turtle, balanced and their variants)
//   --p1-credits, --p2-credits <share>     a slot's share of the curve's income (1 unless set; a profile may set one)
//   --p1-commander, --p2-commander <id>    a new battle's Commanders (vasse, averno, dob); default vasse against dob
//   --seed <n>, --ticks <n>                a new battle's seed (1) and ticks a Battle Round lasts (360)
//   --rounds <n>           rounds a battle lasts at most (8); on a loaded battle, from now on
//   --modifiers <a,b>      named rules over the battle: fast-rounds, double-income ("none" clears them)
//   --battle               build both slots' plans and play the Battle Round
//   --battles <n>          play n rounds (a player's plan plays only in the first; later rounds need scripts)
//   --play-until-win       every slot a script: play until the battle ends, a Nexus falling or the rounds running out
//                          (the limit is raised to 100 rounds unless --rounds says otherwise)
//   --seeds <1-20|1,4,9>   a new battle played once a seed, with --battles or --play-until-win: a line each, then a tally
//   --out <dir>            every round played: its save (round-<n>.save.json) and its report (round-<n>.txt)
//   --log <file>           the battle's log, every round played, at --log-level (info; error, warn, info, debug, trace)
//   --json                 the briefs as data rather than text
//   --name <text>, --notes <text>          the save's name and notes
//
// Without a round to play it changes nothing: a slot with a plan file has the plan checked (what it would build, and
// what the rules refuse, with the reason; exit 1 if anything is refused), a player's slot without one prints its brief.
// Saving and loading happen only at a Build Phase (the owner, 2026-11-12).

import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { DuelState, RoundReport, SidePlan } from "../duel/index.ts"
import { briefOf, checkPlan, readPlan } from "../duel/index.ts"
import { buildLog, parseLevel } from "../report/index.ts"
import type { LogLevel, ReportInput } from "../report/index.ts"
import { FIXTURE_REGISTRY } from "../content/index.ts"
import { resolvePulse } from "../pulse/index.ts"
import { openBattle } from "../skirmish/opening/open.ts"
import { openingOf } from "../skirmish/start.ts"
import { hashEvents } from "../events/serialize.ts"
import { hashState } from "../state/serialize.ts"
import { readProfiles } from "../skirmish/profile-files.ts"
import type { Played } from "../skirmish/play.ts"
import { isPlayer, playNext } from "../skirmish/play.ts"
import type { Controller, Profiles, SaveFile, SaveMap, SaveSetup, Slot } from "../skirmish/save.ts"
import { controllerProblem, duelOf, IDLE_SCRIPT, MODIFIERS, newSetup, readSave, saveOf, saveText, SIDE_OF, SLOT_OF, SLOTS } from "../skirmish/save.ts"
import { playStrategies, roundLines } from "./duel.ts"

type Options = Readonly<{ values: Readonly<Record<string, string>>; flags: ReadonlySet<string> }>

/** The options that take no value. */
const FLAGS = new Set(["battle", "play-until-win", "json", "help"])
/** The options that take one. */
const VALUES = new Set([
  "map", "load", "save", "file", "p1", "p2", "p1-commander", "p2-commander", "p1-credits", "p2-credits",
  "seed", "seeds", "rounds", "ticks", "modifiers", "battles", "out", "log", "log-level", "name", "notes",
])

/** How many rounds `--play-until-win` plays at most, unless `--rounds` says otherwise. */
export const UNTIL_WIN_ROUNDS = 100

/** `--name value`, `--name=value`, `-f value` and the flags, from the arguments. Every option it does not know is
 *  refused by name, so a misspelt one never passes silently. */
export function parseSkirmish(args: readonly string[]): Options {
  const values: Record<string, string> = {}
  const flags = new Set<string>()
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] as string
    if (arg === "help" || arg === "-h") {
      flags.add("help")
      continue
    }
    const long = /^--([a-z0-9-]+)(?:=(.*))?$/.exec(arg)
    const name = arg === "-f" ? "file" : long?.[1]
    if (name === undefined) throw new Error(`unexpected "${arg}": options are --name value (skirmish --help)`)
    if (FLAGS.has(name)) {
      flags.add(name)
      continue
    }
    if (!VALUES.has(name)) throw new Error(`no option --${name} (skirmish --help)`)
    const inline = long?.[2]
    const value = inline ?? args[index + 1]
    if (value === undefined || (inline === undefined && value.startsWith("-") && value !== "-" && !/^-?\d/.test(value))) throw new Error(`--${name} needs a value`)
    if (inline === undefined) index += 1
    values[name] = value
  }
  return { values, flags }
}

/** A whole number option, or `undefined`. */
function whole(options: Options, name: string): number | undefined {
  const value = options.values[name]
  if (value === undefined) return undefined
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) throw new Error(`--${name} must be a whole number, not "${value}"`)
  return parsed
}

/** What `--p1`/`--p2` asks for: the controller, and for a player the plan file it reads (`""`: none). */
export type SlotAsk = Readonly<{ controller: Controller; planFile?: string }>

/** `build:<file>`, `build:`, `script:<name>`, `script:`, or a controller as a save writes it. */
export function slotAsk(text: string, profiles?: Profiles): SlotAsk {
  if (text === "build" || text.startsWith("build:")) return { controller: "player", planFile: text.slice("build:".length) }
  if (text === "script" || text === "script:") return { controller: `script:${IDLE_SCRIPT}` }
  const problem = controllerProblem(text, profiles)
  if (problem !== null) throw new Error(`${problem}: a slot is build:<plan file> or script:<profile>`)
  return { controller: text }
}

/** "1-6" or "1,4,9": the seeds. */
export function seedsOf(text: string): number[] {
  const range = /^(-?\d+)-(-?\d+)$/.exec(text)
  const seeds = range !== null ? Array.from({ length: Math.max(0, Number(range[2]) - Number(range[1]) + 1) }, (_, index) => Number(range[1]) + index) : text.split(",").map(Number)
  if (seeds.length === 0 || seeds.some((seed) => !Number.isInteger(seed))) throw new Error(`--seeds is a range (1-20) or a list (1,4,9), not "${text}"`)
  return seeds
}

/** A plan file's path: a folder (`.` included) means the `build.json` in it. */
function planPath(file: string): string {
  return existsSync(file) && statSync(file).isDirectory() ? join(file, "build.json") : file
}

/** A map file: its rows, and its Nexus and hold for each slot. */
function mapFile(path: string): SaveMap {
  const value = JSON.parse(readFileSync(path, "utf8")) as Partial<SaveMap>
  return { id: value.id ?? path.replace(/^.*\//, "").replace(/\.json$/, ""), name: value.name ?? value.id ?? path, ...value } as SaveMap
}

const optional = <K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> => (value === undefined ? {} : ({ [key]: value } as Record<K, V>))

/** `--modifiers`: a list, or "none". */
function modifiersOf(text: string): string[] {
  return text === "none" || text === "" ? [] : text.split(",").map((name) => name.trim())
}

/** A share option, or `undefined`. */
function share(options: Options, slot: Slot): number | undefined {
  const value = options.values[`${slot}-credits`]
  if (value === undefined) return undefined
  const parsed = Number(value)
  if (!(parsed > 0)) throw new Error(`--${slot}-credits is a share above 0 (1 is the curve's), not "${value}"`)
  return parsed
}

/** The save this run starts from: loaded, or a new battle from the options (at `seed`, when one is given). */
function startingSave(options: Options, profiles: Profiles, seed?: number): Readonly<{ save: SaveFile; loaded: string | null }> {
  const load = options.values["load"] ?? options.values["file"]
  if (load !== undefined) {
    if (options.values["map"] !== undefined) throw new Error("--map starts a new battle; a loaded save keeps its map")
    for (const name of ["seed", "seeds", "ticks"]) if (options.values[name] !== undefined) throw new Error(`--${name} sets up a new battle; a loaded save keeps its own`)
    const { save, problems } = readSave(readFileSync(load, "utf8"), profiles)
    if (save === null) throw new Error(`${load} is not a save the game can load:\n  ${problems.join("\n  ")}`)
    for (const slot of SLOTS) {
      const asked = options.values[`${slot}-commander`]
      if (asked !== undefined && asked !== save.setup.slots[slot].commander) {
        throw new Error(`${slot}'s Commander is ${save.setup.slots[slot].commander} in ${load}: a loaded battle keeps its Commanders`)
      }
    }
    return { save, loaded: load }
  }
  const map = options.values["map"]
  if (map === undefined) throw new Error("a battle needs --map <id|file> to start a new one, or --load <file> (skirmish --help)")
  const setup = newSetup({
    map: map.endsWith(".json") ? mapFile(map) : map,
    ...optional("seed", seed ?? whole(options, "seed")),
    ...optional("roundTicks", whole(options, "ticks")),
    slots: {
      p1: { ...optional("commander", options.values["p1-commander"]) },
      p2: { ...optional("commander", options.values["p2-commander"]) },
    },
  })
  const { save, problems } = readSave(JSON.stringify({ format: "terminal-nexus.save/1", setup }), profiles)
  if (save === null) throw new Error(`that battle cannot be set up:\n  ${problems.join("\n  ")}`)
  return { save, loaded: null }
}

/** A slot's label for a person: `p1 (west, vasse, player)`. */
const slotLabel = (setup: SaveSetup, slot: Slot): string => `${slot} (${slot === "p1" ? "west" : "east"}, ${setup.slots[slot].commander}, ${setup.slots[slot].controller})`

/** A round's report with the duel's sides named by slot. */
const slotLines = (report: RoundReport): string[] => roundLines(report).map((line) => line.replace(/^ {2}A /, "  p1 ").replace(/^ {2}B /, "  p2 "))

/** The slot that won, or `null` for a draw or a battle not over. */
const winnerOf = (state: DuelState): Slot | null => (state.result?.winner === undefined || state.result.winner === null ? null : SLOT_OF[state.result.winner])

/** How the battle stands, in a line. */
function standing(setup: SaveSetup, state: DuelState): string {
  if (state.result === null) return `round ${state.round} of ${setup.rounds}, at its Build Phase`
  const winner = winnerOf(state)
  return winner === null ? `over: a draw after round ${state.result.round}` : `over: ${slotLabel(setup, winner)} won by ${state.result.by} in round ${state.result.round}`
}

/** The battle's log for a round played, at `level`, as `grid` writes one (`buildLog`). */
function roundLog(played: Played, setup: SaveSetup, round: number, level: LogLevel): string[] {
  if (played.final === null || played.registry === null) return []
  const lines = buildLog(
    {
      battleId: `skirmish round ${round}`,
      seed: setup.seed,
      pulseTicks: played.state.setup.pulseTicks,
      registry: played.registry,
      events: played.events,
      finalState: played.final,
      stateHash: hashState(played.final),
      eventsHash: hashEvents(played.events),
    },
    level,
  )
  return [`=== round ${round}: ${played.events.length} events`, ...lines]
}

/** The setup this run plays: the save's, with the options' changes to who plans each slot, the shares, the round
 *  limit and the modifiers. Also the plan files read for the player slots. */
function setupFor(options: Options, save: SaveFile, profiles: Profiles, write: (line: string) => void): Readonly<{ setup: SaveSetup; plans: Partial<Record<Slot, SidePlan>>; fromFile: ReadonlySet<Slot> }> {
  const slots: Record<Slot, SaveSetup["slots"][Slot]> = { ...save.setup.slots }
  const plans: Partial<Record<Slot, SidePlan>> = {}
  const fromFile = new Set<Slot>()
  for (const slot of SLOTS) {
    const asked = options.values[slot]
    const ask = asked === undefined ? null : slotAsk(asked, profiles)
    if (ask !== null) slots[slot] = { ...slots[slot], controller: ask.controller }
    const credits = share(options, slot)
    if (credits !== undefined) slots[slot] = { ...slots[slot], options: { ...slots[slot].options, credits } }
    if (!isPlayer({ ...save.setup, slots }, slot)) continue
    if (ask?.planFile !== undefined && ask.planFile !== "") {
      const path = planPath(ask.planFile)
      if (!existsSync(path)) throw new Error(`${slot}: no plan file ${path}`)
      const { plan, problems } = readPlan(readFileSync(path, "utf8"))
      for (const problem of problems) write(`${slot}'s plan (${path}): ${problem}`)
      plans[slot] = plan
      fromFile.add(slot)
    } else {
      const draft = save.draft?.[slot]
      if (draft !== undefined) plans[slot] = readPlan(draft).plan
    }
  }
  const rounds = whole(options, "rounds") ?? (options.flags.has("play-until-win") ? Math.max(save.setup.rounds, UNTIL_WIN_ROUNDS) : undefined)
  const modifiers = options.values["modifiers"] === undefined ? undefined : modifiersOf(options.values["modifiers"])
  for (const modifier of modifiers ?? []) if (!(MODIFIERS as readonly string[]).includes(modifier)) throw new Error(`no modifier "${modifier}" (${MODIFIERS.join(", ")})`)
  const setup: SaveSetup = { ...save.setup, slots, ...optional("rounds", rounds), ...optional("modifiers", modifiers) }
  if (rounds !== undefined && rounds < 1) throw new Error("--rounds must be 1 or more")
  return { setup, plans, fromFile }
}

/** How many rounds this run plays: none, one, n, or until the battle ends. */
function roundsToPlay(options: Options): number {
  const asked = [options.flags.has("battle"), options.values["battles"] !== undefined, options.flags.has("play-until-win")].filter(Boolean).length
  if (asked > 1) throw new Error("--battle, --battles and --play-until-win each say how many rounds to play: give one")
  if (options.flags.has("play-until-win")) return Number.POSITIVE_INFINITY
  if (options.values["battles"] !== undefined) {
    const count = whole(options, "battles") as number
    if (count < 1) throw new Error("--battles must be 1 or more")
    return count
  }
  return options.flags.has("battle") ? 1 : 0
}

/** Plays up to `count` rounds; returns the duel after them. Writes each round's report, and its save and log when
 *  asked. */
function playRounds(
  setup: SaveSetup,
  start: DuelState,
  plans: Partial<Record<Slot, SidePlan>>,
  count: number,
  profiles: Profiles,
  options: Options,
  write: (line: string) => void,
): DuelState {
  const out = options.values["out"]
  if (out !== undefined) mkdirSync(out, { recursive: true })
  const log = options.values["log"]
  const level = parseLevel(options.values["log-level"] ?? "info")
  const quiet = options.values["seeds"] !== undefined
  let state = start
  for (let played = 0; played < count && state.result === null; played += 1) {
    const round = state.round
    const result = playNext(setup, state, played === 0 ? plans : {}, profiles)
    state = result.state
    if (!quiet) for (const line of slotLines(result.report)) write(line)
    if (log !== undefined) appendFileSync(log, `${[`--- seed ${setup.seed}`, ...roundLog(result, setup, round, level)].join("\n")}\n`)
    if (out !== undefined) {
      const prefix = quiet ? `seed-${setup.seed}-round-${round}` : `round-${round}`
      writeFileSync(join(out, `${prefix}.save.json`), saveText(saveOf(setup, state)))
      writeFileSync(join(out, `${prefix}.txt`), `${[...slotLines(result.report), standing(setup, state)].join("\n")}\n`)
    }
  }
  return state
}

/** Many seeds of one new battle: a line each, then the tally. */
function playSeeds(options: Options, profiles: Profiles, count: number, write: (line: string) => void): number {
  if (options.values["load"] !== undefined || options.values["file"] !== undefined) throw new Error("--seeds plays a new battle once a seed: use --map, not --load")
  if (options.values["save"] !== undefined) throw new Error("--seeds plays many battles: keep them with --out <dir>, not --save")
  if (count === 0) throw new Error("--seeds needs --battles <n> or --play-until-win: how many rounds each seed plays")
  const seeds = seedsOf(options.values["seeds"] as string)
  const tally: Record<string, number> = { p1: 0, p2: 0, draw: 0, unfinished: 0 }
  let rounds = 0
  let byNexus = 0
  let label = ""
  for (const seed of seeds) {
    const { save } = startingSave(options, profiles, seed)
    const { setup, plans } = setupFor(options, save, profiles, write)
    if (count > 1) for (const slot of SLOTS) if (isPlayer(setup, slot)) throw new Error(`${slot} is a player: a plan plays one round; give it a script to play many seeds`)
    label = `${slotLabel(setup, "p1")} against ${slotLabel(setup, "p2")} on ${mapName(setup)}`
    const state = playRounds(setup, duelOf({ ...save, setup }, profiles), plans, count, profiles, options, write)
    const winner = winnerOf(state)
    const key = state.result === null ? "unfinished" : (winner ?? "draw")
    tally[key] = (tally[key] ?? 0) + 1
    rounds += state.round - 1
    if (state.result?.by === "nexus") byNexus += 1
    write(`seed ${seed}: ${standing(setup, state)}`)
  }
  write(`${label}, ${seeds.length} seeds: p1 won ${tally["p1"]}, p2 won ${tally["p2"]}, ${tally["draw"]} drawn${tally["unfinished"] === 0 ? "" : `, ${tally["unfinished"]} unfinished`}; ${byNexus} by a Nexus falling; ${(rounds / seeds.length).toFixed(1)} rounds on average`)
  return 0
}

/** Runs the command; returns the exit code. */
export function main(args: readonly string[], write: (line: string) => void = (line) => process.stdout.write(`${line}\n`), profiles: Profiles = readProfiles()): number {
  const options = parseSkirmish(args)
  if (options.flags.has("help") || args.length === 0) {
    write(usage())
    return args.length === 0 ? 1 : 0
  }
  const count = roundsToPlay(options)
  if (options.values["seeds"] !== undefined) return playSeeds(options, profiles, count, write)
  const { save, loaded } = startingSave(options, profiles)
  if (save.start !== undefined) return testingSave(save, options, write)
  const { setup, plans, fromFile } = setupFor(options, save, profiles, write)
  const state = duelOf({ ...save, setup }, profiles)
  const players = SLOTS.filter((slot) => isPlayer(setup, slot))
  write(`${setup.slots.p1.commander} (p1) against ${setup.slots.p2.commander} (p2) on ${mapName(setup)}, seed ${setup.seed}${setup.modifiers.length === 0 ? "" : `, ${setup.modifiers.join(", ")}`}: ${standing(setup, state)}`)
  if (setup.rounds < state.round && state.result === null) throw new Error(`--rounds ${setup.rounds}: the battle is already at round ${state.round}`)

  let next = state
  let draft: Partial<Record<Slot, SidePlan>> = { ...plans }
  let code = 0
  if (count > 0) {
    if (state.result !== null) throw new Error("the battle is over: there is no next round to play")
    for (const slot of count > 1 ? players : []) {
      throw new Error(`${slot} is a player: a plan plays one round; give every slot a script to play ${count === Number.POSITIVE_INFINITY ? "until the battle ends" : `${count} rounds`}`)
    }
    for (const slot of players) if (plans[slot] === undefined) write(`${slot} has no plan: it builds nothing and attacks`)
    next = playRounds(setup, state, plans, count, profiles, options, write)
    draft = {}
    write(standing(setup, next))
  } else if (state.result !== null) {
    // Over: nothing to plan.
  } else if (players.length === 0) {
    write(`no player plans a slot (${SLOTS.map((slot) => `${slot} ${setup.slots[slot].controller}`).join(", ")}): add --battle to play the round, or --play-until-win`)
  } else {
    for (const slot of players) {
      const side = SIDE_OF[slot]
      const given = plans[slot]
      if (given !== undefined && (fromFile.has(slot) || !options.flags.has("json"))) {
        const checked = checkPlan(state, side, given)
        write(`${slotLabel(setup, slot)}: ${fromFile.has(slot) ? "the plan" : "the draft"} checked, nothing built`)
        write(`  keeps ${checked.kept ?? "no card"}; ${checked.credits} credits, spends ${checked.spent}, leaves ${checked.credits - checked.spent}`)
        for (const line of checked.built) write(`  builds ${line}`)
        for (const line of checked.actions) write(`  takes ${line}`)
        for (const line of checked.refused) write(`  REFUSED ${line}`)
        if (checked.refused.length > 0) code = 1
        if (fromFile.has(slot)) continue
      }
      const brief = briefOf(state, side, playStrategies())
      write(`--- brief for ${slotLabel(setup, slot)}`)
      write(options.flags.has("json") ? JSON.stringify(brief.data, null, 1) : brief.text)
    }
  }

  const target = options.values["save"] ?? options.values["file"]
  if (target !== undefined) {
    const name = options.values["name"] ?? save.name
    const notes = options.values["notes"] ?? save.notes
    writeFileSync(target, saveText(saveOf(setup, next, { ...optional("name", name), ...optional("notes", notes), draft })))
    write(`saved ${target}${next.result === null ? ` at round ${next.round}'s Build Phase` : ", the battle over"}`)
  } else if (count > 0) {
    write(`not saved: add --save <file>${loaded === null ? "" : ` (or -f ${loaded})`} to keep it`)
  }
  return code
}

/**
 * A testing save (`skirmish-testing/`, a save with a `start`): its one Battle Round is written by hand, so it is opened
 * by the kernel from that start, as `grid` opens it, not by the duel, and played to its end or its ticks. Without
 * `--battle` it says what it is; with it, the round's report as `grid --headless` prints it. Nothing is saved: the
 * file is the battle.
 */
function testingSave(save: SaveFile, options: Options, write: (line: string) => void): number {
  for (const slot of SLOTS) if (options.values[slot] !== undefined) throw new Error(`--${slot}: a testing save's slots plan nothing, its units are in its start`)
  if (options.values["save"] !== undefined) throw new Error("--save: a testing save plays the one Battle Round its start writes, with nothing to save after it")
  const opening = openingOf(save)
  write(`${opening.name} (${opening.id}), seed ${save.setup.seed}: a testing save, its Battle Round written by hand, ${save.setup.roundTicks} ticks at most`)
  if (!options.flags.has("battle")) {
    write("add --battle to play it")
    return 0
  }
  const loaded = openBattle(opening, { registry: FIXTURE_REGISTRY })
  const run = resolvePulse({ initialState: loaded.state, registry: loaded.registry, pulseTicks: opening.pulseTicks, seed: opening.seed })
  const input: ReportInput = {
    battleId: opening.id,
    seed: opening.seed,
    pulseTicks: opening.pulseTicks,
    registry: loaded.registry,
    events: run.events,
    finalState: run.finalState,
    stateHash: run.stateHash,
    eventsHash: run.eventsHash,
  }
  const lines = buildLog(input, parseLevel(options.values["log-level"] ?? "warn"))
  if (options.values["log"] !== undefined) writeFileSync(options.values["log"], `${lines.join("\n")}\n`)
  for (const line of lines) write(line)
  write(`tick by tick: grid ${opening.id} --headless --log-level info`)
  return lines.some((line) => line.includes(" ERROR ")) ? 1 : 0
}

/** The map's name for a person. */
const mapName = (setup: SaveSetup): string => (typeof setup.map === "string" ? setup.map : (setup.map.name ?? setup.map.id))

/** The comment this file opens with: what `skirmish --help` prints. */
function usage(): string {
  const lines = readFileSync(new URL(import.meta.url), "utf8").split("\n")
  const end = lines.findIndex((line) => !line.startsWith("//"))
  return lines.slice(0, end).map((line) => line.slice(3)).join("\n")
}
