// skirmish: one battle between two Commander Armies, headless: set up or loaded from a save file, planned and played a
// round at a time, and saved at its next Build Phase, as the game's screen plays it. Each slot is planned by a script,
// or by a player through a plan file: you, an agent, or one of two sessions taking turns. What it does follows from
// what it is given: nothing to play prints the briefs and checks the plans; --battle plays a round; --seeds and
// --commanders play many battles and tally them.
//
//   skirmish --map crossing --p1 build: --p2 script:agro            a new battle: p1's brief
//   skirmish --map crossing --p1 build:plan.json --p2 script:agro   p1's plan checked by the rules, nothing built
//   skirmish --map crossing --p1 build:plan.json --p2 script:agro --battle --save s.json
//                                                                   both sides build, the Battle Round is played, saved
//   skirmish -f s.json                                              the brief of every slot a player plans
//   skirmish -f s.json --p1 build:plan.json --battle                load, play the next round, save over the file
//   skirmish -f s.json --p1 script:defensive --p2 build:            change who plans each slot
//   skirmish --map pocket --p1 build:a.json --p2 build:b.json --battle        two plans of your own against each other
//   skirmish --map crossing --p1 script:agro --p2 script:defensive --play-until-win --log battle.log
//   skirmish --map crossing --p1 script:agro --p2 script:steady --play-until-win --seeds 1-20
//   skirmish --map crossing --p1 script:steady --p2 script:steady --commanders all --seeds 1-6 --play-until-win
//   skirmish -f s.json --wait p1                                    two sessions: block until p1's turn, print its brief
//   skirmish -f s.json --p1 build:plan.json --ready                 hand in p1's plan; the last plan in plays the round
//
// The battle:
//   --map <id|file>          a new battle's map: crossing, pocket, or a map file (its rows, nexus and hold by slot)
//   --p1-commander, --p2-commander <id>    a new battle's Commanders: vasse, averno, dob (vasse against dob)
//   --seed <n>, --ticks <n>  a new battle's seed (1) and how many ticks a Battle Round lasts (360)
//   --load <file>            a save to carry on from, at its Build Phase; it keeps its map, Commanders and seed
//   --save <file>            where to write the save, made or replaced; -f <file> (--file) loads and saves one file
//   --rounds <n>             rounds the battle lasts at most (8); on a loaded battle, from now on
//   --modifiers <a,b>        rules over the battle from the next round: fast-rounds, double-income ("none" clears)
//   --name <text>, --notes <text>          the save's name and notes
//
// The slots:
//   --p1, --p2 <who>         build:<plan file>: a player, and the plan it plays ("build:." reads ./build.json;
//                            "build:" alone, the save's draft or nothing). script:<profile>: a profile in
//                            players/scripts/ (agro, defensive, steady, agro-rich) or a script by its own name
//                            (balanced, rush, turtle and their variants); "script:" alone plans nothing.
//                            A loaded battle keeps each slot's controller unless named.
//   --p1-credits, --p2-credits <share>     a slot's share of the curve's income (1; a profile may carry one)
//
// Playing:
//   --battle                 build both slots' plans and play the Battle Round
//   --battles <n>            play n rounds (a plan plays only the first, so the rest need every slot a script)
//   --play-until-win         play until a Nexus falls or the rounds run out (the limit raised to 100 unless --rounds)
//   --seeds <1-20|1,4,9>     a new battle once a seed, every slot a script, with --battles or --play-until-win: a line
//                            each, then a tally of who won
//   --commanders <a,b|all>   every pairing of these Commanders, each from both sides, once a seed: who won by Commander
//   --wait <p1|p2>           block until the slot has a plan to make, then print its brief (or the result, once over)
//   --timeout <seconds>      how long --wait blocks (900)
//   --ready                  hand in the plans given; once every player's slot has one, play the round
//
// What it writes:
//   --json                   the briefs as data rather than text
//   --out <dir>              every round played: its save (round-<n>.save.json) and its report (round-<n>.txt)
//   --log <file>             every round's Battle Round as grid logs it, at --log-level (info: error, warn, info,
//                            debug, trace)
//
// Exit codes: 0 done; 1 the command could not run (it says why); 2 the rules refused part of a plan it checked;
// 3 --wait ran out of time (run it again). Saving and loading happen only at a Build Phase. A testing save
// (skirmish-testing/) plays its one Battle Round with --battle and prints grid's report.
//
// This comment is what `skirmish --help` prints. The rest of this file reads the options into a request; the work is
// in its modules: ./skirmish-battle.ts (one battle), ./skirmish-seeds.ts (many), ./skirmish-turns.ts (two sessions),
// ./skirmish-testing.ts (a testing save), on the steps the game's screen shares (src/skirmish/request.ts, play.ts).

import { readFileSync } from "node:fs"
import type { LogLevel } from "../report/index.ts"
import { parseLevel } from "../report/index.ts"
import { readProfiles } from "../skirmish/profile-files.ts"
import type { NewBattle, SlotChange } from "../skirmish/request.ts"
import type { Profiles, SaveMap, Slot } from "../skirmish/save.ts"
import { SLOTS } from "../skirmish/save.ts"
import { slotAsk } from "../skirmish/slots.ts"
import { playBattle } from "./skirmish-battle.ts"
import { commandersOf, playPairings, playSeeds } from "./skirmish-seeds.ts"
import { handIn, waitTurn } from "./skirmish-turns.ts"

/** What the command exits with. */
export const EXIT = { done: 0, failed: 1, refused: 2, waiting: 3 } as const

/** The options that take no value, and those that take one. */
const FLAGS = new Set(["battle", "play-until-win", "ready", "json", "help"])
const VALUES = new Set([
  "map", "load", "save", "file", "p1", "p2", "p1-commander", "p2-commander", "p1-credits", "p2-credits", "seed", "seeds",
  "commanders", "rounds", "ticks", "modifiers", "battles", "wait", "timeout", "out", "log", "log-level", "name", "notes",
])

/** The options as written: each value by its name, and the flags given. */
export type Options = Readonly<{ values: Readonly<Record<string, string>>; flags: ReadonlySet<string> }>

/** Everything one run of the command asks for, read and checked from the options. */
export type SkirmishRequest = Readonly<{
  /** The save carried on from, and the one written (`-f` names both). */
  load?: string
  save?: string
  /** A new battle's choices (`--map`, `--seed`, `--ticks`, the Commanders). */
  battle: NewBattle
  slots: Readonly<Partial<Record<Slot, SlotChange>>>
  /** The battle's rules changed from the next round: `--rounds` and `--modifiers`. */
  rules: Readonly<{ rounds?: number; modifiers?: readonly string[] }>
  /** How many rounds to play: 0, n, or until the battle ends (`Infinity`). */
  rounds: number
  seeds?: readonly number[]
  commanders?: readonly string[]
  ready: boolean
  wait?: Readonly<{ slot: Slot; timeout: number }>
  out?: string
  log?: string
  logLevel?: LogLevel
  json: boolean
  name?: string
  notes?: string
}>

/** `--name value`, `--name=value`, `-f value` and the flags. An option nobody knows is refused by name. */
export function parseSkirmish(args: readonly string[]): Options {
  const values: Record<string, string> = {}
  const flags = new Set<string>()
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] as string
    if (arg === "help" || arg === "-h") {
      flags.add("help")
      continue
    }
    const long = /^--([a-z0-9-]+)(?:=(.*))?$/u.exec(arg)
    const name = arg === "-f" ? "file" : long?.[1]
    if (name === undefined) throw new Error(`unexpected "${arg}": options are --name value (skirmish --help)`)
    if (FLAGS.has(name)) {
      flags.add(name)
      continue
    }
    if (!VALUES.has(name)) throw new Error(`no option --${name} (skirmish --help)`)
    const inline = long?.[2]
    const value = inline ?? args[index + 1]
    if (value === undefined || (inline === undefined && value.startsWith("-") && value !== "-" && !/^-?\d/u.test(value))) throw new Error(`--${name} needs a value`)
    if (inline === undefined) index += 1
    values[name] = value
  }
  return { values, flags }
}

/** "1-6" or "1,4,9": the seeds. */
export function seedsOf(text: string): number[] {
  const range = /^(-?\d+)-(-?\d+)$/u.exec(text)
  const seeds = range !== null ? Array.from({ length: Math.max(0, Number(range[2]) - Number(range[1]) + 1) }, (_, index) => Number(range[1]) + index) : text.split(",").map(Number)
  if (seeds.length === 0 || seeds.some((seed) => !Number.isInteger(seed))) throw new Error(`--seeds is a range (1-20) or a list (1,4,9), not "${text}"`)
  return seeds
}

/** A map file: its rows, and its Nexus and hold for each slot. */
function mapFile(path: string): SaveMap {
  const value = JSON.parse(readFileSync(path, "utf8")) as Partial<SaveMap>
  return { id: value.id ?? path.replace(/^.*\//u, "").replace(/\.json$/u, ""), name: value.name ?? value.id ?? path, ...value } as SaveMap
}

const given = <K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> => (value === undefined ? {} : ({ [key]: value } as Record<K, V>))

/** The options read into a request, every combination that cannot work refused saying why. */
export function requestOf(options: Options, profiles: Profiles): SkirmishRequest {
  const { values, flags } = options
  const whole = (name: string): number | undefined => {
    const value = values[name]
    if (value === undefined) return undefined
    const parsed = Number(value)
    if (!Number.isInteger(parsed)) throw new Error(`--${name} must be a whole number, not "${value}"`)
    return parsed
  }
  const refuse = (names: readonly string[], why: string): void => {
    for (const name of names) if (values[name] !== undefined || flags.has(name)) throw new Error(`--${name}: ${why}`)
  }

  const load = values["load"] ?? values["file"]
  const save = values["save"] ?? values["file"]
  if (load !== undefined) {
    refuse(["map"], "it starts a new battle; a loaded save keeps its map")
    refuse(["seed", "ticks"], "it sets up a new battle; a loaded save keeps its own")
    refuse(["p1-commander", "p2-commander"], "a loaded battle keeps its Commanders")
  }

  const asked = [flags.has("battle"), values["battles"] !== undefined, flags.has("play-until-win")].filter(Boolean).length
  if (asked > 1) throw new Error("--battle, --battles and --play-until-win each say how many rounds to play: give one")
  const battles = whole("battles")
  if (battles !== undefined && battles < 1) throw new Error("--battles must be 1 or more")
  const rounds = flags.has("play-until-win") ? Number.POSITIVE_INFINITY : (battles ?? (flags.has("battle") ? 1 : 0))

  const slots: Partial<Record<Slot, SlotChange>> = {}
  for (const slot of SLOTS) {
    const who = values[slot]
    const credits = values[`${slot}-credits`]
    if (credits !== undefined && !(Number(credits) > 0)) throw new Error(`--${slot}-credits is a share above 0 (1 is the curve's), not "${credits}"`)
    if (who !== undefined || credits !== undefined) slots[slot] = { ...given("ask", who === undefined ? undefined : slotAsk(who, profiles)), ...given("credits", credits === undefined ? undefined : Number(credits)) }
  }

  const many = values["seeds"] !== undefined || values["commanders"] !== undefined
  if (many) {
    refuse(["load", "file"], "many battles are new ones: use --map")
    refuse(["save"], "many battles are kept with --out <dir>")
    refuse(["ready", "wait"], "two sessions play one battle")
    if (rounds === 0) throw new Error(`--${values["seeds"] !== undefined ? "seeds" : "commanders"} needs --battles <n> or --play-until-win: how many rounds each battle plays`)
  }
  if (values["commanders"] !== undefined) refuse(["p1-commander", "p2-commander"], "--commanders names every Commander played")

  const waitSlot = values["wait"]
  if (waitSlot !== undefined && waitSlot !== "p1" && waitSlot !== "p2") throw new Error(`--wait names the slot waiting, p1 or p2, not "${waitSlot}"`)
  if (waitSlot !== undefined) {
    if (rounds > 0) throw new Error("--wait plays nothing: the last plan handed in with --ready plays the round")
    refuse(["ready", "p1", "p2", "save"], "--wait only reads the save")
  } else refuse(["timeout"], "it says how long --wait blocks")
  if (flags.has("ready") && rounds > 0) throw new Error("--ready plays the round once every plan is in: drop --battle")
  if ((waitSlot !== undefined || flags.has("ready")) && load === undefined) throw new Error("two sessions share one save: give it with -f <file>")
  if (load === undefined && values["map"] === undefined) throw new Error("a battle needs --map <id|file> to start a new one, or --load <file> (skirmish --help)")

  const map = values["map"]
  const modifiers = values["modifiers"]
  const level = values["log-level"]
  return {
    ...given("load", load),
    ...given("save", save),
    battle: {
      ...given("map", map === undefined ? undefined : map.endsWith(".json") ? mapFile(map) : map),
      ...given("seed", whole("seed")),
      ...given("roundTicks", whole("ticks")),
      commanders: { ...given("p1", values["p1-commander"]), ...given("p2", values["p2-commander"]) },
    },
    slots,
    rules: { ...given("rounds", whole("rounds")), ...given("modifiers", modifiers === undefined ? undefined : modifiers === "none" || modifiers === "" ? [] : modifiers.split(",").map((name) => name.trim())) },
    rounds,
    ...given("seeds", values["seeds"] === undefined ? undefined : seedsOf(values["seeds"])),
    ...given("commanders", values["commanders"] === undefined ? undefined : commandersOf(values["commanders"])),
    ready: flags.has("ready"),
    ...given("wait", waitSlot === undefined ? undefined : { slot: waitSlot as Slot, timeout: whole("timeout") ?? 900 }),
    ...given("out", values["out"]),
    ...given("log", values["log"]),
    ...given("logLevel", level === undefined ? undefined : parseLevel(level)),
    json: flags.has("json"),
    ...given("name", values["name"]),
    ...given("notes", values["notes"]),
  }
}

/** Runs the command; returns its exit code. What goes wrong is written to `fail`, saying why. */
export function main(
  args: readonly string[],
  write: (line: string) => void = (line) => process.stdout.write(`${line}\n`),
  profiles: Profiles = readProfiles(),
  fail: (line: string) => void = (line) => process.stderr.write(`${line}\n`),
): number {
  try {
    const options = parseSkirmish(args)
    if (options.flags.has("help") || args.length === 0) {
      write(usage())
      return args.length === 0 ? EXIT.failed : EXIT.done
    }
    const request = requestOf(options, profiles)
    if (request.commanders !== undefined) playPairings(request, profiles, write)
    else if (request.seeds !== undefined) playSeeds(request, profiles, write)
    else if (request.wait !== undefined) return waitTurn(request, request.wait.slot, request.wait.timeout, profiles, write) ? EXIT.done : EXIT.waiting
    else if (request.ready) handIn(request, profiles, write)
    else return playBattle(request, profiles, write).refused ? EXIT.refused : EXIT.done
    return EXIT.done
  } catch (error) {
    fail(`skirmish: ${error instanceof Error ? error.message : String(error)}`)
    return EXIT.failed
  }
}

/** The comment this file opens with: what `skirmish --help` prints. */
function usage(): string {
  const lines = readFileSync(new URL(import.meta.url), "utf8").split("\n")
  const end = lines.findIndex((line) => !line.startsWith("//"))
  return lines.slice(0, end).map((line) => line.slice(3)).join("\n")
}
