/**
 * Retail / e-commerce arbitrage math.
 *
 * Same "find the spread" engine as P2P, different asset class: buy on the
 * source marketplace, resell on the destination, after marketplace fees,
 * shipping in and shipping out.
 */

export interface RetailListing {
  id: number | string;
  marketplace: string;
  role: string; // 'source' | 'resale'
  url?: string | null;
  price: number;
  currency: string;
  shipping_cost: number;
  marketplace_fee_pct: number;
  in_stock: boolean;
  seller_rating?: number | null;
  observed_at: string;
}

export interface RetailOpportunity {
  source: RetailListing;
  resale: RetailListing;
  landedCost: number;
  grossProceeds: number;
  marketplaceFee: number;
  netProceeds: number;
  profit: number;
  marginPct: number;
  roiPct: number;
  meetsTarget: boolean;
  currencyMismatch: boolean;
  oldestObservation: string;
  confidence: number;
}

function ageHours(iso: string): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 999;
  return (Date.now() - t) / 3_600_000;
}

export function computeOpportunities(params: {
  listings: RetailListing[];
  targetMarginPct: number;
}): RetailOpportunity[] {
  const sources = params.listings.filter((l) => l.role === "source" && l.in_stock);
  const resales = params.listings.filter((l) => l.role === "resale");
  const out: RetailOpportunity[] = [];

  for (const source of sources) {
    for (const resale of resales) {
      if (source.marketplace === resale.marketplace) continue;
      const landedCost = source.price + source.shipping_cost;
      const grossProceeds = resale.price;
      const marketplaceFee = grossProceeds * resale.marketplace_fee_pct;
      const netProceeds = grossProceeds - marketplaceFee - resale.shipping_cost;
      const profit = netProceeds - landedCost;
      const marginPct = grossProceeds > 0 ? profit / grossProceeds : 0;
      const roiPct = landedCost > 0 ? profit / landedCost : 0;

      const oldest = ageHours(source.observed_at) > ageHours(resale.observed_at)
        ? source.observed_at
        : resale.observed_at;
      const staleness = Math.min(1, ageHours(oldest) / 72);
      const ratingBoost = ((source.seller_rating ?? 0.9) + (resale.seller_rating ?? 0.9)) / 2;
      const confidence = Math.max(0, Math.min(1, ratingBoost * (1 - staleness * 0.6)));

      out.push({
        source,
        resale,
        landedCost,
        grossProceeds,
        marketplaceFee,
        netProceeds,
        profit,
        marginPct,
        roiPct,
        meetsTarget: marginPct >= params.targetMarginPct,
        currencyMismatch: source.currency !== resale.currency,
        oldestObservation: oldest,
        confidence,
      });
    }
  }

  return out.sort((a, b) => b.profit - a.profit);
}

/** Price the listing needs to hit for the product to clear the target margin. */
export function breakEvenResalePrice(
  landedCost: number,
  marketplaceFeePct: number,
  outboundShipping: number,
  targetMarginPct = 0,
): number {
  const denom = 1 - marketplaceFeePct - targetMarginPct;
  if (denom <= 0) return Infinity;
  return (landedCost + outboundShipping) / denom;
}

export const MARKETPLACES = [
  "Amazon",
  "eBay",
  "AliExpress",
  "Alibaba",
  "Jumia",
  "Takealot",
  "Konga",
  "Temu",
  "Shopify store",
  "Local wholesale",
];
