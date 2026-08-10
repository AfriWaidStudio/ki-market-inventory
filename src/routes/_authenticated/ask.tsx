import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { EmptyState, inputCls } from "@/components/ModuleUI";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/ask")({
  head: () => ({
    meta: [
      { title: "Ask Sabi — your money assistant" },
      { name: "description", content: "Ask about prices, medicine, work or your shop and get a plain answer." },
      { property: "og:title", content: "Ask Sabi — your money assistant" },
      { property: "og:description", content: "Plain answers, grounded in real prices and your own records." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AskPage,
});

function AskPage() {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setToken(data.session?.access_token ?? null));
  }, []);

  return token ? (
    <AskUI token={token} />
  ) : (
    <AppShell title="Ask Sabi">
      <EmptyState title="Loading…" />
    </AppShell>
  );
}

function AskUI({ token }: { token: string }) {
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat", headers: { Authorization: `Bearer ${token}` } }),
    [token],
  );
  const { messages, sendMessage, status } = useChat({ transport });
  const [input, setInput] = useState("");

  const suggestions = [
    "Where is rice cheapest near me?",
    "Which pharmacy has my medicine in stock?",
    "What job pays best per hour?",
    "How much profit did my shop make today?",
  ];

  return (
    <AppShell title="Ask Sabi" subtitle="Plain answers from real numbers">
      <div className="mx-auto flex h-[70vh] max-w-2xl flex-col rounded-2xl border border-border bg-card">
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Ask me anything about your money. For example:</p>
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage({ text: s })}
                  className="block w-full rounded-xl border border-border px-3 py-2 text-left text-sm hover:border-primary"
                >
                  {s}
                </button>
              ))}
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={
                  m.role === "user"
                    ? "ml-auto max-w-[85%] rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground"
                    : "mr-auto max-w-[85%] rounded-2xl bg-muted px-3 py-2 text-sm whitespace-pre-wrap"
                }
              >
                {m.parts
                  .map((p) => (p.type === "text" ? p.text : ""))
                  .join("")}
              </div>
            ))
          )}
          {status === "streaming" && <div className="text-xs text-muted-foreground">Sabi is thinking…</div>}
        </div>
        <form
          className="flex gap-2 border-t border-border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!input.trim()) return;
            sendMessage({ text: input });
            setInput("");
          }}
        >
          <input
            className={inputCls}
            placeholder="Ask about prices, medicine, work or your shop"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            disabled={status === "streaming"}
          >
            Send
          </button>
        </form>
      </div>
    </AppShell>
  );
}
