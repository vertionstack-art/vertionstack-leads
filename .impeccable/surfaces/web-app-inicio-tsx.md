---
version: 1
slug: "web-app-inicio-tsx"
primary_target: "web/app/inicio.tsx"
related_targets: ["web/app/page.tsx"]
---

# Página de venda (início público)

Scope: `/` for logged-out visitors (logged-in still get the painel). Mode: Persuade.
Audience: freelancers who build websites and need clients; arrive cold from social/ads/word of mouth, often on a phone.
Job: understand in seconds what the tool finds, believe it saves the hunting hours, start the free trial (30 leads, no card).
Proof on hand: none (no customers, testimonials, metrics). Only product truth: the classification rules, temperature reasons, proposal-opened badge, CRM, Financeiro, plan numbers from lib/planos.ts. Demo rows are synthetic and labeled "exemplo".
Owner brief (10/10/2026): "estratégica, que desperte o desejo, explicativa sem enrolar, que todos possam entender facilmente". Owner delegated the structure choice.

## Direction contract

THESIS: The page owns one idea: Instagram, iFood and a free builder are not "has a site", they are your next client. It refuses the SaaS template of headline + screenshot + three icon cards.

OWN-WORLD: The Pastel Ledger. Lavender floor, one huge white sheet (28px), black pills as the only verbs, the presence-digital bar (tinta / roxo-600 / roxo-400 / roxo-200 / hollow) as the signature graphic, rosa/manteiga/lavanda only for temperature, Manrope 800 with tight tracking, tabular counts.

STORY: Visitor sees who counts as a client, sees that each lead comes ranked hot/warm/cold with the reason to use in the pitch, follows one lead to a closed sale in five steps, sees the price next to one site sold, starts the free trial.

FIRST VIEWPORT: Slim top bar (brand tile + Entrar + black "Testar grátis"). Left 7 cols: 56-72px headline, one-line sub, black pill "Testar grátis com 30 leads" + "sem cartão". Full sheet width below: the presence bar at hero scale (~72px tall) with each segment labeled and a one-line "por que é cliente" under each; "Tem site" hollow and struck as the only non-client.

FORM: Structure 7 of 7 ("A barra da oportunidade"), raised with the demo lead list from structure 1 and the five-step journey from structure 2; seed key 0dc205bd. Code-led (no image generation).

Signature interaction: hovering/tapping a bar segment highlights its explanation and the matching demo rows. Motion: one staggered fill of the bar on load, respecting reduced motion.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Seed evidence (verbatim concept-seed output): "SURFACE CONCEPT SEED (key: 0dc205bd; mode: persuade; source: api; approved pool: c3b204a1eed6) DEALT INDICES: 7, 1, 2 (index 7 leads)". Owner answered the text fallback with "quero a melhor opção"; dealt lead built.
Finish review: round 1 fix (8 items), round 2 fix (7 resolved, 1 partial + 2 regressions), final batch applied 10/10/2026 (dimmed labels kept at full ink, Site fraco roxo-300 edge on sky, 44px filter chips on mobile). Adaptations: headline 72px, single-sentence sub, step-1 search scene inert (cadastro does not read ramo/cidade).
