"""
ISIN → Yahoo Finance ticker resolution + yfinance data enrichment.

Strategy (in order):
  1. OpenFIGI API  (free, 25k req/day, returns exchange + ticker)
  2. Country-code heuristic  (ISIN prefix → exchange suffix)
  3. yfinance search fallback

European exchange suffixes for Yahoo Finance:
  FR → .PA   (Euronext Paris)
  NL → .AS   (Euronext Amsterdam)
  DE → .DE   (XETRA)
  BE → .BR   (Euronext Brussels)
  IT → .MI   (Borsa Italiana)
  ES → .MC   (Bolsa Madrid)
  PT → .LS   (Euronext Lisbon)
  CH → .SW   (SIX Swiss)
  SE → .ST   (Nasdaq Stockholm)
  DK → .CO   (Nasdaq Copenhagen)
  NO → .OL   (Oslo Børs)
  FI → .HE   (Nasdaq Helsinki)
  LU → .LU
  IE → .IR   (Euronext Dublin / or .L for LSE-listed Irish ETFs)
  GB → .L    (London Stock Exchange)
"""

import asyncio
import logging
from datetime import date, timedelta
from typing import Optional

import httpx
import yfinance as yf

from app.config import settings

logger = logging.getLogger(__name__)

COUNTRY_SUFFIX: dict[str, str] = {
    "FR": ".PA",
    "NL": ".AS",
    "DE": ".DE",
    "BE": ".BR",
    "IT": ".MI",
    "ES": ".MC",
    "PT": ".LS",
    "CH": ".SW",
    "SE": ".ST",
    "DK": ".CO",
    "NO": ".OL",
    "FI": ".HE",
    "LU": ".LU",
    "GB": ".L",
    "IE": ".IR",
    # North America — no suffix needed for Yahoo
    "US": "",
    "CA": ".TO",
    # Asia
    "JP": ".T",
    "HK": ".HK",
    "CN": ".SS",
    "KR": ".KS",
    "AU": ".AX",
}

OPENFIGI_URL = "https://api.openfigi.com/v3/mapping"


async def _resolve_via_openfigi(isin: str) -> Optional[str]:
    """Call OpenFIGI to get the ticker + exchange for an ISIN."""
    headers = {"Content-Type": "application/json"}
    if settings.OPENFIGI_API_KEY:
        headers["X-OPENFIGI-APIKEY"] = settings.OPENFIGI_API_KEY

    country = isin[:2]
    # Prefer main listing exchange
    mic_map = {
        "FR": "XPAR", "NL": "XAMS", "DE": "XETR", "BE": "XBRU",
        "IT": "XMIL", "ES": "XMAD", "GB": "XLON", "CH": "XSWX",
        "SE": "XSTO", "DK": "XCSE", "NO": "XOSL", "FI": "XHEL",
    }
    payload = [{"idType": "ID_ISIN", "idValue": isin}]
    if country in mic_map:
        payload[0]["exchCode"] = mic_map[country]

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(OPENFIGI_URL, json=payload, headers=headers)
            if resp.status_code != 200:
                return None
            data = resp.json()
            if data and data[0].get("data"):
                ticker = data[0]["data"][0].get("ticker", "")
                suffix = COUNTRY_SUFFIX.get(country, "")
                return f"{ticker}{suffix}" if ticker else None
    except Exception as e:
        logger.warning(f"OpenFIGI failed for {isin}: {e}")
    return None


def _heuristic_ticker(isin: str, name: str) -> Optional[str]:
    """
    Last-resort heuristic: extract ticker from the holding name.
    Fortuneo export puts the ticker in parentheses: "AIR LIQUIDE (AI)".
    """
    import re
    # Extract "(TICKER)" from name — only if 2-6 uppercase chars
    match = re.search(r"\(([A-Z0-9]{1,6})\)$", name.strip())
    if match:
        ticker_base = match.group(1)
        country = isin[:2]
        suffix = COUNTRY_SUFFIX.get(country, "")
        return f"{ticker_base}{suffix}"
    return None


async def resolve_ticker(isin: str, name: str = "") -> Optional[str]:
    """Resolve an ISIN to its Yahoo Finance ticker symbol."""
    # 1. Try OpenFIGI
    ticker = await _resolve_via_openfigi(isin)
    if ticker:
        return ticker

    # 2. Heuristic from name
    ticker = _heuristic_ticker(isin, name)
    if ticker:
        return ticker

    return None


def _classify_asset_type(name: str, isin: str) -> str:
    name_upper = name.upper()
    keywords_etf = ["ETF", "UCITS", "INDEX", "TRACKER", "MSCI", "CAC", "STOXX", "S&P"]
    keywords_fund = ["FCPE", "OPCVM", "FCP", "SICAV", "AMUNDI LABEL", "AMUNDI ACTIONS"]
    keywords_bond = ["OBLIGAT", "BOND", "TERM", "CREDIT"]

    if any(k in name_upper for k in keywords_etf):
        return "ETF"
    if any(k in name_upper for k in keywords_fund):
        return "OPCVM"
    if any(k in name_upper for k in keywords_bond):
        return "Obligations"
    return "Actions"


def _classify_geography(isin: str, sector: str = "") -> str:
    country = isin[:2]
    geo_map = {
        "FR": "Europe", "DE": "Europe", "NL": "Europe", "BE": "Europe",
        "IT": "Europe", "ES": "Europe", "CH": "Europe", "SE": "Europe",
        "DK": "Europe", "NO": "Europe", "FI": "Europe", "PT": "Europe",
        "LU": "Europe", "GB": "Europe", "IE": "Europe",
        "US": "USA", "CA": "USA",
        "JP": "Asie", "HK": "Asie", "CN": "Asie", "KR": "Asie",
        "AU": "Asie",
    }
    return geo_map.get(country, "Émergents")


SECTOR_MAP = {
    # yfinance sector strings → normalized
    "Technology": "Tech",
    "Information Technology": "Tech",
    "Consumer Cyclical": "Consommation",
    "Consumer Defensive": "Consommation",
    "Healthcare": "Santé",
    "Health Care": "Santé",
    "Financial Services": "Finance",
    "Financials": "Finance",
    "Energy": "Énergie",
    "Basic Materials": "Matériaux",
    "Materials": "Matériaux",
    "Industrials": "Industriels",
    "Real Estate": "Immobilier",
    "Utilities": "Services publics",
    "Communication Services": "Telecom/Media",
}


def enrich_holding_from_yfinance(ticker: str, isin: str, name: str) -> dict:
    """
    Pull metadata + dividend history from yfinance.
    Returns a dict with fields to update on the Holding model.
    """
    result: dict = {
        "ticker": ticker,
        "asset_type": _classify_asset_type(name, isin),
        "geography": _classify_geography(isin),
        "country": isin[:2],
    }

    try:
        info = yf.Ticker(ticker).info
        result["current_price"] = info.get("currentPrice") or info.get("regularMarketPrice")
        result["dividend_yield"] = info.get("dividendYield")  # as decimal, e.g. 0.035

        raw_sector = info.get("sector", "")
        result["sector"] = SECTOR_MAP.get(raw_sector, raw_sector or "Autre")

        # Override geography for world/mixed ETFs
        long_name = (info.get("longName") or "").upper()
        if any(k in long_name for k in ["WORLD", "GLOBAL", "MSCI WORLD"]):
            result["geography"] = "Monde"
        elif any(k in long_name for k in ["EMERGING", "ÉMERGENT"]):
            result["geography"] = "Émergents"
        elif any(k in long_name for k in ["ASIA", "JAPON", "TOPIX", "JAPAN"]):
            result["geography"] = "Asie"
        elif any(k in long_name for k in ["LATIN", "LATAM"]):
            result["geography"] = "Émergents"
        elif any(k in long_name for k in ["EUROPE", "STOXX", "EURONEXT"]):
            result["geography"] = "Europe"
        elif any(k in long_name for k in ["USA", "S&P 500", "S&P500", "NASDAQ"]):
            result["geography"] = "USA"

    except Exception as e:
        logger.warning(f"yfinance info failed for {ticker}: {e}")

    return result


async def fetch_dividends(ticker: str, isin: str) -> list[dict]:
    """
    Fetch dividend history from yfinance.
    Returns list of {ex_date, amount_per_share, year}.
    """
    dividends = []
    try:
        loop = asyncio.get_event_loop()
        tk = yf.Ticker(ticker)
        div_series = await loop.run_in_executor(None, lambda: tk.dividends)

        for ts, amount in div_series.items():
            ex_date = ts.date() if hasattr(ts, "date") else ts
            dividends.append({
                "ex_date": ex_date,
                "amount_per_share": float(amount),
                "year": ex_date.year,
                "status": "PAID" if ex_date < date.today() else "PENDING",
            })
    except Exception as e:
        logger.warning(f"yfinance dividends failed for {ticker}: {e}")

    return dividends


async def fetch_price_history(ticker: str, period: str = "2y") -> list[dict]:
    """Fetch OHLCV history, return list of {date, close}."""
    prices = []
    try:
        loop = asyncio.get_event_loop()
        tk = yf.Ticker(ticker)
        hist = await loop.run_in_executor(None, lambda: tk.history(period=period))
        for ts, row in hist.iterrows():
            prices.append({"date": ts.date(), "close": float(row["Close"])})
    except Exception as e:
        logger.warning(f"yfinance history failed for {ticker}: {e}")
    return prices
