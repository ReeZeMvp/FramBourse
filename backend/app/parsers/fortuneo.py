"""
Fortuneo XLS portfolio export parser.

File structure:
  Row 0: "Portefeuille XXXXXXXXXX"
  Row 1: "(PEA/CTO MME/M NOM PRENOM)"
  Row 2: date string "DD/MM/YYYY"
  Row 3: empty
  Row 4: headers — Libellé, Cours, (empty), Dev, Var/Veille, Qté, PRU,
                   Valorisation, +/- values, +/- values (%), Poids, ISIN
  Row 5+: data
"""

import re
from dataclasses import dataclass
from datetime import date
from io import BytesIO
from typing import Optional

import xlrd


@dataclass
class FortuneoHolding:
    name: str
    isin: Optional[str]
    quantity: float
    pru: float
    current_price: float
    currency: str
    valuation: float
    pnl: float
    pnl_pct: float
    weight: float
    var_veille: float


@dataclass
class FortuneoPortfolio:
    account_number: str
    account_label: str  # e.g. "PEA MME ALVES TAVARES AGATHE"
    export_date: Optional[date]
    holdings: list[FortuneoHolding]


def _parse_french_float(value) -> float:
    """Handle both numeric and string French-format numbers (comma as decimal)."""
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        cleaned = value.strip().replace("\xa0", "").replace(" ", "").replace(",", ".")
        try:
            return float(cleaned)
        except ValueError:
            return 0.0
    return 0.0


def _extract_account_number(cell_value: str) -> str:
    match = re.search(r"\d{10,}", str(cell_value))
    return match.group(0) if match else ""


def _parse_export_date(cell_value: str) -> Optional[date]:
    try:
        parts = str(cell_value).strip().split("/")
        if len(parts) == 3:
            return date(int(parts[2]), int(parts[1]), int(parts[0]))
    except Exception:
        pass
    return None


def parse_fortuneo_xls(file_bytes: bytes) -> FortuneoPortfolio:
    wb = xlrd.open_workbook(file_contents=file_bytes)
    ws = wb.sheet_by_index(0)

    account_number = _extract_account_number(ws.cell_value(0, 0))
    account_label = str(ws.cell_value(1, 0)).strip("()")
    export_date = _parse_export_date(ws.cell_value(2, 0))

    # Row 4 = headers, data starts row 5
    holdings: list[FortuneoHolding] = []
    for row_idx in range(5, ws.nrows):
        row = ws.row_values(row_idx)
        name = str(row[0]).strip()
        if not name:
            continue

        isin_raw = str(row[11]).strip() if len(row) > 11 else ""
        isin = isin_raw if len(isin_raw) == 12 else None

        holdings.append(
            FortuneoHolding(
                name=name,
                isin=isin,
                quantity=_parse_french_float(row[5]),
                pru=_parse_french_float(row[6]),
                current_price=_parse_french_float(row[1]),
                currency=str(row[3]).strip() if row[3] else "EUR",
                valuation=_parse_french_float(row[7]),
                pnl=_parse_french_float(row[8]),
                pnl_pct=_parse_french_float(row[9]),
                weight=_parse_french_float(row[10]),
                var_veille=_parse_french_float(row[4]),
            )
        )

    return FortuneoPortfolio(
        account_number=account_number,
        account_label=account_label,
        export_date=export_date,
        holdings=holdings,
    )


def parse_fortuneo_from_upload(file_bytes: bytes) -> FortuneoPortfolio:
    """Entry point for API upload handler."""
    return parse_fortuneo_xls(file_bytes)
