import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { summarize, findDuplicates, renewalUrgency, monthlyCost, type Subscription } from "./saas";

export const listSaasSpend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [vendorRes, subRes, eventRes] = await Promise.all([
      context.supabase.from("saas_vendors").select("*").order("name"),
      context.supabase.from("saas_subscriptions").select("*"),
      context.supabase
        .from("saas_price_events")
        .select("*")
        .order("effective_date", { ascending: false })
        .limit(100),
    ]);
    if (vendorRes.error) throw new Error(vendorRes.error.message);
    if (subRes.error) throw new Error(subRes.error.message);

    const vendors = vendorRes.data ?? [];
    const vendorById = new Map(vendors.map((v) => [v.id, v]));

    const subs: Subscription[] = (subRes.data ?? []).map((s) => ({
      id: s.id,
      vendor_id: s.vendor_id,
      vendor_name: vendorById.get(s.vendor_id)?.name ?? "Unknown vendor",
      category: vendorById.get(s.vendor_id)?.category ?? null,
      plan: s.plan,
      seats: s.seats,
      active_seats: s.active_seats,
      unit_cost: Number(s.unit_cost),
      currency: s.currency,
      billing_cycle: s.billing_cycle,
      renewal_date: s.renewal_date,
      auto_renew: s.auto_renew,
      status: s.status,
      cancellation_notice_days: s.cancellation_notice_days,
    }));

    const enriched = subs
      .map((s) => ({
        ...s,
        monthly: monthlyCost(s),
        ...renewalUrgency(s),
      }))
      .sort((a, b) => b.monthly - a.monthly);

    return {
      vendors,
      subscriptions: enriched,
      duplicates: findDuplicates(subs),
      summary: summarize(subs),
      priceEvents: eventRes.data ?? [],
    };
  });

const VendorInput = z.object({
  name: z.string().min(1).max(80),
  category: z.string().max(60).optional().nullable(),
  website: z.string().max(200).optional().nullable(),
  owner_name: z.string().max(80).optional().nullable(),
});

export const addSaasVendor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => VendorInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("saas_vendors")
      .upsert(
        {
          user_id: context.userId,
          name: data.name,
          category: data.category ?? null,
          website: data.website ?? null,
          owner_name: data.owner_name ?? null,
        },
        { onConflict: "user_id,name" },
      )
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

const SubInput = z.object({
  vendor_id: z.string().uuid(),
  plan: z.string().max(60).default("Standard"),
  seats: z.number().int().min(1).max(100000).default(1),
  active_seats: z.number().int().min(0).max(100000).optional().nullable(),
  unit_cost: z.number().min(0),
  currency: z.string().min(2).max(8).default("USD"),
  billing_cycle: z.enum(["monthly", "quarterly", "annual"]).default("monthly"),
  renewal_date: z.string().max(20).optional().nullable(),
  auto_renew: z.boolean().default(true),
  cancellation_notice_days: z.number().int().min(0).max(365).default(30),
});

export const addSaasSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SubInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("saas_subscriptions").insert({
      user_id: context.userId,
      vendor_id: data.vendor_id,
      plan: data.plan,
      seats: data.seats,
      active_seats: data.active_seats ?? null,
      unit_cost: data.unit_cost,
      currency: data.currency.toUpperCase(),
      billing_cycle: data.billing_cycle,
      renewal_date: data.renewal_date || null,
      auto_renew: data.auto_renew,
      cancellation_notice_days: data.cancellation_notice_days,
      status: "active",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Repricing a subscription also records the delta so trend analysis is real. */
export const repriceSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        new_unit_cost: z.number().min(0),
        note: z.string().max(300).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: sub, error: readErr } = await context.supabase
      .from("saas_subscriptions")
      .select("unit_cost")
      .eq("id", data.id)
      .single();
    if (readErr) throw new Error(readErr.message);

    const { error } = await context.supabase
      .from("saas_subscriptions")
      .update({ unit_cost: data.new_unit_cost })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await context.supabase.from("saas_price_events").insert({
      user_id: context.userId,
      subscription_id: data.id,
      old_amount: Number(sub.unit_cost),
      new_amount: data.new_unit_cost,
      note: data.note ?? null,
    });
    return { ok: true };
  });

export const setSubscriptionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ id: z.string().uuid(), status: z.enum(["active", "cancelled", "paused"]) })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("saas_subscriptions")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
