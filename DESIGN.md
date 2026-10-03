---
name: HabitFlow
description: The day sheet on a colored desk — tear-off calendar pages you stamp, laid on riso-printed desks you can swap.
colors:
  ground: "oklch(0.965 0.006 266)"
  sheet: "oklch(0.995 0.002 266)"
  well: "oklch(0.94 0.008 266)"
  rule: "oklch(0.9 0.01 266)"
  rule-strong: "oklch(0.8 0.015 266)"
  ink: "oklch(0.2 0.025 266)"
  ink-2: "oklch(0.43 0.025 266)"
  ink-3: "oklch(0.62 0.02 266)"
  pen: "oklch(0.49 0.21 266)"
  pen-soft: "oklch(0.92 0.04 266)"
  red: "oklch(0.57 0.2 30)"
  red-soft: "oklch(0.94 0.035 30)"
  binding: "oklch(0.24 0.03 266)"
  dark-ground: "oklch(0.17 0.015 266)"
  dark-sheet: "oklch(0.215 0.018 266)"
  dark-ink: "oklch(0.95 0.008 266)"
  dark-pen: "oklch(0.72 0.15 266)"
  dark-red: "oklch(0.7 0.17 30)"
typography:
  display:
    fontFamily: "Big Shoulders Display Variable, sans-serif"
    fontSize: "168px"
    fontWeight: 900
    lineHeight: 0.9
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Big Shoulders Display Variable, sans-serif"
    fontSize: "56px"
    fontWeight: 800
    lineHeight: 0.9
  title:
    fontFamily: "Source Sans 3 Variable, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 700
  body:
    fontFamily: "Source Sans 3 Variable, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "JetBrains Mono Variable, monospace"
    fontSize: "13px"
    fontWeight: 400
rounded:
  control: "10px"
  sheet: "14px"
  dialog: "16px"
  pill: "9999px"
spacing:
  row-y: "14px"
  row-x: "20px"
  section: "32px"
components:
  button-pen:
    backgroundColor: "{colors.pen}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  button-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  button-line:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  field:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  sheet:
    backgroundColor: "{colors.sheet}"
    rounded: "{rounded.sheet}"
  pill-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.pill}"
---

## Overview

**Creative north star: the day sheet on a desk.** Every screen is built from the objects of paper habit-keeping: a page-a-day tear-off calendar, ballpoint ink, rubber date stamps, tally marks, the red-disc classroom Time Timer, passport stamps. Light mode is the identity (paper under daylight); dark mode is the same sheet read at night. The signature moment is the **stamp**: checking a habit presses an ink disc with a rough rubber edge and a slight, per-day tilt. A finished day gets an **ALL DONE** stamp across the calendar page.

The pages lie on a **desk**: a saturated, riso-printed surface with a printed pattern and cut-paper shapes that overprint (multiply) like riso ink. The desk is a user-selectable template (Settings → Appearance → Desk); sheets stay paper-white on every desk so reading never suffers.

## Colors

Committed strategy on the ground, restrained on the paper.
- **Desks** (`client/src/lib/desks.ts`) are full templates. Each sets ground hue/chroma/lightness, a printed pattern, three shape inks `d1 d2 d3`, a highlighter `hl`, its own pen and binding. All neutrals (sheet, well, rule, ink ramp) are derived from the desk hue in `deskTokens()` for light and dark.
  - Redemption arc (default, always dark): warm charcoal ground, manga focus lines converging on the content, a blood-red rising sun, slash marks, amber rank-up chevrons; ember pen, blood-red calendar binding.
  - Riso print: pink ground, halftone, riso blue / yellow / orange-red.
  - Pool day: aqua, waves, coral / lemon / deep blue.
  - Allotment: leaf green, seed rows, tomato / marigold / forest.
  - Marigold: hot yellow, graph grid, violet / pink / tomato.
  - Lilac: violet, plus marks, lime / orange / indigo.
  - Plain paper: the quiet original, no shapes.
- Light grounds sit at L 0.85–0.89 with chroma ≥ 0.075, so ink text stays ≥ 4.5:1 directly on the desk. Dark desks drop to L 0.2 with the same hue; shapes fall to 34% and screen-blend.
- `pen` is the desk's pen unless the user picks an ink (Settings → Ink). `red` stays the teacher's red pen for streaks, Sundays, slips and ALL DONE.
- `hl` (highlighter) marks the current nav tab, page titles and key Insight numbers; in dark mode it becomes a translucent pen tint.
- Data viz uses fixed palettes independent of the desk: mood runs red → green; categories use six distinct inks.

## Typography

- **Big Shoulders Display** (condensed, calendar/scoreboard numerals) for dates, counts, streak numbers, page titles. Used big and sparingly; never for body.
- **Source Sans 3** for everything read or operated.
- **JetBrains Mono** only for measurements: times, dates, weekday letters in data strips.
- Numbers in running prose (Insights) are set inline in the display face at ~1.35em.

## Layout

- Max content width 1180px; desktop top bar with text tabs and a highlighter swipe on the active tab; phone has a flat bottom tab bar (5 destinations, active icon on a highlighter pill) and a header with New habit + account.
- Today: sticky day sheet column (340px) beside the ledger on desktop; on phones the sheet goes landscape (date left, progress right) above the ledger.
- Lists are **ledgers**: rows inside one sheet separated by `rule`, never stacked cards.

## Elevation & Depth

Paper depth only: `sheet` surfaces carry a 1px bottom rule plus one soft, offset shadow (`0 12px 32px -20px`). Dialogs and popovers get a larger soft shadow. No glow, no glass, no colored halos.

## Shapes

10px controls, 14px sheets, 16px dialogs and the day sheet, full pills for filters and chips. Stamps and progress marks are circles; the stamp slot is a dashed ring that fills from the bottom like an ink level for count habits.

## Components

- **Desk** (`DeskBackground`): fixed layer behind everything: pattern (CSS mask over `--pattern-ink`) plus five cut-paper shapes at the edges (disc, half, burst, ring, squiggle, asterisk, leaf, wave, sun, arch, star). Shapes drift (CSS, 18–40s) or spin slowly, parallax on scroll, and swap with a staggered scale-in when the desk changes. Desk switches use a View Transition circle wipe from the tap point.
- **Character sheet** (`CharacterSheet`): five attributes with fixed colors (Strength red, Intellect blue, Vitality green, Discipline amber, Presence pink), each fed by habit categories; level n needs n² completions; 10-segment game-style bar. On Today (after the ledgers) and at the top of Insights.
- **Arc counter**: "Day N of your arc. Week W." under the greeting, counted from the earliest habit start date.
- **Washi tape** (`Tape`): translucent striped strip with torn ends, taped across the day sheet's top corners and the sign-in demo page.
- **Highlighter** (`Highlight`): marker swipe behind text, scales in from the left once; text is always visible.
- **Scribble**: hand-drawn underline under the user's name, draws itself once.
- **Ink burst** (`InkBurst`): ink flecks + ring thrown off when a stamp lands; the row then washes with the habit's ink (9%) left to right.

- **Stamp** (`StampMark`): filled disc in the habit's ink, knocked-out tick, `#ink-rough` SVG filter (displacement edge + speckle), seeded tilt between -14° and 14°. Press animation: scale 1.45→1, opacity 0→1, 320ms ease-out-expo.
- **Stamp slot** (`StampSlot`): dashed ring; ink level for partial counts; "+1" label for count habits.
- **Tally**: groups of five strokes, the fifth struck; done strokes in habit ink.
- **Day sheet**: binding header (month, year), perforation, huge date numeral (flips in on rotateX), weekday, "n of m done", one stamp per due habit, week strip of ink-filled discs.
- **Seal** (achievements): double ring, title on a circular text path, tier name below, drawn icon in the center; locked seals are dashed and grey.
- **Dial** (focus): Time Timer face, red sector unwinds counter-clockwise toward 12.
- Icons: Lucide, stroke 2, one family everywhere. Habit icons are stored by name.

## Do's and Don'ts

- Do keep every mark ink-like: flat fills, rough edges where it's a stamp, no gradients.
- Do put the date and counts in the display face; keep UI copy in Source Sans.
- Do write copy in plain sentences ("3 left to go", "Rest day", "Cover with a streak freeze").
- Don't use cards for list items, glass/blur surfaces, gradient text, glow shadows, or emoji as icons.
- Don't add eyebrow/kicker labels above headings.
- Motion vocabulary: the stamp press + ink burst + row wash, the day flip and counter roll, highlighter swipes, desk shapes drifting, ledger rows settling in (≤ 8 staggered), page sheets sliding up 18px. Everything has a reduced-motion path (shapes stand still, wipes become instant).
- Don't put desk shapes behind titles or greeting text; keep them at the viewport edges or tucked behind sheets.
