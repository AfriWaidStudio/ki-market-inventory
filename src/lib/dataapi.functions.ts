import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const API_SCOPES = [
  { value: "p2p.read", label: "P2P prices", description: "Latest exchange P2P quotes per asset/fiat" },
  { value: "corridors.read", label: "FX corridors", description: "Provider rates and effective landed value" },
  { value: "spreads.read", label: "Spread history", description: "Historical spread observations per route" },
  { value: "freight.read", label: "Freight rates", description: "Lane rates, transit times and landed cost" },
] as const;

export const listApiClients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [clientRes, usageRes] = await Promise.all([
      context.supabase.from("data_api_clients").select("*").order("created_at", { ascending: false }),
      context.supabase
        .from("data_api_usage")
        .select("client_id, status_code, response_ms, endpoint, called_at")
        .order("called_at", { ascending: false })
        .limit(500),
    ]);
    if (clientRes.error) throw new Error(clientRes.error.message);

    const usage = usageRes.data ?? [];
    const dayAgo = Date.now() - 86_400_000;
    const clients = (clientRes.data ?? []).map((c) => {
      const rows = usage.filter((u) => u.client_id === c.id);
      const recent = rows.filter((u) => Date.parse(u.called_at as string) >= dayAgo);
      const errors = recent.filter((u) => u.status_code >= 400).length;
      const latencies = recent.map((u) => u.response_ms ?? 0).filter((n) => n > 0);
      return {
        ...c,
        calls_24h: recent.length,
        errors_24h: errors,
        avg_ms:
          latencies.length > 0
            ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
            : null,
      };
    });

    return { clients, recentCalls: usage.slice(0, 50) };
  });

const CreateInput = z.object({
  name: z.string().min(1).max(80),
  scopes: z.array(z.string().max(40)).min(1).max(10),
  rate_limit_per_min: z.number().int().min(1).max(6000).default(60),
});

/**
 * Returns the plaintext key exactly once — only the SHA-256 hash is stored,
 * so a database leak cannot be replayed against the API.
 */
export const createApiClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateInput.parse(d))
  .handler(async ({ data, context }) => {
    const { mintApiKey } = await import("./dataapi.server");
    const { key, prefix, hash } = mintApiKey();
    const { error } = await context.supabase.from("data_api_clients").insert({
      user_id: context.userId,
      name: data.name,
      key_prefix: prefix,
      key_hash: hash,
      scopes: data.scopes,
      rate_limit_per_min: data.rate_limit_per_min,
      is_active: true,
    });
    if (error) throw new Error(error.message);
    return { key, prefix };
  });

export const revokeApiClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("data_api_clients")
      .update({ is_active: false, revoked_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteApiClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("data_api_clients").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
