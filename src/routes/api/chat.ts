import { createFileRoute } from "@tanstack/react-router";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        // Auth: verify bearer + get user context
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }

        const body = (await request.json()) as { messages?: unknown };
        if (!Array.isArray(body.messages)) return new Response("Messages required", { status: 400 });

        // Load user's tracked data as grounding context
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
        );

        const [prices, meds, sales, income, reminders, gigs] = await Promise.all([
          supabase.from("sabi_price_reports").select("item, category, unit, price, currency, vendor, area, city, observed_at").order("observed_at", { ascending: false }).limit(150),
          supabase.from("sabi_med_prices").select("drug, form, pharmacy, price, currency, in_stock, area, city, observed_at").order("observed_at", { ascending: false }).limit(80),
          supabase.from("sabi_shop_sales").select("product_name, qty, unit_price, unit_cost, currency, sold_at").order("sold_at", { ascending: false }).limit(80),
          supabase.from("sabi_income_logs").select("work_date, source, amount, currency, hours").order("work_date", { ascending: false }).limit(60),
          supabase.from("sabi_reminders").select("label, kind, dose, times_per_day, next_at, active").limit(20),
          supabase.from("sabi_gigs").select("title, category, pay_amount, pay_unit, currency, city, remote, contact").order("posted_at", { ascending: false }).limit(40),
        ]);

        const grounding = {
          community_prices: prices.data ?? [],
          medicine_prices: meds.data ?? [],
          my_shop_sales: sales.data ?? [],
          my_earnings: income.data ?? [],
          my_reminders: reminders.data ?? [],
          jobs_and_gigs: gigs.data ?? [],
          generated_at: new Date().toISOString(),
        };

        const system = `You are Sabi, a practical money assistant for everyday people in Nigeria, Africa and beyond.
Sabi means "to know". You answer in plain, simple language a first-time smartphone user understands.
Use ONLY the JSON below — never invent prices, pharmacies or jobs.
Always answer with a concrete action: where to buy, what it costs, how much is saved.
Convert pay to per-hour when comparing jobs (hour=1, day=8h, month=176h).
You are not a doctor: for symptoms, suggest seeing a clinic in the data and never diagnose or prescribe.
State clearly when the data is old or missing.

DATA (JSON):
${JSON.stringify(grounding).slice(0, 20000)}`;

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-2.5-flash");

        const result = streamText({
          model,
          system,
          messages: await convertToModelMessages(body.messages as UIMessage[]),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: body.messages as UIMessage[],
        });
      },
    },
  },
});

// Ensure the auth middleware type is loaded (indirectly used above).
export const _authRef = requireSupabaseAuth;
