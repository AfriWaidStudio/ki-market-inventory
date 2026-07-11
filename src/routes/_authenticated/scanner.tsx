import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Zap } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/StatCard";
import { fmtMoney, fmtNumber, SUPPORTED_CURRENCIES } from "@/lib/currency";
import {
  submitPriceSnapshot,
  listRecentSnapshots,
  listOpportunities,
} from "@/lib/scanner.functions";
import { refreshLivePrices } from "@/lib/prices.functions";
import { createTrade } from "@/lib/trades.functions";
import { getProfile } from "@/lib/profile.functions";

const EXCHANGES = ["Binance", "Bybit", "OKX", "KuCoin", "Bitget"];

export const Route = createFileRoute("/_authenticated/scanner")({
  head: () => ({ meta: [{ title: "Opportunity Scanner — KI Market Inventory" }] }),
  component: ScannerPage,
});

function ScannerPage() {
  const qc = useQueryClient();
  const submitFn = useServerFn(submitPriceSnapshot);
  const oppFn = useServerFn(listOpportunities);
  const snapsFn = useServerFn(listRecentSnapshots);
  const createTradeFn = useServerFn(createTrade);
  const refreshFn = useServerFn(refreshLivePrices);
  const profileFn = useServerFn(getProfile);

  const profile = useQuery({ queryKey: ["profile"], queryFn: () => profileFn() });
  const fiat = profile.data?.preferred_currency ?? "NGN";

  const [exchange, setExchange] = useState("Binance");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [price, setPrice] = useState("");
  const [merchantRating, setMerchantRating] = useState("4.5");
  const [merchantCount, setMerchantCount] = useState("20");
  const [liquidity, setLiquidity] = useState("70");
  const [amount, setAmount] = useState("100");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const opps = useQuery({
    queryKey: ["opportunities", amount],
    queryFn: () => oppFn({ data: { amount: Number(amount) || 100 } }),
  });
  const snaps = useQuery({ queryKey: ["snapshots"], queryFn: () => snapsFn() });

  const submit = useMutation({
    mutationFn: () =>
      submitFn({
        data: {
          exchange,
          asset: "USDT",
          side,
          price: Number(price),
          currency: "NGN",
          liquidity_score: Number(liquidity),
          merchant_count: Number(merchantCount),
          merchant_rating: Number(merchantRating),
        },
      }),
    onSuccess: () => {
      setPrice("");
      qc.invalidateQueries({ queryKey: ["snapshots"] });
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      toast.success("Snapshot recorded");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const markBought = useMutation({
    mutationFn: (opp: {
      buy_exchange: string;
      sell_exchange: string;
      buy_price: number;
      sell_price: number;
      currency: string;
      liquidity_score: number | null;
      merchant_count: number | null;
      merchant_rating: number | null;
    }) =>
      createTradeFn({
        data: {
          asset: "USDT",
          amount: Number(amount) || 100,
          buy_exchange: opp.buy_exchange,
          sell_exchange: opp.sell_exchange,
          buy_price: opp.buy_price,
          expected_sell_price: opp.sell_price,
          estimated_fees: 0,
          currency: opp.currency,
          liquidity_score: opp.liquidity_score,
          merchant_count: opp.merchant_count,
          merchant_rating: opp.merchant_rating,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
      qc.invalidateQueries({ queryKey: ["active-trades"] });
      toast.success("Active trade opened");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <AppShell title="Opportunity Scanner">
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <div className="rounded-xl border border-border bg-card p-5 space-y-4 h-fit">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Log a P2P price</h2>
            <p className="mt-1 text-xs text-muted-foreground">Manual entry. Add one buy and one sell per exchange for opportunities to appear.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Exchange">
              <select value={exchange} onChange={(e) => setExchange(e.target.value)} className={inputCls}>
                {EXCHANGES.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </Field>
            <Field label="Side">
              <select value={side} onChange={(e) => setSide(e.target.value as "buy" | "sell")} className={inputCls}>
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
              </select>
            </Field>
            <Field label="Price (NGN/USDT)" className="col-span-2">
              <input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Merchants">
              <input type="number" value={merchantCount} onChange={(e) => setMerchantCount(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Rating (0-5)">
              <input type="number" step="0.1" value={merchantRating} onChange={(e) => setMerchantRating(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Liquidity (0-100)" className="col-span-2">
              <input type="number" value={liquidity} onChange={(e) => setLiquidity(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <button
            disabled={!price || submit.isPending}
            onClick={() => submit.mutate()}
            className="w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {submit.isPending ? "Saving…" : "Record snapshot"}
          </button>

          <div className="pt-4 border-t border-border">
            <Field label="Trade amount (USDT)">
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} />
            </Field>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Live opportunities</h2>
            {opps.isLoading ? (
              <p className="mt-3 text-sm text-muted-foreground">Scanning…</p>
            ) : (opps.data ?? []).length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No opportunities yet. Log at least one buy and one sell on different exchanges.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="text-left py-2">Route</th>
                      <th className="text-right py-2">Buy</th>
                      <th className="text-right py-2">Sell</th>
                      <th className="text-right py-2">Spread</th>
                      <th className="text-right py-2">Net</th>
                      <th className="text-center py-2">KI</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {(opps.data ?? []).map((o, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-2">{o.buy_exchange} → {o.sell_exchange}</td>
                        <td className="text-right">{fmtMoney(o.buy_price, o.currency)}</td>
                        <td className="text-right">{fmtMoney(o.sell_price, o.currency)}</td>
                        <td className="text-right">{fmtNumber(o.spread)} <span className="text-muted-foreground">({(o.spreadPct * 100).toFixed(2)}%)</span></td>
                        <td className={`text-right ${o.netProfit >= 0 ? "text-[color:var(--profit)]" : "text-[color:var(--loss)]"}`}>{fmtMoney(o.netProfit, o.currency)}</td>
                        <td className="text-center">
                          <RecBadge rec={o.recommendation} confidence={o.confidence} risk={o.risk} />
                        </td>
                        <td className="text-right">
                          <button
                            disabled={markBought.isPending}
                            onClick={() => markBought.mutate(o)}
                            className="rounded-md border border-primary/40 px-2.5 py-1 text-xs text-primary hover:bg-primary/10 disabled:opacity-50"
                          >
                            Mark bought
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Recent snapshots</h2>
            <div className="mt-3 space-y-1 text-xs font-mono">
              {(snaps.data ?? []).slice(0, 20).map((s) => (
                <div key={s.id} className="flex justify-between text-muted-foreground">
                  <span>{new Date(s.captured_at as string).toLocaleTimeString()}</span>
                  <span>{s.exchange} {s.side}</span>
                  <span className="text-foreground">{fmtMoney(Number(s.price), s.currency)}</span>
                </div>
              ))}
              {(snaps.data ?? []).length === 0 && (
                <p className="text-muted-foreground">No snapshots yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

const inputCls = "w-full rounded-md border border-input bg-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function RecBadge({ rec, confidence, risk }: { rec: string; confidence: number; risk: number }) {
  const map: Record<string, "profit" | "info" | "warning" | "loss"> = {
    buy_now: "profit",
    wait: "info",
    watch: "warning",
    skip: "loss",
  };
  const label = rec.replace("_", " ");
  return (
    <div className="flex flex-col items-center gap-0.5">
      <Badge tone={map[rec] ?? "default"}>{label}</Badge>
      <span className="text-[10px] text-muted-foreground">c {confidence.toFixed(0)} · r {risk.toFixed(0)}</span>
    </div>
  );
}
