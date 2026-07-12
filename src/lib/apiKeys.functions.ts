import { createServerFn } from "@tanstack/react-start";
import { requireAuth as requireSupabaseAuth } from "@/lib/auth/middleware";
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
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateKeyInput.parse(d))
  .handler(async ({ data, context }) => {
    const { encryptString } = await import("./crypto.server");
    const toHex = (b: Buffer) => "\\x" + b.toString("hex");
    const encKey = toHex(encryptString(data.api_key));
    const encSecret = toHex(encryptString(data.api_secret));
    const { error } = await context.supabase.from("market_inventory_api_keys").insert({
      user_id: context.userId,
      exchange: data.exchange,
      key_label: data.key_label,
      encrypted_key: encKey as unknown as string,
      encrypted_secret: encSecret as unknown as string,
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
      .eq("user_id", context.userId)
      .single();
    const { error } = await context.supabase
      .from("market_inventory_api_keys")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
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
      .eq("user_id", context.userId)
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
      .eq("user_id", context.userId)
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

const DeleteAccountInput = z.object({ id: z.string().uuid() });
export const deleteExchangeAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => DeleteAccountInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("market_inventory_exchange_accounts")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const SyncInput = z.object({
  account_id: z.string().uuid(),
});
export const syncExchangeAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SyncInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: account, error: accErr } = await context.supabase
      .from("market_inventory_exchange_accounts")
      .select("*")
      .eq("id", data.account_id)
      .eq("user_id", context.userId)
      .single();
    if (accErr) throw new Error("Account not found");

    await context.supabase.from("market_inventory_sync_runs").insert({
      user_id: context.userId,
      account_id: data.account_id,
      exchange: account.exchange,
      status: "running",
      started_at: new Date().toISOString(),
    });

    try {
      const { data: apiKey } = await context.supabase
        .from("market_inventory_api_keys")
        .select("encrypted_key, encrypted_secret")
        .eq("user_id", context.userId)
        .eq("exchange", account.exchange)
        .single();

      if (!apiKey) throw new Error("No API key found for this exchange");

      const { decryptString } = await import("./crypto.server");
      const decKey = decryptString(Buffer.from(apiKey.encrypted_key.slice(2), "hex"));
      const decSecret = decryptString(Buffer.from(apiKey.encrypted_secret.slice(2), "hex"));

      let imported = 0;
      let failed = 0;

      const transactions = await fetchExchangeTransactions(decKey as string, decSecret as string, account.exchange);

      for (const tx of transactions) {
        const { error } = await context.supabase.from("market_inventory_exchange_transactions").insert({
          user_id: context.userId,
          account_id: data.account_id,
          external_tx_id: tx.id,
          asset: tx.asset,
          amount: tx.amount,
          type: tx.type,
          side: tx.side,
          status: tx.status,
          tx_time: tx.time,
          fee: tx.fee,
          fee_asset: tx.fee_asset,
          from_address: tx.from_address,
          to_address: tx.to_address,
        });
        if (error) failed++;
        else imported++;
      }

      await context.supabase
        .from("market_inventory_sync_runs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          records_imported: imported,
          records_failed: failed,
        })
        .eq("account_id", data.account_id);

      return { imported, failed };
    } catch (e) {
      await context.supabase
        .from("market_inventory_sync_runs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: e instanceof Error ? e.message : String(e),
        })
        .eq("account_id", data.account_id);
      throw e;
    }
  });

async function fetchExchangeTransactions(key: string, secret: string, exchange: string) {
  const results: Array<{
    id: string;
    asset: string;
    amount: number;
    type: string;
    side: string | null;
    status: string;
    time: string;
    fee: number;
    fee_asset: string;
    from_address: string | null;
    to_address: string | null;
  }> = [];

  if (exchange === "Binance") {
    try {
      const [depResp, witResp] = await Promise.all([
        fetch("https://api.binance.com/sapi/v1/capital/deposit-hisrec?timestamp=" + Date.now() + "&signature=" + await signBinance(secret, "/sapi/v1/capital/deposit-hisrec"), {
          headers: { "X-MBX-APIKEY": key },
        }),
        fetch("https://api.binance.com/sapi/v1/capital/withdraw/history?timestamp=" + Date.now() + "&signature=" + await signBinance(secret, "/sapi/v1/capital/withdraw/history"), {
          headers: { "X-MBX-APIKEY": key },
        }),
      ]);

      if (depResp.ok) {
        const deposits = (await depResp.json()) as any[];
        for (const d of deposits) {
          results.push({
            id: d.txId ?? d.id,
            asset: d.asset,
            amount: Number(d.amount),
            type: "deposit",
            side: null,
            status: d.status === "SUCCESS" ? "completed" : d.status,
            time: d.insertTime ? new Date(d.insertTime).toISOString() : new Date().toISOString(),
            fee: 0,
            fee_asset: d.asset,
            from_address: null,
            to_address: d.address ?? null,
          });
        }
      }

      if (witResp.ok) {
        const withdrawals = (await witResp.json()) as any[];
        for (const w of withdrawals) {
          results.push({
            id: w.id ?? w.txId,
            asset: w.asset,
            amount: Number(w.amount),
            type: "withdrawal",
            side: null,
            status: w.status === "SUCCESS" ? "completed" : w.status.toLowerCase(),
            time: w.applyTime ? new Date(w.applyTime).toISOString() : new Date().toISOString(),
            fee: Number(w.fee ?? 0),
            fee_asset: w.asset,
            from_address: w.address ?? null,
            to_address: w.transferAddress ?? null,
          });
        }
      }
    } catch (e) {
      console.error("Binance sync error:", e);
    }
  }

  if (exchange === "Bybit") {
    try {
      const [depResp, witResp] = await Promise.all([
        fetch("https://api.bybit.com/v5/asset/deposit/list?api_key=" + key + "&timestamp=" + Date.now() + "&sign=" + await signBybit("GET", "/v5/asset/deposit/list"), {
          headers: { "X-BAPI-API-KEY": key },
        }),
        fetch("https://api.bybit.com/v5/asset/withdraw/list?api_key=" + key + "&timestamp=" + Date.now() + "&sign=" + await signBybit("GET", "/v5/asset/withdraw/list"), {
          headers: { "X-BAPI-API-KEY": key },
        }),
      ]);

      if (depResp.ok) {
        const data = (await depResp.json()) as any;
        for (const d of data.result?.list ?? []) {
          results.push({
            id: d.coin + "_" + d.txId,
            asset: d.coin,
            amount: Number(d.amount),
            type: "deposit",
            side: null,
            status: d.status === 1 ? "completed" : "pending",
            time: d.ctime ? new Date(d.ctime).toISOString() : new Date().toISOString(),
            fee: 0,
            fee_asset: d.coin,
            from_address: null,
            to_address: d.addr ?? null,
          });
        }
      }

      if (witResp.ok) {
        const data = (await witResp.json()) as any;
        for (const w of data.result?.list ?? []) {
          results.push({
            id: w.coin + "_" + w.txId,
            asset: w.coin,
            amount: Number(w.amount),
            type: "withdrawal",
            side: null,
            status: w.status === 3 ? "completed" : w.status === 4 ? "failed" : "pending",
            time: w.applyTime ? new Date(w.applyTime).toISOString() : new Date().toISOString(),
            fee: Number(w.fee ?? 0),
            fee_asset: w.coin,
            from_address: w.addrFrom ?? null,
            to_address: w.addrTo ?? null,
          });
        }
      }
    } catch (e) {
      console.error("Bybit sync error:", e);
    }
  }

  return results;
}

async function signBinance(secret: string, path: string): Promise<string> {
  const timestamp = Date.now();
  const query = `timestamp=${timestamp}`;
  const crypto = await import("crypto");
  return crypto.createHmac("sha256", secret).update(query).digest("hex");
}

async function signBybit(secret: string, method: string, path: string, params: string = ""): Promise<string> {
  const timestamp = Date.now();
  const paramStr = method + path + timestamp + params;
  const crypto = await import("crypto");
  return crypto.createHmac("sha256", secret).update(paramStr).digest("hex");
}

const SyncStatusInput = z.object({});
export const getSyncStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SyncStatusInput.parse(d ?? {}))
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("market_inventory_sync_runs")
      .select("*")
      .eq("user_id", context.userId)
      .order("started_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });
