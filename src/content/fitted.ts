// A building's own content: the content id a building that carries an upgrade or a mode is given, read and made here
// and nowhere else. No imports, so the art and the card tables read it as freely as the registry does.

/**
 * **What one building carries, in its content id** (commander-armies.md, what changes between rounds): a building's
 * upgrades and the mode it is in are that building's alone, so a building that carries any is given a content id of
 * its own — its base's, then each thing it carries, by the id its army's card gives it, in the order the card declares
 * them: `structure.citizen.barracks+production-line`. Its side's registry resolves that id into the base definition
 * with each one's changes applied (`ContentRegistry.fitter`), so the kernel, the state's hash, the regroup and the opening
 * carry it as they carry any content id, and nothing in the kernel knows a building can be upgraded. A building that
 * carries nothing keeps its base id, so a state with no upgrade or mode in it is exactly the state it always was.
 */
export const FITTED_MARK = "+"

/** The id a fitted id was made from — its building's own content id, as its card and its art know it — or the id
 *  itself, for one that carries nothing. */
export function baseContentId(id: string): string {
  const at = id.indexOf(FITTED_MARK)
  return at < 0 ? id : id.slice(0, at)
}

/** What a fitted id carries, in its order: none for a base id. */
export function fittingsOf(id: string): string[] {
  const parts = id.split(FITTED_MARK)
  return parts.slice(1)
}

/** The content id of `base` carrying `fittings`, in the order given: `base` itself for none. */
export function fittedId(base: string, fittings: readonly string[]): string {
  return fittings.length === 0 ? base : [base, ...fittings].join(FITTED_MARK)
}

