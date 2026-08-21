// The run summary — milestone-1-spike-battle.md 3.3. Log to stderr, summary to stdout, so that
// `grid run x.ts > report.txt 2> run.log` splits them and a bare run interleaves both.

import { shortHash } from "../state/canonical.ts"
import type { PlayerId, VictoryReason } from "../state/types.ts"
import { PLAYERS } from "../state/types.ts"
import type { ReportInput } from "./log.ts"

/** Hash digits shown in the human summary. `--json` carries the full digest. */
const SUMMARY_HASH_DIGITS = 16

export type RunSummary = Readonly<{
  scenario: string
  seed: number
  ticks: number
  pulseTicks: number
  endedEarly: boolean
  outcome: Readonly<{ winner: PlayerId | null; reason: VictoryReason }> | null
  losses: Readonly<Record<PlayerId, { lost: number; started: number }>>
  stateHash: string
  eventsHash: string
}>

export function summarize(input: ReportInput): RunSummary {
  const started: Record<PlayerId, number> = { A: 0, B: 0 }
  const lost: Record<PlayerId, number> = { A: 0, B: 0 }
  let ended: { winner: PlayerId | null; reason: VictoryReason } | null = null

  for (const event of input.events) {
    if (event.kind === "entity.spawned") started[event.player] += 1
    if (event.kind === "entity.died" || event.kind === "structure.destroyed") {
      lost[event.player] += 1
    }
    if (event.kind === "pulse.ended") ended = { winner: event.winner, reason: event.reason }
  }

  return {
    scenario: input.scenarioId,
    seed: input.seed,
    ticks: input.finalState.tick,
    pulseTicks: input.pulseTicks,
    endedEarly: input.finalState.tick < input.pulseTicks,
    outcome: ended,
    losses: {
      A: { lost: lost.A, started: started.A },
      B: { lost: lost.B, started: started.B },
    },
    stateHash: input.stateHash,
    eventsHash: input.eventsHash,
  }
}

function label(text: string): string {
  return `${text.padEnd(10, " ")} `
}

function hexSeed(seed: number): string {
  return `0x${(seed >>> 0).toString(16).toUpperCase().padStart(8, "0")}`
}

export function formatSummary(summary: RunSummary): string {
  const outcomeText =
    summary.outcome === null
      ? "unresolved"
      : summary.outcome.winner === null
        ? `draw (${summary.outcome.reason})`
        : `${summary.outcome.winner} wins`

  const ticksText = summary.endedEarly
    ? `${summary.ticks} of ${summary.pulseTicks} (ended early: ${summary.outcome?.reason ?? "unknown"})`
    : `${summary.ticks} of ${summary.pulseTicks} (full pulse)`

  const lossesText = PLAYERS.map(
    (player) => `${player}: ${summary.losses[player].lost} of ${summary.losses[player].started}`,
  ).join("    ")

  return [
    `${label("scenario")}${summary.scenario}`,
    `${label("seed")}${hexSeed(summary.seed)}`,
    `${label("ticks")}${ticksText}`,
    `${label("outcome")}${outcomeText}`,
    `${label("losses")}${lossesText}`,
    `${label("state")}${shortHash(summary.stateHash, SUMMARY_HASH_DIGITS)}    ` +
      `events  ${shortHash(summary.eventsHash, SUMMARY_HASH_DIGITS)}`,
  ].join("\n")
}

export function summaryJson(summary: RunSummary, extra: Readonly<Record<string, unknown>>): string {
  return JSON.stringify({ ...summary, ...extra }, null, 2)
}
