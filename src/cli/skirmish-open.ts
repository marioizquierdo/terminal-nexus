// Opening a Skirmish on the screen: the files and the clock a Skirmish's route needs, kept apart from the pure play
// (`./skirmish-play.ts`) and the pure route (`./route.ts`). The game (`terminal-nexus --load`, `--at skirmish...`), the
// setup screen's New game and Load game, and the scripted playtest all open one here.
//
// **Parity with the `skirmish` command** (`./skirmish.ts`): a battle is opened by the same steps the command takes
// (`src/skirmish/request.ts`: a new battle or a save read back, then the slots seated), under the same words (`--p1`,
// `--p2`, `build:<plan file>`, `script:<profile>`), and played by the same `playNext`; so a battle asked for on one opens
// and plays as it would on the other. What differs is what a screen can play (`screenProblem`): p1 as its player, or
// two scripts to watch.

import type { SlotChange } from "../skirmish/request.ts"
import { loadedBattle, newBattle, seat } from "../skirmish/request.ts"
import type { Profiles, SaveFile, Slot } from "../skirmish/save.ts"
import { SHIPPED_PROFILES } from "../skirmish/shipped-players.ts"
import { SLOTS } from "../skirmish/save.ts"
import { screenProblem, slotAsk } from "../skirmish/slots.ts"
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
    save = loadedBattle(text, ask.load, profiles)
  } else {
    const named = ask.setup
    save = newBattle(
      {
        seed: ask.seed ?? clockSeed(now()),
        ...(named?.map === undefined ? {} : { map: named.map }),
        ...(named?.modifiers === undefined ? {} : { modifiers: named.modifiers }),
        commanders: { ...(named?.p1Commander === undefined ? {} : { p1: named.p1Commander }), ...(named?.p2Commander === undefined ? {} : { p2: named.p2Commander }) },
      },
      profiles,
    )
  }
  const changes: Partial<Record<Slot, SlotChange>> = {}
  const problems: string[] = []
  for (const slot of SLOTS) {
    // The command line's --p1/--p2 over the route's p1/p2.
    const written = options.slots?.[slot] ?? ask.setup?.[slot]
    if (written === undefined) continue
    try {
      changes[slot] = { ask: slotAsk(written, profiles) }
    } catch (error) {
      problems.push(`--${slot} ${written}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  if (problems.length > 0) throw new Error(problems.join("\n"))
  // The same seating the `skirmish` command does: a plan file given for p1 is the plan so far, laid on the Build Phase
  // as it opens, as a save's draft is. The screen plans only p1, so only p1's is kept.
  const seated = seat(save, changes, read)
  const { setup } = seated
  const refused = screenProblem(setup)
  if (refused !== null) throw new Error(`the game cannot open this Skirmish: ${refused}`)
  if (seated.problems.length > 0) throw new Error(seated.problems.join("\n"))
  const p1 = seated.plans.p1
  const draft = p1 === undefined ? save.draft : { ...save.draft, p1 }
  if (save.start !== undefined) throw new Error(`${ask.load ?? "this save"} is a testing save: it plays one Battle Round in grid (grid <file>), not on the game's screen`)
  const opened: SaveFile = { ...save, setup, ...(draft === undefined ? {} : { draft }) }
  // A file named without a folder is the working folder's: said so, so Save game writes it back there, not into the saves folder.
  const file = ask.load === undefined ? undefined : ask.load.includes("/") ? ask.load : `./${ask.load}`
  const level = skirmishLevel(opened, file === undefined ? {} : { file }, { newSeed: () => clockSeed(now()), profiles })
  return { kind: "level", level, round: 1 }
}
