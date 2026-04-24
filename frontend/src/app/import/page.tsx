"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { getPortfolios, importFortuneoFile, importAmundiFile, type Portfolio } from "@/lib/api";
import { cn } from "@/lib/utils";

type Source = "fortuneo" | "amundi";

export default function ImportPage() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selectedPortfolio, setSelectedPortfolio] = useState<number | null>(null);
  const [source, setSource] = useState<Source>("fortuneo");
  const [file, setFile] = useState<File | null>(null);
  const [enrich, setEnrich] = useState(true);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getPortfolios().then((ps) => {
      setPortfolios(ps);
      if (ps.length) setSelectedPortfolio(ps[0].id);
    });
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  const handleSubmit = async () => {
    if (!file || !selectedPortfolio) return;
    setStatus("loading");
    setMessage("");
    try {
      let result;
      if (source === "fortuneo") {
        result = await importFortuneoFile(selectedPortfolio, file, enrich);
      } else {
        result = await importAmundiFile(selectedPortfolio, file);
      }
      setStatus("success");
      setMessage(`✓ ${result.holdings_imported} positions importées. ${result.notes ?? ""}`);
      setFile(null);
    } catch (e: any) {
      setStatus("error");
      setMessage(e.message);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">Importer un fichier</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Fortuneo XLS ou Amundi XLSB</p>
      </div>

      {/* Source selector */}
      <div className="card space-y-4">
        <label className="block text-sm font-medium text-zinc-300">Source</label>
        <div className="grid grid-cols-2 gap-3">
          {(["fortuneo", "amundi"] as Source[]).map((s) => (
            <button
              key={s}
              onClick={() => setSource(s)}
              className={cn(
                "rounded-xl border-2 p-4 text-left transition-all",
                source === s
                  ? "border-violet-600 bg-violet-950/50 text-violet-300"
                  : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600"
              )}
            >
              <p className="font-semibold capitalize">{s}</p>
              <p className="text-xs mt-1 opacity-70">
                {s === "fortuneo" ? "Export XLS portefeuille" : "Synthèse Amundi XLSB (PEE/PERCOL)"}
              </p>
            </button>
          ))}
        </div>

        {/* Portfolio selector */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">Portefeuille cible</label>
          <select
            value={selectedPortfolio ?? ""}
            onChange={(e) => setSelectedPortfolio(Number(e.target.value))}
            className="w-full text-sm bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-300"
          >
            {portfolios.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.envelope_type}) — {p.broker ?? "Courtier inconnu"}
              </option>
            ))}
          </select>
          {!portfolios.length && (
            <p className="text-xs text-zinc-500 mt-1">
              Aucun portefeuille trouvé. Créez-en un dans les paramètres.
            </p>
          )}
        </div>

        {/* Enrichissement toggle (Fortuneo only) */}
        {source === "fortuneo" && (
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setEnrich(!enrich)}
              className={cn(
                "relative w-10 h-5 rounded-full transition-colors",
                enrich ? "bg-violet-600" : "bg-zinc-700"
              )}
            >
              <div
                className={cn(
                  "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
                  enrich ? "translate-x-5" : "translate-x-0.5"
                )}
              />
            </div>
            <span className="text-sm text-zinc-300">
              Enrichir via yfinance (secteur, historique dividendes)
            </span>
          </label>
        )}
      </div>

      {/* Drop zone */}
      <div
        ref={dropRef}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => document.getElementById("file-input")?.click()}
        className={cn(
          "card border-2 border-dashed cursor-pointer text-center py-12 transition-all",
          file ? "border-violet-600 bg-violet-950/20" : "border-zinc-700 hover:border-zinc-500"
        )}
      >
        <input
          id="file-input"
          type="file"
          accept=".xls,.xlsb"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <Upload className="mx-auto mb-3 text-zinc-500" size={32} />
        {file ? (
          <div>
            <p className="font-medium text-violet-300">{file.name}</p>
            <p className="text-xs text-zinc-500 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
        ) : (
          <div>
            <p className="text-zinc-400 font-medium">Glissez votre fichier ici</p>
            <p className="text-xs text-zinc-600 mt-1">ou cliquez pour parcourir</p>
            <p className="text-xs text-zinc-700 mt-2">
              {source === "fortuneo" ? "Formats acceptés : .xls" : "Formats acceptés : .xlsb"}
            </p>
          </div>
        )}
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!file || !selectedPortfolio || status === "loading"}
        className={cn(
          "w-full btn-primary py-3 flex items-center justify-center gap-2",
          (!file || !selectedPortfolio) && "opacity-50 cursor-not-allowed"
        )}
      >
        {status === "loading" ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Importation en cours…
          </>
        ) : (
          "Importer"
        )}
      </button>

      {/* Status */}
      {status === "success" && (
        <div className="flex items-start gap-3 rounded-xl bg-green-950/40 border border-green-800 p-4">
          <CheckCircle size={18} className="text-success mt-0.5 shrink-0" />
          <p className="text-sm text-green-300">{message}</p>
        </div>
      )}
      {status === "error" && (
        <div className="flex items-start gap-3 rounded-xl bg-red-950/40 border border-red-800 p-4">
          <AlertCircle size={18} className="text-danger mt-0.5 shrink-0" />
          <p className="text-sm text-red-300">{message}</p>
        </div>
      )}

      {/* Tips */}
      <div className="card-elevated text-xs text-zinc-500 space-y-1.5">
        <p className="font-medium text-zinc-400">Notes d&apos;import</p>
        <p>• Fortuneo : l&apos;import remplace les positions existantes du portefeuille sélectionné.</p>
        <p>• L&apos;enrichissement yfinance peut prendre 30-60s selon le nombre de lignes.</p>
        <p>• Les tickers européens sont résolus via OpenFIGI puis heuristique (ex-date .PA pour FR).</p>
        <p>• Amundi : les positions sont regroupées par fonds (toutes échéances confondues).</p>
      </div>
    </div>
  );
}
