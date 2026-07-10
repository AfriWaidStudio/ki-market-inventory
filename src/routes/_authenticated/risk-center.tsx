import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/StatCard";
import { listRiskAlerts, dismissRiskAlert } from "@/lib/risk.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/risk-center")({
  head: () => ({ meta: [{ title: "Risk Center — KI Market Inventory" }] }),
  component: RiskCenter,
});

function toneFor(sev: string): "profit" | "loss" | "warning" | "info" {
  if (sev === "critical" || sev === "high") return "loss";
  if (sev === "medium") return "warning";
  return "info";
}

function RiskCenter() {
  const listFn = useServerFn(listRiskAlerts);
  const dismissFn = useServerFn(dismissRiskAlert);
  const qc = useQueryClient();
  const opts = queryOptions({ queryKey: ["risk-alerts"], queryFn: () => listFn() });
  const { data } = useSuspenseQuery(opts);
  const dismiss = useMutation({
    mutationFn: (id: string) => dismissFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Alert dismissed");
      qc.invalidateQueries({ queryKey: ["risk-alerts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const active = data.filter((a) => !a.dismissed_at);
  const dismissed = data.filter((a) => a.dismissed_at);

  return (
    <AppShell title="Risk Center">
      <p className="text-sm text-muted-foreground max-w-2xl">
        Risk alerts flag conditions that may hurt a trade: stale prices, thin liquidity, fees eating profit,
        merchants with weak history, network delays. Signals are estimates, not accusations — always verify
        before acting.
      </p>

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Active alerts</h2>
          <Badge tone={active.length > 0 ? "warning" : "info"}>{active.length}</Badge>
        </div>
        {active.length === 0 ? (
          <div className="mt-3 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            No active risk alerts. New alerts appear here when the system detects stale prices, thin
            liquidity, or profit erosion on tracked trades.
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {active.map((a) => (
              <div key={a.id} className="rounded-xl border border-border bg-card p-4 flex items-start gap-4">
                <Badge tone={toneFor(a.severity)}>{a.severity}</Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{a.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(a.created_at).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => dismiss.mutate(a.id)}
                  disabled={dismiss.isPending}
                  className="text-xs rounded-md border border-border px-3 py-1.5 hover:bg-accent disabled:opacity-50"
                >
                  Dismiss
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {dismissed.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Recently dismissed
          </h2>
          <div className="mt-3 space-y-2">
            {dismissed.slice(0, 20).map((a) => (
              <div key={a.id} className="rounded-lg border border-border/50 bg-card/50 p-3 text-sm text-muted-foreground">
                <span className="mr-2 text-xs uppercase tracking-wider">{a.severity}</span>
                {a.message}
              </div>
            ))}
          </div>
        </section>
      )}
    </AppShell>
  );
}
