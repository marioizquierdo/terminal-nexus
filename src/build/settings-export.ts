// Settings as text. The owner: "we need a way to export the settings, so I can report back
// here which settings are working better ... Ideally I would play, export settings, and copy-paste
// them into a PR comment." And the other direction, so an agent can start from exactly what he had.
//
// **The format** is plain lines of `name = value`, with `#` starting a comment, so it reads in a pull
// request comment and parses back without a schema:
//
//     Terminal Nexus settings
//     # build 592f3cb
//     # Changed experiments
//     raid = probe  # Raid, default heavy
//     # Settings
//     theme = dark  # Background
//     ...
//     # Experiments at their defaults
//     focusArrowMs = 180  # Focus arrow
//
// Experiments that differ from this build's defaults come first, each with the default it replaced;
// then the player's own settings; then every other experiment, so the text pins the whole state even
// when a later build moves a default. Each group is in the order Settings lists it. Names are the
// code's own field names — the same ones the settings file uses — because what reads them back is the
// game; the comment gives the name on screen.
//
// **Parsing is forgiving**, in the style of `parseSettings`: any `name = value` pair anywhere is read
// (lines, spaces, commas, semicolons or `&` all separate them, so a one-line `--settings
// "raid=probe crew=some"` works too, and so does a route's query form, `jumpStep=12&reducedMotion=true`:
// the owner's "foo=6&var=true"); an unknown name is ignored and reported; a value that is not one
// the setting can take leaves that one setting as it was. **Every on/off setting takes the usual yes and
// no words** — on/off, true/false, yes/no, 1/0 — a yes/no one (reduced motion) and one whose values are a
// choice or a number with an "off" among them (Key releases, the popup pulse) alike. **A name is read by
// the tier its setting stands on now**, not the one it had when the text was written
// (`src/build/all-settings.ts`): a player setting or an Experiment is applied to whichever it is; **a
// settled Experiment's name is skipped quietly** (`SETTLED_EXPERIMENTS`): an export from before the owner
// settled it still names it, and its value is the code's own now, so it is neither applied nor reported as
// a name the game does not know; and **a renamed setting's old name reads as its new one**
// (`RENAMED_SETTINGS`). Nothing here touches a clock, a file or a clipboard — the adapters do that
// (`src/cli/terminal-nexus.ts`, `src/web/host.ts`).

import type { Settings } from "../settings/types.ts"
import { parseSettings } from "../settings/types.ts"
import type { ShownName } from "./all-settings.ts"
import { SHOWN_SETTINGS, shownSetting } from "./all-settings.ts"
import type { Experiments } from "./experiments.ts"
import { EXPERIMENT_FIELDS, formatExperimentValue, defaultExperiments } from "./experiments.ts"
import type { PlayerField } from "./settings.ts"
import { PLAYER_FIELDS } from "./settings.ts"
import { RENAMED_SETTINGS, SETTLED_EXPERIMENTS } from "./tuning.ts"

export type SettingsSnapshot = Readonly<{ settings: Settings; experiments: Experiments }>

/** A value as the export writes it: a number bare, a yes/no (reduced motion) as `on`/`off`, a choice by
 *  its own name. */
function raw(value: unknown): string {
  if (typeof value === "boolean") return value ? "on" : "off"
  return String(value)
}

export const EXPORT_TITLE = "Terminal Nexus settings"

/** The text of an export. `build` names the commit it came from, when the adapter knows it. */
export function formatSettingsExport(snapshot: SettingsSnapshot, build?: string): string {
  const defaults = defaultExperiments()
  const lines: string[] = build === undefined ? [EXPORT_TITLE] : [EXPORT_TITLE, `# build ${build}`]
  const changed = EXPERIMENT_FIELDS.filter((spec) => snapshot.experiments[spec.field] !== defaults[spec.field])
  if (changed.length === 0) lines.push("# Changed experiments: none")
  else {
    lines.push("# Changed experiments")
    for (const spec of changed) {
      const was = formatExperimentValue(defaults, spec.field)
      lines.push(`${spec.field} = ${raw(snapshot.experiments[spec.field])}  # ${spec.label}, default ${was}`)
    }
  }
  lines.push("# Settings")
  for (const spec of PLAYER_FIELDS) lines.push(`${spec.field} = ${raw(snapshot.settings[spec.field])}  # ${spec.label}`)
  const unchanged = EXPERIMENT_FIELDS.filter((spec) => snapshot.experiments[spec.field] === defaults[spec.field])
  if (unchanged.length > 0) {
    lines.push("# Experiments at their defaults")
    for (const spec of unchanged) lines.push(`${spec.field} = ${raw(snapshot.experiments[spec.field])}  # ${spec.label}`)
  }
  return `${lines.join("\n")}\n`
}

/** Other names a person might write for a player setting: the settings file's names are canonical. */
const PLAYER_ALIASES: Readonly<Record<string, PlayerField>> = {
  colours: "capability",
  colors: "capability",
  colourdepth: "capability",
  colordepth: "capability",
  background: "theme",
  glyphs: "glyphPack",
  symbols: "glyphPack",
  reducedmotion: "reducedMotion",
}

const TRUE_WORDS = new Set(["on", "true", "yes", "1"])
const FALSE_WORDS = new Set(["off", "false", "no", "0"])

/**
 * A shown setting's value from text, or `null` when it is not one the setting can take. Accepted: the
 * value as the export writes it, as the popup shows it ("off", "16", "4 tiles"); for a yes/no, any of the
 * usual words; for a number, any number between the setting's smallest and largest listed values,
 * with a unit or not ("200", "200ms"), since a number the list does not hold is a legal starting value;
 * and for any setting with an "off" value, the usual words for it (`onOffValue`).
 */
function valueFromText(field: ShownName, text: string): number | string | boolean | null {
  const spec = shownSetting(field)
  const lower = text.toLowerCase()
  for (const value of spec.values) {
    if (raw(value).toLowerCase() === lower || spec.format(value).toLowerCase() === lower) return value
  }
  if (typeof spec.values[0] === "boolean") {
    if (TRUE_WORDS.has(lower)) return true
    if (FALSE_WORDS.has(lower)) return false
    return null
  }
  if (typeof spec.values[0] === "number") {
    // Digits first: a bare unit ("ms") is not a number, though `Number("")` would call it 0.
    const digits = /^(\d+)(?:ms|%|tiles?|taps?)?$/u.exec(lower)?.[1]
    const number = Number(digits)
    const numbers = spec.values as readonly number[]
    if (digits !== undefined && number >= Math.min(...numbers) && number <= Math.max(...numbers)) return number
  }
  return onOffValue(spec.values, spec.format, lower)
}

/**
 * The value an on/off word means for a setting that is not a plain yes/no but has an "off" among its values —
 * Key releases (`auto` or `off`), the popup pulse (0 reads "off"): a no word (off, false, no, 0) is that value,
 * and a yes word (on, true, yes, 1) the other one, where there is exactly one other. `null` for anything else,
 * a yes word on a number with several "on" values among them: which one would be a guess.
 */
function onOffValue(
  values: readonly (number | string | boolean)[],
  format: (value: number | string | boolean) => string,
  lower: string,
): number | string | boolean | null {
  const off = values.find((value) => raw(value).toLowerCase() === "off" || format(value).toLowerCase() === "off")
  if (off === undefined) return null
  if (FALSE_WORDS.has(lower)) return off
  const on = values.filter((value) => value !== off)
  if (TRUE_WORDS.has(lower) && on.length === 1) return on[0] ?? null
  return null
}

export type ImportResult = Readonly<{
  snapshot: SettingsSnapshot
  /** The names whose values were taken, in the order they were read — each by its name now. */
  applied: readonly string[]
  /** What was not: an unknown name, or a value the setting cannot take — each as it was written. */
  ignored: readonly string[]
  /** The settled Experiments' names it skipped quietly, in the order they were read. */
  settled: readonly string[]
}>

const PAIR = /([A-Za-z][A-Za-z0-9_]*)\s*=\s*([^\s,;&#]+)/gu

/** The settings Settings shows, by name — what a pair in the text may set. */
const SHOWN_NAMES: ReadonlySet<string> = new Set(SHOWN_SETTINGS.map((spec) => spec.field))

/** The shown setting a name in the text means: its own, its new name if it was renamed, or a player
 *  setting's other name; `null` for any other name. */
function shownNameOf(name: string): ShownName | null {
  const current = RENAMED_SETTINGS[name] ?? name
  if (SHOWN_NAMES.has(current)) return current as ShownName
  return PLAYER_ALIASES[name.toLowerCase()] ?? null
}

/**
 * Reads an export (or any `name = value` text) onto `base`: every pair it recognises replaces that one
 * value, everything else is left as `base` has it. Never throws.
 */
export function parseSettingsExport(text: string, base: SettingsSnapshot): ImportResult {
  const settingsRecord: Record<string, unknown> = { ...base.settings }
  const experiments: Record<string, unknown> = { ...base.experiments }
  const applied: string[] = []
  const ignored: string[] = []
  const settled: string[] = []
  for (const line of text.split(/\r?\n/u)) {
    // A comment runs to the end of its line; a URL-encoded or one-line form has none to strip.
    const body = line.replace(/#.*$/u, "")
    for (const match of body.matchAll(PAIR)) {
      const name = match[1] as string
      const value = match[2] as string
      // A shown setting first, so one that takes up a tuned number's name again is read, not skipped.
      const field = shownNameOf(name)
      if (field === null) {
        const current = RENAMED_SETTINGS[name] ?? name
        if (SETTLED_EXPERIMENTS.has(current)) settled.push(name)
        else ignored.push(`${name}=${value}`)
        continue
      }
      const parsed = valueFromText(field, value)
      if (parsed === null) {
        ignored.push(`${name}=${value}`)
        continue
      }
      if (shownSetting(field).tier === "player") settingsRecord[field] = parsed
      else experiments[field] = parsed
      applied.push(field)
    }
  }
  // The settings file's own forgiving parse has the last word on the player's half.
  const settings = parseSettings({ ...base.settings, ...settingsRecord })
  return { snapshot: { settings, experiments: experiments as Experiments }, applied, ignored, settled }
}

/** What a session opens with from an exported text: its settings, its Experiments, and what it could not
 *  read. */
export type ImportedSettings = Readonly<{ settings: Settings; experiments: Experiments; ignored: readonly string[] }>

/**
 * An exported text read onto the player's saved settings and this build's default Experiments — what
 * `--settings` (the game's and the scripted playtest's) and the browser page's `#settings=` all start
 * from. No text is the saved settings and the defaults as they are. What could not be read is in
 * `ignored`, for each adapter to say in its own way.
 */
export function importSettings(text: string | undefined, saved: Settings): ImportedSettings {
  if (text === undefined) return { settings: saved, experiments: defaultExperiments(), ignored: [] }
  const { snapshot, ignored } = parseSettingsExport(text, { settings: saved, experiments: defaultExperiments() })
  return { settings: snapshot.settings, experiments: snapshot.experiments, ignored }
}
