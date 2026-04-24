"use client";

import { useEffect, useState } from "react";
import { getUsers, updateUser, getPortfolios, type User, type Portfolio } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selected, setSelected] = useState<User | null>(null);
  const [form, setForm] = useState<Partial<User>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getUsers().then((u) => {
      setUsers(u);
      if (u.length) {
        setSelected(u[0]);
        setForm(u[0]);
      }
    });
    getPortfolios().then(setPortfolios);
  }, []);

  const handleSave = async () => {
    if (!selected) return;
    const updated = await updateUser(selected.id, form);
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const field = (label: string, key: keyof User, type = "text", hint?: string) => (
    <div>
      <label className="block text-sm font-medium text-zinc-300 mb-1">{label}</label>
      <input
        type={type}
        value={(form[key] as string | number | undefined) ?? ""}
        onChange={(e) =>
          setForm((prev) => ({
            ...prev,
            [key]: type === "number" ? parseFloat(e.target.value) || 0 : e.target.value,
          }))
        }
        className="w-full text-sm bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-violet-600"
      />
      {hint && <p className="text-xs text-zinc-600 mt-1">{hint}</p>}
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-zinc-50">Paramètres</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Profil utilisateur et données fiscales PEA</p>
      </div>

      {/* User selector */}
      {users.length > 1 && (
        <div className="flex gap-2">
          {users.map((u) => (
            <button
              key={u.id}
              onClick={() => { setSelected(u); setForm(u); }}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                selected?.id === u.id
                  ? "text-white"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              )}
              style={selected?.id === u.id ? { background: u.color } : {}}
            >
              {u.name}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="card space-y-5">
          <h3 className="text-sm font-semibold text-zinc-300">Profil utilisateur</h3>

          {field("Nom affiché", "name")}
          {field("Couleur accent", "color", "color")}

          <hr className="border-zinc-800" />

          <h3 className="text-sm font-semibold text-zinc-300">
            Données fiscales PEA
            <span className="ml-2 text-xs font-normal text-zinc-500">
              (nécessaires au calcul de performance nette)
            </span>
          </h3>

          {field(
            "Date d'ouverture du PEA",
            "pea_opening_date",
            "date",
            "Après 5 ans : taux de prélèvement social uniquement (17,2%)"
          )}
          {field(
            "Cumul des versements (€)",
            "pea_deposits_total",
            "number",
            "Total des versements en espèces depuis l'ouverture"
          )}
          {field(
            "Cumul des retraits espèces (€)",
            "pea_withdrawals_total",
            "number",
            "Sorties de cash (hors dividendes réinvestis automatiquement)"
          )}

          <button onClick={handleSave} className="btn-primary w-full">
            {saved ? "✓ Enregistré" : "Sauvegarder"}
          </button>
        </div>
      )}

      {/* Portfolios list */}
      <div className="card">
        <h3 className="text-sm font-semibold text-zinc-300 mb-4">Portefeuilles</h3>
        <div className="flex flex-col gap-2">
          {portfolios.map((p) => (
            <div key={p.id} className="flex justify-between items-center py-2 border-b border-zinc-800/50 last:border-0">
              <div>
                <p className="text-sm font-medium text-zinc-200">{p.name}</p>
                <p className="text-xs text-zinc-500">{p.broker ?? "—"} · {p.envelope_type}</p>
              </div>
              <div className="text-right text-xs text-zinc-500">
                {p.last_import
                  ? `Import : ${new Date(p.last_import).toLocaleDateString("fr-FR")}`
                  : "Jamais importé"}
              </div>
            </div>
          ))}
          {!portfolios.length && (
            <p className="text-sm text-zinc-500">Aucun portefeuille. Créez-en un via l&apos;API.</p>
          )}
        </div>
      </div>
    </div>
  );
}
