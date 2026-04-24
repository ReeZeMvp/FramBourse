"""
Amundi / PEE / PERCOL XLSB export parser.

Sheet: "Mes avoirs par échéance"
  Row 0: headers — Libellé dispositif, (company), Libellé FCPE, Échéance,
                   nombre de parts, VL, Montant évalué, Montant Total de l'échéance
  Row 1: internal field names (skip)
  Row 2+: data rows; rows starting with " Ligne Total" are subtotals (skip)

Each data row maps to a fund holding with:
  - dispositif  : envelope type  (PEE / Percol Libre / ...)
  - company     : employer name
  - fund_name   : FCPE label
  - maturity     : availability date or "RETRAITE"
  - shares       : nombre de parts
  - nav          : VL (valeur liquidative)
  - amount       : Montant évalué (shares × nav)
"""

from dataclasses import dataclass
from datetime import date
from typing import Optional

from pyxlsb import open_workbook


@dataclass
class AmundiHolding:
    dispositif: str
    company: str
    fund_name: str
    maturity: Optional[str]  # "RETRAITE" or date string
    shares: float
    nav: float
    amount: float
    maturity_date: Optional[date]


@dataclass
class AmundiPortfolio:
    owner_name: str
    holdings: list[AmundiHolding]
    total_amount: float


def _parse_excel_date(val) -> Optional[date]:
    """Excel serial date to Python date."""
    if val is None:
        return None
    if isinstance(val, str):
        val = val.strip()
        if not val or val.upper() == "RETRAITE":
            return None
        try:
            parts = val.split("/")
            if len(parts) == 3:
                return date(int(parts[2]), int(parts[1]), int(parts[0]))
        except Exception:
            pass
        return None
    # xlsb stores dates as floats (Excel serial)
    if isinstance(val, (int, float)):
        try:
            from datetime import timedelta
            base = date(1899, 12, 30)
            return base + timedelta(days=int(val))
        except Exception:
            return None
    return None


def _extract_owner_from_metadata(wb) -> str:
    """Read hidden 'Donnees' sheet to extract employee name."""
    try:
        with wb.get_sheet("Donnees") as ws:
            rows = list(ws.rows())
            nom = prenom = ""
            for row in rows[:10]:
                vals = [c.v for c in row]
                if len(vals) >= 3:
                    if vals[1] == "indNom":
                        nom = str(vals[2] or "")
                    if vals[1] == "indPrenom":
                        prenom = str(vals[2] or "")
            return f"{prenom} {nom}".strip()
    except Exception:
        return ""


def parse_amundi_xlsb(file_bytes: bytes) -> AmundiPortfolio:
    import tempfile, os

    # pyxlsb needs a file path, write temp file
    with tempfile.NamedTemporaryFile(suffix=".xlsb", delete=False) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        with open_workbook(tmp_path) as wb:
            owner = _extract_owner_from_metadata(wb)
            with wb.get_sheet("Mes avoirs par échéance") as ws:
                rows = list(ws.rows())

            holdings: list[AmundiHolding] = []
            total_amount = 0.0

            # Row 0 = column headers, Row 1 = field names, data from row 2
            for row in rows[2:]:
                vals = [c.v for c in row]
                if not vals or vals[0] is None and all(v is None for v in vals[1:5]):
                    continue

                row_type = str(vals[0] or "").strip()
                if "Ligne Total" in row_type or row_type.startswith("posSal"):
                    # Capture grand total if present
                    if "Ligne Total" in row_type and vals[8] is not None:
                        pass  # individual totals per maturity, not the grand total
                    continue

                dispositif = str(vals[1] or "").strip()
                company = str(vals[2] or "").strip()
                fund_name = str(vals[3] or "").strip()
                maturity_raw = vals[4]
                shares = float(vals[5] or 0)
                nav = float(vals[6] or 0)
                amount = float(vals[7] or 0)

                if not fund_name:
                    continue

                maturity_str: Optional[str] = None
                maturity_date: Optional[date] = None

                if maturity_raw is not None:
                    if isinstance(maturity_raw, str) and maturity_raw.strip().upper() == "RETRAITE":
                        maturity_str = "RETRAITE"
                    elif isinstance(maturity_raw, (int, float)):
                        maturity_date = _parse_excel_date(maturity_raw)
                        maturity_str = maturity_date.strftime("%d/%m/%Y") if maturity_date else None
                    else:
                        maturity_str = str(maturity_raw).strip()
                        maturity_date = _parse_excel_date(maturity_str)

                total_amount += amount
                holdings.append(
                    AmundiHolding(
                        dispositif=dispositif,
                        company=company,
                        fund_name=fund_name,
                        maturity=maturity_str,
                        shares=shares,
                        nav=nav,
                        amount=amount,
                        maturity_date=maturity_date,
                    )
                )

        return AmundiPortfolio(owner_name=owner, holdings=holdings, total_amount=total_amount)
    finally:
        os.unlink(tmp_path)


def parse_amundi_from_upload(file_bytes: bytes) -> AmundiPortfolio:
    return parse_amundi_xlsb(file_bytes)
