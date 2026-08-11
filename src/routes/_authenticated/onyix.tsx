import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Btn, EmptyState, Section, inputCls } from "@/components/ModuleUI";
import { onyixOverview, rechargeSmaisika, refillTank } from "@/lib/onyix.functions";
import { formatOnyix, formatSmaisika, onyixToSmaisika, PRUF_LABEL, type PrufLevel } from "@/lib/onyix";

export const Route = createFileRoute("/_authenticated/onyix")({
  head: () => ({
    meta: [
      { title: "Onyix & Smaisika wallet — fuel for the Field" },
      {
        name: "description",
        content:
          "Recharge Smaisika, refill your OnyixTank and see every unit of Onyix the Smaionyix Field consumed on your behalf.",
      },
      { property: "og:title", content: "Onyix & Smaisika wallet" },
      { property: "og:description", content: "1 Onyix = 0.001 Smaisika. Nothing runs outside your tank." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OnyixPage,
});

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function OnyixPage() {
  const overview = useServerFn(onyixOverview);
  const recharge = useServerFn(rechargeSmaisika);
  const refill = useServerFn(refillTank);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["onyix"], queryFn: () => overview() });
  const [smk, setSmk] = useState("5");
  const [onx, setOnx] = useState("1000");
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["onyix"] });
    qc.invalidateQueries({ queryKey: ["beings"] });
  };

  const rechargeMut = useMutation({
    mutationFn: (v: number) => recharge({ data: { smaisika: v } }),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const refillMut = useMutation({
    mutationFn: (v: number) => refill({ data: { onyix: v } }),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (e: Error) => setError(e.message),
  });

  const w = data?.wallet;

  return (
    <AppShell title="Onyix" subtitle="Everything Sabi does consumes Onyix, fetched from WebOnyix and recorded by WaidesPruf">
      {isLoading || !w ? (
        <EmptyState title="Opening your wallet…" />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="OnyixTank" value={formatOnyix(Number(w.onyix_tank))} hint="Fuel available for Field work" />
            <Stat label="Smaisika wallet" value={formatSmaisika(Number(w.smaisika_balance))} hint="1 ONX = 0.001 SMK" />
            <Stat label="Lifetime consumed" value={formatOnyix(Number(w.lifetime_consumed))} hint="Burned across all beings" />
            <Stat
              label="Tank worth"
              value={formatSmaisika(onyixToSmaisika(Number(w.onyix_tank)))}
              hint="If converted back today"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-border bg-card p-3 text-xs text-[color:var(--loss)]">{error}</div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <Section title="Recharge Smaisika" description="Top up the wallet that pays for everything.">
              <div className="flex gap-2">
                <input className={inputCls} value={smk} onChange={(e) => setSmk(e.target.value)} inputMode="decimal" />
                <Btn onClick={() => rechargeMut.mutate(Number(smk))} disabled={rechargeMut.isPending || !Number(smk)}>
                  Recharge
                </Btn>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[1, 5, 10, 50].map((v) => (
                  <Btn key={v} variant="ghost" onClick={() => setSmk(String(v))}>
                    {v} SMK
                  </Btn>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {Number(smk) > 0 ? `${Number(smk)} SMK buys ${(Number(smk) * 1000).toLocaleString()} ONX of Field work.` : ""}
              </p>
            </Section>

            <Section title="Refill OnyixTank" description="Convert Smaisika into Onyix and pour it into the tank.">
              <div className="flex gap-2">
                <input className={inputCls} value={onx} onChange={(e) => setOnx(e.target.value)} inputMode="numeric" />
                <Btn onClick={() => refillMut.mutate(Number(onx))} disabled={refillMut.isPending || !Number(onx)}>
                  Refill
                </Btn>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[500, 1000, 5000, 20000].map((v) => (
                  <Btn key={v} variant="ghost" onClick={() => setOnx(String(v))}>
                    {v.toLocaleString()} ONX
                  </Btn>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Costs {formatSmaisika(onyixToSmaisika(Number(onx) || 0))} from your wallet.
              </p>
            </Section>
          </div>

          <Section
            title="Onyix ledger"
            description="Every grant, recharge, refill and burn — recorded by WaidesPruf so consumption is never invisible."
          >
            {data.ledger.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="py-1.5">When</th>
                      <th>Kind</th>
                      <th>Reason</th>
                      <th className="text-right">Onyix</th>
                      <th className="text-right">Tank after</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.ledger.map((l) => (
                      <tr key={l.id} className="border-t border-border">
                        <td className="py-1.5 whitespace-nowrap text-xs text-muted-foreground">
                          {new Date(l.created_at).toLocaleString()}
                        </td>
                        <td className="text-xs capitalize">{l.kind}</td>
                        <td className="text-xs">{l.reason}</td>
                        <td
                          className={`text-right ${Number(l.onyix_delta) < 0 ? "text-[color:var(--loss)]" : "text-[color:var(--profit)]"}`}
                        >
                          {Number(l.onyix_delta) > 0 ? "+" : ""}
                          {Math.round(Number(l.onyix_delta)).toLocaleString()}
                        </td>
                        <td className="text-right text-xs">{Math.round(Number(l.tank_after)).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No Onyix movement yet" />
            )}
          </Section>

          <Section title="Recent WaidesPruf attestations" description="What the Field claimed, how strongly it is backed, and what it cost.">
            {data.pruf.length ? (
              <div className="space-y-2">
                {data.pruf.slice(0, 10).map((p) => (
                  <div key={p.id} className="rounded-lg border border-border p-2.5">
                    <div className="flex flex-wrap items-center gap-2 text-[10px]">
                      <span className="rounded bg-primary/15 px-1.5 py-0.5 text-primary">
                        {PRUF_LABEL[p.verification_level as PrufLevel] ?? p.verification_level}
                      </span>
                      <span className="text-muted-foreground">
                        confidence {Number(p.confidence)}% • {p.sources} sources • {formatOnyix(Number(p.onyix_consumed))}
                      </span>
                    </div>
                    <div className="mt-1 text-sm">{p.subject}</div>
                    <div className="text-xs text-muted-foreground">{p.claim}</div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="Nothing attested yet" hint="Run a SmaiAssembly and the Field records it here." />
            )}
          </Section>
        </div>
      )}
    </AppShell>
  );
}
