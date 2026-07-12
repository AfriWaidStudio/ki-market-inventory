import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/auth/middleware";
import { z } from "zod";

export const getProfile = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

const UpdateInput = z.object({
  display_name: z.string().max(80).optional().nullable(),
  preferred_currency: z.string().min(2).max(8).optional(),
});
export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d: unknown) => UpdateInput.parse(d))
  .handler(async ({ data, context }) => {
    const payload: { display_name?: string | null; preferred_currency?: string } = {};
    if (data.display_name !== undefined) payload.display_name = data.display_name;
    if (data.preferred_currency !== undefined) payload.preferred_currency = data.preferred_currency;
    const { error } = await context.supabase
      .from("profiles")
      .update(payload)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
