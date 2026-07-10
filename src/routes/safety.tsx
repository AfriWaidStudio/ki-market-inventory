import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/safety")({
  head: () => ({
    meta: [
      { title: "Safety & Risk Disclosure — KI Market Inventory" },
      { name: "description", content: "Risk disclosure and safety principles for KI Market Inventory." },
    ],
  }),
  component: SafetyPage,
});

function SafetyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 text-sm">
      <Link to="/" className="text-primary underline">← Back</Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Safety & Risk</h1>

      <p className="mt-4 text-muted-foreground">
        P2P and arbitrage trading involves real financial risk. Spreads can close, merchants can cancel,
        transfers can delay, and networks can congest. KI Market Inventory helps you think — it does not
        remove that risk.
      </p>

      <h2 className="mt-6 text-lg font-semibold">What we do to protect you</h2>
      <ul className="mt-2 list-disc pl-5 space-y-1 text-muted-foreground">
        <li>API keys encrypted at rest; raw secrets never leave the server.</li>
        <li>Only read-only exchange permissions accepted.</li>
        <li>Every trade action logged in an audit trail.</li>
        <li>Row-level security scopes all data to its owner.</li>
        <li>KI answers are grounded in your real records; it will admit uncertainty.</li>
      </ul>

      <h2 className="mt-6 text-lg font-semibold">Report abuse or a suspicious merchant</h2>
      <p className="mt-2 text-muted-foreground">
        Use the Risk Center to record a merchant concern. For security issues, email the address
        published in your account settings.
      </p>
    </main>
  );
}
