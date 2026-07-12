import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import {
  LayoutDashboard,
  Radar,
  Activity,
  History,
  BarChart3,
  MessageSquare,
  Settings,
  LogOut,
  ShieldAlert,
  BookOpen,
  Search,
  Wallet,
  Bell,
  LifeBuoy,
  BrainCircuit,
  Send,
} from "lucide-react";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/operator", label: "KI Operator", icon: BrainCircuit },
  { to: "/telegram", label: "Telegram KI", icon: Send },
  { to: "/scanner", label: "Scanner", icon: Radar },
  { to: "/trades", label: "Active Trades", icon: Activity },
  { to: "/history", label: "History", icon: History },
  { to: "/journal", label: "Journal", icon: BookOpen },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/risk-center", label: "Risk Center", icon: ShieldAlert },
  { to: "/chat", label: "Ask KI", icon: MessageSquare },
  { to: "/search", label: "Search", icon: Search },
  { to: "/wallet", label: "Smaisika", icon: Wallet },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/help", label: "Help", icon: LifeBuoy },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { signOut: endSession } = useAuth();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await endSession();
    await router.invalidate();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="hidden md:flex md:w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="px-5 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2 text-primary font-mono text-xs tracking-widest uppercase">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" /> Waides KI
          </div>
          <div className="mt-1 text-sm font-semibold">Market Inventory</div>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <button
          onClick={signOut}
          className="mx-2 mb-3 flex items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between border-b border-border px-4 md:px-8 py-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{title ?? "Market Inventory"}</h1>
            <p className="text-xs text-muted-foreground">Tracking & decision support — no auto-execution</p>
          </div>
          <div className="flex md:hidden gap-1 overflow-x-auto max-w-[60vw]">
            {NAV.map(({ to, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="rounded-md p-2 text-muted-foreground hover:bg-accent"
                activeProps={{ className: "bg-accent text-accent-foreground" }}
              >
                <Icon className="h-4 w-4" />
              </Link>
            ))}
            <button onClick={signOut} className="rounded-md p-2 text-muted-foreground hover:bg-accent">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>
        <main className="flex-1 min-w-0 px-4 md:px-8 py-6">{children}</main>
      </div>
    </div>
  );
}
