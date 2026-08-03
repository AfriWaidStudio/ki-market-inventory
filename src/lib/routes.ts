/**
 * Route discovery — pure ranking logic.
 *
 * A "route" is a directed buy-venue → sell-venue pair for one asset/fiat pair.
 * We enumerate every route the live feeds can support, price it with real
 * slippage and real fees, then rank by risk-adjusted net profit rather than
 * headline spread. A fat spread on a dead book loses to a thin spread that
 * actually fills.
 */

import { computeEconomics, profileFor, type Economics, type FeeProfile } from "./fees";
import { estimateExecutablePrice, type SlippageEstimate } from "./slippage";

export interface VenueQuote {
  exchange: string;
  asset: string;
  fiat: string;
  /** "buy" = price you pay to acquire; "sell" = price you receive. */
  side: "buy" | "sell";
  price: number;
  liquidity_score: number | null;
  merchant_count: number | null;
  merchant_rating: number | null;
  depth_asset?: number | null;
  captured_at: string;
}

export interface SpreadSample {
  buy_exchange: string;
  sell_exchange: string;
  net_pct: number | null;
  spread_pct: number;
  observed_at: string;
}

export interface PersistenceStat {
  /** Fraction of recent observations where the route stayed profitable, 0-1. */
  holdRate: number;
  /** Number of observations backing the stat. */
  samples: number;
  /** Minutes the route has been continuously profitable, if it is now. */
  ageMinutes: number | null;
  /** Volatility of the net spread across samples. */
  volatility: number;
  label: "persistent" | "flickering" | "fading" | "new";
}

export interface DiscoveredRoute {
  id: string;
  asset: string;
  fiat: string;
  buy_exchange: string;
  sell_exchange: string;
  quoted_buy_price: number;
  quoted_sell_price: number;
  executable_buy_price: number;
  executable_sell_price: number;
  buy_slippage: SlippageEstimate;
  sell_slippage: SlippageEstimate;
  economics: Economics;
  /** Net profit adjusted down for execution and staleness risk. */
  riskAdjustedProfit: number;
  /** 0-100. Blends net margin, liquidity, trust, persistence, freshness. */
  score: number;
  persistence: PersistenceStat | null;
  minutesSinceQuote: number;
  warnings: string[];
  verdict: "execute" | "size_down" | "monitor" | "avoid";
  headline: string;
}

function ageMinutes(iso: string): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (Date.now() - t) / 60000);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function computePersistence(samples: SpreadSample[]): PersistenceStat {
  if (samples.length === 0) {
    return { holdRate: 0, samples: 0, ageMinutes: null, volatility: 0, label: "new" };
  }
  const vals = samples.map((s) => s.net_pct ?? s.spread_pct);
  const profitable = vals.filter((v) => v > 0).length;
  const holdRate = profitable / vals.length;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
  const volatility = Math.sqrt(variance);

  // Walk backwards from the newest sample while it stays profitable.
  const sorted = [...samples].sort(
    (a, b) => Date.parse(b.observed_at) - Date.parse(a.observed_at),
  );
  let streakStart: string | null = null;
  for (const s of sorted) {
    if ((s.net_pct ?? s.spread_pct) > 0) streakStart = s.observed_at;
    else break;
  }
  const streak = streakStart ? ageMinutes(streakStart) : null;

  const label: PersistenceStat["label"] =
    samples.length < 3
      ? "new"
      : holdRate >= 0.8
        ? "persistent"
        : holdRate >= 0.4
          ? "flickering"
          : "fading";

  return { holdRate, samples: samples.length, ageMinutes: streak, volatility, label };
}

export function discoverRoutes(args: {
  quotes: VenueQuote[];
  amount: number;
  feeProfiles?: Record<string, FeeProfile> | null;
  history?: SpreadSample[];
  allowSameVenue?: boolean;
}): DiscoveredRoute[] {
  const { quotes, amount } = args;
  const history = args.history ?? [];

  // Keep the freshest quote per (exchange, asset, fiat, side).
  const latest = new Map<string, VenueQuote>();
  for (const q of quotes) {
    const key = `${q.exchange}|${q.asset}|${q.fiat}|${q.side}`;
    const prev = latest.get(key);
    if (!prev || Date.parse(q.captured_at) > Date.parse(prev.captured_at)) latest.set(key, q);
  }
  const all = Array.from(latest.values());
  const buys = all.filter((q) => q.side === "buy");
  const sells = all.filter((q) => q.side === "sell");

  const routes: DiscoveredRoute[] = [];

  for (const b of buys) {
    for (const s of sells) {
      if (b.asset !== s.asset || b.fiat !== s.fiat) continue;
      const sameVenue = b.exchange === s.exchange;
      if (sameVenue && !args.allowSameVenue) continue;

      const buySlip = estimateExecutablePrice({
        quotePrice: b.price,
        amount,
        side: "buy",
        depth: {
          depthAsset: b.depth_asset ?? null,
          merchantCount: b.merchant_count,
          liquidityScore: b.liquidity_score,
        },
      });
      const sellSlip = estimateExecutablePrice({
        quotePrice: s.price,
        amount,
        side: "sell",
        depth: {
          depthAsset: s.depth_asset ?? null,
          merchantCount: s.merchant_count,
          liquidityScore: s.liquidity_score,
        },
      });

      const economics = computeEconomics({
        amount,
        buyPrice: buySlip.executablePrice,
        sellPrice: sellSlip.executablePrice,
        buyProfile: profileFor(b.exchange, args.feeProfiles),
        sellProfile: profileFor(s.exchange, args.feeProfiles),
        sameVenue,
      });

      const relevant = history.filter(
        (h) => h.buy_exchange === b.exchange && h.sell_exchange === s.exchange,
      );
      const persistence = relevant.length ? computePersistence(relevant) : null;

      const staleMinutes = Math.max(ageMinutes(b.captured_at), ageMinutes(s.captured_at));

      const warnings: string[] = [];
      if (staleMinutes > 10) warnings.push(`Quotes are ${Math.round(staleMinutes)} minutes old.`);
      if (buySlip.depthConsumed > 1 || sellSlip.depthConsumed > 1)
        warnings.push("Order size exceeds visible depth on at least one leg.");
      if ((b.merchant_count ?? 0) < 3) warnings.push("Very few merchants on the buy side.");
      if ((s.merchant_count ?? 0) < 3) warnings.push("Very few merchants on the sell side.");
      if (economics.breakEvenBufferPct < 0.002)
        warnings.push("Break-even buffer under 0.2% — one bad fill wipes the trade.");
      if (persistence?.label === "fading")
        warnings.push("This route rarely stays profitable between refreshes.");

      // Risk adjustment: haircut the profit for execution and staleness risk.
      const executionRisk = clamp(
        (buySlip.depthConsumed + sellSlip.depthConsumed) / 4 +
          (buySlip.confidence === "low" ? 0.15 : 0) +
          (sellSlip.confidence === "low" ? 0.15 : 0),
        0,
        0.9,
      );
      const stalenessRisk = clamp(staleMinutes / 60, 0, 0.5);
      const persistenceBoost = persistence ? persistence.holdRate : 0.5;
      const riskAdjustedProfit =
        economics.netProfit * (1 - executionRisk) * (1 - stalenessRisk) * (0.6 + 0.4 * persistenceBoost);

      const marginScore = clamp(economics.netSpreadPct * 100 * 30, 0, 40);
      const liquidityScore = clamp(
        (((b.liquidity_score ?? 40) + (s.liquidity_score ?? 40)) / 2 / 100) * 20,
        0,
        20,
      );
      const trustScore = clamp(
        (((b.merchant_rating ?? 3.5) + (s.merchant_rating ?? 3.5)) / 2 / 5) * 15,
        0,
        15,
      );
      const persistenceScore = clamp(persistenceBoost * 15, 0, 15);
      const freshnessScore = clamp(10 - staleMinutes, 0, 10);
      const score = clamp(
        marginScore + liquidityScore + trustScore + persistenceScore + freshnessScore,
        0,
        100,
      );

      let verdict: DiscoveredRoute["verdict"];
      if (economics.netProfit <= 0) verdict = "avoid";
      else if (score >= 70 && warnings.length === 0) verdict = "execute";
      else if (score >= 50) verdict = "size_down";
      else verdict = "monitor";

      const headline =
        economics.netProfit <= 0
          ? `Fees turn a ${(economics.grossSpreadPct * 100).toFixed(2)}% spread into a loss.`
          : `${(economics.netSpreadPct * 100).toFixed(2)}% net after fees and modelled slippage${
              persistence ? ` · held ${Math.round(persistence.holdRate * 100)}% of recent checks` : ""
            }.`;

      routes.push({
        id: `${b.exchange}->${s.exchange}:${b.asset}/${b.fiat}`,
        asset: b.asset,
        fiat: b.fiat,
        buy_exchange: b.exchange,
        sell_exchange: s.exchange,
        quoted_buy_price: b.price,
        quoted_sell_price: s.price,
        executable_buy_price: buySlip.executablePrice,
        executable_sell_price: sellSlip.executablePrice,
        buy_slippage: buySlip,
        sell_slippage: sellSlip,
        economics,
        riskAdjustedProfit,
        score,
        persistence,
        minutesSinceQuote: staleMinutes,
        warnings,
        verdict,
        headline,
      });
    }
  }

  routes.sort((a, b) => b.riskAdjustedProfit - a.riskAdjustedProfit || b.score - a.score);
  return routes;
}
