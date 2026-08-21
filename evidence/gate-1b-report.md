# Gate report — Milestone 1B, quality and effects

**Document role:** Gate evidence report for Gate 1B
**Status:** In progress
**Canon version:** 2.5
**Updated:** 2026-08-21
**License:** Apache-2.0

---

## 1. Frame — written before coding

- **Canon version:** 2.5
- **Milestone and gate:** Milestone 1 — the Pulse Playground; Gate 1B (quality and effects).
- **Authorization, stated plainly:** Gate 1B is GATED on Gate 1A's acceptance, and Gate 1A is **not
  accepted** — its two human checks are still owed, and Mario has said he will watch it. He also
  asked, in session on 2026-08-21, for a second army and for the next milestone to be built. That is
  the owner authorizing directly, which is what the canon's gate is for; it is recorded here rather
  than resolved by marking Gate 1A accepted, so the ledger stays true. **If watching Gate 1A
  produces a REVISE, this gate's work sits on top of a contract that moved**, and that is the risk
  the owner accepted by asking.
- **Question this gate answers:** Do render tiers and an effect vocabulary turn a legible Pulse into
  one worth watching again — and does that survive monochrome and reduced motion?
- **A second question the owner added:** does a second army, built to contrast rather than to
  balance, make the Playground show two different *styles* of fight rather than one fight twice?
- **Smallest artifact that can answer it:**
  - the pure `EffectRecipe` contract of [`ascii-effects.md`](../specs/ascii-effects.md) Section 1,
    driven by the cosmetic stream, with effect instances derived from the ordered event stream and
    nothing else;
  - the ten effects of its Section 5, each in all three required forms;
  - render tiers — monochrome, 16-colour, 256-colour, truecolor — plus an optional Unicode glyph
    pack, selectable at runtime;
  - a **Ravel fixture army** built for contrast against the Citizen fixture, and the smallest rule
    that makes it Ravel rather than a reskin.
- **Automated evidence planned:** every effect pure in absolute time; nothing emitted outside its
  window, its band, or the Grid clip; every glyph width one; all three forms exist and emit at the
  impact beat; the cosmetic stream never touches the gameplay stream — asserted, not assumed;
  composed-frame snapshots stable at fixed timestamps across every render tier; and, for the new
  content, the whole Gate 1A determinism suite still green, including cross-runtime hashes.
- **Human observation planned:** the real gate. Show the same scenario with effects on and off and
  ask which one they would watch again, and why. Then the reduced-motion form — can they still tell
  what hit what? Then monochrome. Screenshots stand in until someone watches.
- **Explicit exclusions:** the Build Phase, economy, production, supply, visibility filtering,
  upgrades, drafts, the Commander, campaigns, packaging, multiplayer, sound. Ravel **jackpot drafts**
  and **scrap doctrine** need an economy and a draft, so neither is built here. No Commander Army is
  authored: [`commander-armies.md`](../specs/commander-armies.md) Section 1 forbids production stats
  before Milestone 4, and the Ravel content here is fixture content of exactly the same disposable
  status as the Citizen fixture in milestone 3.6.
- **One rule is added, and it is named here rather than buried:** Ravel **volatile munitions** —
  things that detonate when they die. A stats-only Ravel army fails the canon's own alignment test
  ([`terminal-nexus-lore.md`](../specs/terminal-nexus-lore.md) Section 8.6: a themed reskin of a
  generic ability fails; a rule that *is* the characterisation passes), so the army would not be
  worth authoring without it. It is a **fixture rule for the Playground bench**, deterministic and
  bounded, that Milestone 4 must confirm or discard when it selects the real microgame.
- **Stop conditions:**
  - effects obscure their own targets, or the busiest frame becomes noise — **REVISE**, per 4.3;
  - causality needs colour, or reduced motion loses the story — **REVISE**;
  - an effect cannot be made pure in absolute time without state — **STOP**, because the whole
    contract rests on it;
  - the cosmetic stream is found to perturb a gameplay hash — **STOP**, since that breaks Gate 1A.

## 2. Environment — pinned, not remembered

Unchanged from [`report.md`](report.md) Section 2: Node 22.22.2 and Bun 1.3.11, no build step,
`@opentui/core` 0.5.6, `typescript` 7.0.2, `@types/node` 22.20.1, on Linux x86_64.

## 3. What was built

About 1,700 lines of source and 900 of tests on top of Gate 1A, in three pieces.

**The effect system** — `src/view/effects/`. The pure `EffectRecipe` contract of
[`ascii-effects.md`](../specs/ascii-effects.md) Section 1, a derivation step that turns the ordered
event stream into instances, and eleven recipes: the ten of its starter vocabulary plus
`fx.blast.detonation`, which the Ravel rule earned and which the vocabulary predates. Every recipe
has all three required forms.

Three decisions worth recording:

- **Cosmetic randomness is a hash, not a stream.** A recipe must satisfy `f(t)` never depending on
  `f(t-1)`, so it cannot draw from a generator whose answers depend on how many times it has been
  asked: two frames rendered out of order, or one frame skipped, would scatter differently. Hashing
  the instance's own identity plus a salt gives stable randomness at any time, in any order, on any
  machine — and it makes "cosmetic randomness only" structural rather than disciplined, because
  there is no stream here to accidentally share with gameplay.
- **Faction language lives in `instance.family`, not in duplicated recipes.** A Citizen round is
  kinetic, orthogonal and tight; a Ravel charge is explosive, diagonal, and entitled to more of the
  screen. One code path, two physical languages, which is craft rule 2 without doubling the
  vocabulary.
- **A cascade is staggered on purpose.** Nine detonations resolve in one tick, and drawn that way
  they are one frame of noise. Each blast in a tick is held back a little longer than the last, so
  the chain ripples and the eye can follow it. Presentation may lie about timing; it may not lie
  about what happened.

**Render tiers and a glyph pack** — monochrome, 16-colour, 256-colour and truecolor resolving one
role table, where the higher tiers are where the factions' own palettes appear: Citizen rust against
Ravel bioluminescent green, from the Energy lines in `terminal-nexus-lore.md` Section 8. Plus the
optional Unicode pack: box-drawing chrome, a middle-dot lattice, shaded rock, diamond ore. It dresses
the field and the frame and **never the actors** — units stay letters in both packs, because case
carries ownership and glyph family carries faction, and prettier symbols do not improve that.

**A second army** — `src/content/ravel.ts`, six definitions of exactly the same disposable status as
the Citizen fixture, and one new rule. Section 1 records the authorization; Section 6 records how it
plays.

Aesthetic changes made by looking at real frames rather than at text:

| Change | Why |
| --- | --- |
| Featureless ground is a coarse lattice, not a dot per tile | 288 identical marks competed with every unit and every effect drawn on top of them. Negative space is material |
| A quiet rule marks the play area where the Grid is smaller than the pane | With a lattice there was no visible edge, and a player could not tell empty ground from off-Grid |
| The legend is built from the opening cast, in the current pack | The fixed list started lying the moment a second faction and a second pack existed |
| Force totals gained a bar, excluding structures | `hp 661` says how much, not how much is left; a 400-point Nexus swamped the bar so badly that a side could lose its army and look nine tenths healthy |
| The footer says `paused at tick 0160` while held | The panel read `[hold]` while the footer read `pulse running`. Both true, of different things, and adjacent they read as a bug |

## 4. Automated results

`npm test` — **122 tests, 122 passing** on Node 22.22.2, and every file passing under Bun 1.3.11.
`npx tsc --noEmit` clean, `./scripts/check-repository.sh` green. Seventeen scenarios, all still
identical over twenty runs and still identical across the two runtimes.

| Check | Result | Evidence |
| --- | --- | --- |
| Every effect is pure in absolute time | PASS | `tests/effects.test.ts`: sampled forwards, backwards, and after every intervening millisecond |
| Nothing emitted outside its window | PASS | `tests/effects.test.ts` |
| Nothing emitted in a forbidden band | PASS | `tests/effects.test.ts`, on the sample set and on every instance derived from every scenario |
| Nothing emitted outside the Grid clip | PASS | The compositor clips; `tests/effects.test.ts` composes at four tiers and two motion settings |
| Every glyph is width one | PASS | `tests/effects.test.ts` and `tests/view.test.ts` |
| All three forms exist and emit at the impact beat | PASS | `tests/effects.test.ts`, all eleven recipes |
| Reduced motion keeps causality | PASS | `tests/effects.test.ts`: the reduced tracer spans shooter to target rather than travelling it |
| The damage flash is an attribute, never a glyph replacement | PASS | `tests/effects.test.ts` |
| **The cosmetic stream never touches the gameplay stream** | PASS | `tests/effects.test.ts`: four cosmetic seeds, one state hash and one event hash, different pictures |
| Composed-frame snapshots stable across every render tier | PASS | `tests/effects.test.ts`: all four tiers put identical glyphs on screen |
| The ASCII pack never leaves ASCII; the Unicode pack never leaves its curated set | PASS | `tests/effects.test.ts` |
| The corruption law: no effect replaces an entity's own glyph | PASS | Enforced in the compositor; `tests/view.test.ts` asserts glyphs against the event stream |
| Volatile munitions damage friend and foe alike | PASS | `tests/ravel.test.ts` |
| Chains are bounded and settle inside one tick | PASS | `tests/ravel.test.ts`: nothing detonates twice, and the cascade ends the fixture on the tick it starts |
| No Ravel moves on a Citizen cadence | PASS | `tests/ravel.test.ts` — "off the beat" as a test rather than a note |
| A Grid Nexus is a flag, not a content id | PASS | `tests/ravel.test.ts` |
| Gate 1A determinism, unchanged | PASS | The mirror skirmish still hashes to `4dc11d15a082a2bb…`; all Gate 1A tests still green |

Measurements:

| Metric | Value | Method | Samples |
| --- | --- | --- | --- |
| Frame budget, mirror skirmish, effects on | p50 **0.42 ms**, p95 **0.94 ms**, max 3.67 ms, **0 over budget** | `tests/performance.test.ts` at 30 fps | 1800 frames (60 s) |
| Frame budget, **worst case** — two armies, 48 x 16, truecolor, 561 effect instances | p50 —, p95 **1.27 ms**, max 2.87 ms, **0 over budget** | same | 1800 frames (60 s) |
| Output bytes per frame, worst case | 5,913 | same | 1800 |
| Effect instances, `citizens-versus-ravels` | 561 over 720 ticks | `PulseView.effectCount` | 1 |
| Effect instances, `ravel-cascade` | 118 over 48 ticks | same | 1 |

`citizens-versus-ravels`, seed `0x0000B001`, 720 ticks: state `sha256:02d2169486cff722…`, events
`sha256:3006ebc267a241de…`, 990 events.

## 5. Human observations

**Nobody has watched it in motion.** Gate 1A's two human checks are still owed and this gate's is
too — and this gate's *is* the real one: show the same scenario with effects on and off and ask
which they would watch again.

What exists is five screenshots in `evidence/screenshots/`, captured from a real terminal at exact
ticks: `ravels-clash` and `ravels-clash-no-effects` are the same instant with the effect system on
and off, which is the comparison the gate is judged on; `cascade-blast` is the worst frame in the
game — nine fuel wagons and five troopers in one tick — and `cascade-monochrome` is that same frame
at the acceptance floor, monochrome and reduced motion; `ravels-clash-wide` is the clash at two
columns per tile.

## 6. Interpretation

**The effects do what the canon promised they would.** `fx.move.trail` is the one that matters —
two dim cells of dust behind a letter, and the letter reads as *moving* rather than teleporting.
Tracers make ranged fire come from somewhere. The clash marks put the blow at the contested edge
rather than on either unit. On the stills the field now shows vectors and events instead of a static
arrangement of letters, and that is the whole difference between a report and a fight.

**The second army is the bigger result.** Three of the four Ravel rule shapes needed nothing new
from the kernel — rates off the Citizen cadence, lower speed tiers, richer salvage — and one needed
a rule. Volatile munitions turned out to be worth the whole exercise: in `citizens-versus-ravels`
the Ravel runners charge in, die, and hurt whatever killed them; a raider's death catches its own
slinger; a fuel wagon takes a hauler and a marksman with it. Nobody needs the lore to describe that
faction after watching it once, which is the alignment test the canon sets. And the fixtures now
show two *styles*: Citizens hold a line and trade efficiently, Ravels lose every fair fight and are
still ahead on the exchange because dying is one of their attacks.

**A second faction is also an audit.** It found a Citizens-only assumption in the kernel — the win
condition was keyed on the content id `structure.citizen.nexus` — within an hour of existing. That
is the cheapest possible moment to find it, and it is an argument for building the second of
anything earlier rather than later.

**The corruption law needed a compositor, not discipline.** The first frame with effects on had a
clash mark sitting on the defender's own cell, which removes the only thing saying the defender is
there. A Gate 1A test caught it immediately. The fix was to make it structurally impossible — the
compositor drops any effect cell that would replace an entity glyph — rather than to ask eleven
recipes to remember. The damage flash is the single exemption, and it is exempt because it carries
no glyph at all.

**The worst frame is loud, and that is the intended answer.** Nine simultaneous radius-two blasts
fill a lot of a 24 x 12 Grid. Thinning the rings and staggering the chain turned one frame of noise
into a visible ripple, but a fuel-dump cascade is still the loudest thing in the game — it should
be, and the surviving trooper stays visible through it. Whether it is *too* loud is a question for
someone watching it, not for a test.

## 7. Failures, surprises, and discarded approaches

**A stream is the wrong shape for effect randomness, and it took writing one to see it.** The
obvious move was to reuse the cosmetic PCG32 stream already sitting in `src/rng`. It cannot work: a
generator's answers depend on how many times it has been asked, so the same effect would scatter
differently depending on which frames rendered — exactly what the purity rule forbids. The
replacement is a hash of the instance's identity. The stream stays for anything that genuinely wants
one, and nothing does.

**My own cadence test caught my own design slip.** The Ravel raider was written at `1/1`, which is a
step every twelve ticks — and twelve ticks is the Citizen worker's cadence. "Off the beat" is a rule
shape, so it is a test rather than a note, and the test failed on the first run. The raider moved to
`4/5`.

**Both armies stampeded into a corner, and it was not a bug.** The first asymmetric fixture put each
army in a rank, which is exactly how Citizens are described as deploying. On a 48 x 16 Grid every
enemy is then the same Chebyshev distance away, the tie breaks on entity id, and *every* unit on
both sides targets one enemy each. Staggering both sides across columns fixes the fixture. It does
not fix the rule, and the rule is Gate 1A's, whose evidence is on the table awaiting a watch — so it
is registered as **Q17** with a recommendation to fix it after acceptance, not before.

**The screenshot pipeline lied in colour.** The first truecolor capture came back as magenta and
blue blocks: the ANSI-to-HTML converter read `38;2;r;g;b` as a run of independent SGR codes, and
numbers like 105 landed in its background branch. The game was fine; the tool was not. Worth
remembering that an evidence tool can be the thing that is broken, and that a screenshot is not
self-verifying.

**The legend and the force bar both started lying quietly.** The legend was a fixed list from when
one faction and one pack existed; the force bar counted a 400-point Nexus alongside twenty-point
runners, so a side could lose its entire army and still show nine tenths health. Neither would have
been caught by a test, because both were *plausible*. Both were caught by looking at a picture.

**Discarded: faction colour as ownership colour.** Colouring Citizens rust and Ravels green is
prettier than colouring player A rust and player B green — until a mirror match, where both armies
are one faction and the two sides become indistinguishable by colour. Ownership keeps the colour;
faction keeps the glyph family and the effect language. That split is also what keeps monochrome
whole.

## 8. Decision

> **PASS**, pending the human comparison that is the gate's actual question.

Everything Section 4.3 lists as automated acceptance passes: eleven effects pure in absolute time,
emitting nothing outside window, band or clip, every glyph width one, all three forms present and
emitting at the impact beat, composed frames stable across four render tiers, and the cosmetic
stream demonstrably unable to move a gameplay hash. The second army contrasts on rates, tiers,
fragility, mass and one rule, and Gate 1A's determinism is untouched.

The gate's real question — *would you watch it again* — is not answerable by a test, and this report
does not claim it. `ravels-clash` and `ravels-clash-no-effects` are the same instant with the system
on and off, and they are the two pictures that decide it.

## 9. Canon impact

**Nothing is applied. All of it waits for Mario.**

| Proposed rule | Would live in | Earned by |
| --- | --- | --- |
| Effect randomness is a **hash of instance identity**, never a stream — the purity rule of ascii-effects.md 1 forbids a generator whose answers depend on call count | `ascii-effects.md` Section 1 | Section 7 above; `tests/effects.test.ts` |
| The corruption law is enforced by the **compositor**: an effect cell that would replace an entity glyph is dropped, and only a glyphless attribute write may touch an occupied cell | `engine.md` Section 9.4 and `ascii-effects.md` 1.1 | A Gate 1A test caught the violation the moment effects existed |
| Faction visual language belongs to the **effect family and the glyph family**, not to the ownership colour, so that a mirror match stays legible and monochrome stays whole | `terminal-nexus-lore.md` Section 8.6 | Section 7 above |
| `fx.blast.detonation` joins the starter vocabulary | `ascii-effects.md` Section 5 | The Ravel volatile-munitions rule postdates the list |
| A cascade of simultaneous detonations is **staggered in presentation** so the chain reads as a chain | `ascii-effects.md` Section 2 | Section 3 above |
| A Grid Nexus is a **flag on a content definition**, not a content id the kernel knows | `engine.md` Section 5 | The second faction broke the hardcoded id within an hour |
| **Volatile munitions** as a fixture rule: things detonate when they die, friend and foe alike, chains bounded by one death each | `commander-armies.md` 4.1 records the shape; the rule itself waits for Milestone 4 to confirm or discard | `scenarios/ravel-cascade.ts` and `tests/ravel.test.ts` |

Questions raised, each in [`../specs/open-questions.md`](../specs/open-questions.md) with a
recommendation:

| ID | Question | Recommendation |
| --- | --- | --- |
| Q17 | Should a Chebyshev tie in target selection break on distance, or on entity id? | Break it on squared Euclidean distance — but not until Gate 1A is accepted, since it moves every hash that report quotes |

## 10. Next authorized action

Watch `ravels-clash` against `ravels-clash-no-effects`, then watch the mirror skirmish in motion for
Gate 1A, and accept or revise both gates. Milestone 2 — routing, economy, visibility — is the next
milestone, and it is gated on Milestone 1 being accepted, not merely finished.
