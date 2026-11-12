// One battle of the `skirmish` command (`./skirmish.ts`, where the options are and what each does): opened from a save
// or set up new, its slots seated, then either each player's plan checked or brief printed, or rounds played, each
// kept as asked; and the save written. The files and the printing are here; the steps themselves are the ones the
// game's screens take (`src/skirmish/request.ts` to open, `src/skirmish/play.ts` to play), so a battle played here and
// one played on the screen are the same battle.

import { appendFileSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import type { DuelState, SidePlan } from "../duel/index.ts"
import { briefOf, checkPlan } from "../duel/index.ts"
import { hashEvents } from "../events/serialize.ts"
import type { LogLevel } from "../report/index.ts"
import { buildLog } from "../report/index.ts"
import type { Played } from "../skirmish/play.ts"
import { isPlayer, playNext } from "../skirmish/play.ts"
import type { Profiles, SaveFile, SaveSetup, Slot } from "../skirmish/save.ts"
import { duelOf, saveOf, saveText, SIDE_OF, SLOTS } from "../skirmish/save.ts"
import type { Seated } from "../skirmish/request.ts"
import { loadedBattle, newBattle, seat, withRules } from "../skirmish/request.ts"
import { battleLine, historyLines, roundLines, slotLabel, standing } from "../skirmish/lines.ts"
import { hashState } from "../state/serialize.ts"
import { playStrategies } from "./play-strategies.ts"
import type { SkirmishRequest } from "./skirmish.ts"
import { readGameFile } from "./skirmish-files.ts"
import { playTestingSave } from "./skirmish-testing.ts"

/** How many rounds `--play-until-win` plays at most, unless `--rounds` says otherwise. */
export const UNTIL_WIN_ROUNDS = 100

/** What a line is written to. */
export type Write = (line: string) => void

/** A battle opened: the save it came from, its setup with the slots seated and the rules changed, the duel as it
 *  stands, and the plans the player slots bring. */
export type Opened = Readonly<{ save: SaveFile; setup: SaveSetup; state: DuelState; seated: Seated }>

/** The save a request starts from: read from `--load`, or a new battle on `seed` (the request's own unless given). */
export function startingSave(request: SkirmishRequest, profiles: Profiles, seed?: number): SaveFile {
  if (request.load !== undefined) return loadedBattle(readFileSync(request.load, "utf8"), request.load, profiles)
  return newBattle({ ...request.battle, ...(seed === undefined ? {} : { seed }) }, profiles)
}

/** A save opened as the request asks: its slots seated (each plan file's problems written) and its rules changed. */
export function openSave(save: SaveFile, request: SkirmishRequest, profiles: Profiles, write: Write): Opened {
  const seated = seat(save, request.slots, readGameFile)
  for (const problem of seated.problems) write(problem)
  const before = duelOf({ ...save, setup: seated.setup }, profiles)
  const untilWin = request.rounds === Number.POSITIVE_INFINITY ? Math.max(save.setup.rounds, UNTIL_WIN_ROUNDS) : undefined
  const rounds = request.rules.rounds ?? untilWin
  const setup = withRules(seated.setup, before.result === null ? before.round : 1, { ...request.rules, ...(rounds === undefined ? {} : { rounds }) })
  return { save, setup, state: duelOf({ ...save, setup }, profiles), seated }
}

/** A save written whole or not at all: to a file beside it first, then moved over it, so a reader never finds half. */
export function writeSave(path: string, save: SaveFile): void {
  mkdirSync(dirname(path) || ".", { recursive: true })
  const next = `${path}.writing`
  writeFileSync(next, saveText(save))
  renameSync(next, path)
}

/** Where each round played is kept, and how: its save and report in `out`, its Battle Round's log in `log`. */
export type Keep = Readonly<{ out?: string; log?: string; level: LogLevel; prefix?: string; quiet?: boolean }>

/** Where the request keeps each round. */
export const keepOf = (request: SkirmishRequest, more: Partial<Keep> = {}): Keep => ({
  ...(request.out === undefined ? {} : { out: request.out }),
  ...(request.log === undefined ? {} : { log: request.log }),
  level: request.logLevel ?? "info",
  ...more,
})

/** The battle's log for a round played, as `grid` writes one (`buildLog`). */
function roundLog(played: Played, setup: SaveSetup, round: number, level: LogLevel): string[] {
  if (played.final === null || played.registry === null) return []
  const lines = buildLog(
    {
      battleId: `skirmish round ${round}`,
      seed: setup.seed,
      pulseTicks: played.state.setup.pulseTicks,
      registry: played.registry,
      events: played.events,
      finalState: played.final,
      stateHash: hashState(played.final),
      eventsHash: hashEvents(played.events),
    },
    level,
  )
  return [`--- seed ${setup.seed}`, `=== round ${round}: ${played.events.length} events`, ...lines]
}

/**
 * Plays up to `count` rounds (the plans given play in the first; every later round needs scripts), writing each
 * round's report unless quiet, and keeping it as `keep` asks. Returns the duel after them.
 */
export function playRounds(setup: SaveSetup, start: DuelState, plans: Readonly<Partial<Record<Slot, SidePlan>>>, count: number, profiles: Profiles, keep: Keep, write: Write): DuelState {
  if (keep.out !== undefined) mkdirSync(keep.out, { recursive: true })
  let state = start
  for (let played = 0; played < count && state.result === null; played += 1) {
    const round = state.round
    const result = playNext(setup, state, played === 0 ? plans : {}, profiles)
    state = result.state
    const report = roundLines(result.report)
    if (keep.quiet !== true) for (const line of report) write(line)
    if (keep.log !== undefined) appendFileSync(keep.log, `${roundLog(result, setup, round, keep.level).join("\n")}\n`)
    if (keep.out !== undefined) {
      const name = `${keep.prefix ?? ""}round-${round}`
      writeFileSync(join(keep.out, `${name}.save.json`), saveText(saveOf(setup, state)))
      writeFileSync(join(keep.out, `${name}.txt`), `${[...report, standing(setup, state)].join("\n")}\n`)
    }
  }
  return state
}

/** Refuses many rounds while a person plans a slot: a plan plays one round. */
export function scriptsOnly(setup: SaveSetup, count: number): void {
  if (count <= 1) return
  const player = SLOTS.find((slot) => isPlayer(setup, slot))
  if (player !== undefined) throw new Error(`${player} is a player: a plan plays one round; give every slot a script to play ${count === Number.POSITIVE_INFINITY ? "until the battle ends" : `${count} rounds`}`)
}

/**
 * Each player's slot without a round to play: its plan checked by the Build Phase's rules (what it keeps, builds and
 * takes, each refusal and why), or its brief. Returns whether the rules refused anything.
 */
function planLines(opened: Opened, json: boolean, write: Write): boolean {
  const { setup, state, seated } = opened
  let refused = false
  for (const slot of SLOTS.filter((each) => isPlayer(setup, each))) {
    const side = SIDE_OF[slot]
    const given = seated.plans[slot]
    const fromFile = seated.fromFile.has(slot)
    if (given !== undefined && (fromFile || !json)) {
      const checked = checkPlan(state, side, given)
      write(`${slotLabel(setup, slot)}: ${fromFile ? "the plan" : "the draft"} checked, nothing built`)
      write(`  keeps ${checked.kept ?? "no card"}; ${checked.credits} credits, spends ${checked.spent}, leaves ${checked.credits - checked.spent}`)
      for (const line of checked.built) write(`  builds ${line}`)
      for (const line of checked.actions) write(`  takes ${line}`)
      for (const line of checked.refused) write(`  REFUSED ${line}`)
      refused ||= checked.refused.length > 0
      if (fromFile) continue
    }
    writeBrief(setup, state, slot, json, write)
  }
  return refused
}

/** A slot's brief, as text with the play strategies (a player that reads words), or as data. */
export function writeBrief(setup: SaveSetup, state: DuelState, slot: Slot, json: boolean, write: Write): void {
  const brief = briefOf(state, SIDE_OF[slot], playStrategies())
  write(`--- brief for ${slotLabel(setup, slot)}`)
  write(json ? JSON.stringify(brief.data, null, 1) : brief.text)
}

/**
 * **One battle**: opened, then with rounds to play, played (and the drafts cleared); without, each player's plan
 * checked or brief printed, or, for a battle over, every round's report. Saved when asked. A testing save plays its
 * one Battle Round instead (`./skirmish-testing.ts`). Returns whether the rules refused part of a plan checked.
 */
export function playBattle(request: SkirmishRequest, profiles: Profiles, write: Write): Readonly<{ refused: boolean }> {
  const save = startingSave(request, profiles)
  if (save.start !== undefined) return playTestingSave(save, request, write)
  const opened = openSave(save, request, profiles, write)
  const { setup, state, seated } = opened
  write(`${battleLine(setup)}: ${standing(setup, state)}`)
  let next = state
  let draft: Partial<Record<Slot, SidePlan>> = { ...seated.plans }
  let refused = false
  if (request.rounds > 0) {
    if (state.result !== null) throw new Error("the battle is over: there is no next round to play")
    scriptsOnly(setup, request.rounds)
    for (const slot of SLOTS) if (isPlayer(setup, slot) && seated.plans[slot] === undefined) write(`${slot} has no plan: it builds nothing and attacks`)
    next = playRounds(setup, state, seated.plans, request.rounds, profiles, keepOf(request), write)
    draft = {}
    write(standing(setup, next))
  } else if (state.result !== null) {
    for (const line of historyLines(setup, state).slice(0, -1)) write(line)
  } else if (!SLOTS.some((slot) => isPlayer(setup, slot))) {
    write(`no player plans a slot (${SLOTS.map((slot) => `${slot} ${setup.slots[slot].controller}`).join(", ")}): add --battle to play the round, or --play-until-win`)
  } else {
    refused = planLines(opened, request.json, write)
  }
  if (request.save !== undefined) {
    writeSave(request.save, saveOf(setup, next, { ...named(request, save), draft }))
    write(`saved ${request.save}${next.result === null ? ` at round ${next.round}'s Build Phase` : ", the battle over"}`)
  } else if (request.rounds > 0) {
    write(`not saved: add --save <file>${request.load === undefined ? "" : ` (or -f ${request.load})`} to keep it`)
  }
  return { refused }
}

/** The save's name and notes: the request's, else the file's own. */
export function named(request: SkirmishRequest, save: SaveFile): Readonly<{ name?: string; notes?: string }> {
  const name = request.name ?? save.name
  const notes = request.notes ?? save.notes
  return { ...(name === undefined ? {} : { name }), ...(notes === undefined ? {} : { notes }) }
}
