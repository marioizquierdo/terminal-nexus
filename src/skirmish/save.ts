// A Skirmish save file (docs/system-design/skirmish-saves.md): a setup, and the battle as it stands at the opening of a
// Build Phase. One format, written by the game and by a person, read by the `skirmish` command, the game and a test.
//
// Pure: it reads and writes text, never a file. The parts a person writes (`setup`, `draft`) say `p1` and `p2`, the
// slots a player picks; the part the game writes (`state`) is the duel's own state between rounds, `DuelState`, in the
// engine's words, where side A is `p1` and side B is `p2`. The Grid's ground is never saved (the map has it) and the
// log never is (the owner, 2026-11-12: "Logging is a separate concern").

import type { Coord } from "../grid/types.ts"
import type { MatchState, TargetArea } from "../state/types.ts"
import type { DuelMap, DuelSetup, DuelState, Side, SidePlan } from "../duel/index.ts"
import { DUEL_MAPS, DUEL_PULSE_TICKS, DUEL_ROUNDS, duelArmy, duelGrid, newDuel, readPlan, scriptedName } from "../duel/index.ts"

/** What a save file says it is, so a later format can tell an older one. */
export const SAVE_FORMAT = "terminal-nexus.save/1"

/** The slots of a battle, by number: two today (the owner, 2026-11-12: "p1", "p2"). */
export const SLOTS = ["p1", "p2"] as const
export type Slot = (typeof SLOTS)[number]

/** The duel's side a slot plays: p1 is A, in the west; p2 is B, in the east. */
export const SIDE_OF: Readonly<Record<Slot, Side>> = { p1: "A", p2: "B" }
export const SLOT_OF: Readonly<Record<Side, Slot>> = { A: "p1", B: "p2" }

/** The goals a Skirmish can be won by. Elimination only, until a Skirmish is fun without more. */
export const GOALS = ["elimination"] as const
export type Goal = (typeof GOALS)[number]

/**
 * The modifiers: named rules laid over a battle, a playground for experiments (the owner, 2026-11-12: "as
 * experimentation ground"). The ones that do not earn a place are removed.
 *
 * - **fast-rounds**: every Battle Round lasts half as long.
 * - **double-income**: every side's round income is doubled.
 */
export const MODIFIERS = ["fast-rounds", "double-income"] as const
export type Modifier = (typeof MODIFIERS)[number]

/**
 * A script profile (`players/scripts/<name>.json`): a named scripted player — the script it plays (one of the duel's
 * scripts, `src/duel/players.ts`), a line saying how it plays, and its options. The same scripts the duels and the
 * measurements play.
 */
export type ScriptProfile = Readonly<{
  script: string
  about: string
  options?: SlotOptions
}>

/** A slot's options: its credits share, a share of the curve's income (1 unless set). There is no difficulty setting
 *  (the owner, 2026-11-11): a share is how a side is made richer or poorer, and may be set on any slot. */
export type SlotOptions = Readonly<{ credits?: number }>

/** The script profiles a run knows, by name. Empty when none were read: the duel's own scripts still play by name. */
export type Profiles = ReadonlyMap<string, ScriptProfile>
const NO_PROFILES: Profiles = new Map()

/** The script that plans nothing: builds nothing, keeps no card, holds. What `script:` with no name plays. */
export const IDLE_SCRIPT = "idle"

/**
 * Who plans a slot each round: `player` (a person, at the screen or through a build file; `player:<name>` names
 * them), `script:<profile>` (a scripted player), `agent:<profile>` (a language model, not built yet).
 */
export type Controller = string

/** A slot as the setup chooses it: its Commander, and who plans it. */
export type SlotSetup = Readonly<{ commander: string; controller: Controller; options?: SlotOptions }>

/** A map drawn in full inside a save, as `DuelMap` is but by slot. */
export type SaveMap = Readonly<{
  id: string
  name: string
  notes?: string
  rows: readonly string[]
  nexus: Readonly<Record<Slot, Coord>>
  hold: Readonly<Record<Slot, TargetArea>>
}>

/** Everything chosen before round 1. */
export type SaveSetup = Readonly<{
  /** A built-in map by id (`crossing`, `pocket`), or one drawn in full. */
  map: string | SaveMap
  seed: number
  goal: Goal
  modifiers: readonly string[]
  rounds: number
  /** Ticks a Battle Round lasts at most (12 a second). */
  roundTicks: number
  slots: Readonly<Record<Slot, SlotSetup>>
}>

/** The duel's state between rounds as a save keeps it: `DuelState` without its setup (the save's own) and without the
 *  Grid's ground (the map's). */
export type SavedState = Omit<DuelState, "setup" | "carried"> & Readonly<{ carried: Omit<MatchState, "grid"> | null }>

/** A save file. Only `format` and `setup` are needed: a file with only those is a new battle. */
export type SaveFile = Readonly<{
  format: typeof SAVE_FORMAT
  name?: string
  notes?: string
  setup: SaveSetup
  /** The battle as the Build Phase of `state.round` opened, written by the game. Absent: round 1, nothing built. */
  state?: SavedState
  /** A slot's plan so far this Build Phase, so loading returns to exactly where it stopped. */
  draft?: Readonly<Partial<Record<Slot, SidePlan>>>
}>

/** A save read from text, and every problem found reading it, all at once. */
export type ReadSave = Readonly<{ save: SaveFile | null; problems: readonly string[] }>

// --- Controllers -------------------------------------------------------------------------------------------------------

/** The kind of a controller: `player`, `script` or `agent`. */
export const controllerKind = (controller: Controller): string => controller.split(":")[0] ?? ""

/** The profile or script a `script:` controller names. */
export const scriptOf = (controller: Controller): string => controller.slice("script:".length) || IDLE_SCRIPT

/** The duel script a `script:` controller plays: its profile's script, or the name itself when it is one. `null` for
 *  a name that is neither. */
export function scriptPlayed(controller: Controller, profiles: Profiles = NO_PROFILES): string | null {
  const name = scriptOf(controller)
  if (name === IDLE_SCRIPT) return IDLE_SCRIPT
  const profile = profiles.get(name)
  if (profile !== undefined) return profile.script
  return scriptedName(name) === undefined ? null : name
}

/** A slot's credits share: its own option, else its profile's, else 1. */
export function shareOf(slot: SlotSetup, profiles: Profiles = NO_PROFILES): number {
  if (slot.options?.credits !== undefined) return slot.options.credits
  if (controllerKind(slot.controller) !== "script") return 1
  return profiles.get(scriptOf(slot.controller))?.options?.credits ?? 1
}

/** What is wrong with a controller, or `null`. */
export function controllerProblem(controller: Controller, profiles: Profiles = NO_PROFILES): string | null {
  const kind = controllerKind(controller)
  if (kind === "player") return null
  if (kind === "script") {
    const script = scriptOf(controller)
    if (scriptPlayed(controller, profiles) !== null) return null
    const known = [...profiles.keys()]
    return `no script or profile "${script}"${known.length === 0 ? "" : ` (profiles: ${known.join(", ")}; or a script: balanced, rush, turtle and their variants)`}`
  }
  if (kind === "agent") return "agent players are not built yet (the agent players' milestone)"
  return `"${controller}" is not a controller: player, script:<name> or agent:<name>`
}

// --- Maps --------------------------------------------------------------------------------------------------------------

/** A save's map as the duel reads it: a built-in one by id, or one drawn in full, its slots turned to sides. */
export function duelMapOf(map: SaveSetup["map"]): string | DuelMap {
  if (typeof map === "string") return map
  return {
    id: map.id,
    name: map.name,
    notes: map.notes ?? "",
    rows: map.rows,
    nexus: { A: map.nexus.p1, B: map.nexus.p2 },
    hold: { A: map.hold.p1, B: map.hold.p2 },
  }
}

/** The map's ground, whichever way the save names it. */
const groundOf = (map: SaveSetup["map"]): ReturnType<typeof duelGrid> => {
  const duel = duelMapOf(map)
  return duelGrid(typeof duel === "string" ? (DUEL_MAPS[duel] as DuelMap) : duel)
}

// --- Between a save and a duel -----------------------------------------------------------------------------------------

/** The duel a save's setup describes, its modifiers and the slots' credits shares laid over it. */
export function duelSetupOf(setup: SaveSetup, profiles: Profiles = NO_PROFILES): DuelSetup {
  const modifiers = new Set(setup.modifiers)
  const income = (slot: Slot): number => shareOf(setup.slots[slot], profiles) * (modifiers.has("double-income") ? 2 : 1)
  const shares = { A: income("p1"), B: income("p2") }
  return {
    map: duelMapOf(setup.map),
    seed: setup.seed,
    rounds: setup.rounds,
    pulseTicks: modifiers.has("fast-rounds") ? Math.max(1, Math.round(setup.roundTicks / 2)) : setup.roundTicks,
    commanders: { A: setup.slots.p1.commander, B: setup.slots.p2.commander },
    ...(shares.A === 1 && shares.B === 1 ? {} : { income: shares }),
  }
}

/** The duel as a save left it: its state with the map's ground put back, or a new duel when it has none. The setup is
 *  always the save's own (with `profiles` for the shares), so a changed controller or modifier takes effect from the
 *  next round. */
export function duelOf(save: SaveFile, profiles: Profiles = NO_PROFILES): DuelState {
  const setup = duelSetupOf(save.setup, profiles)
  if (save.state === undefined) return newDuel(setup)
  const { carried, ...rest } = save.state
  return { ...rest, setup, carried: carried === null ? null : { ...carried, grid: groundOf(save.setup.map) } }
}

/** A save of the duel as it stands, with the slots' controllers and drafts. */
export function saveOf(setup: SaveSetup, state: DuelState, extra: Readonly<{ name?: string; notes?: string; draft?: SaveFile["draft"] }> = {}): SaveFile {
  const { setup: _setup, carried, ...rest } = state
  const saved: SavedState = { ...rest, carried: carried === null ? null : withoutGround(carried) }
  const draft = extra.draft === undefined || Object.keys(extra.draft).length === 0 ? undefined : extra.draft
  return {
    format: SAVE_FORMAT,
    ...(extra.name === undefined ? {} : { name: extra.name }),
    ...(extra.notes === undefined ? {} : { notes: extra.notes }),
    setup,
    ...(state.round === 1 && carried === null && state.history.length === 0 ? {} : { state: saved }),
    ...(draft === undefined ? {} : { draft }),
  }
}

function withoutGround(state: MatchState): Omit<MatchState, "grid"> {
  const { grid: _grid, ...rest } = state
  return rest
}

/** A new battle's setup, every field not given at its default. */
export function newSetup(given: Readonly<Partial<Omit<SaveSetup, "slots">> & { slots?: Partial<Record<Slot, Partial<SlotSetup>>> }>): SaveSetup {
  return {
    map: given.map ?? "crossing",
    seed: given.seed ?? 1,
    goal: given.goal ?? "elimination",
    modifiers: given.modifiers ?? [],
    rounds: given.rounds ?? DUEL_ROUNDS,
    roundTicks: given.roundTicks ?? DUEL_PULSE_TICKS,
    slots: {
      p1: { commander: given.slots?.p1?.commander ?? "vasse", controller: given.slots?.p1?.controller ?? "player" },
      p2: { commander: given.slots?.p2?.commander ?? "dob", controller: given.slots?.p2?.controller ?? "script:balanced" },
    },
  }
}

// --- Reading -----------------------------------------------------------------------------------------------------------

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value)
const isWhole = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value)

/** The problems with a map drawn in full. */
function mapProblems(map: unknown): string[] {
  if (typeof map === "string") return DUEL_MAPS[map] === undefined ? [`setup.map: no map "${map}" (${Object.keys(DUEL_MAPS).join(", ")}), or draw one in full`] : []
  if (!isRecord(map)) return ["setup.map: a map's id, or a map drawn in full ({ id, name, rows, nexus, hold })"]
  const problems: string[] = []
  if (typeof map["id"] !== "string") problems.push("setup.map.id: a name for the map")
  if (typeof map["name"] !== "string") problems.push("setup.map.name: the map's name for a person")
  if (!Array.isArray(map["rows"]) || !map["rows"].every((row) => typeof row === "string")) problems.push("setup.map.rows: the map's rows of text (. open, # rock, * deposit)")
  for (const part of ["nexus", "hold"] as const) {
    const value = map[part]
    for (const slot of SLOTS) {
      const at = isRecord(value) ? value[slot] : undefined
      if (!isRecord(at) || !isWhole(at["x"]) || !isWhole(at["y"]) || (part === "hold" && (!isWhole(at["width"]) || !isWhole(at["height"])))) {
        problems.push(`setup.map.${part}.${slot}: ${part === "nexus" ? "{ x, y }, its Nexus's north-west tile" : "{ x, y, width, height }, where its troops hold"}`)
      }
    }
  }
  if (problems.length === 0) {
    try {
      duelGrid(duelMapOf(map as SaveMap) as DuelMap)
    } catch (error) {
      problems.push(`setup.map: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return problems
}

/** The problems with a slot. */
function slotProblems(slot: Slot, value: unknown, profiles: Profiles): string[] {
  if (!isRecord(value)) return [`setup.slots.${slot}: { commander, controller }`]
  const problems: string[] = []
  const commander = value["commander"]
  if (typeof commander !== "string") problems.push(`setup.slots.${slot}.commander: a Commander's id (vasse, averno, dob)`)
  else {
    try {
      duelArmy(commander)
    } catch (error) {
      problems.push(`setup.slots.${slot}.commander: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  const controller = value["controller"]
  if (typeof controller !== "string") problems.push(`setup.slots.${slot}.controller: player, script:<name> or agent:<name>`)
  else {
    const problem = controllerProblem(controller, profiles)
    if (problem !== null) problems.push(`setup.slots.${slot}.controller: ${problem}`)
  }
  const options = value["options"]
  if (options !== undefined) {
    if (!isRecord(options)) problems.push(`setup.slots.${slot}.options: { credits }`)
    else {
      const credits = options["credits"]
      if (credits !== undefined && (typeof credits !== "number" || !(credits > 0) || credits > 10)) problems.push(`setup.slots.${slot}.options.credits: a share of the income above 0, at most 10 (1 is the curve's)`)
      for (const key of Object.keys(options)) if (key !== "credits") problems.push(`setup.slots.${slot}.options.${key}: the only option is credits`)
    }
  }
  return problems
}

/** A save from its text: what it says, and every problem with it at once. A save with any problem is refused whole. */
export function readSave(text: string, profiles: Profiles = NO_PROFILES): ReadSave {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (error) {
    return { save: null, problems: [`not JSON: ${error instanceof Error ? error.message : String(error)}`] }
  }
  if (!isRecord(value)) return { save: null, problems: ["a save is a JSON object with format and setup"] }
  const problems: string[] = []
  if (value["format"] !== SAVE_FORMAT) problems.push(`format: "${SAVE_FORMAT}", not ${JSON.stringify(value["format"])}`)
  for (const field of ["name", "notes"]) if (value[field] !== undefined && typeof value[field] !== "string") problems.push(`${field}: text`)
  const setup = value["setup"]
  if (!isRecord(setup)) problems.push("setup: { map, seed, goal, modifiers, rounds, roundTicks, slots }")
  else {
    problems.push(...mapProblems(setup["map"]))
    if (!isWhole(setup["seed"])) problems.push("setup.seed: a whole number")
    if (!(GOALS as readonly unknown[]).includes(setup["goal"])) problems.push(`setup.goal: one of ${GOALS.join(", ")}`)
    const modifiers = setup["modifiers"]
    if (!Array.isArray(modifiers)) problems.push("setup.modifiers: a list, [] for none")
    else for (const modifier of modifiers) if (!(MODIFIERS as readonly unknown[]).includes(modifier)) problems.push(`setup.modifiers: no modifier ${JSON.stringify(modifier)} (${MODIFIERS.join(", ")})`)
    for (const field of ["rounds", "roundTicks"]) if (!isWhole(setup[field]) || (setup[field] as number) < 1) problems.push(`setup.${field}: a whole number, 1 or more`)
    const slots = setup["slots"]
    if (!isRecord(slots)) problems.push("setup.slots: { p1, p2 }")
    else {
      for (const slot of SLOTS) problems.push(...slotProblems(slot, slots[slot], profiles))
      for (const key of Object.keys(slots)) if (!(SLOTS as readonly string[]).includes(key)) problems.push(`setup.slots.${key}: the slots are ${SLOTS.join(" and ")}`)
    }
  }
  const state = value["state"]
  if (state !== undefined) {
    if (!isRecord(state) || !isWhole(state["round"]) || !isRecord(state["sides"]) || !Array.isArray(state["history"]) || !("carried" in state) || !("result" in state)) {
      problems.push("state: the battle as the game wrote it ({ round, carried, sides, history, result }); remove it to start from round 1")
    }
  }
  const draft = value["draft"]
  if (draft !== undefined) {
    if (!isRecord(draft)) problems.push("draft: { p1?, p2? }, each a plan")
    else {
      for (const [slot, plan] of Object.entries(draft)) {
        if (!(SLOTS as readonly string[]).includes(slot)) problems.push(`draft.${slot}: the slots are ${SLOTS.join(" and ")}`)
        else for (const problem of readPlan(plan).problems) problems.push(`draft.${slot}: ${problem}`)
      }
    }
  }
  return problems.length > 0 ? { save: null, problems } : { save: value as SaveFile, problems }
}

// --- Writing -----------------------------------------------------------------------------------------------------------

/**
 * A save as text a person can read and change: indented, but each Grid entity, ground item, round's report and planned
 * building on a line of its own, so a battle of a hundred units stays a page, not a thousand lines.
 */
export function saveText(save: SaveFile): string {
  const compact: string[] = []
  const ONE_LINE = new Set(["entities", "groundItems", "vacatedTiles", "history", "build", "actions", "hold", "kept", "absent", "rng", "modifiers", "burning"])
  const marked = JSON.stringify(
    save,
    (key: string, value: unknown) => {
      if (ONE_LINE.has(key) && value !== null && typeof value === "object") {
        if (Array.isArray(value)) {
          if (value.length === 0) return value
          if (value.every((item) => item === null || typeof item !== "object")) {
            compact.push(JSON.stringify(value))
            return `\u0000${compact.length - 1}\u0000`
          }
          return value.map((item) => {
            compact.push(JSON.stringify(item))
            return `\u0000${compact.length - 1}\u0000`
          })
        }
        compact.push(JSON.stringify(value))
        return `\u0000${compact.length - 1}\u0000`
      }
      return value
    },
    2,
  )
  return `${marked.replace(/"\\u0000(\d+)\\u0000"/g, (_, index: string) => compact[Number(index)] as string)}\n`
}
