
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- feed health: readable by any signed-in user; writes only by service role
alter table public.market_intelligence_feed_health enable row level security;
grant select on public.market_intelligence_feed_health to authenticated;
grant all on public.market_intelligence_feed_health to service_role;
drop policy if exists "feed health readable" on public.market_intelligence_feed_health;
create policy "feed health readable" on public.market_intelligence_feed_health for select to authenticated using (true);

-- candles: readable aggregates
alter table public.market_intelligence_candles enable row level security;
grant select on public.market_intelligence_candles to authenticated;
grant all on public.market_intelligence_candles to service_role;
drop policy if exists "candles readable" on public.market_intelligence_candles;
create policy "candles readable" on public.market_intelligence_candles for select to authenticated using (true);

-- ads: signed-in read (raw feed used by scanner)
alter table public.market_intelligence_ads enable row level security;
grant select on public.market_intelligence_ads to authenticated;
grant all on public.market_intelligence_ads to service_role;
drop policy if exists "ads readable" on public.market_intelligence_ads;
create policy "ads readable" on public.market_intelligence_ads for select to authenticated using (true);

-- model metrics: readable
alter table public.ki_model_metrics enable row level security;
grant select on public.ki_model_metrics to authenticated;
grant all on public.ki_model_metrics to service_role;
drop policy if exists "model metrics readable" on public.ki_model_metrics;
create policy "model metrics readable" on public.ki_model_metrics for select to authenticated using (true);

-- worker leases + telegram updates: internal only
alter table public.ki_worker_leases enable row level security;
grant all on public.ki_worker_leases to service_role;

alter table public.ki_telegram_updates enable row level security;
grant all on public.ki_telegram_updates to service_role;
