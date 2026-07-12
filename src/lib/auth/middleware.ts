import { createMiddleware } from "@tanstack/react-start";
import { getCurrentSession } from "./core.server";

export const requireAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const session = await getCurrentSession();
  if (!session) throw new Error("Unauthorized");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return next({ context: { supabase: supabaseAdmin as any, userId: session.user.id, user: session.user } });
});
