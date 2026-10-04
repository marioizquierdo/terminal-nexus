// A mission as data — campaigns.md: "a sequence of Build Phase / Nexus Pulse cycles driven
// by triggers", a trigger being "a condition, and the actions taken when it holds".
//
// This file is the **simulation band**, built at the size PERIMETER needs — `spawn`, `order`, `commitPlan`,
// `win`, `lose` — the **presentation band** at its smallest — `say`, a line of dialog when a round's Build
// Phase opens — and the four conditions its trigger list uses. The shapes follow the sketch in
// campaigns.md (`{ pulse: 1, tick: 0 }`, `{ event: "pulse.end", pulse: 3 }`, `{ spawn: {...} }`)
// so that sketch and this file read alike. **A mission never contains a function**
// (missions are declarative triggers, not a scripting API; whether that stays true is an open question,
// Q39, answered: declarative triggers): the vocabulary grows here, in code, one typed kind at a time, and a mission is only ever these
// literals — which is what lets `validate.ts` check every
// reference before anything runs, and a replay re-derive every action from the mission, the seed and the
// plans.
//
// A mission is written as JSON in its campaign's bundle (`bundles/<id>/bundle.json`, read by `src/bundles`), so
// what a TypeScript comment once said about a choice is said in `notes` — on the mission, a region or a trigger —
// which nothing reads. The bundle loader checks a mission's JSON against these shapes first
// (`src/bundles/mission-shape.ts`): a kind added to the vocabulary here is added there too, or it is refused.
//
// Pure data: nothing here imports the kernel, so the Build Phase may read a mission's shape without ever
// reaching `src/pulse` (tests/architecture.test.ts).

import type { Coord } from "../grid/types.ts"
import type { PlayerId } from "../state/types.ts"

/** A named rectangle of the map — where a group arrives, or what an order points at. Inclusive of its
 *  top-left tile, `width` by `height` tiles. */
export type Region = Readonly<{
  id: string
  x: number
  y: number
  width: number
  height: number
  /** Why it is where it is: for whoever edits the mission, never read. */
  notes?: string
}>

/**
 * When a trigger holds. Evaluated on canonical state and events only — never on anything drawn.
 *
 * - `{ pulse, tick }` — a moment in a Pulse. Tick 0 is the Pulse's opening state: what arrives then is
 *   there when the Pulse starts, and is what the Build Phase before it can show as incoming. A later
 *   tick is applied between two ticks of the kernel.
 * - `{ event: "pulse.end" }` — a Pulse is over (for one Pulse, or every one when `pulse` is absent).
 * - `{ event: "nexus.destroyed", side }` — that side's Grid Nexus stood when the mission began and does
 *   not now. Read at a Pulse's end (the kernel ends a Pulse the moment a Nexus falls).
 * - `{ event: "build.start", pulse }` — that round's Build Phase opens. Only presentation actions run
 *   here (`say`): nothing is resolved between two Pulses, so nothing about the Grid can change then.
 */
export type TriggerCondition =
  | Readonly<{ pulse: number; tick: number }>
  | Readonly<{ event: "pulse.end"; pulse?: number }>
  | Readonly<{ event: "nexus.destroyed"; side: PlayerId }>
  | Readonly<{ event: "build.start"; pulse: number }>

/**
 * What a group does once it is on the Grid. **Only `advance` exists, and today it means what the kernel's
 * one movement rule does — engage the nearest enemy**: the kernel has no order primitive, so the region it
 * names is the stated destination, shown to the player as intention, not a path the kernel steers by
 * (docs/history/reports/2026-09-30-round-loop-and-missions.md). `hold` and `withdraw` wait for that
 * primitive, which is an open question for Mario (Q69).
 */
export type Order = Readonly<{ advance: string }>

/** Units arriving at a region: set down on the free tiles nearest its centre, in the order listed. */
export type SpawnAction = Readonly<{
  spawn: Readonly<{
    side: PlayerId
    /** Content ids and how many of each, in placement order. */
    units: readonly Readonly<{ unit: string; count: number }>[]
    /** A region id. */
    at: string
    /** A name later triggers can `order`, and the preview groups by. */
    group?: string
    order?: Order
    /**
     * One plain line of what this group means to do, shown to the player while it is incoming and on the
     * Explore Map card over any of its units — presentation data the runner never reads (the owner's
     * "optional text that show their intention", 2026-09-30).
     */
    intent?: string
  }>
}>

/** A group already on the Grid is given a new order. */
export type OrderAction = Readonly<{ order: Readonly<{ group: string } & Order> }>

/** A scripted side's Build Phase plan for a Pulse: structures that reveal at its start, like the player's
 *  own. Anchors are north-west tiles, the way the Build Phase stores a placement. */
export type CommitPlanAction = Readonly<{
  commitPlan: Readonly<{
    side: PlayerId
    structures: readonly Readonly<{ contentId: string; anchor: Coord }>[]
  }>
}>

export type WinAction = Readonly<{ win: true }>
export type LoseAction = Readonly<{ lose: true }>

export type SimulationAction = SpawnAction | OrderAction | CommitPlanAction | WinAction | LoseAction

/**
 * What a line of dialog looks at while it is shown — the camera goes there, and the intro highlight lights
 * around it: a unit some trigger brings (by content id: Vasse), a group some trigger spawns (by its name), or
 * a region of the map.
 */
export type SayFocus = Readonly<{ unit: string }> | Readonly<{ group: string }> | Readonly<{ region: string }>

/**
 * **The presentation band, at its smallest** (campaigns.md, "two bands of trigger actions"): a line of
 * dialog, shown in the dialog at the bottom of the screen when the round's Build Phase opens, advanced by the
 * player and skipped by Esc. The trigger runner never reads it, so a mission's lines can never change what
 * its Pulses resolve (`src/match/mission.ts`).
 */
export type SayAction = Readonly<{
  say: Readonly<{
    /**
     * Who says it: the content id of a unit the mission brings — its name, side and glyph then come from
     * the content and the spawn that brings it (`"unit.citizen.vasse"`) — or the name of someone who is not
     * on the Grid (`"Corvane"`).
     */
    speaker: string
    /** Whose side the speaker speaks for — the colour of their name. A unit's own side when absent. */
    side?: PlayerId
    /** The line itself, short enough for the dialog at 80 x 24 (`SAY_LINES` lines of `SAY_COLUMNS`). */
    text: string
    /** Where the camera looks while the line is shown. Absent: it stays where it is. */
    focus?: SayFocus
  }>
}>

export type PresentationAction = SayAction

/** Anything a trigger can do: a simulation action, which the runner applies, or a presentation action,
 *  which only the screen shows. */
export type TriggerAction = SimulationAction | PresentationAction

export type TriggerDefinition = Readonly<{
  id: string
  when: TriggerCondition
  do: readonly TriggerAction[]
  /** Why it does what it does, when it does: for whoever edits the mission, never read. */
  notes?: string
}>

/**
 * One mission: who stands where when it opens, what it brings each Pulse, and how it ends. Deliberately
 * the part of campaigns.md's `MissionDefinition` PERIMETER needs — no opponent army or objectives list yet.
 * What the player may build and draft, the credits and the map are the level's that plays it (a campaign's
 * level in its bundle: `src/bundles`), not the mission's.
 */
export type MissionDefinition = Readonly<{
  id: string
  name: string
  /** How many Pulses the mission plans for. The last one's end must decide the mission. */
  pulses: number
  /** Every Pulse's length in ticks: the kernel's tick limit. */
  pulseTicks: number
  /** The gameplay seed of Pulse 1; later Pulses carry the one stream on from where it stopped. */
  seed: number
  regions: readonly Region[]
  triggers: readonly TriggerDefinition[]
  /** The player's buildings that train during a Pulse, and what each trains (step 6C): the mission's
   *  opt-in to automatic production. How often and how many is the match's to say
   *  (`trainingRegistry`, `src/match/training.ts`); a building not listed trains nothing. */
  trains?: readonly Readonly<{ structure: string; unit: string }>[]
  /** What the Battle Round screen announces for round *n*: the seam where a briefing line for each round goes. */
  roundText?: Readonly<Record<number, string>>
  /** One line the last result says when the mission is won or lost — presentation data, never read by
   *  the runner. */
  endText?: Readonly<{ won: string; lost: string }>
  /** Why the mission is as it is — its tuning, its seed, what it borrows: for whoever edits it, never read. */
  notes?: string
}>

/** A mission that fails validation, with every problem found — not just the first. */
export class MissionError extends Error {
  readonly problems: readonly string[]
  constructor(mission: string, problems: readonly string[]) {
    super(`mission "${mission}" is invalid:\n- ${problems.join("\n- ")}`)
    this.problems = problems
  }
}

/** How a mission stands after a Pulse: it goes on to the next Build Phase, or a trigger ended it. */
export type MissionVerdict =
  | Readonly<{ kind: "continue" }>
  | Readonly<{ kind: "won" | "lost"; trigger: string }>
