import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Badge, StatCard } from "@/components/StatCard";
import { Btn, EmptyState, Section, TabBar, inputCls } from "@/components/ModuleUI";
import { fmtMoney, SUPPORTED_CURRENCIES } from "@/lib/currency";
import { hourlyEquivalent, monthlyEquivalent } from "@/lib/sabi";
import { listWork, addIncomeLog, deleteIncomeLog } from "@/lib/work.functions";

export const Route = createFileRoute("/_authenticated/work")({
  head: () => ({
    meta: [
      { title: "Work — jobs, gigs and what you really earn | Sabi" },
      {
        name: "description",
        content: "Jobs and gigs near you compared on real hourly pay, plus a log of what you actually earn.",
      },
      { property: "og:title", content: "Work — jobs, gigs and what you really earn | Sabi" },
      { property: "og:description", content: "Every job on one ruler: what it pays per hour and per month." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WorkPage,
});

const TABS = [
  { value: "gigs", label: "Find work" },
  { value: "earnings", label: "My earnings" },
] as const;

function WorkPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listWork);
  const addFn = useServerFn(addIncomeLog);
  const delFn = useServerFn(deleteIncomeLog);

  const [tab, setTab] = useState<(typeof TABS)[number]["value"]>("gigs");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["work", city, category, remoteOnly, q],
    queryFn: () =>
      listFn({
        data: {
          city: city || undefined,
          category: category || undefined,
          remoteOnly: remoteOnly || undefined,
          q: q || undefined,
        },
      }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["work"] });
    qc.invalidateQueries({ queryKey: ["today"] });
  };
  const add = useMutation({
    mutationFn: (p: Parameters<typeof addIncomeLog>[0]) => addFn(p),
    onSuccess: () => {
      toast.success("Earning logged.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({ mutationFn: (id: string) => delFn({ data: { id } }), onSuccess: invalidate });

  const income = data?.income ?? [];
  const totalEarned = income.reduce((a, r) => a + Number(r.amount), 0);
  const totalHours = income.reduce((a, r) => a + Number(r.hours), 0);
  const currency = income[0]?.currency ?? "NGN";
  const gigs = (data?.gigs ?? []).slice().sort((a, b) => hourlyEquivalent(Number(b.pay_amount), b.pay_unit) - hourlyEquivalent(Number(a.pay_amount), a.pay_unit));

  return (
    <AppShell title="Work" subtitle="What the job really pays, per hour">
      <div className="space-y-4">
        <TabBar tabs={TABS} value={tab} onChange={setTab} />

        {tab === "gigs" ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <input className={`${inputCls} w-44`} placeholder="Search work" value={q} onChange={(e) => setQ(e.target.value)} />
              <select className={`${inputCls} w-36`} value={city} onChange={(e) => setCity(e.target.value)}>
                <option value="">All cities</option>
                {data?.cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select className={`${inputCls} w-40`} value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">All kinds of work</option>
                {data?.categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={remoteOnly} onChange={(e) => setRemoteOnly(e.target.checked)} />
                Remote only
              </label>
            </div>

            <Section title="Ranked by real hourly pay" description="Daily, monthly and per-task pay all converted to one number.">
              {isLoading ? (
                <EmptyState title="Loading work…" />
              ) : gigs.length === 0 ? (
                <EmptyState title="No work matches your filters" />
              ) : (
                <div className="space-y-2">
                  {gigs.map((g) => (
                    <div key={g.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{g.title}</span>
                          {g.remote && <Badge tone="info">remote</Badge>}
                          <Badge>{g.skill_level}</Badge>
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {[g.location, g.city, g.category].filter(Boolean).join(" · ")}
                          {g.contact ? ` · ${g.contact}` : ""}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold tabular-nums">
                          {fmtMoney(hourlyEquivalent(Number(g.pay_amount), g.pay_unit), g.currency)}/hr
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {fmtMoney(Number(g.pay_amount), g.currency)}/{g.pay_unit} ·{" "}
                          {fmtMoney(monthlyEquivalent(Number(g.pay_amount), g.pay_unit), g.currency)}/mo
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="Earned (logged)" value={fmtMoney(totalEarned, currency)} tone="profit" />
              <StatCard label="Hours worked" value={totalHours.toFixed(1)} />
              <StatCard
                label="Your hourly rate"
                value={totalHours > 0 ? fmtMoney(totalEarned / totalHours, currency) : "—"}
                hint="Compare this against the jobs list"
              />
            </div>
            <IncomeForm onSubmit={(p) => add.mutate({ data: p })} pending={add.isPending} />
            <Section title="Earnings log">
              {income.length === 0 ? (
                <EmptyState title="Nothing logged yet" hint="Log a day's work to see your true hourly rate." />
              ) : (
                <div className="space-y-2">
                  {income.map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2">
                      <div className="min-w-0">
                        <div className="font-medium">{r.source}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.work_date} · {Number(r.hours)}h
                          {r.notes ? ` · ${r.notes}` : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="tabular-nums font-medium">{fmtMoney(Number(r.amount), r.currency)}</span>
                        <Btn variant="danger" onClick={() => del.mutate(r.id)}>
                          Delete
                        </Btn>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </>
        )}
      </div>
    </AppShell>
  );
}

function IncomeForm({
  onSubmit,
  pending,
}: {
  onSubmit: (p: {
    work_date: string;
    source: string;
    amount: number;
    currency: string;
    hours: number;
    notes: string | null;
  }) => void;
  pending: boolean;
}) {
  const [f, setF] = useState({
    work_date: new Date().toISOString().slice(0, 10),
    source: "",
    amount: "",
    currency: "NGN",
    hours: "",
    notes: "",
  });
  return (
    <Section title="Log what you earned" description="Money in, hours spent. Sabi does the maths.">
      <div className="grid gap-2 sm:grid-cols-3">
        <input className={inputCls} type="date" value={f.work_date} onChange={(e) => setF({ ...f, work_date: e.target.value })} />
        <input className={inputCls} placeholder="Where from (e.g. Bolt)" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} />
        <input className={inputCls} type="number" placeholder="Amount" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        <select className={inputCls} value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })}>
          {SUPPORTED_CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code}
            </option>
          ))}
        </select>
        <input className={inputCls} type="number" placeholder="Hours" value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} />
        <input className={inputCls} placeholder="Note (optional)" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
      </div>
      <div className="mt-3">
        <Btn
          disabled={pending || !f.source || !f.amount}
          onClick={() =>
            onSubmit({
              work_date: f.work_date,
              source: f.source.trim(),
              amount: Number(f.amount),
              currency: f.currency,
              hours: Number(f.hours) || 0,
              notes: f.notes.trim() || null,
            })
          }
        >
          {pending ? "Saving…" : "Log earning"}
        </Btn>
      </div>
    </Section>
  );
}
