import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { trustAggregate, type TrustResult } from "@/lib/sabi";

/**
 * Real local prices: markets, wholesale/retail reports, confirm/dispute votes,
 * price requests. New tables are not yet in generated types, so queries go
 * through a loosely-typed handle until the backend migration is applied.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = { from: (t: string) => any };
const loose = (sb: unknown) => sb as Loose;

/** "pampers" also finds "Pampers Baby Dry"; "action bitter" finds "Action Bitters". */
const ALIASES: Record<string, string> = {
  pampas: "pampers",
  pamper: "pampers",
  diaper: "pampers",
  "action bitter": "action bitters",
  mangoes: "mango",
  garri: "garri",
  gari: "garri",
};
export function normaliseQuery(q: string): string {
  const s = q.trim().toLowerCase();
  return ALIASES[s] ?? s.replace(/s$/, "");
}

export interface MarketRow {
  id: string;
  name: string;
  city: string;
  state: string | null;
  currency: string;
}

export interface ReportRow {
  id: string;
  item: string;
  unit: string;
  price: number;
  currency: string;
  vendor: string | null;
  price_type: "retail" | "wholesale";
  kind: "goods" | "service";
  photo_url: string | null;
  observed_at: string;
  user_id: string | null;
  confirms: number;
  disputes: number;
  my_vote: "confirm" | "dispute" | null;
  mine: boolean;
}

export interface ItemCard {
  item: string;
  unit: string;
  currency: string;
  wholesale: TrustResult;
  retail: TrustResult;
  reports: ReportRow[];
}

export const listMarkets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await loose(context.supabase)
      .from("sabi_markets")
      .select("id, name, city, state, currency")
      .order("city");
    if (error) throw new Error(error.message);
    return (data ?? []) as MarketRow[];
  });

export const addMarket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ name: z.string().min(3).max(80), city: z.string().min(2).max(60), state: z.string().max(60).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await loose(context.supabase).from("sabi_markets").insert({ ...data, created_by: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const searchRealPrices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ marketId: z.string().uuid(), q: z.string().max(80).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = loose(context.supabase);
    let query = sb
      .from("sabi_price_reports")
      .select("id, item, unit, price, currency, vendor, price_type, kind, photo_url, observed_at, user_id")
      .eq("market_id", data.marketId)
      .eq("is_sample", false)
      .order("observed_at", { ascending: false })
      .limit(500);
    if (data.q) query = query.ilike("item", `%${normaliseQuery(data.q)}%`);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    const reports = (rows ?? []) as Omit<ReportRow, "confirms" | "disputes" | "my_vote" | "mine">[];

    const ids = reports.map((r) => r.id);
    const votes: { report_id: string; user_id: string; vote: "confirm" | "dispute" }[] = [];
    if (ids.length) {
      const { data: v } = await sb.from("sabi_price_votes").select("report_id, user_id, vote").in("report_id", ids);
      votes.push(...(v ?? []));
    }
    const enriched: ReportRow[] = reports.map((r) => {
      const mine = votes.filter((v) => v.report_id === r.id);
      return {
        ...r,
        confirms: mine.filter((v) => v.vote === "confirm").length,
        disputes: mine.filter((v) => v.vote === "dispute").length,
        my_vote: mine.find((v) => v.user_id === context.userId)?.vote ?? null,
        mine: r.user_id === context.userId,
      };
    });

    const groups = new Map<string, ReportRow[]>();
    for (const r of enriched) {
      const k = `${r.item.toLowerCase()}::${r.unit.toLowerCase()}`;
      groups.set(k, [...(groups.get(k) ?? []), r]);
    }
    const cards: ItemCard[] = Array.from(groups.values()).map((list) => {
      const toInput = (r: ReportRow) => ({ ...r, has_photo: !!r.photo_url });
      return {
        item: list[0]!.item,
        unit: list[0]!.unit,
        currency: list[0]!.currency,
        wholesale: trustAggregate(list.filter((r) => r.price_type === "wholesale").map(toInput)),
        retail: trustAggregate(list.filter((r) => r.price_type === "retail").map(toInput)),
        reports: list,
      };
    });

    const { data: reqs } = await sb
      .from("sabi_price_requests")
      .select("id, item, price_type, created_at, user_id")
      .eq("market_id", data.marketId)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(30);

    return { cards, requests: (reqs ?? []) as { id: string; item: string; price_type: string; created_at: string; user_id: string }[] };
  });

export const reportRealPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        marketId: z.string().uuid(),
        item: z.string().min(2).max(80),
        unit: z.string().min(1).max(40),
        price: z.number().positive().max(1e9),
        price_type: z.enum(["retail", "wholesale"]),
        kind: z.enum(["goods", "service"]),
        category: z.string().min(2).max(30).default("other"),
        vendor: z.string().max(80).optional().nullable(),
        photo_url: z.string().url().max(500).optional().nullable(),
        requestId: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = loose(context.supabase);
    const { data: m, error: me } = await sb.from("sabi_markets").select("city, country, currency").eq("id", data.marketId).single();
    if (me || !m) throw new Error("Market not found");
    const { error } = await sb.from("sabi_price_reports").insert({
      user_id: context.userId,
      market_id: data.marketId,
      item: data.item.trim(),
      unit: data.unit.trim(),
      price: data.price,
      price_type: data.price_type,
      kind: data.kind,
      category: data.category,
      vendor: data.vendor ?? null,
      photo_url: data.photo_url ?? null,
      city: m.city,
      country: m.country,
      currency: m.currency,
    });
    if (error) throw new Error(error.message);
    if (data.requestId) {
      // Answered requests are closed by their owner; leave open for others to confirm.
    }
    return { ok: true };
  });

export const voteOnPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ reportId: z.string().uuid(), vote: z.enum(["confirm", "dispute"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await loose(context.supabase)
      .from("sabi_price_votes")
      .upsert({ report_id: data.reportId, user_id: context.userId, vote: data.vote }, { onConflict: "report_id,user_id" });
    if (error) throw new Error(error.message.includes("row-level") ? "You can't vote on your own price." : error.message);
    return { ok: true };
  });

export const requestPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ marketId: z.string().uuid(), item: z.string().min(2).max(80), price_type: z.enum(["retail", "wholesale"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await loose(context.supabase)
      .from("sabi_price_requests")
      .insert({ user_id: context.userId, market_id: data.marketId, item: data.item, price_type: data.price_type });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const closeRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await loose(context.supabase).from("sabi_price_requests").update({ status: "closed" }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
