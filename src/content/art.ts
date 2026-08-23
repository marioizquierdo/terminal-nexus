// What each piece of content looks like, drawn as rows.
//
// **This lives next to the content definitions and nowhere near the kernel, on purpose.**
// `engine.md` 9.6 is a RULE: "The simulation knows semantic ids such as `unit.worker` and
// `structure.nexus`. **It never knows a glyph.**" So the art is not a field on `ContentDef` — the
// kernel reads those — it is a separate table keyed by the same ids, imported only by the view.
// `tests/architecture.test.ts` asserts `src/pulse` can never reach this file, which is a stronger
// guarantee than the old arrangement had: the glyph table used to live in `src/view/theme.ts`, which
// nothing enforced either way.
//
// What co-locating buys is the other half: a unit's **shape** (`footprint`, in citizen.ts /
// ravel.ts) and its **drawing** are authored in the same folder, and `tests/content.test.ts` fails
// the build if they ever disagree about how big the thing is. Before, a 3x2 structure's six glyphs
// were a flat array in another directory whose length nothing checked.
//
// Rows read north to south, one character per tile, every row the same length as the footprint is
// wide. Case is applied later — player A lower, player B upper (`entityGlyph`) — so author in lower
// case and let ownership do its own work.

/** One entity's body: rows north to south, one character per tile. */
export type UnitArt = readonly string[]

/**
 * Citizens are rounded, contained, engineered — a bracketed chassis holding something. Ravels are
 * angular and forward-leaning, arrowheads pointing the way the energy went
 * (`terminal-nexus-lore.md` Section 8.2). Both vocabularies scale: the Citizen bracket that makes a
 * hauler `(h)` is the same one that makes a Nexus `[=]`, and the Ravel arrowhead that makes a raider
 * `>x<` is the same one under its Nexus.
 */
export const CONTENT_ART: Readonly<Record<string, UnitArt>> = {
  // --- Citizens ------------------------------------------------------------------------------
  "unit.citizen.worker": ["w"],
  "unit.citizen.trooper": ["t"],
  "unit.citizen.marksman": ["m"],
  /** Three tiles of chassis: the brackets are the vehicle, the letter is the crew. */
  "unit.citizen.hauler": ["(h)"],
  /**
   * The 3x3 siege walker. A sealed head over a braced body over legs — the first piece of content
   * big enough that its silhouette, not its letter, is what you recognise at a glance.
   */
  "unit.citizen.colossus": ["[=]", "|c|", "/_\\"],
  /** A domed core over a sealed, bracketed base — the hauler's language at structure scale. */
  "structure.citizen.nexus": [".n.", "[=]"],
  /**
   * Three by two, like both Nexuses — and drawn that way at last. It was declared a single `"b"`
   * while its footprint said 3x2, so all six of its tiles rendered the same letter; the art/footprint
   * agreement test in tests/content.test.ts caught it the first time it ran.
   */
  "structure.citizen.barracks": ["[b]", "|_|"],

  // --- Ravels --------------------------------------------------------------------------------
  "unit.ravel.scav": ["s"],
  "unit.ravel.runner": ["x"],
  "unit.ravel.slinger": ["z"],
  "unit.ravel.fuelwagon": ["v"],
  /** The raider the lore draws as `>x<`: arrowheads saying which way it is going. */
  "unit.ravel.raider": [">x<"],
  /**
   * Ten tiles of welded scrap, and the widest thing on the bench. Arrowheads at both ends of a
   * crowned hull over a bank of treads — the raider's silhouette, three times the size and with
   * enough munitions strapped on to take a city block with it.
   */
  "unit.ravel.leviathan": ["/^l^\\", "<*=*>"],
  /** A jagged canopy over arrowheads radiating from a spark: welded, not engineered. */
  "structure.ravel.nexus": ["/n\\", "<*>"],
  /** The Ravel Nexus's language one size down and a lot cheaper: same jaw, no spark. */
  "structure.ravel.den": ["/d\\", "<_>"],
}

/** The art for a content id, or `undefined` for content nobody has drawn yet. */
export function artFor(contentId: string): UnitArt | undefined {
  return CONTENT_ART[contentId]
}

/** How many tiles wide and tall a piece of art is. */
export function artExtent(art: UnitArt): { width: number; height: number } {
  return { width: art[0]?.length ?? 0, height: art.length }
}
