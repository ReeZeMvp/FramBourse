from datetime import date, datetime
from typing import Optional

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    color: Mapped[str] = mapped_column(String(20), default="#a855f7")

    # PEA fiscal data (manual input)
    pea_opening_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    pea_deposits_total: Mapped[float] = mapped_column(Float, default=0.0)
    pea_withdrawals_total: Mapped[float] = mapped_column(Float, default=0.0)

    portfolios: Mapped[list["Portfolio"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Portfolio(Base):
    __tablename__ = "portfolios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String(100))
    # PEA | CTO | PEE | PER | CRYPTO
    envelope_type: Mapped[str] = mapped_column(String(20))
    account_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    broker: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    last_import: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    user: Mapped["User"] = relationship(back_populates="portfolios")
    holdings: Mapped[list["Holding"]] = relationship(back_populates="portfolio", cascade="all, delete-orphan")
    transactions: Mapped[list["Transaction"]] = relationship(back_populates="portfolio", cascade="all, delete-orphan")
    import_batches: Mapped[list["ImportBatch"]] = relationship(back_populates="portfolio", cascade="all, delete-orphan")


class Holding(Base):
    __tablename__ = "holdings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    portfolio_id: Mapped[int] = mapped_column(ForeignKey("portfolios.id"))
    isin: Mapped[Optional[str]] = mapped_column(String(12), nullable=True, index=True)
    ticker: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    name: Mapped[str] = mapped_column(String(200))
    quantity: Mapped[float] = mapped_column(Float, default=0.0)
    pru: Mapped[float] = mapped_column(Float, default=0.0)  # Prix de Revient Unitaire
    current_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="EUR")
    # Actions | ETF | Obligations | Cash | Crypto | OPCVM
    asset_type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    sector: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    # FR | US | EU | ASIA | EM | WORLD
    geography: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    # Country ISO code
    country: Mapped[Optional[str]] = mapped_column(String(2), nullable=True)
    weight: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    pnl: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    pnl_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    # Dividend yield (current)
    dividend_yield: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    price_updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    portfolio: Mapped["Portfolio"] = relationship(back_populates="holdings")
    dividends: Mapped[list["Dividend"]] = relationship(back_populates="holding", cascade="all, delete-orphan")

    @property
    def valuation(self) -> float:
        return self.quantity * (self.current_price or self.pru)

    @property
    def cost_basis(self) -> float:
        return self.quantity * self.pru

    @property
    def yoc(self) -> Optional[float]:
        """Yield on Cost — rendement sur PRU."""
        if not self.dividend_yield or not self.current_price or not self.pru:
            return None
        annual_div_per_share = self.dividend_yield * self.current_price
        return annual_div_per_share / self.pru if self.pru > 0 else None


class Dividend(Base):
    __tablename__ = "dividends"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    holding_id: Mapped[int] = mapped_column(ForeignKey("holdings.id"))
    ex_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    payment_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    amount_per_share: Mapped[float] = mapped_column(Float)
    total_amount: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="EUR")
    # PAID | PENDING | PROJECTED
    status: Mapped[str] = mapped_column(String(20), default="PENDING")
    year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    holding: Mapped["Holding"] = relationship(back_populates="dividends")


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    portfolio_id: Mapped[int] = mapped_column(ForeignKey("portfolios.id"))
    date: Mapped[date] = mapped_column(Date)
    isin: Mapped[Optional[str]] = mapped_column(String(12), nullable=True)
    name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    # BUY | SELL | DIVIDEND | DEPOSIT | WITHDRAWAL | FEE
    transaction_type: Mapped[str] = mapped_column(String(20))
    quantity: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    amount: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(3), default="EUR")
    fees: Mapped[float] = mapped_column(Float, default=0.0)

    portfolio: Mapped["Portfolio"] = relationship(back_populates="transactions")


class ImportBatch(Base):
    __tablename__ = "import_batches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    portfolio_id: Mapped[int] = mapped_column(ForeignKey("portfolios.id"))
    filename: Mapped[str] = mapped_column(String(255))
    source: Mapped[str] = mapped_column(String(50))  # FORTUNEO | AMUNDI
    imported_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    row_count: Mapped[int] = mapped_column(Integer, default=0)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    portfolio: Mapped["Portfolio"] = relationship(back_populates="import_batches")


class PriceHistory(Base):
    __tablename__ = "price_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ticker: Mapped[str] = mapped_column(String(20), index=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    close: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(3), default="EUR")
