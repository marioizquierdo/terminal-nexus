# Milestone 8 — Commander

**Document role:** Milestone tracker — the first real Commander (Edda Vasse) and a small Nexus upgrade draft
**Status:** GATED
**Depends on:** Milestone 5 (Build Phase is where the upgrade pick lives), Milestone 6 (Pulse is where the Commander acts)
**Updated:** 2026-09-01
**License:** Creative identity is CC BY-SA 4.0 (already true of `commander-armies.md`); mechanism is Apache-2.0

> **This widens Level 1's scope on purpose, and it needs saying plainly.** Every earlier framing of
> Level 1 in this repository (`../milestones/milestone-01-grid-battles.md`'s own acceptance note,
> `../specs/campaigns.md` Section 1) explicitly deferred the Commander mechanic to Mission 3
> (RESTORATION) and told sessions not to author a Commander Army before Milestone 4. Mario's own
> milestone list puts a real Commander in Level 1. See Section 3 below for exactly what does and does
> not change because of that — this is not a quiet reversal, it is a decision that needs the same
> scrutiny any scope change gets.

## 1. Question

Can Commander Edda Vasse exist as a real, persistent frontline unit — with the death/absence/
restoration mechanic [`../specs/engine.md`](../specs/engine.md) Section 5.1 already describes and
nothing has built yet — and can the player pick from a small, real Nexus upgrade draft during Build
Phase, without this becoming "author the Citizens Commander Army" ahead of Milestone 4?

## 2. What gets built

- **The Commander mechanic, for the first time**: a persistent `@`-class unit on the `units` layer,
  competing for investment like any other build choice, that on death is absent for the rest of that
  Pulse and one full Build Phase and Pulse, after which the Prime Nexus may replicate it again.
  "Commander death is not the victory condition" stays true — PERIMETER's own victory/defeat
  (Milestone 6, Q36) never depends on Vasse specifically.
- **Vasse, named**: [`../specs/commander-armies.md`](../specs/commander-armies.md) Section 4.4's
  doctrine — "fortify, verify, then advance" — becomes her actual behaviour profile and stat shape,
  scoped to what PERIMETER needs, not a full roster entry.
- **A small, real Nexus upgrade draft**: [`../specs/engine.md`](../specs/engine.md) Section 5.4 says
  "the Grid Nexus offers a small draft of upgrades" and admits "none of this is designed." This
  milestone designs and builds the smallest real version — one or two options, mission-scoped, filling
  the upgrade-pick slot Milestone 5 already built the mechanism for. Since canon 2.10 the draft has a
  defined source: **the Commander Army's own Nexus power pool, dealt as a hand at the start of each
  Build Phase, one kept** ([`../specs/commander-armies.md`](../specs/commander-armies.md) Section
  2.1). Vasse's PERIMETER army is that shape at its smallest — a pool of two, a hand of two, one
  kept per Build Phase across the mission's three Pulses — which is enough to build the dealing
  mechanism once and never as a placeholder.

## 3. Q34 — does this mean authoring a Commander Army?

**No, and here is the exact line.** A Commander Army
([`../specs/commander-armies.md`](../specs/commander-armies.md) Section 1) is "the complete set of
choices legally available to one player in one match" — starting resources, every legal unit and
structure, the full upgrade pool, faction rules, portraits, barks, effect motifs, balance hypotheses.
This milestone builds one named Commander's mechanic and a two-option upgrade draft scoped to one
mission. Everything else the player can do in PERIMETER is still the disposable Citizen fixture
roster, carrying no balance claim, exactly as Milestone 1 shipped it. Building the *mechanism* a
Commander Army will eventually need, and exercising it once, narrowly, for a named story character the
mission's own already-written fiction requires, is not the same act as selecting and locking the real
Citizens roster.

**Recommendation, registered as Q34 in [`../specs/open-questions.md`](../specs/open-questions.md):**
build the mechanism and Vasse specifically; keep the upgrade draft to the one or two options this
mission needs; do not treat this milestone as Milestone 4's roster selection, and say so explicitly in
this milestone's own gate report so a later reader does not mistake "Vasse exists" for "the Citizens
Commander Army is locked."

**The RESTORATION question.** Mission 3 is where the belief ramp spends the death/absence/restoration
beat narratively ("Vasse dies mid-Pulse — and play continues," `campaigns.md` Section 4.1). Building
the mechanic now does not have to spend that beat early: PERIMETER's own design (map, raid strength)
should simply not force Vasse's death, so the mechanism exists and is testable without the *story*
using it before Mission 3 is ready to.

## 4. Explicitly not this milestone

The full Citizens Commander Army (Milestone 4); a second or third proposed Commander
(`commander-armies.md` Section 4.4 lists two more — Director Denz, Marshal Teag — untouched); Nexus
powers beyond the small upgrade draft; any Ravel-side Commander (Speaker Corvane appears in
PERIMETER's own dialogue but is not a playable or mechanically-modeled unit here).

## 5. Acceptance

Automated: the Commander's death/absence/restoration timing follows the exact cadence
`engine.md` Section 5.1 already specifies, on a named scenario, hash-stable across many runs and both
runtimes; the upgrade draft's effect is deterministic and asserted, not merely "looks right."

Human: a player can tell Vasse apart from an ordinary trooper on sight, understands what her death did
when it happens, and can explain what the upgrade they picked actually changed.

## 6. Definition of done

- [ ] Q34 is registered with its recommendation;
- [ ] the Commander mechanic (persistent unit, death/absence/restoration) is built and tested against
      `engine.md` Section 5.1's own cadence;
- [ ] the upgrade draft offers a real, mechanically distinct choice, not a cosmetic one;
- [ ] this milestone's gate report says explicitly that the Citizens Commander Army is still not
      locked, so the distinction in Section 3 survives past this session;
- [ ] `./scripts/check-repository.sh` passes.
