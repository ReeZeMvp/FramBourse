"use client";

import { useEffect, useState } from "react";
import { getPortfolios, getHoldings, type Holding, type Portfolio } from "@/lib/api";
import { fmtCurrency, fmtPct, pnlColor } from "@/lib/utils";

export default function AnalysisPage() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getPortfolios().then((ps) => {
      setPortfolios(ps);
      if (ps.length) {
        setSelectedId(ps[0].id);
      }
    });
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setLoading(true);
    getHoldings(selectedId).then(setHoldings).finally(() => setLoading(false));
  }, [selectedId]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-zinc-50">Analyse des positions</h1>
        <select
          value={selectedId ?? ""}
          onChange={(e) => setSelectedId(Number(e.target.value))}
          className="text-sm bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-zinc-300"
        >
          {portfolios.map((p) => (
            <option key={p.id} value={p.id}>{p.name} ({p.envelope_type})</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-800">
                <th className="pb-3 pr-4">Valeur</th>
                <th className="pb-3 pr-4">ISIN</th>
                <th className="pb-3 pr-4 text-right">Qté</th>
                <th className="pb-3 pr-4 text-right">PRU</th>
                <th className="pb-3 pr-4 text-right">Cours</th>
                <th className="pb-3 pr-4 text-right">Valorisation</th>
                <th className="pb-3 pr-4 text-right">+/- val</th>
                <th className="pb-3 pr-4 text-right">Rdt</th>
                <th className="pb-3 text-right">YOC</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => (
                <tr key={h.id} className="border-b border-zinc-800/40 hover:bg-zinc-800/30">
                  <td className="py-3 pr-4">
                    <div>
                      <p className="text-zinc-200 font-medium max-w-[200px] truncate">{h.name}</p>
                      <div className="flex gap-1 mt-0.5">
                        {h.asset_type && <span className="badge-violet text-[10px]">{h.asset_type}</span>}
                        {h.geography && <span className="badge text-[10px] bg-zinc-800 text-zinc-400">{h.geography}</span>}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs text-zinc-500">{h.isin ?? "—"}</td>
                  <td className="py-3 pr-4 text-right font-mono">{h.quantity}</td>
                  <td className="py-3 pr-4 text-right font-mono">{h.pru.toFixed(2)}</td>
                  <td className="py-3 pr-4 text-right font-mono">
                    {h.current_price?.toFixed(2) ?? "—"}
                  </td>
                  <td className="py-3 pr-4 text-right font-mono font-medium">
                    {fmtCurrency(h.valuation)}
                  </td>
                  <td className={`py-3 pr-4 text-right font-mono ${pnlColor(h.pnl ?? 0)}`}>
                    {h.pnl != null ? fmtCurrency(h.pnl) : "—"}
                    {h.pnl_pct != null && (
                      <span className="block text-[11px]">{fmtPct(h.pnl_pct * 100)}</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-right font-mono text-blue-400">
                    {h.dividend_yield != null
                      ? `${(h.dividend_yield * 100).toFixed(2)}%`
                      : "—"}
                  </td>
                  <td className="py-3 text-right font-mono text-gold-300 font-semibold">
                    {h.yoc != null ? `${(h.yoc * 100).toFixed(2)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!holdings.length && (
            <p className="text-center text-zinc-500 py-8 text-sm">
              Aucune position. Importez un fichier via la page Import.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
