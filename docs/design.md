# Miflo Design System (Skin 1)

The canonical spec for the app's look and feel. Colors live in
`src/theme/colors.ts`, typography in `src/theme/typography.ts`, motion in
`src/core/ui/`. If this document and the code disagree, fix one of them.

---

## 1. Principles

**1. Elevation is expressed with brightness, not shadow.**
In dark mode shadows do not work: you cannot make anything darker than a
near-black background. So the closer a surface is to the user, the lighter it
is. Light conceptually comes from above.

**2. Borders are always lighter than the surface, never darker.**
An edge catches light. A dark border on a dark card looks like a mistake.
Only one step lighter, not two.

**3. Never skip a step.**
A card goes from surface-1 to surface-2 when it lifts. It does not jump to
`#333333`. Every layer is exactly one step above the one beneath it.

---

## 2. Color

### Elevation ladder

| Step | Hex | Used for |
|---|---|---|
| `background` | `#121212` | The screen itself. The zero point everything else is measured from. |
| `surface` (surface-1) | `#1A1A1A` | Answer options, leaderboard cards, question cards, input fields. |
| `surface2` (surface-2) | `#222222` | Bottom sheets, dropdowns, tooltips, the timer pill, avatar fallback, a card lifted on long-press. |
| `divider` (border) | `#262626` | The standard hairline on cards, and dividers between leaderboard rows. Dividers inside a card use the same border color as the card's own edge, never a darker one. |

### Text

| Token | Hex | Used for |
|---|---|---|
| `textPrimary` / `ink` | `#F5F5F5` | Headings, primary copy. `ink` is the same value for icons, headlines and stat values (the strongest neutral, NOT the brand). |
| `textSecondary` | `#A3A3A3` | Supporting copy, subtitles. |
| `textTertiary` / `muted` | `#6E6E6E` | Meta, captions, placeholders. |

### Brand

| Token | Hex | Used for |
|---|---|---|
| `primary` | `#6260FF` | The primary button fill, progress fill, selected answer, active tab. Also the border on anything active or selected, and the border on secondary buttons. |
| `primaryInk` | `#8583FF` | One step lighter, for small accent text that needs to read on dark. |
| `onInk` | `#F5F5F5` | Text and icons on top of a brand fill. |

### Game feedback (DRAFT, awaiting on-device sign-off)

Right / close / wrong need real hues; a gray guess grid is unplayable. These
are tuned for the `#121212` ground and are trivially swappable tokens:

| Token | Hex | Meaning |
|---|---|---|
| `guessHit` / `success` | `#4FB477` / `#3FD07C` | Right. |
| `guessNear` | `#E0A94A` | Close. |
| `guessMiss` | `#3A3A3A` | Wrong. Neutral dark gray so misses recede instead of shouting. |
| `error` | `#FF6A61` | Wrong / destructive. |
| `info` | `#5B9CFF` | Neutral informational accent (toasts). |
| `timer` | `#3FD07C → #7ED99A → #F5C451 → #F2913D → #FF6A61` | The 5-stop countdown ring, green to red. |

### Everything else

Frosted chrome (the nav pill, the top status fade, toasts) uses faint white
translucency over the dark ground so the blur shows through: fills at 6 to 10
percent white, rims at 14 to 18 percent white (rims lighter than fills, per
principle 2). Scrims are black at 35 to 60 percent. Shadows exist only for
truly floating chrome; cards never carry shadow (principle 1). One theme-fixed
exception: QR codes are always black modules on a white card, because scanners
need dark-on-light.

Read colors through `useColors()` / `useThemedStyles()`. Never hardcode hex in
a component and never use the static `import {colors}` in new code.

---

## 3. Typography

Typeface: **Satoshi**. Only Regular (400) and Medium (500) are bundled. Never
bold; emphasis comes from size and color. The scale is deliberately thin.

| Variant | Weight | Size / line height | Tracking | Used for |
|---|---|---|---|---|
| `hero` | Regular | 34 / 41 | -0.6 | Oversized landing moments only. |
| `title` | Regular | 28 / 34 | -0.5 | Big screen moments only. |
| `wordmark` | Medium | 20 / 25 | -0.3 | The top-bar wordmark and page headers. |
| `section` | Regular | 17 / 22 | -0.2 | Content section headings. |
| `body` | Regular | 16 / 21 | 0 | Body copy. |
| `label` | Medium | 15 / 20 | 0 | Button and control labels. |
| `secondary` | Regular | 13 / 18 | 0 | Smaller supporting copy. |
| `caption` | Regular | 12 / 16 | 0 | Captions and meta. |

Rule: nothing in regular chrome goes above `wordmark` (20). `hero` and `title`
are reserved for deliberate moments, like the welcome tagline or a party code
reveal. Use `<Text variant="...">` from `src/core/ui/Text.tsx`.

---

## 4. Motion and interaction

### The press zoom

Every tappable thing shares one interaction language: a springy shrink.

- Press-in: scale to **0.96**, opacity to **0.9**. Press-out: back to 1.
- Duration **200ms**, easing **cubic-bezier(0.34, 1.25, 0.64, 1)**. The
  control point above 1 gives the springy settle.
- Honors Reduce Motion: opacity only, scale pinned to 1.
- Implementation: `src/core/ui/usePressScale.ts`, consumed through `Button`
  and `PressableScale`. Never use a bare `Pressable` for a control, and never
  wrap a whole screen in one (it steals presses).
- The bottom nav island zooms as one piece: pressing any tab scales the whole
  pill, not just the icon.

### The swipe reveal

Mail-style swipe-right on rows (friend cards, game tiles):

- The row slides right up to **72pt** (plus 16pt of overdrag) and a **48pt**
  circle action fades in on the left, proportional to the drag.
- Release past halfway, or a flick faster than 300, opens it; otherwise it
  snaps shut. Settle is a spring (speed 20, bounciness 4).
- Only one row is open app-wide (the Mail model). Starting a drag on another
  row, scrolling, or tapping the open row closes it.
- Destructive actions tint the icon and caption with `error`.
- Implementation: `src/core/ui/SwipeReveal.tsx`. Inside a scroll view, pass
  `scrollRef` so the pan wins over the scroll recognizer, and call
  `closeOpenSwipeReveal()` from `onScrollBeginDrag`.

### The scroll-fade top

Page titles are part of the content, not a fixed bar:

- The title (`wordmark` variant) is the first child inside the ScrollView, so
  it slides up and off as you scroll.
- A pinned `TopStatusFade` (a real backdrop blur, gradient-masked to fade to
  nothing at its bottom edge) sits behind the status bar, so content dissolves
  under it with no hard seam.
- Persistent controls (back, help) are floating corner circle buttons on a
  transparent bar; they stay put while the title scrolls away.
- The bottom nav island is the one deliberately frosted surface besides the
  top fade.

### The boot loader

On app open the brand ball draws the m: it travels the letter as a pen tip
(up the stem, over both humps, bouncing back up the middle leg), the stroke
appearing behind it, then hops off the short right leg and settles into its
period spot. About 1.8 seconds total; Reduce Motion shows the finished mark
instead. Implementation: `src/core/ui/BootSplash.tsx`, geometry shared with
the app icon (`scripts/generate-app-icon.mjs`). The native launch screen is a
plain `#121212` frame so the animation owns the reveal.

### Haptics

Semantic wrapper in `src/core/haptics`: `tap` on press, `success` / `warning`
/ `error` on outcomes. Buttons fire `tap` automatically.

---

## 5. Component rules

- **Selected or active state**: a `primary` border on the element, one step
  brighter fill only if the element lifts (surface-1 to surface-2).
- **Primary button**: solid `primary` fill, `onInk` label, flat. One primary
  button per screen.
- **Secondary button**: surface fill with a `primary` border.
- **Long-press lift**: the held card moves from surface-1 to surface-2.
- **Cards**: surface-1 fill, `divider` hairline, `radii.card` (16). Pills are
  fully round.
- **No shadow on cards or buttons.** Elevation is brightness (principle 1).
