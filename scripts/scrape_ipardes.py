#!/usr/bin/env python3
"""
scrape_ipardes.py - Three strategies to obtain IPARDES crime data for Paraná.

Strategy 1: basedosdados BigQuery (preferred - structured data)
Strategy 2: BDEweb HTML scraping (IPARDES web tables)
Strategy 3: Caderno Estatístico Tableau (documented only - automated scrape fails)

Falls back through strategies in order. If all automated strategies fail,
prints manual download instructions.
"""

import json
import sys
from pathlib import Path

import requests

BASE_DIR = Path(__file__).parent.parent
RAW_DIR = BASE_DIR / "data" / "raw" / "ipardes"


def ensure_dir() -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)


# ---------------------------------------------------------------------------
# Strategy 1: basedosdados BigQuery
# ---------------------------------------------------------------------------

def strategy_basedosdados() -> bool:
    """
    Query IPARDES data through Base dos Dados BigQuery tables.

    Requires:
      pip install basedosdados
      A valid Google Cloud billing project ID.
    """
    print("\n--- Strategy 1: basedosdados BigQuery ---")
    try:
        import basedosdados as bd  # type: ignore[import-untyped]
    except ImportError:
        print("  [SKIP] basedosdados not installed (pip install basedosdados)")
        return False

    query = """
    SELECT *
    FROM `basedosdados.br_ipardes_estatisticas.municipio`
    WHERE sigla_uf = 'PR'
    ORDER BY ano, id_municipio
    """
    try:
        print("  Running BigQuery query...")
        df = bd.read_sql(query, billing_project_id="seguranca-parana")
        dest = RAW_DIR / "ipardes_basedosdados.csv"
        df.to_csv(dest, index=False, encoding="utf-8")
        print(f"  [OK] Saved {len(df)} rows -> {dest.name}")
        return True
    except Exception as exc:
        print(f"  [FAIL] BigQuery error: {exc}")
        return False


# ---------------------------------------------------------------------------
# Strategy 2: BDEweb HTML scraping
# ---------------------------------------------------------------------------

BDEWEB_URL = (
    "http://www.ipardes.gov.br/imp/index.php"
)

BDEWEB_INDICATORS = {
    "ocorrencias_criminais": {
        "page": "tabela",
        "var": "372",  # Ocorrências criminais
        "desc": "Ocorrências criminais registradas",
    },
    "homicidios_dolosos": {
        "page": "tabela",
        "var": "373",  # Homicídios dolosos
        "desc": "Homicídios dolosos",
    },
    "furtos": {
        "page": "tabela",
        "var": "374",
        "desc": "Furtos",
    },
    "roubos": {
        "page": "tabela",
        "var": "375",
        "desc": "Roubos",
    },
}


def strategy_bdeweb() -> bool:
    """
    Scrape IPARDES BDEweb HTML tables for crime indicators.
    """
    print("\n--- Strategy 2: BDEweb HTML scraping ---")
    try:
        from bs4 import BeautifulSoup
    except ImportError:
        print("  [SKIP] beautifulsoup4 not installed")
        return False

    any_success = False
    for name, meta in BDEWEB_INDICATORS.items():
        dest = RAW_DIR / f"bdeweb_{name}.html"
        if dest.exists():
            print(f"  [skip] {dest.name} already exists")
            any_success = True
            continue

        params = {
            "page": meta["page"],
            "var": meta["var"],
            "Ession": "",
        }
        try:
            print(f"  [GET]  BDEweb var={meta['var']} ({meta['desc']})")
            resp = requests.get(BDEWEB_URL, params=params, timeout=30)
            resp.raise_for_status()

            soup = BeautifulSoup(resp.text, "html.parser")
            tables = soup.find_all("table")
            if not tables:
                print(f"  [WARN] No tables found for {name}")
                continue

            dest.write_text(resp.text, encoding="utf-8")
            print(f"  [OK]   {dest.name} ({len(tables)} tables found)")
            any_success = True

        except Exception as exc:
            print(f"  [FAIL] {name}: {exc}")

    return any_success


# ---------------------------------------------------------------------------
# Strategy 3: Caderno Estatístico Tableau (documentation only)
# ---------------------------------------------------------------------------

def strategy_caderno_tableau() -> bool:
    """
    The IPARDES Caderno Estatístico uses Tableau Public embeds.
    Automated scraping of Tableau is unreliable (JS rendering + API tokens).

    This strategy documents the URLs for manual access.
    """
    print("\n--- Strategy 3: Caderno Estatístico Tableau ---")
    print("  Tableau dashboards require JS rendering; automated scrape fails.")
    print("  Documenting URLs for manual download.\n")

    info = {
        "source": "IPARDES Caderno Estatístico Municipal",
        "base_url": "https://www.ipardes.pr.gov.br/Pagina/Cadernos-municipais",
        "tableau_dashboards": [
            {
                "name": "Segurança Pública",
                "url": "https://www.ipardes.pr.gov.br/Pagina/Cadernos-municipais",
                "notes": (
                    "Select municipality, then 'Segurança Pública' tab. "
                    "Data is rendered via Tableau Public embed. "
                    "Export as CSV/Excel from within Tableau controls."
                ),
            },
        ],
        "manual_steps": [
            "1. Visit https://www.ipardes.pr.gov.br/Pagina/Cadernos-municipais",
            "2. Select a municipality from the dropdown",
            "3. Navigate to the 'Segurança Pública' section",
            "4. In the Tableau embed, click the download icon (bottom-right)",
            "5. Choose 'Crosstab' or 'Data' to export as CSV",
            "6. Save to data/raw/ipardes/caderno_<municipio>.csv",
            "7. Repeat for each municipality of interest (or use AISP groupings)",
        ],
        "alternative": (
            "For bulk data, prefer Strategy 1 (basedosdados) or "
            "Strategy 2 (BDEweb). The Caderno is best for spot checks."
        ),
    }

    dest = RAW_DIR / "caderno_tableau_instructions.json"
    dest.write_text(
        json.dumps(info, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"  [OK] Instructions saved to {dest.name}")
    return False  # not a real data download


# ---------------------------------------------------------------------------
# Fallback instructions
# ---------------------------------------------------------------------------

def print_manual_instructions() -> None:
    print("\n" + "=" * 60)
    print("IPARDES - MANUAL DOWNLOAD INSTRUCTIONS")
    print("=" * 60)
    print("""
All automated strategies failed or were skipped.
To obtain IPARDES data manually:

Option A - Base dos Dados (recommended):
  1. Go to https://basedosdados.org
  2. Search for "ipardes"
  3. Download table "br_ipardes_estatisticas.municipio"
  4. Filter sigla_uf = 'PR'
  5. Save to data/raw/ipardes/ipardes_basedosdados.csv

Option B - BDEweb direct:
  1. Go to http://www.ipardes.gov.br/imp/index.php
  2. Navigate: Dados > Segurança Pública
  3. Select variables and municipalities
  4. Export as CSV
  5. Save to data/raw/ipardes/bdeweb_*.csv

Option C - Caderno Estatístico:
  1. Go to https://www.ipardes.pr.gov.br/Pagina/Cadernos-municipais
  2. Select municipality -> Segurança Pública
  3. Export Tableau data as CSV
  4. Save to data/raw/ipardes/caderno_*.csv
""")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    print("=== IPARDES Data Download ===")
    ensure_dir()

    if strategy_basedosdados():
        print("\n  Strategy 1 succeeded.")
        return

    if strategy_bdeweb():
        print("\n  Strategy 2 succeeded (partial or full).")
        return

    strategy_caderno_tableau()
    print_manual_instructions()


if __name__ == "__main__":
    main()
