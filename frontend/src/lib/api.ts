const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API ${res.status}: ${err}`);
  }
  return res.json() as Promise<T>;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export const getUsers = () => req<User[]>("/users/");
export const createUser = (data: Partial<User>) =>
  req<User>("/users/", { method: "POST", body: JSON.stringify(data) });
export const updateUser = (id: number, data: Partial<User>) =>
  req<User>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(data) });

// ─── Portfolios ───────────────────────────────────────────────────────────────

export const getPortfolios = (userId?: number) =>
  req<Portfolio[]>(`/portfolios/${userId ? `?user_id=${userId}` : ""}`);
export const getHoldings = (portfolioId: number) =>
  req<Holding[]>(`/portfolios/${portfolioId}/holdings`);
export const getPortfolioSummary = (userId?: number) =>
  req<PortfolioSummary>(`/portfolios/summary/all${userId ? `?user_id=${userId}` : ""}`);

// ─── Dividends ────────────────────────────────────────────────────────────────

export const getDividends = (params?: Record<string, string | number>) => {
  const qs = params ? "?" + new URLSearchParams(params as Record<string, string>).toString() : "";
  return req<Dividend[]>(`/dividends/${qs}`);
};
export const getDividendCalendar = (userId?: number) =>
  req<DividendEvent[]>(`/dividends/calendar${userId ? `?user_id=${userId}` : ""}`);
export const getYOC = (userId?: number) =>
  req<YOCRow[]>(`/dividends/yoc${userId ? `?user_id=${userId}` : ""}`);
export const getDividendGrowth = (userId?: number) =>
  req<GrowthRow[]>(`/dividends/growth${userId ? `?user_id=${userId}` : ""}`);
export const getIncomeProjection = (userId?: number) =>
  req<MonthlyIncome[]>(`/dividends/projection${userId ? `?user_id=${userId}` : ""}`);
export const getDividendConcentration = (userId?: number) =>
  req<DivConcentration>(`/dividends/concentration${userId ? `?user_id=${userId}` : ""}`);

// ─── Performance ──────────────────────────────────────────────────────────────

export const getBenchmarks = (ticker: string, start: string) =>
  req<BenchmarkPoint[]>(`/performance/benchmarks?ticker=${ticker}&start=${start}`);
export const getBenchmarkList = () =>
  req<{ name: string; ticker: string }[]>("/performance/benchmarks/list");
export const getPEAVsCTO = (userId: number) =>
  req<Record<string, EnvelopePerf>>(`/performance/pea-vs-cto?user_id=${userId}`);
export const getCurrencyExposure = (userId?: number) =>
  req<CurrencyRow[]>(`/performance/currency-exposure${userId ? `?user_id=${userId}` : ""}`);
export const getConcentration = (userId?: number) =>
  req<Concentration>(`/performance/concentration${userId ? `?user_id=${userId}` : ""}`);

// ─── Import ───────────────────────────────────────────────────────────────────

export async function importFortuneoFile(portfolioId: number, file: File, enrich = true) {
  const form = new FormData();
  form.append("file", file);
  form.append("portfolio_id", portfolioId.toString());
  form.append("enrich", enrich.toString());
  const res = await fetch(`${BASE}/import/fortuneo`, { method: "POST", body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function importAmundiFile(portfolioId: number, file: File) {
  const form = new FormData();
  form.append("file", file);
  form.append("portfolio_id", portfolioId.toString());
  const res = await fetch(`${BASE}/import/amundi`, { method: "POST", body: form });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface User {
  id: number;
  name: string;
  color: string;
  pea_opening_date: string | null;
  pea_deposits_total: number;
  pea_withdrawals_total: number;
}

export interface Portfolio {
  id: number;
  user_id: number;
  name: string;
  envelope_type: string;
  account_number: string | null;
  broker: string | null;
  last_import: string | null;
}

export interface Holding {
  id: number;
  portfolio_id: number;
  isin: string | null;
  ticker: string | null;
  name: string;
  quantity: number;
  pru: number;
  current_price: number | null;
  currency: string;
  asset_type: string | null;
  sector: string | null;
  geography: string | null;
  weight: number | null;
  pnl: number | null;
  pnl_pct: number | null;
  dividend_yield: number | null;
  valuation: number;
  cost_basis: number;
  yoc: number | null;
}

export interface PortfolioSummary {
  total_valuation: number;
  total_cost: number;
  pnl: number;
  pnl_pct: number;
  by_envelope: { label: string; value: number }[];
  by_geography: { label: string; value: number }[];
  by_sector: { label: string; value: number }[];
  by_asset: { label: string; value: number }[];
  top_10: { name: string; value: number; isin: string | null }[];
}

export interface Dividend {
  id: number;
  holding_id: number;
  ex_date: string | null;
  payment_date: string | null;
  amount_per_share: number;
  total_amount: number | null;
  currency: string;
  status: string;
  year: number | null;
}

export interface DividendEvent {
  holding_name: string;
  isin: string | null;
  ticker: string | null;
  ex_date: string;
  payment_date: string | null;
  amount_per_share: number;
  total_amount: number | null;
  currency: string;
}

export interface YOCRow {
  holding_id: number;
  name: string;
  isin: string | null;
  pru: number;
  current_price: number | null;
  quantity: number;
  annual_div_per_share: number;
  current_yield_pct: number | null;
  yoc_pct: number | null;
  total_annual_income: number;
}

export interface GrowthRow {
  year: number;
  total: number;
  yoy_growth_pct: number | null;
}

export interface MonthlyIncome {
  month: number;
  projected_amount: number;
}

export interface DivConcentration {
  top_3_share_pct: number;
  holdings: { name: string; isin: string | null; income: number; share_pct: number }[];
  total_annual_income: number;
}

export interface BenchmarkPoint {
  date: string;
  close: number;
  cumulative_return: number;
}

export interface EnvelopePerf {
  portfolio_id: number;
  name: string;
  valuation: number;
  cost: number;
  gross_pnl: number;
  gross_pnl_pct: number;
  tax_rate_pct: number;
  net_pnl: number;
  net_pnl_pct: number;
}

export interface CurrencyRow {
  currency: string;
  value: number;
  pct: number;
}

export interface Concentration {
  top_10_share_pct: number;
  holdings: {
    name: string;
    isin: string | null;
    ticker: string | null;
    valuation: number;
    share_pct: number;
    sector: string | null;
    geography: string | null;
  }[];
}
