import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Star, StarOff } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/StatCard";
import { Btn, EmptyState, Section, inputCls, downloadCsv } from "@/components/ModuleUI";
import { fmtMoney } from "@/lib/currency";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";
import { freshnessLabel, PRICE_CATEGORIES } from "@/lib/sabi";
import { listMarket, addPriceReport, toggleSavedItem } from "@/lib/market.functions";

export const Route = createFileRoute("/_authenticated/market")({
  head: () => ({
    meta: [
      { title: "Prices near you — Sabi" },
      {
        name: "description",
        content: "Compare what food, gas, fuel, transport and data cost across markets and vendors near you.",
      },
      { property: "og:title", content: "Prices near you — Sabi" },
      { property: "og:description", content: "Community-reported prices, ranked by where you save the most." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MarketPage,
});

function MarketPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMarket);
  const addFn = useServerFn(addPriceReport);
  const saveFn = useServerFn(toggleSavedItem);

  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);

  const filters = { city: city || undefined, category: category || undefined, q: q || undefined };
  const { data, isLoading } = useQuery({
    queryKey: ["market", city, category, q],
    queryFn: () => listFn({ data: filters }),
  });

  const toggle = useMutation({
    mutationFn: (item: string) => saveFn({ data: { item } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["market"] }),
  });

  const add = useMutation({
    mutationFn: (payload: Parameters<typeof addPriceReport>[0]) => addFn(payload),
    onSuccess: () => {
      toast.success("Price added. Thank you — this helps everyone.");
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ["market"] });
      qc.invalidateQueries({ queryKey: ["today"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const items = data?.items ?? [];
  const saved = new Set(data?.saved ?? []);

  return (
    <AppShell title="Prices near you" subtitle="What people actually paid, and where">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className={`${inputCls} w-44`}
            placeholder="Search item"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select className={`${inputCls} w-36`} value={city} onChange={(e) => setCity(e.target.value)}>
            <option value="">All cities</option>
            {data?.cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select className={`${inputCls} w-36`} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {data?.categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <Btn onClick={() => setShowForm((s) => !s)}>{showForm ? "Close" : "Report a price"}</Btn>
          <Btn
            variant="ghost"
            onClick={() =>
              downloadCsv(
                "sabi-prices.csv",
                items.map((i) => ({
                  item: i.item,
                  unit: i.unit,
                  city: i.city,
                  cheapest: i.cheapest.price,
                  where: i.cheapest.vendor ?? i.cheapest.area,
                  dearest: i.dearest.price,
                  save: i.spread,
                })),
              )
            }
          >
            Export
          </Btn>
        </div>

        {showForm && <ReportForm onSubmit={(p) => add.mutate({ data: p })} pending={add.isPending} />}

        <Section title="Biggest gaps today" description="Same item, same city — different price. Buy on the left.">
          {isLoading ? (
            <EmptyState title="Loading prices…" />
          ) : items.length === 0 ? (
            <EmptyState title="No prices match" hint="Try another city, or report the first price yourself." />
          ) : (
            <div className="space-y-2">
              {items.map((i) => {
                const fresh = freshnessLabel(i.freshestAt);
                return (
                  <div key={`${i.item}-${i.city}-${i.unit}`} className="rounded-xl border border-border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggle.mutate(i.item)}
                            aria-label={saved.has(i.item) ? "Stop watching" : "Watch this item"}
                            className="text-muted-foreground hover:text-primary"
                          >
                            {saved.has(i.item) ? (
                              <Star className="h-4 w-4 fill-current text-primary" />
                            ) : (
                              <StarOff className="h-4 w-4" />
                            )}
                          </button>
                          <span className="font-medium">{i.item}</span>
                          <Badge>{i.category}</Badge>
                          <Badge tone={fresh.tone}>{fresh.label}</Badge>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          per {i.unit} · {i.city} · {i.count} report{i.count > 1 ? "s" : ""} · typical{" "}
                          {fmtMoney(i.median, i.currency)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-[color:var(--profit)]">
                          {fmtMoney(i.cheapest.price, i.currency)}
                        </div>
                        <div className="text-xs text-muted-foreground line-through">
                          {fmtMoney(i.dearest.price, i.currency)}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-lg bg-[color:var(--profit)]/10 px-2 py-1 text-[color:var(--profit)]">
                        Cheapest: {i.cheapest.vendor ?? "—"}
                        {i.cheapest.area ? `, ${i.cheapest.area}` : ""}
                      </span>
                      <span className="rounded-lg bg-muted px-2 py-1 text-muted-foreground">
                        Priciest: {i.dearest.vendor ?? "—"}
                        {i.dearest.area ? `, ${i.dearest.area}` : ""}
                      </span>
                      <span className="font-medium text-[color:var(--profit)]">
                        Save {fmtMoney(i.spread, i.currency)} ({(i.savingsPct * 100).toFixed(0)}%)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>
      </div>
    </AppShell>
  );
}

function ReportForm({
  onSubmit,
  pending,
}: {
  onSubmit: (p: {
    item: string;
    category: string;
    unit: string;
    price: number;
    currency: string;
    vendor: string | null;
    area: string | null;
    city: string;
    country: string;
  }) => void;
  pending: boolean;
}) {
  const [f, setF] = useState({
    item: "",
    category: "food",
    unit: "unit",
    price: "",
    currency: "NGN",
    vendor: "",
    area: "",
    city: "Lagos",
    country: "Nigeria",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.value });

  return (
    <Section title="Report a price" description="Saw a price today? Add it and help your neighbours.">
      <div className="grid gap-2 sm:grid-cols-3">
        <input className={inputCls} placeholder="Item (e.g. Rice 50kg)" value={f.item} onChange={set("item")} />
        <select className={inputCls} value={f.category} onChange={set("category")}>
          {PRICE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input className={inputCls} placeholder="Unit (bag, litre, trip)" value={f.unit} onChange={set("unit")} />
        <input className={inputCls} type="number" placeholder="Price" value={f.price} onChange={set("price")} />
        <select className={inputCls} value={f.currency} onChange={set("currency")}>
          {SUPPORTED_CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code}
            </option>
          ))}
        </select>
        <input className={inputCls} placeholder="Vendor / market" value={f.vendor} onChange={set("vendor")} />
        <input className={inputCls} placeholder="Area" value={f.area} onChange={set("area")} />
        <input className={inputCls} placeholder="City" value={f.city} onChange={set("city")} />
        <input className={inputCls} placeholder="Country" value={f.country} onChange={set("country")} />
      </div>
      <div className="mt-3">
        <Btn
          disabled={pending || !f.item || !f.price}
          onClick={() =>
            onSubmit({
              item: f.item.trim(),
              category: f.category,
              unit: f.unit.trim() || "unit",
              price: Number(f.price),
              currency: f.currency,
              vendor: f.vendor.trim() || null,
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
