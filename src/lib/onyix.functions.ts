import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { ONYIX_PER_SMAISIKA, onyixToSmaisika } from "@/lib/onyix";

export const onyixOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { ensureWallet } = await import("@/lib/field.server");
    const wallet = await ensureWallet(context.supabase, context.userId);

    const [ledgerRes, prufRes, empRes] = await Promise.all([
      context.supabase
        .from("onyix_ledger")
        .select("*")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(60),
      context.supabase
        .from("waidespruf_records")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(40),
      context.supabase
        .from("smai_employments")
        .select("being_code, runs, onyix_spent")
        .eq("user_id", context.userId),
    ]);

    return {
      wallet,
      ledger: ledgerRes.data ?? [],
      pruf: prufRes.data ?? [],
      employments: empRes.data ?? [],
      rate: ONYIX_PER_SMAISIKA,
    };
  });

/** Top up the Smaisika wallet. */
export const rechargeSmaisika = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ smaisika: z.number().positive().max(100000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { ensureWallet } = await import("@/lib/field.server");
    const wallet = await ensureWallet(context.supabase, context.userId);
    const next = Number(wallet.smaisika_balance) + data.smaisika;

    const { error } = await context.supabase
      .from("onyix_wallets")
      .update({ smaisika_balance: next })
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);

    await context.supabase.from("onyix_ledger").insert({
      user_id: context.userId,
      kind: "recharge",
      smaisika_delta: data.smaisika,
      source: "smaisika_wallet",
      reason: `Wallet recharged with ${data.smaisika} SMK`,
      tank_after: wallet.onyix_tank,
    });

    return { smaisika: next };
  });

/** Convert Smaisika into Onyix and pour it into the tank. 1 ONX = 0.001 SMK. */
export const refillTank = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ onyix: z.number().positive().max(10_000_000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { ensureWallet } = await import("@/lib/field.server");
    const wallet = await ensureWallet(context.supabase, context.userId);
    const price = onyixToSmaisika(data.onyix);

    if (Number(wallet.smaisika_balance) < price) {
      throw new Error(
        `Refilling ${Math.round(data.onyix)} ONX costs ${price.toFixed(3)} SMK, but your wallet holds ${Number(wallet.smaisika_balance).toFixed(3)} SMK. Recharge first.`,
      );
    }

    const tankAfter = Number(wallet.onyix_tank) + data.onyix;
    const { error } = await context.supabase
      .from("onyix_wallets")
      .update({ smaisika_balance: Number(wallet.smaisika_balance) - price, onyix_tank: tankAfter })
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);

    await context.supabase.from("onyix_ledger").insert({
      user_id: context.userId,
      kind: "refill",
      onyix_delta: data.onyix,
      smaisika_delta: -price,
      source: "webonyix",
      reason: `Tank refilled with ${Math.round(data.onyix)} ONX from WebOnyix`,
      tank_after: tankAfter,
    });

    return { tank: tankAfter, smaisika: Number(wallet.smaisika_balance) - price };
  });
