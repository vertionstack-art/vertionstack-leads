---
version: 1
slug: "web-app-painel-tsx"
primary_target: "web/app/painel.tsx"
related_targets: ["web/app/login/page.tsx","web/app/lead-card.tsx"]
---

# Surface: painel (lead workspace)

Scope: `web/app/painel.tsx` and its pieces (lead-card, modals' shells), plus `/login`. Visitor mode: **Operate**. Task: find the hottest lead, act on it (queue, copy, design, proposal), keep the list clean. Frequency: daily, long sessions on desktop; quick checks on the phone before a call. Constraint: every existing function, label and rule stays; only the presentation is replaced.

## Direction contract

THESIS: A calm, card-based "overview" dashboard (user-pinned reference image, 2026-10-03) replaces the dense admin-table look: the lead pipeline reads like a portfolio — one wide summary card, three pastel temperature cards, then the market-style lead table. Refuses the gray SaaS admin with a toolbar of 9 equal buttons.

OWN-WORLD: Cool lavender ground (#eceaf5); black rounded side rail with white line icons; content on one large white sheet, 28px radius. Pastel fields carry meaning: rose = quentes, butter = mornos, lavender = frios, mint = fila/oportunidade. Black is the action color (pills, primary buttons, the dark action card); Vertion purple marks selection and focus. Manrope throughout, extra-bold headings, tabular numerals. Black rounded-square monograms stand in for logos in the table.

STORY: The user lands, sees how many opportunities exist and how they split by digital presence, clicks a temperature card to narrow, and works the table row by row.

FIRST VIEWPORT: Rail left. Sheet: "Visão geral" 32px extrabold + search pill + user chip at top. Row 1: "Oportunidades" heading; wide pale-sky card (number 40px, split bar by tipo, legend) | "Temperatura" heading; three pastel cards. Row 2: "Leads" heading with filter pills right | dark action card (Conferir sites / Fila / Extensão).

FORM: pinned by user reference — brief-pinned direction beats the roll; no concept-seed run (pinned). Code-led: no native image generation in this harness.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
