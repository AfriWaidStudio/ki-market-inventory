import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { PrufLevel } from "@/lib/onyix";

/**
 * SmaiOnyix Field runtime.
 *
 * Every unit of work in Sabi passes through here: the tank is checked,
 * Onyix is drawn from WebOnyix, the ledger records the burn, and WaidesPruf
 * attests to what was produced. Nothing runs outside available Onyix.
 */

export type Sb = SupabaseClient<Database>;

export class OutOfOnyix extends Error {
  constructor(
    public needed: number,
    public available: number,
  ) {
    super(
      `Not enough Onyix: this run needs ${Math.round(needed)} ONX but your tank holds ${Math.round(available)} ONX.`,
    );
    this.name = "OutOfOnyix";
  }
}

export async function ensureWallet(sb: Sb, userId: string) {
  const { data } = await sb
    .from("onyix_wallets")
    .select("id, smaisika_balance, onyix_tank, lifetime_consumed")
    .eq("user_id", userId)
    .maybeSingle();
  if (data) return data;

  const { data: created, error } = await sb
    .from("onyix_wallets")
    .insert({ user_id: userId })
    .select("id, smaisika_balance, onyix_tank, lifetime_consumed")
    .single();
  if (error) throw new Error(error.message);

  await sb.from("onyix_ledger").insert({
    user_id: userId,
    kind: "grant",
    onyix_delta: created.onyix_tank,
    source: "webonyix",
    reason: "Starter tank issued on first Field contact",
    tank_after: created.onyix_tank,
  });
  return created;
}

/** Draw Onyix from the tank for one unit of Field work. Throws when the tank is dry. */
export async function consumeOnyix(
  sb: Sb,
  userId: string,
  opts: { onyix: number; reason: string; beingCode?: number | null; source?: string },
): Promise<{ tankAfter: number; consumed: number }> {
  const wallet = await ensureWallet(sb, userId);
  const cost = Math.max(0, opts.onyix);
  if (wallet.onyix_tank < cost) throw new OutOfOnyix(cost, wallet.onyix_tank);

  const tankAfter = wallet.onyix_tank - cost;
  const { error } = await sb
    .from("onyix_wallets")
    .update({ onyix_tank: tankAfter, lifetime_consumed: wallet.lifetime_consumed + cost })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);

  await sb.from("onyix_ledger").insert({
    user_id: userId,
    kind: "consumption",
    onyix_delta: -cost,
    source: opts.source ?? "webonyix",
    reason: opts.reason,
    being_code: opts.beingCode ?? null,
    tank_after: tankAfter,
  });

  return { tankAfter, consumed: cost };
}

/** WaidesPruf: record what was claimed, how strongly it is backed, and what it cost. */
export async function attest(
  sb: Sb,
  userId: string,
  rec: {
    subject: string;
    subjectKind: string;
    claim: string;
    level: PrufLevel;
    confidence: number;
    sources: number;
    beingCode?: number | null;
    onyixConsumed: number;
    evidence?: Record<string, unknown>;
  },
) {
  const { error } = await sb.from("waidespruf_records").insert({
    user_id: userId,
    subject: rec.subject,
    subject_kind: rec.subjectKind,
    claim: rec.claim,
    verification_level: rec.level,
    confidence: rec.confidence,
    sources: rec.sources,
    being_code: rec.beingCode ?? null,
    onyix_consumed: rec.onyixConsumed,
    evidence: rec.evidence ?? {},
  });
  if (error) throw new Error(error.message);
}
