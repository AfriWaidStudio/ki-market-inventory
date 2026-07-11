import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
    mutationFn: (v: { id: string; price: number; fees: number }) =>
      closeFn({ data: { id: v.id, actual_sell_price: v.price, final_fees: v.fees } }),
    onSuccess: (res) => {
      setClosingId(null); setActualPrice(""); setFinalFees("");
      invalidate();
      const p = res.analysis.actualProfit;
      toast.success(`Closed. ${p >= 0 ? "Profit" : "Loss"}: ${fmtNumber(p)}`);
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
                  <TradeRow
                    key={t.id}
                    t={t}
                    editing={editing}
                    priceInput={priceInput}
                    setEditing={setEditing}
                    setPriceInput={setPriceInput}
                    doUpdate={doUpdate}
                    closingId={closingId}
                    actualPrice={actualPrice}
                    setActualPrice={setActualPrice}
                    finalFees={finalFees}
                    setFinalFees={setFinalFees}
                    setClosingId={setClosingId}
                    doClose={doClose}
                    doCancel={doCancel}
                  />
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
