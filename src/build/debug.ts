// Debug Mode (gate 5G): the Build Phase's live-editable development flags — an experiment harness
// that lets the owner feel two answers to an open question during a playtest, instead of reading a
// paragraph about them or asking for a new command-line flag (AGENTS.md Section 5, engine.md 9.7).
//
// **Every flag names the question it serves, and is deleted once that question is answered.** A few
// may graduate into real settings; none of them is one yet, so nothing here is saved: the flags live
// in `BuildState.debug` for as long as the screen is open, and `--scroll-margin` still sets where the
// scroll margin starts.
//
// Where each flag is read:
//
// - `smartCursor`, `scrollMargin` and `startFocus` change what a command does, so the reducer reads
//   them from the state it is handed — never from a global — and a driver script replays them exactly;
// - `pressedFlashMs` and `refusedFlashMs` are presentation only: the reducer stores them and nothing
//   else, and the live loop (`src/cli/spike.ts`) reads them when it times a row's flash.
//
// None of them reaches the simulation kernel (`src/pulse`, `src/state`): a Build Phase plan is a plan
// on a screen until the Pulse, and nothing here is part of it.

import { SCROLL_MARGIN } from "./camera.ts"
import type { Focus } from "./types.ts"

export type DebugFlags = Readonly<{
  /** Q55: arming from the menu moves the cursor beside the last thing planned. */
  smartCursor: boolean
  /** Q54: how close to the view's edge the cursor gets before the camera follows, in tiles. */
  scrollMargin: number
  /** Which half of the screen has the keyboard when the Build Phase opens — a guess gate 5F made. */
  startFocus: Focus
  /** How long a menu row's "pressed" flash lasts, in milliseconds. */
  pressedFlashMs: number
  /** How long a menu row's "refused" flicker lasts, in milliseconds. */
  refusedFlashMs: number
}>

export type DebugField = keyof DebugFlags

/** When a change is seen: at once, or only once the Build Phase starts over. */
export type DebugApplies = "now" | "restart"

type FieldSpec<F extends DebugField> = Readonly<{
  field: F
  /** The row's name, short enough for the narrowest popup. */
  label: string
  applies: DebugApplies
  /** The question the flag exists to answer, in plain words. Shown under the list for the
   *  highlighted row; the open-questions id, where there is one, in parentheses at the end. */
  question: string
  /** The values Left/Right walk, in order. A number the list does not hold (a `--scroll-margin` of
   *  12, say) steps to its nearest neighbour in the direction asked. */
  values: readonly DebugFlags[F][]
  /** Whether stepping past either end comes round to the other. True for a choice of two, where
   *  "the next one" is the only thing either arrow can mean; false for a number, where the ends are
   *  real limits. */
  cycles: boolean
  format: (value: DebugFlags[F]) => string
}>

type AnyFieldSpec = { [F in DebugField]: FieldSpec<F> }[DebugField]

const tiles = (value: number): string => `${value} tile${value === 1 ? "" : "s"}`
const millis = (value: number): string => (value === 0 ? "off" : `${value} ms`)

/** The owner's own "about 50 ms" (2026-09-27), the 90 and 140 the live loop was built with, and a
 *  spread either side to feel the difference against. */
const FLASH_VALUES = [0, 50, 90, 140, 250, 400] as const

/** The flags, in the order the popup lists them. */
export const DEBUG_FIELDS: readonly AnyFieldSpec[] = [
  {
    field: "smartCursor",
    label: "Smart cursor",
    applies: "now",
    question:
      "Picking a building from the menu puts the cursor beside the last thing you planned. Off: it stays put. (Q55)",
    values: [true, false],
    cycles: true,
    format: (value: boolean) => (value ? "on" : "off"),
  },
  {
    field: "scrollMargin",
    label: "Scroll margin",
    applies: "now",
    question: "How near the edge of the view the cursor gets before the map scrolls along. (Q54)",
    values: [0, 1, 2, 3, 4, 5, 6, 8],
    cycles: false,
    format: tiles,
  },
  {
    field: "startFocus",
    label: "Opens on",
    applies: "restart",
    question: "Where the keyboard is when the Build Phase opens: the menu, or the map. Built as the menu, a guess.",
    values: ["menu", "grid"],
    cycles: true,
    format: (value: Focus) => (value === "grid" ? "map" : "menu"),
  },
  {
    field: "pressedFlashMs",
    label: "Pressed flash",
    applies: "now",
    question: "How long a menu row flashes when you choose it. Asked for: about 50 ms.",
    values: FLASH_VALUES,
    cycles: false,
    format: millis,
  },
  {
    field: "refusedFlashMs",
    label: "Refused flicker",
    applies: "now",
    question: "How long a row flickers when a key reaches it but does nothing: Left on the menu, or a row you cannot afford.",
    values: FLASH_VALUES,
    cycles: false,
    format: millis,
  },
]

/** The popup's last row, after the flags: start the Build Phase over, keeping them. */
export const DEBUG_RESTART_ROW = DEBUG_FIELDS.length
/** How many rows Up/Down walk in the popup: every flag, then the restart. */
export const DEBUG_ROW_COUNT = DEBUG_FIELDS.length + 1
export const DEBUG_RESTART_QUESTION =
  "Starts this Build Phase over with the settings above, so one marked restart takes effect. The plan is lost."

/** The live loop's flash durations as gate 5F built them — the starting values of the two flags. */
export const DEFAULT_FLASH_MS = { pressed: 90, refused: 140 } as const

/** The flags a screen opens with: what the context asks for (`--scroll-margin`, a test's
 *  `smartCursor: false`), and otherwise what gate 5F built. */
export function initialDebugFlags(
  context: Readonly<{ scrollMargin?: number; smartCursor?: boolean }>,
): DebugFlags {
  return {
    smartCursor: context.smartCursor ?? true,
    scrollMargin: context.scrollMargin ?? SCROLL_MARGIN,
    startFocus: "menu",
    pressedFlashMs: DEFAULT_FLASH_MS.pressed,
    refusedFlashMs: DEFAULT_FLASH_MS.refused,
  }
}

export function fieldSpec(field: DebugField): AnyFieldSpec {
  return DEBUG_FIELDS.find((spec) => spec.field === field) as AnyFieldSpec
}

/** The flag on popup row `row`, or `null` for the restart row (or anything past it). */
export function fieldAtRow(row: number): DebugField | null {
  return DEBUG_FIELDS[row]?.field ?? null
}

export function rowOfField(field: DebugField): number {
  return DEBUG_FIELDS.findIndex((spec) => spec.field === field)
}

/** A flag's current value, as the popup shows it. */
export function formatDebugValue(flags: DebugFlags, field: DebugField): string {
  const spec = fieldSpec(field) as FieldSpec<DebugField>
  return (spec.format as (value: DebugFlags[DebugField]) => string)(flags[field])
}

/** The value one step from `current`, or `null` at the end of a list that does not cycle. */
function stepValue<T>(values: readonly T[], current: T, step: -1 | 1, cycles: boolean): T | null {
  const index = values.indexOf(current)
  if (index >= 0) {
    const next = index + step
    if (next >= 0 && next < values.length) return values[next] as T
    return cycles ? (values[(next + values.length) % values.length] as T) : null
  }
  // A number the list does not hold: its nearest neighbour in the direction asked.
  if (typeof current !== "number") return values[0] ?? null
  const numbers = values as readonly number[]
  const found = step > 0 ? numbers.find((value) => value > current) : [...numbers].reverse().find((value) => value < current)
  return (found ?? null) as T | null
}

export type DebugAdjustment = Readonly<{ flags: DebugFlags; changed: boolean }>

/** One Left (`-1`) or Right (`+1`) on a flag. A number at the end of its range stays put and says
 *  so (`changed: false`); a choice of two comes round. */
export function adjustDebug(flags: DebugFlags, field: DebugField, step: -1 | 1): DebugAdjustment {
  const spec = fieldSpec(field) as FieldSpec<DebugField>
  const next = stepValue<DebugFlags[DebugField]>(spec.values, flags[field], step, spec.cycles)
  if (next === null || next === flags[field]) return { flags, changed: false }
  return { flags: { ...flags, [field]: next }, changed: true }
}

/** How long the live loop shows an acknowledgement of this kind. Zero means not at all. */
export function flashDuration(flags: DebugFlags, kind: "pressed" | "refused"): number {
  return kind === "pressed" ? flags.pressedFlashMs : flags.refusedFlashMs
}
