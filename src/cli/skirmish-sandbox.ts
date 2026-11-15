// A sandbox played by the `skirmish` command (`./skirmish.ts`): a save with a `start`, a board written by hand
// (docs/system-design/skirmish-saves.md, "A board written by hand"). Its one Battle Round is the battle engine run from
// that board to its end or its ticks (`playSandboxRound`), as every Battle Round of a battle is; nothing is saved after
// it, since the file is the battle.

import { writeFileSync } from "node:fs"
import type { DomainEvent } from "../engine/events/types.ts"
import { buildLog } from "../report/index.ts"
import type { SaveFile } from "../skirmish/save.ts"
import { SLOTS } from "../skirmish/save.ts"
import { openingOf } from "../skirmish/start.ts"
import { playSandboxRound } from "../skirmish/sandbox-round.ts"
import type { MatchState } from "../engine/state/types.ts"
import { roundScreenshots } from "./skirmish-battle.ts"
import type { SkirmishRequest } from "./skirmish.ts"

/**
 * Without a round to play it says what the save is; with one, it plays the round and prints its levelled log and report
 * (`--log-level`, `warn` unless set), then each ASCII screenshot `--show` asks for. Returns `refused` when the log
 * reports an error.
 */
export function playSandbox(save: SaveFile, request: SkirmishRequest, write: (line: string) => void): Readonly<{ refused: boolean }> {
  for (const slot of SLOTS) if (request.slots[slot] !== undefined) throw new Error(`--${slot}: a sandbox's slots plan nothing, its units are in its start`)
  if (request.save !== undefined) throw new Error("--save: a sandbox plays the one Battle Round its start writes, with nothing to save after it")
  const opening = openingOf(save)
  write(`${opening.name} (${opening.id}), seed ${save.setup.seed}: a sandbox, its board written by hand, ${save.setup.roundTicks} ticks at most`)
  if (request.playTo === undefined) {
    write("add --play-to next to play it")
    return { refused: false }
  }
  const states: MatchState[] = []
  const events: DomainEvent[] = []
  const round = playSandboxRound(opening, request.show === undefined ? {} : { watch: (state, happened) => (states.push(state), events.push(...happened)) })
  const lines = buildLog(round.report, request.logLevel ?? "warn")
  if (request.log !== undefined) writeFileSync(request.log, `${lines.join("\n")}\n`)
  for (const line of lines) write(line)
  if (request.show !== undefined) for (const line of roundScreenshots(states, events, round.registry, opening.seed, request.show, request.showEffects)) write(line)
  return { refused: lines.some((line) => line.includes(" ERROR ")) }
}
