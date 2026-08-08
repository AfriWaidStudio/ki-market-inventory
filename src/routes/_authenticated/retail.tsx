import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Badge, StatCard } from "@/components/StatCard";
import { Btn, EmptyState, Section, TabBar, downloadCsv, inputCls } from "@/components/ModuleUI";
import { fmtMoney, fmtNumber, fmtPercent } from "@/lib/currency";
import { freshnessLabel, freshnessTone } from "@/lib/freshness";
import { MARKETPLACES, breakEvenResalePrice } from "@/lib/retail";
import {
  listRetailProducts,
  addRetailProduct,
  removeRetailProduct,
  recordRetailListing,
} from "@/lib/retail.functions";

export const Route = createFileRoute("/_authenticated/retail")({
  head: () => ({
    meta: [
      { title: "Retail Arbitrage Desk — Waides KI" },
      {
        name: "description",
        content:
          "Track marketplace price gaps, landed cost, fees and break-even resale prices across Amazon, eBay, Jumia and more.",
      },
      { property: "og:title", content: "Retail Arbitrage Desk — Waides KI" },
      {
        property: "og:description",
        content: "Marketplace price gaps priced after fees, shipping and stock risk.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RetailPage,
});

type Tab = "opportunities" | "catalog" | "listings" | "breakeven";

const TABS = [
  { value: "opportunities", label: "Opportunities" },
  { value: "catalog", label: "Catalog" },
  { value: "listings", label: "Record listing" },
  { value: "breakeven", label: "Break-even lab" },
] as const;

function RetailPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listRetailProducts);
  const addProductFn = useServerFn(addRetailProduct);
  const removeProductFn = useServerFn(removeRetailProduct);
  const listingFn = useServerFn(recordRetailListing);

  const [tab, setTab] = useState<Tab>("opportunities");
  const [search, setSearch] = useState("");
  const [onlyTarget, setOnlyTarget] = useState(false);
  const [sort, setSort] = useState<"profit" | "margin" | "roi">("profit");

  const products = useQuery({ queryKey: ["retail"], queryFn: () => listFn() });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["retail"] });

  const rows = products.data ?? [];

  const opportunities = useMemo(() => {
    const flat = rows.flatMap((r) =>
      r.opportunities.map((o) => ({ product: r.product, opp: o })),
    );
    return flat
      .filter((x) =>
        search
          ? x.product.title.toLowerCase().includes(search.toLowerCase()) ||
            x.opp.source.marketplace.toLowerCase().includes(search.toLowerCase()) ||
            x.opp.resale.marketplace.toLowerCase().includes(search.toLowerCase())
          : true,
      )
      .filter((x) => (onlyTarget ? x.opp.meetsTarget : true))
      .sort((a, b) =>
        sort === "profit"
          ? b.opp.profit - a.opp.profit
          : sort === "margin"
            ? b.opp.marginPct - a.opp.marginPct
            : b.opp.roiPct - a.opp.roiPct,
      );
  }, [rows, search, onlyTarget, sort]);

  const totals = useMemo(() => {
    const best = rows.map((r) => r.best).filter((b) => b != null);
    const profit = best.reduce((a, b) => a + b!.profit, 0);
    const hits = best.filter((b) => b!.meetsTarget).length;
    const currency = rows[0]?.best?.source.currency ?? "USD";
    return {
      profit,
      hits,
      currency,
      tracked: rows.length,
      listings: rows.reduce((a, r) => a + r.listings.length, 0),
      avgMargin: best.length ? best.reduce((a, b) => a + b!.marginPct, 0) / best.length : 0,
    };
  }, [rows]);

  const addProduct = useMutation({
    mutationFn: (v: { title: string; category: string; sku: string; target_margin_pct: number }) =>
      addProductFn({
        data: {
          title: v.title,
          category: v.category || null,
          sku: v.sku || null,
          target_margin_pct: v.target_margin_pct,
        },
      }),
    onSuccess: () => {
      toast.success("Product tracked");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeProduct = useMutation({
    mutationFn: (id: string) => removeProductFn({ data: { id } }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const addListing = useMutation({
    mutationFn: (v: Parameters<typeof recordRetailListing>[0] extends never ? never : {
      product_id: string;
      marketplace: string;
      role: "source" | "resale";
      price: number;
      currency: string;
      shipping_cost: number;
      marketplace_fee_pct: number;
      in_stock: boolean;
      url: string;
    }) =>
      listingFn({
        data: {
          product_id: v.product_id,
          marketplace: v.marketplace,
          role: v.role,
          price: v.price,
          currency: v.currency,
          shipping_cost: v.shipping_cost,
          marketplace_fee_pct: v.marketplace_fee_pct,
          in_stock: v.in_stock,
          url: v.url || null,
        },
      }),
    onSuccess: () => {
      toast.success("Listing recorded");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell title="Retail Arbitrage">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label="Best-case profit"
            value={fmtMoney(totals.profit, totals.currency)}
            hint="Sum of each product's top spread"
            tone={totals.profit > 0 ? "profit" : "default"}
          />
          <StatCard label="Products tracked" value={String(totals.tracked)} />
          <StatCard label="Listings observed" value={String(totals.listings)} />
          <StatCard
            label="Hitting target margin"
            value={String(totals.hits)}
            tone={totals.hits > 0 ? "profit" : "warning"}
          />
          <StatCard label="Avg best margin" value={fmtPercent(totals.avgMargin)} />
        </div>

        <TabBar tabs={TABS} value={tab} onChange={setTab} />

        {tab === "opportunities" && (
          <Section
            title="Live spreads"
            description="Every source→resale pair priced after marketplace fees and both shipping legs."
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className={`${inputCls} w-44`}
                  placeholder="Filter product or market"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select
                  className={`${inputCls} w-32`}
                  value={sort}
                  onChange={(e) => setSort(e.target.value as typeof sort)}
                >
                  <option value="profit">Profit</option>
                  <option value="margin">Margin</option>
                  <option value="roi">ROI</option>
                </select>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={onlyTarget}
                    onChange={(e) => setOnlyTarget(e.target.checked)}
                  />
                  Target only
                </label>
                <Btn
                  variant="ghost"
                  onClick={() =>
                    downloadCsv(
                      "retail-opportunities.csv",
                      opportunities.map((x) => ({
                        product: x.product.title,
                        buy_on: x.opp.source.marketplace,
                        sell_on: x.opp.resale.marketplace,
                        landed_cost: x.opp.landedCost,
                        net_proceeds: x.opp.netProceeds,
                        profit: x.opp.profit,
                        margin_pct: x.opp.marginPct,
                        roi_pct: x.opp.roiPct,
                      })),
                    )
                  }
                >
                  Export CSV
                </Btn>
              </div>
            }
          >
            {products.isLoading ? (
              <EmptyState title="Loading spreads…" />
            ) : opportunities.length === 0 ? (
              <EmptyState
                title="No opportunities yet"
                hint="Track a product, then record at least one source and one resale listing."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="py-2 text-left">Product</th>
                      <th className="py-2 text-left">Route</th>
                      <th className="py-2 text-right">Landed</th>
                      <th className="py-2 text-right">Net proceeds</th>
                      <th className="py-2 text-right">Profit</th>
                      <th className="py-2 text-right">Margin</th>
                      <th className="py-2 text-right">ROI</th>
                      <th className="py-2 text-left">Signal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {opportunities.map((x, i) => (
                      <tr key={`${x.product.id}-${i}`} className="border-b border-border/50">
                        <td className="py-2">{x.product.title}</td>
                        <td className="py-2 text-xs text-muted-foreground">
                          {x.opp.source.marketplace} → {x.opp.resale.marketplace}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {fmtMoney(x.opp.landedCost, x.opp.source.currency)}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {fmtMoney(x.opp.netProceeds, x.opp.resale.currency)}
                        </td>
                        <td
                          className={`py-2 text-right tabular-nums ${x.opp.profit >= 0 ? "text-[color:var(--profit)]" : "text-[color:var(--loss)]"}`}
                        >
                          {fmtMoney(x.opp.profit, x.opp.resale.currency)}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {fmtPercent(x.opp.marginPct)}
                        </td>
                        <td className="py-2 text-right tabular-nums">{fmtPercent(x.opp.roiPct)}</td>
                        <td className="py-2">
                          <div className="flex flex-wrap gap-1">
                            <Badge tone={x.opp.meetsTarget ? "profit" : "default"}>
                              {x.opp.meetsTarget ? "Target met" : "Below target"}
                            </Badge>
                            <Badge tone={freshnessTone(x.opp.oldestObservation)}>
                              {freshnessLabel(x.opp.oldestObservation)}
                            </Badge>
                            {x.opp.currencyMismatch && <Badge tone="warning">FX risk</Badge>}
                            <Badge tone={x.opp.confidence > 0.6 ? "info" : "warning"}>
                              conf {fmtNumber(x.opp.confidence * 100, 0)}
                            </Badge>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        )}

        {tab === "catalog" && (
          <div className="grid gap-4 lg:grid-cols-3">
            <Section title="Track a product" className="lg:col-span-1">
              <ProductForm onSubmit={(v) => addProduct.mutate(v)} pending={addProduct.isPending} />
            </Section>
            <Section
              title="Catalog"
              description="Target margin drives every green/red verdict on the opportunities tab."
              className="lg:col-span-2"
            >
              {rows.length === 0 ? (
                <EmptyState title="No products tracked yet" />
              ) : (
                <div className="space-y-2">
                  {rows.map((r) => (
                    <div
                      key={r.product.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                    >
                      <div>
                        <div className="text-sm font-medium">{r.product.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.product.category ?? "Uncategorised"} · {r.listings.length} listings ·
                          target {fmtPercent(r.product.target_margin_pct)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {r.best && (
                          <Badge tone={r.best.profit >= 0 ? "profit" : "loss"}>
                            best {fmtMoney(r.best.profit, r.best.resale.currency)}
                          </Badge>
                        )}
                        <Btn variant="danger" onClick={() => removeProduct.mutate(r.product.id)}>
                          Remove
                        </Btn>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>
        )}

        {tab === "listings" && (
          <Section
            title="Record a listing"
            description="One observation per marketplace; the newest price always wins the comparison."
          >
            <ListingForm
              products={rows.map((r) => ({ id: r.product.id, title: r.product.title }))}
              pending={addListing.isPending}
              onSubmit={(v) => addListing.mutate(v)}
            />
          </Section>
        )}

        {tab === "breakeven" && <BreakEvenLab />}
      </div>
    </AppShell>
  );
}

function ProductForm({
  onSubmit,
  pending,
}: {
  onSubmit: (v: { title: string; category: string; sku: string; target_margin_pct: number }) => void;
  pending: boolean;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [sku, setSku] = useState("");
  const [margin, setMargin] = useState(15);
  return (
    <div className="space-y-3">
      <input className={inputCls} placeholder="Product title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input className={inputCls} placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
      <input className={inputCls} placeholder="SKU" value={sku} onChange={(e) => setSku(e.target.value)} />
      <label className="block text-xs text-muted-foreground">
        Target margin: {margin}%
        <input
          type="range"
          min={0}
          max={60}
          value={margin}
          onChange={(e) => setMargin(Number(e.target.value))}
          className="mt-1 w-full"
        />
      </label>
      <Btn
        disabled={pending || !title.trim()}
        onClick={() => onSubmit({ title: title.trim(), category, sku, target_margin_pct: margin / 100 })}
      >
        {pending ? "Saving…" : "Track product"}
      </Btn>
    </div>
  );
}

function ListingForm({
  products,
  onSubmit,
  pending,
}: {
  products: { id: string; title: string }[];
  pending: boolean;
  onSubmit: (v: {
    product_id: string;
    marketplace: string;
    role: "source" | "resale";
    price: number;
    currency: string;
    shipping_cost: number;
    marketplace_fee_pct: number;
    in_stock: boolean;
    url: string;
  }) => void;
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [marketplace, setMarketplace] = useState(MARKETPLACES[0]);
  const [role, setRole] = useState<"source" | "resale">("source");
  const [price, setPrice] = useState(0);
  const [currency, setCurrency] = useState("USD");
  const [shipping, setShipping] = useState(0);
  const [feePct, setFeePct] = useState(10);
  const [inStock, setInStock] = useState(true);
  const [url, setUrl] = useState("");

  if (!products.length) return <EmptyState title="Track a product first" />;

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <select className={inputCls} value={productId} onChange={(e) => setProductId(e.target.value)}>
        {products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title}
          </option>
        ))}
      </select>
      <select className={inputCls} value={marketplace} onChange={(e) => setMarketplace(e.target.value)}>
        {MARKETPLACES.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <select className={inputCls} value={role} onChange={(e) => setRole(e.target.value as "source" | "resale")}>
        <option value="source">Source (buy)</option>
        <option value="resale">Resale (sell)</option>
      </select>
      <input className={inputCls} type="number" placeholder="Price" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
      <input className={inputCls} placeholder="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)} />
      <input className={inputCls} type="number" placeholder="Shipping" value={shipping} onChange={(e) => setShipping(Number(e.target.value))} />
      <input className={inputCls} type="number" placeholder="Marketplace fee %" value={feePct} onChange={(e) => setFeePct(Number(e.target.value))} />
      <input className={inputCls} placeholder="Listing URL (optional)" value={url} onChange={(e) => setUrl(e.target.value)} />
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} />
        In stock
      </label>
      <div className="md:col-span-3">
        <Btn
          disabled={pending || price <= 0}
          onClick={() =>
            onSubmit({
              product_id: productId,
              marketplace,
              role,
              price,
              currency,
              shipping_cost: shipping,
              marketplace_fee_pct: feePct / 100,
              in_stock: inStock,
              url,
            })
          }
        >
          {pending ? "Saving…" : "Record listing"}
        </Btn>
      </div>
    </div>
  );
}

function BreakEvenLab() {
  const [landed, setLanded] = useState(100);
  const [feePct, setFeePct] = useState(12);
  const [outbound, setOutbound] = useState(8);
  const [target, setTarget] = useState(15);
  const be = breakEvenResalePrice(landed, feePct / 100, outbound, 0);
  const withTarget = breakEvenResalePrice(landed, feePct / 100, outbound, target / 100);

  return (
    <Section
      title="Break-even lab"
      description="The resale price you must clear before a marketplace fee eats the trade."
    >
      <div className="grid gap-3 md:grid-cols-4">
        <label className="text-xs text-muted-foreground">
          Landed cost
          <input className={inputCls} type="number" value={landed} onChange={(e) => setLanded(Number(e.target.value))} />
        </label>
        <label className="text-xs text-muted-foreground">
          Marketplace fee %
          <input className={inputCls} type="number" value={feePct} onChange={(e) => setFeePct(Number(e.target.value))} />
        </label>
        <label className="text-xs text-muted-foreground">
          Outbound shipping
          <input className={inputCls} type="number" value={outbound} onChange={(e) => setOutbound(Number(e.target.value))} />
        </label>
        <label className="text-xs text-muted-foreground">
          Target margin %
          <input className={inputCls} type="number" value={target} onChange={(e) => setTarget(Number(e.target.value))} />
        </label>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <StatCard label="Break-even price" value={fmtNumber(be)} hint="Zero profit, fees covered" />
        <StatCard
          label={`Price for ${target}% margin`}
          value={fmtNumber(withTarget)}
          tone="profit"
          hint="List above this to hit your target"
        />
      </div>
    </Section>
  );
}
