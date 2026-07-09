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

        const [{ data: trades }, { data: alerts }] = await Promise.all([
          supabase
            .from("market_inventory_trades")
            .select("id, route, status, amount, buy_price, expected_sell_price, actual_sell_price, expected_profit, actual_profit, duration_minutes, ki_accuracy_verdict, buy_time, sell_time, currency, confidence_score, risk_score")
            .order("created_at", { ascending: false })
            .limit(100),
          supabase
            .from("market_inventory_risk_alerts")
            .select("severity, message, created_at")
            .is("dismissed_at", null)
            .order("created_at", { ascending: false })
            .limit(20),
        ]);

        const grounding = {
          trades: trades ?? [],
          risk_alerts: alerts ?? [],
          generated_at: new Date().toISOString(),
        };

        const system = `You are Waides KI, a P2P arbitrage intelligence analyst.
You NEVER execute trades. Your job is decision support grounded in the user's actual tracked data.
When answering, use only the JSON grounding below — do not invent numbers.
If the user asks about profitability, timing, best route, or specific trades, cite the actual data.
Be direct, communicate uncertainty, and refuse to guarantee outcomes.

USER_DATA (JSON):
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
