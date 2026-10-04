// The browser playtest page's address: what a direct link after `#` asks for. Kept apart from `host.ts`, the one
// file that touches the DOM, so a test can read an address the way the page does.
//
//   #at=<route>          where to open, in the game's route grammar (`src/cli/route.ts`): `#at=settings`,
//                        `#at=campaign?level=vasse-test-1&round=3`
//   #settings=<text>     a settings text to start a campaign level with, as `--settings` takes it:
//                        `#settings=nextRound=auto&trainEvery=6`
//   #keys=<key script>   keys to play first on a campaign level, as `--keys` takes them: `#keys=Esc n 1`
//
// Joined by `&`: `#at=campaign?level=vasse-test-1&round=2&settings=trainEvery=6&keys=Esc`. **A route and a
// settings text have `&` and `=` of their own**, so a part runs until the next `&at=`, `&settings=` or `&keys=`,
// not until the next `&`: everything between belongs to it, written as plainly as on a command line. Each part
// may also be percent-encoded, as an address often is (`%20` for a space, `%26` for an `&` inside a part).
//
// A local copy of the page takes any such address. **A link on claude.ai cannot carry a `#` part with `=` in it**,
// so a published page opens at a place through a demo button instead (a demo's `at`, `scripts/build-web.mjs`).

/** The parts an address may have, in the order a link usually writes them. */
export const ADDRESS_PARTS = ["at", "settings", "keys"] as const

export type AddressPart = (typeof ADDRESS_PARTS)[number]

/** What an address asks for: each part it has, decoded. */
export type Address = Readonly<Partial<Record<AddressPart, string>>>

const PART_START = new RegExp(`(?:^|&)(${ADDRESS_PARTS.join("|")})=`, "gu")

/** A part percent-decoded, or as written when it is not valid percent-encoding (a lone `%`). */
function decoded(text: string): string {
  try {
    return decodeURIComponent(text)
  } catch {
    return text
  }
}

/** The parts of `hash` (`window.location.hash`, with or without its `#`). The first of a repeated part counts;
 *  anything before the first part the page knows is ignored. */
export function readAddress(hash: string): Address {
  const text = hash.startsWith("#") ? hash.slice(1) : hash
  const starts = [...text.matchAll(PART_START)]
  const address: Partial<Record<AddressPart, string>> = {}
  starts.forEach((match, index) => {
    const name = match[1] as AddressPart
    const from = (match.index ?? 0) + match[0].length
    const to = starts[index + 1]?.index ?? text.length
    if (address[name] === undefined) address[name] = decoded(text.slice(from, to))
  })
  return address
}
