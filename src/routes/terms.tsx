import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms — KI Market Inventory" },
      { name: "description", content: "Terms of use for KI Market Inventory." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 text-sm">
      <Link to="/" className="text-primary underline">← Back</Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Terms of Use</h1>

      <h2 className="mt-6 text-lg font-semibold">Not financial advice</h2>
      <p className="mt-2 text-muted-foreground">
        KI Market Inventory is a personal tracking and decision-support tool. Nothing shown in the app is
        financial, investment, tax, or legal advice. All KI outputs are probabilistic estimates, not
        guarantees. You are solely responsible for any trades you place elsewhere.
      </p>

      <h2 className="mt-6 text-lg font-semibold">No execution, no custody</h2>
      <p className="mt-2 text-muted-foreground">
        The app never executes trades, moves funds, or requests trading permissions. Any exchange
        integration is read-only.
      </p>

      <h2 className="mt-6 text-lg font-semibold">Acceptable use</h2>
      <p className="mt-2 text-muted-foreground">
        Do not abuse the service, attempt to access other users' data, share credentials, or use the app
        for illegal activity.
      </p>

      <h2 className="mt-6 text-lg font-semibold">Availability</h2>
      <p className="mt-2 text-muted-foreground">
        The service is provided "as is" without warranty. We may change or discontinue features at any
        time.
      </p>
    </main>
  );
}
