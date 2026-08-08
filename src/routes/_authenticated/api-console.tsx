import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Badge, StatCard } from "@/components/StatCard";
import { Btn, EmptyState, Section, TabBar, downloadCsv, inputCls } from "@/components/ModuleUI";
import { fmtNumber } from "@/lib/currency";
import {
  API_SCOPES,
  listApiClients,
  createApiClient,
  revokeApiClient,
  deleteApiClient,
} from "@/lib/dataapi.functions";

export const Route = createFileRoute("/_authenticated/api-console")({
  head: () => ({
    meta: [
      { title: "Data API Console — Waides KI" },
      {
        name: "description",
        content:
          "Mint scoped API keys, set rate limits and watch usage for the Waides market-data API.",
      },
      { property: "og:title", content: "Data API Console — Waides KI" },
      {
        property: "og:description",
        content: "Scoped keys, rate limits, usage analytics and copy-paste examples.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ApiConsolePage,
});

type Tab = "keys" | "create" | "usage" | "docs";

const TABS = [
  { value: "keys", label: "Keys" },
  { value: "create", label: "Create key" },
  { value: "usage", label: "Usage" },
  { value: "docs", label: "Docs" },
] as const;

function ApiConsolePage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listApiClients);
  const createFn = useServerFn(createApiClient);
  const revokeFn = useServerFn(revokeApiClient);
  const deleteFn = useServerFn(deleteApiClient);

  const [tab, setTab] = useState<Tab>("keys");
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["p2p.read"]);
  const [rateLimit, setRateLimit] = useState(60);
  const [freshKey, setFreshKey] = useState<string | null>(null);

  const clients = useQuery({ queryKey: ["api-clients"], queryFn: () => listFn() });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["api-clients"] });

  const rows = clients.data?.clients ?? [];
  const calls = clients.data?.recentCalls ?? [];
  const totalCalls = rows.reduce((a, c) => a + c.calls_24h, 0);
  const totalErrors = rows.reduce((a, c) => a + c.errors_24h, 0);

  const create = useMutation({
    mutationFn: () => createFn({ data: { name, scopes, rate_limit_per_min: rateLimit } }),
    onSuccess: (r) => {
      setFreshKey(r.key);
      setName("");
      toast.success("Key created — copy it now, it is shown once");
      invalidate();
      setTab("keys");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell title="Data API">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Active keys" value={String(rows.filter((c) => c.is_active).length)} />
          <StatCard label="Calls (24h)" value={String(totalCalls)} />
          <StatCard
            label="Errors (24h)"
            value={String(totalErrors)}
            tone={totalErrors > 0 ? "loss" : "profit"}
          />
          <StatCard
            label="Avg latency"
            value={
              rows.some((c) => c.avg_ms)
                ? `${fmtNumber(
                    rows.filter((c) => c.avg_ms).reduce((a, c) => a + (c.avg_ms ?? 0), 0) /
                      Math.max(1, rows.filter((c) => c.avg_ms).length),
                    0,
                  )} ms`
                : "—"
            }
          />
        </div>

        {freshKey && (
          <div className="rounded-xl border border-primary/40 bg-primary/5 p-4">
            <div className="text-xs uppercase tracking-widest text-primary">New key — shown once</div>
            <code className="mt-2 block break-all rounded-md bg-background px-3 py-2 font-mono text-xs">
              {freshKey}
            </code>
            <div className="mt-2 flex gap-2">
              <Btn
                onClick={() => {
                  void navigator.clipboard.writeText(freshKey);
                  toast.success("Copied");
                }}
              >
                Copy
              </Btn>
              <Btn variant="ghost" onClick={() => setFreshKey(null)}>
                Dismiss
              </Btn>
            </div>
          </div>
        )}

        <TabBar tabs={TABS} value={tab} onChange={setTab} />

        {tab === "keys" && (
          <Section title="API keys" description="Only the hash is stored — a leak cannot be replayed.">
            {clients.isLoading ? (
              <EmptyState title="Loading keys…" />
            ) : rows.length === 0 ? (
              <EmptyState title="No API keys yet" hint="Create one on the Create key tab." />
            ) : (
              <div className="space-y-2">
                {rows.map((c) => (
                  <div
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                  >
                    <div>
                      <div className="text-sm font-medium">{c.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {c.key_prefix}••••••• · {c.rate_limit_per_min}/min ·{" "}
                        {(c.scopes ?? []).join(", ")}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={c.is_active ? "profit" : "default"}>
                        {c.is_active ? "active" : "revoked"}
                      </Badge>
                      <Badge tone={c.errors_24h > 0 ? "loss" : "info"}>
                        {c.calls_24h} calls · {c.errors_24h} err
                      </Badge>
                      {c.is_active && (
                        <Btn
                          variant="ghost"
                          onClick={async () => {
                            await revokeFn({ data: { id: c.id } });
                            invalidate();
                          }}
                        >
                          Revoke
                        </Btn>
                      )}
                      <Btn
                        variant="danger"
                        onClick={async () => {
                          await deleteFn({ data: { id: c.id } });
                          invalidate();
                        }}
                      >
                        Delete
                      </Btn>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        {tab === "create" && (
          <Section title="Create key" description="Scope keys tightly — one purpose per key.">
            <div className="grid gap-3 md:grid-cols-2">
              <input
                className={inputCls}
                placeholder="Key name (e.g. Pricing widget)"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <label className="text-xs text-muted-foreground">
                Rate limit: {rateLimit} req/min
                <input
                  type="range"
                  min={10}
                  max={600}
                  step={10}
                  value={rateLimit}
                  onChange={(e) => setRateLimit(Number(e.target.value))}
                  className="mt-1 w-full"
                />
              </label>
              <div className="md:col-span-2 space-y-2">
                {API_SCOPES.map((s) => (
                  <label
                    key={s.value}
                    className="flex items-start gap-2 rounded-lg border border-border px-3 py-2"
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={scopes.includes(s.value)}
                      onChange={(e) =>
                        setScopes((prev) =>
                          e.target.checked
                            ? [...prev, s.value]
                            : prev.filter((x) => x !== s.value),
                        )
                      }
                    />
                    <span>
                      <span className="text-sm">{s.label}</span>
                      <span className="block text-xs text-muted-foreground">{s.description}</span>
                    </span>
                  </label>
                ))}
              </div>
              <div className="md:col-span-2">
                <Btn
                  disabled={!name.trim() || scopes.length === 0 || create.isPending}
                  onClick={() => create.mutate()}
                >
                  {create.isPending ? "Minting…" : "Create key"}
                </Btn>
              </div>
            </div>
          </Section>
        )}

        {tab === "usage" && (
          <Section
            title="Recent calls"
            actions={
              <Btn
                variant="ghost"
                onClick={() =>
                  downloadCsv(
                    "api-usage.csv",
                    calls.map((c) => ({
                      endpoint: c.endpoint,
                      status: c.status_code,
                      ms: c.response_ms ?? "",
                      at: c.called_at,
                    })),
                  )
                }
              >
                Export CSV
              </Btn>
            }
          >
            {calls.length === 0 ? (
              <EmptyState title="No API traffic yet" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="py-2 text-left">Endpoint</th>
                      <th className="py-2 text-right">Status</th>
                      <th className="py-2 text-right">Latency</th>
                      <th className="py-2 text-right">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calls.map((c, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-2 font-mono text-xs">{c.endpoint}</td>
                        <td className="py-2 text-right">
                          <Badge tone={c.status_code >= 400 ? "loss" : "profit"}>
                            {c.status_code}
                          </Badge>
                        </td>
                        <td className="py-2 text-right tabular-nums">{c.response_ms ?? "—"} ms</td>
                        <td className="py-2 text-right text-xs text-muted-foreground">
                          {new Date(c.called_at as string).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        )}

        {tab === "docs" && (
          <Section title="Quick start" description="One endpoint, scoped by key, rate limited per minute.">
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Send your key in the <code className="font-mono">x-api-key</code> header. The
                response returns only the datasets your key is scoped for.
              </p>
              <pre className="overflow-x-auto rounded-lg bg-background p-3 font-mono text-xs">
{`curl -H "x-api-key: smk_live_..." \\
  "${typeof window !== "undefined" ? window.location.origin : ""}/api/public/v1/data?dataset=p2p&asset=USDT&fiat=NGN"`}
              </pre>
              <div className="grid gap-2 sm:grid-cols-2">
                {API_SCOPES.map((s) => (
                  <div key={s.value} className="rounded-lg border border-border px-3 py-2">
                    <div className="font-mono text-xs text-primary">{s.value}</div>
                    <div className="text-xs text-muted-foreground">{s.description}</div>
                  </div>
                ))}
              </div>
            </div>
          </Section>
        )}
      </div>
    </AppShell>
  );
}
