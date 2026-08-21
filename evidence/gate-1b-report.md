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

To be filled in as the work lands.

## 4. Automated results

| Check | Result | Evidence |
| --- | --- | --- |

## 5. Human observations

Nobody has watched it yet.

## 6. Interpretation

To be written after Section 4 is complete.

## 7. Failures, surprises, and discarded approaches

To be filled in as they happen.

## 8. Decision

> Pending.

## 9. Canon impact

| Proposed rule | Would live in | Earned by |
| --- | --- | --- |

## 10. Next authorized action

Pending the decision in Section 8.
