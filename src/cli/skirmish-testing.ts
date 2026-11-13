// A testing save played by the `skirmish` command (`./skirmish.ts`): a save with a `start`, whose one Battle Round is
// written by hand (`skirmish-testing/`, docs/system-design/testing-ground.md). It is opened by the kernel from that
// start, exactly as `grid` opens it, not by the duel, and played to its end or its ticks; nothing is saved after it,
// since the file is the battle.

import { writeFileSync } from "node:fs"
import { FIXTURE_REGISTRY } from "../content/index.ts"
import { resolvePulse } from "../pulse/index.ts"
import { buildLog } from "../report/index.ts"
import { openBattle } from "../skirmish/opening/open.ts"
import type { SaveFile } from "../skirmish/save.ts"
import { SLOTS } from "../skirmish/save.ts"
import { openingOf } from "../skirmish/start.ts"
import type { SkirmishRequest } from "./skirmish.ts"

/**
 * Without a round to play it says what the save is; with one, it plays the round and prints its report as
 * `grid --headless` does (`--log-level`, `warn` unless set). Returns `refused` when the log reports an error.
 */
export function playTestingSave(save: SaveFile, request: SkirmishRequest, write: (line: string) => void): Readonly<{ refused: boolean }> {
  for (const slot of SLOTS) if (request.slots[slot] !== undefined) throw new Error(`--${slot}: a testing save's slots plan nothing, its units are in its start`)
  if (request.save !== undefined) throw new Error("--save: a testing save plays the one Battle Round its start writes, with nothing to save after it")
  const opening = openingOf(save)
  write(`${opening.name} (${opening.id}), seed ${save.setup.seed}: a testing save, its Battle Round written by hand, ${save.setup.roundTicks} ticks at most`)
  if (request.playTo === undefined) {
    write("add --play-to next to play it")
    return { refused: false }
  }
  const loaded = openBattle(opening, { registry: FIXTURE_REGISTRY })
  const run = resolvePulse({ initialState: loaded.state, registry: loaded.registry, pulseTicks: opening.pulseTicks, seed: opening.seed })
  const lines = buildLog(
    {
      battleId: opening.id,
      seed: opening.seed,
      pulseTicks: opening.pulseTicks,
      registry: loaded.registry,
      events: run.events,
      finalState: run.finalState,
      stateHash: run.stateHash,
      eventsHash: run.eventsHash,
    },
    request.logLevel ?? "warn",
  )
  if (request.log !== undefined) writeFileSync(request.log, `${lines.join("\n")}\n`)
  for (const line of lines) write(line)
  write(`tick by tick: grid ${opening.id} --headless --log-level info`)
  return { refused: lines.some((line) => line.includes(" ERROR ")) }
}
