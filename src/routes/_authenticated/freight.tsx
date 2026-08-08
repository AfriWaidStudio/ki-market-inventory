import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Badge, StatCard } from "@/components/StatCard";
import { Btn, EmptyState, Section, TabBar, downloadCsv, inputCls } from "@/components/ModuleUI";
import { fmtMoney, fmtNumber, fmtPercent } from "@/lib/currency";
import { freshnessLabel, freshnessTone } from "@/lib/freshness";
import { EQUIPMENT, FREIGHT_MODES } from "@/lib/freight";
import {
  listFreightLanes,
  addFreightLane,
  removeFreightLane,
  recordFreightRate,
  saveDutyProfile,
  quoteLane,
} from "@/lib/freight.functions";

export const Route = createFileRoute("/_authenticated/freight")({
  head: () => ({
    meta: [
      { title: "Freight & Landed Cost — Waides KI" },
      {
        name: "description",
        content:
          "Rank carriers by true landed cost: base rate, surcharges, insurance, duty and VAT, with cost per day saved.",
      },
      { property: "og:title", content: "Freight & Landed Cost — Waides KI" },
      {
        property: "og:description",
        content: "Lane rates, duty profiles and landed-cost ranking for every shipment.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FreightPage,
});

type Tab = "quote" | "lanes" | "rates" | "duties";

const TABS = [
  { value: "quote", label: "Landed cost" },
  { value: "lanes", label: "Lanes" },
  { value: "rates", label: "Record rate" },
  { value: "duties", label: "Duty profiles" },
] as const;

function FreightPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listFreightLanes);
  const addLaneFn = useServerFn(addFreightLane);
  const removeLaneFn = useServerFn(removeFreightLane);
  const rateFn = useServerFn(recordFreightRate);
  const dutyFn = useServerFn(saveDutyProfile);
  const quoteFn = useServerFn(quoteLane);

  const [tab, setTab] = useState<Tab>("quote");
  const [laneId, setLaneId] = useState<string>("");
  const [cargoValue, setCargoValue] = useState(20000);
  const [insurance, setInsurance] = useState(200);
  const [units, setUnits] = useState(500);
  const [hsCode, setHsCode] = useState("");
  const [destCountry, setDestCountry] = useState("");
  const [modeFilter, setModeFilter] = useState("all");

  const lanes = useQuery({ queryKey: ["freight"], queryFn: () => listFn() });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["freight"] });
    qc.invalidateQueries({ queryKey: ["freight-quote"] });
  };

  const laneRows = lanes.data?.lanes ?? [];
  const activeLaneId = laneId || laneRows[0]?.lane.id || "";

  const quote = useQuery({
    queryKey: ["freight-quote", activeLaneId, cargoValue, insurance, units, hsCode, destCountry],
    enabled: Boolean(activeLaneId),
    queryFn: () =>
      quoteFn({
        data: {
          lane_id: activeLaneId,
          cargo_value: cargoValue,
          insurance,
          units,
          hs_code: hsCode || null,
          destination_country: destCountry || null,
        },
      }),
  });

  const ranked = quote.data?.ranked ?? [];
  const best = ranked[0];

  const filteredLanes = useMemo(
    () => laneRows.filter((l) => (modeFilter === "all" ? true : l.lane.mode === modeFilter)),
    [laneRows, modeFilter],
  );

  const spread = useMemo(() => {
    if (ranked.length < 2) return 0;
    return ranked[ranked.length - 1].landed.totalLanded - ranked[0].landed.totalLanded;
  }, [ranked]);

  return (
    <AppShell title="Freight Intelligence">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Lanes tracked" value={String(laneRows.length)} />
          <StatCard
            label="Carrier quotes"
            value={String(laneRows.reduce((a, l) => a + l.rates.length, 0))}
          />
          <StatCard
            label="Cheapest landed"
            value={best ? fmtMoney(best.landed.totalLanded, best.rate.currency) : "—"}
            tone="profit"
          />
          <StatCard
            label="Carrier spread"
            value={best ? fmtMoney(spread, best.rate.currency) : "—"}
            tone={spread > 0 ? "warning" : "default"}
            hint="Cheapest vs most expensive"
          />
          <StatCard
            label="Cost per unit"
            value={best?.landed.costPerUnit != null ? fmtNumber(best.landed.costPerUnit) : "—"}
          />
        </div>

        <TabBar tabs={TABS} value={tab} onChange={setTab} />

        {tab === "quote" && (
          <>
            <Section title="Shipment inputs" description="CIF basis: cargo + freight + insurance, then duty and VAT.">
              <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                <select className={inputCls} value={activeLaneId} onChange={(e) => setLaneId(e.target.value)}>
                  {laneRows.map((l) => (
                    <option key={l.lane.id} value={l.lane.id}>
                      {l.lane.origin} → {l.lane.destination} ({l.lane.mode})
                    </option>
                  ))}
                </select>
                <input className={inputCls} type="number" value={cargoValue} onChange={(e) => setCargoValue(Number(e.target.value))} placeholder="Cargo value" />
                <input className={inputCls} type="number" value={insurance} onChange={(e) => setInsurance(Number(e.target.value))} placeholder="Insurance" />
                <input className={inputCls} type="number" value={units} onChange={(e) => setUnits(Number(e.target.value))} placeholder="Units" />
                <input className={inputCls} value={hsCode} onChange={(e) => setHsCode(e.target.value)} placeholder="HS code" />
                <input className={inputCls} value={destCountry} onChange={(e) => setDestCountry(e.target.value)} placeholder="Destination country" />
              </div>
            </Section>

            <Section
              title="Carrier ranking"
              description="Ranked on landed cost, with the premium you pay per day saved."
              actions={
                <Btn
                  variant="ghost"
                  onClick={() =>
                    downloadCsv(
                      "freight-ranking.csv",
                      ranked.map((r) => ({
                        carrier: r.rate.carrier,
                        base_rate: r.rate.base_rate,
                        surcharges: r.rate.surcharges,
                        transit_days: r.rate.transit_days ?? "",
                        freight_total: r.landed.freightTotal,
                        duty: r.landed.duty,
                        vat: r.landed.vat,
                        total_landed: r.landed.totalLanded,
                        vs_cheapest: r.vsCheapest,
                      })),
                    )
                  }
                >
                  Export CSV
                </Btn>
              }
            >
              {!activeLaneId ? (
                <EmptyState title="Add a lane first" />
              ) : quote.isLoading ? (
                <EmptyState title="Calculating landed cost…" />
              ) : ranked.length === 0 ? (
                <EmptyState title="No carrier rates on this lane yet" hint="Record a rate on the Record rate tab." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                      <tr className="border-b border-border">
                        <th className="py-2 text-left">#</th>
                        <th className="py-2 text-left">Carrier</th>
                        <th className="py-2 text-right">Freight</th>
                        <th className="py-2 text-right">Duty+VAT</th>
                        <th className="py-2 text-right">Landed</th>
                        <th className="py-2 text-right">Per unit</th>
                        <th className="py-2 text-right">Transit</th>
                        <th className="py-2 text-right">Δ cheapest</th>
                        <th className="py-2 text-left">Flags</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ranked.map((r) => (
                        <tr key={r.rate.id} className="border-b border-border/50">
                          <td className="py-2 text-muted-foreground">{r.rank}</td>
                          <td className="py-2">{r.rate.carrier}</td>
                          <td className="py-2 text-right tabular-nums">
                            {fmtMoney(r.landed.freightTotal, r.rate.currency)}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {fmtMoney(r.landed.duty + r.landed.vat + r.landed.otherFees, r.rate.currency)}
                          </td>
                          <td className="py-2 text-right tabular-nums font-medium">
                            {fmtMoney(r.landed.totalLanded, r.rate.currency)}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {r.landed.costPerUnit != null ? fmtNumber(r.landed.costPerUnit) : "—"}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {r.rate.transit_days ?? "—"}d
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {r.vsCheapest === 0 ? "—" : `+${fmtNumber(r.vsCheapest)}`}
                          </td>
                          <td className="py-2">
                            <div className="flex flex-wrap gap-1">
                              {r.rank === 1 && <Badge tone="profit">Cheapest</Badge>}
                              {r.daysVsFastest === 0 && <Badge tone="info">Fastest</Badge>}
                              {r.expired && <Badge tone="loss">Expired</Badge>}
                              {r.costPerDaySaved != null && (
                                <Badge tone="warning">
                                  {fmtNumber(r.costPerDaySaved)}/day saved
                                </Badge>
                              )}
                              <Badge tone={freshnessTone(r.rate.observed_at)}>
                                {freshnessLabel(r.rate.observed_at)}
                              </Badge>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {best && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <StatCard label="Freight share" value={fmtPercent(best.landed.freightSharePct)} />
                      <StatCard label="Tax share" value={fmtPercent(best.landed.taxSharePct)} />
                      <StatCard
                        label="CIF value"
                        value={fmtMoney(best.landed.cifValue, best.rate.currency)}
                      />
                    </div>
                  )}
                </div>
              )}
            </Section>
          </>
        )}

        {tab === "lanes" && (
          <div className="grid gap-4 lg:grid-cols-3">
            <Section title="Add lane" className="lg:col-span-1">
              <LaneForm
                onSubmit={async (v) => {
                  try {
                    await addLaneFn({ data: v });
                    toast.success("Lane added");
                    invalidate();
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
              />
            </Section>
            <Section
              title="Lane book"
              className="lg:col-span-2"
              actions={
                <select className={`${inputCls} w-32`} value={modeFilter} onChange={(e) => setModeFilter(e.target.value)}>
                  <option value="all">All modes</option>
                  {FREIGHT_MODES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              }
            >
              {filteredLanes.length === 0 ? (
                <EmptyState title="No lanes yet" />
              ) : (
                <div className="space-y-2">
                  {filteredLanes.map((l) => (
                    <div
                      key={l.lane.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                    >
                      <div>
                        <div className="text-sm font-medium">
                          {l.lane.origin} → {l.lane.destination}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {l.lane.mode} · {l.lane.equipment} · {l.rates.length} carriers ·{" "}
                          {l.observations} observations
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Btn
                          variant="ghost"
                          onClick={() => {
                            setLaneId(l.lane.id);
                            setTab("quote");
                          }}
                        >
                          Quote
                        </Btn>
                        <Btn
                          variant="danger"
                          onClick={async () => {
                            await removeLaneFn({ data: { id: l.lane.id } });
                            invalidate();
                          }}
                        >
                          Remove
                        </Btn>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>
        )}

        {tab === "rates" && (
          <Section title="Record carrier rate" description="Newest observation per carrier wins the ranking.">
            <RateForm
              lanes={laneRows.map((l) => ({
                id: l.lane.id,
                label: `${l.lane.origin} → ${l.lane.destination}`,
              }))}
              onSubmit={async (v) => {
                try {
                  await rateFn({ data: v });
                  toast.success("Rate recorded");
                  invalidate();
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            />
          </Section>
        )}

        {tab === "duties" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="Save duty profile" description="HS code + destination decides duty, VAT and other fees.">
              <DutyForm
                onSubmit={async (v) => {
                  try {
                    await dutyFn({ data: v });
                    toast.success("Duty profile saved");
                    invalidate();
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
              />
            </Section>
            <Section title="Saved profiles">
              {(lanes.data?.duties ?? []).length === 0 ? (
                <EmptyState title="No duty profiles yet" />
              ) : (
                <div className="space-y-2">
                  {(lanes.data?.duties ?? []).map((d, i) => (
                    <div
                      key={`${d.hs_code}-${i}`}
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <span>
                        {d.hs_code} · {d.destination_country}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        duty {fmtPercent(Number(d.duty_pct))} · VAT {fmtPercent(Number(d.vat_pct))} ·
                        other {fmtPercent(Number(d.other_fees_pct))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function LaneForm({
  onSubmit,
}: {
  onSubmit: (v: { origin: string; destination: string; mode: string; equipment: string }) => void;
}) {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [mode, setMode] = useState(FREIGHT_MODES[0]);
  const [equipment, setEquipment] = useState(EQUIPMENT[0]);
  return (
    <div className="space-y-3">
      <input className={inputCls} placeholder="Origin (e.g. Shenzhen)" value={origin} onChange={(e) => setOrigin(e.target.value)} />
      <input className={inputCls} placeholder="Destination (e.g. Lagos)" value={destination} onChange={(e) => setDestination(e.target.value)} />
      <select className={inputCls} value={mode} onChange={(e) => setMode(e.target.value)}>
        {FREIGHT_MODES.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <select className={inputCls} value={equipment} onChange={(e) => setEquipment(e.target.value)}>
        {EQUIPMENT.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <Btn
        disabled={!origin.trim() || !destination.trim()}
        onClick={() => onSubmit({ origin: origin.trim(), destination: destination.trim(), mode, equipment })}
      >
        Add lane
      </Btn>
    </div>
  );
}

function RateForm({
  lanes,
  onSubmit,
}: {
  lanes: { id: string; label: string }[];
  onSubmit: (v: {
    lane_id: string;
    carrier: string;
    base_rate: number;
    currency: string;
    surcharges: number;
    transit_days: number | null;
    valid_until: string | null;
  }) => void;
}) {
  const [laneId, setLaneId] = useState(lanes[0]?.id ?? "");
  const [carrier, setCarrier] = useState("");
  const [base, setBase] = useState(0);
  const [currency, setCurrency] = useState("USD");
  const [surcharges, setSurcharges] = useState(0);
  const [transit, setTransit] = useState(30);
  const [validUntil, setValidUntil] = useState("");

  if (!lanes.length) return <EmptyState title="Add a lane first" />;

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <select className={inputCls} value={laneId} onChange={(e) => setLaneId(e.target.value)}>
        {lanes.map((l) => (
          <option key={l.id} value={l.id}>
            {l.label}
          </option>
        ))}
      </select>
      <input className={inputCls} placeholder="Carrier" value={carrier} onChange={(e) => setCarrier(e.target.value)} />
      <input className={inputCls} type="number" placeholder="Base rate" value={base} onChange={(e) => setBase(Number(e.target.value))} />
      <input className={inputCls} placeholder="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)} />
      <input className={inputCls} type="number" placeholder="Surcharges" value={surcharges} onChange={(e) => setSurcharges(Number(e.target.value))} />
      <input className={inputCls} type="number" placeholder="Transit days" value={transit} onChange={(e) => setTransit(Number(e.target.value))} />
      <input className={inputCls} type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
      <div className="md:col-span-3">
        <Btn
          disabled={!carrier.trim() || base <= 0}
          onClick={() =>
            onSubmit({
              lane_id: laneId,
              carrier: carrier.trim(),
              base_rate: base,
              currency,
              surcharges,
              transit_days: transit,
              valid_until: validUntil || null,
            })
          }
        >
          Record rate
        </Btn>
      </div>
    </div>
  );
}

function DutyForm({
  onSubmit,
}: {
  onSubmit: (v: {
    hs_code: string;
    description: string | null;
    destination_country: string;
    duty_pct: number;
    vat_pct: number;
    other_fees_pct: number;
  }) => void;
}) {
  const [hs, setHs] = useState("");
  const [desc, setDesc] = useState("");
  const [country, setCountry] = useState("");
  const [duty, setDuty] = useState(10);
  const [vat, setVat] = useState(7.5);
  const [other, setOther] = useState(2);
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <input className={inputCls} placeholder="HS code" value={hs} onChange={(e) => setHs(e.target.value)} />
      <input className={inputCls} placeholder="Destination country" value={country} onChange={(e) => setCountry(e.target.value)} />
      <input className={inputCls} placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} />
      <input className={inputCls} type="number" placeholder="Duty %" value={duty} onChange={(e) => setDuty(Number(e.target.value))} />
      <input className={inputCls} type="number" placeholder="VAT %" value={vat} onChange={(e) => setVat(Number(e.target.value))} />
      <input className={inputCls} type="number" placeholder="Other fees %" value={other} onChange={(e) => setOther(Number(e.target.value))} />
      <div className="md:col-span-2">
        <Btn
          disabled={hs.trim().length < 2 || country.trim().length < 2}
          onClick={() =>
            onSubmit({
              hs_code: hs.trim(),
              description: desc || null,
              destination_country: country.trim(),
              duty_pct: duty / 100,
              vat_pct: vat / 100,
              other_fees_pct: other / 100,
            })
          }
        >
          Save profile
        </Btn>
      </div>
    </div>
  );
}
