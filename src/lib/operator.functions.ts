import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/middleware";

export const getOperatorOverview = createServerFn({method:"GET"}).middleware([requireAuth]).handler(async({context})=>{
  const db=context.supabase as any;
  const [{data:plans},{data:alerts},{data:settings},{data:health},{data:metrics}]=await Promise.all([
    db.from("ki_position_plans").select("*, market_inventory_trades(id,asset,amount,remaining_amount,buy_price,currency,buy_time,source_exchange,destination_exchange,payment_method)").eq("user_id",context.userId).eq("active",true).order("computed_at",{ascending:false}),
    db.from("ki_operator_alerts").select("*").eq("user_id",context.userId).is("acknowledged_at",null).order("created_at",{ascending:false}).limit(30),
    db.from("ki_strategy_settings").select("*").eq("user_id",context.userId).maybeSingle(),
    db.from("market_intelligence_feed_health").select("*").order("fiat"),
    db.from("ki_model_metrics").select("*").order("metric_date",{ascending:false}).limit(40),
  ]);
  return {plans:plans??[],alerts:alerts??[],settings:settings??{posture:"capital_protection",normal_horizon_hours:24,shadow_mode:true,live_alerts_enabled:false},health:health??[],metrics:metrics??[]};
});
export const getMarketSeries=createServerFn({method:"POST"}).middleware([requireAuth]).inputValidator((v:unknown)=>z.object({fiat:z.enum(["NGN","GHS","KES","ZAR","USD","EUR","GBP","AED"]),exchange:z.enum(["Binance","Bybit","OKX"]),side:z.enum(["buy","sell"]),interval:z.union([z.literal(60),z.literal(300),z.literal(900),z.literal(3600),z.literal(86400)]).default(300)}).parse(v)).handler(async({data,context})=>{const {data:rows,error}=await(context.supabase as any).from("market_intelligence_candles").select("*").eq("fiat",data.fiat).eq("exchange",data.exchange).eq("side",data.side).eq("interval_seconds",data.interval).order("bucket_at",{ascending:false}).limit(500);if(error)throw new Error(error.message);return(rows??[]).reverse();});
export const updateStrategySettings=createServerFn({method:"POST"}).middleware([requireAuth]).inputValidator((v:unknown)=>z.object({normal_horizon_hours:z.number().int().min(1).max(168),alert_cooldown_minutes:z.number().int().min(5).max(1440),enabled_fiats:z.array(z.enum(["NGN","GHS","KES","ZAR","USD","EUR","GBP","AED"])).min(1)}).parse(v)).handler(async({data,context})=>{const{error}=await(context.supabase as any).from("ki_strategy_settings").upsert({user_id:context.userId,...data,posture:"capital_protection",break_even_first:true,updated_at:new Date().toISOString()});if(error)throw new Error(error.message);return{ok:true};});
export const acknowledgeOperatorAlert=createServerFn({method:"POST"}).middleware([requireAuth]).inputValidator((v:unknown)=>z.object({id:z.string().uuid()}).parse(v)).handler(async({data,context})=>{await(context.supabase as any).from("ki_operator_alerts").update({acknowledged_at:new Date().toISOString()}).eq("id",data.id).eq("user_id",context.userId);return{ok:true};});
export const submitRecommendationFeedback=createServerFn({method:"POST"}).middleware([requireAuth]).inputValidator((v:unknown)=>z.object({recommendation_id:z.string().uuid(),rating:z.enum(["helpful","not_helpful","followed","ignored"]),note:z.string().max(500).optional()}).parse(v)).handler(async({data,context})=>{const{error}=await(context.supabase as any).from("ki_recommendation_feedback").upsert({user_id:context.userId,...data},{onConflict:"user_id,recommendation_id"});if(error)throw new Error(error.message);return{ok:true};});
