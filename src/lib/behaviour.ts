/**
 * Behaviour learning — turns a trade history into a personal operating profile.
 *
 * This is the "KI knows how *you* trade" layer: when you're sharpest, which
 * routes you actually win on, whether you cut losers, and the mistakes you
 * repeat. Pure and deterministic so the same history always yields the same
 * profile.
 */

export interface BehaviourTrade {
  id: string;
  status: string;
  buy_time: string;
  sell_time: string | null;
  duration_minutes: number | null;
  amount: number;
  buy_price: number;
  actual_profit: number | null;
  expected_profit: number | null;
  confidence_score: number | null;
  risk_score: number | null;
  buy_exchange: string;
  sell_exchange: string;
  ki_accuracy_verdict: string | null;
  currency: string;
}

export interface BucketStat {
  key: string;
  label: string;
  trades: number;
  profit: number;
  winRate: number;
  avgProfit: number;
}

export interface BehaviourProfile {
  sampleSize: number;
  /** 0-100. High = follows the plan, cuts losers, sizes consistently. */
  disciplineScore: number;
  /** 0-100. High = takes big positions relative to their own average. */
  aggressionScore: number;
  /** 0-100. Consistency of outcomes; punishes wild swings. */
  consistencyScore: number;
  bestHours: BucketStat[];
  worstHours: BucketStat[];
  bestDays: BucketStat[];
  bestRoutes: BucketStat[];
  worstRoutes: BucketStat[];
  avgHoldMinutes: number;
  medianSize: number;
  winRate: number;
  expectancy: number;
  largestWin: number;
  largestLoss: number;
  maxDrawdown: number;
  currentStreak: { kind: "win" | "loss" | "none"; length: number };
  patterns: string[];
  coaching: string[];
  currency: string;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function bucketise(
  trades: BehaviourTrade[],
  keyOf: (t: BehaviourTrade) => string,
  labelOf: (k: string) => string,
): BucketStat[] {
  const map = new Map<string, { profit: number; count: number; wins: number }>();
  for (const t of trades) {
    const k = keyOf(t);
    const cur = map.get(k) ?? { profit: 0, count: 0, wins: 0 };
    const p = num(t.actual_profit);
    cur.profit += p;
    cur.count += 1;
    if (p > 0) cur.wins += 1;
    map.set(k, cur);
  }
  return Array.from(map.entries())
    .map(([key, v]) => ({
      key,
      label: labelOf(key),
      trades: v.count,
      profit: v.profit,
      winRate: v.count ? v.wins / v.count : 0,
      avgProfit: v.count ? v.profit / v.count : 0,
    }))
    .sort((a, b) => b.profit - a.profit);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function buildBehaviourProfile(all: BehaviourTrade[]): BehaviourProfile {
  const closed = all
    .filter((t) => t.status === "closed" && t.sell_time)
    .sort((a, b) => Date.parse(a.sell_time!) - Date.parse(b.sell_time!));
  const currency = all[0]?.currency ?? "NGN";

  if (closed.length === 0) {
    return {
      sampleSize: 0,
      disciplineScore: 0,
      aggressionScore: 0,
      consistencyScore: 0,
      bestHours: [],
      worstHours: [],
      bestDays: [],
      bestRoutes: [],
      worstRoutes: [],
      avgHoldMinutes: 0,
      medianSize: 0,
      winRate: 0,
      expectancy: 0,
      largestWin: 0,
      largestLoss: 0,
      maxDrawdown: 0,
      currentStreak: { kind: "none", length: 0 },
      patterns: [],
      coaching: [
        "No closed trades yet. Close a few trades and KI will start learning your edge, your timing and your leaks.",
      ],
      currency,
    };
  }

  const profits = closed.map((t) => num(t.actual_profit));
  const wins = profits.filter((p) => p > 0);
  const losses = profits.filter((p) => p <= 0);
  const winRate = wins.length / closed.length;
  const avgWin = wins.length ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
  const avgLoss = losses.length ? Math.abs(losses.reduce((a, b) => a + b, 0) / losses.length) : 0;
  const expectancy = winRate * avgWin - (1 - winRate) * avgLoss;

  const sizes = closed.map((t) => num(t.amount) * num(t.buy_price)).sort((a, b) => a - b);
  const medianSize = sizes[Math.floor(sizes.length / 2)] ?? 0;
  const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
  const maxSize = sizes[sizes.length - 1] ?? 0;

  const holds = closed.map((t) => t.duration_minutes ?? 0);
  const avgHoldMinutes = holds.reduce((a, b) => a + b, 0) / holds.length;

  // Equity curve → drawdown
  let peak = 0;
  let equity = 0;
  let maxDrawdown = 0;
  for (const p of profits) {
    equity += p;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak - equity);
  }

  // Streak from the most recent trades backwards
  let streakKind: "win" | "loss" | "none" = "none";
  let streakLen = 0;
  for (let i = profits.length - 1; i >= 0; i--) {
    const kind = profits[i]! > 0 ? "win" : "loss";
    if (streakKind === "none") {
      streakKind = kind;
      streakLen = 1;
    } else if (streakKind === kind) streakLen += 1;
    else break;
  }

  const hourStats = bucketise(
    closed,
    (t) => String(new Date(t.buy_time).getHours()),
    (k) => `${k.padStart(2, "0")}:00`,
  ).filter((b) => b.trades >= 1);
  const dayStats = bucketise(
    closed,
    (t) => String(new Date(t.buy_time).getDay()),
    (k) => DAYS[Number(k)] ?? k,
  );
  const routeStats = bucketise(
    closed,
    (t) => `${t.buy_exchange}→${t.sell_exchange}`,
    (k) => k,
  );

  // ---- Scores -------------------------------------------------------------
  // Discipline: cuts losers fast, holds are consistent, losses are small.
  const lossHolds = closed.filter((t) => num(t.actual_profit) <= 0).map((t) => t.duration_minutes ?? 0);
  const winHolds = closed.filter((t) => num(t.actual_profit) > 0).map((t) => t.duration_minutes ?? 0);
  const avgLossHold = lossHolds.length ? lossHolds.reduce((a, b) => a + b, 0) / lossHolds.length : 0;
  const avgWinHold = winHolds.length ? winHolds.reduce((a, b) => a + b, 0) / winHolds.length : 0;
  const cutsLosers = avgLossHold <= avgWinHold * 1.2;
  const lossRatio = avgWin > 0 ? avgLoss / avgWin : avgLoss > 0 ? 2 : 0;
  const sizeSpread = avgSize > 0 ? maxSize / avgSize : 1;
  const disciplineScore = clamp(
    40 +
      (cutsLosers ? 20 : -15) +
      (lossRatio <= 1 ? 20 : lossRatio <= 1.5 ? 8 : -12) +
      (sizeSpread <= 2 ? 15 : sizeSpread <= 4 ? 5 : -10) +
      (winRate >= 0.5 ? 10 : 0),
    0,
    100,
  );

  const aggressionScore = clamp(
    30 + (sizeSpread - 1) * 15 + (avgHoldMinutes < 30 ? 20 : 0) + (closed.length > 20 ? 10 : 0),
    0,
    100,
  );

  const mean = profits.reduce((a, b) => a + b, 0) / profits.length;
  const sd = Math.sqrt(profits.reduce((a, b) => a + (b - mean) ** 2, 0) / profits.length);
  const cv = Math.abs(mean) > 0 ? sd / Math.abs(mean) : 3;
  const consistencyScore = clamp(100 - cv * 25, 0, 100);

  // ---- Patterns & coaching ------------------------------------------------
  const patterns: string[] = [];
  const coaching: string[] = [];

  const topHour = hourStats[0];
  const worstHour = hourStats[hourStats.length - 1];
  if (topHour && topHour.trades >= 2 && topHour.profit > 0) {
    patterns.push(
      `Your strongest window is ${topHour.label} — ${topHour.trades} trades, ${Math.round(topHour.winRate * 100)}% win rate.`,
    );
  }
  if (worstHour && worstHour.profit < 0 && worstHour.trades >= 2) {
    patterns.push(`${worstHour.label} is consistently negative across ${worstHour.trades} trades.`);
    coaching.push(`Stop trading around ${worstHour.label} until the data changes — it is a proven leak.`);
  }

  const topRoute = routeStats[0];
  const worstRoute = routeStats[routeStats.length - 1];
  if (topRoute && topRoute.trades >= 2) {
    patterns.push(
      `${topRoute.label} is your edge: ${topRoute.trades} trades, avg ${topRoute.avgProfit.toFixed(0)} per trade.`,
    );
  }
  if (worstRoute && worstRoute.profit < 0 && worstRoute.trades >= 2 && worstRoute.key !== topRoute?.key) {
    coaching.push(`${worstRoute.label} has lost money across ${worstRoute.trades} trades — drop it or halve the size.`);
  }

  if (!cutsLosers) {
    patterns.push(
      `You hold losers ${(avgLossHold / Math.max(avgWinHold, 1)).toFixed(1)}× longer than winners.`,
    );
    coaching.push("Set a hard time-stop. Holding a bad P2P fill rarely improves it — the spread moves against you.");
  }
  if (lossRatio > 1.5) {
    coaching.push(
      `Average loss (${avgLoss.toFixed(0)}) is ${lossRatio.toFixed(1)}× your average win. Tighten entries or lower size on low-confidence routes.`,
    );
  }
  if (sizeSpread > 4) {
    patterns.push("Your position sizes swing wildly — largest trade is several times your average.");
    coaching.push("Fix a base unit size. Erratic sizing means one bad trade can erase ten good ones.");
  }
  if (streakKind === "loss" && streakLen >= 3) {
    coaching.push(`${streakLen} losses in a row. Step back to paper mode until a clean route appears.`);
  }
  if (streakKind === "win" && streakLen >= 4) {
    coaching.push(`${streakLen} wins in a row — the usual next mistake is oversizing. Keep the unit fixed.`);
  }

  const overconfident = closed.filter(
    (t) => (t.confidence_score ?? 0) >= 70 && num(t.actual_profit) <= 0,
  ).length;
  if (overconfident >= 2) {
    patterns.push(`${overconfident} high-confidence setups still lost — the confidence model is over-fitting your inputs.`);
    coaching.push("Treat confidence above 70 as 'worth checking', not 'guaranteed'. Verify depth before sizing up.");
  }

  if (coaching.length === 0) {
    coaching.push("Nothing structurally broken in your recent behaviour. Keep the sizing fixed and the routes narrow.");
  }

  return {
    sampleSize: closed.length,
    disciplineScore,
    aggressionScore,
    consistencyScore,
    bestHours: hourStats.filter((h) => h.profit > 0).slice(0, 5),
    worstHours: hourStats.filter((h) => h.profit < 0).slice(-5).reverse(),
    bestDays: dayStats.slice(0, 3),
    bestRoutes: routeStats.filter((r) => r.profit > 0).slice(0, 5),
    worstRoutes: routeStats.filter((r) => r.profit < 0).slice(-5).reverse(),
    avgHoldMinutes,
    medianSize,
    winRate,
    expectancy,
    largestWin: Math.max(0, ...profits),
    largestLoss: Math.min(0, ...profits),
    maxDrawdown,
    currentStreak: { kind: streakKind, length: streakLen },
    patterns,
    coaching,
    currency,
  };
}
