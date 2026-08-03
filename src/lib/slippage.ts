/**
 * Slippage and executable-price modelling.
 *
 * A quoted P2P top-of-book price is only real for the first slice of an order
 * book. Fill a large amount and you walk down the ladder into worse merchants.
 * We only ever see aggregate depth from the public feeds, so we model the walk
 * with a convex impact curve calibrated on how much of visible depth the order
 * consumes and how thin the merchant set is.
 *
 * Pure and deterministic.
 */

export interface DepthContext {
  /** Total asset units visible across the sampled ads. */
  depthAsset: number | null;
  /** Number of distinct merchants sampled. */
  merchantCount: number | null;
  /** 0-100 liquidity score from the feed. */
  liquidityScore: number | null;
}

export interface SlippageEstimate {
  /** Price a fill of `amount` should actually average. */
  executablePrice: number;
  /** Fractional move away from the quote (always >= 0). */
  slippagePct: number;
  /** Fraction of visible depth this order consumes. */
  depthConsumed: number;
  confidence: "high" | "medium" | "low";
  note: string;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * `side` is the direction of the user's fill:
 *  - "buy"  → adverse slippage pushes the price UP
 *  - "sell" → adverse slippage pushes the price DOWN
 */
export function estimateExecutablePrice(args: {
  quotePrice: number;
  amount: number;
  side: "buy" | "sell";
  depth: DepthContext;
}): SlippageEstimate {
  const { quotePrice, amount, side, depth } = args;
  const merchants = depth.merchantCount ?? 0;
  const liq = depth.liquidityScore;

  // Effective depth: prefer observed asset depth, otherwise infer a floor from
  // merchant count so a thin book is never treated as infinitely deep.
  const observed = depth.depthAsset && depth.depthAsset > 0 ? depth.depthAsset : null;
  const inferred = merchants > 0 ? merchants * 250 : null;
  const effectiveDepth = observed ?? inferred;

  if (!effectiveDepth || quotePrice <= 0 || amount <= 0) {
    // No depth signal — assume a defensive 0.25% haircut rather than pretending
    // the quote is executable at any size.
    const pct = 0.0025;
    return {
      executablePrice: side === "buy" ? quotePrice * (1 + pct) : quotePrice * (1 - pct),
      slippagePct: pct,
      depthConsumed: 0,
      confidence: "low",
      note: "No depth data — applied a defensive 0.25% haircut.",
    };
  }

  const consumed = amount / effectiveDepth;

  // Convex impact: negligible for the first quarter of the book, then rises
  // sharply. 1.6% base coefficient with a quadratic tail.
  const base = 0.016;
  const impact = base * (Math.pow(clamp(consumed, 0, 4), 1.6) * 0.9 + consumed * 0.25);

  // Thin merchant sets are riskier than depth alone suggests.
  const merchantPenalty = merchants > 0 && merchants < 5 ? (5 - merchants) * 0.0008 : 0;
  const liqPenalty = liq != null && liq < 40 ? ((40 - liq) / 40) * 0.002 : 0;

  const slippagePct = clamp(impact + merchantPenalty + liqPenalty, 0, 0.15);
  const executablePrice =
    side === "buy" ? quotePrice * (1 + slippagePct) : quotePrice * (1 - slippagePct);

  const confidence: SlippageEstimate["confidence"] =
    observed && merchants >= 5 ? "high" : observed || merchants >= 3 ? "medium" : "low";

  const note =
    consumed < 0.25
      ? `Order takes ${(consumed * 100).toFixed(0)}% of visible depth — top-of-book is realistic.`
      : consumed < 1
        ? `Order takes ${(consumed * 100).toFixed(0)}% of visible depth — expect to walk the book.`
        : `Order exceeds visible depth (${(consumed * 100).toFixed(0)}%) — fill will be partial or badly priced.`;

  return { executablePrice, slippagePct, depthConsumed: consumed, confidence, note };
}

/** Compare what we predicted against what the user actually got. */
export function realizedSlippage(args: {
  quotedPrice: number;
  actualPrice: number;
  side: "buy" | "sell";
  predictedSlippagePct?: number | null;
}): {
  realizedPct: number;
  predictedPct: number | null;
  deltaPct: number | null;
  verdict: "better_than_modelled" | "as_modelled" | "worse_than_modelled" | "unknown";
} {
  const raw =
    args.side === "buy"
      ? (args.actualPrice - args.quotedPrice) / args.quotedPrice
      : (args.quotedPrice - args.actualPrice) / args.quotedPrice;
  const realizedPct = Number.isFinite(raw) ? raw : 0;
  const predictedPct = args.predictedSlippagePct ?? null;
  if (predictedPct == null) {
    return { realizedPct, predictedPct: null, deltaPct: null, verdict: "unknown" };
  }
  const deltaPct = realizedPct - predictedPct;
  const verdict =
    Math.abs(deltaPct) <= 0.002
      ? "as_modelled"
      : deltaPct > 0
        ? "worse_than_modelled"
        : "better_than_modelled";
  return { realizedPct, predictedPct, deltaPct, verdict };
}
