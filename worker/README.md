# KI Operator worker

Run this as a separate always-on Node service after applying the operator migration.

```bash
npm run worker:operator
```

Required environment: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. Optional: `OPERATOR_POLL_MS=30000`.
Only one instance evaluates at a time through the database lease. Exchange failures trigger exponential backoff. Keep `shadow_mode=true` until seven days of feed/model metrics have been reviewed.
