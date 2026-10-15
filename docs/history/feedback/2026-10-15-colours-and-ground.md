# The colour setting's name, and the game painting its own ground (2026-10-15)

Mario, the day he dropped the 16-colour depth, asked for the next round of colour work: what the setting should be
called, a decision on the background question, and the light theme. These notes continue
[`2026-10-15-drop-16-colours.md`](2026-10-15-drop-16-colours.md)'s numbering. His words are voice transcription, kept as
they arrived. Status values: **Built**, **Scheduled**, **Open**, **Contested**.

### F176 — What should the capability setting be called

> Let's continue fixing colors. You are the color and palette expert, both visually and in code structure. Both have to
> be smooth and harmonic.
>
> Why is the capability parameter called like that? should it be "color" instead? Please check and find a better design,
> updating the dev doc files to make sure future agents know about the flags.

**Built.** The setting is `colors` everywhere now: `--colors` on the command line, Colours on the Settings screen (the
screen still says none, 256 and millions), `colors` in the saved settings, the export and the Activity Logs, and
`ColorDepth` for its type in the code. It had three names for one thing (the flag said capability, the screen said
Colour depth, the code said `CapabilityMode`), and "capability" suggested a fact the game detects, such as what a
terminal can do, rather than how much colour the player has chosen to draw with. A settings file or a pasted export
written under the old name still reads (the colours keep their value), and `--capability` is refused with a line saying
it is `--colors`. The four display options, their flags, their saved names and where a colour goes are in one table in
[`DEVELOPMENT.md`](../../../DEVELOPMENT.md) ("The display options").

### F177 — The game paints its own background

> For background color... of course! This should he clear, but while Terminal Nexus is game played on the terminal, it
> is still a rich game. We support ascii and  monochrome, but that is to allow better testing and compatibility; if you
> see screenshots it's clear that is a degraded experience. We are trying to simulate RTS field battles here, and
> there's a lot of visual information that needs to be crystal clear; colors and contrast are crucial here, and we can
> only achieve that with colored backgrounds. We also implement layers and transparency, all that needs a strong control
> over the background.

**Built.** This answers the question the Solarized remark opened (whether the game paints its own ground or leaves the
terminal's): it paints it. At 256 colours and in millions every cell is two colours, its glyph's and its fill, the fill
being the theme's ground unless the cell brings its own, so a Solarized terminal, a purple one and a black one all show
the same game, and a fade or a see-through mix blends toward a ground that is really there. A screen bigger than the game
(the title menu is 80 by 24 on any terminal) is ground to its edges. The terminal's own ideas of "default colour",
"faint" and "reverse video", which differ from one terminal to the next, are no longer sent with colours: a dim glyph is
mixed toward its fill by the game, the same everywhere. Monochrome alone leaves the terminal's colours as they are.
It also settles how monochrome is described: the floor where every fact still reads, kept for testing and for any
terminal, and not the look the game is made for (the documents said "not the degraded mode"; they now say what he said).

### F178 — The light theme, and the next round of colour stability

> The switch to light theme is currently not working well, perhaps after controlling the background color this will also
> be fixed.
>
> Go ahead and address the next iteration of cor stability improvements

**Built.** It was fixed by the ground, as he guessed: the light theme's dark text had been drawn on whatever the terminal's
own background was, which on a dark terminal is dark on dark. Looking at the light theme with its ground painted found one
more thing, which is also fixed: the Ravel side's green had been darkened almost to black (so the "RAID" line and the raid's
units read as plain text, and at 256 colours as grey), to keep it far from the Citizens' rust in lightness. It is now a
green that reads as green (the cube's own forest green), and the two sides stay well apart for a red-green colour-blind
player when simulated. 256 colours is matched to millions by how different two colours look, not by how far apart their
channels are, and a few light-theme colours (and one dark) moved a few points toward the 256-colour cube so every role is
within a small difference of what millions shows. A palette test now holds these as a bar for any colour added later
(`tests/palette.test.ts`). Left alone because they are inherent to 256 colours: a faint wash of a colour (a territory's
tint) lands on the nearest of very few pale or dark colours, so it can read greyer or pinker than in millions.
