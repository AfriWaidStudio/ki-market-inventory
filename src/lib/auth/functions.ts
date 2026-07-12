import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  assertSameOrigin,
  assertRateLimit,
  createSession,
  getCurrentSession,
  hashPassword,
  hashToken,
  newOpaqueToken,
  normalizeEmail,
  revokeCurrentSession,
  verifyPassword,
} from "./core.server";

const credentials = z.object({ email: z.string().email().max(254), password: z.string().min(10).max(128) });

export const getCurrentUser = createServerFn({ method: "GET" }).handler(async () =>
  (await getCurrentSession())?.user ?? null,
);

export const register = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => credentials.extend({ displayName: z.string().trim().max(80).optional() }).parse(value))
  .handler(async ({ data }) => {
    assertSameOrigin();
    assertRateLimit("register", 5, 15 * 60 * 1000);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = normalizeEmail(data.email);
    const passwordHash = await hashPassword(data.password);
    const { data: user, error } = await (supabaseAdmin as any)
      .from("app_users")
      .insert({ email, password_hash: passwordHash, display_name: data.displayName || email })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") return { error: "An account with this email already exists." };
      throw new Error(error.message);
    }
    await (supabaseAdmin as any).from("auth_identities").insert({ user_id: user.id, provider: "password", provider_subject: email, provider_email: email });
    await (supabaseAdmin as any).from("profiles").upsert({ user_id: user.id, display_name: data.displayName || email });
    await (supabaseAdmin as any).from("user_roles").upsert({ user_id: user.id, role: "user" });
    await createSession(user.id);
    return { ok: true as const, userId: user.id };
  });

export const login = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => credentials.parse(value))
  .handler(async ({ data }) => {
    assertSameOrigin();
    assertRateLimit("login", 10, 15 * 60 * 1000);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: user } = await (supabaseAdmin as any)
      .from("app_users").select("id,password_hash,status").eq("email", normalizeEmail(data.email)).maybeSingle();
    if (!user?.password_hash || user.status !== "active" || !(await verifyPassword(user.password_hash, data.password))) {
      return { error: "Invalid email or password." };
    }
    await createSession(user.id);
    return { ok: true };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  assertSameOrigin();
  await revokeCurrentSession();
  return { ok: true };
});

export const requestPasswordReset = createServerFn({ method: "POST" })
  .validator((value: unknown) => z.object({ email: z.string().email().max(254) }).parse(value))
  .handler(async ({ data }) => {
    assertSameOrigin();
    assertRateLimit("password-reset", 5, 15 * 60 * 1000);
    if (process.env.NODE_ENV === "production") throw new Error("Password email transport is not configured.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: user } = await (supabaseAdmin as any).from("app_users").select("id").eq("email", normalizeEmail(data.email)).maybeSingle();
    if (user) {
      const token = newOpaqueToken();
      await (supabaseAdmin as any).from("password_reset_tokens").insert({ user_id: user.id, token_hash: hashToken(token), expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() });
      const baseUrl = new URL((await import("@tanstack/react-start/server")).getRequest().url).origin;
      console.info(`[Auth] Password reset link for ${normalizeEmail(data.email)}: ${baseUrl}/auth?reset=${encodeURIComponent(token)}`);
    }
    return { ok: true };
  });

export const resetPassword = createServerFn({ method: "POST" })
  .validator((value: unknown) => z.object({ token: z.string().min(20), password: z.string().min(10).max(128) }).parse(value))
  .handler(async ({ data }) => {
    assertSameOrigin();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const { data: reset } = await (supabaseAdmin as any).from("password_reset_tokens").select("id,user_id,expires_at,consumed_at").eq("token_hash", hashToken(data.token)).maybeSingle();
    if (!reset || reset.consumed_at || reset.expires_at <= now) return { error: "This reset link is invalid or expired." };
    const passwordHash = await hashPassword(data.password);
    await (supabaseAdmin as any).from("app_users").update({ password_hash: passwordHash }).eq("id", reset.user_id);
    await (supabaseAdmin as any).from("password_reset_tokens").update({ consumed_at: now }).eq("id", reset.id).is("consumed_at", null);
    await (supabaseAdmin as any).from("auth_sessions").update({ revoked_at: now }).eq("user_id", reset.user_id).is("revoked_at", null);
    await (supabaseAdmin as any).from("auth_identities").upsert({ user_id: reset.user_id, provider: "password", provider_subject: reset.user_id }, { onConflict: "provider,user_id" });
    return { ok: true };
  });

export const beginGoogleOAuth = createServerFn({ method: "POST" }).handler(async () => {
  assertSameOrigin();
  assertRateLimit("google-oauth", 20, 15 * 60 * 1000);
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return { error: "Google OAuth is not configured." };
  const [{ createHash }, { getRequest, setCookie }] = await Promise.all([
    import("node:crypto"), import("@tanstack/react-start/server"),
  ]);
  const state = newOpaqueToken(); const nonce = newOpaqueToken(); const verifier = newOpaqueToken(48);
  const options = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/auth/callback", maxAge: 600 };
  setCookie("oauth_state", state, options); setCookie("oauth_nonce", nonce, options); setCookie("oauth_verifier", verifier, options);
  const redirectUri = `${new URL(getRequest().url).origin}/auth/callback`;
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: "code", scope: "openid email profile", state, nonce, code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256", prompt: "select_account" }).toString();
  return { url: url.toString() };
});
