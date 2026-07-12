import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AuthContext, AuthUser } from "./types";
import {
  getCurrentUser,
  beginGoogleOAuth,
  login,
  logout,
  register,
  requestPasswordReset,
  resetPassword as resetPasswordFn,
} from "./functions";

type ContextValue = AuthContext & { refresh: () => Promise<void> };
const Context = createContext<ContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true);
    try { setUser(await getCurrentUser()); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const value = useMemo<ContextValue>(() => ({
    user,
    session: user ? { user } : null,
    loading,
    error,
    refresh,
    signIn: async (email, password) => {
      setLoading(true); setError(null);
      try { const result = await login({ data: { email, password } }); if (result.error) { setError(result.error); return result; } await refresh(); return {}; } finally { setLoading(false); }
    },
    signUp: async (email, password, displayName) => {
      setLoading(true); setError(null);
      try { const result = await register({ data: { email, password, displayName } }); if (result.error) { setError(result.error); return result; } await new Promise(r => setTimeout(r, 50)); await refresh(); return { requiresVerification: false }; } finally { setLoading(false); }
    },
    signOut: async () => { await logout(); setUser(null); },
    signInWithOAuth: async () => { const result = await beginGoogleOAuth(); if (result.url) window.location.assign(result.url); else setError(result.error ?? "Google sign-in failed"); },
    resetPassword: async (email) => { await requestPasswordReset({ data: { email } }); return {}; },
    confirmEmail: async () => ({}),
    updateProfile: async () => ({ error: "Profile updates use the settings service." }),
  }), [error, loading, refresh, user]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return { ...value, isAuthenticated: !!value.user, isVerified: true };
}
export const useAuthContext = useAuth;
export function useUser() { const { user, loading } = useAuth(); return { user, loading, displayName: user?.displayName ?? user?.email ?? null }; }
export function useSession() { const { session, loading } = useAuth(); return { session, loading }; }
export function useIsAuthenticated() { const { isAuthenticated, loading } = useAuth(); return { isAuthenticated, loading }; }
export function useIsVerified() { const { isVerified, loading } = useAuth(); return { isVerified, loading }; }
export function useUpdateProfile() { const { updateProfile, loading } = useAuth(); return { updateProfile, loading }; }
export function useSignIn() { const { signIn, loading } = useAuth(); return { signIn, loading }; }
export function useSignUp() { const { signUp, loading } = useAuth(); return { signUp, loading }; }
export function useSignOut() { const { signOut, loading } = useAuth(); return { signOut, loading }; }
export function useOAuth() { const { signInWithOAuth, loading } = useAuth(); return { signInWithOAuth, loading }; }
export function useResetPassword() { const { resetPassword, loading } = useAuth(); return { resetPassword, loading }; }
export function useConfirmEmail() { const { confirmEmail, loading } = useAuth(); return { confirmEmail, loading }; }
export { resetPasswordFn };