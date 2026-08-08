import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Badge, StatCard } from "@/components/StatCard";
import { Btn, EmptyState, Section, TabBar, downloadCsv, inputCls } from "@/components/ModuleUI";
import { fmtMoney, fmtNumber } from "@/lib/currency";
import { listRetailProducts } from "@/lib/retail.functions";
import { listSaasSpend } from "@/lib/saas.functions";
import { listFreightLanes } from "@/lib/freight.functions";

export const Route = createFileRoute("/_authenticated/opportunities")({
  head: () => ({
    meta: [
      { title: "Opportunity Feed — Waides KI" },
      {
        name: "description",
        content:
          "One ranked feed of every money-saving and money-making signal across retail, SaaS spend and freight lanes.",
      },
      { property: "og:title", content: "Opportunity Feed — Waides KI" },
      {
        property: "og:description",
        content: "Cross-module signals ranked by the value they release this month.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OpportunitiesPage,
});

type Module = "all" | "retail" | "saas" | "freight";

const TABS = [
  { value: "all", label: "All signals" },
  { value: "retail", label: "Retail" },
  { value: "saas", label: "SaaS" },
  { value: "freight", label: "Freight" },
] as const;

interface Signal {
  id: string;
  module: Exclude<Module, "all">;
  title: string;
  detail: string;
  value: number;
  currency: string;
  kind: "profit" | "saving";
  confidence: number;
  href: "/retail" | "/saas" | "/freight";
}

function OpportunitiesPage() {
  const retailFn = useServerFn(listRetailProducts);
  const saasFn = useServerFn(listSaasSpend);
  const freightFn = useServerFn(listFreightLanes);

  const [tab, setTab] = useState<Module>("all");
  const [minValue, setMinValue] = useState(0);
  const [search, setSearch] = useState("");

  const retail = useQuery({ queryKey: ["retail"], queryFn: () => retailFn() });
  const saas = useQuery({ queryKey: ["saas"], queryFn: () => saasFn() });
  const freight = useQuery({ queryKey: ["freight"], queryFn: () => freightFn() });

  const signals = useMemo<Signal[]>(() => {
    const out: Signal[] = [];

    for (const r of retail.data ?? []) {
      const best = r.best;
      if (!best || best.profit <= 0) continue;
      out.push({
        id: `retail-${r.product.id}`,
        module: "retail",
        title: `${r.product.title}: ${best.source.marketplace} → ${best.resale.marketplace}`,
        detail: `Landed ${fmtNumber(best.landedCost)} · net ${fmtNumber(best.netProceeds)} · margin ${(best.marginPct * 100).toFixed(1)}%`,
        value: best.profit,
        currency: best.resale.currency,
        kind: "profit",
        confidence: best.confidence,
        href: "/retail",
      });
    }

    const spend = saas.data;
    if (spend) {
      for (const s of spend.subscriptions) {
        const seats = s.seats - (s.active_seats ?? s.seats);
        if (seats > 0) {
          out.push({
            id: `saas-waste-${s.id}`,
            module: "saas",
            title: `${s.vendor_name}: ${seats} unused seat${seats > 1 ? "s" : ""}`,
            detail: `${s.plan} · ${s.billing_cycle} · drop seats before ${s.renewal_date ?? "renewal"}`,
            value: (s.monthly / Math.max(1, s.seats)) * seats * 12,
            currency: s.currency,
            kind: "saving",
            confidence: 0.9,
            href: "/saas",
          });
        }
      }
      for (const g of spend.duplicates) {
        out.push({
          id: `saas-dupe-${g.category}`,
          module: "saas",
          title: `Duplicate ${g.category} tools`,
          detail: g.subscriptions.map((s) => s.vendor_name).join(" · "),
          value: g.potentialSaving * 12,
          currency: g.subscriptions[0]?.currency ?? "USD",
          kind: "saving",
          confidence: 0.7,
          href: "/saas",
        });
      }
    }

    for (const l of freight.data?.lanes ?? []) {
      if (l.rates.length < 2) continue;
      const totals = l.rates.map((r) => r.base_rate + r.surcharges);
      const gap = Math.max(...totals) - Math.min(...totals);
      if (gap <= 0) continue;
      out.push({
        id: `freight-${l.lane.id}`,
        module: "freight",
        title: `${l.lane.origin} → ${l.lane.destination}: carrier spread`,
        detail: `${l.rates.length} carriers quoted · ${l.lane.mode} ${l.lane.equipment}`,
        value: gap,
        currency: l.rates[0]?.currency ?? "USD",
        kind: "saving",
        confidence: 0.8,
        href: "/freight",
      });
    }

    return out.sort((a, b) => b.value - a.value);
  }, [retail.data, saas.data, freight.data]);

  const filtered = signals
    .filter((s) => (tab === "all" ? true : s.module === tab))
    .filter((s) => s.value >= minValue)
    .filter((s) => (search ? s.title.toLowerCase().includes(search.toLowerCase()) : true));

  const loading = retail.isLoading || saas.isLoading || freight.isLoading;
  const totalValue = filtered.reduce((a, s) => a + s.value, 0);
  const currency = filtered[0]?.currency ?? "USD";

  return (
    <AppShell title="Opportunity Feed">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Value on the table"
            value={fmtMoney(totalValue, currency)}
            tone="profit"
            hint="Annualised where recurring"
          />
          <StatCard label="Signals" value={String(filtered.length)} />
          <StatCard
            label="Profit plays"
            value={String(filtered.filter((s) => s.kind === "profit").length)}
          />
          <StatCard
            label="Savings plays"
            value={String(filtered.filter((s) => s.kind === "saving").length)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <TabBar tabs={TABS} value={tab} onChange={setTab} />
          <input
            className={`${inputCls} w-48`}
            placeholder="Search signals"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <input
            className={`${inputCls} w-32`}
            type="number"
            placeholder="Min value"
            value={minValue}
            onChange={(e) => setMinValue(Number(e.target.value))}
          />
          <Btn
            variant="ghost"
            onClick={() =>
              downloadCsv(
                "opportunity-feed.csv",
                filtered.map((s) => ({
                  module: s.module,
                  title: s.title,
                  detail: s.detail,
                  value: s.value,
                  currency: s.currency,
                  kind: s.kind,
                })),
              )
            }
          >
            Export CSV
          </Btn>
        </div>

        <Section
          title="Ranked signals"
          description="Every module competing for the same attention, ranked by value released."
        >
          {loading ? (
            <EmptyState title="Scanning every module…" />
          ) : filtered.length === 0 ? (
            <EmptyState
              title="No signals above your threshold"
              hint="Add products, subscriptions or lane rates and they show up here automatically."
            />
          ) : (
            <div className="space-y-2">
              {filtered.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge tone="info">{s.module}</Badge>
                      <span className="truncate text-sm font-medium">{s.title}</span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">{s.detail}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge tone={s.confidence > 0.75 ? "profit" : "warning"}>
                      conf {Math.round(s.confidence * 100)}
                    </Badge>
                    <span className="text-sm tabular-nums text-[color:var(--profit)]">
                      {fmtMoney(s.value, s.currency)}
                    </span>
                    <Link
                      to={s.href}
                      className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
                    >
                      Open
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </AppShell>
  );
}
