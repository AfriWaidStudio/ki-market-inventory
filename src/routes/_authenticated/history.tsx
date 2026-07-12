import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/StatCard";
import { fmtMoney } from "@/lib/currency";
import { listTradesPaginated } from "@/lib/trades.functions";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({ meta: [{ title: "Trade History — KI Market Inventory" }] }),
  component: HistoryPage,
});

function HistoryPage() {
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const [statusFilter, setStatusFilter] = useState<"all" | "closed" | "cancelled">("closed");
  const [typeFilter, setTypeFilter] = useState<"all" | "paper" | "manual">("all");
  const [routeFilter, setRouteFilter] = useState<string>("all");

  const listFn = useServerFn(listTradesPaginated);
  const query = useQuery({
    queryKey: ["trade-history", page, statusFilter, typeFilter, routeFilter],
    queryFn: () => {
      const data: any = { offset: page * pageSize, limit: pageSize };
      if (statusFilter !== "all") data.status = statusFilter;
      if (typeFilter !== "all") data.trade_type = typeFilter;
      if (routeFilter !== "all") data.route = routeFilter;
      return listFn({ data });
    },
    placeholderData: (prev) => prev,
  });

  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  const routes = useMemo(() => {
    const allRoutes = rows.map((r) => r.route).filter(Boolean) as string[];
    return Array.from(new Set(allRoutes)).sort();
  }, [rows]);

  return (
    <AppShell title="Trade History">
      <div className="mb-4 flex flex-wrap gap-3">
        <select value={statusFilter} onChange={(e) => { setPage(0); setStatusFilter(e.target.value as any); }} className={selCls}>
          <option value="closed">Closed trades</option>
          <option value="cancelled">Cancelled trades</option>
        </select>
        <select value={typeFilter} onChange={(e) => { setPage(0); setTypeFilter(e.target.value as any); }} className={selCls}>
          <option value="all">Paper + Manual</option>
          <option value="manual">Manual only</option>
          <option value="paper">Paper only</option>
        </select>
        <select value={routeFilter} onChange={(e) => { setPage(0); setRouteFilter(e.target.value); }} className={selCls}>
          <option value="all">All routes</option>
          {routes.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {query.isLoading && page === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">No trades match those filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left py-3 px-4">Date</th>
                  <th className="text-left py-3 px-4">Route</th>
                  <th className="text-center py-3 px-4">Type</th>
                  <th className="text-right py-3 px-4">Amount</th>
                  <th className="text-right py-3 px-4">Buy</th>
                  <th className="text-right py-3 px-4">Sell</th>
                  <th className="text-right py-3 px-4">P/L</th>
                  <th className="text-center py-3 px-4">KI verdict</th>
                  <th className="text-center py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {rows.map((t) => {
                  const p = Number(t.realized_profit ?? t.actual_profit ?? 0);
                  return (
                    <tr key={t.id} className="border-t border-border">
                      <td className="py-3 px-4 text-xs text-muted-foreground">
                        {new Date((t.sell_time ?? t.created_at) as string).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <Link to="/trades/$tradeId" params={{ tradeId: t.id }} className="hover:text-primary">
                          {t.route}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge tone={t.trade_type === "paper" ? "info" : "profit"}>{t.trade_type}</Badge>
                      </td>
                      <td className="py-3 px-4 text-right">{Number(t.amount).toFixed(0)} {t.asset}</td>
                      <td className="py-3 px-4 text-right">{fmtMoney(Number(t.buy_price), t.currency)}</td>
                      <td className="py-3 px-4 text-right">{t.actual_sell_price != null ? fmtMoney(Number(t.actual_sell_price), t.currency) : "—"}</td>
                      <td className={`py-3 px-4 text-right ${p >= 0 ? "text-[color:var(--profit)]" : "text-[color:var(--loss)]"}`}>
                        {t.status === "closed" ? fmtMoney(p, t.currency) : "—"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {t.ki_accuracy_verdict ? (
                          <Badge tone={t.ki_accuracy_verdict === "accurate" ? "profit" : "warning"}>
                            {t.ki_accuracy_verdict}
                          </Badge>
                        ) : "—"}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge tone={t.status === "closed" ? "info" : "default"}>{t.status}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center gap-2 p-4 border-t border-border">
            <button
              onClick={() => setPage(0)}
              disabled={page === 0}
              className="px-3 py-1 text-sm rounded-md border border-input bg-input hover:bg-accent disabled:opacity-50"
            >
              First
            </button>
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-3 py-1 text-sm rounded-md border border-input bg-input hover:bg-accent disabled:opacity-50"
            >
              Prev
            </button>
            <span className="px-2 text-sm text-muted-foreground">
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1 text-sm rounded-md border border-input bg-input hover:bg-accent disabled:opacity-50"
            >
              Next
            </button>
            <button
              onClick={() => setPage(totalPages - 1)}
              disabled={page >= totalPages - 1}
              className="px-3 py-1 text-sm rounded-md border border-input bg-input hover:bg-accent disabled:opacity-50"
            >
              Last
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}

const selCls = "rounded-md border border-input bg-input px-3 py-2 text-sm";
