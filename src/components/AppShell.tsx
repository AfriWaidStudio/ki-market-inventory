import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sun, ShoppingBasket, HeartPulse, Briefcase, Store, MessageCircle, Bot, Fuel, Settings, LogOut } from "lucide-react";

const NAV = [
  { to: "/home", label: "Today", icon: Sun, blurb: "What to do now" },
  { to: "/market", label: "Prices", icon: ShoppingBasket, blurb: "Where it's cheap" },
  { to: "/care", label: "Health", icon: HeartPulse, blurb: "Medicine & clinics" },
  { to: "/work", label: "Work", icon: Briefcase, blurb: "Jobs & earnings" },
  { to: "/shop", label: "My Shop", icon: Store, blurb: "Stock & profit" },
  { to: "/ask", label: "Ask Sabi", icon: MessageCircle, blurb: "Your assistant" },
  { to: "/beings", label: "SmaiBeings", icon: Bot, blurb: "Your workforce" },
  { to: "/onyix", label: "Onyix", icon: Fuel, blurb: "Fuel & wallet" },
  { to: "/settings", label: "Settings", icon: Settings, blurb: "Money & account" },
] as const;


export function AppShell({ children, title, subtitle }: { children: ReactNode; title?: string; subtitle?: string }) {
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.invalidate();
    });
    return () => sub.subscription.unsubscribe();
  }, [router]);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="hidden md:flex md:w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="px-5 py-6">
          <div className="text-2xl font-bold tracking-tight text-sidebar-primary">Sabi</div>
          <div className="mt-1 text-xs text-sidebar-foreground/70">Know before you spend.</div>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {NAV.map(({ to, label, icon: Icon, blurb }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="min-w-0">
                <span className="block text-sm font-medium leading-tight">{label}</span>
                <span className="block text-[11px] leading-tight text-sidebar-foreground/60">{blurb}</span>
              </span>
            </Link>
          ))}
        </nav>
        <button
          onClick={signOut}
          className="mx-3 mb-4 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 md:px-8 py-3">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight">{title ?? "Sabi"}</h1>
            <p className="truncate text-xs text-muted-foreground">
              {subtitle ?? "Real prices from real people. No guessing."}
            </p>
          </div>
          <span className="md:hidden text-lg font-bold text-primary">Sabi</span>
        </header>

        <main className="flex-1 min-w-0 px-4 md:px-8 py-5 pb-24 md:pb-8">{children}</main>

        <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 grid grid-cols-6 border-t border-border bg-card">
          {NAV.slice(0, 6).map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex flex-col items-center gap-0.5 py-2 text-[10px] text-muted-foreground"
              activeProps={{ className: "text-primary" }}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
