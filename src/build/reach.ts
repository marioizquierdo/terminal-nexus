// A reach in plain words: what a card says of an attack's reach, an aura's and the build range, so the shape a
// player reads is the shape the map draws. A row counts two columns in every distance (`src/grid/reach.ts`), so a
// reach of R covers R columns either side and `rowsWithin(R)` rows up and down: as wide as it is tall on screen. A
// reach of 1 is touching: hand to hand, or a small blast.
//
// Pure: no view, no state. Every card that states a reach says it here.

import { rowsWithin } from "../grid/reach.ts"

/**
 * A reach of `reach` (1 or more), as a card says it: "6 across, 3 up/down" — `reach` columns either side and
 * `rowsWithin(reach)` rows up and down — or "touching" for a reach of 1. "up/down" rather than "up and down"
 * because the tallest card at 80 x 24, the Commander's, says her aura's in a sentence with no row to spare
 * (`skillLines`, `src/view/build-card.ts`), and a card says a reach one way.
 */
export function reachShape(reach: number): string {
  if (reach === 1) return "touching"
  return `${reach} across, ${rowsWithin(reach)} up/down`
}
