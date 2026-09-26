# Sabi Real Prices — truth-first local market pricing

## Honest answer first
Right now Sabi does NOT know the real price of Pampers, Action Bitters or mango in Ubani (Umuahia) or Onitsha. The prices shown today are sample rows added to demo the app, plus anything users report. The AI does not "know" market prices — no AI does. Open markets like Ubani and Onitsha Main Market publish no price list online, so the only way to get real prices is people in those markets reporting what they saw, and Sabi checking those reports against each other.

This plan makes Sabi honest about that, and builds the machinery to collect real, checked, local prices.

## What users will see
1. **Markets you can pick** — Ubani Market (Umuahia), Onitsha Main Market, Ariaria (Aba), Balogun, Mile 12, Oyingbo, Wuse, Kurmi, Oja Oba, Ogbete, plus "add my market".
2. **Search any item in any market** — e.g. "Pampers size 4" in Onitsha shows:
   - Wholesale price range (carton/bag) and retail price range (pack/piece), shown separately
   - How many people reported it, how recently, and a trust level (Confirmed / Likely / Single report / No data)
   - The unit clearly stated (carton of 6 packs, per bottle, per basket, per piece)
3. **"No real price yet"** — if nobody has reported it, Sabi says so plainly and offers "Ask someone in this market". Never a guessed number.
4. **Report a price in 10 seconds** — item, market, wholesale or retail, unit, price, optional photo of price tag or receipt.
5. **"I saw this price too" / "Price is wrong"** buttons on every price, so buyers confirm or dispute.
6. **Price requests** — a buyer asks "What is mango per basket in Ubani today?"; users in that market get notified and can answer.
7. **Reporter trust** — people whose prices keep getting confirmed gain a badge and their reports count more.
8. **Sample data clearly labelled** — existing demo prices are marked "Sample — not real" and excluded from Ask Sabi answers and trust scores.
9. **Ask Sabi rules** — answers quote only checked prices, always saying "3 people reported ₦X–₦Y in Onitsha, last seen 2 days ago". If none exist it says "I don't have a real price for that yet" instead of inventing one.
10. **Services too** — same flow for services (tailoring, barbing, okada/keke fares, mechanic, phone repair).

## How a price becomes trusted (the logic)
- Only reports from the last 14 days count; older ones fade out.
- Extreme outliers (far outside the middle of other reports) are set aside, not deleted.
- Shown price = middle value (median) of the remaining reports, with the low–high range.
- Trust level:
  - Confirmed: 3+ different people, or 2 plus a photo, within 7 days
  - Likely: 2 people, or 1 trusted reporter
  - Single report: 1 person — shown with a warning
- One person cannot confirm their own price or flood reports (daily limits per item/market).
- Disputes lower trust; many disputes hide the price until re-confirmed.

## Technical details
- New tables: `sabi_markets` (name, city, state, country, lat/lng), `sabi_items` (canonical name, aliases, category, default units, kind goods/service), price reports gain `market_id`, `price_type` (wholesale/retail), `unit_qty`, `is_sample`, `photo_path`, `status`; `sabi_price_votes` (confirm/dispute, one per user per report), `sabi_price_requests` + answers, `sabi_reporter_stats`. GRANTs + owner/authenticated RLS; storage bucket for price photos.
- Mark all existing seeded rows `is_sample = true`.
- Aggregation done in a server function (median, outlier filter via IQR, trust level, freshness); pure logic in `src/lib/sabi.ts` with unit tests.
- Item search with alias matching ("pampers" = "Pampers Baby Dry", "action bitter" = "Action Bitters").
- `/market` rebuilt around market picker + search + wholesale/retail cards; new report, confirm, dispute and request flows; notifications for requests in a user's markets.
- `/api/chat` grounding switched to trusted aggregates only (non-sample), with explicit "no data" instructions; Onyix metering unchanged.
- No fake seeding of "real" prices. Markets list is seeded (they are real places); prices start empty until people report.
