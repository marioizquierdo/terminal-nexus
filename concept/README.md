# Terminal Nexus — concept art

**Document role:** Early visual exploration and historical reference. Not canon, not decisions
**Status:** Reference
**Canon version:** 2.10
**Updated:** 2026-09-01
**License:** Mixed — see "Licensing" below

## What this is

Two different kinds of material, both kept for reference rather than authority:

- **Concept art** (`2026-08-19 - *.png`) — early visual exploration, made before any code existed, to
  see what the game might feel like. **Do not take it too seriously.** Nothing here is a commitment,
  and no session should treat a detail in it as a requirement.
- **Dev screenshots and prototypes** (`2026-08-21 - *.png`/`.PNG`) — actual captures of `grid`
  running, once there was a real Grid to watch. This is the material the original concept art
  predicted would eventually replace it: concept art cannot answer whether motion reads: `grid` can,
  and now some of it has.

When a piece and a specification disagree, the specification wins. If the disagreement looks like a
real decision, it becomes a row in [`../specs/open-questions.md`](../specs/open-questions.md).

## Files

| File | What it is |
| --- | --- |
| `2026-08-19 - ascii factions.png` | Early faction-identity ASCII exploration |
| `2026-08-19 - ascii pulse.png` | Early Nexus Pulse composition exploration |
| `2026-08-19 - campaign intro concept 2.png` | Campaign-intro / cutscene concept |
| `2026-08-19 - concept art.png` | General early visual exploration |
| `2026-08-19 - gameplay concept 1.png` | Gameplay composition concept |
| `2026-08-19 - gameplay concept 2.png` | Gameplay composition concept |
| `2026-08-19 - original spec.md` | **Historical archive** — the actual pre-canon-split specification, kept verbatim. See the note at the top of the file itself before reading it as if current |
| `2026-08-21 - dev screenshot 1.png` | A real captured frame of `grid` running |
| `2026-08-21 - dev screenshot 2.png` | A real captured frame of `grid` running |
| `2026-08-21 - grid prototype 1 - b&w.PNG` | `grid`, monochrome capability tier |
| `2026-08-21 - grid prototype 1 - color.PNG` | `grid`, colour capability tier |
| `2026-08-21 - grid prototype 2 - ravelsclash wide.PNG` | `grid`, a Ravels engagement, wide composition |
| `2026-08-21 - grid prototype 2 - ravelsclash.PNG` | `grid`, a Ravels engagement |

These descriptions are provisional, written from filenames rather than a full curatorial pass — a
"what's worth keeping from each piece" analysis like the one this README used to carry for the
(never actually committed) placeholder images it described is worth doing properly against the real
art here, but is future work, not done in this pass.

For genuine documentation of what `grid` looks like and why, prefer
[`../evidence/screenshots/`](../evidence/screenshots/) — captured by
`.claude/skills/grid-screenshots`, current, and reproducible on demand — over the dated snapshots
here, which age the moment the tool's presentation changes again.

## Known drift

Concept art predates several decisions and may say so in places — retired phase names, resource
counts that no longer match the one-resource rule, or a Build Phase drawn before it had that name.
None of it matters; redraw when `grid` gives something real to draw from instead.

## Licensing

Concept art (`2026-08-19 - *.png` except the spec, and the `2026-08-21` dev screenshots/prototypes)
is CC BY-SA 4.0 — visual direction, per `NOTICE`. `2026-08-19 - original spec.md` is the archived
precursor to `specs/`, which itself splits license by subject (Apache-2.0 for technical/engineering
content, CC BY-SA 4.0 for lore and creative content) — the same split applies to its archived
ancestor; it has not been re-split section by section, since editing it at all would undo the point
of an archive. Third-party references must be attributed and never traced.

## Adding a piece

Drop the file in with a dated, descriptive name (`YYYY-MM-DD - subject.png`) matching what's already
here, and add a row to the table above.
