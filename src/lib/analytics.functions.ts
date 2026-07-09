import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

interface TradeRow {
  amount: number | string;
  buy_price: number | string;
  actual_profit: number | string | null;
  expected_profit: number | string | null;
  final_fees: number | string | null;
  estimated_fees: number | string | null;
  duration_minutes: number | null;
  status: string;
  route: string | null;
  buy_time: string;
  sell_time: string | null;
  ki_accuracy_verdict: string | null;
  currency: string;
}

function num(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export const dashboardSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows, error } = await context.supabase
      .from("market_inventory_trades")
      .select("*");
    if (error) throw new Error(error.message);
    const trades = (rows ?? []) as unknown as TradeRow[];

    const now = new Date();
    const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - 7);
    const startOfMonth = new Date(now); startOfMonth.setDate(now.getDate() - 30);

    const closed = trades.filter((t) => t.status === "closed");
    const active = trades.filter((t) => t.status === "active");

    const profitInWindow = (from: Date) =>
      closed
        .filter((t) => t.sell_time && new Date(t.sell_time) >= from)
        .reduce((sum, t) => sum + num(t.actual_profit), 0);

    const totalProfit = closed.reduce((s, t) => s + num(t.actual_profit), 0);
    const totalFees = closed.reduce((s, t) => s + num(t.final_fees ?? t.estimated_fees), 0);
    const wins = closed.filter((t) => num(t.actual_profit) > 0).length;
    const winRate = closed.length ? wins / closed.length : 0;
    const avgProfit = closed.length ? totalProfit / closed.length : 0;
    const avgDuration = closed.length
      ? closed.reduce((s, t) => s + (t.duration_minutes ?? 0), 0) / closed.length
      : 0;

    const routeStats = new Map<string, { profit: number; count: number }>();
    for (const t of closed) {
      const key = t.route ?? "—";
      const cur = routeStats.get(key) ?? { profit: 0, count: 0 };
      cur.profit += num(t.actual_profit);
      cur.count += 1;
      routeStats.set(key, cur);
    }
    const routeArr = Array.from(routeStats.entries()).map(([route, v]) => ({ route, ...v }));
    routeArr.sort((a, b) => b.profit - a.profit);
    const bestRoute = routeArr[0]?.route ?? null;
    const worstRoute = routeArr[routeArr.length - 1]?.route ?? null;

    const trackedCapital = active.reduce((s, t) => s + num(t.amount) * num(t.buy_price), 0);

    const currency = trades[0]?.currency ?? "NGN";

    return {
      currency,
      trackedCapital,
      activeCount: active.length,
      closedCount: closed.length,
      todayProfit: profitInWindow(startOfDay),
      weekProfit: profitInWindow(startOfWeek),
      monthProfit: profitInWindow(startOfMonth),
      totalProfit,
      avgProfit,
      avgDurationMinutes: avgDuration,
      bestRoute,
      worstRoute,
      winRate,
      totalFees,
      routeStats: routeArr,
    };
  });

export const analyticsSeries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows, error } = await context.supabase
      .from("market_inventory_trades")
      .select("*")
      .eq("status", "closed")
      .order("sell_time", { ascending: true });
    if (error) throw new Error(error.message);
    const closed = (rows ?? []) as unknown as TradeRow[];

    // Profit by day
    const byDay = new Map<string, number>();
    for (const t of closed) {
      if (!t.sell_time) continue;
      const d = t.sell_time.slice(0, 10);
      byDay.set(d, (byDay.get(d) ?? 0) + num(t.actual_profit));
    }
    const profitByDay = Array.from(byDay.entries()).map(([date, profit]) => ({ date, profit }));

    // Profit by hour
    const byHour = new Map<number, number>();
    for (const t of closed) {
      if (!t.buy_time) continue;
      const h = new Date(t.buy_time).getHours();
      byHour.set(h, (byHour.get(h) ?? 0) + num(t.actual_profit));
    }
    const profitByHour = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      profit: byHour.get(h) ?? 0,
    }));

    // Cumulative capital growth
    let running = 0;
    const capitalGrowth = profitByDay.map((d) => ({ date: d.date, cumulative: (running += d.profit) }));

    // KI accuracy
    const totalWithVerdict = closed.filter((t) => t.ki_accuracy_verdict).length;
    const accurate = closed.filter((t) => t.ki_accuracy_verdict === "accurate").length;
    const kiAccuracy = totalWithVerdict ? accurate / totalWithVerdict : 0;

    return { profitByDay, profitByHour, capitalGrowth, kiAccuracy };
  });
