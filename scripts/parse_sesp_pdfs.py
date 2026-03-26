#!/usr/bin/env python3
"""
parse_sesp_pdfs.py - Extract tabular data from SESP-PR PDF reports.

Parses PDF reports downloaded by download_data.py from data/raw/sesp_pr/
and produces structured JSON files in data/processed/.

Report types:
  - drogas       -> sesp_pr_drogas.json   (drug seizure data)
  - criminal     -> sesp_pr_criminal.json (criminal statistics)
  - mortes_violentas -> sesp_pr_mortes_violentas.json (lethal violence)
  - transito     -> sesp_pr_transito.json (traffic data)

Also updates drogas.json with actual parsed data from drug PDFs.
"""

import json
import logging
import re
import sys
from pathlib import Path
from typing import Any

import pandas as pd
import pdfplumber

BASE_DIR = Path(__file__).parent.parent
RAW_DIR = BASE_DIR / "data" / "raw" / "sesp_pr"
PROCESSED_DIR = BASE_DIR / "data" / "processed"
DASHBOARD_DIR = BASE_DIR / "dashboard" / "public" / "data"

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Filename parsing
# ---------------------------------------------------------------------------

_FILENAME_RE = re.compile(
    r"^(?P<year>\d{4})"
    r"(?:_(?P<quarter>\d)tri)?"
    r"_(?P<report_type>[a-z_]+)"
    r"\.pdf$"
)


def parse_filename(name: str) -> dict[str, Any] | None:
    """Extract year, quarter (optional), and report type from a PDF filename."""
    m = _FILENAME_RE.match(name)
    if m is None:
        return None
    return {
        "year": int(m.group("year")),
        "quarter": int(m.group("quarter")) if m.group("quarter") else None,
        "report_type": m.group("report_type"),
    }


# ---------------------------------------------------------------------------
# Generic table extraction
# ---------------------------------------------------------------------------

def extract_tables_from_pdf(pdf_path: Path) -> list[pd.DataFrame]:
    """Open a PDF with pdfplumber and return all extractable tables as DataFrames."""
    tables: list[pd.DataFrame] = []
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page_num, page in enumerate(pdf.pages, start=1):
                try:
                    extracted = page.extract_tables()
                    if not extracted:
                        continue
                    for table in extracted:
                        if table and len(table) > 1:
                            header = table[0]
                            rows = table[1:]
                            df = pd.DataFrame(rows, columns=header)
                            # Drop completely empty rows/columns
                            df = df.dropna(how="all").dropna(axis=1, how="all")
                            if not df.empty:
                                tables.append(df)
                except Exception:
                    logger.warning(
                        "Failed to extract table from page %d of %s",
                        page_num,
                        pdf_path.name,
                    )
    except Exception:
        logger.warning("Could not open PDF: %s (may be scanned/corrupted)", pdf_path.name)
    return tables


# ---------------------------------------------------------------------------
# Per-type parsers
# ---------------------------------------------------------------------------

def _clean_numeric(value: Any) -> int | None:
    """Convert a cell value to int, handling dots/commas as thousands separators."""
    if value is None:
        return None
    s = str(value).strip().replace(".", "").replace(",", "")
    s = re.sub(r"[^\d-]", "", s)
    if not s or s == "-":
        return None
    try:
        return int(s)
    except ValueError:
        return None


def parse_drogas_pdf(pdf_path: Path, year: int, quarter: int | None) -> list[dict]:
    """
    Parse a drug seizure PDF.

    Returns list of dicts with keys: tipo_droga, quantidade, unidade, ano, trimestre.
    """
    tables = extract_tables_from_pdf(pdf_path)
    if not tables:
        logger.info("No tables found in %s", pdf_path.name)
        return []

    records: list[dict] = []
    for df in tables:
        if df.shape[1] < 2:
            continue

        cols_lower = [str(c).lower().strip() if c else "" for c in df.columns]

        # Try to identify drug-type column and quantity column
        tipo_col: int | None = None
        qtd_col: int | None = None

        for i, col in enumerate(cols_lower):
            if any(kw in col for kw in ("droga", "tipo", "substância", "substancia", "natureza")):
                tipo_col = i
            if any(kw in col for kw in ("quantidade", "qtd", "apreens", "total", "kg", "unidade")):
                if qtd_col is None:
                    qtd_col = i

        # Fallback: first column = type, second = quantity
        if tipo_col is None:
            tipo_col = 0
        if qtd_col is None:
            qtd_col = 1 if df.shape[1] > 1 else 0

        for _, row in df.iterrows():
            tipo_val = str(row.iloc[tipo_col]).strip() if row.iloc[tipo_col] else ""
            if not tipo_val or tipo_val.lower() in ("total", "none", "nan", ""):
                continue
            qtd_val = _clean_numeric(row.iloc[qtd_col])

            records.append({
                "tipo_droga": tipo_val,
                "quantidade": qtd_val,
                "ano": year,
                "trimestre": quarter,
            })

    logger.info("Parsed %d drug records from %s", len(records), pdf_path.name)
    return records


def parse_criminal_pdf(pdf_path: Path, year: int, quarter: int | None) -> list[dict]:
    """
    Parse a criminal statistics PDF.

    Returns list of dicts with keys: tipo_crime, ocorrencias, ano, trimestre.
    """
    tables = extract_tables_from_pdf(pdf_path)
    if not tables:
        logger.info("No tables found in %s", pdf_path.name)
        return []

    records: list[dict] = []
    for df in tables:
        if df.shape[1] < 2:
            continue

        cols_lower = [str(c).lower().strip() if c else "" for c in df.columns]

        tipo_col: int | None = None
        ocorr_col: int | None = None

        for i, col in enumerate(cols_lower):
            if any(kw in col for kw in ("crime", "tipo", "natureza", "delito", "infração")):
                tipo_col = i
            if any(kw in col for kw in ("ocorrência", "ocorrencia", "total", "registr", "quant")):
                if ocorr_col is None:
                    ocorr_col = i

        if tipo_col is None:
            tipo_col = 0
        if ocorr_col is None:
            ocorr_col = min(1, df.shape[1] - 1)

        for _, row in df.iterrows():
            tipo_val = str(row.iloc[tipo_col]).strip() if row.iloc[tipo_col] else ""
            if not tipo_val or tipo_val.lower() in ("total", "none", "nan", ""):
                continue
            ocorr_val = _clean_numeric(row.iloc[ocorr_col])

            records.append({
                "tipo_crime": tipo_val,
                "ocorrencias": ocorr_val,
                "ano": year,
                "trimestre": quarter,
            })

    logger.info("Parsed %d criminal records from %s", len(records), pdf_path.name)
    return records


def parse_mortes_violentas_pdf(pdf_path: Path, year: int, quarter: int | None) -> list[dict]:
    """
    Parse a lethal violence PDF.

    Returns list of dicts with keys: tipo, vitimas, ano, trimestre.
    """
    tables = extract_tables_from_pdf(pdf_path)
    if not tables:
        logger.info("No tables found in %s", pdf_path.name)
        return []

    records: list[dict] = []
    for df in tables:
        if df.shape[1] < 2:
            continue

        cols_lower = [str(c).lower().strip() if c else "" for c in df.columns]

        tipo_col: int | None = None
        vitimas_col: int | None = None

        for i, col in enumerate(cols_lower):
            if any(kw in col for kw in ("tipo", "natureza", "morte", "causa", "crime")):
                tipo_col = i
            if any(kw in col for kw in ("vítima", "vitima", "total", "óbito", "obito", "quant")):
                if vitimas_col is None:
                    vitimas_col = i

        if tipo_col is None:
            tipo_col = 0
        if vitimas_col is None:
            vitimas_col = min(1, df.shape[1] - 1)

        for _, row in df.iterrows():
            tipo_val = str(row.iloc[tipo_col]).strip() if row.iloc[tipo_col] else ""
            if not tipo_val or tipo_val.lower() in ("total", "none", "nan", ""):
                continue
            vit_val = _clean_numeric(row.iloc[vitimas_col])

            records.append({
                "tipo": tipo_val,
                "vitimas": vit_val,
                "ano": year,
                "trimestre": quarter,
            })

    logger.info("Parsed %d lethal violence records from %s", len(records), pdf_path.name)
    return records


def parse_transito_pdf(pdf_path: Path, year: int, quarter: int | None) -> list[dict]:
    """
    Parse a traffic report PDF.

    Returns list of dicts with keys: tipo, ocorrencias, ano, trimestre.
    """
    tables = extract_tables_from_pdf(pdf_path)
    if not tables:
        logger.info("No tables found in %s", pdf_path.name)
        return []

    records: list[dict] = []
    for df in tables:
        if df.shape[1] < 2:
            continue

        tipo_col = 0
        ocorr_col = min(1, df.shape[1] - 1)

        for _, row in df.iterrows():
            tipo_val = str(row.iloc[tipo_col]).strip() if row.iloc[tipo_col] else ""
            if not tipo_val or tipo_val.lower() in ("total", "none", "nan", ""):
                continue
            ocorr_val = _clean_numeric(row.iloc[ocorr_col])

            records.append({
                "tipo": tipo_val,
                "ocorrencias": ocorr_val,
                "ano": year,
                "trimestre": quarter,
            })

    logger.info("Parsed %d traffic records from %s", len(records), pdf_path.name)
    return records


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

_PARSERS = {
    "drogas": parse_drogas_pdf,
    "criminal": parse_criminal_pdf,
    "mortes_violentas": parse_mortes_violentas_pdf,
    "transito": parse_transito_pdf,
}


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def _save_json(data: Any, path: Path) -> None:
    """Write data as JSON to path."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(data, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    size_kb = path.stat().st_size / 1024
    logger.info("Saved %s (%.1f KB)", path.name, size_kb)


def parse_all_pdfs() -> dict[str, list[dict]]:
    """
    Parse all SESP-PR PDFs and return results grouped by report type.

    Returns dict mapping report_type -> list of parsed records.
    """
    if not RAW_DIR.exists():
        logger.warning("Raw PDF directory not found: %s", RAW_DIR)
        return {}

    pdf_files = sorted(RAW_DIR.glob("*.pdf"), reverse=True)
    if not pdf_files:
        logger.warning("No PDF files found in %s", RAW_DIR)
        return {}

    logger.info("Found %d PDF files in %s", len(pdf_files), RAW_DIR)

    results: dict[str, list[dict]] = {
        "drogas": [],
        "criminal": [],
        "mortes_violentas": [],
        "transito": [],
    }

    for pdf_path in pdf_files:
        meta = parse_filename(pdf_path.name)
        if meta is None:
            logger.warning("Skipping unrecognized filename: %s", pdf_path.name)
            continue

        report_type = meta["report_type"]
        parser = _PARSERS.get(report_type)
        if parser is None:
            logger.warning("No parser for report type '%s' (%s)", report_type, pdf_path.name)
            continue

        try:
            records = parser(pdf_path, meta["year"], meta["quarter"])
            results[report_type].extend(records)
        except Exception:
            logger.exception("Failed to parse %s", pdf_path.name)

    for rtype, records in results.items():
        logger.info("Total %s records: %d", rtype, len(records))

    return results


def save_results(results: dict[str, list[dict]]) -> None:
    """Save parsed results to data/processed/ and update dashboard drogas.json."""
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    for report_type, records in results.items():
        output_path = PROCESSED_DIR / f"sesp_pr_{report_type}.json"
        _save_json(records, output_path)

    # Update drogas.json with actual data
    drogas_data = results.get("drogas", [])
    drogas_output = {
        "fonte": "SESP-PR/CAPE relatorios anuais (PDF)",
        "nota": (
            "Dados extraidos automaticamente dos relatorios PDF da SESP-PR. "
            "Alguns PDFs podem nao ter tabelas extraiveis (imagens escaneadas)."
        ),
        "total_registros": len(drogas_data),
        "dados": drogas_data,
    }

    # Save to data/processed/
    _save_json(drogas_output, PROCESSED_DIR / "drogas.json")

    # Also save to dashboard/public/data/ if directory exists
    if DASHBOARD_DIR.exists():
        dashboard_drogas = DASHBOARD_DIR / "drogas.json"
        dashboard_drogas.write_text(
            json.dumps(drogas_output, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
        logger.info("Updated dashboard %s", dashboard_drogas.name)


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )

    logger.info("SESP-PR PDF Parser")
    logger.info("Raw dir : %s", RAW_DIR)
    logger.info("Output  : %s", PROCESSED_DIR)

    results = parse_all_pdfs()

    total = sum(len(v) for v in results.values())
    if total == 0:
        logger.warning("No data extracted from any PDF")
    else:
        logger.info("Total records extracted: %d", total)

    save_results(results)
    logger.info("Done")


if __name__ == "__main__":
    main()
