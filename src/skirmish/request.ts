// A Skirmish asked for: a new battle from a few choices, or a save read back, then each slot seated with who plays it,
// its credits share and, for a player, its build file. One set of steps for the `skirmish` command
// (`src/cli/skirmish.ts`) and the game's screens (`src/cli/skirmish-open.ts`), so `--p1 script:agro` or a build file
// means the same on both, and a battle asked for one way opens as it would the other. Pure: the caller hands in a
// file's text (`readFile`), and each problem is thrown as an `Error` that says every problem at once.

import type { BattleState, BuildActions, BuildEntry } from "../battle/index.ts"
import { readBuildFile } from "../battle/index.ts"
import type { Profiles, SaveFile, SaveMap, SaveSetup, Slot } from "./save.ts"
import { battleOf, MODIFIERS, newSetup, readSave, SAVE_FORMAT, SLOTS } from "./save.ts"
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

/** What may change about a slot as a battle opens: who plans it (a build file with a player) and its credits share. */
export type SlotChange = Readonly<{ ask?: SlotAsk; credits?: number }>

/** A setup with its slots seated, and the build actions each player's slot brings, by round: from its build file, else
 *  the save's draft for the round it is at. */
export type Seated = Readonly<{
  setup: SaveSetup
  /** Each player slot's build file (`actionsFor` picks a round's); a draft is one entry, for the first round played. */
  builds: Readonly<Partial<Record<Slot, readonly BuildEntry[]>>>
  /** The slots whose build actions came from a build file this time, rather than the draft. */
  fromFile: ReadonlySet<Slot>
  /** What a build file said that its reader had to drop or guess, each with its slot and file. */
  problems: readonly string[]
}>

/**
 * **The slots seated**: each slot's controller and credits share as changed, and each player's build actions, read from
 * its build file through `readFile` when one is named, otherwise the save's draft. A slot that changes nothing keeps
 * what the save had. A build file that cannot be read throws.
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
  const builds: Partial<Record<Slot, readonly BuildEntry[]>> = {}
  const fromFile = new Set<Slot>()
  const problems: string[] = []
  for (const slot of SLOTS) {
    if (!isPlayer(setup, slot)) continue
    const file = changes[slot]?.ask?.buildFile
    if (file !== undefined && file !== "") {
      let text: string
      try {
        text = readFile(file)
      } catch (error) {
        throw new Error(`${slot}: no build file ${file} (${error instanceof Error ? error.message : String(error)})`)
      }
      const read = readBuildFile(text)
      builds[slot] = read.entries
      fromFile.add(slot)
      problems.push(...read.problems.map((problem) => `${slot}'s build file (${file}): ${problem}`))
    } else if (save.draft?.[slot] !== undefined) {
      builds[slot] = [{ actions: save.draft[slot] as BuildActions }]
    }
  }
  return { setup, builds, fromFile, problems }
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

/** What opening a save may change: who plays each slot, the rules from now on, where build files are read from. */
export type OpenSave = Readonly<{
  slots?: Readonly<Partial<Record<Slot, SlotChange>>>
  rules?: Readonly<{ rounds?: number; modifiers?: readonly string[] }>
  /** A build file's text. Absent: a build file named is refused ("no files to read <path> from"). */
  readFile?: (path: string) => string
  profiles: Profiles
}>

/** A save opened: the save as read, its setup with the slots seated and the rules changed, the battle as it stands
 *  under that setup, and the seating (each player slot's build file or draft, and what its reader dropped). */
export type Opened = Readonly<{ save: SaveFile; setup: SaveSetup; state: BattleState; seated: Seated }>

/**
 * **A save opened** as a door asks: its slots seated (`seat`), its rules changed from the round the battle is at
 * (`withRules`; round 1 when the battle is over, since a battle over has no next round to limit), and the battle read
 * back under the new setup (`battleOf`). Throws for a sandbox (a save with a `start`), which no Build Phase opens.
 * Problems a build file's reader dropped come back in `seated.problems`; the caller writes them or refuses them.
 */
export function openSave(save: SaveFile, options: OpenSave): Opened {
  if (save.start !== undefined) throw new Error("this save is a sandbox: it plays one Battle Round in grid (grid <file>), not from a Build Phase")
  const readFile = options.readFile ?? ((path: string): string => { throw new Error(`no files to read ${path} from`) })
  const seated = seat(save, options.slots ?? {}, readFile)
  const before = battleOf({ ...save, setup: seated.setup }, options.profiles)
  const setup = withRules(seated.setup, before.result === null ? before.round : 1, options.rules ?? {})
  return { save, setup, state: battleOf({ ...save, setup }, options.profiles), seated }
}
