// **The battle reading**: what a battle says, read in one place (docs/system-design/battles.md, "Reading a battle"), so
// the brief, a round's report, the `skirmish` command, a script and a model all read the same facts.
//
// Every reading here is public: the Battle Round is fought in the open, and both sides see all of it. What is private is
// the Build Phase — a side's credits, its hand and its build actions — which nothing here reads.
//
// A reading is one small file: a tracker shown each tick's state and events, and asked for its value as the round ends
// (`Tracker`). A new reading is a new file and one line below; the round's report keeps it, and the brief and every
// script get it at once. Keep each one plain — a count, a total, a place — and leave the meaning to whoever reads it.
//
// Pure: a reading is a function of the round's states and events. It reads the record and never feeds the rules.

import type { ContentRegistry } from "../../content/index.ts"
import type { ConstructItem } from "../../build/types.ts"
import type { DomainEvent } from "../../events/types.ts"
import type { MatchState } from "../../state/types.ts"
import type { Side } from "../types.ts"
import type { AdvanceReading } from "./advance.ts"
import { readAdvance } from "./advance.ts"
import type { ArmyReading } from "./army.ts"
import { readArmy } from "./army.ts"
import type { BuildingsReading } from "./buildings.ts"
import { readBuildings } from "./buildings.ts"
import { roundContext } from "./context.ts"
import type { DamageReading } from "./damage.ts"
import { readDamage } from "./damage.ts"
import type { Engagement } from "./engagements.ts"
import { readEngagements } from "./engagements.ts"

export type { Composition } from "./context.ts"
export type { AdvanceReading } from "./advance.ts"
export type { ArmyReading } from "./army.ts"
export type { BuildingsReading, Damaged } from "./buildings.ts"
export type { DamageReading } from "./damage.ts"
export type { Engagement, EngagementSide } from "./engagements.ts"
export { ENGAGEMENT_QUIET, ENGAGEMENT_REACH } from "./engagements.ts"
export type { Score } from "./score.ts"
export { scoreOf } from "./score.ts"
export { nameOf, namedCounts, readingLines, roundReadingLines, scoreLine } from "./lines.ts"

/** One reading as a round plays: shown each tick's state and events, it gives its value at the end. */
export type Tracker<T> = Readonly<{ step: (state: MatchState, events: readonly DomainEvent[]) => void; done: (end: MatchState) => T }>

/** What one side's Battle Round said. */
export type SideReading = Readonly<{
  army: ArmyReading
  buildings: BuildingsReading
  advance: AdvanceReading
  damage: DamageReading
}>

/** A Battle Round, read: where the sides fought (`engagements`, in order), and each side's reading. */
export type RoundReading = Readonly<{ engagements: readonly Engagement[]; sides: Readonly<Record<Side, SideReading>> }>

/** A reader a round is played through: shown each state and its events, it gives the reading at the end. */
export type RoundReader = Readonly<{ step: (state: MatchState, events: readonly DomainEvent[]) => void; reading: (end: MatchState) => RoundReading }>

/** **A round's reader**, from the round's opening, each side's content and each side's build menu (what things cost). */
export function roundReader(
  start: MatchState,
  sides: Readonly<Record<Side, ContentRegistry>>,
  catalogs: Readonly<Record<Side, readonly ConstructItem[]>>,
): RoundReader {
  const { context, step } = roundContext(start, sides, catalogs)
  const army = readArmy(context, start)
  const buildings = readBuildings(context)
  const advance = readAdvance(context, start)
  const damage = readDamage(context)
  const engagements = readEngagements(context)
  const trackers: readonly Tracker<unknown>[] = [army, buildings, advance, damage, engagements]
  return {
    step(state, events) {
      step(events)
      for (const tracker of trackers) tracker.step(state, events)
    },
    reading(end) {
      const read = { army: army.done(end), buildings: buildings.done(end), advance: advance.done(end), damage: damage.done(end) }
      const side = (which: Side): SideReading => ({ army: read.army[which], buildings: read.buildings[which], advance: read.advance[which], damage: read.damage[which] })
      return { engagements: engagements.done(end), sides: { A: side("A"), B: side("B") } }
    },
  }
}
