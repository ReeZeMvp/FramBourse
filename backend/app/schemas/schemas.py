from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel


class UserCreate(BaseModel):
    name: str
    color: str = "#a855f7"
    pea_opening_date: Optional[date] = None
    pea_deposits_total: float = 0.0
    pea_withdrawals_total: float = 0.0


class UserUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    pea_opening_date: Optional[date] = None
    pea_deposits_total: Optional[float] = None
    pea_withdrawals_total: Optional[float] = None


class UserOut(BaseModel):
    id: int
    name: str
    color: str
    pea_opening_date: Optional[date]
    pea_deposits_total: float
    pea_withdrawals_total: float

    class Config:
        from_attributes = True


class PortfolioCreate(BaseModel):
    user_id: int
    name: str
    envelope_type: str
    account_number: Optional[str] = None
    broker: Optional[str] = None


class PortfolioOut(BaseModel):
    id: int
    user_id: int
    name: str
    envelope_type: str
    account_number: Optional[str]
    broker: Optional[str]
    last_import: Optional[datetime]

    class Config:
        from_attributes = True


class HoldingOut(BaseModel):
    id: int
    portfolio_id: int
    isin: Optional[str]
    ticker: Optional[str]
    name: str
    quantity: float
    pru: float
    current_price: Optional[float]
    currency: str
    asset_type: Optional[str]
    sector: Optional[str]
    geography: Optional[str]
    country: Optional[str]
    weight: Optional[float]
    pnl: Optional[float]
    pnl_pct: Optional[float]
    dividend_yield: Optional[float]
    valuation: float
    cost_basis: float
    yoc: Optional[float]

    class Config:
        from_attributes = True


class DividendOut(BaseModel):
    id: int
    holding_id: int
    ex_date: Optional[date]
    payment_date: Optional[date]
    amount_per_share: float
    total_amount: Optional[float]
    currency: str
    status: str
    year: Optional[int]

    class Config:
        from_attributes = True


class ImportResult(BaseModel):
    portfolio_id: int
    source: str
    holdings_imported: int
    filename: str
    notes: Optional[str] = None
