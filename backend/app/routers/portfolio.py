from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.models import Holding, Portfolio
from app.schemas.schemas import HoldingOut, PortfolioCreate, PortfolioOut

router = APIRouter(prefix="/portfolios", tags=["portfolio"])


@router.get("/", response_model=list[PortfolioOut])
async def list_portfolios(user_id: int | None = None, db: AsyncSession = Depends(get_db)):
    q = select(Portfolio)
    if user_id:
        q = q.where(Portfolio.user_id == user_id)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/", response_model=PortfolioOut, status_code=201)
async def create_portfolio(payload: PortfolioCreate, db: AsyncSession = Depends(get_db)):
    portfolio = Portfolio(**payload.model_dump())
    db.add(portfolio)
    await db.commit()
    await db.refresh(portfolio)
    return portfolio


@router.get("/{portfolio_id}", response_model=PortfolioOut)
async def get_portfolio(portfolio_id: int, db: AsyncSession = Depends(get_db)):
    p = await db.get(Portfolio, portfolio_id)
    if not p:
        raise HTTPException(404, "Portfolio not found")
    return p


@router.delete("/{portfolio_id}", status_code=204)
async def delete_portfolio(portfolio_id: int, db: AsyncSession = Depends(get_db)):
    p = await db.get(Portfolio, portfolio_id)
    if not p:
        raise HTTPException(404, "Portfolio not found")
    await db.delete(p)
    await db.commit()


@router.get("/{portfolio_id}/holdings", response_model=list[HoldingOut])
async def list_holdings(portfolio_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Holding).where(Holding.portfolio_id == portfolio_id)
    )
    return result.scalars().all()


@router.get("/summary/all")
async def portfolio_summary(user_id: int | None = None, db: AsyncSession = Depends(get_db)):
    """
    Aggregate summary across all portfolios of a user (or all users).
    Returns totals + allocation breakdowns.
    """
    q = select(Portfolio).options(selectinload(Portfolio.holdings))
    if user_id:
        q = q.where(Portfolio.user_id == user_id)
    result = await db.execute(q)
    portfolios = result.scalars().all()

    total_valuation = 0.0
    total_cost = 0.0
    by_envelope: dict[str, float] = {}
    by_geography: dict[str, float] = {}
    by_sector: dict[str, float] = {}
    by_asset: dict[str, float] = {}
    top_holdings: list[dict] = []

    for p in portfolios:
        for h in p.holdings:
            val = h.valuation
            cost = h.cost_basis
            total_valuation += val
            total_cost += cost
            by_envelope[p.envelope_type] = by_envelope.get(p.envelope_type, 0) + val
            by_geography[h.geography or "Autre"] = by_geography.get(h.geography or "Autre", 0) + val
            by_sector[h.sector or "Autre"] = by_sector.get(h.sector or "Autre", 0) + val
            by_asset[h.asset_type or "Autre"] = by_asset.get(h.asset_type or "Autre", 0) + val
            top_holdings.append({"name": h.name, "value": val, "isin": h.isin})

    top_holdings.sort(key=lambda x: x["value"], reverse=True)

    def to_pct(d: dict) -> list[dict]:
        total = sum(d.values()) or 1
        return [{"label": k, "value": round(v / total * 100, 2)} for k, v in sorted(d.items(), key=lambda x: -x[1])]

    pnl = total_valuation - total_cost
    pnl_pct = (pnl / total_cost * 100) if total_cost > 0 else 0

    return {
        "total_valuation": round(total_valuation, 2),
        "total_cost": round(total_cost, 2),
        "pnl": round(pnl, 2),
        "pnl_pct": round(pnl_pct, 2),
        "by_envelope": to_pct(by_envelope),
        "by_geography": to_pct(by_geography),
        "by_sector": to_pct(by_sector),
        "by_asset": to_pct(by_asset),
        "top_10": top_holdings[:10],
    }
