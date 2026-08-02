/**
 * Public P2P order-book fetchers (server-only).
 *
 * These hit the same unauthenticated endpoints the exchange websites use, so
 * no API keys are required. Each returns a normalized snapshot or throws with
 * a short reason so the caller can record feed health.
 */

export type Side = "buy" | "sell";

export type NormalizedSnap = {
  exchange: string;
  side: Side;
  price: number;
  best_price: number;
  liquidity_score: number | null;
  merchant_count: number | null;
  merchant_rating: number | null;
  depth_asset: number | null;
};

export const P2P_EXCHANGES = ["Binance", "Bybit", "OKX"] as const;

function trust(rate0to1: number): number | null {
  const v = Number((rate0to1 * 5).toFixed(2));
  return Number.isFinite(v) && v > 0 ? v : null;
}

async function fetchBinance(asset: string, fiat: string, side: Side): Promise<NormalizedSnap[]> {
  const tradeType = side === "buy" ? "BUY" : "SELL";
  const r = await fetch("https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
    body: JSON.stringify({ page: 1, rows: 10, asset, tradeType, fiat, payTypes: [], publisherType: null }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
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
  const avgFinish = top.reduce((s, x) => s + Number(x.advertiser?.monthFinishRate ?? 0), 0) / top.length;
  const orders = top.reduce((s, x) => s + Number(x.advertiser?.monthOrderCount ?? 0), 0);
  const depth = top.reduce((s, x) => s + Number(x.adv?.surplusAmount ?? 0), 0);
  return [{
    exchange: "Binance",
    side,
    price,
    best_price: price,
    merchant_count: rows.length,
    merchant_rating: trust(avgFinish),
    liquidity_score: Math.min(100, Math.round(orders / 20)),
    depth_asset: depth || null,
  }];
}

async function fetchBybit(asset: string, fiat: string, side: Side): Promise<NormalizedSnap[]> {
  const bybitSide = side === "buy" ? "1" : "0";
  const r = await fetch("https://api2.bybit.com/fiat/otc/item/online", {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
    body: JSON.stringify({
      userId: "", tokenId: asset, currencyId: fiat, payment: [],
      side: bybitSide, size: "10", page: "1", amount: "",
    }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = (await r.json()) as {
    result?: { items?: Array<{ price?: string; recentOrderNum?: number; recentExecuteRate?: number; lastQuantity?: string }> };
  };
  const rows = j.result?.items ?? [];
  if (!rows.length) return [];
  const top = rows.slice(0, 5);
  const price = Number(top[0]?.price ?? 0);
  if (!price) return [];
  const avgExec = top.reduce((s, x) => s + Number(x.recentExecuteRate ?? 0), 0) / top.length; // 0-100
  const orders = top.reduce((s, x) => s + Number(x.recentOrderNum ?? 0), 0);
  const depth = top.reduce((s, x) => s + Number(x.lastQuantity ?? 0), 0);
  return [{
    exchange: "Bybit",
    side,
    price,
    best_price: price,
    merchant_count: rows.length,
    merchant_rating: trust(avgExec / 100),
    liquidity_score: Math.min(100, Math.round(orders / 20)),
    depth_asset: depth || null,
  }];
}

async function fetchOkx(asset: string, fiat: string, side: Side): Promise<NormalizedSnap[]> {
  const okxSide = side === "buy" ? "sell" : "buy";
  const url = `https://www.okx.com/v3/c2c/tradingOrders/books?quoteCurrency=${fiat}&baseCurrency=${asset}&side=${okxSide}&paymentMethod=all&userType=all&showTrade=false&showFollow=false&showAlreadyTraded=false&isAbleFilter=false`;
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = (await r.json()) as {
    data?: {
      sell?: Array<{ price?: string; completedOrderQuantity?: number; completedRate?: string; availableAmount?: string }>;
      buy?: Array<{ price?: string; completedOrderQuantity?: number; completedRate?: string; availableAmount?: string }>;
    };
  };
  const rows = (okxSide === "sell" ? j.data?.sell : j.data?.buy) ?? [];
  if (!rows.length) return [];
  const top = rows.slice(0, 5);
  const price = Number(top[0]?.price ?? 0);
  if (!price) return [];
  const avgRate = top.reduce((s, x) => s + Number(x.completedRate ?? 0), 0) / top.length;
  const orders = top.reduce((s, x) => s + Number(x.completedOrderQuantity ?? 0), 0);
  const depth = top.reduce((s, x) => s + Number(x.availableAmount ?? 0), 0);
  return [{
    exchange: "OKX",
    side,
    price,
    best_price: price,
    merchant_count: rows.length,
    merchant_rating: trust(avgRate),
    liquidity_score: Math.min(100, Math.round(orders / 20)),
    depth_asset: depth || null,
  }];
}

const FETCHERS: Record<string, (a: string, f: string, s: Side) => Promise<NormalizedSnap[]>> = {
  Binance: fetchBinance,
  Bybit: fetchBybit,
  OKX: fetchOkx,
};

export type FeedOutcome = {
  exchange: string;
  ok: boolean;
  snaps: NormalizedSnap[];
  error?: string;
};

/** Fetch both sides for every supported exchange for one asset/fiat pair. */
export async function fetchPairAllExchanges(asset: string, fiat: string): Promise<FeedOutcome[]> {
  const results = await Promise.all(
    P2P_EXCHANGES.map(async (name): Promise<FeedOutcome> => {
      const fn = FETCHERS[name]!;
      try {
        const [buy, sell] = await Promise.all([fn(asset, fiat, "buy"), fn(asset, fiat, "sell")]);
        const snaps = [...buy, ...sell];
        if (!snaps.length) return { exchange: name, ok: false, snaps: [], error: "No ads returned" };
        return { exchange: name, ok: true, snaps };
      } catch (e) {
        return { exchange: name, ok: false, snaps: [], error: e instanceof Error ? e.message : String(e) };
      }
    }),
  );
  return results;
}
