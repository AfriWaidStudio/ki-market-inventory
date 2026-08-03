import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { DEFAULT_FEE_PROFILES, type FeeProfile } from "./fees";
import { discoverRoutes, computePersistence, type SpreadSample, type VenueQuote } from "./routes";

const DiscoverInput = z.object({
  amount: z.number().positive().max(10_000_000).default(1000),
  asset: z.string().default("USDT"),
  fiat: z.string().default("NGN"),
  allowSameVenue: z.boolean().default(false),
  persist: z.boolean().default(true),
});

async function loadFeeProfiles(
  supabase: { from: (t: string) => any },
): Promise<Record<string, FeeProfile>> {
  const { data } = await supabase.from("market_inventory_fee_profiles").select("*");
  const map: Record<string, FeeProfile> = { ...DEFAULT_FEE_PROFILES };
  for (const r of (data ?? []) as Array<Record<string, unknown>>) {
    map[String(r.exchange)] = {
      exchange: String(r.exchange),
      trade_fee_pct: Number(r.trade_fee_pct),
      payment_fee_pct: Number(r.payment_fee_pct),
      payment_fee_flat: Number(r.payment_fee_flat),
      withdrawal_fee_asset: Number(r.withdrawal_fee_asset),
      network: (r.network as string) ?? null,
    };
  }
  return map;
}

/**
 * Enumerate and rank every venue-to-venue route the live feeds support, then
 * record the observation so persistence can be measured over time.
 */
export const discoverLiveRoutes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DiscoverInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

    const [snapRes, histRes, feeProfiles] = await Promise.all([
      context.supabase
        .from("market_inventory_price_snapshots")
        .select(
          "exchange, asset, side, price, currency, liquidity_score, merchant_count, merchant_rating, captured_at",
        )
        .eq("asset", data.asset)
        .eq("currency", data.fiat)
        .order("captured_at", { ascending: false })
        .limit(300),
      context.supabase
        .from("market_inventory_spread_history")
        .select("buy_exchange, sell_exchange, spread_pct, net_pct, observed_at")
        .eq("asset", data.asset)
        .eq("fiat", data.fiat)
        .gte("observed_at", since)
        .order("observed_at", { ascending: false })
        .limit(1000),
      loadFeeProfiles(context.supabase as unknown as { from: (t: string) => any }),
    ]);

    if (snapRes.error) throw new Error(snapRes.error.message);

    const quotes: VenueQuote[] = (snapRes.data ?? []).map((s) => ({
      exchange: s.exchange,
      asset: s.asset,
      fiat: s.currency,
      side: s.side as "buy" | "sell",
      price: Number(s.price),
      liquidity_score: s.liquidity_score != null ? Number(s.liquidity_score) : null,
      merchant_count: s.merchant_count != null ? Number(s.merchant_count) : null,
      merchant_rating: s.merchant_rating != null ? Number(s.merchant_rating) : null,
      depth_asset: null,
      captured_at: s.captured_at as string,
    }));

    const history: SpreadSample[] = (histRes.data ?? []).map((h) => ({
      buy_exchange: h.buy_exchange,
      sell_exchange: h.sell_exchange,
      spread_pct: Number(h.spread_pct),
      net_pct: h.net_pct != null ? Number(h.net_pct) : null,
      observed_at: h.observed_at as string,
    }));

    const routes = discoverRoutes({
      quotes,
      amount: data.amount,
      feeProfiles,
      history,
      allowSameVenue: data.allowSameVenue,
    });

    // Persist this observation so tomorrow's persistence stats are real.
    if (data.persist && routes.length) {
      const now = new Date().toISOString();
      const rows = routes.slice(0, 24).map((r) => ({
        user_id: context.userId,
        asset: r.asset,
        fiat: r.fiat,
        buy_exchange: r.buy_exchange,
        sell_exchange: r.sell_exchange,
        buy_price: r.quoted_buy_price,
        sell_price: r.quoted_sell_price,
        executable_buy_price: r.executable_buy_price,
        executable_sell_price: r.executable_sell_price,
        spread: r.quoted_sell_price - r.quoted_buy_price,
        spread_pct: r.economics.grossSpreadPct,
        net_pct: r.economics.netSpreadPct,
        depth_asset: null,
        observed_at: now,
      }));
      await context.supabase.from("market_inventory_spread_history").insert(rows);
    }

    return {
      routes,
      quotes_used: quotes.length,
      history_samples: history.length,
      generated_at: new Date().toISOString(),
    };
  });

const HistoryInput = z.object({
  asset: z.string().default("USDT"),
  fiat: z.string().default("NGN"),
  buy_exchange: z.string(),
  sell_exchange: z.string(),
  hours: z.number().int().min(1).max(168).default(24),
});

/** Spread persistence series for a single route — powers the sparkline. */
export const routeSpreadHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => HistoryInput.parse(d))
  .handler(async ({ data, context }) => {
    const since = new Date(Date.now() - data.hours * 3600_000).toISOString();
    const { data: rows, error } = await context.supabase
      .from("market_inventory_spread_history")
      .select("spread_pct, net_pct, buy_price, sell_price, observed_at")
      .eq("asset", data.asset)
      .eq("fiat", data.fiat)
      .eq("buy_exchange", data.buy_exchange)
      .eq("sell_exchange", data.sell_exchange)
      .gte("observed_at", since)
      .order("observed_at", { ascending: true });
    if (error) throw new Error(error.message);

    const series = (rows ?? []).map((r) => ({
      observed_at: r.observed_at as string,
      spread_pct: Number(r.spread_pct),
      net_pct: r.net_pct != null ? Number(r.net_pct) : null,
      buy_price: Number(r.buy_price),
      sell_price: Number(r.sell_price),
    }));

    const persistence = computePersistence(
      series.map((s) => ({
        buy_exchange: data.buy_exchange,
        sell_exchange: data.sell_exchange,
        spread_pct: s.spread_pct,
        net_pct: s.net_pct,
        observed_at: s.observed_at,
      })),
    );

    return { series, persistence };
  });
