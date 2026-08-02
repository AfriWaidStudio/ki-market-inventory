/** Data-freshness helpers — nothing should look more certain than it is. */

export type Freshness = "live" | "recent" | "stale" | "unknown";

export function ageSeconds(at: string | Date | null | undefined): number | null {
  if (!at) return null;
  const t = typeof at === "string" ? Date.parse(at) : at.getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.round((Date.now() - t) / 1000));
}

export function freshnessOf(at: string | Date | null | undefined): Freshness {
  const s = ageSeconds(at);
  if (s == null) return "unknown";
  if (s < 120) return "live";
  if (s < 600) return "recent";
  return "stale";
}

export function fmtAge(at: string | Date | null | undefined): string {
  const s = ageSeconds(at);
  if (s == null) return "—";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function freshnessLabel(at: string | Date | null | undefined): string {
  const f = freshnessOf(at);
  if (f === "unknown") return "No data";
  const prefix = f === "live" ? "Live" : f === "recent" ? "Recent" : "Stale";
  return `${prefix} · ${fmtAge(at)}`;
}

export function freshnessTone(at: string | Date | null | undefined): "profit" | "info" | "warning" | "default" {
  const f = freshnessOf(at);
  if (f === "live") return "profit";
  if (f === "recent") return "info";
  if (f === "stale") return "warning";
  return "default";
}
