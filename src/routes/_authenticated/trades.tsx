import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/StatCard";
import { fmtMoney, fmtNumber } from "@/lib/currency";
import {
  listTrades,
  updateTradePrice,
  markClosed,
  cancelTrade,
} from "@/lib/trades.functions";

export const Route = createFileRoute("/_authenticated/trades")({
  head: () => ({ meta: [{ title: "Active Trades — KI Market Inventory" }] }),
  component: TradesPage,
});

function TradesPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listTrades);
  const updateFn = useServerFn(updateTradePrice);
  const closeFn = useServerFn(markClosed);
  const cancelFn = useServerFn(cancelTrade);

  const trades = useQuery({
    queryKey: ["active-trades"],
    queryFn: () => listFn({ data: { status: "active" } }),
  });

  const [editing, setEditing] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState("");
  const [closingId, setClosingId] = useState<string | null>(null);
  const [actualPrice, setActualPrice] = useState("");
  const [finalFees, setFinalFees] = useState("");
  const [amountSold, setAmountSold] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["active-trades"] });
    qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
    qc.invalidateQueries({ queryKey: ["trade-history"] });
  };

  const doUpdate = useMutation({
    mutationFn: (v: { id: string; price: number }) =>
      updateFn({ data: { id: v.id, expected_sell_price: v.price } }),
    onSuccess: () => { setEditing(null); setPriceInput(""); invalidate(); toast.success("Updated"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const doClose = useMutation({
    mutationFn: (v: { id: string; price: number; fees: number; amountSold?: number }) =>
      closeFn({
        data: {
          id: v.id,
          actual_sell_price: v.price,
          final_fees: v.fees,
          amount_sold: v.amountSold,
        },
      }),
    onSuccess: (res) => {
      setClosingId(null); setActualPrice(""); setFinalFees(""); setAmountSold("");
      invalidate();
      const p = res.analysis.actualProfit;
      toast.success(`${res.fully_closed ? "Closed" : "Partially closed"}. ${p >= 0 ? "Profit" : "Loss"}: ${fmtNumber(p)}`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const doCancel = useMutation({
    mutationFn: (id: string) => cancelFn({ data: { id } }),
    onSuccess: () => { invalidate(); toast.success("Cancelled"); },
  });

  const rows = trades.data ?? [];

  return (
    <AppShell title="Active Trades">
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            No active trades. Open one from the <Link to="/scanner" className="text-primary underline">Scanner</Link>.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left py-3 px-4">Route</th>
                  <th className="text-center py-3 px-4">Type</th>
                  <th className="text-left py-3 px-4">Stage</th>
                  <th className="text-right py-3 px-4">Amount</th>
                  <th className="text-right py-3 px-4">Buy</th>
                  <th className="text-right py-3 px-4">Exp. sell</th>
                  <th className="text-right py-3 px-4">Exp. profit</th>
                  <th className="text-center py-3 px-4">Confidence</th>
                  <th className="text-left py-3 px-4">Open for</th>
                  <th className="text-right py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {rows.map((t) => (
                  <Fragment key={t.id}>
                    <tr className="border-t border-border">
                      <td className="py-3 px-4">
                        <Link to="/trades/$tradeId" params={{ tradeId: t.id }} className="text-foreground hover:text-primary">
                          {t.route}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge tone={t.trade_type === "paper" ? "info" : "profit"}>
                          {t.trade_type === "paper" ? "paper" : "manual"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">
                        {String(t.stage ?? t.status).replaceAll("_", " ")}
                      </td>
                      <td className="py-3 px-4 text-right">{fmtNumber(Number(t.amount), 0)} {t.asset}</td>
                      <td className="py-3 px-4 text-right">{fmtMoney(Number(t.buy_price), t.currency)}</td>
                      <td className="py-3 px-4 text-right">
                        {editing === t.id ? (
                          <div className="flex gap-1 justify-end">
                            <input type="number" step="0.01" value={priceInput} onChange={(e) => setPriceInput(e.target.value)}
                              className="w-24 rounded border border-input bg-input px-2 py-1 text-right text-sm" />
                            <button onClick={() => doUpdate.mutate({ id: t.id, price: Number(priceInput) })}
                              className="rounded bg-primary px-2 text-xs text-primary-foreground">Save</button>
                          </div>
                        ) : (
                          <button onClick={() => { setEditing(t.id); setPriceInput(String(t.expected_sell_price ?? "")); }}
                            className="hover:text-primary">{fmtMoney(Number(t.expected_sell_price), t.currency)}</button>
                        )}
                      </td>
                      <td className={`py-3 px-4 text-right ${Number(t.expected_profit) >= 0 ? "text-[color:var(--profit)]" : "text-[color:var(--loss)]"}`}>
                        {fmtMoney(Number(t.expected_profit), t.currency)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge tone={Number(t.confidence_score) >= 70 ? "profit" : Number(t.confidence_score) >= 50 ? "info" : "warning"}>
                          {fmtNumber(Number(t.confidence_score), 0)}%
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground">
                        {timeAgo(t.buy_time as string)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => { setClosingId(t.id); setActualPrice(String(t.expected_sell_price ?? "")); setFinalFees(String(t.estimated_fees ?? "0")); setAmountSold(String(t.remaining_amount ?? t.amount)); }}
                            className="rounded border border-primary/40 px-2 py-1 text-xs text-primary hover:bg-primary/10">
                            {t.trade_type === "paper" ? "Paper Close" : "I Closed"}
                          </button>
                          <button onClick={() => doCancel.mutate(t.id)}
                            className="rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted">Cancel</button>
                        </div>
                      </td>
                    </tr>
                    {closingId === t.id && (
                      <tr className="bg-muted/20">
                        <td colSpan={10} className="p-4">
                          <div className="flex flex-wrap items-end gap-3">
                            <label className="text-sm">
                              <div className="text-xs uppercase text-muted-foreground">Amount sold</div>
                              <input type="number" step="0.000001" value={amountSold} onChange={(e) => setAmountSold(e.target.value)}
                                className="mt-1 w-32 rounded border border-input bg-input px-2 py-1.5" />
                            </label>
                            <label className="text-sm">
                              <div className="text-xs uppercase text-muted-foreground">Actual sell price</div>
                              <input type="number" step="0.01" value={actualPrice} onChange={(e) => setActualPrice(e.target.value)}
                                className="mt-1 w-32 rounded border border-input bg-input px-2 py-1.5" />
                            </label>
                            <label className="text-sm">
                              <div className="text-xs uppercase text-muted-foreground">Final fees</div>
                              <input type="number" step="0.01" value={finalFees} onChange={(e) => setFinalFees(e.target.value)}
                                className="mt-1 w-32 rounded border border-input bg-input px-2 py-1.5" />
                            </label>
                            <button onClick={() => doClose.mutate({ id: t.id, price: Number(actualPrice), fees: Number(finalFees), amountSold: Number(amountSold) || undefined })}
                              disabled={!actualPrice || doClose.isPending}
                              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">
                              {t.trade_type === "paper" ? "Confirm paper close" : "Confirm external close"}
                            </button>
                            <button onClick={() => setClosingId(null)}
                              className="rounded-md border border-border px-3 py-2 text-sm">Cancel</button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d`;
}
