// The JSON shape of a mission (`src/mission/types.ts`), for the loader to check before anything reads one:
// every field of the right kind, every trigger's condition and actions in the vocabulary, and nothing
// misspelt. Whether the mission makes sense — its regions on the map, its groups spawned before they are
// ordered, its lines short enough for the dialog — is `validateMission`'s, which runs once the shape holds.
//
// Each object's shape is typed against its type in `src/mission/types.ts`, so a field added there does not
// compile until it is added here; an action or a condition added to the vocabulary is added here too, or the
// loader refuses it by name.

import type { Coord } from "../grid/types.ts"
import type {
  CommitPlanAction,
  MissionDefinition,
  Order,
  OrderAction,
  Region,
  SayAction,
  SpawnAction,
  TriggerAction,
  TriggerCondition,
  TriggerDefinition,
} from "../mission/types.ts"
import type { PlayerId } from "../state/types.ts"
import type { Say, Shape } from "./shape.ts"
import { dictionary, fieldAt, isObject, keyed, list, literal, number, record, shown, text } from "./shape.ts"

const side: Shape<PlayerId> = literal("A", "B")

const coord: Shape<Coord> = record<Coord>({ x: number, y: number }, {})

const region: Shape<Region> = record<Region>({ id: text, x: number, y: number, width: number, height: number }, { notes: text })

/** The four conditions: a moment (`{ pulse, tick }`), or an event, which names which. */
const condition: Shape<TriggerCondition> = (() => {
  const moment = record<Readonly<{ pulse: number; tick: number }>>({ pulse: number, tick: number }, {})
  const events: Readonly<Record<string, Shape<TriggerCondition>>> = {
    "pulse.end": record<Readonly<{ event: "pulse.end"; pulse?: number }>>({ event: literal("pulse.end") }, { pulse: number }),
    "nexus.destroyed": record<Readonly<{ event: "nexus.destroyed"; side: PlayerId }>>({ event: literal("nexus.destroyed"), side }, {}),
    "build.start": record<Readonly<{ event: "build.start"; pulse: number }>>({ event: literal("build.start"), pulse: number }, {}),
  }
  return {
    name: "a condition",
    check(value: unknown, at: string, say: Say): value is TriggerCondition {
      if (!isObject(value) || !Object.hasOwn(value, "event")) return moment.check(value, at, say)
      const shape = typeof value["event"] === "string" ? events[value["event"]] : undefined
      if (shape !== undefined) return shape.check(value, at, say)
      const known = Object.keys(events).map((event) => `"${event}"`).join(", ")
      say(`${fieldAt(at, "event")} should be one of ${known}, not ${shown(value["event"])}`)
      return false
    },
  }
})()

const order: Shape<Order> = record<Order>({ advance: text }, {})

const spawn: Shape<SpawnAction["spawn"]> = record<SpawnAction["spawn"]>(
  {
    side,
    units: list(record<Readonly<{ unit: string; count: number }>>({ unit: text, count: number }, {})),
    at: text,
  },
  { group: text, order, intent: text },
)

const orderAction: Shape<OrderAction["order"]> = record<OrderAction["order"]>({ group: text, advance: text }, {})

const commitPlan: Shape<CommitPlanAction["commitPlan"]> = record<CommitPlanAction["commitPlan"]>(
  { side, structures: list(record<Readonly<{ contentId: string; anchor: Coord }>>({ contentId: text, anchor: coord }, {})) },
  {},
)

const sayLine: Shape<SayAction["say"]> = record<SayAction["say"]>(
  { speaker: text, text },
  { side, focus: keyed("a focus", { unit: text, group: text, region: text }) },
)

const action: Shape<TriggerAction> = keyed("an action", {
  spawn,
  order: orderAction,
  commitPlan,
  win: literal(true),
  lose: literal(true),
  say: sayLine,
})

const trigger: Shape<TriggerDefinition> = record<TriggerDefinition>({ id: text, when: condition, do: list(action) }, { notes: text })

/** What the Battle Round screen announces for each round, keyed by the round's number. */
const roundText = dictionary(text) as Shape<Readonly<Record<number, string>>>

/** A whole mission's shape. */
export const missionShape: Shape<MissionDefinition> = record<MissionDefinition>(
  {
    id: text,
    name: text,
    pulses: number,
    pulseTicks: number,
    seed: number,
    regions: list(region),
    triggers: list(trigger),
  },
  {
    trains: list(record<Readonly<{ structure: string; unit: string }>>({ structure: text, unit: text }, {})),
    roundText,
    endText: record<Readonly<{ won: string; lost: string }>>({ won: text, lost: text }, {}),
    notes: text,
  },
)
