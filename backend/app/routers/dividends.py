from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.models import Dividend, Holding, Portfolio
from app.schemas.schemas import DividendOut
from app.services.performance import compute_dividend_growth_yoy, project_monthly_income

router = APIRouter(prefix="/dividends", tags=["dividends"])


@router.get("/", response_model=list[DividendOut])
async def list_dividends(
    user_id: int | None = None,
    portfolio_id: int | None = None,
    year: int | None = None,
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(Dividend)
        .join(Holding, Dividend.holding_id == Holding.id)
        .join(Portfolio, Holding.portfolio_id == Portfolio.id)
    )
    if user_id:
        q = q.where(Portfolio.user_id == user_id)
    if portfolio_id:
        q = q.where(Portfolio.id == portfolio_id)
    if year:
        q = q.where(Dividend.year == year)
    if status:
        q = q.where(Dividend.status == status)
    q = q.order_by(Dividend.ex_date.desc())
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/calendar")
async def dividend_calendar(
    user_id: int | None = None,
    months_ahead: int = 6,
    db: AsyncSession = Depends(get_db),
):
    """Return upcoming ex-dates and payment dates as a timeline."""
    today = date.today()
    q = (
        select(Dividend, Holding)
        .join(Holding, Dividend.holding_id == Holding.id)
        .join(Portfolio, Holding.portfolio_id == Portfolio.id)
        .where(Dividend.status.in_(["PENDING", "PROJECTED"]))
    )
    if user_id:
        q = q.where(Portfolio.user_id == user_id)

    result = await db.execute(q)
    rows = result.all()

    calendar = []
    for div, holding in rows:
        if div.ex_date and div.ex_date >= today:
            calendar.append({
                "holding_name": holding.name,
                "isin": holding.isin,
                "ticker": holding.ticker,
                "ex_date": div.ex_date.isoformat(),
                "payment_date": div.payment_date.isoformat() if div.payment_date else None,
                "amount_per_share": div.amount_per_share,
                "total_amount": div.total_amount,
                "currency": div.currency,
            })

    calendar.sort(key=lambda x: x["ex_date"])
    return calendar


@router.get("/yoc")
async def yield_on_cost(
    user_id: int | None = None,
    portfolio_id: int | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Yield on Cost (YOC) vs current yield for each holding with dividends."""
    q = (
        select(Holding)
        .join(Portfolio, Holding.portfolio_id == Portfolio.id)
        .options(selectinload(Holding.dividends))
    )
    if user_id:
        q = q.where(Portfolio.user_id == user_id)
    if portfolio_id:
        q = q.where(Portfolio.id == portfolio_id)

    result = await db.execute(q)
    holdings = result.scalars().all()

    rows = []
    for h in holdings:
        if not h.dividends:
            continue
        paid = [d for d in h.dividends if d.status == "PAID"]
        if not paid:
            continue

        # Annual dividend: sum last 12m
        recent_divs = sorted(paid, key=lambda d: d.ex_date or date.min, reverse=True)
        annual_div = sum(d.amount_per_share for d in recent_divs[:4])  # up to 4 payments

        current_yield = (annual_div / h.current_price * 100) if h.current_price else None
        yoc = (annual_div / h.pru * 100) if h.pru else None

        rows.append({
            "holding_id": h.id,
            "name": h.name,
            "isin": h.isin,
            "pru": h.pru,
            "current_price": h.current_price,
            "quantity": h.quantity,
            "annual_div_per_share": round(annual_div, 4),
            "current_yield_pct": round(current_yield, 2) if current_yield else None,
            "yoc_pct": round(yoc, 2) if yoc else None,
            "total_annual_income": round(annual_div * h.quantity, 2),
        })

    rows.sort(key=lambda x: x.get("yoc_pct") or 0, reverse=True)
    return rows


@router.get("/growth")
async def dividend_growth(user_id: int | None = None, db: AsyncSession = Depends(get_db)):
    """Year-over-year dividend growth."""
    q = (
        select(Dividend)
        .join(Holding, Dividend.holding_id == Holding.id)
        .join(Portfolio, Holding.portfolio_id == Portfolio.id)
        .where(Dividend.status == "PAID")
    )
    if user_id:
        q = q.where(Portfolio.user_id == user_id)

    result = await db.execute(q)
    divs = result.scalars().all()

    raw = [{"year": d.year, "total_amount": d.total_amount or 0} for d in divs if d.year]
    return compute_dividend_growth_yoy(raw)


@router.get("/projection")
async def income_projection(user_id: int | None = None, db: AsyncSession = Depends(get_db)):
    """Monthly projected dividend income for the next 12 months."""
    q = (
        select(Dividend, Holding)
        .join(Holding, Dividend.holding_id == Holding.id)
        .join(Portfolio, Holding.portfolio_id == Portfolio.id)
    )
    if user_id:
        q = q.where(Portfolio.user_id == user_id)

    result = await db.execute(q)
    rows = result.all()

    all_divs = []
    for div, holding in rows:
        all_divs.append({
            "ex_date": div.ex_date,
            "amount_per_share": div.amount_per_share,
            "year": div.year,
            "quantity": holding.quantity,
        })

    return project_monthly_income(all_divs, quantity=1)


@router.get("/concentration")
async def dividend_concentration(user_id: int | None = None, db: AsyncSession = Depends(get_db)):
    """Top 3 income sources as % of total — dividend dependency risk."""
    q = (
        select(Holding)
        .join(Portfolio, Holding.portfolio_id == Portfolio.id)
        .options(selectinload(Holding.dividends))
    )
    if user_id:
        q = q.where(Portfolio.user_id == user_id)

    result = await db.execute(q)
    holdings = result.scalars().all()

    income_by_holding = []
    for h in holdings:
        paid = [d for d in h.dividends if d.status == "PAID"]
        if not paid:
            continue
        annual = sum(d.amount_per_share for d in sorted(paid, key=lambda d: d.ex_date or date.min, reverse=True)[:4])
        total_income = annual * h.quantity
        if total_income > 0:
            income_by_holding.append({"name": h.name, "isin": h.isin, "income": round(total_income, 2)})

    total = sum(x["income"] for x in income_by_holding) or 1
    income_by_holding.sort(key=lambda x: x["income"], reverse=True)

    for item in income_by_holding:
        item["share_pct"] = round(item["income"] / total * 100, 1)

    top3_share = sum(x["income"] for x in income_by_holding[:3]) / total * 100

    return {
        "top_3_share_pct": round(top3_share, 1),
        "holdings": income_by_holding[:10],
        "total_annual_income": round(total, 2),
    }
