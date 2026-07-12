import {createFileRoute,Link} from "@tanstack/react-router";
import {handleGoogleCallback} from "@/lib/google-oauth-callback.server";
export const Route=createFileRoute("/auth/callback")({server:{handlers:{GET:async({request})=>handleGoogleCallback(request)}},component:()=> <div className="min-h-screen grid place-items-center"><p>Authentication callback unavailable. <Link to="/auth">Return to sign in</Link></p></div>});
