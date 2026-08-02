import { createFileRoute } from "@tanstack/react-router";

/**
 * Background price refresh. Called by the scheduled job every few minutes so
 * snapshots stay fresh even when nobody has the Scanner open.
 * Protected by a shared CRON_SECRET bearer token.
 */
export const Route = createFileRoute("/api/public/cron/refresh-prices")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Accepts either the project anon key (pg_cron) or the shared CRON_SECRET.
        const anonKey = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];
        const cronSecret = process.env["CRON_SECRET"];
        const apikey = request.headers.get("apikey");
        const auth = request.headers.get("authorization") ?? "";
        const authorized =
          (!!anonKey && apikey === anonKey) || (!!cronSecret && auth === `Bearer ${cronSecret}`);
        if (!authorized) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { fetchPairAllExchanges } = await import("@/lib/p2p.server");

        const { data: pairs, error } = await supabaseAdmin
          .from("market_inventory_watchlist")
          .select("user_id, asset, fiat")
          .eq("is_active", true)
          .limit(200);
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

        // Deduplicate network calls: one fetch per asset/fiat pair, fanned out to users.
        const byPair = new Map<string, { asset: string; fiat: string; users: string[] }>();
        for (const p of pairs ?? []) {
          const key = `${p.asset}::${p.fiat}`;
          const entry = byPair.get(key) ?? { asset: p.asset, fiat: p.fiat, users: [] };
          entry.users.push(p.user_id);
          byPair.set(key, entry);
        }

        const now = new Date().toISOString();
        let inserted = 0;
        const failures: Array<{ pair: string; exchange: string; error: string }> = [];

        for (const entry of byPair.values()) {
          const outcomes = await fetchPairAllExchanges(entry.asset, entry.fiat);
          const snapRows = outcomes.flatMap((o) =>
            o.snaps.flatMap((s) =>
              entry.users.map((uid) => ({
                user_id: uid,
                exchange: s.exchange,
                asset: entry.asset,
                side: s.side,
                price: s.price,
                currency: entry.fiat,
                liquidity_score: s.liquidity_score,
                merchant_count: s.merchant_count,
                merchant_rating: s.merchant_rating,
              })),
            ),
          );
          if (snapRows.length) {
            await supabaseAdmin.from("market_inventory_price_snapshots").insert(snapRows);
            inserted += snapRows.length;
          }

          const statusRows = outcomes.flatMap((o) =>
            entry.users.map((uid) => ({
              user_id: uid,
              exchange: o.exchange,
              asset: entry.asset,
              fiat: entry.fiat,
              status: o.ok ? "live" : "unavailable",
              consecutive_failures: o.ok ? 0 : 1,
              last_success_at: o.ok ? now : null,
              last_failure_at: o.ok ? null : now,
              error_message: o.ok ? null : (o.error ?? "Unknown error"),
              updated_at: now,
            })),
          );
          if (statusRows.length) {
            await supabaseAdmin
              .from("market_inventory_feed_status")
              .upsert(statusRows, { onConflict: "user_id,exchange,asset,fiat" });
          }

          for (const o of outcomes) {
            if (!o.ok) {
              failures.push({
                pair: `${entry.asset}/${entry.fiat}`,
                exchange: o.exchange,
                error: o.error ?? "Unknown error",
              });
            }
          }
        }

        return Response.json({ ok: true, pairs: byPair.size, inserted, failures, at: now });
      },
    },
  },
});
