// What a side earned in a battle, to spend from its next Build Phase: the credits its abilities noted (a bounty's,
// `src/abilities/bounty.ts`). The kernel knows no credits; an ability notes what it earned on an `ability.triggered`
// event, and the rules between rounds add those up for each side here — so an economy that runs on the fight is read
// from the fight's own record, the same way in a campaign and a duel.

import type { DomainEvent } from "../events/types.ts"
import type { PlayerId } from "../state/types.ts"

/** The credits `player`'s abilities earned in a battle, from its events. */
export function creditsEarned(events: readonly DomainEvent[], player: PlayerId): number {
  let credits = 0
  for (const event of events) if (event.kind === "ability.triggered" && event.player === player) credits += event.credits ?? 0
  return credits
}
