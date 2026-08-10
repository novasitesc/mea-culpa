# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**MudHakar** is a Next.js 15 online RPG platform with a dark medieval fantasy aesthetic. Players create and manage D&D-style characters, trade items, join guilds and parties, and participate in game systems (roulette, dice, shops). Premium features are monetized via PayPal.

## Commands

```bash
npm run dev        # Start dev server at http://localhost:3000
npm run build      # Production build
npm run lint       # Run ESLint
npm run test:db    # Run database tests via tsx database/test.ts
```

No unit test framework (Jest/Vitest) is configured. The only test script targets database integration.

## Architecture

### Stack
- **Next.js 15** with App Router — all pages and API routes live under `/app`
- **Supabase** (PostgreSQL + Auth) — browser client in `lib/supabase.ts`, server singleton in `lib/supabaseServer.ts`
- **TypeScript** strict mode, path alias `@/*` maps to repo root
- **Tailwind CSS 4** with a custom medieval dark theme (OKLch color space, custom tokens like `gold`, `blood`, `parchment`)
- **Radix UI + shadcn/ui** for accessible component primitives (`/components/ui/`)
- **PayPal** sandbox integration for premium purchases

### Authentication Flow
- `lib/useAuth.ts` — the primary auth hook; tracks session and hydrates the user profile from Supabase on `onAuthStateChange`. Components call this hook; they do **not** call Supabase auth directly.
- `lib/apiAuth.ts` — extracts and validates Bearer JWT tokens in API routes. Every protected API route calls `getUserFromRequest(req)` to authenticate.
- Admin gates check `es_admin` or `rol_sistema === 'admin'` on the profile row. Use `lib/adminAuth.ts` helpers for this.
- Session refresh is triggered by dispatching `window.dispatchEvent(new Event("auth:refresh"))`.

### API Routes Pattern
All API endpoints live under `/app/api/`. They follow Next.js Route Handler conventions (`export async function GET/POST/PUT/DELETE`). The server-side Supabase client (service role) is always imported from `lib/supabaseServer.ts` — never instantiate a new client inside a route.

Route groupings:
- `/api/admin/*` — admin-only operations (characters, users, shops, taxes, roulette config)
- `/api/profile/*` — character creation, equipment, items, spells, sleep options
- `/api/partidas/*` — party/game session management
- `/api/comercio/*` — peer-to-peer trading marketplace
- `/api/gremio/*` — guild system
- `/api/ruleta/*` — roulette spins and configuration
- `/api/tiendas/*` — shop browsing and purchases
- `/api/dados/*` — dice rolling
- `/api/paypal/*` — order creation, capture, and webhook verification
- `/api/spells/*` — spell registry
- `/api/notas/*` — character notes
- `/api/noticias/*` — homepage news/announcements

### Character & Game Systems
- Characters support up to 3 simultaneous classes with D&D stats (STR/DEX/CON/INT/WIS/CHR).
- Equipment slots: 5 armor, 6 accessories, 2 weapons. Bag capacity is derived from STR modifier.
- Type definitions live in `lib/types/character.ts` (character classes, stats, equipment, bag) and `lib/types/dados.ts` (dice types).
- Item catalog is defined in `lib/item-catalog.ts`; spell entries in `lib/spells.ts`.
- Character life/death/revival logic is centralized in `lib/characterLife.ts`.
- Gold currency operations go through `lib/goldService.ts`.

### Roulette & PayPal
- `lib/roulette.ts` — wheel logic, 100 slots, cost cycles, prize tier calculation.
- `lib/paypal.ts` — order creation/capture and cryptographic webhook signature verification.
- Premium flows: roulette spins, character slot unlocking, character revival.

### Styling Conventions
- Tailwind utility-first; custom medieval tokens used via CSS variables (e.g., `text-gold`, `bg-blood`, `text-parchment`).
- Fonts: **Cinzel Decorative** for headings, **MedievalSharp** for decorative text, loaded in root `app/layout.tsx`.
- Dark theme by default — no light mode toggle.

## Environment Variables

Required server-side secrets: `SUPABASE_SERVICE_ROLE_KEY`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`.  
Required public vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_PAYPAL_CLIENT_ID`.

No `.env.example` exists — check `.env` for the current shape.
