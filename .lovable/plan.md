# KI Market Inventory — Consolidation, Wiring & Live Price Intelligence

Goal: stop adding surfaces. Take what exists and make it **actually work end-to-end** — every button, every route, every link, every setting — and give Waides KI **real live prices** from Binance, Bybit, and OKX so it can reason on real data instead of only what the user typed.

Purpose reminder (from your original brief): this is a **personal P2P/arbitrage command center** and intelligence analyst. It tracks trades, explains opportunities, learns from behavior, and never executes real orders. Everything we do here serves that.

---

## Phase 1 — Full audit & repair pass (no new features)

Walk every existing route as a real user, in a browser, signed in, and fix what's broken:

- `/auth` — email/password sign-up, sign-in, Google OAuth round-trip, redirect back to `/dashboard`, session persistence on reload.
- `/dashboard` — every stat card pulls from `analytics.functions.ts` and renders correctly (0-state, 1-trade state, many-trades state).
- `/scanner` — submit price snapshot form works, opportunities list refreshes, KI recommendation badges render, "Mark Bought" creates a trade and lands you on `/trades`.
- `/trades` — Update Price / Mark Closed / Cancel / Ask KI actions all round-trip to DB and invalidate the list.
- `/trades/$tradeId` — timeline, price updates, notes add/save, KI accuracy verdict appears after close.
- `/history` — filters (date, exchange, route, P/L, status) actually filter.
- `/analytics` — every chart renders with real data, empty states are clear.
- `/chat` — Waides KI answers stream, session token attaches, grounding JSON includes trades + alerts + **live prices** (Phase 2).
- `/risk-center` — dismiss works, list refreshes.
- `/journal`, `/search`, `/notifications`, `/wallet`, `/help` — links, empty states, "coming soon" labels honest.
- `/settings` — currency preference saves and is reflected everywhere (`currency.ts` formatter reads it); exchange accounts add/remove; API keys form shows the read-only warning and the audit log entry appears.
- Header/sidebar — every nav link routes, active state highlights, sign-out tears down cache and redirects to `/auth`.
- Legal `/privacy`, `/terms`, `/safety` — footer links reach them.

Fix any hydration errors, 500s, broken invalidations, missing empty states, and mislabeled buttons found along the way.

## Phase 2 — Live price intelligence (auto-fetch, no manual entry required)

Give KI real market awareness. Public P2P endpoints from Binance, Bybit, OKX don't need API keys — they're the same ones the exchange websites use.

- New server function `prices.functions.ts`:
  - `fetchLivePrices({ asset, fiat, side })` — server-side `fetch` to:
    - Binance P2P: `https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search`
    - Bybit P2P: `https://api2.bybit.com/fiat/otc/item/online`
    - OKX P2P: `https://www.okx.com/v3/c2c/tradingOrders/books`
  - Normalize each response to a common shape: `{ exchange, side, price, currency, liquidity_score, merchant_count, merchant_rating, captured_at }`.
  - Insert into existing `market_inventory_price_snapshots` (already scaffolded) so all downstream code keeps working.
- New public server route `/api/public/cron/refresh-prices` (signed with `CRON_SECRET`) that calls the fetcher for the user's watched pairs. Scheduled via pg_cron every 2–5 min.
- `/scanner` gets a "Live" toggle — when on, prices auto-refresh from snapshots instead of requiring manual entry. Manual entry remains as fallback.
- Waides KI grounding in `/api/chat` gets the latest live snapshots injected alongside trades and alerts, so it can answer "what's the spread on Binance→Bybit right now" against real data.
- Add a **freshness badge** on every price ("Live · 42s ago" / "Stale · 6m ago") so nothing looks more certain than it is.
- Store failures in `market_inventory_audit_log` (source: `price_fetch`) so you can see when an exchange endpoint blocks us.

Rate-limit: 1 call per exchange per minute per user. If an exchange 429s or geo-blocks, mark that exchange as "unavailable" in the UI rather than silently failing.

## Phase 3 — End-to-end test pass (Playwright)

Automated flow that proves the whole loop, run headless in the sandbox:

1. Sign up → land on dashboard.
2. Add currency preference in settings → verify it's applied.
3. Trigger a live-price refresh → verify snapshots appear.
4. Open scanner → best opportunity shows → "Mark Bought" → land on trades.
5. Update price on the active trade → Mark Closed → verify actual_profit + KI accuracy verdict.
6. Open `/chat` → ask "how did my last trade do?" → verify the reply cites the real trade.
7. Dismiss a risk alert → verify it disappears.
8. Sign out → verify redirect to `/auth` and cache is torn down.

Screenshot each step under `/tmp/browser/e2e/`. Any red step blocks the phase from being called done.

## Phase 4 — Cross-cutting polish (only after 1–3 are green)

- Consistent empty/loading/error states across every route.
- Every mutation invalidates the right queries (no stale UI).
- Every money value uses the decimal-safe formatter in `currency.ts`.
- Every "estimate" is visibly labeled as an estimate, never a guarantee.
- Mobile layout sweep on the top 5 routes.

---

## Technical details

- No new pages/routes get added in this pass except `prices.functions.ts` and `/api/public/cron/refresh-prices`.
- P2P endpoints called server-side only (CORS + IP diversity). Cloudflare Worker `fetch` is fine.
- pg_cron schedule installed via migration; secret via `generate_secret` for `CRON_SECRET`.
- No exchange API keys required for public P2P data. The existing `market_inventory_api_keys` table stays for future read-only account features.
- Chat grounding stays under 20KB; live prices summarized (latest per exchange/side) before injection.

## Out of scope (still)

- Real order execution, withdrawals, fund movement.
- Auto-buy / auto-sell.
- Third-party paid data providers.

---

Approve this and I'll start with Phase 1 (audit/repair), then Phase 2 (live prices), then Phase 3 (E2E tests). No new product surfaces will be built in this pass.
