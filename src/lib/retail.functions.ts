import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { computeOpportunities, type RetailListing } from "./retail";

export const listRetailProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [prodRes, listRes] = await Promise.all([
      context.supabase.from("retail_products").select("*").order("created_at", { ascending: false }),
      context.supabase
        .from("retail_listings")
        .select("*")
        .order("observed_at", { ascending: false })
        .limit(1000),
    ]);
    if (prodRes.error) throw new Error(prodRes.error.message);
    if (listRes.error) throw new Error(listRes.error.message);

    const byProduct = new Map<string, RetailListing[]>();
    for (const l of listRes.data ?? []) {
      const row: RetailListing = {
        id: l.id,
        marketplace: l.marketplace,
        role: l.role,
        url: l.url,
        price: Number(l.price),
        currency: l.currency,
        shipping_cost: Number(l.shipping_cost),
        marketplace_fee_pct: Number(l.marketplace_fee_pct),
        in_stock: l.in_stock,
        seller_rating: l.seller_rating != null ? Number(l.seller_rating) : null,
        observed_at: l.observed_at as string,
      };
      byProduct.set(l.product_id, [...(byProduct.get(l.product_id) ?? []), row]);
    }

    return (prodRes.data ?? []).map((p) => {
      const listings = byProduct.get(p.id) ?? [];
      const opportunities = computeOpportunities({
        listings,
        targetMarginPct: Number(p.target_margin_pct),
      });
      return {
        product: {
          id: p.id,
          title: p.title,
          category: p.category,
          sku: p.sku,
          target_margin_pct: Number(p.target_margin_pct),
          is_active: p.is_active,
          notes: p.notes,
        },
        listings,
        best: opportunities[0] ?? null,
        opportunities: opportunities.slice(0, 6),
      };
    });
  });

const ProductInput = z.object({
  title: z.string().min(1).max(160),
  category: z.string().max(60).optional().nullable(),
  sku: z.string().max(60).optional().nullable(),
  target_margin_pct: z.number().min(0).max(1).default(0.15),
  notes: z.string().max(500).optional().nullable(),
});

export const addRetailProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ProductInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("retail_products")
      .insert({
        user_id: context.userId,
        title: data.title,
        category: data.category ?? null,
        sku: data.sku ?? null,
        target_margin_pct: data.target_margin_pct,
        notes: data.notes ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const removeRetailProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("retail_products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const ListingInput = z.object({
  product_id: z.string().uuid(),
  marketplace: z.string().min(1).max(60),
  role: z.enum(["source", "resale"]).default("source"),
  url: z.string().max(500).optional().nullable(),
  price: z.number().positive(),
  currency: z.string().min(2).max(8).default("USD"),
  shipping_cost: z.number().min(0).default(0),
  marketplace_fee_pct: z.number().min(0).max(1).default(0),
  in_stock: z.boolean().default(true),
  seller_rating: z.number().min(0).max(1).optional().nullable(),
});

export const recordRetailListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListingInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("retail_listings").insert({
      user_id: context.userId,
      product_id: data.product_id,
      marketplace: data.marketplace,
      role: data.role,
      url: data.url ?? null,
      price: data.price,
      currency: data.currency.toUpperCase(),
      shipping_cost: data.shipping_cost,
      marketplace_fee_pct: data.marketplace_fee_pct,
      in_stock: data.in_stock,
      seller_rating: data.seller_rating ?? null,
      observed_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
