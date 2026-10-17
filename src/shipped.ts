// What the game ships: its army and campaign files, as plain JSON. Nothing here is checked or resolved, and nothing
// here is code, so both readers can import it without importing each other: the content registry
// (`src/content/army-content.ts`) reads the units and structures the armies define, and the loader
// (`src/armies/index.ts`) checks everything against that registry.
//
// Adding an army is a folder under `armies/` with its `army.json` and one line in `ARMY_FILES`; adding a campaign is a
// folder under `campaigns/` with its `campaign.json` and one line in `CAMPAIGN_FILES`
// (docs/system-design/army-authoring.md). The game reads only the files listed here, imported with the code: there is
// no mod loader looking for folders on disk. The order does not matter: the loader puts each army after the ones it
// requires.

import all from "../armies/all/army.json" with { type: "json" }
import citizen from "../armies/citizen/army.json" with { type: "json" }
import ravel from "../armies/ravel/army.json" with { type: "json" }
import vasse from "../armies/vasse/army.json" with { type: "json" }
import averno from "../armies/averno/army.json" with { type: "json" }
import dob from "../armies/dob/army.json" with { type: "json" }
import vasseCampaign from "../campaigns/vasse/campaign.json" with { type: "json" }
import avernoCampaign from "../campaigns/averno/campaign.json" with { type: "json" }

/** Every army file: the shared one, the factions, then the Commanders. */
export const ARMY_FILES: readonly unknown[] = [all, citizen, ravel, vasse, averno, dob]

/** Every campaign file. */
export const CAMPAIGN_FILES: readonly unknown[] = [vasseCampaign, avernoCampaign]
