import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { StatCard, Badge } from "@/components/StatCard";
import { fmtMoney, fmtNumber } from "@/lib/currency";
import { dashboardSummary } from "@/lib/analytics.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — KI Market Inventory" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const summaryFn = useServerFn(dashboardSummary);
  const opts = queryOptions({
    queryKey: ["dashboard-summary"],
    queryFn: () => summaryFn(),
  });
  const { data } = useSuspenseQuery(opts);
  const c = data.currency;

  return (
    <AppShell title="Command Center">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Tracked capital" value={fmtMoney(data.trackedCapital, c)} hint={`${data.activeCount} active trades`} />
        <StatCard label="Today profit" value={fmtMoney(data.todayProfit, c)} tone={data.todayProfit >= 0 ? "profit" : "loss"} />
        <StatCard label="7-day profit" value={fmtMoney(data.weekProfit, c)} tone={data.weekProfit >= 0 ? "profit" : "loss"} />
        <StatCard label="30-day profit" value={fmtMoney(data.monthProfit, c)} tone={data.monthProfit >= 0 ? "profit" : "loss"} />
        <StatCard label="Total profit" value={fmtMoney(data.totalProfit, c)} tone={data.totalProfit >= 0 ? "profit" : "loss"} hint={`${data.closedCount} closed trades`} />
        <StatCard label="Avg profit / trade" value={fmtMoney(data.avgProfit, c)} />
        <StatCard label="Avg duration" value={`${fmtNumber(data.avgDurationMinutes, 0)}m`} />
        <StatCard label="Win rate" value={`${(data.winRate * 100).toFixed(1)}%`} />
        <StatCard label="Total fees" value={fmtMoney(data.totalFees, c)} tone="warning" />
        <StatCard label="Best route" value={data.bestRoute ?? "—"} />
        <StatCard label="Worst route" value={data.worstRoute ?? "—"} tone="loss" />
      </div>

      <div className="mt-8 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Route performance</h2>
          <Badge tone="info">{data.routeStats.length} routes</Badge>
        </div>
        {data.routeStats.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No closed trades yet. Mark trades as bought on the <a href="/scanner" className="text-primary underline">Scanner</a>, then close them to build history.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="text-left py-2">Route</th>
                  <th className="text-right py-2">Trades</th>
                  <th className="text-right py-2">Total profit</th>
                  <th className="text-right py-2">Avg</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {data.routeStats.map((r) => (
                  <tr key={r.route} className="border-b border-border/50">
                    <td className="py-2">{r.route}</td>
                    <td className="text-right">{r.count}</td>
                    <td className={`text-right ${r.profit >= 0 ? "text-[color:var(--profit)]" : "text-[color:var(--loss)]"}`}>
                      {fmtMoney(r.profit, c)}
                    </td>
                    <td className="text-right">{fmtMoney(r.profit / Math.max(1, r.count), c)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
