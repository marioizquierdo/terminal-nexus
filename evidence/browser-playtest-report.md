# Browser playtest page, and two round-2 decisions — report

**Document role:** Evidence report for owner-directed work between gates 5F and 5G
**Status:** PASS — awaiting Mario's play on a real phone
**Canon version:** 2.20
**Updated:** 2026-09-27
**License:** Apache-2.0

## 1. Frame — written before coding

- **Question.** Mario agreed to three things on 2026-09-27: (a) the Nexus Powers popup closes itself
  after a pick (Q60); (b) the menu side of the map gets a solid "map ends here" bar like the other
  three sides, without it reading as a heavy menu border (feedback F17); (c) the portable-rendering
  proposal — a browser page that plays the real game on a phone, as a development tool, built before
  gate 5G, painting on a canvas, with a plain-JavaScript SHA-256 everywhere if it is fast enough, one
  private page per pull request, and a line in the design documents and agent instructions.
- **Smallest artifact.** One reducer line for (a); one extra layout column for (b); for (c), written
  interfaces for what the three screen loops already use from a terminal, a canvas backend, one DOM
  file, and a Bun build script — no second game loop.
- **Evidence.** Tests for each behaviour change; a speed measurement before switching the hash; a test
  that runs the browser bundle with no Node features and compares fingerprints with Node's; an
  emulated-iPhone run of the built page; regenerated screenshots, looked at.
- **Exclusions.** No xterm.js mode, no demo sandbox (`demos/`), no GitHub Pages — all deferred by the
  proposal. No gate 5G work.

## 2. Environment — pinned, not remembered

Node 22.22.2, Bun 1.3.11, TypeScript 7.0.2, Chromium 1194 (Playwright's) for the emulated-phone run,
this cloud container (Linux).

```bash
npm run typecheck                    # both tsconfigs
npm test                             # 437 pass
npm run test:bun                     # all files pass, including the sandbox test
bun scripts/build-web.mjs            # dist/terminal-nexus-playtest.html
for map in scenarios/*.map.json; do ./bin/grid.ts "$map" --verify --runs 20; done
node scripts/capture-spike-screenshots.mjs
./scripts/check-repository.sh
```

## 3. What was built

- **The popup closes on the pick** (`pickNexus` in `src/build/state.ts`). Esc still closes it without
  one; reopening it lists the pick as active.
- **The map's west side is its own column.** The menu's divider moved one column left and stays a
  plain line; the Grid's west side is solid where the map ends, a blank gutter otherwise (then the
  divider is drawn light, like the other three sides). The menu's text is one character narrower; the
  map keeps its 48 columns at 80 × 24 (`src/build/layout.ts`, `drawChrome` in `src/view/build.ts`).
- **Terminal and host interfaces** (`src/view/backends/ports.ts`, `Host` in `src/cli/lifecycle.ts`):
  the menu, Build Phase and Pulse playback loops take a terminal-shaped output and input and a host
  for interrupts, exit and error reporting. Node's `process` fits them unchanged. A loop also accepts
  a backend object where it took a backend name.
- **Pulse `q` fix** (`src/cli/watch.ts`, feedback F16): leaving now finishes the playback promise.
- **SHA-256 in plain JavaScript** (`src/state/sha256.ts`), used by every fingerprint.
- **Settings parse moved** out of the file-system module into `src/settings/types.ts`.
- **Canvas backend** (`src/view/backends/canvas.ts`): a pure `paintOps` step and a painter.
- **The page**: `src/web/keys.ts` (key presses and taps to terminal bytes, through the scripted
  playtest's own key names), `src/web/host.ts` (the one DOM file), `src/web/page.html`,
  `scripts/build-web.mjs` and `scripts/lib/web-bundle.mjs` (fails on any Node-only import).
- **CI** builds the page after the Bun tests.

## 4. Automated results

| Check | Result |
| --- | --- |
| `npm run typecheck` | clean, both configurations |
| `npm test` (Node) | 437 pass, 0 fail |
| `npm run test:bun` | all test files pass |
| `tests/web.test.ts` sandbox test (Bun) | grand battle's state and event hashes, 41 Pulse frames, 13 Build Phase frames and 6 menu frames identical to Node's |
| Build with a `node:crypto` import put back into `src/state/canonical.ts` | build fails naming the file; two web tests fail |
| `tests/lifecycle.test.ts` new q test, with the fix removed | fails ("hung") |
| `./scripts/check-repository.sh` | passes at canon 2.20 |

**Speed check for the hash switch** (same container, back to back): `grid --verify --runs 20` over
every map took 19.8 s with `node:crypto` and 20.7 s with the plain version (about 4% slower); `npm
test` went from 44.7 s to 46.3 s. Hashing alone is about 4.5× slower (about 15 ms per MB), a small
share of resolving a battle.

**Page size**: 134 KB, one file, 77 source files, no libraries.

## 5. Human observations

Mine, not Mario's. In Playwright's emulated iPhone 13 (landscape): the Build Phase opened; the key bar's
`n`, `Enter`, `1` picked a power (the popup closed) and armed a Barracks; two taps on one tile placed
it ("Barracks placed (resources: 90)"); the grand battle played with effects; the menu opened on
Campaign. The only console error was the web font failing through this container's proxy, so the
page fell back to a system monospace. **Not checked: a real iPhone, or an iPad's hardware keyboard**
(Esc and Option are the uncertain keys).

## 6. Interpretation

The page runs the terminal's code: the loops are the same functions, the bundle is proven Node-free by
the build, and its fingerprints match Node's. What it cannot show is listed in `DEVELOPMENT.md`.

## 7. Failures, surprises, and discarded approaches

- My remembered NIST vector for the two-block SHA-256 test string was wrong (`…f7ff3de`); Node's own
  crypto and the new code both gave `…db06c1`, which is the published value.
- The Build Phase's `q` now asks before leaving, so the page cannot switch screens by sending `q` as
  the research prototype did. It sends Ctrl+C, every screen's immediate quit.
- Moving the west edge one column inside the map would have cost a map column and put the viewport
  below its 48-column floor at 80 × 24; the column comes from the menu instead.
- A lighter second line beside the divider, while the map scrolls, read as a double border
  (`||`, `++`); the Grid's west column is a blank gutter then, and the divider carries the light side.
- The regenerated screenshot script still used "n 1 n" (pick, then n to close); after the change that
  reopens the popup, and two live-terminal shots timed out until it was fixed.

## 8. Decision

**PASS.** Everything asked is built, with tests; the page needs Mario's play on a real phone.

## 9. Canon impact

Canon 2.20: `engine.md` 10.2 gains the browser page's rule. Q60 is answered. The feedback log lists the
design-document sentences still owed an update for the orchestrator's pass.

## 10. Next authorized action

Mario plays the page from his phone; the orchestrator's pass over the open feedback items; then gate
5G.
