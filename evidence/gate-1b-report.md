# Gate report — Milestone 1B, quality and effects

**Document role:** Gate evidence report for Gate 1B
**Status:** In progress — revised after a third round of owner feedback, awaiting the next viewing (the branch itself has still never been watched — see Section 14)
**Canon version:** 2.6
**Updated:** 2026-08-23
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

## 10. The owner's viewing — findings and this session's response

The original Section 10 asked for exactly this — watch it and accept or revise — and Mario did:
he watched the Pulse Playground in motion and reported back at length, on both legibility and looks.
This section is the response, on branch
`claude/pulse-playground-legibility-pass` (commits `e7d632f`..`7d4e80f`), and the honest reading of
Section 8's decision changes with it — see the revised decision below.

### What was said

Paraphrased from the owner's own message, kept close to his wording:

- **Legibility.** Diagonal movement was "the main" problem — once units start shooting, it stops
  being possible to follow what's happening. Shooting should lean on a small timing delay rather
  than a large ASCII glyph, "similar to how terran marines shoot in Starcraft." Pathfinding needs to
  get smarter — declare a target, find a free attack position, rescan often — and units want a
  default-movement state distinct from an engaged/combat state, "multiple states... will allow more
  complex and engaging behaviours later." A settle delay after death, and after a step, would read
  more clearly. Adjacent same-type units read as one merged unit ("TT" vs "T T"). `watch` shouldn't
  exit on its own when the Pulse ends. Initial movement felt a little slow, and he wanted to see
  different unit speeds side by side.
- **Looks.** The screenshot tooling works well and he wants a sub-tick, multi-frame capture around a
  real multi-unit engagement, on request only (expensive). A strong, deliberate 256-colour palette
  should be the main design reference. On his black-background terminal the help text was nearly
  invisible — "how are other ASCII games dealing with this?" — and a themes system might be worth
  it. "Draw a Nexus!" — the current single tiled letter is not the visual identity the game needs,
  and it is worth iterating toward "perfection." Mirror matches (citizen-vs-citizen, ravel-vs-ravel)
  need a real answer for colour, and he floated a future skins system with a player-chosen colour.
- **Explicitly deferred, registered rather than built:** sandbox placement, rewind/fast-forward, and
  a full replay engine for collecting player feedback later — "not needed for now."
- He also asked for one large, populous scenario, purely to enjoy watching it.

### What this session did about it

| Owner's finding | Response | Evidence |
| --- | --- | --- |
| Diagonal movement is the main legibility problem | Movement and targeting are four-way (N/E/S/W), Manhattan distance, everywhere | `e7d632f`; `src/grid/coords.ts`, `src/pulse/movement.ts` |
| ...which exposed a real routing bug (goal was a target's anchor, not its nearest tile) | Fixed generally (`nearestFootprintTile`/`movementGoal`), not worked around per scenario | `e7d632f` |
| ...and a harder on-axis dead end under Manhattan distance that diagonal movement used to paper over | Diagnosed, reproduced, documented as a real kernel limitation rather than patched blind; **Q15** sharpened with the finding and a recommendation | `e7d632f`; `specs/open-questions.md` Q15 |
| Shooting should lean on timing, not a large glyph | Ranged tracer cut from a two-cell streak to one; impact-burst shards and melee-clash debris cut and time-boxed, guided by a real multi-unit capture rather than guessed at | `a8b49b5`; before/after count in the same commit: 10.10 → 9.22 effect cells/frame on `grand-battle`'s opening exchange |
| A settle delay after death, and a beat after a step before attacking, would read more clearly | Both implemented as real kernel rules — `DEATH_SETTLE_TICKS`, a `VacatedOverlay`; an actor that moved this tick cannot also attack on it — each with a dedicated scenario and test, not just a presentation trick | `e7d632f`; `scenarios/settle-delay.ts`, `tests/rules.test.ts` |
| Pathfinding needs to get smarter; default-movement vs. engaged states | Registered, not built — real pathfinding and a state machine are Milestone 2 scope, and building ahead of that gate is exactly what the canon says not to do | `7d4e80f`; `specs/milestone-2-deterministic-pulse.md`, new bullets |
| Adjacent-unit spacing ("TT" vs "T T") | Registered alongside behaviour states, since a spacing preference needs to know "advancing or engaged" to apply only half the time, per the owner's own melee exception | `7d4e80f`; `specs/milestone-2-deterministic-pulse.md` |
| `watch` shouldn't exit on its own | Fixed: the auto-settle after the Pulse's duration is gone; the session now holds the final frame until `q`, SIGINT, or SIGTERM, same as any other point | `483a197`; new `tests/lifecycle.test.ts` case drives a Pulse to completion and checks it does not exit |
| What does frame-stepping actually show? | Answered directly: 30 fps presentation against 12 Hz simulation, so `.` (frame) moves presentation time by one third of what `,` (tick) does — real sub-tick interpolation, not a no-op |  |
| Initial movement felt slow; wants to see different speeds side by side | Citizen trooper/marksman moved 3/4 → 1/1; new `speed-parade.ts` lines up one of every mobile unit type at a common start, racing the same distance, fastest to slowest | `f808ebd` |
| ...which surfaced a real reporting bug: a crowded multi-tile mover was reported "blocked by edge" | The report checked only the mover's anchor tile, not its full footprint; fixed at both `move.blocked` report sites, pinned with a test | `f808ebd`; `tests/rules.test.ts` |
| A large, populous scenario to watch | `grand-battle.ts`: 56 entities on the 48x16 default preset (density, not Grid area — see the note below) | `ecc808e`, `a8b49b5` |
| Sub-tick, multi-frame capture around a real engagement, on request | `scripts/capture-engagement.mjs`: finds the engagement from the headless log, steps frame by frame (not tick by tick), captures the run. Shared its tmux/ANSI/PNG pipeline with the existing screenshot script (`scripts/lib/terminal-capture.mjs`) rather than duplicating it | `a8b49b5` |
| A strong 256-colour palette as the design reference | `scripts/render-palette.mjs` renders every `StyleRole`, both themes, straight from the live `PALETTE` table — swatch, ANSI code, 256 index, RGB — so the reference can never drift from what the game draws | `43d5102`; `evidence/screenshots/palette-reference.png` |
| Nearly invisible help text on a dark terminal; "how do other tools handle this?" | Traced to three compounding causes and fixed: `--capability` defaulted to `color16` unconditionally (now detects `COLORTERM`/`TERM`, the standard simple method); `chrome.muted`/`chrome.label` sat on ANSI 90 while every use of `chrome.muted` *also* applies the `dim` attribute on top, and ANSI 90 is the least consistently themed of the sixteen codes across real terminals; `player.a`/`player.b`'s ANSI-16 codes did not match the hue the rest of the table already committed to (96/93, bright cyan and bright yellow, for rust orange and Ravel green) | `9ea57fe` |
| A themes system, started simple | `--theme dark|light`: a second full `PALETTE` table, threaded only as far as it has to go (the three functions that finally turn a role into a colour), no background probe (unreliable across terminals, real complexity for a gate asked to start simple) | `9ea57fe`; `evidence/screenshots/mirror-light-theme.png` |
| "Draw a Nexus!" | Both factions now render real 3x2 multi-cell art instead of a tiled single letter — Citizen a domed core over a bracketed base (`.n.`/`[=]`), Ravel a jagged canopy over arrows radiating from a spark (`/n\`/`<*>`) — a first pass, explicitly meant for iteration | `427cef3` |
| Mirror-match colour (citizen-vs-citizen, ravel-vs-ravel) | Made observable (`ravel-mirror-skirmish.ts`, the Ravel counterpart to the existing citizen fixture) rather than changed: the RULE already in `engine.md` ("ownership keeps the colour") does keep the two sides apart, at the cost of one side of a same-faction mirror wearing the other faction's signature hue. Registered as **Q18** with options and a recommendation rather than overridden, since it is a stated RULE and changing it needs the owner and a canon bump | `51e0d9c` |
| A future skins system, a 3rd player-chosen colour | Folded into Q18 as one of its options, not built | `51e0d9c` |
| Sandbox placement, rewind/fast-forward, a replay engine for feedback | Registered as **Q19**, exactly as asked ("keep this in mind... not needed for now"): a full replay format is already Milestone 2's; rewind/fast-forward is presentation on top of it, with one real design consequence now (keep per-tick state cheaply addressable); sandbox placement reads as an early, lighter form of Milestone 3's battle editor. Recommendation: nothing until Milestone 2 is accepted | `7d4e80f`; `specs/open-questions.md` Q19 |

A note on `grand-battle.ts`'s size: the first draft used the 72x24 preset — the ceiling `engine.md`
3.3 allows — and it resolved fine headless but overlapped its own side panel once actually watched.
The composition (`compositionSize`/`gridOrigin` in `src/view/compose.ts`) currently draws every
scenario in a fixed 48x16 viewport with no scrolling; the cursor-driven scrolling 3.3 describes for
larger Grids is not built yet. Rebuilt at 48x16 with 56 entities instead — density carries
"populous," not Grid area, until scrolling exists.

Every item above that touched behaviour (four-way movement, settle delay, stop-then-attack, the
blocked-reason fix, the theme system) shipped with new or updated tests, not just a scenario to look
at. 134 Node tests pass (122 before this round), green under Bun, `tsc` clean,
`check-repository.sh` clean, at every commit in the range above.

### Revised decision

> **REVISE, acted on — PASS still pending the owner's next look.**

Section 8's PASS was correct about what it claimed: the automated evidence held, and it was explicit
that the gate's real question — would you watch it again — was not answerable by a test and was not
being claimed. The owner watched it, and the answer was "mostly, but here is what got in the way."
That is a REVISE, and the table above is the response to it. It is not a fresh PASS: only Mario
watching it again settles that, same as before. What changed is that the specific, concrete things
his first watch found are now fixed, tested, or — where fixing them meant building ahead of a gate
that is not yet authorized — registered with a recommendation instead of guessed at.

## 11. Next authorized action, revised

Watch it again — `grand-battle` for the populous fight the owner asked to just enjoy,
`speed-parade` for the speed spread, `ravels-clash` and `ravel-mirror-skirmish` for the effects and
colour work, `--theme light` if the terminal is light. Accept or revise Gate 1B (and, since it was
never separately closed, Gate 1A alongside it). Milestone 2 — routing, economy, visibility, and now
the behaviour-states and spacing items Section 11 registers — is next, gated on that acceptance, not
merely on this session running out of things to fix.

## 12. The owner's second viewing — findings and this session's response

Section 11 asked for exactly this: watch it again, accept or revise. Mario did — `npm run play`,
Citizens versus Ravels — and sent a second round of notes, on branch
`claude/grid-playtest-feedback-an01m2` (commits `2cddd33`..`4302e2e`). Same shape as Section 10:
paraphrased findings, then this session's response, then a revised decision.

### What was said

Paraphrased from the owner's own message, kept close to his wording:

- **It landed.** "Wow, generally speaking this is a LOT cooler. It really works, and the initial
  engagement feels good. I can follow who is shooting at who much better." Read as encouraging, not
  as acceptance — see the note at the end of this section on that specific point.
- **Movement is still too slow.** Units take a while to reach initial engagement; once it is over,
  slow movement makes it too slow to reach the next interesting part. "We should probably think
  about how to reach the initial conflict faster. Maybe outposts regroup units next to them so next
  pulses resolve faster."
- **A pathfinding failure**, described exactly: "Two units on the top of the screen around tick 200
  got stuck: `t▓▓X`. The pathfinding algorithm is failing here. Try and notice."
- **Colour contrast**, hedged: "Perhaps we have to work on the colors to ensure more contrast."
- **Bigger explosions on death than on a hit.** "Show bigger explosions when the units die vs when
  they take damage."
- **The small timing delays are working.** "The timings for shooting and taking damage are much
  better now. Those small frame delays really help building movement. Look for more opportunities to
  do that, specially when the effect is resolved within the same turn so it doesn't really affect the
  gameplay."
- **Movement jitter.** "Also moving units at slight different speeds also helps a lot to see nicer
  movement. I wonder if we should build in some movement jitter based on terrain (pseudo-random but
  deterministic so we can replay)."

### What this session did about it

| Owner's finding | Response | Evidence |
| --- | --- | --- |
| "Two units... got stuck: `t▓▓X`. The pathfinding algorithm is failing" | Reproduced exactly (`citizens-versus-ravels`, tick 179: `A:trooper#3` and `B:runner#2` deadlocked nose to nose across a two-tile rock, each one's only distance-closing direction pointed straight into it) — this is Q15's on-axis dead end, already diagnosed and registered last round, now confirmed on the real fixture rather than only the abstract case. Isolated to `on-axis-deadlock.ts`, a two-entity regression the previous fix could not have caught | `e1e677f`, `4355dcc`; `scenarios/on-axis-deadlock.ts`; `specs/open-questions.md` Q15 |
| ...while chasing that down, the `WARN stuck` line itself was found to name the wrong tile — the one the actor could not enter, reported as though it were the actor's own position, which is exactly why "notice" needed a stare rather than a glance at the log | Fixed at the source (`src/report/log.ts` tracks each actor's own tile from `entity.spawned`/`entity.moved` and reports it separately from the tile it wants); found the same misdirection was masking a second, worse bug | `e1e677f` |
| ...the second bug: any scenario with a placement on impassable terrain silently entombs that entity, unable to ever move | Both baseline mirror fixtures (`citizen-mirror-skirmish.ts`, `ravel-mirror-skirmish.ts`) had it — their "mirrored" rock pairs were not actually mirrored, so four of `citizen-mirror-skirmish`'s seven B units (three of the Ravel fixture's) have stood in rock since Gate 1A, not fighting. The loader now refuses the placement outright, naming the row/column/terrain id; both fixtures corrected | `e1e677f` |
| Units still move too slow, a second time (trooper/marksman already went `3/4` → `1/1` last round) | Every `movementRate` in both rosters × 1.5, preserving every ratio the content was tuned against. First attack in `citizens-versus-ravels` now lands at tick 91 (7.6s), down from tick 144 (12s) | `ddaa5f7`; `src/content/citizen.ts`, `src/content/ravel.ts` |
| ...which shifted two fixtures' pinned combat arithmetic in `milestone-1-spike-battle.md` 3.6 | Both re-measured and corrected rather than left to silently drift, with the trooper-vs-two-marksmen fixture's changed *story* (no longer a clean ranged kill) disclosed explicitly rather than papered over or re-balanced without being asked | `ddaa5f7`; `specs/milestone-1-spike-battle.md` 3.6, `tests/scenario.test.ts` |
| "Maybe outposts regroup units... so next pulses resolve faster" | Registered as **Q23**, not built: outposts, production, and multi-Pulse regrouping are Milestone 2/3 scope, unauthorized regardless of how reasonable the idea is | `4302e2e`; `specs/open-questions.md` Q23 |
| "Perhaps we have to work on the colors to ensure more contrast" | Measured rather than guessed at: WCAG contrast ratios computed against the real truecolor swatches. Each side already clears 3:1 against the background in both themes; `player.a` vs `player.b` directly does not — 2.08:1 dark, **1.08:1 light** (almost identical brightness, separated only by hue). Registered as **Q21** with the measurement and a recommendation (retune lightness, not hue, in the light theme specifically) rather than repainted on a hunch | `4302e2e`; `specs/open-questions.md` Q21 |
| "Show bigger explosions when the units die vs when they take damage" | `ascii-effects.md` Section 5 already states this as a requirement for `fx.death.collapse` and nothing had ever tested it. For the common 1x1 footprint the death ring only touched four cardinal neighbours (5 cells at peak against the hit's 2); widened to a full eight-cell ring (9 cells at peak, ~4.5x rather than ~2.5x). New test pins "visibly heavier" as a number and was checked to fail against the pre-fix ring before it was checked to pass | `77c8895`; `tests/effects.test.ts` |
| "The timings for shooting and taking damage are much better now... look for more opportunities to do that, specially when the effect is resolved within the same turn" | Found exactly that gap: a same-tick ranged kill (`attack.launched`, `damage.applied`, `entity.died`, and any `entity.detonated` it triggers all resolve within one tick) already held the impact burst for its flight window, but the death collapse, structure collapse, and blast did not — a unit could visibly explode before its own tracer arrived. All three now wait for the same impact beat the burst already waits for. Reproduced and pinned: `citizens-versus-ravels` tick 169, a marksman's shot kills a runner whose volatile munitions catch a trooper, all fixed to land in the right order | `51c1467`; `tests/effects.test.ts` |
| "moving units at slight different speeds also helps... movement jitter based on terrain" | Distinguished what the speed pass above already delivers (rate varies *across* unit types) from what was actually asked (identical units of the *same* type still step in lockstep with each other). Registered as **Q22**, framed against the engine's existing seeded-gameplay/free-cosmetic split — the same deterministic-hash shape every `fx.*` recipe already uses — with a recommended first cut (pure interpolation jitter, no kernel change) rather than built directly, since it touches the state/presentation boundary closely enough to be worth a real answer | `4302e2e`; `specs/open-questions.md` Q22 |

Everything that touched behaviour or presentation timing shipped with a new or updated test proving
the specific claim, not just a scenario to look at — including two tests written to fail against the
old code first, so "this actually was the bug" is checked rather than assumed. 138 Node tests pass
(134 before this round), green under Bun, `tsc` clean, `check-repository.sh` clean, at every commit
in the range above. `grid verify --runs 20` on every touched scenario: hashes identical.

A separate, unrelated repair also landed this round: `main` itself had gone red between the two
viewings (a direct commit cleaning up the concept-art folder deleted a required file and archived a
pre-canon document full of retired terms), and a second session fixed it independently while this one
was already in flight. Both fixes were merged and this branch adopted the version already on `main`
rather than carry a second, competing implementation — `2ff17e9`.

**On "this is a LOT cooler... I can follow who is shooting at who much better":** read as encouraging
feedback with a concrete, itemized follow-up list immediately behind it — the same shape
`milestone-1-spike-battle.md`'s own framing already anticipates ("Encouraging is not the same as
accepted... A new session's authorised work is whatever the owner's most recent feedback asks for —
not new scope"). Not inferred as acceptance here; if this reads differently to the owner, that is his
call to make explicitly, not this session's to assume.

### Revised decision

> **REVISE, acted on a second time — PASS still pending the owner's next look.**

Same shape as Section 10's close: the gate's real question is not answerable by a test, was not
claimed as answered, and the owner's second watch found real things a first pass could not have —
one of them (the entombed-unit bug) predating this gate entirely, sitting undetected since Gate 1A.
What changed between viewings is fixed, tested, or registered with a recommendation; nothing here
claims the gate is now accepted.

## 13. Next authorized action, revised again

Watch it again. `citizens-versus-ravels` for the faster approach and the corrected death/blast
timing; `on-axis-deadlock` (headless is enough — it is a two-line regression, not a scenario built to
be watched) if the pathfinding fix is worth confirming directly; `--theme light` if the light-theme
contrast measurement in Q21 is worth a look before it is acted on. Accept or revise Gate 1B (and
Gate 1A alongside it, still never separately closed). Three more questions are open and waiting on
the owner specifically — **Q21** (contrast), **Q22** (movement jitter), **Q23** (outposts) — alongside
the six still open from the first round. Milestone 2 remains gated on acceptance, not on this session
running out of things to fix, same as last time.

## 14. A third round, mid-session — the branch was never watched at all

Before Section 13 was even acted on, the owner replied again — but from `main`, which had none of
Sections 1–13's work on it (no PR had been opened; nothing was asked to open one). So this round's
first finding was procedural, not a bug: **"is the work committed?"** Yes, and pushed, to
`claude/grid-playtest-feedback-an01m2` — confirmed by fetching `origin/main` directly and diffing
against it before answering, rather than assuming. The playtest notes that followed were therefore
against the *original* Gate 1B fixture, not anything this branch had already changed — worth knowing
when reading the responses below, several of which read as "still too slow" on a baseline that had, on
this branch, already moved once.

### What was said

- **"Two units stuck" (again).** The owner asked to confirm this: "is the work committed? I... still
  see... the citizens vs ravels scenario still shows 't' moving up and getting stuck up there." Not a
  new finding — the branch fix from round two (Section 12) was never on `main` to see.
- **A ranged kill's own target.** New: "I still see projectiles set from 'm' (marksman) but the enemy
  dies instantly while the projectile arrives later... if there's a delay on the attack arriving, the
  delay should match the effect, and the effect should match the delay... if there are other units
  with the same attack type, they need the same delay."
- **Movement, a third time.** "The movement speed is still too slow, they should move 2 or 2.5 times
  faster" — against the un-sped-up baseline on `main`, not this branch's already-shipped 1.5x pass,
  which the owner had not yet seen.
- **A new rule.** "when a unit kills an enemy, it should wait a full movement cooldown before
  starting to move again. Otherwise... it is hard to see who won that fight — specially if they
  decide to move vertically."
- **Set aside, verbatim, for later.** The terminal cell's own aspect ratio — "too fast when moving up
  and down, too slow when moving sideways... Let's explore the vertical-rectangle issue later, for
  now just take note."

### What this session did about it

| Owner's finding | Response | Evidence |
| --- | --- | --- |
| "is the work committed?" — nothing visible on `main` | Confirmed by fetching `origin/main` and diffing rather than assuming; explained plainly that nothing had been merged, no PR had been asked for, and this reply names that before anything else | this section |
| "Two units stuck" | Already fixed in round two (Section 12); not on `main`, so not re-diagnosed — pointed back at the existing fix rather than duplicated | Section 12 |
| "the enemy dies instantly while the projectile arrives later" | A real, different bug from round two's effect-timing fix: `state.entities` drops a dead entity from the composed frame the instant it dies, but its own `fx.ranged.tracer` keeps animating for the rest of the flight window — so the target's *glyph* vanished before its own tracer arrived, a gap the effect-timing fix never touched. Fixed by holding a "corpse" — last known position, drawn exactly like a live entity, never in `state.entities` so it never reaches the force bar — for exactly as long as the death effect it precedes is already held. Verified against a real same-tick kill before writing code (the target's glyph was gone two ticks before its tracer visibly landed) | `435fcd0`; `src/view/snapshot.ts`, `src/view/compose.ts`, `tests/view.test.ts` |
| "if there are other units with the same attack type, they need the same delay" | Verified rather than assumed: `flightWindowTicks()` (`arbitration.ts`) is one shared, pure function of `(distance, projectileTilesPerTick)`, used identically for every ranged attacker with no per-unit special-casing anywhere in the flight-window or corpse-hold code — the slinger gets the same fix as the marksman automatically |  |
| "still too slow... 2 or 2.5 times faster" | A second, larger speed pass — 2x the *original* rate, not a further multiple on the branch's already-shipped 1.5x, since the owner was judging the original baseline both playtests actually watched. First attack in `citizens-versus-ravels` now lands at tick 72 (6s), down from 144 (12s) before either pass — exactly 2x | `13d5832`; `src/content/citizen.ts`, `src/content/ravel.ts` |
| "wait a full movement cooldown before starting to move again" | Built as a kernel rule, same shape as the existing `DEATH_SETTLE_TICKS`: a killer's `moveCredit` is zeroed the instant its kill lands, the same mechanism `accrueCredit` already applies to a step actually taken, so it needs a full cadence's worth of credit again before its next move. New fixture (`kill-then-hold.ts`) isolates it; broke `settle-delay.ts`'s own test in a real way (that fixture used to let the killer be both the killer *and* the tile-tester, which stopped proving anything once a kill could hold a mover longer than the settle window) — redesigned with an independent tester rather than patched around | `051d57a`; `src/pulse/attacks.ts`, `scenarios/kill-then-hold.ts`, `scenarios/settle-delay.ts` |
| The terminal cell's own aspect ratio | Registered as **Q24**, exactly as asked ("take note... explore later") — connected to `engine.md` 9.3's existing RULE and mitigation (adaptive tile width) rather than treated as unrelated, with the owner's own three ideas laid out as options and none recommended, since he asked for this to wait | `af02fda`; `specs/open-questions.md` Q24 |

Every behavioural change shipped with a new or updated test proving the specific claim, including two
written to fail against the pre-fix code first (the corpse hold, the movement hold) before confirming
they pass. 140 Node tests (139 before this round), green under Bun, `tsc` clean,
`check-repository.sh` clean. `grid verify --runs 10` swept all 23 checked-in scenarios after the
kernel rule change (the movement hold touches `stateHash`): every one deterministic.

## 15. Next authorized action, once more

Same as Section 13, on the branch that now actually carries all of it: `citizens-versus-ravels` for
the corrected timing and the now-doubled speed; `kill-then-hold` and `settle-delay` (headless — both
are two-and-three-line regressions, not scenarios built to be watched) if the two kernel-rule changes
are worth confirming directly. **The one thing this round adds ahead of watching anything: decide how
this branch reaches `main`.** Nothing has been merged and no PR exists; the owner has not asked for
one. Four questions now wait specifically on the owner — **Q21** (contrast), **Q22** (movement
jitter), **Q23** (outposts), **Q24** (cell aspect ratio, explicitly deferred by the owner's own
request) — alongside the six still open from the first round. Milestone 2 remains gated on
acceptance, not on this session running out of things to fix.

## 16. A fourth round — multi-tile units, the placement format, and a quality pass

Section 15 asked how the branch reaches `main`. The answer arrived first: PR #15 was opened from the
Claude Code UI and, later this same day, merged by the owner — encouraging, and explicitly not a
substitute for the acceptance Section 8 and Section 12 both still wait on (this round adds nothing
that changes that read). What arrived after the PR was a large, explicit follow-up request rather than
an instruction to start Milestone 2, paraphrased close to the owner's own wording:

- **Large units, and a review of placement and unit representation.** "The next thing I want to
  explore is large units that spam over multiple tiles" — units whose content definition (`unit.
  citizen.trooper`, for instance) decides the symbol *matrix*, not just a letter, and where a
  placement's single symbol marks the unit's centre rather than a corner.
- **Placements split per player.** Instead of one shared grid plus one legend distinguishing sides by
  case, two separate placement blocks — "it is possible to put units from different players on the
  same tile, but this should be validated and fail with an error" — each with its own optional origin
  coordinate, so a block need not cover the whole Grid.
- **A legend entry that can carry partial starting health**, "important when implementing more
  pulses, for example starting on pulse 3, the placements will have some units with damage already
  taken," extensible to future modifiers without saying what those will be yet.
- **A visual ask**: "Define a few large units, and run the scenarios... I am interested on seeing
  larger ascii representations of some units and see them going down in battle."
- **A quality pass afterward**: a refactor review now that the code has been reshaped several times in
  the same direction, plus a design exercise — "Can you think of other types of units? That would be
  a good exercise to check if the code is simple and flexible enough to accommodate those changes
  later."

Mid-session, `main` moved out from under the branch a second time: an independent session had already
renamed every scenario from a TypeScript module (`.ts`) to a checked-in `.map.json` file and redesigned
`grid`'s CLI around it (PR #16, canon 2.6 → 2.7), merged while this branch's placement-format rewrite
was already in flight against the old shape. And, mid-session again, the owner added two more asks
before this round closed: audit the greedy router specifically for large-footprint bugs (not build
real pathfinding — still Milestone 2's job), and run one more refactor pass with fresh eyes, subagents
invited for both.

### What this session did

**Placement format v2.** `ScenarioDefinition.placements` is now `Partial<Record<PlayerId,
PlacementBlock>>` — one block per player, each an optional `at` origin plus `rows` plus a `legend` of
`{ content, hp? }` objects, replacing one Grid-sized overlay and one shared legend keyed by letter case
(`src/scenario/types.ts`). A placement symbol marks a unit's **centre tile**; the loader derives the
anchor via a new `footprintCentre` (`src/grid/coords.ts`, built on a new `footprintExtent` that also
replaced two private, silently-agreeing-only-by-luck copies of the same arithmetic in
`view/effects/derive.ts` and `view/compose.ts`). Ordinals — the kernel's own iteration order, never
authoring order — are assigned after gathering every player's placements and sorting by Grid reading
order (row, then column, then player, then content id), proven by a test that swaps which player's
block is written first and checks the assignment does not move. Validation grew a real new case rather
than only moving the old ones: two players claiming the same tile, even across layers, now fails
loudly by construction where a single shared alphabet used to make it impossible to write at all; `hp`
outside `1..maxHp` fails the same way. All 23 then-checked-in scenarios were converted by codemod
(`/tmp/convert-scenarios.mjs`, later `/tmp/convert-maps.mjs` once PR #16's rename landed) and proven
unchanged — not just re-verified, compared: loaded entity state byte-identical to a pre-conversion
baseline, and `stateHash`/`eventsHash` identical across every scenario in a git-worktree comparison
against both `HEAD` and, after the merge, `origin/main`.

**Two genuinely large units, watched.** `unit.citizen.colossus` (3×3, 160 hp, cadence 24 — the slowest
thing on the bench) and `unit.ravel.leviathan` (5×2, 130 hp, a radius-2 detonation reaching most of a
formation) are real fixture roster entries, not test-only fixtures, each escorted by the small units
that used to be the whole roster in a new showcase, `scenarios/heavies-clash.map.json`. A rules test
pins that the two actually fight at footprint distance rather than anchor distance and that at least
one dies, so the large-footprint death-collapse path is exercised by the suite and not only by
watching. It was watched: `evidence/screenshots/heavies-open.png` (tick 0, both bodies at scale next
to their escorts) and `evidence/screenshots/heavies-death.png` (tick 400, the leviathan's collapse
filling its full 5×2 footprint while the colossus stands intact nearby) are the visual confirmation the
owner asked for directly, captured through the same tmux-to-PNG pipeline every other screenshot in this
repository uses, not a hand-picked frame.

**Unit art relocated and enforced.** Glyphs moved out of `src/view/theme.ts` into `src/content/art.ts`,
co-located with the definitions whose size they must agree with — `engine.md` 9.6's RULE that the
simulation never knows a glyph is now also asserted by a dependency-graph test that walks from every
kernel entry point and confirms none of them can reach the art file, with a sanity check that `src/
view` still can (so the test cannot be vacuously true). Co-locating paid for itself immediately: a new
test asserting art size against `footprintExtent` failed on the *existing* roster before anything new
was added — `structure.citizen.barracks` and `structure.ravel.den` were both declared 3×2 in their
footprint and drawn as a single flat letter, silently wrong since whenever they were authored. Both are
now drawn correctly at their real size.

**Quality pass, part one — three refactors, zero behaviour change.** `distanceBetween(a, b)` (`src/
pulse/shared.ts`) replaces four identical `footprintDistance(anchor, footprint, anchor, footprint)`
calls across perception, intents, attacks, and detonation. `applyDamage(context, target, source,
amount)` replaces the duplicated clamp-hp/emit-event/mark-pendingDead block in `attacks()` and
`detonate()`, and removes `attacks()`'s `hpAtTierStart` snapshot map as provably redundant (nothing
mutates hp between accumulating a tier's damage and applying it, so `target.hp` already equals the
tier-start value — the snapshot was defensive documentation that had quietly become dead code). `Actor`
is now `Mutable<EntityState> & {definition, pendingDead, killer}` instead of an eight-field hand copy
of `EntityState`'s shape, so a future state field appears on `Actor` the moment it lands in `state/
types.ts`; the reverse conversion, back into hashed and replayed `MatchState`, stays fully enumerated
on purpose, with a comment explaining why the asymmetry is deliberate rather than an oversight. All
three are pure refactors — verified, not assumed, by comparing `stateHash`/`eventsHash` across all 24
scenarios before and after, byte for byte identical.

**Quality pass, part two — the unit-type exercise.** The owner's question was whether `ContentDef` and
the kernel would accommodate other plausible unit types, or force a redesign. Answered by building the
cheapest one for real rather than only arguing about it, and by analysing the rest honestly rather than
building everything the exercise raised:

- **Air is not just plausible, it was already real.** `maskForActor` already special-cased
  `layer === "air"` to ignore terrain; `scenario/load.ts` already exempted air from the
  on-rock-at-spawn check; `view/compose.ts` already had a render band for it. Nothing on the roster
  had ever used any of it. `unit.ravel.buzzard` (1×1, `collidesWith: ["air"]`) is that first real
  content, and `scenarios/air-crossing.map.json` walls it into a 1×1 rock room every neighbouring tile
  of which is impassable — a room a ground unit placed there could never leave — then lets it fly
  straight out to fight a trooper on the other side. The new test watches this happen in a resolved
  Pulse: the buzzard's own `entity.moved` events land on rock, `attack.launched` fires between the two
  despite no layer check anywhere in perception or attacks needing to exist for it to, and
  `isMobile()`'s "not obstacles" rule correctly seats an air-only side in the annihilation count. Zero
  kernel changes were needed — the flexibility claim was already true and simply unexercised.
- **Healer** (heals allies instead of damaging enemies) is moderate, not cheap: `hostilesOf()`/
  `selectTarget()` in `perception.ts` have exactly one notion of "who to look at" — an enemy — so a
  healer needs either a new `Behavior` variant alongside `"advance" | "flee" | "static"` or a parallel
  targeting path, plus a heal-shaped sibling to `applyDamage` (clamped at `maxHp`, never setting
  `pendingDead`) and a new `heal.applied` event rather than overloading `damage.applied` with a
  negative amount. Bounded, no schema change, but real surface area across three files.
- **Artillery / splash-on-hit** (an attack that damages an area on every hit, not only on the
  attacker's own death) is now cheaper than it would have been before this session's refactor:
  `detonate()` is already a working "damage everyone within radius R" reference, and it already calls
  the same `applyDamage`/`distanceBetween` an on-hit splash would need. What it changes is `attacks()`'s
  own simultaneity guarantee — splash from several attackers landing on overlapping tiles in the same
  speed tier needs the same accumulate-then-apply-once discipline direct hits already get, or
  simultaneous artillery becomes iteration-order-dependent, which is a determinism risk, not a
  refactor. Flagged as a good next-session candidate, not built this pass.
- **Shielded** (a second hp pool absorbed first) splits in two: a flat, non-regenerating shield is
  genuinely close to cheap (one `EntityState` field, one local edit to the now-shared `applyDamage`),
  but any version needs a schema bump (`SCHEMA_VERSION`, `state/serialize.ts`/`canonical.ts`, every
  existing scenario still loading with a sensible default) and a new event so an absorbed hit is
  legible rather than silently eaten — regeneration on top of that needs a timed-condition primitive
  the kernel does not have at all (see burrower, below). Not built.
- **Burrower** (temporarily untargetable, ignores terrain while burrowed) surfaces the one real gap
  worth naming on its own: the kernel has no concept of a *timed* per-entity condition — `cooldown` is
  the only thing that counts down today, and it means exactly one thing. A burrower, a healer's "just
  healed, locked out for N ticks," and a shield's regen delay would all want the same primitive,
  which is a reason to design it once, when something authorized actually needs it, not once per unit
  type ad hoc. Also worth noting in passing: "ignores terrain" is currently spelled `layer === "air"`
  specifically in `maskForActor` (`shared.ts`), not as an independent fact a ground-layer unit could
  also carry — a burrower would need that split into two separate `ContentDef` facts, a small, honest
  refactor of its own if it's ever built.
- **Transport** (carries other units, invisible on the Grid while boarded) is the one genuinely
  expensive idea: it needs an entity that is alive but off-Grid entirely, a new intent (board/
  disembark), and a real design decision about whether a killed transport's cargo dies with it or
  escapes — a state-shape change, not an extension. Not built, not sketched further than that.
- **Spawner** (a structure that periodically produces units) is not a flexibility question at all —
  `tick.ts`'s `economyAndProduction()` phase is deliberately empty and named as reserved for
  Milestone 2 in its own comment, and AGENTS.md forbids building production before then regardless of
  how cheap it might be. The one finding worth keeping: the phase slot already exists and is already
  proven correctly ordered relative to perception, so Milestone 2 inherits that for free.
- **One structural question the exercise raised and answered without needing the owner**: should
  `ContentDef` grow a generic extensible bag instead of one bespoke typed field per mechanic (`attack?`,
  `detonation?`, `nexus?`, and now, hypothetically, `heal?`, `splash?`, `shieldHp?`)? AGENTS.md Section
  4 already answers this — "prefer direct code for the current proof, extract a framework only after
  two real uses reveal the boundary" — and three bespoke fields have scaled cleanly with no framework
  yet justified. Not registered as a question; there wasn't one.
- Also worth recording: `Behavior`'s three values are checked by ad hoc `=== "flee"` / `=== "static"`
  comparisons in `perception.ts` and `intents.ts`, not an exhaustive switch the way `DomainEvent`'s
  `kind` is checked everywhere it is consumed. A fourth value (a healer's `"support"`, say) would
  compile silently into the wrong branch rather than fail loudly. Worth converting to an exhaustive
  switch **when** a fourth value is actually added, not preemptively.

Two more things were asked for before this round closed: an audit of the greedy router specifically for
large-footprint bugs (not new pathfinding — still Milestone 2's job), and a second, fresh-eyes refactor
pass, subagents invited for both.

**The refactor pass** found five real things, all applied. `resolveTarget(context, actor)` (`pulse/
shared.ts`) replaces the same "resolve `targetOrdinal` to an `Actor` or `null`" one-liner duplicated
across `intents.ts`, `arbitration.ts`'s `rerank()`, and `attacks.ts` — exactly the class of duplication
`distanceBetween`/`applyDamage` were extracted for earlier this round, and the seam a future phase
reading `targetOrdinal` would otherwise re-derive a fourth way. A dead no-op loop in `pulse/context.ts`
that rebuilt each player's roster entry field-by-field into an object with identical values is gone —
pre-existing since Gate 1A, confusing rather than costly, since it reads as finalizing something and
does nothing. `flightWindowTicks` moved from `arbitration.ts` (whose own header scopes it to
"arbitration and settle") to `attacks.ts`, its only caller and the only place it has anything to do
with. A missing test case was added: the loader's off-Grid check had coverage for the east edge only,
and centre-anchoring — this round's own addition — is exactly what can push a multi-tile unit's anchor
*negative*, an untested branch of the same bounds check. And one real gap was found and documented
rather than mechanically patched: the placement-format rewrite dropped the old single-grid dimension
check, and `PlacementBlock.rows` now has no structural validation at all — every checked-in scenario
already relies on intentionally ragged rows (a short row trailing off as blank), so the one check that
would catch a truncated row would also break the format's own established, reasonable convention.
Recorded as a known, accepted limit on `PlacementBlock.rows` rather than left silently unmentioned; a
screenshot or a watched run is still the check for it. All five verified the same way as the earlier
pass: `stateHash`/`eventsHash` identical across all 25 scenarios before and after.

### Verification

158 Node tests (140 before this round), 157 under Bun, `tsc --noEmit` clean, `check-repository.sh`
clean, `grid --verify --runs 20` on the new `air-crossing` scenario and `--runs 10` swept across all 25
checked-in scenarios. Two independent hash-comparison proofs, not one: the placement-format conversion
against the pre-conversion `.ts` baseline, and the post-merge conversion against `origin/main`'s
independently-renamed `.map.json` files — both byte-identical across every scenario, both ways.

### Revised decision

> **REVISE, acted on a fourth time — PASS still pending the owner's next look.**

The gate's real question has not changed shape across four rounds: not answerable by a test, not
claimed as answered here either. What this round adds is a genuine second axis for that question —
Section 8 asked "is Gate 1A's determinism claim true," Section 12 and 13 asked "does the presentation
read," and this round asks "does the shape of the code accommodate what comes next without a redesign"
— answered as honestly for the parts that don't (transport, a timed-condition primitive) as for the
part that already did (air).

## 17. Next authorized action, a fourth time

PR #15 merged mid-session; this round's work is unmerged follow-up sitting on the same branch, not an
update to a closed PR — a new pull request, when the owner wants one, is a new PR, not a reopening of
#15. Watch `heavies-clash` for the large-unit fight and `air-crossing` for the flying unit (both are
built to be watched; the rest of this round's new fixtures are two-and-three-line regressions, headless
is enough). Milestone 2 remains gated on acceptance, not on this session running out of things to fix
— now with an actual account, rather than a guess, of what the next unit type will cost when Milestone
2 or the Commander Army work that follows it wants one.
