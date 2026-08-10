import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/StatCard";
import { Btn, EmptyState, Section, TabBar, inputCls } from "@/components/ModuleUI";
import { fmtMoney, SUPPORTED_CURRENCIES } from "@/lib/currency";
import { freshnessLabel } from "@/lib/sabi";
import { listCare, addMedPrice, addReminder, markReminderTaken, deleteReminder } from "@/lib/care.functions";

export const Route = createFileRoute("/_authenticated/care")({
  head: () => ({
    meta: [
      { title: "Health — medicine prices & clinics | Sabi" },
      {
        name: "description",
        content: "Find your medicine in stock at the lowest price nearby, locate clinics, and never miss a dose.",
      },
      { property: "og:title", content: "Health — medicine prices & clinics | Sabi" },
      { property: "og:description", content: "Cheaper medicine, open clinics, and dose reminders in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CarePage,
});

const TABS = [
  { value: "medicine", label: "Medicine" },
  { value: "places", label: "Clinics & pharmacies" },
  { value: "reminders", label: "Reminders" },
] as const;

function CarePage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listCare);
  const addMedFn = useServerFn(addMedPrice);
  const addRemFn = useServerFn(addReminder);
  const takenFn = useServerFn(markReminderTaken);
  const delRemFn = useServerFn(deleteReminder);

  const [tab, setTab] = useState<(typeof TABS)[number]["value"]>("medicine");
  const [city, setCity] = useState("");
  const [q, setQ] = useState("");
  const [showMedForm, setShowMedForm] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["care", city, q],
    queryFn: () => listFn({ data: { city: city || undefined, q: q || undefined } }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["care"] });
    qc.invalidateQueries({ queryKey: ["today"] });
  };

  const addMed = useMutation({
    mutationFn: (p: Parameters<typeof addMedPrice>[0]) => addMedFn(p),
    onSuccess: () => {
      toast.success("Medicine price added.");
      setShowMedForm(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const addRem = useMutation({
    mutationFn: (p: Parameters<typeof addReminder>[0]) => addRemFn(p),
    onSuccess: () => {
      toast.success("Reminder set.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const taken = useMutation({
    mutationFn: (id: string) => takenFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Marked taken. Next dose scheduled.");
      invalidate();
    },
  });
  const delRem = useMutation({
    mutationFn: (id: string) => delRemFn({ data: { id } }),
    onSuccess: invalidate,
  });

  return (
    <AppShell title="Health" subtitle="Medicine that's in stock, at a price you can pay">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <TabBar tabs={TABS} value={tab} onChange={setTab} />
          <select className={`${inputCls} w-36`} value={city} onChange={(e) => setCity(e.target.value)}>
            <option value="">All cities</option>
            {data?.cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {tab === "medicine" && (
            <>
              <input
                className={`${inputCls} w-44`}
                placeholder="Search medicine"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <Btn onClick={() => setShowMedForm((s) => !s)}>{showMedForm ? "Close" : "Add a price"}</Btn>
            </>
          )}
        </div>

        {tab === "medicine" && (
          <>
            {showMedForm && <MedForm onSubmit={(p) => addMed.mutate({ data: p })} pending={addMed.isPending} />}
            <Section title="Where to buy it" description="Cheapest in-stock option first. Out-of-stock is flagged.">
              {isLoading ? (
                <EmptyState title="Loading…" />
              ) : (data?.drugs.length ?? 0) === 0 ? (
                <EmptyState title="No medicine prices yet" hint="Add the first one for your area." />
              ) : (
                <div className="space-y-3">
                  {data?.drugs.map((d) => (
                    <div key={`${d.drug}-${d.city}`} className="rounded-xl border border-border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="font-medium">{d.drug}</span>{" "}
                          <span className="text-xs text-muted-foreground">
                            {d.form} · {d.city}
                          </span>
                        </div>
                        {d.saving > 0 && (
                          <Badge tone="profit">save {fmtMoney(d.saving, d.currency)}</Badge>
                        )}
                      </div>
                      <div className="mt-2 space-y-1">
                        {d.options.map((o) => {
                          const fresh = freshnessLabel(o.observed_at);
                          return (
                            <div
                              key={o.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/60 px-3 py-1.5 text-sm"
                            >
                              <span className="min-w-0 truncate">
                                {o.pharmacy}
                                {o.area ? ` · ${o.area}` : ""}
                                {o.pack_size ? ` · ${o.pack_size}` : ""}
                              </span>
                              <span className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">{fresh.label}</span>
                                {o.in_stock ? (
                                  <Badge tone="profit">in stock</Badge>
                                ) : (
                                  <Badge tone="loss">out of stock</Badge>
                                )}
                                <span className="tabular-nums font-medium">{fmtMoney(o.price, o.currency)}</span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </>
        )}

        {tab === "places" && (
          <Section title="Clinics & pharmacies" description="Who is open, and how to reach them.">
            {(data?.facilities.length ?? 0) === 0 ? (
              <EmptyState title="Nothing listed for this city yet" />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {data?.facilities.map((f) => (
                  <div key={f.id} className="rounded-xl border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{f.name}</span>
                      <Badge tone={f.open_24h ? "profit" : "default"}>{f.open_24h ? "24 hours" : f.kind}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {[f.area, f.city, f.hours].filter(Boolean).join(" · ")}
                    </div>
                    {f.phone && (
                      <a href={`tel:${f.phone}`} className="mt-2 inline-block text-sm text-primary hover:underline">
                        Call {f.phone}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        {tab === "reminders" && (
          <>
            <ReminderForm onSubmit={(p) => addRem.mutate({ data: p })} pending={addRem.isPending} />
            <Section title="Your reminders" description="Mark a dose taken and Sabi schedules the next one.">
              {(data?.reminders.length ?? 0) === 0 ? (
                <EmptyState title="No reminders yet" hint="Add medicine, a bill, or a restock reminder." />
              ) : (
                <div className="space-y-2">
                  {data?.reminders.map((r) => (
                    <div
                      key={r.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2"
                    >
                      <div>
                        <div className="font-medium">{r.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.dose ? `${r.dose} · ` : ""}
                          {r.times_per_day}x daily · next {new Date(r.next_at).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Btn onClick={() => taken.mutate(r.id)}>Taken</Btn>
                        <Btn variant="danger" onClick={() => delRem.mutate(r.id)}>
                          Remove
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

function MedForm({
  onSubmit,
  pending,
}: {
  onSubmit: (p: {
    drug: string;
    form: string;
    pack_size: string | null;
    pharmacy: string;
    price: number;
    currency: string;
    in_stock: boolean;
    area: string | null;
    city: string;
    country: string;
  }) => void;
  pending: boolean;
}) {
  const [f, setF] = useState({
    drug: "",
    form: "tablet",
    pack_size: "",
    pharmacy: "",
    price: "",
    currency: "NGN",
    in_stock: true,
    area: "",
    city: "Lagos",
    country: "Nigeria",
  });
  return (
    <Section title="Add a medicine price" description="Help someone find their drug at a price they can afford.">
      <div className="grid gap-2 sm:grid-cols-3">
        <input className={inputCls} placeholder="Drug" value={f.drug} onChange={(e) => setF({ ...f, drug: e.target.value })} />
        <input className={inputCls} placeholder="Form (tablet, syrup)" value={f.form} onChange={(e) => setF({ ...f, form: e.target.value })} />
        <input className={inputCls} placeholder="Pack size" value={f.pack_size} onChange={(e) => setF({ ...f, pack_size: e.target.value })} />
        <input className={inputCls} placeholder="Pharmacy" value={f.pharmacy} onChange={(e) => setF({ ...f, pharmacy: e.target.value })} />
        <input className={inputCls} type="number" placeholder="Price" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
        <select className={inputCls} value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })}>
          {SUPPORTED_CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code}
            </option>
          ))}
        </select>
        <input className={inputCls} placeholder="Area" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} />
        <input className={inputCls} placeholder="City" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
        <input className={inputCls} placeholder="Country" value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.in_stock} onChange={(e) => setF({ ...f, in_stock: e.target.checked })} />
          In stock
        </label>
      </div>
      <div className="mt-3">
        <Btn
          disabled={pending || !f.drug || !f.pharmacy || !f.price}
          onClick={() =>
            onSubmit({
              drug: f.drug.trim(),
              form: f.form.trim() || "tablet",
              pack_size: f.pack_size.trim() || null,
              pharmacy: f.pharmacy.trim(),
              price: Number(f.price),
              currency: f.currency,
              in_stock: f.in_stock,
              area: f.area.trim() || null,
              city: f.city.trim(),
              country: f.country.trim(),
            })
          }
        >
          {pending ? "Saving…" : "Add price"}
        </Btn>
      </div>
    </Section>
  );
}

function ReminderForm({
  onSubmit,
  pending,
}: {
  onSubmit: (p: { label: string; kind: string; dose: string | null; times_per_day: number; next_at: string }) => void;
  pending: boolean;
}) {
  const [f, setF] = useState({ label: "", kind: "medicine", dose: "", times: "2", next: "" });
  return (
    <Section title="New reminder" description="Medicine doses, a bill, or restocking — Sabi keeps count.">
      <div className="grid gap-2 sm:grid-cols-3">
        <input className={inputCls} placeholder="What? (e.g. Coartem)" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} />
        <select className={inputCls} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
          <option value="medicine">medicine</option>
          <option value="bill">bill</option>
          <option value="restock">restock</option>
        </select>
        <input className={inputCls} placeholder="Dose (1 tablet)" value={f.dose} onChange={(e) => setF({ ...f, dose: e.target.value })} />
        <input className={inputCls} type="number" min={1} max={12} placeholder="Times per day" value={f.times} onChange={(e) => setF({ ...f, times: e.target.value })} />
        <input className={inputCls} type="datetime-local" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} />
      </div>
      <div className="mt-3">
        <Btn
          disabled={pending || !f.label}
          onClick={() =>
            onSubmit({
              label: f.label.trim(),
              kind: f.kind,
              dose: f.dose.trim() || null,
              times_per_day: Number(f.times) || 1,
              next_at: f.next ? new Date(f.next).toISOString() : new Date().toISOString(),
            })
          }
        >
          {pending ? "Saving…" : "Set reminder"}
        </Btn>
      </div>
    </Section>
  );
}
