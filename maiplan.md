# KI Market Inventory

## Full End-to-End Workflows, Testing Instructions & Definition of Done

Build, test, and verify the complete **KI Market Inventory** as a real working platform.

The purpose of KI Market Inventory is to help users track P2P and arbitrage activities, compare market opportunities, record simulated or real-world user-confirmed trades, connect exchanges through read-only access, analyze inflows and outflows, calculate actual profit and loss, and communicate with Konsmik Intelligence through natural conversation.

This platform must not execute real trades during the first production stage.

It must never:

* Buy cryptocurrency automatically.
* Sell cryptocurrency automatically.
* Transfer user funds.
* Request withdrawal permissions.
* Request trading permissions.
* Release P2P assets.
* simulate success using fake backend responses.

The platform is initially a **tracking, analysis, paper-trading, journaling, and read-only intelligence system**.

Every workflow below must be implemented and tested completely.

---

# 1. Core Operating Modes

KI Market Inventory must support three operating modes.

## Mode A — Paper Tracking

This mode allows users to simulate a trade without using real money.

The platform behaves as though a trade has been opened, but the action only exists inside the inventory.

The user can:

* Select an opportunity.
* Enter an amount.
* Tap **Paper Buy**.
* Track the simulated position.
* Watch live or manually refreshed prices.
* Tap **Paper Close**.
* See simulated profit or loss.

The system must clearly label this as:

**Paper Trade — No real transaction occurred.**

Paper-trade results must never be mixed with verified real-trade profit.

---

## Mode B — Manual Real-Trade Tracking

This mode allows the user to record an action they completed outside the platform.

The user taps:

**I Bought**

This does not place a real order.

It records that the user confirms they bought an asset elsewhere.

The user then enters or confirms:

* Asset
* Amount
* Buy exchange
* Buy price
* Total purchase cost
* Payment method
* Merchant
* Transaction time
* Expected sell exchange
* Expected sell price
* Estimated fees
* Notes

The platform creates an active tracked trade.

Later, the user taps:

**I Closed**

Again, this does not sell anything.

It records that the user confirms the trade has been completed externally.

The user enters or confirms:

* Sell exchange
* Sell price
* Amount sold
* Fees
* Final amount received
* Sell time
* Notes

The backend calculates the final result.

---

## Mode C — Read-Only Exchange Synchronization

The user connects supported exchanges using read-only API credentials.

The platform can then import available information such as:

* Wallet balances
* Deposits
* Withdrawals
* Internal transfers
* Spot transactions where available
* P2P order history where the provider exposes it
* Transaction timestamps
* Network fees
* Asset movement
* Exchange account status

The platform must never request:

* Trade permission
* Withdrawal permission
* Transfer permission

The system must show the exact permission status after connection.

If any dangerous permission is detected, reject or disable the connection and warn the user.

---

# 2. New User Onboarding Workflow

When a new user enters KI Market Inventory for the first time, guide them through setup.

## Step 1 — Welcome

Display:

> Welcome to KI Market Inventory. Track opportunities, record trades, analyze your performance, and speak with Konsmik Intelligence about your market activity.

Actions:

* Start Setup
* Explore Demo
* Learn How It Works

## Step 2 — Choose Tracking Method

Allow the user to select:

* Paper trading only
* Manual tracking
* Connect exchange read-only
* Use all available modes

The selection can be changed later.

## Step 3 — Set Base Currency

Default based on the user's region, but allow manual selection.

Examples:

* NGN
* USD
* EUR
* GBP
* GHS
* KES

For Nigerian users, default to NGN.

## Step 4 — Starting Capital

Ask the user to enter the amount they want to track.

Examples:

* ₦30,000
* ₦75,000
* ₦150,000
* Custom amount

Explain that this is for tracking only and does not move money.

## Step 5 — Preferred Exchanges

Allow selection of:

* Binance
* Bybit
* OKX
* KuCoin
* Bitget
* Future supported providers

## Step 6 — Risk Preference

Allow:

* Conservative
* Balanced
* Aggressive
* Custom

This preference changes how opportunities are ranked, but must not promise safety or profits.

## Step 7 — Complete Setup

Create:

* Market Inventory profile
* Default wallet
* Tracking preferences
* Notification preferences
* Personal risk profile
* Empty journal
* Initial analytics record

The user is then taken to the dashboard.

---

# 3. Dashboard Workflow

When the user opens KI Market Inventory, show the most important information immediately.

## Dashboard Summary

Display:

* Tracked capital
* Available tracked cash
* Capital currently inside active trades
* Paper-trading balance
* Real-trade tracked balance
* Active trades
* Pending transfers
* Today's realized profit
* Today's unrealized estimate
* Weekly profit
* Monthly profit
* All-time profit
* Total fees
* Win rate
* Best route
* Current KI recommendation
* Number of available opportunities

Paper and real-trade values must be clearly separated.

## Dashboard States

Test all states:

### New User

Show helpful empty-state guidance.

### No Opportunity

Display:

> No opportunity currently meets your selected risk and profitability rules.

### Active Trade

Show the current trade timer and status.

### Exchange Sync Failure

Show a warning without breaking the rest of the dashboard.

### Partially Available Data

Clearly label delayed or unavailable exchange information.

---

# 4. Opportunity Scanner Workflow

The Opportunity Scanner must collect, normalize, compare, and rank available market information.

## Inputs

Compare available data from supported platforms:

* P2P buy prices
* P2P sell prices
* Merchant limits
* Payment methods
* Advertised liquidity
* Merchant completion rate
* Merchant order count
* Estimated network fee
* Exchange withdrawal fee
* Estimated transfer duration
* Current market volatility
* Historical spread stability
* User-selected capital
* User risk preference

## Opportunity Calculation

For each opportunity calculate:

```text
Purchase Cost = Buy Price × Asset Amount

Gross Sale Value = Sell Price × Asset Amount

Gross Spread Profit = Gross Sale Value − Purchase Cost

Net Profit =
Gross Sale Value
− Purchase Cost
− Withdrawal Fee
− Network Fee
− Platform Fee
− Payment Cost
− Other Recorded Costs

ROI Percentage =
Net Profit ÷ Purchase Cost × 100
```

Use decimal or numeric database fields.

Never use floating-point values for financial totals.

## Opportunity Card

Each card must show:

* Asset
* Buy exchange
* Sell exchange
* Buy price
* Sell price
* Spread
* Capital required
* Estimated total fees
* Estimated net profit
* Estimated ROI
* Available order limits
* Merchant reliability
* Liquidity
* Risk level
* Confidence score
* Last update time
* Data source
* Recommended action

Possible actions:

* Paper Buy
* I Bought
* Save
* Watch
* Compare
* Ask KI
* Ignore

## Opportunity Status

Support:

* New
* Improving
* Stable
* Weakening
* Expired
* Insufficient liquidity
* Unavailable
* High risk
* Data delayed

Opportunities must expire when their data is no longer reliable.

---

# 5. Opportunity Comparison Workflow

The user must be able to compare several opportunities side by side.

Compare:

* Route
* Required capital
* Profit
* ROI
* Fees
* Transfer time
* Liquidity
* Merchant quality
* Confidence
* Risk
* Data freshness

KI should explain:

* Which has the highest expected profit.
* Which has the lowest risk.
* Which has the fastest expected completion.
* Which is best for the user's capital.
* Why the most profitable option may not be the safest.

The final output must never claim certainty.

---

# 6. Paper Trade Opening Workflow

When the user taps **Paper Buy**:

## Step 1 — Trade Confirmation

Show:

* Selected opportunity
* Simulated amount
* Simulated purchase cost
* Estimated fees
* Expected profit
* Risk
* Current data timestamp

Require confirmation:

> This is a simulated trade. No real order will be placed.

## Step 2 — Create Paper Trade

Record:

* user_id
* entity_id
* trade_type = paper
* asset
* amount
* buy_exchange
* expected_sell_exchange
* buy_price
* expected_sell_price
* expected_fees
* expected_profit
* opportunity_id
* KI recommendation
* confidence score
* risk score
* opened_at
* status = active

## Step 3 — Active Paper Trade

Start the trade timer.

Show:

* Time open
* Current market price
* Current sell estimate
* Current estimated profit
* Original expectation
* Price movement
* Spread movement
* KI status
* Last updated time

## Step 4 — Close Paper Trade

The user taps **Paper Close**.

Record:

* simulated sell price
* closed time
* simulated final profit
* final fees
* duration
* KI accuracy
* outcome

Add the result to paper-trading analytics only.

---

# 7. Manual Trade Opening Workflow

When the user taps **I Bought**:

## Step 1 — Select Input Method

Allow:

* Use opportunity details
* Enter trade manually
* Import from transaction
* Duplicate previous trade setup

## Step 2 — Confirm Purchase Details

Required:

* Asset
* Amount bought
* Buy exchange
* Buy price
* Total purchase cost
* Currency
* Buy time

Optional:

* Merchant name
* Merchant ID
* Payment method
* Order reference
* Screenshot or receipt
* Notes

## Step 3 — Select Intended Exit

Allow:

* Sell on another exchange
* Sell on same exchange
* Exit exchange undecided
* Hold temporarily

Record expected exit separately from actual exit.

## Step 4 — Calculate Expected Outcome

Show:

* Expected gross value
* Expected fees
* Expected net profit
* Expected ROI
* Estimated break-even price

## Step 5 — Confirm

Display:

> KI Market Inventory will record and monitor this trade. It will not execute or control the transaction.

## Step 6 — Create Active Trade

Status becomes:

* Bought
* Awaiting transfer
* Received
* Listed for sale
* Awaiting payment
* Ready to close

The user can update the stage manually.

---

# 8. Active Trade Monitoring Workflow

Every active trade must have a dedicated workspace.

## Header

Show:

* Asset
* Route
* Trade type
* Trade status
* Time open
* Last sync time

## Financial Summary

Show:

* Purchase cost
* Original expected profit
* Current estimated profit
* Unrealized difference
* Break-even sell price
* Current sell price
* Total estimated fees

## Timeline

Record every event:

* Opportunity detected
* Trade opened
* User marked bought
* Transfer initiated
* Transfer received
* Sale started
* Price changed
* KI recommendation changed
* Trade closed

## Actions

Allow:

* Update stage
* Update price
* Add fee
* Add note
* Upload receipt
* Mark transferred
* Mark received
* Mark listed
* Mark payment received
* Close trade
* Cancel tracking
* Ask KI

## KI Monitoring

KI may recommend:

* Close now
* Continue monitoring
* Target reached
* Break-even risk
* Spread weakening
* Fees increased
* Data unavailable
* User action required

Every recommendation must include:

* Reason
* Supporting data
* Confidence
* Data timestamp
* Known uncertainty

---

# 9. Trade Closing Workflow

When the user taps **I Closed**:

## Step 1 — Confirm Exit Details

Required:

* Amount sold
* Sell exchange
* Actual sell price
* Final amount received
* Sell time

Optional:

* Merchant
* Payment method
* Final network fee
* Other cost
* Notes
* Proof

## Step 2 — Reconciliation

Calculate:

```text
Gross Revenue = Actual Sell Price × Amount Sold

Total Cost =
Purchase Cost
+ Buy-Side Fees
+ Transfer Fees
+ Network Fees
+ Sell-Side Fees
+ Other Costs

Actual Profit = Gross Revenue − Total Cost

ROI = Actual Profit ÷ Total Cost × 100
```

Support partial close.

If only part of the position is sold:

* Keep remaining amount active.
* Calculate realized profit for the closed portion.
* Calculate estimated value for the remaining portion.

## Step 3 — Review Result

Show:

* Profit or loss
* ROI
* Trade duration
* Expected versus actual outcome
* Difference caused by price
* Difference caused by fees
* Difference caused by delays
* KI recommendation accuracy
* User notes

## Step 4 — Journal Entry

Generate a trade journal entry automatically.

Allow the user to add:

* What went well
* What went wrong
* Emotion during the trade
* Lesson learned
* Would repeat?
* Strategy tag

## Step 5 — Update Analytics

Update all relevant summaries immediately.

---

# 10. Cancelled and Abandoned Trade Workflow

Support trade statuses such as:

* Cancelled before purchase
* Tracking cancelled
* Transfer failed
* Sale failed
* Abandoned
* Invalid record
* Duplicate

Cancelled records must not be counted as realized profit.

Retain them for audit and learning unless the user permanently deletes them under supported data-retention rules.

---

# 11. Read-Only Exchange Connection Workflow

## Step 1 — Select Exchange

Show available providers.

## Step 2 — Security Explanation

Clearly instruct the user:

* Create a read-only API key.
* Do not enable trading.
* Do not enable withdrawals.
* Use IP restrictions where supported.
* Rotate keys if exposure is suspected.

## Step 3 — Enter Credentials

The frontend sends credentials securely to the backend.

Never store raw secrets in:

* Local storage
* Browser cookies
* Frontend code
* Client logs
* Analytics events

## Step 4 — Encrypt and Store

The backend must:

* Validate credentials.
* Inspect permissions where possible.
* Reject dangerous permission sets.
* Encrypt the secret before storing.
* Store a masked API-key identifier.
* Record connection time.
* Write an audit log.

## Step 5 — Initial Sync

Import supported data.

Display:

* Sync started
* Records discovered
* Records imported
* Unsupported records
* Errors
* Completion time

## Step 6 — Connection Status

Support:

* Connected
* Syncing
* Healthy
* Permission warning
* Authentication failed
* Rate limited
* Temporarily unavailable
* Disconnected
* Revoked

## Step 7 — Disconnect

The user must be able to:

* Pause synchronization
* Reconnect
* Replace credentials
* Delete connection
* Delete imported connection metadata where permitted

---

# 12. Automatic Transaction Matching Workflow

When read-only records are imported, attempt to identify related actions.

Example:

1. USDT purchased or received on Exchange A.
2. Matching USDT withdrawal occurs.
3. Similar deposit appears on Exchange B.
4. Asset later decreases or a sell record appears.
5. Fiat-equivalent result is entered or imported where available.

The system should group likely related records into a suggested trade.

Show:

> KI detected a possible Binance → Bybit transaction flow. Review and confirm.

The user must confirm before it becomes a verified trade.

Automatic matching must use:

* Asset
* Amount
* Time proximity
* Fees
* Wallet address where permitted
* Transaction ID
* Exchange route
* Historical patterns

Support match confidence:

* High
* Medium
* Low

Never silently classify uncertain records as confirmed profit.

---

# 13. Inflow and Outflow Tracking Workflow

Create a complete money and asset movement ledger.

Track:

* Starting capital
* Added capital
* Removed capital
* Exchange deposit
* Exchange withdrawal
* Internal transfer
* Network fee
* Trading fee
* P2P purchase
* P2P sale
* Refund
* Adjustment
* Profit
* Loss

Capital added by the user must not be counted as profit.

Capital withdrawn by the user must not be counted as loss.

Profit calculations must distinguish:

* Capital flow
* Trading revenue
* Costs
* Realized profit
* Unrealized estimate

---

# 14. KI Chat Workflow

The user can speak naturally with Konsmik Intelligence.

Examples:

* How much have I made today?
* What is my real total profit?
* Separate paper profit from actual profit.
* Which trade is currently weakest?
* Should I close this trade?
* What route has worked best?
* How much have I paid in fees?
* Show me every loss caused by delay.
* What time do I trade best?
* Compare Binance and Bybit.
* Find trades similar to this one.
* What mistake do I repeat?
* Explain this profit calculation.
* What should I focus on today?

## Chat Data Rules

KI must use:

* The authenticated user's records.
* Current authorized exchange data.
* Current opportunities.
* Stored preferences.
* Relevant trade history.

KI must not invent:

* Transactions
* Prices
* Merchant information
* Profits
* Balances
* API connection status

When data is unavailable, say so clearly.

## Chat Actions

Allow approved actions such as:

* Open a trade record
* Filter history
* Create a draft paper trade
* Add a note
* Generate a report
* Create an alert

Require explicit confirmation before changing financial records.

---

# 15. Personal Intelligence Workflow

Over time, analyze the user's history.

Identify:

* Best trading hours
* Worst trading hours
* Best routes
* Worst routes
* Average duration
* Fee patterns
* Delay patterns
* Most profitable amount range
* Frequent mistakes
* Consistency
* Ignored warnings
* Risk preference versus actual behavior

Do not claim that historical patterns guarantee future results.

---

# 16. Analytics Workflow

Build analytics for:

## Profit Analytics

* Today
* Yesterday
* This week
* This month
* Custom range
* All time

## Route Analytics

* Profit by route
* Trade count by route
* Average duration by route
* Fees by route
* Win rate by route

## Exchange Analytics

* Buy volume
* Sell volume
* Profit
* Fees
* Sync reliability
* Average completion time

## Behavioral Analytics

* Best hour
* Worst hour
* Average holding time
* Trades opened under pressure
* Trades closed early
* Trades held too long
* Followed KI
* Ignored KI

## Capital Analytics

* Starting capital
* Added capital
* Withdrawn capital
* Realized profit
* Current tracked capital
* Capital growth rate

All reports must separate:

* Paper
* Manual real-trade
* Read-only verified
* Unverified imported records

---

# 17. Daily Report Workflow

At the end of each day, generate:

* Opening tracked capital
* Closing tracked capital
* Number of trades
* Paper trades
* Real tracked trades
* Verified imported trades
* Wins
* Losses
* Gross profit
* Fees
* Net profit
* Best trade
* Weakest trade
* Best route
* Main mistake
* KI lesson
* Data completeness status

The report should be readable in both card and conversational formats.

---

# 18. Weekly Review Workflow

Generate:

* Weekly net result
* Capital change
* Route performance
* Fee burden
* Best trading day
* Worst trading day
* Best trading time
* Improvement from previous week
* Risk issues
* Strategy observations
* Recommended focus for next week

Allow export as:

* PDF later
* CSV
* JSON
* Shareable summary card

---

# 19. Alert Workflow

Allow users to create alerts for:

* Spread above target
* Estimated profit above target
* Specific buy price
* Specific sell price
* Low-risk opportunity
* High merchant trust
* Active trade target reached
* Break-even risk
* Exchange sync failure
* Connection permission problem
* Fee spike
* Unusual outflow

Every alert must include:

* Trigger condition
* Exchange
* Asset
* Expiration
* Notification channel
* Cooldown
* Enabled status

Prevent repeated alert spam.

---

# 20. Merchant Tracking Workflow

Where merchant information is available or manually entered, support:

* Merchant name
* Exchange
* Completion rate
* Order count
* Average response time
* User's trade count
* User's profit history
* User notes
* Trusted
* Watchlist
* Blocked
* Risk warning

Never publicly accuse a merchant of fraud based only on weak signals.

Use wording such as:

> This merchant has indicators that require additional verification.

---

# 21. Search and Filtering Workflow

Users must be able to search naturally or with filters.

Filters:

* Date
* Asset
* Exchange
* Route
* Status
* Trade type
* Profit
* Loss
* Paper
* Verified
* Unverified
* Merchant
* Risk
* Confidence
* Duration

Natural-language examples:

* Show my profitable Bybit trades.
* Find every trade over 30 minutes.
* Show losses caused by fees.
* Show my trades from last Monday.
* Find all unverified imports.

---

# 22. Edit and Correction Workflow

Users must be able to correct manual records.

Every edit should:

* Preserve the previous value.
* Record who made the change.
* Record the timestamp.
* Recalculate affected analytics.
* Write an audit event.

Sensitive imported records should not be overwritten directly.

Instead, create:

* User correction
* Reconciliation adjustment
* Verified override

---

# 23. Admin Workflow

The admin interface must support:

* View platform health
* View exchange connector status
* View sync failures
* View job queues
* View provider rate limits
* View anonymized usage analytics
* Manage supported exchanges
* Enable or disable integrations
* Configure opportunity thresholds
* Configure fees
* Configure asset support
* Configure alert limits
* Inspect error logs
* Retry failed jobs
* Suspend abusive users
* Manage feature flags

Admins must not casually access private user financial records.

Access must be permission-controlled and audited.

---

# 24. Background Job Workflows

Use BullMQ and Redis for long-running or recurring jobs.

Jobs include:

* Exchange synchronization
* Opportunity refresh
* Price snapshot collection
* Analytics aggregation
* Daily report generation
* Weekly report generation
* Alert evaluation
* Notification delivery
* Expired opportunity cleanup
* Connection health checks
* Reconciliation
* Data-retention cleanup

Each job must support:

* Retry
* Backoff
* Timeout
* Failure logging
* Dead-letter handling
* Idempotency

Running the same job twice must not duplicate records.

---

# 25. Realtime Workflow

Use Socket.IO or Supabase Realtime where appropriate.

Realtime events may include:

* Opportunity updated
* Opportunity expired
* Trade price updated
* Trade status changed
* Sync completed
* Alert triggered
* Notification created
* Dashboard totals updated

The app must recover from disconnection.

After reconnection:

* Fetch the latest authoritative state.
* Do not rely only on missed realtime events.

---

# 26. Security Test Workflow

Verify all of the following:

* User A cannot view User B's trades.
* User A cannot update User B's trades.
* User A cannot access User B's API connections.
* User A cannot access User B's uploaded files.
* Regular users cannot access admin routes.
* Frontend cannot retrieve raw API secrets.
* Service-role credentials never reach the browser.
* Dangerous exchange permissions are rejected.
* Input validation blocks malformed data.
* Rate limits protect sensitive endpoints.
* Duplicate requests do not double-create trades.
* Duplicate close requests do not double-count profit.
* Deleted sessions cannot continue using protected APIs.
* Audit logs are created for sensitive actions.

---

# 27. Financial Accuracy Test Workflow

Test:

* Positive profit
* Negative result
* Break-even
* Zero fee
* Multiple fees
* Partial close
* Multiple partial closes
* Capital deposit
* Capital withdrawal
* Refund
* Adjustment
* Currency conversion
* Decimal asset amount
* Very small fee
* Very large amount
* Duplicate imported transaction
* Missing sell price
* Missing final amount
* Delayed close

Every financial total must be reproducible from ledger entries.

Dashboard totals should not be stored as the only source of truth.

Use transaction records and reconciliation.

---

# 28. Failure-State Testing

Test all failures:

* Exchange API unavailable
* Invalid API key
* Expired API key
* Permission changed
* Rate limit reached
* Database failure
* Redis unavailable
* Worker unavailable
* Realtime disconnected
* Notification failure
* AI provider failure
* Partial sync
* Duplicate webhook
* Stale opportunity
* Missing price
* Unsupported transaction type

The app must:

* Fail safely.
* Preserve user data.
* Explain the problem.
* Avoid fake values.
* Allow retry where appropriate.

---

# 29. KI Reliability Testing

Ask KI questions whose answers are known from stored records.

Verify:

* Profit answer matches ledger.
* Trade count matches database.
* Best route matches analytics.
* Active-trade answer uses current status.
* Paper and real results are separated.
* Unverified records are labeled.
* KI does not invent exchange prices.
* KI explains missing data.
* KI cites the time of market data.
* KI recommendations contain uncertainty.
* KI cannot alter records without approval.

---

# 30. User Experience Testing

Test on:

* Mobile
* Tablet
* Desktop
* Slow connection
* Realtime disconnection
* Empty account
* Large trade history
* Dark mode
* Light mode

Every important action must have:

* Loading state
* Success state
* Error state
* Empty state
* Confirmation where needed
* Undo where safe

Avoid excessive tables on mobile.

Use cards, drawers, filters, and progressive disclosure.

---

# 31. Performance Testing

Verify:

* Dashboard loads quickly.
* Pagination is used for large histories.
* Charts do not request unlimited records.
* Redis caches non-sensitive repeated data.
* Database queries use indexes.
* Exchange APIs are not called directly from every browser.
* Background sync is batched.
* Realtime events are scoped.
* AI chat does not load the user's entire history unnecessarily.

---

# 32. Required Database Areas

At minimum, create or verify models for:

* market_inventory_profiles
* market_inventory_accounts
* market_inventory_trades
* market_inventory_trade_events
* market_inventory_trade_fees
* market_inventory_trade_notes
* market_inventory_opportunities
* market_inventory_price_snapshots
* market_inventory_exchange_connections
* market_inventory_exchange_transactions
* market_inventory_sync_runs
* market_inventory_transaction_matches
* market_inventory_capital_ledger
* market_inventory_merchants
* market_inventory_alerts
* market_inventory_daily_reports
* market_inventory_weekly_reports
* market_inventory_ai_insights
* market_inventory_audit_logs

Do not store raw exchange secrets inside normal connection records.

Use a secure encrypted vault design.

---

# 33. Required API Areas

Create versioned APIs for:

* Profile
* Dashboard
* Opportunities
* Paper trades
* Manual trades
* Trade updates
* Trade closing
* Trade history
* Exchange connections
* Exchange sync
* Imported transactions
* Matching and reconciliation
* Analytics
* Reports
* Alerts
* Merchants
* KI chat
* Admin operations

Use:

```text
/api/v1/market-inventory/...
```

Controllers should remain thin.

Business rules belong in services and domain modules.

---

# 34. Definition of Done

KI Market Inventory is not complete merely because pages exist.

It is complete only when:

* Users can finish onboarding.
* Users can create paper trades.
* Users can close paper trades.
* Users can record manual trades.
* Users can close manual trades.
* Partial closes work.
* Profit calculations are accurate.
* Capital flow is separated from profit.
* Active trades update correctly.
* Paper and real results remain separate.
* Read-only connections are secure.
* Connection permissions are validated.
* Imported transactions are deduplicated.
* Suggested matches require confirmation.
* Analytics match the financial ledger.
* KI answers from real user records.
* KI does not invent missing data.
* Security rules isolate all users.
* Admin actions are audited.
* Background jobs recover safely.
* Failure states are handled.
* Mobile UX is usable.
* No real trading action exists.
* No withdrawal permission exists.
* No private key is exposed.

---

# Final Instruction to the Developer or AI Agent

Do not only inspect the frontend.

Test the full flow from interface to API, business logic, database, queue, realtime updates, analytics, and KI response.

Do not mark a workflow complete because a button changes the screen.

A workflow is complete only when:

1. The frontend sends the correct request.
2. The backend validates it.
3. The business rule is executed.
4. The database records the result.
5. The audit log records the action.
6. The UI receives the authoritative response.
7. Analytics update correctly.
8. KI can retrieve and explain the result.
9. Failure and retry behavior are verified.
10. Another user cannot access the record.

Where an existing implementation already works, preserve and improve it.

Where a workflow is mock-only, clearly identify it and replace it with real backend behavior.

Where an integration cannot provide certain data, do not fabricate it. Mark the data as unavailable, unsupported, delayed, user-confirmed, inferred, or unverified.

The final platform must feel like a personal market intelligence command center that observes, records, reconciles, explains, and learns from the user's activity without controlling the user's money.