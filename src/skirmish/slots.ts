// Who plays each slot, as a command line asks for it: `--p1`/`--p2` with `build:<build file>`, `build:`,
// `script:<name>` or `script:` — the same words for the `skirmish` command (`src/cli/skirmish.ts`), the game
// (`terminal-nexus --load`) and the scripted playtest. Pure: a build file's text is read by the caller.

import type { Controller, Profiles, SaveSetup, Slot } from "./save.ts"
import { controllerKind, controllerProblem, IDLE_SCRIPT, SLOTS } from "./save.ts"

/** What `--p1`/`--p2` asks for: the controller, and for a player the build file it reads (`""`: none). */
export type SlotAsk = Readonly<{ controller: Controller; buildFile?: string }>

/** `build:<file>`, `build:`, `script:<name>`, `script:`, or a controller as a save writes it. */
export function slotAsk(text: string, profiles?: Profiles): SlotAsk {
  if (text === "build" || text.startsWith("build:")) return { controller: "player", buildFile: text.slice("build:".length) }
  if (text === "script" || text === "script:") return { controller: `script:${IDLE_SCRIPT}` }
  const problem = controllerProblem(text, profiles)
  if (problem !== null) throw new Error(`${problem}: a slot is build:<build file> or script:<profile>`)
  return { controller: text }
}

/** Why the game's screen cannot play a setup, by kind: an agent in a slot, two players, or p2 as the only player. */
export type ScreenRefusal = Readonly<{ kind: "agent"; slot: Slot } | { kind: "two-players" } | { kind: "p2-player" }>

/**
 * **What the screen can play**, or why not (`null`: it can): p1 as its player against a script in p2, or two scripts to
 * watch (spectating). An agent waits for the agent players' milestone, p2 as the screen's only player is not built,
 * and two players wait for Versus. The setup screen (`startProblem`) and a save opened on the screen (`screenProblem`)
 * say it each in their own words.
 */
export function screenRefusal(setup: SaveSetup): ScreenRefusal | null {
  const agent = SLOTS.find((slot) => controllerKind(setup.slots[slot].controller) === "agent")
  if (agent !== undefined) return { kind: "agent", slot: agent }
  const players = SLOTS.filter((slot) => controllerKind(setup.slots[slot].controller) === "player")
  if (players.length === 2) return { kind: "two-players" }
  if (players.length === 1 && players[0] !== "p1") return { kind: "p2-player" }
  return null
}

/** Why a save or a command line's slots cannot open on the screen, in the command line's words, or `null`. */
export function screenProblem(setup: SaveSetup): string | null {
  const refusal = screenRefusal(setup)
  if (refusal === null) return null
  if (refusal.kind === "agent") return `${refusal.slot} is ${setup.slots[refusal.slot].controller}: agent players are not built yet (give it a script, --${refusal.slot} script:steady)`
  if (refusal.kind === "two-players") return "both slots are players: two players at one screen wait for Versus (give one slot a script, --p2 script:balanced)"
  return "the screen plays p1 as its player: p2 as the player is not built yet (swap the slots' controllers, --p1 build: --p2 script:balanced)"
}
