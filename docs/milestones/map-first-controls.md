# Map-first controls — a proposal to try

_The Build Phase driven from the map, with the side panel as the map's helper on the right. An experiment first: the
owner plays each change as it lands, and only the direction he keeps is cleaned up into a pull request. From the owner's
notes after playing the rally point, 2026-11-26._

## Why

Playing the rally point showed where the decisions are: on the map. Today the menu runs the Build Phase. The player
goes to the menu, picks a building, the focus jumps to the map, and back again. The map-first flow turns that round: the
cursor lives on the map, and the panel offers what can be done with the tile under it.

## The three ways to play

This part is settled, and [`ui-patterns.md`](../system-design/ui-patterns.md) holds it as a rule ("Three ways to
play"). Each way plays the whole game alone:

1. **The mouse alone.** A click is how the mouse looks at something (it has no hover), and a click on an action does it.
2. **Six keys**, as an old game pad: the arrows **move**, Enter or Space **accepts**, Esc, `x`, Backspace or Delete
   **goes back**. Shift with an arrow moves fast. Esc is also the pad's Start: with nothing left to go back from, it opens
   the game menu.
3. **Hotkeys**, for speed: the arrows still move the cursor, and a letter or a digit does an action at once (`b`
   build, a digit for a building, `n` Nexus Pulse, `s` Start Battle), skipping the steps in between.

The flow below is written for the six keys; the mouse and the hotkeys reach every step of it.

## The flow

**The screen.** The map on the left, taking the width; the side panel on the right (the eye reads from left to right,
and the map comes first); the top bar and the bottom line as today.

**The cursor is the hover.** The Build Phase opens with the keyboard on the map, the cursor beside the player's Nexus.
Moving the cursor is looking: the panel shows the card of what is under it (a building, a unit, a resource, open
ground), and the bottom line says what Enter and the hotkeys would do there and anything the tile's status needs said.
There is no Explore Map mode any more: exploring is what the map always does.

**Enter selects.** Enter on a tile gives the keyboard to the panel, which lists what can be done there, one to three
rows:

| Under the cursor | The panel's rows (Enter on the map) |
| --- | --- |
| Open ground | `[b] Build`, opened at once: Enter on ground is the same as `b`, so the list of buildings shows with the first highlighted |
| One of your buildings | its actions: upgrade, a building action (train, a fitting), remove while it is only planned |
| Your Nexus | the Nexus Pulse: the hand to pick from (Enter on the Nexus is the same as `n`), and `[s] Start Battle` |
| An enemy building or unit | nothing to do: Enter does nothing, and its card is already showing |

Esc goes back one step: from the building list to the tile's rows, from the rows to the map, the cursor where it was.

**Building.** A building picked in the list gives the keyboard back to the map with its ghost at the tile where Enter
was pressed (the arming spot rule, from that tile). The arrows move it, Enter places it, Esc cancels it. **Once placed,
the cursor waits beside the new building**, on the tile where a second one would fit (the arming spot rule again), so
building a row is Enter, Enter, Enter. The loop is: walk the map, Enter, pick, place, walk on.

**The Nexus and the round.** Selecting the Nexus is the Nexus Pulse, so a power can be picked by walking to it or by
`n` from anywhere. Starting the round is `s` from anywhere, or the Nexus's row: it goes straight to the rally point (the
rally point's own flow), and Enter there starts the Battle Round.

**The mouse.** A click on a tile moves the cursor there: the panel shows its card and its rows. A click on a row does
it (`Build` opens the list, a building arms it, the ghost on the clicked tile); a second click on the same tile is Enter
(placing does this today). A right click goes back. So the mouse walks the same steps as the six keys.

**The hotkeys.** A building's digit arms it from the map at the cursor, as today; `b` opens the list; `n` the Nexus
Pulse; `s` Start Battle; `u` undo. Every hotkey still shows on screen where its action is offered.

## Details to settle while playing

- **What the panel shows on open ground before Enter.** The ground's card says little. The panel's spare room could hold
  what the menu shows today: the credits, the raid coming and where your troops head. Try it there first.
- **Where the credits live.** On the top bar, so they show whatever the panel holds; the list of buildings shows each
  cost and dims what cannot be afforded.
- **Enter on open ground: the list, or the rows first?** The owner asked for the list at once. Keep it unless a second
  action on the ground appears (a rally point of a building's own, later).
- **The list remembers.** The building list opens on the last building placed, so building another of the same is
  Enter, Enter.
- **Tab** keeps moving the keyboard between the map and the panel, for players who want the menu.
- **The Battle Round.** The same rule while the round plays: the cursor looks, the panel shows the card of what is
  under it, and Enter has nothing to do yet.
- **Motion.** The hand-off motions follow the keyboard both ways: the focus arrow from the cursor to the panel when
  Enter opens it, and from the list's row back to the ghost when a building is picked.
- **What goes away if this works:** Explore Map as a mode (exploring is the default), plain navigation and Explore Map as
  two map modes (one is left, besides placing), the menu's Explore Map row, and the rule that the Build Phase opens on
  the menu.

## How to build it: experiment first

The owner plays the game on his own computer while a local agent changes it, and decides by playing. So this work does
not follow the usual rules for a change until a direction is chosen:

- **No Experiments, settings or flags.** Change the code directly; try a version, let him play it, change it again.
  Two ways of doing a thing are not kept side by side behind a switch.
- **No measurement first, no new tests yet.** Keep the type check passing and the game starting; tests that assume the
  menu runs the Build Phase may fail meanwhile, and are not worth fixing until the flow is settled. Note which ones
  fail.
- **Small steps he can play at once.** Each change is runnable as soon as it is made (`./bin/terminal-nexus.ts`, a
  Skirmish), and the agent says in one line what changed and what to try.
- **Keep a short log** of what was tried and what he said, in this file under "What was tried", so the cleanup knows
  why the final shape is the one it is.
- **Commit as you go on a branch of its own**, never on `main`; no pull request yet.

**Then the cleanup, in its own pass**, once he says the flow is right:

- The design documents: [`ui-patterns.md`](../system-design/ui-patterns.md) (the screen's regions, the focus, the map's
  modes, the menu rows, the cards, the hand-offs, back and cancel) and [`input.md`](../system-design/input.md) (the
  cursor and the focus) say the new flow, and every RULE they hold is true again.
- The tests: the failing ones rewritten for the new flow, a test for each new rule, the old modes' tests removed.
- Dead code removed (Explore Map's mode, the menu's rows that went), the glossary's words checked.
- A pull request written with the `pr-description` skill, its Demo a GIF of building a few buildings from the map.

## Where to start in the code

- The layout: `src/build/layout.ts` (`buildLayout`: the panel's side, the map's box) and `src/view/build-frame.ts`.
- The focus and the modes: `src/build/state.ts` (`focus`, `exploreMap`, `returnTo`, `armingSpot`, `menuEntries`) and
  `src/build/keyboard.ts`.
- The panel: `src/view/build-menu.ts` and the cards (`src/build/card.ts`, `drawCardBody`).
- The bottom line: `src/build/help.ts` (`HINTS`).
- The hand-offs: `src/view/build-live.ts`.
- The scripted playtest (`node scripts/playtest.mjs`) to count the keys a flow takes before and after: building a
  Barracks beside the Nexus should take fewer presses than today.

## What was tried

**First cut, 2026-11-26** (branch `claude/eloquent-bardeen-i6pexc`), waiting for the owner to play it:

- **The panel on the right.** The map on the left from the frame's border; the divider is the map's east side and the
  panel's west. Popups docked to the panel open over it on the right.
- **The cursor is the hover.** The Build Phase opens with the keyboard on the map, the cursor on the nearest open ground
  beside the Nexus. The panel always shows the card under the cursor (there is no plain navigation now), and the bottom
  line says what Enter does there.
- **Enter selects.** Open ground: the list of buildings (the old menu, its first row renamed `[e] Map`), on the last
  building placed or the first. The Nexus: the Nexus Pulse, with a `[s] Start Battle` row under the hand. A building of
  yours: its actions as rows docked over the panel (Remove while it is only planned). A unit or an enemy: nothing.
- **Esc goes back one step**: the list to the map, placing to the map, and on the map the game menu. `x` stops on the map.
- **Placing**: the ghost from the selected tile (the arming spot rule), and once placed the cursor waits on the next
  spot that fits the same building, so another is Enter, Enter, Enter (list, pick, place).
- **The mouse**: a click on a tile moves the cursor; a second click on it is Enter; a click on the panel while it shows
  the card is Enter.
- **Not yet**: `b` as the list's hotkey (it is a building action's key today), the ground's panel holding the credits
  and the raid, the hand-off motions, the Battle Round's hover.
- **Tests failing meanwhile**: the focus and hand-off tests in `tests/` that assume the menu opens the Build Phase
  (`build-focus`, arming-spot flows, the driver and mouse equivalence frames); rewritten in the cleanup.
