from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import Holding, Portfolio, PriceHistory
from app.services.performance import BENCHMARK_TICKERS, fetch_benchmark_returns

router = APIRouter(prefix="/performance", tags=["performance"])


@router.get("/benchmarks")
async def get_benchmarks(
    ticker: str = Query("CW8.PA", description="Benchmark Yahoo ticker"),
    start: date = Query(default_factory=lambda: date(date.today().year - 2, 1, 1)),
):
    """Return daily cumulative returns for a benchmark."""
    return await fetch_benchmark_returns(ticker, start)


@router.get("/benchmarks/list")
async def list_benchmarks():
    return [{"name": k, "ticker": v} for k, v in BENCHMARK_TICKERS.items()]


@router.get("/pea-vs-cto")
async def pea_vs_cto(user_id: int, db: AsyncSession = Depends(get_db)):
    """
    Compare PEA vs CTO performance (valuation + cost + PnL per envelope).
    Fiscal note: PEA gains taxed at 17.2% flat after 5 years (PFU-exempt);
    CTO at 30% flat tax (PFU).
    """
    q = (
        select(Portfolio)
        .where(Portfolio.user_id == user_id)
    )
    result = await db.execute(q)
    portfolios = result.scalars().all()

    data = {}
    for p in portfolios:
        hq = await db.execute(select(Holding).where(Holding.portfolio_id == p.id))
        holdings = hq.scalars().all()
        valuation = sum(h.valuation for h in holdings)
        cost = sum(h.cost_basis for h in holdings)
        pnl = valuation - cost

        # Net-of-tax PnL
        if p.envelope_type == "PEA":
            tax_rate = 0.172  # only social charges after 5y
        elif p.envelope_type == "CTO":
            tax_rate = 0.30   # PFU flat tax
        else:
            tax_rate = 0.0

        net_pnl = pnl * (1 - tax_rate) if pnl > 0 else pnl

        data[p.envelope_type] = {
            "portfolio_id": p.id,
            "name": p.name,
            "valuation": round(valuation, 2),
            "cost": round(cost, 2),
            "gross_pnl": round(pnl, 2),
            "gross_pnl_pct": round(pnl / cost * 100, 2) if cost else 0,
            "tax_rate_pct": tax_rate * 100,
            "net_pnl": round(net_pnl, 2),
            "net_pnl_pct": round(net_pnl / cost * 100, 2) if cost else 0,
        }

    return data


@router.get("/currency-exposure")
async def currency_exposure(user_id: int | None = None, db: AsyncSession = Depends(get_db)):
    """Real currency exposure EUR / USD / GBP / Other."""
    q = (
        select(Holding)
        .join(Portfolio, Holding.portfolio_id == Portfolio.id)
    )
    if user_id:
        q = q.where(Portfolio.user_id == user_id)

    result = await db.execute(q)
    holdings = result.scalars().all()

    by_currency: dict[str, float] = {}
    for h in holdings:
        cur = h.currency or "EUR"
        by_currency[cur] = by_currency.get(cur, 0) + h.valuation

    total = sum(by_currency.values()) or 1
    return [
        {"currency": k, "value": round(v, 2), "pct": round(v / total * 100, 1)}
        for k, v in sorted(by_currency.items(), key=lambda x: -x[1])
    ]


@router.get("/concentration")
async def concentration_risk(user_id: int | None = None, db: AsyncSession = Depends(get_db)):
    """Top 10 holdings as % of total portfolio value."""
    q = (
        select(Holding)
        .join(Portfolio, Holding.portfolio_id == Portfolio.id)
    )
    if user_id:
        q = q.where(Portfolio.user_id == user_id)

    result = await db.execute(q)
    holdings = result.scalars().all()

    total = sum(h.valuation for h in holdings) or 1
    rows = [
        {
            "name": h.name,
            "isin": h.isin,
            "ticker": h.ticker,
            "valuation": round(h.valuation, 2),
            "share_pct": round(h.valuation / total * 100, 1),
            "sector": h.sector,
            "geography": h.geography,
        }
        for h in holdings
    ]
    rows.sort(key=lambda x: x["valuation"], reverse=True)
    top10_share = sum(r["valuation"] for r in rows[:10]) / total * 100
    return {"top_10_share_pct": round(top10_share, 1), "holdings": rows[:10]}
