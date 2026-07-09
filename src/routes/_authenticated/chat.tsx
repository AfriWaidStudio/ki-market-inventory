import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({ meta: [{ title: "Ask KI — KI Market Inventory" }] }),
  component: ChatPage,
});

function ChatPage() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null));
  }, []);

  return token ? <ChatUI token={token} /> : <AppShell title="Ask Waides KI"><div className="text-muted-foreground">Loading session…</div></AppShell>;
}

function ChatUI({ token }: { token: string }) {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: "/api/chat",
    headers: { Authorization: `Bearer ${token}` },
  });
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const suggestions = [
    "How much have I made today?",
    "Which route is my most profitable?",
    "What time do I trade best?",
    "What is the safest opportunity right now?",
    "Am I profitable overall?",
  ];

  return (
    <AppShell title="Ask Waides KI">
      <div className="flex flex-col h-[calc(100vh-11rem)] rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div>
              <p className="text-sm text-muted-foreground">
                Waides KI answers using your actual tracked trades. It never invents numbers.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      handleInputChange({ target: { value: s } } as React.ChangeEvent<HTMLInputElement>);
                    }}
                    className="rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs hover:bg-muted"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                {m.parts?.map((p, i) => (p.type === "text" ? <span key={i}>{p.text}</span> : null)) ?? m.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-muted px-4 py-2.5 text-sm text-muted-foreground">
                <span className="inline-flex gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "300ms" }} />
                </span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <form onSubmit={handleSubmit} className="border-t border-border p-3 flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            placeholder="Ask about your trades, timing, or opportunities…"
            className="flex-1 rounded-md border border-input bg-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>
    </AppShell>
  );
}
