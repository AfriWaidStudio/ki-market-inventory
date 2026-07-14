# Enterprise-Grade Upgrade Plan

Goal: take what we've built (auth, SmaiID, scanner, trades, KI chat, operator engine, telegram, risk, analytics) and make it feel like a production product — every backend wired, every worker reachable, observability in place, and shippable.

Below is broken into phases. We do them in order; each phase leaves the app in a working state.

---

## Phase 1 — Backend hardening & data integrity

**Why:** several features read from tables that are only populated when the external worker runs. In Lovable's serverless runtime we have no always-on Node process, so the operator/price loop never fires and KI has nothing to ground on.

Work:
1. Convert `worker/operator-worker.ts` cycle into a **server route** at `/api/public/cron/operator-tick` (signed with `CRON_SECRET`) that:
   - captures market ads from Binance/Bybit/Bitget adapters
   - aggregates 1m/5m/15m/1h/1d candles
   - re-evaluates open positions → writes `ki_position_plans`, `ki_operator_alerts`
   - dispatches queued Telegram alerts
2. Wire **pg_cron** (Supabase) to hit that URL every 30s using the stable `project--{id}.lovable.app` host.
3. Add a **feed health dashboard** row on Settings → Operator: last success per exchange/fiat, consecutive failures, next retry.
4. Backfill missing GRANTs / RLS on any table still marked `RLS off` that shouldn't be (`ki_model_metrics`, `ki_telegram_updates`, `ki_worker_leases`, `market_intelligence_*`). Public read-only aggregates get narrow `TO anon` SELECT; user-scoped stays `TO authenticated`.

## Phase 2 — Auth & identity polish

1. Email delivery: request `RESEND_API_KEY` via `add_secret`, wire real transactional email for signup verification + password reset (currently reset returns a debug URL).
2. Session UX: "remember me", visible active sessions list in Settings with revoke.
3. SmaiID: expose verification history, make the badge clickable → drawer showing what KI checked.
4. Google OAuth: verify redirect allow-list, add Apple as optional.
5. Rate limit `/api/auth/*` routes (in-memory + DB-backed counter table).

## Phase 3 — KI intelligence upgrade

1. Streaming chat already works; add **tool calling** so KI can:
   - `get_live_prices({exchange, fiat, side})`
   - `get_position_plan({trade_id})`
   - `get_feed_health()`
   - `simulate_exit({trade_id, price})`
2. Persist conversations to `ki_conversations` / `ki_conversation_messages` (tables exist, unused).
3. Add message feedback (👍/👎) → `ki_recommendation_feedback` for future fine-tuning signal.
4. Grounding cache: memoize `buildKiGrounding` per user for 15s to cut token cost.

## Phase 4 — MCP server (agent integrations)

Expose the app as an MCP server at `/mcp` using `@lovable.dev/mcp-js` + Supabase OAuth 2.1 so users can connect Claude/ChatGPT/Cursor and let their assistant:
- list open trades / plans / alerts
- fetch current prices and feed health
- create a paper trade
- ask KI a question (delegates to the same orchestrator)

Auth-gated per user; each tool acts as that user via bearer token.

## Phase 5 — Exchange connectivity

1. Encrypt API keys at rest with `APP_ENCRYPTION_KEY` (already provisioned).
2. Real Binance + Bybit REST clients for balance + trade history sync (currently stubbed in `market_inventory_exchange_transactions`).
3. Sync status card on Settings → Exchanges with last run, next run, error surface.
4. Background reconciliation: match exchange transactions to local trades → `market_inventory_transaction_matches`.

## Phase 6 — Notifications & alerts

1. Telegram: finish the two-way bind flow (bot deep-link with one-time code → writes `telegram_connections`).
2. In-app notification center already exists — wire real-time updates via Supabase Realtime channel on `ki_operator_alerts`.
3. Per-user quiet hours + severity filters in Settings.

## Phase 7 — Observability & ops

1. Structured logging helper (`src/lib/log.server.ts`) with request id.
2. Error capture already partially there — add breadcrumb + user id + route to every 500.
3. Health page at `/api/public/health` returning DB, AI gateway, feed status.
4. Admin route `/_authenticated/admin` gated by `has_role('admin')` — shows worker leases, recent alerts, feed health, user count, verification queue.

## Phase 8 — UX polish for "enterprise feel"

1. Global command palette (⌘K) → search trades, jump to routes, run KI query.
2. Consistent empty states + skeleton loaders on every list route.
3. Keyboard shortcuts on trades/scanner tables.
4. Dark theme audit; ensure all tokens semantic (no raw `bg-white`).
5. SEO/head metadata pass on public routes (`/`, `/privacy`, `/terms`, `/safety`, `/auth`).

## Phase 9 — Testing & release readiness

1. Vitest coverage for `operator-engine`, `auth/primitives`, `ki-orchestrator`, price adapters.
2. Playwright smoke: signup → verify → login → create paper trade → open KI chat → logout.
3. Seed script for demo data (behind admin gate).
4. Publish + custom domain check + `og:image` per route.

---

## Technical notes

- **Cron transport**: pg_cron → `net.http_post` to `/api/public/cron/*` with `x-cron-secret` header. Server route verifies via timing-safe compare against `CRON_SECRET` (generated).
- **MCP consent**: uses `supabase--configure_oauth_server` + `/.lovable/oauth/consent` route per `app-mcp-server-authoring`.
- **Realtime**: Supabase channel `ki_operator_alerts:user_id=eq.<uid>` on the client, filtered subscription.
- **Secrets to add**: `CRON_SECRET` (generated), `RESEND_API_KEY` (user), optional `TELEGRAM_BOT_TOKEN` (user).
- **No new frameworks** — stays on TanStack Start + Lovable Cloud.

---

## Suggested execution order for the next few turns

1. Phase 1 (cron + feed health) — unblocks KI grounding.
2. Phase 3 (KI tool calling + persistence) — biggest visible upgrade.
3. Phase 2 (real email) — makes auth production-safe.
4. Phase 7 (admin + health) — gives you a control panel.
5. Phase 4 (MCP), Phase 5 (exchange sync), Phase 6, 8, 9.

Tell me which phase to start with — or say "go" and I'll run Phase 1 immediately.
