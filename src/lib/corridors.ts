/**
 * Cross-border payment intelligence.
 *
 * Every provider hides cost in three places: the FX markup, the visible fee,
 * and the payout method. This module makes all three comparable on one number:
 * how much actually lands on the other side.
 */

export type ProviderType = "bank" | "fintech" | "crypto_p2p" | "mobile_money" | "agent";

export interface CorridorQuote {
  id?: number | string;
  provider: string;
  provider_type: string;
  fx_rate: number;
  mid_market_rate?: number | null;
  fee_flat: number;
  fee_pct: number;
  min_amount?: number | null;
  max_amount?: number | null;
  speed_hours?: number | null;
  payout_method?: string | null;
  observed_at: string;
}

export interface RankedCorridor {
  quote: CorridorQuote;
  eligible: boolean;
  ineligibleReason: string | null;
  feeTotal: number;
  amountAfterFees: number;
  receiveAmount: number;
  effectiveRate: number;
  fxMarkupPct: number;
  totalCostPct: number;
  vsBest: number;
  speedHours: number | null;
  score: number;
  rank: number;
}

export function midRateOf(quotes: CorridorQuote[]): number | null {
  const explicit = quotes.map((q) => q.mid_market_rate).filter((r): r is number => r != null && r > 0);
  if (explicit.length) return explicit.reduce((a, b) => a + b, 0) / explicit.length;
  const rates = quotes.map((q) => q.fx_rate).filter((r) => r > 0);
  if (!rates.length) return null;
  // Absent a true mid, the best available rate is the least-bad proxy.
  return Math.max(...rates);
}

/**
 * Rank providers for a corridor at a given send amount.
 * Score blends landed value (dominant) with speed, because a rate you wait
 * four days for is not the same product as one that settles in an hour.
 */
export function rankCorridor(params: {
  quotes: CorridorQuote[];
  amount: number;
  speedWeight?: number;
}): { ranked: RankedCorridor[]; mid: number | null; bestReceive: number | null } {
  const { quotes, amount } = params;
  const speedWeight = params.speedWeight ?? 0.12;
  const mid = midRateOf(quotes);

  const rows: RankedCorridor[] = quotes.map((q) => {
    const feeTotal = q.fee_flat + amount * q.fee_pct;
    const amountAfterFees = Math.max(0, amount - feeTotal);
    const receiveAmount = amountAfterFees * q.fx_rate;
    const effectiveRate = amount > 0 ? receiveAmount / amount : 0;
    const fxMarkupPct = mid && mid > 0 ? Math.max(0, (mid - q.fx_rate) / mid) : 0;
    const idealReceive = mid ? amount * mid : receiveAmount;
    const totalCostPct = idealReceive > 0 ? Math.max(0, (idealReceive - receiveAmount) / idealReceive) : 0;

    let ineligibleReason: string | null = null;
    if (q.min_amount != null && amount < q.min_amount) ineligibleReason = `Below ${q.provider} minimum`;
    if (q.max_amount != null && amount > q.max_amount) ineligibleReason = `Above ${q.provider} maximum`;

    return {
      quote: q,
      eligible: ineligibleReason == null,
      ineligibleReason,
      feeTotal,
      amountAfterFees,
      receiveAmount,
      effectiveRate,
      fxMarkupPct,
      totalCostPct,
      vsBest: 0,
      speedHours: q.speed_hours ?? null,
      score: 0,
      rank: 0,
    };
  });

  const eligible = rows.filter((r) => r.eligible);
  const bestReceive = eligible.length ? Math.max(...eligible.map((r) => r.receiveAmount)) : null;

  for (const r of rows) {
    r.vsBest = bestReceive ? r.receiveAmount - bestReceive : 0;
    const valueScore = bestReceive && bestReceive > 0 ? r.receiveAmount / bestReceive : 0;
    const speedPenalty = r.speedHours == null ? 0.5 : Math.min(1, r.speedHours / 96);
    r.score = r.eligible ? valueScore - speedWeight * speedPenalty : 0;
  }

  const ranked = [...rows].sort((a, b) => b.score - a.score);
  ranked.forEach((r, i) => {
    r.rank = i + 1;
  });
  return { ranked, mid, bestReceive };
}

/** Money left on the table by using `chosen` instead of the top-ranked option. */
export function opportunityCost(ranked: RankedCorridor[], chosenProvider: string): number {
  const best = ranked.find((r) => r.eligible);
  const chosen = ranked.find((r) => r.quote.provider === chosenProvider);
  if (!best || !chosen) return 0;
  return best.receiveAmount - chosen.receiveAmount;
}

export const PROVIDER_TYPES: { value: ProviderType; label: string }[] = [
  { value: "bank", label: "Bank wire" },
  { value: "fintech", label: "Fintech" },
  { value: "crypto_p2p", label: "Crypto P2P" },
  { value: "mobile_money", label: "Mobile money" },
  { value: "agent", label: "Local agent" },
];
