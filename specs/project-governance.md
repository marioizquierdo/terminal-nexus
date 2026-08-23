# Terminal Nexus — project governance

**Document role:** Canon authority, evidence process, execution ledger, and durable decisions
**Status:** Canonical
**Canon version:** 2.7
**Updated:** 2026-08-23
**License:** Apache-2.0

## 1. Canon is a document set

Terminal Nexus has no single monolithic specification. The canonical set and its reading order are indexed in [`README.md`](README.md).

The documents contain statements with different authority:

- **Locked decisions** are explicit commitments here or rules earned by an accepted gate.
- **Working hypotheses** are preferred directions that an active milestone must test.
- **Open questions** are intentionally unresolved until relevant evidence exists.
- **Deferred direction** protects future seams without authorizing implementation.
- **Historical evidence** belongs in reports, fixtures, recordings, and Git history.

The active milestone is the narrow implementation contract. It may add detail inside its scope but cannot silently contradict another canonical document. Descriptive completeness is not implementation authorization.

## 2. Bounded agent autonomy

Within the active gate, an agent may independently:

- choose reversible module boundaries, names, local data shapes, and test organization;
- add diagnostics, fixtures, comparison modes, and small evidence tools;
- compare alternatives when experimentation is cheaper than debate;
- simplify or discard code created only to answer the gate question;
- report that the favored hypothesis failed.

An agent must not independently:

- promote a hypothesis into canon without accepted evidence;
- absorb a later milestone because the architecture makes it convenient;
- create a generic framework before two concrete uses reveal its contract;
- treat automated tests as proof of an experiential claim;
- hide a blocker by changing a pinned runtime, fixture, target, or requirement;
- add secrets, services, public endpoints, or external writes without authority.

When the design is underdetermined, prefer a fixture, parameter, toggle, or brief comparison that makes the decision observable. Ask the owner only when alternatives materially change the product promise, experiment, or irreversible architecture.

When you do have to ask, ask in [`open-questions.md`](open-questions.md) rather than in a pull-request comment, and follow its protocol: state the options, state their costs, **give a recommendation**, then keep working on everything the answer does not touch. A session that stops entirely because one fork is unresolved has usually stopped too early.

## 3. The evidence loop

Every milestone gate follows:

> **Question → smallest artifact → automated evidence → human observation → decision → canon update**

Code existing is not completion. Each gate closes with a concise report containing:

- canon version, milestone, and gate;
- hypothesis and explicit exclusions;
- exact runtime, dependencies, platform, and commands;
- artifact and scenarios exercised;
- automated results, measurements, snapshots, hashes, or fixtures;
- human observations separated from interpretation;
- failures, surprises, and discarded approaches worth preserving;
- decision: **PASS**, **REVISE**, **STOP**, or **BLOCKED**;
- canonical rules earned and next authorized action.

Preserve aesthetic comparisons as screenshots or recordings with presentation order. Preserve simulation claims as complete inputs, seeds, content locks, and hashes.

## 4. Canon update protocol

After an accepted decision:

1. update the execution ledger;
2. add one concise progress-history entry;
3. promote only evidence-backed conclusions into relevant documents;
4. update locked and open decisions;
5. revise the next milestone only after owner acceptance;
6. increment the canon version for semantic changes;
7. update cross-document links and run repository validation.

Keep procedural logs out of the canon. Lore and product intent must not be rewritten to rationalize incidental implementation shortcuts.

## 5. Execution ledger

Allowed states are **COMPLETE**, **CURRENT**, **GATED**, **REVISE**, **BLOCKED**, and **STOPPED**. Only one implementation gate may be **CURRENT**, and the repository validator enforces it against the milestone documents.

| Workstream | State | Basis | Next action |
| --- | --- | --- | --- |
| Product discovery and canon split | COMPLETE | Canon 2.0 separated concept, lore, engine, content, campaigns, and milestones | Preserve boundaries while testing risky assumptions |
| Canon audit and autonomy pass | COMPLETE | Canon 2.1 added the open-questions register and gate-report template and made the validator derive its invariants | Keep the register current as gates raise new questions |
| Design-authority pass | COMPLETE | Canon 2.2 renamed the Grid, added the layer model, marked engine sections by authority, and refocused Milestone 1 on the Pulse | Superseded by the 2.3 corrections |
| Viewport and playground pass | COMPLETE | Canon 2.3 formalised viewport limits and cursor-driven scrolling, made layers render-order-only with collision as a composed mask, settled multi-tile units, reduced the markers to RULE and GUIDANCE, and reshaped Milestone 1 into the Pulse Playground | Open Gate 1A |
| Faction design and fiction pass | COMPLETE | Canon 2.4 aligned all five faction identities across philosophy, verb, mechanics direction, psychographics, and voice; added faction mechanical identities and engine capability asks; added the Operator belief ramp, a worked mission, and voice exemplars; registered Q10 and Q11, both since resolved by the owner | Owner review; Milestone 4 selects the first mechanical proofs |
| Execution-readiness audit | COMPLETE | Canon 2.5 audited the set as an *executable* contract: resolved the speed-tier, viewport-gating, chrome-arithmetic, and flight-window contradictions; added the coordinate convention; closed the gaps where no Gate 1A check would have caught a wrong view or a lying report; and split preferences from load-bearing RULEs | Gate 1A is unblocked; open it |
| Milestone 1A — the Pulse Playground | COMPLETE | Built, evidenced and merged. Every automated check in its Section 3.9 passes on two runtimes; [`../evidence/report.md`](../evidence/report.md) concludes PASS. **The two human checks in its Section 3.10 remain unobserved**, and nothing in canon claims them | Mario watches a mirror skirmish, and one in monochrome |
| Milestone 1B — quality and effects | CURRENT | Built and evidenced: eleven effects under the pure contract, four render tiers, an optional glyph pack, and a second fixture army for contrast. [`../evidence/gate-1b-report.md`](../evidence/gate-1b-report.md) concludes PASS on everything a test can answer, and explicitly not on the rest. **Fed back four times in two days** (2026-08-22/23, `npm run play`, three rounds against one unmerged branch — see the report's Sections 12 and 14 — then PR #15 merged and a fourth round landed on top, Section 16): rounds one through three fixed a stuck-warning bug masking units placed inside impassable terrain since Gate 1A, death/blast timing and weight, a ranged kill's own target vanishing before its tracer, movement sped up twice (1.5x then 2x the original), a new post-kill movement-hold kernel rule, and four new questions (Q21 contrast, Q22 movement jitter, Q23 outposts, Q24 cell aspect ratio). Round four redesigned the placement format around per-player blocks and centre-tile anchoring, authored two genuinely large multi-tile units and watched one die on screen, relocated unit art into `src/content` enforced against footprint by a test (catching a real, pre-existing 3×2-declared-drawn-as-1×1 bug on two structures), landed a first real `air`-layer unit proving a flexibility claim the kernel already made but never exercised, ran a refactor pass (`distanceBetween`, `applyDamage`, `Actor` derived from `EntityState`, all hash-verified as behaviour-preserving), and answered the owner's "would other unit types force a redesign" question per mechanism rather than in the abstract | PR #15 is merged; round four's work is unmerged follow-up on the same branch and needs a **new** PR, not a reopening of #15. Watch `heavies-clash` and `air-crossing`; accept or revise Gate 1B (and Gate 1A alongside it, still never separately closed) — not merely wait for a session to run out of fixes |
| Milestone 2 — completing the Pulse | GATED | Routing, economy, production, visibility, replay, and hardening the spike deferred. **Its contracts are locked** at canon 2.6, promoted from Milestone 1 with citations, so it can start cold | Authorize after Milestone 1 is accepted. Design the replay format first — it is the one contract Milestone 1 did not lock |
| Milestone 3 — Build Phase and editor | GATED | Requires a complete kernel | Lock placement rules before implementation |
| Milestone 4 — Citizens versus Ravels | GATED | Requires presentation, kernel, and builder proofs | Select the deliberately tiny integrated ruleset |
| Milestone 5 — human campaign fragment | GATED | Requires a replayable microgame worth teaching | Test narrative, unlocks, and pacing |
| Delivery — packaging, PTY, browser | GATED | Deferred out of Milestone 1; answers no question the game currently has | Authorize when Terminal Nexus needs to run where it was not built |

## 6. Progress history

| Date | Canon | Result | Next gate |
| --- | --- | --- | --- |
| 2026-08-19 | 1.1 | Consolidated product, lore, mechanics, architecture, tools, and milestones | Operational review |
| 2026-08-19 | 1.2 | Added agent autonomy, evidence loop, canon protocol, and execution ledger | Toolchain preflight |
| 2026-08-19 | 1.3 | Added renderer-neutral architecture, runtime research, 12 Hz hypothesis, and preflight contract | Renderer selection |
| 2026-08-19 | 1.4 | Completed repository quality pass and dual-license scope | Repository bootstrap |
| 2026-08-19 | 2.0 | Split the monolithic canon; updated Prime Nexus replication, Nexus Symbols, resurrection, and Build Phase/Nexus Pulse terminology | Milestone 1A |
| 2026-08-20 | 2.1 | Audited canon against itself and the concept art; narrowed Gate 1A to cell frame and lifecycle and moved delivery to Gate 1C; added the open-questions register, gate-report template, ASCII references, and concept index; corrected runtime direction against measured evidence; replaced hardcoded validator literals with derived invariants | Milestone 1A |
| 2026-08-20 | 2.1 | Owner answered Q1 (adaptive tile width), Q2 (one resource), and Q6 (accept the Gate 1A/1C split), and authorized opening Gate 1A | Milestone 1A |
| 2026-08-20 | 2.3 | Formalised viewport minimum and maximum, cursor-driven scrolling with no minimap, and terminal size bands; corrected layers to define render order only, with collision as a mask composed from chosen layers; settled that units may span multiple tiles (Q3); reduced authority markers to RULE and GUIDANCE; reshaped Milestone 1 into the **Pulse Playground**, with the headless report and the ASCII view built together and a levelled log as the agent feedback loop | Milestone 1A |
| 2026-08-20 | 2.2 | Renamed the battle surface to the **Grid** and the replica to the **Grid Nexus**; added Grid size and shape presets, the five-layer occupancy model, and footprint/anchor/facing placement; marked every engine section LAW, GUIDANCE, or UNPROVEN; refocused Milestone 1 onto the Pulse itself with three gates ending in an effects gate; added `ascii-effects.md`; deferred packaging and remote delivery out of the milestone | Milestone 1A |
| 2026-08-21 | 2.4 | Faction design and fiction pass: rewrote the five faction identities so philosophy, strategic verb, geometry, motion, chance, and voice make one statement each (Glitch converges instead of "chaotic", Alder grows instead of machining, verb *Transcend* → *Outgrow*); added psychographic promises, signature moments, and an anti-redundancy law; added mechanics-as-characterisation, variance-as-doctrine, capability asks, and Commander identity proposals to `commander-armies.md`; added the six-mission Operator belief ramp and a fully written Mission 1 to `campaigns.md`; added voice shades, system-text and bark exemplars, and ten pairing exchanges to the lore; protected the interface's voice as a twelfth deliberate mystery; registered Q10 (diegetic interface deception) and Q11 (Alder draft refusal). Mario resolved both the same day: Q10 **dropped** as mis-scoped — engine determinism was never in question and campaign writing is designed later — and Q11 answered at concept level — **Alder refuse artificial Nexus power: little or no draft, more complexity in the structures they grow** | Milestone 1A |
| 2026-08-21 | 2.5 | Execution-readiness audit — the canon read as a contract an isolated session must execute, not as a design document. Resolved four contradictions that sat directly on Gate 1A's path: the speed-tier order (`engine.md` 4.3 said descending, the fixture said ascending, and only ascending matched the fixture's own arithmetic), the viewport fitting algorithm (which gated *every* Grid smaller than the minimum viewport, including Gate 1A's own), the vertical chrome budget (Section 3.1 implied 20 rows while the floor said 24, and the two rows of one table disagreed with each other — Q12), and the ranged flight window that two documents assumed and none defined. Added the coordinate convention, defined speed tier as initiative, fenced facing as the one presentation-only field allowed in hashed state, and replaced the collision-mask caching prescription with the intent behind it. Closed the Gate 1A checks that no listed check would have caught: the view is now asserted against the event stream, `watch` and `run` must agree on hashes, the report must derive from events rather than kernel internals, and determinism is checked across Bun *and* Node. Split preferences from load-bearing RULEs (preset matrix, scroll margin), moved the monochrome-legibility claim to the human list where governance already required it, closed Q4 as bookkeeping, dropped Milestone 1's promise to answer Q7, and made AGENTS.md version-checked so the summary cannot drift. Registered Q12 and Q13, both applied under their recommendations | Milestone 1A |

| 2026-08-21 | 2.6 | **Milestone 1 built.** The Pulse Playground exists: Grid and composed collision masks, a deterministic nine-phase kernel, PCG32 with published vectors, the scenario format, a fixed-column levelled report derived only from events plus state, an 80×24 ASCII view over an engine-owned cell frame, and a `playground` CLI — then Gate 1B's eleven effects under the pure absolute-time contract, four render tiers, an optional Unicode pack, and a **Ravel fixture army** built for contrast, whose volatile-munitions rule is the first thing on the bench that makes a faction legible without a word of lore. 122 tests on Node and Bun, seventeen scenarios, hashes identical across runtimes. Promoted to RULE: 12 Hz and the movement-credit rules, the tick order, the PRNG, canonical serialization, mask caching as lazy views over one occupancy index, the flight-window formula, the Nexus as a definition flag, four capability tiers, and the corruption law enforced by the compositor rather than by recipe discipline. Corrected on evidence: OpenTUI's native core does not load under Node, and one fixture-arithmetic claim was a shot out. Registered Q14, Q15, Q16 and Q17. **Both gates' human checks remain unobserved, and no canon statement claims them** | Milestone 2, after Milestone 1 is accepted |
| 2026-08-23 | 2.7 | **`grid` CLI and map-file redesign**, requested directly by the owner ahead of Milestone 2: dropped the `run`/`watch`/`verify` subcommands for a single positional map argument (`grid <map>`, default action `watch`) plus `--headless` and `--verify` flags; converted every checked-in scenario from a `.ts` module to a `.map.json` file (`src/scenario/loadMapFile.ts`), the same shape a campaign level or a map-editor map will use later; merged the headless log and summary into one stream, default level lowered `INFO` → `WARN`, closed by a trailing `report` log line rather than a separate stdout summary; added `--turn <tick>` (seeks watch playback, filters the headless log, and cross-checks an intermediate state hash in `--verify`, all without re-simulating) and `--save-log <file>` (writes the log to a file in any action); `--verify` now defaults to 10 runs, still overridable. `engine.md` Section 11, `milestone-1-spike-battle.md` 3.3–3.5, and `replay-format.md`'s unbuilt CLI sketch updated to match | Milestone 2, after Milestone 1 is accepted |

## 7. Locked product decisions

- Title: **Terminal Nexus**.
- Product: deterministic terminal strategy; an LLM is not required.
- Match rhythm: 5–12 minutes.
- Phases: hidden, simultaneous, untimed **Build Phase** followed by a fixed-tick **Nexus Pulse**.
- Resolution speed: presentation is independent from deterministic logical time.
- Early engine/content stack: TypeScript-first; runtime and first terminal backend are evidence-selected.
- Renderer boundary: simulation emits visibility-filtered semantic views and events; the terminal compositor emits an engine-owned cell frame; platform backends are adapters.
- Presentation baseline: monochrome seven-bit ASCII, enhanced by explicit ANSI color and optional Unicode modes.
- The play surface is the **Grid**. The replica on it is a **Grid Nexus**; the one that stays home is a **Prime Nexus**.
- Grid presets: the **default `medium-extra-wide` (48 × 16) is locked**, because both compositions are derived from it. The rest of the preset matrix — sizes `small`/`medium`/`large`/`extra-large` against shapes `squared`/`wide`/`extra-wide` — is GUIDANCE in [`engine.md`](engine.md) Section 3.1 and may change when content shows a better set.
- Grid orientation is a rendering choice. Portrait and landscape change nothing about state, rules, or coordinates.
- The Grid has five layers — terrain, obstacles, workers, units, air. **Layers define render order only.** Collision is a mask composed from a chosen set of layers, so cross-layer collision is normal and same-tile coexistence is a property of the masks involved.
- Every entity has an anchor, a footprint, and a facing. **Units as well as structures may span multiple tiles**; a mover tests its whole footprint. Facing is presentation-only until a milestone earns otherwise.
- The viewport is clamped to between 48 × 16 and 72 × 24 tiles, so no display shows meaningfully more Grid than another. The cursor drives scrolling at a 3-tile margin. There is no minimap. The clamp and the cursor-driven rule are locked; **the tuning numbers inside them — the 3-tile margin above all — are locked direction, and Milestone 3 may retune them on evidence** from the first person who actually scrolls a Grid.
- Every engine statement declares its authority: **RULE** or **GUIDANCE**. Descriptive completeness is not authorization.
- Tile width is adaptive presentation: one terminal column per tile at 80 columns, two at 128 or wider. Same tiles, same information; 80×24 is the acceptance target.
- One resource per match. Deposits and salvage both yield it; supply is a separate population cap; Nexus energy is a state readout, not a currency.
- Commander: a prominent persistent frontline `@`, fictionally a Nexus Symbol; death causes one full Build Phase/Pulse cycle of absence before restoration.
- Prime Nexus: remains at its home location and replicates a smaller Grid Nexus; Nexuses do not teleport.
- Production: fixed recipes from buildings, not direct unit purchases.
- Victory: destroy the enemy Grid Nexus.
- First integrated factions: Citizens and Ravels.
- First complete single-player direction: Citizen origin campaign.
- Architecture: deterministic kernel, content, scenario, projection, presentation, adapters, and shell remain separate.
- Terminal library and JavaScript runtime are chosen independently; neither implies the other.
- Corruption effects never occupy the `units` or `structures` bands and never remove the only carrier of a required semantic cue.
- An undecided question lives in the open-questions register with a recommendation, not as a hedge inside a specification.
- Modding: preserve future seams but do not build a loader or stable SDK in early milestones.
- Logical time is **12 ticks per simulation second**, and movement credit is an integer accumulator capped at one step's cost that a blocked step keeps. Earned by Milestone 1; durations are authored in raw ticks, so the rate is expensive to change from Milestone 4 onward.
- The seeded gameplay PRNG is **PCG32** (`pcg_setseq_64_xsh_rr_32`), checked against published vectors. Cosmetic randomness is a **hash of an effect instance's identity**, never a stream — a stream's answers depend on how many times it was asked, which is exactly what effect purity forbids.
- A **Grid Nexus is a flag on a content definition**, never a content id the kernel recognises.
- The **compositor enforces the corruption law**: an effect cell that would replace an entity's glyph is dropped, and the only write permitted onto an occupied cell is a glyphless attribute change.
- Faction visual identity lives in the **glyph family and the effect language**. Ownership keeps the colour, so a mirror match stays legible and monochrome stays whole.
- Fixture armies on the bench are **not Commander Armies** and carry no balance claim. Milestone 4 still selects the real Citizens-versus-Ravels microgame.

## 8. Open when relevant

Decisions that **block or shape current work** live in [`open-questions.md`](open-questions.md), with
options, costs, and a recommendation each. The list below is the longer horizon: things that are
genuinely fine to leave unanswered until the project reaches them.

- exact Citizen and Ravel commanders and Commander Armies;
- radius metric, same-plan chaining, and hidden reveal conflicts;
- equal-tick mutual Nexus destruction;
- exact Nexus draft timing and research stacking;
- scoring and long-term skirmish progression;
- campaign cast, sequence, and ending;
- final title availability and trademark clearance;
- sound direction;
- commercial/open-source/community release model;
- multiplayer format;
- whether an LLM role proves worthwhile;
- whether Milestone 2 confirms 12 logical ticks per second and the movement-credit rules;
- whether the first browser path is hosted terminal parity or browser-native graphics;
- when a Rust or Go boundary becomes worth its complexity.

## 9. Test and playtest strategy

The mature project should combine:

- unit tests for coordinates, range, costs, cooldowns, serialization, definitions, and effect sampling;
- property tests for occupancy, resources, supply, bounded arbitration, and replay hashes;
- minimal scenario fixtures for movement claims, equal-speed damage, worker flight, salvage, connectivity, and Nexus access;
- structured-cell snapshots across capability and reduced-motion modes;
- replay round trips and hash comparison;
- soak tests over generated maps and seeds;
- clean-install, packaging, non-TTY, resize, signal, and cleanup tests;
- human playtests for recognition, emotional impact, comprehension, strategy, and replay desire.

Agents may act as invariant hunters, legal-policy players, and replay critics. Every engine defect must reduce to a state, plan, seed, or event fixture; every balance claim should identify a reproducible cohort.

**Every RULE table in [`engine.md`](engine.md) gets a test named for its section.** The cadence table
of Section 4.1 becomes `engine-4.1-cadence`; the band list of Section 9.4 becomes
`engine-9.4-bands`; the layer names, the preset default, and the collision-mask examples likewise.
The reason is drift: `scripts/check-repository.sh` compares documents against documents, and the
moment code exists there are two copies of every table with nothing comparing them. Named this way,
canon drift stops being something a reader has to notice and becomes a failing test with the
specification section in its name — the same trick as the validator, applied to the half of the
project it cannot see.

Initial balance metrics eventually include win rate, match length, resource flow, worker uptime, production contention, supply stalls, unit survival, building lifetime, salvage recovery, territory coverage, upgrade selection, commander uptime, Nexus damage timing, and comeback frequency.

Statistics diagnose; they do not define fun.

## 10. Deferred systems

### Local campaign opponents

Single-player opponents begin as deterministic local policies receiving the same bounded planning view and legal action vocabulary as a human. Scripted tutorials, weighted heuristics, and limited rollouts may share that interface. A campaign policy may cheat only when the mission communicates the exception.

### Multiplayer and model-driven AI

Hidden simultaneous plans and deterministic resolution fit asynchronous or live multiplayer, but networking waits for exact replays, content locks, plan validation, reveal rules, and a balanced two-faction match.

An LLM may later return a constrained legal plan, provide dialogue, answer contextual help, or add campaign texture. It does not mutate rules or become a dependency of the core game.

### Sound

**TBD — dedicated research and design pass required.** Stable semantic presentation cues should leave a clean future subscription point for movement, attacks, destruction, restoration, and Nexus states. No sound dependency belongs in Milestone 1.
