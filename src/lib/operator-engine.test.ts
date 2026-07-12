import { describe, expect, it } from "vitest";
import { calculateBreakEven, classifyRegime, dedupeAlertKey, evaluatePosition, quoteExecutableSale, type MarketAd } from "./operator-engine";
const now = new Date("2026-07-11T12:00:00Z");
const ads: MarketAd[] = [
  { exchange: "Bybit", side: "sell", price: 1360, availableAsset: 60, observedAt: now.toISOString() },
  { exchange: "Bybit", side: "sell", price: 1358, availableAsset: 60, observedAt: now.toISOString() },
  { exchange: "Binance", side: "sell", price: 1355, availableAsset: 200, observedAt: now.toISOString() },
];
describe("operator engine", () => {
  it("weights executable price across depth", () => expect(quoteExecutableSale(ads, 100, now.getTime())?.price).toBeCloseTo(1359.2));
  it("includes fees and transfer loss in break-even", () => expect(calculateBreakEven({ tradeId:"t",remainingAmount:100,buyPrice:1350,entryFees:100,exitFeesFiat:100,transferFeeAsset:1,openedAt:now.toISOString(),horizonHours:24 })).toBeCloseTo(1365.66, 1));
  it("classifies trend and withholds confidence without history", () => {
    expect(classifyRegime([100,101,102])).toBe("rising");
    const d = evaluatePosition({ tradeId:"t",remainingAmount:100,buyPrice:1350,entryFees:0,exitFeesFiat:0,transferFeeAsset:0,openedAt:now.toISOString(),horizonHours:24 }, ads, { prices:[1350],timestamps:[now.toISOString()],sampleCount:1,feedHealthy:true }, now);
    expect(d.confidence).toBeNull(); expect(d.missingData).toContain("Insufficient history for calibrated probability");
  });
  it("deduplicates within a price band", () => expect(dedupeAlertKey("t","target","sell",1350.001)).toBe(dedupeAlertKey("t","target","sell",1350.002)));
});
