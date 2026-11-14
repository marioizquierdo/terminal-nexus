// A sandbox played by the `skirmish` command (`./skirmish.ts`): a save with a `start`, whose one Battle Round is
// written by hand (`sandboxes/`, docs/system-design/sandboxes.md). Played by `playSandboxRound`, the path
// `grid` and a measurement play it by too, to its end or its ticks; nothing is saved after it, since the file is the
// battle.

import { writeFileSync } from "node:fs"
import { buildLog } from "../report/index.ts"
import type { SaveFile } from "../skirmish/save.ts"
import { SLOTS } from "../skirmish/save.ts"
import { openingOf } from "../skirmish/start.ts"
import { playSandboxRound } from "../skirmish/sandbox-round.ts"
import type { SkirmishRequest } from "./skirmish.ts"

/**
 * Without a round to play it says what the save is; with one, it plays the round and prints its report as
 * `grid --headless` does (`--log-level`, `warn` unless set). Returns `refused` when the log reports an error.
 */
export function playSandbox(save: SaveFile, request: SkirmishRequest, write: (line: string) => void): Readonly<{ refused: boolean }> {
  for (const slot of SLOTS) if (request.slots[slot] !== undefined) throw new Error(`--${slot}: a sandbox's slots plan nothing, its units are in its start`)
  if (request.show !== undefined) throw new Error("--show: a sandbox's round is drawn by grid (grid <sandbox>, or the grid-screenshots skill), not by --show")
  if (request.save !== undefined) throw new Error("--save: a sandbox plays the one Battle Round its start writes, with nothing to save after it")
  const opening = openingOf(save)
  write(`${opening.name} (${opening.id}), seed ${save.setup.seed}: a sandbox, its Battle Round written by hand, ${save.setup.roundTicks} ticks at most`)
  if (request.playTo === undefined) {
    write("add --play-to next to play it")
    return { refused: false }
  }
  const lines = buildLog(playSandboxRound(opening).report, request.logLevel ?? "warn")
  if (request.log !== undefined) writeFileSync(request.log, `${lines.join("\n")}\n`)
  for (const line of lines) write(line)
  write(`tick by tick: grid ${opening.id} --headless --log-level info`)
  return { refused: lines.some((line) => line.includes(" ERROR ")) }
}
