import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/StatCard";
import { fmtMoney } from "@/lib/currency";
import { searchTrades } from "@/lib/search.functions";
import { Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/search")({
  head: () => ({ meta: [{ title: "Search — KI Market Inventory" }] }),
  component: SearchPage,
});

function SearchPage() {
  const [q, setQ] = useState("");
  const searchFn = useServerFn(searchTrades);
  const { data, isFetching } = useQuery({
    queryKey: ["search", q],
    queryFn: () => searchFn({ data: { q } }),
    placeholderData: (prev) => prev,
  });

  return (
    <AppShell title="Universal Search">
      <div className="max-w-2xl">
        <label className="relative block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search asset, exchange, route, status…"
            className="w-full rounded-lg border border-input bg-input pl-10 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </label>
        <p className="mt-2 text-xs text-muted-foreground">
          Searches your trades only. Try: <span className="text-foreground">USDT</span>,{" "}
          <span className="text-foreground">Binance</span>, <span className="text-foreground">closed</span>.
        </p>
      </div>

      <div className="mt-6">
        {isFetching && !data && <p className="text-sm text-muted-foreground">Searching…</p>}
        {data && data.length === 0 && (
          <p className="text-sm text-muted-foreground">No results.</p>
        )}
        {data && data.length > 0 && (
          <div className="space-y-2">
            {data.map((t) => {
              const profit = t.actual_profit != null ? Number(t.actual_profit) : Number(t.expected_profit ?? 0);
              const tone = profit >= 0 ? "profit" : "loss";
              return (
                <Link
                  key={t.id}
                  to="/trades/$tradeId"
                  params={{ tradeId: t.id }}
                  className="block rounded-lg border border-border bg-card p-3 hover:border-primary/50"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge tone="info">{t.asset}</Badge>
                      <span className="text-muted-foreground">{t.buy_exchange} → {t.sell_exchange}</span>
                      <Badge tone={t.status === "closed" ? "profit" : t.status === "cancelled" ? "loss" : "warning"}>
                        {t.status}
                      </Badge>
                    </div>
                    <div className={`tabular-nums font-medium text-[color:var(--${tone})]`}>
                      {fmtMoney(profit, t.currency ?? "NGN")}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
