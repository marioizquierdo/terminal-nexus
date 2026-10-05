// A pull request's demos for the browser playtest page (`bun scripts/build-web.mjs --demos <file>`): each a
// button that opens the game where a question is, and says what to try there. Checked here, at build time, as the
// page will read them — a demo the page could not follow would open somewhere else and say nothing.
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
// `at`, `keys` and `settings` are a launch's parts (`src/cli/launch.ts`), read the way the page reads them.
// Not reached by the page: its demos are stamped into it already checked.

import { LAUNCH_PARTS, readLaunch } from "../cli/launch.ts"
import type { LaunchText } from "../cli/launch.ts"
import { DEFAULT_LEVEL_ROUTE } from "../cli/route.ts"

export type Demo = Readonly<{ label: string; try: string }> & LaunchText

const FIELDS: readonly string[] = ["label", "try", ...LAUNCH_PARTS]

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
    for (const field of LAUNCH_PARTS) {
      if (demo[field] !== undefined && typeof demo[field] !== "string") throw new Error(`${which}'s "${field}" must be text`)
    }
    const { at, keys, settings } = demo as LaunchText
    const { launch, problems } = readLaunch({ at, keys, settings }, DEFAULT_LEVEL_ROUTE)
    if (launch.destination.kind !== "level" && (keys !== undefined || settings !== undefined)) {
      throw new Error(`${which}'s at, "${at}", is on the title menu: its keys and settings are for a campaign level`)
    }
    // A route or a key script the page cannot read would open the Build Phase at its beginning and say nothing.
    const [problem] = problems
    if (problem !== undefined) throw new Error(`${which}'s ${problem.part}: ${problem.error.message}`)
    return {
      label: demo["label"],
      try: demo["try"],
      ...(at === undefined ? {} : { at }),
      ...(keys === undefined ? {} : { keys }),
      ...(settings === undefined ? {} : { settings }),
    }
  })
}
