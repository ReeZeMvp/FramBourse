"use client";

import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from "recharts";
import {
  getBenchmarks, getBenchmarkList, getPEAVsCTO, getCurrencyExposure,
  getConcentration,
  type BenchmarkPoint, type EnvelopePerf, type CurrencyRow, type Concentration,
} from "@/lib/api";
import { fmtCurrency, fmtPct, pnlColor } from "@/lib/utils";

const USER_ID = 1; // TODO: dynamic user selection

export default function PerformancePage() {
  const [benchmarks, setBenchmarks] = useState<{ name: string; ticker: string }[]>([]);
  const [selectedBenchmark, setSelectedBenchmark] = useState("CW8.PA");
  const [benchmarkData, setBenchmarkData] = useState<BenchmarkPoint[]>([]);
  const [envelopes, setEnvelopes] = useState<Record<string, EnvelopePerf>>({});
  const [currencies, setCurrencies] = useState<CurrencyRow[]>([]);
  const [concentration, setConcentration] = useState<Concentration | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBenchmarkList().then(setBenchmarks);
    Promise.all([
      getBenchmarks(selectedBenchmark, `${new Date().getFullYear() - 2}-01-01`),
      getPEAVsCTO(USER_ID),
      getCurrencyExposure(USER_ID),
      getConcentration(USER_ID),
    ]).then(([bData, env, cur, conc]) => {
      setBenchmarkData(bData);
      setEnvelopes(env);
      setCurrencies(cur);
      setConcentration(conc);
    }).finally(() => setLoading(false));
  }, [selectedBenchmark]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">Performance</h1>
        <p className="text-sm text-zinc-500 mt-0.5">TWR, benchmarks et analyse fiscale</p>
      </div>

      {/* Benchmark chart */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-semibold text-zinc-300">Benchmark</h3>
          <select
            value={selectedBenchmark}
            onChange={(e) => setSelectedBenchmark(e.target.value)}
            className="text-sm bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-zinc-300"
          >
            {benchmarks.map((b) => (
              <option key={b.ticker} value={b.ticker}>{b.name}</option>
            ))}
          </select>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={benchmarkData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#71717a", fontSize: 11 }}
              axisLine={false} tickLine={false}
              tickFormatter={(v) => v.slice(0, 7)}
              interval={30}
            />
            <YAxis
              tick={{ fill: "#71717a", fontSize: 11 }}
              axisLine={false} tickLine={false}
              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            />
            <Tooltip
              contentStyle={{ background: "#1f1f23", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 13 }}
              formatter={(v: number) => [`${(v * 100).toFixed(2)}%`, "Performance"]}
            />
            <Line
              type="monotone"
              dataKey="cumulative_return"
              stroke="#7c3aed"
              strokeWidth={2}
              dot={false}
              name="Benchmark"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* PEA vs CTO */}
      <div>
        <h3 className="text-sm font-semibold text-zinc-300 mb-3">Comparatif PEA vs CTO (net de fiscalité)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(envelopes).map(([type, perf]) => (
            <EnvelopeCard key={type} type={type} perf={perf} />
          ))}
        </div>
      </div>

      {/* Currency exposure + Concentration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Currency */}
        <div className="card">
          <h3 className="text-sm font-semibold text-zinc-300 mb-4">Exposition devises</h3>
          <div className="flex flex-col gap-3">
            {currencies.map((c) => (
              <div key={c.currency}>
                <div className="flex justify-between text-xs text-zinc-400 mb-1">
                  <span className="font-medium text-zinc-300">{c.currency}</span>
                  <span>{c.pct}% · {fmtCurrency(c.value)}</span>
                </div>
                <div className="h-2 bg-zinc-800 rounded-full">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${c.pct}%`,
                      background: c.currency === "EUR" ? "#7c3aed" : c.currency === "USD" ? "#3b82f6" : "#f59e0b",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Concentration */}
        {concentration && (
          <div className="card">
            <div className="flex justify-between mb-4">
              <h3 className="text-sm font-semibold text-zinc-300">Risque de concentration</h3>
              <span className="badge-violet">Top 10 : {concentration.top_10_share_pct}%</span>
            </div>
            <div className="flex flex-col gap-2">
              {concentration.holdings.slice(0, 7).map((h, i) => (
                <div key={h.isin ?? h.name} className="flex items-center gap-2">
                  <span className="text-xs text-zinc-600 w-4">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="text-zinc-300 truncate max-w-[160px]">{h.name}</span>
                      <span className="text-zinc-400 ml-2">{h.share_pct}%</span>
                    </div>
                    <div className="h-1 bg-zinc-800 rounded-full">
                      <div className="h-full rounded-full bg-violet-600" style={{ width: `${h.share_pct}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EnvelopeCard({ type, perf }: { type: string; perf: EnvelopePerf }) {
  return (
    <div className="card space-y-3">
      <div className="flex justify-between items-center">
        <span className="font-semibold text-zinc-100">{perf.name}</span>
        <span className="badge-violet">{type}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-zinc-500 text-xs">Valorisation</p>
          <p className="font-bold text-zinc-100">{fmtCurrency(perf.valuation)}</p>
        </div>
        <div>
          <p className="text-zinc-500 text-xs">PRU total</p>
          <p className="font-bold text-zinc-100">{fmtCurrency(perf.cost)}</p>
        </div>
        <div>
          <p className="text-zinc-500 text-xs">PV brute</p>
          <p className={`font-bold ${pnlColor(perf.gross_pnl)}`}>
            {fmtCurrency(perf.gross_pnl)} ({fmtPct(perf.gross_pnl_pct)})
          </p>
        </div>
        <div>
          <p className="text-zinc-500 text-xs">PV nette ({perf.tax_rate_pct}% taxe)</p>
          <p className={`font-bold ${pnlColor(perf.net_pnl)}`}>
            {fmtCurrency(perf.net_pnl)} ({fmtPct(perf.net_pnl_pct)})
          </p>
        </div>
      </div>
    </div>
  );
}
