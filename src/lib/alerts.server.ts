/**
 * Alert engine runner (server-only).
 *
 * Gathers the operator's live world — routes, open positions, feed health,
 * recent outcomes — evaluates the rules in alerts.ts, and persists the result
 * as notifications plus risk-centre entries. Runs both on demand (server fn)
 * and unattended (cron), so it takes any Supabase client.
 */

import { computeEconomics, DEFAULT_FEE_PROFILES, profileFor, type FeeProfile } from "./fees";
import { discoverRoutes, type SpreadSample, type VenueQuote } from "./routes";
import { evaluateAlerts, type ActiveTradeSnapshot, type GeneratedAlert } from "./alerts";

// The Supabase JS client is heavily generic; the engine only needs `.from`.
type Db = { from: (table: string) => any };

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function loadFeeProfileMap(db: Db, userId?: string): Promise<Record<string, FeeProfile>> {
  let q = db.from("market_inventory_fee_profiles").select("*");
  if (userId) q = q.eq("user_id", userId);
  const { data } = await q;
  const map: Record<string, FeeProfile> = { ...DEFAULT_FEE_PROFILES };
  for (const r of (data ?? []) as Array<Record<string, unknown>>) {
    map[String(r.exchange)] = {
      exchange: String(r.exchange),
      trade_fee_pct: num(r.trade_fee_pct),
      payment_fee_pct: num(r.payment_fee_pct),
      payment_fee_flat: num(r.payment_fee_flat),
      withdrawal_fee_asset: num(r.withdrawal_fee_asset),
      network: (r.network as string) ?? null,
    };
  }
  return map;
}

export interface AlertRunResult {
  evaluated: number;
  created: number;
  alerts: GeneratedAlert[];
}

export async function runAlertEngine(
  db: Db,
  userId: string,
  opts: { scopeByUser?: boolean; opportunityThreshold?: number } = {},
): Promise<AlertRunResult> {
  const scope = <T>(q: T): T =>
    opts.scopeByUser === false ? q : ((q as any).eq("user_id", userId) as T);

  const since = new Date(Date.now() - 6 * 3600_000).toISOString();

  const [snapRes, tradeRes, feedRes, histRes, closedRes, feeProfiles] = await Promise.all([
    scope(
      db
        .from("market_inventory_price_snapshots")
        .select(
          "exchange, asset, side, price, currency, liquidity_score, merchant_count, merchant_rating, captured_at",
        )
        .order("captured_at", { ascending: false })
        .limit(200),
    ),
    scope(
      db
        .from("market_inventory_trades")
        .select("*")
        .eq("status", "active")
        .order("buy_time", { ascending: false })
        .limit(100),
    ),
    scope(
      db
        .from("market_inventory_feed_status")
        .select("exchange, asset, fiat, status, consecutive_failures, last_success_at, error_message"),
    ),
    scope(
      db
        .from("market_inventory_spread_history")
        .select("buy_exchange, sell_exchange, spread_pct, net_pct, observed_at")
        .gte("observed_at", since)
        .limit(800),
    ),
    scope(
      db
        .from("market_inventory_trades")
        .select("actual_profit, sell_time")
        .eq("status", "closed")
        .order("sell_time", { ascending: false })
        .limit(10),
    ),
    loadFeeProfileMap(db, opts.scopeByUser === false ? undefined : userId),
  ]);

  const snaps = (snapRes.data ?? []) as Array<Record<string, unknown>>;
  const quotes: VenueQuote[] = snaps.map((s) => ({
    exchange: String(s.exchange),
    asset: String(s.asset),
    fiat: String(s.currency),
    side: s.side === "buy" ? "buy" : "sell",
    price: num(s.price),
    liquidity_score: s.liquidity_score != null ? num(s.liquidity_score) : null,
    merchant_count: s.merchant_count != null ? num(s.merchant_count) : null,
    merchant_rating: s.merchant_rating != null ? num(s.merchant_rating) : null,
    depth_asset: null,
    captured_at: String(s.captured_at),
  }));

  const history: SpreadSample[] = ((histRes.data ?? []) as Array<Record<string, unknown>>).map(
    (h) => ({
      buy_exchange: String(h.buy_exchange),
      sell_exchange: String(h.sell_exchange),
      spread_pct: num(h.spread_pct),
      net_pct: h.net_pct != null ? num(h.net_pct) : null,
      observed_at: String(h.observed_at),
    }),
  );

  const trades = (tradeRes.data ?? []) as Array<Record<string, unknown>>;
  const avgAmount = trades.length
    ? trades.reduce((s, t) => s + num(t.amount), 0) / trades.length
    : 1000;

  const routes = discoverRoutes({
    quotes,
    amount: Math.max(100, avgAmount),
    feeProfiles,
    history,
  });

  // Best executable sell price per venue right now.
  const bestSell = new Map<string, number>();
  for (const q of quotes) {
    if (q.side !== "sell") continue;
    const k = `${q.exchange}|${q.asset}|${q.fiat}`;
    if (!bestSell.has(k)) bestSell.set(k, q.price);
  }

  const activeTrades: ActiveTradeSnapshot[] = trades.map((t) => {
    const amount = num(t.amount);
    const buyPrice = num(t.buy_price);
    const sellPrice = num(t.expected_sell_price) || buyPrice;
    const econ = computeEconomics({
      amount,
      buyPrice,
      sellPrice,
      buyProfile: profileFor(String(t.buy_exchange), feeProfiles),
      sellProfile: profileFor(String(t.sell_exchange), feeProfiles),
      sameVenue: t.buy_exchange === t.sell_exchange,
      extraFees: num(t.total_recorded_fees),
    });
    const marketKey = `${String(t.sell_exchange)}|${String(t.asset)}|${String(t.currency)}`;
    return {
      id: String(t.id),
      asset: String(t.asset),
      currency: String(t.currency),
      amount,
      buy_price: buyPrice,
      expected_sell_price: t.expected_sell_price != null ? num(t.expected_sell_price) : null,
      buy_exchange: String(t.buy_exchange),
      sell_exchange: String(t.sell_exchange),
      buy_time: String(t.buy_time),
      intended_horizon_hours:
        t.intended_horizon_hours != null ? num(t.intended_horizon_hours) : null,
      break_even_price: econ.breakEvenPrice,
      market_sell_price: bestSell.get(marketKey) ?? null,
    };
  });

  const feeds = ((feedRes.data ?? []) as Array<Record<string, unknown>>).map((f) => ({
    exchange: String(f.exchange),
    asset: String(f.asset),
    fiat: String(f.fiat),
    status: String(f.status),
    consecutive_failures: num(f.consecutive_failures),
    last_success_at: (f.last_success_at as string) ?? null,
    error_message: (f.error_message as string) ?? null,
  }));

  const alerts = evaluateAlerts({
    routes,
    activeTrades,
    feeds,
    latestSnapshotAt: quotes[0]?.captured_at ?? null,
    recentClosedProfits: ((closedRes.data ?? []) as Array<Record<string, unknown>>).map((c) =>
      num(c.actual_profit),
    ),
    opportunityThreshold: opts.opportunityThreshold ?? 0,
  });

  if (alerts.length === 0) return { evaluated: 0, created: 0, alerts: [] };

  // Persist. The unique (user_id, dedupe_key) index turns repeats into no-ops.
  const { data: inserted } = await db
    .from("market_inventory_notifications")
    .upsert(
      alerts.map((a) => ({
        user_id: userId,
        type: a.type,
        severity: a.severity,
        title: a.title,
        body: a.body,
        link: a.link,
        dedupe_key: a.dedupe_key,
        metadata: a.metadata,
      })),
      { onConflict: "user_id,dedupe_key", ignoreDuplicates: true },
    )
    .select("id");

  // Mirror the actionable ones into the risk centre.
  const risky = alerts.filter((a) => a.severity === "critical" || a.severity === "warning");
  if (risky.length) {
    const { data: existing } = await db
      .from("market_inventory_risk_alerts")
      .select("message")
      .is("dismissed_at", null)
      .limit(200);
    const seen = new Set(
      ((existing ?? []) as Array<{ message: string }>).map((r) => r.message),
    );
    const fresh = risky.filter((a) => !seen.has(a.body));
    if (fresh.length) {
      await db.from("market_inventory_risk_alerts").insert(
        fresh.map((a) => ({
          user_id: userId,
          severity: a.severity === "critical" ? "high" : "medium",
          message: a.body,
          related_trade_id: a.trade_id ?? null,
        })),
      );
    }
  }

  return {
    evaluated: alerts.length,
    created: (inserted as Array<unknown> | null)?.length ?? 0,
    alerts,
  };
}
