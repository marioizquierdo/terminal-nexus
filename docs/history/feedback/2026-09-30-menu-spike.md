# Owner feedback — the Build Phase menu spike

Mario started the menu reorganisation that round 3 left for a spike of its own (F51, in
[`2026-09-29-pr48-round-3.md`](2026-09-29-pr48-round-3.md)) on 2026-09-30, after pull request 48 was
merged. It continues that log's numbering and is built on a dedicated pull request. Status values:
**Built**, **Scheduled**, **Open**, **Contested**.

## What the menu is for

### F52 — Every menu row either opens a popup or gives the map something to do

> Let's do one round of improving the build menu. Overall, I want consistency and simplicity, and we
> can now start to see the patterns that will allow this. Let's think about the actual actions that can
> be done on this game. All the actions are during the building phase.
>
> * Explore Map, just to gather intel
> * Choose a nexus upgrade. It is useful to be able to explore the map before picking the upgrade. We
>   haven't completely decided how the upgrades work, but we are trying to do a draft pick, where the
>   player chooses one of three. Here is where the player can also explore the other upgrades selected
>   during the previous pulses. In any case, the menu item just needs to toggle the nexus popup, and
>   show if there are any required upgrades to pick.
> * See available resources
> * Place a building, artifact or unit on the map.
> * Pick an upgrade or activate some item
> * Read info about a tile on the map, or a menu item.
> * Start next battle round
>
> It seems that menu items either open a popup, or place something on the map. During the game, more
> items will appear as they are unlocked. Some actions may only be available by navigating the map and
> clicking on the right building or unit, which will show a different menu; let's worry about that
> later. Right now, we will improve the regular menu.

**Built** as the principle the others follow, and written into the interface rules: both kinds of row
share one active look (F53). `[n] Nexus` already toggled its popup and showed how many picks are
waiting (`(1)`); nothing changed there. Menus reached by clicking a building or a unit on the map are
later work, not this spike.

## The menu itself

### F53 — The active row reads `[x] Explore Map >>`

> Active menu item should change from "> [e] Explore Map" to "[x] Explore Map     >>", with the arrow on
> the right side, and the hotkey updated to "x" (which is the alternative to esc). This will help with
> the visual aid about the selected item having an effect on the grid. Specially important for
> buildings.

**Built.** While a row's action is under way its hotkey shows as `[x]` — the key that ends it — and
`>>` replaces its right-hand value (a building's cost), pointing at the map; the `>` in front is gone.
It is the one active style for every row, so the Nexus row behind its popup and Start Pulse behind the
Battle Round screen take it too (both popups sit over the map, to the right). `e` still opens and
closes Explore Map; only the active row shows `[x]`. A pressed flash still plays over the same words.

### F54 — An arrow flies from the menu row to the cursor, and the cursor blinks when it lands

> Explore Map and buildings change the keyboard focus from the menu on the left into the cursor on the
> grid in the right. We should experiment with an animation that sends an arrow from the menu item to
> the cursor. The arrows on the right side could actually come from the right side of the word that is
> being clicked (e.g. "[1] Barraks      40" becomes "[1] Barraks      >>" and then the arrow continues
> all the way to the cursor. This animation should be fast and use interpolation for best framerate, and
> the arrow could be better represented in ansi. The cursor doesn't have to wait until the animation is
> completed (the user should be able to start moving it right away), but when the arrow animation
> completes (arrives at the cursor), the cursor should flick/blink (what is the effect name?) with the
> same exact effect as the one we use when selecting menu items (blank twice in quick succession). This
> is a specific way to bring the eye attention towards the cursor on the left. This is only needed when
> going from menu to grid, when pressing esc or x to go back to the menu, it is clear that the menu item
> is selected again, so no need for back effect. Let's see how this looks and whether this helps with
> clarity of focus.

**Built, as two Experiments he can flip** (`d`: **Focus arrow**, 180 ms, off to 500; **Cursor blink**,
2, 0 to 3). The arrow leaves the active row's `>>` and flies in a straight line to wherever the cursor
is drawn, eased so it arrives fast and settles, homing on the cursor if it moves meanwhile; keys work
at once. Its head points the way it flies (`>` or `▶`) and a short trail follows, each cell the step
that reached it. When it lands the cursor blinks twice in the look of a menu row's "pressed" flash, at
the same speed. Only when a menu row hands the keyboard to the map (a building armed, or Explore Map
opened, from the menu); never on the way back, and not for Tab. Reduced motion drops the flight and
keeps the blink. The name he asked for: in the code the menu's effect is the **pressed flash**; on
screen it is a **blink** (twice, a double blink); the moving arrow is the **focus arrow**.

### F55 — Left and Right only blink the row; a placement back on the menu blinks it once

> We can remove the focus change when on a menu item pressing right arrow twice, on second though, it's
> better that the focus stays on the menu, but it is good that the menu item blinks when pressing left
> or right. When placing a building and the focus comes back to the menu, it should blink once to help
> bring the eye back to the building selection.

**Built.** Left and Right on the menu keep their flicker and never move the keyboard; Tab and a click
on the map still do. A placement begun on the menu — by key or by click — comes back to it with the
building's row flashing once.

### F56 — No categories; one blank line between Explore Map, Nexus and the buildings

> Remove the categories for now. We don't know how many items will be on a real game; we may need
> headers to separate menu items, or maybe it is fine to have a single long list. For now, let's not
> worry about that and have all options on the same menu. Just keep a space (1 empty line) between
> Explore, Nexus, and the Buildings.

**Built.** The COMMON, ARMY and SPECIAL headings and their "none available" lines are gone; the
menu reads Explore Map, a blank line, Nexus, a blank line, the buildings in order, and Start Pulse on
the panel's last line. The rule that an empty group is drawn so no hotkey moves when content arrives
went with the groups, until headings come back.

### F57 — Resources as `$ 100`, top right, no maximum

> Keep the resources on the top right of the menu. Use a symbol for the resources, use "$ 100" for now.
> Do not show the max amount, we can show that on demand when the player tries to add more resources
> but there's a limit, we will implement that later. For now, just add "$ xx". Having the credits
> aligned on the right looks good, because that is the cost of buildings, nice.

**Built**, read as: the panel's top line holds `$ 100` against its right edge, the same column as the
costs, with nothing else on that line — so it stays in view on every panel, a building's card and
Explore Map included. No maximum. (The other reading, `$ 100` directly above the building list where
RESOURCE was, is one line of layout to swap if he prefers it; asked on the pull request.)

### F58 — No help text in the menu; a building being placed shows its full card

> Remove the help text at the bottom of the menu. Instead, let's use the same mechanism that we already
> have for "Explore Map", when a building is selected for placement, the menu should change to the full
> card that shows details about that building, but instead of having "[x] Explore Map >>" on top, it
> will have the building selection "[x] Barraks     >>". This will create visual consistency for
> anything that gains focus on the map, where "x" (or esc) will close the temporal detail view, and it
> will work well to allow players to read more details about the thing that is going to be placed. This
> will give us a lot more real state to show more details.

**Built.** The key help that overflowed into the panel and the line describing the highlighted row
have left it (what a row does is the bottom line's to say, F59). While a building is armed the panel
is its card, under `$ 100`, `[x] Barracks >>` and a separator — the same card Explore Map shows for a
building: its glyphs, its name and "to build", what it does, cost, health, size, attack. `x`, Esc or a
click on the panel close it, back to where the placing began; a digit arms another building and the
card changes.

## The bottom of the screen

### F59 — One bottom row: contextual help

> The bottom of the UI currently uses 3 rows. We have to reduce that to 1 row. The "view x y" position
> is not needed. The "Map arrows move, enter/space etc etc." info for keys is also not needed. The only
> thing that is useful is having a single row that offers contextual help. We already have one for the
> last row, we just need to make that one better in code with an easy-to-use interface to show help as
> needed. This will also give the game more screen real state.

**Built.** The position readout and the key help are gone; the map has the two rows (18 rows of map
at 80 × 24 instead of 16), and 80 × 24 stays the floor. The one row says what the last key did when it
said something, and otherwise what can be done where the keyboard is — the highlighted row's
description and cost, the keys for placing, what an open popup's keys do — from one list in the code
with a line per situation (`src/build/help.ts`); a new situation is one line there. An answer lapses
at the next key that says nothing, so the hint comes back on its own, and hints read quieter than
answers. The map's edge weight is the "more map this way" signal alone. This reversed the rule that
the footer carries a position readout (canon 2.27).

### F60 — The game menu explains the controls

> The "menu [esc]" can also have an option for "Controls and hotkeys" that opens a section that explains
> how to use the keyboard, hotkeys and mouse clicks. This will be enough for offering help.

**Built.** The game menu has `[c] Controls and hotkeys`: a scrolling page of the keys and clicks, by
situation — the menu, the map, placing a building, Explore Map, popups, the mouse, the Nexus Pulse,
anywhere — from one table. Esc goes back to the game menu. `?` opens it straight from the game, and
the phone key bar on the browser page has a `?` key.
