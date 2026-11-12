// Opening a Skirmish on the screen, and writing one from it: the files and the clock a Skirmish's route and Save game
// need, kept apart from the pure play (`./skirmish-play.ts`) and the pure route (`./route.ts`). The game
// (`terminal-nexus --load`, `--at skirmish...`), the title menu's Skirmish row and the scripted playtest all open one
// here, so a slot named on any command line (`--p1`, `--p2`) means the same everywhere — the `skirmish` command's words
// (`src/skirmish/slots.ts`).
//
// **The seam for the setup screen** (the Skirmish milestone's next screen): the title menu's Skirmish opens
// `openSkirmish({})`, the defaults on a seed from the clock. The setup screen will hand a setup of its own instead —
// `skirmishLevel(save)` with the map, the slots and the seed it chose — and Load game a file, as `--load` does here.

import { readPlan } from "../duel/index.ts"
import type { Profiles, SaveFile, Slot } from "../skirmish/save.ts"
import { SHIPPED_PROFILES } from "../skirmish/shipped-players.ts"
import { newSetup, readSave, SLOTS } from "../skirmish/save.ts"
import type { SlotAsk } from "../skirmish/slots.ts"
import { screenProblem, slotAsk, withControllers } from "../skirmish/slots.ts"
import { clockSeed } from "../skirmish/words.ts"
import type { LevelDestination, SkirmishDestination } from "./route.ts"
import { skirmishLevel } from "./skirmish-play.ts"

/** What opening a Skirmish may read: the clock a new seed comes from, the slots a command line names, and the files. */
export type OpenSkirmishOptions = Readonly<{
  /** Milliseconds, for a new battle's seed (`clockSeed`): `Date.now` unless a test injects one. */
  now?: () => number
  /** `--p1`, `--p2` as written: `build:<plan file>`, `build:`, `script:<name>`. */
  slots?: Readonly<Partial<Record<Slot, string>>>
  /** A file's text, for a save or a plan file (`readGameFile`, `./skirmish-files.ts`, in a terminal). Absent: a host
   *  with no files (the browser page), where a save or a plan file is refused. */
  readFile?: (path: string) => string
  /** The script profiles a slot may name: `players/scripts/` in a terminal (`readProfiles`), the shipped ones unless
   *  given. */
  profiles?: Profiles
}>

/**
 * **A Skirmish route, opened**: a save file read and checked (refused whole, every problem named), or a new battle on
 * the defaults and the seed given or one from the clock; the slots a command line names put in place (a plan file for
 * p1 becomes its draft, laid on the Build Phase as it opens); and refused, saying why, when the screen cannot play it
 * (`screenProblem`). Throws an `Error` whose message says every problem.
 */
export function openSkirmish(ask: Omit<SkirmishDestination, "kind">, options: OpenSkirmishOptions = {}): LevelDestination {
  const now = options.now ?? Date.now
  const profiles = options.profiles ?? SHIPPED_PROFILES
  const read =
    options.readFile ??
    ((path: string): string => {
      throw new Error(`this screen has no files to read ${path} from`)
    })
  let save: SaveFile
  if (ask.load !== undefined) {
    let text: string
    try {
      text = read(ask.load)
    } catch (error) {
      throw new Error(`cannot read the save ${ask.load}: ${error instanceof Error ? error.message : String(error)}`)
    }
    const { save: loaded, problems } = readSave(text, profiles)
    if (loaded === null) throw new Error(`${ask.load} is not a save the game can load:\n  ${problems.join("\n  ")}`)
    save = loaded
  } else {
    save = { format: "terminal-nexus.save/1", setup: newSetup({ seed: ask.seed ?? clockSeed(now()) }) }
  }
  const asks: Partial<Record<Slot, SlotAsk>> = {}
  const problems: string[] = []
  for (const slot of SLOTS) {
    const written = options.slots?.[slot]
    if (written === undefined) continue
    try {
      asks[slot] = slotAsk(written, profiles)
    } catch (error) {
      problems.push(`--${slot} ${written}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  if (problems.length > 0) throw new Error(problems.join("\n"))
  const setup = withControllers(save.setup, asks)
  const refused = screenProblem(setup)
  if (refused !== null) throw new Error(`the game cannot open this Skirmish: ${refused}`)
  // A plan file given for p1 is the plan so far: laid on the Build Phase as it opens, as a save's draft is.
  let draft = save.draft
  const planFile = asks.p1?.planFile
  if (planFile !== undefined && planFile !== "") {
    const { plan, problems: planProblems } = readPlan(read(planFile))
    if (planProblems.length > 0) throw new Error(`p1's plan (${planFile}):\n  ${planProblems.join("\n  ")}`)
    draft = { ...draft, p1: plan }
  }
  if (save.start !== undefined) throw new Error(`${ask.load ?? "this save"} is a testing save: it plays one Battle Round in grid (grid <file>), not on the game's screen`)
  const opened: SaveFile = { ...save, setup, ...(draft === undefined ? {} : { draft }) }
  // A file named without a folder is the working folder's: said so, so Save game writes it back there, not into the saves folder.
  const file = ask.load === undefined ? undefined : ask.load.includes("/") ? ask.load : `./${ask.load}`
  const level = skirmishLevel(opened, file === undefined ? {} : { file }, { newSeed: () => clockSeed(now()), profiles })
  return { kind: "level", level, round: 1 }
}
