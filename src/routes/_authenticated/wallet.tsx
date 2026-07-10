import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { StatCard, Badge } from "@/components/StatCard";

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => ({ meta: [{ title: "Smaisika Wallet — KI Market Inventory" }] }),
  component: WalletPage,
});

function WalletPage() {
  return (
    <AppShell title="Smaisika Wallet">
      <div className="max-w-3xl">
        <div className="flex items-center gap-2">
          <Badge tone="warning">Coming soon</Badge>
          <p className="text-sm text-muted-foreground">
            Smaisika is the Konsmik ecosystem credit — not a currency for withdrawing funds.
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <StatCard label="Balance" value="—" hint="Ledger not yet enabled" />
          <StatCard label="Lifetime spent" value="—" />
          <StatCard label="Burned today" value="—" />
        </div>

        <div className="mt-6 rounded-xl border border-border bg-card p-5 text-sm space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            What Smaisika is used for
          </h2>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>KI chat messages beyond your free quota</li>
            <li>Premium scans and deep reports</li>
            <li>Data exports, alerts, extended storage</li>
          </ul>
          <p className="text-xs text-muted-foreground">
            When the ledger goes live every charge, refund, and grant is recorded with balance-before and
            balance-after. Failed jobs auto-refund. You will always see the cost before confirming.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
