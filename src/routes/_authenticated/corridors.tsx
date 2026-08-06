import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Badge, StatCard } from "@/components/StatCard";
import { fmtMoney, fmtNumber, fmtPercent } from "@/lib/currency";
import { freshnessLabel, freshnessTone } from "@/lib/freshness";
import { PROVIDER_TYPES } from "@/lib/corridors";
import {
  listCorridors,
  addCorridor,
  removeCorridor,
  compareCorridor,
  recordCorridorQuote,
} from "@/lib/corridors.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/corridors")({
  head: () => ({
    meta: [
      { title: "Cross-Border Corridors — Waides KI" },
      {
        name: "description",
        content:
          "Compare bank, fintech, mobile money and crypto P2P routes on what actually lands after FX markup and fees.",
      },
      { property: "og:title", content: "Cross-Border Corridors — Waides KI" },
      {
        property: "og:description",
        content: "Rank every payment provider on landed value, not headline rate.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CorridorsPage;
});

const input =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

function CorridorsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listCorridors);
  const addFn = useServerFn(addCorridor);
  const removeFn = useServerFn(removeCorridor);
  const compareFn = useServerFn(compareCorridor);
  const quoteFn = useServerFn(recordCorridorQuote);

  const [send, setSend] = useState("USD");
  const [receive, setReceive] = useState("NGN");
  const [amount, setAmount] = useState(1000);

  const corridors = useQuery({ queryKey: ["corridors"], queryFn: () => listFn() });
  const comparison = useQuery({
    queryKey: ["corridor-compare", send, receive, amount],
    queryFn: () =>
      compareFn({ data: { send_currency: send, receive_currency: receive, amount } }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["corridors"] });
    qc.invalidateQueries({ queryKey: ["corridor-compare"] });
  };

  const add = useMutation({
    mutationFn: () =>
      addFn({ data: { send_currency: send, receive_currency: receive, typical_amount: amount } }),
    onSuccess: () => {
      toast.success("Corridor tracked");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeFn({ data: { id } }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const [q, setQ] = useState({
    provider: "",
    provider_type: "fintech",
    fx_rate: "",
    mid_market_rate: "",
    fee_flat: "0",
    fee_pct: "0",
    speed_hours: "",
    payout_method: "",
  });

  const saveQuote = useMutation({
    mutationFn: () =>
      quoteFn({
        data: {
          send_currency: send,
          receive_currency: receive,
          provider: q.provider,
          provider_type: q.provider_type,
          fx_rate: Number(q.fx_rate),
          mid_market_rate: q.mid_market_rate ? Number(q.mid_market_rate) : null,
          fee_flat: Number(q.fee_flat || 0),
          fee_pct: Number(q.fee_pct || 0) / 100,
          speed_hours: q.speed_hours ? Number(q.speed_hours) : null,
          payout_method: q.payout_method || null,
        },
      }),
    onSuccess: () => {
      toast.success("Quote recorded");
      setQ({ ...q, provider: "", fx_rate: "" });
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const result = comparison.data;
  const best = result?.ranked.find((r) => r.eligible);

  return (
    <AppShell title="Cross-Border Corridors">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Providers hide cost in three places: the FX markup, the visible fee, and the payout method. This
        ranks them on one number — how much actually lands on the other side.
      </p>

      <div className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <label className="text-xs uppercase tracking-widest text-muted-foreground">
          Send
          <input
            className={`${input} mt-1 w-28`}
            value={send}
            onChange={(e) => setSend(e.target.value.toUpperCase())}
          />
        </label>
        <label className="text-xs uppercase tracking-widest text-muted-foreground">
          Receive
          <input
            className={`${input} mt-1 w-28`}
            value={receive}
            onChange={(e) => setReceive(e.target.value.toUpperCase())}
          />
        </label>
        <label className="text-xs uppercase tracking-widest text-muted-foreground">
          Amount
          <input
            type="number"
            className={`${input} mt-1 w-36`}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
        </label>
        <button
          onClick={() => add.mutate()}
          className="rounded-md border border-border px-3 py-2 text-xs hover:bg-accent"
        >
          Track corridor
        </button>
      </div>

      {(corridors.data ?? []).length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {(corridors.data ?? []).map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setSend(c.send_currency);
                setReceive(c.receive_currency);
                setAmount(Number(c.typical_amount));
              }}
              className="group inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent"
            >
              {c.send_currency} → {c.receive_currency}
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  remove.mutate(c.id);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                ×
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <StatCard
          label="Best lands"
          value={best ? fmtMoney(best.receiveAmount, receive) : "—"}
          hint={best ? best.quote.provider : "No quotes yet"}
          tone="profit"
        />
        <StatCard
          label="Effective rate"
          value={best ? fmtNumber(best.effectiveRate, 4) : "—"}
          hint={`${send} → ${receive}`}
        />
        <StatCard
          label="Total cost"
          value={best ? fmtPercent(best.totalCostPct) : "—"}
          hint="vs. mid-market reference"
          tone="warning"
        />
        <StatCard
          label="Providers compared"
          value={String(result?.ranked.length ?? 0)}
          hint="Latest quote per provider"
        />
      </div>

      <section className="mt-6 overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="text-left text-xs uppercase tracking-widest text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Provider</th>
              <th className="px-4 py-3">Rate</th>
              <th className="px-4 py-3">Fees</th>
              <th className="px-4 py-3">Lands</th>
              <th className="px-4 py-3">vs best</th>
              <th className="px-4 py-3">Speed</th>
              <th className="px-4 py-3">Freshness</th>
            </tr>
          </thead>
          <tbody>
            {(result?.ranked ?? []).map((r) => (
              <tr key={r.quote.provider} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-3 tabular-nums text-muted-foreground">{r.rank}</td>
                <td className="px-4 py-3">
                  <div className="font-medium">{r.quote.provider}</div>
                  <div className="text-xs text-muted-foreground">
                    {PROVIDER_TYPES.find((p) => p.value === r.quote.provider_type)?.label ??
                      r.quote.provider_type}
                  </div>
                </td>
                <td className="px-4 py-3 tabular-nums">{fmtNumber(r.quote.fx_rate, 4)}</td>
                <td className="px-4 py-3 tabular-nums">{fmtMoney(r.feeTotal, send)}</td>
                <td className="px-4 py-3 tabular-nums font-medium">
                  {fmtMoney(r.receiveAmount, receive)}
                </td>
                <td
                  className={`px-4 py-3 tabular-nums ${r.vsBest < 0 ? "text-[color:var(--loss)]" : "text-[color:var(--profit)]"}`}
                >
                  {r.eligible ? fmtMoney(r.vsBest, receive) : (r.ineligibleReason ?? "—")}
                </td>
                <td className="px-4 py-3">{r.speedHours != null ? `${r.speedHours}h` : "—"}</td>
                <td className="px-4 py-3">
                  <Badge tone={freshnessTone(r.quote.observed_at)}>
                    {freshnessLabel(r.quote.observed_at)}
                  </Badge>
                </td>
              </tr>
            ))}
            {(result?.ranked.length ?? 0) === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No quotes for this corridor yet. Add one below — bank, fintech, mobile money or agent.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="mt-6 rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Record a provider quote
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <input
            className={input}
            placeholder="Provider"
            value={q.provider}
            onChange={(e) => setQ({ ...q, provider: e.target.value })}
          />
          <select
            className={input}
            value={q.provider_type}
            onChange={(e) => setQ({ ...q, provider_type: e.target.value })}
          >
            {PROVIDER_TYPES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <input
            className={input}
            placeholder="FX rate"
            value={q.fx_rate}
            onChange={(e) => setQ({ ...q, fx_rate: e.target.value })}
          />
          <input
            className={input}
            placeholder="Mid-market rate (optional)"
            value={q.mid_market_rate}
            onChange={(e) => setQ({ ...q, mid_market_rate: e.target.value })}
          />
          <input
            className={input}
            placeholder="Flat fee"
            value={q.fee_flat}
            onChange={(e) => setQ({ ...q, fee_flat: e.target.value })}
          />
          <input
            className={input}
            placeholder="Fee %"
            value={q.fee_pct}
            onChange={(e) => setQ({ ...q, fee_pct: e.target.value })}
          />
          <input
            className={input}
            placeholder="Speed (hours)"
            value={q.speed_hours}
            onChange={(e) => setQ({ ...q, speed_hours: e.target.value })}
          />
          <input
            className={input}
            placeholder="Payout method"
            value={q.payout_method}
            onChange={(e) => setQ({ ...q, payout_method: e.target.value })}
          />
        </div>
        <button
          onClick={() => saveQuote.mutate()}
          disabled={!q.provider || !q.fx_rate || saveQuote.isPending}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {saveQuote.isPending ? "Saving…" : "Record quote"}
        </button>
        <p className="mt-2 text-xs text-muted-foreground">
          Rates are your observations, not guarantees. Always confirm on the provider before sending.
        </p>
      </section>
    </AppShell>
  );
}
