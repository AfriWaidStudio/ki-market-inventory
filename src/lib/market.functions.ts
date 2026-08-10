import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { summariseItems, type PriceRow } from "@/lib/sabi";

export const listMarket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ city: z.string().optional(), category: z.string().optional(), q: z.string().optional() })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("sabi_price_reports")
      .select("id, item, category, unit, price, currency, vendor, area, city, country, observed_at")
      .order("observed_at", { ascending: false })
      .limit(600);

    if (data.city) query = query.eq("city", data.city);
    if (data.category) query = query.eq("category", data.category);
    if (data.q) query = query.ilike("item", `%${data.q}%`);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const { data: all } = await context.supabase.from("sabi_price_reports").select("city, category");
    const cities = Array.from(new Set((all ?? []).map((r) => r.city))).sort();
    const categories = Array.from(new Set((all ?? []).map((r) => r.category))).sort();

    const { data: saved } = await context.supabase
      .from("sabi_saved_items")
      .select("item")
      .eq("user_id", context.userId);

    return {
      reports: (rows ?? []) as PriceRow[],
      items: summariseItems((rows ?? []) as PriceRow[]),
      cities,
      categories,
      saved: (saved ?? []).map((s) => s.item),
    };
  });

export const addPriceReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        item: z.string().min(2).max(80),
        category: z.string().min(2).max(30),
        unit: z.string().min(1).max(30),
        price: z.number().positive(),
        currency: z.string().min(2).max(8),
        vendor: z.string().max(80).optional().nullable(),
        area: z.string().max(80).optional().nullable(),
        city: z.string().min(2).max(60),
        country: z.string().min(2).max(60),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("sabi_price_reports")
      .insert({ ...data, user_id: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleSavedItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ item: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("sabi_saved_items")
      .select("id")
      .eq("user_id", context.userId)
      .eq("item", data.item)
      .maybeSingle();

    if (existing) {
      const { error } = await context.supabase.from("sabi_saved_items").delete().eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { saved: false };
    }
    const { error } = await context.supabase
      .from("sabi_saved_items")
      .insert({ user_id: context.userId, item: data.item });
    if (error) throw new Error(error.message);
    return { saved: true };
  });
