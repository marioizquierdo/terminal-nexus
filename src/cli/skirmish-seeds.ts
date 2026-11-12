// Many battles at once for the `skirmish` command (`./skirmish.ts`): one new battle played once a seed (`--seeds`), a
// line each and then a tally, and every pairing of the Commanders named, each from both sides (`--commanders`), so a
// side's advantage on the map cancels out. Every slot is a script: a plan file plays one round of one battle.

import { ARMIES } from "../armies/index.ts"
import type { Profiles } from "../skirmish/save.ts"
import { duelOf, SLOTS } from "../skirmish/save.ts"
import { isPlayer } from "../skirmish/play.ts"
import type { Tally } from "../skirmish/lines.ts"
import { counted, emptyTally, slotLabel, standing, tallyLine, winnerOf } from "../skirmish/lines.ts"
import type { SkirmishRequest } from "./skirmish.ts"
import type { Write } from "./skirmish-battle.ts"
import { keepOf, openSave, playRounds, startingSave } from "./skirmish-battle.ts"

/** One new battle, as the request sets it up but on `seed` and with these Commanders, played its rounds. */
function playOne(request: SkirmishRequest, profiles: Profiles, seed: number, commanders: SkirmishRequest["battle"]["commanders"], prefix: string, write: Write) {
  const save = startingSave({ ...request, battle: { ...request.battle, ...(commanders === undefined ? {} : { commanders }) } }, profiles, seed)
  const { setup } = openSave(save, request, profiles, write)
  const player = SLOTS.find((slot) => isPlayer(setup, slot))
  if (player !== undefined) throw new Error(`${player} is a player: a plan plays one round of one battle; give every slot a script to play many battles`)
  const state = playRounds(setup, duelOf({ ...save, setup }, profiles), {}, request.rounds, profiles, keepOf(request, { prefix, quiet: true }), write)
  return { setup, state }
}

/** **One battle a seed**: a line each, then the tally. */
export function playSeeds(request: SkirmishRequest, profiles: Profiles, write: Write): void {
  const seeds = request.seeds ?? [request.battle.seed ?? 1]
  let tally: Tally = emptyTally()
  let label = ""
  for (const seed of seeds) {
    const { setup, state } = playOne(request, profiles, seed, undefined, `seed-${seed}-`, write)
    label = `${slotLabel(setup, "p1")} against ${slotLabel(setup, "p2")}`
    tally = counted(tally, state)
    write(`seed ${seed}: ${standing(setup, state)}`)
  }
  write(`${label}, ${seeds.length} seeds: ${tallyLine(tally)}`)
}

/** The Commanders `--commanders` names: a list of ids, or `all`. */
export const commandersOf = (text: string): string[] => (text === "all" ? ARMIES.commanders.map((commander) => commander.id) : text.split(",").map((id) => id.trim()))

/**
 * **Every pairing**: each pair of the Commanders, each from both ends of the map, once a seed; a line a pairing saying
 * who won how often, by Commander, then the tally of every battle by slot (how often the west won).
 */
export function playPairings(request: SkirmishRequest, profiles: Profiles, write: Write): void {
  const names = request.commanders ?? []
  if (names.length < 2) throw new Error("--commanders names two Commanders or more (or all)")
  const seeds = request.seeds ?? [request.battle.seed ?? 1]
  let bySlot: Tally = emptyTally()
  for (let i = 0; i < names.length; i += 1) {
    for (let j = i + 1; j < names.length; j += 1) {
      const first = names[i] as string
      const second = names[j] as string
      const wins: Record<string, number> = { [first]: 0, [second]: 0 }
      let pairing: Tally = emptyTally()
      for (const seed of seeds) {
        for (const [p1, p2] of [
          [first, second],
          [second, first],
        ] as const) {
          const { state } = playOne(request, profiles, seed, { p1, p2 }, `${p1}-${p2}-seed-${seed}-`, write)
          const winner = winnerOf(state)
          if (winner !== null) wins[winner === "p1" ? p1 : p2] = (wins[winner === "p1" ? p1 : p2] ?? 0) + 1
          pairing = counted(pairing, state)
          bySlot = counted(bySlot, state)
        }
      }
      const others = tallyLine(pairing).replace(/^p1 won \d+, p2 won \d+, /u, "")
      write(`${first} against ${second}, ${pairing.battles} battles: ${first} won ${wins[first]}, ${second} won ${wins[second]}, ${others}`)
    }
  }
  write(`every battle by slot, ${bySlot.battles} battles: ${tallyLine(bySlot, "p1 (west)", "p2 (east)")}`)
}
