# Terminal Nexus — next steps

*What waits on Mario, the small carry-over from finished work, and the cleanup queue. Delete an item when
it is done.*

## Waiting on Mario

- **Play the Activity logs** (pull request 51): on the playtest page tap the "Activity logs" demo, press
  Esc then `a`, change the filter, press `e`, and paste the export into the pull request, so a real
  session's export can be checked. Also look at the About screen (Menu, then `4`).
- **Turn on GitHub Discussions** (repository Settings → General → Features) with an Announcements
  category, as the place for public updates; the About screen then links to it (`src/menu/about.ts` has
  the slot). Why this and not Discord is in
  [`../history/reports/2026-10-01-feedback-pipeline-parked.md`](../history/reports/2026-10-01-feedback-pipeline-parked.md).
- **Play step 6B**: PERIMETER, three rounds, Enter between them. Press `d` during a round: **Next round**
  (key / auto — whether the result waits for Enter or the next Build Phase begins on its own) and
  **Incoming wave** (shown / hidden — whether the Build Phase shows the next wave, see-through, with its
  intention), under THE MISSION. Then paste the export.
- **Q70**: when his squads fall in round 2, the round stops with the raid at the gate. Does that read
  right, or should a side whose Nexus stands only lose when it falls?
- **Q69**: an order primitive (hold, head for a place) as its own step — the smallest kernel change that
  makes an intention something the kernel keeps. `docs/game-design/scripted-opponent.md` has the thinking he asked for.
- **Step 6A's ending, in words** (accepted 2026-09-30, but not yet described): whether the flashing timer
  and the light round the border read as anticipation rather than an alarm, whether the red is rare and
  faint enough, and whether the result is clear without being told.
- **Run the key-release probe in iTerm2.** `node scripts/probe-key-release.mjs`, hold an arrow, let it
  go, tap it, `q`. If the lines say `release`, the Key releases Experiment's `auto` reads them there;
  if they say `legacy`, `auto` and `off` feel the same in iTerm2 (see Navigation and key releases below).
- **One question:** was "press `b`" an example of a key or a request for letter hotkeys? (Q67.)
- **One more:** should the player ever read the word "Pulse"? The start screen says Battle Round; the menu
  row and the running screen still say Pulse (Q68).
- **The menu spike follow-up's Experiments** (Battle Round flash, Flash strength, Popup pulse, and the
  keyboard navigation numbers) came back without an export; they stay until he sends one.

## Carry-over

Small, none blocking.

**From step 6B** (the loop; [the round-loop report](../history/reports/2026-09-30-round-loop-and-missions.md) has the reasons):

- **PERIMETER is played on the Build Phase's placeholder map**, with regions named for its landmarks
  (the ridge's gap, the east flats). PERIMETER's own map is Q38's.
- **Every unit engages the nearest enemy** — `order` has one verb, `advance`, and an intention is a
  sentence the mission writes (Q69).
- **A round ends when the player's units are all dead**, even with the Nexus standing and a later
  arrival still due (Q70).
- **A new Nexus power is dealt every round** (the placeholder draft adds 30 or 2000 credits), on top of
  the credits carried over. Real Nexus powers are Milestone 8's.
- **The incoming wave is a forecast** placed against the map without the plan; a building on an
  arrival's tile moves it when the round starts.
- **The Barracks trains nothing yet** — its card says "Trains troopers" — until 6C.
- **The walk home is a straight glide** over whole tiles, with no routing (from step 6A).
- **Watch again** replays a Pulse already resolved; it cannot, and must not, resolve a new one (from step 6A).
- **Step 6A's design changes** (Recall as built, the Start Pulse screen) still have to be written into the
  design documents, together with 6B's, which the round-loop report lists.

**From the Build Phase:**

- **The map's own Barracks sits right of the first free spot**, so arming a second Barracks goes below
  it and the third continues to the right. That is content, not the rule; a different starter map
  would not show it.
- **The restart-needed message has no live trigger**: no Experiment needs a restart today. The
  detection is tested with a test-only list; when the first restart-only Experiment appears, play it.
- **Q62, Q63, Q64** are still open and observable (the exploring click, the wheel step, the light
  theme's light). Ask him when he has an export.
- **A Settings restart with buildings planned throws removal sparks** over each; harmless, and arguably
  right, but the live loop cannot tell a restart from an undo.

**From the menu spike** ([the menu spike report](../history/reports/2026-09-30-menu-spike.md) has the reasons):

- **The Controls page is written by hand** (`controlsPage` in `src/build/help.ts`). A new key needs a
  line there as well as in `src/build/keyboard.ts`; a test holds every bracketed key a *hint* names to a
  real binding, but the page's own lines are checked by eye.
- **The focus arrow on a shallow diagonal** steps a row every few columns, a comet of `-` with a `\` at
  each step; in Unicode `━` and `╲`. Worth his eye along with the Experiment.
- **The card while placing shows what is being built, never what is under the cursor**; a player who
  wants to read a building on the map while placing presses Esc, then `e`.

**From the menu spike's second round** ([the menu spike report](../history/reports/2026-09-30-menu-spike.md) has the reasons):

- **Three same-state tests click tiles chosen outside the click's edge zones** (build-phase,
  build-nexus, build-experiments): if the owner changes the click edge zone, those tiles need moving.
- **The committed plan's fallback panel still prints `[esc] menu`**, key first, beside the top bar's
  own `menu [esc]`; it only shows when no Pulse can start. Removing the line is one edit.
- **The title screen's menu does not speed up when held** — it stops at its ends and jumps, but has no
  clock of its own to time a held key by, and only four rows.

## Navigation and key releases

### Polish navigation in a session of its own

The owner asked for this note (third round of menu spike feedback, 2026-09-30): "Just do some changes here, and add a note
that we need to come back to polish navigation again on another dedicated session".

**Built in the menu spike's third round**, on the map cursor and in every Build Phase list alike (`src/build/motion.ts`;
the reducer still sees only ordinary `move-cursor` and `highlight` commands):

- **Taps speed up by counting.** Taps of one arrow each within `doubleTapMs` of the one before are a run
  that keeps its speed; the third tap since the speed last changed (or the run began), if it came within
  `fastTapMs`, doubles it: 1, 1, 2 — then 2, 2, 4 — and 4 is the top. A slower gap, another arrow or any
  other key starts over at 1. *Reading taken:* the second doubling uses the first one's rule (three taps,
  the last quick); his words could also mean three double taps of any pace — one line in `moveStep` if so.
- **A hold runs at the game's own cadence**: at most one move per `holdMoveMs` (on average exactly that
  when the keyboard repeats faster), `holdFirstStep` a move, `holdLongStep` once it has repeated for
  `holdLongMs`. A hold breaks a run of taps, so the tap after it is one tile. The fast move is unchanged.
- **How a repeat is told from a tap**: with key events the terminal says so; without, a press within the
  hold window (the Experiment, 200 ms by default) of the one before is a repeat.
- **Key releases (auto / off)**, applied at once: on `auto` the Build Phase asks the terminal for the kitty
  keyboard protocol, pushes its flags if it answers and pops them on every way out through the one
  disposer (tested: `q q`, Ctrl+C in both forms, Esc then `q`, SIGINT, SIGTERM, a render failure, a
  setup failure). With it on, Esc arrives whole and needs no wait. The browser page plays such a
  terminal from `keydown`/`keyup`. Scripts can send `Right/repeat`, `Right/release`; the playtest
  summary prints each move (`tap 2`, `hold 0`).

**First guesses** (`src/build/tuning.ts`): his own numbers — `doubleTapMs`, `fastTapMs`,
`tapsToSpeedUp`, `tapTopStep` — and the hold cadence, which is ours: `holdMoveMs`, `holdFirstStep`,
`holdLongStep`, `holdLongMs`. The hold window's 200 is his "I would try".

**Measure first**, in his iTerm2: `node scripts/probe-key-release.mjs`. Does it answer the kitty query,
and do held keys say `repeat` then `release`? What are his keyboard's repeat delay and interval (the
`+N ms` column while holding)? Then play with Key releases `auto` and `off` and compare. tmux and SSH may
not pass the protocol through — measure, do not assume.

**Left for that session:**

- Tune the hold cadence to his feel — make its four numbers Experiments for the session if he wants to
  turn them live.
- A learned hold window (tier 2 below): measure the first held run's repeat gap and set the window from
  it, rather than a fixed 200 ms.
- With key events, a hold still waits for the operating system's first repeat before moving on the
  cadence. A timer of the game's own in the live loop could start it sooner and stop at the release —
  with a safety stop for a release that never comes.
- Without the protocol a lone Esc still waits a moment (`escTimeoutMs`); Windows Terminal's win32-input-mode is not read;
  the title screen's menu has no timing at all; the page's hidden typing field sends no releases.
- A terminal that answers the question after a very quick quit would print its answer into the shell —
  not seen, not guarded.

### The design

The decision is Q66 in [`answered-questions.md`](../history/answered-questions.md); this is the working design. Principle: **the plain path
always works; a host that offers more makes it better.**

- **Tier 1 (floor).** Every move is also one key (tap = 1 tile, Shift/PageUp/PageDown = 12), so no hold
  is ever required. True today.
- **Tier 2 (timing; the terminal today).** Keep the ramp. Replace the hand-tuned "Hold window" default
  with **a learned one**: on the first held run, measure the gap between repeats, keep the median, and
  set the window to about twice it, so a slow OS repeat delay stops turning a hold's first repeat into
  a tap. Keep the Experiment as an override. Treat "nothing for the window" as the release.
- **Tier 3 (releases).** When the host reports them, a press moves exactly one tile; a hold is press
  … release and runs on the game's **own repeat cadence** (a fixed interval and the 1 → 2 → 4 curve),
  ignoring the OS repeat entirely. This is "regular 1 block intervals" for taps and a steady, tunable
  speed for holds.
- **Detecting a host.** Terminal: send the kitty query (`CSI ? u`) followed by Device Attributes
  (`CSI c`, which every terminal answers), so "answered the second, not the first" means no protocol.
  If supported, push flags with `CSI > 3 u` (disambiguate + report event types) and **pop them on every
  exit path** through the one disposer (`q`, `SIGINT`, `SIGTERM`, a crash) — leaving a terminal in
  that mode is the failure to avoid. Browser: `keydown`/`keyup`, always. Windows Terminal:
  win32-input-mode. `scripts/probe-key-release.mjs` already does the query and prints every event.
- **What it costs elsewhere.** With the protocol on, keys arrive as `CSI … u`, so the decoder learns a
  second form (and a lone Esc stops needing its 100 ms wait, which also ends the Esc-versus-Option
  ambiguity). `tmux`, `screen` and SSH hops may not pass it through — measure, do not assume.
- **Parity.** The reducer still gets `move-cursor` commands; only the input path changes. A test feeds
  the same intent as timed presses and as press/release events and asserts the same positions.
- **Ship it behind an Experiment** ("Key releases": auto | off) so Mario can compare, and after the
  input event with a `phase` exists ([`portability.md`](../system-design/portability.md), item 1) — that seam is the real work.

## Cleanup and refactor queue

| Item | Why | Size |
| --- | --- | --- |
| Screenshot flows set Experiments with `--settings`, not "Down*6" | Every added or removed Experiment shifts a count (three recounts this round) | a morning; only the flows that set a value, not the ones that show the popup |
| A `ScreenHost` interface and an `InputEvent` with `phase` | Fewer TTY fakes, real key releases, gamepad and touch-hold | see [`portability.md`](../system-design/portability.md) |
| One launch-options module for the command line and `#settings=` / `#keys=` | A new option can reach one and not the other | small |
| A host-conformance test: run a key script through the terminal path and the page (headless Chromium) and compare frames | Turns the by-hand check we did into a test | small to medium |

## Not measured yet

- iTerm2: key releases (the probe), Option and Esc handling as measured in step 5A's table, OSC 52
  clipboard once "Applications in terminal may access clipboard" is on.
- Any terminal but iTerm2 and tmux: WezTerm, Ghostty, kitty, Alacritty, Windows Terminal, GNOME/VTE.
- The playtest page on a real phone and on an iPad with a hardware keyboard (Esc, Option).
- The thin map-edge glyphs on a terminal font that lacks box-drawing weights.
