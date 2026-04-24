import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmt(value: number, decimals = 2): string {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function fmtCurrency(value: number, currency = "EUR"): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function fmtPct(value: number, decimals = 2): string {
  return `${value >= 0 ? "+" : ""}${fmt(value, decimals)}%`;
}

export function pnlColor(value: number): string {
  if (value > 0) return "text-success";
  if (value < 0) return "text-danger";
  return "text-zinc-400";
}

export const MONTHS_FR = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
  "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc",
];

export const GEOGRAPHY_COLORS: Record<string, string> = {
  Europe: "#7c3aed",
  USA: "#3b82f6",
  Asie: "#f59e0b",
  Émergents: "#22c55e",
  Monde: "#a855f7",
  Autre: "#6b7280",
};

export const SECTOR_COLORS: Record<string, string> = {
  Tech: "#7c3aed",
  Santé: "#22c55e",
  Finance: "#3b82f6",
  "Énergie": "#f59e0b",
  Industriels: "#64748b",
  Consommation: "#ec4899",
  Matériaux: "#84cc16",
  Immobilier: "#f97316",
  "Telecom/Media": "#06b6d4",
  "Services publics": "#a78bfa",
  Autre: "#6b7280",
};
