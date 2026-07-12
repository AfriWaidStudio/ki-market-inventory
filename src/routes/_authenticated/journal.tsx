import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/StatCard";
import { fmtMoney } from "@/lib/currency";
import { listTradesPaginated } from "@/lib/trades.functions";

export const Route = createFileRoute("/_authenticated/journal")({
  head: () => ({ meta: [{ title: "Journal — KI Market Inventory" }] }),
  component: JournalPage,
});

function JournalPage() {
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const listFn = useServerFn(listTradesPaginated);
  const opts = queryOptions({
    queryKey: ["trades", "closed-journal", page],
    queryFn: () => listFn({ data: { status: "closed", offset: page * pageSize, limit: pageSize } }),
  });
  const { data } = useSuspenseQuery(opts);

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <AppShell title="Trade Journal">
      <p className="text-sm text-muted-foreground max-w-2xl">
        Every closed trade generates a draft journal entry from your actual records. Lessons are estimated
        from KI's post-trade analysis — you can correct them on the trade detail page.
      </p>

      {rows.length === 0 ? (
        <div className="mt-6 rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No closed trades yet. Close a trade on the <Link to="/trades" className="text-primary underline">Active Trades</Link> page
          to start your journal.
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {rows.map((t) => {
            const profit = t.actual_profit != null ? Number(t.actual_profit) : 0;
            const tone = profit >= 0 ? "profit" : "loss";
            return (
              <Link
                key={t.id}
                to="/trades/$tradeId"
                params={{ tradeId: t.id }}
                className="block rounded-xl border border-border bg-card p-4 hover:border-primary/50 transition"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Badge tone="info">{t.asset}</Badge>
                    <span className="text-muted-foreground">
                      {t.buy_exchange} → {t.sell_exchange}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(t.sell_time ?? t.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className={`text-sm font-medium tabular-nums text-[color:var(--${tone})]`}>
                    {fmtMoney(profit, t.currency ?? "NGN")}
                  </div>
                </div>
                {t.lesson_learned && (
                  <p className="mt-2 text-sm text-muted-foreground italic">"{t.lesson_learned}"</p>
                )}
                {t.ki_accuracy_verdict && (
                  <p className="mt-1 text-xs text-muted-foreground">KI: {t.ki_accuracy_verdict}</p>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
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
    </AppShell>
  );
}
