// A Skirmish's record in plain lines, for whoever reads it as text: a round's report, how the battle stands, and the
// tally of many battles. The `skirmish` command prints them and writes them beside each round it keeps
// (`src/cli/skirmish.ts`); the screen says the same things in its own words (`./words.ts`). Pure.

import type { DuelState, RoundReport } from "../duel/index.ts"
import { SIDES } from "../duel/index.ts"
import { namedCounts } from "../duel/reading.ts"
import type { SaveSetup, Slot } from "./save.ts"
import { SLOT_OF } from "./save.ts"
import { mapNameOf } from "./words.ts"

/** A slot for a person: `p1 (west, vasse, player)`. */
export const slotLabel = (setup: SaveSetup, slot: Slot): string => `${slot} (${slot === "p1" ? "west" : "east"}, ${setup.slots[slot].commander ?? "no Commander"}, ${setup.slots[slot].controller})`

/** The battle in a line: who against whom, where, on which seed, under which modifiers. */
export const battleLine = (setup: SaveSetup): string =>
  `${setup.slots.p1.commander} (p1) against ${setup.slots.p2.commander} (p2) on ${mapNameOf(setup.map)}, seed ${setup.seed}${setup.modifiers.length === 0 ? "" : `, ${setup.modifiers.join(", ")}`}`

/** The slot that won, or `null` for a draw or a battle not over. */
export const winnerOf = (state: DuelState): Slot | null => (state.result === null || state.result.winner === null ? null : SLOT_OF[state.result.winner])

/** How the battle stands, in a line. */
export function standing(setup: SaveSetup, state: DuelState): string {
  if (state.result === null) return `round ${state.round} of ${setup.rounds}, at its Build Phase`
  const winner = winnerOf(state)
  return winner === null ? `over: a draw after round ${state.result.round}` : `over: ${slotLabel(setup, winner)} won by ${state.result.by} in round ${state.result.round}`
}

/** One round's report in a few lines a slot: what each side had, kept, built, fielded, lost and dealt. */
export function roundLines(report: RoundReport): string[] {
  const lines = [`round ${report.round}: ended ${report.ended === "nexus" ? "when a Nexus fell" : "on time"} at tick ${report.ticks}`]
  const counts = (record: Readonly<Record<string, number>>): string => Object.entries(record).map(([name, count]) => `${count} ${name}`).join(", ") || "none"
  for (const side of SIDES) {
    const own = report.sides[side]
    lines.push(
      `  ${SLOT_OF[side]} ${own.commander}: ${own.credits} credits, spent ${own.spent}${own.earned > 0 ? `, earned ${own.earned}` : ""}; kept ${own.kept ?? "nothing"}; built ${own.built.length}${own.formation === undefined ? "" : ` (${own.formation})`}${own.actions === undefined ? "" : `; ${own.actions.join(", ")}`}${own.refused.length > 0 ? `, refused ${own.refused.length}` : ""}; ${own.stance}`,
      `     fielded ${counts(own.fielded)}; trained ${counts(own.trained)}; lost ${counts(own.lost)}`,
      `     dealt ${own.dealt.units}/${own.dealt.buildings}/${own.dealt.nexus} (units/buildings/Nexus); Nexus ${own.nexus.after}/${own.nexus.most}${own.commanderFell ? "; Commander fell" : ""}${Object.keys(own.abilities).length > 0 ? `; ${counts(own.abilities)}` : ""}`,
    )
    const read = report.reading?.sides[side]
    if (read !== undefined) {
      const parts = [
        read.front === null ? "no fighting" : `front ${read.front}% toward the enemy`,
        ...(read.closest === null ? [] : [`nearest enemy ${read.closest} from its Nexus`]),
        ...(Object.keys(read.nexusHits).length === 0 ? [] : [`Nexus hit by ${namedCounts(read.nexusHits)}`]),
        ...(Object.keys(read.buildingsLost).length === 0 ? [] : [`buildings lost ${namedCounts(read.buildingsLost)}`]),
        ...(read.ownDamage === 0 ? [] : [`own blasts ${read.ownDamage}`]),
      ]
      lines.push(`     ${parts.join("; ")}`)
    }
  }
  if (report.reading !== undefined) lines[0] += report.reading.contact === null ? "; no contact" : `; first contact at tick ${report.reading.contact}`
  return lines
}

/** Every round played so far, then how the battle stands. */
export const historyLines = (setup: SaveSetup, state: DuelState): string[] => [...state.history.flatMap(roundLines), standing(setup, state)]

/** How many battles each slot won, how many were drawn or left unfinished, and how they ended. */
export type Tally = { p1: number; p2: number; draw: number; unfinished: number; byNexus: number; rounds: number; battles: number }

export const emptyTally = (): Tally => ({ p1: 0, p2: 0, draw: 0, unfinished: 0, byNexus: 0, rounds: 0, battles: 0 })

/** The tally with one more battle counted, as it stands after `state`. */
export function counted(tally: Tally, state: DuelState): Tally {
  const key = state.result === null ? "unfinished" : (winnerOf(state) ?? "draw")
  return { ...tally, [key]: tally[key] + 1, byNexus: tally.byNexus + (state.result?.by === "nexus" ? 1 : 0), rounds: tally.rounds + state.round - 1, battles: tally.battles + 1 }
}

/** A tally in a line: `p1 won 4, p2 won 2, 0 drawn; 3 by a Nexus falling; 6.5 rounds on average`. */
export const tallyLine = (tally: Tally, p1 = "p1", p2 = "p2"): string =>
  `${p1} won ${tally.p1}, ${p2} won ${tally.p2}, ${tally.draw} drawn${tally.unfinished === 0 ? "" : `, ${tally.unfinished} unfinished`}; ${tally.byNexus} by a Nexus falling; ${(tally.rounds / Math.max(1, tally.battles)).toFixed(1)} rounds on average`
