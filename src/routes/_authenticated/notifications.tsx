import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/StatCard";
import { fmtAge } from "@/lib/freshness";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  runAlertScan,
} from "@/lib/notifications.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — KI Market Inventory" },
      {
        name: "description",
        content: "Proactive alerts from Waides KI: opportunity windows, break-even breaches, feed outages and risk warnings.",
      },
    ],
  }),
  component: NotificationsPage,
});

const TONE = {
  critical: "loss",
  warning: "warning",
  success: "profit",
  info: "info",
} as const;

function NotificationsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listNotifications);
  const readFn = useServerFn(markNotificationRead);
  const readAllFn = useServerFn(markAllNotificationsRead);
  const scanFn = useServerFn(runAlertScan);

  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listFn(),
    refetchInterval: 60_000,
  });

  const scan = useMutation({
    mutationFn: () => scanFn(),
    onSuccess: (r) => {
      toast.success(
        r.created > 0 ? `${r.created} new alert${r.created === 1 ? "" : "s"}` : "No new alerts",
      );
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["risk-alerts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const items = data ?? [];
  const unread = items.filter((n) => !n.read_at).length;

  return (
    <AppShell title="Notifications">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground max-w-2xl">
          Waides KI watches your open positions, live feeds and route persistence, and only speaks when
          something actually changed. {unread > 0 ? `${unread} unread.` : "All caught up."}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => scan.mutate()}
            disabled={scan.isPending}
            className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {scan.isPending ? "Scanning…" : "Run scan now"}
          </button>
          <button
            onClick={async () => {
              await readAllFn();
              qc.invalidateQueries({ queryKey: ["notifications"] });
            }}
            className="rounded-lg border border-border px-3 py-2 text-sm"
          >
            Mark all read
          </button>
        </div>
      </div>

      <div className="mt-6 space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && items.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No alerts yet. Run a scan to have KI evaluate your positions and the live market.
          </div>
        )}
        {items.map((n) => (
          <div
            key={n.id}
            className={`rounded-xl border bg-card p-4 ${
              n.read_at ? "border-border opacity-70" : "border-primary/40"
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={TONE[n.severity as keyof typeof TONE] ?? "default"}>{n.severity}</Badge>
              <span className="text-sm font-medium">{n.title}</span>
              <span className="text-xs text-muted-foreground">{fmtAge(n.created_at)}</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{n.body}</p>
            <div className="mt-3 flex gap-3 text-xs">
              {n.link && (
                <a href={n.link} className="text-primary underline">
                  Open
                </a>
              )}
              {!n.read_at && (
                <button
                  className="text-muted-foreground hover:text-foreground"
                  onClick={async () => {
                    await readFn({ data: { id: n.id } });
                    qc.invalidateQueries({ queryKey: ["notifications"] });
                  }}
                >
                  Mark read
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
