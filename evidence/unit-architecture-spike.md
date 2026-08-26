# Unit-design-architecture spike — evidence and audit

**What this is:** not a gate report — this is not Gate 1B work, and nothing here is Commander Army
authoring. Mario asked directly, in session, for an architecture stress test: try to add a batch of
new unit designs as real, running content, and find out where `ContentDef`, the content registry, and
the existing kernel rules absorb them cleanly and where they don't. That finding is the deliverable.
The roster itself — `src/content/proving-grounds.ts` — is disposable bench content, exactly the same
status as the Citizen and Ravel fixtures beside it. `commander-armies.md` still reserves real rosters
for Milestone 4; nothing here is authorized as canon and nothing here should be read as one.

Format follows `commander-armies.md` Section 1's own audit ("what they proved is worth carrying
forward") rather than `specs/templates/gate-report.md` — this isn't a gate, so that template's shape
doesn't fit.

## Fourteen designs, in order

Fourteen counts the seven Mario named directly plus seven more sketched from Clash of Clans/Clash
Royale-style asymmetries; thirteen were built as real, running content with a scenario and a
screenshot, one was deliberately not built and is named as a gap instead (see the end of this
section). For each: the ask, whether it absorbed as plain `ContentDef` data, and — if not — the
smallest capability that closed the gap.

### 1. Skyraider / Grunt / Flak trooper — the ground-air asymmetry

*"Flying unit goes to the nearest enemy and starts shooting and following. Ground units cannot reach
air."*

**Needed a new capability.** The flying half needed nothing: `layer: "air"`, `collidesWith: ["air"]`,
a normal `attack`, `behavior: "advance"` — the exact recipe `unit.ravel.buzzard` already proved in
Gate 1B. The "ground cannot reach it" half is where the gap was, and it was a real gap, not a
hypothetical one: Q8 in `open-questions.md` deliberately lets an air entity share a tile with a ground
one, and nothing in `attacks()` ever checked layer compatibility before this session. A ground melee
unit standing on the same tile as a flyer was already, silently, in melee range of it.

The fix: `ContentDef.targetLayers?: readonly EntityLayer[]` — a hard restriction on which layers an
entity may perceive as viable targets, read by `perception.ts`'s candidate filtering before either an
`attack` or a contact `detonation` ever resolves against whatever it decided. Undefined means every
layer, so every existing Citizen and Ravel definition is untouched and every existing hash is
unaffected — opt-in, not a new default. `unit.bench.grunt` sets it to exclude `"air"`;
`unit.bench.flaktrooper` is an otherwise ordinary ranged unit with the field simply left unset, proving
the counter-play costs nothing new either.

Scenario: `bench-sky-ground-asymmetry.map.json`. The grunt never emits a single `target.selected`
event — it isn't stuck, it isn't bugged, it simply never perceives an enemy it could reach — while the
flak trooper engages normally. Screenshot: `evidence/screenshots/bench-sky-ground-asymmetry.png`.

### 2. Spitter — contact detonation, the baneling rule shape

*"Ground unit that explodes to deal radius damage (like banelings)."*

**Needed a new capability**, and deliberately not the same one Ravel's runner already has. A Ravel
runner detonates because something else killed it while it was fighting normally — three of the four
Ravel rule shapes needed nothing from the kernel, and `detonation` (the fourth) was already built.
Reusing it for the spitter without change would have proven nothing new: a true baneline never fights
at all, it chooses to die the instant it is close enough. That choice needed a real hook: could a unit
carrying no `attack` self-destruct as a decision rather than a consequence?

The fix: `Detonation.triggerRange?: number`. When set, a unit with a resolved target inside that
range marks itself `pendingDead` during the attack phase (tier-ordered, exactly like every other
attack this tick) — nothing more. `resolution()` (death.ts, phase 8) already knows how to run an
entity's `detonation`; contact detonation only had to decide *when* to ask for it, not build a second
blast mechanism. `unit.bench.spitter` has `detonation` and no `attack` at all.

Scenario: `bench-spitter-contact.map.json`. Spitter deaths show `killer: null` in their `entity.died`
event — proof the death was self-chosen, not inflicted — distinguishing this rule shape from Ravel's
death-only one in the event log itself, not just in a design document.

### 3. Medic — ally-seeking support, the biggest gap on the bench

*"Healer unit."*

**Needed the largest new capability of the thirteen.** Every existing `Behavior` seeks the nearest
*hostile*; nothing sought an ally, and nothing turned a positive number into more health instead of
less. This touched real breadth: a fourth `Behavior` value (`"support"`), a third `AttackKind`
(`"heal"`), a new `applyHeal` (shared.ts, `applyDamage`'s mirror — clamped at `maxHp`, never kills),
and a new event kind, `heal.applied`, rather than a negative `damage.applied` — because a heal is a
different *meaning*, not just a different sign (engine.md 7's own words for why events exist at all).

What it did **not** need, once perception's ally-list existed: `intents.ts`'s "move toward target,
hold and act in range" logic is already generic over any resolved target, hostile or ally, so a
healer's movement needed zero new code; `arbitration.ts`'s `flee`-vs-`toward` branch already defaults
"support" to "toward" correctly. The only real branch point was `attacks()` routing a `"heal"`-kind
hit to `applyHeal` instead of `applyDamage`.

The medic is a flyer on purpose (Clash of Clans' own Healer is), so its scenario doubles as an
integration check for design 1: does ally-seeking compose with the ground-air asymmetry, or does it
need its own version of the same fix? It didn't — `bench-medic-support.map.json` fields a grunt
(cannot touch the medic) and a flak trooper (can) against it, unchanged from design 1's own pairing.
Screenshot: `evidence/screenshots/bench-medic-support.png`.

### 4. Hatchery / Spawnling — a combat-only spawn primitive

*"Spawner, large unit that creates smaller units."*

**Needed the most invasive new capability**, and the one this session watched most carefully against
AGENTS.md's standing prohibition on building production before Milestone 2. Nothing in the kernel
could create an entity after tick 0 before this session — `MatchState.nextOrdinal` existed, unused,
precisely because nobody had needed it yet.

The fix, scoped deliberately narrow: `ContentDef.spawn?: { contentId, intervalTicks, maxAlive }`, a new
`src/pulse/spawn.ts` with a `spawning()` pass run once per tick (numbered "1.5" in `tick.ts`'s own
comment — not a claim on an `engine.md` 4.3 phase number, which stays exactly nine), and three new
`EntityState` fields (`windup`, `spawnCooldown`, `focusStreak` — see designs 6 and 7 below for the
other two). No cost, no resource, nothing the empty `economyAndProduction` phase would recognise as
its own: this is a combat ability a living unit performs, the same shape as a Clash Royale Graveyard
or a StarCraft Broodmother, not the economy Milestone 2 still owns. Whether that framing actually holds
once a real roster wants it is registered as **Q26**, not decided here.

A genuinely interesting, unplanned finding fell out of testing this for real: `bench-hatchery-spawn.
map.json`'s hatchery has no initial mobile forces (a spawner is a structure), so Q13's roster snapshot
— computed once, from initial placements, specifically so a workers-only side isn't declared
"annihilated" for having no soldiers at the start — means this side can **never** be annihilated, no
matter how many spawned units and the hatchery itself die, because `hasMobile` was `false` at tick 0
and is never re-evaluated. The fixture runs to a tick-limit draw even after player A has nothing left
at all. Registered as **Q28**.

Screenshot: not separately captured (see design 5's split, which shares the same spawn primitive and
is more visually legible at one frame).

### 5. Shard-giant — splitting on death, the same primitive from a second trigger

*A design added to round out the roster: the golem rule shape — dying multiplies instead of only
damaging.*

**Composed almost for free, once design 4 existed** — the interesting part was recognising it should.
`splitOnDeath?: { contentId, count }` is a second `ContentDef` trigger for the exact same
"create an entity nearby" primitive, called from `death.ts`'s `resolveDeaths` instead of a periodic
timer. Pulling the tile-search-and-construction logic (`spawnOneNear`) out of `spawning()` into its
own function, shared by both triggers, is the concrete instance of "a second real use reveals the
seam" (engine.md 0's own words) this session produced honestly, not by design up front.

Scenario: `bench-shardgiant-split.map.json`, tuned with a starting-hp placement override (18 of 90) so
the fixture actually reaches the death rather than the giant winning first — noted in the scenario's
own `notes` field. Screenshot: `evidence/screenshots/bench-shardgiant-split.png` shows the giant's
death collapse still animating beside its own two, already-spawned children in the same frame.

### 6. Siege crawler — windup, then splash

*"Siege Tank: moves at reasonable speed, then anchors itself on the ground with some delay, then
shoots on the ground with explosive AOE."*

**Needed two small, independently reusable capabilities.** "Anchors with a delay, then fires" is a
one-time hold that plain `cooldownTicks` cannot express (cooldown recurs every shot; this needed to
spend down once, only while genuinely holding a firing position, never while marching). The fix:
`AttackDef.windupTicks`, backed by `EntityState.windup` — initialised to the full value at spawn,
decremented only on a tick the attacker would otherwise fire, never rearmed once spent.

The AOE half reused a shape already on the bench: `AttackDef.splash?: AreaDamage`, where `AreaDamage`
is the *same* `{radius, damage}` shape `Detonation` already was, pulled out under its own name once a
second trigger moment (a landed hit, not a death) wanted it. `death.ts`'s `detonate()` and
`attacks()`'s splash handling now both call a shared `areaDamage`/`actorsWithin` pair in `shared.ts`.

Scenario: `bench-siegecrawler-windup.map.json`. Screenshot: `evidence/screenshots/
bench-siegecrawler-windup.png`, tick 58 — the crawler's first shot, landing on both clustered troopers
at once. See "Failures and discarded approaches" below for a real bug this fixture caught.

### 7. Ram — a soft targeting bias, not a hard one

*"RAM giant unit that targets buildings."*

**Needed one new, small capability**, deliberately not design 1's mechanism. `targetLayers` is a hard
restriction — the right shape for "can never reach," wrong for "prefers, but can still fight." A giant
that could never engage a soldier once every building fell would be a *worse* unit for the same idea,
and Clash of Clans' own Giant is exactly this: tunnel-visions defences, eats free damage from anything
else, but still swings if that's all that's left.

The fix: `ContentDef.targetPreference?: readonly EntityLayer[]` — narrows perception's candidate list
to preferred layers only when something on one is actually in sight, falling back to the ordinary
nearest-enemy scan otherwise. `unit.bench.ram` demonstrates the downside as starkly as the upside:
`bench-ram-preference.map.json` places a trooper far closer than the barracks, and the ram ignores it
entirely, taking nineteen unanswered hits over the whole match rather than trading with the one enemy
actually attacking it. `target.selected`'s very first line names the barracks at distance 20 over the
trooper at distance 9. Screenshot: none separately captured — the outcome is legible from the event log
alone (see the test `targetPreference: a giant prefers a farther structure...` in
`tests/proving-grounds.test.ts`).

### 8. Sniper — absorbed with nothing new at all

*"Sniper unit that can shoot from far away."*

The cleanest case on the bench: `AttackDef { kind: "ranged", range: 9, damage: 22, cooldownTicks: 40,
projectileTilesPerTick: 6 }`, low `maxHp`, nothing else. `bench-sniper-crossfire.map.json` and
`tests/proving-grounds.test.ts` don't even need a dedicated test — the design's whole claim is that it
needed no kernel work, and the fixture resolving deterministically alongside everything else is the
proof.

### 9–11. Hog rider, Wall-Breaker (saboteur), Balloon (bomber) — pure composition

*Clash Royale/Clash of Clans-inspired designs chosen specifically to test reuse, not to add new
mechanics.*

**Needed zero new kernel code between them.** Each is a different combination of capabilities designs
1, 2, and the pre-existing `air` layer already proved:

- **Hog rider** (`unit.bench.hogrider`): `targetLayers: ["obstacles"]` — the same field the grunt uses
  to lose a layer, pointed at a different one, so it ignores every soldier and beelines whatever it
  can knock down.
- **Wall-Breaker** (`unit.bench.saboteur`): `targetLayers: ["obstacles"]` **plus**
  `detonation.triggerRange` — designs 1 and 2's capabilities composed with no glue code, because
  perception's candidate filter is the one place both a normal `attack` and a contact detonation ever
  read a resolved target from.
- **Balloon** (`unit.bench.bomber`): the `air` layer, `targetLayers: ["obstacles"]`, a normal `attack`
  for its bombing run, and a plain death-only `detonation` (no `triggerRange`) so a bomber shot down
  before it arrives still goes out loud. Four fields, all of which existed before this unit was
  designed.

Scenario: `bench-hog-saboteur-bomber.map.json` — all three ignore the two defending troopers entirely
and beeline the barracks; the troopers can still *physically* block the ground rushers' path (targeting
and collision are separate questions, engine.md 3.4.1), while the bomber, on a different layer, never
has to route around anything. It plays out as a real, dramatic fight (screenshot: `evidence/
screenshots/bench-hog-saboteur-bomber.png`): the hog rider dies mid-siege, the saboteur dies and takes
a trooper's health down with its blast (detonation still fires on a normal death, not only on
`triggerRange` — see the note on that interaction below), and the bomber finishes the barracks before
its own death-blast kills the last trooper standing. A:3 of 3 attackers died; the barracks fell anyway
— a side note worth keeping: with no Nexus placed for either side, destroying the barracks doesn't end
the match, so the match's own scoring still credits B the win by annihilation despite A's objective
being met. Not a bug — a plain consequence of a non-Nexus structure not being a victory condition —
but a good illustration of how much of "who won" rides on Q13's roster model.

### 12. Wall segment — the control case

*Not one of Mario's seven, and not one of the Clash-inspired seven either: `commander-armies.md`
Section 7's own prediction, built specifically as a known-clean baseline.*

**Needed nothing**, exactly as predicted: "a slow, high-integrity Citizen unit whose footprint is a
straight 1×3 or 1×4 line... nothing about this needs a new engine capability, only content shaped to
use two rules that already exist." `unit.bench.wallsegment` is `rectFootprint(4, 1)` plus
`behavior: "static"` — the bench's first *armed* static entity, and it turns out the schema already
allowed that too (`isMobile`/`intents()` only ever gate *movement* on behavior, never firing;
`attacks()` doesn't care about behavior at all). `bench-wallsegment-blockade.map.json` places it across
the one gap in a rock barrier; three troopers have to fight through it or not get through at all. It
never advances and never stops fighting back — confirmed in `tests/proving-grounds.test.ts`.

### 13. Beam turret — damage that ramps with a held lock

*A design added to round out the roster: the Inferno Tower rule shape.*

**Needed one new capability**: per-actor combat memory beyond a cooldown.
`EntityState.focusStreak` counts consecutive successful hits against the *same* resolved target,
reset the instant perception reassigns one (including losing it entirely) — perception already
computes "did the target change" for its own `target.selected` event, so the reset piggybacks on a
comparison that already existed. `AttackDef.focusRamp: { perHitPercent, maxPercent }` reads it to scale
`attack.damage`, in integer percentages rather than a float multiplier: canonical content is hashed
(`contentLockOf`, resolve.ts), and `state/canonical.ts` refuses any non-integer number outright —
`0.5` is a legal *runtime* ratio but not a legal *stored* one, which the first draft of this design
learned by failing every scenario test at once rather than by inspection.

`structure.bench.beamturret` is a static structure with a real `attack` — the schema already supports
this (see design 12), nobody had built one. `bench-beamturret-focus.map.json` locks it onto a lone,
slow colossus with nothing else to shoot at; `attack.launched`'s own `damage` field climbs tick over
tick in the headless log, capped at the declared multiplier, and the turret wins outright against a
unit with more than twice its own effective health.

### The one design named and not built: arbitrary mid-match placement

*A Clash Royale Miner-style ambusher that deploys anywhere on the Grid rather than only through normal
movement.*

Not built, on purpose — naming a real gap without closing it is a valid outcome this session was
explicitly told to produce. Two things are missing, and neither is small:

1. **A teleport-shaped intent.** Every movement claim `arbitration.ts` resolves today comes from
   `rankedSteps` — a candidate adjacent to the mover's current tile. A unit that can claim an arbitrary
   tile needs a second kind of `Intent` arbitration can still adjudicate (speed tier, then the seeded
   stream) without assuming the claimed tile is one step away from anything.
2. **Live placement legality**, not just load-time legality. `scenario/load.ts`'s footprint-fits /
   no-impassable-terrain / not-already-claimed checks run once, at tick 0, over a whole scenario. A
   mid-match arbitrary placement needs the equivalent check computed live, against whatever a
   `CollisionMask` says *this tick*, for one candidate tile rather than a whole roster.

Smallest capability that would close the gap for this design specifically: a new `Intent` variant
produced outside `rankedSteps` carrying a direct destination, plus a small reusable "is this tile,
right now, legal for this footprint and this layer" query built from the same `CollisionMask` the
loader's checks and every step's `footprintFits` call already share. Not registered as an open
question — it doesn't block anything today, and the two pieces above are enough for whoever builds it
next to start from a real answer instead of a blank page.

## Kernel capabilities added, all additive

| Capability | Where | Used by |
| --- | --- | --- |
| `ContentDef.targetLayers` | content/types.ts, pulse/perception.ts | grunt, hog rider, saboteur, bomber |
| `ContentDef.targetPreference` | content/types.ts, pulse/perception.ts | ram |
| `Behavior: "support"`, `AttackKind: "heal"`, `applyHeal`, `heal.applied` | content/types.ts, pulse/perception.ts, pulse/shared.ts, pulse/attacks.ts, events/types.ts | medic |
| `Detonation.triggerRange` | content/types.ts, pulse/attacks.ts | spitter, saboteur |
| `AttackDef.windupTicks`, `EntityState.windup` | content/types.ts, state/types.ts, pulse/attacks.ts | siege crawler |
| `AttackDef.splash` (`AreaDamage`, shared with `Detonation`) | content/types.ts, pulse/shared.ts, pulse/attacks.ts | siege crawler |
| `ContentDef.spawn`, `pulse/spawn.ts`'s `spawning()` | content/types.ts, state/types.ts (`spawnCooldown`), pulse/spawn.ts, pulse/tick.ts | hatchery |
| `ContentDef.splitOnDeath` (reuses `spawn.ts`'s primitive) | content/types.ts, pulse/spawn.ts, pulse/death.ts | shard-giant |
| `AttackDef.focusRamp`, `EntityState.focusStreak` | content/types.ts, state/types.ts, pulse/attacks.ts, pulse/perception.ts | beam turret |

Every one of the nine is additive: every new `ContentDef`/`AttackDef`/`Detonation` field is optional
and defaults to today's behaviour, `SCHEMA_VERSION` bumped 2 → 3 for the three new `EntityState`
fields, and every existing scenario's *gameplay outcome* — ticks, winner, losses, and the full INFO log
byte-for-byte — was diffed against `main` and found identical (see Verification, below). Nothing here
required touching `citizen.ts`, `ravel.ts`, or a single existing `.map.json` file.

## Refactors made along the way, and why

- **`targetLayers`/`targetPreference` live on `ContentDef`, not `AttackDef`.** The first sketch (for
  the grunt) put it on `AttackDef`, since that's where range and damage already live. Design 2's
  wall-breaker — a unit with `detonation.triggerRange` and **no `attack` at all** — needed the exact
  same restriction and had nowhere to hang it. Moving it to `ContentDef` before either design shipped
  was the actual "review the code before adding the next one" moment this spike asked for: targeting
  eligibility is a perception-phase question, orthogonal to how an entity happens to deal its damage.
- **`AreaDamage` pulled out of `Detonation`.** `Detonation` was `{radius, damage}`; `attack.splash`
  needed the identical shape at a different trigger moment. Naming the shape once
  (`content/types.ts`) and having `Detonation` extend it, rather than duplicating three fields under a
  new name, means a future third trigger for "damage everyone nearby" (a Feudal damage-interception
  rule, say — `commander-armies.md` 4.3 already names one) has a type to reach for.
- **`shared.ts`'s `areaDamage`/`actorsWithin` split.** One clean helper wanted to both compute *and*
  apply area damage; `detonate()` couldn't use it as-is without silently reordering `entity.detonated`
  ahead of the `damage.applied` events it causes, which would have changed every existing detonation
  fixture's event stream for no reason. Splitting the read-only geometry query from the apply-and-report
  step let both callers share the query while each kept its own event order.
- **`footprintRing` moved from `view/effects/recipes.ts` to `grid/coords.ts`.** The death-choreography
  effect needed a body's perimeter to draw a shockwave from; `pulse/spawn.ts` needed the identical
  shape to search for a free tile next to a spawner. Two real uses on either side of the state/Pulse
  boundary, the same geometry — engine.md 0's "extract a shared contract once a second use reveals the
  seam" for real, not hypothetically.
- **`freshEntityFields(definition)`, content/types.ts.** `scenario/load.ts`'s entity construction and
  `pulse/spawn.ts`'s mid-Pulse construction both decide a fresh entity's `moveCredit`, `cooldown`,
  `targetOrdinal`, `windup`, `spawnCooldown`, and `focusStreak` defaults. One function, called from
  both, rather than two lists a future field addition has to remember to update in sync.

## Failures and discarded approaches — the highest-value section

Two real bugs, both caught only by actually running a scenario, neither visible from reading the code:

1. **Splash damaging its own shooter.** The first cut of `attack.splash` measured area damage from
   the resolved target's *anchor point* and applied it to everyone in radius with no exclusion. Running
   `bench-siegecrawler-windup.map.json` showed the crawler taking its own splash damage — because the
   trooper it was windup-holding against kept closing distance during the hold, and by the time the
   shot fired, the crawler itself was inside its own blast radius. "Splash radius is smaller than
   attack range" turned out to be an assumption about the *moment of firing*, not a fact about the
   content — the reasoning that ruled out self-damage as a rare edge case was simply wrong once a
   target could keep moving during a windup. Fixed by excluding the shooter from its own splash
   (`attacks.ts`), matching the self-exclusion `detonate()` already had for a dying entity's own blast.
2. **A footprint silently narrowed to a point during a refactor.** Pulling `detonate()`'s inline
   blast-radius filter into a shared `actorsWithin` helper (so `attack.splash` could reuse the same
   geometry) accidentally changed what "distance from the blast" meant: the original measured from the
   dying entity's *whole footprint* (`distanceBetween`'s own definition, the nearest occupied tile
   rule from engine.md 3.5); the refactor measured from a bare anchor point. For a 1x1 body these are
   identical, which is exactly why the existing test suite's "twenty runs produce identical hashes"
   check didn't catch it — it only proves a run agrees with *itself*, not with `main`. The regression
   only shows up against a multi-tile detonator: `unit.ravel.leviathan` (5x2). Caught by explicitly
   diffing gameplay outcomes (ticks, winner, losses, full INFO log) between this branch and `main` for
   seven existing scenarios — `citizens-versus-ravels` and `grand-battle` both disagreed before the
   fix, agreed byte-for-byte after. **The lesson, stated plainly: internal hash-stability tests prove
   a change is deterministic, never that it is unchanged. A refactor to already-tuned kernel code needs
   its own explicit before/after comparison against the base branch, every time, regardless of how
   confident the diff looks.** `shared.ts`'s `distanceFromArea` now carries this history in its own
   comment so the next session doesn't have to rediscover it.

One thing tried and kept, not discarded, but worth recording as a near-miss: the ram-preference
fixture's first draft placed the trooper directly on-axis between the ram and the barracks, which
tripped the *already-documented* Q15 on-axis routing dead end (the ram hard-stopped and never found
the one-tile detour a human would). That is not a new bug — Q15 already names it and defers the real
fix to Milestone 2 — but it is a vivid demonstration of Q15's practical cost: a brand-new capability
(`targetPreference`) working exactly as designed still produced a broken-looking fixture because of an
unrelated, already-known kernel limitation. The checked-in scenario repositions the trooper off-axis
specifically to demonstrate the preference cleanly rather than re-litigate Q15.

## Verification

```bash
npm install
npm run typecheck          # clean
npm test                   # 195/195, Node
./scripts/run-tests.sh bun # all files pass (see the cli.test.ts timeout note below)
./scripts/check-repository.sh   # passes; canon 2.7, Gate 1B unchanged
```

Every scenario in the repository (existing and new, 36 total) re-verified with `grid --verify`:
identical hashes across repeated runs, no mismatches.

`tests/cli.test.ts`'s cross-runtime hash check (`--headless --json` under both Node and Bun, once per
scenario file) crossed Bun's 5000ms default per-test timeout once this session's eleven new scenarios
landed — exactly the failure mode `DEVELOPMENT.md` already documents and already has a fix for. Applied
the same fix: an explicit `{ timeout: 120_000 }` third argument, not a smaller scenario count.

Existing content was **not** taken on faith: gameplay outcomes (ticks, winner, per-side losses, full
event count) for seven existing scenarios — `citizen-mirror-skirmish`, `citizens-versus-ravels`,
`ravel-cascade`, `structure-destruction`, `salvage-drop`, `small-multicell-skirmish`, `grand-battle` —
were diffed against `main` before any kernel change landed and again after every kernel change was
in place. The first diff (before the fix above) found the footprint-distance regression described
above; the second, after the fix, was clean. The full INFO-level log (not just the summary) for the
two most detonation-heavy of those seven — `ravel-cascade` and `grand-battle` — was additionally
diffed byte-for-byte against `main` and found identical.

Ten new tests in `tests/proving-grounds.test.ts` assert behaviour, not just "the fixture loads": the
grunt never selects a target across the whole ground-air fixture, a spitter death shows `killer: null`,
a single splash hit produces more than one `damage.applied` and never damages its own source, the
ram's first selected target is the barracks at a much greater distance than the trooper it ignores, a
heal clamps and reports as its own event kind, the hatchery's spawns never exceed `maxAlive` and at
least one happens after tick 0, the shard-giant's death produces its declared split count in the same
tick, focus-ramp damage is monotonically non-decreasing and capped, the wall segment never emits
`entity.moved`, and the three structure-only rushers never attack anything but the barracks.
`content.test.ts`'s existing generic footprint/art-agreement tests cover every new content id with no
changes of their own.

Screenshots (`evidence/screenshots/`, `node scripts/capture-screenshots.mjs --only <name>`):
`bench-sky-ground-asymmetry`, `bench-siegecrawler-windup`, `bench-medic-support`,
`bench-shardgiant-split`, `bench-hog-saboteur-bomber` — sent directly to Mario during the session.

## Open questions registered

Three, all in `specs/open-questions.md` Section 4 with recommendations: **Q26** (is the spawn
primitive's "combat ability, not production" framing one Mario needs to bless before real content uses
it), **Q27** (should ground-cannot-target-air become the schema's default rather than opt-in, once air
is real roster content rather than a bench experiment), **Q28** (Q13's roster snapshot can make a
spawner-only side immune to "annihilation" — a real, if currently bench-only, edge case).

## What this does and does not authorize

Nothing. This is an architecture finding, not a gate result and not owner acceptance of anything.
Milestone 4 still selects the real Citizens-versus-Ravels microgame and still owns the first real
roster; `commander-armies.md` is unchanged. The nine capabilities above exist, are tested, and are
available the day a real design needs one of these same shapes — that availability is the point of the
exercise, not a claim that any of these thirteen units should ship.
