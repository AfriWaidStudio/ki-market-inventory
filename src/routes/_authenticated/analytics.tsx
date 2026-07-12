import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { StatCard } from "@/components/StatCard";
import { analyticsSeries } from "@/lib/analytics.functions";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analytics — KI Market Inventory" }] }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const fn = useServerFn(analyticsSeries);
  const q = useQuery({ queryKey: ["analytics-series"], queryFn: () => fn() });

  if (q.isLoading) return <AppShell title="Analytics"><div className="text-muted-foreground">Loading…</div></AppShell>;
  const d = q.data ?? { profitByDay: [], profitByType: [], profitByHour: [], capitalGrowth: [], kiAccuracy: 0 };

  return (
    <AppShell title="Analytics">
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <StatCard label="Closed trades" value={`${d.profitByDay.length} days tracked`} />
        <StatCard label="KI accuracy" value={`${(d.kiAccuracy * 100).toFixed(1)}%`} tone="profit" />
        <StatCard label="Best hour" value={bestHourLabel(d.profitByHour)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Profit by day">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={d.profitByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }} />
              <Line type="monotone" dataKey="profit" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Paper vs manual realized profit">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={d.profitByType}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }} />
              <Bar dataKey="manual" fill="var(--profit)" />
              <Bar dataKey="paper" fill="var(--color-primary)" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Cumulative capital growth">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={d.capitalGrowth}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }} />
              <Line type="monotone" dataKey="cumulative" stroke="var(--profit)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Profit by hour of day" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={d.profitByHour}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="hour" stroke="var(--color-muted-foreground)" fontSize={11} />
              <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
              <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }} />
              <Bar dataKey="profit" fill="var(--color-primary)" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </AppShell>
  );
}

function ChartCard({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-card p-5 ${className}`}>
      <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3">{title}</h3>
      {children}
    </div>
  );
}

function bestHourLabel(rows: Array<{ hour: number; profit: number }>): string {
  if (!rows.length) return "—";
  const best = [...rows].sort((a, b) => b.profit - a.profit)[0];
  if (best.profit <= 0) return "—";
  return `${best.hour.toString().padStart(2, "0")}:00`;
}
