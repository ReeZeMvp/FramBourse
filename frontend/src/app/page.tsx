"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Wallet, BarChart2, DollarSign } from "lucide-react";
import { getPortfolioSummary, type PortfolioSummary } from "@/lib/api";
import { fmtCurrency, fmtPct, pnlColor, GEOGRAPHY_COLORS, SECTOR_COLORS } from "@/lib/utils";
import { StatCard } from "@/components/dashboard/StatCard";
import { AllocationDonut } from "@/components/dashboard/AllocationDonut";
import { SectorHeatmap } from "@/components/dashboard/SectorHeatmap";
import { Top10Holdings } from "@/components/dashboard/Top10Holdings";

export default function DashboardPage() {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPortfolioSummary()
      .then(setSummary)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingScreen />;
  if (error) return <ErrorScreen message={error} />;
  if (!summary) return null;

  const pnlPositive = summary.pnl >= 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-50">Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Vue globale du portefeuille</p>
        </div>
        <span className="badge-violet">Live</span>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Valorisation totale"
          value={fmtCurrency(summary.total_valuation)}
          icon={Wallet}
          glow
        />
        <StatCard
          label="Prix de revient"
          value={fmtCurrency(summary.total_cost)}
          icon={BarChart2}
        />
        <StatCard
          label="Plus/Moins-value"
          value={fmtCurrency(summary.pnl)}
          sub={fmtPct(summary.pnl_pct)}
          subColor={pnlPositive ? "text-success" : "text-danger"}
          icon={pnlPositive ? TrendingUp : TrendingDown}
        />
        <StatCard
          label="Rendement moyen"
          value={`${summary.by_asset.find((a) => a.label === "Actions")?.value?.toFixed(1) ?? "—"}%`}
          sub="Actions dividendes"
          icon={DollarSign}
        />
      </div>

      {/* Allocation charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <AllocationDonut
          title="Répartition géographique"
          data={summary.by_geography}
          colorMap={GEOGRAPHY_COLORS}
        />
        <AllocationDonut
          title="Classe d'actifs"
          data={summary.by_asset}
        />
        <AllocationDonut
          title="Par enveloppe"
          data={summary.by_envelope}
        />
      </div>

      {/* Sector heatmap + Top 10 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SectorHeatmap data={summary.by_sector} />
        <Top10Holdings
          holdings={summary.top_10}
          totalValuation={summary.total_valuation}
        />
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center h-full text-zinc-500">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm">Chargement du portefeuille…</p>
      </div>
    </div>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="card max-w-md text-center space-y-3">
        <p className="text-danger font-medium">Erreur de chargement</p>
        <p className="text-sm text-zinc-500">{message}</p>
        <p className="text-xs text-zinc-600">
          Vérifiez que le backend est démarré sur le port 8000.
        </p>
        <button onClick={() => window.location.reload()} className="btn-primary mt-2">
          Réessayer
        </button>
      </div>
    </div>
  );
}
