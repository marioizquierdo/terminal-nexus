// What an ability is: the code a unit's `abilities` entry names by its `kind` (`ContentDef.abilities`), and the
// narrow world the kernel hands it (docs/system-design/army-authoring.md, "Abilities").
//
// An ability is the way a Commander or a unit does something on its own besides fighting — an aura that guards, a
// bounty on what dies near it, a lucky hit — written once as an `AbilityKind` and named by data:
//
//   "abilities": [{ "kind": "aura", "name": "By the Book", "radius": 4, "damageTakenPercent": 75 }]
//
// A kind declares its numbers (`params`, checked when an army file is loaded) and any of the **hooks** below; the
// kernel calls each hook at one fixed moment of a tick, for every living unit that has the ability, in ordinal order:
//
// | hook               | when                                                     | what it may do                      |
// | ------------------ | -------------------------------------------------------- | ----------------------------------- |
// | `damageModifiers`  | once a tick, as the attacks begin, after the moves       | offer units a share of their damage |
// | `hitDealt`         | each attack its bearer makes, before auras               | return what the hit deals instead   |
// | `tick`             | once a tick, after the attacks, before deaths settle      | heal, damage, note, earn credits    |
// | `death`            | once for each unit that died this tick, after the deaths | heal, damage, note, earn credits    |
//
// **An ability never touches the kernel's state itself.** It reads `Body`s (a unit as an ability sees it) and acts
// through `AbilityWorld`, whose every act goes through the kernel's own rules (a heal is the heal rule, a hit is the
// damage rule) and leaves an event behind — so an ability is deterministic, hashed and replayed like everything else:
// whole numbers only, the gameplay stream for chance (`random`), no clock, nothing from presentation.
//
// The kinds the game ships are in `index.ts`. A mod's kinds would be passed beside them where a battle starts
// (`PulseContext.abilities`): the kernel takes its table as an argument; nothing looks for kinds on disk.

import type { Coord, EntityLayer, Footprint } from "../grid/types.ts"
import type { Shape } from "../content/shape.ts"
import type { AbilityUse } from "../content/types.ts"
import type { PlayerId } from "../state/types.ts"

/** A side of the battle: the state's own `PlayerId`. */
export type Side = PlayerId

/** A unit as an ability sees it: who it is, whose, where, and how hurt. Read-only: an ability acts through its world. */
export type Body = Readonly<{
  ordinal: number
  /** Its report id, `A:trooper#3`. */
  id: string
  player: Side
  contentId: string
  hp: number
  maxHp: number
  anchor: Coord
  footprint: Footprint
  layer: EntityLayer
  commander: boolean
}>

/** What an ability can see: the tick, who stands, how far apart. All a hook that only decides (`damageModifiers`) is
 *  handed: it may not act. */
export type AbilityView = Readonly<{
  /** The tick it is. */
  tick: number
  /** Every unit and structure still standing this tick, in ordinal order. */
  bodies: () => readonly Body[]
  /** Whether `b` is within `radius` of `a`, measured as range is: to the nearest tile of each footprint, a row counting
   *  two columns (grid.md). */
  within: (a: Body, b: Body, radius: number) => boolean
}>

/** What an ability can do, through the kernel's own rules. */
export type AbilityWorld = AbilityView &
  Readonly<{
  /** A whole number from 0 to `bound - 1`, from the battle's one gameplay stream: the only chance an ability has. */
  random: (bound: number) => number
  /** Restores `amount` of `target`'s health, never past its most, as a heal from `source` (`heal.applied`). */
  heal: (target: Body, source: Body, amount: number) => void
  /** Deals `amount` to `target` as a hit from `source`, guarded and boosted like any (`damage.applied`); a unit it
   *  brings to nothing dies this tick. */
  damage: (target: Body, source: Body, amount: number) => void
  /**
   * Says the ability did something: an `ability.triggered` event naming the bearer and the ability, and what it
   * touched. With `credits`, the bearer's side earns them, to spend from its next Build Phase (the rules between
   * rounds add them up: `src/match/earnings.ts`).
   */
  note: (bearer: Body, ability: AbilityUse, detail?: Readonly<{ target?: Body; amount?: number; credits?: number }>) => void
  }>

/** How an ability offers the units it covers a share of their damage this tick: what they deal (`"dealt"`), or what
 *  they take (`"taken"`), as a percent of the hit. Several offers never stack: a unit keeps the strongest of each
 *  channel (the largest share dealt, the smallest taken), the first bearer in ordinal order on a tie. */
export type DamageOffer = (unit: Body, channel: "dealt" | "taken", percent: number) => void

/** How a card says what a Commander does: she, he, they. */
export type Pronouns = Readonly<{ subject: string; possessive: string }>

/**
 * One kind of ability: its name as data writes it, the numbers it takes, the line a card says of it, and its hooks.
 * `P` is the whole entry, `{ kind, ...its numbers }`.
 */
export type AbilityKind<P extends AbilityUse = AbilityUse> = Readonly<{
  kind: string
  /** The numbers it takes, checked when the content is loaded: a mistyped or missing number is said there, by path. */
  params: Shape<P>
  /** What a card says of it, one sentence: "By the Book: she and her units within range 4 take 25% less damage." */
  describe: (params: P, pronouns: Pronouns) => string
  /** How far it reaches, for the view to draw round its bearer; `null` when it reaches nowhere in particular. */
  reach?: (params: P) => number | null
  damageModifiers?: (bearer: Body, params: P, view: AbilityView, offer: DamageOffer) => void
  hitDealt?: (bearer: Body, target: Body, amount: number, params: P, world: AbilityWorld) => number
  /** A healing pulse, a slow burn, a building that mends what stands near it. */
  tick?: (bearer: Body, params: P, world: AbilityWorld) => void
  death?: (bearer: Body, dying: Body, killer: Body | null, params: P, world: AbilityWorld) => void
}>

/** The ability kinds a battle knows, by kind. */
export type AbilityTable = Readonly<Record<string, AbilityKind>>
