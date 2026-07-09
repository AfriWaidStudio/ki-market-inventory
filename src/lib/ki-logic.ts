// Deterministic scoring logic for Konsmik Intelligence.

export type Recommendation = "buy_now" | "wait" | "watch" | "skip";

export interface OpportunityInput {
  buyPrice: number;
  sellPrice: number;
  amount: number;
  estimatedFees: number;
  liquidityScore?: number | null; // 0-100
  merchantCount?: number | null;
  merchantRating?: number | null; // 0-5
}

export interface OpportunityResult {
  spread: number;
  spreadPct: number;
  grossProfit: number;
  netProfit: number;
  confidence: number; // 0-100
  risk: number; // 0-100
  recommendation: Recommendation;
  reasoning: string;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function scoreOpportunity(input: OpportunityInput): OpportunityResult {
  const {
    buyPrice,
    sellPrice,
    amount,
    estimatedFees,
    liquidityScore,
    merchantCount,
    merchantRating,
  } = input;

  const spread = sellPrice - buyPrice;
  const spreadPct = buyPrice > 0 ? spread / buyPrice : 0;
  const grossProfit = spread * amount;
  const netProfit = grossProfit - estimatedFees;

  // Confidence weights
  const spreadScore = clamp(spreadPct * 100 * 25, 0, 45); // ~1.8% spread caps
  const feeCoverage = grossProfit > 0 ? clamp((netProfit / grossProfit) * 25, 0, 25) : 0;
  const liqScore = clamp(((liquidityScore ?? 60) / 100) * 15, 0, 15);
  const merchantScore = clamp(((merchantRating ?? 4) / 5) * 10, 0, 10);
  const merchantVolume = clamp(Math.log10((merchantCount ?? 5) + 1) * 3, 0, 5);
  const confidence = clamp(
    spreadScore + feeCoverage + liqScore + merchantScore + merchantVolume,
    0,
    100,
  );

  // Risk (inverse of liquidity + rating, penalised by thin spread)
  const liqRisk = clamp(100 - (liquidityScore ?? 60), 0, 100);
  const ratingRisk = clamp((5 - (merchantRating ?? 4)) * 20, 0, 100);
  const spreadRisk = spreadPct < 0.005 ? 40 : spreadPct < 0.01 ? 20 : 5;
  const risk = clamp(liqRisk * 0.4 + ratingRisk * 0.4 + spreadRisk * 0.2, 0, 100);

  let recommendation: Recommendation;
  if (netProfit <= 0) recommendation = "skip";
  else if (confidence >= 75 && risk < 40) recommendation = "buy_now";
  else if (confidence >= 55) recommendation = "wait";
  else recommendation = "watch";

  const reasoning = buildReasoning({
    spread,
    spreadPct,
    grossProfit,
    netProfit,
    confidence,
    risk,
    recommendation,
    liquidityScore: liquidityScore ?? null,
    merchantCount: merchantCount ?? null,
    merchantRating: merchantRating ?? null,
  });

  return { spread, spreadPct, grossProfit, netProfit, confidence, risk, recommendation, reasoning };
}

function buildReasoning(r: {
  spread: number;
  spreadPct: number;
  grossProfit: number;
  netProfit: number;
  confidence: number;
  risk: number;
  recommendation: Recommendation;
  liquidityScore: number | null;
  merchantCount: number | null;
  merchantRating: number | null;
}): string {
  const parts: string[] = [];
  parts.push(
    `Spread ${r.spread.toFixed(2)} (${(r.spreadPct * 100).toFixed(2)}%). Estimated net profit ${r.netProfit.toFixed(2)}.`,
  );
  if (r.liquidityScore != null) parts.push(`Liquidity ${r.liquidityScore.toFixed(0)}/100.`);
  if (r.merchantRating != null) parts.push(`Merchant rating ${r.merchantRating.toFixed(1)}/5.`);
  if (r.merchantCount != null) parts.push(`${r.merchantCount} merchants available.`);
  parts.push(`Confidence ${r.confidence.toFixed(0)}%. Risk ${r.risk.toFixed(0)}%.`);
  switch (r.recommendation) {
    case "buy_now":
      parts.push("Recommendation: execute now — spread and liquidity favour the trade.");
      break;
    case "wait":
      parts.push("Recommendation: consider waiting; spread is modest.");
      break;
    case "watch":
      parts.push("Recommendation: watch; confidence is below threshold.");
      break;
    case "skip":
      parts.push("Recommendation: skip — fees consume the profit.");
      break;
  }
  return parts.join(" ");
}

export interface CloseAnalysis {
  actualProfit: number;
  expectedProfit: number | null;
  delta: number | null;
  verdict: "accurate" | "underestimated" | "overestimated" | "unknown";
  mistakes: string[];
  lesson: string;
}

export function analyseClose(args: {
  buyPrice: number;
  actualSellPrice: number;
  amount: number;
  finalFees: number;
  expectedProfit: number | null;
  durationMinutes: number;
}): CloseAnalysis {
  const actualProfit = (args.actualSellPrice - args.buyPrice) * args.amount - args.finalFees;
  const mistakes: string[] = [];
  if (args.actualSellPrice < args.buyPrice) mistakes.push("Sold below buy price.");
  if (args.finalFees > Math.max(actualProfit, 0)) mistakes.push("Fees exceeded profit.");
  if (args.durationMinutes > 240) mistakes.push("Held longer than 4 hours.");

  let verdict: CloseAnalysis["verdict"] = "unknown";
  let delta: number | null = null;
  if (args.expectedProfit != null) {
    delta = actualProfit - args.expectedProfit;
    const rel = args.expectedProfit === 0 ? 0 : Math.abs(delta) / Math.abs(args.expectedProfit);
    if (rel <= 0.15) verdict = "accurate";
    else if (delta > 0) verdict = "underestimated";
    else verdict = "overestimated";
  }

  const lesson =
    actualProfit > 0
      ? mistakes.length
        ? `Profitable, but note: ${mistakes.join(" ")}`
        : "Clean profitable trade — repeat this route/timing."
      : mistakes.length
        ? `Loss recorded. ${mistakes.join(" ")}`
        : "Loss recorded. Review spread assumptions before re-entering this route.";

  return { actualProfit, expectedProfit: args.expectedProfit, delta, verdict, mistakes, lesson };
}
