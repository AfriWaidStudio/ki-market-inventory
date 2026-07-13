import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { requestPasswordReset, resetPassword } from "@/lib/auth/functions";
import { toast } from "sonner";

type Search = { reset?: string; oauth_error?: string };
export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    reset: typeof search.reset === "string" ? search.reset : undefined,
    oauth_error: typeof search.oauth_error === "string" ? search.oauth_error : undefined,
  }),
  head: () => ({ meta: [{ title: "Sign in — KI Market Inventory" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot" | "reset">(search.reset ? "reset" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const { isAuthenticated, signIn, signUp, signInWithOAuth, loading, error } = useAuth();

  useEffect(() => { if (isAuthenticated) void navigate({ to: "/dashboard" }); }, [isAuthenticated, navigate]);
  useEffect(() => { if (search.oauth_error) toast.error(search.oauth_error); }, [search.oauth_error]);
  useEffect(() => { if (error) toast.error(error); }, [error]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setResetUrl(null);
    if (mode === "forgot") {
      const result = await requestPasswordReset({ data: { email } });
      if (result.resetUrl) setResetUrl(result.resetUrl);
      toast.success(result.deliveryUnavailable ? "Reset email is not configured yet; try again when email sending is connected." : "If that account exists, a reset link has been created.");
      setMode("signin"); return;
    }
    if (mode === "reset" && search.reset) {
      const result = await resetPassword({ data: { token: search.reset, password } });
      if (result.error) return toast.error(result.error);
      toast.success("Password updated. You can now sign in."); setMode("signin"); return;
    }
    const result = mode === "signup" ? await signUp(email, password, displayName) : await signIn(email, password);
    if (result.error) toast.error(result.error);
    else {
      if (mode === "signup") toast.success("Account created — KI verified your SmaiID.");
      void navigate({ to: "/dashboard" });
    }
  }

  const showEmail = mode !== "reset";
  const showPassword = mode !== "forgot";
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[radial-gradient(ellipse_at_top,_var(--color-accent)_0%,_var(--color-background)_60%)]">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="text-primary font-mono text-sm tracking-widest uppercase">● Waides KI</div>
          <h1 className="mt-3 text-3xl font-semibold">KI Market Inventory</h1>
          <p className="mt-2 text-sm text-muted-foreground">First-party secure account access</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-2xl">
          {(mode === "signin" || mode === "signup") && <div className="flex gap-1 rounded-lg bg-muted p-1 text-sm">
            <button type="button" onClick={() => setMode("signin")} className={`flex-1 rounded-md py-2 ${mode === "signin" ? "bg-card shadow" : "text-muted-foreground"}`}>Sign in</button>
            <button type="button" onClick={() => setMode("signup")} className={`flex-1 rounded-md py-2 ${mode === "signup" ? "bg-card shadow" : "text-muted-foreground"}`}>Create account</button>
          </div>}
          <form onSubmit={submit} className="mt-5 space-y-3">
            {mode === "signup" && <label className="block text-xs uppercase text-muted-foreground">Display name<input className="mt-1 w-full rounded-md border bg-input px-3 py-2 text-sm" value={displayName} onChange={e => setDisplayName(e.target.value)} /></label>}
            {showEmail && <label className="block text-xs uppercase text-muted-foreground">Email<input type="email" required className="mt-1 w-full rounded-md border bg-input px-3 py-2 text-sm" value={email} onChange={e => setEmail(e.target.value)} /></label>}
            {showPassword && <label className="block text-xs uppercase text-muted-foreground">{mode === "reset" ? "New password" : "Password"}<input type="password" required minLength={10} className="mt-1 w-full rounded-md border bg-input px-3 py-2 text-sm" value={password} onChange={e => setPassword(e.target.value)} /></label>}
            <button disabled={loading} className="w-full rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50">{loading ? "Working…" : mode === "signup" ? "Create account" : mode === "forgot" ? "Create reset link" : mode === "reset" ? "Set new password" : "Sign in"}</button>
          </form>
          {resetUrl && (
            <a href={resetUrl} className="mt-3 block break-all rounded-md border border-border bg-secondary px-3 py-2 text-xs text-primary underline">
              Open test reset link
            </a>
          )}
          {mode === "signin" && <button type="button" onClick={() => setMode("forgot")} className="mt-3 text-xs text-primary underline">Forgot password?</button>}
          {(mode === "forgot" || mode === "reset") && <button type="button" onClick={() => setMode("signin")} className="mt-3 text-xs text-primary underline">Back to sign in</button>}
          {(mode === "signin" || mode === "signup") && <>
            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><div className="h-px flex-1 bg-border" />OR<div className="h-px flex-1 bg-border" /></div>
            <button type="button" onClick={() => void signInWithOAuth("google")} className="w-full rounded-md border bg-secondary py-2.5 text-sm font-medium">Continue with Google</button>
          </>}
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">Tracking-only tool. <Link to="/" className="underline">Back home</Link></p>
      </div>
    </div>
  );
}
