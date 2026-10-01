# Terminal Nexus — testing

_What the test suite proves and how; moved from the governance document and from AGENTS.md, to be rewritten._

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

**Every RULE table in [`engine.md`](../system-design/grid-engine.md) gets a test named for its section.** The cadence table
of Section 4.1 becomes `engine-4.1-cadence`; the band list of Section 9.4 becomes
`engine-9.4-bands`; the layer names, the preset default, and the collision-mask examples likewise.
The reason is drift: `scripts/check-repository.sh` compares documents against documents, and the
moment code exists there are two copies of every table with nothing comparing them. Named this way,
canon drift stops being something a reader has to notice and becomes a failing test with the
specification section in its name — the same trick as the validator, applied to the half of the
project it cannot see.

Initial balance metrics eventually include win rate, match length, resource flow, worker uptime, production contention, supply stalls, unit survival, building lifetime, salvage recovery, territory coverage, upgrade selection, commander uptime, Nexus damage timing, and comeback frequency.

Statistics diagnose; they do not define fun.

## 7. Verification

Until the product runtime is selected, run:

```bash
./scripts/check-repository.sh
```

When a gate adds commands, record exact install, build, test, and run instructions in its evidence
and promote the accepted ones into `DEVELOPMENT.md`.

**For simulation work** — Gate 1A, and every kernel change after it:

- the same scenario, seed, and tick count produce identical final-state and event hashes across many
  runs;
- resolving in one call equals resolving tick by tick;
- the kernel calls no clock and no `Math.random`, and imports nothing from a renderer — assert it,
  do not assume it;
- changing only the cosmetic seed changes nothing about state or events;
- no two entities overlap in a collision mask that includes both their layers, ever;
- arbitration terminates under a bounded pass count with a decreasing progress measure;
- every rule has a named scenario file that exercises it, checked in and runnable.

**For terminal work**, once a gate authorizes it:

- structured-cell snapshots, identical across backends;
- keyboard and mouse-event receipt;
- resize suspension and recovery from the same presentation time;
- alternate-screen and cursor cleanup;
- `q`, `SIGINT`, `SIGTERM`, setup failure, and caught render failure through one idempotent disposer;
- non-TTY behavior;
- monochrome ASCII and explicit color modes;
- startup, frame-time, changed-cell, and output-byte evidence.

The lifecycle cases matter most. A renderer that drops frames is a tuning problem; a renderer that
leaves the terminal in raw mode is a reason to reject it.
