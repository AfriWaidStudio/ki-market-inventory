import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/StatCard";
import { fmtMoney } from "@/lib/currency";
import { listTrades } from "@/lib/trades.functions";

export const Route = createFileRoute("/_authenticated/journal")({
  head: () => ({ meta: [{ title: "Journal — KI Market Inventory" }] }),
  component: JournalPage,
});

function JournalPage() {
  const listFn = useServerFn(listTrades);
  const opts = queryOptions({
    queryKey: ["trades", "closed-journal"],
    queryFn: () => listFn({ data: { status: "closed" } }),
  });
  const { data } = useSuspenseQuery(opts);

  return (
    <AppShell title="Trade Journal">
      <p className="text-sm text-muted-foreground max-w-2xl">
        Every closed trade generates a draft journal entry from your actual records. Lessons are estimated
        from KI's post-trade analysis — you can correct them on the trade detail page.
      </p>

      {data.length === 0 ? (
        <div className="mt-6 rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No closed trades yet. Close a trade on the <Link to="/trades" className="text-primary underline">Active Trades</Link> page
          to start your journal.
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {data.map((t) => {
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
    </AppShell>
  );
}
