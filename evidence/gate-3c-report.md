# Gate report — Milestone 3, Gate 3C: Mode select and honest handoffs

**Document role:** Gate evidence report for Gate 3C
**Status:** BUILT — Section 8 concludes PASS on every automated check; owner review is outstanding
**Canon version:** 2.16
**Updated:** 2026-09-21
**License:** Apache-2.0

---

## 1. Frame — written before coding

- **Canon version:** 2.16.
- **Milestone and gate:** Milestone 3 — Game Menu; Gate 3C (Mode select and honest handoffs). This is
  the last gate this milestone names — 3A and 3B are both built, merged, and pushed live by Mario, who
  then asked directly what to do next.
- **Question this gate answers:** With neither the campaign menu (Milestone 4) nor the Challenge run
  screen (Milestone 11) built yet, can Campaign and Challenge each be honest about that in their own,
  best-fitting way — Campaign as a real second screen a player actually visits, Challenge as a menu
  row that already says why before it's even pressed — without inventing a generic "disabled" input
  behaviour that the menu's own rule (every displayed hotkey activates something real) does not
  actually call for?
- **Smallest artifact that can answer it:**
  - Campaign's hotkey now opens a real placeholder screen — its own subtitle, a plain message, and a
    Back row — built out of the exact same reusable list/session/view machinery Settings already
    proved in Gate 3B, not a new kind of screen;
  - Challenge's top-level row states its own reason right in its label (dimmed, so it visibly reads
    differently from a live option) instead of only revealing that reason after being pressed;
    pressing it still behaves exactly as it already does today (Gate 3A's stub notice) — the change is
    what the row looks like at rest, not what it does;
  - a `disabled` flag on a menu item that affects rendering only — dimmed text instead of the normal
    hotkey/label colours — with no change at all to the keyboard, mouse, or driver adapters, or to the
    pure command reducer. `engine.md` 9.7 is explicit that a displayed hotkey activates the item it
    belongs to; nothing this gate builds needs that to stop being true, so nothing about activation
    changes.
- **Automated evidence planned:**
  - the same raw-hotkey / raw-arrow-then-Enter / raw-click equivalence proof the last two gates built,
    now covering Campaign's placeholder screen's own Back row;
  - a cross-screen key-routing check generalised from two screens to three (top, settings, campaign),
    proving a key typed right after a screen-switching hotkey still lands on whichever screen is
    current *after* that switch, not whichever chunk it arrived in;
  - a render-level check that a `disabled` item's hotkey and label actually come out dimmed when not
    highlighted, and read exactly like any other item's when highlighted (the inverse-video highlight
    is still what "selected" means, per Gate 3A);
  - the existing sharp-edge equivalence test for the top-level menu and the Settings screen staying
    green unmodified, since neither one's own input behaviour changes;
  - the whole existing suite (`npm test`, `npm run test:bun`) staying green.
- **Human observation planned:** none required to close this gate, same reasoning as 3A and 3B — every
  criterion above is mechanically checkable. Screenshots go in `evidence/screenshots/` regardless.
- **Explicit exclusions:** any real Campaign or Challenge content (Milestones 4 and 11 own that); a
  generic reusable "disabled item" *input* behaviour beyond rendering (nothing today needs one, and
  the one place this gate does need dimming does not need it either, per the RULE reasoning above); a
  save/progression system; sound; touching Settings or Exit, which this gate leaves alone.
- **Stop conditions:** if honouring `engine.md` 9.7's "a displayed hotkey activates the item" turns out
  to be incompatible with a menu row that shouldn't do anything real yet — that would mean the
  milestone's own "disabled with the reason shown" language and the RULE are in real tension, which is
  a canon question for Mario, not a session's to resolve by quietly weakening the RULE.

## 2. Environment — pinned, not remembered

| | |
| --- | --- |
| OS and architecture | Linux (container), x86_64 |
| Runtime and exact version | Node v22.22.2; Bun 1.3.11 |
| Dependencies and exact versions | `@opentui/core@0.5.6`, `typescript@7.0.2`, `@types/node@22.20.1` — unchanged by this gate |
| Hardware, if it affects measurements | Not applicable |
| Date measured | 2026-09-21 |

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

**One new rendering flag, `MenuItem.disabled` (`src/menu/types.ts`)** — no change to `MenuCommand`,
`list.ts`'s reducer, `keyboard.ts`, or `mouse.ts`. A disabled item is still a completely normal item
to every adapter and to the driver: it has a real hotkey, arrows can land the highlight on it, a click
on its row activates it, and `onActivate` fires for it exactly as for any other item. The only thing
that reads the flag is the composer.

**Dimmed rendering for a disabled item (`src/view/menu.ts`)** — when not highlighted, both the
hotkey and label parts render in `chrome.muted` with `dim: true` (the same role/attribute pair the
menu's own subtitle, tagline, and footer hint already use) instead of `chrome.hotkey`/`chrome.value`.
Highlighting it is completely unchanged: the whole row still inverts, exactly like any other item —
inverse video is what "selected" means, regardless of whether the selected row happens to be dimmed
at rest.

**Campaign's own placeholder screen (`src/cli/menu.ts`)** — `Screen` gained a third value,
`"campaign"`, alongside `"top"` and `"settings"`. A new `campaignMenu` session (one item, `Back`) and
a fixed message (`CAMPAIGN_PLACEHOLDER`, the exact text Gate 3A's own stub notice used to show) are
reached from the top-level menu's Campaign hotkey, which now calls `goTo("campaign")` instead of
setting a notice. Screen-specific details that used to live as inline ternaries in `render()`
(subtitle, whether the footer shows "esc back") were pulled into one `SCREEN_INFO` lookup keyed by
`Screen`, and a new `sessionFor(screen)` helper replaced the `screen === "top" ? topMenu : settingsMenu`
pattern everywhere it appeared (`render()` and `onData()`) — the one place either grows the next time a
screen is added, rather than a repeated three-way (soon four-way) branch at every call site.

**Challenge's label and dimming (`src/cli/menu.ts`)** — `TOP_LEVEL_ITEMS`'s `challenge` entry gained
`disabled: true` and its label changed to `"Challenge (Milestone 11)"`. Its `onActivate` handling is
completely unchanged from Gate 3A: it still sets the same stub notice
(`STUB_NOTICES.challenge`) and stays on the top-level menu. `STUB_NOTICES` itself shrank to just that
one entry, since Campaign no longer uses it.

**Tests** (new file, plus additions to two existing ones): `tests/menu-campaign-screen.test.ts` (4
tests — the placeholder screen shows its own message and hides the top-level menu's other items, the
Back row's hotkey returns to the top level, Esc does too, and a hotkey crossing into Campaign followed
by a second key in the same chunk still routes correctly — the third-screen case for Gate 3B's own
cross-screen fix); one new test in `tests/menu-view.test.ts` (a disabled item renders dimmed at rest
and identically-inverted when highlighted); `tests/menu-session.test.ts`'s existing "activating a
stubbed item" test was split in two — one for Challenge (unchanged behaviour, now also asserting
`disabled: true` and that the top-level menu stays on screen) and a new one for Campaign (asserting it
leaves for its own screen, checked against the *current* frame, not the cumulative write history,
which would still contain the top-level menu's own items from the very first frame drawn).

**Evidence**: `scripts/capture-menu-screenshot.mjs` gained three shots — `menu-challenge-dimmed`
(arrow-down once, showing the dimmed row highlighted), `campaign-screen`, and `campaign-back-to-top`
(the same two-step wait pattern `settings-back-to-top` already needed, for the same reason: entering
and leaving the same word, "top-level menu," is on screen before any key is sent at all) — plus five
existing shots regenerated against current code, all of which now show Challenge's dimmed label
wherever the top-level menu appears in them.

**Docs**: `README.md`, `DEVELOPMENT.md`, and `milestones/milestone-03-game-menu.md` updated together
(AGENTS.md Section 5); the milestone's own Active gate field now reads "none," with every Definition
of Done item checked, since this is the last gate it names.

## 4. Automated results

| Check | Result | Evidence |
| --- | --- | --- |
| `./scripts/check-repository.sh` | PASS | Canon 2.16, zero failures |
| `npm run typecheck` (`tsc --noEmit`) | PASS | Clean, `strict`/`noUncheckedIndexedAccess`/`exactOptionalPropertyTypes` all on |
| `npm test` (Node 22.22.2) | PASS | 275/275, 0 failures |
| `npm run test:bun` (Bun 1.3.11) | PASS | 274/274 across 27 files, 0 failures |
| Node/Bun count reconciled | explained | Same single-test gap as Gates 3A and 3B's own reports: `tests/lifecycle.test.ts`'s `if (!RUNTIME_IS_BUN)` OpenTUI-fallback test, registered only where the fallback actually happens (Node) |
| A disabled item's hotkey/label render dimmed at rest; identical to any other item when highlighted | PASS | `tests/menu-view.test.ts`, new test |
| Challenge's item is marked `disabled`, still shows a notice, does not quit or change screen | PASS | `tests/menu-session.test.ts` |
| Campaign leaves the top-level menu for its own screen; the top-level menu's own items are gone from the current frame | PASS | `tests/menu-session.test.ts`, checked via `lastWrite`, not the cumulative write log |
| Campaign's placeholder screen shows its message and a displayed Back hotkey, not the top-level menu | PASS | `tests/menu-campaign-screen.test.ts` |
| The Back row's hotkey, and Esc, both return to the top-level menu | PASS | `tests/menu-campaign-screen.test.ts` |
| A hotkey crossing into Campaign and a second key in the same chunk both land correctly (the third-screen case) | PASS | `tests/menu-campaign-screen.test.ts` |
| The existing Gate 3A/3B suites stay green: isolated adapter equivalence, Settings' own sharp-edge test, the settings-save ordering test | PASS | `tests/menu-adapters.test.ts`, `tests/menu-list.test.ts`, `tests/menu-settings-screen.test.ts`, unmodified assertions |
| Real terminal (tmux/PTY): the top-level menu shows Challenge dimmed at launch | PASS | `evidence/screenshots/menu-top-level.png` |
| Real terminal: highlighting the dimmed Challenge row is plain inverse video, same as any other item | PASS | `evidence/screenshots/menu-challenge-dimmed.png` |
| Real terminal: Campaign's placeholder screen shows its message and Back | PASS | `evidence/screenshots/campaign-screen.png` |
| Real terminal: Back returns to the top-level menu, still highlighting Campaign | PASS | `evidence/screenshots/campaign-back-to-top.png` |
| Real terminal: Gate 3A/3B's five affected screenshots still look correct against current code | PASS | `evidence/screenshots/{menu-top-level,menu-monochrome,menu-highlight-moved,menu-stub-notice,settings-back-to-top}.png`, regenerated |

Measurements: not applicable — this gate has no performance or balance claim.

## 5. Human observations

None yet — nobody but this session has looked at the screen, the same as Gates 3A and 3B. Not planned
as a blocking requirement for the same reason as before (every criterion in Section 1 is mechanically
checkable). Four new screenshots exist (`menu-challenge-dimmed`, `campaign-screen`,
`campaign-back-to-top`, and the regenerated `menu-top-level` already showing Challenge dimmed) for
whenever Mario looks, alongside `npm run terminal-nexus` running the real thing.

## 6. Interpretation

**Reading `engine.md` 9.7 as a RULE, not just a description, changed what this gate actually built.**
The milestone's own text names two different fallbacks — Campaign gets "an explicit placeholder
screen," Challenge is "disabled with the reason shown" — and it would have been easy to read
"disabled" as an invitation to build a generic inert/unclickable menu-item behaviour. Checking the
RULE first (a displayed hotkey activates the item it belongs to) ruled that out before any code was
written: a disabled item still had to activate something real. The result is a smaller change than a
generic disabled-input mechanism would have been — one rendering flag, read in exactly one place — and
it left every one of Gate 3A's own foundational tests (the isolated adapter equivalence test, the
raw-bytes-in-one-chunk test) passing completely unmodified, which is itself a small piece of evidence
that the flag really did stay a rendering concern and nothing else.

**The two fallbacks ended up asymmetric on purpose, not by accident.** Campaign got a real second
screen; Challenge stayed on the top-level menu with a dimmed, self-explaining label. Both are equally
honest about the same underlying fact (neither Milestone 4 nor Milestone 11 exists yet) — the
difference is where that honesty is expressed, matching the milestone's own text for each rather than
picking one treatment and applying it to both. A generic "unbuilt destination" screen shared by both
would have been simpler to build, but would have flattened a distinction the milestone document drew
on purpose.

**A reversible decision made without asking, stated here so a later session can revisit cheaply:**
Challenge's activation still shows its old stub notice (repeating, on activation, the same fact its
label already states at rest) rather than being changed into a silent no-op now that the label alone
arguably already says enough. Kept for two reasons: it is the smaller diff (Gate 3A's existing,
already-tested mechanism, untouched), and pressing a key that visibly does *nothing at all* beyond
moving the highlight risks reading as broken even when it is working exactly as designed — a repeated,
harmless confirmation seemed like the safer default until there is real evidence either way.

**No new open question was registered.** The one candidate fork this gate raised — whether a disabled
item's activation should stay a real notice-on-request (kept) or become a silent, label-only no-op —
is a reversible UX-polish decision with an obvious one-line fix if it turns out wrong, not a product
choice Mario would need to pick between named options for. Recorded above as an assumption rather than
a blocker, the same treatment Gates 3A and 3B gave their own candidates.

## 7. Failures, surprises, and discarded approaches

**The design question that mattered most was resolved by reading the RULE before writing any code,
not by trial and error.** The milestone's own "disabled with the reason shown" phrase, read on its
own, points toward a conventional greyed-out-and-unclickable UI control. Re-reading `engine.md` 9.7's
exact words first — "every menu item displays its hotkey... and pressing that key activates the
item... a hotkey that is not displayed does not exist" — surfaced the real tension before any code
existed: a genuinely inert, unclickable row with a still-displayed hotkey would have quietly broken
that RULE. Worth naming plainly because it is the opposite of most of this gate's own failures-section
material from Gates 3A/3B, which found real bugs *after* something shipped; this one was avoided
entirely by checking the authority level of a sentence before treating it as a build instruction —
exactly the discipline `AGENTS.md` Section 3 asks for ("descriptive completeness is not authorization"
cuts both ways: a milestone's own prose is not a licence to override a RULE either).

**An existing test's assertion stayed true for a different reason than it used to, and that was worth
noticing rather than shipping quietly.** `tests/menu-session.test.ts`'s original "activating a stubbed
item shows a notice and does not quit" test drove Campaign's hotkey and checked for the substring "not
built yet" in the write history. It still passes unmodified-in-spirit today, but only because
`CAMPAIGN_PLACEHOLDER` reuses Gate 3A's exact original notice text as the new placeholder screen's own
message — the same words are now shown for a structurally different reason (a dedicated screen, not a
notice on the current one), which the test's own name and assertion no longer described accurately.
Left as a passing coincidence, it would have been a truth hiding behind a stale description; split
instead into a Challenge-specific test (genuinely unchanged) and a new Campaign-specific one that
checks the *current* frame no longer contains the top-level menu's own other items — the actual claim
"this is a different screen" makes, which the original test never tested at all.

**The same cumulative-log trap Gate 3B's report already named, met again in a different file.**
Proving Campaign's screen replaced the top-level menu (rather than merely adding a notice on top of
it) needs a negative assertion — "the old screen's items are gone" — and `tests/menu-session.test.ts`'s
own `FakeStdout` only tracked cumulative `written` history, which can never shrink and so can never
prove an absence. Gate 3B hit this exact shape of bug in a different test file and fixed it there with
a `lastWrite` field; the fix had to be repeated here rather than reused, since each test file keeps its
own small `FakeStdout`/`FakeStdin` pair by this project's own convention (no shared test-only module).
Worth naming again: this is now the second file with this exact fix, which is a reasonable argument
for a shared test helper module once a third file needs it — not built here, per `AGENTS.md`'s "extract
a framework only after two real uses reveal the boundary," since two is not yet three.

**Discarded: a generic navigation-stack abstraction for three screens.** With a third screen added,
the temptation was to replace `Screen`'s flat union and the `goTo`/`sessionFor` pair with a small
push/pop stack, anticipating a fourth or fifth screen later. Three screens with one fixed shape — every
non-top screen goes back to exactly `"top"`, never to each other — is still fully described by a flat
enum and a lookup table; a stack would generalise a shape (multi-level back navigation) nothing in this
game has needed yet. `SCREEN_INFO` and `sessionFor` were sized for "add one line per new screen," which
is the same cost a stack would have, without committing to a navigation model no gate has asked for.

## 8. Decision

> **PASS**

Every automated check this gate set for itself (Section 1) passes, on both runtimes. The central
design risk — whether "disabled with the reason shown" could be built without quietly weakening
`engine.md` 9.7's own RULE — was resolved by reading the RULE first, and the resulting change is
additive and small: one rendering flag, read in exactly one place, with zero changes to the command
vocabulary, the three adapters, or the pure reducer, and the whole of Gates 3A and 3B's own test suites
pass completely unmodified as a result. Campaign's placeholder screen reuses Gate 3B's own
session/list/view pattern rather than inventing a fourth kind of screen. An existing test whose
assertion had quietly become true for the wrong reason was caught and split into two accurate ones
rather than left as a passing coincidence. Explicit exclusions (real Campaign/Challenge content, a
generic disabled-input mechanism, save/progression, sound) are named, not silently missing. No new
open question needed registering; the one candidate fork is recorded in Section 6 as a reversible
assumption. This is the last gate `milestones/milestone-03-game-menu.md` names — every Definition of
Done item is now checked, and the milestone itself awaits Mario's review and acceptance rather than
further building.

## 9. Canon impact

| Proposed rule | Would live in | Earned by |
| --- | --- | --- |
| None | — | This gate builds Campaign and Challenge's handoffs exactly as `milestones/milestone-03-game-menu.md` Section 2 already describes them, and reads `engine.md` 9.7's existing RULE more carefully rather than proposing to change it; nothing here contradicts or extends any RULE, so no amendment is proposed. |

Questions raised: none. Section 6 explains why the one candidate fork (whether Challenge's activation
should keep showing a notice or become a silent no-op) is recorded as a reversible assumption rather
than registered as a `Q<n>` row — it is not a product decision Mario would need to choose between named
options for, and it is cheap to revisit if evidence later says otherwise.

## 10. Next authorized action

None within Milestone 3 — this was its last gate. The next authorized action is Mario reviewing the
three gate reports and the screenshots in `evidence/screenshots/` and formally accepting the
milestone, the same act that closed Milestone 1; once that happens, a future session updates
`specs/project-governance.md`'s ledger and opens Milestone 5 (Build Phase) per
[`../milestones/README.md`](../milestones/README.md)'s own build order — not before, per `AGENTS.md`
Section 9's "revise the next milestone only after owner acceptance."
