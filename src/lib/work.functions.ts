import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listWork = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        city: z.string().optional(),
        category: z.string().optional(),
        remoteOnly: z.boolean().optional(),
        q: z.string().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    let gigs = context.supabase
      .from("sabi_gigs")
      .select(
        "id, title, category, pay_amount, pay_unit, currency, location, city, country, remote, skill_level, contact, source, posted_at",
      )
      .order("posted_at", { ascending: false })
      .limit(200);
    if (data.city) gigs = gigs.eq("city", data.city);
    if (data.category) gigs = gigs.eq("category", data.category);
    if (data.remoteOnly) gigs = gigs.eq("remote", true);
    if (data.q) gigs = gigs.ilike("title", `%${data.q}%`);

    const [gigRes, incomeRes, cityRes] = await Promise.all([
      gigs,
      context.supabase
        .from("sabi_income_logs")
        .select("id, work_date, source, amount, currency, hours, notes")
        .eq("user_id", context.userId)
        .order("work_date", { ascending: false })
        .limit(180),
      context.supabase.from("sabi_gigs").select("city, category"),
    ]);
    if (gigRes.error) throw new Error(gigRes.error.message);

    return {
      gigs: gigRes.data ?? [],
      income: incomeRes.data ?? [],
      cities: Array.from(new Set((cityRes.data ?? []).map((r) => r.city))).sort(),
      categories: Array.from(new Set((cityRes.data ?? []).map((r) => r.category))).sort(),
    };
  });

export const addIncomeLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        work_date: z.string(),
        source: z.string().min(2).max(80),
        amount: z.number().positive(),
        currency: z.string().min(2).max(8),
        hours: z.number().min(0).max(24),
        notes: z.string().max(200).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("sabi_income_logs")
      .insert({ ...data, user_id: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteIncomeLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("sabi_income_logs")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
