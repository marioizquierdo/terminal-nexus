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
  /**
   * Two by two, between the trooper and the hauler in scale as well as in the roster. A sealed
   * turret over two struts - the bracket vocabulary at its smallest multi-tile size, still reading
   * as "contained" rather than "vehicle" the way the hauler's open `(h)` does.
   */
  "unit.citizen.sentinel": ["[]", "||"],

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
  /** A single chevron - the Ravel arrowhead vocabulary reduced to one flying tile, wings up. */
  "unit.ravel.buzzard": ["^"],
  /**
   * Two tiles of raiding hull: a cockpit meeting an engine flare, arrowheads pointed at each other
   * the way the leviathan's are pointed apart - small enough that this is the whole ship, not a
   * fragment of a bigger one.
   */
  "unit.ravel.corsair": ["<>"],
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

/**
 * A short, ordered sequence a content id may define for its own death — owner playtest, 2026-08-23:
 * "Consider a dead animation, the unit itself can define a few frames for that. A combination of
 * effects and a dead animation could really make it snap, specially for those large units." Optional
 * and purely additive: content with no entry here keeps the plain per-tile debris `fx.death.collapse`
 * has always drawn, unanimated. Each frame is a `UnitArt` the same size as the content's footprint —
 * `tests/content.test.ts` enforces that the same way it does for `CONTENT_ART` — and a space in a
 * frame means "nothing here in this frame", not a literal blank glyph: `src/view/effects/recipes.ts`
 * falls back to the generic debris fill for that one tile rather than painting a hole.
 *
 * Read only by `fx.death.collapse` (`src/view/effects/recipes.ts`), never by the kernel: the same
 * boundary `CONTENT_ART` already draws, for the same reason (engine.md 9.6 — the simulation never
 * knows a glyph, and a death frame is exactly that, played over time).
 */
export const DEATH_ART: Readonly<Record<string, readonly UnitArt[]>> = {
  /**
   * Crack, then topple, then rubble - the sealed head fails first (an `x` where the `=` core sat),
   * the frame sags without it, and what is left settles into the same debris vocabulary a 1x1
   * death already uses (`=`), just arranged like something that used to stand.
   */
  "unit.citizen.colossus": [
    ["[x]", "|=|", "/_\\"],
    [" x ", "\\=/", "/-\\"],
    [" . ", ".=.", "..."],
  ],
  /**
   * The crowned hull's own arrowhead becomes the wound (`^X^`), the hull buckles inward, and the
   * wreck that is left is the Ravel debris vocabulary (`*`, `,`) with nothing left standing tall
   * enough to still read as a vehicle - true to the doctrine even in death: it does not fall over,
   * it comes apart.
   */
  "unit.ravel.leviathan": [
    ["/^X^\\", "<*=*>"],
    [" \\*/ ", "<***>"],
    [" ,*, ", ",,*,,"],
  ],
  /** The sealed turret cracks, the struts buckle, and what is left is rubble - the same three-beat
   *  shape as the colossus's, one size down. */
  "unit.citizen.sentinel": [
    ["[x", "||"],
    [" =", "-|"],
    [" .", ".."],
  ],
  /** The hull the corsair's own arrowheads met in life comes apart into the spark and scatter that
   *  end every Ravel death - the first character falls through to the generic fill on the final
   *  frame, so the ring debris (fx.death.collapse's own scaling) finishes what the ship started. */
  "unit.ravel.corsair": [["<*"], [" ,"]],
}

/** The death-frame sequence for a content id, or `undefined` for content that has none authored. */
export function deathFramesFor(contentId: string): readonly UnitArt[] | undefined {
  return DEATH_ART[contentId]
}
