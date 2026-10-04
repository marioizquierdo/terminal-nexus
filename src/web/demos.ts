// A pull request's demos for the browser playtest page (`bun scripts/build-web.mjs --demos <file>`): each a
// button that opens the game where a question is, and says what to try there. Checked here, at build time, with
// the readers the page itself uses — a demo the page could not follow would open somewhere else and say nothing.
//
// A demos file is a list of `{ "label", "try", "at"?, "keys"?, "settings"? }`:
//
//   label     the button's name
//   try       what to try once it opens, shown under the screen
//   at        where it opens, as a route (`src/cli/route.ts`): `campaign?level=vasse-test-1&round=2` opens that
//             round without a key script walking to it; a campaign level's first round unless given
//   keys      a key script played first, as `--keys` takes it — on a campaign level only
//   settings  a settings text to start with, as `--settings` takes it — on a campaign level only
//
// Not reached by the page: its demos are stamped into it already checked.

import { parseKeyScript } from "../playtest/keys.ts"
import { parseRoute } from "../cli/route.ts"

export type Demo = Readonly<{ label: string; try: string; at?: string; keys?: string; settings?: string }>

const FIELDS: readonly string[] = ["label", "try", "at", "keys", "settings"]

/** `list` as demos, or an error naming `source`, the demo and what is wrong with it. */
export function checkDemos(list: unknown, source: string): readonly Demo[] {
  if (!Array.isArray(list)) throw new Error(`${source}: expected a list of demos`)
  return list.map((entry: unknown, index): Demo => {
    const which = `${source}: demo ${index + 1}`
    const demo = (typeof entry === "object" && entry !== null ? entry : {}) as Record<string, unknown>
    const unknown = Object.keys(demo).filter((field) => !FIELDS.includes(field))
    if (typeof demo["label"] !== "string" || typeof demo["try"] !== "string" || unknown.length > 0) {
      const extra = unknown.length > 0 ? `; unknown: ${unknown.join(", ")}` : ""
      throw new Error(`${which} needs a "label" and a "try", and may have "at", "keys" and "settings"${extra}`)
    }
    for (const field of ["at", "keys", "settings"]) {
      if (demo[field] !== undefined && typeof demo[field] !== "string") throw new Error(`${which}'s "${field}" must be text`)
    }
    const { at, keys, settings } = demo as Readonly<{ at?: string; keys?: string; settings?: string }>
    if (at !== undefined) {
      let destination
      try {
        destination = parseRoute(at)
      } catch (error) {
        throw new Error(`${which}'s at: ${error instanceof Error ? error.message : String(error)}`)
      }
      if (destination.kind !== "level" && (keys !== undefined || settings !== undefined)) {
        throw new Error(`${which}'s at, "${at}", is on the title menu: its keys and settings are for a campaign level`)
      }
    }
    // A key script the page cannot read would open the Build Phase at its beginning and say nothing.
    if (keys !== undefined) {
      try {
        parseKeyScript(keys)
      } catch (error) {
        throw new Error(`${which}'s keys: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    return {
      label: demo["label"],
      try: demo["try"],
      ...(at === undefined ? {} : { at }),
      ...(keys === undefined ? {} : { keys }),
      ...(settings === undefined ? {} : { settings }),
    }
  })
}
