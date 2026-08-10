/**
 * Sabi core math — pure, dependency-free, shared by server functions and UI.
 *
 * One idea runs through the whole product: take messy real-world numbers
 * (prices, wages, stock), line them up honestly, and say what to do.
 */

export interface PriceRow {
  id: string;
  item: string;
  category: string;
  unit: string;
  price: number;
  currency: string;
  vendor: string | null;
  area: string | null;
  city: string;
  country: string;
  observed_at: string;
}

export interface ItemSummary {
  item: string;
  category: string;
  unit: string;
  currency: string;
  city: string;
  count: number;
  cheapest: PriceRow;
  dearest: PriceRow;
  median: number;
  average: number;
  spread: number;
  savingsPct: number;
  freshestAt: string;
}

export function hoursAgo(iso: string): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 9999;
  return (Date.now() - t) / 3_600_000;
}

export function freshnessLabel(iso: string): { label: string; tone: "profit" | "warning" | "loss" } {
  const h = hoursAgo(iso);
  if (h < 1) return { label: "just now", tone: "profit" };
  if (h < 24) return { label: `${Math.round(h)}h ago`, tone: "profit" };
  if (h < 72) return { label: `${Math.round(h / 24)}d ago`, tone: "warning" };
  return { label: `${Math.round(h / 24)}d ago`, tone: "loss" };
}

export function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? (s[mid] as number) : (((s[mid - 1] as number) + (s[mid] as number)) / 2);
}

/** Group raw community reports into "one row per thing you buy". */
export function summariseItems(rows: PriceRow[]): ItemSummary[] {
  const groups = new Map<string, PriceRow[]>();
  for (const r of rows) {
    const key = `${r.item.toLowerCase()}::${r.city}::${r.unit}`;
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }

  const out: ItemSummary[] = [];
  for (const list of groups.values()) {
    const sorted = [...list].sort((a, b) => a.price - b.price);
    const cheapest = sorted[0] as PriceRow;
    const dearest = sorted[sorted.length - 1] as PriceRow;
    const prices = sorted.map((r) => r.price);
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    const spread = dearest.price - cheapest.price;
    out.push({
      item: cheapest.item,
      category: cheapest.category,
      unit: cheapest.unit,
      currency: cheapest.currency,
      city: cheapest.city,
      count: list.length,
      cheapest,
      dearest,
      median: median(prices),
      average: avg,
      spread,
      savingsPct: dearest.price > 0 ? spread / dearest.price : 0,
      freshestAt: list.reduce((a, r) => (hoursAgo(r.observed_at) < hoursAgo(a) ? r.observed_at : a), list[0]!.observed_at),
    });
  }
  return out.sort((a, b) => b.spread - a.spread);
}

export interface MedRow {
  id: string;
  drug: string;
  form: string;
  pack_size: string | null;
  pharmacy: string;
  price: number;
  currency: string;
  in_stock: boolean;
  area: string | null;
  city: string;
  phone: string | null;
  observed_at: string;
}

export interface DrugSummary {
  drug: string;
  form: string;
  currency: string;
  city: string;
  options: MedRow[];
  cheapestInStock: MedRow | null;
  dearest: MedRow;
  saving: number;
  savingPct: number;
  stockOutCount: number;
}

export function summariseDrugs(rows: MedRow[]): DrugSummary[] {
  const groups = new Map<string, MedRow[]>();
  for (const r of rows) {
    const key = `${r.drug.toLowerCase()}::${r.city}`;
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }
  const out: DrugSummary[] = [];
  for (const list of groups.values()) {
    const sorted = [...list].sort((a, b) => a.price - b.price);
    const inStock = sorted.filter((r) => r.in_stock);
    const cheapestInStock = inStock[0] ?? null;
    const dearest = sorted[sorted.length - 1] as MedRow;
    const saving = cheapestInStock ? dearest.price - cheapestInStock.price : 0;
    out.push({
      drug: (sorted[0] as MedRow).drug,
      form: (sorted[0] as MedRow).form,
      currency: (sorted[0] as MedRow).currency,
      city: (sorted[0] as MedRow).city,
      options: sorted,
      cheapestInStock,
      dearest,
      saving,
      savingPct: dearest.price > 0 ? saving / dearest.price : 0,
      stockOutCount: sorted.length - inStock.length,
    });
  }
  return out.sort((a, b) => b.saving - a.saving);
}

/** Everyone's pay is quoted differently. Put it all on one monthly ruler. */
export function monthlyEquivalent(amount: number, unit: string): number {
  switch (unit) {
    case "hour":
      return amount * 8 * 22;
    case "day":
      return amount * 22;
    case "week":
      return amount * 4.33;
    case "month":
      return amount;
    case "year":
      return amount / 12;
    default:
      return amount; // per task — not comparable, shown as-is
  }
}

export function hourlyEquivalent(amount: number, unit: string): number {
  return monthlyEquivalent(amount, unit) / (8 * 22);
}

export interface ShopProduct {
  id: string;
  name: string;
  unit: string;
  cost_price: number;
  sell_price: number;
  stock: number;
  low_stock_at: number;
  currency: string;
}

export interface ShopSale {
  id: string;
  product_name: string;
  qty: number;
  unit_price: number;
  unit_cost: number;
  currency: string;
  sold_at: string;
}

export function saleProfit(s: ShopSale): number {
  return (s.unit_price - s.unit_cost) * s.qty;
}

export function saleRevenue(s: ShopSale): number {
  return s.unit_price * s.qty;
}

export function isSameDay(iso: string, ref = new Date()): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

export function marginPct(p: ShopProduct): number {
  return p.sell_price > 0 ? (p.sell_price - p.cost_price) / p.sell_price : 0;
}

export const PRICE_CATEGORIES = [
  "food",
  "energy",
  "transport",
  "data",
  "rent",
  "school",
  "health",
  "other",
] as const;

export const GIG_CATEGORIES = [
  "logistics",
  "retail",
  "digital",
  "technical",
  "transport",
  "construction",
  "beauty",
  "education",
  "crafts",
  "general",
] as const;
