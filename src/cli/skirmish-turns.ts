// Two sessions playing one save, a slot each, for the `skirmish` command (`./skirmish.ts`): the way two language-model
// agents play each other. Each waits for its slot's turn (`--wait`), reads the brief, and hands in its plan
// (`--ready`); the plan handed in last plays the round. Through the save file alone: a slot's plan waits in the save's
// draft, and the drafts are cleared when the round plays, which is what tells a waiting slot its next turn is open. A
// lock beside the file keeps two plans handed in at once from playing a round twice, and every save is written whole
// before it replaces the old one, so a waiting reader never reads half a file.

import { mkdirSync, readFileSync, rmdirSync } from "node:fs"
import type { Profiles, Slot } from "../skirmish/save.ts"
import { duelOf, saveOf, SLOTS } from "../skirmish/save.ts"
import { isPlayer } from "../skirmish/play.ts"
import { loadedBattle } from "../skirmish/request.ts"
import { historyLines, standing } from "../skirmish/lines.ts"
import type { SkirmishRequest } from "./skirmish.ts"
import type { Write } from "./skirmish-battle.ts"
import { keepOf, named, openSave, playRounds, writeBrief, writeSave } from "./skirmish-battle.ts"

/** Waits `ms` without spinning the processor. */
const pause = (ms: number): void => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/** Holds the save's lock (`<file>.lock`) while `work` runs. */
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

/** The file both sessions read and write: `-f`, or `--load` and `--save` naming the same one. */
function sharedFile(request: SkirmishRequest): string {
  if (request.load === undefined || (request.save !== undefined && request.save !== request.load)) throw new Error("two sessions share one save: give it with -f <file>")
  return request.load
}

/**
 * **A plan handed in** (`--ready`): under the lock, the save read afresh, the plans given laid in its draft, and, once
 * every player's slot has one, the round played and the next Build Phase saved with the drafts cleared.
 */
export function handIn(request: SkirmishRequest, profiles: Profiles, write: Write): void {
  const file = sharedFile(request)
  locked(file, () => {
    const save = loadedBattle(readFileSync(file, "utf8"), file, profiles)
    const { setup, state, seated } = openSave(save, request, profiles, write)
    if (state.result !== null) {
      write(`the battle is over: ${standing(setup, state)}`)
      return
    }
    const waiting = SLOTS.filter((slot) => isPlayer(setup, slot) && seated.plans[slot] === undefined)
    if (waiting.length > 0) {
      writeSave(file, saveOf(setup, state, { ...named(request, save), draft: seated.plans }))
      const mine = SLOTS.find((slot) => seated.fromFile.has(slot))
      write(`plan for round ${state.round} kept; waiting for ${waiting.join(" and ")}.${mine === undefined ? "" : ` Run: skirmish -f ${file} --wait ${mine}`}`)
      return
    }
    const next = playRounds(setup, state, seated.plans, 1, profiles, keepOf(request), write)
    writeSave(file, saveOf(setup, next, { ...named(request, save), draft: {} }))
    write(next.result === null ? `round ${next.round} is open. Run: skirmish -f ${file} --wait <slot>` : `THE BATTLE IS OVER: ${standing(setup, next)}`)
  })
}

/**
 * **A slot's turn waited for** (`--wait <slot>`): blocks until the slot has a plan to make, then prints its brief; or
 * until the battle is over, then prints every round's report. Returns `false` when `timeout` seconds pass first.
 */
export function waitTurn(request: SkirmishRequest, slot: Slot, timeout: number, profiles: Profiles, write: Write): boolean {
  const file = sharedFile(request)
  const until = Date.now() + timeout * 1000
  for (;;) {
    const save = loadedBattle(readFileSync(file, "utf8"), file, profiles)
    const state = duelOf(save, profiles)
    if (state.result !== null) {
      write(`THE BATTLE IS OVER: ${standing(save.setup, state)}`)
      for (const line of historyLines(save.setup, state).slice(0, -1)) write(line)
      return true
    }
    if (!isPlayer(save.setup, slot)) throw new Error(`${slot} is ${save.setup.slots[slot].controller}: no session plans it`)
    if (save.draft?.[slot] === undefined) {
      writeBrief(save.setup, state, slot, request.json, write)
      write(`hand in the plan with: skirmish -f ${file} --${slot} build:<plan file> --ready`)
      return true
    }
    if (Date.now() > until) {
      write(`still waiting for the other slot's plan for round ${state.round}: run --wait again`)
      return false
    }
    pause(1000)
  }
}
