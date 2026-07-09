import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "profit" | "loss" | "warning";
  className?: string;
}) {
  const toneClass =
    tone === "profit"
      ? "text-[color:var(--profit)]"
      : tone === "loss"
        ? "text-[color:var(--loss)]"
        : tone === "warning"
          ? "text-[color:var(--warning)]"
          : "text-foreground";
  return (
    <div className={cn("rounded-xl border border-border bg-card p-4", className)}>
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={cn("mt-2 text-2xl font-semibold tabular-nums", toneClass)}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function Badge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "profit" | "loss" | "warning" | "info";
}) {
  const map = {
    default: "bg-muted text-muted-foreground",
    profit: "bg-[color:var(--profit)]/15 text-[color:var(--profit)]",
    loss: "bg-[color:var(--loss)]/15 text-[color:var(--loss)]",
    warning: "bg-[color:var(--warning)]/15 text-[color:var(--warning)]",
    info: "bg-primary/15 text-primary",
  } as const;
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", map[tone])}>
      {children}
    </span>
  );
}
