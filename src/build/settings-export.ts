// Settings as text (owner, 2026-09-28): "we need a way to export the settings, so I can report back
// here which settings are working better ... Ideally I would play, export settings, and copy-paste
// them into a PR comment." And the other direction, so an agent can start from exactly what he had.
//
// **The format** is plain lines of `name = value`, with `#` starting a comment, so it reads in a pull
// request comment and parses back without a schema:
//
//     Terminal Nexus settings
//     # build 592f3cb
//     # Changed experiments
//     placeLight = rainbow  # Lighting, default light
//     # Settings
//     theme = dark  # Background
//     ...
//     # Experiments at their defaults
//     placeFramesMs = 450  # Build animation
//
// Experiments that differ from this build's defaults come first, each with the default it replaced;
// then the player's own settings; then every other experiment, so the text pins the whole state even
// when a later build moves a default. Names are the code's own field names — the same ones the
// settings file uses — because what reads them back is the game; the comment gives the name on screen.
//
// **Parsing is forgiving**, in the style of `parseSettings`: any `name = value` pair anywhere is read
// (lines, spaces, commas, semicolons or `&` all separate them, so a one-line `--settings
// "placeLight=rainbow scrollMargin=25"` works too); an unknown name is ignored; a value that is not one
// the setting can take leaves that one setting as it was. Nothing here touches a clock, a file or a
// clipboard — the adapters do that (`src/cli/terminalNexus.ts`, `src/web/host.ts`).

import type { Settings } from "../settings/types.ts"
import { parseSettings } from "../settings/types.ts"
import type { DebugField, DebugFlags } from "./debug.ts"
import { DEBUG_FIELDS, fieldSpec, formatDebugValue, initialDebugFlags } from "./debug.ts"
import type { PlayerField } from "./settings.ts"
import { PLAYER_FIELDS, playerSpec } from "./settings.ts"

export type SettingsSnapshot = Readonly<{ settings: Settings; experiments: DebugFlags }>

/** The experiments' defaults in this build: what a fresh Build Phase opens with when nothing is
 *  passed. "Changed" in an export means "not this". */
export function defaultExperiments(): DebugFlags {
  return initialDebugFlags({})
}

/** A value as the export writes it: a number bare, a yes/no as `on`/`off`, a choice by its own name. */
function raw(value: unknown): string {
  if (typeof value === "boolean") return value ? "on" : "off"
  return String(value)
}

export const EXPORT_TITLE = "Terminal Nexus settings"

/** The text of an export. `build` names the commit it came from, when the adapter knows it. */
export function formatSettingsExport(snapshot: SettingsSnapshot, build?: string): string {
  const defaults = defaultExperiments()
  const lines: string[] = build === undefined ? [EXPORT_TITLE] : [EXPORT_TITLE, `# build ${build}`]
  const changed = DEBUG_FIELDS.filter((spec) => snapshot.experiments[spec.field] !== defaults[spec.field])
  if (changed.length === 0) lines.push("# Changed experiments: none")
  else {
    lines.push("# Changed experiments")
    for (const spec of changed) {
      const was = formatDebugValue(defaults, spec.field)
      lines.push(`${spec.field} = ${raw(snapshot.experiments[spec.field])}  # ${spec.label}, default ${was}`)
    }
  }
  lines.push("# Settings")
  for (const spec of PLAYER_FIELDS) lines.push(`${spec.field} = ${raw(snapshot.settings[spec.field])}  # ${spec.label}`)
  const unchanged = DEBUG_FIELDS.filter((spec) => snapshot.experiments[spec.field] === defaults[spec.field])
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

function asBoolean(text: string): boolean | null {
  const lower = text.toLowerCase()
  if (TRUE_WORDS.has(lower)) return true
  if (FALSE_WORDS.has(lower)) return false
  return null
}

/**
 * One experiment's value from text, or `null` when it is not one the flag can take. Accepted: the
 * value as the export writes it, as the popup shows it ("centres", "map"), or — for a number — any
 * number between the flag's smallest and largest listed values, with a unit or not ("450", "450ms",
 * "25%"), since a number the list does not hold is a legal starting value (`--scroll-margin 12`).
 */
function experimentValue(field: DebugField, text: string): DebugFlags[DebugField] | null {
  const spec = fieldSpec(field)
  const values = spec.values as readonly DebugFlags[DebugField][]
  const format = spec.format as (value: DebugFlags[DebugField]) => string
  const lower = text.toLowerCase()
  for (const value of values) {
    if (raw(value).toLowerCase() === lower || format(value).toLowerCase() === lower) return value
  }
  const first = values[0]
  if (typeof first === "boolean") return asBoolean(text)
  if (typeof first === "number") {
    const number = Number(lower.replace(/(ms|%|tiles?)$/u, ""))
    const numbers = values as readonly number[]
    if (Number.isInteger(number) && number >= Math.min(...numbers) && number <= Math.max(...numbers)) return number
  }
  return null
}

export type ImportResult = Readonly<{
  snapshot: SettingsSnapshot
  /** The names whose values were taken, in the order they were read. */
  applied: readonly string[]
  /** What was not: an unknown name, or a value the setting cannot take — each as it was written. */
  ignored: readonly string[]
}>

const PAIR = /([A-Za-z][A-Za-z0-9_]*)\s*=\s*([^\s,;&#]+)/gu

/**
 * Reads an export (or any `name = value` text) onto `base`: every pair it recognises replaces that one
 * value, everything else is left as `base` has it. Never throws.
 */
export function parseSettingsExport(text: string, base: SettingsSnapshot): ImportResult {
  const settingsRecord: Record<string, unknown> = { ...base.settings }
  const experiments: Record<string, unknown> = { ...base.experiments }
  const applied: string[] = []
  const ignored: string[] = []
  const fields = new Set<string>(DEBUG_FIELDS.map((spec) => spec.field))
  for (const line of text.split(/\r?\n/u)) {
    // A comment runs to the end of its line; a URL-encoded or one-line form has none to strip.
    const body = line.replace(/#.*$/u, "")
    for (const match of body.matchAll(PAIR)) {
      const name = match[1] as string
      const value = match[2] as string
      if (fields.has(name)) {
        const parsed = experimentValue(name as DebugField, value)
        if (parsed === null) ignored.push(`${name}=${value}`)
        else {
          experiments[name] = parsed
          applied.push(name)
        }
        continue
      }
      const player = PLAYER_FIELDS.some((spec) => spec.field === name)
        ? (name as PlayerField)
        : PLAYER_ALIASES[name.toLowerCase()]
      if (player === undefined) {
        ignored.push(`${name}=${value}`)
        continue
      }
      const candidate = player === "reducedMotion" ? asBoolean(value) : playerValue(player, value)
      if (candidate === null) {
        ignored.push(`${name}=${value}`)
        continue
      }
      settingsRecord[player] = candidate
      applied.push(player)
    }
  }
  // The settings file's own forgiving parse has the last word on the player's half.
  const settings = parseSettings({ ...base.settings, ...settingsRecord })
  return { snapshot: { settings, experiments: experiments as DebugFlags }, applied, ignored }
}

/** A player setting's value from text — its own name, or the name the popup shows ("16", "none"). */
function playerValue(field: Exclude<PlayerField, "reducedMotion">, text: string): string | null {
  const spec = playerSpec(field)
  const format = spec.format as (value: string) => string
  const lower = text.toLowerCase()
  for (const value of spec.values as readonly string[]) {
    if (value.toLowerCase() === lower || format(value).toLowerCase() === lower) return value
  }
  return null
}
