import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { DEFAULT_FEE_PROFILES, type FeeProfile } from "./fees";

const FeeProfileInput = z.object({
  exchange: z.string().min(1).max(40),
  trade_fee_pct: z.number().min(0).max(20),
  payment_fee_pct: z.number().min(0).max(20),
  payment_fee_flat: z.number().min(0),
  withdrawal_fee_asset: z.number().min(0),
  network: z.string().max(20).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export type FeeProfileRow = FeeProfile & { id: string; notes: string | null };

/** Returns the user's saved profiles merged over the conservative defaults. */
export const listFeeProfiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("market_inventory_fee_profiles")
      .select("*")
      .order("exchange");
    if (error) throw new Error(error.message);

    const saved = new Map<string, FeeProfileRow>();
    for (const r of data ?? []) {
      saved.set(r.exchange, {
        id: r.id,
        exchange: r.exchange,
        trade_fee_pct: Number(r.trade_fee_pct),
        payment_fee_pct: Number(r.payment_fee_pct),
        payment_fee_flat: Number(r.payment_fee_flat),
        withdrawal_fee_asset: Number(r.withdrawal_fee_asset),
        network: r.network,
        notes: r.notes,
      });
    }
    const merged: FeeProfileRow[] = [];
    for (const [exchange, def] of Object.entries(DEFAULT_FEE_PROFILES)) {
      merged.push(saved.get(exchange) ?? { ...def, id: `default:${exchange}`, notes: null });
    }
    for (const [exchange, row] of saved) {
      if (!DEFAULT_FEE_PROFILES[exchange]) merged.push(row);
    }
    return merged;
  });

export const upsertFeeProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FeeProfileInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("market_inventory_fee_profiles").upsert(
      {
        user_id: context.userId,
        exchange: data.exchange,
        trade_fee_pct: data.trade_fee_pct,
        payment_fee_pct: data.payment_fee_pct,
        payment_fee_flat: data.payment_fee_flat,
        withdrawal_fee_asset: data.withdrawal_fee_asset,
        network: data.network ?? null,
        notes: data.notes ?? null,
      },
      { onConflict: "user_id,exchange" },
    );
    if (error) throw new Error(error.message);
    await context.supabase.from("market_inventory_audit_log").insert({
      user_id: context.userId,
      action: "fee_profile_updated",
      metadata: { exchange: data.exchange },
    });
    return { ok: true };
  });

export const deleteFeeProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ exchange: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("market_inventory_fee_profiles")
      .delete()
      .eq("exchange", data.exchange);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
