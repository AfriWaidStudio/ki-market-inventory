/**
 * Onyix — the fuel of the Smaionyix Field.
 *
 * Nothing in Sabi runs for free. Every SmaiBeing run, every verification,
 * every assembly burns Onyix drawn from the user's OnyixTank. The tank is
 * refilled from the Smaisika wallet at a fixed rate:
 *
 *      1 Onyix = 0.001 Smaisika   (1 Smaisika = 1,000 Onyix)
 */

export const SMAISIKA_PER_ONYIX = 0.001;
export const ONYIX_PER_SMAISIKA = 1000;

export function onyixToSmaisika(onyix: number): number {
  return onyix * SMAISIKA_PER_ONYIX;
}

export function smaisikaToOnyix(smaisika: number): number {
  return smaisika * ONYIX_PER_SMAISIKA;
}

export function formatOnyix(n: number): string {
  return `${Math.round(n).toLocaleString()} ONX`;
}

export function formatSmaisika(n: number): string {
  return `${n.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })} SMK`;
}

/** WaidesPruf ladder — how much a claim can be trusted. */
export const PRUF_LEVELS = [
  "unverified",
  "community_reported",
  "merchant_verified",
  "receipt_verified",
  "transaction_verified",
  "multi_source_verified",
  "waidespruf_verified",
] as const;

export type PrufLevel = (typeof PRUF_LEVELS)[number];

export const PRUF_LABEL: Record<PrufLevel, string> = {
  unverified: "Unverified",
  community_reported: "Community reported",
  merchant_verified: "Merchant verified",
  receipt_verified: "Receipt verified",
  transaction_verified: "Transaction verified",
  multi_source_verified: "Multi-source verified",
  waidespruf_verified: "WaidesPruf verified",
};

export function prufWeight(level: PrufLevel): number {
  return (PRUF_LEVELS.indexOf(level) + 1) / PRUF_LEVELS.length;
}

/**
 * Market truth: never a blind average.
 * Source trust x freshness x sample size decides the confidence of an estimate.
 */
export function marketConfidence(opts: {
  observations: number;
  hoursOld: number;
  level: PrufLevel;
  agreement: number; // 0..1, how tightly observations cluster
}): number {
  const sample = Math.min(1, opts.observations / 12);
  const freshness = Math.max(0, 1 - opts.hoursOld / 168);
  const trust = prufWeight(opts.level);
  const raw = 0.3 * sample + 0.25 * freshness + 0.25 * trust + 0.2 * Math.max(0, Math.min(1, opts.agreement));
  return Math.round(raw * 100);
}

/** How tightly a set of prices agree (1 = identical, 0 = wild). */
export function agreementScore(values: number[]): number {
  if (values.length < 2) return 0.5;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean <= 0) return 0;
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
  return Math.max(0, 1 - sd / mean);
}

export type BeingDomain =
  | "price"
  | "goods"
  | "property"
  | "supply"
  | "retail"
  | "opportunity"
  | "work"
  | "health"
  | "mobility"
  | "utilities"
  | "truth"
  | "command";

export const DOMAIN_LABEL: Record<BeingDomain, string> = {
  price: "Price truth",
  goods: "Goods & staples",
  property: "Property",
  supply: "Supply & procurement",
  retail: "Retail & stores",
  opportunity: "Opportunity",
  work: "Work & wages",
  health: "Health",
  mobility: "Transport & logistics",
  utilities: "Energy & services",
  truth: "Verification",
  command: "Commanders",
};

/**
 * Which SmaiBeings wake up for a question. The Assembly Commander (100)
 * and an auditor (92) always join, so every answer is checked before it ships.
 */
export function routeQuestion(question: string): { domain: BeingDomain; codes: number[] } {
  const q = question.toLowerCase();
  const table: [BeingDomain, RegExp, number[]][] = [
    ["property", /rent|apartment|house|land|property|flat|estate|neighbou?rhood/, [21, 22, 25, 26, 29]],
    ["health", /drug|medicine|pharmac|clinic|hospital|health|lab|malaria|tablet/, [72, 76, 73, 71, 80]],
    ["work", /job|work|salary|wage|gig|hire|employ|pay per/, [61, 62, 64, 68, 70]],
    ["supply", /supplier|wholesale|restock|reorder|procure|distributor|bulk/, [31, 32, 35, 36, 38]],
    ["retail", /shop|store|stock|sell|margin|customer|kiosk/, [41, 38, 37, 39, 50]],
    ["opportunity", /business|opportunity|start|invest|trend|demand|idea/, [55, 54, 51, 60, 53]],
    ["mobility", /transport|fare|bus|delivery|dispatch|logistic|travel/, [81, 82, 83, 84, 85]],
    ["utilities", /fuel|gas|electric|power|data|airtime|internet|water/, [17, 16, 87, 88, 89]],
    ["goods", /rice|garri|beans|tomato|meat|fish|cement|phone|clothes/, [11, 12, 14, 18, 19]],
  ];
  for (const [domain, re, codes] of table) {
    if (re.test(q)) return { domain, codes: [...codes, 92, 100] };
  }
  return { domain: "price", codes: [1, 2, 5, 6, 92, 100] };
}
