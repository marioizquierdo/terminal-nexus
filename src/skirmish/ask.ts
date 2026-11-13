// A Skirmish asked for in words: one table and one reader for both doors that take them, the `skirmish` command's
// flags (`--map pocket --p2 script:agro`, `src/cli/skirmish.ts`) and the game's route (`skirmish?map=pocket&p2=script:agro`,
// `src/cli/route.ts`). Each door hands in its own `name → value` pairs and says a problem its own way (`--seed` or
// `seed`); what a word means, what it may be and which words cannot stand together are said once, here. Then the ask
// becomes a battle by the steps both doors share (`./request.ts`).
//
// Pure: a map file is read through the caller's `readFile`, and nothing here knows a terminal or a clock.

import type { NewBattle, SlotChange } from "./request.ts"
import type { Profiles, SaveMap, Slot } from "./save.ts"
import { SLOTS } from "./save.ts"
import { slotAsk } from "./slots.ts"
import { isSkirmishSeed, SKIRMISH_SEED_LIMIT } from "./words.ts"

/** A Skirmish as the words ask for it: a save to open or a new battle's setup, who plays each slot and the rules. */
export type SkirmishAsk = Readonly<{
  load?: string
  seed?: number
  /** A built-in map's id, or a map file (`.json`). */
  map?: string
  ticks?: number
  rounds?: number
  modifiers?: readonly string[]
  commanders?: Readonly<Partial<Record<Slot, string>>>
  /** Who plays each slot, as written: `build:`, `build:<build file>`, `script:<name>`. */
  slots?: Readonly<Partial<Record<Slot, string>>>
  credits?: Readonly<Partial<Record<Slot, number>>>
}>

/** Every word, with what it asks for: the route's help says these, and the command's manual the same. */
export const ASK_WORDS: Readonly<Record<string, string>> = {
  load: "a save file, opened at its Build Phase",
  seed: `a new battle's seed, a whole number from 0 to ${SKIRMISH_SEED_LIMIT - 1}`,
  map: "a new battle's map: crossing, pocket or a map file (.json)",
  ticks: "a new battle's ticks a Battle Round",
  rounds: "the round limit, from the next round on",
  modifiers: "the modifiers, by name with commas (none for none): fast-rounds, double-income",
  p1: "who plays p1: build: (a person), build:<build file>, or script:<profile>",
  p2: "who plays p2: build:, build:<build file>, or script:<profile>",
  "p1-commander": "p1's Commander: vasse, averno or dob",
  "p2-commander": "p2's Commander: vasse, averno or dob",
  "p1-credits": "p1's share of the credits curve, 1 the curve's own",
  "p2-credits": "p2's share of the credits curve",
}

/** The words that set up a new battle, which a loaded save keeps as it was. */
const NEW_BATTLE_WORDS = ["seed", "map", "ticks", "p1-commander", "p2-commander"] as const

/** What a word cannot be, said without the door's own way of naming it: the door writes `${word} ${says}`. */
export type AskProblem = Readonly<{ word: string; says: string }>

const given = <K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> => (value === undefined ? {} : ({ [key]: value } as Record<K, V>))

/** A list of modifiers as written: `none` or nothing for none. */
export const modifiersOf = (text: string): string[] => (text === "" || text === "none" ? [] : text.split(",").map((name) => name.trim()))

/** **The words read** (`get` gives a word's value as written, or nothing), with every problem at once. */
export function readAsk(get: (word: string) => string | undefined): Readonly<{ ask: SkirmishAsk; problems: readonly AskProblem[] }> {
  const problems: AskProblem[] = []
  const whole = (word: string, from: number, why: string): number | undefined => {
    const text = get(word)
    if (text === undefined) return undefined
    if (/^\d+$/u.test(text) && Number(text) >= from) return Number(text)
    problems.push({ word, says: `must be ${why}, not "${text}"` })
    return undefined
  }
  const load = get("load")
  if (load !== undefined) {
    for (const word of NEW_BATTLE_WORDS) if (get(word) !== undefined) problems.push({ word, says: "sets up a new battle: a loaded save keeps its own" })
  }
  const seed = whole("seed", 0, `a whole number from 0 to ${SKIRMISH_SEED_LIMIT - 1}`)
  if (seed !== undefined && !isSkirmishSeed(seed)) problems.push({ word: "seed", says: `must be a whole number from 0 to ${SKIRMISH_SEED_LIMIT - 1}, not "${seed}"` })
  const slots: Partial<Record<Slot, string>> = {}
  const commanders: Partial<Record<Slot, string>> = {}
  const credits: Partial<Record<Slot, number>> = {}
  for (const slot of SLOTS) {
    const who = get(slot)
    if (who !== undefined) slots[slot] = who
    const commander = get(`${slot}-commander`)
    if (commander !== undefined) commanders[slot] = commander
    const share = get(`${slot}-credits`)
    if (share !== undefined) {
      if (Number(share) > 0) credits[slot] = Number(share)
      else problems.push({ word: `${slot}-credits`, says: `is a share above 0 (1 is the curve's), not "${share}"` })
    }
  }
  const modifiers = get("modifiers")
  const ask: SkirmishAsk = {
    ...given("load", load),
    ...given("seed", seed !== undefined && isSkirmishSeed(seed) ? seed : undefined),
    ...given("map", get("map")),
    ...given("ticks", whole("ticks", 1, "a whole number of ticks from 1")),
    ...given("rounds", whole("rounds", 1, "a whole number of rounds from 1")),
    ...given("modifiers", modifiers === undefined ? undefined : modifiersOf(modifiers)),
    ...(Object.keys(commanders).length === 0 ? {} : { commanders }),
    ...(Object.keys(slots).length === 0 ? {} : { slots }),
    ...(Object.keys(credits).length === 0 ? {} : { credits }),
  }
  return { ask, problems }
}

/** **The words an ask is written as**, in the table's order: what a route or a command line says to ask for it again. */
export function askWords(ask: SkirmishAsk): Array<readonly [string, string]> {
  const words: Array<readonly [string, string]> = []
  const add = (word: string, value: string | number | undefined): void => {
    if (value !== undefined) words.push([word, String(value)])
  }
  add("load", ask.load)
  add("seed", ask.seed)
  add("map", ask.map)
  add("ticks", ask.ticks)
  add("rounds", ask.rounds)
  for (const slot of SLOTS) add(slot, ask.slots?.[slot])
  for (const slot of SLOTS) add(`${slot}-commander`, ask.commanders?.[slot])
  for (const slot of SLOTS) add(`${slot}-credits`, ask.credits?.[slot])
  if (ask.modifiers !== undefined) add("modifiers", ask.modifiers.length === 0 ? "none" : ask.modifiers.join(","))
  return words
}

/** A map file's text as a map: its rows, and its Nexus and hold for each slot; named after the file unless it says. */
function mapFile(text: string, path: string): SaveMap {
  const value = JSON.parse(text) as Partial<SaveMap>
  return { id: value.id ?? path.replace(/^.*\//u, "").replace(/\.json$/u, ""), name: value.name ?? value.id ?? path, ...value } as SaveMap
}

/** **The new battle an ask sets up**: its map (a map file read through `readFile`), seed, ticks and Commanders. */
export function newBattleOf(ask: SkirmishAsk, readFile: (path: string) => string): NewBattle {
  const map: string | SaveMap | undefined = ask.map === undefined ? undefined : ask.map.endsWith(".json") ? mapFile(readFile(ask.map), ask.map) : ask.map
  return {
    ...given("map", map),
    ...given("seed", ask.seed),
    ...given("roundTicks", ask.ticks),
    ...(ask.commanders === undefined ? {} : { commanders: ask.commanders }),
  }
}

/** **What changes about each slot** as the battle opens: who plays it (checked against the profiles) and its credits
 *  share. Throws, naming every slot written wrong, the way the door writes its words (`--p1` or `p1`). */
export function slotChangesOf(ask: SkirmishAsk, profiles: Profiles, named: (word: string) => string = (word) => word): Partial<Record<Slot, SlotChange>> {
  const changes: Partial<Record<Slot, SlotChange>> = {}
  const problems: string[] = []
  for (const slot of SLOTS) {
    const who = ask.slots?.[slot]
    const credits = ask.credits?.[slot]
    let change: SlotChange = {}
    if (who !== undefined) {
      try {
        change = { ask: slotAsk(who, profiles) }
      } catch (error) {
        problems.push(`${named(slot)} ${who}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    if (credits !== undefined) change = { ...change, credits }
    if (Object.keys(change).length > 0) changes[slot] = change
  }
  if (problems.length > 0) throw new Error(problems.join("\n"))
  return changes
}

/** The rules an ask changes from the next round on: the round limit and the modifiers. */
export const rulesOf = (ask: SkirmishAsk): Readonly<{ rounds?: number; modifiers?: readonly string[] }> => ({
  ...given("rounds", ask.rounds),
  ...given("modifiers", ask.modifiers),
})
