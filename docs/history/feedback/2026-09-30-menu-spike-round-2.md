# Owner feedback — the menu spike, round 2

Mario played the menu spike (pull request 49) and sent this on 2026-09-30, with a settings export.
It continues [`2026-09-30-menu-spike.md`](2026-09-30-menu-spike.md)'s numbering and is built on the
same branch and pull request. Status values: **Built**, **Scheduled**, **Open**, **Contested**.

> Excellent. Now some feedback to review:

## The menu rows

### F61 — The Left/Right flicker is too strong

> The blink effect when the menu item does not have an action (left + right arrows) should be more
> subtle. Right now, it is so strong that it seems as if it would be doing something. Instead it should
> probably just grey out the text and not change the background, or have a slight change of background
> but keep the text the same. Please decide the one that you think is best, I think you get the idea.

**Built.** Decision: **grey out the text, keep the background.** The highlight bar stays exactly as it
is and only the row's words turn grey for the flicker, which reads as "nothing here" rather than as a
press. (A background change would need colour to show at all; greyed words also work in monochrome,
where they are drawn dim.) The same grey answers a refused key on any row — a building that costs too
much, or another building's digit while one is being placed.

### F67 — The active row: no underline, one `>`

> Do not underline an active menu item, it is enough with the color and the ">>". And actually, change
> the "active in grid" arrow to just one ">".

**Built.** An active row is the hotkey colour and a single `>` at its right end; no underline.

### F70 — The card's header keeps the item's own hotkey, which cancels

> I regret using "x" on the detail title. It should keep the same letter as before, and simply work as a
> cancelation. So cancelation is "esc", "x" or the same hotkey (e.g. "e" for Explore, "1" for Barraks,
> etc.) that is already on the title. That is more intuitive.

**Built.** The header reads `[1] Barracks  >` and `[e] Explore Map  >`; `1` while the Barracks is being
placed cancels it, as `e` already closed Explore Map. Esc and `x` still cancel, and the bottom line
while placing says so: "Place the Barracks: arrows move, [enter] places, [1] or [esc] cancels." 

### F71 — The credits sit on the line before the buildings, with the map's resource symbol

> The credits should not be at the top right of the menu, specially when showing the details of a
> selection. Instead, they should be on the empty line right before the build/construction list. Also,
> we should change the symbol, it should be the same as the symbol used on the map to represent
> resources.

**Built.** The amount is right-aligned on the blank line above the first building, with the map's
resource-deposit symbol (`*` in ASCII, `◆` in Unicode) in the deposit's colour: `◆ 130`. It is not on
the cards. The symbol is read from the map's own glyph table, so a map that draws its resources
differently shows its own.

### F72 — No blank line between Explore Map and Nexus

> Do not leave a space between Explore and Nexus items. Keep Explore at the top, then Nexus, then a space
> with the credits/resources at the right, then the first building, etc.

**Built.** The menu reads: Explore Map, Nexus, the credits line, the buildings, … Start Pulse last.

## Going to the map

### F63 — The arrow leaves from where the row was

> The arrow effect to the cursor is amazing! Let's polish it a little bit: It works specially well for
> building construction, it almost seems like the energy of the building is transfered from the menu to
> the grid, which is amazing. The arrow with the bluish color works well. The only thing I would change:
> start from the actual location of the menu item, not from the top. The item moves to the top because
> that works as a title.

**Built.** The arrow starts at the right end of the row the building was on in the menu, and the row
moves up to become the card's title (F68).

### F64 — Explore Map sends a see-through cursor instead of the arrow

> The arrow effect for the Explore should be different. The current arrow looks like a ray of energy,
> which works really well for placing buildings, but exploring is just moving the focus to the map. Use a
> cursor that is the same as the blank cursor, with about 80% "transparency"

### F65 — What "transparency" means

> We can define transparency as the color interpolation between the actual element color and the
> background, we could also blend the icon color as well, assuming that the icon is about 20% of the
> surface, so if the background is black, the icon on the background is yellow, and the cursor is white,
> then the cursor at 80% transparency (or "alpha") would be 80% white, and the other 20% split between
> black (80%) and yellow (20%); if we can calculate it like that, it will look pretty good when moving
> quickly around.

**Built (F64, F65).** Opening Explore Map from the menu sends a copy of the map cursor, at 80% opacity,
from the Explore Map row to the cursor, gliding over whatever it crosses. Each cell it covers is mixed
exactly as described: its background becomes 80% the cursor's colour and 20% of what was there — that
20% itself 80% the cell's background and 20% its glyph's colour — and the glyph stays readable, drawn
80% of the way toward the colour the real cursor draws glyphs in. The mix is a style the renderer
works out from colour roles (never a literal colour in the frame), exact at millions of colours, the
nearest colour at 256, and at 16 colours and in monochrome the plain cursor look for the part of its
trail that is more than half opaque. The arrow stays for buildings. It shares the focus arrow's length
setting, so the two hand-offs always take the same time.

### F66 — Explore Map puts the cursor on clear ground, as placing does

> Explore Map should use the same smart cursor placement as then placing a building. Having the cursor on
> a clear background when starting the movement is easier to follow (it's guaranteed to have high
> contrast with the background). Same algorithm should apply, so it should be easy to implement: find an
> empty tile with 1 tile space if possible, unless there is no empty tile in the area around the last
> cursor placement.

**Built.** Opening Explore Map from the menu runs the arming rule for a one-tile footprint: the cursor
stays where it is if that tile is free, and otherwise moves to the nearest free tile with a free tile
around it within 12 tiles (sideways cheaper than up or down), or stays if there is none. Decision:
**only from the menu.** Opened from the map (Enter in plain navigation, or `e` there), the player has
just put the cursor on the thing they want to read about, so it stays where it is.

### F68 — The card appears with a short animation

> Selecting a building, throwing the energy ray to the cursor, and changing the menu to show the details
> is working really well. But we can do better; let's implement an animation, where all the menu
> disappears except for the currently selected menu item that changed to the active state, then quickly
> interpolates (moves) the item to the top, and then the detail card appears. Be creative on this
> transition, but make sure it stays within 100 or 150 ms (feel free to add an experimental setting if
> you think I could play with some parameters). I think a fade effect to reveal the details would work.
> Revealing the title, subtitle and description text should have the typing effect. And the building
> tile could use the same building animation as when it is created.

**Built.** About 150 ms in three beats: the other rows fade out (the first quarter); the chosen row,
now active, slides up to the title line (the next 30%); the card fades in, its name, subtitle and
description typed out and the building's icon playing the same frames as a building going up (the
rest). An Experiment, **Card reveal**, sets the whole length — off, 100, 150, 250, 400 or 800 ms, the
last for watching it in slow motion. Explore Map's card opens the same way, for one pattern, and
moving from one card to another (Explore Map straight to a building's digit) reveals the new one.
Reduced motion shows the card at once.

### F69 — While a building is being placed, the menu stays on it

> Selecting a building (menu item) with hotkey while another building is currently selected should not
> change the selection. Let's make it so the current building ghost needs to be placed, or canceled,
> before the menu can select another one. Currently there's a small bug when hotkey a building (e.g "1")
> then another (e.g. "2") and then closing ("x") does not bring the menu focus back at the last selected
> menu item. But this should go away by locking the same building until canceled (pressing the same
> hotkey or esc or x).

**Built.** While a building is armed, another building's digit, `e`, `s` and `p` are refused (the header
row greys for a moment and the bottom line says "Place the Barracks or cancel it first: [1] or [esc].");
its own digit, Esc and `x` cancel it. Popups that belong to no row choice (the Nexus powers, the game
menu, Controls, Settings) still open over it and give it back when they close. The bug he saw — `1`,
`2`, `x` leaving the menu's highlight on the wrong row — cannot happen any more, since `2` no longer
changes anything.

## Back and cancel

### F62 — Only Esc opens the game menu; `x` only cancels

> Menu should only open with "esc", but not with "x". I think this is the only exception to the rule of
> esc and x are the same. I noticed I started using "x" to cancel things more often, so I like to type
> x-x-x and I 'd like that always get's back to the regular state with the focus on the menu.

**Built.** `x` walks back one level like Esc, and on the menu it does nothing: `x x x` always lands on the
menu with the keyboard there. Esc (and the top bar's `menu [esc]`, and `q`) opens the game menu. A right
click behaves like `x` — decision: a stray right click should never open a menu. `x` and a right click
also do nothing once the plan is committed or the Pulse is playing, where Esc still opens the game
menu.

### F73 — No "[esc] Back" rows in popups

> The menu popup does not need an option "[esc] Back to the game", because the general esc on the top
> right is contextual and already says "close" (same for every popup). Pressing esc or x will close any
> popup or cancel placing things on the grid, that's the UX convention (plz formalize it on the ui design
> spec).

**Built.** The game menu loses `[esc] Back to the game` and the export loses `[esc] Back to Settings`; the
convention is written into the interface rules: Esc or `x` closes any popup or cancels placing, the top
bar's right end says which, and no popup lists it.

## Moving in lists

### F75 — Menus stop at their ends; holding moves fast; Shift jumps to the end

> The navigation with up/down arrows in the menus should not rotate (same for game menu, settings menu,
> etc), if I keep down pressed, it should quickly move to the bottom and stay there (it's easier like
> that). Pressing shift + up should bring the cursor all the way to the top (or pgup, etc), this is the
> same convention as moving in the map, and it works well. Use the same timings, consistency here will
> be very useful.

**Built.** Every list — the Build Phase menu, the Nexus powers, the game menu, Settings, the export, the
Controls page, the title screen's menu — stops at its first and last row. A held arrow moves with the
map cursor's own ramp and timings; Shift+Up/Down, PageUp/PageDown and Home/End go to the first or last
row. One piece of code does it for all of them (`src/menu/list-keys.ts`), so a new list gets it by
using that. The title screen's menu stops at its ends and jumps too, but does not speed up: it has
only a few rows and no clock of its own to time a held key by.

## The interface rules

### F74 — Reorganise the interface rules document

> The ui design spec is growing. We have a lot of useful information on it and also a lot of extra cruff
> that is result of multiple edits over time. Please take some time to re-think and organize this
> document, and make sure it is properly referenced from AGENTS.md/CLAUDE.d so agents take it into
> account when working on the UI.

> I think from here you can easily guess the type of UI interactivity that we want to build, this will
> make the game look a LOT more legit, while also helping with usability. If you identify new UI
> patterns, please take note on the ui design doc, and make sure to keep polishing and improving the ui
> design doc so it becomes easier and easier to develop new UI.

**Built.** `docs/system-design/ui-patterns.md` rewritten around its patterns rather than its history: how to use it
and a checklist for a new screen first, then one section per pattern — the three worlds, focus and
modes, back and cancel, lists, menus and rows, popups, cards, hand-offs, the bottom line, colour and
see-through styles, animation timing, Experiments and tuned values — with this round's new patterns in
it (the see-through cursor, the card reveal, the lock while placing, lists that stop at their ends).
`AGENTS.md` and `CLAUDE.md` point to it as the document to read before any interface work.

## The settings export

### F76 — His settings are the defaults; most Experiments go

> Here's a new set of settings with my latest preferences. Many of those settings can be cleaned now, I
> feel good about them. Keep only the few that you think may be useful later, but it is good to cleanup
> so we can add more as we need them.

```
Terminal Nexus settings
# build 02fd8ee
# Changed experiments
placeGlowMs = 400  # Glow time, default 250 ms
scrollMargin = 30  # Scroll margin, default 25%
clickZone = 25  # Click edge zone, default 33%
easeMs = 100  # View slide, default 150 ms
cursorGlideMs = 100  # Cursor glide, default 80 ms
fastRecentres = off  # Shift centres, default on
rampMs = 200  # Held to go fast, default 300 ms
holdWindowMs = 350  # Hold window, default 150 ms
jumpStep = 10  # Shift jump, default 12 tiles
jumpRepeatMs = 100  # Jump repeat, default 150 ms
escTimeoutMs = 50  # Esc timeout, default 100 ms
refusedFlashMs = 90  # Refused flicker, default 140 ms
endWalkPauseMs = 500  # Walk-back delay, default 1000 ms
endWalkMs = 1000  # Walk-back time, default 2000 ms
raid = heavy  # Raid, default probe
crew = none  # Your units, default some
# Settings
theme = dark  # Background
capability = truecolor  # Colour depth
glyphPack = unicode  # Symbols
reducedMotion = off  # Reduced motion
# Experiments at their defaults
focusArrowMs = 180  # Focus arrow
cursorBlinks = 2  # Cursor blink
placeFramesMs = 300  # Build animation
placeLight = light  # Lighting
placeParticles = few  # Particles
clickScroll = edges  # Explore click
armedClickScrolls = on  # Armed click scrolls
doubleClickMs = 400  # Double click
tapStep = 1  # Tap step
holdStep = 2  # Hold step
fastStep = 4  # Fast step
refusedCursorMs = 150  # Refused cursor
pressedFlashMs = 90  # Pressed flash
endWarnMs = 3000  # Final warning
endCentre = on  # Centre on Nexus
redAlerts = on  # Red alerts
```

**Built.** Every value in it becomes the default, including a heavy raid and no units of your own for the
placeholder Nexus Pulse. The settled numbers move out of Settings into one table of tuned values in the
code (`src/build/tuning.ts`), each saying who chose it and when. Experiments kept: the focus arrow's length and the new card
animation's (both still being felt), the hold window (it depends on each keyboard's repeat delay, so it
may need retuning on another machine), and the raid and your units (placeholder Pulse data, gone when
the real mission arrives).
