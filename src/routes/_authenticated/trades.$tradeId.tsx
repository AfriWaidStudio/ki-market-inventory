import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/StatCard";
import { fmtMoney, fmtNumber } from "@/lib/currency";
import { addTradeFee, addTradeNote, getTrade, updateTradeStage } from "@/lib/trades.functions";

export const Route = createFileRoute("/_authenticated/trades/$tradeId")({
  head: () => ({ meta: [{ title: "Trade — KI Market Inventory" }] }),
  component: TradeDetailPage,
});

function TradeDetailPage() {
  const { tradeId } = Route.useParams();
  const qc = useQueryClient();
  const getFn = useServerFn(getTrade);
  const noteFn = useServerFn(addTradeNote);
  const feeFn = useServerFn(addTradeFee);
  const stageFn = useServerFn(updateTradeStage);

  const q = useQuery({
    queryKey: ["trade", tradeId],
    queryFn: () => getFn({ data: { id: tradeId } }),
  });

  const [note, setNote] = useState("");
  const [feeAmount, setFeeAmount] = useState("");
  const [feeType, setFeeType] = useState("network");
  const [stage, setStage] = useState("");
  const addNote = useMutation({
    mutationFn: () => noteFn({ data: { trade_id: tradeId, note } }),
    onSuccess: () => { setNote(""); qc.invalidateQueries({ queryKey: ["trade", tradeId] }); toast.success("Note added"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const addFee = useMutation({
    mutationFn: () =>
      feeFn({
        data: {
          trade_id: tradeId,
          fee_type: feeType,
          amount: Number(feeAmount),
          currency: q.data?.trade.currency ?? "NGN",
        },
      }),
    onSuccess: () => {
      setFeeAmount("");
      qc.invalidateQueries({ queryKey: ["trade", tradeId] });
      qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
      toast.success("Fee recorded");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const updateStage = useMutation({
    mutationFn: () => stageFn({ data: { id: tradeId, stage: stage as never } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["trade", tradeId] });
      qc.invalidateQueries({ queryKey: ["active-trades"] });
      toast.success("Stage updated");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (q.isLoading) return <AppShell title="Trade"><div className="text-muted-foreground">Loading…</div></AppShell>;
  if (!q.data) return <AppShell title="Trade"><div className="text-muted-foreground">Not found.</div></AppShell>;

  const { trade: t, notes, events, fees, ledger } = q.data;
  const p = t.realized_profit != null && Number(t.realized_profit) !== 0 ? Number(t.realized_profit) : Number(t.actual_profit ?? t.expected_profit ?? 0);
  const isClosed = t.status === "closed";

  return (
    <AppShell title={`Trade · ${t.route ?? ""}`}>
      <div className="mb-4">
        <Link to="/trades" className="text-xs text-muted-foreground hover:text-primary">← Back to active trades</Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Overview</h2>
              <div className="flex gap-2">
                <Badge tone={t.trade_type === "paper" ? "info" : "profit"}>{t.trade_type}</Badge>
                <Badge tone={t.status === "active" ? "info" : t.status === "closed" ? "profit" : "default"}>{t.status}</Badge>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <Info label="Amount" value={`${fmtNumber(Number(t.amount), 0)} ${t.asset}`} />
              <Info label="Remaining" value={`${fmtNumber(Number(t.remaining_amount ?? t.amount), 6)} ${t.asset}`} />
              <Info label="Stage" value={String(t.stage ?? t.status).replaceAll("_", " ")} />
              <Info label="Buy" value={fmtMoney(Number(t.buy_price), t.currency)} />
              <Info label={isClosed ? "Actual sell" : "Expected sell"} value={fmtMoney(Number(t.actual_sell_price ?? t.expected_sell_price), t.currency)} />
              <Info label={isClosed ? "Realized P/L" : "Expected P/L"} value={fmtMoney(p, t.currency)} tone={p >= 0 ? "profit" : "loss"} />
              <Info label="Estimated fees" value={fmtMoney(Number(t.estimated_fees ?? 0), t.currency)} />
              <Info label="Recorded fees" value={fmtMoney(Number(t.total_recorded_fees ?? 0), t.currency)} />
              {t.final_fees != null && <Info label="Final fees" value={fmtMoney(Number(t.final_fees), t.currency)} />}
              <Info label="Confidence" value={`${fmtNumber(Number(t.confidence_score), 0)}%`} />
              <Info label="Risk" value={`${fmtNumber(Number(t.risk_score), 0)}%`} />
              <Info label="Opened" value={new Date(t.buy_time as string).toLocaleString()} />
              {t.sell_time && <Info label="Closed" value={new Date(t.sell_time as string).toLocaleString()} />}
              {t.duration_minutes != null && <Info label="Duration" value={`${t.duration_minutes}m`} />}
              {t.ki_accuracy_verdict && <Info label="KI verdict" value={t.ki_accuracy_verdict} />}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">KI reasoning</h2>
            <p className="mt-3 text-sm text-foreground/90 leading-relaxed">{t.ki_reasoning ?? "No reasoning recorded."}</p>
            {t.lesson_learned && (
              <>
                <div className="mt-4 border-t border-border pt-4">
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">Lesson learned</div>
                  <p className="mt-2 text-sm">{t.lesson_learned}</p>
                </div>
              </>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Timeline</h2>
            <div className="mt-3 space-y-2">
              {events.length === 0 && <p className="text-xs text-muted-foreground">No events yet.</p>}
              {events.map((event) => (
                <div key={event.id} className="border-l border-border pl-3 text-xs">
                  <div className="font-medium">{String(event.event_type).replaceAll("_", " ")}</div>
                  <div className="text-muted-foreground">
                    {new Date(event.created_at as string).toLocaleString()}
                    {event.to_stage ? ` · ${String(event.to_stage).replaceAll("_", " ")}` : ""}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Ledger</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <tbody>
                  {ledger.map((entry) => (
                    <tr key={entry.id} className="border-b border-border/50">
                      <td className="py-2 text-muted-foreground">{new Date(entry.created_at as string).toLocaleString()}</td>
                      <td className="py-2">{String(entry.entry_type).replaceAll("_", " ")}</td>
                      <td className={`py-2 text-right tabular-nums ${Number(entry.amount) >= 0 ? "text-[color:var(--profit)]" : "text-[color:var(--loss)]"}`}>
                        {fmtMoney(Number(entry.amount), entry.currency)}
                      </td>
                    </tr>
                  ))}
                  {ledger.length === 0 && (
                    <tr><td className="py-2 text-muted-foreground">No ledger entries yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {t.status === "active" && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Stage</h2>
              <select value={stage || t.stage || ""} onChange={(e) => setStage(e.target.value)} className="mt-3 w-full rounded-md border border-input bg-input px-3 py-2 text-sm">
                {(t.trade_type === "paper" ? ["paper_active"] : ["bought","awaiting_transfer","received","listed_for_sale","awaiting_payment","ready_to_close","partially_closed"]).map((value) => (
                  <option key={value} value={value}>{value.replaceAll("_", " ")}</option>
                ))}
              </select>
              <button onClick={() => updateStage.mutate()} disabled={updateStage.isPending || !(stage || t.stage)}
                className="mt-2 w-full rounded-md bg-primary py-1.5 text-sm text-primary-foreground disabled:opacity-50">
                Update stage
              </button>
            </div>
          )}

          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Fees</h2>
            <div className="mt-3 space-y-2">
              {fees.map((fee) => (
                <div key={fee.id} className="flex justify-between text-xs border-b border-border/50 py-1">
                  <span>{fee.fee_type}</span>
                  <span className="tabular-nums">{fmtMoney(Number(fee.amount), fee.currency)}</span>
                </div>
              ))}
              {fees.length === 0 && <p className="text-xs text-muted-foreground">No fees recorded yet.</p>}
            </div>
            {t.status === "active" && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <input value={feeType} onChange={(e) => setFeeType(e.target.value)} className="rounded-md border border-input bg-input px-2 py-1.5 text-sm" />
                <input type="number" step="0.01" value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} placeholder="Amount" className="rounded-md border border-input bg-input px-2 py-1.5 text-sm" />
                <button onClick={() => addFee.mutate()} disabled={!feeAmount || addFee.isPending}
                  className="col-span-2 rounded-md bg-primary py-1.5 text-sm text-primary-foreground disabled:opacity-50">
                  Add fee
                </button>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Notes</h2>
            <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
              {notes.length === 0 && <p className="text-xs text-muted-foreground">No notes yet.</p>}
              {notes.map((n) => (
                <div key={n.id} className="rounded-md bg-muted/40 p-2 text-xs">
                  <div className="text-muted-foreground">{new Date(n.created_at as string).toLocaleString()}</div>
                  <div className="mt-0.5">{n.note}</div>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
                placeholder="Add a note…"
                className="w-full rounded-md border border-input bg-input px-3 py-2 text-sm" />
              <button onClick={() => addNote.mutate()} disabled={!note.trim() || addNote.isPending}
                className="mt-2 w-full rounded-md bg-primary py-1.5 text-sm text-primary-foreground disabled:opacity-50">
                {addNote.isPending ? "Saving…" : "Add note"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Info({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "profit" | "loss" }) {
  const cls = tone === "profit" ? "text-[color:var(--profit)]" : tone === "loss" ? "text-[color:var(--loss)]" : "text-foreground";
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 tabular-nums ${cls}`}>{value}</div>
    </div>
  );
}
