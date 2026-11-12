// The script profiles and example saves the game ships, imported with the code as plain JSON — the way
// `src/shipped.ts` carries the army files — so the browser page, which has no files to read, offers the same profiles
// on its setup screen and the same examples on its Load game as the terminal does. The terminal reads `players/` and
// `saves/` from disk (`./profile-files.ts`, `src/cli/skirmish-files.ts`), which also finds a profile a person adds;
// `tests/setup-screen.test.ts` holds this list to exactly the files on disk, so a profile added there and not here fails.

import agro from "../../players/scripts/agro.json" with { type: "json" }
import agroRich from "../../players/scripts/agro-rich.json" with { type: "json" }
import defensive from "../../players/scripts/defensive.json" with { type: "json" }
import steady from "../../players/scripts/steady.json" with { type: "json" }
import crossingNew from "../../saves/crossing-new.save.json" with { type: "json" }
import crossingRound4 from "../../saves/crossing-round-4.save.json" with { type: "json" }
import mirrorVasse from "../../saves/mirror-vasse.save.json" with { type: "json" }
import pocketShort from "../../saves/pocket-short.save.json" with { type: "json" }
import type { Profiles, ScriptProfile } from "./save.ts"

/** Every script profile `players/scripts/` ships, by name. */
export const SHIPPED_PROFILES: Profiles = new Map<string, ScriptProfile>([
  ["agro", agro],
  ["agro-rich", agroRich],
  ["defensive", defensive],
  ["steady", steady],
])

/** Every example save `saves/` ships, by its path from the repository's root, as text a save is read from. */
export const SHIPPED_SAVES: ReadonlyMap<string, string> = new Map([
  ["saves/crossing-new.save.json", JSON.stringify(crossingNew)],
  ["saves/crossing-round-4.save.json", JSON.stringify(crossingRound4)],
  ["saves/mirror-vasse.save.json", JSON.stringify(mirrorVasse)],
  ["saves/pocket-short.save.json", JSON.stringify(pocketShort)],
])
