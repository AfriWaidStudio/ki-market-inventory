import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Zap, X, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/StatCard";
import { fmtMoney, fmtNumber, SUPPORTED_CURRENCIES } from "@/lib/currency";
import { freshnessLabel, freshnessTone, fmtAge } from "@/lib/freshness";
import {
  submitPriceSnapshot,
  listRecentSnapshots,
  listOpportunities,
} from "@/lib/scanner.functions";
import {
  refreshWatchlist,
  listFeedStatus,
  listWatchlist,
  addWatchPair,
  removeWatchPair,
} from "@/lib/prices.functions";
import { createTrade } from "@/lib/trades.functions";
import { getProfile } from "@/lib/profile.functions";

const EXCHANGES = ["Binance", "Bybit", "OKX", "KuCoin", "Bitget"];
const ASSETS = ["USDT", "USDC", "BTC", "ETH"];

export const Route = createFileRoute("/_authenticated/scanner")({
  head: () => ({
    meta: [
      { title: "Opportunity Scanner — KI Market Inventory" },
      { name: "description", content: "Live P2P spreads across Binance, Bybit and OKX with freshness-aware KI scoring." },
      { property: "og:title", content: "Opportunity Scanner — KI Market Inventory" },
      { property: "og:description", content: "Live P2P spreads across Binance, Bybit and OKX with freshness-aware KI scoring." },
    ],
  }),
  component: ScannerPage,
});

function ScannerPage() {
  const qc = useQueryClient();
  const submitFn = useServerFn(submitPriceSnapshot);
  const oppFn = useServerFn(listOpportunities);
  const snapsFn = useServerFn(listRecentSnapshots);
  const createTradeFn = useServerFn(createTrade);
  const refreshFn = useServerFn(refreshWatchlist);
  const profileFn = useServerFn(getProfile);
  const feedFn = useServerFn(listFeedStatus);
  const watchFn = useServerFn(listWatchlist);
  const addWatchFn = useServerFn(addWatchPair);
  const removeWatchFn = useServerFn(removeWatchPair);

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
  const [newAsset, setNewAsset] = useState("USDT");
  const [newFiat, setNewFiat] = useState(fiat);

  const opps = useQuery({
    queryKey: ["opportunities", amount],
    queryFn: () => oppFn({ data: { amount: Number(amount) || 100 } }),
  });
  const snaps = useQuery({ queryKey: ["snapshots"], queryFn: () => snapsFn() });
  const feeds = useQuery({ queryKey: ["feed-status"], queryFn: () => feedFn(), refetchInterval: 60_000 });
  const watchlist = useQuery({ queryKey: ["watchlist"], queryFn: () => watchFn() });

  const submit = useMutation({
    mutationFn: () =>
      submitFn({
        data: {
          exchange,
          asset: "USDT",
          side,
          price: Number(price),
          currency: fiat,
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

  const refresh = useMutation({
    mutationFn: () => refreshFn(),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["snapshots"] });
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      qc.invalidateQueries({ queryKey: ["feed-status"] });
      if (res.inserted > 0) {
        toast.success(`Live prices refreshed · ${res.pairs} pair${res.pairs === 1 ? "" : "s"}`);
      } else if (res.failures.length) {
        toast.error(`Exchanges unreachable: ${[...new Set(res.failures.map((f) => f.exchange))].join(", ")}`);
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Refresh failed"),
  });

  const addPair = useMutation({
    mutationFn: () => addWatchFn({ data: { asset: newAsset, fiat: newFiat } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["watchlist"] });
      toast.success(`Watching ${newAsset}/${newFiat}`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const dropPair = useMutation({
    mutationFn: (id: string) => removeWatchFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist"] }),
  });

  // Seed the watchlist with the user's preferred currency the first time.
  useEffect(() => {
    if (!watchlist.isSuccess || !profile.isSuccess) return;
    if ((watchlist.data ?? []).length === 0) {
      addWatchFn({ data: { asset: "USDT", fiat } }).then(() =>
        qc.invalidateQueries({ queryKey: ["watchlist"] }),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchlist.isSuccess, profile.isSuccess]);

  // Auto-fetch live prices on mount and every 2 minutes
  useEffect(() => {
    if (!autoRefresh) return;
    refresh.mutate();
    const id = setInterval(() => refresh.mutate(), 120_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, fiat]);

  const latestCapture = (snaps.data ?? [])[0]?.captured_at as string | undefined;

  return (
    <AppShell title="Opportunity Scanner">
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <div className="space-y-6">
          {/* Watchlist */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Watched pairs</h2>
            <p className="text-xs text-muted-foreground">Every pair here is refreshed in the background, whether or not this page is open.</p>
            <div className="flex flex-wrap gap-2">
              {(watchlist.data ?? []).map((w) => (
                <span key={w.id} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-2.5 py-1 text-xs">
                  {w.asset}/{w.fiat}
                  <button onClick={() => dropPair.mutate(w.id)} className="text-muted-foreground hover:text-[color:var(--loss)]" aria-label={`Stop watching ${w.asset}/${w.fiat}`}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {(watchlist.data ?? []).length === 0 && (
                <span className="text-xs text-muted-foreground">No pairs watched yet.</span>
              )}
            </div>
            <div className="flex gap-2">
              <select value={newAsset} onChange={(e) => setNewAsset(e.target.value)} className={inputCls}>
                {ASSETS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              <select value={newFiat} onChange={(e) => setNewFiat(e.target.value)} className={inputCls}>
                {SUPPORTED_CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
              </select>
              <button
                onClick={() => addPair.mutate()}
                disabled={addPair.isPending}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-primary/40 px-2.5 text-xs text-primary hover:bg-primary/10 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>
          </div>

          {/* Feed health */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Exchange feeds</h2>
            {(feeds.data ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">No feed data yet — run a refresh.</p>
            ) : (
              <div className="space-y-1.5">
                {(feeds.data ?? []).map((f) => (
                  <div key={`${f.exchange}-${f.asset}-${f.fiat}`} className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium">{f.exchange} <span className="text-muted-foreground">{f.asset}/{f.fiat}</span></span>
                    {f.status === "live" ? (
                      <Badge tone="profit">live · {fmtAge(f.last_success_at)}</Badge>
                    ) : (
                      <span title={f.error_message ?? undefined}>
                        <Badge tone="loss">unavailable</Badge>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Manual entry */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4 h-fit">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Log a P2P price</h2>
              <p className="mt-1 text-xs text-muted-foreground">Manual fallback for exchanges we can&apos;t reach automatically.</p>
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
              <Field label={`Price (${fiat}/USDT)`} className="col-span-2">
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
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5 text-primary" /> Live opportunities
                </h2>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Binance · Bybit · OKX P2P</span>
                  <Badge tone={freshnessTone(latestCapture)}>{freshnessLabel(latestCapture)}</Badge>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
                  Auto
                </label>
                <button
                  onClick={() => refresh.mutate()}
                  disabled={refresh.isPending}
                  className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 px-2.5 py-1.5 text-xs text-primary hover:bg-primary/10 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${refresh.isPending ? "animate-spin" : ""}`} />
                  {refresh.isPending ? "Fetching…" : "Refresh live"}
                </button>
              </div>
            </div>
            {opps.isLoading ? (
              <p className="mt-3 text-sm text-muted-foreground">Scanning…</p>
            ) : (opps.data ?? []).length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No opportunities yet. Add a watched pair above, or log at least one buy and one sell on different exchanges.</p>
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
                      <th className="text-center py-2">Trust</th>
                      <th className="text-center py-2">Fresh</th>
                      <th className="text-center py-2">KI</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {(opps.data ?? []).map((o, i) => {
                      const oldest = [o.buy_captured_at, o.sell_captured_at].sort()[0];
                      return (
                        <tr key={i} className="border-b border-border/50">
                          <td className="py-2">{o.buy_exchange} → {o.sell_exchange}</td>
                          <td className="text-right">{fmtMoney(o.buy_price, o.currency)}</td>
                          <td className="text-right">{fmtMoney(o.sell_price, o.currency)}</td>
                          <td className="text-right">{fmtNumber(o.spread)} <span className="text-muted-foreground">({(o.spreadPct * 100).toFixed(2)}%)</span></td>
                          <td className={`text-right ${o.netProfit >= 0 ? "text-[color:var(--profit)]" : "text-[color:var(--loss)]"}`}>{fmtMoney(o.netProfit, o.currency)}</td>
                          <td className="text-center text-xs text-muted-foreground whitespace-nowrap">
                            {o.merchant_rating != null ? `★ ${o.merchant_rating.toFixed(1)}` : "—"}
                            {o.merchant_count != null ? ` · ${o.merchant_count}` : ""}
                            <div className="text-[10px]">liq {o.liquidity_score ?? "—"}</div>
                          </td>
                          <td className="text-center">
                            <Badge tone={freshnessTone(oldest)}>{fmtAge(oldest)}</Badge>
                          </td>
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-[11px] text-muted-foreground">Net figures are estimates based on the latest observed top-of-book price — not a guarantee of fill.</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Recent snapshots</h2>
            <div className="mt-3 space-y-1 text-xs font-mono">
              {(snaps.data ?? []).slice(0, 20).map((s) => (
                <div key={s.id} className="flex justify-between gap-2 text-muted-foreground">
                  <span>{fmtAge(s.captured_at as string)}</span>
                  <span>{s.exchange} {s.asset} {s.side}</span>
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
