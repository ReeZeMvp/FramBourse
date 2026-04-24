"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, CartesianGrid,
} from "recharts";
import {
  getDividendCalendar,
  getYOC,
  getDividendGrowth,
  getIncomeProjection,
  getDividendConcentration,
  type DividendEvent,
  type YOCRow,
  type GrowthRow,
  type MonthlyIncome,
  type DivConcentration,
} from "@/lib/api";
import { fmtCurrency, MONTHS_FR, cn } from "@/lib/utils";

type Tab = "calendar" | "yoc" | "projection" | "growth" | "risk";

export default function DividendsPage() {
  const [tab, setTab] = useState<Tab>("calendar");
  const [calendar, setCalendar] = useState<DividendEvent[]>([]);
  const [yoc, setYOC] = useState<YOCRow[]>([]);
  const [growth, setGrowth] = useState<GrowthRow[]>([]);
  const [projection, setProjection] = useState<MonthlyIncome[]>([]);
  const [concentration, setConcentration] = useState<DivConcentration | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getDividendCalendar(),
      getYOC(),
      getDividendGrowth(),
      getIncomeProjection(),
      getDividendConcentration(),
    ]).then(([cal, yocData, growthData, proj, conc]) => {
      setCalendar(cal);
      setYOC(yocData);
      setGrowth(growthData);
      setProjection(proj);
      setConcentration(conc);
    }).finally(() => setLoading(false));
  }, []);

  const TABS: { id: Tab; label: string }[] = [
    { id: "calendar", label: "Calendrier" },
    { id: "yoc", label: "YOC vs Rendement" },
    { id: "projection", label: "Projection 12 mois" },
    { id: "growth", label: "Croissance YoY" },
    { id: "risk", label: "Concentration" },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">Dividendes</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Module revenus passifs</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
              tab === t.id
                ? "border-violet-500 text-violet-400"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {tab === "calendar" && <CalendarTab events={calendar} />}
          {tab === "yoc" && <YOCTab rows={yoc} />}
          {tab === "projection" && <ProjectionTab data={projection} />}
          {tab === "growth" && <GrowthTab data={growth} />}
          {tab === "risk" && concentration && <RiskTab data={concentration} />}
        </>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CalendarTab({ events }: { events: DividendEvent[] }) {
  if (!events.length) return <EmptyState message="Aucun dividende à venir trouvé." />;
  return (
    <div className="card overflow-x-auto">
      <h3 className="text-sm font-semibold text-zinc-300 mb-4">Prochains détachements</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-zinc-500 border-b border-zinc-800">
            <th className="pb-2 pr-4">Valeur</th>
            <th className="pb-2 pr-4">Ex-date</th>
            <th className="pb-2 pr-4">Paiement</th>
            <th className="pb-2 pr-4 text-right">€/action</th>
            <th className="pb-2 text-right">Total estimé</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e, i) => (
            <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
              <td className="py-2.5 pr-4 font-medium text-zinc-200 max-w-[200px] truncate">
                {e.holding_name}
              </td>
              <td className="py-2.5 pr-4">
                <span className="badge-violet">{e.ex_date}</span>
              </td>
              <td className="py-2.5 pr-4 text-zinc-400">{e.payment_date ?? "—"}</td>
              <td className="py-2.5 pr-4 text-right font-mono text-zinc-300">
                {e.amount_per_share.toFixed(4)}
              </td>
              <td className="py-2.5 text-right font-mono text-gold-300">
                {e.total_amount ? fmtCurrency(e.total_amount) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function YOCTab({ rows }: { rows: YOCRow[] }) {
  if (!rows.length) return <EmptyState message="Aucune donnée YOC disponible." />;
  return (
    <div className="card overflow-x-auto">
      <h3 className="text-sm font-semibold text-zinc-300 mb-4">
        Yield on Cost (YOC) vs Rendement courant
      </h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-zinc-500 border-b border-zinc-800">
            <th className="pb-2 pr-4">Valeur</th>
            <th className="pb-2 pr-4 text-right">PRU</th>
            <th className="pb-2 pr-4 text-right">Cours</th>
            <th className="pb-2 pr-4 text-right">Div/action</th>
            <th className="pb-2 pr-4 text-right">Rdt courant</th>
            <th className="pb-2 pr-4 text-right">YOC</th>
            <th className="pb-2 text-right">Revenu annuel</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.holding_id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
              <td className="py-2.5 pr-4 font-medium text-zinc-200 max-w-[180px] truncate">
                {r.name}
              </td>
              <td className="py-2.5 pr-4 text-right font-mono text-zinc-400">{r.pru.toFixed(2)}</td>
              <td className="py-2.5 pr-4 text-right font-mono text-zinc-300">
                {r.current_price?.toFixed(2) ?? "—"}
              </td>
              <td className="py-2.5 pr-4 text-right font-mono text-zinc-400">
                {r.annual_div_per_share.toFixed(4)}
              </td>
              <td className="py-2.5 pr-4 text-right font-mono text-blue-400">
                {r.current_yield_pct != null ? `${r.current_yield_pct.toFixed(2)}%` : "—"}
              </td>
              <td className="py-2.5 pr-4 text-right font-mono text-gold-300 font-semibold">
                {r.yoc_pct != null ? `${r.yoc_pct.toFixed(2)}%` : "—"}
              </td>
              <td className="py-2.5 text-right font-mono text-success">
                {fmtCurrency(r.total_annual_income)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProjectionTab({ data }: { data: MonthlyIncome[] }) {
  const chartData = data.map((d) => ({
    month: MONTHS_FR[d.month - 1],
    amount: d.projected_amount,
  }));
  const total = data.reduce((s, d) => s + d.projected_amount, 0);

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-sm font-semibold text-zinc-300">Revenus mensuels projetés (12 mois)</h3>
          <div className="text-right">
            <p className="text-xs text-zinc-500">Annuel estimé</p>
            <p className="text-lg font-bold text-gold-300">{fmtCurrency(total)}</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} barSize={28}>
            <XAxis dataKey="month" tick={{ fill: "#71717a", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: "#1f1f23", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 13 }}
              formatter={(v: number) => [fmtCurrency(v), "Revenus"]}
            />
            <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={i % 2 === 0 ? "#7c3aed" : "#6d28d9"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function GrowthTab({ data }: { data: GrowthRow[] }) {
  if (!data.length) return <EmptyState message="Pas encore assez d'historique." />;
  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-zinc-300 mb-4">Croissance des dividendes (YoY)</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} barSize={40}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis dataKey="year" tick={{ fill: "#71717a", fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#71717a", fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: "#1f1f23", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 13 }}
            formatter={(v: number, name: string) => [
              name === "total" ? fmtCurrency(v) : `${v?.toFixed(1)}%`,
              name === "total" ? "Dividendes" : "Croissance YoY",
            ]}
          />
          <Bar dataKey="total" name="total" fill="#7c3aed" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-3 grid grid-cols-3 gap-3">
        {data.map((d) => (
          <div key={d.year} className="bg-zinc-800/50 rounded-lg p-3">
            <p className="text-xs text-zinc-500">{d.year}</p>
            <p className="font-bold text-zinc-100">{fmtCurrency(d.total)}</p>
            {d.yoy_growth_pct != null && (
              <p className={d.yoy_growth_pct >= 0 ? "text-success text-xs" : "text-danger text-xs"}>
                {d.yoy_growth_pct >= 0 ? "+" : ""}{d.yoy_growth_pct.toFixed(1)}%
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function RiskTab({ data }: { data: DivConcentration }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="card text-center">
          <p className="stat-label">Revenu annuel total</p>
          <p className="stat-value text-gold-300 mt-2">{fmtCurrency(data.total_annual_income)}</p>
        </div>
        <div className={cn("card text-center", data.top_3_share_pct > 50 ? "border-warning/40" : "")}>
          <p className="stat-label">Concentration Top 3</p>
          <p className={cn("stat-value mt-2", data.top_3_share_pct > 50 ? "text-warning" : "text-success")}>
            {data.top_3_share_pct.toFixed(1)}%
          </p>
          {data.top_3_share_pct > 50 && (
            <p className="text-xs text-warning mt-1">⚠ Dépendance élevée</p>
          )}
        </div>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-zinc-300 mb-4">Sources de revenus</h3>
        <div className="flex flex-col gap-2.5">
          {data.holdings.map((h, i) => (
            <div key={h.isin ?? h.name} className="flex items-center gap-3">
              <span className="text-xs text-zinc-500 w-4">{i + 1}</span>
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-300 truncate max-w-[200px]">{h.name}</span>
                  <span className="text-zinc-400 font-mono shrink-0 ml-2">
                    {h.share_pct}% · {fmtCurrency(h.income)}
                  </span>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full">
                  <div
                    className="h-full rounded-full bg-gold-500"
                    style={{ width: `${h.share_pct}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="card text-center py-12">
      <p className="text-zinc-500 text-sm">{message}</p>
      <p className="text-xs text-zinc-600 mt-2">
        Importez un fichier Fortuneo pour commencer.
      </p>
    </div>
  );
}
