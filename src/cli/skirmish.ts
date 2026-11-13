// skirmish: one battle between two Commander Armies, headless: set up or loaded from a save file, played to the round
// asked for, and stopped at a Build Phase, as the game's screen plays it. Each slot is played by a script, or by a
// player through a build file: you, an agent, or anything that writes JSON. There are no turns: both slots make their
// build actions for a round from the same brief, blind, and the round plays them together. What it does follows from
// what it is given: nothing to play prints each player's brief, or checks its build actions; --play-to plays rounds and
// stops at a Build Phase; --seeds and --commanders play many battles and tally them.
//
//   skirmish --map crossing --p1 build: --p2 script:agro            a new battle: p1's brief
//   skirmish --map crossing --p1 build:b.json --p2 script:agro      p1's build actions checked by the rules, nothing built
//   skirmish --map crossing --p1 build:b.json --p2 script:agro --play-to next --save s.json
//                                                                   round 1 played, stopped at round 2's Build Phase, saved
//   skirmish -f s.json                                              the brief of every slot a player plays
//   skirmish -f s.json --p1 build:b.json --play-to next             load, play the next round, save over the file
//   skirmish -f s.json --p1 build:b.json                            hand in p1's build actions alone (the save's draft);
//   skirmish -f s.json --p2 build:c.json --play-to next               p2's later, and the round plays both
//   skirmish -f s.json --p1 script:defensive --p2 build:            change who plays each slot
//   skirmish --map pocket --p1 build:rounds.json --p2 script:agro --play-to 5     p1's build file plays rounds 1 to 4
//   skirmish --map crossing --p1 script:agro --p2 script:defensive --play-to end --log battle.log
//   skirmish --map crossing --p1 script:agro --p2 script:steady --play-to end --seeds 1-20
//   skirmish --map crossing --p1 script:steady --p2 script:steady --commanders all --seeds 1-6 --play-to end
//
// A build file is a slot's build actions as JSON: the power it keeps, what it builds and where, the actions taken on
// its buildings, the formation and the stance (docs/system-design/battles.md, the brief and the build actions). One object
// is for the first round played; a list of them is by round, each with "round": 3, "2-4" or "*", the first that
// fits winning:
//   [{ "round": 1, "build": [{ "building": "barracks", "at": "forward" }], "stance": "hold" },
//    { "round": "*", "build": ["barracks", "depot"], "stance": "attack" }]
// Rounds a build file covers play blind, without a brief between them. When a player slot has no build actions for
// the round about to play, the battle stops at that round's Build Phase and prints the slot's brief.
//
// The battle:
//   --map <id|file>          a new battle's map: crossing, pocket, or a map file (its rows, nexus and hold by slot)
//   --p1-commander, --p2-commander <id>    a new battle's Commanders: vasse, averno, dob (vasse against dob)
//   --seed <n>, --ticks <n>  a new battle's seed (1; up to 999999) and how many ticks a Battle Round lasts (360)
//   --load <file>            a save to carry on from, at its Build Phase; it keeps its map, Commanders and seed
//   --save <file>            where to write the save, made or replaced; -f <file> (--file) loads and saves one file
//   --rounds <n>             rounds the battle lasts at most (8); on a loaded battle, from now on
//   --modifiers <a,b>        rules over the battle from the next round: fast-rounds, double-income ("none" clears)
//   --name <text>, --notes <text>          the save's name and notes
//
// The slots:
//   --p1, --p2 <who>         build:<build file>: a player, and its build actions ("build:." reads ./build.json;
//                            "build:" alone, the save's draft or nothing). script:<profile>: a profile in
//                            players/scripts/ (agro, defensive, steady, agro-rich) or a script by its own name
//                            (balanced, rush, turtle and their variants); "script:" alone builds nothing.
//                            A loaded battle keeps each slot's controller unless named.
//   --p1-credits, --p2-credits <share>     a slot's share of the curve's income (1; a profile may carry one)
//
// Playing:
//   --play-to <next|n|end>   play rounds and stop at a Build Phase: the next round's, round n's, or none (the battle's
//                            end, its limit raised to 100 rounds unless --rounds). It stops sooner when a player slot
//                            has no build actions for the round about to play
//   --seeds <1-20|1,4,9>     a new battle once a seed, with --play-to: a line each, then a tally of who won
//   --commanders <a,b|all>   every pairing of these Commanders, each from both sides, once a seed: who won by Commander
//
// What it writes:
//   --show <0,120,end>       each Battle Round played as an ASCII screenshot at these ticks (end: as it ends), after its
//                            report: the Grid as the screen draws it, with a legend and what stands under what
//   --show-effects           the ASCII screenshots with the effects on (shots, bursts); without, only what stands
//   --json                   the briefs as data rather than text
//   --out <dir>              every round played: its save (round-<n>.save.json) and its report (round-<n>.txt)
//   --log <file>             every round's Battle Round as grid logs it, at --log-level (info: error, warn, info,
//                            debug, trace)
//
// Exit codes: 0 done; 1 the command could not run (it says why); 2 the rules refused part of the build actions it
// checked. Saving and loading happen only at a Build Phase, and a save it writes opens on the game's screen
// (terminal-nexus --load <file>). A sandbox (sandboxes/) plays its one Battle Round with --play-to and
// prints grid's report.
//
// The words for the battle and the slots are the game's too, read by one reader (src/skirmish/ask.ts): terminal-nexus
// --map pocket --p2 script:agro opens on screen the battle skirmish --map pocket --p2 script:agro plays, and so does the
// route skirmish?map=pocket&p2=script:agro.
//
// This comment is what `skirmish --help` prints. The rest of this file reads the options into a request; the work is
// in its modules: ./skirmish-battle.ts (one battle), ./skirmish-seeds.ts (many), ./skirmish-sandbox.ts (a
// sandbox), on the steps the game's screen shares (src/skirmish/request.ts, play.ts).

import { readFileSync } from "node:fs"
import type { LogLevel } from "../report/index.ts"
import { parseLevel } from "../report/index.ts"
import { readProfiles } from "../skirmish/profile-files.ts"
import { ASK_WORDS, newBattleOf, readAsk, rulesOf, slotChangesOf } from "../skirmish/ask.ts"
import type { NewBattle, SlotChange } from "../skirmish/request.ts"
import type { Profiles, Slot } from "../skirmish/save.ts"
import { playBattle } from "./skirmish-battle.ts"
import { commandersOf, playPairings, playSeeds } from "./skirmish-seeds.ts"

/** What the command exits with. */
export const EXIT = { done: 0, failed: 1, refused: 2 } as const

/** The options that take no value, and those that take one: the words that ask for a Skirmish, which the game's route
 *  takes too (`src/skirmish/ask.ts`), and the command's own. */
const FLAGS = new Set(["json", "help", "show-effects"])
const VALUES = new Set([...Object.keys(ASK_WORDS), "save", "file", "seeds", "commanders", "play-to", "out", "log", "log-level", "name", "notes", "show"])

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
  /** Where to stop: the next round's Build Phase, round n's, or the battle's end; nothing to play when absent. */
  playTo?: "next" | "end" | number
  seeds?: readonly number[]
  commanders?: readonly string[]
  out?: string
  log?: string
  logLevel?: LogLevel
  /** The ticks of every Battle Round played to draw the battle at (`end`: as the round ends): `--show 0,120,end`. */
  show?: readonly (number | "end")[]
  /** `--show-effects`: the ASCII screenshots with the effects on screen at that instant (shots, bursts, fire's light). */
  showEffects: boolean
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

const given = <K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> => (value === undefined ? {} : ({ [key]: value } as Record<K, V>))

/** The options read into a request: the words a Skirmish is asked for by (`readAsk`, as the route reads them), then the
 *  command's own; every combination that cannot work refused saying why. */
export function requestOf(options: Options, profiles: Profiles): SkirmishRequest {
  const { values, flags } = options
  const refuse = (names: readonly string[], why: string): void => {
    for (const name of names) if (values[name] !== undefined || flags.has(name)) throw new Error(`--${name}: ${why}`)
  }

  const load = values["load"] ?? values["file"]
  const save = values["save"] ?? values["file"]
  const { ask, problems } = readAsk((word) => (word === "load" ? load : values[word]))
  if (problems.length > 0) throw new Error(problems.map((problem) => `--${problem.word} ${problem.says}`).join("\n"))

  const playTo = values["play-to"]
  if (playTo !== undefined && playTo !== "next" && playTo !== "end" && !(Number.isInteger(Number(playTo)) && Number(playTo) >= 1)) throw new Error(`--play-to is next, a round (4) or end, not "${playTo}"`)

  const many = values["seeds"] !== undefined || values["commanders"] !== undefined
  if (many) {
    refuse(["load", "file"], "many battles are new ones: use --map")
    refuse(["save"], "many battles are kept with --out <dir>")
    if (playTo === undefined) throw new Error(`--${values["seeds"] !== undefined ? "seeds" : "commanders"} needs --play-to next, a round or end: how far each battle plays`)
  }
  if (values["commanders"] !== undefined) refuse(["p1-commander", "p2-commander"], "--commanders names every Commander played")

  if (load === undefined && ask.map === undefined) throw new Error("a battle needs --map <id|file> to start a new one, or --load <file> (skirmish --help)")

  const level = values["log-level"]
  const show = values["show"]?.split(",").map((part) => {
    const tick = part.trim()
    if (tick === "end") return "end" as const
    if (/^\d+$/u.test(tick)) return Number(tick)
    throw new Error(`--show is ticks and end, with commas (0,120,end), not "${values["show"]}"`)
  })
  if (show !== undefined && playTo === undefined) throw new Error("--show draws the Battle Rounds played: it needs --play-to")
  if (flags.has("show-effects") && show === undefined) throw new Error("--show-effects dresses the ASCII screenshots --show takes: name the ticks with --show")
  return {
    ...given("load", load),
    ...given("save", save),
    battle: newBattleOf(ask, (path) => readFileSync(path, "utf8")),
    slots: slotChangesOf(ask, profiles, (word) => `--${word}`),
    rules: rulesOf(ask),
    ...given<"playTo", "next" | "end" | number>("playTo", playTo === undefined ? undefined : playTo === "next" || playTo === "end" ? playTo : Number(playTo)),
    ...given("seeds", values["seeds"] === undefined ? undefined : seedsOf(values["seeds"])),
    ...given("commanders", values["commanders"] === undefined ? undefined : commandersOf(values["commanders"])),
    ...given("out", values["out"]),
    ...given("log", values["log"]),
    ...given("logLevel", level === undefined ? undefined : parseLevel(level)),
    ...given("show", show),
    json: flags.has("json"),
    showEffects: flags.has("show-effects"),
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
