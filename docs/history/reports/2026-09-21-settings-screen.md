# Gate report — Milestone 3, Gate 3B: Settings

**Document role:** Gate evidence report for Gate 3B
**Status:** BUILT — Section 8 concludes PASS on every automated check; owner review is outstanding
**Canon version:** 2.16
**Updated:** 2026-09-21
**License:** Apache-2.0

---

## 1. Frame — written before coding

- **Canon version:** 2.16.
- **Milestone and gate:** Milestone 3 — Game Menu; Gate 3B (Settings). Gate 3A (the menu and the
  three adapters) is built, merged, and Mario has moved the project on to this gate directly, the
  same kind of direct go-ahead that carried Milestone 1 from Gate 1A into 1B before 1A's own human
  check had happened.
- **Question this gate answers:** Can a player change how the game looks and sounds — screen colour
  depth, light or dark background, plain or fancier symbols, and whether decorative motion is on —
  from a menu instead of only a command-line flag, and does that choice survive quitting and
  relaunching the game?
- **Smallest artifact that can answer it:** a Settings screen, reached from the top-level menu's
  Settings option, built entirely out of the same reusable menu list gate 3A already has: four rows,
  each showing its current value and cycling to the next choice when picked, plus a fifth row (and
  Esc) to go back. A small file next to the game's other local files remembers the last choice made,
  read back the next time the game starts.
- **Automated evidence planned:**
  - the same keyboard/mouse/click-equivalence proof gate 3A built, now against the Settings screen's
    own rows — a raw hotkey, raw arrow-then-Enter, and a raw mouse click at the row's own screen
    position all change the same setting;
  - the saved file survives a full stop-and-restart: write it, throw away everything in memory, load
    it fresh, and check the values came back exactly as they were left;
  - a missing file, an empty file, and a file with garbage in it all fall back to sensible defaults
    instead of crashing the game;
  - going back to the main menu (by the Back row or by Esc) returns to exactly where the player was,
    and changing a setting is visible immediately — the very next frame is already drawn in the new
    theme or colour depth, not just remembered for later;
  - the whole existing suite from gate 3A stays green, since this gate is meant to extend that
    screen, not replace it.
- **Human observation planned:** none required to close this gate, for the same reason as 3A — every
  criterion above is something a test or a screenshot can check on its own. Screenshots go in
  `evidence/screenshots/` regardless, for whenever Mario wants to look.
- **Explicit exclusions:** anything about Campaign or Challenge (that is Gate 3C's job); a real
  save file for campaign progress (still not built, still a later decision); sound (nothing plays
  sound yet); any new game-play setting beyond the four the milestone names (colour depth, light or
  dark, plain or fancy symbols, and decorative motion on/off).
- **Stop conditions:** if changing a setting turns out to need more than the menu shape gate 3A
  already built — for example if the reusable list turns out unable to show "the current value of a
  choice," which would mean 3A's own list shape doesn't generalise the way it was supposed to.

## 2. Environment — pinned, not remembered

| | |
| --- | --- |
| OS and architecture | Linux (container), x86_64 |
| Runtime and exact version | Node v22.22.2; Bun 1.3.11 |
| Dependencies and exact versions | `@opentui/core@0.5.6`, `typescript@7.0.2`, `@types/node@22.20.1` — unchanged by this gate |
| Hardware, if it affects measurements | Not applicable |
| Date measured | 2026-09-18 |

Commands, copy-pasteable, in the order a stranger would run them:

```bash
# install
npm ci

# build
# there is no build step

# typecheck
npm run typecheck

# test
npm test
npm run test:bun

# run
./bin/terminal-nexus.ts
./scripts/check-repository.sh
```

## 3. What was built

**The settings values themselves, `src/settings/types.ts`** — no stdin, no file access, no
`menu`/`view` import: just the shape and how each field steps forward.

- `Settings` — `capability`, `theme`, `glyphPack`, `reducedMotion`, the same four things `grid`
  already takes as flags.
- `DEFAULT_SETTINGS` — a fixed, honest baseline (`color16`/`dark`/`ascii`/off) for what a brand-new
  player or a corrupt file falls back to. Deliberately not `grid`'s own terminal-sniffing guess:
  that guess is still applied once, in `terminalNexus.ts`, only on a genuinely first run — see
  below.
- `nextCapability`/`nextTheme`/`nextGlyphPack`/`toggleReducedMotion` — one small `cycle` helper
  wrapping each field's own legal-value list, so picking a row always lands on another real value,
  never an invalid one.

**Reading and writing the file, `src/settings/store.ts`** — `defaultSettingsPath()` points at
`~/.terminal-nexus/settings.json`, a dotfolder `grid` never reads. `load()` returns `null` for
"nothing to apply yet" (no file, unreadable JSON, or JSON that is not a settings-shaped object —
including a bare array or string, which pass a naive `typeof === "object"` check in JavaScript but
are not what this means) rather than throwing, so a caller's own first-run guess is a real fallback,
not a crash to catch. `parseSettings` rebuilds a legal `Settings` one field at a time, so a file
missing a field (an older version of the game), carrying one this version doesn't recognise (a
newer one), or holding one of the wrong type still yields every other field it got right. `save()`
creates the containing folder if needed, then writes the whole file.

**A fourth command, `back` (`src/menu/types.ts`, `src/menu/list.ts`, `src/menu/keyboard.ts`)** — Esc,
handled the same way `quit` already was: the pure reducer (`applyMenuCommand`) passes it straight
through without touching `highlighted`, because leaving a screen is the session's business, not the
list's. `MenuSession` gained an `onBack` callback (default: do nothing, correct for a screen with
nowhere to go back to) and a `setItems(items)` method that replaces a session's item list in place —
a settings row relabelling itself ("Background: dark" → "Background: light") is new text on the same
screen, not a new one, and the highlight only moves if the list genuinely shrank underneath it.
`handleKey(key, layout)` was pulled out of `handleData`'s loop body as its own method — see Section
7 for why a caller juggling two screens needs it split out this way.

**The Settings screen and the settings-aware CLI, `src/cli/menu.ts` and `src/cli/terminalNexus.ts`**
— `settingsItems(settings)` builds five rows fresh from the current values every time one changes:
colour depth, background, symbols, reduced motion, and Back. `runMenu` now holds two persistent
`MenuSession` instances (top-level and settings) and a `screen` flag choosing which one is live;
picking a settings row cycles that field, rebuilds the row list, tells the backend to redraw with the
new presentation, and starts (without blocking on) a write to the settings file. `terminalNexus.ts`
layers where a session's settings come from: a saved file beats `grid`'s own first-run colour-depth
guess, and an explicit command-line flag beats either, for that one run only, without touching what
is saved.

**Live presentation updates, `src/view/frame.ts` and both backends** — `TerminalBackend` gained an
optional `setPresentation(capability, theme)`. `AnsiBackend` and `OpenTuiBackend` both now hold their
capability and theme in a mutable field/closure variable instead of reading them once from
construction options, so `setPresentation` can change what the very next `present()` call draws
without stopping and restarting the backend. See Section 7 — this did not exist before this gate,
and nothing needed it to.

**Settings are now saved one at a time, in order, with a failure that actually gets reported** — a
pre-merge quality review (Section 7) found that two changes picked close together could fire two
independent, unordered writes to the settings file, letting a stale one land on disk after a fresher
one and quietly revert the player's last choice. Fixed by chaining every write onto the one before
it, so the file is always caught up to whatever the player picked last. The same review also pointed
out that a save failure was being discarded with no trace at all; the last one, if any, is now
reported in one line once the session actually ends.

**A repo-wide raw-byte audit** — two escape-sequence regexes that shipped merged in Gate 3A
(`src/menu/mouse.ts`'s `SGR_MOUSE`, `tests/menu-view.test.ts`'s colour-code extractor) turned out to
contain a literal raw ESC control byte instead of the six-character text ``, the same class of
bug Gate 3A's own report already named and thought it had fixed once (Section 7 there). Both fixed
here, alongside a fresh instance in this gate's own new screenshot-script code. See Section 7.

**Tests** (new files, plus additions to existing ones): `tests/menu-settings-screen.test.ts` (9
tests — the sharp-edge equivalence test extended to all four settings rows, Back and Esc, the
live-presentation-update proof, the persistence-survives-a-relaunch end-to-end case, and, added during
the pre-merge review, a deterministic proof that two rapid saves never run concurrently),
`tests/settings-store.test.ts` (8 tests), `tests/settings-types.test.ts` (4 tests); three
`runMenu(...)` call sites in `tests/menu-session.test.ts` updated for the new `settings`/
`settingsStore` options; one regex fixed in `tests/menu-view.test.ts` (the raw-byte audit above).

**Evidence**: `scripts/capture-menu-screenshot.mjs` extended with a `waitForText` polling parameter
(cycling a settings row writes a file and redraws, slower than a plain navigation redraw, so a fixed
delay could catch it mid-change) and a `background` parameter (a light-theme shot needs a light page
background to be legible — the same thing `capture-screenshots.mjs` already does for `grid`'s own
light-theme shots). Three new PNGs — `settings-screen`, `settings-light-theme`,
`settings-back-to-top` — alongside the five from Gate 3A, regenerated against current code.

**Docs**: `README.md`, `DEVELOPMENT.md`, and `milestones/milestone-03-game-menu.md` updated together
(AGENTS.md Section 5); the milestone file's Active gate moved to 3C.

## 4. Automated results

| Check | Result | Evidence |
| --- | --- | --- |
| `./scripts/check-repository.sh` | PASS | Canon 2.16, gate 3C now current, zero failures |
| `npm run typecheck` (`tsc --noEmit`) | PASS | Clean, `strict`/`noUncheckedIndexedAccess`/`exactOptionalPropertyTypes` all on |
| `npm test` (Node 22.22.2) | PASS | 269/269, 0 failures |
| `npm run test:bun` (Bun 1.3.11) | PASS | 268/268 across 26 files, 0 failures |
| Node/Bun count reconciled | explained | Same single-test gap as Gate 3A's own report: `tests/lifecycle.test.ts`'s `if (!RUNTIME_IS_BUN)` OpenTUI-fallback test, registered only where the fallback actually happens (Node) |
| Two settings changes picked close together save in order, never concurrently | PASS | `tests/menu-settings-screen.test.ts`, added during the pre-merge review in Section 7; fails against the pre-fix code (proven directly, then reverted) |
| Every Settings row displays its own hotkey | PASS | `tests/menu-settings-screen.test.ts` test 1 |
| Raw hotkey, raw arrow-then-Enter, raw mouse click at the row's own position → identical next value, for all four rows | PASS | `tests/menu-settings-screen.test.ts` test 2, "the sharp edge" |
| Back row returns to the top-level menu | PASS | `tests/menu-settings-screen.test.ts` test 3 |
| Two keys crossing a screen change in one stdin chunk both land on the right screen | PASS | `tests/menu-settings-screen.test.ts` test 4 — regression test for the bug in Section 7 |
| Esc returns to the top-level menu; Esc is a no-op at the top level | PASS | `tests/menu-settings-screen.test.ts` tests 5–6 |
| A colour-depth change is visible on the very next frame, with no backend stop-and-restart | PASS | `tests/menu-settings-screen.test.ts` test 7 — checked against `stdout`'s whole write history, not just the newest frame |
| A setting changed on the Settings screen survives a full stop-and-restart | PASS | `tests/menu-settings-screen.test.ts` test 8 |
| A file that was never written, or is not valid JSON, or is a JSON array/bare string, loads as `null` | PASS | `tests/settings-store.test.ts` |
| Saving then loading round-trips every field exactly | PASS | `tests/settings-store.test.ts` |
| A partially-wrong, partially-missing, or newer/older-version file keeps every field it got right | PASS | `tests/settings-store.test.ts` |
| `save()` creates the containing folder when it does not exist yet | PASS | `tests/settings-store.test.ts` |
| Each of `nextCapability`/`nextTheme`/`nextGlyphPack`/`toggleReducedMotion` cycles/wraps correctly | PASS | `tests/settings-types.test.ts` |
| The full Gate 3A suite stays green | PASS | `tests/menu-adapters.test.ts`, `tests/menu-list.test.ts`, `tests/menu-view.test.ts`, `tests/lifecycle.test.ts`, `tests/terminal-nexus-cli.test.ts`, unmodified assertions except the one regex fix in `menu-view.test.ts` (Section 7) |
| Repo-wide raw-byte scan comes back clean | PASS | `grep -rlP '\x1b'` limited to expected files (`.mjs`/`.ts` sources that intentionally hold escape-sequence constants as `` text) after the fixes in Section 7 |
| Real terminal (tmux/PTY): Settings reached by its own hotkey, four rows and Back all visible | PASS | `evidence/screenshots/settings-screen.png` |
| Real terminal: cycling Background to light takes effect with no restart, no flicker | PASS | `evidence/screenshots/settings-light-theme.png` |
| Real terminal: Back returns to the top-level menu, still highlighting Settings | PASS | `evidence/screenshots/settings-back-to-top.png`, re-captured after the pre-merge review found its wait condition was not actually synchronizing on anything (Section 7) |
| Real terminal: Gate 3A's five screenshots still look correct against current code | PASS | `evidence/screenshots/menu-{top-level,monochrome,highlight-moved,stub-notice,mouse-click}.png`, regenerated |

Measurements: not applicable — this gate has no performance or balance claim.

## 5. Human observations

None yet — nobody but this session has looked at the screen. As with Gate 3A, this was not planned
as a blocking requirement (every acceptance criterion in Section 1 is mechanically checkable), but
eight screenshots now exist in `evidence/screenshots/` (five from Gate 3A regenerated, three new:
`settings-screen`, `settings-light-theme`, `settings-back-to-top`) and `npm run terminal-nexus` runs
the real thing, for whenever Mario looks.

## 6. Interpretation

**The acceptance bar is met, including its sharp edge, on the new screen.** The Settings-screen
equivalence test (`tests/menu-settings-screen.test.ts` test 2) does exactly what Gate 3A's report
insisted on: it derives the raw hotkey from each row's own displayed text and the raw mouse-click
coordinate from the same layout functions the composer draws with, then drives the real keyboard and
mouse adapters with those raw bytes — not hand-built commands — and checks all three land on the
identical next value. Nothing new was invented for this; it is the same test shape as Gate 3A's,
pointed at a second screen, which is itself a small piece of evidence that the reusable menu-list
shape actually generalises the way Gate 3A's own report hoped it would (Section 1's stop condition
there named exactly this risk).

**Several small, reversible decisions were made under bounded autonomy**
(`project-governance.md` Section 2) rather than asked about, each stated here so a later session can
revisit cheaply if evidence says otherwise:

- **The settings file lives at `~/.terminal-nexus/settings.json`**, a dotfolder convention many
  command-line tools use, rather than beside the repository or under a platform-specific config
  directory (XDG, etc). Simplest thing that works for a single-user terminal game; moving it later
  is a one-line change to `defaultSettingsPath()` with nothing else depending on the path.
- **A command-line flag overrides a saved setting for one run without changing what is saved.** This
  matches the override order `grid` already uses for its own flags, and it means testing
  `--capability` never has the side effect of silently changing what a later plain launch shows.
- **The Settings screen is a second, persistent `MenuSession` instance, not a single session whose
  item list gets swapped out.** Keeping the top-level menu's own highlight alive underneath Settings
  (rather than rebuilding it fresh) is what makes "Back returns to exactly where the player was"
  true for free, rather than a state to track separately.
- **No new open question was registered.** The two candidate forks this gate raised — the settings
  file's exact location/format, and whether a command-line flag or a saved choice wins when both are
  present — are both reversible technical decisions with an obvious, cheap fix if either turns out
  wrong, not product choices Mario would need to pick between named options for. Both are recorded
  above as assumptions rather than blockers, the same treatment Gate 3A gave its own two candidates.

## 7. Failures, surprises, and discarded approaches

**The most serious bug in this whole gate was found only by asking for a dedicated pre-merge review,
after everything above already showed green.** Mario asked for one before merging this PR, on top of
the automated evidence and the screenshots. It found three things worth recording in detail.

*A data-loss bug in the exact feature this gate claims to have built.* Every settings change kicked
off its own independent write to the settings file, with nothing making sure they finished in the
order they were made. Two changes picked close enough together — the exact "fast typist or a script"
shape this gate's own cross-screen-routing fix (below) already treats as real — could have their
writes actually reach disk in either order, so a later, correct choice could be silently overwritten
by an earlier, stale one finishing its write second. This directly contradicted a claim this very
report made in Section 3 before the review ("the last thing a player changed is genuinely on disk").
Proven, not just suspected: a standalone script driving the shipped code through the exact "open
Settings, cycle colour depth twice, quit" sequence 300 times over showed the wrong value saved about
7% of the time; a lower-level probe hitting the settings-file writer directly, 500 times, showed it
about 14% of the time — both consistent with an honest race rather than a one-off fluke. Fixed by
chaining every write onto the promise of the one before it, so a write only ever starts once the
previous one has actually finished, guaranteeing the file always catches up to the true final choice.
Covered by a new test that does not rely on hitting the race by luck: a stand-in settings store whose
first write deliberately hangs until the test releases it, proving the second write is never even
*started* while the first is still in flight. Run against the code as it stood before this fix, the
same test fails immediately and correctly, which is what makes it a real regression test rather than
a tautology.

*A save that fails leaves no trace anywhere.* The existing code already chose, reasonably, not to
crash or block quitting the game over a settings file that failed to write. But it went a step
further than that and didn't record the failure anywhere at all — a permanently broken save path (a
read-only home directory, a full disk) would look, from every angle a player or a future session
could check, exactly like a save path that was working perfectly. Fixed by remembering the most
recent failure and printing one line about it after the session ends and the terminal is back to
normal — deliberately not mid-session, where writing to the screen would land inside the very menu
it's reporting on and corrupt whatever the player was looking at.

*A screenshot's own timing check was not actually checking anything.* The Settings-to-Back
screenshot waited for the words "top-level menu" to reappear before capturing the frame — except
those words are already on screen from the very first frame, before either key is even sent, so the
wait was satisfied instantly regardless of whether the Back key had actually been processed yet. The
checked-in image happened to be correct anyway, purely because of incidental delay elsewhere in the
pipeline, not because anything had actually been waited for — exactly the kind of accidentally-passing
check that can start capturing the wrong frame the moment something upstream gets faster. Fixed by
waiting for the Settings screen to genuinely appear first, then sending Back, so the final wait is
now checking a real transition instead of text that was never going to be absent.

*Along the way: a new shape of the TypeScript narrowing gap this gate had already met once.* Writing
the deterministic race test needed a variable set inside a callback and read afterward — this gate's
existing `required()` helper (Section 7 below) was built for a different shape of this same problem
and didn't fix this one; even an explicit type-guard function couldn't. The type checker, it turns
out, loses track of a local variable's real type the moment the *only* place it's ever assigned is
inside a nested function, even though that function demonstrably already ran by the time it's read.
Confirmed with a series of small standalone files before touching the real test, to make sure the
fix wasn't papering over something else. Worked around without any assertion or cast: give the
variable a harmless placeholder function to start with instead of `undefined`, so there is no
narrowing left to do. Left here as its own lesson rather than folded into `required()`, since the two
do not share a fix.

**A real architectural gap: no backend could change how it draws without being torn down.** Designing
"a settings change is visible on the very next frame" surfaced that `AnsiBackend` and
`OpenTuiBackend` both read `capability`/`theme` once, from their constructor options, and never
again — the only way to show a different colour depth was to `stop()` the backend and `start()` a
new one, which for the ANSI backend means leaving and re-entering the alternate screen: a visible
flash, and a second lifecycle to keep idempotent. Fixed by holding both fields as mutable state (a
private field on the class, a closure variable in the factory function) and adding
`setPresentation(capability, theme)` to `TerminalBackend` and both concrete backends. Proven by a
test that checks the *whole* session's write history for exactly one alternate-screen-enter sequence
after cycling colour depth twice — not just that the new frame looks right, which a stop-and-restart
would also produce.

**A real bug caught before it could ship: two keys in one chunk could misroute to a screen the
player had already left.** The original `onData` handler picked "which `MenuSession` is active"
once per `stdin` "data" event, then handed the whole chunk to that one session. A hotkey that enters
Settings, immediately followed by a second key — the exact shape a fast typist or a driver script
produces, and indistinguishable at the OS level from two separate slower keystrokes — arrived as one
chunk, so the second key was still being evaluated against the screen that was current when the
chunk *started*, not the one the first key had just switched to. Found by tracing the code by hand
while reviewing the two-screen design, not by a failing test — there was no test yet that sent two
keys in one `emit("data", ...)` call, the same category of gap Gate 3A's own report named for
`keysFromChunk` ("a fake stdin that always sends one logical action per `data` event cannot, by
construction, find a bug that only appears when several logical actions share one physical chunk").
Fixed by extracting `MenuSession.handleKey(key, layout)` and having the CLI's `onData` re-check which
screen is current before *every* key, not once per chunk. Covered by a regression test that sends
`"32"` (Settings' own hotkey, then Background's) as a single buffer and checks the second key landed
on Background, not on the top-level menu's own hotkey `"2"` (Challenge).

**The same raw-byte-in-source trap Gate 3A's report already named, found twice more, already
merged.** Gate 3A's Section 7 described a tool-call round-trip that turns `` written as
parameter text into a literal, invisible raw ESC control byte landing in a source file, caught once
in that gate's own screenshot script. Building this gate's Settings screenshots hit the identical
trap fresh, in the same script. Auditing the repository afterward with `grep -rlP '\x1b'` — rather
than trusting that gate 3A's one fix had closed the issue — turned up two more instances that had
already shipped merged from Gate 3A itself, silently: `src/menu/mouse.ts`'s `SGR_MOUSE` regex and
`tests/menu-view.test.ts`'s colour-code-extraction regex both had a raw ESC byte where the source
read ``. Neither had ever caused a visible failure — a raw control byte and the six characters
`\`, `u`, `0`, `0`, `1`, `b` are only different as *source text*, not at runtime, so both regexes
matched exactly as intended the whole time. All three fixed by writing the replacement text through
a byte-safe Python script instead of a tool-call parameter, then verified with a repository-wide
`grep -rlP '\x1b'` scan that came back naming only files that hold `` as intended literal text.
The honest lesson is not "fixed": it is that a previous gate naming this risk and fixing one instance
of it did not prevent the same risk from landing again, twice, unnoticed, in that same gate's own
merged output — this class of bug needs its own repo-wide check every time a session's tool calls
build a control-character escape sequence, not a one-time fix.

**A quieter bug, caught by writing the fallback-boundary tests rather than by a failure report:**
`typeof [] === "object"` in JavaScript, so `SettingsStore.load()`'s original "is this parsed JSON a
settings object" guard (`typeof parsed !== "object" || parsed === null`) let a JSON array through as
if it were a valid-but-strange settings object, which `parseSettings` would then have quietly turned
into `DEFAULT_SETTINGS` instead of the correct answer, `null` ("nothing usable was ever really
saved"). Found while deliberately writing one test per fallback boundary — file missing, not valid
JSON, wrong shape, partially wrong, extra field — because a bare array is exactly the kind of value
that satisfies a `typeof === "object"` check without being what that check means. Fixed by adding an
explicit `Array.isArray(parsed)` exclusion; covered by its own test.

**Smaller frictions, each fixed in place:**

- `stdout.written`, a cumulative log of every write a fake stream ever received, cannot prove
  something is *absent* from the current screen — an earlier frame's text never disappears from a
  log of everything ever written, even once a real terminal has long since overwritten it. Added a
  `lastWrite` field (just the most recent write) to the test file's `FakeStdout` for any assertion
  that needs "what's on screen right now," keeping `written` only for the one assertion that
  genuinely needs the whole history (Section 4's alternate-screen-count check).
- TypeScript's narrowing from `assert.ok(x !== undefined)` does not survive `x` being read again
  inside a callback defined in an outer scope — a compile-time limitation, not a runtime one. Worked
  around with a small `required<T>(value, message): T` helper that throws instead of narrowing, so
  the value it returns stays narrow anywhere it is then passed.
- Constructing a `runMenu` session without ever sending it `"q"` leaks its SIGINT/SIGTERM listeners
  across the whole test file, eventually tripping Node's `MaxListenersExceededWarning`. Fixed by
  making sure every test (and shared helper) that starts a session also quits it.
- The screenshot script's `tmux send-keys` returns as soon as the bytes are injected into the pty,
  not once the app has reacted to them. A plain navigation redraw is fast enough that this was never
  visible in Gate 3A's own shots, but a settings row that cycles a value, writes a file, and redraws
  is slower, and an early run of the new shots landed mid-change. Fixed by adding a `waitForText`
  polling parameter to the screenshot helper, used only where the extra work makes it necessary.
- The light-theme screenshot was initially unreadable — its palette is designed to sit on a light
  terminal background, and the capture pipeline's default page background is dark. Matched the
  existing precedent in `capture-screenshots.mjs` (a `background` parameter set per shot) rather than
  inventing a different fix.
- Generating screenshots runs the real `terminal-nexus` executable, which reads and writes the real
  `~/.terminal-nexus/settings.json` in the container's actual home directory — not a fixture, and not
  cleaned up automatically between runs. Left stale state from one debugging pass into the next more
  than once; worked around with `rm -rf ~/.terminal-nexus` before regenerating shots. Worth naming
  for whoever next touches this script: it is not sandboxed the way the fake-stdin tests are.
- **A false alarm, investigated and ruled out, not fixed:** a regenerated monochrome-capability
  screenshot appeared, on first look, to show a cyan-tinted hotkey — which would have meant
  monochrome was leaking colour. Direct `tmux capture-pane` output was checked byte-for-byte for any
  SGR colour code and found completely clean; re-examining the rendered image afterward found no
  cyan actually present. Concluded this was a visual misjudgment, not a regression; no code changed
  because of it. Recorded here rather than silently — Section 1's own governance guidance
  distinguishes "reporting that a hypothesis failed" from hiding the fact that one was checked.

**Discarded: a third, generic "screen stack" abstraction for the top-level/Settings switch.** The
first instinct on seeing two screens was to build a small navigation-stack type (`push`/`pop`, a list
of screens) in anticipation of Gate 3C adding more. Two screens with one fixed relationship (Settings
goes back to the top level, always) is fully described by the `Screen = "top" | "settings"` flag and
`goTo`/`onBack` already in `src/cli/menu.ts` — a stack generalises a shape that does not exist yet.
Left for whichever gate first needs more than one level of back-navigation to justify it with a real
second case, per AGENTS.md's own "extract a framework only after two real uses reveal the boundary."

## 8. Decision

> **PASS**

Every automated check this gate set for itself (Section 1) passes, on both runtimes, including the
sharp-edge equivalence test extended to the Settings screen's own four rows. Two real architectural
gaps — no live backend presentation update, and a cross-screen key-routing bug that a fast typist or
a script could actually trigger — were found and fixed during this gate's own design and review,
before either shipped, each with a regression test. A third risk Gate 3A's report had already named
and partly fixed (raw control bytes landing in source text through a tool-call round-trip) turned out
to have shipped merged in two more places from that same gate; both are now fixed, and a repository-
wide scan confirms nothing else was missed. A dedicated pre-merge review, asked for on top of all of
this, then found a genuine data-loss bug in the save path itself (Section 7) — the most serious defect
in the whole gate, and one every automated check above had missed because none of them had asked
whether two rapid changes could race each other on disk. It is now fixed, proven with a test that
fails against the pre-fix code and passes against the fix, and the two smaller gaps the same review
raised (a save failure vanishing with no trace, and a screenshot's wait condition that was not
actually waiting on anything) are fixed too. Explicit exclusions (Campaign/Challenge, any
save/progression format, sound, any setting beyond the milestone's own four) are named, not silently
missing. No new open question needed registering; the two candidate forks are recorded in Section 6
as reversible assumptions.

## 9. Canon impact

| Proposed rule | Would live in | Earned by |
| --- | --- | --- |
| None | — | This gate implements Settings exactly as `milestones/milestone-03-game-menu.md` Section 2 already describes it; nothing here contradicts or extends any RULE, so no amendment is proposed. |

Questions raised: none. Section 6 explains why the settings file's location/format and the
flag-versus-saved-choice precedence are recorded as reversible assumptions rather than registered as
`Q<n>` rows — neither is a product decision Mario would choose between named options for, and both
are cheap to revisit if evidence later says otherwise.

## 10. Next authorized action

Gate 3C (Mode select and honest handoffs: Campaign hands off to Milestone 4 or an explicit
placeholder, Challenge hands off to Milestone 11 or is disabled with the reason shown) — after Mario
has looked at `evidence/screenshots/settings-*.png` and this report, per
`milestones/milestone-03-game-menu.md` Section 1.1's own build order. Gate 3C is also the last gate
this milestone names; nothing beyond it is authorized by this report.
