import { createServerFn } from "@tanstack/react-start";
import { requireAuth as requireSupabaseAuth } from "@/lib/auth/middleware";
import { z } from "zod";
import { analyseClose, scoreOpportunity } from "./ki-logic";

const TradeType = z.enum(["paper", "manual"]);
const Stage = z.enum([
  "paper_active",
  "paper_closed",
  "bought",
  "awaiting_transfer",
  "received",
  "listed_for_sale",
  "awaiting_payment",
  "ready_to_close",
  "partially_closed",
  "closed",
  "cancelled",
]);

const BaseCreateInput = z.object({
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
  source_exchange: z.string().max(80).optional(),
  destination_exchange: z.string().max(80).optional(),
  payment_method: z.string().max(120).optional(),
  total_fiat_spent: z.number().positive().optional(),
  entry_fees: z.number().min(0).default(0),
  transfer_network: z.string().max(80).optional(),
  transfer_fee_asset: z.number().min(0).default(0),
  intended_horizon_hours: z.number().int().min(1).max(168).default(24),
  available_amount: z.number().positive().optional(),
});

const ListInput = z.object({
  status: z.enum(["active", "closed", "cancelled"]).optional(),
  trade_type: TradeType.optional(),
});

const IdInput = z.object({ id: z.string().uuid() });

const UpdatePriceInput = z.object({
  id: z.string().uuid(),
  expected_sell_price: z.number().positive(),
});

const CloseInput = z.object({
  id: z.string().uuid(),
  actual_sell_price: z.number().positive(),
  final_fees: z.number().min(0),
  amount_sold: z.number().positive().optional(),
  actual_sell_exchange: z.string().optional(),
  notes: z.string().max(2000).optional(),
});

const AddNoteInput = z.object({
  trade_id: z.string().uuid(),
  note: z.string().min(1).max(2000),
});

const AddFeeInput = z.object({
  trade_id: z.string().uuid(),
  fee_type: z.string().min(1).max(80).default("other"),
  amount: z.number().min(0),
  currency: z.string().min(1).default("NGN"),
  note: z.string().max(500).optional().nullable(),
});

const StageInput = z.object({
  id: z.string().uuid(),
  stage: Stage,
  note: z.string().max(500).optional().nullable(),
});

type SupabaseContext = {
  supabase: any;
  userId: string;
};

type TradeRow = {
  id: string;
  user_id: string;
  trade_type: "paper" | "manual";
  asset: string;
  amount: number | string;
  remaining_amount?: number | string;
  closed_amount?: number | string;
  buy_exchange: string;
  sell_exchange: string;
  buy_price: number | string;
  expected_sell_price: number | string | null;
  estimated_fees: number | string | null;
  total_recorded_fees?: number | string;
  expected_profit: number | string | null;
  actual_profit?: number | string | null;
  realized_profit?: number | string | null;
  final_fees?: number | string | null;
  buy_time: string;
  sell_time?: string | null;
  duration_minutes?: number | null;
  status: "active" | "closed" | "cancelled";
  stage?: string;
  currency: string;
  route?: string | null;
  confidence_score?: number | string | null;
  risk_score?: number | string | null;
  ki_reasoning?: string | null;
  ki_accuracy_verdict?: string | null;
  lesson_learned?: string | null;
};

function num(value: unknown): number {
  if (value == null) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isMissingSchema(error: { message?: string; code?: string } | null | undefined): boolean {
  const message = error?.message?.toLowerCase() ?? "";
  return (
    error?.code === "42P01" ||
    error?.code === "42703" ||
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("column")
  );
}

function normalizeTrade(row: any): TradeRow {
  return {
    ...row,
    trade_type: row.trade_type === "paper" ? "paper" : "manual",
    remaining_amount: row.remaining_amount ?? row.amount,
    closed_amount: row.closed_amount ?? (row.status === "closed" ? row.amount : 0),
    total_recorded_fees: row.total_recorded_fees ?? row.final_fees ?? row.estimated_fees ?? 0,
    stage:
      row.stage ??
      (row.status === "closed" ? "closed" : row.status === "cancelled" ? "cancelled" : "bought"),
  };
}

async function audit(context: SupabaseContext, action: string, metadata: Record<string, unknown>) {
  const { error } = await context.supabase.from("market_inventory_audit_log").insert({
    user_id: context.userId,
    action,
    metadata,
  });
  if (error && !isMissingSchema(error)) throw new Error(error.message);
}

async function recordEvent(
  context: SupabaseContext,
  tradeId: string,
  eventType: string,
  metadata: Record<string, unknown> = {},
  fromStage?: string | null,
  toStage?: string | null,
) {
  const { error } = await context.supabase.from("market_inventory_trade_events").insert({
    user_id: context.userId,
    trade_id: tradeId,
    event_type: eventType,
    from_stage: fromStage ?? null,
    to_stage: toStage ?? null,
    metadata,
  });
  if (error && !isMissingSchema(error)) throw new Error(error.message);
}

async function recordLedger(
  context: SupabaseContext,
  trade: Pick<TradeRow, "id" | "trade_type" | "currency">,
  entryType:
    | "paper_position_opened"
    | "paper_realized_profit"
    | "manual_capital_committed"
    | "manual_realized_profit"
    | "fee_recorded"
    | "adjustment",
  amount: number,
  description: string,
  metadata: Record<string, unknown> = {},
) {
  const { error } = await context.supabase.from("market_inventory_capital_ledger").insert({
    user_id: context.userId,
    trade_id: trade.id,
    trade_type: trade.trade_type,
    entry_type: entryType,
    amount,
    currency: trade.currency,
    description,
    metadata,
  });
  if (error && !isMissingSchema(error)) throw new Error(error.message);
}

async function createTypedTrade(
  context: SupabaseContext,
  data: z.infer<typeof BaseCreateInput>,
  tradeType: "paper" | "manual",
) {
  const score = scoreOpportunity({
    buyPrice: data.buy_price,
    sellPrice: data.expected_sell_price,
    amount: data.amount,
    estimatedFees: data.estimated_fees,
    liquidityScore: data.liquidity_score ?? null,
    merchantCount: data.merchant_count ?? null,
    merchantRating: data.merchant_rating ?? null,
  });

  let { data: row, error } = await context.supabase
    .from("market_inventory_trades")
    .insert({
      user_id: context.userId,
      trade_type: tradeType,
      asset: data.asset,
      amount: data.amount,
      remaining_amount: data.amount,
      closed_amount: 0,
      buy_exchange: data.buy_exchange,
      sell_exchange: data.sell_exchange,
      source_exchange: data.source_exchange ?? data.buy_exchange,
      destination_exchange: data.destination_exchange ?? data.sell_exchange,
      payment_method: data.payment_method ?? null,
      total_fiat_spent: data.total_fiat_spent ?? data.amount * data.buy_price,
      entry_fees: data.entry_fees,
      transfer_network: data.transfer_network ?? null,
      transfer_fee_asset: data.transfer_fee_asset,
      intended_horizon_hours: data.intended_horizon_hours,
      available_amount: data.available_amount ?? data.amount,
      buy_price: data.buy_price,
      expected_sell_price: data.expected_sell_price,
      estimated_fees: data.estimated_fees,
      total_recorded_fees: data.estimated_fees,
      expected_profit: score.netProfit,
      confidence_score: score.confidence,
      risk_score: score.risk,
      ki_reasoning: score.reasoning,
      currency: data.currency,
      user_notes: data.user_notes ?? null,
      status: "active",
      stage: tradeType === "paper" ? "paper_active" : "bought",
    })
    .select("*")
    .single();
  if (error && isMissingSchema(error)) {
    const fallback = await context.supabase
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
        ki_reasoning:
          tradeType === "paper"
            ? `Paper Trade - No real transaction occurred. ${score.reasoning}`
            : score.reasoning,
        currency: data.currency,
        user_notes: data.user_notes ?? null,
        status: "active",
      })
      .select("*")
      .single();
    row = fallback.data;
    error = fallback.error;
  }
  if (error) throw new Error(error.message);

  const trade = normalizeTrade(row);
  await recordEvent(context, trade.id, `${tradeType}_trade_opened`, {
    amount: data.amount,
    buy_price: data.buy_price,
    expected_sell_price: data.expected_sell_price,
    expected_profit: score.netProfit,
    }, null, trade.stage);

  if (tradeType === "manual") {
    await recordLedger(
      context,
      trade,
      "manual_capital_committed",
      data.amount * data.buy_price,
      "Manual trade capital committed",
      { amount: data.amount, buy_price: data.buy_price },
    );
  } else {
    await recordLedger(
      context,
      trade,
      "paper_position_opened",
      0,
      "Paper trade opened. No real transaction occurred.",
      { amount: data.amount, buy_price: data.buy_price },
    );
  }

  await audit(context, `${tradeType}_trade_created`, { trade_id: trade.id, route: row.route });
  return row;
}

export const createPaperTrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => BaseCreateInput.parse(data))
  .handler(async ({ data, context }) => createTypedTrade(context as SupabaseContext, data, "paper"));

export const createManualTrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => BaseCreateInput.parse(data))
  .handler(async ({ data, context }) => createTypedTrade(context as SupabaseContext, data, "manual"));

export const createTrade = createManualTrade;

export const listTrades = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ListInput.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    let query = (context as SupabaseContext).supabase
      .from("market_inventory_trades")
      .select("*")
      .eq("user_id", (context as SupabaseContext).userId)
      .order("created_at", { ascending: false });
    if (data.status) query = query.eq("status", data.status);
    if (data.trade_type) query = query.eq("trade_type", data.trade_type);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const PaginatedInput = z.object({
  status: z.enum(["active", "closed", "cancelled"]).optional(),
  trade_type: TradeType.optional(),
  route: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

export const listTradesPaginated = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => PaginatedInput.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    let query = (context as SupabaseContext).supabase
      .from("market_inventory_trades")
      .select("*", { count: "exact" })
      .eq("user_id", (context as SupabaseContext).userId)
      .order("created_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);
    if (data.status) query = query.eq("status", data.status);
    if (data.trade_type) query = query.eq("trade_type", data.trade_type);
    if (data.route) query = query.eq("route", data.route);
    const { data: rows, error, count } = await query;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], total: count ?? 0 };
  });

function isMissingRelation(error: { message?: string; code?: string } | null | undefined): boolean {
  const message = error?.message?.toLowerCase() ?? "";
  return (
    error?.code === "42P01" ||
    message.includes("does not exist") ||
    message.includes("schema cache")
  );
}

export const getTrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => IdInput.parse(data))
  .handler(async ({ data, context }) => {
    const ctx = context as SupabaseContext;
    const { data: trade, error } = await ctx.supabase
      .from("market_inventory_trades")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", ctx.userId)
      .single();
    if (error) throw new Error(error.message);

    const [{ data: notes }, { data: events, error: eventsErr }, { data: fees, error: feesErr }, { data: ledger, error: ledgerErr }] =
      await Promise.all([
        ctx.supabase
          .from("market_inventory_trade_notes")
          .select("*")
          .eq("trade_id", data.id)
          .eq("user_id", ctx.userId)
          .order("created_at", { ascending: true }),
        ctx.supabase
          .from("market_inventory_trade_events")
          .select("*")
          .eq("trade_id", data.id)
          .eq("user_id", ctx.userId)
          .order("created_at", { ascending: true }),
        ctx.supabase
          .from("market_inventory_trade_fees")
          .select("*")
          .eq("trade_id", data.id)
          .eq("user_id", ctx.userId)
          .order("created_at", { ascending: true }),
        ctx.supabase
          .from("market_inventory_capital_ledger")
          .select("*")
          .eq("trade_id", data.id)
          .eq("user_id", ctx.userId)
          .order("created_at", { ascending: true }),
      ]);

    return {
      trade,
      notes: notes ?? [],
      events: eventsErr && isMissingRelation(eventsErr) ? [] : (events ?? []),
      fees: feesErr && isMissingRelation(feesErr) ? [] : (fees ?? []),
      ledger: ledgerErr && isMissingRelation(ledgerErr) ? [] : (ledger ?? []),
    };
  });

export const updateTradePrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => UpdatePriceInput.parse(data))
  .handler(async ({ data, context }) => {
    const ctx = context as SupabaseContext;
    const { data: trade } = await ctx.supabase
      .from("market_inventory_trades")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", ctx.userId)
      .single();
    if (!trade) throw new Error("Trade not found");

    const score = scoreOpportunity({
      buyPrice: num(trade.buy_price),
      sellPrice: data.expected_sell_price,
      amount: num(trade.remaining_amount ?? trade.amount),
      estimatedFees: num(trade.estimated_fees),
    });
    const update: Record<string, unknown> = {
      expected_sell_price: data.expected_sell_price,
      expected_profit: score.netProfit,
      confidence_score: score.confidence,
      risk_score: score.risk,
      ki_reasoning: score.reasoning,
    };
    if (!isMissingSchema(null)) {
      update.last_event_at = new Date().toISOString();
    }
    const { error } = await ctx.supabase
      .from("market_inventory_trades")
      .update(update)
      .eq("id", data.id)
      .eq("user_id", ctx.userId);
    if (error && !isMissingSchema(error)) throw new Error(error.message);

    await recordEvent(ctx, data.id, "expected_price_updated", {
      expected_sell_price: data.expected_sell_price,
      expected_profit: score.netProfit,
    });
    await audit(ctx, "trade_price_updated", { trade_id: data.id, expected_sell_price: data.expected_sell_price });
    return { ok: true };
  });

async function closeTypedTrade(
  context: SupabaseContext,
  data: z.infer<typeof CloseInput>,
  expectedType: "paper" | "manual",
) {
  const { data: tradeRow } = await context.supabase
    .from("market_inventory_trades")
    .select("*")
    .eq("id", data.id)
    .eq("user_id", context.userId)
    .single();
  if (!tradeRow) throw new Error("Trade not found");
  const trade = tradeRow as TradeRow;
  if (trade.trade_type !== expectedType) throw new Error(`Expected a ${expectedType} trade`);
  if (trade.status !== "active") throw new Error("Only active trades can be closed");

  const remaining = num(trade.remaining_amount);
  const closeAmount = data.amount_sold ?? remaining;
  if (closeAmount > remaining) throw new Error("Close amount exceeds remaining amount");

  const sellTime = new Date();
  const durationMinutes = Math.round((sellTime.getTime() - new Date(trade.buy_time).getTime()) / 60000);
  const analysis = analyseClose({
    buyPrice: num(trade.buy_price),
    actualSellPrice: data.actual_sell_price,
    amount: closeAmount,
    finalFees: data.final_fees,
    expectedProfit: trade.expected_profit != null ? num(trade.expected_profit) : null,
    durationMinutes,
  });

  const nextRemaining = remaining - closeAmount;
  const isFullyClosed = nextRemaining <= 0.00000001;
  const nextStage = isFullyClosed
    ? expectedType === "paper"
      ? "paper_closed"
      : "closed"
    : "partially_closed";

  const hasNewColumns = !isMissingSchema(null) && tradeRow.final_fees !== undefined;

  const update: Record<string, unknown> = {
    actual_sell_price: data.actual_sell_price,
    status: isFullyClosed ? "closed" : "active",
    stage: nextStage,
    remaining_amount: Math.max(0, nextRemaining),
  };

  if (hasNewColumns) {
    update.final_fees = num(tradeRow.final_fees) + data.final_fees;
    update.actual_profit = num(tradeRow.actual_profit) + analysis.actualProfit;
    update.realized_profit = num(tradeRow.realized_profit) + analysis.actualProfit;
    if (isFullyClosed) update.sell_time = sellTime.toISOString();
    update.duration_minutes = durationMinutes;
    update.closed_amount = num(trade.closed_amount) + closeAmount;
    update.total_recorded_fees = num(trade.total_recorded_fees) + data.final_fees;
    update.ki_accuracy_verdict = analysis.verdict;
    update.lesson_learned = analysis.lesson;
    update.last_event_at = sellTime.toISOString();
  } else {
    if (isFullyClosed) {
      update.actual_profit = num(tradeRow.actual_profit ?? tradeRow.expected_profit ?? 0) + analysis.actualProfit;
    }
  }

  if (data.actual_sell_exchange) update.sell_exchange = data.actual_sell_exchange;

  const { error } = await context.supabase
    .from("market_inventory_trades")
    .update(update)
    .eq("id", data.id)
    .eq("user_id", context.userId);
  if (error && !isMissingSchema(error)) throw new Error(error.message);

  if (data.final_fees > 0) {
    await context.supabase.from("market_inventory_trade_fees").insert({
      user_id: context.userId,
      trade_id: data.id,
      fee_type: "close",
      amount: data.final_fees,
      currency: trade.currency,
      note: data.notes ?? null,
    });
    await recordLedger(context, trade, "fee_recorded", -data.final_fees, "Fee recorded during trade close", {
      amount_sold: closeAmount,
    });
  }

  await recordLedger(
    context,
    trade,
    expectedType === "paper" ? "paper_realized_profit" : "manual_realized_profit",
    analysis.actualProfit,
    expectedType === "paper" ? "Paper trade realized profit" : "Manual trade realized profit",
    {
      amount_sold: closeAmount,
      actual_sell_price: data.actual_sell_price,
      final_fees: data.final_fees,
      duration_minutes: durationMinutes,
      partial: !isFullyClosed,
    },
  );

  await recordEvent(context, data.id, isFullyClosed ? `${expectedType}_trade_closed` : `${expectedType}_trade_partially_closed`, {
    amount_sold: closeAmount,
    actual_sell_price: data.actual_sell_price,
    actual_profit: analysis.actualProfit,
    remaining_amount: Math.max(0, nextRemaining),
  }, trade.stage, nextStage);
  await audit(context, `${expectedType}_trade_closed`, {
    trade_id: data.id,
    amount_sold: closeAmount,
    actual_profit: analysis.actualProfit,
    partial: !isFullyClosed,
  });

  return { ok: true, analysis, remaining_amount: Math.max(0, nextRemaining), fully_closed: isFullyClosed };
}

export const closePaperTrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CloseInput.parse(data))
  .handler(async ({ data, context }) => closeTypedTrade(context as SupabaseContext, data, "paper"));

export const closeManualTrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CloseInput.parse(data))
  .handler(async ({ data, context }) => closeTypedTrade(context as SupabaseContext, data, "manual"));

export const markClosed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CloseInput.parse(data))
  .handler(async ({ data, context }) => {
    const ctx = context as SupabaseContext;
    const { data: trade } = await ctx.supabase
      .from("market_inventory_trades")
      .select("trade_type")
      .eq("id", data.id)
      .eq("user_id", ctx.userId)
      .single();
    return closeTypedTrade(ctx, data, trade?.trade_type === "paper" ? "paper" : "manual");
  });

export const addTradeFee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => AddFeeInput.parse(data))
  .handler(async ({ data, context }) => {
    const ctx = context as SupabaseContext;
    const { data: trade } = await ctx.supabase
      .from("market_inventory_trades")
      .select("*")
      .eq("id", data.trade_id)
      .eq("user_id", ctx.userId)
      .single();
    if (!trade) throw new Error("Trade not found");

    const { error } = await ctx.supabase.from("market_inventory_trade_fees").insert({
      user_id: ctx.userId,
      trade_id: data.trade_id,
      fee_type: data.fee_type,
      amount: data.amount,
      currency: data.currency,
      note: data.note ?? null,
    });
    if (error && !isMissingSchema(error)) throw new Error(error.message);

    const hasNewColumns = !isMissingSchema(null);
    if (hasNewColumns) {
      await ctx.supabase
        .from("market_inventory_trades")
        .update({
          total_recorded_fees: num(trade.total_recorded_fees) + data.amount,
          last_event_at: new Date().toISOString(),
        })
        .eq("id", data.trade_id)
        .eq("user_id", ctx.userId);
    }

    await recordLedger(ctx, trade, "fee_recorded", -data.amount, "Trade fee recorded", {
      fee_type: data.fee_type,
      note: data.note ?? null,
    });
    await recordEvent(ctx, data.trade_id, "fee_added", { fee_type: data.fee_type, amount: data.amount });
    await audit(ctx, "trade_fee_added", { trade_id: data.trade_id, fee_type: data.fee_type, amount: data.amount });
    return { ok: true };
  });

export const updateTradeStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => StageInput.parse(data))
  .handler(async ({ data, context }) => {
    const ctx = context as SupabaseContext;
    const { data: trade } = await ctx.supabase
      .from("market_inventory_trades")
      .select("stage, status")
      .eq("id", data.id)
      .eq("user_id", ctx.userId)
      .single();
    if (!trade) throw new Error("Trade not found");
    if (trade.status !== "active") throw new Error("Only active trades can change stage");

    const update: Record<string, unknown> = { stage: data.stage };
    if (!isMissingSchema(null)) {
      update.last_event_at = new Date().toISOString();
    }

    const { error } = await ctx.supabase
      .from("market_inventory_trades")
      .update(update)
      .eq("id", data.id)
      .eq("user_id", ctx.userId);
    if (error && !isMissingSchema(error)) throw new Error(error.message);

    await recordEvent(ctx, data.id, "stage_updated", { note: data.note ?? null }, trade.stage, data.stage);
    await audit(ctx, "trade_stage_updated", { trade_id: data.id, from_stage: trade.stage, to_stage: data.stage });
    return { ok: true };
  });

export const cancelTradeTracking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => IdInput.parse(data))
  .handler(async ({ data, context }) => {
    const ctx = context as SupabaseContext;
    const { data: trade } = await ctx.supabase
      .from("market_inventory_trades")
      .select("stage")
      .eq("id", data.id)
      .eq("user_id", ctx.userId)
      .single();
    const update: Record<string, unknown> = {
      status: "cancelled",
      stage: "cancelled",
    };
    if (!isMissingSchema(null)) {
      update.last_event_at = new Date().toISOString();
    }
    const { error } = await ctx.supabase
      .from("market_inventory_trades")
      .update(update)
      .eq("id", data.id)
      .eq("user_id", ctx.userId);
    if (error && !isMissingSchema(error)) throw new Error(error.message);
    await recordEvent(ctx, data.id, "trade_tracking_cancelled", {}, trade?.stage ?? null, "cancelled");
    await audit(ctx, "trade_tracking_cancelled", { trade_id: data.id });
    return { ok: true };
  });

export const cancelTrade = cancelTradeTracking;

export const addTradeNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => AddNoteInput.parse(data))
  .handler(async ({ data, context }) => {
    const ctx = context as SupabaseContext;
    const { data: ownedTrade } = await ctx.supabase.from("market_inventory_trades").select("id").eq("id", data.trade_id).eq("user_id", ctx.userId).maybeSingle();
    if (!ownedTrade) throw new Error("Trade not found");
    const { error } = await ctx.supabase
      .from("market_inventory_trade_notes")
      .insert({ user_id: ctx.userId, trade_id: data.trade_id, note: data.note });
    if (error) throw new Error(error.message);
    await recordEvent(ctx, data.trade_id, "note_added", { note: data.note.slice(0, 120) });
    await audit(ctx, "trade_note_added", { trade_id: data.trade_id });
    return { ok: true };
  });
