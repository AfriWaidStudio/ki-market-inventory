import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Btn, EmptyState, Section, TabBar, inputCls } from "@/components/ModuleUI";
import { listBeings, employBeing, runAssembly } from "@/lib/beings.functions";
import { DOMAIN_LABEL, formatOnyix, type BeingDomain } from "@/lib/onyix";

export const Route = createFileRoute("/_authenticated/beings")({
  head: () => ({
    meta: [
      { title: "SmaiBeings — Sabi's real-world workforce" },
      {
        name: "description",
        content:
          "Employ any of the 100 official Sabi SmaiBeings, each commanding 20 TredBeings, and run assemblies that answer real market questions.",
      },
      { property: "og:title", content: "SmaiBeings — Sabi's real-world workforce" },
      { property: "og:description", content: "100 beings, 2,000 TredBeings, one answer. Fuelled by Onyix." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BeingsPage,
});

type Tab = "workforce" | "hired" | "assemblies";

function BeingsPage() {
  const list = useServerFn(listBeings);
  const employ = useServerFn(employBeing);
  const run = useServerFn(runAssembly);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["beings"], queryFn: () => list({ data: {} }) });
  const [tab, setTab] = useState<Tab>("workforce");
  const [domain, setDomain] = useState<BeingDomain | "all">("all");
  const [q, setQ] = useState("");
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);

  const hireMut = useMutation({
    mutationFn: (v: { code: number; hire: boolean }) => employ({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["beings"] }),
  });

  const runMut = useMutation({
    mutationFn: (text: string) => run({ data: { question: text } }),
    onSuccess: () => {
      setError(null);
      setQuestion("");
      qc.invalidateQueries({ queryKey: ["beings"] });
      qc.invalidateQueries({ queryKey: ["onyix"] });
      setTab("assemblies");
    },
    onError: (e: Error) => setError(e.message),
  });

  const beings = data?.beings ?? [];
  const hiredCodes = new Set((data?.employments ?? []).map((e) => e.being_code));

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return beings.filter(
      (b) =>
        (domain === "all" || b.domain === domain) &&
        (!needle || b.name.toLowerCase().includes(needle) || b.purpose.toLowerCase().includes(needle)),
    );
  }, [beings, domain, q]);

  const domains = useMemo(() => Array.from(new Set(beings.map((b) => b.domain))), [beings]);

  return (
    <AppShell title="SmaiBeings" subtitle="Sabi's workforce — created in Waides and Soko, running on the Smaionyix Field">
      <div className="space-y-4">
        <Section
          title="Ask the Field"
          description="A question forms a SmaiAssembly. The beings answer, the Auditor checks them, WaidesPruf records it — and your tank pays for it."
          actions={<span className="text-xs text-muted-foreground">Tank: {formatOnyix(data?.tank ?? 0)}</span>}
        >
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (question.trim().length > 3) runMut.mutate(question.trim());
            }}
          >
            <input
              className={inputCls}
              placeholder="e.g. What is a fair rent for a self-contained in Wuse under ₦800k?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
            <Btn type="submit" disabled={runMut.isPending}>
              {runMut.isPending ? "Assembling…" : "Form assembly"}
            </Btn>
          </form>
          {error && <p className="mt-2 text-xs text-[color:var(--loss)]">{error}</p>}
        </Section>

        <TabBar
          tabs={[
            { value: "workforce", label: `Workforce (${beings.length})` },
            { value: "hired", label: `Employed (${hiredCodes.size})` },
            { value: "assemblies", label: `Assemblies (${data?.assemblies.length ?? 0})` },
          ]}
          value={tab}
          onChange={setTab}
        />

        {isLoading && <EmptyState title="Waking the Field…" />}

        {tab === "workforce" && !isLoading && (
          <Section
            title="100 official SmaiBeings"
            description="Each being commands up to 20 TredBeings — 2,000 specialist workers, none of them idling."
          >
            <div className="flex flex-wrap gap-2">
              <input
                className={`${inputCls} sm:max-w-xs`}
                placeholder="Search beings"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <select
                className={`${inputCls} sm:max-w-[14rem]`}
                value={domain}
                onChange={(e) => setDomain(e.target.value as BeingDomain | "all")}
              >
                <option value="all">All domains</option>
                {domains.map((d) => (
                  <option key={d} value={d}>
                    {DOMAIN_LABEL[d as BeingDomain] ?? d}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {filtered.map((b) => (
                <div key={b.code} className="rounded-xl border border-border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">
                        <span className="text-muted-foreground">#{b.code}</span> {b.name}
                      </div>
                      <div className="text-xs text-muted-foreground">{b.purpose}</div>
                    </div>
                    <Btn
                      variant={hiredCodes.has(b.code) ? "ghost" : "primary"}
                      onClick={() => hireMut.mutate({ code: b.code, hire: !hiredCodes.has(b.code) })}
                    >
                      {hiredCodes.has(b.code) ? "Employed" : "Employ"}
                    </Btn>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                    <span className="rounded bg-muted px-1.5 py-0.5">{DOMAIN_LABEL[b.domain as BeingDomain] ?? b.domain}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5">{b.origin}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5">{Number(b.onyix_cost)} ONX / run</span>
                    <span className="rounded bg-muted px-1.5 py-0.5">{b.tred_beings.length} TredBeings</span>
                    {b.is_commander && <span className="rounded bg-primary/15 px-1.5 py-0.5 text-primary">Commander</span>}
                  </div>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[11px] text-muted-foreground">Show TredBeings</summary>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {b.tred_beings.map((t) => (
                        <span key={t} className="rounded bg-muted px-1.5 py-0.5 text-[10px]">
                          {t}
                        </span>
                      ))}
                    </div>
                  </details>
                </div>
              ))}
            </div>
            {!filtered.length && <EmptyState title="No being matches that" />}
          </Section>
        )}

        {tab === "hired" && !isLoading && (
          <Section title="Your employed beings" description="Employed here, they also appear in Waides mode on Konsmik and can be hired in SokoPlace.">
            {data?.employments.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="py-1.5">Being</th>
                      <th>Runs</th>
                      <th>Onyix spent</th>
                      <th>Employed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.employments.map((e) => {
                      const b = beings.find((x) => x.code === e.being_code);
                      return (
                        <tr key={e.id} className="border-t border-border">
                          <td className="py-1.5">
                            #{e.being_code} {b?.name ?? ""}
                          </td>
                          <td>{e.runs}</td>
                          <td>{formatOnyix(Number(e.onyix_spent))}</td>
                          <td className="text-xs text-muted-foreground">
                            {new Date(e.employed_at).toLocaleDateString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="You have not employed any being yet" hint="Employ one from the workforce tab." />
            )}
          </Section>
        )}

        {tab === "assemblies" && !isLoading && (
          <div className="space-y-3">
            {data?.assemblies.length ? (
              data.assemblies.map((a) => (
                <Section
                  key={a.id}
                  title={a.question}
                  description={`${DOMAIN_LABEL[a.domain as BeingDomain] ?? a.domain} • ${a.being_codes.length} beings • confidence ${Number(a.confidence)}% • ${formatOnyix(Number(a.onyix_consumed))} burned`}
                >
                  <p className="text-sm">{a.answer}</p>
                  <div className="mt-3 space-y-2">
                    {(a.findings as unknown as { being: string; headline: string; detail: string }[]).map((f, i) => (
                      <div key={i} className="rounded-lg border border-border p-2.5">
                        <div className="text-xs font-medium text-primary">{f.being}</div>
                        <div className="text-sm">{f.headline}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">{f.detail}</div>
                      </div>
                    ))}
                  </div>
                </Section>
              ))
            ) : (
              <EmptyState title="No assembly has run yet" hint="Ask the Field above." />
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
