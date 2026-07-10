import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/StatCard";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — KI Market Inventory" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  return (
    <AppShell title="Notifications">
      <div className="max-w-2xl space-y-4">
        <Badge tone="warning">Coming soon</Badge>
        <p className="text-sm text-muted-foreground">
          Notification channels (email, push, in-app) and quiet hours are not yet enabled. Active risk
          signals appear on the{" "}
          <a href="/risk-center" className="text-primary underline">
            Risk Center
          </a>{" "}
          in the meantime.
        </p>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Planned channels
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground list-disc pl-5">
            <li>Email — daily digest, critical risk alerts</li>
            <li>In-app — real-time alerts while browsing</li>
            <li>Push — opt-in for time-sensitive opportunities</li>
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
