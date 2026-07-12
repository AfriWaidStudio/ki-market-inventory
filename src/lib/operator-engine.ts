export const OPERATOR_MODEL_VERSION = "operator-v1.0.0";
export const SUPPORTED_FIATS = ["NGN", "GHS", "KES", "ZAR", "USD", "EUR", "GBP", "AED"] as const;
export type OperatorAction = "sell_now" | "wait" | "transfer" | "avoid" | "insufficient_data";

export type MarketAd = {
  exchange: string; side: "buy" | "sell"; price: number; availableAsset: number;
  minFiat?: number | null; maxFiat?: number | null; paymentMethods?: string[];
  completionRate?: number | null; completedOrders?: number | null; observedAt: string;
};
export type ExecutableQuote = { exchange: string; price: number; filledAsset: number; proceeds: number; adsUsed: number; oldestObservation: string };
export type PositionInput = {
  tradeId: string; remainingAmount: number; buyPrice: number; totalFiatSpent?: number | null;
  entryFees: number; transferFeeAsset: number; exitFeesFiat: number; openedAt: string; horizonHours: number;
  sourceExchange?: string | null; destinationExchange?: string | null; paymentMethod?: string | null;
};
export type MarketHistory = { prices: number[]; timestamps: string[]; sampleCount: number; feedHealthy: boolean };
export type PositionDecision = {
  action: OperatorAction; venue: string | null; executablePrice: number | null; executableAmount: number;
  breakEvenPrice: number; targetPrice: number; expectedNet: number | null; downside: number | null;
  targetWindowHours: number | null; confidence: number | null; confidenceEligible: boolean; regime: string;
  evidence: string[]; missingData: string[]; invalidationCondition: string; nextEvaluationAt: string;
};

const num = (n: number) => Number.isFinite(n) ? n : 0;
export function quoteExecutableSale(ads: MarketAd[], amount: number, now = Date.now()): ExecutableQuote | null {
  const eligible = ads.filter(a => a.side === "sell" && a.price > 0 && a.availableAsset > 0 && now - new Date(a.observedAt).getTime() <= 120_000);
  const byExchange = new Map<string, MarketAd[]>();
  for (const ad of eligible) byExchange.set(ad.exchange, [...(byExchange.get(ad.exchange) ?? []), ad]);
  let best: ExecutableQuote | null = null;
  for (const [exchange, rows] of byExchange) {
    rows.sort((a, b) => b.price - a.price);
    let remaining = amount, proceeds = 0, used = 0, oldest = new Date().toISOString();
    for (const ad of rows) {
      const fill = Math.min(remaining, ad.availableAsset);
      const fiat = fill * ad.price;
      if ((ad.minFiat && fiat < ad.minFiat) || (ad.maxFiat && fiat > ad.maxFiat && ad.maxFiat / ad.price <= 0)) continue;
      const boundedFill = ad.maxFiat ? Math.min(fill, ad.maxFiat / ad.price) : fill;
      if (boundedFill <= 0) continue;
      proceeds += boundedFill * ad.price; remaining -= boundedFill; used += 1;
      if (ad.observedAt < oldest) oldest = ad.observedAt;
      if (remaining <= 1e-8) break;
    }
    const filled = amount - remaining;
    if (filled < amount * 0.98) continue;
    const quote = { exchange, price: proceeds / filled, filledAsset: filled, proceeds, adsUsed: used, oldestObservation: oldest };
    if (!best || quote.proceeds > best.proceeds) best = quote;
  }
  return best;
}

export function calculateBreakEven(position: PositionInput) {
  const sellable = Math.max(0.00000001, position.remainingAmount - position.transferFeeAsset);
  const cost = position.totalFiatSpent ?? position.remainingAmount * position.buyPrice;
  return (cost + position.entryFees + position.exitFeesFiat) / sellable;
}

export function classifyRegime(prices: number[]) {
  if (prices.length < 3) return "unknown";
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const volatility = Math.sqrt(prices.reduce((s, p) => s + (p - mean) ** 2, 0) / prices.length) / mean;
  const trend = (prices.at(-1)! - prices[0]) / prices[0];
  if (volatility > 0.015) return "volatile";
  if (trend > 0.004) return "rising";
  if (trend < -0.004) return "falling";
  return "range_bound";
}

export function evaluatePosition(position: PositionInput, ads: MarketAd[], history: MarketHistory, now = new Date()): PositionDecision {
  const breakEven = calculateBreakEven(position);
  const quote = quoteExecutableSale(ads, position.remainingAmount - position.transferFeeAsset, now.getTime());
  const heldHours = (now.getTime() - new Date(position.openedAt).getTime()) / 3_600_000;
  const regime = classifyRegime(history.prices);
  const missing: string[] = [];
  if (!history.feedHealthy) missing.push("Market feed is unhealthy or stale");
  if (history.sampleCount < 120) missing.push("Insufficient history for calibrated probability");
  if (!quote) missing.push("No venue has enough fresh executable depth");
  const eligible = history.sampleCount >= 120 && history.feedHealthy && !!quote;
  const expectedNet = quote ? quote.proceeds - ((position.totalFiatSpent ?? position.remainingAmount * position.buyPrice) + position.entryFees + position.exitFeesFiat) : null;
  const downside = quote ? Math.min(0, expectedNet ?? 0) : null;
  const recent = history.prices.slice(-120);
  const reachable = recent.length ? recent.filter(p => p >= breakEven).length / recent.length : 0;
  const conservativeUpside = recent.length >= 20 ? [...recent].sort((a,b) => a-b)[Math.floor(recent.length * 0.65)] : breakEven;
  const target = Math.max(breakEven, conservativeUpside || breakEven);
  let action: OperatorAction = "insufficient_data";
  if (quote && history.feedHealthy) {
    if (quote.price >= target) action = "sell_now";
    else if (heldHours >= position.horizonHours && (regime === "falling" || reachable < 0.25)) action = expectedNet != null && expectedNet >= 0 ? "sell_now" : "avoid";
    else action = "wait";
  }
  const evidence = [
    `All-in break-even is ${breakEven.toFixed(2)} per USDT.`,
    quote ? `${quote.exchange} can execute ${quote.filledAsset.toFixed(2)} USDT near ${quote.price.toFixed(2)}.` : "Executable depth is unavailable.",
    `Market regime is ${regime}; position has been held ${heldHours.toFixed(1)} hours.`,
    eligible ? `${(reachable * 100).toFixed(0)}% of recent observations met break-even.` : "Confidence is withheld until enough healthy observations exist.",
  ];
  const confidence = eligible ? Math.max(5, Math.min(95, 35 + reachable * 50 + (regime === "rising" ? 10 : regime === "falling" ? -10 : 0))) : null;
  return {
    action, venue: quote?.exchange ?? null, executablePrice: quote?.price ?? null,
    executableAmount: quote?.filledAsset ?? 0, breakEvenPrice: breakEven, targetPrice: target,
    expectedNet, downside, targetWindowHours: eligible ? (reachable > .6 ? 1 : reachable > .35 ? 6 : 24) : null,
    confidence, confidenceEligible: eligible, regime, evidence, missingData: missing,
    invalidationCondition: "Recompute if executable price, depth, costs, trade stage, or feed health changes materially.",
    nextEvaluationAt: new Date(now.getTime() + 30_000).toISOString(),
  };
}

export function dedupeAlertKey(tradeId: string, type: string, action: string, price?: number | null) {
  const band = price == null ? "none" : (Math.round(price * 20) / 20).toFixed(2);
  return `${tradeId}:${type}:${action}:${band}`;
}
