# Terminal Nexus specifications

**Canon version:** 2.0
**Current implementation gate:** Milestone 1A — renderer preflight

The project canon is this document set, not one monolithic file. Each document has one job, and the current milestone controls implementation scope.

## Start here

For a new coding session, read:

1. [`terminal-nexus-concept.md`](terminal-nexus-concept.md) — the one-page game definition.
2. [`milestone-1-spike-battle.md`](milestone-1-spike-battle.md) — the active implementation contract. Only Gate 1A is currently authorized.
3. [`project-governance.md`](project-governance.md) — authority, evidence loop, execution ledger, and locked decisions.
4. Only the sections of the supporting canon named by the active gate.
5. Existing source, tests, and evidence before changing code.

For game design or fiction, choose the relevant document below rather than feeding an agent the entire repository.

## Canon map

- [`terminal-nexus-concept.md`](terminal-nexus-concept.md) — short product pitch: audience, match, promise, differentiators, and current scope.
- [`terminal-nexus-lore.md`](terminal-nexus-lore.md) — universe, Prime Nexuses, Nexus Symbols, Ancients, Originals, factions, ASCII semiotics, voice, and story seeds.
- [`engine.md`](engine.md) — gameplay contracts, deterministic architecture, grid/combat/economy rules, content interfaces, rendering, runtime direction, replay, tools, and modding seams.
- [`commander-armies.md`](commander-armies.md) — future playable packages of Commander, units, structures, upgrades, and Nexus powers. Rosters are intentionally undefined.
- [`campaigns.md`](campaigns.md) — mission/campaign structure, teaching, Citizen opening, cutscenes, opponent policies, and authoring tools.
- [`project-governance.md`](project-governance.md) — canon maintenance, bounded autonomy, evidence process, progress, decisions, tests, and deferred systems.

## Milestones

- [`milestone-1-spike-battle.md`](milestone-1-spike-battle.md) — **CURRENT:** renderer preflight followed, after acceptance, by an authored ASCII battle reel.
- [`milestone-2-deterministic-pulse.md`](milestone-2-deterministic-pulse.md) — deterministic grid combat and replay authority.
- [`milestone-3-builder-editor.md`](milestone-3-builder-editor.md) — Build Phase UX and agent-friendly battle editor.
- [`milestone-4-citizens-ravels.md`](milestone-4-citizens-ravels.md) — minimal complete two-faction match.
- [`milestone-5-campaign-fragment.md`](milestone-5-campaign-fragment.md) — first Citizen campaign proof.

Only the gate marked **CURRENT** is implementation authority. Future documents are planning context and must be expanded with exact fixtures before work begins.

## Updating canon

After an accepted gate, update the relevant focused document, execution ledger, progress history, and next milestone. Increment the shared canon version for semantic changes and update every changed document's metadata.

Do not duplicate a rule across files unless one location is explicitly a short summary linking to its authority. Lore facts belong in the lore document; implementation contracts belong in the engine; playable options belong in Commander Armies; mission content belongs in campaigns.
