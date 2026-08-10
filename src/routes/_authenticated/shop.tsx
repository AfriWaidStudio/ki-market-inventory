import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Badge, StatCard } from "@/components/StatCard";
import { Btn, EmptyState, Section, TabBar, inputCls } from "@/components/ModuleUI";
import { fmtMoney, SUPPORTED_CURRENCIES } from "@/lib/currency";
import { isSameDay, marginPct, saleProfit, saleRevenue } from "@/lib/sabi";
import { listShop, saveProduct, deleteProduct, recordSale, saveDebtor, settleDebtor } from "@/lib/shop.functions";

export const Route = createFileRoute("/_authenticated/shop")({
  head: () => ({
    meta: [
      { title: "My Shop — stock, sales and daily profit | Sabi" },
      {
        name: "description",
        content: "A shop book that adds itself up: stock levels, every sale, who owes you, and today's real profit.",
      },
      { property: "og:title", content: "My Shop — stock, sales and daily profit | Sabi" },
      { property: "og:description", content: "Know your profit today, not at the end of the month." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ShopPage,
});

const TABS = [
  { value: "today", label: "Today" },
  { value: "stock", label: "Stock" },
  { value: "debtors", label: "Debtors" },
] as const;

function ShopPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listShop);
  const saveProductFn = useServerFn(saveProduct);
  const delProductFn = useServerFn(deleteProduct);
  const sellFn = useServerFn(recordSale);
  const saveDebtorFn = useServerFn(saveDebtor);
  const settleFn = useServerFn(settleDebtor);

  const [tab, setTab] = useState<(typeof TABS)[number]["value"]>("today");
  const { data, isLoading } = useQuery({ queryKey: ["shop"], queryFn: () => listFn() });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["shop"] });
    qc.invalidateQueries({ queryKey: ["today"] });
  };
  const addProduct = useMutation({
    mutationFn: (p: Parameters<typeof saveProduct>[0]) => saveProductFn(p),
    onSuccess: () => {
      toast.success("Product saved.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const delProduct = useMutation({ mutationFn: (id: string) => delProductFn({ data: { id } }), onSuccess: invalidate });
  const sell = useMutation({
    mutationFn: (v: { product_id: string; qty: number }) => sellFn({ data: v }),
    onSuccess: (r) => {
      toast.success(`Sale recorded — profit ${fmtMoney(r.profit, currency)}`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const addDebtor = useMutation({
    mutationFn: (p: Parameters<typeof saveDebtor>[0]) => saveDebtorFn(p),
    onSuccess: () => {
      toast.success("Debtor added.");
      invalidate();
    },
  });
  const settle = useMutation({
    mutationFn: (v: { id: string; settled: boolean }) => settleFn({ data: v }),
    onSuccess: invalidate,
  });

  const products = data?.products ?? [];
  const sales = data?.sales ?? [];
  const debtors = data?.debtors ?? [];
  const currency = products[0]?.currency ?? "NGN";

  const todaySales = sales.filter((s) => isSameDay(s.sold_at));
  const todayRevenue = todaySales.reduce((a, s) => a + saleRevenue(s), 0);
  const todayProfit = todaySales.reduce((a, s) => a + saleProfit(s), 0);
  const monthProfit = sales.reduce((a, s) => a + saleProfit(s), 0);
  const owed = debtors.filter((d) => !d.settled).reduce((a, d) => a + Number(d.amount), 0);
  const lowStock = products.filter((p) => Number(p.stock) <= Number(p.low_stock_at));

  return (
    <AppShell title="My Shop" subtitle="Your book, adding itself up">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Today profit" value={fmtMoney(todayProfit, currency)} tone="profit" hint={`${todaySales.length} sales`} />
          <StatCard label="Today sales" value={fmtMoney(todayRevenue, currency)} />
          <StatCard label="30-day profit" value={fmtMoney(monthProfit, currency)} />
          <StatCard label="People owe you" value={fmtMoney(owed, currency)} tone={owed > 0 ? "warning" : "default"} />
        </div>

        <TabBar tabs={TABS} value={tab} onChange={setTab} />

        {isLoading && <EmptyState title="Loading your shop…" />}

        {tab === "today" && !isLoading && (
          <Section title="Sell something" description="Tap a product to record one sale. Stock drops automatically.">
            {products.length === 0 ? (
              <EmptyState title="Add your products first" hint="Go to the Stock tab." />
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {products.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => sell.mutate({ product_id: p.id, qty: 1 })}
                      className="rounded-xl border border-border bg-card px-4 py-3 text-left hover:border-primary"
                    >
                      <div className="text-sm font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {fmtMoney(Number(p.sell_price), p.currency)} · {Number(p.stock)} left
                      </div>
                    </button>
                  ))}
                </div>
                <div className="mt-4 space-y-1">
                  {todaySales.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No sales recorded today yet.</p>
                  ) : (
                    todaySales.map((s) => (
                      <div key={s.id} className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-1.5 text-sm">
                        <span>
                          {s.product_name} × {Number(s.qty)}
                        </span>
                        <span className="tabular-nums text-[color:var(--profit)]">
                          +{fmtMoney(saleProfit(s), s.currency)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </Section>
        )}

        {tab === "stock" && !isLoading && (
          <>
            {lowStock.length > 0 && (
              <div className="rounded-xl border border-[color:var(--warning)]/40 bg-[color:var(--warning)]/10 px-4 py-3 text-sm">
                Running low: {lowStock.map((p) => p.name).join(", ")}
              </div>
            )}
            <ProductForm onSubmit={(p) => addProduct.mutate({ data: p })} pending={addProduct.isPending} />
            <Section title="Your products">
              {products.length === 0 ? (
                <EmptyState title="No products yet" />
              ) : (
                <div className="space-y-2">
                  {products.map((p) => (
                    <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-3 py-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{p.name}</span>
                          {Number(p.stock) <= Number(p.low_stock_at) && <Badge tone="warning">low stock</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          cost {fmtMoney(Number(p.cost_price), p.currency)} · sell{" "}
                          {fmtMoney(Number(p.sell_price), p.currency)} · margin{" "}
                          {(marginPct({ ...p, cost_price: Number(p.cost_price), sell_price: Number(p.sell_price), stock: Number(p.stock), low_stock_at: Number(p.low_stock_at) }) * 100).toFixed(0)}%
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm tabular-nums">{Number(p.stock)} {p.unit}</span>
                        <Btn variant="danger" onClick={() => delProduct.mutate(p.id)}>
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

        {tab === "debtors" && !isLoading && (
          <>
            <DebtorForm onSubmit={(p) => addDebtor.mutate({ data: p })} pending={addDebtor.isPending} />
            <Section title="Who owes you">
              {debtors.length === 0 ? (
                <EmptyState title="Nobody owes you. Good." />
              ) : (
                <div className="space-y-2">
                  {debtors.map((d) => (
                    <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-3 py-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{d.name}</span>
                          {d.settled && <Badge tone="profit">paid</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {[d.phone, d.due_date ? `due ${d.due_date}` : null].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="tabular-nums font-medium">{fmtMoney(Number(d.amount), d.currency)}</span>
                        <Btn onClick={() => settle.mutate({ id: d.id, settled: !d.settled })}>
                          {d.settled ? "Reopen" : "Mark paid"}
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

function ProductForm({
  onSubmit,
  pending,
}: {
  onSubmit: (p: {
    name: string;
    unit: string;
    cost_price: number;
    sell_price: number;
    stock: number;
    low_stock_at: number;
    currency: string;
  }) => void;
  pending: boolean;
}) {
  const [f, setF] = useState({ name: "", unit: "unit", cost: "", sell: "", stock: "", low: "5", currency: "NGN" });
  return (
    <Section title="Add a product" description="Cost and selling price — that's all Sabi needs to track profit.">
      <div className="grid gap-2 sm:grid-cols-3">
        <input className={inputCls} placeholder="Product name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input className={inputCls} placeholder="Unit" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} />
        <select className={inputCls} value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })}>
          {SUPPORTED_CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code}
            </option>
          ))}
        </select>
        <input className={inputCls} type="number" placeholder="Cost price" value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} />
        <input className={inputCls} type="number" placeholder="Selling price" value={f.sell} onChange={(e) => setF({ ...f, sell: e.target.value })} />
        <input className={inputCls} type="number" placeholder="Stock" value={f.stock} onChange={(e) => setF({ ...f, stock: e.target.value })} />
        <input className={inputCls} type="number" placeholder="Warn me at" value={f.low} onChange={(e) => setF({ ...f, low: e.target.value })} />
      </div>
      <div className="mt-3">
        <Btn
          disabled={pending || !f.name}
          onClick={() =>
            onSubmit({
              name: f.name.trim(),
              unit: f.unit.trim() || "unit",
              cost_price: Number(f.cost) || 0,
              sell_price: Number(f.sell) || 0,
              stock: Number(f.stock) || 0,
              low_stock_at: Number(f.low) || 0,
              currency: f.currency,
            })
          }
        >
          {pending ? "Saving…" : "Add product"}
        </Btn>
      </div>
    </Section>
  );
}

function DebtorForm({
  onSubmit,
  pending,
}: {
  onSubmit: (p: { name: string; phone: string | null; amount: number; currency: string; due_date: string | null }) => void;
  pending: boolean;
}) {
  const [f, setF] = useState({ name: "", phone: "", amount: "", currency: "NGN", due: "" });
  return (
    <Section title="Add a debtor" description="Record credit you gave, so it doesn't disappear.">
      <div className="grid gap-2 sm:grid-cols-3">
        <input className={inputCls} placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input className={inputCls} placeholder="Phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        <input className={inputCls} type="number" placeholder="Amount" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        <select className={inputCls} value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })}>
          {SUPPORTED_CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code}
            </option>
          ))}
        </select>
        <input className={inputCls} type="date" value={f.due} onChange={(e) => setF({ ...f, due: e.target.value })} />
      </div>
      <div className="mt-3">
        <Btn
          disabled={pending || !f.name || !f.amount}
          onClick={() =>
            onSubmit({
              name: f.name.trim(),
              phone: f.phone.trim() || null,
              amount: Number(f.amount),
              currency: f.currency,
              due_date: f.due || null,
            })
          }
        >
          {pending ? "Saving…" : "Add debtor"}
        </Btn>
      </div>
    </Section>
  );
}
