import type { ContentRegistry } from "../content/index.ts"
import type { MatchState, PlayerId } from "../state/types.ts"
import { PLAYERS } from "../state/types.ts"

export type Roster = Readonly<{
  /** Whether the player started the Pulse with a Grid Nexus that can be destroyed. */
  hasNexus: boolean
  /** Whether the player started with anything on `workers`, `units`, or `air`. */
  hasMobile: boolean
}>

export type PulseContext = Readonly<{
  registry: ContentRegistry
  pulseTicks: number
  roster: Readonly<Record<PlayerId, Roster>>
}>

export const NEXUS_CONTENT_ID = "structure.citizen.nexus"

/**
 * Victory needs to know what each side started with, so that a scenario placing no Nexus is not
 * instantly won and a side that never had a worker is not instantly annihilated (Q13).
 */
export function createContext(
  initialState: MatchState,
  registry: ContentRegistry,
  pulseTicks: number,
): PulseContext {
  const roster: Record<PlayerId, { hasNexus: boolean; hasMobile: boolean }> = {
    A: { hasNexus: false, hasMobile: false },
    B: { hasNexus: false, hasMobile: false },
  }
  for (const entity of initialState.entities) {
    const definition = registry.get(entity.contentId)
    const side = roster[entity.player]
    if (entity.contentId === NEXUS_CONTENT_ID) side.hasNexus = true
    if (definition.layer !== "obstacles") side.hasMobile = true
  }
  for (const player of PLAYERS) {
    const side = roster[player]
    roster[player] = { hasNexus: side.hasNexus, hasMobile: side.hasMobile }
  }
  return { registry, pulseTicks, roster }
}
