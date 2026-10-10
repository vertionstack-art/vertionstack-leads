---
name: Vertion Leads
description: A lead workspace for website freelancers, laid out like a calm overview dashboard on a white sheet.
colors:
  tinta: "#0b0b0f"
  tinta-70: "#3f3f46"
  chao: "#eceaf5"
  sheet: "#ffffff"
  roxo-50: "#f5f3ff"
  roxo-100: "#ede9fe"
  roxo-200: "#ddd6fe"
  roxo-300: "#c4b5fd"
  roxo-400: "#a78bfa"
  roxo-500: "#8b5cf6"
  roxo-600: "#7c3aed"
  roxo-700: "#6d28d9"
  roxo-900: "#4c1d95"
  ceu: "#dfeafb"
  rosa: "#fbe1e1"
  manteiga: "#f7efcb"
  lavanda: "#e8e3fa"
  menta: "#d9f0e0"
  neutral-100: "#f4f4f5"
  neutral-200: "#e4e4e7"
  neutral-300: "#d4d4d8"
  neutral-500: "#71717a"
typography:
  display:
    fontFamily: "Manrope, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "44px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.03em"
    fontFeature: "tnum"
  headline:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "32px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.625
  label:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "normal"
  caption:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.375
rounded:
  monogram: "12px"
  field: "16px"
  card-compact: "22px"
  card: "24px"
  rail: "26px"
  sheet: "28px"
  pill: "9999px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  sheet-x: "36px"
components:
  button-primary:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.sheet}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.tinta-70}"
  button-secondary:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.tinta}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 20px"
    height: "44px"
  row-action-pending:
    backgroundColor: "{colors.neutral-100}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.pill}"
    padding: "6px 8px"
  row-action-done:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.pill}"
    padding: "6px 8px"
  input-search:
    backgroundColor: "{colors.neutral-100}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.pill}"
    padding: "0 16px 0 40px"
    height: "44px"
  select-filter:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.tinta}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "8px 36px 8px 16px"
    height: "40px"
  textarea:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.field}"
    padding: "8px 12px"
  chip-neutral:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.tinta}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  card-summary:
    backgroundColor: "{colors.ceu}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.card}"
    padding: "24px"
  card-temperature-quente:
    backgroundColor: "{colors.rosa}"
    rounded: "{rounded.card}"
    padding: "20px"
  card-temperature-morno:
    backgroundColor: "{colors.manteiga}"
    rounded: "{rounded.card}"
    padding: "20px"
  card-temperature-frio:
    backgroundColor: "{colors.lavanda}"
    rounded: "{rounded.card}"
    padding: "20px"
  card-action-dark:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.card}"
    padding: "20px"
  button-on-dark:
    backgroundColor: "{colors.ceu}"
    textColor: "{colors.tinta}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "40px"
  rail:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.rail}"
    width: "80px"
  sheet:
    backgroundColor: "{colors.sheet}"
    rounded: "{rounded.sheet}"
    padding: "32px 36px"
  monogram:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.monogram}"
    size: "40px"
---

# Design System: Vertion Leads

## Overview

**Creative North Star: "The Pastel Ledger"**

A working ledger dressed as a calm overview. A cool lavender floor holds one large white sheet; a black rounded rail stands to its left. On the sheet, the pipeline reads top-down like a portfolio summary: one wide pale-sky card with the opportunity count and a presence-digital bar, three pastel temperature cards, then the lead table worked row by row. It is built for long desk sessions and quick checks on the phone before a call, so density lives in the table and calm lives above it.

Color carries meaning, not mood. Each pastel field has exactly one owner, black is the verb, and Vertion purple is the brand's quiet signature: the monogram, the presence ramp, selection inside forms, and focus. Everything a hand touches is a pill. Type is Manrope throughout, extra-bold for headings and big numbers, sentence case everywhere.

This world replaces the gray SaaS admin with a toolbar of equal buttons. Actions are grouped where they are used (the dark action card, the row actions), never lined up as a strip of same-weight controls.

**Key Characteristics:**
- Lavender floor, white sheet (28px), black rail (26px), cards (24px).
- Pastel fields with fixed semantic owners; neutral chips with a colored dot.
- Black is the action color and the "done" state; purple marks brand, selection and focus.
- Pills for every button, select and single-line input.
- Manrope extra-bold headings, tabular numerals for every count.
- Lucide line icons only.

## Colors

A white-purple-black brand palette set on a cool lavender floor, with five pastel fields that each mean one thing.

### Primary
- **Ink Black** (tinta): the action color. Primary buttons, toggled filter pills, the selected temperature card ring, row actions once done, the rail, the dark action card, the table monograms. Hover deepens to **Ink 70** (tinta-70) on black buttons.

### Secondary
- **Vertion Purple ramp** (roxo-50 to roxo-900): brand and selection. roxo-200 fills the "V" brand tile and the user avatar and is the text-selection color; roxo-600 is the global focus outline (2px, 2px offset); roxo-500/600 borders and roxo-50 fills mark the chosen option inside form choice groups; roxo-600 / roxo-400 / roxo-200 are three steps of the presence-digital bar.

### Tertiary (pastel fields)
- **Pale Sky** (ceu): the opportunities summary card only.
- **Rose** (rosa): temperature "quente" only (card and chip).
- **Butter** (manteiga): temperature "morno" only.
- **Lavender** (lavanda): temperature "frio" only.
- **Mint** (menta): money and confirmed good news only (10/10/2026): the "Proposta aberta" badge, "pagamento recebido", and the result panel of the sales-page calculator. Text on mint is emerald-950.

Chip text on pastel uses the matching deep tone (red-900 on rose, amber-900 on butter, roxo-900 on lavender).

### Neutral
- **Lavender Floor** (chao): page background behind the sheet. Cool, never gray.
- **Sheet White** (sheet): the working surface, chips, modals.
- **Zinc 100** (neutral-100): search and login inputs at rest, pending row actions, menu hover.
- **Zinc 200 / 300** (neutral-200, neutral-300): hairline borders on outline pills, selects, chips, inputs.
- **Zinc 500** (neutral-500): table headers, secondary meta text.

### Named Rules
**The Fixed Owner Rule.** Every pastel field belongs to one meaning: rose, butter and lavender are temperature (quente, morno, frio); pale sky is the opportunities summary and the primary pill on the dark card; mint is reserved. A pastel never appears as decoration or as a generic alert color.

**The Ink Is the Verb Rule.** If it acts, it is black. A row action is gray (zinc-100) while pending and turns black with a lucide Check when done. Purple never fills an action button.

**The Dot Carries the Color Rule.** Presence-digital and status chips are neutral (white, zinc-200 ring); only a 8px dot is colored. Presence dots match the summary bar exactly: Sem site tinta, Só rede social roxo-600, Só marketplace roxo-400, Site fraco roxo-200, Tem site hollow (white with a zinc-300 ring).

## Typography

**Display Font:** Manrope (via next/font, weights 400-800), with ui-sans-serif, system-ui, Segoe UI fallback
**Body Font:** Manrope
**Label/Mono Font:** Manrope for labels; the system monospace only inside the prompt textarea, where the content is a prompt to be pasted.

**Character:** One geometric-humanist family doing everything; hierarchy comes from weight (800 for headings and counts, 700 for labels) and tight negative tracking on large sizes, not from a second face.

### Hierarchy
- **Display** (800, 40-44px, line-height 1, -0.03em, tabular): the big counts on the summary and temperature cards (34px on narrow screens).
- **Headline** (800, 32px desktop / 28px mobile, line-height 1, -0.03em): the page title "Visão geral"; login headline at 28px.
- **Title** (800, 19px, -0.02em): section headings (Oportunidades, Temperatura, Leads); 22px on the dark action card; 18px for modal and dialog titles.
- **Body** (500, 13px, line-height 1.625): descriptions, banners, card copy. 13.5-14px inside inputs.
- **Label** (700, 13px, sentence case): button text, card labels, field titles.
- **Caption** (600, 12px): chips, table headers (zinc-500), hints; 11.5px for percentages and secondary meta.

### Named Rules
**The Sentence Case Rule.** Labels are 13px bold in sentence case. No uppercase, letter-spaced labels or eyebrows above headings.

**The Tabular Count Rule.** Every number that counts something uses tabular numerals so columns and cards align.

## Layout

The page is the lavender floor with a fixed black rail (80px wide, inset 12px from the viewport edges) on desktop and a white sheet filling the rest, its own corners rounded and inset 12px. On mobile the rail becomes a floating black bottom bar (22px radius, inset 12px) and the sheet goes edge to edge inside the floor margin.

Sheet padding is 20px mobile, 36px desktop (top 24px / 32px). The header row holds the title on the left and the search pill plus user chip on the right. Below it, sections stack with 32-40px between them:

1. Summary row, two columns on large screens (about 1.1 : 1): the opportunities card left, three temperature cards right, both rows fixed to 236px tall; section headings sit 16px above their cards.
2. Leads row: filters (selects and pills, 6-8px gaps) with a 400px dark action card to the right on extra-large screens.
3. The lead table, full sheet width, rows separated by hairlines, the action column sticky to the right edge. Below md, rows become stacked lead cards.

Spacing runs on a 4px grid with 6, 8, 16, 24 and 32px doing most of the work. Interactive heights are 40px for filters and dense controls, 44px for primary buttons and inputs, 48px on the login form.

## Elevation & Depth

Depth is mostly tonal: floor, sheet and pastel fields separate by color, not shadow. Shadows are soft, ink-tinted (rgba of #0b0b0f), and reserved for things that float above the sheet or need a lift off a pastel.

### Shadow Vocabulary
- **Dialog** (`box-shadow: 0 24px 60px rgba(11,11,15,0.25)`): modals and the confirm dialog, over a tinta/40 scrim.
- **Login sheet** (`box-shadow: 0 24px 60px rgba(11,11,15,0.08)`): the standalone login sheet on the floor.
- **Menu** (`box-shadow: 0 12px 32px rgba(11,11,15,0.14)`): the user dropdown, plus a zinc-200 ring.
- **Floating bar** (`box-shadow: 0 10px 30px rgba(11,11,15,0.25)`): the mobile bottom bar.
- **Lift** (`box-shadow: 0 2px 8px rgba(11,11,15,0.06)`): white icon tiles on temperature cards and the white pill on the sky card (0.08).

### Named Rules
**The Tonal First Rule.** Cards on the sheet are flat. Hover is a 2px rise (translateY) on clickable summary cards, not a bigger shadow.

## Shapes

Generous, consistent rounding with a fixed ladder: the sheet 28px, the rail 26px, cards and modals 24px, compact mobile lead cards and the mobile bar 22px, textareas, panels, banners, icon tiles and the brand tile 16px, table monograms and menu items 12px. Every button, select, single-line input, chip and progress bar is a full pill. Borders are 1px zinc hairlines; there are no hard edges and no offset shadows.

**The Pill Rule.** If it is a button, a select or a one-line input, it is fully rounded. Multi-line fields and containers use the 16px corner.

## Components

### Buttons
Confident and quiet: black or outlined, always pills.
- **Shape:** full pill (9999px).
- **Primary:** tinta fill, white 13px bold label, 44px tall, 20px side padding; hover tinta-70; disabled zinc-300.
- **Secondary:** white with a zinc-300 hairline, ink label; hover darkens the border.
- **On dark:** white/30 outline pills with white bold labels, hover full-white border; the primary pill is pale sky.
- **Destructive:** red-600 fill, only inside the typed-confirmation dialog.
- **Focus:** the global roxo-600 outline, 2px, 2px offset.

### Row Actions
Small pills in a two-column grid at the end of each table row (CONTACT, COPY, DESIGN, PROPOSTA, ENTREGA). Pending: zinc-100 fill, ink text, hover zinc-200. Done: tinta fill, white text, a lucide Check before the label. This gray-to-black shift is the "done" signal; no other color is added.

### Chips
- **Presence and status chips:** white, zinc-200 ring, 12px semibold text, an 8px colored dot (see The Dot Carries the Color Rule).
- **Filter pills on the sky card:** white/60 at rest, white on hover, tinta with white text when pressed.
- **Temperature chip:** the level's pastel with its deep-tone text and a matching ring, next to the lead name.

### Cards / Containers
- **Corner Style:** 24px.
- **Opportunities card:** pale sky, 24px padding, big count, a 12px pill-shaped split bar on white/70, then dot chips.
- **Temperature cards:** rose / butter / lavender, count, bold label, muted hint, a white 44px icon tile and the percentage. Selected: 2px tinta ring with 2px offset.
- **Dark action card:** tinta, white text, faint white line drawing in the corner, outline pills at the bottom.
- **Border:** none on cards; hairlines only on the table, inputs and outline pills.

### Inputs / Fields
- **Search and login inputs:** zinc-100 pill, no border; focus turns white with a 2px roxo-200 ring.
- **Form inputs and selects:** white pill with a zinc-300 (or zinc-200) hairline; focus border roxo-500 plus roxo-100 ring.
- **Textareas:** 16px corners, zinc-300 hairline, same purple focus.
- **Choice groups (briefing, proposal):** pill or rounded options; the chosen one gets a roxo-500/600 border and roxo-50 fill.

### Navigation
- **Rail:** tinta, 80px wide, 26px radius. The roxo-200 "V" tile at top, then 48px icon buttons (16px radius) in white/55; hover white/8 fill; active white/12 fill with full-white icon. Tooltips slide in from the right as small ink pills.
- **Mobile:** the same items in a floating tinta bottom bar with icon over a small label.

### Modals
White, 24px corners, dialog shadow, a header with an 18px extra-bold title and a lucide X close in a round hover pill. Sections separate with zinc-200 hairlines; a context band (roxo-50) may lead the body. Footer holds the primary black pill and an outline secondary.

### Monogram
A 40px black rounded square (12px) with the business initial in white extra-bold stands in for a logo in every table row (44px on mobile cards).

## Do's and Don'ts

### Do:
- **Do** keep each pastel with its owner: rosa quente, manteiga morno, lavanda frio, ceu opportunities summary and the dark-card primary pill; menta money and confirmed good news.
- **Do** make every button, select and single-line input a full pill; give textareas and panels 16px corners, cards 24px, the sheet 28px, the rail 26px.
- **Do** show a row action as zinc-100 while pending and tinta with a lucide Check once done.
- **Do** color only the dot on presence and status chips; keep presence dots identical to the summary bar.
- **Do** use roxo-600 for the 2px focus outline and purple borders/fills for the chosen option in form choice groups.
- **Do** set headings in Manrope 800 with negative tracking, labels at 13px bold sentence case, and counts in tabular numerals.
- **Do** use lucide icons at 16-20px, line style, stroke 2.

### Don't:
- **Don't** use a pastel field for alerts, banners, notes or decoration.
- **Don't** fill an action button with purple; black is the action color.
- **Don't** set labels in uppercase with letter spacing, or put eyebrow text above headings.
- **Don't** use unicode glyphs (arrows, checks, bullets, stars) as icons.
- **Don't** line up a toolbar of equal-weight buttons; group actions where they are used.
- **Don't** use a gray floor; the floor is lavender (chao).
