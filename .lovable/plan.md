## KI Market Inventory — Full Build

A personal P2P/arbitrage command center for USDT tracking across Binance, Bybit, OKX. **Tracking + decision support only — no real trading, no fund movement, no auto-execute.**

### Stack & auth
- Lovable Cloud (Postgres + Auth + Edge)
- Email/password + Google sign-in (managed)
- Route gate under `src/routes/_authenticated/*`; public `/auth`
- Currency: user-selectable (default NGN ₦), stored per trade + user preference
- Prices: **manual entry** (no external scraping yet); price_snapshots table scaffolded for future sync

### Database (all with RLS `auth.uid() = user_id`, GRANTs to authenticated + service_role)

1. `profiles` — user_id, display_name, preferred_currency, created_at
2. `user_roles` + `app_role` enum + `has_role()` security definer (standard pattern)
3. `market_inventory_trades` — full spec from brief (user_id, asset, amount, buy/sell exchange, prices, fees, expected/actual profit, times, duration_minutes, status enum [active|closed|cancelled], route, confidence_score, risk_score, ki_reasoning, user_notes, currency, timestamps)
4. `market_inventory_price_snapshots` — user_id, exchange, asset, side (buy/sell), price, currency, liquidity_score, merchant_count, captured_at
5. `market_inventory_exchange_accounts` — user_id, exchange, label, is_active
6. `market_inventory_api_keys` — user_id, exchange, key_label, encrypted_key, encrypted_secret, permissions (read_only only), created_at. Encryption via pgcrypto + `APP_ENCRYPTION_KEY` secret (generated). **UI warning: read-only only, no withdrawal/trade perms.**
7. `market_inventory_trade_notes` — trade_id, user_id, note, created_at
8. `market_inventory_daily_reports` — user_id, report_date, total_profit, trade_count, win_rate, avg_duration, best_route (materialized on demand)
9. `market_inventory_risk_alerts` — user_id, severity, message, related_trade_id, created_at, dismissed_at
10. `market_inventory_audit_log` — user_id, action (api_key_created/deleted/synced), metadata, created_at

### Server functions (`src/lib/*.functions.ts`, all `.middleware([requireSupabaseAuth])`)
- `trades.functions.ts`: listActive, listClosed (with filters), getTrade, createTrade (Mark Bought), updatePrice, markClosed (computes actual_profit, duration, updates KI accuracy), cancelTrade, addNote
- `scanner.functions.ts`: submitPriceSnapshot, listCurrentOpportunities (computes spread/fees/net/scores per exchange pair)
- `analytics.functions.ts`: dashboardSummary, profitByDay, profitByRoute, profitByExchange, bestHour, winRate, capitalGrowth, kiAccuracy
- `apiKeys.functions.ts`: listKeys, createKey (encrypt with pgcrypto), deleteKey — all write to audit_log
- `chat.functions.ts`: `askKI` — pulls user's real trades + snapshots, sends to Lovable AI Gateway (`google/gemini-2.5-flash`) with system prompt anchoring answers to actual data; streams response

### Routes
- `/auth` — email/password + Google (managed Lovable OAuth broker)
- `/_authenticated/route.tsx` — integration-managed gate (create with first protected route)
- `/_authenticated/index.tsx` → **Dashboard**: capital, active count, today/week/month/total profit, avg profit, avg duration, best/worst route, win rate, total fees, active risk alerts
- `/_authenticated/scanner` → **Opportunity Scanner**: enter prices per exchange, live spread/fee/net-profit table, KI recommendation badge (buy now / wait / skip / watch) per pair
- `/_authenticated/trades` → **Active Trades table** with Update Price / Mark Closed / Cancel / Ask KI actions
- `/_authenticated/history` → **Trade History** with filters (date, exchange, route, P/L, status, confidence)
- `/_authenticated/trades/$tradeId` → **Trade Detail**: timeline, buy/sell details, all price updates, KI reasoning, notes, profit calc, mistakes detected, KI accuracy verdict
- `/_authenticated/analytics` → charts (recharts) for all analytics metrics
- `/_authenticated/chat` → **KI Chat** grounded in user's data
- `/_authenticated/settings` → currency preference, exchange accounts, API keys (with big read-only warning), audit log viewer

### KI logic (deterministic, in server functions — no ML)
- **Confidence score**: weighted spread% vs fees, liquidity, merchant count, merchant rating
- **Risk score**: inverse of liquidity + merchant reputation + spread volatility
- **Recommendation**: thresholds on net_profit vs fees + confidence
- **KI accuracy on close**: compare expected_profit vs actual_profit; store delta and verdict (accurate / overestimated / underestimated)
- **Mistake detection**: sell below buy, held too long vs avg, fees > profit
- KI Chat answers via Lovable AI Gateway using user's real aggregates as context

### Security
- RLS on every table (owner-only)
- `user_roles` separate table + `has_role()` (no roles on profiles)
- API secrets encrypted via pgcrypto with server-only `APP_ENCRYPTION_KEY`
- Audit log for all key create/delete/sync
- Zod validation on every server function input
- Clear UI warnings on API key form: read-only only, no withdrawal, no trading
- No auto-execute anywhere; buttons labeled "Mark Bought" / "Mark Closed" (tracking only)

### Design
Dark trading-desk aesthetic: near-black bg, cyan/emerald accents for profit, rose for loss, mono numerics (JetBrains Mono), Inter for UI. Card-based dashboard, dense tables, badges for status/confidence/risk.

### Deliverables in this build
- Enable Lovable Cloud + configure Google social auth
- All migrations (tables + enums + GRANTs + RLS + `has_role` + pgcrypto encryption functions)
- Generate `APP_ENCRYPTION_KEY` secret
- All server functions + routes + UI pages listed above
- Sign-in/sign-up page with Google button
- Header with session-aware account menu + sign-out (cache teardown pattern)
- Currency formatter helper + user preference wiring

### Explicitly out of scope (per brief)
- Real order execution, withdrawals, transfers
- Live exchange API polling / auto-sync (schema scaffolded only)
- Auto-buy / auto-sell
