"""
Time-Weighted Return (TWR) calculation and benchmark comparison utilities.

TWR formula (modified Dietz / sub-period linking):
  TWR = (1+r1) × (1+r2) × ... × (1+rn) - 1

Where each sub-period return ri = (EV - BV - CF) / (BV + CF_weighted)
"""

from datetime import date
from typing import Optional
import yfinance as yf
import asyncio
import logging

logger = logging.getLogger(__name__)

BENCHMARK_TICKERS = {
    "MSCI World": "URTH",          # iShares MSCI World ETF (USD)
    "S&P 500": "SPY",
    "CAC 40 TR": "^FCHI",          # Note: ^FCHI is price only; use CW8.PA for MSCI World EUR TR
    "MSCI World EUR": "CW8.PA",    # Amundi MSCI World UCITS ETF EUR — best for EUR TWR comparison
}


def compute_twr(cash_flows: list[dict], valuations: list[dict]) -> Optional[float]:
    """
    Simplified TWR from a series of portfolio valuations and cash flows.

    cash_flows: [{date, amount}]  — positive = deposit, negative = withdrawal
    valuations: [{date, value}]   — ordered ascending

    Returns total TWR as a decimal (0.15 = +15%).
    """
    if len(valuations) < 2:
        return None

    valuations_sorted = sorted(valuations, key=lambda x: x["date"])
    cf_by_date = {cf["date"]: cf["amount"] for cf in cash_flows}

    twr = 1.0
    for i in range(1, len(valuations_sorted)):
        bv = valuations_sorted[i - 1]["value"]
        ev = valuations_sorted[i]["value"]
        period_date = valuations_sorted[i]["date"]
        cf = cf_by_date.get(period_date, 0.0)

        denominator = bv + max(cf, 0)  # weight deposits at start of period
        if denominator <= 0:
            continue
        r = (ev - bv - cf) / denominator
        twr *= 1 + r

    return twr - 1


async def fetch_benchmark_returns(
    ticker: str,
    start: date,
    end: Optional[date] = None,
) -> list[dict]:
    """
    Fetch daily returns for a benchmark ticker.
    Returns [{date, close, cumulative_return}].
    """
    end = end or date.today()
    results = []
    try:
        loop = asyncio.get_event_loop()
        tk = yf.Ticker(ticker)
        hist = await loop.run_in_executor(
            None,
            lambda: tk.history(start=start.isoformat(), end=end.isoformat()),
        )
        if hist.empty:
            return []
        base = float(hist["Close"].iloc[0])
        for ts, row in hist.iterrows():
            results.append({
                "date": ts.date().isoformat(),
                "close": float(row["Close"]),
                "cumulative_return": (float(row["Close"]) / base) - 1,
            })
    except Exception as e:
        logger.warning(f"Benchmark fetch failed for {ticker}: {e}")
    return results


def compute_dividend_growth_yoy(dividends: list[dict]) -> list[dict]:
    """
    Group dividends by year and compute year-over-year growth.
    dividends: [{year, total_amount}]
    Returns [{year, total, yoy_growth_pct}].
    """
    by_year: dict[int, float] = {}
    for d in dividends:
        yr = d.get("year")
        amt = d.get("total_amount", 0) or d.get("amount_per_share", 0)
        if yr:
            by_year[yr] = by_year.get(yr, 0) + float(amt)

    rows = sorted(by_year.items())
    result = []
    for i, (year, total) in enumerate(rows):
        prev_total = rows[i - 1][1] if i > 0 else None
        yoy = ((total - prev_total) / prev_total) if prev_total else None
        result.append({"year": year, "total": round(total, 2), "yoy_growth_pct": round(yoy * 100, 1) if yoy is not None else None})
    return result


def project_monthly_income(dividends: list[dict], quantity: float) -> list[dict]:
    """
    Project next 12 months of dividend income based on last known annual schedule.
    dividends: [{ex_date (date), amount_per_share, year}]
    Returns [{month (1-12), projected_amount}].
    """
    from collections import defaultdict
    from datetime import date

    today = date.today()
    current_year = today.year

    # Use last 2 years of dividends to infer monthly pattern
    recent = [d for d in dividends if d.get("year", 0) >= current_year - 1]
    monthly_avg: dict[int, float] = defaultdict(float)
    monthly_count: dict[int, int] = defaultdict(int)

    for d in recent:
        ex = d.get("ex_date")
        if ex:
            m = ex.month if hasattr(ex, "month") else int(str(ex)[5:7])
            monthly_avg[m] += float(d.get("amount_per_share", 0)) * quantity
            monthly_count[m] += 1

    result = []
    for month in range(1, 13):
        count = monthly_count.get(month, 0)
        projected = monthly_avg[month] / count if count > 0 else 0
        result.append({"month": month, "projected_amount": round(projected, 2)})
    return result
