// A side's build actions for a round as a player hands them in: a JSON object (`BuildActions`: the power it keeps, the
// buildings and where, the actions taken on its buildings, the formation and the rally point), read leniently, because a
// language model writes it; and a build file, those actions for one round or many, chosen by round. The first `{ ... }`
// in the text is the build actions, whatever prose or fence surrounds it; a field of the wrong kind is
// dropped with a problem said, never the whole of them; a rally point it cannot read is the default, in front of the
// base; a formation it does not name is none, each building where its placement says. What the round then refuses (a
// building it cannot afford, a card number past the hand, a rally point on rock) is the round's to say (`playRound`).
//
// **Files from before the rally point** (the owner, 2026-11-26: the stance goes, the rally point says where the troops
// go) still play: their `"stance"` is read as a rally point — `"attack"` the enemy's Nexus, `"hold"` the side's own —
// and their `"banner"` as a rally point on its tile, each with a problem said (`retired`), never refused.

import { RALLY_PLACES } from "../match/rally.ts"
import type { RallyPlace, RallySpot } from "../match/rally.ts"
import type { BuildingOrder, Formation, Placement, BuildActions, Zone } from "./types.ts"
import { FORMATIONS, ZONES } from "./types.ts"

/** Build actions read from text, every problem found reading them, and which of those problems only say an old field
 *  was read in its new form (`"stance"`, `"banner"`): the build actions play as they are, and a save is not refused
 *  for them. */
export type ReadBuildActions = Readonly<{ actions: BuildActions; problems: readonly string[]; retired: readonly string[] }>

/** The words a problem names the rally point's forms in. */
const RALLY_FORMS = `{ "x", "y" } (a tile), ${RALLY_PLACES.map((place) => `"${place}"`).join(" or ")}`

/** The rally point in a field's value, or `undefined` when it is not one. */
function rallyIn(value: unknown): RallySpot | undefined {
  if (typeof value === "string") return (RALLY_PLACES as readonly string[]).includes(value) ? (value as RallyPlace) : undefined
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined
  const { x, y } = value as Record<string, unknown>
  return typeof x === "number" && typeof y === "number" && Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 ? { x, y } : undefined
}

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
    return { actions: { build: [] }, problems: ["no build actions found: keep nothing, build nothing, rally in front of the base"], retired: [] }
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
  // The rally point; or, from a file written before it, the banner's tile, or else the stance's Nexus.
  const retired: string[] = []
  let rally: RallySpot | undefined
  const named = raw["rally"]
  if (named !== undefined && named !== null) {
    rally = rallyIn(named)
    if (rally === undefined) problems.push(`"rally" should be ${RALLY_FORMS}, not ${JSON.stringify(named)}; the troops rally in front of the base`)
  }
  const banner = raw["banner"]
  if (banner !== undefined && banner !== null) {
    const tile = rallyIn(banner)
    const read = tile === undefined || typeof tile === "string" ? null : tile
    if (rally !== undefined || named !== undefined) retired.push(`"banner" is no longer read: "rally" says where the troops go`)
    else if (read === null) retired.push(`"banner" is no longer read, and this one names no tile: write "rally": ${RALLY_FORMS}`)
    else {
      rally = read
      retired.push(`"banner" is read as "rally": { "x": ${read.x}, "y": ${read.y} }, and held: write "rally" instead`)
    }
  }
  const stance = raw["stance"]
  if (stance !== undefined && stance !== null) {
    const place: RallyPlace | undefined = stance === "attack" ? "ENEMY_NEXUS" : stance === "hold" ? "HOME_NEXUS" : undefined
    if (rally !== undefined || named !== undefined || (banner !== undefined && banner !== null)) retired.push(`"stance" is no longer read: the rally point says where the troops go`)
    else if (place === undefined) retired.push(`"stance" is no longer read, and ${JSON.stringify(stance)} was never one: write "rally": ${RALLY_FORMS}`)
    else {
      rally = place
      retired.push(`"stance": "${String(stance)}" is read as "rally": "${place}": write "rally" instead`)
    }
  }
  problems.push(...retired)
  const note = typeof raw["note"] === "string" ? raw["note"].slice(0, 300) : undefined
  return {
    actions: {
      ...(power === undefined ? {} : { power }),
      build,
      ...(formation === undefined ? {} : { formation }),
      ...(actions.length === 0 ? {} : { actions }),
      ...(rally === undefined ? {} : { rally }),
      ...(note === undefined ? {} : { note }),
    },
    problems,
    retired,
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
