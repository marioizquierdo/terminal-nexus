// A side's build actions for a round as a player hands them in: a JSON object (`BuildActions`: the power it keeps, the
// buildings and where, the actions taken on its buildings, the formation and the stance), read leniently, because a
// language model writes it; and a build file, those actions for one round or many, chosen by round. The first `{ ... }`
// in the text is the build actions, whatever prose or fence surrounds it; a field of the wrong kind is
// dropped with a problem said, never the whole of them; a stance it does not name holds; a formation it does not name is
// none, each building where its placement says. What the round then refuses (a
// building it cannot afford, a card number past the hand) is the round's to say (`playRound`).

import type { BuildingOrder, Formation, Placement, BuildActions, Stance, Zone } from "./types.ts"
import { FORMATIONS, STANCES, ZONES } from "./types.ts"

/** Build actions read from text, and every problem found reading them. */
export type ReadBuildActions = Readonly<{ actions: BuildActions; problems: readonly string[] }>

/** The JSON object in `text`: the whole text, or the first balanced `{ ... }` in it. `null` when there is none. */
function objectIn(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    // Not the whole text: look for the first balanced object in it.
  }
  const start = text.indexOf("{")
  if (start < 0) return null
  let depth = 0
  let quoted = false
  for (let index = start; index < text.length; index += 1) {
    const character = text[index]
    if (quoted) {
      if (character === "\\") index += 1
      else if (character === '"') quoted = false
      continue
    }
    if (character === '"') quoted = true
    else if (character === "{") depth += 1
    else if (character === "}") {
      depth -= 1
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, index + 1))
        } catch {
          return null
        }
      }
    }
  }
  return null
}

/** Build actions from `text` (or an object already parsed): what they say, as far as they say it, and the problems. */
export function readBuildActions(given: string | unknown): ReadBuildActions {
  const problems: string[] = []
  const value = typeof given === "string" ? objectIn(given) : given
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { actions: { build: [], stance: "hold" }, problems: ["no build actions found: keep nothing, build nothing, hold"] }
  }
  const raw = value as Record<string, unknown>
  let power: number | undefined
  if (raw["power"] !== undefined && raw["power"] !== null) {
    if (typeof raw["power"] === "number" && Number.isInteger(raw["power"]) && raw["power"] >= 0) power = raw["power"]
    else problems.push(`"power" should be a card's number or 0, not ${JSON.stringify(raw["power"])}`)
  }
  const build: Placement[] = []
  const asked = raw["build"]
  if (asked !== undefined && !Array.isArray(asked)) problems.push(`"build" should be a list`)
  if (Array.isArray(asked)) {
    asked.forEach((item: unknown, index) => {
      const entry = typeof item === "string" ? { building: item } : item
      if (entry === null || typeof entry !== "object") return problems.push(`build ${index + 1} should be an object with "building"`)
      const fields = entry as Record<string, unknown>
      if (typeof fields["building"] !== "string") return problems.push(`build ${index + 1} names no "building"`)
      const at = fields["at"]
      const zone = typeof at === "string" && (ZONES as readonly string[]).includes(at) ? (at as Zone) : undefined
      if (at !== undefined && zone === undefined) problems.push(`build ${index + 1}: "at" should be one of ${ZONES.join(", ")}; it goes by its Nexus`)
      const x = fields["x"]
      const y = fields["y"]
      const tile = typeof x === "number" && typeof y === "number" && Number.isInteger(x) && Number.isInteger(y) ? { x, y } : {}
      build.push({ building: fields["building"], ...(zone === undefined ? {} : { at: zone }), ...tile })
    })
  }
  const stanceGiven = raw["stance"]
  const stance: Stance = typeof stanceGiven === "string" && (STANCES as readonly string[]).includes(stanceGiven) ? (stanceGiven as Stance) : "hold"
  if (stanceGiven !== undefined && stance !== stanceGiven) problems.push(`"stance" should be ${STANCES.join(" or ")}; it holds`)
  const formationGiven = raw["formation"]
  const formation = typeof formationGiven === "string" && (FORMATIONS as readonly string[]).includes(formationGiven) ? (formationGiven as Formation) : undefined
  if (formationGiven !== undefined && formationGiven !== null && formation === undefined) {
    problems.push(`"formation" should be ${FORMATIONS.map((name) => `"${name}"`).join(", ")}; each building goes where its "at" says`)
  }
  const actions: BuildingOrder[] = []
  const acting = raw["actions"]
  if (acting !== undefined && acting !== null && !Array.isArray(acting)) problems.push(`"actions" should be a list`)
  if (Array.isArray(acting)) {
    acting.forEach((item: unknown, index) => {
      const fields = item !== null && typeof item === "object" ? (item as Record<string, unknown>) : {}
      const { x, y, action } = fields
      if (typeof x !== "number" || typeof y !== "number" || !Number.isInteger(x) || !Number.isInteger(y) || typeof action !== "string") {
        return problems.push(`action ${index + 1} should be { "x", "y", "action" }: a building of yours by its anchor, and one of its actions by id`)
      }
      actions.push({ x, y, action })
    })
  }
  const note = typeof raw["note"] === "string" ? raw["note"].slice(0, 300) : undefined
  return {
    actions: {
      ...(power === undefined ? {} : { power }),
      build,
      ...(formation === undefined ? {} : { formation }),
      stance,
      ...(actions.length === 0 ? {} : { actions }),
      ...(note === undefined ? {} : { note }),
    },
    problems,
  }
}

// --- Build files: build actions by round ---------------------------------------------------------------------------

/** Which rounds a build file's entry is for: one (`3`), a range (`"2-4"`), every round (`"*"`), or, left out, the first
 *  round played with the file. */
export type RoundSelector = number | string

/** One entry of a build file: the rounds it is for, and its build actions. */
export type BuildEntry = Readonly<{ round?: RoundSelector; actions: BuildActions }>

/** A build file read: its entries in order, and every problem found reading them. */
export type ReadBuildFile = Readonly<{ entries: readonly BuildEntry[]; problems: readonly string[] }>

/** Whether `selector` is one a build file may name. */
function selectorProblem(selector: unknown): string | null {
  if (typeof selector === "number" && Number.isInteger(selector) && selector >= 1) return null
  if (selector === "*") return null
  if (typeof selector === "string" && /^\d+(-\d+)?$/u.test(selector)) {
    const [from, to = from] = selector.split("-").map(Number) as [number, number?]
    if (from >= 1 && (to ?? from) >= from) return null
  }
  return `"round" should be a round (3), a range ("2-4") or every round ("*"), not ${JSON.stringify(selector)}`
}

/**
 * **A build file**: one object of build actions (for the first round played with it), or a list of them, each with the
 * `round` it is for. Read leniently, as build actions are: an entry with a round it cannot read is dropped and said.
 */
export function readBuildFile(text: string): ReadBuildFile {
  const trimmed = text.trim()
  let value: unknown
  try {
    value = JSON.parse(trimmed)
  } catch {
    value = undefined
  }
  if (!Array.isArray(value)) {
    const { actions, problems } = readBuildActions(value ?? text)
    const round = value !== null && typeof value === "object" ? (value as Record<string, unknown>)["round"] : undefined
    if (round === undefined) return { entries: [{ actions }], problems }
    const problem = selectorProblem(round)
    return problem === null ? { entries: [{ round: round as RoundSelector, actions }], problems } : { entries: [], problems: [...problems, problem] }
  }
  const entries: BuildEntry[] = []
  const problems: string[] = []
  value.forEach((item: unknown, index) => {
    const round = item !== null && typeof item === "object" ? (item as Record<string, unknown>)["round"] : undefined
    const problem = round === undefined ? null : selectorProblem(round)
    if (problem !== null) return problems.push(`entry ${index + 1}: ${problem}; dropped`)
    const read = readBuildActions(item)
    problems.push(...read.problems.map((each) => `entry ${index + 1}: ${each}`))
    entries.push({ ...(round === undefined ? {} : { round: round as RoundSelector }), actions: read.actions })
  })
  return { entries, problems }
}

/** Whether an entry is for `round`, `first` being the first round played with the file. */
export function entryFits(entry: BuildEntry, round: number, first: number): boolean {
  const selector = entry.round
  if (selector === undefined) return round === first
  if (selector === "*") return true
  if (typeof selector === "number") return selector === round
  const [from, to = from] = selector.split("-").map(Number) as [number, number?]
  return round >= from && round <= (to ?? from)
}

/** The build actions a file gives for `round`: its first entry that fits, or `undefined`. */
export const actionsFor = (entries: readonly BuildEntry[], round: number, first: number): BuildActions | undefined => entries.find((entry) => entryFits(entry, round, first))?.actions
