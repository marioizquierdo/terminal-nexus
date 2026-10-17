import type { AbilityTable } from "../abilities/index.ts"
import type { ContentRegistry } from "../content/index.ts"
import type { MatchState, PlayerId } from "../state/types.ts"

export type Roster = Readonly<{
  /** Whether the player started the Pulse with a Grid Nexus that can be destroyed. */
  hasNexus: boolean
  /** Whether the player started with anything on `workers`, `units`, or `air`. */
  hasMobile: boolean
}>

export type PulseContext = Readonly<{
  registry: ContentRegistry
  /**
   * A side's own content, when the two sides' differ: a duel's, where what one side's Nexus powers changed (troopers
   * that burst, a wider aura) is that side's alone, though both field troopers. A side without one reads `registry`.
   * Every lookup of a unit's definition goes through its side (`contentOf`). Absent: one content for both sides, as in
   * every battle before duels.
   */
  sides?: Readonly<Partial<Record<PlayerId, ContentRegistry>>>
  pulseTicks: number
  roster: Readonly<Record<PlayerId, Roster>>
  /** The ability kinds its units' abilities name (`src/abilities/`). Absent: the game's own (`ABILITIES`). */
  abilities?: AbilityTable
}>

/** What a battle may give besides its state, content and length: each side's own content, and its ability kinds. */
export type PulseOptions = Readonly<Pick<PulseContext, "sides" | "abilities">>

/** The content `player`'s units are defined by in a battle: its own, or the battle's. */
export function contentOf(pulse: Readonly<Pick<PulseContext, "registry" | "sides">>, player: PlayerId): ContentRegistry {
  return pulse.sides?.[player] ?? pulse.registry
}

/**
 * Victory needs to know what each side started with, so that a scenario placing no Nexus is not
 * instantly won and a side that never had a worker is not instantly annihilated. Workers count: a side with only workers left has lost its army.
 */
export function createContext(
  initialState: MatchState,
  registry: ContentRegistry,
  pulseTicks: number,
  options: PulseOptions = {},
): PulseContext {
  const roster: Record<PlayerId, { hasNexus: boolean; hasMobile: boolean }> = {
    A: { hasNexus: false, hasMobile: false },
    B: { hasNexus: false, hasMobile: false },
  }
  for (const entity of initialState.entities) {
    const definition = contentOf({ registry, ...options }, entity.player).get(entity.contentId)
    const side = roster[entity.player]
    if (definition.nexus === true) side.hasNexus = true
    if (definition.layer !== "obstacles") side.hasMobile = true
  }
  return { registry, pulseTicks, roster, ...(options.sides === undefined ? {} : { sides: options.sides }), ...(options.abilities === undefined ? {} : { abilities: options.abilities }) }
}
