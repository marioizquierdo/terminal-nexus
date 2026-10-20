// A shove (milestone 16, a Grid that changes): every `everyTicks` ticks, each enemy unit touching the bearer is pushed
// `tiles` tiles straight away from it. A bench ability, the test of the kernel's rule for a unit that did not walk
// (`displace`, `src/pulse/shared.ts`), so the first Nexus power or unit that pushes has it ready: a pushed unit stops
// where its body would not fit, and walks on from where it lands.

import type { Shape } from "../content/shape.ts"
import { literal, positiveWholeNumber, record, text } from "../content/shape.ts"
import type { AbilityKind } from "./types.ts"

/** A shove's numbers: its name on a card, how far it pushes, and how often. */
export type Shove = Readonly<{ kind: "shove"; name: string; tiles: number; everyTicks: number }>

const params: Shape<Shove> = record<Shove>({ kind: literal("shove"), name: text, tiles: positiveWholeNumber, everyTicks: positiveWholeNumber }, {})

export const SHOVE: AbilityKind<Shove> = {
  kind: "shove",
  params,
  describe: (shove) => `${shove.name}: every ${shove.everyTicks / 12} seconds, enemies touching it are pushed ${shove.tiles} tiles away.`,
  reach: () => 1,
  tick: (bearer, shove, world) => {
    if (world.tick % shove.everyTicks !== 0) return
    for (const body of world.bodies()) {
      if (body.player === bearer.player || body.layer === "obstacles" || !world.within(bearer, body, 1)) continue
      world.push(body, bearer, shove.tiles)
      world.note(bearer, shove, { target: body })
    }
  },
}
