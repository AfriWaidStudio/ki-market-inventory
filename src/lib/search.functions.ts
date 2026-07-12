import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/auth/middleware";
import { z } from "zod";

const Input = z.object({ q: z.string().max(200).default("") });

export const searchTrades = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => Input.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const q = data.q.trim();
    let query = context.supabase
      .from("market_inventory_trades")
      .select("id, asset, amount, buy_exchange, sell_exchange, status, expected_profit, actual_profit, currency, created_at, ki_accuracy_verdict")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (q.length > 0) {
      const like = `%${q}%`;
      // Match asset OR exchanges OR notes/status via OR
      query = query.or(
        `asset.ilike.${like},buy_exchange.ilike.${like},sell_exchange.ilike.${like},status.ilike.${like}`,
      );
    }
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
