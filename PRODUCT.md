# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary subscriber (confirmed 2026-10-03): the **freelancer who builds websites** and needs to find clients. Works alone, from a laptop at a desk while prospecting and from the phone in hand at the moment of calling a business. Today the only users are Lucas and his partner (two seats, `USUARIOS`), who use it the same way.

## Product Purpose

Answer one question: "which local businesses still have no website of their own?" — then carry each one from discovery to delivered site. Success is a closed sale: a lead found, approached, shown a preview, sent a proposal, and delivered.

## Positioning

Instagram, WhatsApp, Linktree, iFood, Doctoralia, VivaReal and free builders count as **opportunity**, not as "has a site". A broken site scores hotter than no site, because the owner already paid for one and is losing customers now. The whole pipeline (prospect → preview → proposal → delivery) lives in one tool, built around the preview the seller shows before any price.

## Operating Context

Flow: leads arrive from Google Maps (today via a Chrome extension; planned: searched from inside the panel through a data API) → the panel classifies and scores temperature → "Conferir sites" demotes sites that only exist on paper → CONTACT queues the lead for the local WhatsApp sender → DESIGN builds the briefing and preview prompt → COPY writes the approach around that preview → PROPOSTA prices and produces a PDF/link → ENTREGA publishes the sold site. Manual registration exists for referrals.

## Capabilities and Constraints

- Subscriber uses the **whole path**, same as the owners (confirmed).
- Next.js 16 on Vercel, Neon Postgres; in-memory store when `DATABASE_URL` is absent (local).
- Pricing rules, the four prompts and their wording are owner decisions; design work must not alter them.
- `/admin` has no link anywhere in the panel, on purpose.
- Planned, not built: monthly subscription, accounts/licensing on the server, in-panel lead search.

## Brand Commitments

Vertion Stack palette: white, purple, black. Product name "Vertion Leads". Portuguese (pt-BR) interface, plain language — the owner is not technical.

## Evidence on Hand

No customers, testimonials or metrics to show. Never invent numbers; every figure on screen comes from the database.

## Product Principles

1. The lead list is the product; everything else serves acting on one lead fast.
2. Show why a lead is hot, not just that it is.
3. Irreversible actions stay quiet and confirmed.
4. Works on the phone at the moment of the call.
