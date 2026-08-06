import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { rankRates, type DutyProfile, type FreightRate } from "./freight";

export const listFreightLanes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [laneRes, rateRes, dutyRes] = await Promise.all([
      context.supabase.from("freight_lanes").select("*").order("created_at", { ascending: false }),
      context.supabase
        .from("freight_rates")
        .select("*")
        .order("observed_at", { ascending: false })
        .limit(1000),
      context.supabase.from("freight_duty_profiles").select("*").order("hs_code"),
    ]);
    if (laneRes.error) throw new Error(laneRes.error.message);
    if (rateRes.error) throw new Error(rateRes.error.message);

    const byLane = new Map<string, FreightRate[]>();
    for (const r of rateRes.data ?? []) {
      const row: FreightRate = {
        id: r.id,
        lane_id: r.lane_id,
        carrier: r.carrier,
        base_rate: Number(r.base_rate),
        currency: r.currency,
        surcharges: Number(r.surcharges),
        transit_days: r.transit_days,
        valid_until: r.valid_until,
        source: r.source,
        observed_at: r.observed_at as string,
      };
      byLane.set(r.lane_id, [...(byLane.get(r.lane_id) ?? []), row]);
    }

    // One rate per carrier per lane — the newest observation wins.
    const lanes = (laneRes.data ?? []).map((l) => {
      const all = byLane.get(l.id) ?? [];
      const latest = new Map<string, FreightRate>();
      for (const r of all) if (!latest.has(r.carrier)) latest.set(r.carrier, r);
      return { lane: l, rates: Array.from(latest.values()), observations: all.length };
    });

    return { lanes, duties: (dutyRes.data ?? []) as unknown as DutyProfile[] };
  });

const LaneInput = z.object({
  origin: z.string().min(1).max(80),
  destination: z.string().min(1).max(80),
  mode: z.string().min(2).max(20).default("ocean"),
  equipment: z.string().min(1).max(20).default("40ft"),
});

export const addFreightLane = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => LaneInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("freight_lanes").upsert(
      { user_id: context.userId, ...data, is_active: true },
      { onConflict: "user_id,origin,destination,mode,equipment" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeFreightLane = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("freight_lanes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const RateInput = z.object({
  lane_id: z.string().uuid(),
  carrier: z.string().min(1).max(80),
  base_rate: z.number().min(0),
  currency: z.string().min(2).max(8).default("USD"),
  surcharges: z.number().min(0).default(0),
  transit_days: z.number().int().min(0).max(365).optional().nullable(),
  valid_until: z.string().max(20).optional().nullable(),
  notes: z.string().max(300).optional().nullable(),
});

export const recordFreightRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RateInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("freight_rates").insert({
      user_id: context.userId,
      lane_id: data.lane_id,
      carrier: data.carrier,
      base_rate: data.base_rate,
      currency: data.currency.toUpperCase(),
      surcharges: data.surcharges,
      transit_days: data.transit_days ?? null,
      valid_until: data.valid_until || null,
      notes: data.notes ?? null,
      source: "manual",
      observed_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const DutyInput = z.object({
  hs_code: z.string().min(2).max(20),
  description: z.string().max(160).optional().nullable(),
  destination_country: z.string().min(2).max(60),
  duty_pct: z.number().min(0).max(1).default(0),
  vat_pct: z.number().min(0).max(1).default(0),
  other_fees_pct: z.number().min(0).max(1).default(0),
});

export const saveDutyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DutyInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("freight_duty_profiles").upsert(
      {
        user_id: context.userId,
        hs_code: data.hs_code,
        description: data.description ?? null,
        destination_country: data.destination_country,
        duty_pct: data.duty_pct,
        vat_pct: data.vat_pct,
        other_fees_pct: data.other_fees_pct,
      },
      { onConflict: "user_id,hs_code,destination_country" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const QuoteInput = z.object({
  lane_id: z.string().uuid(),
  cargo_value: z.number().min(0).default(0),
  insurance: z.number().min(0).default(0),
  units: z.number().int().min(0).optional().nullable(),
  hs_code: z.string().max(20).optional().nullable(),
  destination_country: z.string().max(60).optional().nullable(),
});

/** Landed-cost comparison across every carrier quoted on one lane. */
export const quoteLane = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => QuoteInput.parse(d))
  .handler(async ({ data, context }) => {
    const [rateRes, dutyRes] = await Promise.all([
      context.supabase
        .from("freight_rates")
        .select("*")
        .eq("lane_id", data.lane_id)
        .order("observed_at", { ascending: false })
        .limit(200),
      data.hs_code && data.destination_country
        ? context.supabase
            .from("freight_duty_profiles")
            .select("*")
            .eq("hs_code", data.hs_code)
            .eq("destination_country", data.destination_country)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (rateRes.error) throw new Error(rateRes.error.message);

    const latest = new Map<string, FreightRate>();
    for (const r of rateRes.data ?? []) {
      if (latest.has(r.carrier)) continue;
      latest.set(r.carrier, {
        id: r.id,
        lane_id: r.lane_id,
        carrier: r.carrier,
        base_rate: Number(r.base_rate),
        currency: r.currency,
        surcharges: Number(r.surcharges),
        transit_days: r.transit_days,
        valid_until: r.valid_until,
        source: r.source,
        observed_at: r.observed_at as string,
      });
    }

    const duty = (dutyRes as { data: unknown }).data as DutyProfile | null;
    const ranked = rankRates({
      rates: Array.from(latest.values()),
      cargoValue: data.cargo_value,
      insurance: data.insurance,
      units: data.units ?? null,
      duty: duty
        ? {
            hs_code: duty.hs_code,
            destination_country: duty.destination_country,
            duty_pct: Number(duty.duty_pct),
            vat_pct: Number(duty.vat_pct),
            other_fees_pct: Number(duty.other_fees_pct),
          }
        : null,
    });

    return { ranked, duty, generated_at: new Date().toISOString() };
  });
