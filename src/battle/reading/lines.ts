// The battle reading in words: the score in a line, a side's reading as its brief says it, and both sides' in a round's
// report. Only words: the readings themselves are in their own files.

import { cardTextFor } from "../../content/cards.ts"
import { baseContentId } from "../../content/index.ts"
import type { Side } from "../types.ts"
import type { Composition } from "./context.ts"
import type { RoundReading, SideReading } from "./index.ts"
import type { Score } from "./score.ts"

/** A content id as a person reads it: its card's title (`unit.ravel.bomber` → Bomber). */
export const nameOf = (contentId: string): string => cardTextFor(contentId)?.title ?? baseContentId(contentId).slice(baseContentId(contentId).lastIndexOf(".") + 1)

/** Counts by content id (or `a by b`) as a person reads them, most first: "2 Barracks by Bomber, 1 Turret by Runner". */
export const namedCounts = (record: Readonly<Record<string, number>>): string =>
  Object.entries(record)
    .sort((a, b) => b[1] - a[1])
    .map(([what, count]) => `${count} ${what.split(" by ").map(nameOf).join(" by ")}`)
    .join(", ")

/** A composition in words: "12 worth 180: 8 Trooper, 4 Marksman". */
const said = (composition: Composition): string => (composition.count === 0 ? "none" : `${composition.count} worth ${composition.value}: ${namedCounts(composition.counts)}`)

const other = (side: Side): Side => (side === "A" ? "B" : "A")

/** The score in a line, as `side` reads it. */
export function scoreLine(score: Score, side: Side): string {
  const enemy = other(side)
  const percent = (share: number): string => `${Math.round(share * 100)}%`
  const who = score.leader === null ? "Even" : score.leader === side ? "You lead" : "The enemy leads"
  const rule = score.by === "health" ? "on Nexus health" : score.by === "damage" ? "on damage" : "on Nexus health and on damage"
  const nexus = score.nexus[side] === 1 && score.nexus[enemy] === 1 ? "both Nexuses whole" : `your Nexus ${percent(score.nexus[side])}, theirs ${percent(score.nexus[enemy])}`
  return `${who} ${rule}: damage dealt over the battle, yours ${score.dealt[side]}, theirs ${score.dealt[enemy]}; ${nexus === "both Nexuses whole" ? nexus : `Nexus health as the last round ended (before it mends), ${nexus}`}. A battle the rounds run out on is judged on Nexus health, then damage.`
}

/** A round's reading as `side`'s brief says it, a few lines: its army, its buildings, how far it got, what hurt it,
 *  and where the sides fought. */
export function readingLines(reading: RoundReading, side: Side): string[] {
  const mine = reading.sides[side]
  const theirs = reading.sides[other(side)]
  const lines: string[] = []
  // Units trained during the round are in neither the army it opened with nor, once lost, the one it ended with.
  const trained = (army: SideReading["army"]): string => {
    const count = army.end.count - army.start.count + army.lost.count
    return count > 0 ? `; ${count} more trained during it` : ""
  }
  lines.push(`Your army: ${said(mine.army.start)} as it opened${trained(mine.army)}; ${said(mine.army.end)} as it ended; lost ${said(mine.army.lost)}.`)
  lines.push(`Their army: ${said(theirs.army.start)} as it opened${trained(theirs.army)}; ${said(theirs.army.end)} as it ended; lost ${said(theirs.army.lost)}.`)
  const damaged = mine.buildings.damaged.map((building) => `${nameOf(building.contentId)} at ${building.at.x},${building.at.y} ${building.hp}/${building.most}`)
  lines.push(`Your buildings: ${said(mine.buildings.standing)} standing${damaged.length === 0 ? "" : `; damaged ${damaged.join(", ")}`}${Object.keys(mine.buildings.lost).length === 0 ? "" : `; destroyed ${namedCounts(mine.buildings.lost)}`}.`)
  const where = (at: number | null): string => (at === null ? "none on the Grid" : `${at}%`)
  lines.push(`Advance (0% your Nexus, 100% theirs): your army ${where(mine.advance.start)} -> ${where(mine.advance.end)}, theirs ${where(theirs.advance.start === null ? null : 100 - theirs.advance.start)} -> ${where(theirs.advance.end === null ? null : 100 - theirs.advance.end)}${mine.advance.closest === null ? "" : `; the nearest an enemy came to your Nexus: ${mine.advance.closest} tiles`}.`)
  if (Object.keys(mine.damage.taken).length > 0) lines.push(`Damage you took, by source: ${Object.entries(mine.damage.taken).sort((a, b) => b[1] - a[1]).map(([by, amount]) => `${nameOf(by)} ${amount}`).join(", ")}${mine.damage.own > 0 ? ` (${mine.damage.own} of it your own blasts and splashes)` : ""}.`)
  lines.push(...engagementLines(reading, side))
  return lines
}

/** Each engagement in a line, from `side`'s end ("you" and "they"), or by slot when `side` is absent. */
function engagementLines(reading: RoundReading, side?: Side): string[] {
  if (reading.engagements.length === 0) return ["Engagements: none."]
  const name = (which: Side): string => (side === undefined ? (which === "A" ? "p1" : "p2") : which === side ? "you" : "they")
  return reading.engagements.map((engagement, index) => {
    const part = (which: Side): string => {
      const own = engagement.sides[which]
      return `${name(which)} ${own.engaged.count} engaged (worth ${own.engaged.value}), dealt ${own.dealt}, lost ${said(own.lost)}`
    }
    const first: Side = side ?? "A"
    return `Engagement ${index + 1}: ticks ${engagement.start}-${engagement.end} at ${engagement.at.x},${engagement.at.y} (${engagement.reach} wide): ${part(first)}; ${part(other(first))}.`
  })
}

/** A round's reading in the round's report: both sides in a few lines, and each engagement. */
export function roundReadingLines(reading: RoundReading): string[] {
  const lines: string[] = []
  for (const side of ["A", "B"] as const) {
    const own = reading.sides[side]
    const slot = side === "A" ? "p1" : "p2"
    const parts = [
      `army ${own.army.start.count} (${own.army.start.value}) -> ${own.army.end.count} (${own.army.end.value})`,
      `advance from its own Nexus ${own.advance.start ?? "-"}% -> ${own.advance.end ?? "-"}%`,
      ...(own.advance.closest === null ? [] : [`nearest enemy ${own.advance.closest} from its Nexus`]),
      ...(own.buildings.damaged.length === 0 ? [] : [`damaged ${own.buildings.damaged.map((building) => `${nameOf(building.contentId)} ${building.hp}/${building.most}`).join(", ")}`]),
      ...(Object.keys(own.buildings.lost).length === 0 ? [] : [`buildings lost ${namedCounts(own.buildings.lost)}`]),
      ...(own.damage.own === 0 ? [] : [`own blasts ${own.damage.own}`]),
    ]
    lines.push(`     ${slot}: ${parts.join("; ")}`)
  }
  for (const line of engagementLines(reading)) lines.push(`     ${line}`)
  return lines
}
