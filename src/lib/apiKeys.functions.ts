import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CreateKeyInput = z.object({
  exchange: z.string().min(1),
  key_label: z.string().min(1).max(80),
  api_key: z.string().min(1).max(500),
  api_secret: z.string().min(1).max(500),
});

export const listApiKeys = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("market_inventory_api_keys")
      .select("id, exchange, key_label, permissions, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateKeyInput.parse(d))
  .handler(async ({ data, context }) => {
    const { encryptString } = await import("./crypto.server");
    const encKey = encryptString(data.api_key);
    const encSecret = encryptString(data.api_secret);
    const { error } = await context.supabase.from("market_inventory_api_keys").insert({
      user_id: context.userId,
      exchange: data.exchange,
      key_label: data.key_label,
      encrypted_key: encKey,
      encrypted_secret: encSecret,
      permissions: "read_only",
    });
    if (error) throw new Error(error.message);
    await context.supabase.from("market_inventory_audit_log").insert({
      user_id: context.userId,
      action: "api_key_created",
      metadata: { exchange: data.exchange, key_label: data.key_label },
    });
    return { ok: true };
  });

const IdInput = z.object({ id: z.string().uuid() });
export const deleteApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("market_inventory_api_keys")
      .select("exchange, key_label")
      .eq("id", data.id)
      .single();
    const { error } = await context.supabase
      .from("market_inventory_api_keys")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await context.supabase.from("market_inventory_audit_log").insert({
      user_id: context.userId,
      action: "api_key_deleted",
      metadata: { id: data.id, exchange: row?.exchange, key_label: row?.key_label },
    });
    return { ok: true };
  });

export const listAuditLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("market_inventory_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listExchangeAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("market_inventory_exchange_accounts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const AccountInput = z.object({
  exchange: z.string().min(1),
  label: z.string().max(80).optional().nullable(),
});
export const addExchangeAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AccountInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("market_inventory_exchange_accounts").insert({
      user_id: context.userId,
      exchange: data.exchange,
      label: data.label ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
