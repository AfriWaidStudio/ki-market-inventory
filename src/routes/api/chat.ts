import {createFileRoute} from "@tanstack/react-router";
import {getCurrentSession} from "@/lib/auth/core.server";
import {createLovableAiGatewayProvider} from "@/lib/ai-gateway.server";
import {buildKiGrounding,buildKiSystem} from "@/lib/ki-orchestrator.server";
import {convertToModelMessages,streamText,type UIMessage} from "ai";
export const Route=createFileRoute("/api/chat")({server:{handlers:{POST:async({request})=>{const key=process.env.LOVABLE_API_KEY;if(!key)return new Response("Missing LOVABLE_API_KEY",{status:500});const session=await getCurrentSession();if(!session)return new Response("Unauthorized",{status:401});const body=await request.json() as{messages?:unknown};if(!Array.isArray(body.messages))return new Response("Messages required",{status:400});const grounding=await buildKiGrounding(session.user.id),gateway=createLovableAiGatewayProvider(key);const result=streamText({model:gateway("google/gemini-2.5-flash"),system:buildKiSystem(grounding),messages:await convertToModelMessages(body.messages as UIMessage[])});return result.toUIMessageStreamResponse({originalMessages:body.messages as UIMessage[]});}}}});
