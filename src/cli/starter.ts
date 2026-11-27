// The starter map's Skirmish: the Build Phase's test base, and where the scripted playtest and a demo open when nothing
// names a place. A save like any other (`saves/starter.save.json`): Vasse, played by a person, against a Dob who builds
// nothing, on a battlefield larger than the largest viewport on both axes, so scrolling is unavoidable.
//
// It was PERIMETER's first round, a story mission, until Story stopped (the owner, 2026-11-26): new mechanics are built
// in Skirmish only, so the screen most tests start from is a Skirmish's.

import type { BuildContext } from "../build/state.ts"
import type { SaveFile } from "../skirmish/save.ts"
import starterSave from "../../saves/starter.save.json" with { type: "json" }
import type { PlayableLevel } from "./levels.ts"
import { skirmishLevel } from "./skirmish-play.ts"

/** The starter map's save file, as the game reads it. */
export const STARTER_SAVE_FILE = "saves/starter.save.json"

/** The starter map's Skirmish, as the screens open it: what the game opens when nothing names a place. */
export const STARTER_LEVEL: PlayableLevel = skirmishLevel(starterSave as unknown as SaveFile, { file: STARTER_SAVE_FILE })

/** Round 1's Build Phase of the starter map's Skirmish. */
export function starterContext(scrollMargin?: number, extra: Partial<BuildContext> = {}): BuildContext {
  return STARTER_LEVEL.firstRound(scrollMargin, extra)
}

/** The screen's connections to it, as `BuildSession` takes them. */
export const { startPulse, nextRound, foresee, keep } = STARTER_LEVEL.play

/** What the game opens when nothing names a place: the starter map's Skirmish. */
export const DEFAULT_LEVEL: PlayableLevel = STARTER_LEVEL
