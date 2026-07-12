import { createFileRoute, redirect } from "@tanstack/react-router";
import LandingPage from "@/components/LandingPage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "KI Market Inventory — P2P Arbitrage Command Center" },
      { name: "description", content: "Track P2P and arbitrage trades across Binance, Bybit, OKX. Konsmik Intelligence explains every opportunity. Tracking-only; no auto-execution." },
    ],
  }),
  component: LandingPage,
});