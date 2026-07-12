import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Trash2, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/StatCard";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";
import { useAuth } from "@/lib/auth";
import { getProfile, updateProfile } from "@/lib/profile.functions";
import {
  listApiKeys,
  createApiKey,
  deleteApiKey,
  listAuditLog,
  listExchangeAccounts,
  addExchangeAccount,
  deleteExchangeAccount,
  syncExchangeAccount,
  getSyncStatus,
} from "@/lib/apiKeys.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — KI Market Inventory" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const profileFn = useServerFn(getProfile);
  const updateProfileFn = useServerFn(updateProfile);
  const listKeysFn = useServerFn(listApiKeys);
  const createKeyFn = useServerFn(createApiKey);
  const deleteKeyFn = useServerFn(deleteApiKey);
  const auditFn = useServerFn(listAuditLog);
  const listAccountsFn = useServerFn(listExchangeAccounts);
  const addAccountFn = useServerFn(addExchangeAccount);
  const deleteAccountFn = useServerFn(deleteExchangeAccount);
  const syncFn = useServerFn(syncExchangeAccount);
  const syncStatusFn = useServerFn(getSyncStatus);

  const profile = useQuery({ queryKey: ["profile"], queryFn: () => profileFn() });
  const keys = useQuery({ queryKey: ["api-keys"], queryFn: () => listKeysFn() });
  const audit = useQuery({ queryKey: ["audit"], queryFn: () => auditFn() });
  const accounts = useQuery({ queryKey: ["exchange-accounts"], queryFn: () => listAccountsFn() });
  const syncStatus = useQuery({ queryKey: ["sync-status"], queryFn: () => syncStatusFn() });

  const [currency, setCurrency] = useState<string>("");
  const [displayName, setDisplayName] = useState<string>("");
  const [keyExchange, setKeyExchange] = useState("Binance");
  const [keyLabel, setKeyLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [readOnlyAck, setReadOnlyAck] = useState(false);
  const [acctExchange, setAcctExchange] = useState("Binance");
  const [acctLabel, setAcctLabel] = useState("");

  const saveProfile = useMutation({
    mutationFn: () => updateProfileFn({ data: { display_name: displayName || null, preferred_currency: currency || undefined } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["profile"] }); toast.success("Profile saved"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const createKey = useMutation({
    mutationFn: () => createKeyFn({ data: { exchange: keyExchange, key_label: keyLabel, api_key: apiKey, api_secret: apiSecret } }),
    onSuccess: () => {
      setKeyLabel(""); setApiKey(""); setApiSecret(""); setReadOnlyAck(false);
      qc.invalidateQueries({ queryKey: ["api-keys"] }); qc.invalidateQueries({ queryKey: ["audit"] });
      toast.success("API key encrypted and stored");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const removeKey = useMutation({
    mutationFn: (id: string) => deleteKeyFn({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["api-keys"] }); qc.invalidateQueries({ queryKey: ["audit"] }); toast.success("Deleted"); },
  });
  const addAccount = useMutation({
    mutationFn: () => addAccountFn({ data: { exchange: acctExchange, label: acctLabel || null } }),
    onSuccess: () => { setAcctLabel(""); qc.invalidateQueries({ queryKey: ["exchange-accounts"] }); toast.success("Added"); },
  });
  const deleteAccount = useMutation({
    mutationFn: (id: string) => deleteAccountFn({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["exchange-accounts"] }); toast.success("Deleted"); },
  });
  const syncAccount = useMutation({
    mutationFn: (id: string) => syncFn({ data: { account_id: id } }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["sync-status"] });
      toast.success(`Synced ${res.imported} transactions`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Sync failed"),
  });

  const p = profile.data;
  const displayValue = displayName || (p?.display_name ?? "");
  const currencyValue = currency || (p?.preferred_currency ?? "NGN");

  return (
    <AppShell title="Settings">
      <SmaiIdCard />
      <div className="grid gap-6 lg:grid-cols-2 mt-6">
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Profile</h2>
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="text-xs uppercase text-muted-foreground">Display name</span>
              <input value={displayValue} onChange={(e) => setDisplayName(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-input px-3 py-2 text-sm" />
            </label>
            <label className="block">
              <span className="text-xs uppercase text-muted-foreground">Preferred currency</span>
              <select value={currencyValue} onChange={(e) => setCurrency(e.target.value)} className="mt-1 w-full rounded-md border border-input bg-input px-3 py-2 text-sm">
                {SUPPORTED_CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.symbol} {c.name} ({c.code})</option>)}
              </select>
            </label>
            <button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">
              Save profile
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Exchange accounts</h2>
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <select value={acctExchange} onChange={(e) => setAcctExchange(e.target.value)} className="rounded-md border border-input bg-input px-3 py-2 text-sm col-span-1">
                {["Binance","Bybit","OKX","KuCoin","Bitget"].map((x) => <option key={x}>{x}</option>)}
              </select>
              <input value={acctLabel} onChange={(e) => setAcctLabel(e.target.value)} placeholder="Label (optional)" className="rounded-md border border-input bg-input px-3 py-2 text-sm col-span-1" />
              <button onClick={() => addAccount.mutate()} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">Add</button>
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {(accounts.data ?? []).map((a) => (
                <li key={a.id} className="flex items-center justify-between border-b border-border/50 py-1.5">
                  <div>
                    <span>{a.exchange} {a.label && <span className="text-muted-foreground">— {a.label}</span>}</span>
                    <div className="text-xs text-muted-foreground">
                      Last sync: {syncStatus.data?.find(s => s.account_id === a.id)?.completed_at
                        ? new Date(syncStatus.data.find(s => s.account_id === a.id)!.completed_at).toLocaleString()
                        : "never"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => syncAccount.mutate(a.id)} disabled={syncAccount.isPending} className="rounded p-1.5 text-muted-foreground hover:text-primary">
                      <RefreshCw className={`h-4 w-4 ${syncAccount.isPending ? "animate-spin" : ""}`} />
                    </button>
                    <button onClick={() => deleteAccount.mutate(a.id)} className="rounded p-1.5 text-muted-foreground hover:text-[color:var(--loss)] hover:bg-muted">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-[color:var(--warning)] mt-0.5 shrink-0" />
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Exchange API keys (read-only)</h2>
              <p className="mt-2 text-sm text-foreground/80">
                Only add API keys with <strong>read-only permissions</strong>. This app will <strong>never</strong> execute trades, transfers, or withdrawals. Do not grant Withdraw or Trade permissions. Keys are AES-256-GCM encrypted at rest.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <select value={keyExchange} onChange={(e) => setKeyExchange(e.target.value)} className="rounded-md border border-input bg-input px-3 py-2 text-sm">
              {["Binance","Bybit","OKX","KuCoin","Bitget"].map((x) => <option key={x}>{x}</option>)}
            </select>
            <input value={keyLabel} onChange={(e) => setKeyLabel(e.target.value)} placeholder="Key label" className="rounded-md border border-input bg-input px-3 py-2 text-sm" />
            <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="API key" className="rounded-md border border-input bg-input px-3 py-2 text-sm" />
            <input value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} placeholder="API secret" type="password" className="rounded-md border border-input bg-input px-3 py-2 text-sm" />
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={readOnlyAck} onChange={(e) => setReadOnlyAck(e.target.checked)} />
            I confirm this key has <strong>read-only</strong> permissions — no trade, no withdraw.
          </label>
          <button
            onClick={() => createKey.mutate()}
            disabled={!readOnlyAck || !keyLabel || !apiKey || !apiSecret || createKey.isPending}
            className="mt-3 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {createKey.isPending ? "Encrypting…" : "Add read-only key"}
          </button>

          <ul className="mt-5 divide-y divide-border">
            {(keys.data ?? []).map((k) => (
              <li key={k.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <div className="font-medium">{k.exchange} · {k.key_label}</div>
                  <div className="text-xs text-muted-foreground">Added {new Date(k.created_at as string).toLocaleString()}</div>
                </div>
                <Badge tone="info">{k.permissions}</Badge>
              </li>
            ))}
            {(keys.data ?? []).length === 0 && <li className="py-3 text-sm text-muted-foreground">No API keys yet.</li>}
          </ul>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Sync history</h2>
          <div className="mt-3 max-h-64 overflow-y-auto space-y-1 text-sm">
            {syncStatus.data?.length ? (
              syncStatus.data.map((s) => (
                <div key={s.id} className="flex justify-between border-b border-border/40 py-2">
                  <div>
                    <span className="font-medium">{s.exchange}</span>
                    <div className="text-xs text-muted-foreground">
                      {s.status === "running" ? "Running…" : s.status === "completed" ? "Completed" : "Failed"}
                      {s.records_imported > 0 && ` — ${s.records_imported} transactions`}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(s.started_at).toLocaleString()}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">No sync history yet.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Audit log</h2>
          <div className="mt-3 max-h-64 overflow-y-auto space-y-1 text-xs font-mono">
            {(audit.data ?? []).map((a) => (
              <div key={a.id} className="flex justify-between border-b border-border/40 py-1">
                <span className="text-muted-foreground">{new Date(a.created_at as string).toLocaleString()}</span>
                <span>{a.action}</span>
                <span className="text-muted-foreground truncate max-w-xs">{a.metadata ? JSON.stringify(a.metadata) : ""}</span>
              </div>
            ))}
            {(audit.data ?? []).length === 0 && <p className="text-muted-foreground">No entries.</p>}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function SmaiIdCard() {
  const { user } = useAuth();
  if (!user) return null;
  const verified = user.smaiVerificationStatus === "verified";
  const label = verified ? "Verified by KI" : user.smaiVerificationStatus === "pending" ? "Awaiting KI verification" : user.smaiVerificationStatus === "flagged" ? "Flagged by KI" : "Revoked";
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div>
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Your SmaiID</div>
        <div className="mt-1 font-mono text-xl">{user.smaiId}</div>
        <p className="mt-1 text-xs text-muted-foreground">
          A unique identity KI uses to recognize your account across every surface. Share it with support instead of your email.
        </p>
      </div>
      <div className="flex flex-col items-start md:items-end gap-1">
        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${verified ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${verified ? "bg-emerald-400" : "bg-amber-400"}`} />
          {label}
        </span>
        {user.smaiVerifiedAt && (
          <span className="text-[10px] text-muted-foreground">since {new Date(user.smaiVerifiedAt).toLocaleString()}</span>
        )}
      </div>
    </div>
  );
}
