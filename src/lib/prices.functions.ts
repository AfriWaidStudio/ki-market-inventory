import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/auth/middleware";
import { z } from "zod";

/**
 * Live P2P price intelligence.
 *
 * Fetches public P2P order books from Binance, Bybit, and OKX server-side
 * (Cloudflare Worker fetch — same endpoints their public websites use, no
 * API keys required) and writes normalized snapshots into
 * market_inventory_price_snapshots so the rest of the app (Scanner,
 * Waides KI chat grounding) reads real data instead of only what the user
 * typed.
 */

const RefreshInput = z.object({
  asset: z.string().default("USDT"),
  fiat: z.string().default("NGN"),
});

type NormalizedSnap = {
  exchange: string;
  side: "buy" | "sell";
  price: number;
  liquidity_score: number | null;
  merchant_count: number | null;
  merchant_rating: number | null;
};

async function fetchBinance(asset: string, fiat: string, side: "buy" | "sell"): Promise<NormalizedSnap[]> {
  // tradeType from the TAKER perspective: BUY = user buys USDT from merchant.
  const tradeType = side === "buy" ? "BUY" : "SELL";
  const r = await fetch("https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
    body: JSON.stringify({
      page: 1,
      rows: 10,
      asset,
      tradeType,
      fiat,
      payTypes: [],
      publisherType: null,
    }),
  });
  if (!r.ok) throw new Error(`Binance ${r.status}`);
  const j = (await r.json()) as {
    data?: Array<{
      adv?: { price?: string; surplusAmount?: string };
      advertiser?: { monthOrderCount?: number; monthFinishRate?: number };
    }>;
  };
  const rows = j.data ?? [];
  if (!rows.length) return [];
  const top = rows.slice(0, 5);
  const price = Number(top[0]?.adv?.price ?? 0);
  if (!price) return [];
  const avgFinish =
    top.reduce((s, r) => s + Number(r.advertiser?.monthFinishRate ?? 0), 0) / top.length;
  const totalOrders = top.reduce(
    (s, r) => s + Number(r.advertiser?.monthOrderCount ?? 0),
    0,
  );
  return [
    {
      exchange: "Binance",
      side,
      price,
      merchant_count: rows.length,
      merchant_rating: Number((avgFinish * 5).toFixed(2)) || null, // finish rate 0-1 → 0-5
      liquidity_score: Math.min(100, Math.round(totalOrders / 20)),
    },
  ];
}

async function fetchBybit(asset: string, fiat: string, side: "buy" | "sell"): Promise<NormalizedSnap[]> {
  // Bybit side: "1" = merchants SELLING (user buys), "0" = merchants BUYING (user sells)
  const bybitSide = side === "buy" ? "1" : "0";
  const r = await fetch("https://api2.bybit.com/fiat/otc/item/online", {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
    body: JSON.stringify({
      userId: "",
      tokenId: asset,
      currencyId: fiat,
      payment: [],
      side: bybitSide,
      size: "10",
      page: "1",
      amount: "",
    }),
  });
  if (!r.ok) throw new Error(`Bybit ${r.status}`);
  const j = (await r.json()) as {
    result?: {
      items?: Array<{
        price?: string;
        recentOrderNum?: number;
        recentExecuteRate?: number;
      }>;
    };
  };
  const rows = j.result?.items ?? [];
  if (!rows.length) return [];
  const top = rows.slice(0, 5);
  const price = Number(top[0]?.price ?? 0);
  if (!price) return [];
  const avgExec =
    top.reduce((s, r) => s + Number(r.recentExecuteRate ?? 0), 0) / top.length; // 0-100
  const totalOrders = top.reduce((s, r) => s + Number(r.recentOrderNum ?? 0), 0);
  return [
    {
      exchange: "Bybit",
      side,
      price,
      merchant_count: rows.length,
      merchant_rating: Number(((avgExec / 100) * 5).toFixed(2)) || null,
      liquidity_score: Math.min(100, Math.round(totalOrders / 20)),
    },
  ];
}

async function fetchOkx(asset: string, fiat: string, side: "buy" | "sell"): Promise<NormalizedSnap[]> {
  // OKX side from merchant POV: side=sell → merchants selling → user buys.
  const okxSide = side === "buy" ? "sell" : "buy";
  const url = `https://www.okx.com/v3/c2c/tradingOrders/books?quoteCurrency=${fiat}&baseCurrency=${asset}&side=${okxSide}&paymentMethod=all&userType=all&showTrade=false&showFollow=false&showAlreadyTraded=false&isAbleFilter=false`;
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!r.ok) throw new Error(`OKX ${r.status}`);
  const j = (await r.json()) as {
    data?: {
      sell?: Array<{ price?: string; completedOrderQuantity?: number; completedRate?: string }>;
      buy?: Array<{ price?: string; completedOrderQuantity?: number; completedRate?: string }>;
    };
  };
  const rows = (okxSide === "sell" ? j.data?.sell : j.data?.buy) ?? [];
  if (!rows.length) return [];
  const top = rows.slice(0, 5);
  const price = Number(top[0]?.price ?? 0);
  if (!price) return [];
  const avgRate =
    top.reduce((s, r) => s + Number(r.completedRate ?? 0), 0) / top.length;
  const totalOrders = top.reduce(
    (s, r) => s + Number(r.completedOrderQuantity ?? 0),
    0,
  );
  return [
    {
      exchange: "OKX",
      side,
      price,
      merchant_count: rows.length,
      merchant_rating: Number((avgRate * 5).toFixed(2)) || null,
      liquidity_score: Math.min(100, Math.round(totalOrders / 20)),
    },
  ];
}

export const refreshLivePrices = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => RefreshInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const jobs: Array<Promise<{ ok: true; snaps: NormalizedSnap[] } | { ok: false; exchange: string; error: string }>> = [];

    for (const side of ["buy", "sell"] as const) {
      for (const [name, fn] of [
        ["Binance", fetchBinance],
        ["Bybit", fetchBybit],
        ["OKX", fetchOkx],
      ] as const) {
        jobs.push(
          fn(data.asset, data.fiat, side)
            .then((snaps) => ({ ok: true as const, snaps }))
            .catch((e) => ({
              ok: false as const,
              exchange: name,
              error: e instanceof Error ? e.message : String(e),
            })),
        );
      }
    }

    const results = await Promise.all(jobs);
    const snaps: NormalizedSnap[] = [];
    const failures: Array<{ exchange: string; error: string }> = [];
    for (const r of results) {
      if (r.ok) snaps.push(...r.snaps);
      else failures.push({ exchange: r.exchange, error: r.error });
    }

    if (snaps.length) {
      const { error } = await context.supabase
        .from("market_inventory_price_snapshots")
        .insert(
          snaps.map((s) => ({
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
      if (error) throw new Error(error.message);
    }

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
      inserted: snaps.length,
      failures,
      exchanges_ok: [...new Set(snaps.map((s) => s.exchange))],
    };
  });

export const listLatestLivePrices = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("market_inventory_price_snapshots")
      .select("exchange, side, price, currency, liquidity_score, merchant_count, merchant_rating, captured_at")
      .eq("user_id", context.userId)
      .order("captured_at", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);
    // Keep latest per (exchange, side)
    const latest = new Map<string, (typeof data)[number]>();
    for (const s of data ?? []) {
      const key = `${s.exchange}::${s.side}`;
      if (!latest.has(key)) latest.set(key, s);
    }
    return Array.from(latest.values());
  });
