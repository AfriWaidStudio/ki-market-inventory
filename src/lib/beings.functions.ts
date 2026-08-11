import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { routeQuestion, agreementScore, marketConfidence, type PrufLevel } from "@/lib/onyix";
import { summariseItems, summariseDrugs, monthlyEquivalent, hoursAgo, type PriceRow, type MedRow } from "@/lib/sabi";

export const listBeings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { ensureWallet } = await import("@/lib/field.server");
    const [beingsRes, empRes, wallet, asmRes] = await Promise.all([
      context.supabase.from("smai_beings").select("*").order("code"),
      context.supabase.from("smai_employments").select("*").eq("user_id", context.userId),
      ensureWallet(context.supabase, context.userId),
      context.supabase
        .from("smai_assemblies")
        .select("*")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    return {
      beings: beingsRes.data ?? [],
      employments: empRes.data ?? [],
      assemblies: asmRes.data ?? [],
      tank: wallet.onyix_tank,
    };
  });

export const employBeing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ code: z.number().int(), hire: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    if (!data.hire) {
      const { error } = await context.supabase
        .from("smai_employments")
        .delete()
        .eq("user_id", context.userId)
        .eq("being_code", data.code);
      if (error) throw new Error(error.message);
      return { employed: false };
    }
    const { error } = await context.supabase
      .from("smai_employments")
      .upsert({ user_id: context.userId, being_code: data.code, active: true }, { onConflict: "user_id,being_code" });
    if (error) throw new Error(error.message);
    return { employed: true };
  });

interface Finding {
  being: string;
  code: number;
  headline: string;
  detail: string;
}

export const runAssembly = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ question: z.string().min(4).max(400) }).parse(d))
  .handler(async ({ data, context }) => {
    const { consumeOnyix, attest, OutOfOnyix } = await import("@/lib/field.server");
    const sb = context.supabase;
    const { domain, codes } = routeQuestion(data.question);

    const { data: beings } = await sb.from("smai_beings").select("code, name, onyix_cost").in("code", codes);
    const roster = beings ?? [];
    const cost = roster.reduce((a, b) => a + Number(b.onyix_cost), 0);

    try {
      await consumeOnyix(sb, context.userId, {
        onyix: cost,
        reason: `SmaiAssembly (${domain}) — ${roster.length} beings — "${data.question.slice(0, 60)}"`,
        beingCode: 100,
      });
    } catch (e) {
      if (e instanceof OutOfOnyix) throw new Error(e.message);
      throw e;
    }

    const nameOf = (code: number) => roster.find((b) => b.code === code)?.name ?? `Being ${code}`;
    const findings: Finding[] = [];
    let confidence = 40;
    let level: PrufLevel = "community_reported";
    let answer = "";
    const terms = data.question.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3);

    if (domain === "health") {
      const { data: rows } = await sb
        .from("sabi_med_prices")
        .select("id, drug, form, pack_size, pharmacy, price, currency, in_stock, area, city, phone, observed_at")
        .order("observed_at", { ascending: false })
        .limit(300);
      const matched = (rows ?? []).filter((r) => !terms.length || terms.some((t) => r.drug.toLowerCase().includes(t)));
      const drugs = summariseDrugs((matched.length ? matched : (rows ?? [])) as MedRow[]).slice(0, 3);
      for (const d of drugs) {
        const c = d.cheapestInStock;
        findings.push({
          being: nameOf(72),
          code: 72,
          headline: `${d.drug} — ${c ? `${d.currency}${c.price.toLocaleString()} at ${c.pharmacy}` : "no verified stock"}`,
          detail: c
            ? `${d.options.length} pharmacies checked in ${d.city}. Cheapest in stock saves ${d.currency}${Math.round(d.saving).toLocaleString()} (${Math.round(d.savingPct * 100)}%) against the dearest. ${d.stockOutCount} out of stock.`
            : `Every pharmacy checked in ${d.city} reports out of stock. Pharmacy Availability Being flagged a supply gap.`,
        });
      }
      const prices = drugs.flatMap((d) => d.options.map((o) => o.price));
      confidence = marketConfidence({
        observations: prices.length,
        hoursOld: drugs[0] ? hoursAgo(drugs[0].options[0]!.observed_at) : 999,
        level: "community_reported",
        agreement: agreementScore(prices),
      });
      answer = drugs.length
        ? `Cheapest verified option: ${drugs[0]!.cheapestInStock?.pharmacy ?? "none in stock"}. Call before travelling — stock moves faster than prices.`
        : "No medicine observations match that yet. Report one from Health and the Field will start tracking it.";
    } else if (domain === "work") {
      const { data: gigs } = await sb
        .from("sabi_gigs")
        .select("title, category, pay_amount, pay_unit, currency, city, remote, contact, posted_at")
        .order("posted_at", { ascending: false })
        .limit(120);
      const ranked = (gigs ?? [])
        .map((g) => ({ ...g, monthly: monthlyEquivalent(Number(g.pay_amount), g.pay_unit) }))
        .sort((a, b) => b.monthly - a.monthly)
        .slice(0, 4);
      for (const g of ranked) {
        findings.push({
          being: nameOf(62),
          code: 62,
          headline: `${g.title} — ${g.currency}${Math.round(g.monthly).toLocaleString()}/month equivalent`,
          detail: `Quoted ${g.currency}${Number(g.pay_amount).toLocaleString()} per ${g.pay_unit} in ${g.city}${g.remote ? " (remote)" : ""}. Wage Intelligence normalised every offer to one monthly ruler before ranking.`,
        });
      }
      confidence = marketConfidence({
        observations: ranked.length,
        hoursOld: 24,
        level: "community_reported",
        agreement: agreementScore(ranked.map((r) => r.monthly)),
      });
      answer = ranked.length
        ? `Best real pay right now: ${ranked[0]!.title}. Compare on the monthly column, not the headline number.`
        : "No open work matches that yet.";
    } else if (domain === "retail" || domain === "supply") {
      const [prodRes, priceRes] = await Promise.all([
        sb.from("sabi_shop_products").select("name, unit, cost_price, sell_price, stock, low_stock_at, currency").eq("user_id", context.userId),
        sb.from("sabi_price_reports").select("id, item, category, unit, price, currency, vendor, area, city, country, observed_at").order("observed_at", { ascending: false }).limit(400),
      ]);
      const market = summariseItems((priceRes.data ?? []) as PriceRow[]);
      for (const p of (prodRes.data ?? []).slice(0, 6)) {
        const m = market.find((x) => x.item.toLowerCase().includes(p.name.toLowerCase().split(" ")[0] ?? ""));
        const gap = m ? Number(p.cost_price) - m.cheapest.price : 0;
        findings.push({
          being: nameOf(31),
          code: 31,
          headline: m && gap > 0
            ? `${p.name} — cheaper source found, ${p.currency}${Math.round(gap).toLocaleString()} below your cost`
            : `${p.name} — your acquisition cost looks competitive`,
          detail: m
            ? `You buy at ${p.currency}${Number(p.cost_price).toLocaleString()}. Cheapest verified market observation is ${m.currency}${m.cheapest.price.toLocaleString()} at ${m.cheapest.vendor ?? "an unnamed seller"}, ${m.cheapest.area ?? m.cheapest.city}. True acquisition cost still needs delivery and minimum order — ask before switching.`
            : `No market observation for ${p.name} yet. Supplier Intelligence cannot compare what nobody has reported.`,
        });
      }
      confidence = marketConfidence({
        observations: market.length,
        hoursOld: 12,
        level: "community_reported",
        agreement: 0.6,
      });
      answer = findings.length
        ? "Procurement Being ranked your stock by how far your cost sits above verified market. Switch only where the gap survives delivery."
        : "Add products in My Shop and the supply beings will start comparing your costs against the market.";
    } else {
      const { data: rows } = await sb
        .from("sabi_price_reports")
        .select("id, item, category, unit, price, currency, vendor, area, city, country, observed_at")
        .order("observed_at", { ascending: false })
        .limit(500);
      const all = (rows ?? []) as PriceRow[];
      const matched = all.filter((r) => !terms.length || terms.some((t) => r.item.toLowerCase().includes(t)));
      const items = summariseItems(matched.length ? matched : all).slice(0, 4);
      for (const it of items) {
        findings.push({
          being: nameOf(codes[0] ?? 1),
          code: codes[0] ?? 1,
          headline: `${it.item} — ${it.currency}${it.cheapest.price.toLocaleString()} at ${it.cheapest.vendor ?? it.cheapest.area ?? it.city}`,
          detail: `${it.count} observations in ${it.city}. Typical ${it.currency}${Math.round(it.median).toLocaleString()} per ${it.unit}; dearest ${it.currency}${it.dearest.price.toLocaleString()}. Buying at the cheapest verified point saves ${Math.round(it.savingsPct * 100)}%.`,
        });
      }
      const prices = items.flatMap((i) => [i.cheapest.price, i.median, i.dearest.price]);
      confidence = marketConfidence({
        observations: items.reduce((a, i) => a + i.count, 0),
        hoursOld: items[0] ? hoursAgo(items[0].freshestAt) : 999,
        level: "community_reported",
        agreement: agreementScore(prices),
      });
      answer = items.length
        ? `Typical price is ${items[0]!.currency}${Math.round(items[0]!.median).toLocaleString()} per ${items[0]!.unit}. Anything under that is a genuine save; anything over is worth walking away from.`
        : "No observations match yet. Report a price and the Field starts building truth for it.";
    }

    if (confidence >= 70 && findings.length >= 3) level = "multi_source_verified";
    else if (confidence >= 50) level = "merchant_verified";

    findings.push({
      being: nameOf(92),
      code: 92,
      headline: `Market Auditor: confidence ${confidence}%`,
      detail: `Scored on source trust, freshness, sample size and how tightly observations agree. Nothing here is a guarantee — it is the best verified picture the Field currently holds.`,
    });

    const { data: saved, error } = await sb
      .from("smai_assemblies")
      .insert({
        user_id: context.userId,
        question: data.question,
        domain,
        being_codes: codes,
        answer,
        findings: findings as never,
        confidence,
        onyix_consumed: cost,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    await attest(sb, context.userId, {
      subject: data.question.slice(0, 120),
      subjectKind: domain,
      claim: answer,
      level,
      confidence,
      sources: findings.length,
      beingCode: 100,
      onyixConsumed: cost,
      evidence: { beings: codes, findings: findings.length },
    });

    for (const code of codes) {
      const { data: emp } = await sb
        .from("smai_employments")
        .select("id, runs, onyix_spent")
        .eq("user_id", context.userId)
        .eq("being_code", code)
        .maybeSingle();
      if (emp) {
        await sb
          .from("smai_employments")
          .update({ runs: emp.runs + 1, onyix_spent: Number(emp.onyix_spent) + cost / codes.length })
          .eq("id", emp.id);
      }
    }

    return { assembly: saved, findings, cost, confidence, level };
  });
