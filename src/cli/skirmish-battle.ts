// One battle of the `skirmish` command (`./skirmish.ts`, where the options are and what each does): opened from a save
// or set up new, its slots seated, played to the round asked for (`--play-to`), and stopped at a Build Phase, where each
// player's build actions for that round are checked, or its brief printed when it has none; then saved. The files and
// the printing are here; the steps themselves are the ones the game's screens take (`src/skirmish/request.ts` to open,
// `src/skirmish/play.ts` to play), so a battle played here and one played on the screen are the same battle.
//
// There are no turns: both slots make their build actions for a round from the same brief, blind, in any order. A
// slot's actions may be handed in on their own (saved as the save's draft) and the other's later; the round plays once
// a run is asked to play it. A save loaded and written back (`-f`) is held under a lock while the run reads and writes
// it, so two runs handing in actions at once never lose one.

import { appendFileSync, mkdirSync, readFileSync, renameSync, rmdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import type { ContentRegistry } from "../content/index.ts"
import type { BattleState } from "../battle/index.ts"
import { actionsFor, briefOf, checkBuildActions } from "../battle/index.ts"
import { titleOf } from "../battle/index.ts"
import type { DomainEvent } from "../events/types.ts"
import { spawnEvents } from "../pulse/index.ts"
import { asciiScreenshot, asciiScreenshotLines } from "../view/ascii-screenshot.ts"
import { createView, DEFAULT_PRESENTATION } from "../view/index.ts"
import { drawBattleMap } from "./battle-map.ts"
import { timelineOf } from "./timeline.ts"
import { hashEvents } from "../events/serialize.ts"
import type { LogLevel } from "../report/index.ts"
import { buildLog } from "../report/index.ts"
import type { Played, Ran, RoundWatch } from "../skirmish/play.ts"
import { actionsAt, isPlayer, playOn } from "../skirmish/play.ts"
import type { Profiles, SaveFile, SaveSetup, Slot } from "../skirmish/save.ts"
import { saveOf, saveText, SIDE_OF, SLOTS } from "../skirmish/save.ts"
import type { Opened, Seated } from "../skirmish/request.ts"
import { loadedBattle, newBattle, openSave } from "../skirmish/request.ts"
import { battleLine, historyLines, roundLines, slotLabel, standing } from "../skirmish/lines.ts"
import { hashState } from "../state/serialize.ts"
import type { MatchState } from "../state/types.ts"
import { playStrategies } from "./play-strategies.ts"
import type { SkirmishRequest } from "./skirmish.ts"
import { readGameFile } from "./skirmish-files.ts"
import { playSandbox } from "./skirmish-sandbox.ts"

/** How many rounds `--play-to end` plays at most, unless `--rounds` says otherwise. */
export const UNTIL_END_ROUNDS = 100

/** What a line is written to. */
export type Write = (line: string) => void

/** The save a request starts from: read from `--load`, or a new battle on `seed` (the request's own unless given). */
export function startingSave(request: SkirmishRequest, profiles: Profiles, seed?: number): SaveFile {
  if (request.load !== undefined) return loadedBattle(readFileSync(request.load, "utf8"), request.load, profiles)
  return newBattle({ ...request.battle, ...(seed === undefined ? {} : { seed }) }, profiles)
}

/** A save opened as the request asks (`openSave`, `src/skirmish/request.ts`): its slots seated, each build file's
 *  problems written, and its rules changed, `--play-to end` raising the round limit. */
export function openRequested(save: SaveFile, request: SkirmishRequest, profiles: Profiles, write: Write): Opened {
  const toEnd = request.playTo === "end" ? Math.max(save.setup.rounds, UNTIL_END_ROUNDS) : undefined
  const rounds = request.rules.rounds ?? toEnd
  const opened = openSave(save, { slots: request.slots, rules: { ...request.rules, ...(rounds === undefined ? {} : { rounds }) }, readFile: readGameFile, profiles, ...(request.load === undefined ? {} : { file: request.load }) })
  for (const problem of opened.seated.problems) write(problem)
  return opened
}

/** The round whose Build Phase a run stops at: the one it is at (nothing to play), the next, a round named, or never
 *  (play to the end). */
export function stopRound(playTo: SkirmishRequest["playTo"], state: BattleState): number {
  if (playTo === undefined) return state.round
  if (playTo === "next") return state.round + 1
  if (playTo === "end") return Number.POSITIVE_INFINITY
  if (playTo < state.round && state.result === null) throw new Error(`--play-to ${playTo}: the battle is already at round ${state.round}`)
  return playTo
}

/** A save written whole or not at all: to a file beside it first, then moved over it, so a reader never finds half. */
export function writeSave(path: string, save: SaveFile): void {
  mkdirSync(dirname(path) || ".", { recursive: true })
  const next = `${path}.writing`
  writeFileSync(next, saveText(save))
  renameSync(next, path)
}

/** Waits `ms` without spinning the processor. */
const pause = (ms: number): void => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/** Holds a save's lock (`<file>.lock`) while `work` reads and writes it. */
function locked<T>(file: string, work: () => T): T {
  const lock = `${file}.lock`
  for (let tries = 0; ; tries += 1) {
    try {
      mkdirSync(lock)
      break
    } catch {
      if (tries > 600) throw new Error(`${file} stayed locked for a minute: remove ${lock} if nothing is running`)
      pause(100)
    }
  }
  try {
    return work()
  } finally {
    rmdirSync(lock)
  }
}

/** Where each round played is kept, and how: its save and report in `out`, its Battle Round's log in `log`. */
export type Keep = Readonly<{ out?: string; log?: string; level: LogLevel; prefix?: string; quiet?: boolean; show?: readonly (number | "end")[]; effects?: boolean }>

/** Where the request keeps each round. */
export const keepOf = (request: SkirmishRequest, more: Partial<Keep> = {}): Keep => ({
  ...(request.out === undefined ? {} : { out: request.out }),
  ...(request.log === undefined ? {} : { log: request.log }),
  ...(request.show === undefined ? {} : { show: request.show }),
  ...(request.showEffects ? { effects: true } : {}),
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
 * **Rounds played** (`playOn`, the one loop every door plays by) until the battle reaches round `stop`'s Build Phase, or
 * ends, or a player slot has no build actions for the round about to play. Each round's report is written unless quiet,
 * and kept as `keep` asks.
 */
export function playRounds(setup: SaveSetup, start: BattleState, builds: Seated["builds"], stop: number, profiles: Profiles, keep: Keep, write: Write): Ran {
  if (keep.out !== undefined) mkdirSync(keep.out, { recursive: true })
  // `--show`: each Battle Round played, as an ASCII screenshot at the ticks asked for and as it ends, after its report.
  let states: MatchState[] = []
  let events: DomainEvent[] = []
  let drawn: ContentRegistry | null = null
  const watch: RoundWatch | undefined = keep.show === undefined ? undefined : (battle, happened, registry) => {
    states.push(battle)
    events.push(...happened)
    drawn ??= registry
  }
  return playOn(setup, start, builds, stop, profiles, ({ before, played }) => {
    const round = before.round
    const pictures = keep.show === undefined || drawn === null ? [] : roundScreenshots(states, events, drawn, setup.seed, keep.show, keep.effects === true)
    states = []
    events = []
    drawn = null
    const report = [...roundLines(played.report), ...pictures]
    if (keep.quiet !== true) for (const line of report) write(line)
    if (keep.log !== undefined) appendFileSync(keep.log, `${roundLog(played, setup, round, keep.level).join("\n")}\n`)
    if (keep.out !== undefined) {
      const name = `${keep.prefix ?? ""}round-${round}`
      writeFileSync(join(keep.out, `${name}.save.json`), saveText(saveOf(setup, played.state)))
      writeFileSync(join(keep.out, `${name}.txt`), `${[...report, standing(setup, played.state)].join("\n")}\n`)
    }
  }, watch)
}

/**
 * A Battle Round played, as ASCII screenshots (`asciiScreenshot`, `src/view/ascii-screenshot.ts`) at `ticks` and as it
 * ends (`end`): the round's states and events made into the view the screen plays (`createView`), sampled at each tick
 * — so each is what the screen draws there — with its ruler, legend and overlaps. Effects only when asked for.
 */
function roundScreenshots(states: readonly MatchState[], events: readonly DomainEvent[], registry: ContentRegistry, seed: number, ticks: readonly (number | "end")[], effects: boolean): string[] {
  const first = states[0]
  if (first === undefined) return []
  const timeline = timelineOf({ id: "skirmish", name: "Skirmish" }, states, [...spawnEvents(first, registry), ...events], states.length - 1, seed, registry)
  const view = createView(timeline, { ...DEFAULT_PRESENTATION, effects })
  const lastTick = states.length - 1
  const asked = [...new Set(ticks.map((tick) => (tick === "end" ? lastTick : tick)).filter((tick) => tick <= lastTick))].sort((a, b) => a - b)
  const past = ticks.filter((tick): tick is number => tick !== "end" && tick > lastTick)
  const note = past.length === 0 ? [] : [`--- not drawn: tick ${past.join(", ")} is past this round's end (tick ${lastTick})`]
  return [...note, ...asked.flatMap((tick) => {
    const sample = view.sampleAt(tick * view.tickDurationMs, "monochrome")
    const shot = asciiScreenshot(
      { grid: timeline.grid, registry, state: sample.state, positions: sample.positions, fire: sample.fire, ...(effects ? { effects: sample.effects, heldCorpses: sample.heldCorpses } : {}) },
      { side: (player) => (player === "A" ? "p1" : "p2"), content: titleOf },
    )
    return [`--- ASCII screenshot at tick ${tick}${tick === lastTick ? " (the round's end)" : ""}`, ...asciiScreenshotLines(shot), standingLine(sample.state, registry)]
  })]
}

/** What the picture cannot show: each side's Nexus health and how many units it has on the Grid at that tick. */
function standingLine(state: Pick<MatchState, "entities">, registry: ContentRegistry): string {
  const side = (player: "A" | "B", label: string): string => {
    const own = state.entities.filter((entity) => entity.player === player)
    const nexus = own.find((entity) => registry.get(entity.contentId).nexus === true)
    const units = own.filter((entity) => registry.get(entity.contentId).layer !== "obstacles").length
    return `${label} Nexus ${nexus === undefined ? "fallen" : `${nexus.hp}/${registry.get(nexus.contentId).maxHp}`}, ${units} unit${units === 1 ? "" : "s"}`
  }
  return `Standing: ${side("A", "p1")}; ${side("B", "p2")}.`
}

/** A slot's brief, as text with the play strategies (a player that reads words), or as data. */
export function writeBrief(setup: SaveSetup, state: BattleState, slot: Slot, json: boolean, write: Write): void {
  const brief = briefOf(state, SIDE_OF[slot], playStrategies(), drawBattleMap)
  if (json) return write(JSON.stringify({ slot, ...brief.data }))
  write(`--- brief for ${slotLabel(setup, slot)}`)
  write(brief.text)
}

/**
 * **At a Build Phase**: each player slot's build actions for the round checked by the Build Phase's rules (what it
 * keeps, builds and takes, each refusal and why), or, when it has none, its brief. A draft is checked and its brief
 * printed too. Returns whether the rules refused anything.
 */
function atBuildPhase(setup: SaveSetup, state: BattleState, seated: Seated, first: number, json: boolean, write: Write): boolean {
  let refused = false
  for (const slot of SLOTS.filter((each) => isPlayer(setup, each))) {
    const given = actionsFor(seated.builds[slot] ?? [], state.round, first)
    const fromFile = seated.fromFile.has(slot)
    if (given !== undefined && (fromFile || !json)) {
      const checked = checkBuildActions(state, SIDE_OF[slot], given)
      write(`${slotLabel(setup, slot)}: ${fromFile ? "build actions" : "the draft's build actions"} for round ${state.round} checked, nothing built`)
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

/**
 * **One battle**: opened, played to the round asked for, then, at the Build Phase it stops at, each player's build
 * actions checked or brief printed (for a battle over, every round's report). Saved when asked: build actions handed
 * in without a round played are kept as the save's draft. A sandbox plays its one Battle Round instead
 * (`./skirmish-sandbox.ts`). Returns whether the rules refused part of the build actions checked.
 */
export function playBattle(request: SkirmishRequest, profiles: Profiles, write: Write): Readonly<{ refused: boolean }> {
  const run = (): Readonly<{ refused: boolean }> => {
    const save = startingSave(request, profiles)
    if (save.start !== undefined) return playSandbox(save, request, write)
    const { setup, state, seated } = openRequested(save, request, profiles, write)
    write(`${battleLine(setup)}: ${standing(setup, state)}`)
    const first = state.round
    const stop = stopRound(request.playTo, state)
    if (state.result !== null && stop > state.round) throw new Error("the battle is over: there is no next round to play")
    const ran: Ran = stop > state.round ? playRounds(setup, state, seated.builds, stop, profiles, keepOf(request), write) : { state, played: 0, waiting: [] }
    const next = ran.state
    if (ran.played > 0) write(standing(setup, next))
    for (const slot of ran.waiting) write(`${slot} has no build actions for round ${next.round}: the battle waits at its Build Phase`)
    let refused = false
    if (next.result !== null) {
      if (ran.played === 0) for (const line of historyLines(setup, next).slice(0, -1)) write(line)
    } else if (!SLOTS.some((slot) => isPlayer(setup, slot))) {
      if (ran.played === 0) write(`no player plays a slot (${SLOTS.map((slot) => `${slot} ${setup.slots[slot].controller}`).join(", ")}): add --play-to next to play the round, or --play-to end`)
    } else {
      refused = atBuildPhase(setup, next, seated, first, request.json, write)
    }
    if (request.save !== undefined) {
      const draft = ran.played === 0 ? actionsAt(setup, seated.builds, first, first).actions : {}
      writeSave(request.save, saveOf(setup, next, { ...named(request, save), draft }))
      write(`saved ${request.save}${next.result === null ? ` at round ${next.round}'s Build Phase; on screen: ./bin/terminal-nexus.ts --load ${request.save}` : ", the battle over"}`)
    } else if (ran.played > 0) {
      write(`not saved: add --save <file>${request.load === undefined ? "" : ` (or -f ${request.load})`} to keep it`)
    }
    return { refused }
  }
  return request.load !== undefined && request.save === request.load ? locked(request.load, run) : run()
}

/** The save's name and notes: the request's, else the file's own. */
export function named(request: SkirmishRequest, save: SaveFile): Readonly<{ name?: string; notes?: string }> {
  const name = request.name ?? save.name
  const notes = request.notes ?? save.notes
  return { ...(name === undefined ? {} : { name }), ...(notes === undefined ? {} : { notes }) }
}
