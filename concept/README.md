# Terminal Nexus — concept art

**Document role:** Early visual exploration. Not canon, not decisions
**Status:** Reference
**Canon version:** 2.4
**Updated:** 2026-08-20
**License:** CC BY-SA 4.0

## What this is

Three images made early, to see what the game might feel like. **Do not take them too seriously.**
Nothing here is a commitment, and no session should treat a detail in them as a requirement.

The real visual concept will come from the **Pulse Playground** — from watching actual units move,
shoot, and die on a real Grid, at the real frame rate, in a real terminal. Concept art cannot answer
whether motion reads. The Playground can.

When a piece and a specification disagree, the specification wins. If the disagreement looks like a
real decision, it becomes a row in [`../specs/open-questions.md`](../specs/open-questions.md).

## Files

Drop the images in with these names; this index refers to them so.

| File | Subject |
| --- | --- |
| `01-nexus-pulse.png` | A Nexus Pulse resolving — Grid with sidebar readouts |
| `02-build-phase.png` | Build Phase — placing a structure with ghost, radius, and validation |
| `03-intercept-cutscene.png` | Cutscene — two Commanders talking over an ASCII tableau |

> The image binaries are not committed yet. This index was written from the pieces as shown.

## What is worth keeping from them

Not a delta table — just the ideas that seem good, for whoever authors the real thing later.

**From the Pulse piece.** Movement trails (`----->`) give a one-cell actor direction and weight, and
they cost almost nothing — this is why `fx.move.trail` is the first effect authored in Gate 1B. The
sidebar reads as *state* rather than telemetry: `NEXUS CRITICAL`, `INTEGRITY 06%`, `STATUS ENGAGED`
tells a story at a glance. Citizen structures read as interlocking armour and Ravel forces as
scattered diagonals, so the factions separate by **shape before colour** — which is the legibility
rule working without anyone enforcing it.

**From the Build Phase piece.** The placement panel that explains *why* — *Connected to Nexus. Clear
terrain. Outside enemy range.* — is the best single idea in the set, and worth more than a red cell
and no reason. Hidden information drawn as `?` rather than omitted keeps the tension without leaking
the plan. The keyboard-first footer with undo and commit. A permanent legend strip.

**From the cutscene.** The speaker badge is the Grid glyph, boxed in the faction's own geometry —
`@` in Citizen orange in a hard-angled frame, `g` in Ravel pink in a jagged one. That is the "rhyme at
four resolutions" rule from [`../specs/terminal-nexus-lore.md`](../specs/terminal-nexus-lore.md)
Section 1, demonstrated rather than described. Two lines of dialogue doing the work of a paragraph.
`SIGNAL SOURCE: BELOW` as the only status text.

## Known drift

The art predates several decisions and says so in places — a retired phase name, a `TURN` counter,
a `DAYTIME PULSE` header, and separate salvage and energy counters where the game now has one
resource. None of it matters. Redraw when the Playground gives us something real to draw from.

## Adding a piece

Drop the file here with a numbered, descriptive name, add a line to the table, and note anything worth
keeping. Concept art is CC BY-SA 4.0; third-party references must be attributed and never traced.
