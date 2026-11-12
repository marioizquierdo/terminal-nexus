// `skirmish`: one battle against a scripted Commander, set up, played a round at a time and saved, headless
// (docs/system-design/skirmish-saves.md). One command, the same options whether the battle is new or loaded:
//
//   skirmish --map crossing --p1 build: --p2 script:rush            a new battle: print p1's brief
//   skirmish --map crossing --p1 build:plan.json --p2 script:rush   check p1's plan against the rules, build nothing
//   skirmish --map crossing --p1 build:. --p2 script:rush --battle --save s.json
//                                                                   build both plans, play the Battle Round, save
//   skirmish --load s.json                                          the briefs of the slots a player plans
//   skirmish --load s.json --p1 script:turtle --p2 build:           change who plans each slot
//   skirmish --load s.json --p1 build:plan.json --save s.json       keep p1's plan as the save's draft, no battle
//   skirmish -f s.json --battle                                     load, play the next round, save over it
//
// Options:
//   --map <id|file>        a new battle's map: crossing, pocket, or a map file (its rows, nexus and hold by slot)
//   --load <file>          a save file to carry on from, at its Build Phase
//   --save <file>          where to write the save (made or replaced); -f <file> (--file) loads and saves one file
//   --p1, --p2 <who>       who plans the slot: build:<plan file> (a player; "build:." reads ./build.json, "build:" alone
//                          the save's draft or nothing), or script:<name> ("script:" alone plans nothing)
//   --p1-commander, --p2-commander <id>    a new battle's Commanders (vasse, averno, dob); default vasse against dob
//   --seed <n>, --rounds <n>, --ticks <n>  a new battle's seed (1), rounds at most (8), ticks a Battle Round (360)
//   --battle               build both slots' plans and play the Battle Round
//   --json                 the briefs as data rather than text
//   --name <text>, --notes <text>          the save's name and notes
//
// Without --battle it changes nothing: a slot with a plan file has the plan checked (what it would build, and what
// the rules refuse, with the reason; exit 1 if anything is refused), a player's slot without one prints its brief.
// Saving and loading happen only at a Build Phase (the owner, 2026-11-12).

import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { DuelMap, DuelState, SidePlan } from "../duel/index.ts"
import { briefOf, checkPlan, readPlan, scriptedPlayer, playRound } from "../duel/index.ts"
import type { Controller, SaveFile, SaveMap, SaveSetup, Slot } from "../skirmish/save.ts"
import {
  controllerKind,
  controllerProblem,
  duelOf,
  IDLE_SCRIPT,
  newSetup,
  readSave,
  saveOf,
  saveText,
  scriptOf,
  SIDE_OF,
  SLOTS,
} from "../skirmish/save.ts"
import { playStrategies, roundLines } from "./duel.ts"

type Options = Readonly<{ values: Readonly<Record<string, string>>; flags: ReadonlySet<string> }>

/** The options that take no value. */
const FLAGS = new Set(["battle", "json", "help"])
/** The options that take one. */
const VALUES = new Set(["map", "load", "save", "file", "p1", "p2", "p1-commander", "p2-commander", "seed", "rounds", "ticks", "name", "notes"])

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
    if (value === undefined || (inline === undefined && value.startsWith("-") && value !== "-")) throw new Error(`--${name} needs a value`)
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
type SlotAsk = Readonly<{ controller: Controller; planFile?: string }>

/** `build:<file>`, `build:`, `script:<name>`, `script:`, or a controller as a save writes it. */
export function slotAsk(text: string): SlotAsk {
  if (text === "build" || text.startsWith("build:")) return { controller: "player", planFile: text.slice("build:".length) }
  if (text === "script" || text === "script:") return { controller: `script:${IDLE_SCRIPT}` }
  const problem = controllerProblem(text)
  if (problem !== null) throw new Error(`${problem}: a slot is build:<plan file> or script:<name>`)
  return { controller: text }
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

/** The save this run starts from: loaded, or a new battle from the options. */
function startingSave(options: Options): Readonly<{ save: SaveFile; loaded: string | null }> {
  const load = options.values["load"] ?? options.values["file"]
  if (load !== undefined) {
    if (options.values["map"] !== undefined) throw new Error("--map starts a new battle; a loaded save keeps its map")
    for (const name of ["seed", "rounds", "ticks"]) if (options.values[name] !== undefined) throw new Error(`--${name} sets up a new battle; a loaded save keeps its own`)
    const { save, problems } = readSave(readFileSync(load, "utf8"))
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
    ...optional("seed", whole(options, "seed")),
    ...optional("rounds", whole(options, "rounds")),
    ...optional("roundTicks", whole(options, "ticks")),
    slots: {
      p1: { ...optional("commander", options.values["p1-commander"]) },
      p2: { ...optional("commander", options.values["p2-commander"]) },
    },
  })
  const { save, problems } = readSave(JSON.stringify({ format: "terminal-nexus.save/1", setup }))
  if (save === null) throw new Error(`that battle cannot be set up:\n  ${problems.join("\n  ")}`)
  return { save, loaded: null }
}

const optional = <K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> => (value === undefined ? {} : ({ [key]: value } as Record<K, V>))

/** A slot's label for a person: `p1 (west, vasse, player)`. */
const slotLabel = (setup: SaveSetup, slot: Slot): string => `${slot} (${slot === "p1" ? "west" : "east"}, ${setup.slots[slot].commander}, ${setup.slots[slot].controller})`

/** A round's report with the duel's sides named by slot. */
const slotLines = (lines: readonly string[]): string[] => lines.map((line) => line.replace(/^ {2}A /, "  p1 ").replace(/^ {2}B /, "  p2 "))

/** How the battle stands, in a line. */
function standing(setup: SaveSetup, state: DuelState): string {
  if (state.result === null) return `round ${state.round} of ${setup.rounds}, at its Build Phase`
  const winner = state.result.winner === null ? null : (Object.entries(SIDE_OF).find(([, side]) => side === state.result?.winner)?.[0] as Slot)
  return winner === null ? `over: a draw after round ${state.result.round}` : `over: ${slotLabel(setup, winner)} won by ${state.result.by} in round ${state.result.round}`
}

/** Runs the command; returns the exit code. */
export function main(args: readonly string[], write: (line: string) => void = (line) => process.stdout.write(`${line}\n`)): number {
  const options = parseSkirmish(args)
  if (options.flags.has("help") || args.length === 0) {
    write(usage())
    return args.length === 0 ? 1 : 0
  }
  const { save, loaded } = startingSave(options)

  // Who plans each slot this time, and the plans the players hand in.
  const slots: Record<Slot, SaveSetup["slots"][Slot]> = { ...save.setup.slots }
  const plans: Partial<Record<Slot, SidePlan>> = {}
  const fromFile = new Set<Slot>()
  for (const slot of SLOTS) {
    const asked = options.values[slot]
    const ask = asked === undefined ? null : slotAsk(asked)
    if (ask !== null) slots[slot] = { ...slots[slot], controller: ask.controller }
    if (controllerKind(slots[slot].controller) !== "player") continue
    if (ask?.planFile !== undefined && ask.planFile !== "") {
      const path = planPath(ask.planFile)
      const { plan, problems } = readPlan(readFileSync(path, "utf8"))
      for (const problem of problems) write(`${slot}'s plan (${path}): ${problem}`)
      plans[slot] = plan
      fromFile.add(slot)
    } else {
      const draft = save.draft?.[slot]
      if (draft !== undefined) plans[slot] = readPlan(draft).plan
    }
  }
  const setup: SaveSetup = { ...save.setup, slots }
  const state = duelOf(save)
  const players = SLOTS.filter((slot) => controllerKind(slots[slot].controller) === "player")
  write(`${setup.slots.p1.commander} (p1) against ${setup.slots.p2.commander} (p2) on ${mapName(setup)}, seed ${setup.seed}: ${standing(setup, state)}`)

  let next = state
  let draft: Partial<Record<Slot, SidePlan>> = { ...plans }
  let code = 0
  if (options.flags.has("battle")) {
    if (state.result !== null) throw new Error("the battle is over: there is no next round to play")
    const plan = (slot: Slot): SidePlan => {
      const controller = slots[slot].controller
      if (controllerKind(controller) === "player") return plans[slot] ?? { build: [], stance: "attack" }
      const script = scriptOf(controller)
      if (script === IDLE_SCRIPT) return { build: [], stance: "hold" }
      return (scriptedPlayer(script) as NonNullable<ReturnType<typeof scriptedPlayer>>)(briefOf(state, SIDE_OF[slot]).data)
    }
    for (const slot of players) if (plans[slot] === undefined) write(`${slot} has no plan: it builds nothing and attacks`)
    const played = playRound(state, { A: plan("p1"), B: plan("p2") })
    next = played.state
    draft = {}
    for (const line of slotLines(roundLines(played.report))) write(line)
    write(standing(setup, next))
  } else if (state.result !== null) {
    // Over: nothing to plan.
  } else if (players.length === 0) {
    write(`no player plans a slot (${SLOTS.map((slot) => `${slot} ${slots[slot].controller}`).join(", ")}): add --battle to play the round`)
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
  } else if (options.flags.has("battle")) {
    write(`not saved: add --save <file>${loaded === null ? "" : ` (or -f ${loaded})`} to keep this round`)
  }
  return code
}

/** The map's name for a person. */
const mapName = (setup: SaveSetup): string => (typeof setup.map === "string" ? setup.map : (setup.map as SaveMap | DuelMap).name)

/** The comment this file opens with: what `skirmish --help` prints. */
function usage(): string {
  const lines = readFileSync(new URL(import.meta.url), "utf8").split("\n")
  const end = lines.findIndex((line) => !line.startsWith("//"))
  return lines.slice(0, end).map((line) => line.slice(3)).join("\n")
}
