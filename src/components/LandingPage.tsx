import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import {
  Search,
  TestTube,
  BarChart3,
  Bot,
  ShieldCheck,
  BookOpen,
  Database,
  Workflow,
  Target,
  TrendingUp,
  CheckCircle2,
  Globe,
  ArrowRight,
  Shield,
  Lock,
  Zap,
  AlertCircle,
} from "lucide-react";
import {
  IllustrationScanner,
  IllustrationPaperTrading,
  IllustrationAnalytics,
  IllustrationKI,
  IllustrationRiskManagement,
  IllustrationJournal,
} from "@/assets/illustrations";

const features = [
  {
    icon: Search,
    title: "Opportunity Scanner",
    description: "Real-time P2P price comparison across Binance, Bybit, OKX, KuCoin, and Bitget",
    Illustration: IllustrationScanner,
    color: "text-cyan-500",
    bg: "bg-cyan-500/10",
  },
  {
    icon: TestTube,
    title: "Paper Trading",
    description: "Simulate trades without real money. Track performance with zero risk.",
    Illustration: IllustrationPaperTrading,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
  {
    icon: BarChart3,
    title: "Profit Analytics",
    description: "Daily, weekly, monthly profit tracking. Separate paper vs real trades.",
    Illustration: IllustrationAnalytics,
    color: "text-cyan-600",
    bg: "bg-cyan-600/10",
  },
  {
    icon: Bot,
    title: "KI Intelligence",
    description: "Chat with AI about your trades, performance, and market opportunities.",
    Illustration: IllustrationKI,
    color: "text-purple-600",
    bg: "bg-purple-600/10",
  },
  {
    icon: ShieldCheck,
    title: "Risk Management",
    description: "Track capital flow, fees, and risks. Never mix paper with real profit.",
    Illustration: IllustrationRiskManagement,
    color: "text-cyan-400",
    bg: "bg-cyan-400/10",
  },
  {
    icon: BookOpen,
    title: "Trade Journal",
    description: "Document lessons learned. Track emotions and outcomes for continuous improvement.",
    Illustration: IllustrationJournal,
    color: "text-purple-400",
    bg: "bg-purple-400/10",
  },
];

const stats = [
  { value: "0", label: "Active Trades", icon: Database },
  { value: "0", label: "Total Profit", icon: TrendingUp },
  { value: "0", label: "Paper Trades", icon: TestTube },
  { value: "0", label: "Manual Trades", icon: Target },
];

const workflowSteps = [
  {
    step: "1",
    title: "Connect Exchanges",
    description: "Add read-only API keys from Binance, Bybit, OKX, KuCoin, or Bitget",
    icon: Globe,
  },
  {
    step: "2",
    title: "Scan Opportunities",
    description: "View real-time P2P price spreads and arbitrage opportunities",
    icon: Search,
  },
  {
    step: "3",
    title: "Paper or Manual Trade",
    description: "Simulate or record actual trades with full tracking",
    icon: Workflow,
  },
  {
    step: "4",
    title: "Analyze Performance",
    description: "Review profits, fees, and risk patterns with AI insights",
    icon: BarChart3,
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading && isAuthenticated) void navigate({ to: "/dashboard" });
  }, [isAuthenticated, loading, navigate]);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <section className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-black" />
        <div className="absolute -top-48 -right-48 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-48 -left-48 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        
        <div className="relative container mx-auto px-4 py-20 lg:py-32">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-cyan-500/20 text-cyan-300 text-sm font-medium mb-8 backdrop-blur-sm border border-cyan-500/30">
              <ShieldCheck className="h-4 w-4" />
              <span className="font-semibold">Tracking-only platform</span>
              <span className="mx-2">•</span>
              <span>No auto-execution • Never moves your funds</span>
            </div>
            
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-8 leading-none text-white">
              <span className="block">Your P2P & Arbitrage</span>
              <span className="block bg-gradient-to-r from-cyan-400 via-purple-400 to-cyan-300 bg-clip-text text-transparent">Command Center</span>
            </h1>
            
            <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto leading-relaxed">
              Track opportunities, record trades, analyze performance, and speak with Konsmik Intelligence about your market activity.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-14">
              <Link
                to="/auth"
                className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 px-10 py-4 text-base font-semibold text-black shadow-xl hover:shadow-2xl transition-all duration-300 group"
              >
                Get Started
                <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/auth"
                className="inline-flex items-center justify-center rounded-xl border-2 border-slate-600 bg-slate-900/80 px-10 py-4 text-base font-semibold text-slate-200 hover:bg-slate-800 transition-all duration-300"
              >
                Sign In
              </Link>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-2xl mx-auto">
              {stats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-r from-cyan-500 to-purple-600 flex items-center justify-center mb-3 shadow-lg">
                      <Icon className="h-6 w-6 text-black" />
                    </div>
                    <div className="text-3xl font-bold text-white">{stat.value}</div>
                    <div className="text-sm text-slate-400 mt-1">{stat.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-slate-900">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center mb-20">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800 text-slate-300 text-sm font-medium mb-6">
              <Zap className="h-4 w-4" />
              How It Works
            </div>
            <h2 className="text-4xl font-bold mb-6 text-white">Simple 4-Step Workflow</h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              Get from zero to full tracking in minutes
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {workflowSteps.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="group text-center">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-r from-cyan-500 to-purple-600 flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:scale-105 transition-transform">
                    <span className="text-black font-bold text-xl">{step.step}</span>
                  </div>
                  <h3 className="text-lg font-semibold mb-3 text-white">{step.title}</h3>
                  <p className="text-slate-400 text-sm px-4">{step.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-24 bg-gradient-to-b from-slate-950 to-slate-900">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center mb-20">
            <h2 className="text-4xl font-bold mb-6 text-white">Powerful Features</h2>
            <p className="text-xl text-slate-400">
              Track, analyze, and optimize your P2P trading strategies
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature) => {
              const Icon = feature.icon;
              const Illustration = feature.Illustration;
              return (
                <div key={feature.title} className="group bg-slate-900/50 dark:bg-slate-900 rounded-2xl border border-slate-800 p-8 shadow-sm hover:shadow-xl transition-all duration-300">
                  <div className={`inline-flex items-center justify-center w-14 h-14 rounded-xl ${feature.bg} ${feature.color} mb-6`}>
                    <Icon className="h-7 w-7" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3 text-white">{feature.title}</h3>
                  <p className="text-slate-400 mb-6 leading-relaxed">{feature.description}</p>
                  <div className="bg-slate-800 rounded-lg p-3">
                    <div className="w-full h-32 bg-slate-700 rounded-md overflow-hidden">
                      <Illustration className="w-full h-full" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-24 bg-slate-900">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-6 text-white">Your Security & Control</h2>
              <p className="text-xl text-slate-400 max-w-2xl mx-auto">
                We never execute trades or move your funds - only track
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="flex items-start gap-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500 flex items-center justify-center flex-shrink-0">
                    <Lock className="h-5 w-5 text-black" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">Read-Only Access</h3>
                    <p className="text-slate-400 text-sm">
                      API keys are encrypted at rest. We only read your transaction history.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                  <div className="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center flex-shrink-0">
                    <Shield className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">No Auto-Execution</h3>
                    <p className="text-slate-400 text-sm">
                      This platform tracks only. We never place orders or execute trades.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                  <div className="w-10 h-10 rounded-lg bg-cyan-600 flex items-center justify-center flex-shrink-0">
                    <Database className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">Encrypted Storage</h3>
                    <p className="text-slate-400 text-sm">
                      API keys are AES-256-GCM encrypted. Never stored in plain text.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-6">
                <div className="flex items-start gap-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                  <div className="w-10 h-10 rounded-lg bg-purple-600 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">Separate Tracking</h3>
                    <p className="text-slate-400 text-sm">
                      Paper and real trades are kept separate. Never mixed.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                  <div className="w-10 h-10 rounded-lg bg-cyan-400 flex items-center justify-center flex-shrink-0">
                    <Shield className="h-5 w-5 text-black" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">Audit Trail</h3>
                    <p className="text-slate-400 text-sm">
                      Every action is logged. Transparent and traceable.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                  <div className="w-10 h-10 rounded-lg bg-purple-400 flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-black" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">Risk Warnings</h3>
                    <p className="text-slate-400 text-sm">
                      We warn about high-risk opportunities and fee spikes.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 bg-gradient-to-r from-cyan-600 via-purple-600 to-cyan-500 text-black">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-8">
              Ready to Track Your Trading?
            </h2>
            <p className="text-xl opacity-95 mb-10">
              Join thousands of traders using KI Market Inventory to optimize their strategies.
            </p>
            <Link
              to="/auth"
              className="inline-flex items-center justify-center rounded-xl bg-black text-cyan-400 px-10 py-4 text-base font-semibold shadow-xl hover:shadow-2xl transition-all duration-300 group"
            >
              Get Started Free
              <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
