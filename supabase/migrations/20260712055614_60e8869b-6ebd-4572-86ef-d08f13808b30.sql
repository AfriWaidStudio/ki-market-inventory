CREATE TABLE public.market_intelligence_ads (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  exchange text NOT NULL,
  asset text NOT NULL DEFAULT 'USDT',
  fiat text NOT NULL,
  side text NOT NULL CHECK (side IN ('buy','sell')),
  external_ad_id text NOT NULL,
  price numeric NOT NULL CHECK (price > 0),
  available_asset numeric,
  min_fiat numeric,
  max_fiat numeric,
  payment_methods text[] NOT NULL DEFAULT '{}',
  merchant_name text,
  merchant_verified boolean,
  completion_rate numeric,
  completed_orders integer,
  response_latency_ms integer,
  schema_version text NOT NULL,
  observed_at timestamptz NOT NULL,
  raw_fingerprint text NOT NULL,
  UNIQUE(exchange, fiat, side, external_ad_id, observed_at)
);
CREATE INDEX market_ads_lookup_idx ON public.market_intelligence_ads(fiat, exchange, side, observed_at DESC);

CREATE TABLE public.market_intelligence_candles (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  exchange text NOT NULL,
  asset text NOT NULL DEFAULT 'USDT',
  fiat text NOT NULL,
  side text NOT NULL CHECK (side IN ('buy','sell')),
  interval_seconds integer NOT NULL,
  bucket_at timestamptz NOT NULL,
  open numeric NOT NULL, high numeric NOT NULL, low numeric NOT NULL, close numeric NOT NULL,
  executable_price numeric NOT NULL,
  depth_asset numeric NOT NULL DEFAULT 0,
  merchant_count integer NOT NULL DEFAULT 0,
  volatility numeric NOT NULL DEFAULT 0,
  UNIQUE(exchange, asset, fiat, side, interval_seconds, bucket_at)
);
CREATE INDEX market_candles_lookup_idx ON public.market_intelligence_candles(fiat, exchange, side, interval_seconds, bucket_at DESC);

CREATE TABLE public.market_intelligence_feed_health (
  exchange text NOT NULL,
  fiat text NOT NULL,
  status text NOT NULL CHECK (status IN ('healthy','degraded','stale','blocked','unsupported')),
  schema_version text,
  consecutive_failures integer NOT NULL DEFAULT 0,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  next_attempt_at timestamptz,
  latency_ms integer,
  error_message text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(exchange, fiat)
);

ALTER TABLE public.market_inventory_trades
  ADD COLUMN IF NOT EXISTS source_exchange text,
  ADD COLUMN IF NOT EXISTS destination_exchange text,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS total_fiat_spent numeric,
  ADD COLUMN IF NOT EXISTS entry_fees numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS transfer_network text,
  ADD COLUMN IF NOT EXISTS transfer_fee_asset numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS intended_horizon_hours integer NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS available_amount numeric;

CREATE TABLE public.ki_strategy_settings (
  user_id uuid PRIMARY KEY REFERENCES public.app_users(id) ON DELETE CASCADE,
  posture text NOT NULL DEFAULT 'capital_protection' CHECK (posture IN ('capital_protection','balanced','aggressive')),
  break_even_first boolean NOT NULL DEFAULT true,
  normal_horizon_hours integer NOT NULL DEFAULT 24 CHECK (normal_horizon_hours BETWEEN 1 AND 168),
  enabled_fiats text[] NOT NULL DEFAULT ARRAY['NGN','GHS','KES','ZAR','USD','EUR','GBP','AED'],
  evaluation_amounts numeric[] NOT NULL DEFAULT ARRAY[100,500,1000],
  shadow_mode boolean NOT NULL DEFAULT true,
  shadow_started_at timestamptz NOT NULL DEFAULT now(),
  live_alerts_enabled boolean NOT NULL DEFAULT false,
  alert_cooldown_minutes integer NOT NULL DEFAULT 30,
  muted_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ki_position_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  trade_id uuid NOT NULL REFERENCES public.market_inventory_trades(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('sell_now','wait','transfer','avoid','insufficient_data')),
  venue text, executable_price numeric, executable_amount numeric,
  break_even_price numeric NOT NULL, target_price numeric NOT NULL,
  expected_net numeric, downside numeric, target_window_hours integer,
  confidence numeric, confidence_eligible boolean NOT NULL DEFAULT false,
  regime text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '[]',
  missing_data text[] NOT NULL DEFAULT '{}',
  invalidation_condition text NOT NULL,
  next_evaluation_at timestamptz NOT NULL,
  model_version text NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX ki_active_plan_trade_idx ON public.ki_position_plans(trade_id) WHERE active;
CREATE INDEX ki_plans_user_idx ON public.ki_position_plans(user_id, computed_at DESC);

CREATE TABLE public.ki_recommendation_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  trade_id uuid REFERENCES public.market_inventory_trades(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.ki_position_plans(id) ON DELETE SET NULL,
  action text NOT NULL,
  evidence jsonb NOT NULL, market_snapshot jsonb NOT NULL,
  predicted_windows jsonb NOT NULL DEFAULT '{}',
  model_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  outcome jsonb, evaluated_at timestamptz
);
CREATE TABLE public.ki_recommendation_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  recommendation_id uuid NOT NULL REFERENCES public.ki_recommendation_snapshots(id) ON DELETE CASCADE,
  rating text NOT NULL CHECK (rating IN ('helpful','not_helpful','followed','ignored')),
  note text, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, recommendation_id)
);

CREATE TABLE public.ki_operator_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  trade_id uuid REFERENCES public.market_inventory_trades(id) ON DELETE CASCADE,
  alert_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info','warning','critical')),
  dedupe_key text NOT NULL,
  title text NOT NULL, message text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  UNIQUE(user_id, dedupe_key)
);

CREATE TABLE public.ki_alert_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES public.ki_operator_alerts(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('in_app','telegram')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','suppressed')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz, error_message text,
  UNIQUE(alert_id, channel)
);

CREATE TABLE public.telegram_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.app_users(id) ON DELETE CASCADE,
  telegram_user_id bigint UNIQUE,
  chat_id bigint UNIQUE,
  link_code_hash text, link_code_expires_at timestamptz,
  linked_at timestamptz,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ki_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('web','telegram')),
  external_thread_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ki_conversation_channel_thread_idx ON public.ki_conversations(user_id, channel, external_thread_id);
CREATE TABLE public.ki_conversation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ki_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  external_message_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, external_message_id)
);

CREATE TABLE public.ki_telegram_updates (
  update_id bigint PRIMARY KEY,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  error_message text
);

CREATE TABLE public.ki_worker_leases (
  lease_key text PRIMARY KEY,
  owner_id text NOT NULL,
  lease_until timestamptz NOT NULL,
  checkpoint jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ki_model_metrics (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  model_version text NOT NULL,
  fiat text NOT NULL,
  metric_date date NOT NULL,
  sample_count integer NOT NULL,
  direction_accuracy numeric,
  target_hit_rate numeric,
  calibration_error numeric,
  feed_uptime numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(model_version, fiat, metric_date)
);

ALTER TABLE public.ki_strategy_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ki_position_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ki_recommendation_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ki_recommendation_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ki_operator_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ki_alert_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ki_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ki_conversation_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.market_intelligence_ads, public.market_intelligence_candles, public.market_intelligence_feed_health,
  public.ki_strategy_settings, public.ki_position_plans, public.ki_recommendation_snapshots, public.ki_recommendation_feedback, public.ki_operator_alerts,
  public.ki_alert_deliveries, public.telegram_connections, public.ki_conversations, public.ki_conversation_messages,
  public.ki_telegram_updates, public.ki_worker_leases, public.ki_model_metrics FROM anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;