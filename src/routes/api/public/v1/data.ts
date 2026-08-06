/**
 * Public white-label data API.
 *   GET /api/public/v1/data?dataset=p2p|corridors|spreads|freight
 *   Header: x-api-key: smk_live_...
 *
 * Keys are hashed at rest; this route verifies the hash, enforces the
 * per-minute rate limit, scopes the response to the key owner, and logs usage.
 */
import { createFileRoute } from "@tanstack/react-router";

const DATASET_SCOPE: Record<string, string> = {
  p2p: "p2p.read",
  corridors: "corridors.read",
  spreads: "spreads.read",
  freight: "freight.read",
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-api-key",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS },
  });
}

export const Route = createFileRoute("/api/public/v1/data")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const started = Date.now();
        const url = new URL(request.url);
        const dataset = (url.searchParams.get("dataset") ?? "p2p").toLowerCase();
        const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") ?? 100)));

        const scope = DATASET_SCOPE[dataset];
        if (!scope) return json({ error: "Unknown dataset", datasets: Object.keys(DATASET_SCOPE) }, 400);

        const presented = request.headers.get("x-api-key") ?? "";
        if (!presented.startsWith("smk_live_")) return json({ error: "Missing or malformed API key" }, 401);

        const { hashApiKey } = await import("@/lib/dataapi.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const hash = hashApiKey(presented);

        const { data: client } = await supabaseAdmin
          .from("data_api_clients")
          .select("id, user_id, scopes, rate_limit_per_min, is_active")
          .eq("key_hash", hash)
          .maybeSingle();

        if (!client || !client.is_active) return json({ error: "Invalid or revoked API key" }, 401);
        if (!client.scopes.includes(scope)) return json({ error: `Key lacks scope ${scope}` }, 403);

        const windowStart = new Date(Date.now() - 60_000).toISOString();
        const { count } = await supabaseAdmin
          .from("data_api_usage")
          .select("id", { count: "exact", head: true })
          .eq("client_id", client.id)
          .gte("called_at", windowStart);

        const log = async (status: number) => {
          await supabaseAdmin.from("data_api_usage").insert({
            client_id: client.id,
            user_id: client.user_id,
            endpoint: `/api/public/v1/data?dataset=${dataset}`,
            status_code: status,
            response_ms: Date.now() - started,
          });
        };

        if ((count ?? 0) >= client.rate_limit_per_min) {
          await log(429);
          return json({ error: "Rate limit exceeded", limit: client.rate_limit_per_min }, 429);
        }

        let rows: unknown[] = [];
        if (dataset === "p2p") {
          const { data } = await supabaseAdmin
            .from("market_inventory_price_snapshots")
            .select("exchange, asset, side, price, currency, liquidity_score, merchant_count, merchant_rating, captured_at")
            .eq("user_id", client.user_id)
            .order("captured_at", { ascending: false })
            .limit(limit);
          rows = data ?? [];
        } else if (dataset === "corridors") {
          const { data } = await supabaseAdmin
            .from("corridor_quotes")
            .select("send_currency, receive_currency, provider, provider_type, fx_rate, fee_flat, fee_pct, speed_hours, payout_method, observed_at")
            .eq("user_id", client.user_id)
            .order("observed_at", { ascending: false })
            .limit(limit);
          rows = data ?? [];
        } else if (dataset === "spreads") {
          const { data } = await supabaseAdmin
            .from("market_inventory_spread_history")
            .select("asset, fiat, buy_exchange, sell_exchange, buy_price, sell_price, spread_pct, net_pct, observed_at")
            .eq("user_id", client.user_id)
            .order("observed_at", { ascending: false })
            .limit(limit);
          rows = data ?? [];
        } else {
          const { data } = await supabaseAdmin
            .from("freight_rates")
            .select("lane_id, carrier, base_rate, currency, surcharges, transit_days, valid_until, observed_at")
            .eq("user_id", client.user_id)
            .order("observed_at", { ascending: false })
            .limit(limit);
          rows = data ?? [];
        }

        await Promise.all([
          log(200),
          supabaseAdmin
            .from("data_api_clients")
            .update({ last_used_at: new Date().toISOString() })
            .eq("id", client.id),
        ]);

        return json({
          dataset,
          count: rows.length,
          generated_at: new Date().toISOString(),
          data: rows,
        });
      },
    },
  },
});
