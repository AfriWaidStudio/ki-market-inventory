/**
 * SaaS spend & vendor management math.
 * Finds the three things that actually leak money: unused seats,
 * duplicate tooling, and renewals that pass their cancellation window.
 */

export interface Subscription {
  id: string;
  vendor_id: string;
  vendor_name: string;
  category: string | null;
  plan: string;
  seats: number;
  active_seats: number | null;
  unit_cost: number;
  currency: string;
  billing_cycle: string;
  renewal_date: string | null;
  auto_renew: boolean;
  status: string;
  cancellation_notice_days: number;
}

export const BILLING_CYCLES = ["monthly", "quarterly", "annual"] as const;

export function cycleMonths(cycle: string): number {
  if (cycle === "annual") return 12;
  if (cycle === "quarterly") return 3;
  return 1;
}

export function monthlyCost(s: Subscription): number {
  const perCycle = s.unit_cost * Math.max(1, s.seats);
  return perCycle / cycleMonths(s.billing_cycle);
}

export function annualCost(s: Subscription): number {
  return monthlyCost(s) * 12;
}

export function utilization(s: Subscription): number | null {
  if (s.active_seats == null || s.seats <= 0) return null;
  return Math.min(1, s.active_seats / s.seats);
}

/** Spend attached to seats nobody is using. */
export function wastedMonthly(s: Subscription): number {
  const u = utilization(s);
  if (u == null) return 0;
  const idleSeats = Math.max(0, s.seats - (s.active_seats ?? s.seats));
  return (idleSeats * s.unit_cost) / cycleMonths(s.billing_cycle);
}

export function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const t = Date.parse(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / 86_400_000);
}

export type RenewalUrgency = "overdue" | "act_now" | "soon" | "planned" | "unknown";

/** Urgency is measured against the cancellation deadline, not the renewal date. */
export function renewalUrgency(s: Subscription): { urgency: RenewalUrgency; daysToDecide: number | null } {
  const d = daysUntil(s.renewal_date);
  if (d == null) return { urgency: "unknown", daysToDecide: null };
  const daysToDecide = d - s.cancellation_notice_days;
  if (d < 0) return { urgency: "overdue", daysToDecide };
  if (daysToDecide <= 0) return { urgency: "act_now", daysToDecide };
  if (daysToDecide <= 14) return { urgency: "soon", daysToDecide };
  return { urgency: "planned", daysToDecide };
}

export interface DuplicateGroup {
  category: string;
  subscriptions: Subscription[];
  monthlyTotal: number;
  potentialSaving: number;
}

/** Two tools in one category is a negotiation lever, not automatically waste. */
export function findDuplicates(subs: Subscription[]): DuplicateGroup[] {
  const byCategory = new Map<string, Subscription[]>();
  for (const s of subs) {
    if (s.status !== "active" || !s.category) continue;
    const key = s.category.trim().toLowerCase();
    byCategory.set(key, [...(byCategory.get(key) ?? []), s]);
  }
  const groups: DuplicateGroup[] = [];
  for (const [category, list] of byCategory) {
    if (list.length < 2) continue;
    const costs = list.map(monthlyCost).sort((a, b) => a - b);
    const monthlyTotal = costs.reduce((a, b) => a + b, 0);
    groups.push({
      category,
      subscriptions: list,
      monthlyTotal,
      // Consolidating onto the largest tool saves the smaller ones.
      potentialSaving: monthlyTotal - costs[costs.length - 1]!,
    });
  }
  return groups.sort((a, b) => b.potentialSaving - a.potentialSaving);
}

export interface SpendSummary {
  monthlyTotal: number;
  annualTotal: number;
  activeCount: number;
  vendorCount: number;
  wastedMonthly: number;
  duplicateSaving: number;
  renewalsNext30: number;
  actNow: Subscription[];
  topSpend: Subscription[];
  savingsFound: number;
}

export function summarize(subs: Subscription[]): SpendSummary {
  const active = subs.filter((s) => s.status === "active");
  const monthlyTotal = active.reduce((a, s) => a + monthlyCost(s), 0);
  const waste = active.reduce((a, s) => a + wastedMonthly(s), 0);
  const duplicates = findDuplicates(active);
  const duplicateSaving = duplicates.reduce((a, g) => a + g.potentialSaving, 0);
  const actNow = active.filter((s) => {
    const u = renewalUrgency(s).urgency;
    return u === "act_now" || u === "overdue";
  });
  const renewalsNext30 = active.filter((s) => {
    const d = daysUntil(s.renewal_date);
    return d != null && d >= 0 && d <= 30;
  }).length;

  return {
    monthlyTotal,
    annualTotal: monthlyTotal * 12,
    activeCount: active.length,
    vendorCount: new Set(active.map((s) => s.vendor_id)).size,
    wastedMonthly: waste,
    duplicateSaving,
    renewalsNext30,
    actNow,
    topSpend: [...active].sort((a, b) => monthlyCost(b) - monthlyCost(a)).slice(0, 5),
    savingsFound: (waste + duplicateSaving) * 12,
  };
}

export const SAAS_CATEGORIES = [
  "Analytics",
  "CRM",
  "Design",
  "Communication",
  "Project management",
  "Infrastructure",
  "Security",
  "Marketing",
  "Finance",
  "AI",
  "Support",
  "HR",
];
