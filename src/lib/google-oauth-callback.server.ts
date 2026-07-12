import {createServerOnlyFn} from "@tanstack/react-start";
import {createRemoteJWKSet,jwtVerify} from "jose";
import {deleteCookie,getCookie} from "@tanstack/react-start/server";
import {createSession,normalizeEmail} from "./auth/core.server";

export const handleGoogleCallback=createServerOnlyFn(async(request:Request)=>{
  const origin=new URL(request.url).origin;
  const clear=()=>{const o={path:"/auth/callback"};deleteCookie("oauth_state",o);deleteCookie("oauth_nonce",o);deleteCookie("oauth_verifier",o);};
  const fail=(reason:string)=>{clear();return Response.redirect(`${origin}/auth?oauth_error=${encodeURIComponent(reason)}`,302);};
  const url=new URL(request.url),code=url.searchParams.get("code"),state=url.searchParams.get("state"),expected=getCookie("oauth_state"),verifier=getCookie("oauth_verifier"),nonce=getCookie("oauth_nonce");
  if(!code||!state||!expected||state!==expected||!verifier||!nonce)return fail("Invalid or expired OAuth request");
  const clientId=process.env.GOOGLE_CLIENT_ID,clientSecret=process.env.GOOGLE_CLIENT_SECRET;if(!clientId||!clientSecret)return fail("Google OAuth is not configured");
  const response=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({code,client_id:clientId,client_secret:clientSecret,redirect_uri:`${origin}/auth/callback`,grant_type:"authorization_code",code_verifier:verifier})});if(!response.ok)return fail("Google sign-in failed");
  const{id_token:idToken}=await response.json() as{id_token?:string};if(!idToken)return fail("Google did not return an identity");let claims;try{({payload:claims}=await jwtVerify(idToken,createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs")),{issuer:["https://accounts.google.com","accounts.google.com"],audience:clientId}));}catch{return fail("Google identity validation failed");}
  if(claims.nonce!==nonce||!claims.sub||typeof claims.email!=="string"||claims.email_verified!==true)return fail("Google email is not verified");
  const email=normalizeEmail(claims.email),{supabaseAdmin:raw}=await import("@/integrations/supabase/client.server"),db=raw as any;const{data:identity}=await db.from("auth_identities").select("user_id").eq("provider","google").eq("provider_subject",claims.sub).maybeSingle();let userId=identity?.user_id;
  if(!userId){let{data:user}=await db.from("app_users").select("id").eq("email",email).maybeSingle();if(!user){const inserted=await db.from("app_users").insert({email,display_name:typeof claims.name==="string"?claims.name:email}).select("id").single();if(inserted.error)return fail("Could not create account");user=inserted.data;await db.from("profiles").upsert({user_id:user.id,display_name:typeof claims.name==="string"?claims.name:email});await db.from("user_roles").upsert({user_id:user.id,role:"user"});}userId=user.id;const linked=await db.from("auth_identities").insert({user_id:userId,provider:"google",provider_subject:claims.sub,provider_email:email,metadata:claims});if(linked.error&&linked.error.code!=="23505")return fail("Could not link Google account");}
  clear();await createSession(userId);return Response.redirect(`${origin}/dashboard`,302);
});
