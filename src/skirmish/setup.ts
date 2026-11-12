// The setup screen's choices, as data (docs/system-design/skirmish-saves.md, setting up a Skirmish): what each row of
// New game and of a loaded save's Load game offers, how a row's value comes round when it is chosen, and why a setup
// cannot start. Pure, like the save it makes: the title screens (`src/cli/title-screens.ts`) draw and drive it, and a
// test walks it without a terminal.
//
// A setup is a `SaveSetup`, the very one a save file carries: the setup screen chooses exactly what a save holds,
// under the same names, so New game's Start is `skirmishLevel({ format, setup })` and nothing is translated.

import { ARMIES } from "../armies/index.ts"
import { DUEL_MAPS } from "../duel/index.ts"
import type { Controller, Modifier, Profiles, SaveSetup, Slot, SlotSetup } from "./save.ts"
import { controllerKind, MODIFIERS, newSetup, scriptOf, shareOf, SLOTS } from "./save.ts"
import { commanderNameOf, mapNameOf } from "./words.ts"

/** The maps New game offers, in order: the duel's built-in ones. */
export const SETUP_MAPS: readonly string[] = Object.keys(DUEL_MAPS)

/** The Commanders a slot may have, in order. */
export const SETUP_COMMANDERS: readonly string[] = ARMIES.commanders.map((commander) => commander.id)

/** The credits shares a slot comes round through: a share of the curve's income. */
export const CREDIT_SHARES: readonly number[] = [0.5, 0.75, 1, 1.25, 1.5, 2]

/** The agent profile the setup screen shows, dimmed: agent players are not built yet. */
export const SETUP_AGENT = "agent:curious"

/** The player's name a `Player` slot shows when nothing names one. */
export const DEFAULT_PLAYER_NAME = "player"

/** The script profile New game's p2 starts on: `steady`, which plays the duel's `balanced` script. */
export const DEFAULT_OPPONENT = "script:steady"

/** A new battle's setup as New game opens it: Vasse as `Player: <name>` against Dob Hunter's `steady` profile on the
 *  Crossing, Elimination, no modifiers, the seed given. */
export function setupDefaults(seed: number, playerName: string = DEFAULT_PLAYER_NAME, profiles: Profiles = new Map()): SaveSetup {
  const opponent = profiles.has(scriptOf(DEFAULT_OPPONENT)) ? DEFAULT_OPPONENT : "script:balanced"
  return newSetup({ seed, slots: { p1: { controller: `player:${playerName}` }, p2: { controller: opponent } } })
}

/** The controllers a slot comes round through: the player, each script profile, and the agent (dimmed). */
export function controllerChoices(playerName: string, profiles: Profiles): readonly Controller[] {
  return [`player:${playerName}`, ...[...profiles.keys()].sort().map((name) => `script:${name}`), SETUP_AGENT]
}

/** A controller as a row shows it: `Player: marioiz`, `Scripted: agro`, `Agent: curious (not built yet)`. */
export function controllerLabel(controller: Controller, playerName: string = DEFAULT_PLAYER_NAME): string {
  const kind = controllerKind(controller)
  const name = controller.includes(":") ? controller.slice(controller.indexOf(":") + 1) : ""
  if (kind === "player") return `Player: ${name === "" ? playerName : name}`
  if (kind === "script") return `Scripted: ${scriptOf(controller)}`
  if (kind === "agent") return `Agent: ${name} (not built yet)`
  return controller
}

/** A credits share as a row shows it: `125%`. */
export const shareLabel = (share: number): string => `${Math.round(share * 100)}%`

/** The item after `current` in `all`, coming round at the end; the first when `current` is not in it. */
function after<T>(all: readonly T[], current: T): T {
  const index = all.indexOf(current)
  return all[(index + 1) % all.length] as T
}

/** What a row of a setup is about. The title screens give each its hotkey and label. */
export type SetupField =
  | Readonly<{ kind: "map" }>
  | Readonly<{ kind: "commander"; slot: Slot }>
  | Readonly<{ kind: "controller"; slot: Slot }>
  | Readonly<{ kind: "credits"; slot: Slot }>
  | Readonly<{ kind: "goal" }>
  | Readonly<{ kind: "modifier"; modifier: Modifier }>
  | Readonly<{ kind: "seed" }>

/** New game's rows, in the order the setup depends on them: the map, each slot, the goal, the modifiers, the seed. */
export const NEW_GAME_FIELDS: readonly SetupField[] = [
  { kind: "map" },
  ...SLOTS.flatMap((slot): SetupField[] => [
    { kind: "commander", slot },
    { kind: "controller", slot },
    { kind: "credits", slot },
  ]),
  { kind: "goal" },
  ...MODIFIERS.map((modifier): SetupField => ({ kind: "modifier", modifier })),
  { kind: "seed" },
]

/** A loaded save's rows: who plays each slot and its credits, and the modifiers — not the map or the Commanders, which
 *  the battle so far depends on. */
export const LOAD_GAME_FIELDS: readonly SetupField[] = [
  ...SLOTS.flatMap((slot): SetupField[] => [
    { kind: "controller", slot },
    { kind: "credits", slot },
  ]),
  ...MODIFIERS.map((modifier): SetupField => ({ kind: "modifier", modifier })),
]

/** How the setup screen names a slot: `p1 (west)`. */
export const slotName = (slot: Slot): string => `${slot} ${slot === "p1" ? "(west)" : "(east)"}`

/** A row's name and its value as it reads now. */
export function fieldText(setup: SaveSetup, field: SetupField, playerName: string, profiles: Profiles): Readonly<{ name: string; value: string }> {
  switch (field.kind) {
    case "map":
      return { name: "Map", value: mapNameOf(setup.map) }
    case "commander":
      return { name: `${slotName(field.slot)} Commander`, value: commanderNameOf(setup.slots[field.slot].commander) }
    case "controller":
      return { name: `${slotName(field.slot)} played by`, value: controllerLabel(setup.slots[field.slot].controller, playerName) }
    case "credits": {
      const slot = setup.slots[field.slot]
      const share = shareOf(slot, profiles)
      const profile = slot.options?.credits === undefined && controllerKind(slot.controller) === "script" && share !== 1 ? ` (${scriptOf(slot.controller)}'s)` : ""
      return { name: `${slotName(field.slot)} credits`, value: `${shareLabel(share)}${profile}` }
    }
    case "goal":
      return { name: "Goal", value: "Elimination (the only goal built)" }
    case "modifier":
      return { name: `Modifier ${field.modifier}`, value: setup.modifiers.includes(field.modifier) ? "on" : "off" }
    case "seed":
      return { name: "Seed", value: String(setup.seed) }
  }
}

/** A line saying more about a row, for the line under the rows: what a profile plays like, what a modifier does. */
export function fieldAbout(setup: SaveSetup, field: SetupField, profiles: Profiles): string {
  switch (field.kind) {
    case "map": {
      const map = typeof setup.map === "string" ? DUEL_MAPS[setup.map] : undefined
      return map?.notes ?? "The map fixes the slots: two Nexuses, west and east."
    }
    case "commander":
      return `${commanderNameOf(setup.slots[field.slot].commander)} leads ${field.slot}'s army: Enter for the next Commander.`
    case "controller": {
      const controller = setup.slots[field.slot].controller
      const kind = controllerKind(controller)
      if (kind === "player") return "A person plans this slot at the screen."
      if (kind === "agent") return "A language model playing this slot is not built yet: choose another."
      const profile = profiles.get(scriptOf(controller))
      return profile?.about ?? `The ${scriptOf(controller)} script plans this slot.`
    }
    case "credits":
      return "A share of the income each round: there is no difficulty setting, only richer or poorer sides."
    case "goal":
      return "Destroy the enemy Nexus, or have the healthier one when the rounds run out."
    case "modifier":
      return field.modifier === "fast-rounds" ? "Every Battle Round lasts half as long." : "Every side's round income is doubled."
    case "seed":
      return "The battle's seed: Enter types a new one (digits, then Enter); the same seed plays the same battle."
  }
}

/** Whether a row is dimmed: an agent controller, which cannot start. */
export function fieldDimmed(setup: SaveSetup, field: SetupField): boolean {
  return field.kind === "controller" && controllerKind(setup.slots[field.slot].controller) === "agent"
}

/** A slot with its credits option set to `share`, or dropped when that is what it would be without one. */
function withShare(slot: SlotSetup, share: number, profiles: Profiles): SlotSetup {
  const { options: _options, ...rest } = slot
  const plain = shareOf(rest, profiles)
  return share === plain ? rest : { ...rest, options: { credits: share } }
}

/** A slot with another controller: its own credits option kept only if it still differs from the new profile's. */
function withController(slot: SlotSetup, controller: Controller, profiles: Profiles): SlotSetup {
  const share = slot.options?.credits
  const changed: SlotSetup = { ...slot, controller }
  return share === undefined ? changed : withShare(changed, share, profiles)
}

/**
 * The setup with `field` come round to its next value: the next map, Commander, controller (the player, each profile,
 * the agent), credits share, the modifier on or off. The goal (Elimination only) and the seed (typed, not cycled) stay
 * as they are.
 */
export function nextValue(setup: SaveSetup, field: SetupField, playerName: string, profiles: Profiles): SaveSetup {
  const slot = (key: Slot, change: (slot: SlotSetup) => SlotSetup): SaveSetup => ({ ...setup, slots: { ...setup.slots, [key]: change(setup.slots[key]) } })
  switch (field.kind) {
    case "map":
      return { ...setup, map: after(SETUP_MAPS, typeof setup.map === "string" ? setup.map : "") }
    case "commander":
      return slot(field.slot, (current) => ({ ...current, commander: after(SETUP_COMMANDERS, current.commander ?? "") }))
    case "controller": {
      const choices = controllerChoices(playerName, profiles)
      const current = setup.slots[field.slot].controller
      // A player of another name is this screen's player: the next is the first script.
      const at = controllerKind(current) === "player" ? `player:${playerName}` : current
      return slot(field.slot, (value) => withController(value, after(choices, at), profiles))
    }
    case "credits":
      return slot(field.slot, (value) => withShare(value, after(CREDIT_SHARES, shareOf(value, profiles)), profiles))
    case "modifier": {
      const on = setup.modifiers.includes(field.modifier)
      const modifiers = on ? setup.modifiers.filter((modifier) => modifier !== field.modifier) : MODIFIERS.filter((modifier) => modifier === field.modifier || setup.modifiers.includes(modifier))
      return { ...setup, modifiers }
    }
    case "goal":
    case "seed":
      return setup
  }
}

/**
 * Why the screen cannot start this setup, or `null`: an agent in a slot (not built yet), two players at one screen
 * (Versus), or p2 as the only player (the screen plays p1). No player at all is spectating, which it plays.
 */
export function startProblem(setup: SaveSetup): string | null {
  for (const slot of SLOTS) {
    if (controllerKind(setup.slots[slot].controller) === "agent") return `${slot} is an agent: agent players are not built yet. Choose a player or a script.`
  }
  const players = SLOTS.filter((slot) => controllerKind(setup.slots[slot].controller) === "player")
  if (players.length === 2) return "Two players at one screen wait for Versus: give one slot a script."
  if (players.length === 1 && players[0] === "p2") return "The screen plays p1: make p1 the player and p2 a script, or both scripts to watch."
  return null
}

/** Whether nobody plays at the screen: both slots scripts, a battle to watch. */
export const spectating = (setup: SaveSetup): boolean => SLOTS.every((slot) => controllerKind(setup.slots[slot].controller) !== "player")
