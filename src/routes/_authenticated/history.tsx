import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/StatCard";
import { fmtMoney } from "@/lib/currency";
import { listTrades } from "@/lib/trades.functions";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({ meta: [{ title: "Trade History — KI Market Inventory" }] }),
  component: HistoryPage,
});

function HistoryPage() {
  const listFn = useServerFn(listTrades);
  const closed = useQuery({ queryKey: ["trade-history"], queryFn: () => listFn({ data: {} }) });

  const [routeFilter, setRouteFilter] = useState("all");
  const [plFilter, setPlFilter] = useState<"all" | "win" | "loss">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "closed" | "cancelled">("all");

  const rows = closed.data ?? [];
  const routes = useMemo(() => Array.from(new Set(rows.map((r) => r.route).filter(Boolean))) as string[], [rows]);

  const filtered = rows.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (statusFilter === "all" && r.status === "active") return false;
    if (routeFilter !== "all" && r.route !== routeFilter) return false;
    const p = Number(r.actual_profit ?? 0);
    if (plFilter === "win" && p <= 0) return false;
    if (plFilter === "loss" && p >= 0) return false;
    return true;
  });

  return (
    <AppShell title="Trade History">
      <div className="mb-4 flex flex-wrap gap-3">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as never)} className={selCls}>
          <option value="all">All (closed + cancelled)</option>
          <option value="closed">Closed only</option>
          <option value="cancelled">Cancelled only</option>
        </select>
        <select value={routeFilter} onChange={(e) => setRouteFilter(e.target.value)} className={selCls}>
          <option value="all">All routes</option>
          {routes.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={plFilter} onChange={(e) => setPlFilter(e.target.value as never)} className={selCls}>
          <option value="all">Wins & losses</option>
          <option value="win">Wins only</option>
          <option value="loss">Losses only</option>
        </select>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">No trades match those filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left py-3 px-4">Date</th>
                  <th className="text-left py-3 px-4">Route</th>
                  <th className="text-right py-3 px-4">Amount</th>
                  <th className="text-right py-3 px-4">Buy</th>
                  <th className="text-right py-3 px-4">Sell</th>
                  <th className="text-right py-3 px-4">P/L</th>
                  <th className="text-center py-3 px-4">KI verdict</th>
                  <th className="text-center py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {filtered.map((t) => {
                  const p = Number(t.actual_profit ?? 0);
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
      </div>
    </AppShell>
  );
}

const selCls = "rounded-md border border-input bg-input px-3 py-2 text-sm";
