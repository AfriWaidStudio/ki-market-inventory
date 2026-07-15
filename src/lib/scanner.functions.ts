import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { scoreOpportunity } from "./ki-logic";

const SnapshotInput = z.object({
  exchange: z.string().min(1),
  asset: z.string().default("USDT"),
  side: z.enum(["buy", "sell"]),
  price: z.number().positive(),
  currency: z.string().default("NGN"),
  liquidity_score: z.number().min(0).max(100).nullable().optional(),
  merchant_count: z.number().int().min(0).nullable().optional(),
  merchant_rating: z.number().min(0).max(5).nullable().optional(),
});

export const submitPriceSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SnapshotInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("market_inventory_price_snapshots").insert({
      user_id: context.userId,
      exchange: data.exchange,
      asset: data.asset,
      side: data.side,
      price: data.price,
      currency: data.currency,
      liquidity_score: data.liquidity_score ?? null,
      merchant_count: data.merchant_count ?? null,
      merchant_rating: data.merchant_rating ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listRecentSnapshots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("market_inventory_price_snapshots")
      .select("*")
      .order("captured_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const AmountInput = z.object({ amount: z.number().positive().default(100) });
export const listOpportunities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AmountInput.parse(d ?? { amount: 100 }))
  .handler(async ({ data, context }) => {
    const { data: snaps, error } = await context.supabase
      .from("market_inventory_price_snapshots")
      .select("*")
      .order("captured_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    // Keep latest per (exchange, side)
    const latest = new Map<string, (typeof snaps)[number]>();
    for (const s of snaps ?? []) {
      const key = `${s.exchange}::${s.side}`;
      if (!latest.has(key)) latest.set(key, s);
    }
    const buys = Array.from(latest.values()).filter((s) => s.side === "buy");
    const sells = Array.from(latest.values()).filter((s) => s.side === "sell");

    const opps: Array<{
      buy_exchange: string;
      sell_exchange: string;
      buy_price: number;
      sell_price: number;
      currency: string;
      buy_captured_at: string;
      sell_captured_at: string;
      liquidity_score: number | null;
      merchant_count: number | null;
      merchant_rating: number | null;
      spread: number;
      spreadPct: number;
      netProfit: number;
      confidence: number;
      risk: number;
      recommendation: string;
      reasoning: string;
    }> = [];

    const estFees = 0; // manual scanner assumes 0 by default; UI can extend
    for (const b of buys) {
      for (const s of sells) {
        if (b.exchange === s.exchange) continue;
        const score = scoreOpportunity({
          buyPrice: Number(b.price),
          sellPrice: Number(s.price),
          amount: data.amount,
          estimatedFees: estFees,
          liquidityScore: (b.liquidity_score as number) ?? (s.liquidity_score as number) ?? null,
          merchantCount: (b.merchant_count as number) ?? null,
          merchantRating: (b.merchant_rating as number) ?? null,
        });
        opps.push({
          buy_exchange: b.exchange,
          sell_exchange: s.exchange,
          buy_price: Number(b.price),
          sell_price: Number(s.price),
          currency: b.currency,
          buy_captured_at: b.captured_at as string,
          sell_captured_at: s.captured_at as string,
          liquidity_score: (b.liquidity_score as number) ?? null,
          merchant_count: (b.merchant_count as number) ?? null,
          merchant_rating: (b.merchant_rating as number) ?? null,
          ...score,
        });
      }
    }
    opps.sort((a, b) => b.netProfit - a.netProfit);
    return opps;
  });
