# Dropping the 16-colour depth (2026-10-15)

Mario asked how the colour depths work and whether all of them are worth keeping, then decided. These notes continue
[`2026-10-13-commander-armies.md`](2026-10-13-commander-armies.md)'s numbering. His words are voice transcription, kept
as they arrived. Status values: **Built**, **Scheduled**, **Open**, **Contested**.

### F174 — Review how the colour modes work and what they cost

> I want to review how do the different color modes actually work and is implemented. I am wondering if it is adding too
> much complexity to the project to maintain the multiple color modes, or if we have a progressive or enhancement
> techniques that are actually allowing us to define the colors in full color mode, and they naturally degrade to the 16
> and black and white. If what are the exceptions in some cases where we actually have to define to make sure that 16
> black and white still look decent? And what I'm actually thinking is, how can we have a strong color palette for the
> game where we can eventually make ASCII art and using different colors? And how can we make sure the effects like
> transparency still work without having to define extra code for the different modes? If we identify there is extra
> complexity, where can we cut corners? Is it still worth it to support black and white? Is it still worth it to support
> 16 colors? Where are the platforms where this could be useful for a game like this?

**Built** (as a review, no code). Truecolor to 256 colours is derived by nearest match, so it costs nothing to keep.
Monochrome is the floor and costs nothing as a depth. The sixteen-colour depth was the one hand-authored table:
twenty-six roles shared eleven ANSI codes in the dark theme and eight in the light one (there, the player's own colour,
the danger colour and the blast were all the same red), and its tests pinned past bugs rather than a rule. The palette
question (a real accent palette, with ramps that ASCII art can draw with) stays Q51; the review's proposal for it is in
that question.

### F175 — Drop the 16-colour depth

> I would still like to drop the 16 color, basically because I don't want to have to support that. I would be ok with
> 16 color if it could be fully automatable like 256 and 2 colors. I only have bandwith to playtest true-color and I can
> check 256 and b&w once in a while, but I don't want to also have to check 16 color. If we drop this mode, does that
> mean we will fallback to b&w? Is it possible we can also resolve 16 color by nearest neighbor like we do on 256? I
> don't even know how the game can support the terminal's solaris theme, since Terminal Nexus makes use of background
> colors a lot, all the visual effects are really needed to have a reasonable read of the battle. What do you think here.
> I want to resolve this on this session, and then update the docs

**Built.** There are three colour depths now: none (monochrome), 256 colours and millions (truecolor). A terminal that
advertises nothing more gets monochrome, and so does a saved setting that named the old depth; the Settings row, or
`--capability`, is one step from the right one. Nearest match cannot do the sixteen: they are the terminal theme's own
colours (Solarized's yellow is not xterm's), so there is nothing to match against, and the 256 search already starts
at index 16 for that reason. A test now holds that no colour the game draws is one of them. Monochrome sends no colour
code at all, so it is the one depth that leaves the player's terminal theme exactly as it is. The question the
Solarized remark raises is a different one, and it is registered: the game leaves the terminal's own background under
its colours while it blends toward its own assumed ground (Q79).
