// A mission's lines — the presentation band of its triggers (campaigns.md, "two bands of trigger actions"),
// built at its smallest: `say`, a line of dialog, run when a round's Build Phase opens (`build.start`).
//
// **The runner never reads any of this** (`src/match/mission.ts` applies only the simulation band), so a
// mission's lines can never change what its Pulses resolve: a scene read, skipped or never shown ends on
// exactly the same Grid. What is here is what the screen needs to show a round's scene — `sceneOf` — and
// the load-time checks on a `say`, which `validate.ts` reports with every other problem at once.
//
// Pure data, like the rest of `src/mission`: no kernel, no view, no glyph. A speaker who is a unit is named
// by its content id here; its name and its glyph are the shell's and the view's to find.

import type { ContentRegistry } from "../content/index.ts"
import { wrapWords } from "../terminal/wrap-words.ts"
import type { PlayerId } from "../state/types.ts"
import type {
  MissionDefinition,
  PresentationAction,
  SayAction,
  TriggerAction,
  TriggerCondition,
  TriggerDefinition,
} from "./types.ts"

/**
 * How many columns of text a line of dialog has at the 80 x 24 floor, and how many lines the dialog holds:
 * a `say` must wrap into at most `SAY_LINES` lines of `SAY_COLUMNS` (checked when the mission loads). The
 * dialog is the popup's own width over the map (`src/build/popup.ts`), whose text column is this wide at
 * 80 columns — a test holds the two to each other.
 */
export const SAY_COLUMNS = 42
export const SAY_LINES = 3

/** A line of a scene: the `say` it was written as. */
export type SceneLine = SayAction["say"]

/** Whether an action is presentation (shown, never resolved) rather than simulation. */
export function isPresentation(action: TriggerAction): action is PresentationAction {
  return "say" in action
}

/** Whether a condition is a round's Build Phase opening. */
export function isBuildStart(condition: TriggerCondition): condition is Readonly<{ event: "build.start"; pulse: number }> {
  return "event" in condition && condition.event === "build.start"
}

/** **A round's scene**: the lines its `build.start` triggers say, in trigger order and, within a trigger,
 *  in the order it lists them. Empty for a round with nothing to say. */
export function sceneOf(mission: Pick<MissionDefinition, "triggers">, round: number): readonly SceneLine[] {
  const lines: SceneLine[] = []
  for (const trigger of mission.triggers) {
    if (!isBuildStart(trigger.when) || trigger.when.pulse !== round) continue
    for (const action of trigger.do) if ("say" in action) lines.push(action.say)
  }
  return lines
}

/** A line of text as the dialog wraps it at the floor. */
export function sayLines(text: string): readonly string[] {
  return wrapWords(text.trim(), SAY_COLUMNS)
}

/** What a mission brings onto the Grid by the end of round `round`'s Pulse — the groups its spawns name,
 *  and the units they bring — so a line can only look at what can be on that round's map. */
function broughtBy(mission: MissionDefinition, round: number): Readonly<{ groups: Set<string>; units: Map<string, PlayerId> }> {
  const groups = new Set<string>()
  const units = new Map<string, PlayerId>()
  for (const trigger of mission.triggers) {
    const { when } = trigger
    if ("event" in when || when.pulse > round) continue
    for (const action of trigger.do) {
      if (!("spawn" in action)) continue
      if (action.spawn.group !== undefined) groups.add(action.spawn.group)
      for (const entry of action.spawn.units) if (!units.has(entry.unit)) units.set(entry.unit, action.spawn.side)
    }
  }
  return { groups, units }
}

/** A string shaped like a content id (`unit.citizen.vasse`) rather than a person's name. */
const looksLikeContentId = (value: string): boolean => /^[a-z]+(\.[a-z0-9-]+)+$/u.test(value)

/**
 * Every problem with one `say`, said through `say` (the validator's own collector), each naming the trigger
 * and the action as `where` does: a line runs only when a Build Phase opens; its speaker and its text are
 * not empty, and the text fits the dialog at 80 x 24; a speaker given by content id is a unit the mission
 * brings by that round, and a name is not a mistyped id; its side is a side; and what it looks at is real —
 * a region of the mission, or a group or a unit some trigger brings by that round.
 */
export function checkSay(
  mission: MissionDefinition,
  registry: ContentRegistry,
  trigger: TriggerDefinition,
  action: SayAction,
  where: string,
  say: (problem: string) => void,
): void {
  const line = action.say
  const round = isBuildStart(trigger.when) ? trigger.when.pulse : null
  if (round === null) say(`${where} must wait for a Build Phase to open (build.start): a line is shown only then`)
  const brought = broughtBy(mission, round ?? mission.pulses)
  const by = round === null ? "" : ` by round ${round}`

  const speaker = typeof line.speaker === "string" ? line.speaker.trim() : ""
  if (speaker === "") say(`${where} has no speaker`)
  else if (registry.has(speaker)) {
    if (registry.get(speaker).layer === "obstacles") say(`${where} has the structure "${speaker}" speak; a speaker is a unit or a name`)
    else if (!brought.units.has(speaker)) say(`${where} has "${speaker}" speak, which no trigger brings${by}`)
  } else if (looksLikeContentId(speaker)) say(`${where} names the unknown speaker "${speaker}"`)

  if (line.side !== undefined && line.side !== "A" && line.side !== "B") say(`${where} names the unknown side "${String(line.side)}"`)

  const text = typeof line.text === "string" ? line.text.trim() : ""
  if (text === "") say(`${where} says nothing`)
  else {
    const wrapped = sayLines(text)
    if (wrapped.length > SAY_LINES || wrapped.some((part) => part.length > SAY_COLUMNS)) {
      say(`${where} is too long for the dialog: it takes ${wrapped.length} lines of ${SAY_COLUMNS} columns at 80 x 24, and the dialog holds ${SAY_LINES}`)
    }
  }

  const focus = line.focus as Readonly<Record<string, unknown>> | undefined
  if (focus === undefined) return
  const keys = Object.keys(focus)
  if (keys.length !== 1) {
    say(`${where} looks at ${keys.length === 0 ? "nothing" : `${keys.length} things at once`}: a focus is one unit, group or region`)
    return
  }
  const value = focus[keys[0] as string]
  if ("region" in focus) {
    if (!mission.regions.some((region) => region.id === value)) say(`${where} looks at the unknown region "${String(value)}"`)
  } else if ("group" in focus) {
    if (typeof value !== "string" || !brought.groups.has(value)) say(`${where} looks at the group "${String(value)}", which no trigger brings${by}`)
  } else if ("unit" in focus) {
    if (typeof value !== "string" || !registry.has(value)) say(`${where} looks at the unknown content id "${String(value)}"`)
    else if (!brought.units.has(value)) say(`${where} looks at "${value}", which no trigger brings${by}`)
  } else {
    say(`${where} has a focus this vocabulary does not know: ${JSON.stringify(focus)}`)
  }
}
