// The script profiles in `players/scripts/` read from disk, for the command line and the game in a terminal (the
// browser page carries them another way). Each file is one profile (`ScriptProfile`, `save.ts`); a file that is not
// one is refused by name.

import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { scriptedName } from "../duel/index.ts"
import type { Profiles, ScriptProfile } from "./save.ts"

/** Where the profiles that ship with the game are. */
export const PLAYERS_DIR = new URL("../../players/", import.meta.url).pathname

/** Every script profile in `dir/scripts`, by file name without `.json`. */
export function readProfiles(dir: string = PLAYERS_DIR): Profiles {
  const folder = join(dir, "scripts")
  const profiles = new Map<string, ScriptProfile>()
  if (!existsSync(folder)) return profiles
  for (const file of readdirSync(folder).filter((name) => name.endsWith(".json")).sort()) {
    const name = file.slice(0, -".json".length)
    const value = JSON.parse(readFileSync(join(folder, file), "utf8")) as Partial<ScriptProfile>
    if (typeof value.script !== "string" || scriptedName(value.script) === undefined) throw new Error(`players/scripts/${file}: "script" must be one of the duel's scripts, not ${JSON.stringify(value.script)}`)
    if (typeof value.about !== "string") throw new Error(`players/scripts/${file}: "about" says in a line how it plays`)
    const credits = value.options?.credits
    if (credits !== undefined && (typeof credits !== "number" || !(credits > 0))) throw new Error(`players/scripts/${file}: options.credits is a share above 0`)
    profiles.set(name, { script: value.script, about: value.about, ...(value.options === undefined ? {} : { options: value.options }) })
  }
  return profiles
}

/** The agent profiles in `dir/agents`, by file name without `.md`. */
export function agentProfiles(dir: string = PLAYERS_DIR): readonly string[] {
  const folder = join(dir, "agents")
  return existsSync(folder) ? readdirSync(folder).filter((name) => name.endsWith(".md")).map((name) => name.slice(0, -3)).sort() : []
}
