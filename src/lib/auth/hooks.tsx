import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AuthContext, AuthUser } from "./types";
import {
  getCurrentUser,
  completeManagedAuthSignIn,
  login,
  logout,
  register,
  requestPasswordReset,
  resetPassword as resetPasswordFn,
} from "./functions";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

type ContextValue = AuthContext & { refresh: () => Promise<void> };
const Context = createContext<ContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const currentUser = await getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (data.session) {
        const linked = await completeManagedAuthSignIn();
        if (!linked.error) setUser(await getCurrentUser());
        else setUser(null);
        return;
      }

      setUser(null);
    } finally { setLoading(false); }
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
      try {
        const result = await login({ data: { email, password } });
        if (!result.error) { await refresh(); return {}; }

        const fallback = await supabase.auth.signInWithPassword({ email, password });
        if (!fallback.error) {
          const linked = await completeManagedAuthSignIn();
          if (!linked.error) { await refresh(); return {}; }
        }

        setError(result.error);
        return result;
      } finally { setLoading(false); }
    },
    signUp: async (email, password, displayName) => {
      setLoading(true); setError(null);
      try { const result = await register({ data: { email, password, displayName } }); if (result.error) { setError(result.error); return result; } await new Promise(r => setTimeout(r, 50)); await refresh(); return { requiresVerification: false }; } finally { setLoading(false); }
    },
    signOut: async () => { await logout(); await supabase.auth.signOut(); setUser(null); },
    signInWithOAuth: async () => {
      setLoading(true); setError(null);
      try {
        if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
          setError("Google sign-in is available in the Lovable preview or published app.");
          return;
        }
        const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
        if (result.redirected) return;
        if (result.error) {
          setError(result.error instanceof Error ? result.error.message : String(result.error));
          return;
        }
        const linked = await completeManagedAuthSignIn();
        if (linked.error) {
          setError(linked.error);
          return;
        }
        await refresh();
      } finally { setLoading(false); }
    },
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