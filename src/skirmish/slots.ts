// Who plays each slot, as a command line asks for it: `--p1`/`--p2` with `build:<plan file>`, `build:`,
// `script:<name>` or `script:` — the same words for the `skirmish` command (`src/cli/skirmish.ts`), the game
// (`terminal-nexus --load`) and the scripted playtest. Pure: a plan file's text is read by the caller.

import type { Controller, Profiles, SaveSetup, Slot } from "./save.ts"
import { controllerKind, controllerProblem, IDLE_SCRIPT, SLOTS } from "./save.ts"

/** What `--p1`/`--p2` asks for: the controller, and for a player the plan file it reads (`""`: none). */
export type SlotAsk = Readonly<{ controller: Controller; planFile?: string }>

/** `build:<file>`, `build:`, `script:<name>`, `script:`, or a controller as a save writes it. */
export function slotAsk(text: string, profiles?: Profiles): SlotAsk {
  if (text === "build" || text.startsWith("build:")) return { controller: "player", planFile: text.slice("build:".length) }
  if (text === "script" || text === "script:") return { controller: `script:${IDLE_SCRIPT}` }
  const problem = controllerProblem(text, profiles)
  if (problem !== null) throw new Error(`${problem}: a slot is build:<plan file> or script:<profile>`)
  return { controller: text }
}

/** A setup with the controllers asked for in place of its own; a slot not asked for keeps its controller. */
export function withControllers(setup: SaveSetup, asks: Readonly<Partial<Record<Slot, SlotAsk>>>): SaveSetup {
  const slots = { ...setup.slots }
  for (const slot of SLOTS) {
    const ask = asks[slot]
    if (ask !== undefined) slots[slot] = { ...slots[slot], controller: ask.controller }
  }
  return { ...setup, slots }
}

/**
 * Why the game's screen cannot play a setup, or `null`: the screen plays p1 as its player against a script in p2, or
 * watches two scripts (spectating). An agent waits for the agent players' milestone, p2 as the screen's only player is
 * not built, and two players wait for Versus.
 */
export function screenProblem(setup: SaveSetup): string | null {
  const agent = SLOTS.find((slot) => controllerKind(setup.slots[slot].controller) === "agent")
  if (agent !== undefined) return `${agent} is ${setup.slots[agent].controller}: agent players are not built yet (give it a script, --${agent} script:steady)`
  const players = SLOTS.filter((slot) => controllerKind(setup.slots[slot].controller) === "player")
  if (players.length === 2) return "both slots are players: two players at one screen wait for Versus (give one slot a script, --p2 script:balanced)"
  if (players.length === 1 && players[0] !== "p1") return "the screen plays p1 as its player: p2 as the player is not built yet (swap the slots' controllers, --p1 build: --p2 script:balanced)"
  return null
}
