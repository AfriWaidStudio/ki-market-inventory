import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listShop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const [products, sales, debtors] = await Promise.all([
      context.supabase
        .from("sabi_shop_products")
        .select("id, name, unit, cost_price, sell_price, stock, low_stock_at, currency")
        .eq("user_id", context.userId)
        .order("name"),
      context.supabase
        .from("sabi_shop_sales")
        .select("id, product_id, product_name, qty, unit_price, unit_cost, currency, sold_at")
        .eq("user_id", context.userId)
        .gte("sold_at", since)
        .order("sold_at", { ascending: false }),
      context.supabase
        .from("sabi_debtors")
        .select("id, name, phone, amount, currency, due_date, settled")
        .eq("user_id", context.userId)
        .order("due_date", { nullsFirst: false }),
    ]);
    if (products.error) throw new Error(products.error.message);

    return {
      products: products.data ?? [],
      sales: sales.data ?? [],
      debtors: debtors.data ?? [],
    };
  });

export const saveProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(1).max(80),
        unit: z.string().min(1).max(20),
        cost_price: z.number().min(0),
        sell_price: z.number().min(0),
        stock: z.number().min(0),
        low_stock_at: z.number().min(0),
        currency: z.string().min(2).max(8),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { id, ...fields } = data;
    if (id) {
      const { error } = await context.supabase
        .from("sabi_shop_products")
        .update(fields)
        .eq("id", id)
        .eq("user_id", context.userId);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { error } = await context.supabase
      .from("sabi_shop_products")
      .insert({ ...fields, user_id: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("sabi_shop_products")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const recordSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ product_id: z.string().uuid(), qty: z.number().positive() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: p, error: readErr } = await context.supabase
      .from("sabi_shop_products")
      .select("id, name, cost_price, sell_price, stock, currency")
      .eq("id", data.product_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!p) throw new Error("Product not found");

    const { error } = await context.supabase.from("sabi_shop_sales").insert({
      user_id: context.userId,
      product_id: p.id,
      product_name: p.name,
      qty: data.qty,
      unit_price: p.sell_price,
      unit_cost: p.cost_price,
      currency: p.currency,
    });
    if (error) throw new Error(error.message);

    const { error: stockErr } = await context.supabase
      .from("sabi_shop_products")
      .update({ stock: Math.max(0, Number(p.stock) - data.qty) })
      .eq("id", p.id)
      .eq("user_id", context.userId);
    if (stockErr) throw new Error(stockErr.message);

    return { profit: (Number(p.sell_price) - Number(p.cost_price)) * data.qty };
  });

export const saveDebtor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().min(1).max(80),
        phone: z.string().max(40).optional().nullable(),
        amount: z.number().min(0),
        currency: z.string().min(2).max(8),
        due_date: z.string().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("sabi_debtors")
      .insert({ ...data, user_id: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const settleDebtor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), settled: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("sabi_debtors")
      .update({ settled: data.settled })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
