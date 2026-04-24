"use client";

import { useEffect, useState } from "react";
import { getPortfolioSummary, type PortfolioSummary } from "@/lib/api";
import { AllocationDonut } from "@/components/dashboard/AllocationDonut";
import { GEOGRAPHY_COLORS } from "@/lib/utils";

export default function GeographyPage() {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);

  useEffect(() => { getPortfolioSummary().then(setSummary); }, []);

  if (!summary) return <div className="text-zinc-500 text-sm">Chargement…</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-zinc-50">Répartition géographique</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AllocationDonut
          title="Exposition géographique"
          data={summary.by_geography}
          colorMap={GEOGRAPHY_COLORS}
        />
        <div className="card">
          <h3 className="text-sm font-semibold text-zinc-300 mb-4">Détail par zone</h3>
          <div className="flex flex-col gap-3">
            {summary.by_geography.map((g) => (
              <div key={g.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-zinc-300">{g.label}</span>
                  <span className="font-mono text-violet-400">{g.value.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-zinc-800 rounded-full">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${g.value}%`,
                      background: GEOGRAPHY_COLORS[g.label] ?? "#7c3aed",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
