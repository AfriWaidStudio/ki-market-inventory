import { deleteCookie, getCookie, getRequest, setCookie } from "@tanstack/react-start/server";
export { hashPassword, hashToken, newOpaqueToken, normalizeEmail, verifyPassword } from "./primitives";
import { hashToken, newOpaqueToken } from "./primitives";

import type { AuthUser } from "./types";

export const SESSION_COOKIE = "kimi_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const attempts = new Map<string, { count: number; resetAt: number }>();

export function assertSameOrigin() {
  const request = getRequest();
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new Error("Invalid request origin");
}

export function assertRateLimit(bucket: string, limit: number, windowMs: number) {
  const request = getRequest();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const key = `${bucket}:${ip}`; const now = Date.now(); const current = attempts.get(key);
  if (!current || current.resetAt <= now) { attempts.set(key, { count: 1, resetAt: now + windowMs }); return; }
  if (current.count >= limit) throw new Error("Too many attempts. Please try again later.");
  current.count += 1;
}

function cookieOptions(maxAge: number) {
  const secure = process.env.NODE_ENV === "production";
  return { secure, sameSite: "lax" as const, path: "/", maxAge };
}

export function setSessionCookie(token: string) {
  setCookie(SESSION_COOKIE, token, cookieOptions(Math.floor(SESSION_TTL_MS / 1000)));
}

export function clearSessionCookie() {
  deleteCookie(SESSION_COOKIE, cookieOptions(0));
}

export async function createSession(userId: string) {
  const token = newOpaqueToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await (supabaseAdmin as any).from("auth_sessions").insert({
    user_id: userId,
    token_hash: hashToken(token),
    expires_at: expiresAt,
    last_activity_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  setSessionCookie(token);
}

export async function getCurrentSession(): Promise<{ user: AuthUser; sessionId: string } | null> {
  const token = getCookie(SESSION_COOKIE);
  if (!token) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const now = new Date().toISOString();
  const { data, error } = await (supabaseAdmin as any)
    .from("auth_sessions")
    .select("id, user_id, expires_at, revoked_at, app_users(id,email,display_name,status,created_at)")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  const userRow = Array.isArray(data?.app_users) ? data.app_users[0] : data?.app_users;
  if (error || !data || data.revoked_at || data.expires_at <= now || !userRow || userRow.status !== "active") {
    clearSessionCookie();
    return null;
  }
  const refreshedExpiry = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  void (supabaseAdmin as any).from("auth_sessions").update({ last_activity_at: now, expires_at: refreshedExpiry }).eq("id", data.id);
  setSessionCookie(token);
  return {
    sessionId: data.id,
    user: {
      id: userRow.id,
      email: userRow.email,
      displayName: userRow.display_name,
      createdAt: userRow.created_at,
    },
  };
}

export async function revokeCurrentSession() {
  const token = getCookie(SESSION_COOKIE);
  if (token) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await (supabaseAdmin as any)
      .from("auth_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("token_hash", hashToken(token));
  }
  clearSessionCookie();
}
