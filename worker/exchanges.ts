import { createHash } from "node:crypto";
import type { MarketAd } from "../src/lib/operator-engine";

export type CapturedAd = MarketAd & {
  asset: string; fiat: string; externalAdId: string; minFiat: number | null; maxFiat: number | null;
  paymentMethods: string[]; merchantName: string | null; merchantVerified: boolean | null;
  completionRate: number | null; completedOrders: number | null; latencyMs: number; schemaVersion: string;
  rawFingerprint: string;
};
const fingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const asNum = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

export async function fetchBinanceBook(asset: string, fiat: string, side: "buy"|"sell"): Promise<CapturedAd[]> {
  const started = Date.now();
  const response = await fetch("https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search", { method:"POST", headers:{"content-type":"application/json","user-agent":"Mozilla/5.0"}, body:JSON.stringify({page:1,rows:20,asset,fiat,tradeType:side === "buy" ? "BUY" : "SELL",payTypes:[],publisherType:null}) });
  if (!response.ok) throw new Error(`Binance HTTP ${response.status}`);
  const payload = await response.json() as any; const rows = payload.data;
  if (!Array.isArray(rows)) throw new Error("Binance schema changed: data is not an array");
  return rows.map((row:any, index:number) => ({
    exchange:"Binance",asset,fiat,side,externalAdId:String(row.adv?.advNo ?? index),price:asNum(row.adv?.price),
    availableAsset:asNum(row.adv?.surplusAmount),minFiat:asNum(row.adv?.minSingleTransAmount)||null,maxFiat:asNum(row.adv?.maxSingleTransAmount)||null,
    paymentMethods:(row.adv?.tradeMethods ?? []).map((p:any)=>String(p.tradeMethodName ?? p.identifier)).filter(Boolean),
    merchantName:row.advertiser?.nickName ?? null,merchantVerified:Boolean(row.advertiser?.userType),completionRate:asNum(row.advertiser?.monthFinishRate)||null,
    completedOrders:Math.round(asNum(row.advertiser?.monthOrderCount))||null,
    observedAt:new Date().toISOString(),latencyMs:Date.now()-started,schemaVersion:"binance-c2c-v2",rawFingerprint:fingerprint(row),
  })).filter((a:CapturedAd)=>a.price>0 && a.availableAsset>0);
}

export async function fetchBybitBook(asset:string, fiat:string, side:"buy"|"sell"):Promise<CapturedAd[]> {
  const started=Date.now();
  const response=await fetch("https://api2.bybit.com/fiat/otc/item/online",{method:"POST",headers:{"content-type":"application/json","user-agent":"Mozilla/5.0"},body:JSON.stringify({userId:"",tokenId:asset,currencyId:fiat,payment:[],side:side==="buy"?"1":"0",size:"20",page:"1",amount:""})});
  if(!response.ok) throw new Error(`Bybit HTTP ${response.status}`);
  const payload=await response.json() as any; const rows=payload.result?.items;
  if(!Array.isArray(rows)) throw new Error("Bybit schema changed: items is not an array");
  return rows.map((row:any,index:number)=>({exchange:"Bybit",asset,fiat,side,externalAdId:String(row.id??row.itemId??index),price:asNum(row.price),availableAsset:asNum(row.lastQuantity??row.quantity),minFiat:asNum(row.minAmount)||null,maxFiat:asNum(row.maxAmount)||null,paymentMethods:(row.payments??row.paymentTerms??[]).map(String),merchantName:row.nickName??null,merchantVerified:Boolean(row.isOnline),completionRate:(asNum(row.recentExecuteRate)||0)/100||null,completedOrders:Math.round(asNum(row.recentOrderNum))||null,observedAt:new Date().toISOString(),latencyMs:Date.now()-started,schemaVersion:"bybit-fiat-otc-v1",rawFingerprint:fingerprint(row)})).filter((a:CapturedAd)=>a.price>0&&a.availableAsset>0);
}

export async function fetchOkxBook(asset:string,fiat:string,side:"buy"|"sell"):Promise<CapturedAd[]> {
  const started=Date.now(), marketSide=side==="buy"?"sell":"buy";
  const url=`https://www.okx.com/v3/c2c/tradingOrders/books?quoteCurrency=${encodeURIComponent(fiat)}&baseCurrency=${encodeURIComponent(asset)}&side=${marketSide}&paymentMethod=all&userType=all&showTrade=false&showFollow=false&showAlreadyTraded=false&isAbleFilter=false`;
  const response=await fetch(url,{headers:{"user-agent":"Mozilla/5.0"}}); if(!response.ok) throw new Error(`OKX HTTP ${response.status}`);
  const payload=await response.json() as any; const rows=marketSide==="sell"?payload.data?.sell:payload.data?.buy;
  if(!Array.isArray(rows)) throw new Error("OKX schema changed: book is not an array");
  return rows.slice(0,20).map((row:any,index:number)=>({exchange:"OKX",asset,fiat,side,externalAdId:String(row.id??row.publicUserId??index),price:asNum(row.price),availableAsset:asNum(row.availableAmount??row.quantity),minFiat:asNum(row.quoteMinAmountPerOrder)||null,maxFiat:asNum(row.quoteMaxAmountPerOrder)||null,paymentMethods:(row.paymentMethods??row.paymentMethod??[]).map?.(String)??[],merchantName:row.nickName??row.merchantName??null,merchantVerified:Boolean(row.merchantId),completionRate:asNum(row.completedRate)||null,completedOrders:Math.round(asNum(row.completedOrderQuantity))||null,observedAt:new Date().toISOString(),latencyMs:Date.now()-started,schemaVersion:"okx-c2c-v3",rawFingerprint:fingerprint(row)})).filter((a:CapturedAd)=>a.price>0&&a.availableAsset>0);
}

export const EXCHANGES = [
  {name:"Binance",fetch:fetchBinanceBook},{name:"Bybit",fetch:fetchBybitBook},{name:"OKX",fetch:fetchOkxBook},
] as const;
