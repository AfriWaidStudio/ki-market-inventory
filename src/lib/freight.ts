/**
 * Freight & landed-cost intelligence.
 * A freight quote is meaningless without duty, VAT and transit risk attached —
 * this computes the number an importer actually pays.
 */

export interface FreightRate {
  id: number | string;
  lane_id: string;
  carrier: string;
  base_rate: number;
  currency: string;
  surcharges: number;
  transit_days: number | null;
  valid_until: string | null;
  source: string;
  observed_at: string;
}

export interface DutyProfile {
  hs_code: string;
  description?: string | null;
  destination_country: string;
  duty_pct: number;
  vat_pct: number;
  other_fees_pct: number;
}

export interface LandedCost {
  freightTotal: number;
  cifValue: number;
  duty: number;
  vat: number;
  otherFees: number;
  totalLanded: number;
  costPerUnit: number | null;
  freightSharePct: number;
  taxSharePct: number;
}

/**
 * CIF basis: duty is assessed on cargo value + freight + insurance,
 * then VAT is assessed on CIF + duty. Getting this order wrong understates
 * the bill by the VAT-on-duty amount.
 */
export function computeLandedCost(params: {
  cargoValue: number;
  insurance?: number;
  rate: Pick<FreightRate, "base_rate" | "surcharges">;
  duty?: DutyProfile | null;
  units?: number | null;
}): LandedCost {
  const insurance = params.insurance ?? 0;
  const freightTotal = params.rate.base_rate + params.rate.surcharges;
  const cifValue = params.cargoValue + freightTotal + insurance;
  const duty = cifValue * (params.duty?.duty_pct ?? 0);
  const vat = (cifValue + duty) * (params.duty?.vat_pct ?? 0);
  const otherFees = cifValue * (params.duty?.other_fees_pct ?? 0);
  const totalLanded = cifValue + duty + vat + otherFees;

  return {
    freightTotal,
    cifValue,
    duty,
    vat,
    otherFees,
    totalLanded,
    costPerUnit: params.units && params.units > 0 ? totalLanded / params.units : null,
    freightSharePct: totalLanded > 0 ? freightTotal / totalLanded : 0,
    taxSharePct: totalLanded > 0 ? (duty + vat + otherFees) / totalLanded : 0,
  };
}

export interface RankedRate {
  rate: FreightRate;
  landed: LandedCost;
  vsCheapest: number;
  daysVsFastest: number | null;
  costPerDaySaved: number | null;
  expired: boolean;
  rank: number;
}

/**
 * Ranking a lane is a cost/time trade-off, so we surface the premium per day
 * saved rather than pretending one number decides it.
 */
export function rankRates(params: {
  rates: FreightRate[];
  cargoValue: number;
  duty?: DutyProfile | null;
  units?: number | null;
  insurance?: number;
}): RankedRate[] {
  const rows = params.rates.map((rate) => ({
    rate,
    landed: computeLandedCost({
      cargoValue: params.cargoValue,
      insurance: params.insurance ?? 0,
      rate,
      duty: params.duty ?? null,
      units: params.units ?? null,
    }),
    vsCheapest: 0,
    daysVsFastest: null as number | null,
    costPerDaySaved: null as number | null,
    expired: rate.valid_until ? Date.parse(`${rate.valid_until}T23:59:59Z`) < Date.now() : false,
    rank: 0,
  }));

  if (!rows.length) return rows;
  const cheapest = Math.min(...rows.map((r) => r.landed.totalLanded));
  const transits = rows.map((r) => r.rate.transit_days).filter((d): d is number => d != null);
  const fastest = transits.length ? Math.min(...transits) : null;

  for (const r of rows) {
    r.vsCheapest = r.landed.totalLanded - cheapest;
    if (fastest != null && r.rate.transit_days != null) {
      r.daysVsFastest = r.rate.transit_days - fastest;
      const daysSaved = -r.daysVsFastest;
      r.costPerDaySaved = daysSaved > 0 ? r.vsCheapest / daysSaved : null;
    }
  }

  const ranked = [...rows].sort((a, b) => a.landed.totalLanded - b.landed.totalLanded);
  ranked.forEach((r, i) => {
    r.rank = i + 1;
  });
  return ranked;
}

export const FREIGHT_MODES = ["ocean", "air", "road", "rail", "courier"];
export const EQUIPMENT = ["20ft", "40ft", "40ft HC", "LCL", "pallet", "parcel"];
