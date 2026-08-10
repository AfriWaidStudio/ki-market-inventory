import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { summariseItems, summariseDrugs, saleProfit, isSameDay, type PriceRow, type MedRow } from "@/lib/sabi";

/**
 * The whole app in one answer: what changed, what it costs you, what to do next.
 */
export const todayBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

    const [profileRes, savedRes, pricesRes, medsRes, remRes, salesRes, incomeRes, gigsRes] =
      await Promise.all([
        context.supabase
          .from("profiles")
          .select("display_name, preferred_currency")
          .eq("user_id", context.userId)
          .maybeSingle(),
        context.supabase.from("sabi_saved_items").select("item").eq("user_id", context.userId),
        context.supabase
          .from("sabi_price_reports")
          .select("id, item, category, unit, price, currency, vendor, area, city, country, observed_at")
          .order("observed_at", { ascending: false })
          .limit(400),
        context.supabase
          .from("sabi_med_prices")
          .select("id, drug, form, pack_size, pharmacy, price, currency, in_stock, area, city, phone, observed_at")
          .order("observed_at", { ascending: false })
          .limit(200),
        context.supabase
          .from("sabi_reminders")
          .select("id, label, kind, dose, times_per_day, next_at, active")
          .eq("user_id", context.userId)
          .eq("active", true)
          .order("next_at")
          .limit(5),
        context.supabase
          .from("sabi_shop_sales")
          .select("id, product_name, qty, unit_price, unit_cost, currency, sold_at")
          .eq("user_id", context.userId)
          .gte("sold_at", weekAgo),
        context.supabase
          .from("sabi_income_logs")
          .select("amount, hours, currency, work_date")
          .eq("user_id", context.userId)
          .gte("work_date", weekAgo.slice(0, 10)),
        context.supabase
          .from("sabi_gigs")
          .select("id, title, pay_amount, pay_unit, currency, city, remote, posted_at")
          .order("posted_at", { ascending: false })
          .limit(5),
      ]);

    const currency = profileRes.data?.preferred_currency ?? "NGN";
    const savedNames = new Set((savedRes.data ?? []).map((s) => s.item.toLowerCase()));

    const items = summariseItems((pricesRes.data ?? []) as PriceRow[]);
    const watched = items.filter((i) => savedNames.has(i.item.toLowerCase()));
    const topSavings = (watched.length ? watched : items).slice(0, 5);
    const potentialSaving = topSavings.reduce((a, i) => a + i.spread, 0);

    const drugs = summariseDrugs((medsRes.data ?? []) as MedRow[]);
    const topDrug = drugs[0] ?? null;

    const sales = salesRes.data ?? [];
    const todaySales = sales.filter((s) => isSameDay(s.sold_at));
    const todayProfit = todaySales.reduce((a, s) => a + saleProfit(s), 0);
    const weekProfit = sales.reduce((a, s) => a + saleProfit(s), 0);

    const income = incomeRes.data ?? [];
    const weekIncome = income.reduce((a, r) => a + Number(r.amount), 0);
    const weekHours = income.reduce((a, r) => a + Number(r.hours), 0);

    return {
      displayName: profileRes.data?.display_name ?? null,
      currency,
      potentialSaving,
      topSavings: topSavings.map((i) => ({
        item: i.item,
        unit: i.unit,
        city: i.city,
        currency: i.currency,
        cheapPrice: i.cheapest.price,
        cheapVendor: i.cheapest.vendor ?? i.cheapest.area ?? i.cheapest.city,
        dearPrice: i.dearest.price,
        spread: i.spread,
        savingsPct: i.savingsPct,
        observedAt: i.freshestAt,
        watched: savedNames.has(i.item.toLowerCase()),
      })),
      medTip: topDrug?.cheapestInStock
        ? {
            drug: topDrug.drug,
            pharmacy: topDrug.cheapestInStock.pharmacy,
            price: topDrug.cheapestInStock.price,
            currency: topDrug.currency,
            saving: topDrug.saving,
            city: topDrug.city,
          }
        : null,
      nextReminder: remRes.data?.[0] ?? null,
      reminderCount: remRes.data?.length ?? 0,
      todayProfit,
      weekProfit,
      salesToday: todaySales.length,
      weekIncome,
      weekHours,
      hourlyRate: weekHours > 0 ? weekIncome / weekHours : 0,
      newGigs: gigsRes.data ?? [],
    };
  });
