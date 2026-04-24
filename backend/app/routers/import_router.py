"""
Import router — handles file uploads (Fortuneo XLS, Amundi XLSB)
and triggers ISIN enrichment via yfinance.
"""

import asyncio
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import Dividend, Holding, ImportBatch, Portfolio
from app.parsers.amundi import parse_amundi_from_upload
from app.parsers.fortuneo import parse_fortuneo_from_upload
from app.schemas.schemas import ImportResult
from app.services.enrichment import (
    enrich_holding_from_yfinance,
    fetch_dividends,
    resolve_ticker,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/import", tags=["import"])


@router.post("/fortuneo", response_model=ImportResult)
async def import_fortuneo(
    file: UploadFile = File(...),
    portfolio_id: int = Form(...),
    enrich: bool = Form(True),
    db: AsyncSession = Depends(get_db),
):
    portfolio = await db.get(Portfolio, portfolio_id)
    if not portfolio:
        raise HTTPException(404, "Portfolio not found")

    content = await file.read()
    try:
        parsed = parse_fortuneo_from_upload(content)
    except Exception as e:
        raise HTTPException(400, f"Parse error: {e}")

    # Clear existing holdings for this portfolio (full replace strategy)
    existing = await db.execute(select(Holding).where(Holding.portfolio_id == portfolio_id))
    for h in existing.scalars().all():
        await db.delete(h)
    await db.flush()

    imported = 0
    for fh in parsed.holdings:
        holding = Holding(
            portfolio_id=portfolio_id,
            isin=fh.isin,
            name=fh.name,
            quantity=fh.quantity,
            pru=fh.pru,
            current_price=fh.current_price,
            currency=fh.currency,
            pnl=fh.pnl,
            pnl_pct=fh.pnl_pct,
            weight=fh.weight,
        )

        if enrich and fh.isin:
            try:
                ticker = await resolve_ticker(fh.isin, fh.name)
                if ticker:
                    meta = enrich_holding_from_yfinance(ticker, fh.isin, fh.name)
                    for k, v in meta.items():
                        if v is not None:
                            setattr(holding, k, v)
                    holding.price_updated_at = datetime.utcnow()

                    # Fetch and store dividends
                    divs = await fetch_dividends(ticker, fh.isin)
                    db.add(holding)
                    await db.flush()  # get holding.id

                    for dv in divs:
                        total = dv["amount_per_share"] * fh.quantity
                        div_obj = Dividend(
                            holding_id=holding.id,
                            ex_date=dv["ex_date"],
                            amount_per_share=dv["amount_per_share"],
                            total_amount=round(total, 4),
                            currency=fh.currency,
                            status=dv["status"],
                            year=dv["year"],
                        )
                        db.add(div_obj)
                    imported += 1
                    continue
            except Exception as e:
                logger.warning(f"Enrichment failed for {fh.isin}: {e}")

        db.add(holding)
        imported += 1

    batch = ImportBatch(
        portfolio_id=portfolio_id,
        filename=file.filename or "upload.xls",
        source="FORTUNEO",
        row_count=imported,
    )
    db.add(batch)
    portfolio.last_import = datetime.utcnow()

    await db.commit()

    return ImportResult(
        portfolio_id=portfolio_id,
        source="FORTUNEO",
        holdings_imported=imported,
        filename=file.filename or "",
        notes=f"Export du {parsed.export_date} — {parsed.account_label}",
    )


@router.post("/amundi", response_model=ImportResult)
async def import_amundi(
    file: UploadFile = File(...),
    portfolio_id: int = Form(...),
    db: AsyncSession = Depends(get_db),
):
    portfolio = await db.get(Portfolio, portfolio_id)
    if not portfolio:
        raise HTTPException(404, "Portfolio not found")

    content = await file.read()
    try:
        parsed = parse_amundi_from_upload(content)
    except Exception as e:
        raise HTTPException(400, f"Parse error: {e}")

    # Clear existing holdings
    existing = await db.execute(select(Holding).where(Holding.portfolio_id == portfolio_id))
    for h in existing.scalars().all():
        await db.delete(h)
    await db.flush()

    # Group holdings by fund (sum across maturities)
    fund_map: dict[str, dict] = {}
    for ah in parsed.holdings:
        key = ah.fund_name
        if key not in fund_map:
            fund_map[key] = {
                "name": ah.fund_name,
                "dispositif": ah.dispositif,
                "shares": 0.0,
                "amount": 0.0,
                "nav": ah.nav,
            }
        fund_map[key]["shares"] += ah.shares
        fund_map[key]["amount"] += ah.amount

    imported = 0
    for fund_name, data in fund_map.items():
        holding = Holding(
            portfolio_id=portfolio_id,
            name=data["name"],
            quantity=data["shares"],
            pru=data["nav"],
            current_price=data["nav"],
            currency="EUR",
            asset_type="OPCVM",
            geography="Monde",
        )
        db.add(holding)
        imported += 1

    batch = ImportBatch(
        portfolio_id=portfolio_id,
        filename=file.filename or "upload.xlsb",
        source="AMUNDI",
        row_count=imported,
        notes=f"Propriétaire: {parsed.owner_name} — Total: {parsed.total_amount:.2f}€",
    )
    db.add(batch)
    portfolio.last_import = datetime.utcnow()

    await db.commit()

    return ImportResult(
        portfolio_id=portfolio_id,
        source="AMUNDI",
        holdings_imported=imported,
        filename=file.filename or "",
        notes=f"Propriétaire: {parsed.owner_name}",
    )


@router.get("/history/{portfolio_id}")
async def import_history(portfolio_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ImportBatch)
        .where(ImportBatch.portfolio_id == portfolio_id)
        .order_by(ImportBatch.imported_at.desc())
    )
    batches = result.scalars().all()
    return [
        {
            "id": b.id,
            "filename": b.filename,
            "source": b.source,
            "imported_at": b.imported_at.isoformat(),
            "row_count": b.row_count,
            "notes": b.notes,
        }
        for b in batches
    ]
