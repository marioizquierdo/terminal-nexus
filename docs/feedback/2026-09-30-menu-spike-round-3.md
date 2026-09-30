# The menu spike — the owner's third round (2026-09-30)

**Document role:** The owner's feedback on the menu spike's second round and the general review, item by item, with what became of each
**Status:** WORKING — every item is Built, Scheduled, Open or Contested
**Updated:** 2026-09-30
**License:** Apache-2.0

Mario played the second round (pull request 49) and sent this on 2026-09-30, with a settings export. It
continues [`2026-09-30-menu-spike-round-2.md`](2026-09-30-menu-spike-round-2.md)'s numbering and is built
on the same branch and pull request. Status values: **Built**, **Scheduled**, **Open**, **Contested**.

### F77 — The effects

> I love the effects. They are visually interesting and really help ground the building activity.

**Noted.** Nothing to change; the card reveal and the hand-offs stay as they are, at his new lengths
(F81).

> Some minor adjustments:

### F78 — The scroll bar: the track as the border, a texture on the bar

> scroll bar texture should be inverted, keep the same background as the regular border, but add
> different texture for the bar, that will be more visible. The inverted shadow is a bit confusing.

**Open.** The popup's scroll bar track becomes the plain border, like the rest of the right side, and
the thumb (the part in view) gets its own texture, different from the shadow's, so it stands out.

### F79 — Tapping and holding to move: counting taps, a limit on holds, and key releases

> navigation with taps and acceleration (without holding) is still not working very well. The problem I
> have is that I often try to move to a position a few tiles away and then the cursor starts jumping
> ahead, so I have to stop and come back. The same is happening with the menu now. I would try
> holdWindowMs = 200ms, and then, give it a bit more time before updating to double speed. Let's try
> this: Instead of accelerating on fast taps based only on time, try based on number of taps within two
> different time windows: a double-tap (400ms) and a fast-double-tap (300ms). If there is a succession of
> double-tap and then fast-tap then activate double speed (medium). This means the user tap 3 times at
> least before activating speed, and the last one needs to be a bit faster (should feel like it accounts
> for acceleration). After that, the speed is maintained only with double taps, and after another 3 taps
> it doubles again to 4-tiles speed (fast). The keyboard press events should be handled in a way that
> limit the scroll speed more than strictly activating the fast movement. We should enable/disable
> reading key-press in the settings, so I can test how it feels when the system provides it vs when it
> does not. Just do some changes here, and add a note that we need to come back to polish navigation
> again on another dedicated session.

**Open.** Read as four changes, on the map cursor and in every list alike:

- **Taps accelerate by counting, not by time.** Two taps within 400 ms of each other are a double tap,
  within 300 ms a fast one. Speed doubles to 2 tiles only on the third tap of a run whose last gap was
  fast; it stays at 2 while taps keep coming within 400 ms, and after three more it doubles to 4. A
  pause longer than 400 ms, another direction or another key starts over at 1.
- **A held key has a speed limit.** A held key's repeats move the cursor on the game's own steady
  cadence, whatever the operating system's repeat rate, rather than switching straight to the fastest
  step.
- **The hold window becomes 200 ms**, as he asked to try (his export still had 250 from the old ramp;
  it stays an Experiment).
- **Key releases, where the terminal reports them**, behind a new Experiment, "Key releases" (auto /
  off): with it on, a terminal that supports the kitty keyboard protocol tells the game exactly when a
  key is pressed, repeated and let go, so a tap is a tap and a hold is a hold without guessing; off, the
  game guesses from the timing, as before.

**Scheduled:** a dedicated session to polish navigation again, as he asked (`docs/next-steps.md`).

### F80 — The Battle Round screen breathes

> Battle Round start popup. Also needs to be more "flashy", try a pulse effect on the border, it doesn't
> need to be intense, just relaxing turning a but lighter and darker to create dynamism

**Open.** The Battle Round screen's border slowly turns a little lighter and a little darker, like
breathing. A new Experiment, "Battle Round pulse", sets how long one breath takes (off for a still
border). Reduced motion keeps it still.

### F81 — His third settings export

> Preferred settings:

```
Terminal Nexus settings
# build 546de47
# Changed experiments
focusArrowMs = 250  # Focus arrow, default 180 ms
cardRevealMs = 400  # Card reveal, default 150 ms
holdWindowMs = 250  # Hold window, default 350 ms
crew = some  # Your units, default none
# Settings
theme = dark  # Background
capability = truecolor  # Colour depth
glyphPack = unicode  # Symbols
reducedMotion = off  # Reduced motion
# Experiments at their defaults
raid = heavy  # Raid
```

**Built.** The focus arrow (250 ms) and the card reveal (400 ms) are settled: they leave Settings for
the table of tuned values, with who chose them and when, and an older export that names them is read
without a word. "Your units: some" is the placeholder Pulse's default, beside the heavy raid; both stay
Experiments until the real mission replaces them. The hold window is the one value not taken from the
export: his words the same day asked to try 200 ms with the new tap counting (F79), so 200 is the
default and 250 is one step to the right.
