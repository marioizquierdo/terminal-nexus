# Measurements

_Results of `bin/measure.ts`, written down as [`measurement.md`](../../system-design/measurement.md) says: each file is
one run of a spec, with the build and the day it ran on and the routes it measured. Read one with
`node bin/measure.ts show <file>`; compare two with `node bin/measure.ts compare <before> <after>`._

| Date | Spec | Routes | File |
| --- | --- | --- | --- |
| 2026-10-20 | full | the greedy step, before pathfinding: the baseline | [2026-10-20-baseline-greedy.json](2026-10-20-baseline-greedy.json) |
| 2026-10-20 | full | distance fields round what stands, crowds and swaps, reachable targets, slow ground, side layers, flight maps, the enemy Nexus by default, units out over the roofs: the pathfinding milestone, built ([what it says](../reports/2026-10-20-pathfinding-measured.md)) | [2026-10-20-routes-and-roofs.json](2026-10-20-routes-and-roofs.json) |
