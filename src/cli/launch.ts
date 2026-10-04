// What a run starts from, read once whichever way it was started: where it opens (a route), the settings text it
// starts with, and the keys it plays first. The game's command line (`--at`, `--settings`, `--keys`), the scripted
// playtest's (the same three), the browser page's address (`#at=`, `#settings=`, `#keys=`) and a demo's fields
// (`at`, `settings`, `keys`) each only find these texts and say where they came from; reading them, and saying
// what is wrong with one, is here, so a new part reaches every way of starting a run at once (`LAUNCH_PARTS`: the
// page's address and a demo read every part it names, and a test holds the command line to it).
//
// What a host does with a launch stays the host's: the game and the playtest refuse one they cannot read, the page
// opens its default and says why under the screen, the build refuses a demo; and where a launch opens when it
// names no place is the host's to say (the title menu for the game, the default level's first round elsewhere). A
// settings text stays text here, because each host reads it over its own saved settings (`importSettings`).
//
// Pure: no terminal, no file, no clock. The browser page reads it too.

import { parseKeyScript } from "../playtest/keys.ts"
import type { PlaytestStep } from "../playtest/keys.ts"
import { parseRoute } from "./route.ts"
import type { Destination } from "./route.ts"

/** The parts a launch may have, in the order a link usually writes them. */
export const LAUNCH_PARTS = ["at", "settings", "keys"] as const

export type LaunchPart = (typeof LAUNCH_PARTS)[number]

/** A launch as its adapter found it: each part's text as written, or nothing. */
export type LaunchText = Readonly<{ [Part in LaunchPart]?: string | undefined }>

/** A launch, read. */
export type Launch = Readonly<{
  /** Where it opens: the place its route names, or the host's own start when it names none it can open. */
  destination: Destination
  /** The settings text it starts with, as written. */
  settings?: string
  /** The keys it plays before the player has the keyboard. */
  keys?: readonly PlaytestStep[]
}>

/** A part that could not be read, and why: a route that is not a place (a `RouteError`, every problem at once),
 *  or a key script with a key the game does not know. */
export type LaunchProblem = Readonly<{ part: LaunchPart; error: Error }>

/**
 * `text` read: its route's destination, or `start`'s (a route) when it names none; its settings text; its key
 * script as steps. A part that cannot be read is left out — a route that is not a place opens `start` — and said
 * in `problems`, for the host to refuse the launch or to say why it opened where it did.
 */
export function readLaunch(text: LaunchText, start: string): Readonly<{ launch: Launch; problems: readonly LaunchProblem[] }> {
  const problems: LaunchProblem[] = []
  const read = <T>(part: LaunchPart, reader: (written: string) => T): T | undefined => {
    const written = text[part]
    if (written === undefined) return undefined
    try {
      return reader(written)
    } catch (error) {
      problems.push({ part, error: error instanceof Error ? error : new Error(String(error)) })
      return undefined
    }
  }
  const destination = read("at", parseRoute) ?? parseRoute(start)
  const keys = read("keys", parseKeyScript)
  const { settings } = text
  return {
    launch: { destination, ...(settings === undefined ? {} : { settings }), ...(keys === undefined ? {} : { keys }) },
    problems,
  }
}
