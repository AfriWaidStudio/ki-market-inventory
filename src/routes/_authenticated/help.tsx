import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/help")({
  head: () => ({ meta: [{ title: "Help & Safety — KI Market Inventory" }] }),
  component: HelpPage,
});

function HelpPage() {
  return (
    <AppShell title="Help & Safety">
      <div className="max-w-3xl space-y-6 text-sm">
        <section>
          <h2 className="text-base font-semibold">What this app does</h2>
          <p className="mt-2 text-muted-foreground">
            KI Market Inventory is a personal tracker and decision-support workspace for P2P and arbitrage
            trades. It never executes trades, moves funds, or connects with trading permissions. All
            recommendations are probabilistic — never guaranteed outcomes.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold">Getting started</h2>
          <ol className="mt-2 list-decimal pl-5 space-y-1 text-muted-foreground">
            <li>Set your reporting currency in <Link to="/settings" className="text-primary underline">Settings</Link>.</li>
            <li>Log a manual opportunity in the <Link to="/scanner" className="text-primary underline">Scanner</Link>.</li>
            <li>Mark it as bought to move it into <Link to="/trades" className="text-primary underline">Active Trades</Link>.</li>
            <li>Close it with actual sell price and fees to build your <Link to="/journal" className="text-primary underline">Journal</Link>.</li>
            <li>Ask <Link to="/chat" className="text-primary underline">Waides KI</Link> questions grounded in your real data.</li>
          </ol>
        </section>

        <section>
          <h2 className="text-base font-semibold">Safety principles</h2>
          <ul className="mt-2 list-disc pl-5 space-y-1 text-muted-foreground">
            <li>API keys, when connected, must be read-only. The app rejects trading permissions.</li>
            <li>Secrets are encrypted server-side and never returned to the browser.</li>
            <li>All trade data is scoped to your account and inaccessible to other users.</li>
            <li>KI answers only from your authorized data; it will say when information is missing or stale.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold">Not financial advice</h2>
          <p className="mt-2 text-muted-foreground">
            Nothing in this product is financial, investment, tax, or legal advice. Verify prices, fees,
            and merchant conditions on the exchange before acting.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
