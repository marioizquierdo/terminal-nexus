// A side's plan as a player hands it in: a JSON object (`SidePlan`), read leniently, because a language model writes it.
// The first `{ ... }` in the text is the plan, whatever prose or fence surrounds it; a field of the wrong kind is
// dropped with a problem said, never the whole plan; a stance it does not name holds. What the round then refuses (a
// building it cannot afford, a card number past the hand) is the round's to say (`playRound`).

import type { Placement, SidePlan, Stance, Zone } from "./types.ts"
import { STANCES, ZONES } from "./types.ts"

/** A plan read from text, and every problem found reading it. */
export type ReadPlan = Readonly<{ plan: SidePlan; problems: readonly string[] }>

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

/** A plan from `text` (or an object already parsed): what it says, as far as it says it, and the problems. */
export function readPlan(given: string | unknown): ReadPlan {
  const problems: string[] = []
  const value = typeof given === "string" ? objectIn(given) : given
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { plan: { build: [], stance: "hold" }, problems: ["no plan found: keep nothing, build nothing, hold"] }
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
  const note = typeof raw["note"] === "string" ? raw["note"].slice(0, 300) : undefined
  return { plan: { ...(power === undefined ? {} : { power }), build, stance, ...(note === undefined ? {} : { note }) }, problems }
}
