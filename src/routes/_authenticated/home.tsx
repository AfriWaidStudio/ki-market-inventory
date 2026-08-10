import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/StatCard";
import { EmptyState } from "@/components/ModuleUI";
import { fmtMoney } from "@/lib/currency";
import { freshnessLabel, hourlyEquivalent } from "@/lib/sabi";
import { todayBrief } from "@/lib/today.functions";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Today — Sabi" },
      { name: "description", content: "What changed in your prices, health, work and shop today." },
      { property: "og:title", content: "Today — Sabi" },
      { property: "og:description", content: "One screen: what to buy, where, and what you made today." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TodayPage,
});

function TodayPage() {
  const briefFn = useServerFn(todayBrief);
  const { data, isLoading } = useQuery({ queryKey: ["today"], queryFn: () => briefFn() });

  if (isLoading || !data) {
    return (
      <AppShell title="Today">
        <EmptyState title="Getting today's numbers…" />
      </AppShell>
    );
  }

  const greeting = data.displayName ? `Hi ${data.displayName.split(" ")[0]}` : "Hi";

  return (
    <AppShell title="Today" subtitle="The five things worth knowing right now">
      <div className="space-y-5">
        {/* The 5-second answer */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">{greeting} — here's the short version.</p>
          <p className="mt-2 text-2xl font-semibold leading-snug md:text-3xl">
            You can save{" "}
            <span className="text-[color:var(--profit)]">
              {fmtMoney(data.potentialSaving, data.topSavings[0]?.currency ?? data.currency)}
            </span>{" "}
            by buying in the right place today.
          </p>
          {data.salesToday > 0 && (
            <p className="mt-1 text-sm text-muted-foreground">
              Your shop made {fmtMoney(data.todayProfit, data.currency)} profit on {data.salesToday} sale
              {data.salesToday > 1 ? "s" : ""} so far.
            </p>
          )}
        </div>

        {/* Buy here, not there */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Buy here, not there</h2>
            <Link to="/market" className="text-sm text-primary hover:underline">
              All prices
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {data.topSavings.length === 0 ? (
              <EmptyState title="No price reports yet" hint="Add one on the Prices tab." />
            ) : (
              data.topSavings.map((s) => {
                const fresh = freshnessLabel(s.observedAt);
                return (
                  <div
                    key={`${s.item}-${s.city}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{s.item}</span>
                        {s.watched && <Badge tone="info">watching</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {fmtMoney(s.cheapPrice, s.currency)} per {s.unit} at {s.cheapVendor} · {s.city} ·{" "}
                        {fresh.label}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-[color:var(--profit)]">
                        save {fmtMoney(s.spread, s.currency)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        vs {fmtMoney(s.dearPrice, s.currency)} elsewhere
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-3">
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-base font-semibold">Health</h2>
            {data.medTip ? (
              <>
                <p className="mt-2 text-sm">
                  <span className="font-medium">{data.medTip.drug}</span> is{" "}
                  {fmtMoney(data.medTip.price, data.medTip.currency)} at {data.medTip.pharmacy}.
                </p>
                <p className="mt-1 text-xs text-[color:var(--profit)]">
                  {fmtMoney(data.medTip.saving, data.medTip.currency)} cheaper than the priciest option in{" "}
                  {data.medTip.city}.
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No medicine prices for your area yet.</p>
            )}
            {data.nextReminder && (
              <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs">
                Next reminder: <span className="font-medium">{data.nextReminder.label}</span> at{" "}
                {new Date(data.nextReminder.next_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}
            <Link to="/care" className="mt-3 inline-block text-sm text-primary hover:underline">
              Open Health
            </Link>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-base font-semibold">Work</h2>
            <p className="mt-2 text-sm">
              You earned {fmtMoney(data.weekIncome, data.currency)} in 7 days
              {data.weekHours > 0 && <> — {fmtMoney(data.hourlyRate, data.currency)} an hour.</>}
            </p>
            <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
              {data.newGigs.slice(0, 3).map((g) => (
                <li key={g.id} className="truncate">
                  {g.title} · {fmtMoney(hourlyEquivalent(Number(g.pay_amount), g.pay_unit), g.currency)}/hr
                </li>
              ))}
            </ul>
            <Link to="/work" className="mt-3 inline-block text-sm text-primary hover:underline">
              Open Work
            </Link>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-base font-semibold">My Shop</h2>
            <p className="mt-2 text-sm">
              Today: <span className="font-semibold">{fmtMoney(data.todayProfit, data.currency)}</span> profit
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              7 days: {fmtMoney(data.weekProfit, data.currency)}
            </p>
            <Link to="/shop" className="mt-3 inline-block text-sm text-primary hover:underline">
              Open My Shop
            </Link>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
