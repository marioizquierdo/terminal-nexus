# Keyboard without acceleration (2026-10-08)

Mario asked for a build to try with the arrow keys' acceleration taken away, and more settings to try other ways of
moving with the keyboard. These notes continue [`2026-10-07-nexus-pulse.md`](2026-10-07-nexus-pulse.md)'s numbering.
Built on a new pull request as a round of the Commander step. Status values: **Built**, **Scheduled**, **Open**,
**Contested**.

### F158 — A build with no acceleration, where only Shift goes faster or slower

> Well, do you know the acceleration when pressing the keyboard? I actually want to try a build that does not have
> acceleration and only relies on pressing shift to go faster or slower. Please make a PR with a playable version of
> it so I can test it out.

**Built.** The build opens with no acceleration: an arrow moves one tile, whether it is tapped slowly, tapped
quickly, or held, and a held arrow still repeats at the game's own pace. Shift (and Option, PageUp/PageDown,
Home/End) is the only way to change speed. Read two ways, since "faster or slower" could mean either: Shift moves
further than an arrow by default (10 tiles), and the arrow's step and Shift's step are both settings, so Shift can
instead be the slow, exact move (arrows five tiles, Shift one). The older speed-ups are still there, one setting
away. The pull request is a playable page with a button for each way to try it.

### F159 — Settings to try other ways of moving with the keyboard

> And feel free to add some settings so I can try out some other combinations of how to navigate with the keyboard.

**Built.** Keyboard navigation in Settings (`d`) now opens on the combination itself: **Acceleration** (off, taps,
holds, or both — the way it was), **Arrow step** (1 to 10 tiles), **Shift step** (1 to 20 tiles), **Shift pace**
(how often a held Shift-arrow moves) and **Hold pace** (how often a held arrow moves, or off: every repeat the
keyboard sends). The numbers the old acceleration uses follow, labelled as acceleration's, and the two about the
terminal's own key reports come last. A list always moves one row for an arrow and goes to its first or last row for
Shift, whatever the map's steps are. The Controls page (`?`) says what the arrows and Shift do in the build being
played.

### F160 — Acceleration removed

> What are some conventions that we can implement? Lets start by removing the acceleration, that was a bad idea.
> Tell me more recommendations

**Built.** Acceleration is gone, not just off: the Acceleration Experiment and the six numbers it used (the tap run
window, the quick tap, taps to speed up, the fastest tap, when a hold goes faster and how far) are deleted, and an
old settings export that names them still loads quietly. An arrow moves its step whether tapped slowly, tapped
quickly or held, and Shift is the only change of speed, as in every roguelike the survey could read
([the report](../reports/2026-10-09-roguelike-navigation.md)). Keyboard navigation in Settings is now Arrow step,
Shift step, Shift pace, Hold pace, and the terminal's two. The recommendations went back to him in the session.

### F161 — Shift jumps 9 across and 6 up or down

> shift jump can be uodated to 9 horizontally and 6 vertically.

**Built.** Shift (and Option, Home/End) jumps 9 tiles left or right; Shift (and Option, PageUp/PageDown) jumps 6 up
or down, since a row is about twice as tall on screen as a column is wide. They are two Experiments in Settings,
Shift step across and Shift step up/down; an old export's single jump distance reads as the one across.
