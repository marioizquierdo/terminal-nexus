// The Build Phase's Settings popup (owner, 2026-09-28: "Let's solidify this as Settings"): the
// player's own settings first — the four the title menu's Settings screen already has, saved the same
// way — and then **Experiments**, every Debug Mode flag (`src/build/debug.ts`), which are for
// playtesting and are never saved. Two lists in one popup, one row shape (a value Left and Right
// change), and one way out of it for the owner's feedback: the export (`settings-export.ts`).
//
// This file holds the player half and the popup's row order. The flags themselves stay in
// `debug.ts`, whose spec list the Experiments section wraps unchanged.
//
// **Row ids.** `BuildState.overlayHighlight` names the highlighted row by an id, and the ids are
// chosen so that an experiment's id is its index in `DEBUG_FIELDS` — `rowOfField(field)` — and the
// restart row keeps `DEBUG_RESTART_ROW`, exactly as when Debug Mode was a popup of its own. The export
// row and the player settings come after them in id space. What Up/Down walk is the *display* order,
// `SETTINGS_ORDER`: player settings, experiments, restart, export.

import type { Settings } from "../settings/types.ts"
import { CAPABILITY_MODES, THEMES } from "../view/roles.ts"
import type { CapabilityMode, Theme } from "../view/roles.ts"
import { GLYPH_PACKS } from "../view/theme.ts"
import type { GlyphPack } from "../view/theme.ts"
import type { DebugField } from "./debug.ts"
import { DEBUG_FIELDS, DEBUG_RESTART_ROW } from "./debug.ts"

export type PlayerField = keyof Settings

type PlayerSpec<F extends PlayerField> = Readonly<{
  field: F
  label: string
  /** What the setting is for, in plain words — shown under the list while it is highlighted. */
  question: string
  values: readonly Settings[F][]
  format: (value: Settings[F]) => string
}>

type AnyPlayerSpec = { [F in PlayerField]: PlayerSpec<F> }[PlayerField]

const CAPABILITY_NAMES: Readonly<Record<CapabilityMode, string>> = {
  monochrome: "none",
  color16: "16",
  color256: "256",
  truecolor: "millions",
}

/** The player's settings, in the order the popup lists them. Every one applies at once. */
export const PLAYER_FIELDS: readonly AnyPlayerSpec[] = [
  {
    field: "theme",
    label: "Background",
    question: "Dark or light: match your terminal's own background.",
    values: THEMES,
    format: (value: Theme) => value,
  },
  {
    field: "capability",
    label: "Colour depth",
    question: "How many colours the screen uses. Pick fewer if colours look wrong in your terminal; none is black and white.",
    values: CAPABILITY_MODES,
    format: (value: CapabilityMode) => CAPABILITY_NAMES[value],
  },
  {
    field: "glyphPack",
    label: "Symbols",
    question: "Plain keyboard characters (ascii), or Unicode lines and blocks where your font has them.",
    values: GLYPH_PACKS,
    format: (value: GlyphPack) => value,
  },
  {
    field: "reducedMotion",
    label: "Reduced motion",
    question: "On: a new building appears finished at once, with no light and no sparks.",
    values: [false, true],
    format: (value: boolean) => (value ? "on" : "off"),
  },
]

export function playerSpec(field: PlayerField): AnyPlayerSpec {
  return PLAYER_FIELDS.find((spec) => spec.field === field) as AnyPlayerSpec
}

export function formatPlayerValue(settings: Settings, field: PlayerField): string {
  const spec = playerSpec(field) as PlayerSpec<PlayerField>
  return (spec.format as (value: Settings[PlayerField]) => string)(settings[field])
}

/** One Left (`-1`) or Right (`+1`) on a player setting. Every one is a choice, so both ends come
 *  round. */
export function adjustSetting(settings: Settings, field: PlayerField, step: -1 | 1): Settings {
  const spec = playerSpec(field) as PlayerSpec<PlayerField>
  const values = spec.values as readonly Settings[PlayerField][]
  const index = Math.max(0, values.indexOf(settings[field]))
  const next = values[(index + step + values.length) % values.length] as Settings[PlayerField]
  return { ...settings, [field]: next }
}

// --- The game menu ----------------------------------------------------------------------------------

/**
 * The game menu's rows, in order (owner, 2026-09-28: "When pressing [esc] or explicitly opening the
 * main menu, there should be an option for '[s] Settings' along with '[q] Quit'"), and the way back to
 * the game. `overlayHighlight` indexes this list while the game menu is open.
 */
export const GAME_MENU_ROWS = ["settings", "quit", "back"] as const
export type GameMenuRow = (typeof GAME_MENU_ROWS)[number]

// --- The popup's rows -------------------------------------------------------------------------------

/** The restart row keeps Debug Mode's own id. */
export const SETTINGS_RESTART_ROW = DEBUG_RESTART_ROW
/** "Export settings", after the restart. */
export const SETTINGS_EXPORT_ROW = DEBUG_FIELDS.length + 1
const FIRST_PLAYER_ROW = DEBUG_FIELDS.length + 2

/** The id of player setting `field`'s row. */
export function playerRow(field: PlayerField): number {
  return FIRST_PLAYER_ROW + PLAYER_FIELDS.findIndex((spec) => spec.field === field)
}

/** The id of the first row of each section: where `[s] Settings` and `d` open the popup. */
export const FIRST_SETTING_ROW = FIRST_PLAYER_ROW
export const FIRST_EXPERIMENT_ROW = 0

/** The rows in the order Up/Down walk them and the popup draws them. */
export const SETTINGS_ORDER: readonly number[] = [
  ...PLAYER_FIELDS.map((_, index) => FIRST_PLAYER_ROW + index),
  ...DEBUG_FIELDS.map((_, index) => index),
  SETTINGS_RESTART_ROW,
  SETTINGS_EXPORT_ROW,
]

export type SettingsRow =
  | Readonly<{ kind: "player"; field: PlayerField }>
  | Readonly<{ kind: "experiment"; field: DebugField }>
  | Readonly<{ kind: "restart" }>
  | Readonly<{ kind: "export" }>

/** What row id `row` is, or `null` for an id no row has. */
export function settingsRowAt(row: number): SettingsRow | null {
  if (row >= 0 && row < DEBUG_FIELDS.length) return { kind: "experiment", field: (DEBUG_FIELDS[row] as { field: DebugField }).field }
  if (row === SETTINGS_RESTART_ROW) return { kind: "restart" }
  if (row === SETTINGS_EXPORT_ROW) return { kind: "export" }
  const player = PLAYER_FIELDS[row - FIRST_PLAYER_ROW]
  return player === undefined ? null : { kind: "player", field: player.field }
}

/** Up (`-1`) or Down (`+1`) from row id `row`, in display order, coming round at either end. */
export function stepSettingsRow(row: number, delta: -1 | 1): number {
  const position = SETTINGS_ORDER.indexOf(row)
  const count = SETTINGS_ORDER.length
  const next = position < 0 ? 0 : (((position + delta) % count) + count) % count
  return SETTINGS_ORDER[next] as number
}
