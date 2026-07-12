import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/auth/middleware";
import { z } from "zod";

export const listRiskAlerts = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("market_inventory_risk_alerts")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const IdInput = z.object({ id: z.string().uuid() });

export const dismissRiskAlert = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => IdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("market_inventory_risk_alerts")
      .update({ dismissed_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
