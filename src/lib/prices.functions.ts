import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Live P2P price intelligence.
 *
 * Fetchers live in p2p.server.ts (server-only). This module owns the
 * user-facing server functions: refreshing a pair, reading feed health, and
 * managing the watchlist of asset/fiat pairs we keep fresh.
 */

const PairInput = z.object({
  asset: z.string().default("USDT"),
  fiat: z.string().default("NGN"),
});

export const refreshLivePrices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PairInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { fetchPairAllExchanges } = await import("./p2p.server");
    const outcomes = await fetchPairAllExchanges(data.asset, data.fiat);

    const rows = outcomes.flatMap((o) =>
      o.snaps.map((s) => ({
        user_id: context.userId,
        exchange: s.exchange,
        asset: data.asset,
        side: s.side,
        price: s.price,
        currency: data.fiat,
        liquidity_score: s.liquidity_score,
        merchant_count: s.merchant_count,
        merchant_rating: s.merchant_rating,
      })),
    );

    if (rows.length) {
      const { error } = await context.supabase
        .from("market_inventory_price_snapshots")
        .insert(rows);
      if (error) throw new Error(error.message);
    }

    const now = new Date().toISOString();
    const statusRows = outcomes.map((o) => ({
      user_id: context.userId,
      exchange: o.exchange,
      asset: data.asset,
      fiat: data.fiat,
      status: o.ok ? "live" : "unavailable",
      consecutive_failures: o.ok ? 0 : 1,
      last_success_at: o.ok ? now : null,
      last_failure_at: o.ok ? null : now,
      error_message: o.ok ? null : (o.error ?? "Unknown error"),
      updated_at: now,
    }));
    await context.supabase
      .from("market_inventory_feed_status")
      .upsert(statusRows, { onConflict: "user_id,exchange,asset,fiat" });

    const failures = outcomes
      .filter((o) => !o.ok)
      .map((o) => ({ exchange: o.exchange, error: o.error ?? "Unknown error" }));

    if (failures.length) {
      await context.supabase.from("market_inventory_audit_log").insert(
        failures.map((f) => ({
          user_id: context.userId,
          action: "price_fetch_failed",
          metadata: { exchange: f.exchange, error: f.error, asset: data.asset, fiat: data.fiat },
        })),
      );
    }

    return {
      inserted: rows.length,
      failures,
      exchanges_ok: outcomes.filter((o) => o.ok).map((o) => o.exchange),
      fetched_at: now,
    };
  });

export const listLatestLivePrices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("market_inventory_price_snapshots")
      .select("exchange, asset, side, price, currency, liquidity_score, merchant_count, merchant_rating, captured_at")
      .order("captured_at", { ascending: false })
      .limit(120);
    if (error) throw new Error(error.message);
    const latest = new Map<string, (typeof data)[number]>();
    for (const s of data ?? []) {
      const key = `${s.exchange}::${s.asset}::${s.currency}::${s.side}`;
      if (!latest.has(key)) latest.set(key, s);
    }
    return Array.from(latest.values());
  });

export const listFeedStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("market_inventory_feed_status")
      .select("exchange, asset, fiat, status, consecutive_failures, last_success_at, last_failure_at, error_message, updated_at")
      .order("exchange", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/* ---------------- Watchlist ---------------- */

export const listWatchlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("market_inventory_watchlist")
      .select("id, asset, fiat, is_active, created_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const addWatchPair = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PairInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("market_inventory_watchlist")
      .upsert(
        {
          user_id: context.userId,
          asset: data.asset.toUpperCase(),
          fiat: data.fiat.toUpperCase(),
          is_active: true,
        },
        { onConflict: "user_id,asset,fiat" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeWatchPair = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("market_inventory_watchlist")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Refresh every active watched pair for the current user. */
export const refreshWatchlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { fetchPairAllExchanges } = await import("./p2p.server");
    const { data: pairs, error } = await context.supabase
      .from("market_inventory_watchlist")
      .select("asset, fiat")
      .eq("is_active", true);
    if (error) throw new Error(error.message);

    const list = pairs?.length ? pairs : [{ asset: "USDT", fiat: "NGN" }];
    const now = new Date().toISOString();
    let inserted = 0;
    const failures: Array<{ exchange: string; pair: string; error: string }> = [];

    for (const p of list) {
      const outcomes = await fetchPairAllExchanges(p.asset, p.fiat);
      const rows = outcomes.flatMap((o) =>
        o.snaps.map((s) => ({
          user_id: context.userId,
          exchange: s.exchange,
          asset: p.asset,
          side: s.side,
          price: s.price,
          currency: p.fiat,
          liquidity_score: s.liquidity_score,
          merchant_count: s.merchant_count,
          merchant_rating: s.merchant_rating,
        })),
      );
      if (rows.length) {
        await context.supabase.from("market_inventory_price_snapshots").insert(rows);
        inserted += rows.length;
      }
      await context.supabase.from("market_inventory_feed_status").upsert(
        outcomes.map((o) => ({
          user_id: context.userId,
          exchange: o.exchange,
          asset: p.asset,
          fiat: p.fiat,
          status: o.ok ? "live" : "unavailable",
          consecutive_failures: o.ok ? 0 : 1,
          last_success_at: o.ok ? now : null,
          last_failure_at: o.ok ? null : now,
          error_message: o.ok ? null : (o.error ?? "Unknown error"),
          updated_at: now,
        })),
        { onConflict: "user_id,exchange,asset,fiat" },
      );
      for (const o of outcomes) {
        if (!o.ok) failures.push({ exchange: o.exchange, pair: `${p.asset}/${p.fiat}`, error: o.error ?? "Unknown" });
      }
    }

    return { inserted, failures, pairs: list.length, fetched_at: now };
  });
