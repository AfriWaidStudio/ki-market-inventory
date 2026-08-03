/**
 * Proactive alert engine — pure rule evaluation.
 *
 * Takes a snapshot of the operator's world and returns the alerts that should
 * exist right now. Persistence and de-duplication are handled by the caller;
 * this file only decides *what is worth saying*.
 *
 * Every alert carries a dedupe key bucketed by time so a condition that stays
 * true for hours produces one notification, not one per refresh.
 */

import type { DiscoveredRoute } from "./routes";

export type AlertSeverity = "critical" | "warning" | "info" | "success";

export interface GeneratedAlert {
  type: string;
  severity: AlertSeverity;
  title: string;
  body: string;
  link: string | null;
  dedupe_key: string;
  metadata: Record<string, unknown>;
  /** Set when the alert is tied to a specific position. */
  trade_id?: string | null;
}

export interface ActiveTradeSnapshot {
  id: string;
  asset: string;
  currency: string;
  amount: number;
  buy_price: number;
  expected_sell_price: number | null;
  buy_exchange: string;
  sell_exchange: string;
  buy_time: string;
  intended_horizon_hours: number | null;
  break_even_price: number;
  /** Best executable sell price available right now, if known. */
  market_sell_price: number | null;
}

export interface FeedSnapshot {
  exchange: string;
  asset: string;
  fiat: string;
  status: string;
  consecutive_failures: number;
  last_success_at: string | null;
  error_message: string | null;
}

export interface AlertContext {
  routes: DiscoveredRoute[];
  activeTrades: ActiveTradeSnapshot[];
  feeds: FeedSnapshot[];
  latestSnapshotAt: string | null;
  recentClosedProfits: number[];
  /** Minimum net profit worth waking the operator for. */
  opportunityThreshold: number;
}

function hourBucket(d = new Date()): string {
  return `${d.toISOString().slice(0, 13)}`;
}

function dayBucket(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function hoursSince(iso: string): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : (Date.now() - t) / 3600_000;
}

export function evaluateAlerts(ctx: AlertContext): GeneratedAlert[] {
  const out: GeneratedAlert[] = [];

  /* ---------- 1. Opportunity windows ---------- */
  const best = ctx.routes.find((r) => r.verdict === "execute");
  if (best && best.economics.netProfit >= ctx.opportunityThreshold) {
    out.push({
      type: "opportunity",
      severity: "success",
      title: `${best.buy_exchange} → ${best.sell_exchange} is open`,
      body: `${(best.economics.netSpreadPct * 100).toFixed(2)}% net after fees and modelled slippage. Score ${best.score.toFixed(0)}/100. ${best.headline}`,
      link: "/scanner",
      dedupe_key: `opportunity:${best.id}:${hourBucket()}`,
      metadata: {
        route: best.id,
        net_profit: best.economics.netProfit,
        net_pct: best.economics.netSpreadPct,
        score: best.score,
      },
    });
  }

  /* ---------- 2. Route fading ---------- */
  for (const r of ctx.routes.slice(0, 6)) {
    if (r.persistence?.label === "fading" && r.economics.netProfit > 0) {
      out.push({
        type: "route_fading",
        severity: "info",
        title: `${r.buy_exchange} → ${r.sell_exchange} looks unstable`,
        body: `This route held profit in only ${Math.round(r.persistence.holdRate * 100)}% of the last ${r.persistence.samples} checks. Treat the current quote as fragile.`,
        link: "/scanner",
        dedupe_key: `route_fading:${r.id}:${dayBucket()}`,
        metadata: { route: r.id, hold_rate: r.persistence.holdRate },
      });
    }
  }

  /* ---------- 3. Break-even breaches on open positions ---------- */
  for (const t of ctx.activeTrades) {
    if (t.market_sell_price == null) continue;
    const buffer = (t.market_sell_price - t.break_even_price) / t.break_even_price;
    if (buffer < 0) {
      out.push({
        type: "break_even_breach",
        severity: "critical",
        title: `Position underwater: ${t.buy_exchange} → ${t.sell_exchange}`,
        body: `Market sell price ${t.market_sell_price.toFixed(2)} is below your all-in break-even of ${t.break_even_price.toFixed(2)}. Closing now locks a loss of roughly ${((t.break_even_price - t.market_sell_price) * t.amount).toFixed(0)} ${t.currency}.`,
        link: `/trades/${t.id}`,
        dedupe_key: `break_even:${t.id}:${hourBucket()}`,
        metadata: { break_even: t.break_even_price, market: t.market_sell_price },
        trade_id: t.id,
      });
    } else if (buffer < 0.002) {
      out.push({
        type: "break_even_thin",
        severity: "warning",
        title: `Thin margin on ${t.buy_exchange} → ${t.sell_exchange}`,
        body: `Only ${(buffer * 100).toFixed(2)}% above break-even. One bad fill turns this position negative.`,
        link: `/trades/${t.id}`,
        dedupe_key: `break_even_thin:${t.id}:${hourBucket()}`,
        metadata: { buffer },
        trade_id: t.id,
      });
    }
  }

  /* ---------- 4. Positions past their intended horizon ---------- */
  for (const t of ctx.activeTrades) {
    const horizon = t.intended_horizon_hours ?? 24;
    const held = hoursSince(t.buy_time);
    if (held > horizon) {
      out.push({
        type: "horizon_exceeded",
        severity: "warning",
        title: "Position held past its plan",
        body: `${t.amount} ${t.asset} on ${t.buy_exchange} → ${t.sell_exchange} has been open ${held.toFixed(1)}h against a ${horizon}h plan. Decide: exit, re-plan, or accept the drift.`,
        link: `/trades/${t.id}`,
        dedupe_key: `horizon:${t.id}:${dayBucket()}`,
        metadata: { held_hours: held, horizon },
        trade_id: t.id,
      });
    }
  }

  /* ---------- 5. Feed health ---------- */
  for (const f of ctx.feeds) {
    if (f.status !== "live" && f.consecutive_failures >= 1) {
      out.push({
        type: "feed_down",
        severity: f.consecutive_failures >= 3 ? "critical" : "warning",
        title: `${f.exchange} feed unavailable`,
        body: `${f.exchange} ${f.asset}/${f.fiat} has failed ${f.consecutive_failures} time(s). ${f.error_message ?? ""} Prices from this venue are not being updated — do not size off them.`.trim(),
        link: "/scanner",
        dedupe_key: `feed_down:${f.exchange}:${f.asset}:${f.fiat}:${hourBucket()}`,
        metadata: { exchange: f.exchange, failures: f.consecutive_failures },
      });
    }
  }

  /* ---------- 6. Stale market data ---------- */
  if (ctx.latestSnapshotAt) {
    const mins = (Date.now() - Date.parse(ctx.latestSnapshotAt)) / 60000;
    if (mins > 30) {
      out.push({
        type: "stale_data",
        severity: "warning",
        title: "Market data has gone stale",
        body: `No fresh quote in ${Math.round(mins)} minutes. Every price on screen should be treated as historical until the feed recovers.`,
        link: "/scanner",
        dedupe_key: `stale_data:${hourBucket()}`,
        metadata: { minutes: mins },
      });
    }
  } else {
    out.push({
      type: "no_data",
      severity: "info",
      title: "No market data yet",
      body: "Add a pair to your watchlist and run a refresh so KI has something to reason about.",
      link: "/scanner",
      dedupe_key: `no_data:${dayBucket()}`,
      metadata: {},
    });
  }

  /* ---------- 7. Capital concentration ---------- */
  const totalCapital = ctx.activeTrades.reduce((s, t) => s + t.amount * t.buy_price, 0);
  if (totalCapital > 0 && ctx.activeTrades.length > 1) {
    const byRoute = new Map<string, number>();
    for (const t of ctx.activeTrades) {
      const k = `${t.buy_exchange}→${t.sell_exchange}`;
      byRoute.set(k, (byRoute.get(k) ?? 0) + t.amount * t.buy_price);
    }
    for (const [route, cap] of byRoute) {
      const share = cap / totalCapital;
      if (share > 0.7) {
        out.push({
          type: "concentration",
          severity: "warning",
          title: "Capital concentrated in one route",
          body: `${(share * 100).toFixed(0)}% of your open capital sits on ${route}. A single venue outage or price move hits everything at once.`,
          link: "/risk-center",
          dedupe_key: `concentration:${route}:${dayBucket()}`,
          metadata: { route, share },
        });
      }
    }
  }

  /* ---------- 8. Losing streak ---------- */
  const recent = ctx.recentClosedProfits.slice(0, 4);
  if (recent.length >= 3 && recent.every((p) => p <= 0)) {
    out.push({
      type: "losing_streak",
      severity: "critical",
      title: `${recent.length} losing trades in a row`,
      body: "The pattern, not the last trade, is the signal. Drop to paper mode until a route with a proven persistence score appears.",
      link: "/analytics",
      dedupe_key: `losing_streak:${dayBucket()}`,
      metadata: { streak: recent.length },
    });
  }

  return out;
}
