import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy — KI Market Inventory" },
      { name: "description", content: "How KI Market Inventory handles your data." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 text-sm">
      <Link to="/" className="text-primary underline">← Back</Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Privacy</h1>
      <p className="mt-4 text-muted-foreground">
        KI Market Inventory stores only the data you enter or authorize. Your trades, notes, and any
        connected exchange keys are scoped to your account and protected by row-level security.
      </p>
      <h2 className="mt-8 text-lg font-semibold">What we store</h2>
      <ul className="mt-2 list-disc pl-5 space-y-1 text-muted-foreground">
        <li>Account: email, display name, preferred currency.</li>
        <li>Trades and price snapshots you record.</li>
        <li>Optional read-only exchange API keys, encrypted server-side.</li>
        <li>Audit log entries for sensitive actions.</li>
      </ul>
      <h2 className="mt-8 text-lg font-semibold">What we don't do</h2>
      <ul className="mt-2 list-disc pl-5 space-y-1 text-muted-foreground">
        <li>Execute trades or move funds.</li>
        <li>Request or use trading, withdrawal, or transfer permissions.</li>
        <li>Sell or share your trade data.</li>
      </ul>
      <h2 className="mt-8 text-lg font-semibold">Your controls</h2>
      <p className="mt-2 text-muted-foreground">
        You can export or delete your data at any time from Settings. Deleting your account removes all
        associated records.
      </p>
    </main>
  );
}
