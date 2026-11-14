// Opening a Skirmish on the screen: the files and the clock a Skirmish's route needs, kept apart from the pure play
// (`./skirmish-play.ts`) and the pure route (`./route.ts`). The game (`terminal-nexus --load`, `--at skirmish...`), the
// setup screen's New game and Load game, and the scripted playtest all open one here.
//
// **Parity with the `skirmish` command** (`./skirmish.ts`): a battle is opened by the same steps the command takes
// (`src/skirmish/request.ts`: a new battle or a save read back, then `openSave`: the slots seated and the rules changed), under the same words (`--p1`,
// `--p2`, `build:<build file>`, `script:<profile>`), and played by the same `playNext`; so a battle asked for on one opens
// and plays as it would on the other. What differs is what a screen can play (`screenProblem`): p1 as its player, or
// two scripts to watch.

import { actionsFor } from "../battle/index.ts"
import type { SkirmishAsk } from "../skirmish/ask.ts"
import { newBattleOf, rulesOf, slotChangesOf } from "../skirmish/ask.ts"
import { loadedBattle, newBattle, openSave } from "../skirmish/request.ts"
import type { Profiles, SaveFile, Slot } from "../skirmish/save.ts"
import { SHIPPED_PROFILES } from "../skirmish/shipped-players.ts"
import { screenProblem } from "../skirmish/slots.ts"
import { clockSeed } from "../skirmish/words.ts"
import type { LevelDestination, SkirmishDestination } from "./route.ts"
import { skirmishLevel } from "./skirmish-play.ts"

/** What opening a Skirmish may read: the clock a new seed comes from, the slots a command line names, and the files. */
export type OpenSkirmishOptions = Readonly<{
  /** Milliseconds, for a new battle's seed (`clockSeed`): `Date.now` unless a test injects one. */
  now?: () => number
  /** `--p1`, `--p2` as written: `build:<build file>`, `build:`, `script:<name>`. */
  slots?: Readonly<Partial<Record<Slot, string>>>
  /** A file's text, for a save or a build file (`readGameFile`, `./skirmish-files.ts`, in a terminal). Absent: a host
   *  with no files (the browser page), where a save or a build file is refused. */
  readFile?: (path: string) => string
  /** The script profiles a slot may name: `players/scripts/` in a terminal (`readProfiles`), the shipped ones unless
   *  given. */
  profiles?: Profiles
}>

/**
 * **A Skirmish route, opened**: a save file read and checked (refused whole, every problem named), or a new battle on
 * the defaults and the seed given or one from the clock; the slots a command line names put in place (a build file for
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
    save = newBattle({ ...newBattleOf(ask, read), seed: ask.seed ?? clockSeed(now()) }, profiles)
  }
  if (save.start !== undefined) throw new Error(`${ask.load ?? "this save"} is a sandbox: it plays one Battle Round in grid (grid <file>), not on the game's screen`)
  // The command line's --p1/--p2 over the route's p1/p2; then who plays each slot, read as the command reads it.
  const written: SkirmishAsk = { ...ask, slots: { ...ask.slots, ...options.slots } }
  const changes = slotChangesOf(written, profiles, (word) => `--${word}`)
  // The same seating the `skirmish` command does: p1's build actions for the round it opens at (from its build file,
  // else the draft) are laid on the Build Phase as it opens. The screen plays only p1, so only p1's are kept.
  const opened = openSave(save, { slots: changes, rules: rulesOf(ask), readFile: read, profiles, ...(ask.load === undefined ? {} : { file: ask.load }) })
  const { setup, seated } = opened
  const round = opened.state.round
  const refused = screenProblem(setup)
  if (refused !== null) throw new Error(`the game cannot open this Skirmish: ${refused}`)
  if (seated.problems.length > 0) throw new Error(seated.problems.join("\n"))
  const p1 = actionsFor(seated.builds.p1 ?? [], round, round)
  const draft = p1 === undefined ? save.draft : { ...save.draft, p1 }
  const ready: SaveFile = { ...save, setup, ...(draft === undefined ? {} : { draft }) }
  // A file named without a folder is the working folder's: said so, so Save game writes it back there, not into the saves folder.
  const file = ask.load === undefined ? undefined : ask.load.includes("/") ? ask.load : `./${ask.load}`
  const level = skirmishLevel(ready, file === undefined ? {} : { file }, { newSeed: () => clockSeed(now()), profiles })
  return { kind: "level", level, round: 1 }
}
