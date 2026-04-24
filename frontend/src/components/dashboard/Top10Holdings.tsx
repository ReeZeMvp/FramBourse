"use client";

import { fmtCurrency } from "@/lib/utils";

interface Props {
  holdings: { name: string; value: number; isin: string | null }[];
  totalValuation: number;
}

export function Top10Holdings({ holdings, totalValuation }: Props) {
  const max = holdings[0]?.value ?? 1;

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-zinc-300 mb-4">Top 10 positions</h3>
      <div className="flex flex-col gap-2.5">
        {holdings.map((h, i) => {
          const pct = (h.value / totalValuation) * 100;
          const barPct = (h.value / max) * 100;
          return (
            <div key={h.isin ?? h.name} className="flex flex-col gap-1">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-300 truncate max-w-[200px]">{h.name}</span>
                <span className="text-zinc-400 font-mono shrink-0 ml-2">
                  {pct.toFixed(1)}% · {fmtCurrency(h.value)}
                </span>
              </div>
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${barPct}%`,
                    background: i === 0
                      ? "#7c3aed"
                      : i < 3
                      ? "#a855f7"
                      : "#6d28d9",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
