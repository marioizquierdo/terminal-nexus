// What a battle says, read in one place (docs/system-design/battles.md, "Reading a battle"): the score as it stands
// (who leads, and by which rule the battle would be judged if it ended now), and what one Battle Round said beyond its
// totals — where the fighting was between the two Nexuses, when it began, how near the enemy came, what hit each
// Nexus and what destroyed each building. The brief prints it for every player (a person, a script, a model), the
// round report carries it, and a script reads it to plan (`src/battle/players.ts`).
//
// Pure: a reading is a function of the battle's history, or of a round's states and events as the round plays them. It
// reads the record, never feeds the rules: nothing the kernel decides depends on it.

import { cardTextFor } from "../content/cards.ts"
import type { ContentRegistry } from "../content/index.ts"
import { baseContentId } from "../content/index.ts"
import type { DomainEvent } from "../events/types.ts"
import { gridDistance } from "../grid/coords.ts"
import type { Coord } from "../grid/types.ts"
import type { MatchState } from "../state/types.ts"
import type { RoundReport, Side } from "./types.ts"
import { SIDES } from "./types.ts"

// --- The score -----------------------------------------------------------------------------------------------------

/** The score after the rounds played: each side's damage dealt over the battle and its Nexus's share of health, and who
 *  leads by the rule a battle that ran out of rounds is judged by (`by`: "health", "damage", or "even"). */
export type Score = Readonly<{
  dealt: Readonly<Record<Side, number>>
  nexus: Readonly<Record<Side, number>>
  leader: Side | null
  by: "health" | "damage" | "even"
}>

const dealtIn = (report: RoundReport, side: Side): number => report.sides[side].dealt.units + report.sides[side].dealt.buildings + report.sides[side].dealt.nexus

/** **The score**, from every round so far: what decides a battle the rounds run out on — the healthier Nexus by share,
 *  then the damage dealt over the whole battle. Before any round, even. */
export function scoreOf(history: readonly RoundReport[]): Score {
  const last = history.at(-1)
  const share = (side: Side): number => {
    const nexus = last?.sides[side].nexus
    return nexus === undefined || nexus.most === 0 ? 1 : nexus.after / nexus.most
  }
  const dealt = { A: 0, B: 0 }
  for (const report of history) for (const side of SIDES) dealt[side] += dealtIn(report, side)
  const nexus = { A: share("A"), B: share("B") }
  if (nexus.A !== nexus.B) return { dealt, nexus, leader: nexus.A > nexus.B ? "A" : "B", by: "health" }
  if (dealt.A !== dealt.B) return { dealt, nexus, leader: dealt.A > dealt.B ? "A" : "B", by: "damage" }
  return { dealt, nexus, leader: null, by: "even" }
}

/** The score in a line, as `side` reads it: "you lead on damage, 14 812 to 12 090; both Nexuses whole". */
export function scoreLine(score: Score, side: Side): string {
  const enemy: Side = side === "A" ? "B" : "A"
  const percent = (share: number): string => `${Math.round(share * 100)}%`
  const who = score.leader === null ? "even" : score.leader === side ? "you lead" : "the enemy leads"
  const rule = score.by === "health" ? "on Nexus health" : score.by === "damage" ? "on damage" : "on both Nexus health and damage"
  const nexus = score.nexus[side] === 1 && score.nexus[enemy] === 1 ? "both Nexuses whole" : `your Nexus ${percent(score.nexus[side])}, theirs ${percent(score.nexus[enemy])}`
  return `${who === "even" ? "Even" : who.charAt(0).toUpperCase() + who.slice(1)} ${rule}: damage dealt ${score.dealt[side]} to ${score.dealt[enemy]}; ${nexus}. If the battle ended now it would be judged on Nexus health, then damage.`
}

// --- One Battle Round, read -------------------------------------------------------------------------------------------

/** What one side's Battle Round said beyond its totals. */
export type SideReading = Readonly<{
  /** Where the fighting was, on average, in whole percent of the way from this side's Nexus (0) to the enemy's (100): the
   *  front. A whole number, as everything a battle's state keeps. `null` when no unit was hurt. */
  front: number | null
  /** The nearest an enemy unit came to this side's Nexus, in tiles (a row counting two); `null` when none stood. */
  closest: number | null
  /** What hit this side's Nexus, damage by the content that dealt it (its own side's included: a blast hurts both). */
  nexusHits: Readonly<Record<string, number>>
  /** This side's buildings destroyed, counted by "what by what" (`building.citizen.barracks by unit.ravel.bomber`). */
  buildingsLost: Readonly<Record<string, number>>
  /** Damage this side's own blasts and splashes did to its own units, buildings and Nexus. */
  ownDamage: number
}>

/** A Battle Round, read: the tick units first hurt each other (`null`: never), and each side's reading. */
export type RoundReading = Readonly<{ contact: number | null; sides: Readonly<Record<Side, SideReading>> }>

/** A reader a round is played through: shown each state and its events (`step`), it gives the reading at the end. */
export type RoundReader = Readonly<{ step: (state: MatchState, events: readonly DomainEvent[]) => void; reading: () => RoundReading }>

/** **A round's reader**, from the round's opening and each side's content. */
export function roundReader(start: MatchState, sides: Readonly<Record<Side, ContentRegistry>>): RoundReader {
  const contentOf = new Map(start.entities.map((entity) => [entity.id, entity.contentId] as const))
  const ownerOf = new Map(start.entities.map((entity) => [entity.id, entity.player as Side] as const))
  const definition = (id: string) => {
    const player = ownerOf.get(id)
    const contentId = contentOf.get(id)
    return player === undefined || contentId === undefined ? undefined : sides[player].get(contentId)
  }
  const nexusAt: Partial<Record<Side, Coord>> = {}
  for (const entity of start.entities) if (definition(entity.id)?.nexus === true) nexusAt[entity.player as Side] = entity.anchor
  const along = (at: Coord): number | null => {
    const a = nexusAt.A
    const b = nexusAt.B
    if (a === undefined || b === undefined) return null
    const dx = b.x - a.x
    const dy = b.y - a.y
    const length = dx * dx + dy * dy
    return length === 0 ? null : Math.min(1, Math.max(0, ((at.x - a.x) * dx + (at.y - a.y) * dy) / length))
  }
  let contact: number | null = null
  const fronts: number[] = []
  const closest: Record<Side, number | null> = { A: null, B: null }
  const nexusHits: Record<Side, Record<string, number>> = { A: {}, B: {} }
  const buildingsLost: Record<Side, Record<string, number>> = { A: {}, B: {} }
  const ownDamage: Record<Side, number> = { A: 0, B: 0 }
  const isUnit = (id: string): boolean => definition(id)?.layer !== undefined && definition(id)?.layer !== "obstacles"
  return {
    step(state, events) {
      const position = new Map(state.entities.map((entity) => [entity.id, entity.anchor] as const))
      for (const event of events) {
        if (event.kind === "entity.spawned") {
          contentOf.set(event.entity, event.contentId)
          ownerOf.set(event.entity, event.player as Side)
        }
        if (event.kind === "damage.applied") {
          const victim = ownerOf.get(event.entity)
          const attacker = ownerOf.get(event.source)
          if (victim === undefined) continue
          if (attacker === victim) ownDamage[victim] += event.amount
          if (definition(event.entity)?.nexus === true) {
            const by = contentOf.get(event.source) ?? event.source
            nexusHits[victim][by] = (nexusHits[victim][by] ?? 0) + event.amount
          }
          if (attacker !== undefined && attacker !== victim && isUnit(event.entity) && isUnit(event.source)) {
            contact ??= state.tick
            const at = position.get(event.entity)
            const share = at === undefined ? null : along(at)
            if (share !== null) fronts.push(share)
          }
        }
        if (event.kind === "structure.destroyed" && definition(event.entity)?.nexus !== true) {
          const by = event.killer === null ? "nothing" : (contentOf.get(event.killer) ?? event.killer)
          const key = `${event.contentId} by ${by}`
          const side = event.player as Side
          buildingsLost[side][key] = (buildingsLost[side][key] ?? 0) + 1
        }
      }
      for (const side of SIDES) {
        const nexus = nexusAt[side]
        if (nexus === undefined) continue
        for (const entity of state.entities) {
          if (entity.player === side || !isUnit(entity.id)) continue
          const distance = gridDistance(entity.anchor, nexus)
          if (closest[side] === null || distance < (closest[side] as number)) closest[side] = distance
        }
      }
    },
    reading() {
      const front = fronts.length === 0 ? null : fronts.reduce((sum, share) => sum + share, 0) / fronts.length
      const percent = front === null ? null : Math.round(front * 100)
      const sideReading = (side: Side): SideReading => ({
        front: percent === null ? null : side === "A" ? percent : 100 - percent,
        closest: closest[side],
        nexusHits: nexusHits[side],
        buildingsLost: buildingsLost[side],
        ownDamage: ownDamage[side],
      })
      return { contact, sides: { A: sideReading("A"), B: sideReading("B") } }
    },
  }
}

/** A content id as a person reads it: its card's title (`unit.ravel.bomber` → Bomber). */
export const nameOf = (contentId: string): string => cardTextFor(contentId)?.title ?? baseContentId(contentId).slice(baseContentId(contentId).lastIndexOf(".") + 1)

/** A reading's counts by content (`unit.ravel.bomber`, or `a by b`) as a person reads them: "2 Barracks by Bomber". */
export const namedCounts = (record: Readonly<Record<string, number>>): string =>
  Object.entries(record)
    .sort((a, b) => b[1] - a[1])
    .map(([what, count]) => `${count} ${what.split(" by ").map(nameOf).join(" by ")}`)
    .join(", ")

/** A round's reading as `side` reads it, a few lines: where the fighting was, how near the enemy came, what hit its
 *  Nexus, what destroyed its buildings, and what its own blasts cost it. */
export function readingLines(reading: RoundReading, side: Side): string[] {
  const mine = reading.sides[side]
  const lines: string[] = []
  const where = mine.front === null
    ? "no unit hurt another"
    : `the fighting was ${mine.front}% of the way from your Nexus to theirs${mine.front < 35 ? " (in your half: they pressed you)" : mine.front > 65 ? " (in their half: you pressed them)" : " (about the middle)"}`
  lines.push(`Front: ${where}${reading.contact === null ? "" : `; first contact at tick ${reading.contact}`}${mine.closest === null ? "" : `; the nearest an enemy came to your Nexus was ${mine.closest} tile${mine.closest === 1 ? "" : "s"}`}.`)
  const hits = Object.entries(mine.nexusHits).sort((a, b) => b[1] - a[1])
  if (hits.length > 0) lines.push(`Your Nexus was hit by: ${hits.map(([by, amount]) => `${nameOf(by)} ${amount}`).join(", ")}.`)
  if (Object.keys(mine.buildingsLost).length > 0) lines.push(`Your buildings destroyed: ${namedCounts(mine.buildingsLost)}.`)
  if (mine.ownDamage > 0) lines.push(`Your own blasts and splashes hurt your side for ${mine.ownDamage}.`)
  return lines
}
