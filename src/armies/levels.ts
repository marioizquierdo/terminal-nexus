// A campaign's levels as written, made whole before they are checked: a level that extends another becomes a copy of
// it with its own fields in place (`extends`), and a mission that brings "@commander" brings the campaign's Commander.
// So the second Commander's level is the first one's rounds with one line changed, and stays so when they change.
//
// - **What a level gives replaces what it extends**, field by field: its map, credits, unlocks, schedule and notes.
// - **Its mission changes the extended one's**: a field it gives replaces that field whole; its `triggers` are a whole
//   new list, or `{ "remove": [ids], "replace": [triggers] }` — the triggers to drop, and the triggers to put in, in
//   place of the one with the same id or after the rest.
// - **A level may extend a level that extends another**, from any campaign; a circle is refused.
//
// Pure, and on plain JSON: the shapes are checked after, on the level as it is made (`load.ts`).

import { isObject } from "../content/shape.ts"
import type { MissionDefinition, TriggerDefinition } from "../mission/types.ts"
import type { LevelEntry, MissionPatch } from "./types.ts"
import { COMMANDER_PLACEHOLDER } from "./types.ts"

/** A level, whole: everything it says, and everything it did not say taken from what it extends. */
export type WholeLevel = Readonly<{
  entry: LevelEntry
  /** Its mission, before its shape is checked. */
  mission: unknown
}>

/** `base`'s mission with `patch`'s fields in place, and its triggers removed, replaced or added. */
function patchedMission(base: unknown, patch: MissionPatch): unknown {
  if (!isObject(base)) return patch
  const { triggers, ...fields } = patch
  const mission: Record<string, unknown> = { ...base, ...fields }
  if (triggers === undefined) return mission
  if (Array.isArray(triggers)) return { ...mission, triggers }
  const change = triggers as Readonly<{ remove?: readonly string[]; replace?: readonly TriggerDefinition[] }>
  const removed = new Set(change.remove ?? [])
  const replacing = new Map((change.replace ?? []).map((trigger) => [trigger.id, trigger]))
  const kept = (Array.isArray(base["triggers"]) ? (base["triggers"] as readonly TriggerDefinition[]) : [])
    .filter((trigger) => !removed.has(trigger.id))
    .map((trigger) => replacing.get(trigger.id) ?? trigger)
  const added = [...replacing.values()].filter((trigger) => !kept.some((existing) => existing === trigger))
  return { ...mission, triggers: [...kept, ...added] }
}

/**
 * Every level of `levels` made whole, by id, with a problem said for a level that extends one no campaign has, or
 * that extends itself in a circle. `levels` holds every campaign's levels, so one may extend another's.
 */
export function wholeLevels(levels: ReadonlyMap<string, LevelEntry>, say: (level: string, problem: string) => void): Map<string, WholeLevel> {
  const whole = new Map<string, WholeLevel>()
  const making = new Set<string>()
  const make = (id: string): WholeLevel | null => {
    const done = whole.get(id)
    if (done !== undefined) return done
    const entry = levels.get(id)
    if (entry === undefined) return null
    if (entry.extends === undefined) {
      const made = { entry, mission: entry.mission }
      whole.set(id, made)
      return made
    }
    if (making.has(id)) {
      say(id, `extends "${entry.extends}", which extends it back: a circle`)
      return null
    }
    making.add(id)
    const base = make(entry.extends)
    making.delete(id)
    if (base === null) {
      if (!levels.has(entry.extends)) say(id, `extends "${entry.extends}", which is not a level any campaign has`)
      return null
    }
    const { extends: _extends, mission: patch, ...own } = entry
    const merged: LevelEntry = { ...base.entry, ...own, id: entry.id }
    const { extends: _baseExtends, ...flat } = merged
    const made = { entry: flat, mission: patch === undefined ? base.mission : patchedMission(base.mission, patch as MissionPatch) }
    whole.set(id, made)
    return made
  }
  for (const id of levels.keys()) make(id)
  return whole
}

/** `mission` with every spawn of "@commander" bringing `unit`, the campaign's Commander's. */
export function withCommander(mission: MissionDefinition, unit: string): MissionDefinition {
  let changed = false
  const triggers = mission.triggers.map((trigger) => ({
    ...trigger,
    do: trigger.do.map((action) => {
      if (!("spawn" in action) || !action.spawn.units.some((entry) => entry.unit === COMMANDER_PLACEHOLDER)) return action
      changed = true
      return { spawn: { ...action.spawn, units: action.spawn.units.map((entry) => (entry.unit === COMMANDER_PLACEHOLDER ? { ...entry, unit } : entry)) } }
    }),
  }))
  return changed ? { ...mission, triggers } : mission
}
