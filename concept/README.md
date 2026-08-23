# Terminal Nexus — concept and provenance

**Document role:** Early visual exploration and the superseded original specification. Not canon, not decisions
**Status:** Reference
**Canon version:** 2.6
**Updated:** 2026-08-22
**License:** CC BY-SA 4.0 for the art; the archived specification carries its own mixed licence

## What this is

Two kinds of thing, both kept for provenance and neither of them authoritative:

- **Concept art** made early, to see what the game might feel like, plus screenshots taken later from
  the real thing. **Do not take the early pieces too seriously.** Nothing in them is a commitment.
- **The original specification**, the single file the project started as, before the canon was split
  into [`../specs/`](../specs/README.md).

When a piece here and a specification disagree, the specification wins. If the disagreement looks
like a real decision, it becomes a row in [`../specs/open-questions.md`](../specs/open-questions.md).

The real visual concept now comes from **`grid`** (`../bin/grid.ts`), watching actual units move,
shoot, and die on a real Grid, at the real frame rate, in a real terminal. Concept art cannot answer
whether motion reads. `grid` can — which is why the newest files here are screenshots rather than
drawings.

## Files

Named by the date they were made, so the folder reads chronologically.

| File | What it is |
| --- | --- |
| `2026-08-19 - original spec.md` | The superseded single-file specification, frozen. See below |
| `2026-08-19 - concept art.png` | The first look at the game's world and tone |
| `2026-08-19 - gameplay concept 1.png` | A Pulse resolving — Grid with sidebar readouts |
| `2026-08-19 - gameplay concept 2.png` | Base building — placement with ghost, radius, and validation |
| `2026-08-19 - campaign intro concept 2.png` | Cutscene — two Commanders talking over an ASCII tableau |
| `2026-08-19 - ascii factions.png` | Faction glyph and shape vocabulary |
| `2026-08-19 - ascii pulse.png` | Movement, fire, and impact drawn as ASCII |
| `2026-08-21 - dev screenshot 1.png` | **Real output.** `grid` mid-Pulse |
| `2026-08-21 - dev screenshot 2.png` | **Real output.** `grid` mid-Pulse |
| `2026-08-21 - grid prototype 1 - b&w.PNG` | **Real output.** The monochrome tier — the acceptance floor |
| `2026-08-21 - grid prototype 1 - color.PNG` | **Real output.** The same frame in truecolor |
| `2026-08-21 - grid prototype 2 - ravelsclash.png` | **Real output.** Citizens against Ravels |
| `2026-08-21 - grid prototype 2 - ravelsclash wide.png` | **Real output.** The same clash at two columns per tile |

The `2026-08-21` files are captures of working code, not drawings. Newer captures, tied to specific
ticks and render tiers, live in [`../evidence/screenshots/`](../evidence/screenshots/) alongside the
gate report that cites them.

## The archived specification

[`2026-08-19 - original spec.md`](2026-08-19%20-%20original%20spec.md) is where every current document
came from. It declares **Status: Historical**, which means three things:

- nothing may depend on it, and no session should build from it;
- it is **not** edited to match current vocabulary or current decisions — it still says *Veil*, <!-- stale-ok -->
  *planning phase*, and *battlefield*, where the canon now says **Build Phase**, **Nexus Pulse**, and the **Grid**; <!-- stale-ok -->
- the repository validator therefore exempts it from the canon-version and retired-terminology
  checks, while still requiring its metadata header and still following its links. Any document that
  declares itself Historical gets the same treatment, for the same reason: an archive edited to use
  today's words stops being a record of what was actually said.

Read it to find out *why* something is the way it is. Read [`../specs/`](../specs/README.md) to find
out what is true.

## What is worth keeping from the early art

Not a delta table — just the ideas that seem good, for whoever authors the real thing later.

**From the Pulse piece.** Movement trails give a one-cell actor direction and weight, and they cost
almost nothing — this is why `fx.move.trail` was the first effect authored in Gate 1B, and it is the
one that turned out to matter most. The sidebar reads as *state* rather than telemetry: `NEXUS
CRITICAL`, `INTEGRITY 06%`, `STATUS ENGAGED` tells a story at a glance. Citizen structures read as
interlocking armour and Ravel forces as scattered diagonals, so the factions separate by **shape
before colour** — which is the legibility rule working without anyone enforcing it.

**From the base-building piece.** The placement panel that explains *why* — *Connected to Nexus.
Clear terrain. Outside enemy range.* — is the best single idea in the set, and worth more than a red
cell and no reason. Hidden information drawn as `?` rather than omitted keeps the tension without
leaking the plan. The keyboard-first footer with undo and commit. A permanent legend strip.

**From the cutscene.** The speaker badge is the Grid glyph, boxed in the faction's own geometry —
`@` in Citizen orange in a hard-angled frame, `g` in Ravel pink in a jagged one. That is the "rhyme at
four resolutions" rule from [`../specs/terminal-nexus-lore.md`](../specs/terminal-nexus-lore.md)
Section 1, demonstrated rather than described. Two lines of dialogue doing the work of a paragraph.
`SIGNAL SOURCE: BELOW` as the only status text.

## Known drift in the early art

The `2026-08-19` pieces predate several decisions and show it — a retired phase name, a `TURN`
counter, a `DAYTIME PULSE` header, and separate salvage and energy counters where the game now has
one resource. None of it matters. Redraw when `grid` gives us something new worth drawing from.

## Adding a piece

Drop the file here with a dated, descriptive name, add a row to the table, and note anything worth
keeping. Concept art is CC BY-SA 4.0; third-party references must be attributed and never traced.
