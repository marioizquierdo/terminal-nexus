// A Skirmish asked for: a new battle from a few choices, or a save read back, then each slot seated with who plans it,
// its credits share and, for a player, its plan file. One set of steps for the `skirmish` command
// (`src/cli/skirmish.ts`) and the game's screens (`src/cli/skirmish-open.ts`), so `--p1 script:agro` or a plan file
// means the same on both, and a battle asked for one way opens as it would the other. Pure: the caller hands in a
// file's text (`readFile`), and each problem is thrown as an `Error` that says every problem at once.

import type { SidePlan } from "../duel/index.ts"
import { readPlan } from "../duel/index.ts"
import type { Profiles, SaveFile, SaveMap, SaveSetup, Slot } from "./save.ts"
import { MODIFIERS, newSetup, readSave, SAVE_FORMAT, SLOTS } from "./save.ts"
import type { SlotAsk } from "./slots.ts"
import { isPlayer } from "./play.ts"

/** What a new battle may choose; everything else is the setup's default (`newSetup`). */
export type NewBattle = Readonly<{
  map?: string | SaveMap
  seed?: number
  roundTicks?: number
  commanders?: Readonly<Partial<Record<Slot, string>>>
  modifiers?: readonly string[]
}>

/** A new battle as a save with only its setup, checked as a loaded save is. */
export function newBattle(asked: NewBattle, profiles: Profiles): SaveFile {
  const setup = newSetup({
    ...(asked.map === undefined ? {} : { map: asked.map }),
    ...(asked.seed === undefined ? {} : { seed: asked.seed }),
    ...(asked.roundTicks === undefined ? {} : { roundTicks: asked.roundTicks }),
    ...(asked.modifiers === undefined ? {} : { modifiers: asked.modifiers }),
    slots: {
      p1: asked.commanders?.p1 === undefined ? {} : { commander: asked.commanders.p1 },
      p2: asked.commanders?.p2 === undefined ? {} : { commander: asked.commanders.p2 },
    },
  })
  const { save, problems } = readSave(JSON.stringify({ format: SAVE_FORMAT, setup }), profiles)
  if (save === null) throw new Error(`that Skirmish cannot be set up:\n  ${problems.join("\n  ")}`)
  return save
}

/** A save's text read back; refused whole, every problem named, as the file `path`. */
export function loadedBattle(text: string, path: string, profiles: Profiles): SaveFile {
  const { save, problems } = readSave(text, profiles)
  if (save === null) throw new Error(`${path} is not a save the game can load:\n  ${problems.join("\n  ")}`)
  return save
}

/** What may change about a slot as a battle opens: who plans it (a plan file with a player) and its credits share. */
export type SlotChange = Readonly<{ ask?: SlotAsk; credits?: number }>

/** A setup with its slots seated, and the plans each player's slot brings: from its plan file, else the save's draft. */
export type Seated = Readonly<{
  setup: SaveSetup
  plans: Readonly<Partial<Record<Slot, SidePlan>>>
  /** The slots whose plan came from a plan file this time, rather than the draft. */
  fromFile: ReadonlySet<Slot>
  /** What a plan file said that its reader had to drop or guess (`readPlan`), each with its slot and file. */
  problems: readonly string[]
}>

/**
 * **The slots seated**: each slot's controller and credits share as changed, and each player's plan, read from its plan
 * file through `readFile` when one is named, otherwise the save's draft. A slot that changes nothing keeps what the
 * save had. A plan file that cannot be read throws.
 */
export function seat(save: SaveFile, changes: Readonly<Partial<Record<Slot, SlotChange>>>, readFile: (path: string) => string): Seated {
  const slots: Record<Slot, SaveSetup["slots"][Slot]> = { ...save.setup.slots }
  for (const slot of SLOTS) {
    const change = changes[slot]
    if (change?.credits !== undefined && !(change.credits > 0)) throw new Error(`${slot}'s credits share must be above 0 (1 is the curve's), not ${change.credits}`)
    if (change?.ask !== undefined) slots[slot] = { ...slots[slot], controller: change.ask.controller }
    if (change?.credits !== undefined) slots[slot] = { ...slots[slot], options: { ...slots[slot].options, credits: change.credits } }
  }
  const setup: SaveSetup = { ...save.setup, slots }
  const plans: Partial<Record<Slot, SidePlan>> = {}
  const fromFile = new Set<Slot>()
  const problems: string[] = []
  for (const slot of SLOTS) {
    if (!isPlayer(setup, slot)) continue
    const file = changes[slot]?.ask?.planFile
    if (file !== undefined && file !== "") {
      let text: string
      try {
        text = readFile(file)
      } catch (error) {
        throw new Error(`${slot}: no plan file ${file} (${error instanceof Error ? error.message : String(error)})`)
      }
      const read = readPlan(text)
      plans[slot] = read.plan
      fromFile.add(slot)
      problems.push(...read.problems.map((problem) => `${slot}'s plan (${file}): ${problem}`))
    } else if (save.draft?.[slot] !== undefined) {
      plans[slot] = save.draft[slot] as SidePlan
    }
  }
  return { setup, plans, fromFile, problems }
}

/** The battle's rules changed from the next round on: its round limit (never below the round it is at) and its modifiers. */
export function withRules(setup: SaveSetup, round: number, rules: Readonly<{ rounds?: number; modifiers?: readonly string[] }>): SaveSetup {
  for (const modifier of rules.modifiers ?? []) if (!(MODIFIERS as readonly string[]).includes(modifier)) throw new Error(`no modifier "${modifier}" (${MODIFIERS.join(", ")})`)
  if (rules.rounds !== undefined && rules.rounds < 1) throw new Error("a battle lasts 1 round or more")
  if (rules.rounds !== undefined && rules.rounds < round) throw new Error(`a limit of ${rules.rounds} rounds: the battle is already at round ${round}`)
  return {
    ...setup,
    ...(rules.rounds === undefined ? {} : { rounds: rules.rounds }),
    ...(rules.modifiers === undefined ? {} : { modifiers: rules.modifiers }),
  }
}
