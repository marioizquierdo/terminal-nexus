# Terminal Nexus — content interfaces

_How units, structures, factions and armies are described to the engine: declarative TypeScript definitions, composable capabilities, and the seams left open for modding._

## 1. Content interfaces

**Content is TypeScript-first and declarative** (RULE — `src/content/types.ts`). A unit, structure or
attack is a data record the kernel reads (`ContentDef` and its attack, detonation and spawn shapes),
registered by id in a content registry (`src/content/index.ts`); behaviour comes from capabilities
and bounded rule shapes on the record, never from code written per unit.

**A Grid Nexus is a flag on a content definition**, never a content id the kernel recognises (RULE —
`tests/ravel.test.ts`, `src/pulse/victory.ts`); see
[`pulse.md`](pulse.md).

**Modding is a set of seams, not a feature**: keep the places a mod would plug in (definitions are
data, the registry is built from a list, the kernel takes the registry as an argument) but build no
loader and no stable SDK (RULE — `AGENTS.md`, which forbids building a mod loader).

The interfaces below are sketches. Names and shapes will change the first time real content touches
them, and that is expected; the shape built today is `ContentDef` in `src/content/types.ts`.
The content built so far is the bench rosters (Citizen, Ravel and Proving Grounds, used by the tests and
the engine tool) and the starter map's catalog; none of it is a Commander Army.
**Do not build these interfaces before content needs them.**

```ts
type ContentId = string
type EntityId = string
type Tick = number
type Rational = Readonly<{ numerator: number; denominator: number }>
type ResourceCost = Readonly<Record<ContentId, number>>

interface UnitDefinition {
  readonly id: ContentId
  readonly layer: "workers" | "units" | "air"
  readonly roleTags: readonly string[]
  readonly footprint: Footprint
  readonly maxHealth: number
  readonly supply: number
  readonly movementRate: Rational
  readonly speedTier: number
  readonly attack?: ContentId
  readonly capabilities: readonly ContentId[]
  readonly presentation: ContentId
}

interface AttackDefinition {
  readonly id: ContentId
  readonly range: number
  readonly damage: number
  readonly speedTier: number
  readonly cooldownTicks: number
  readonly targetRules: readonly ContentId[]
  readonly presentationCue: ContentId
}

interface StructureDefinition {
  readonly id: ContentId
  readonly roleTags: readonly string[]
  readonly level: 1 | 2 | 3
  readonly footprint: Footprint
  readonly maxHealth: number
  readonly cost: ResourceCost
  readonly buildRadius?: number
  readonly storage?: number
  readonly supply?: number
  readonly workerSlots?: number
  readonly production?: ProductionRecipe
  readonly attack?: ContentId
  readonly presentation: ContentId
}

interface ProductionRecipe {
  readonly output: ContentId
  readonly quantity: number
  readonly cost: ResourceCost
  readonly intervalTicks: number
  readonly spawnRule: ContentId
}
```

The sketch's `buildRadius` is built as `constructionRadius` on `ContentDef`: every building the player places
has one, the kernel never reads it, and while the "Build range" Experiment is felt its value stands in for
each ([`pulse.md`](pulse.md), construction territory).

Beside it, `clearance`: the room a building that makes units keeps free round it (the Barracks and the
Hatchery have one, of one tile); the kernel never reads it either, and while the "Barracks room" Experiment is
felt its value stands in for each ([`pulse.md`](pulse.md), room round a building that makes units).

The recipe the Pulse runs today (`ProductionRecipe` in `src/content/types.ts`) is the free part of this one,
in waves: `output`, `perWave`, `waves` (a cap that stands in for the supply a recipe will one day need),
`firstTicks` and `intervalTicks`, the gap between waves. `cost` and `spawnRule` arrive with the worker
economy. No content definition carries a recipe; a battle opts a building in from what its card in the army
spawns (see "Automatic production" in [`pulse.md`](pulse.md)).

Upgrades, Nexus powers, Commanders, and Commander Armies follow the same pattern and are described in
[`commander-armies.md`](../game-design/commander-armies.md). A Commander today is a unit whose content says so
(`commander: true`, Vasse in `src/content/commanders.ts`), which only the rules between rounds read (see
"Commander" in [`pulse.md`](pulse.md)). A **Commander Army** is the playable content boundary:
the complete set of choices legally available to one player in one match — a Nexus and faction, a
Commander, starting units and structures, blueprints and a tech tree, upgrades, Nexus powers, and
Specials, bounded against its faction's pools (same document). The match, the Pulse, and every
renderer see an army; none of them ever sees a faction. What is built of one is smaller, and written as
data in an army folder: the buildings and Nexus powers a player may be offered, a Commander, and a campaign
whose levels each offer what it has unlocked by then.

**An army is data, not code** (RULE — `armies/`, `src/armies/`, `tests/armies.test.ts`). An army is a folder
under `armies/` holding an `army.json`: its id and title, the armies it `requires`, `notes`, and any of five
sections — `content` (the content ids it brings to the Grid), `buildings` (a structure, its cost and, for one
that makes units, what it spawns in each battle: `spawns`, the unit, how many a wave, how many waves a round
and the seconds between waves, each a whole number above zero), `powers` (a Nexus power's name, its one line
and its effect), `commanders` (a name, her unit, and her `barks`: a few lines for each moment of a Battle
Round she answers, refused by name for a moment no Commander speaks at, a moment with no lines, or a line that
says nothing or does not fit the panel's feed or one row of the map at 80 × 24) and `campaigns` (a Commander
and her levels in the order they are played, each with a map by name, its credits, what it unlocks and its
mission). **An army sees what it and the armies it requires bring, directly or through another, and nothing
else**, so content forms a tree with a campaign at the top: its levels, then the cards and units they use,
from its own army or one beneath it. `armies/all` holds the buildings and Nexus powers any Commander may use;
`armies/vasse` requires it and holds her Commander and her campaign (the owner's names, 2026-10-04: "call the
folder armies/vasse and armies/all"). The loader (`src/armies/load.ts`, pure: the content registry and the map
table are its arguments) refuses a broken army with every problem at once, each naming where by ids
(`campaigns[vasse].levels[vasse-test-2].mission.pulses`), and freezes what it hands the game. The kernel never
reads an army; the Build Phase's assembly reads what a level offers.

Still code, each named by id from an army: the content definitions themselves (stats and footprints, in
`src/content`; moving them into the armies is the next step), what a Nexus power's effect kinds do, the
maps (`src/build/maps.ts`: the starter map, and open ground, the Ground test's) and the mission vocabulary (`src/mission/`). The game reads only the
armies `src/armies/index.ts` lists, imported with the code: there is no mod loader looking for folders on
disk. **To add a Commander**: a folder requiring `all`, her unit's id in `content`, her `commanders` entry (with her barks, for her to speak in battle), a
campaign whose levels unlock `all`'s cards or her own, and one line in that list.

Prefer composable capabilities — health, movement, attack, production, storage, supply, worker slots,
radius, restoration, regroup anchor — over inheritance. Exceptional behaviour may register narrow
hooks that receive read-only context and return intents for the kernel to validate. A hook API
protects engine integrity; it is **not** a security sandbox, and installed TypeScript is arbitrary
local code. No hook API is built (**IDEA**).
