import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { summariseDrugs, type MedRow } from "@/lib/sabi";

export const listCare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ city: z.string().optional(), q: z.string().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    let meds = context.supabase
      .from("sabi_med_prices")
      .select("id, drug, form, pack_size, pharmacy, price, currency, in_stock, area, city, phone, observed_at")
      .order("observed_at", { ascending: false })
      .limit(400);
    if (data.city) meds = meds.eq("city", data.city);
    if (data.q) meds = meds.ilike("drug", `%${data.q}%`);

    let facilities = context.supabase
      .from("sabi_facilities")
      .select("id, name, kind, area, city, country, phone, hours, open_24h")
      .order("name");
    if (data.city) facilities = facilities.eq("city", data.city);

    const [medRes, facRes, remRes, cityRes] = await Promise.all([
      meds,
      facilities,
      context.supabase
        .from("sabi_reminders")
        .select("id, label, kind, dose, times_per_day, next_at, active")
        .eq("user_id", context.userId)
        .order("next_at"),
      context.supabase.from("sabi_med_prices").select("city"),
    ]);
    if (medRes.error) throw new Error(medRes.error.message);

    const rows = (medRes.data ?? []) as MedRow[];
    return {
      meds: rows,
      drugs: summariseDrugs(rows),
      facilities: facRes.data ?? [],
      reminders: remRes.data ?? [],
      cities: Array.from(new Set((cityRes.data ?? []).map((r) => r.city))).sort(),
    };
  });

export const addMedPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        drug: z.string().min(2).max(80),
        form: z.string().min(2).max(30),
        pack_size: z.string().max(40).optional().nullable(),
        pharmacy: z.string().min(2).max(80),
        price: z.number().positive(),
        currency: z.string().min(2).max(8),
        in_stock: z.boolean(),
        area: z.string().max(80).optional().nullable(),
        city: z.string().min(2).max(60),
        country: z.string().min(2).max(60),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("sabi_med_prices")
      .insert({ ...data, user_id: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        label: z.string().min(2).max(80),
        kind: z.string().min(2).max(20),
        dose: z.string().max(60).optional().nullable(),
        times_per_day: z.number().int().min(1).max(12),
        next_at: z.string(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("sabi_reminders")
      .insert({ ...data, user_id: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markReminderTaken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rem, error: readErr } = await context.supabase
      .from("sabi_reminders")
      .select("times_per_day, next_at")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!rem) throw new Error("Reminder not found");

    const gapHours = 24 / Math.max(1, rem.times_per_day);
    const next = new Date(Date.now() + gapHours * 3_600_000).toISOString();
    const { error } = await context.supabase
      .from("sabi_reminders")
      .update({ next_at: next })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { next_at: next };
  });

export const deleteReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("sabi_reminders")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
