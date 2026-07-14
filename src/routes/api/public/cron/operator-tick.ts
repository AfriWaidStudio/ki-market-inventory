import { createFileRoute } from "@tanstack/react-router";
import { EXCHANGES, type CapturedAd } from "../../../../../worker/exchanges";
import {
  OPERATOR_MODEL_VERSION,
  SUPPORTED_FIATS,
  dedupeAlertKey,
  evaluatePosition,
  type MarketAd,
} from "@/lib/operator-engine";

function verifyApiKey(request: Request): boolean {
  const provided = request.headers.get("apikey") ?? "";
  const expected = process.env.SUPABASE_PUBLISHABLE_KEY ?? "";
  return expected.length > 0 && provided === expected;
}

export const Route = createFileRoute("/api/public/cron/operator-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!verifyApiKey(request)) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as any;
        const started = Date.now();
        const captured: CapturedAd[] = [];
        const feedResults: Array<{ exchange: string; fiat: string; ok: boolean; error?: string; count: number; latency: number }> = [];

        // 1. capture — bounded parallel per fiat to avoid runtime timeout
        for (const fiat of SUPPORTED_FIATS) {
          await Promise.all(
            EXCHANGES.flatMap((adapter) =>
              (["buy", "sell"] as const).map(async (side) => {
                const t0 = Date.now();
                try {
                  const ads = await adapter.fetch("USDT", fiat, side);
                  captured.push(...ads);
                  feedResults.push({ exchange: adapter.name, fiat, ok: true, count: ads.length, latency: Date.now() - t0 });
                } catch (error) {
                  feedResults.push({
                    exchange: adapter.name,
                    fiat,
                    ok: false,
                    error: error instanceof Error ? error.message : String(error),
                    count: 0,
                    latency: Date.now() - t0,
                  });
                }
              }),
            ),
          );
        }

        // 2. feed health — merge with previous counters
        const prev = await db.from("market_intelligence_feed_health").select("exchange,fiat,consecutive_failures");
        const prevMap = new Map<string, number>(
          (prev.data ?? []).map((r: any) => [`${r.exchange}:${r.fiat}`, r.consecutive_failures ?? 0]),
        );
        const now = new Date().toISOString();
        for (const r of feedResults) {
          const key = `${r.exchange}:${r.fiat}`;
          const priorFails = prevMap.get(key) ?? 0;
          if (r.ok) {
            await db.from("market_intelligence_feed_health").upsert({
              exchange: r.exchange,
              fiat: r.fiat,
              status: r.count > 0 ? "healthy" : "unsupported",
              last_success_at: now,
              consecutive_failures: 0,
              latency_ms: r.latency,
              updated_at: now,
              error_message: null,
              next_attempt_at: null,
            }, { onConflict: "exchange,fiat" });
          } else {
            const next = priorFails + 1;
            await db.from("market_intelligence_feed_health").upsert({
              exchange: r.exchange,
              fiat: r.fiat,
              status: next >= 3 ? "stale" : "degraded",
              consecutive_failures: next,
              last_failure_at: now,
              error_message: r.error,
              next_attempt_at: new Date(Date.now() + Math.min(300_000, 30_000 * 2 ** next)).toISOString(),
              updated_at: now,
            }, { onConflict: "exchange,fiat" });
          }
        }

        // 3. persist ads
        if (captured.length) {
          await db.from("market_intelligence_ads").insert(
            captured.map((a) => ({
              exchange: a.exchange, asset: a.asset, fiat: a.fiat, side: a.side, external_ad_id: a.externalAdId,
              price: a.price, available_asset: a.availableAsset, min_fiat: a.minFiat, max_fiat: a.maxFiat,
              payment_methods: a.paymentMethods, merchant_name: a.merchantName, merchant_verified: a.merchantVerified,
              completion_rate: a.completionRate, completed_orders: a.completedOrders, response_latency_ms: a.latencyMs,
              schema_version: a.schemaVersion, observed_at: a.observedAt, raw_fingerprint: a.rawFingerprint,
            })),
          );
        }

        // 4. aggregate candles
        const buckets = new Map<string, CapturedAd[]>();
        for (const ad of captured) {
          const k = `${ad.exchange}:${ad.fiat}:${ad.side}`;
          buckets.set(k, [...(buckets.get(k) ?? []), ad]);
        }
        for (const [key, rows] of buckets) {
          const [exchange, fiat, side] = key.split(":");
          const prices = rows.map((r) => r.price);
          const close = prices[0];
          const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
          for (const seconds of [60, 300, 900, 3600, 86400]) {
            const epoch = Math.floor(Date.now() / 1000 / seconds) * seconds;
            await db.from("market_intelligence_candles").upsert({
              exchange, asset: "USDT", fiat, side, interval_seconds: seconds,
              bucket_at: new Date(epoch * 1000).toISOString(),
              open: close, high: Math.max(...prices), low: Math.min(...prices), close,
              executable_price: close,
              depth_asset: rows.reduce((s, r) => s + r.availableAsset, 0),
              merchant_count: rows.length,
              volatility: Math.sqrt(prices.reduce((s, p) => s + (p - mean) ** 2, 0) / prices.length) / mean,
            }, { onConflict: "exchange,asset,fiat,side,interval_seconds,bucket_at" });
          }
        }

        // 5. re-evaluate open trades
        const { data: trades } = await db.from("market_inventory_trades").select("*").eq("status", "active");
        let plans = 0;
        let alerts = 0;
        for (const trade of trades ?? []) {
          const fiat = trade.currency ?? "NGN";
          const ads = captured.filter((a) => a.fiat === fiat) as MarketAd[];
          const { data: candles } = await db
            .from("market_intelligence_candles")
            .select("close,bucket_at")
            .eq("fiat", fiat).eq("side", "sell").eq("interval_seconds", 60)
            .order("bucket_at", { ascending: true }).limit(1440);
          const { data: health } = await db
            .from("market_intelligence_feed_health").select("status").eq("fiat", fiat);
          const decision = evaluatePosition(
            {
              tradeId: trade.id,
              remainingAmount: Number(trade.remaining_amount),
              buyPrice: Number(trade.buy_price),
              totalFiatSpent: trade.total_fiat_spent == null ? null : Number(trade.total_fiat_spent),
              entryFees: Number(trade.entry_fees ?? 0),
              transferFeeAsset: Number(trade.transfer_fee_asset ?? 0),
              exitFeesFiat: Number(trade.estimated_fees ?? 0),
              openedAt: trade.buy_time,
              horizonHours: Number(trade.intended_horizon_hours ?? 24),
              sourceExchange: trade.source_exchange,
              destinationExchange: trade.destination_exchange,
              paymentMethod: trade.payment_method,
            },
            ads,
            {
              prices: (candles ?? []).map((c: any) => Number(c.close)),
              timestamps: (candles ?? []).map((c: any) => c.bucket_at),
              sampleCount: candles?.length ?? 0,
              feedHealthy: (health ?? []).some((h: any) => h.status === "healthy"),
            },
          );

          await db.from("ki_position_plans").update({ active: false }).eq("trade_id", trade.id).eq("active", true);
          const { data: plan } = await db.from("ki_position_plans").insert({
            user_id: trade.user_id, trade_id: trade.id,
            action: decision.action, venue: decision.venue,
            executable_price: decision.executablePrice, executable_amount: decision.executableAmount,
            break_even_price: decision.breakEvenPrice, target_price: decision.targetPrice,
            expected_net: decision.expectedNet, downside: decision.downside,
            target_window_hours: decision.targetWindowHours, confidence: decision.confidence,
            confidence_eligible: decision.confidenceEligible, regime: decision.regime,
            evidence: decision.evidence, missing_data: decision.missingData,
            invalidation_condition: decision.invalidationCondition,
            next_evaluation_at: decision.nextEvaluationAt, model_version: OPERATOR_MODEL_VERSION,
          }).select("id").single();
          plans += 1;

          await db.from("ki_recommendation_snapshots").insert({
            user_id: trade.user_id, trade_id: trade.id, plan_id: plan?.id,
            action: decision.action, evidence: decision.evidence,
            market_snapshot: { fiat, ads: ads.length },
            predicted_windows: { target_hours: decision.targetWindowHours },
            model_version: OPERATOR_MODEL_VERSION,
          });

          if (decision.action === "sell_now") {
            const key = dedupeAlertKey(trade.id, "target_reached", decision.action, decision.executablePrice);
            await db.from("ki_operator_alerts").upsert({
              user_id: trade.user_id, trade_id: trade.id,
              alert_type: "target_reached", severity: "warning", dedupe_key: key,
              title: "KI exit opportunity",
              message: `${decision.venue} can execute near ${decision.executablePrice?.toFixed(2)} ${fiat}. Net: ${decision.expectedNet?.toFixed(2)} ${fiat}.`,
              evidence: { decision },
            }, { onConflict: "user_id,dedupe_key" });
            alerts += 1;
          }
        }

        return Response.json({
          ok: true,
          duration_ms: Date.now() - started,
          captured: captured.length,
          feeds: feedResults.length,
          feed_failures: feedResults.filter((r) => !r.ok).length,
          plans_updated: plans,
          alerts_raised: alerts,
        });
      },
    },
  },
});
