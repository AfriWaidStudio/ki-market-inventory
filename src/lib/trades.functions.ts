import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { scoreOpportunity, analyseClose } from "./ki-logic";

const CreateInput = z.object({
  asset: z.string().min(1).default("USDT"),
  amount: z.number().positive(),
  buy_exchange: z.string().min(1),
  sell_exchange: z.string().min(1),
  buy_price: z.number().positive(),
  expected_sell_price: z.number().positive(),
  estimated_fees: z.number().min(0).default(0),
  currency: z.string().min(1).default("NGN"),
  liquidity_score: z.number().min(0).max(100).nullable().optional(),
  merchant_count: z.number().int().min(0).nullable().optional(),
  merchant_rating: z.number().min(0).max(5).nullable().optional(),
  user_notes: z.string().max(2000).nullable().optional(),
});

export const createTrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateInput.parse(d))
  .handler(async ({ data, context }) => {
    const score = scoreOpportunity({
      buyPrice: data.buy_price,
      sellPrice: data.expected_sell_price,
      amount: data.amount,
      estimatedFees: data.estimated_fees,
      liquidityScore: data.liquidity_score ?? null,
      merchantCount: data.merchant_count ?? null,
      merchantRating: data.merchant_rating ?? null,
    });
    const { data: row, error } = await context.supabase
      .from("market_inventory_trades")
      .insert({
        user_id: context.userId,
        asset: data.asset,
        amount: data.amount,
        buy_exchange: data.buy_exchange,
        sell_exchange: data.sell_exchange,
        buy_price: data.buy_price,
        expected_sell_price: data.expected_sell_price,
        estimated_fees: data.estimated_fees,
        expected_profit: score.netProfit,
        confidence_score: score.confidence,
        risk_score: score.risk,
        ki_reasoning: score.reasoning,
        currency: data.currency,
        user_notes: data.user_notes ?? null,
        status: "active",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const ListInput = z.object({ status: z.enum(["active", "closed", "cancelled"]).optional() });
export const listTrades = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListInput.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("market_inventory_trades")
      .select("*")
      .order("created_at", { ascending: false });
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const IdInput = z.object({ id: z.string().uuid() });
export const getTrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: trade, error } = await context.supabase
      .from("market_inventory_trades")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    const { data: notes } = await context.supabase
      .from("market_inventory_trade_notes")
      .select("*")
      .eq("trade_id", data.id)
      .order("created_at", { ascending: true });
    return { trade, notes: notes ?? [] };
  });

const UpdatePriceInput = z.object({
  id: z.string().uuid(),
  expected_sell_price: z.number().positive(),
});
export const updateTradePrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdatePriceInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: t } = await context.supabase
      .from("market_inventory_trades")
      .select("*")
      .eq("id", data.id)
      .single();
    if (!t) throw new Error("Trade not found");
    const score = scoreOpportunity({
      buyPrice: Number(t.buy_price),
      sellPrice: data.expected_sell_price,
      amount: Number(t.amount),
      estimatedFees: Number(t.estimated_fees ?? 0),
    });
    const { error } = await context.supabase
      .from("market_inventory_trades")
      .update({
        expected_sell_price: data.expected_sell_price,
        expected_profit: score.netProfit,
        confidence_score: score.confidence,
        risk_score: score.risk,
        ki_reasoning: score.reasoning,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const CloseInput = z.object({
  id: z.string().uuid(),
  actual_sell_price: z.number().positive(),
  final_fees: z.number().min(0),
  actual_sell_exchange: z.string().optional(),
});
export const markClosed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CloseInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: t } = await context.supabase
      .from("market_inventory_trades")
      .select("*")
      .eq("id", data.id)
      .single();
    if (!t) throw new Error("Trade not found");
    const sellTime = new Date();
    const durationMinutes = Math.round(
      (sellTime.getTime() - new Date(t.buy_time as string).getTime()) / 60000,
    );
    const analysis = analyseClose({
      buyPrice: Number(t.buy_price),
      actualSellPrice: data.actual_sell_price,
      amount: Number(t.amount),
      finalFees: data.final_fees,
      expectedProfit: t.expected_profit != null ? Number(t.expected_profit) : null,
      durationMinutes,
    });
    const update: {
      actual_sell_price: number;
      final_fees: number;
      actual_profit: number;
      sell_time: string;
      duration_minutes: number;
      status: "closed";
      ki_accuracy_verdict: string;
      lesson_learned: string;
      sell_exchange?: string;
    } = {
      actual_sell_price: data.actual_sell_price,
      final_fees: data.final_fees,
      actual_profit: analysis.actualProfit,
      sell_time: sellTime.toISOString(),
      duration_minutes: durationMinutes,
      status: "closed",
      ki_accuracy_verdict: analysis.verdict,
      lesson_learned: analysis.lesson,
    };
    if (data.actual_sell_exchange) update.sell_exchange = data.actual_sell_exchange;
    const { error } = await context.supabase
      .from("market_inventory_trades")
      .update(update)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true, analysis };
  });

export const cancelTrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("market_inventory_trades")
      .update({ status: "cancelled" })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const AddNoteInput = z.object({ trade_id: z.string().uuid(), note: z.string().min(1).max(2000) });
export const addTradeNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AddNoteInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("market_inventory_trade_notes")
      .insert({ user_id: context.userId, trade_id: data.trade_id, note: data.note });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
