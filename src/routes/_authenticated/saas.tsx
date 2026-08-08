import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Badge, StatCard } from "@/components/StatCard";
import { Btn, EmptyState, Section, TabBar, downloadCsv, inputCls } from "@/components/ModuleUI";
import { fmtMoney, fmtNumber, fmtPercent } from "@/lib/currency";
import { BILLING_CYCLES, SAAS_CATEGORIES, utilization, wastedMonthly } from "@/lib/saas";
import {
  listSaasSpend,
  addSaasVendor,
  addSaasSubscription,
  repriceSubscription,
  setSubscriptionStatus,
} from "@/lib/saas.functions";

export const Route = createFileRoute("/_authenticated/saas")({
  head: () => ({
    meta: [
      { title: "SaaS Spend Control — Waides KI" },
      {
        name: "description",
        content:
          "See every subscription, seat waste, duplicate tool and renewal deadline before auto-renew charges you again.",
      },
      { property: "og:title", content: "SaaS Spend Control — Waides KI" },
      {
        property: "og:description",
        content: "Renewal radar, seat utilisation and duplicate-tool detection in one desk.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SaasPage,
});

type Tab = "portfolio" | "renewals" | "waste" | "add" | "history";

const TABS = [
  { value: "portfolio", label: "Portfolio" },
  { value: "renewals", label: "Renewal radar" },
  { value: "waste", label: "Waste & duplicates" },
  { value: "add", label: "Add" },
  { value: "history", label: "Price history" },
] as const;

const URGENCY_TONE: Record<string, "profit" | "loss" | "warning" | "default"> = {
  overdue: "loss",
  act_now: "loss",
  soon: "warning",
  planned: "profit",
  unknown: "default",
};

function SaasPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listSaasSpend);
  const vendorFn = useServerFn(addSaasVendor);
  const subFn = useServerFn(addSaasSubscription);
  const repriceFn = useServerFn(repriceSubscription);
  const statusFn = useServerFn(setSubscriptionStatus);

  const [tab, setTab] = useState<Tab>("portfolio");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  const spend = useQuery({ queryKey: ["saas"], queryFn: () => listFn() });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["saas"] });

  const data = spend.data;
  const subs = data?.subscriptions ?? [];
  const summary = data?.summary;

  const filtered = useMemo(
    () =>
      subs
        .filter((s) => (category === "all" ? true : s.category === category))
        .filter((s) =>
          search
            ? `${s.vendor_name} ${s.plan}`.toLowerCase().includes(search.toLowerCase())
            : true,
        ),
    [subs, search, category],
  );

  const reprice = useMutation({
    mutationFn: (v: { id: string; new_unit_cost: number }) => repriceFn({ data: v }),
    onSuccess: () => {
      toast.success("Repriced — delta logged");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: (v: { id: string; status: "active" | "cancelled" | "paused" }) =>
      statusFn({ data: v }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const currency = subs[0]?.currency ?? "USD";

  return (
    <AppShell title="SaaS Spend">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Monthly spend" value={fmtMoney(summary?.monthlyTotal ?? 0, currency)} />
          <StatCard label="Annual run-rate" value={fmtMoney(summary?.annualTotal ?? 0, currency)} />
          <StatCard
            label="Seat waste / mo"
            value={fmtMoney(summary?.wastedMonthly ?? 0, currency)}
            tone={(summary?.wastedMonthly ?? 0) > 0 ? "loss" : "profit"}
          />
          <StatCard
            label="Savings found / yr"
            value={fmtMoney(summary?.savingsFound ?? 0, currency)}
            tone="profit"
          />
          <StatCard
            label="Renewals ≤30d"
            value={String(summary?.renewalsNext30 ?? 0)}
            tone={(summary?.renewalsNext30 ?? 0) > 0 ? "warning" : "default"}
          />
        </div>

        <TabBar tabs={TABS} value={tab} onChange={setTab} />

        {tab === "portfolio" && (
          <Section
            title="Subscription portfolio"
            description="Normalised to monthly so annual plans stop hiding their true weight."
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className={`${inputCls} w-40`}
                  placeholder="Search vendor"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select
                  className={`${inputCls} w-40`}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="all">All categories</option>
                  {SAAS_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <Btn
                  variant="ghost"
                  onClick={() =>
                    downloadCsv(
                      "saas-portfolio.csv",
                      filtered.map((s) => ({
                        vendor: s.vendor_name,
                        plan: s.plan,
                        seats: s.seats,
                        active_seats: s.active_seats ?? "",
                        monthly: s.monthly,
                        cycle: s.billing_cycle,
                        renewal: s.renewal_date ?? "",
                        status: s.status,
                      })),
                    )
                  }
                >
                  Export CSV
                </Btn>
              </div>
            }
          >
            {spend.isLoading ? (
              <EmptyState title="Loading spend…" />
            ) : filtered.length === 0 ? (
              <EmptyState title="No subscriptions yet" hint="Add a vendor and a plan on the Add tab." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="py-2 text-left">Vendor</th>
                      <th className="py-2 text-left">Plan</th>
                      <th className="py-2 text-right">Seats</th>
                      <th className="py-2 text-right">Utilisation</th>
                      <th className="py-2 text-right">Monthly</th>
                      <th className="py-2 text-left">Renewal</th>
                      <th className="py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => {
                      const util = utilization(s);
                      return (
                        <tr key={s.id} className="border-b border-border/50">
                          <td className="py-2">{s.vendor_name}</td>
                          <td className="py-2 text-xs text-muted-foreground">
                            {s.plan} · {s.billing_cycle}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {s.active_seats ?? "—"}/{s.seats}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {util == null ? "—" : fmtPercent(util)}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {fmtMoney(s.monthly, s.currency)}
                          </td>
                          <td className="py-2">
                            <Badge tone={URGENCY_TONE[s.urgency] ?? "default"}>
                              {s.renewal_date ?? "no date"}
                              {s.daysToDecide != null ? ` · ${s.daysToDecide}d` : ""}
                            </Badge>
                          </td>
                          <td className="py-2 text-right">
                            <div className="flex justify-end gap-1">
                              <Btn
                                variant="ghost"
                                onClick={() => {
                                  const v = window.prompt("New unit cost", String(s.unit_cost));
                                  if (v && Number(v) >= 0)
                                    reprice.mutate({ id: s.id, new_unit_cost: Number(v) });
                                }}
                              >
                                Reprice
                              </Btn>
                              <Btn
                                variant="danger"
                                onClick={() =>
                                  setStatus.mutate({
                                    id: s.id,
                                    status: s.status === "active" ? "cancelled" : "active",
                                  })
                                }
                              >
                                {s.status === "active" ? "Cancel" : "Reactivate"}
                              </Btn>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        )}

        {tab === "renewals" && (
          <Section
            title="Renewal radar"
            description="Sorted by the last day you can still cancel without paying another cycle."
          >
            {subs.filter((s) => s.renewal_date).length === 0 ? (
              <EmptyState title="No renewal dates recorded" />
            ) : (
              <div className="space-y-2">
                {[...subs]
                  .filter((s) => s.renewal_date)
                  .sort((a, b) => (a.daysToDecide ?? 9999) - (b.daysToDecide ?? 9999))
                  .map((s) => (
                    <div
                      key={s.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                    >
                      <div>
                        <div className="text-sm font-medium">
                          {s.vendor_name} · {s.plan}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Renews {s.renewal_date} · {s.cancellation_notice_days}d notice ·{" "}
                          {s.auto_renew ? "auto-renew ON" : "manual"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={URGENCY_TONE[s.urgency] ?? "default"}>
                          {s.urgency.replace("_", " ")}
                        </Badge>
                        <span className="text-sm tabular-nums">
                          {fmtMoney(s.monthly, s.currency)}/mo
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </Section>
        )}

        {tab === "waste" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="Seat waste" description="Paid seats nobody logged into.">
              {subs.filter((s) => wastedMonthly(s) > 0).length === 0 ? (
                <EmptyState title="No measurable seat waste" hint="Record active seats to unlock this." />
              ) : (
                <div className="space-y-2">
                  {subs
                    .filter((s) => wastedMonthly(s) > 0)
                    .sort((a, b) => wastedMonthly(b) - wastedMonthly(a))
                    .map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                      >
                        <span>{s.vendor_name}</span>
                        <span className="text-[color:var(--loss)] tabular-nums">
                          {fmtMoney(wastedMonthly(s), s.currency)}/mo
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </Section>
            <Section title="Duplicate tools" description="Same job, two invoices.">
              {(data?.duplicates ?? []).length === 0 ? (
                <EmptyState title="No overlapping categories detected" />
              ) : (
                <div className="space-y-2">
                  {(data?.duplicates ?? []).map((g, i) => (
                    <div key={i} className="rounded-lg border border-border px-3 py-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{g.category}</span>
                        <span className="text-[color:var(--profit)] tabular-nums">
                          save {fmtMoney(g.potentialSaving, currency)}/mo
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {g.subscriptions.map((s) => s.vendor_name).join(" · ")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>
        )}

        {tab === "add" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="Add vendor">
              <VendorForm
                onSubmit={async (v) => {
                  try {
                    await vendorFn({ data: v });
                    toast.success("Vendor saved");
                    invalidate();
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
              />
            </Section>
            <Section title="Add subscription">
              <SubForm
                vendors={(data?.vendors ?? []).map((v) => ({ id: v.id, name: v.name }))}
                onSubmit={async (v) => {
                  try {
                    await subFn({ data: v });
                    toast.success("Subscription added");
                    invalidate();
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
              />
            </Section>
          </div>
        )}

        {tab === "history" && (
          <Section title="Price events" description="Every increase your vendors slipped in.">
            {(data?.priceEvents ?? []).length === 0 ? (
              <EmptyState title="No price changes recorded yet" />
            ) : (
              <div className="space-y-2">
                {(data?.priceEvents ?? []).map((e) => {
                  const delta = Number(e.new_amount) - Number(e.old_amount);
                  return (
                    <div
                      key={e.id}
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <span className="text-xs text-muted-foreground">{e.effective_date}</span>
                      <span className="tabular-nums">
                        {fmtNumber(Number(e.old_amount))} → {fmtNumber(Number(e.new_amount))}
                      </span>
                      <Badge tone={delta > 0 ? "loss" : "profit"}>
                        {delta > 0 ? "+" : ""}
                        {fmtNumber(delta)}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        )}
      </div>
    </AppShell>
  );
}

function VendorForm({
  onSubmit,
}: {
  onSubmit: (v: { name: string; category: string | null; website: string | null }) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState(SAAS_CATEGORIES[0]);
  const [website, setWebsite] = useState("");
  return (
    <div className="space-y-3">
      <input className={inputCls} placeholder="Vendor name" value={name} onChange={(e) => setName(e.target.value)} />
      <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
        {SAAS_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <input className={inputCls} placeholder="Website" value={website} onChange={(e) => setWebsite(e.target.value)} />
      <Btn disabled={!name.trim()} onClick={() => onSubmit({ name: name.trim(), category, website: website || null })}>
        Save vendor
      </Btn>
    </div>
  );
}

function SubForm({
  vendors,
  onSubmit,
}: {
  vendors: { id: string; name: string }[];
  onSubmit: (v: {
    vendor_id: string;
    plan: string;
    seats: number;
    active_seats: number | null;
    unit_cost: number;
    currency: string;
    billing_cycle: "monthly" | "quarterly" | "annual";
    renewal_date: string | null;
    auto_renew: boolean;
    cancellation_notice_days: number;
  }) => void;
}) {
  const [vendorId, setVendorId] = useState(vendors[0]?.id ?? "");
  const [plan, setPlan] = useState("Standard");
  const [seats, setSeats] = useState(1);
  const [activeSeats, setActiveSeats] = useState(1);
  const [cost, setCost] = useState(0);
  const [currency, setCurrency] = useState("USD");
  const [cycle, setCycle] = useState<"monthly" | "quarterly" | "annual">("monthly");
  const [renewal, setRenewal] = useState("");
  const [autoRenew, setAutoRenew] = useState(true);
  const [notice, setNotice] = useState(30);

  if (!vendors.length) return <EmptyState title="Add a vendor first" />;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <select className={inputCls} value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
        {vendors.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </select>
      <input className={inputCls} placeholder="Plan" value={plan} onChange={(e) => setPlan(e.target.value)} />
      <input className={inputCls} type="number" placeholder="Seats" value={seats} onChange={(e) => setSeats(Number(e.target.value))} />
      <input className={inputCls} type="number" placeholder="Active seats" value={activeSeats} onChange={(e) => setActiveSeats(Number(e.target.value))} />
      <input className={inputCls} type="number" placeholder="Unit cost" value={cost} onChange={(e) => setCost(Number(e.target.value))} />
      <input className={inputCls} placeholder="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)} />
      <select className={inputCls} value={cycle} onChange={(e) => setCycle(e.target.value as typeof cycle)}>
        {BILLING_CYCLES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <input className={inputCls} type="date" value={renewal} onChange={(e) => setRenewal(e.target.value)} />
      <input className={inputCls} type="number" placeholder="Notice days" value={notice} onChange={(e) => setNotice(Number(e.target.value))} />
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={autoRenew} onChange={(e) => setAutoRenew(e.target.checked)} />
        Auto-renew
      </label>
      <div className="md:col-span-2">
        <Btn
          onClick={() =>
            onSubmit({
              vendor_id: vendorId,
              plan,
              seats,
              active_seats: activeSeats,
              unit_cost: cost,
              currency,
              billing_cycle: cycle,
              renewal_date: renewal || null,
              auto_renew: autoRenew,
              cancellation_notice_days: notice,
            })
          }
        >
          Add subscription
        </Btn>
      </div>
    </div>
  );
}
