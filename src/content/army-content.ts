// The units and structures the army files define as data (`src/content/data.ts`), each split into its three parts:
// the definition the kernel reads, the words its card says, and the glyph that draws it. The registry takes the
// definitions (`./index.ts`), the card table the words (`./cards.ts`) and the art table the glyphs (`./art.ts`), so
// a unit written in an army file is drawn, named and fought with like one written in TypeScript.
//
// An entry that does not have its shape is left out here; the army loader refuses the armies and says why, every
// problem at once (`src/armies/load.ts`), so a broken entry never reaches a battle.

import { ARMY_FILES } from "../shipped.ts"
import type { CardText } from "./cards.ts"
import type { Glyph } from "./data.ts"
import { definitionOf, entriesOf } from "./data.ts"
import type { ContentDef } from "./types.ts"

/** A unit or a structure an army file defines: what the kernel reads, what its card says, how it is drawn. */
export type ArmyContent = Readonly<{ definition: ContentDef; card: CardText; glyph: Glyph }>

/** Everything the shipped army files define, in the order they list it. */
export const ARMY_CONTENT: readonly ArmyContent[] = entriesOf(ARMY_FILES).map((entry) => ({
  definition: definitionOf(entry),
  card: entry.card,
  glyph: entry.glyph,
}))
