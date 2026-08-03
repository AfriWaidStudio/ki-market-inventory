/**
 * Fee-aware profit engine.
 *
 * Every number the product shows as "profit" flows through here. A P2P
 * arbitrage round-trip has five distinct cost surfaces and most trackers only
 * model one of them:
 *
 *   1. Buy-side trade fee     (exchange taker/P2P fee on the fiat spent)
 *   2. Buy-side payment fee   (bank/transfer charge on the fiat leg)
 *   3. Network transfer fee   (asset burnt moving between exchanges)
 *   4. Sell-side trade fee    (exchange fee on the fiat received)
 *   5. Sell-side payment fee  (payout/withdrawal charge on the fiat leg)
 *
 * Everything below is pure and deterministic — no I/O, no randomness — so the
 * same inputs always produce the same economics on the server, in the UI, and
 * inside KI's reasoning.
 */

export interface FeeProfile {
  exchange: string;
  /** Percent of the fiat leg taken by the exchange (0.1 = 0.1%). */
  trade_fee_pct: number;
  /** Percent of the fiat leg taken by the payment rail. */
  payment_fee_pct: number;
  /** Flat fiat charge per payment. */
  payment_fee_flat: number;
  /** Asset units burnt when withdrawing from this exchange. */
  withdrawal_fee_asset: number;
  /** Withdrawal network (TRC20, BEP20, …). */
  network: string | null;
}

export const DEFAULT_NETWORK = "TRC20";

/**
 * Conservative published defaults. These are starting points a user overrides
 * in Settings → Fee profiles; we never silently assume zero cost.
 */
export const DEFAULT_FEE_PROFILES: Record<string, FeeProfile> = {
  Binance: {
    exchange: "Binance",
    trade_fee_pct: 0,
    payment_fee_pct: 0,
    payment_fee_flat: 0,
    withdrawal_fee_asset: 1,
    network: "TRC20",
  },
  Bybit: {
    exchange: "Bybit",
    trade_fee_pct: 0,
    payment_fee_pct: 0,
    payment_fee_flat: 0,
    withdrawal_fee_asset: 1,
    network: "TRC20",
  },
  OKX: {
    exchange: "OKX",
    trade_fee_pct: 0,
    payment_fee_pct: 0,
    payment_fee_flat: 0,
    withdrawal_fee_asset: 0.8,
    network: "TRC20",
  },
};

export function profileFor(
  exchange: string,
  profiles?: Record<string, FeeProfile> | null,
): FeeProfile {
  return (
    profiles?.[exchange] ??
    DEFAULT_FEE_PROFILES[exchange] ?? {
      exchange,
      trade_fee_pct: 0,
      payment_fee_pct: 0,
      payment_fee_flat: 0,
      withdrawal_fee_asset: 0,
      network: DEFAULT_NETWORK,
    }
  );
}

export interface EconomicsInput {
  amount: number;
  buyPrice: number;
  sellPrice: number;
  buyProfile: FeeProfile;
  sellProfile: FeeProfile;
  /** Same-exchange trades skip the withdrawal leg entirely. */
  sameVenue?: boolean;
  /** Any additional user-recorded fees in fiat. */
  extraFees?: number;
}

export interface FeeLine {
  key: string;
  label: string;
  amount: number;
  /** "fiat" costs are charged in the quote currency; "asset" in the coin. */
  unit: "fiat" | "asset";
  detail: string;
}

export interface Economics {
  /** Fiat the user hands over to acquire `amount` of the asset. */
  fiatIn: number;
  /** Asset units that survive the transfer leg. */
  assetDelivered: number;
  /** Fiat received before sell-side deductions. */
  grossOut: number;
  /** Fiat actually landing in the bank account. */
  netOut: number;
  /** All-in cost basis (fiat in + buy-side fees + extras). */
  costBasis: number;
  /** Fiat profit after every modelled cost. */
  netProfit: number;
  /** Profit if fees were zero — the number naive trackers show. */
  naiveProfit: number;
  /** How much of the naive profit fees eat, 0-1. */
  feeDrag: number;
  /** Total fees expressed in fiat. */
  totalFees: number;
  /** Sell price at which this trade breaks exactly even. */
  breakEvenPrice: number;
  /** Distance from current sell price to break-even, as a fraction. */
  breakEvenBufferPct: number;
  /** Return on the deployed capital, as a fraction. */
  roi: number;
  /** Raw spread percent before fees. */
  grossSpreadPct: number;
  /** Spread percent after fees — the only one worth trading on. */
  netSpreadPct: number;
  lines: FeeLine[];
}

function safeDiv(a: number, b: number): number {
  return b === 0 || !Number.isFinite(b) ? 0 : a / b;
}

export function computeEconomics(input: EconomicsInput): Economics {
  const amount = Math.max(0, input.amount);
  const buyPrice = Math.max(0, input.buyPrice);
  const sellPrice = Math.max(0, input.sellPrice);
  const extra = Math.max(0, input.extraFees ?? 0);
  const buy = input.buyProfile;
  const sell = input.sellProfile;

  const fiatIn = amount * buyPrice;
  const buyTradeFee = (fiatIn * buy.trade_fee_pct) / 100;
  const buyPaymentFee = (fiatIn * buy.payment_fee_pct) / 100 + buy.payment_fee_flat;

  const transferAsset = input.sameVenue ? 0 : Math.max(0, buy.withdrawal_fee_asset);
  const assetDelivered = Math.max(0, amount - transferAsset);
  const transferFiat = transferAsset * buyPrice;

  const grossOut = assetDelivered * sellPrice;
  const sellTradeFee = (grossOut * sell.trade_fee_pct) / 100;
  const sellPaymentFee = (grossOut * sell.payment_fee_pct) / 100 + sell.payment_fee_flat;
  const netOut = grossOut - sellTradeFee - sellPaymentFee;

  const costBasis = fiatIn + buyTradeFee + buyPaymentFee + extra;
  const netProfit = netOut - costBasis;
  const naiveProfit = (sellPrice - buyPrice) * amount;

  const totalFees =
    buyTradeFee + buyPaymentFee + sellTradeFee + sellPaymentFee + transferFiat + extra;

  // Solve netOut(breakEven) === costBasis for the sell price.
  const sellPctFactor = 1 - sell.trade_fee_pct / 100 - sell.payment_fee_pct / 100;
  const requiredGross = safeDiv(costBasis + sell.payment_fee_flat, sellPctFactor);
  const breakEvenPrice = safeDiv(requiredGross, assetDelivered);

  const lines: FeeLine[] = [
    {
      key: "buy_trade",
      label: `${buy.exchange} trade fee`,
      amount: buyTradeFee,
      unit: "fiat",
      detail: `${buy.trade_fee_pct}% of ${fiatIn.toFixed(2)}`,
    },
    {
      key: "buy_payment",
      label: `${buy.exchange} payment fee`,
      amount: buyPaymentFee,
      unit: "fiat",
      detail: `${buy.payment_fee_pct}% + ${buy.payment_fee_flat} flat`,
    },
    {
      key: "transfer",
      label: `Network transfer (${buy.network ?? DEFAULT_NETWORK})`,
      amount: transferAsset,
      unit: "asset",
      detail: input.sameVenue
        ? "Same venue — no transfer required"
        : `${transferAsset} units burnt ≈ ${transferFiat.toFixed(2)} fiat`,
    },
    {
      key: "sell_trade",
      label: `${sell.exchange} trade fee`,
      amount: sellTradeFee,
      unit: "fiat",
      detail: `${sell.trade_fee_pct}% of ${grossOut.toFixed(2)}`,
    },
    {
      key: "sell_payment",
      label: `${sell.exchange} payout fee`,
      amount: sellPaymentFee,
      unit: "fiat",
      detail: `${sell.payment_fee_pct}% + ${sell.payment_fee_flat} flat`,
    },
  ];
  if (extra > 0) {
    lines.push({
      key: "extra",
      label: "Recorded extra fees",
      amount: extra,
      unit: "fiat",
      detail: "Manually logged against this trade",
    });
  }

  return {
    fiatIn,
    assetDelivered,
    grossOut,
    netOut,
    costBasis,
    netProfit,
    naiveProfit,
    feeDrag: naiveProfit > 0 ? Math.min(1, safeDiv(totalFees, naiveProfit)) : totalFees > 0 ? 1 : 0,
    totalFees,
    breakEvenPrice,
    breakEvenBufferPct: safeDiv(sellPrice - breakEvenPrice, breakEvenPrice),
    roi: safeDiv(netProfit, costBasis),
    grossSpreadPct: safeDiv(sellPrice - buyPrice, buyPrice),
    netSpreadPct: safeDiv(netProfit, fiatIn),
    lines: lines.filter((l) => l.amount !== 0 || l.key === "transfer"),
  };
}

/** Minimum trade size where fixed costs stop dominating the spread. */
export function minimumViableAmount(args: {
  buyPrice: number;
  sellPrice: number;
  buyProfile: FeeProfile;
  sellProfile: FeeProfile;
  sameVenue?: boolean;
  targetProfit?: number;
}): number | null {
  const target = args.targetProfit ?? 0;
  let lo = 1;
  let hi = 1_000_000;
  const profitAt = (n: number) =>
    computeEconomics({
      amount: n,
      buyPrice: args.buyPrice,
      sellPrice: args.sellPrice,
      buyProfile: args.buyProfile,
      sellProfile: args.sellProfile,
      sameVenue: args.sameVenue ?? false,
    }).netProfit;
  if (profitAt(hi) <= target) return null;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (profitAt(mid) > target) hi = mid;
    else lo = mid;
  }
  return Math.ceil(hi);
}
