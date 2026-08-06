import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { rankCorridor, type CorridorQuote } from "./corridors";

const PairInput = z.object({
  send_currency: z.string().min(2).max(8),
  receive_currency: z.string().min(2).max(8),
  amount: z.number().positive().max(100_000_000).default(1000),
});

export const listCorridors = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("corridor_watchlist")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const AddCorridorInput = z.object({
  send_currency: z.string().min(2).max(8),
  receive_currency: z.string().min(2).max(8),
  typical_amount: z.number().positive().max(100_000_000).default(1000),
  label: z.string().max(80).optional().nullable(),
});

export const addCorridor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AddCorridorInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("corridor_watchlist").upsert(
      {
        user_id: context.userId,
        send_currency: data.send_currency.toUpperCase(),
        receive_currency: data.receive_currency.toUpperCase(),
        typical_amount: data.typical_amount,
        label: data.label ?? null,
        is_active: true,
      },
      { onConflict: "user_id,send_currency,receive_currency" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeCorridor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("corridor_watchlist").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const QuoteInput = z.object({
  send_currency: z.string().min(2).max(8),
  receive_currency: z.string().min(2).max(8),
  provider: z.string().min(1).max(80),
  provider_type: z.string().min(2).max(24).default("fintech"),
  fx_rate: z.number().positive(),
  mid_market_rate: z.number().positive().optional().nullable(),
  fee_flat: z.number().min(0).default(0),
  fee_pct: z.number().min(0).max(1).default(0),
  min_amount: z.number().min(0).optional().nullable(),
  max_amount: z.number().min(0).optional().nullable(),
  speed_hours: z.number().min(0).max(1000).optional().nullable(),
  payout_method: z.string().max(60).optional().nullable(),
  notes: z.string().max(400).optional().nullable(),
});

export const recordCorridorQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => QuoteInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("corridor_quotes").insert({
      user_id: context.userId,
      send_currency: data.send_currency.toUpperCase(),
      receive_currency: data.receive_currency.toUpperCase(),
      provider: data.provider,
      provider_type: data.provider_type,
      fx_rate: data.fx_rate,
      mid_market_rate: data.mid_market_rate ?? null,
      fee_flat: data.fee_flat,
      fee_pct: data.fee_pct,
      min_amount: data.min_amount ?? null,
      max_amount: data.max_amount ?? null,
      speed_hours: data.speed_hours ?? null,
      payout_method: data.payout_method ?? null,
      notes: data.notes ?? null,
      source: "manual",
      observed_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Latest quote per provider for a corridor, ranked by what actually lands.
 * P2P snapshots for the receive currency are folded in as a synthetic
 * "crypto P2P" provider so stablecoin routes compete on the same table.
 */
export const compareCorridor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PairInput.parse(d))
  .handler(async ({ data, context }) => {
    const send = data.send_currency.toUpperCase();
    const receive = data.receive_currency.toUpperCase();

    const [quoteRes, snapRes] = await Promise.all([
      context.supabase
        .from("corridor_quotes")
        .select("*")
        .eq("send_currency", send)
        .eq("receive_currency", receive)
        .order("observed_at", { ascending: false })
        .limit(300),
      context.supabase
        .from("market_inventory_price_snapshots")
        .select("exchange, side, price, currency, captured_at")
        .eq("currency", receive)
        .eq("side", "sell")
        .order("captured_at", { ascending: false })
        .limit(40),
    ]);
    if (quoteRes.error) throw new Error(quoteRes.error.message);

    const latest = new Map<string, CorridorQuote>();
    for (const q of quoteRes.data ?? []) {
      if (!latest.has(q.provider)) {
        latest.set(q.provider, {
          id: q.id,
          provider: q.provider,
          provider_type: q.provider_type,
          fx_rate: Number(q.fx_rate),
          mid_market_rate: q.mid_market_rate != null ? Number(q.mid_market_rate) : null,
          fee_flat: Number(q.fee_flat),
          fee_pct: Number(q.fee_pct),
          min_amount: q.min_amount != null ? Number(q.min_amount) : null,
          max_amount: q.max_amount != null ? Number(q.max_amount) : null,
          speed_hours: q.speed_hours != null ? Number(q.speed_hours) : null,
          payout_method: q.payout_method,
          observed_at: q.observed_at as string,
        });
      }
    }

    // Stablecoin route: send currency buys USDT at ~1.0, sold into the receive fiat.
    if (send === "USD") {
      const seen = new Set<string>();
      for (const s of snapRes.data ?? []) {
        const key = `P2P · ${s.exchange}`;
        if (seen.has(key) || latest.has(key)) continue;
        seen.add(key);
        latest.set(key, {
          provider: key,
          provider_type: "crypto_p2p",
          fx_rate: Number(s.price),
          mid_market_rate: null,
          fee_flat: 0,
          fee_pct: 0.004,
          min_amount: null,
          max_amount: null,
          speed_hours: 0.5,
          payout_method: "Bank transfer",
          observed_at: s.captured_at as string,
        });
      }
    }

    const { ranked, mid, bestReceive } = rankCorridor({
      quotes: Array.from(latest.values()),
      amount: data.amount,
    });

    return {
      send_currency: send,
      receive_currency: receive,
      amount: data.amount,
      mid_market_rate: mid,
      best_receive: bestReceive,
      ranked,
      generated_at: new Date().toISOString(),
    };
  });

const TransferInput = z.object({
  send_currency: z.string().min(2).max(8),
  receive_currency: z.string().min(2).max(8),
  provider: z.string().min(1).max(80),
  amount_sent: z.number().positive(),
  amount_received: z.number().positive(),
  baseline_rate: z.number().positive().optional().nullable(),
  purpose: z.string().max(120).optional().nullable(),
  notes: z.string().max(400).optional().nullable(),
});

export const logCorridorTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => TransferInput.parse(d))
  .handler(async ({ data, context }) => {
    const effective = data.amount_received / data.amount_sent;
    const baseline = data.baseline_rate ?? null;
    const saved = baseline != null ? (effective - baseline) * data.amount_sent : null;
    const { error } = await context.supabase.from("corridor_transfers").insert({
      user_id: context.userId,
      send_currency: data.send_currency.toUpperCase(),
      receive_currency: data.receive_currency.toUpperCase(),
      provider: data.provider,
      amount_sent: data.amount_sent,
      amount_received: data.amount_received,
      effective_rate: effective,
      total_cost: baseline != null ? Math.max(0, (baseline - effective) * data.amount_sent) : 0,
      baseline_rate: baseline,
      saved_vs_baseline: saved,
      purpose: data.purpose ?? null,
      notes: data.notes ?? null,
      sent_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listCorridorTransfers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("corridor_transfers")
      .select("*")
      .order("sent_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
