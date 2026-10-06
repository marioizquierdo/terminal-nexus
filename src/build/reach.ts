// A reach in plain words: what a card says of an attack's reach, an aura's and the build range, so the shape a
// player reads is the shape the map draws. A terminal cell is about twice as tall as it is wide, and the rule
// the owner chose for it ("rows x2") counts a row as two columns in every distance: a reach of R covers R
// columns to each side and half as many rows up and down, rounded down, so it looks round on screen — and more
// units fit side by side than one behind another. A reach of 1 is touching: hand to hand, or a small blast.
//
// Pure: no view, no state. Every card that states a reach says it here, so the words change in one place if
// the rule does.

/** How many columns a row counts in every distance: a cell is about twice as tall as it is wide. */
const ROW_DISTANCE = 2

/**
 * A reach of `reach` (1 or more), as a card says it: "6 across, 3 up/down" — `reach` columns to each side and
 * `floor(reach / ROW_DISTANCE)` rows up and down — or "touching" for a reach of 1. "up/down" rather than "up
 * and down" because the tallest card at 80 x 24, the Commander's, says her aura's in a sentence with no row to
 * spare (`skillLines`, `src/view/build-card.ts`), and a card says a reach one way.
 */
export function reachShape(reach: number): string {
  if (reach === 1) return "touching"
  return `${reach} across, ${Math.floor(reach / ROW_DISTANCE)} up/down`
}
