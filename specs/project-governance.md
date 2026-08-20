# Terminal Nexus — project governance

**Document role:** Canon authority, evidence process, execution ledger, and durable decisions
**Status:** Canonical
**Canon version:** 2.1
**Updated:** 2026-08-20
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
| Canon audit and autonomy pass | COMPLETE | Canon 2.1 split Milestone 1's scope, added the open-questions register and gate-report template, and replaced hardcoded validator literals with derived invariants | Answer Q1 so the Gate 1A fixture composition is settled |
| Milestone 1A — cell frame and lifecycle | CURRENT | Backend measurements favor the OpenTUI imperative core; direct ANSI is the control | Run Gate 1A in `milestone-1-spike-battle.md` and stop for owner acceptance |
| Milestone 1B — authored ASCII battle reel | GATED | Requires a selected backend | Authorize only after Gate 1A passes |
| Milestone 1C — delivery probe | GATED | Independent of 1B; packaging, PTY, and browser terminal | Authorize when Terminal Nexus needs to run somewhere it was not built |
| Milestone 2 — deterministic Nexus Pulse | GATED | Requires visual-spike lessons | Lock deterministic contracts before implementation |
| Milestone 3 — builder and battle editor | GATED | Requires cell-frame and kernel direction | Lock placement rules before implementation |
| Milestone 4 — Citizens versus Ravels | GATED | Requires presentation, kernel, and builder proofs | Select the deliberately tiny integrated ruleset |
| Milestone 5 — human campaign fragment | GATED | Requires a replayable microgame worth teaching | Test narrative, unlocks, and pacing |

## 6. Progress history

| Date | Canon | Result | Next gate |
| --- | --- | --- | --- |
| 2026-08-19 | 1.1 | Consolidated product, lore, mechanics, architecture, tools, and milestones | Operational review |
| 2026-08-19 | 1.2 | Added agent autonomy, evidence loop, canon protocol, and execution ledger | Toolchain preflight |
| 2026-08-19 | 1.3 | Added renderer-neutral architecture, runtime research, 12 Hz hypothesis, and preflight contract | Renderer selection |
| 2026-08-19 | 1.4 | Completed repository quality pass and dual-license scope | Repository bootstrap |
| 2026-08-19 | 2.0 | Split the monolithic canon; updated Prime Nexus replication, Nexus Symbols, resurrection, and Build Phase/Nexus Pulse terminology | Milestone 1A |
| 2026-08-20 | 2.1 | Audited canon against itself and the concept art; narrowed Gate 1A to cell frame and lifecycle and moved delivery to Gate 1C; added the open-questions register, gate-report template, ASCII references, and concept index; corrected runtime direction against measured evidence; replaced hardcoded validator literals with derived invariants | Milestone 1A |

## 7. Locked product decisions

- Title: **Terminal Nexus**.
- Product: deterministic terminal strategy; an LLM is not required.
- Match rhythm: 5–12 minutes.
- Phases: hidden, simultaneous, untimed **Build Phase** followed by a fixed-tick **Nexus Pulse**.
- Resolution speed: presentation is independent from deterministic logical time.
- Early engine/content stack: TypeScript-first; runtime and first terminal backend are evidence-selected.
- Renderer boundary: simulation emits visibility-filtered semantic views and events; the terminal compositor emits an engine-owned cell frame; platform backends are adapters.
- Presentation baseline: monochrome seven-bit ASCII, enhanced by explicit ANSI color and optional Unicode modes.
- First visual target: a 48×18 battlefield inside one 80×24 composition.
- Commander: a prominent persistent frontline `@`, fictionally a Nexus Symbol; death causes one full Build Phase/Pulse cycle of absence before restoration.
- Prime Nexus: remains at its home location and replicates a smaller battlefield Nexus; Nexuses do not teleport.
- Production: fixed recipes from buildings, not direct unit purchases.
- Victory: destroy the enemy battlefield Nexus.
- First integrated factions: Citizens and Ravels.
- First complete single-player direction: Citizen origin campaign.
- Architecture: deterministic kernel, content, scenario, projection, presentation, adapters, and shell remain separate.
- Terminal library and JavaScript runtime are chosen independently; neither implies the other.
- Corruption effects never occupy the `units` or `structures` bands and never remove the only carrier of a required semantic cue.
- An undecided question lives in the open-questions register with a recommendation, not as a hedge inside a specification.
- Modding: preserve future seams but do not build a loader or stable SDK in early milestones.

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
