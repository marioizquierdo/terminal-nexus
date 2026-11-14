// What each entity became: one line each, hp and tile at the start and at the end of a run. Read from two states, never
// from the kernel, and printed before the report line. The Build Phase's headless run shows this by default: a
// regroup has no events but the spawns, so its mending and its step back show nowhere else. `--end-states` asks for it
// of a Battle Round (grid --help).

import type { ContentRegistry } from "../content/index.ts"
import type { MatchState } from "../state/types.ts"
import { formatCoordinate, formatLine } from "./format.ts"

/** One WARN line per entity of the opening, `end` kind: `hp 100->400  at (3,4)->(3,4)`, or `gone` for one the run lost. */
export function endStateLines(initial: MatchState, final: MatchState, registry: ContentRegistry): string[] {
  const after = new Map(final.entities.map((entity) => [entity.ordinal, entity]))
  return initial.entities.map((before) => {
    const end = after.get(before.ordinal)
    const maxHp = registry.get(before.contentId).maxHp
    const detail =
      end === undefined
        ? `hp ${before.hp}/${maxHp}->0  at ${formatCoordinate(before.anchor)}  gone`
        : `hp ${before.hp}->${end.hp}/${maxHp}  at ${formatCoordinate(before.anchor)}->${formatCoordinate(end.anchor)}${
            before.anchor.x === end.anchor.x && before.anchor.y === end.anchor.y ? "  stayed" : "  moved"
          }`
    return formatLine({ tick: final.tick, level: "warn", kind: "end", subject: before.id, detail })
  })
}
